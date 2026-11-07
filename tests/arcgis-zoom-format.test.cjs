'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { feature } = require('../scripts/export-arcgis-geojson.cjs');

const base = {
  country_name: 'Pays test',
  country_code: 'CI',
  latitude: '5.3',
  longitude: '-4.0',
  coordinate_status: 'approximate_center',
  source: 'repere-west-africa.js',
  zoom: '8'
};

test('zoom décimal valide conservé pour un centre de pays', () => {
  assert.equal(feature(base, 'country').properties.zoom, 8);
  assert.equal(feature({ ...base, zoom: '18' }, 'country').properties.zoom, 18);
});

test('notations implicites et zooms hors plage rejetés', () => {
  for (const zoom of ['0xA', '1e1', '8.0', '+8', '08', '0', '19', 'NaN', '']) {
    assert.throws(() => feature({ ...base, zoom }, 'country'), /Zoom invalide/, zoom);
  }
});

test('les centres de villes ne nécessitent pas de zoom', () => {
  const city = { ...base, city_name: 'Ville test' };
  delete city.zoom;
  assert.equal(feature(city, 'city').properties.zoom, null);
});
