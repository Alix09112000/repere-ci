/* Repère CI V7 — géométries de bâtiments OSM pour MapLibre.
   Aucune élévation n'est prétendue mesurée si la hauteur est inconnue. */
const Repere3DData = (() => {
  'use strict';
  const EMPTY = Object.freeze({type:'FeatureCollection',features:[]});
  function nombre(tag) {
    if (tag == null || typeof tag === 'boolean') return null;
    const match = String(tag).trim().replace(',','.').match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:m|metres|meters)?$/i);
    const v=match ? Number(match[1]) : NaN;
    return Number.isFinite(v) && v>=0 && v<=450 ? v : null;
  }
  function hauteur(tags) {
    const t = tags || {};
    const explicite = nombre(t.height);
    const niveaux = nombre(t['building:levels']);
    const min = nombre(t.min_height);
    const minNiveaux = nombre(t['building:min_level']);
    const base = min != null ? min : minNiveaux != null ? minNiveaux*3 : 0;
    let height;
    let estime = false;
    if (explicite != null) {
      height=explicite;
    } else if (niveaux != null) {
      height=niveaux*3;
      estime=true;
    } else {
      height=7;
      estime=true;
    }
    return {height:Math.max(base+0.5,height),base,estime};
  }
  function rectangle(center, demiLargeur=0.0018) {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) throw Error('Centre invalide');
    // Zone de ~400 m au départ. Ne pas aspirer tout Abidjan depuis une API publique.
    return [
      Number((center.lat-demiLargeur).toFixed(6)),
      Number((center.lng-demiLargeur).toFixed(6)),
      Number((center.lat+demiLargeur).toFixed(6)),
      Number((center.lng+demiLargeur).toFixed(6))
    ];
  }
  function requete(center) {
    const b=rectangle(center);
    return '[out:json][timeout:12];way["building"](' + b.join(',') + ');out geom 180;';
  }
  function estFerme(positions) {
    if (positions.length < 4) return false;
    const a=positions[0],b=positions[positions.length-1];
    return a[0]===b[0]&&a[1]===b[1];
  }
  function convertir(json) {
    const features=[];
    for (const item of (Array.isArray(json?.elements)?json.elements:[]).slice(0,180)) {
      if (item?.type!=='way'||!Array.isArray(item.geometry)||item.geometry.length>200)continue;
      const coords=item.geometry
        .filter(p=>p && Number.isFinite(p.lat) && Number.isFinite(p.lon)
          && Math.abs(p.lat)<=90 && Math.abs(p.lon)<=180)
        .map(p=>[p.lon,p.lat]);
      if(!estFerme(coords))continue;
      const h=hauteur(item.tags);
      features.push({
        type:'Feature',
        properties:{
          osmId:String(item.id || ''),
          height:h.height,
          base:h.base,
          estimated:h.estime
        },
        geometry:{type:'Polygon',coordinates:[coords]}
      });
    }
    return {type:'FeatureCollection',features};
  }
  return Object.freeze({EMPTY,nombre,hauteur,rectangle,requete,convertir});
})();
