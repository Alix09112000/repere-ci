const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const html=read('index.html');
const js=read('repere-maps.js');
const css=read('repere-v8-2.css');

test('le bandeau de marque est un véritable élément HTML avant la recherche',()=>{
 const header=html.indexOf('class="repere-topbar"');
 const search=html.indexOf('class="chercher"');
 const map=html.indexOf('id="map"');
 assert.ok(map<header&&header<search);
 assert.match(html,/<strong>Repère Maps<\/strong>/);
 assert.match(html,/Explorez la Côte d’Ivoire/);
 assert.ok(html.indexOf('id="repereLayersToggle"')>header);
 assert.ok(html.indexOf('id="repereLayersToggle"')<search);
});
test('la feuille Explorer dispose d’un raccourci interactif visible en mode compact',()=>{
 const shortcut=html.indexOf('id="repereExploreShortcut"');
 const sheetContent=html.indexOf('id="repereSheetContent"');
 const head=html.indexOf('id="repereSheetToggle"');
 assert.ok(head<shortcut && shortcut<sheetContent);
 assert.match(js,/exploreShortcut\?\.addEventListener\('click'/);
 assert.match(js,/setCollapsed\(false\)/);
 assert.match(js,/setCollapsed\(isCompact\(\)\)/);
 assert.match(css,/#scrCarte\.sheet-collapsed \.repere-explore-shortcut\{display:flex\}/);
});
test('le badge de carte décrit la zone affichée sans inventer la position GPS',()=>{
 assert.match(html,/id="repereMapContext"/);
 assert.match(html,/id="repereMapContextLabel"/);
 assert.match(js,/map\.getCenter\(\)/);
 assert.match(js,/map\.distance\(/);
 assert.match(js,/Abidjan · Repères à proximité/);
 assert.match(js,/Côte d’Ivoire · Repères locaux/);
 assert.match(js,/Explorer la carte/);
 assert.match(js,/contextButton\?\.addEventListener\('click'/);
});
test('carte, recherche, catégories et panneaux restent liés aux fonctions connues',()=>{
 const app=read('repere-app.js');
 for(const id of ['map','map3d','qDest','btnChercher','suggest','carteEtat',
  'feuilleBas','btnAllerPartager','btnAllerLieux','btnRecentrer',
  'btnSignaler','repereLayersPanel','repereMap3D','consigne','trajet']) {
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(app,/document\.querySelector\('#scrCarte \.mapwrap'\)\.appendChild\(bandeFiltres\)/);
 assert.match(css,/#scrCarte \.filtres/);
 assert.match(css,/#app \.tabs/);
});
test('le design est une véritable mise en page mobile et ordinateur',()=>{
 assert.match(css,/#scrCarte \.repere-topbar\{/);
 assert.match(css,/#scrCarte \.chercher\{/);
 assert.match(css,/#scrCarte \.feuille-bas\{/);
 assert.match(css,/#scrCarte \.repere-map-context\{/);
 assert.match(css,/@media\(min-width:900px\)/);
 assert.match(css,/@media\(max-width:400px\)/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/#scrCarte\.repere-guiding \.repere-topbar/);
});
test('les règles de priorité conservent la navigation active dégagée',()=>{
 assert.match(css,/#scrCarte\.repere-route-preview \.repere-topbar/);
 assert.match(css,/#scrCarte\.repere-guiding \.repere-map-context/);
 assert.match(css,/#scrCarte\.repere-guiding \.chercher/);
 assert.match(css,/#scrCarte\.repere-route-preview \.cmds/);
 assert.match(css,/#scrCarte\.repere-guiding #map \.leaflet-bottom/);
});
test('la dernière feuille de style et le cache PWA sont bien à jour',()=>{
 const old=html.indexOf('href="repere-v8.css"');
 const latest=html.indexOf('href="repere-v8-2.css"');
 assert.ok(old>=0 && latest>old);
 const sw=read('sw.js');
 assert.match(sw,/repere-ci-coque-v19/);
 assert.match(sw,/'\.\/repere-v8-2\.css'/);
});
test('pas de faux bouton satellite et aucune perte des contrôles existants',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length);
 assert.doesNotMatch(html,/id="repereMapSatellite"/);
 assert.match(html,/Source à connecter/);
 assert.match(html,/id="reperePlacesToggle"/);
 assert.match(html,/id="repere3dTilt"/);
});
