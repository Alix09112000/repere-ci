/* Catalogue régional et recherche indicative, sans réseau ni DOM complet.
   Exécuter : node --test tests/repere-west-africa.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../repere-west-africa.js'), 'utf8');
const contexte = {
  window: {},
  document: { readyState: 'loading', addEventListener() {} }
};
vm.runInNewContext(source, contexte, { filename: 'repere-west-africa.js' });
const region = contexte.window.RepereWestAfrica;

test('les 16 pays ont des codes uniques et des centres géographiques valides', () => {
  assert.equal(region.countries.length, 16);
  assert.equal(new Set(region.countries.map(p => p.code)).size, 16);
  for (const p of region.countries) {
    assert.match(p.code, /^[A-Z]{2}$/);
    assert.ok(p.name.length > 0);
    assert.ok(Number.isFinite(p.lat) && Math.abs(p.lat) <= 90);
    assert.ok(Number.isFinite(p.lng) && Math.abs(p.lng) <= 180);
    assert.ok(Number.isInteger(p.zoom) && p.zoom > 0 && p.zoom <= 18);
  }
});

test('les villes sont reliées à un pays du catalogue et chaque pays est représenté', () => {
  const codes = new Set(region.countries.map(p => p.code));
  assert.ok(region.cities.length >= 16);
  assert.equal(new Set(region.cities.map(c => c.name + ':' + c.country)).size, region.cities.length);
  for (const city of region.cities) {
    assert.ok(codes.has(city.country), city.name + ' : code pays inconnu');
    assert.ok(Number.isFinite(city.lat) && Math.abs(city.lat) <= 90);
    assert.ok(Number.isFinite(city.lng) && Math.abs(city.lng) <= 180);
  }
  for (const code of codes) {
    assert.ok(region.cities.some(c => c.country === code), code + ' : aucune ville');
  }
});

test('recherche sans accents, avec espaces et apostrophes usuelles', () => {
  assert.equal(region.searchCities('lome')[0].name, 'Lomé');
  assert.equal(region.searchCities('saint louis')[0].name, 'Saint-Louis');
  assert.equal(region.searchCities("cote d'ivoire").length, 3);
  assert.equal(region.searchCities('côte d’ivoire').length, 3);
  assert.equal(region.searchCities('guinee bissau')[0].name, 'Bissau');
});

test('les codes pays trouvent les villes correspondantes, sans fausse précision', () => {
  const hits = region.searchCities('CI');
  assert.equal(hits.length, 3);
  assert.ok(hits.every(c => c.country === 'CI'));
  assert.equal(region.searchCities('SN')[0].country, 'SN');
  assert.equal(region.searchCities('adresse inconnue').length, 0);
});

test('recherche vide, limites et résultats plafonnés', () => {
  assert.equal(region.searchCities(' ').length, 0);
  assert.equal(region.searchCities('a').length, 0);
  assert.equal(region.searchCities('CI', 0).length, 0);
  assert.equal(region.searchCities('CI', 1).length, 1);
  assert.ok(region.searchCities('a', 100).length <= 50);
});
