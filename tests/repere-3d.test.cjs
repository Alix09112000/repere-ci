const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const lire=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const helpers=vm.runInNewContext(lire('repere-3d-data.js')+'\nRepere3DData');

test('requête Overpass bornée et 180 bâtiments maximum',()=>{
 const text=helpers.requete({lat:5.348,lng:-4.02});
 assert.match(text,/way\["building"\]/);
 assert.match(text,/out geom 180;/);
 assert.match(text,/timeout:12/);
 const bbox=helpers.rectangle({lat:5.348,lng:-4.02});
 assert.equal(bbox.length,4);
 assert.ok(bbox[2]-bbox[0]<.005);
});
test('hauteurs explicites en mètres',()=>{
 const h=helpers.hauteur({height:'14.2 m',min_height:'2'});
 assert.equal(h.height,14.2);
 assert.equal(h.base,2);
 assert.equal(h.estime,false);
});
test('étages → hauteur estimée, pas annoncée mesurée',()=>{
 const h=helpers.hauteur({'building:levels':'3'});
 assert.equal(h.height,9);
 assert.equal(h.estime,true);
 const missing=helpers.hauteur({});
 assert.equal(missing.height,7);
 assert.equal(missing.estime,true);
 assert.equal(helpers.nombre('absurde'),null);
 assert.equal(helpers.nombre('1000'),null);
});
test('OSM Ways transformés en GeoJSON de vrais polygones',()=>{
 const data=helpers.convertir({elements:[
   {type:'way',id:7,tags:{height:'12'},
    geometry:[{lat:5,lon:-4},{lat:5,lon:-3.99},{lat:5.01,lon:-3.99},{lat:5,lon:-4}]},
   {type:'way',id:8,tags:{'building:levels':'2'},
    geometry:[{lat:5.01,lon:-4},{lat:5.01,lon:-3.99},{lat:5.02,lon:-3.99},{lat:5.01,lon:-4}]}
 ]});
 assert.equal(data.type,'FeatureCollection');
 assert.equal(data.features.length,2);
 assert.equal(data.features[0].properties.osmId,'7');
 assert.equal(data.features[0].properties.height,12);
 assert.equal(data.features[0].geometry.coordinates[0][0][0],-4);
 assert.equal(data.features[1].properties.estimated,true);
});
test('ne convertit pas les chemins ouverts ou géométries mal formées',()=>{
 const broken=helpers.convertir({elements:[
   {type:'way',id:1,geometry:[{lat:5,lon:-4},{lat:5,lon:-3.99},{lat:5.01,lon:-4}]},
   {type:'node',id:2,geometry:[{lat:5,lon:-4}]},
   {type:'way',id:3,geometry:[{lat:300,lon:10},{lat:5,lon:-4},{lat:5.01,lon:-4},{lat:300,lon:10}]},
 ]});
 assert.equal(broken.features.length,0);
});
test('la 3D n’est pas démarrée sans demande explicite',()=>{
 const code=lire('repere-3d.js');
 assert.match(code,/el\('repereMap3D'\)\?\.addEventListener\('click',toggle\)/);
 assert.match(code,/await loadLibrary\(\)/);
 assert.match(code,/if\(!window\.WebGLRenderingContext\)/);
 assert.match(code,/function leave\(\)/);
 assert.match(code,/map\.invalidateSize\(\)/);
 assert.match(code,/repere-3d-buildings/);
 assert.match(code,/fill-extrusion/);
 assert.match(code,/updateRoute\(lastRoute\)/);
 assert.match(code,/updatePosition\(lastPosition,false\)/);
});
test('les données OSM n’ont pas de coordonnées personnelles en requête hors mode 3D',()=>{
 const code=lire('repere-3d.js');
 assert.match(code,/if\(!active\|\|!ready\)return;/);
 assert.match(code,/if\(Date\.now\(\)-timestampBuildings<45000\)return;/);
 assert.match(code,/maxzoom:19/);
});
