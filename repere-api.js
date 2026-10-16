/* Repère CI — noyau applicatif.
   Tout ce qui parle à l'API GeoDeliver, plus le magasin local. Aucune
   dépendance : chargé par un simple <script src>. */

const API = 'https://geodeliver-ci.onrender.com';

/* Clé publique de l'application. Trois routes de l'API — enregistrer un
   repère, nommer un quartier, soumettre une correction — demandent une clé.
   Celle-ci est forcément visible dans le code du navigateur : c'est assumé.
   Ce qui la rend acceptable, c'est qu'elle n'ouvre que ces trois routes, ne
   consomme aucun quota client, et se révoque en changeant CLE_PUBLIQUE sur le
   serveur.

   Doit être IDENTIQUE à la variable CLE_PUBLIQUE sur Render (service API).
   Générée une fois pour cette migration — à ne pas regénérer sans mettre les
   deux côtés à jour en même temps. */
const CLE_PUBLIQUE = 'rc_pub_3GgeTQfUedde2KhEKgRU4qz9-tx7EY4Z';

/* Bornes de la Côte d'Ivoire — les mêmes que geocode.BORNES_CI côté serveur.
   Un point hors de ces bornes est refusé par l'API : autant le dire ici. */
const CI = { latMin: 4.30, latMax: 10.80, lngMin: -8.70, lngMax: -2.40 };
const ABIDJAN = { lat: 5.348, lng: -4.020 };

/* Au-delà de 20 m d'incertitude, le code désigne la porte du voisin : c'est le
   seuil que l'API applique, répété ici pour prévenir avant l'envoi. */
const PRECISION_MAX = 20;

const $ = (id) => document.getElementById(id);

/* ═══ MAGASIN LOCAL ═══
   Tout est préfixé rc_ pour ne jamais toucher aux clés des autres
   applications GeoDeliver servies depuis le même domaine. */
const Store = {
  lire(cle, defaut) {
    try { const v = localStorage.getItem('rc_' + cle); return v === null ? defaut : JSON.parse(v); }
    catch (e) { return defaut; }
  },
  ecrire(cle, val) {
    try { localStorage.setItem('rc_' + cle, JSON.stringify(val)); } catch (e) {}
  },
  appareil() {
    let a = Store.lire('appareil', null);
    if (!a) { a = Math.random().toString(36).slice(2, 10); Store.ecrire('appareil', a); }
    return a;
  }
};

/* ═══ FORMATS ═══ */
const fmt = {
  distance(m) { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'; },
  duree(s) {
    const min = Math.round(s / 60);
    return min >= 60 ? Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') : min + ' min';
  },
  heure(d) {
    return String(d.getHours()).padStart(2, '0') + ' h ' + String(d.getMinutes()).padStart(2, '0');
  }
};

/* ═══ POSITION ═══ */
const Geo = {
  derniere: null,
  /* Un seul chemin pour obtenir la position : il valide les bornes du pays et
     conserve l'incertitude, que les écrans doivent pouvoir montrer. */
  obtenir(onOk, onErr) {
    if (!('geolocation' in navigator)) return onErr && onErr('Ce téléphone ne donne pas la position.');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng, accuracy: precision } = p.coords;
        if (lat < CI.latMin || lat > CI.latMax || lng < CI.lngMin || lng > CI.lngMax)
          return onErr && onErr('Tu sembles hors de Côte d\u2019Ivoire.');
        Geo.derniere = { lat, lng, precision };
        onOk(Geo.derniere);
      },
      () => onErr && onErr('Position refusée. Autorise la localisation pour continuer.'),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  }
};

/* ═══ API ═══ */
const Api = {
  entetes(extra) {
    const h = { 'X-API-Key': CLE_PUBLIQUE };
    const j = Store.lire('jeton', null);
    if (j) h.Authorization = 'Bearer ' + j;
    return Object.assign(h, extra || {});
  },
  async json(chemin, options) {
    const o = Object.assign({}, options);
    o.headers = Api.entetes(o.headers);
    const r = await fetch(API + chemin, o);
    let d = null;
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && d.detail) || ('Erreur ' + r.status));
    return d;
  },
  poster(chemin, corps) {
    return Api.json(chemin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    });
  },


  quartier(lat, lng) { return Api.json('/reverse?lat=' + lat + '&lng=' + lng); },
  decoder(code) { return Api.json('/geocode/decoder/' + encodeURIComponent(code)); },
  /* La position part avec la recherche : sans elle, le serveur classe par nom
     et propose un lieu à soixante kilomètres avant celui du coin de la rue. */
  lieux(q, limite, pos) {
    let u = '/lieux?q=' + encodeURIComponent(q) + '&limite=' + (limite || 12);
    if (pos) u += '&lat=' + pos.lat.toFixed(5) + '&lng=' + pos.lng.toFixed(5);
    return Api.json(u);
  },
  lieuxProches(lat, lng, rayon, categorie) {
    return Api.json('/lieux/proches?lat=' + lat.toFixed(5) + '&lng=' + lng.toFixed(5) +
      '&rayon=' + rayon + '&limite=200' + (categorie ? '&categorie=' + categorie : ''));
  },
  alertes(lat, lng, rayon) {
    return Api.json('/signalements/proches?lat=' + lat.toFixed(5) + '&lng=' + lng.toFixed(5) + '&rayon=' + rayon);
  },
  signaler(corps) { return Api.poster('/signalements', corps); },
  confirmer(id) { return Api.poster('/signalements/' + id + '/confirmer', {}); },
  infirmer(id) { return Api.poster('/signalements/' + id + '/infirmer', {}); },
  statsRoute() { return Api.json('/signalements/stats'); },
  geocoder(corps) { return Api.poster('/geocode', corps); },
  apprendre(corps) { return Api.poster('/apprendre', corps); },

  // Comptes citoyens
  inscription(corps) { return Api.poster('/citoyens/inscription', corps); },
  verifier(email, code) { return Api.poster('/citoyens/verifier', { email: email, code: code }); },
  renvoyer(email) { return Api.poster('/citoyens/renvoyer', { email: email }); },
  connexion(email, mdp) { return Api.poster('/citoyens/connexion', { email: email, mot_de_passe: mdp }); },
  moi() { return Api.json('/citoyens/moi'); },
  apport(genre) { return Api.poster('/citoyens/moi/apport', { genre: genre }); },
  fusion(points) { return Api.poster('/citoyens/moi/fusion?points_locaux=' + (points | 0), {}); },
  syncLieux(lieux, commune) {
    return Api.json('/citoyens/moi/lieux', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lieux: lieux, commune: commune || null })
    });
  },
  classement(commune) {
    return Api.json('/citoyens/classement' + (commune ? '?commune=' + encodeURIComponent(commune) : ''));
  },
  effacerCompte() { return Api.json('/citoyens/moi', { method: 'DELETE' }); }
};

/* ═══ COMPTE ═══
   Le jeton et le profil sont gardés sur l'appareil ; les points et les lieux
   font foi sur le serveur dès qu'un compte existe. */
const Compte = {
  connecte() { return !!Store.lire('jeton', null); },
  ouvrir(jeton, profil) {
    Store.ecrire('jeton', jeton);
    Compte.appliquer(profil);
  },
  /* Le serveur est la référence : ses totaux remplacent les compteurs locaux.
     Les lieux locaux et distants sont fusionnés, puis renvoyés. */
  appliquer(profil) {
    if (!profil) return;
    Store.ecrire('user', { nom: profil.nom, tel: profil.telephone, email: profil.email,
                           commune: profil.commune, pionnier: profil.pionnier });
    Store.ecrire('points', profil.points);
    Store.ecrire('apports', profil.apports);
    const vus = {}, tous = [];
    (Lieux.liste().concat(profil.lieux || [])).forEach((l) => {
      if (l && l.geocode && !vus[l.geocode]) { vus[l.geocode] = 1; tous.push(l); }
    });
    Store.ecrire('lieux', tous.slice(0, 30));
  },
  fermer() {
    ['jeton', 'user'].forEach((k) => localStorage.removeItem('rc_' + k));
  },
  async rafraichir() {
    if (!Compte.connecte()) return null;
    try { const d = await Api.moi(); Compte.appliquer(d.profil); return d.profil; }
    catch (e) {
      // Jeton expiré : on se déconnecte proprement plutôt que d'échouer partout.
      if (/401|Jeton|Connexion requise/.test(String(e.message))) Compte.fermer();
      return null;
    }
  },
  syncLieux() {
    if (!Compte.connecte()) return;
    const u = Store.lire('user', {}) || {};
    Api.syncLieux(Lieux.liste(), u.commune).catch(() => {});
  }
};

/* Robustesse d'un mot de passe : mêmes règles que citoyens.py. */
const MotDePasse = {
  regles(m) {
    return [
      { ok: m.length >= 10, txt: '10 caractères' },
      { ok: /[a-z]/.test(m) && /[A-Z]/.test(m), txt: 'minuscules et majuscules' },
      { ok: /\d/.test(m), txt: 'un chiffre' },
      { ok: /[^A-Za-z0-9]/.test(m), txt: 'un symbole' }
    ];
  },
  valide(m) { return MotDePasse.regles(m).every((r) => r.ok); },
  /* Généré par le générateur cryptographique du navigateur, jamais par
     Math.random. Sans caractères ambigus (0/O, 1/l/I) : il doit pouvoir se
     recopier à la main. */
  generer() {
    const jeux = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?-+'];
    const tous = jeux.join('');
    const n = new Uint32Array(14);
    crypto.getRandomValues(n);
    const c = jeux.map((j, i) => j[n[i] % j.length]);
    for (let i = 4; i < 14; i++) c.push(tous[n[i] % tous.length]);
    for (let i = c.length - 1; i > 0; i--) {
      const r = new Uint32Array(1); crypto.getRandomValues(r);
      const k = r[0] % (i + 1); const t = c[i]; c[i] = c[k]; c[k] = t;
    }
    return c.join('');
  }
};

/* ═══ DESCRIPTION EN LANGAGE LOCAL ═══

   Le cœur du produit : transformer une position en une phrase qu'un Ivoirien
   peut suivre. Trois briques, dans l'ordre où on les dirait à l'oral —
   le quartier, le repère le plus proche, puis deux repères pour trianguler.

   Le calcul est fait ici, côté client, parce que l'API n'a pas encore
   d'endpoint pour cela. Le jour où il existera, cette fonction n'aura plus
   qu'à l'appeler : la forme de la phrase ne changera pas. */
const Description = {
  /* Un repère à plus de 600 m n'aide plus personne à trouver une porte. */
  RAYON: 600,

  async pour(pos) {
    const sortie = { quartier: null, ville: null, reperes: [], phrase: '' };

    const [zone, autour] = await Promise.all([
      Api.quartier(pos.lat, pos.lng).catch(() => null),
      Api.lieuxProches(pos.lat, pos.lng, Description.RAYON).catch(() => null)
    ]);

    if (zone) {
      sortie.quartier = zone.quartier || (zone.zone && zone.zone.nom) || null;
      sortie.ville = zone.ville || null;
    }

    /* Les repères nommés font de meilleurs points d'orientation que les
       boutiques anonymes : on garde ceux qui portent un nom propre, du plus
       proche au plus loin, sans jamais dépasser trois. */
    if (autour && autour.lieux) {
      sortie.reperes = autour.lieux
        .filter((l) => l.nom && l.nom.length > 2)
        .slice(0, 3);
    }

    sortie.phrase = Description.phrase(sortie);
    return sortie;
  },

  phrase(d) {
    const bouts = [];
    const lieu = [d.quartier, d.ville && d.ville !== d.quartier ? d.ville : null]
      .filter(Boolean).join(', ');
    if (lieu) bouts.push(lieu);

    if (d.reperes.length) {
      const p = d.reperes[0];
      bouts.push('à ' + fmt.distance(p.distance_m) + ' de ' + p.nom);
    }
    if (d.reperes.length >= 3) {
      bouts.push('entre ' + d.reperes[1].nom + ' et ' + d.reperes[2].nom);
    }
    if (!bouts.length) return 'Position enregistrée, sans repère connu autour.';
    return bouts.join(' — ') + '.';
  }
};

/* ═══ CONTRIBUTIONS ═══
   Le barème récompense l'effort : un signalement en roulant vaut peu, aller
   relever la porte d'un voisin vaut beaucoup. */
const BAREME = {
  signal: 2, confirmation: 1, repere: 3, photo: 4, commerce: 6, rue: 8, voisin: 10
};

const Points = {
  total() { return Store.lire('points', 0); },
  apports() { return Store.lire('apports', 0); },
  crediter(genre) {
    const p = BAREME[genre] || 0;
    Store.ecrire('points', Points.total() + p);
    Store.ecrire('apports', Points.apports() + 1);
    /* Avec un compte, le serveur applique le barème et ses plafonds ; ses
       totaux remplacent ensuite le compteur local. */
    if (Compte.connecte()) {
      Api.apport(genre).then((d) => {
        Store.ecrire('points', d.points);
        Store.ecrire('apports', d.apports);
      }).catch(() => {});
    }
    return p;
  }
};

/* ═══ LIEUX ENREGISTRÉS ═══ */
const Lieux = {
  liste() { return Store.lire('lieux', []); },
  ajouter(lieu) {
    const l = Lieux.liste().filter((x) => x.geocode !== lieu.geocode);
    l.unshift(Object.assign({ ajoute: Date.now() }, lieu));
    Store.ecrire('lieux', l.slice(0, 30));
    Compte.syncLieux();
  },
  retirer(geocode) {
    Store.ecrire('lieux', Lieux.liste().filter((x) => x.geocode !== geocode));
    Compte.syncLieux();
  },
  partages() { return Store.lire('partages', []); },
  noterPartage(p) {
    const l = Lieux.partages();
    l.unshift(Object.assign({ quand: Date.now() }, p));
    Store.ecrire('partages', l.slice(0, 20));
  }
};

/* ═══ PARTAGE ═══ */
const Partage = {
  /* Le lien pointe vers lieu.html du même dossier : le destinataire ouvre une
     page web, sans rien installer. */
  lien(geocode) {
    const base = location.href.replace(/[^/]*$/, '');
    return base + 'lieu.html?c=' + encodeURIComponent(geocode);
  },
  texte(geocode, phrase, note, expediteur) {
    const bouts = [];
    if (expediteur) bouts.push(expediteur + ' t\u2019envoie un lieu.');
    if (phrase) bouts.push(phrase);
    if (note) bouts.push(note);
    bouts.push('Repère : ' + geocode);
    bouts.push(Partage.lien(geocode));
    return bouts.join('\n');
  },
  whatsapp(txte) { return 'https://wa.me/?text=' + encodeURIComponent(txte); },
  sms(txte) { return 'sms:?&body=' + encodeURIComponent(txte); }
};

/* ═══ TYPES DE SIGNALEMENT ═══
   Durées reprises de signalements.py : elles sont affichées à l'utilisateur,
   les deux listes doivent rester d'accord. */
const SIGNAUX = [
  { id: 'embouteillage', nom: 'Embouteillage', duree: '45 min',
    svg: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
  { id: 'accident', nom: 'Accident', duree: '2 h',
    svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v1"/>' },
  { id: 'inondation', nom: 'Inondation', duree: '6 h',
    svg: '<path d="M3 15c3-3 6 3 9 0s6-3 9 0M3 20c3-3 6 3 9 0s6-3 9 0"/>' },
  { id: 'route_coupee', nom: 'Route coupée', duree: '12 h',
    svg: '<path d="M4 12h16M8 6l8 12"/>' },
  { id: 'barrage', nom: 'Barrage', duree: '1 h 30',
    svg: '<path d="M3 9h18v6H3z"/><path d="M7 9v6M12 9v6M17 9v6"/>' },
  { id: 'travaux', nom: 'Travaux', duree: '7 jours',
    svg: '<path d="M3 20h18"/><path d="M6 20V9l6-5 6 5v11"/>' },
  { id: 'nid_de_poule', nom: 'Nid-de-poule', duree: '30 jours',
    svg: '<ellipse cx="12" cy="14" rx="7" ry="4"/><path d="M5 14c0-4 3-7 7-7"/>' },
  { id: 'danger', nom: 'Autre danger', duree: '3 h',
    svg: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/>' }
];

/* Les cinq façons d'enrichir la base d'adresses. */
const APPORTS = [
  { id: 'voisin', titre: 'Enregistrer l\u2019adresse d\u2019un voisin', sous: 'Sa porte, avec son accord' },
  { id: 'repere', titre: 'Confirmer ou corriger un repère', sous: 'Dix secondes, sur place' },
  { id: 'commerce', titre: 'Ajouter un commerce absent', sous: 'Boutique, maquis, atelier' },
  { id: 'photo', titre: 'Décrire un portail', sous: 'Ce que le livreur cherche des yeux' },
  { id: 'rue', titre: 'Nommer une rue ou une allée', sous: 'Le nom que les gens emploient' }
];

const CATEGORIES = [
  { id: '', nom: 'Tout' }, { id: 'pharmacie', nom: 'Pharma' }, { id: 'marche', nom: 'Marchés' },
  { id: 'ecole', nom: 'Écoles' }, { id: 'sante', nom: 'Santé' }, { id: 'commerce', nom: 'Boutiques' },
  { id: 'restaurant', nom: 'Maquis' }, { id: 'station', nom: 'Stations' }, { id: 'banque', nom: 'Banques' }
];

const ATTRIBUTION = '© les contributeurs OpenStreetMap';
