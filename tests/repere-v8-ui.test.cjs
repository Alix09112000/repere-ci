const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html'), css=read('repere-v8.css'), ui=read('repere-maps.js');
const app=read('repere-app.js'), gl=read('repere-3d.js');

test('fond Plan et Détaillé séparés du bouton 3D et des repères',()=>{
 for(const id of ['repereLayersToggle','repereLayersClose','repereLayersPanel',
   'repereMapPlan','repereMapDetail','repereMap3D','reperePlacesToggle'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/<section id="repereLayersPanel"[\s\S]*?role="dialog"[\s\S]*?hidden>/);
 assert.match(html,/id="repereLayersToggle"[\s\S]*?aria-expanded="false"/);
 assert.match(html,/id="repereMap3D"[\s\S]*?aria-pressed="false"/);
 assert.match(html,/id="reperePlacesToggle"[\s\S]*?aria-pressed="true"/);
 assert.doesNotMatch(html,/<div class="repere-map-style-switch"/);
});

test('Satellite : aucun fond sans fournisseur ni licence valide',()=>{
 assert.match(html,/Satellite/);
 assert.match(html,/Source à connecter/);
 assert.match(html,/source d’imagerie et de sa licence/);
 assert.doesNotMatch(html,/id="repereMapSatellite"/);
 assert.doesNotMatch(app,/tileLayer\(['"]https:\/\/[^\s]+satellite/);
});

test('design V8 chargé en dernier et présent dans le cache PWA',()=>{
 const older=html.indexOf('href="repere-maps.css"');
 const newer=html.indexOf('href="repere-v8.css"');
 assert.ok(older>=0 && newer>older);
 const sw=read('sw.js');
 assert.match(sw,/repere-ci-coque-v19/);
 assert.match(sw,/'\.\/repere-v8\.css'/);
 assert.match(css,/#scrCarte \.repere-layers-panel\[hidden\]/);
});

test('panneau de couches accessible au clavier, avec fermeture contextualisée',()=>{
 assert.match(ui,/function openLayers\(\)/);
 assert.match(ui,/function closeLayers\(restoreFocus=false\)/);
 assert.match(ui,/if \(e\.key === 'Escape'/);
 assert.match(ui,/layersClose\?\.focus\(\)/);
 assert.match(ui,/if \(guiding\) closeLayers\(false\)/);
 assert.match(ui,/layersTrigger\.setAttribute\('aria-expanded','true'\)/);
});

test('le panneau Explorer est compact au démarrage sur téléphone',()=>{
 assert.match(ui,/setCollapsed\(isCompact\(\)\)/);
 assert.match(css,/#scrCarte\.sheet-collapsed \.feuille-bas/);
 assert.match(css,/#scrCarte\.sheet-collapsed \.repere-sheet-heading p\{display:none\}/);
 assert.match(css,/@media\(min-width:900px\)/);
});

test('masquer les POI ne désactive pas les itinéraires ni le GPS',()=>{
 assert.match(ui,/Store\.lire\('placesVisible', true\)/);
 assert.match(ui,/Store\.ecrire\('placesVisible', placesVisible\)/);
 assert.match(ui,/map\.removeLayer\(coucheLieux\)/);
 assert.match(ui,/Repere3D\.setPlacesVisible\(placesVisible\)/);
 assert.match(app,/window\.RepereLayers\?\.placesVisible !== false/);
 assert.match(gl,/function setPlacesVisible\(value\)/);
 assert.match(gl,/if\(!placesVisible\) \{ setGeo\('repere-3d-points',VIDE\);return; \}/);
 assert.match(gl,/updatePosition\(lastPosition,false\)/);
 assert.match(gl,/updateRoute\(lastRoute\)/);
});

test('tous les IDs HTML sont uniques',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(v=>v[1]);
 assert.equal(ids.length,new Set(ids).size);
});
