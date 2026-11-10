'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { feature } = require('../scripts/export-arcgis-geojson.cjs');

const row = {
  country_code: 'SN',
  country_name: 'Sénégal',
  city_name: 'Dakar',
  latitude: '14.7167',
  longitude: '-17.4677',
  zoom: '7',
  coordinate_status: 'approximate_center',
  source: 'repere-west-africa.js'
};

test('GeoJSON : seuls les types country et city sont acceptés', () => {
  for (const kind of ['region', 'Country', '', null, undefined]) {
    assert.throws(() => feature(row, kind), /Type de centre GeoJSON invalide/);
  }
});

test('GeoJSON : les types existants conservent leurs propriétés', () => {
  assert.equal(feature(row, 'country').properties.kind, 'country_center');
  assert.equal(feature(row, 'country').properties.zoom, 7);
  assert.equal(feature(row, 'city').properties.kind, 'city_center');
  assert.equal(feature(row, 'city').properties.zoom, null);
});
