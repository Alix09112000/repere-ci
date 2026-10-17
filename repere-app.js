/* Repère CI — logique d'écran.
   Charge après repere-api.js, qui porte l'API, le magasin et les barèmes. */

const S = {
  code: Store.lire('code', null),
  phrase: Store.lire('phrase', null),
  note: Store.lire('note', ''),
  reperes: [],
  alertes: [],
  nbLieux: null,
  filtre: '',
  user: Store.lire('user', null),
  signalChoisi: null
};

/* ═══ INCRUSTATIONS ═══ */
function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 2800);
}

const feuille = $('feuille');
$('fFermer').addEventListener('click', () => feuille.classList.remove('on'));
feuille.addEventListener('click', (e) => { if (e.target === feuille) feuille.classList.remove('on'); });

function ouvrirFeuille(titre) {
  $('fTitre').textContent = titre;
  $('fCorps').innerHTML = '';
  feuille.classList.add('on');
  return $('fCorps');
}

/* Un champ étiqueté, monté dans un conteneur. Évite de répéter la même
   structure sept fois dans les formulaires. */
function champ(parent, etiquette, placeholder, multi) {
  const w = document.createElement('div');
  w.className = 'grp';
  const l = document.createElement('span');
  l.className = 'lab';
  l.textContent = etiquette;
  const f = document.createElement(multi ? 'textarea' : 'input');
  f.className = 'fld';
  f.placeholder = placeholder || '';
  w.append(l, f);
  parent.appendChild(w);
  return f;
}

/* ═══ NAVIGATION ENTRE ÉCRANS ═══ */
document.querySelectorAll('#tabs button').forEach((b) => {
  b.addEventListener('click', () => allerA(b.dataset.scr));
});

function allerA(id) {
  document.querySelectorAll('.scr').forEach((x) => x.classList.remove('on'));
  $(id).classList.add('on');
  document.querySelectorAll('#tabs button').forEach((x) => {
    x.classList.toggle('on', x.dataset.scr === id);
  });
  if (id === 'scrCarte') setTimeout(() => map.invalidateSize(), 60);
  if (id === 'scrPartager') setTimeout(() => minimap && minimap.invalidateSize(), 60);
  if (id === 'scrLieux') majLieux();
  if (id === 'scrRoute') { majAlertes(); chargerStatsRoute(); }
  if (id === 'scrProfil') majProfil();
}

$('btnAllerPartager').addEventListener('click', () => allerA('scrPartager'));
$('btnAllerLieux').addEventListener('click', () => allerA('scrLieux'));

/* ═══ CARTE ═══ */
const carre = (taille, couleur, plein) => L.divIcon({
  className: '', iconSize: [taille + 6, taille + 6], iconAnchor: [(taille + 6) / 2, (taille + 6) / 2],
  html: '<div style="width:' + (taille + 6) + 'px;height:' + (taille + 6) + 'px;border-radius:50%;' +
        'background:' + (plein ? couleur : '#fff') + ';border:3px solid ' + (plein ? '#fff' : couleur) + ';' +
        'box-shadow:0 2px 8px rgba(10,40,50,.25)' + (plein && taille >= 15 ? ',0 0 0 10px rgba(15,118,110,.16)' : '') + '"></div>'
});

/* Losange rouge pour les signalements : distinct au premier coup d'œil des
   carrés noirs qui portent les repères. L'opacité dit la fiabilité. */
const losange = (fiabilite) => L.divIcon({
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div style="width:14px;height:14px;margin:3px;transform:rotate(45deg);' +
        'background:#D97706;border:2px solid #fff;border-radius:4px;box-shadow:0 2px 6px rgba(146,64,14,.35);opacity:' +
        Math.max(0.35, (fiabilite || 60) / 100).toFixed(2) + '"></div>'
});

const map = L.map('map', { zoomControl: false, attributionControl: true })
  .setView([ABIDJAN.lat, ABIDJAN.lng], 14);
/* Les deux vues utilisent des données OSM réelles : la vue Repères
   privilégie les écoles, points de soin et autres lieux utiles.
   Elle ne prétend pas être une imagerie satellite. */
const fondPlan = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd', maxZoom: 20, maxNativeZoom: 19
});
const fondDetails = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · style <a href="https://www.hotosm.org/">HOT</a> · hébergement OSM France',
  maxZoom: 19, subdomains: 'abc'
});
/* Optional satellite provider: configure an authorized XYZ tile endpoint.
   No imagery is fetched until a provider URL has been configured. */
const SATELLITE_URL = window.REPERE_SATELLITE_TILE_URL || '';
const fondSatellite = SATELLITE_URL ? L.tileLayer(SATELLITE_URL, {
  attribution: window.REPERE_SATELLITE_ATTRIBUTION || 'Imagerie : fournisseur configuré',
  maxZoom: 20, maxNativeZoom: 19
}) : null;
const fondsCarte = { plan: fondPlan, details: fondDetails, ...(fondSatellite ? {satellite:fondSatellite} : {}) };
let fondActif = ['plan','details','satellite'].includes(Store.lire('fondCarte','plan')) && fondsCarte[Store.lire('fondCarte','plan')] ? Store.lire('fondCarte','plan') : 'plan';
fondsCarte[fondActif].addTo(map);
map.attributionControl.setPrefix('');

function choisirFondCarte(type) {
  if (!(type in fondsCarte)) return;
  if (type !== fondActif) {
    map.removeLayer(fondsCarte[fondActif]);
    fondActif = type;
    fondsCarte[type].addTo(map);
    fondsCarte[type].bringToBack();
    Store.ecrire('fondCarte', type);
  }
  $('repereMapPlan').setAttribute('aria-pressed', String(type === 'plan'));
  $('repereMapDetail').setAttribute('aria-pressed', String(type === 'details'));
  $('repereMapSatellite')?.setAttribute('aria-pressed', String(type === 'satellite'));
}
$('repereMapPlan').addEventListener('click', () => choisirFondCarte('plan'));
$('repereMapDetail').addEventListener('click', () => choisirFondCarte('details'));
$('repereMapSatellite')?.addEventListener('click', () => {
  if (!fondSatellite) { toast('Satellite : une source d’imagerie autorisée doit être configurée.'); return; }
  if (window.Repere3D?.isActive?.()) window.Repere3D.leave();
  choisirFondCarte('satellite');
});
if(fondSatellite) $('repereSatelliteStatus').textContent='Imagerie aérienne';
choisirFondCarte(fondActif);

/* Regroupement natif via Leaflet.markercluster, avec repli sans plugin.
   Les lieux se séparent progressivement au zoom : 200 repères ne cachent
   plus les rues lorsque l'utilisateur explore un quartier. */
const coucheLieux = typeof L.markerClusterGroup === 'function'
  ? L.markerClusterGroup({
      maxClusterRadius: zoom => zoom < 13 ? 72 : zoom < 16 ? 58 : 42,
      disableClusteringAtZoom: 18,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction(cluster) {
        return L.divIcon({
          html: '<span>' + cluster.getChildCount() + '</span>',
          className: 'repere-cluster',
          iconSize: L.point(42, 42)
        });
      }
    }).addTo(map)
  : L.layerGroup().addTo(map);
const coucheAlertes = L.layerGroup().addTo(map);
const coucheAlternatives = L.layerGroup().addTo(map);
const coucheTrajet = L.layerGroup().addTo(map);
let coucheParcourue = null; // Portion réellement suivie grâce aux relevés GPS.
let marqueurMoi = null;
let marqueurDest = null;

/* Carte réduite de l'écran Partager : le même fond, sans commandes. */
let minimap = null;
function monterMinimap() {
  if (minimap) return;
  minimap = L.map('minimap', {
    zoomControl: false, attributionControl: false, dragging: false,
    scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false
  }).setView([ABIDJAN.lat, ABIDJAN.lng], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(minimap);
}

/* ═══ FILTRES DE CATÉGORIE ═══
   Montés dans une bande qui défile ; l'étiquette reste courte pour qu'aucun
   mot ne soit coupé. */
const bandeFiltres = document.createElement('div');
bandeFiltres.className = 'filtres';
CATEGORIES.forEach((c) => {
  const b = document.createElement('button');
  b.className = 'chip' + (c.id === S.filtre ? ' acc' : '');
  b.textContent = c.nom;
  b.dataset.cat = c.id;
  b.addEventListener('click', () => {
    S.filtre = c.id;
    bandeFiltres.querySelectorAll('.chip').forEach((x) => x.classList.toggle('acc', x.dataset.cat === S.filtre));
    chargerLieux();
  });
  bandeFiltres.appendChild(b);
});
document.querySelector('#scrCarte .mapwrap').appendChild(bandeFiltres);

/* ═══ REPÈRES SUR LA CARTE ═══ */
/* ═══ RÉVEIL DU SERVEUR ═══
   Render gratuit endort le service après 15 min sans appel : la première
   requête qui le relance peut prendre jusqu'à une minute. Sans message,
   c'est indiscernable d'une panne. On prévient une seule fois par session,
   seulement si ça traîne vraiment, et seulement si rien n'a encore réussi. */
let reveilMinuteur = setTimeout(() => {
  reveilMinuteur = null;
  toast('Le serveur se réveille après une pause — ça peut prendre jusqu’à une minute la première fois.');
}, 4000);
function serveurEstReveille() {
  if (reveilMinuteur) { clearTimeout(reveilMinuteur); reveilMinuteur = null; }
}

let chargeEnCours = null;
/* Les points GeoDeliver sont situés en Côte d'Ivoire. La carte OSM, elle,
   peut être explorée partout : éviter les requêtes hors couverture et
   expliquer clairement l'absence de repères. */
function carteDansCI() {
  const c = map.getCenter();
  return c.lat >= CI.latMin && c.lat <= CI.latMax &&
         c.lng >= CI.lngMin && c.lng <= CI.lngMax;
}
/* Marqueurs nommés, lisibles au zoom rapproché. Aucun nom API n'entre
   dans du HTML : les libellés sont toujours ajoutés par textContent. */
function iconeLieu(lieu) {
  const p = ReperePoi.profil(lieu);
  return L.divIcon({
    className: 'repere-marker-icon', iconSize: [36, 42],
    iconAnchor: [18, 40], popupAnchor: [0, -34], tooltipAnchor: [0, -35],
    html: '<span class="repere-place-marker" style="--poi-color:' + p.couleur + '">' +
          '<span class="repere-place-marker-inner">' + p.icone + '</span></span>'
  });
}
function listeRepereAutour(lieux, message) {
  const boite = $('repereNearbyItems'), nombre = $('repereNearbyCount');
  boite.replaceChildren();
  if (message || !Array.isArray(lieux) || lieux.length === 0) {
    nombre.textContent = lieux && lieux.length === 0 ? '0 repère' : '—';
    const info = document.createElement('span');
    info.className = 'repere-nearby-empty';
    info.textContent = message || 'Aucun lieu référencé autour du centre de la carte.';
    boite.appendChild(info);
    return;
  }
  const centre = map.getCenter();
  const proches = ReperePoi.selectionner(lieux,
    l => map.distance(centre, L.latLng(Number(l.lat), Number(l.lng))), 5);
  nombre.textContent = lieux.length + ' trouvé' + (lieux.length > 1 ? 's' : '');
  for (const entree of proches) {
    const l = entree.lieu, p = ReperePoi.profil(l);
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'repere-nearby-item';
    bouton.setAttribute('aria-label', 'Afficher le lieu ' + String(l.nom || p.nom));
    const icone = document.createElement('span');
    icone.className = 'repere-nearby-icon';
    icone.style.setProperty('--poi-color', p.couleur);
    icone.textContent = p.icone;
    icone.setAttribute('aria-hidden', 'true');
    const bloc = document.createElement('span');
    bloc.className = 'repere-nearby-text';
    const titre = document.createElement('strong');
    titre.textContent = String(l.nom || p.nom);
    const sous = document.createElement('small');
    sous.textContent = p.nom + ' · ' + fmt.distance(entree.distance) + ' du centre';
    bloc.append(titre, sous);
    const fleche = document.createElement('span');
    fleche.textContent = '›';
    fleche.className = 'repere-nearby-arrow';
    fleche.setAttribute('aria-hidden', 'true');
    bouton.append(icone, bloc, fleche);
    bouton.addEventListener('click', () => {
      allerA('scrCarte');
      map.setView([Number(l.lat), Number(l.lng)], 17, { animate: true });
      ouvrirFicheLieu(l);
    });
    boite.appendChild(bouton);
  }
}

async function chargerLieux() {
  const c = map.getCenter();
  const rayon = Math.min(3000, Math.round(map.getBounds().getNorthEast().distanceTo(c)));
  const cle = c.lat.toFixed(4) + c.lng.toFixed(4) + rayon + S.filtre;
  chargeEnCours = cle;
  if (!carteDansCI()) {
    coucheLieux.clearLayers();
    if (typeof Repere3D !== 'undefined') Repere3D.updatePlaces([]);
    listeRepereAutour([], 'Les lieux référencés sont actuellement disponibles en Côte d’Ivoire.');
    S.nbLieux = 0;
    majEtat();
    return;
  }
  try {
    const d = await Api.lieuxProches(c.lat, c.lng, rayon, S.filtre);
    serveurEstReveille();
    if (chargeEnCours !== cle) return;   // une requête plus récente a pris la main
    coucheLieux.clearLayers();
    const lieux = (d.lieux || []).filter(ReperePoi.valide);
    const centre = map.getCenter();
    const classement = ReperePoi.selectionner(lieux,
      l => map.distance(centre, L.latLng(Number(l.lat), Number(l.lng))), 200);
    const etiquetes = ReperePoi.etiquettes(classement,
      l => map.latLngToContainerPoint([Number(l.lat), Number(l.lng)]),
      map.getZoom(), 9);
    lieux.forEach((l) => {
      const marqueur = L.marker([Number(l.lat), Number(l.lng)], {
        icon: iconeLieu(l), title: String(l.nom || 'Repère local'), keyboard: true
      }).bindPopup(popupLieu(l));
      if (l.nom) {
        const texte = document.createElement('span');
        texte.textContent = String(l.nom);
        marqueur.bindTooltip(texte, {
          permanent: etiquetes.has(l), direction: 'top',
          className: 'repere-place-label', opacity: 1, offset: [0, -4]
        });
      }
      marqueur.addTo(coucheLieux);
    });
    listeRepereAutour(lieux);
    if (typeof Repere3D !== 'undefined') Repere3D.updatePlaces(lieux);
    S.nbLieux = lieux.length;
  } catch (e) {
    if (chargeEnCours !== cle) return;
    S.nbLieux = null;
    if (typeof Repere3D !== 'undefined') Repere3D.updatePlaces([]);
    listeRepereAutour(null, 'Impossible de charger les lieux. Vérifiez la connexion ou réessayez.');
  }
  majEtat();
}

/* Toucher le bandeau d'état relance le chargement quand il affiche l'échec :
   plus besoin de rebouger la carte pour réessayer. */
$('carteEtat').addEventListener('click', () => {
  if (!carteDansCI() || S.nbLieux !== null) return;
  toast('Nouvelle tentative…');
  chargerLieux();
  chargerAlertes();
});

/* Une fiche unique sert aux résultats de recherche et aux repères sur la carte.
   Aucune donnée provenant de l'API n'est interpolée en HTML. */
function coordonneesLieu(l) {
  const lat = Number(l && l.lat), lng = Number(l && l.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

function ouvrirFicheLieu(l) {
  const nom = String(l.nom || l.geocode || 'Lieu sans nom');
  const coord = coordonneesLieu(l);
  const corps = ouvrirFeuille(nom);
  const bloc = document.createElement('div');
  bloc.className = 'repere-place-card';
  const type = document.createElement('span');
  type.className = 'repere-place-type';
  type.textContent = String(l.libelle || l.etiquette || 'Repère local');
  bloc.appendChild(type);

  const details = [l.commune, l.quartier, l.ville]
    .filter(Boolean).map(String).filter((v, i, all) => all.indexOf(v) === i);
  if (l.distance_m != null && Number.isFinite(Number(l.distance_m)) && Number(l.distance_m) >= 0) {
    details.push('À ' + fmt.distance(Number(l.distance_m)));
  }
  if (details.length) {
    const info = document.createElement('p');
    info.className = 'repere-place-description';
    info.textContent = details.join(' · ');
    bloc.appendChild(info);
  }
  if (l.geocode) {
    const code = document.createElement('div');
    code.className = 'repere-place-code';
    const identifier = document.createElement('span');
    identifier.textContent = 'GeoCode';
    const value = document.createElement('strong');
    value.textContent = String(l.geocode);
    code.append(identifier, value);
    bloc.appendChild(code);
  }
  corps.appendChild(bloc);

  const boutons = document.createElement('div');
  boutons.className = 'repere-place-actions';
  const bouton = (texte, style, action) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'repere-place-action ' + style;
    b.textContent = texte;
    b.addEventListener('click', action);
    boutons.appendChild(b);
    return b;
  };
  const trajet = bouton('Itinéraire', 'primaire', () => {
    if (!coord) return toast('Coordonnées de ce lieu indisponibles.');
    feuille.classList.remove('on');
    window.allerVers(coord.lat, coord.lng, nom);
  });
  if (!coord) trajet.disabled = true;
  const carte = bouton('Voir sur la carte', 'secondaire', () => {
    if (!coord) return toast('Coordonnées de ce lieu indisponibles.');
    feuille.classList.remove('on');
    allerA('scrCarte');
    map.setView([coord.lat, coord.lng], 17, { animate: true });
  });
  if (!coord) carte.disabled = true;
  if (l.geocode) bouton('Copier le GeoCode', 'secondaire', async () => {
    try {
      await navigator.clipboard.writeText(String(l.geocode));
      toast('GeoCode copié.');
    } catch (_) { toast('Copie indisponible sur cet appareil.'); }
  });
  corps.appendChild(boutons);
}

function popupLieu(l) {
  const conteneur = document.createElement('div');
  conteneur.className = 'repere-map-popup';
  const titre = document.createElement('strong');
  titre.textContent = String(l.nom || 'Lieu');
  const description = document.createElement('span');
  description.textContent = String(l.libelle || 'Repère local');
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'chip acc';
  action.textContent = 'Voir la fiche du lieu';
  action.addEventListener('click', () => {
    map.closePopup();
    ouvrirFicheLieu(l);
  });
  conteneur.append(titre, description, action);
  return conteneur;
}

/* ═══ SIGNALEMENTS SUR LA CARTE ═══ */
let alertesChargeId = 0;
async function chargerAlertes() {
  const numero = ++alertesChargeId;
  if (!carteDansCI()) {
    S.alertes = [];
    coucheAlertes.clearLayers();
    majAlertes();
    majEtat();
    majAlerteProche();
    return;
  }
  const c = map.getCenter();
  const rayon = Math.min(6000, Math.round(map.getBounds().getNorthEast().distanceTo(c)));
  try {
    const d = await Api.alertes(c.lat, c.lng, rayon);
    if (numero !== alertesChargeId || !carteDansCI()) return;
    serveurEstReveille();
    S.alertes = d.signalements || [];
    coucheAlertes.clearLayers();
    S.alertes.forEach((a) => {
      L.marker([a.lat, a.lng], { icon: losange(a.fiabilite) })
        .bindPopup(popupAlerte(a))
        .addTo(coucheAlertes);
    });
  } catch (e) {
    if (numero !== alertesChargeId || !carteDansCI()) return;
    S.alertes = [];
    const l = $('listeAlertes');
    l.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'empty';
    b.style.cssText = 'width:100%;border:0;background:none;cursor:pointer;color:inherit;font:inherit';
    b.innerHTML = 'Signalements indisponibles.<br/><span style="text-decoration:underline">Toucher pour réessayer.</span>';
    b.addEventListener('click', () => { chargerAlertes(); chargerStatsRoute(); });
    l.appendChild(b);
    $('rAutour').textContent = '—';
  }
  majAlertes();
  majEtat();
  majAlerteProche();
}

function popupAlerte(a) {
  return '<strong>' + a.libelle + '</strong><br/>' +
    (a.commentaire ? a.commentaire + '<br/>' : '') +
    'Il y a ' + a.age_min + ' min · ' + a.confirmations + ' confirmation(s)' +
    '<br/><button class="chip acc" style="margin-top:8px" onclick="confirmerAlerte(' + a.id + ')">Toujours là</button>' +
    ' <button class="chip dim" style="margin-top:8px" onclick="infirmerAlerte(' + a.id + ')">C\u2019est fini</button>';
}

window.confirmerAlerte = async (id) => {
  try {
    await Api.confirmer(id);
    map.closePopup();
    toast('Merci, c\u2019est confirmé. +' + Points.crediter('confirmation') + ' point.');
    chargerAlertes();
  } catch (e) { toast('Envoi impossible.'); }
};

window.infirmerAlerte = async (id) => {
  try {
    const d = await Api.infirmer(id);
    map.closePopup();
    Points.crediter('confirmation');
    toast(d.retire ? 'Signalement retiré.' : 'Merci, c\u2019est noté.');
    chargerAlertes();
  } catch (e) { toast('Envoi impossible.'); }
};

/* Une seule ligne pour les deux couches. L'attribution OpenStreetMap reste à
   droite, portée par Leaflet : la licence ODbL l'exige. */
function majEtat() {
  const horsCI = !carteDansCI();
  const bouts = [horsCI ? 'Repères disponibles en Côte d’Ivoire'
    : (S.nbLieux === null ? 'Repères indisponibles — toucher pour réessayer' : S.nbLieux + ' repères')];
  if (S.alertes.length) bouts.push(S.alertes.length + ' alerte' + (S.alertes.length > 1 ? 's' : ''));
  const el = $('carteEtat');
  el.textContent = bouts.join(' · ');
  el.style.color = S.alertes.length ? 'var(--accent)' : 'var(--ink-70)';
  el.style.cursor = !horsCI && S.nbLieux === null ? 'pointer' : '';
  el.style.textDecoration = !horsCI && S.nbLieux === null ? 'underline' : 'none';
}

/* L'accueil ne montre qu'une alerte : la plus proche. Le reste est dans
   l'écran Route, atteint en touchant cette ligne. */
function majAlerteProche() {
  const el = $('alertePlusProche');
  if (!S.alertes.length) { el.innerHTML = ''; return; }
  const a = S.alertes[0];
  el.innerHTML = '';
  const b = document.createElement('button');
  b.className = 'alerte';
  b.style.borderBottom = '0';
  b.style.paddingBottom = '0';
  b.innerHTML = '<span class="pip"></span>' +
    '<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">' +
    '<span style="font-size:14px;font-weight:700;line-height:1.3">' + a.libelle +
    (a.commentaire ? ' · ' + a.commentaire : '') + '</span></span>' +
    '<span class="sub" style="flex:none;font-weight:700">' + fmt.distance(a.distance_m) + '</span>';
  b.addEventListener('click', () => allerA('scrRoute'));
  el.appendChild(b);
}

map.on('moveend', () => {
  chargerLieux(); chargerAlertes();
  if (typeof Repere3D !== 'undefined') Repere3D.syncLeaflet();
});

/* ═══ MA POSITION ═══ */
function localiser(onOk, onErr) {
  Geo.obtenir((p) => {
    if (marqueurMoi) map.removeLayer(marqueurMoi);
    marqueurMoi = L.marker([p.lat, p.lng], { icon: carre(15, '#0F766E', true) }).addTo(map);
    if (typeof Repere3D !== 'undefined') Repere3D.updatePosition(p,false);
    onOk(p);
  }, onErr);
}

$('btnRecentrer').addEventListener('click', () => {
  localiser((p) => { map.setView([p.lat, p.lng], 17); }, (m) => toast(m));
});

/* ═══ TRAJET MULTIMODAL A → B ═══ */
let derniereDestination = null;
let controleTrajet = null;
let minuteurOptions = null;
function lireOptionsTrajet() {
  return RepereRouting.options({
    mode: document.querySelector('input[name="routeMode"]:checked')?.value,
    critere: 'rapide', // classement automatique, sans sélecteur technique
    autoroutes: $('routeAutoroutes').value,
    sansPeage: $('routeSansPeage').checked
  });
}
function ajusterOptionsTrajet() {
  const o = lireOptionsTrajet();
  $('routeOptionsVoiture').hidden = o.mode !== 'voiture';
  const noms = { voiture:'VOITURE', velo:'VÉLO', pied:'À PIED' };
  document.querySelector('.repere-route-eyebrow').textContent = 'VOTRE ITINÉRAIRE · ' + noms[o.mode];
  $('trajet').dataset.mode = o.mode;
  const libelleTraces = {
    voiture: 'Tracé routier continu — voiture',
    velo: 'Tracé bleu segmenté — vélo',
    pied: 'Tracé orange pointillé — à pied'
  };
  $('repereRouteVisualDescription').textContent = libelleTraces[o.mode];
  $('routeModeInfo').textContent = o.autoroutes !== 'normal' && o.mode === 'voiture'
    ? 'Itinéraire automatique. L’évitement des autoroutes reste une préférence.'
    : 'Meilleur trajet proposé automatiquement, alternatives comparées si disponibles.';
}
$('repereRoutingControls').addEventListener('change', () => {
  if (Nav.actif) return; // ne jamais changer de mode pendant le guidage
  ajusterOptionsTrajet();
  if (!derniereDestination) return;
  // Grouper les changements successifs pour ne pas solliciter le service public.
  clearTimeout(minuteurOptions);
  // Invalider immédiatement la requête en cours : le délai anti-rebond
  // ne doit pas permettre à un ancien résultat d'écraser les nouveaux critères.
  ++sequenceTrajet;
  if (controleTrajet) controleTrajet.abort();
  $('btnDemarrer').disabled = true;
  $('routeModeInfo').textContent = 'Recalcul pour les nouvelles préférences…';
  minuteurOptions = setTimeout(() => {
    tracerTrajet(derniereDestination.dest, derniereDestination.nom);
  }, 450);
});
ajusterOptionsTrajet();
$('btnRecalculerTrajet').addEventListener('click', () => {
  if (Nav.actif || !derniereDestination) return;
  tracerTrajet(derniereDestination.dest, derniereDestination.nom);
});

/* ═══ TRAJET A → B ═══

   Le calcul de route revient à OSRM, service public d'OpenStreetMap : il
   connaît le réseau routier ivoirien et rend une géométrie suivant les rues.
   Le /itineraire de l'API GeoDeliver ordonne une tournée de livraisons entre
   plusieurs arrêts et exige une clé — ce n'est pas le même problème. */
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const RE_GEOCODE = /^[A-Za-z]{3}[- ]?[A-Za-z]{4}[- ]?[A-Za-z0-9]{4,6}([- ][A-Za-z])?$/;

const MANOEUVRES = {
  'turn-left': 'Tourne à gauche', 'turn-right': 'Tourne à droite',
  'turn-sharp left': 'Tourne franchement à gauche', 'turn-sharp right': 'Tourne franchement à droite',
  'turn-slight left': 'Serre à gauche', 'turn-slight right': 'Serre à droite',
  'turn-straight': 'Continue tout droit', 'new name-straight': 'Continue tout droit',
  'depart-straight': 'Démarre', 'arrive-straight': 'Tu es arrivé',
  'roundabout-straight': 'Au rond-point, continue', 'rotary-straight': 'Au rond-point, continue',
  'merge-straight': 'Insère-toi', 'fork-left': 'À l\u2019embranchement, à gauche',
  'fork-right': 'À l\u2019embranchement, à droite', 'end of road-left': 'Au bout, à gauche',
  'end of road-right': 'Au bout, à droite'
};

function direManoeuvre(pas) {
  const m = pas.maneuver || {};
  const cle = (m.type || '') + '-' + (m.modifier || 'straight');
  let t = MANOEUVRES[cle];
  if (!t) {
    if (m.type === 'roundabout' || m.type === 'rotary')
      t = 'Au rond-point, prends la ' + (m.exit || 1) + 'e sortie';
    else if (m.modifier)
      t = 'Prends à ' + m.modifier.replace('left', 'gauche').replace('right', 'droite');
    else t = 'Continue';
  }
  const rue = (pas.name || '').trim();
  return rue ? t + ' sur ' + rue : t;
}


/* Découpe la géométrie uniquement jusqu'au dernier point GPS reçu.
   N'imite jamais un déplacement lorsque le téléphone reste immobile. */
function dessinerAvancementGPS(avance) {
  if (!coucheParcourue || !Nav.route || !Nav.cum || !Nav.cum.length) return;
  const path = Nav.route.ligne, cumul = Nav.cum;
  const distance = Math.max(0, Math.min(Number(avance) || 0, Nav.longueur));
  if (!path.length) return;
  const part = [path[0]];
  for (let i = 1; i < path.length; i++) {
    if (cumul[i] <= distance) {
      part.push(path[i]);
    } else {
      const taille = cumul[i] - cumul[i - 1];
      const t = taille ? Math.max(0, Math.min(1, (distance - cumul[i-1]) / taille)) : 0;
      if (t > 0) part.push([
        path[i-1][0] + t * (path[i][0] - path[i-1][0]),
        path[i-1][1] + t * (path[i][1] - path[i-1][1])
      ]);
      break;
    }
  }
  coucheParcourue.setLatLngs(part);
}

function etatSignalGPS(message, quality) {
  const status = $('repereGpsStatus');
  if (!status) return;
  if (status.textContent !== message) status.textContent = message;
  status.dataset.quality = quality;
}

/* Profil visuel cohérent avec le mode de déplacement réellement calculé.
   Les couleurs et pointillés ne prétendent pas mesurer le trafic. */
const STYLES_PAR_MODE = Object.freeze({
  voiture: Object.freeze({
    couleur: '#087F68', epaisseur: 8, cap: 'round', dash: null,
    parcoure: '#58756C', halo: 13, animation: true
  }),
  velo: Object.freeze({
    couleur: '#1877D2', epaisseur: 7, cap: 'round', dash: '15 9',
    parcoure: '#12518A', halo: 12, animation: false
  }),
  pied: Object.freeze({
    couleur: '#F07A28', epaisseur: 7, cap: 'round', dash: '2 11',
    parcoure: '#B45318', halo: 12, animation: false
  })
});
function styleModeTrajet() {
  return STYLES_PAR_MODE[lireOptionsTrajet().mode] || STYLES_PAR_MODE.voiture;
}

/* Dessine le tracé réel renvoyé par le moteur multimodal et met à jour tout ce qui en
   dépend : couche de la carte, résumé, étapes, et l'état de navigation. */
function afficherRoute(route, dest, nom, enGuidage) {
  const ligne = route.geometry.coordinates.map((c) => [c[1], c[0]]);
  // Les grappes de repères recouvrent la polyligne : les retirer pendant
  // l'itinéraire, puis les rétablir une fois le trajet terminé.
  if (map.hasLayer(coucheLieux)) map.removeLayer(coucheLieux);

  coucheTrajet.clearLayers();
  coucheAlternatives.clearLayers();
  const style = styleModeTrajet();
  const mode = lireOptionsTrajet().mode;
  L.polyline(ligne, {
    color: '#FFFFFF', weight: style.halo, opacity: .96, interactive: false,
    lineCap: style.cap, lineJoin: 'round'
  }).addTo(coucheTrajet);
  L.polyline(ligne, {
    color: style.couleur, weight: style.epaisseur, opacity: 1,
    dashArray: style.dash || undefined, interactive: false,
    lineCap: style.cap, lineJoin: 'round', className: 'repere-route-main repere-route-' + mode
  }).addTo(coucheTrajet);
  if (style.animation) {
    // Uniquement une animation illustrative en voiture, jamais un faux GPS.
    L.polyline(ligne, {
      color: '#FFFFFF', weight: 2, opacity: .68, dashArray: '5 18',
      interactive: false, className: 'repere-route-flow'
    }).addTo(coucheTrajet);
  }
  // Aucune progression sans nouveau relevé GPS.
  coucheParcourue = L.polyline([], {
    color: style.parcoure, weight: style.epaisseur, opacity: 1,
    lineCap: style.cap, interactive: false
  }).addTo(coucheTrajet);
  if (marqueurDest) map.removeLayer(marqueurDest);
  marqueurDest = L.marker([dest.lat, dest.lng], { icon: carre(19, '#13232A', true) }).addTo(map);
  if (!enGuidage) {
    const desktop = window.matchMedia('(min-width:720px)').matches;
    map.fitBounds(L.latLngBounds(ligne), {
      paddingTopLeft: desktop ? [450, 85] : [28, 85],
      paddingBottomRight: desktop ? [65, 65] : [28, 300],
      maxZoom: 16
    });
  }

  /* Des alertes à proximité du tracé restent visibles, mais elles ne sont
     pas assimilées à une mesure du trafic en temps réel. */
  const surLaRoute = S.alertes.filter((a) =>
    ligne.some((q) => Math.abs(q[0] - a.lat) < 0.0025 && Math.abs(q[1] - a.lng) < 0.0025));

  $('tDest').textContent = nom;
  $('tDuree').textContent = fmt.duree(route.duration);
  $('tDistance').textContent = fmt.distance(route.distance);
  $('tArrivee').textContent = fmt.heure(new Date(Date.now() + route.duration * 1000));
  const res = $('tResume');
  res.textContent = 'Aperçu du tracé · le GPS suit votre position après « Démarrer » · sans trafic en temps réel' +
    (surLaRoute.length ? ' · ' + surLaRoute.length + ' signalement(s) sur le trajet' : '');
  res.style.color = surLaRoute.length ? 'var(--alert-ink)' : '';

  const e = $('tEtapes');
  e.replaceChildren();
  surLaRoute.forEach((a) => {
    const item = document.createElement('div');
    item.className = 'etape repere-route-warning';
    const picto = document.createElement('span');
    picto.className = 'n';
    picto.textContent = '!';
    const corps = document.createElement('span');
    corps.className = 'repere-step-text';
    const titre = document.createElement('strong');
    titre.textContent = String(a.libelle || 'Signalement');
    corps.appendChild(titre);
    if (a.commentaire) {
      const commentaire = document.createElement('span');
      commentaire.textContent = String(a.commentaire);
      corps.appendChild(commentaire);
    }
    item.append(picto, corps);
    e.appendChild(item);
  });
  const etapes = route.legs[0].steps || [];
  etapes.forEach((pas, index) => {
    const item = document.createElement('div');
    item.className = 'etape';
    const numero = document.createElement('span');
    numero.className = 'n';
    numero.textContent = String(index + 1);
    const texte = document.createElement('span');
    texte.className = 'repere-step-text';
    const manoeuvre = document.createElement('strong');
    manoeuvre.textContent = direManoeuvre(pas);
    const distance = document.createElement('span');
    distance.textContent = fmt.distance(pas.distance);
    texte.append(manoeuvre, distance);
    item.append(numero, texte);
    e.appendChild(item);
  });
  $('btnEtapes').disabled = e.children.length === 0;

  Nav.route = { ligne: ligne, etapes: etapes, dest: dest, nom: nom, mode: lireOptionsTrajet().mode };
  Nav.preparer();
  if (typeof Repere3D !== 'undefined') Repere3D.updateRoute(Nav.route);
}

/* Comparaison accessible : sélection d'une route sans appel réseau supplémentaire. */
function afficherAlternatives(routes, dest, nom) {
  const z = $('tAlternatives');
  z.replaceChildren();
  if (routes.length < 2) { z.hidden = true; return; }
  z.hidden = false;
  const minimum = Math.min(...routes.map((r) => r.duration));
  const lePlusCourt = Math.min(...routes.map((r) => r.distance));
  const lePlusLong = Math.max(...routes.map((r) => r.distance));
  const baseMode = lireOptionsTrajet().mode;
  const style = STYLES_PAR_MODE[baseMode] || STYLES_PAR_MODE.voiture;
  routes.forEach((route, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'repere-route-option' + (i === 0 ? ' is-selected' : '');
    b.setAttribute('aria-pressed', String(i === 0));
    const nomOption = document.createElement('span');
    nomOption.className = 'repere-route-option-name';
    const pointsForts = [];
    if (route.duration === minimum) pointsForts.push('le plus rapide proposé');
    if (route.distance === lePlusCourt) pointsForts.push('le plus court proposé');
    if (routes.length > 1 && route.distance === lePlusLong && lePlusLong > lePlusCourt) {
      pointsForts.push('le plus long proposé');
    }
    nomOption.textContent = (i === 0 ? 'Recommandé' : 'Alternative ' + i) +
      (pointsForts.length ? ' · ' + pointsForts.join(' · ') : '');
    const duree = document.createElement('strong');
    duree.textContent = fmt.duree(route.duration);
    const distance = document.createElement('span');
    distance.className = 'repere-route-option-distance';
    distance.textContent = fmt.distance(route.distance);
    b.append(nomOption, duree, distance);
    b.addEventListener('click', () => {
      z.querySelectorAll('.repere-route-option').forEach((x) => {
        const selected = x === b;
        x.classList.toggle('is-selected', selected);
        x.setAttribute('aria-pressed', String(selected));
      });
      afficherRoute(route, dest, nom, false);
      // Les trajets non sélectionnés restent consultables sur la carte.
      routes.filter((x) => x !== route).forEach((autre) => {
        const coords = autre.geometry.coordinates.map((point) => [point[1], point[0]]);
        if (coords.length < 2) return;
        L.polyline(coords, {
          color: style.couleur, weight: 4, opacity: .34,
          dashArray: style.dash || '7 9', interactive: false,
          className: 'repere-route-alternative'
        }).addTo(coucheAlternatives).bringToBack();
      });
    });
    z.appendChild(b);
  });
  // Dessiner les autres propositions discrètement : couleur selon le mode,
  // toujours derrière l'itinéraire sélectionné.
  routes.slice(1).forEach((alternative) => {
    const coords = alternative.geometry.coordinates.map((point) => [point[1], point[0]]);
    if (coords.length < 2) return;
    L.polyline(coords, {
      color: style.couleur, weight: 4, opacity: .34,
      dashArray: style.dash || '7 9', interactive: false,
      className: 'repere-route-alternative'
    }).addTo(coucheAlternatives).bringToBack();
  });
}

function replierEtapes() {
  $('tEtapes').hidden = true;
  $('btnEtapes').setAttribute('aria-expanded', 'false');
  $('btnEtapes').querySelector('span').textContent = 'Voir les étapes de l’itinéraire';
}
$('btnEtapes').addEventListener('click', () => {
  const etapes = $('tEtapes');
  etapes.hidden = !etapes.hidden;
  $('btnEtapes').setAttribute('aria-expanded', String(!etapes.hidden));
  $('btnEtapes').querySelector('span').textContent = etapes.hidden
    ? 'Voir les étapes de l’itinéraire' : 'Masquer les étapes';
});

let sequenceTrajet = 0;
async function tracerTrajet(dest, nom) {
  clearTimeout(minuteurOptions);
  if (controleTrajet) controleTrajet.abort();
  if (!Geo.derniere) {
    return localiser(() => tracerTrajet(dest, nom), (m) => toast(m));
  }
  /* Pendant le guidage, un recalcul ne doit pas rouvrir le panneau ni
     recadrer la carte sur tout le trajet : on reste derrière le conducteur.
     On ne propose pas non plus de choix de tracé à ce moment-là — ce n'est
     pas le moment de comparer des options au volant. */
  const enGuidage = Nav.actif;
  /* Tracer une destination différente abandonne le partage en cours : il
     décrivait l'ancien trajet, pas le nouveau, et ne doit pas rester actif
     sans que personne n'y pense. Un recalcul en cours de guidage (même
     destination, juste écarté de la route) ne touche pas à ça. */
  if (!enGuidage && Nav.suiviCode) {
    Api.suiviTerminer(Nav.suiviCode).catch(() => {});
    Nav.suiviCode = null;
    majBoutonSuivi();
  }
  const p = Geo.derniere;
  const demande = ++sequenceTrajet;
  controleTrajet = new AbortController();
  const choix = lireOptionsTrajet();
  const bouton = $('btnDemarrer');
  if (!enGuidage) {
    bouton.disabled = true;
    $('routeModeInfo').textContent = 'Calcul en cours…';
    // Ne garder qu'une destination courante pour le recalcul après changement d'option.
    derniereDestination = { dest: { lat: dest.lat, lng: dest.lng }, nom };
  }
  try {
    const d = await RepereRouting.calculer(p, dest, choix, controleTrajet.signal);
    if (demande !== sequenceTrajet) return;
    if (enGuidage) {
      afficherRoute(d.routes[0], dest, nom, true);
      return;  // pas de nouvelle feuille ni d'autres choix en roulant
    }
    afficherRoute(d.routes[0], dest, nom, false);
    replierEtapes();
    afficherAlternatives(d.routes, dest, nom);
    $('routeModeInfo').textContent = [
      choix.mode === 'voiture' ? 'Voiture' : choix.mode === 'velo' ? 'Vélo' : 'À pied',
      d.source,
      d.routes.length === 1 ? 'Une seule route trouvée' :
        d.routes.length + ' trajets proposés',
      'Pas de trafic en temps réel'
    ].join(' · ');
    $('btnDemarrer').style.display = 'flex';
    bouton.disabled = false;
    $('trajet').classList.add('on');
    document.getElementById('scrCarte').classList.add('repere-route-preview');
    $('suggest').classList.remove('on');
    $('feuilleBas').style.display = 'none';
  } catch (err) {
    if (demande !== sequenceTrajet || controleTrajet.signal.aborted) return;
    const message = err && err.message ? err.message : 'Calcul indisponible.';
    if (!enGuidage) {
      bouton.disabled = true;
      $('routeModeInfo').textContent = 'Ce profil n’a pas pu être calculé : ' + message;
      $('tDest').textContent = nom;
      $('tDuree').textContent = '—';
      $('tDistance').textContent = '—';
      $('tArrivee').textContent = '—';
      $('tResume').textContent = 'Aucun nouvel itinéraire confirmé.';
      $('tAlternatives').hidden = true;
      $('tAlternatives').replaceChildren();
      $('tEtapes').replaceChildren();
      replierEtapes();
      coucheTrajet.clearLayers();
      coucheAlternatives.clearLayers();
      coucheParcourue = null;
      if (marqueurDest) { map.removeLayer(marqueurDest); marqueurDest = null; }
      if (window.RepereLayers?.placesVisible !== false && !map.hasLayer(coucheLieux)) coucheLieux.addTo(map);
      Nav.route = null;
      if (typeof Repere3D !== 'undefined') Repere3D.updateRoute(null);
      $('trajet').classList.add('on');
      document.getElementById('scrCarte').classList.add('repere-route-preview');
      $('feuilleBas').style.display = 'none';
    }
    toast(message);
  }
}

window.allerVers = (lat, lng, nom) => { map.closePopup(); allerA('scrCarte'); tracerTrajet({ lat, lng }, nom); };

/* Un seul point de sortie du trajet, qu'il soit fermé depuis l'aperçu
   (avant guidage), interrompu en cours de route, ou terminé à l'arrivée :
   la carte doit toujours revenir à son état de départ. */
function finirTrajet() {
  ++sequenceTrajet;
  clearTimeout(minuteurOptions);
  if (controleTrajet) controleTrajet.abort();
  derniereDestination = null;
  $('btnDemarrer').disabled = false;
  Nav.arreter();
  $('trajet').classList.remove('on');
  document.getElementById('scrCarte').classList.remove('repere-route-preview');
  $('feuilleBas').style.display = 'flex';
  replierEtapes();
  coucheTrajet.clearLayers();
  coucheAlternatives.clearLayers();
  coucheParcourue = null;
  if (typeof Repere3D !== 'undefined') Repere3D.updateRoute(null);
  if (window.RepereLayers?.placesVisible !== false && !map.hasLayer(coucheLieux)) coucheLieux.addTo(map);
  if (marqueurDest) { map.removeLayer(marqueurDest); marqueurDest = null; }
  if (Nav.suiviCode) {
    Api.suiviTerminer(Nav.suiviCode).catch(() => {});
    Nav.suiviCode = null;
    majBoutonSuivi();
  }
}

$('tFermer').addEventListener('click', finirTrajet);
$('btnFinGuidage').addEventListener('click', finirTrajet);

/* ═══ GUIDAGE EN TEMPS RÉEL ═══

   Ce qui sépare une carte d'une application de navigation : le téléphone suit
   la position, annonce la manœuvre à voix haute avant le carrefour, et
   recalcule quand on s'écarte. Sans cela, il faut regarder l'écran — ce qui au
   volant n'est ni utile ni prudent.

   La voix passe par la synthèse vocale du téléphone : rien à télécharger,
   aucun serveur, et le français est disponible partout. Elle demande un geste
   de l'utilisateur pour démarrer sur iOS — c'est le bouton « Démarrer » qui
   le fournit. */
const Nav = {
  route: null,          // { ligne, etapes, dest, nom }
  actif: false,
  muet: Store.lire('muet', false),
  veille: null,         // identifiant watchPosition
  alerteHorsZone: false, // ne répète pas l'avertissement à chaque mesure GPS
  etape: 0,
  annonces: {},         // manœuvres déjà dites, pour ne pas se répéter
  horsRoute: 0,
  suiviCode: null,      // code du partage de trajet en direct, s'il est actif
  suiviDernierEnvoi: 0, // horodatage du dernier point poussé au serveur

  /* Projection d'un point sur un segment. Rend l'écart en mètres et la
     fraction parcourue du segment. À l'échelle d'une ville, la projection
     équirectangulaire suffit et coûte trois multiplications. */
  projeter(p, a, b) {
    const k = 111000, kx = k * 0.9963;
    const px = (p.lng - a[1]) * kx, py = (p.lat - a[0]) * k;
    const bx = (b[1] - a[1]) * kx, by = (b[0] - a[0]) * k;
    const long2 = bx * bx + by * by;
    if (long2 === 0) return { d: Math.sqrt(px * px + py * py), t: 0 };
    let t = (px * bx + py * by) / long2;
    t = Math.max(0, Math.min(1, t));
    const dx = px - t * bx, dy = py - t * by;
    return { d: Math.sqrt(dx * dx + dy * dy), t: t };
  },

  /* Tables d'abscisses calculées une fois par tracé : distance cumulée le long
     de la polyligne, et point de départ de chaque étape. C'est ce qui permet
     de raisonner en avancement plutôt qu'en proximité d'un carrefour. */
  preparer() {
    const l = Nav.route.ligne;
    const cum = [0];
    for (let i = 1; i < l.length; i++) {
      cum.push(cum[i - 1] + Nav.metres(
        { lat: l[i - 1][0], lng: l[i - 1][1] }, { lat: l[i][0], lng: l[i][1] }));
    }
    Nav.cum = cum;
    Nav.longueur = cum[cum.length - 1] || 0;

    // offsets[i] = abscisse de la manœuvre qui ouvre l'étape i.
    const e = Nav.route.etapes;
    const off = [0];
    for (let i = 0; i < e.length; i++) off.push(off[i] + (e[i].distance || 0));
    Nav.offsets = off;
  },

  /* Où en est-on ? Rend l'écart au tracé et l'abscisse parcourue.
     Raisonner en abscisse est indispensable : un relevé GPS arrive toutes les
     une à trois secondes, soit vingt à soixante mètres en ville. Une étape
     validée par la seule proximité du carrefour — moins de vingt-cinq mètres —
     serait sautée la plupart du temps, et l'application continuerait
     d'annoncer un virage déjà passé. */
  progres(pos) {
    const l = Nav.route.ligne;
    let mini = Infinity, avance = 0;
    for (let i = 0; i < l.length - 1; i++) {
      const r = Nav.projeter(pos, l[i], l[i + 1]);
      if (r.d < mini) {
        mini = r.d;
        avance = Nav.cum[i] + r.t * (Nav.cum[i + 1] - Nav.cum[i]);
      }
    }
    return { ecart: mini, avance: avance };
  },

  /* L'étape dont la manœuvre est encore devant, et ce qui reste pour
     l'atteindre. */
  prochaine(avance) {
    const e = Nav.route.etapes, off = Nav.offsets;
    let j = 1;
    while (j < e.length && off[j] <= avance + 5) j += 1;
    j = Math.min(j, e.length - 1);
    return { indice: j, etape: e[j], restant: Math.max(0, off[j] - avance) };
  },

  metres(a, b) {
    const dx = (b.lng - a.lng) * 111000 * 0.9963, dy = (b.lat - a.lat) * 111000;
    return Math.sqrt(dx * dx + dy * dy);
  },

  dire(texte) {
    if (Nav.muet || !('speechSynthesis' in window)) return;
    const v = new SpeechSynthesisUtterance(texte);
    v.lang = 'fr-FR';
    v.rate = 1.0;
    speechSynthesis.cancel();   // une consigne périmée ne doit pas retarder la suivante
    speechSynthesis.speak(v);
  },

  demarrer() {
    if ($('btnDemarrer').disabled) return toast('L’itinéraire n’est pas prêt.');
    if (!Nav.route) return toast('Choisis d’abord une destination.');
    if (!('geolocation' in navigator)) return toast('Ce téléphone ne donne pas la position.');

    Nav.actif = true;
    etatSignalGPS('Recherche du signal GPS…', 'waiting');
    Nav.etape = 0;
    Nav.annonces = {};
    Nav.horsRoute = 0;
    Nav.alerteHorsZone = false;
    $('consigne').classList.add('on');
    // Recherche et filtres n'ont rien à faire là pendant le guidage, et la
    // bande de filtres dépassait sous le bandeau rouge.
    document.querySelector('#scrCarte .mapwrap').classList.add('guidage');
    $('trajet').classList.remove('on');
    document.getElementById('scrCarte').classList.remove('repere-route-preview');
    $('carteEtat').classList.add('guidage');
    majBoutonVoix();
    allerA('scrCarte');

    /* Le bandeau et la voix partent de la même étape : la première manœuvre
       réellement devant nous, pas l'instruction de départ déjà accomplie. */
    const depart = Geo.derniere
      ? Nav.prochaine(Nav.progres(Geo.derniere).avance)
      : { indice: 1, etape: Nav.route.etapes[Math.min(1, Nav.route.etapes.length - 1)], restant: null };
    Nav.etape = depart.indice;
    Nav.afficher(depart.etape, depart.restant);
    Nav.dire('Guidage démarré. ' + Nav.consigneTexte(depart.etape));

    /* watchPosition plutôt qu'une boucle de getCurrentPosition : le téléphone
       ne rend un point que lorsqu'il a bougé, ce qui ménage la batterie. */
    Nav.veille = navigator.geolocation.watchPosition(
      (p) => Nav.avancer({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      (error) => {
        if (!Nav.actif) return;
        if (error.code === 1) {
          Nav.arreter();
          $('trajet').classList.add('on');
          document.getElementById('scrCarte').classList.add('repere-route-preview');
          toast('Localisation refusée : autorisez le GPS pour être guidé.');
        } else {
          etatSignalGPS('Signal GPS indisponible · position non actualisée', 'error');
          toast('Signal GPS indisponible. Le suivi attend une nouvelle position.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
    );
  },

  arreter() {
    if (Nav.veille !== null) { navigator.geolocation.clearWatch(Nav.veille); Nav.veille = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    Nav.actif = false;
    etatSignalGPS('Guidage terminé', 'waiting');
    $('consigne').classList.remove('on');
    document.querySelector('#scrCarte .mapwrap').classList.remove('guidage');
    $('carteEtat').classList.remove('guidage');
    majEtat();
  },

  consigneTexte(etape) {
    return etape ? direManoeuvre(etape) : 'Continue';
  },

  afficher(etape, distance) {
    $('consigneTexte').textContent = Nav.consigneTexte(etape);
    $('consigneDistance').textContent = distance === null ? '—' : fmt.distance(distance);

    /* La flèche dit la manœuvre d'un coup d'œil : c'est ce qu'on lit en
       roulant, le texte ne vient qu'en second. */
    const m = (etape && etape.maneuver) || {};
    const mod = m.modifier || '';
    let d = 'M12 20V7M6 13l6-6 6 6';                                  // tout droit
    if (mod.indexOf('left') !== -1) d = 'M12 20V10a3 3 0 00-3-3H5M9 4L5 7l4 3';
    else if (mod.indexOf('right') !== -1) d = 'M12 20V10a3 3 0 013-3h4M15 4l4 3-4 3';
    if (m.type === 'arrive') d = 'M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z';
    $('consigneFleche').innerHTML = '<path d="' + d + '"/>';
  },

  avancer(pos) {
    if (!Nav.actif || !Nav.route) return;
    // Même contrôle géographique que Geo.obtenir : watchPosition renvoie
    // directement les coordonnées, y compris une simulation Chrome hors CI.
    // Ne jamais déplacer la carte ou publier le suivi vers l'océan.
    if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng) ||
        pos.lat < CI.latMin || pos.lat > CI.latMax ||
        pos.lng < CI.lngMin || pos.lng > CI.lngMax) {
      etatSignalGPS('GPS hors Côte d’Ivoire · corrige les coordonnées dans Capteurs', 'error');
      if (!Nav.alerteHorsZone) {
        toast('GPS hors Côte d’Ivoire : utilise une latitude et longitude d’Abidjan.');
        Nav.alerteHorsZone = true;
      }
      return;
    }
    Nav.alerteHorsZone = false;
    // Ignorer un point trop incertain pour ne pas créer de faux virages.
    if (Number.isFinite(pos.precision) && pos.precision > 80) {
      etatSignalGPS('Précision GPS faible · attente d’un meilleur signal', 'weak');
      return;
    }
    Geo.derniere = pos;
    if (typeof Repere3D !== 'undefined') Repere3D.updatePosition(pos);
    if (marqueurMoi) marqueurMoi.setLatLng([pos.lat, pos.lng]);
    else marqueurMoi = L.marker([pos.lat, pos.lng], { icon: carre(15, '#0F766E', true) }).addTo(map);
    if (map.getZoom() < 16) map.setView([pos.lat, pos.lng], 16, { animate: true });
    else map.panTo([pos.lat, pos.lng], { animate: true, duration: .45 });
    etatSignalGPS('Suivi GPS actif · position actualisée', 'active');

    /* Un point toutes les douze secondes suffit à suivre quelqu'un en direct,
       et ménage la base comme la batterie — un point à chaque relevé GPS (une
       à trois secondes) ne rendrait pas le suivi plus utile pour un proche. */
    if (Nav.suiviCode && Date.now() - Nav.suiviDernierEnvoi > 12000) {
      Nav.suiviDernierEnvoi = Date.now();
      Api.suiviMettreAJour(Nav.suiviCode, pos.lat, pos.lng).catch(() => {});
    }

    const pr = Nav.progres(pos);
    dessinerAvancementGPS(pr.avance);

    /* Écart au tracé. Un seul point aberrant ne doit pas déclencher un
       recalcul : il faut trois relevés d'affilée au-delà de soixante mètres. */
    if (pr.ecart > 60) {
      Nav.horsRoute += 1;
      if (Nav.horsRoute >= 3) {
        Nav.horsRoute = 0;
        Nav.dire('Tu t\u2019es écarté. Je recalcule.');
        const d = Nav.route.dest, nom = Nav.route.nom;
        tracerTrajet(d, nom).then(() => { if (Nav.actif) { Nav.etape = 0; Nav.annonces = {}; } });
        return;
      }
    } else {
      Nav.horsRoute = 0;
    }

    const suite = Nav.prochaine(pr.avance);
    Nav.etape = suite.indice;
    const etape = suite.etape, restant = suite.restant;
    Nav.afficher(etape, restant);

    /* Trois annonces par manœuvre, aux distances où elles servent : le temps
       de changer de file, puis juste avant le carrefour. */
    const cle = suite.indice;
    const dites = Nav.annonces[cle] || {};
    const texte = Nav.consigneTexte(etape);
    if (restant < 400 && restant > 200 && !dites.loin) {
      dites.loin = 1; Nav.dire('Dans ' + fmt.distance(restant) + ', ' + texte.toLowerCase());
    } else if (restant < 150 && restant > 60 && !dites.proche) {
      dites.proche = 1; Nav.dire(texte);
    } else if (restant < 45 && !dites.maintenant) {
      dites.maintenant = 1; Nav.dire('Maintenant, ' + texte.toLowerCase());
    }
    Nav.annonces[cle] = dites;

    // Ce qui reste jusqu'au bout : la longueur du tracé moins l'avancement.
    const total = Math.max(0, Nav.longueur - pr.avance);
    $('carteEtat').textContent = fmt.distance(total) + ' restants';

    if (total < 30 || Nav.metres(pos, Nav.route.dest) < 35) {
      Nav.dire('Tu es arrivé.');
      toast('Arrivé à destination.');
      finirTrajet();
    }
  }
};

function majBoutonVoix() {
  const b = $('btnVoix');
  b.classList.toggle('muet', Nav.muet);
  $('voixIcone').innerHTML = Nav.muet
    ? '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>'
    : '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 010 6"/>';
}

$('btnDemarrer').addEventListener('click', () => Nav.demarrer());

/* ═══ PARTAGE DE TRAJET EN DIRECT ═══
   Un lien que n'importe qui ouvre sans installer l'application, et qui montre
   la position bouger en temps réel pendant qu'on roule — ce que ne permettait
   jusque-là que le point figé de l'écran Partager. */
function majBoutonSuivi() {
  const b = $('btnPartagerTrajet');
  b.firstChild.textContent = Nav.suiviCode ? 'Partage actif — renvoyer le lien' : 'Partager ce trajet en direct';
}

function suiviLien(code) {
  return location.href.replace(/[^/]*$/, '') + 'suivi.html?c=' + encodeURIComponent(code);
}

$('btnPartagerTrajet').addEventListener('click', async () => {
  if (Nav.suiviCode) {
    window.open(Partage.whatsapp('Je partage ma position en direct.\n' + suiviLien(Nav.suiviCode)), '_blank');
    return;
  }
  if (!Nav.route || !Geo.derniere) return toast('Trace d’abord un trajet.');
  const b = $('btnPartagerTrajet');
  b.disabled = true;
  try {
    const d = await Api.suiviCreer({
      lat: Geo.derniere.lat, lng: Geo.derniere.lng,
      dest_lat: Nav.route.dest.lat, dest_lng: Nav.route.dest.lng, dest_nom: Nav.route.nom
    });
    Nav.suiviCode = d.code;
    Nav.suiviDernierEnvoi = Date.now();
    majBoutonSuivi();
    window.open(Partage.whatsapp('Je partage ma position en direct.\n' + suiviLien(d.code)), '_blank');
  } catch (e) { toast('Partage impossible — réessaie.'); }
  b.disabled = false;
});
$('btnVoix').addEventListener('click', () => {
  Nav.muet = !Nav.muet;
  Store.ecrire('muet', Nav.muet);
  majBoutonVoix();
  if (Nav.muet && 'speechSynthesis' in window) speechSynthesis.cancel();
  toast(Nav.muet ? 'Voix coupée.' : 'Voix rétablie.');
});
majBoutonVoix();

/* ═══ RECHERCHE DE DESTINATION ═══ */
/* Les réponses tardives ne doivent jamais remplacer la nouvelle recherche. */
let numeroRecherche = 0;
let minuteur;
function afficherSuggestions() {
  $('suggest').classList.add('on');
  $('qDest').setAttribute('aria-expanded', 'true');
}
function fermerSuggestions() {
  $('suggest').classList.remove('on');
  $('qDest').setAttribute('aria-expanded', 'false');
}
function annulerRecherche() {
  ++numeroRecherche;
  clearTimeout(minuteur);
  fermerSuggestions();
}
function etatRecherche(message) {
  const s = $('suggest');
  const note = document.createElement('p');
  note.className = 'repere-search-state';
  note.textContent = message;
  s.replaceChildren(note);
  afficherSuggestions();
}
function proposer(items) {
  const s = $('suggest');
  s.replaceChildren();
  if (!items.length) {
    etatRecherche('Aucun lieu trouvé. Essayez un nom de quartier ou un GeoCode.');
    return;
  }
  const entete = document.createElement('div');
  entete.className = 'repere-results-heading';
  entete.textContent = items.length + ' résultat' + (items.length > 1 ? 's' : '');
  s.appendChild(entete);
  items.forEach((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'repere-result-item';
    const picto = document.createElement('span');
    picto.className = 'repere-result-icon';
    picto.setAttribute('aria-hidden', 'true');
    picto.textContent = '⌖';
    const corps = document.createElement('span');
    corps.className = 'grow';
    const titre = document.createElement('span');
    titre.className = 'nm';
    titre.textContent = String(it.nom || 'Lieu');
    const sous = document.createElement('span');
    sous.className = 'sub';
    sous.textContent = String(it.sous || it.etiquette || 'Repère local');
    corps.append(titre, sous);
    const fleche = document.createElement('span');
    fleche.className = 'repere-result-arrow';
    fleche.setAttribute('aria-hidden', 'true');
    fleche.textContent = '›';
    b.append(picto, corps, fleche);
    b.addEventListener('click', () => {
      $('qDest').value = String(it.nom || '');
      annulerRecherche();
      $('qDest').blur();
      ouvrirFicheLieu(it);
    });
    s.appendChild(b);
  });
  afficherSuggestions();
}

async function chercherDestination() {
  clearTimeout(minuteur);
  const q = $('qDest').value.trim();
  const demande = ++numeroRecherche;
  if (q.length < 2) { fermerSuggestions(); return; }
  etatRecherche('Recherche des lieux…');

  if (RE_GEOCODE.test(q)) {
    try {
      const d = await Api.decoder(q);
      if (demande !== numeroRecherche || $('qDest').value.trim() !== q) return;
      return proposer([{
        nom: d.geocode || q, geocode: d.geocode || q, etiquette: 'Repère',
        sous: [d.quartier, d.ville].filter(Boolean).join(', '),
        quartier: d.quartier, ville: d.ville, lat: d.lat, lng: d.lng
      }]);
    } catch (e) {
      if (demande !== numeroRecherche) return;
      etatRecherche('GeoCode non reconnu. Vérifiez le code et réessayez.');
      return;
    }
  }
  try {
    const d = await Api.lieux(q, 12, Geo.derniere);
    if (demande !== numeroRecherche || $('qDest').value.trim() !== q) return;
    proposer((d.lieux || []).map((l) => ({
      nom: l.nom, etiquette: l.libelle, libelle: l.libelle,
      sous: [l.libelle, l.commune, l.distance_m != null ? fmt.distance(l.distance_m) : null]
        .filter(Boolean).join(' · '),
      commune: l.commune, quartier: l.quartier, ville: l.ville,
      geocode: l.geocode, distance_m: l.distance_m, lat: l.lat, lng: l.lng
    })));
  } catch (e) {
    if (demande !== numeroRecherche) return;
    etatRecherche('La recherche est indisponible. Vérifiez votre connexion puis réessayez.');
  }
}

$('qDest').addEventListener('input', () => {
  ++numeroRecherche;
  clearTimeout(minuteur);
  const q = $('qDest').value.trim();
  if (q.length < 2) { fermerSuggestions(); return; }
  minuteur = setTimeout(chercherDestination, 320);
});
$('btnChercher').addEventListener('click', chercherDestination);
$('qDest').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('qDest').blur(); chercherDestination(); }
  if (e.key === 'ArrowDown') {
    const premier = $('suggest').querySelector('button.repere-result-item');
    if (premier) { e.preventDefault(); premier.focus(); }
  }
});
$('suggest').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { annulerRecherche(); $('qDest').focus(); return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const boutons = Array.from($('suggest').querySelectorAll('button.repere-result-item'));
  const indice = boutons.indexOf(document.activeElement);
  if (indice < 0) return;
  e.preventDefault();
  if (e.key === 'ArrowUp' && indice === 0) $('qDest').focus();
  else boutons[(indice + (e.key === 'ArrowDown' ? 1 : -1) + boutons.length) % boutons.length].focus();
});

/* Appui long sur la carte : y aller sans rien taper. */
let presse;
map.on('mousedown touchstart', (e) => {
  presse = setTimeout(() => tracerTrajet(e.latlng, 'Point sur la carte'), 650);
});
['mouseup', 'touchend', 'dragstart', 'move'].forEach((ev) => map.on(ev, () => clearTimeout(presse)));

/* ═══ PARTAGER ═══ */
monterMinimap();

function afficherEtape(laquelle) {
  $('etapeCapture').style.display = laquelle === 'capture' ? 'flex' : 'none';
  $('etapeApercu').style.display = laquelle === 'apercu' ? 'flex' : 'none';
}

$('btnCapturer').addEventListener('click', () => {
  const b = $('btnCapturer');
  b.disabled = true;
  b.firstChild.textContent = 'Recherche de ta position…';
  const fini = () => { b.disabled = false; b.firstChild.textContent = 'Capturer ce point'; };

  Geo.obtenir(async (p) => {
    minimap.setView([p.lat, p.lng], 17);
    L.marker([p.lat, p.lng], { icon: carre(18, '#0F766E', true) }).addTo(minimap);

    const note = $('precisionNote');
    note.style.display = 'flex';

    /* La précision est dite AVANT l'envoi. Au-delà du seuil, l'API refuse de
       toute façon : autant expliquer quoi faire plutôt que montrer une erreur. */
    if (p.precision > PRECISION_MAX) {
      note.style.borderColor = 'var(--accent)';
      note.innerHTML = '<span class="lab acc">Trop imprécis</span>' +
        '<span style="font-size:15px;line-height:1.45">Précision ' + Math.round(p.precision) +
        ' m. À cette distance, le code désignerait la porte du voisin. Sors sur le pas de ta porte et réessaie.</span>';
      return fini();
    }
    note.style.borderColor = 'var(--ink)';
    note.innerHTML = '<span class="lab">Précision</span>' +
      '<span style="font-size:15px">' + Math.round(p.precision) + ' m — assez pour désigner ta porte.</span>';

    try {
      const [attribution, description] = await Promise.all([
        Api.geocoder({
          /* Avec un compte, le vrai numéro distingue les foyers d'une même
             porte. Sans compte, un identifiant propre à cet appareil évite
             que tous les contributeurs anonymes soient confondus en une
             seule personne par le serveur. */
          telephone: (S.user && S.user.tel) || Store.telephoneAnonyme(),
          lat: p.lat, lng: p.lng, precision_m: p.precision
        }),
        Description.pour(p)
      ]);

      S.code = attribution.geocode;
      S.phrase = description.phrase;
      S.reperes = description.reperes;
      Store.ecrire('code', S.code);
      Store.ecrire('phrase', S.phrase);

      $('monCode').textContent = S.code;
      $('maPhrase').value = S.phrase;
      $('maNote').value = S.note || '';

      const occ = $('monOccupant');
      if (attribution.occupant) {
        occ.style.display = 'block';
        occ.textContent = 'Occupant ' + attribution.occupant + ' — ' +
          attribution.occupants_du_lieu + ' foyers à cette porte.';
      } else { occ.style.display = 'none'; }

      majListeReperes();
      afficherEtape('apercu');
      $('bdPartager').scrollTop = 0;
    } catch (e) {
      toast(e.message || 'Enregistrement impossible.');
    }
    fini();
  }, (m) => { toast(m); fini(); });
});

function majListeReperes() {
  const el = $('listeReperes');
  el.innerHTML = '';
  if (!S.reperes.length) return;
  const l = document.createElement('span');
  l.className = 'lab';
  l.textContent = 'Repères retenus';
  el.appendChild(l);
  S.reperes.forEach((r) => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:11px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)';
    d.innerHTML = '<span style="width:11px;height:11px;border-radius:50%;background:var(--accent);flex:none"></span>' +
      '<span style="flex:1;min-width:0;font-size:14px">' + r.nom + '</span>' +
      '<span class="sub" style="flex:none;font-weight:700">' + fmt.distance(r.distance_m) + '</span>';
    el.appendChild(d);
  });
  const att = document.createElement('span');
  att.className = 'sub';
  att.textContent = ATTRIBUTION;
  el.appendChild(att);
}

function texteAPartager() {
  S.note = $('maNote').value.trim();
  Store.ecrire('note', S.note);
  return Partage.texte(S.code, $('maPhrase').value.trim(), S.note, S.user && S.user.nom);
}

$('btnWhatsApp').addEventListener('click', () => {
  const t = texteAPartager();
  Lieux.noterPartage({ geocode: S.code, phrase: $('maPhrase').value.trim(), canal: 'WhatsApp' });
  window.open(Partage.whatsapp(t), '_blank');
});
$('btnSms').addEventListener('click', () => {
  const t = texteAPartager();
  Lieux.noterPartage({ geocode: S.code, phrase: $('maPhrase').value.trim(), canal: 'SMS' });
  location.href = Partage.sms(t);
});
$('btnCopier').addEventListener('click', async () => {
  const t = texteAPartager();
  try { await navigator.clipboard.writeText(t); toast('Copié.'); }
  catch (e) { toast('Copie impossible sur ce téléphone.'); }
});

$('btnEnregistrerLieu').addEventListener('click', () => {
  const c = ouvrirFeuille('Enregistrer ce lieu');
  const nom = champ(c, 'Nom du lieu', 'ex. Chez moi');
  const b = document.createElement('button');
  b.className = 'cta';
  b.innerHTML = 'Enregistrer<i>&rarr;</i>';
  b.addEventListener('click', () => {
    if (!nom.value.trim()) return toast('Donne-lui un nom.');
    Lieux.ajouter({
      nom: nom.value.trim(), geocode: S.code,
      phrase: $('maPhrase').value.trim(), note: $('maNote').value.trim()
    });
    feuille.classList.remove('on');
    toast('Lieu enregistré.');
    majLieux();
  });
  c.appendChild(b);
});

$('btnRecommencer').addEventListener('click', () => {
  afficherEtape('capture');
  $('precisionNote').style.display = 'none';
});

/* Une position déjà obtenue survit au rechargement : on rouvre sur l'aperçu
   plutôt que de redemander la position. */
if (S.code && S.phrase) {
  $('monCode').textContent = S.code;
  $('maPhrase').value = S.phrase;
  $('maNote').value = S.note || '';
  afficherEtape('apercu');
} else {
  afficherEtape('capture');
}

/* ═══ SIGNALER ═══ */
SIGNAUX.forEach((s) => {
  const b = document.createElement('button');
  b.className = 'typ';
  b.dataset.type = s.id;
  b.innerHTML = '<svg viewBox="0 0 24 24">' + s.svg + '</svg><b>' + s.nom + '</b><em>' + s.duree + '</em>';
  b.addEventListener('click', () => {
    S.signalChoisi = s.id;
    $('grilleTypes').querySelectorAll('.typ').forEach((x) => x.classList.toggle('on', x.dataset.type === s.id));
    $('btnEnvoyerSignal').disabled = false;
  });
  $('grilleTypes').appendChild(b);
});

$('btnSignaler').addEventListener('click', () => allerA('scrSignaler'));

$('segSignal').querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => {
    $('segSignal').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    const route = b.dataset.volet === 'route';
    $('voletRoute').style.display = route ? 'flex' : 'none';
    $('voletAdresse').style.display = route ? 'none' : 'flex';
  });
});

$('btnEnvoyerSignal').addEventListener('click', () => {
  if (!S.signalChoisi) return;
  const b = $('btnEnvoyerSignal');
  b.disabled = true;
  Geo.obtenir(async (p) => {
    try {
      const d = await Api.signaler({
        type: S.signalChoisi, lat: p.lat, lng: p.lng,
        commentaire: $('signalNote').value.trim() || null,
        appareil: Store.appareil()
      });
      const pts = Points.crediter('signal');
      toast(d.fusionne ? 'Déjà signalé — confirmé. +' + pts + ' points.' : 'Signalé. Merci. +' + pts + ' points.');
      $('signalNote').value = '';
      S.signalChoisi = null;
      $('grilleTypes').querySelectorAll('.typ').forEach((x) => x.classList.remove('on'));
      chargerAlertes();
      allerA('scrCarte');
    } catch (e) { toast(e.message || 'Envoi impossible.'); }
    b.disabled = true;
  }, (m) => { toast(m); b.disabled = false; });
});

/* ═══ APPORTS D'ADRESSE ═══ */
APPORTS.forEach((a) => {
  const b = document.createElement('button');
  b.className = 'item';
  b.innerHTML = '<span class="chip">+' + BAREME[a.id] + '</span>' +
    '<span class="grow"><span class="nm">' + a.titre + '</span>' +
    '<span class="sub">' + a.sous + '</span></span><span class="lab">&rarr;</span>';
  b.addEventListener('click', () => ouvrirApport(a));
  $('listeApports').appendChild(b);
});

function ouvrirApport(a) {
  const c = ouvrirFeuille(a.titre);
  let f1 = null, f2 = null;
  if (a.id === 'voisin') {
    f1 = champ(c, 'Nom ou surnom', 'ex. Tantie Awa');
    f2 = champ(c, 'Repère', 'ex. deuxième portail après le kiosque', true);
  } else if (a.id === 'repere') {
    f1 = champ(c, 'Ce qu\u2019on voit ici', 'ex. église catholique, mur ocre', true);
  } else if (a.id === 'commerce') {
    f1 = champ(c, 'Nom du commerce', 'ex. Alimentation Bénédiction');
    f2 = champ(c, 'Ce qu\u2019on y trouve', 'ex. alimentation, crédit téléphonique');
  } else if (a.id === 'photo') {
    f1 = champ(c, 'Ce que le livreur doit chercher', 'ex. portail bleu, numéro 14 peint', true);
  } else {
    f1 = champ(c, 'Nom employé par les gens', 'ex. rue du marché, voie du château d\u2019eau');
  }

  const note = document.createElement('span');
  note.className = 'sub';
  note.textContent = 'La position de ton téléphone est jointe. Ne renseigne l\u2019adresse de quelqu\u2019un qu\u2019avec son accord.';
  c.appendChild(note);

  const env = document.createElement('button');
  env.className = 'cta';
  env.innerHTML = 'Envoyer<i>&rarr;</i>';
  env.addEventListener('click', () => {
    if (!f1.value.trim()) return toast('Remplis au moins le premier champ.');
    env.disabled = true;
    Geo.obtenir(async (p) => {
      const texte = [f1.value.trim(), f2 && f2.value.trim()].filter(Boolean).join(' — ');
      try {
        await Api.apprendre({
          adresse_originale: '[' + a.id + '] ' + texte,
          lat: p.lat, lng: p.lng, quartier: '', source: 'contributeur'
        });
        feuille.classList.remove('on');
        toast('Merci. +' + Points.crediter(a.id) + ' points.');
      } catch (e) { toast(e.message || 'Envoi impossible.'); }
      env.disabled = false;
    }, (m) => { env.disabled = false; toast(m); });
  });
  c.appendChild(env);
}

/* ═══ SUR LA ROUTE ═══ */
function majAlertes() {
  const l = $('listeAlertes');
  $('rAutour').textContent = S.alertes.length;
  if (!S.alertes.length) {
    l.innerHTML = '<div class="empty">Rien à signaler autour de toi.<br/>Bonne route.</div>';
    return;
  }
  l.innerHTML = '';
  S.alertes.slice(0, 40).forEach((a) => {
    const b = document.createElement('button');
    b.className = 'alerte';
    b.innerHTML = '<span class="pip' + (a.fiabilite < 45 ? ' vieux' : '') + '"></span>' +
      '<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">' +
      '<span class="nm">' + a.libelle + '</span>' +
      '<span class="sub">' + (a.commentaire ? a.commentaire + ' · ' : '') +
      'à ' + fmt.distance(a.distance_m) + ' · il y a ' + a.age_min + ' min</span></span>' +
      '<span class="chip dim">' + a.confirmations + '</span>';
    b.addEventListener('click', () => {
      allerA('scrCarte');
      setTimeout(() => map.setView([a.lat, a.lng], 17), 80);
    });
    l.appendChild(b);
  });
}

async function chargerStatsRoute() {
  try {
    const d = await Api.statsRoute();
    serveurEstReveille();
    $('rVille').textContent = d.actifs != null ? d.actifs : '—';
    $('rJour').textContent = d.signales_24h != null ? d.signales_24h : '—';
  } catch (e) { /* sans importance : l'écran reste lisible */ }
}

$('btnRafraichir').addEventListener('click', () => {
  chargerAlertes();
  chargerStatsRoute();
  toast('Actualisé.');
});

/* ═══ MES LIEUX ═══ */
function majLieux() {
  const l = $('mesLieux');
  const mes = Lieux.liste();
  l.innerHTML = '';
  if (!mes.length) {
    l.innerHTML = '<div class="empty">Aucun lieu enregistré.<br/>Capture ta position pour commencer.</div>';
  }
  mes.forEach((x) => {
    const d = document.createElement('div');
    d.className = 'item';
    d.innerHTML = '<span class="grow"><span class="nm">' + x.nom + '</span>' +
      '<span class="sub mn" style="font-size:12px">' + x.geocode + '</span></span>';

    const y = document.createElement('button');
    y.className = 'chip acc';
    y.textContent = 'Y aller';
    y.addEventListener('click', async () => {
      try {
        const p = await Api.decoder(x.geocode);
        allerA('scrCarte');
        tracerTrajet({ lat: p.lat, lng: p.lng }, x.nom);
      } catch (e) { toast('Code illisible.'); }
    });

    const s = document.createElement('button');
    s.className = 'chip dim';
    s.textContent = 'Partager';
    s.addEventListener('click', () => {
      const t = Partage.texte(x.geocode, x.phrase, x.note, S.user && S.user.nom);
      Lieux.noterPartage({ geocode: x.geocode, phrase: x.phrase, canal: 'WhatsApp' });
      window.open(Partage.whatsapp(t), '_blank');
    });

    d.append(y, s);
    l.appendChild(d);
  });

  const p = $('mesPartages');
  const envois = Lieux.partages();
  p.innerHTML = '';
  if (!envois.length) {
    p.innerHTML = '<div class="empty">Rien de partagé pour l\u2019instant.</div>';
    return;
  }
  envois.forEach((x) => {
    const jours = Math.floor((Date.now() - x.quand) / 86400000);
    const quand = jours === 0 ? 'aujourd\u2019hui' : jours === 1 ? 'hier' : 'il y a ' + jours + ' jours';
    const d = document.createElement('div');
    d.className = 'item';
    d.innerHTML = '<span class="grow"><span class="nm" style="font-weight:700">par ' + x.canal + '</span>' +
      '<span class="sub">' + (x.phrase || x.geocode) + ' · ' + quand + '</span></span>';
    const r = document.createElement('button');
    r.className = 'chip dim';
    r.textContent = 'Renvoyer';
    r.addEventListener('click', () => {
      window.open(Partage.whatsapp(Partage.texte(x.geocode, x.phrase, '', S.user && S.user.nom)), '_blank');
    });
    d.appendChild(r);
    p.appendChild(d);
  });
}

$('btnAjouterLieu').addEventListener('click', () => allerA('scrPartager'));

/* ═══ PROFIL ═══ */
function majProfil() {
  S.user = Store.lire('user', null);
  const pts = Points.total();
  $('pPoints').textContent = pts;
  $('pApports').textContent = Points.apports();
  $('pRang').textContent = '—';

  const pionnier = pts >= 100;
  $('pBadge').textContent = pionnier ? 'Pionnier' : 'Nouveau';
  $('pBadgeNote').textContent = pionnier
    ? 'Ton nom figure sur la page publique de ta commune.'
    : 'Les 100 premiers d\u2019une commune deviennent Pionniers.';
  $('pProgres').style.width = Math.min(100, pts) + '%';
  $('pProgresTexte').textContent = Math.min(pts, 100) + ' / 100';

  const bc = $('btnCompte');
  if (S.user && Compte.connecte()) {
    $('pNom').textContent = S.user.nom;
    $('pTel').textContent = (S.user.tel || '') + (S.user.email ? ' · ' + S.user.email : '');
    $('pInitiales').textContent = S.user.nom.trim().split(/\s+/).map((m) => m[0]).join('').slice(0, 2).toUpperCase();
    bc.querySelector('.nm').textContent = 'Se déconnecter';
    bc.querySelector('.sub').textContent = 'Tes points et tes lieux restent sur ton compte';
    // Le rang vient du serveur : il n'existe que pour un compte confirmé.
    Api.classement().then((d) => {
      $('pRang').textContent = d.moi ? '#' + d.moi.rang : '—';
    }).catch(() => {});
  } else {
    $('pNom').textContent = 'Contributeur anonyme';
    $('pTel').textContent = 'Aucun compte sur cet appareil';
    $('pInitiales').textContent = 'RC';
    bc.querySelector('.nm').textContent = 'Créer un compte ou se connecter';
    bc.querySelector('.sub').textContent = 'Pour garder tes lieux et entrer au classement';
  }
}

/* Indicateur de robustesse : une ligne par règle, cochée au fil de la frappe. */
function jaugeMotDePasse(parent, champMdp) {
  const w = document.createElement('div');
  w.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  parent.appendChild(w);
  const maj = () => {
    w.innerHTML = '';
    MotDePasse.regles(champMdp.value).forEach((r) => {
      const t = document.createElement('span');
      t.className = 'chip' + (r.ok ? ' acc' : ' dim');
      t.textContent = (r.ok ? '✓ ' : '') + r.txt;
      w.appendChild(t);
    });
  };
  champMdp.addEventListener('input', maj);
  maj();
  return maj;
}

function bouton(parent, texte, classe) {
  const b = document.createElement('button');
  b.className = 'cta' + (classe ? ' ' + classe : '');
  b.innerHTML = texte + '<i>&rarr;</i>';
  parent.appendChild(b);
  return b;
}

function note(parent, texte) {
  const s = document.createElement('span');
  s.className = 'sub';
  s.textContent = texte;
  parent.appendChild(s);
  return s;
}

function feuilleInscription() {
  const c = ouvrirFeuille('Créer mon compte');
  const nom = champ(c, 'Nom', 'Ton nom');
  const tel = champ(c, 'Téléphone', '+225 07 00 00 00 00');
  tel.type = 'tel';
  const email = champ(c, 'Email', 'toi@exemple.com');
  email.type = 'email'; email.autocomplete = 'email';
  const mdp = champ(c, 'Mot de passe', '10 caractères minimum');
  mdp.type = 'password'; mdp.autocomplete = 'new-password';
  const maj = jaugeMotDePasse(c, mdp);

  const duo = document.createElement('div');
  duo.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';
  const gen = bouton(duo, 'Générer', 'out');
  const voir = bouton(duo, 'Afficher', 'out');
  c.appendChild(duo);
  gen.addEventListener('click', () => {
    mdp.value = MotDePasse.generer();
    mdp.type = 'text'; voir.firstChild.textContent = 'Masquer';
    maj();
    if (navigator.clipboard) navigator.clipboard.writeText(mdp.value).catch(() => {});
    toast('Mot de passe généré et copié. Garde-le précieusement.');
  });
  voir.addEventListener('click', () => {
    const cache = mdp.type === 'password';
    mdp.type = cache ? 'text' : 'password';
    voir.firstChild.textContent = cache ? 'Masquer' : 'Afficher';
  });

  note(c, 'Ton numéro sert à retrouver tes adresses. Il n\u2019est jamais affiché en entier, et personne ne peut retrouver ton adresse à partir de lui. Un code de confirmation part sur ton email.');

  const env = bouton(c, 'Recevoir mon code');
  env.addEventListener('click', async () => {
    if (!nom.value.trim() || !tel.value.trim() || !email.value.trim()) return toast('Nom, téléphone et email sont requis.');
    if (!MotDePasse.valide(mdp.value)) return toast('Le mot de passe ne remplit pas toutes les règles.');
    env.disabled = true;
    try {
      const d = await Api.inscription({ nom: nom.value.trim(), telephone: tel.value.trim(),
                                        email: email.value.trim(), mot_de_passe: mdp.value });
      feuilleCode(d.email, d.message);
    } catch (e) { toast(String(e.message || e)); }
    env.disabled = false;
  });

  const lien = document.createElement('button');
  lien.className = 'item';
  lien.innerHTML = '<span class="grow"><span class="nm">J\u2019ai déjà un compte</span>' +
    '<span class="sub">Se connecter</span></span><span class="lab">&rarr;</span>';
  lien.addEventListener('click', feuilleConnexion);
  c.appendChild(lien);
}

function feuilleCode(email, message) {
  const c = ouvrirFeuille('Confirme ton email');
  note(c, 'Un code à 6 chiffres vient de partir à ' + email + '. Il est valable 10 minutes. Regarde aussi dans les indésirables.');
  const code = champ(c, 'Code', '000000');
  code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 6;
  code.style.cssText = 'font-family:var(--mono);font-size:26px;letter-spacing:.3em';
  setTimeout(() => code.focus(), 80);

  const ok = bouton(c, 'Confirmer');
  const valider = async () => {
    const v = code.value.replace(/\D/g, '');
    if (v.length !== 6) return toast('Le code fait 6 chiffres.');
    ok.disabled = true;
    try {
      const d = await Api.verifier(email, v);
      const locaux = Points.total();
      Compte.ouvrir(d.token, d.profil);
      // Les points gagnés avant le compte sont repris une seule fois.
      if (locaux > 0) {
        try { const f = await Api.fusion(locaux); Compte.appliquer(f.profil); } catch (e) {}
      }
      Compte.syncLieux();
      feuille.classList.remove('on');
      majProfil(); majLieux();
      toast('Compte confirmé. Bienvenue ' + d.profil.nom.split(' ')[0] + '.');
    } catch (e) { toast(String(e.message || e)); }
    ok.disabled = false;
  };
  ok.addEventListener('click', valider);
  code.addEventListener('input', () => { if (code.value.replace(/\D/g, '').length === 6) valider(); });

  const re = bouton(c, 'Renvoyer le code', 'out');
  re.addEventListener('click', async () => {
    re.disabled = true;
    try { const d = await Api.renvoyer(email); toast(d.message || 'Code renvoyé.'); }
    catch (e) { toast(String(e.message || e)); }
    setTimeout(() => { re.disabled = false; }, 60000);   // même délai que le serveur
  });
  if (message && /impossible/i.test(message)) toast(message);
}

function feuilleConnexion() {
  const c = ouvrirFeuille('Se connecter');
  const email = champ(c, 'Email', 'toi@exemple.com');
  email.type = 'email'; email.autocomplete = 'email';
  const mdp = champ(c, 'Mot de passe', '');
  mdp.type = 'password'; mdp.autocomplete = 'current-password';
  const b = bouton(c, 'Se connecter');
  b.addEventListener('click', async () => {
    if (!email.value.trim() || !mdp.value) return toast('Email et mot de passe requis.');
    b.disabled = true;
    try {
      const d = await Api.connexion(email.value.trim(), mdp.value);
      Compte.ouvrir(d.token, d.profil);
      feuille.classList.remove('on');
      majProfil(); majLieux();
      toast('Connecté.');
    } catch (e) {
      const m = String(e.message || e);
      // Inscription jamais confirmée : le serveur a renvoyé un code.
      if (/pas encore confirmé/.test(m)) return feuilleCode(email.value.trim().toLowerCase());
      toast(m);
    }
    b.disabled = false;
  });
  const lien = document.createElement('button');
  lien.className = 'item';
  lien.innerHTML = '<span class="grow"><span class="nm">Pas encore de compte</span>' +
    '<span class="sub">Créer un compte</span></span><span class="lab">&rarr;</span>';
  lien.addEventListener('click', feuilleInscription);
  c.appendChild(lien);
}

$('btnCompte').addEventListener('click', () => {
  if (Compte.connecte()) {
    Compte.fermer();
    majProfil();
    return toast('Déconnecté. Tes données restent sur ton compte.');
  }
  feuilleInscription();
});

$('btnEffacer').addEventListener('click', () => {
  const c = ouvrirFeuille('Mes données');
  const connecte = Compte.connecte();
  const t = document.createElement('p');
  t.style.cssText = 'font-size:15px;line-height:1.5';
  t.textContent = connecte
    ? 'Le serveur garde ton nom, ton numéro, ton email, tes points, tes lieux enregistrés et les GeoCodes créés avec ton numéro. Les signalements de la route ne sont pas liés à ton compte.'
    : 'Cet appareil garde ton repère, tes lieux enregistrés, ton historique de partages et ton compteur de contributions. Rien d\u2019autre n\u2019est lié à toi sur le serveur.';
  c.appendChild(t);

  const b = bouton(c, connecte ? 'Effacer mon compte et mes adresses' : 'Tout effacer sur cet appareil');
  b.addEventListener('click', async () => {
    if (connecte) {
      if (!confirm('Effacer définitivement ton compte, tes points et tes adresses ? Ce n\u2019est pas réversible.')) return;
      b.disabled = true;
      try { const d = await Api.effacerCompte(); toast(d.message); }
      catch (e) { b.disabled = false; return toast(String(e.message || e)); }
    }
    /* On n'efface que les clés rc_ : les autres applications GeoDeliver
       peuvent partager ce domaine, leurs données ne nous appartiennent pas. */
    Object.keys(localStorage).filter((k) => k.indexOf('rc_') === 0)
      .forEach((k) => localStorage.removeItem(k));
    feuille.classList.remove('on');
    setTimeout(() => location.reload(), 900);
  });
  note(c, connecte
    ? 'L\u2019effacement est immédiat et complet, conformément à la loi ivoirienne sur les données personnelles.'
    : 'Sans compte, rien n\u2019est à effacer sur le serveur.');
});

/* ═══ BANNIÈRE D'INSTALLATION ═══
   Le bandeau natif du navigateur n'apparaît qu'après des règles d'usage que
   l'utilisateur ne voit jamais expliquées. On en montre une à nous, qui dit
   pourquoi installer, et qui propose la bonne marche à suivre même sur
   Safari iOS, qui ne déclenche jamais beforeinstallprompt. */
(function () {
  const deja_installee = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (deja_installee || Store.lire('installIgnoree', false)) return;

  const banniere = $('installBanniere');
  const fermer = () => { banniere.classList.remove('on'); Store.ecrire('installIgnoree', true); };
  $('btnFermerInstall').addEventListener('click', fermer);

  let invite = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invite = e;
    banniere.classList.add('on');
  });
  $('btnInstaller').addEventListener('click', async () => {
    if (!invite) return fermer();
    invite.prompt();
    await invite.userChoice;
    invite = null;
    banniere.classList.remove('on');
  });
  window.addEventListener('appinstalled', fermer);

  /* Safari iOS ne propose jamais l'installation elle-même : la seule porte
     d'entrée est Partager → Sur l'écran d'accueil, qu'il faut expliquer. */
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (iOS) {
    $('installTexte').textContent =
      'Appuie sur Partager, puis « Sur l’écran d’accueil ».';
    $('btnInstaller').style.display = 'none';
    setTimeout(() => banniere.classList.add('on'), 2000);
  }
})();

/* ═══ DÉMARRAGE ═══ */
majLieux();
majProfil();
// Le serveur fait foi : on recharge points et lieux dès l'ouverture.
Compte.rafraichir().then((pr) => { if (pr) { majProfil(); majLieux(); } });
chargerLieux();
chargerAlertes();
chargerStatsRoute();
localiser((p) => { map.setView([p.lat, p.lng], 16); }, () => {});
