/* Export GeoJSON des centres indicatifs : synchronisation et structure RFC 7946. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generate } = require('../scripts/export-arcgis-geojson.cjs');

const file = path.join(__dirname, '../data/arcgis/centers.geojson');
const text = fs.readFileSync(file, 'utf8');
const geojson = JSON.parse(text);

test('GeoJSON déterministe et synchronisé avec les CSV ArcGIS Pro', () => {
  assert.equal(text, generate(), 'Relancer node scripts/export-arcgis-geojson.cjs');
});

test('40 centres ponctuels indicatifs, dont 16 pays et 24 villes', () => {
  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 40);
  const countries = geojson.features.filter(f => f.properties.kind === 'country_center');
  const cities = geojson.features.filter(f => f.properties.kind === 'city_center');
  assert.equal(countries.length, 16);
  assert.equal(cities.length, 24);
  const codes = new Set(countries.map(f => f.properties.country_code));
  assert.equal(codes.size, 16);
  assert.ok(cities.every(f => codes.has(f.properties.country_code)));
  assert.equal(new Set(cities.map(f => f.properties.country_code + ':' + f.properties.name)).size, 24);
});

test('WGS84 : longitude avant latitude, provenance et précision non surestimée', () => {
  for (const feature of geojson.features) {
    assert.equal(feature.type, 'Feature');
    assert.equal(feature.geometry.type, 'Point');
    assert.equal(feature.geometry.coordinates.length, 2);
    const [lon, lat] = feature.geometry.coordinates;
    assert.ok(Number.isFinite(lon) && Math.abs(lon) <= 180);
    assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90);
    assert.equal(feature.properties.coordinate_status, 'approximate_center');
    assert.equal(feature.properties.source, 'repere-west-africa.js');
    assert.ok(feature.properties.name.length > 0);
    assert.match(feature.properties.country_code, /^[A-Z]{2}$/);
    if (feature.properties.kind === 'country_center') {
      assert.ok(Number.isInteger(feature.properties.zoom));
    } else {
      assert.equal(feature.properties.zoom, null);
    }
  }
});
