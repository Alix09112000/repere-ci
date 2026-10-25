/* Exécuter localement : node --test tests/repere-routing.test.cjs
   Sans dépendance npm. Les appels réseau sont simulés : un test navigateur
   connecté est nécessaire pour valider le service Valhalla public. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../repere-routing.js'), 'utf8');
const origine = { lat: 5.348, lng: -4.020 };
const destination = { lat: 5.354, lng: -4.015 };
function moteur(fetch) {
  return vm.runInNewContext(source + '\nRepereRouting', { fetch, encodeURIComponent });
}
function route(distance, duree) {
  return {
    distance, duration: duree,
    geometry: { type: 'LineString', coordinates: [[-4.020,5.348],[-4.015,5.354]] },
    legs: [{ steps: [{ distance, maneuver: { type: 'depart' } }] }]
  };
}
const fixture = { routes: [route(4200,500),route(3400,650),route(5000,800)] };

test('modes voiture, vélo, pied transmis à Valhalla', () => {
  const moteurTest = moteur(async () => ({ok:true,json:async()=>fixture}));
  for (const [mode,costing] of Object.entries({voiture:'auto',velo:'bicycle',pied:'pedestrian'})) {
    const payload = moteurTest.requeteValhalla(origine,destination,{mode});
    assert.equal(payload.costing,costing);
    assert.equal(payload.format,'osrm');
    assert.equal(payload.shape_format,'geojson');
  }
});
test('les préférences voiture sont bien transférées', () => {
  const m = moteur(async()=>({ok:true,json:async()=>fixture}));
  const sansAutoroute = m.requeteValhalla(origine,destination,{mode:'voiture',autoroutes:'eviter'});
  assert.equal(sansAutoroute.costing_options.auto.use_highways,0);
  const autoroute = m.requeteValhalla(origine,destination,{mode:'voiture',autoroutes:'favoriser'});
  assert.equal(autoroute.costing_options.auto.use_highways,1);
  const peages = m.requeteValhalla(origine,destination,{mode:'voiture',sansPeage:true});
  assert.equal(peages.costing_options.auto.use_tolls,0);
  const combinaison = m.requeteValhalla(origine,destination,{mode:'voiture',critere:'court',autoroutes:'eviter'});
  assert.equal(combinaison.costing_options.auto.shortest,undefined);
});
test('classement rapide, court, long parmi les options', () => {
  const m = moteur(async()=>({ok:true,json:async()=>fixture}));
  assert.equal(m.classer(fixture.routes,{critere:'rapide'})[0].duration,500);
  assert.equal(m.classer(fixture.routes,{critere:'court'})[0].distance,3400);
  assert.equal(m.classer(fixture.routes,{critere:'alternatives'})[0].distance,5000);
});
test('un service absent ne remplace pas marche ou vélo par voiture', async () => {
  const urls=[];
  const m=moteur(async url=>{urls.push(url);if(url.includes('valhalla1'))throw Error('réseau');return {ok:true,json:async()=>fixture};});
  await assert.rejects(m.calculer(origine,destination,{mode:'pied'}));
  await assert.rejects(m.calculer(origine,destination,{mode:'velo'}));
  await assert.rejects(m.calculer(origine,destination,{mode:'voiture',autoroutes:'eviter'}));
  assert.equal(urls.length,3);
  const result=await m.calculer(origine,destination,{mode:'voiture'});
  assert.match(result.source,/OSRM/);
  assert.equal(urls.length,5);
});
test('les coordonnées absentes ne sont pas converties en (0, 0)', () => {
  const m = moteur(async()=>({ok:true,json:async()=>fixture}));
  for (const valeur of [null, undefined, '', ' ', false, true, NaN, Infinity]) {
    assert.throws(
      () => m.requeteValhalla({lat:valeur,lng:-4.020},destination,{}),
      /Coordonnées du trajet invalides/
    );
    assert.throws(
      () => m.requeteValhalla(origine,{lat:5.354,lng:valeur},{}),
      /Coordonnées du trajet invalides/
    );
  }
  assert.throws(() => m.requeteValhalla({lng:-4.020},destination,{}),
    /Coordonnées du trajet invalides/);
  assert.throws(() => m.requeteValhalla(origine,{lat:91,lng:0},{}),
    /Coordonnées du trajet invalides/);
  assert.throws(() => m.requeteValhalla(origine,{lat:0,lng:181},{}),
    /Coordonnées du trajet invalides/);
  const zero = m.requeteValhalla({lat:0,lng:0},destination,{});
  assert.equal(zero.locations[0].lat,0);
  assert.equal(zero.locations[0].lon,0);
  const chaine = m.requeteValhalla({lat:'5.348',lng:'-4.020'},destination,{});
  assert.equal(chaine.locations[0].lat,5.348);
  assert.equal(chaine.locations[0].lon,-4.020);
});

test('les réponses corrompues sont rejetées', () => {
  const m=moteur(async()=>({ok:true,json:async()=>fixture}));
  assert.throws(()=>m.validerReponse({routes:[{duration:1,distance:3} ]},{}));
});
