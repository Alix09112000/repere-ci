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
test('carte vectorielle et bâtiments OpenFreeMap : pas de raster étiré',()=>{
 const code=lire('repere-3d.js');
 assert.match(code,/https:\/\/tiles\.openfreemap\.org\/styles\/bright/);
 assert.match(code,/https:\/\/tiles\.openfreemap\.org\/planet/);
 assert.match(code,/source-layer':'building'/);
 assert.match(code,/fill-extrusion/);
 assert.match(code,/render_height/);
 assert.match(code,/render_min_height/);
 assert.doesNotMatch(code,/type:'raster'/);
 assert.doesNotMatch(code,/async function buildings\(\)/);
 assert.doesNotMatch(code,/overpass-api/);
});
test('chargement 3D seulement si l’utilisateur l’active ; sortie 2D',()=>{
 const code=lire('repere-3d.js');
 assert.match(code,/el\('repereMap3D'\)\?\.addEventListener\('click',toggle\)/);
 assert.match(code,/await loadLibrary\(\)/);
 assert.match(code,/if\(!window\.WebGLRenderingContext\)/);
 assert.match(code,/function leave\(\)/);
 assert.match(code,/map\.invalidateSize\(\)/);
 assert.match(code,/updateRoute\(lastRoute\)/);
 assert.match(code,/updatePosition\(lastPosition,false\)/);
});
test('points d’intérêt filtrés et étiquetés selon le zoom',()=>{
 const code=lire('repere-3d.js');
 assert.match(code,/function renderPlaces\(\)/);
 assert.match(code,/if\(zoom<15\.5\)/);
 assert.match(code,/const maximum=zoom>=17\?22:12/);
 assert.match(code,/bounds\.contains/);
 assert.match(code,/occupied\.some/);
 assert.match(code,/repere-3d-place-labels/);
 assert.match(code,/text-allow-overlap':false/);
});
test('sélection de repères espacés dans la zone visible (simulation)',()=>{
 const code=lire('repere-3d.js');
 const a=code.indexOf('  function renderPlaces() {');
 const b=code.indexOf('  function updatePlaces(lieux) {',a);
 assert.ok(a>=0&&b>a);
 const snippet=code.slice(a,b);
 const saved={data:null};
 const instance={
   getZoom:()=>16,
   getCenter:()=>({lat:5.348,lng:-4.02}),
   getBounds:()=>({contains:([x,y])=>x>-4.03&&x<-4.01&&y>5.34&&y<5.36}),
   project:([x,y])=>({x:(x+4.03)*100000,y:(y-5.34)*100000})
 };
 const lieux=Array.from({length:45},(_,i)=>({
   nom:'Lieu '+i,lat:5.345+(i%8)*0.0003,lng:-4.025+Math.floor(i/8)*0.00035
 }));
 let events=[];
 const render=vm.runInNewContext(snippet+'\nrenderPlaces',{
   instance,ready:true,lastPlaces:lieux,
   VIDE:{type:'FeatureCollection',features:[]},
   geojson:features=>({type:'FeatureCollection',features}),
   ReperePoi:{profil:()=>({couleur:'#087F68'})},
   setGeo:(id,val)=>{saved.data=val;events.push(id)}
 });
 render();
 assert.equal(events[0],'repere-3d-points');
 assert.ok(saved.data.features.length>0);
 assert.ok(saved.data.features.length<=12);
 assert.ok(saved.data.features.every(f=>f.properties.name.startsWith('Lieu')));
 const all=saved.data.features.map(f=>instance.project(f.geometry.coordinates));
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   assert.ok(Math.abs(all[i].x-all[j].x)>=52 || Math.abs(all[i].y-all[j].y)>=42);
 }
});
