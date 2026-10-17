const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lire = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const poi = vm.runInNewContext(lire('repere-poi.js')+'\nReperePoi');
const donnees = [
  { nom:'Pharmacie centrale', libelle:'Pharmacie', lat:5.3482, lng:-4.02 },
  { nom:'École du quartier', categorie:'ecole', lat:5.35, lng:-4.018 },
  { nom:'Banque du marché', type:'banque', lat:5.36, lng:-4.03 },
  { nom:'Lieu sans coordonnées', libelle:'Marché', lat:null, lng:null },
];

test('marquage par catégories, accents et défaut sûr', () => {
  assert.equal(poi.categorie(donnees[0]), 'pharmacie');
  assert.equal(poi.categorie(donnees[1]), 'ecole');
  assert.equal(poi.categorie(donnees[2]), 'banque');
  assert.equal(poi.categorie({libelle:'Hôpital'}), 'sante');
  assert.equal(poi.categorie({libelle:'Maquis'}), 'restaurant');
  assert.equal(poi.categorie({libelle:'Lieu à découvrir'}), 'autre');
  const couleurs = ['pharmacie','ecole','banque'].map((_,i)=>poi.profil(donnees[i]).couleur);
  assert.equal(new Set(couleurs).size, 3);
});

test('sélection proche, tri et coordonnées invalides', () => {
  const r = poi.selectionner(donnees, l=>Math.round((l.lat-5.348)*100000),5);
  assert.equal(r.length,3);
  assert.equal(r[0].lieu.nom,'Pharmacie centrale');
  assert.equal(r[1].lieu.nom,'École du quartier');
  assert.equal(r[2].lieu.nom,'Banque du marché');
  assert.equal(poi.valide({lat:null,lng:null}),false);
  assert.equal(poi.valide({lat:12,lng:-192}),false);
});

test('labels permanents seulement au fort zoom, avec collision limitée', () => {
  const points = [
    {lieu:{nom:'A'},distance:5},
    {lieu:{nom:'B'},distance:10},
    {lieu:{nom:'C'},distance:20},
    {lieu:{nom:'D'},distance:40},
  ];
  const calc = l=>({A:{x:30,y:40},B:{x:50,y:48},C:{x:200,y:180},D:{x:400,y:240}}[l.nom]);
  assert.equal(poi.etiquettes(points,calc,15).size,0);
  const labels=poi.etiquettes(points,calc,18,2);
  assert.equal(labels.size,2);
  assert.equal([...labels][0].nom,'A');
  assert.equal([...labels][1].nom,'C');
});

test('sources d’un lieu affichées avec textContent et non HTML brut', () => {
  const app = lire('repere-app.js');
  assert.match(app,/titre\.textContent = String\(l\.nom \|\| p\.nom\)/);
  assert.match(app,/texte\.textContent = String\(l\.nom\)/);
  assert.match(app,/const lieux = \(d\.lieux \|\| \[\]\)\.filter\(ReperePoi\.valide\)/);
  assert.match(app,/marqueur\.bindTooltip\(texte,/);
});

test('sélecteur de fonds détail avec attributs de copyright', () => {
  const app = lire('repere-app.js');
  assert.match(app,/tile\.openstreetmap\.fr\/hot/);
  assert.match(app,/style <a href="https:\/\/www\.hotosm\.org\/">HOT<\/a>/);
  assert.match(app,/repereMapPlan.*addEventListener/);
  assert.match(app,/repereMapDetail.*addEventListener/);
  assert.match(app,/fondsCarte\[fondActif\]\.addTo\(map\)/);
  const html=lire('index.html');
  assert.match(html,/id="repereMapPlan"/);
  assert.match(html,/id="repereMapDetail"/);
  assert.ok(html.indexOf('src="repere-poi.js"')<html.indexOf('src="repere-app.js"'));
});
