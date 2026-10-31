/* Vérifie la traçabilité et les limites des exports ArcGIS Pro. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const provenance = require('../data/arcgis/provenance.json');
const geojson = JSON.parse(fs.readFileSync(path.join(root, 'data/arcgis/centers.geojson'), 'utf8'));
const lines = file => fs.readFileSync(path.join(root, file), 'utf8').trimEnd().split(/\r?\n/);

test('métadonnées ArcGIS : précision, licence et date non inventées', () => {
  assert.equal(provenance.schema_version, 1);
  assert.equal(provenance.coordinate_reference_system, 'EPSG:4326');
  assert.equal(provenance.geojson_coordinate_order, 'longitude,latitude');
  assert.equal(provenance.source_catalog, 'repere-west-africa.js');
  assert.equal(provenance.source_scope, 'internal_application_catalog_only');
  assert.equal(provenance.coordinate_status, 'approximate_center');
  assert.equal(provenance.external_source_verified, false);
  assert.equal(provenance.source_license_verified, false);
  assert.equal(provenance.source_observation_date, null);
  assert.equal(provenance.positional_accuracy_meters, null);
  assert.ok(provenance.limitations.length >= 3);
});

test('couverture déclarée conforme aux 16 pays et 24 villes', () => {
  const countryRows = lines('data/arcgis/countries.csv').slice(1);
  const cityRows = lines('data/arcgis/cities.csv').slice(1);
  const codes = countryRows.map(row => row.split(',')[0]).sort();
  assert.equal(countryRows.length, 16);
  assert.equal(cityRows.length, 24);
  assert.deepEqual(provenance.country_codes, codes);
  assert.equal(new Set(codes).size, 16);
  assert.equal(geojson.features.length, 40);
  assert.ok(geojson.features.every(feature =>
    feature.properties.coordinate_status === provenance.coordinate_status &&
    feature.properties.source === provenance.source_catalog &&
    codes.includes(feature.properties.country_code)));
});

test('inventaire des fichiers et nombres d’enregistrements synchronisés', () => {
  const expected = new Map([
    ['data/arcgis/countries.csv', 16],
    ['data/arcgis/cities.csv', 24],
    ['data/arcgis/centers.geojson', 40]
  ]);
  assert.equal(provenance.datasets.length, expected.size);
  for (const dataset of provenance.datasets) {
    assert.ok(expected.has(dataset.path), dataset.path);
    assert.equal(dataset.record_count, expected.get(dataset.path));
    assert.ok(fs.existsSync(path.join(root, dataset.path)), dataset.path);
    const actual = dataset.format === 'CSV'
      ? lines(dataset.path).length - 1
      : JSON.parse(fs.readFileSync(path.join(root, dataset.path), 'utf8')).features.length;
    assert.equal(actual, dataset.record_count, dataset.path);
    expected.delete(dataset.path);
  }
  assert.equal(expected.size, 0);
});
