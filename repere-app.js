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
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: ATTRIBUTION, maxZoom: 19, subdomains: 'abc'
}).addTo(map);
map.attributionControl.setPrefix('');

const coucheLieux = L.layerGroup().addTo(map);
const coucheAlertes = L.layerGroup().addTo(map);
const coucheTrajet = L.layerGroup().addTo(map);
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
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, subdomains: 'abc'
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
let chargeEnCours = null;
async function chargerLieux() {
  const c = map.getCenter();
  const rayon = Math.min(3000, Math.round(map.getBounds().getNorthEast().distanceTo(c)));
  const cle = c.lat.toFixed(4) + c.lng.toFixed(4) + rayon + S.filtre;
  chargeEnCours = cle;
  try {
    const d = await Api.lieuxProches(c.lat, c.lng, rayon, S.filtre);
    if (chargeEnCours !== cle) return;   // une requête plus récente a pris la main
    coucheLieux.clearLayers();
    (d.lieux || []).forEach((l) => {
      L.marker([l.lat, l.lng], { icon: carre(9, '#0F766E', false) })
        .bindPopup(popupLieu(l))
        .addTo(coucheLieux);
    });
    S.nbLieux = (d.lieux || []).length;
  } catch (e) {
    S.nbLieux = null;
  }
  majEtat();
}

function popupLieu(l) {
  const nom = String(l.nom).replace(/'/g, '\u2019');
  return '<strong>' + nom + '</strong><br/>' + l.libelle +
    (l.geocode ? '<br/><span class="mn" style="font-size:12px">' + l.geocode + '</span>' : '') +
    '<br/><button class="chip acc" style="margin-top:8px" onclick="allerVers(' +
    l.lat + ',' + l.lng + ',&quot;' + nom + '&quot;)">M\u2019y rendre</button>';
}

/* ═══ SIGNALEMENTS SUR LA CARTE ═══ */
async function chargerAlertes() {
  const c = map.getCenter();
  const rayon = Math.min(6000, Math.round(map.getBounds().getNorthEast().distanceTo(c)));
  try {
    const d = await Api.alertes(c.lat, c.lng, rayon);
    S.alertes = d.signalements || [];
    coucheAlertes.clearLayers();
    S.alertes.forEach((a) => {
      L.marker([a.lat, a.lng], { icon: losange(a.fiabilite) })
        .bindPopup(popupAlerte(a))
        .addTo(coucheAlertes);
    });
  } catch (e) {
    S.alertes = [];
    $('listeAlertes').innerHTML =
      '<div class="empty">Signalements indisponibles.<br/>Vérifie ta connexion.</div>';
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
  const bouts = [S.nbLieux === null ? 'Repères indisponibles' : S.nbLieux + ' repères'];
  if (S.alertes.length) bouts.push(S.alertes.length + ' alerte' + (S.alertes.length > 1 ? 's' : ''));
  const el = $('carteEtat');
  el.textContent = bouts.join(' · ');
  el.style.color = S.alertes.length ? 'var(--accent)' : 'var(--ink-70)';
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

map.on('moveend', () => { chargerLieux(); chargerAlertes(); });

/* ═══ MA POSITION ═══ */
function localiser(onOk, onErr) {
  Geo.obtenir((p) => {
    if (marqueurMoi) map.removeLayer(marqueurMoi);
    marqueurMoi = L.marker([p.lat, p.lng], { icon: carre(15, '#0F766E', true) }).addTo(map);
    onOk(p);
  }, onErr);
}

$('btnRecentrer').addEventListener('click', () => {
  localiser((p) => { map.setView([p.lat, p.lng], 17); }, (m) => toast(m));
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

async function tracerTrajet(dest, nom) {
  if (!Geo.derniere) {
    return localiser(() => tracerTrajet(dest, nom), (m) => toast(m));
  }
  /* Pendant le guidage, un recalcul ne doit pas rouvrir le panneau ni
     recadrer la carte sur tout le trajet : on reste derrière le conducteur. */
  const enGuidage = Nav.actif;
  const p = Geo.derniere;
  toast('Calcul du trajet…');
  try {
    const r = await fetch(OSRM + p.lng + ',' + p.lat + ';' + dest.lng + ',' + dest.lat +
      '?overview=full&geometries=geojson&steps=true');
    const d = await r.json();
    if (!d.routes || !d.routes.length) throw new Error('Aucune route');
    const route = d.routes[0];
    const ligne = route.geometry.coordinates.map((c) => [c[1], c[0]]);

    coucheTrajet.clearLayers();
    L.polyline(ligne, { color: '#ffffff', weight: 10, opacity: 1 }).addTo(coucheTrajet);
    L.polyline(ligne, { color: '#0F766E', weight: 6, opacity: 1, lineCap: 'round' }).addTo(coucheTrajet);
    if (marqueurDest) map.removeLayer(marqueurDest);
    marqueurDest = L.marker([dest.lat, dest.lng], { icon: carre(19, '#13232A', true) }).addTo(map);
    if (!enGuidage) map.fitBounds(L.latLngBounds(ligne), { padding: [50, 50] });

    /* Les signalements qui touchent le trajet passent avant les instructions :
       un bouchon à trois rues de là n'intéresse personne. */
    const surLaRoute = S.alertes.filter((a) =>
      ligne.some((q) => Math.abs(q[0] - a.lat) < 0.0025 && Math.abs(q[1] - a.lng) < 0.0025));

    $('tDest').textContent = nom;
    const res = $('tResume');
    res.textContent = fmt.distance(route.distance) + ' · ' + fmt.duree(route.duration) +
      ' · arrivée ' + fmt.heure(new Date(Date.now() + route.duration * 1000)) +
      (surLaRoute.length ? ' · ' + surLaRoute.length + ' alerte(s)' : '');
    res.style.color = surLaRoute.length ? 'var(--accent)' : '';

    const e = $('tEtapes');
    e.innerHTML = '';
    surLaRoute.forEach((a) => {
      const d2 = document.createElement('div');
      d2.className = 'etape';
      d2.innerHTML = '<span class="n" style="color:var(--accent)">!</span>' +
        '<span style="flex:1;min-width:0"><span class="nm">' + a.libelle + '</span>' +
        (a.commentaire ? '<br/><span class="sub">' + a.commentaire + '</span>' : '') + '</span>';
      e.appendChild(d2);
    });
    (route.legs[0].steps || []).forEach((pas) => {
      const d2 = document.createElement('div');
      d2.className = 'etape';
      d2.innerHTML = '<span class="n">' + fmt.distance(pas.distance) + '</span>' +
        '<span style="flex:1;min-width:0">' + direManoeuvre(pas) + '</span>';
      e.appendChild(d2);
    });

    Nav.route = { ligne: ligne, etapes: route.legs[0].steps || [], dest: dest, nom: nom };
    Nav.preparer();
    if (enGuidage) return;   // le bandeau de consigne reprend la main tout seul
    $('btnDemarrer').style.display = 'flex';
    $('trajet').classList.add('on');
    $('suggest').classList.remove('on');
    $('feuilleBas').style.display = 'none';
  } catch (err) {
    toast('Trajet impossible à calculer — réessaie.');
  }
}

window.allerVers = (lat, lng, nom) => { map.closePopup(); allerA('scrCarte'); tracerTrajet({ lat, lng }, nom); };

/* Un seul point de sortie du trajet, qu'il soit fermé depuis l'aperçu
   (avant guidage), interrompu en cours de route, ou terminé à l'arrivée :
   la carte doit toujours revenir à son état de départ. */
function finirTrajet() {
  Nav.arreter();
  $('trajet').classList.remove('on');
  $('feuilleBas').style.display = 'flex';
  coucheTrajet.clearLayers();
  if (marqueurDest) { map.removeLayer(marqueurDest); marqueurDest = null; }
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
  etape: 0,
  annonces: {},         // manœuvres déjà dites, pour ne pas se répéter
  horsRoute: 0,

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
    if (!Nav.route) return toast('Choisis d\u2019abord une destination.');
    if (!('geolocation' in navigator)) return toast('Ce téléphone ne donne pas la position.');

    Nav.actif = true;
    Nav.etape = 0;
    Nav.annonces = {};
    Nav.horsRoute = 0;
    $('consigne').classList.add('on');
    // Recherche et filtres n'ont rien à faire là pendant le guidage, et la
    // bande de filtres dépassait sous le bandeau rouge.
    document.querySelector('#scrCarte .mapwrap').classList.add('guidage');
    $('trajet').classList.remove('on');
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
      () => toast('Position perdue — le guidage continue à l\u2019aveugle.'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
    );
  },

  arreter() {
    if (Nav.veille !== null) { navigator.geolocation.clearWatch(Nav.veille); Nav.veille = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    Nav.actif = false;
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
    Geo.derniere = pos;

    if (marqueurMoi) map.removeLayer(marqueurMoi);
    marqueurMoi = L.marker([pos.lat, pos.lng], { icon: carre(15, '#0F766E', true) }).addTo(map);
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 16), { animate: true });

    const pr = Nav.progres(pos);

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
$('btnVoix').addEventListener('click', () => {
  Nav.muet = !Nav.muet;
  Store.ecrire('muet', Nav.muet);
  majBoutonVoix();
  if (Nav.muet && 'speechSynthesis' in window) speechSynthesis.cancel();
  toast(Nav.muet ? 'Voix coupée.' : 'Voix rétablie.');
});
majBoutonVoix();

/* ═══ RECHERCHE DE DESTINATION ═══ */
function proposer(items) {
  const s = $('suggest');
  s.innerHTML = '';
  if (!items.length) {
    s.innerHTML = '<div class="empty">Rien trouvé sous ce nom.</div>';
    s.classList.add('on');
    return;
  }
  items.forEach((it) => {
    const b = document.createElement('button');
    b.innerHTML = '<span class="chip dim">' + (it.etiquette || 'Lieu') + '</span>' +
      '<span class="grow"><span class="nm">' + it.nom + '</span>' +
      (it.sous ? '<span class="sub">' + it.sous + '</span>' : '') + '</span>';
    b.addEventListener('click', () => {
      $('qDest').value = it.nom;
      s.classList.remove('on');
      tracerTrajet(it, it.nom);
    });
    s.appendChild(b);
  });
  s.classList.add('on');
}

async function chercherDestination() {
  const q = $('qDest').value.trim();
  if (q.length < 2) return;

  /* Un GeoCode d'abord : c'est ce que les gens reçoivent par WhatsApp, et ce
     qu'aucune autre application de navigation ne sait lire. */
  if (RE_GEOCODE.test(q)) {
    try {
      const d = await Api.decoder(q);
      return proposer([{
        nom: d.geocode, etiquette: 'Repère',
        sous: (d.quartier || '') + (d.ville ? ', ' + d.ville : '') +
              (d.occupant ? ' — occupant ' + d.occupant : ''),
        lat: d.lat, lng: d.lng
      }]);
    } catch (e) { toast(e.message || 'Code non reconnu.'); }
  }

  try {
    const d = await Api.lieux(q, 12, Geo.derniere);
    proposer((d.lieux || []).map((l) => ({
      nom: l.nom, etiquette: l.libelle,
      /* La distance est le renseignement décisif : elle évite de lancer un
         trajet de soixante kilomètres en croyant viser le quartier d'à côté. */
      sous: [l.libelle, l.commune, l.distance_m != null ? fmt.distance(l.distance_m) : null]
        .filter(Boolean).join(' · '),
      lat: l.lat, lng: l.lng
    })));
  } catch (e) { toast('Recherche indisponible.'); }
}

let minuteur;
$('qDest').addEventListener('input', () => {
  clearTimeout(minuteur);
  if ($('qDest').value.trim().length < 2) { $('suggest').classList.remove('on'); return; }
  minuteur = setTimeout(chercherDestination, 350);
});
$('btnChercher').addEventListener('click', chercherDestination);
$('qDest').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('qDest').blur(); chercherDestination(); }
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
          telephone: (S.user && S.user.tel) || '+2250700000000',
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

/* ═══ DÉMARRAGE ═══ */
majLieux();
majProfil();
// Le serveur fait foi : on recharge points et lieux dès l'ouverture.
Compte.rafraichir().then((pr) => { if (pr) { majProfil(); majLieux(); } });
chargerLieux();
chargerAlertes();
chargerStatsRoute();
localiser((p) => { map.setView([p.lat, p.lng], 16); }, () => {});
