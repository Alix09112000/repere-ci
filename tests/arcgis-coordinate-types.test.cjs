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

test('ArcGIS: reject non-string latitude and longitude even when coercible to decimals', () => {
  for (const kind of ['country', 'city']) {
    for (const key of ['latitude', 'longitude']) {
      for (const value of [14.7, 0, null, undefined, true, ['14.7']]) {
        assert.throws(
          () => feature({ ...base, [key]: value }, kind),
          /Coordonnées non décimales/,
          kind + ' ' + key + ' ' + String(value)
        );
      }
    }
  }
});

test('ArcGIS: preserve valid string decimals for country and city centers', () => {
  for (const kind of ['country', 'city']) {
    const point = feature(base, kind);
    assert.deepEqual(point.geometry.coordinates, [-17.4677, 14.7167]);
  }
});
