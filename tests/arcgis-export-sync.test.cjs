'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generate } = require('../scripts/export-arcgis-geojson.cjs');

test('ArcGIS: checked-in centers.geojson matches the CSV-generated export byte for byte', () => {
  const output = path.resolve(__dirname, '../data/arcgis/centers.geojson');
  const committed = fs.readFileSync(output, 'utf8');
  const generated = generate();
  assert.equal(committed, generated,
    'centers.geojson is out of sync; run node scripts/export-arcgis-geojson.cjs');
});

test('ArcGIS: generating the export is deterministic and ends with a newline', () => {
  const first = generate();
  assert.equal(generate(), first);
  assert.ok(first.endsWith('\n'));
  assert.ok(!first.endsWith('\n\n'));
});
