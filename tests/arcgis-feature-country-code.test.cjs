'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { feature } = require('../scripts/export-arcgis-geojson.cjs');

const base = {
  country_code: 'SN',
  country_name: 'Sénégal',
  city_name: 'Dakar',
  latitude: '14.7167',
  longitude: '-17.4677',
  zoom: '7',
  coordinate_status: 'approximate_center',
  source: 'repere-west-africa.js'
};

test('GeoJSON : codes pays ISO alpha-2 valides conservés pour pays et villes', () => {
  for (const kind of ['country', 'city']) {
    assert.equal(feature(base, kind).properties.country_code, 'SN');
  }
});

test('GeoJSON : codes pays invalides rejetés pour pays et villes', () => {
  for (const kind of ['country', 'city']) {
    for (const code of [undefined, null, '', 'S', 'SEN', 'sn', 'S1', ' SN', 'SN ', 12, {}]) {
      assert.throws(() => feature({ ...base, country_code: code }, kind), /Code pays invalide/);
    }
  }
});
