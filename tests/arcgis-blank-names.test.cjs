'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCatalog } = require('../scripts/export-arcgis-geojson.cjs');

function catalog() {
  const codes = ['BJ','BF','CV','CI','GM','GH','GN','GW','LR','ML','MR','NE','NG','SN','SL','TG'];
  return {
    countries: codes.map((country_code, i) => ({ country_code, country_name: 'Pays ' + i })),
    cities: Array.from({ length: 24 }, (_, i) => ({
      country_code: codes[i % codes.length], city_name: 'Ville ' + i
    }))
  };
}

test('catalogue de référence : 16 pays et 24 villes acceptés', () => {
  const { countries, cities } = catalog();
  assert.doesNotThrow(() => validateCatalog(countries, cities));
});

test('nom de pays fourni mais vide ou blanc refusé', () => {
  for (const name of ['', '   ', '\t']) {
    const { countries, cities } = catalog();
    countries[0].country_name = name;
    assert.throws(() => validateCatalog(countries, cities), /Catalogue/);
  }
});

test('nom de ville vide ou blanc refusé', () => {
  for (const name of ['', '   ', '\t']) {
    const { countries, cities } = catalog();
    cities[0].city_name = name;
    assert.throws(() => validateCatalog(countries, cities), /Catalogue/);
  }
});

test('compatibilité : noms de pays absents dans les anciens jeux de tests', () => {
  const { countries, cities } = catalog();
  countries.forEach(row => delete row.country_name);
  assert.doesNotThrow(() => validateCatalog(countries, cities));
});
