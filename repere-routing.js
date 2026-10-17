/* Repère Maps V5 — routage multimodal.
   Valhalla : moteur OSM avec profils auto / bicycle / pedestrian.
   Service public de démonstration FOSSGIS, limité en capacité :
   prévoir une instance dédiée ou un fournisseur contractuel avant un
   déploiement public à grande échelle. Aucune API secrète dans le client. */
const RepereRouting = (() => {
  'use strict';
  const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
  const OSRM_CAR = 'https://router.project-osrm.org/route/v1/driving/';
  const MODES = Object.freeze({
    voiture: { costing: 'auto', libelle: 'Voiture' },
    velo: { costing: 'bicycle', libelle: 'Vélo' },
    pied: { costing: 'pedestrian', libelle: 'À pied' }
  });
  const PARAMETRES = Object.freeze({
    mode: 'voiture', critere: 'rapide', autoroutes: 'normal', sansPeage: false
  });
  const prend = (objet, liste, defaut) => liste.includes(objet) ? objet : defaut;

  function options(entree) {
    const v = Object.assign({}, PARAMETRES, entree || {});
    const mode = prend(v.mode, Object.keys(MODES), PARAMETRES.mode);
    const critere = prend(v.critere, ['rapide', 'court', 'alternatives'], PARAMETRES.critere);
    const autoroutes = mode === 'voiture'
      ? prend(v.autoroutes, ['normal', 'eviter', 'favoriser'], 'normal') : 'normal';
    return { mode, critere, autoroutes, sansPeage: mode === 'voiture' && v.sansPeage === true };
  }

  function validPoint(p) {
    return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) &&
      Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;
  }

  function requeteValhalla(depart, arrivee, choix) {
    if (!validPoint(depart) || !validPoint(arrivee)) throw Error('Coordonnées du trajet invalides.');
    const o = options(choix), costing = MODES[o.mode].costing;
    const preference = {};
    if (o.critere === 'court') preference.shortest = true;
    if (o.mode === 'voiture') {
      preference.use_highways = o.autoroutes === 'eviter' ? 0
        : o.autoroutes === 'favoriser' ? 1 : 0.5;
      if (o.sansPeage) preference.use_tolls = 0;
    }
    return {
      locations: [
        { lat: Number(depart.lat), lon: Number(depart.lng) },
        { lat: Number(arrivee.lat), lon: Number(arrivee.lng) }
      ],
      costing,
      costing_options: { [costing]: preference },
      // Valhalla fournit des instructions OSRM exploitables par Nav.direManoeuvre.
      format: 'osrm',
      shape_format: 'geojson',
      units: 'km',
      language: 'fr-FR',
      alternates: 3
    };
  }

  function classer(routes, choix) {
    const o = options(choix);
    const axe = o.critere === 'court' || o.critere === 'alternatives' ? 'distance' : 'duration';
    const order = routes.slice().sort((a, b) => o.critere === 'alternatives'
      ? b.distance - a.distance : a[axe] - b[axe]);
    // Une proposition unique ne devient jamais une « plus longue » garantie.
    return order;
  }

  function validerReponse(payload, choix) {
    if (!payload || !Array.isArray(payload.routes)) throw Error('Réponse du calculateur invalide.');
    const bonnes = payload.routes.filter(route =>
      route && Number.isFinite(route.duration) && route.duration >= 0 &&
      Number.isFinite(route.distance) && route.distance >= 0 &&
      route.geometry && route.geometry.type === 'LineString' &&
      Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length >= 2 &&
      Array.isArray(route.legs) && route.legs.length > 0 &&
      Array.isArray(route.legs[0].steps)
    );
    if (!bonnes.length) throw Error('Aucun itinéraire disponible pour ce mode.');
    return {
      routes: classer(bonnes, choix),
      options: options(choix),
      alternativesDisponibles: bonnes.length > 1,
      source: payload.source || 'Valhalla'
    };
  }

  async function recuperer(url, init, signal) {
    const reponse = await fetch(url, Object.assign({ signal }, init || {}));
    if (!reponse.ok) {
      if (reponse.status === 429) throw Error('Service de routage temporairement surchargé. Réessaie plus tard.');
      throw Error('Calcul indisponible pour ce mode (HTTP ' + reponse.status + ').');
    }
    return reponse.json();
  }

  function repliOSRMPermis(choix) {
    const c = options(choix);
    // Ne JAMAIS remplacer un itinéraire vélo/piéton ou « sans autoroute »
    // par un itinéraire voiture standard : ce serait trompeur.
    return c.mode === 'voiture' && c.critere === 'rapide' &&
      c.autoroutes === 'normal' && !c.sansPeage;
  }

  async function calculer(depart, arrivee, choix, signal) {
    const o = options(choix);
    const valhalla = requeteValhalla(depart, arrivee, o);
    const url = VALHALLA + '?json=' + encodeURIComponent(JSON.stringify(valhalla));
    try {
      // Identifiant demandé par FOSSGIS pour les applications publiques.
      const d = await recuperer(url, { headers: { 'X-Client-Id': 'alix09112000.github.io/repere-ci' } }, signal);
      return validerReponse(d, o);
    } catch (erreur) {
      if (signal && signal.aborted) throw erreur;
      if (!repliOSRMPermis(o)) throw erreur;
      const p = [depart, arrivee].map(v => Number(v.lng) + ',' + Number(v.lat)).join(';');
      const u = OSRM_CAR + p + '?overview=full&geometries=geojson&steps=true&alternatives=3';
      const d = await recuperer(u, {}, signal);
      return validerReponse(Object.assign({}, d, { source: 'OSRM (secours voiture)' }), o);
    }
  }

  return Object.freeze({ options, requeteValhalla, classer, validerReponse, repliOSRMPermis, calculer, MODES });
})();
