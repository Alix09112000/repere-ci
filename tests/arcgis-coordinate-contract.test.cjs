'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { feature } = require('../scripts/export-arcgis-geojson.cjs');

const base = {
  country_code: 'SN',
  country_name: 'Sénégal',
  latitude: '14.7167',
  longitude: '-17.4677',
  zoom: '7',
  coordinate_status: 'approximate_center',
  source: 'repere-west-africa.js'
};

test('GeoJSON : coordonnées dans l’ordre longitude, latitude', () => {
  const result = feature(base, 'country');
  assert.deepEqual(result.geometry, {
    type: 'Point', coordinates: [-17.4677, 14.7167]
  });
  assert.equal(result.properties.coordinate_status, 'approximate_center');
  assert.equal(result.properties.zoom, 7);
});

test('GeoJSON : latitudes et longitudes hors bornes refusées', () => {
  for (const [key, value] of [
    ['latitude', '90.0001'], ['latitude', '-90.0001'],
    ['longitude', '180.0001'], ['longitude', '-180.0001']
  ]) {
    assert.throws(() => feature({ ...base, [key]: value }, 'country'), /Coordonnées invalides/);
  }
});

test('GeoJSON : notations numériques ambiguës refusées', () => {
  for (const value of ['1e1', '0x10', 'NaN', 'Infinity', '14,7', ' 14.7']) {
    assert.throws(() => feature({ ...base, latitude: value }, 'country'), /Coordonnées non décimales/);
  }
});

test('GeoJSON : provenance et statut indicatif obligatoires', () => {
  assert.throws(() => feature({ ...base, source: 'unknown' }, 'country'), /Provenance/);
  assert.throws(() => feature({ ...base, coordinate_status: 'surveyed' }, 'country'), /Provenance/);
});

test('GeoJSON : zoom strict et absence de zoom pour les villes', () => {
  for (const zoom of ['0', '19', '01', '1e1', '0xA']) {
    assert.throws(() => feature({ ...base, zoom }, 'country'), /Zoom invalide/);
  }
  const city = feature({ ...base, city_name: 'Dakar' }, 'city');
  assert.equal(city.properties.zoom, null);
  assert.equal(city.properties.kind, 'city_center');
});
