'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generate } = require('../scripts/export-arcgis-geojson.cjs');

test('ArcGIS export: 16 country centers and 24 city centers, with valid GeoJSON geometry', () => {
  const collection = JSON.parse(generate());
  assert.equal(collection.type, 'FeatureCollection');
  assert.equal(collection.features.length, 40);
  const counts = { country_center: 0, city_center: 0 };
  const codes = new Set();
  for (const feature of collection.features) {
    assert.equal(feature.type, 'Feature');
    assert.equal(feature.geometry.type, 'Point');
    assert.equal(feature.geometry.coordinates.length, 2);
    const [lon, lat] = feature.geometry.coordinates;
    assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180);
    assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90);
    assert.equal(feature.properties.coordinate_status, 'approximate_center');
    assert.equal(feature.properties.source, 'repere-west-africa.js');
    assert.ok(typeof feature.properties.name === 'string' && feature.properties.name.trim());
    assert.match(feature.properties.country_code, /^[A-Z]{2}$/);
    assert.ok(Object.hasOwn(counts, feature.properties.kind));
    counts[feature.properties.kind]++;
    if (feature.properties.kind === 'country_center') {
      codes.add(feature.properties.country_code);
      assert.ok(Number.isInteger(feature.properties.zoom));
    } else {
      assert.equal(feature.properties.zoom, null);
    }
  }
  assert.deepEqual(counts, { country_center: 16, city_center: 24 });
  assert.equal(codes.size, 16);
  for (const feature of collection.features) {
    assert.ok(codes.has(feature.properties.country_code));
  }
});
