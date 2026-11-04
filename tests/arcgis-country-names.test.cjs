'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCatalog } = require('../scripts/export-arcgis-geojson.cjs');

function fixture() {
  const codes = ['BF','BJ','CI','CV','GH','GM','GN','GW','LR','ML','MR','NE','NG','SL','SN','TG'];
  return {
    countries: codes.map((country_code, i) => ({ country_code, country_name: 'Country ' + i })),
    cities: Array.from({ length: 24 }, (_, i) => ({
      country_code: codes[i % codes.length],
      city_name: 'City ' + i
    }))
  };
}

test('catalogue témoin : 16 pays et 24 villes distincts', () => {
  const { countries, cities } = fixture();
  assert.doesNotThrow(() => validateCatalog(countries, cities));
});

test('rejette les noms de pays identiques après normalisation des accents et de la casse', () => {
  const { countries, cities } = fixture();
  countries[0].country_name = 'Côte d Ivoire';
  countries[1].country_name = ' COTE D IVOIRE ';
  assert.throws(() => validateCatalog(countries, cities), /Catalogue de pays ou villes incohérent/);
});

test('rejette les noms de pays identiques après normalisation des espaces', () => {
  const { countries, cities } = fixture();
  countries[0].country_name = 'Guinée Bissau';
  countries[1].country_name = 'Guinée   Bissau';
  assert.throws(() => validateCatalog(countries, cities), /Catalogue de pays ou villes incohérent/);
});
