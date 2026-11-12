'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCatalog } = require('../scripts/export-arcgis-geojson.cjs');

function catalog() {
  const countries = Array.from({ length: 16 }, (_, i) => ({
    country_code: 'A' + String.fromCharCode(65 + i),
    country_name: 'Pays ' + i
  }));
  const cities = Array.from({ length: 24 }, (_, i) => ({
    country_code: countries[i % 16].country_code,
    city_name: 'Ville ' + i
  }));
  return { countries, cities };
}

test('ArcGIS catalog accepts valid string geographic names', () => {
  const { countries, cities } = catalog();
  assert.doesNotThrow(() => validateCatalog(countries, cities));
});

test('ArcGIS catalog rejects non-string city names', () => {
  for (const invalid of [123, true, {}, ['Dakar']]) {
    const { countries, cities } = catalog();
    cities[0].city_name = invalid;
    assert.throws(() => validateCatalog(countries, cities), /Catalogue de pays ou villes incohérent/);
  }
});

test('ArcGIS catalog rejects non-string supplied country names', () => {
  for (const invalid of [123, true, {}, ['Sénégal']]) {
    const { countries, cities } = catalog();
    countries[0].country_name = invalid;
    assert.throws(() => validateCatalog(countries, cities), /Catalogue de pays ou villes incohérent/);
  }
});
