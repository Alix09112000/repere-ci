/* Repère CI — présentation des points d'intérêt (sans API secondaire).
   Les noms proviennent des lieux déjà renvoyés par notre serveur. */
const ReperePoi = (() => {
  'use strict';
  const TYPES = Object.freeze({
    pharmacie: Object.freeze({ icone: '✚', couleur: '#D82F51', nom: 'Pharmacie' }),
    sante: Object.freeze({ icone: '⚕', couleur: '#C43C5E', nom: 'Santé' }),
    ecole: Object.freeze({ icone: '🎓', couleur: '#486FD3', nom: 'École' }),
    marche: Object.freeze({ icone: '▣', couleur: '#A7612C', nom: 'Marché' }),
    restaurant: Object.freeze({ icone: '🍴', couleur: '#CF6B21', nom: 'Restaurant' }),
    station: Object.freeze({ icone: '⛽', couleur: '#156AA1', nom: 'Station-service' }),
    banque: Object.freeze({ icone: '▤', couleur: '#6254BD', nom: 'Banque' }),
    commerce: Object.freeze({ icone: '◆', couleur: '#0F8B73', nom: 'Commerce' }),
    autre: Object.freeze({ icone: '●', couleur: '#087F68', nom: 'Repère local' })
  });
  function sansAccent(texte) {
    return String(texte || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function categorie(lieu) {
    const t = sansAccent([lieu?.categorie, lieu?.type, lieu?.libelle].filter(Boolean).join(' '));
    if (/pharma|officine/.test(t)) return 'pharmacie';
    if (/sante|hopital|clinique|dispensaire|medical/.test(t)) return 'sante';
    if (/ecole|universite|lycee|college|enseignement/.test(t)) return 'ecole';
    if (/marche|market/.test(t)) return 'marche';
    if (/restaurant|maquis|cafe|bar|snack/.test(t)) return 'restaurant';
    if (/station|carburant|essence|petrole/.test(t)) return 'station';
    if (/banque|bank|atm|guichet/.test(t)) return 'banque';
    if (/commerce|boutique|shop|magasin/.test(t)) return 'commerce';
    return 'autre';
  }
  function profil(lieu) { return TYPES[categorie(lieu)]; }
  function valide(lieu) {
    if (!lieu || lieu.lat == null || lieu.lng == null ||
        lieu.lat === '' || lieu.lng === '') return false;
    return Number.isFinite(Number(lieu.lat)) &&
      Number.isFinite(Number(lieu.lng)) &&
      Math.abs(Number(lieu.lat)) <= 90 && Math.abs(Number(lieu.lng)) <= 180;
  }
  function selectionner(lieux, distance, maximum = 5) {
    return (Array.isArray(lieux) ? lieux : [])
      .filter(valide)
      .map(lieu => ({ lieu, distance: Number(distance(lieu)) }))
      .filter(item => Number.isFinite(item.distance) && item.distance >= 0)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, Math.max(0, maximum));
  }
  function etiquettes(lieuxProches, projeter, zoom, maximum = 9) {
    if (zoom < 17) return new Set();
    const positions = [];
    const choisis = new Set();
    for (const item of lieuxProches) {
      const nom = String(item.lieu.nom || '').trim();
      if (!nom || nom.length > 65) continue;
      const p = projeter(item.lieu);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (positions.some(q => Math.abs(p.x - q.x) < 100 && Math.abs(p.y - q.y) < 48)) continue;
      positions.push(p);
      choisis.add(item.lieu);
      if (choisis.size >= maximum) break;
    }
    return choisis;
  }
  return Object.freeze({ categorie, profil, valide, selectionner, etiquettes });
})();
