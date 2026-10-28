/* Contrôle de cohérence des exports CSV pour ArcGIS Pro. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = { window: {}, document: { readyState: 'loading', addEventListener() {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'repere-west-africa.js'), 'utf8'), context);
const catalog = context.window.RepereWestAfrica;
function csvRows(filename, columns) {
  const content = fs.readFileSync(path.join(root, 'data/arcgis', filename), 'utf8');
  assert.ok(!content.startsWith('\uFEFF'), 'CSV UTF-8 sans BOM attendu');
  const lines = content.trimEnd().split(/\r?\n/);
  assert.equal(lines.shift(), columns.join(','));
  return lines.map(line => {
    const values = line.split(',');
    assert.equal(values.length, columns.length, line);
    return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
  });
}
function validCoordinates(row) {
  assert.ok(Number.isFinite(Number(row.latitude)) && Math.abs(Number(row.latitude)) <= 90);
  assert.ok(Number.isFinite(Number(row.longitude)) && Math.abs(Number(row.longitude)) <= 180);
  assert.equal(row.coordinate_status, 'approximate_center');
  assert.equal(row.source, 'repere-west-africa.js');
}
test('export pays : 16 centres indicatifs synchronisés avec le catalogue', () => {
  const rows = csvRows('countries.csv', ['country_code','country_name','latitude','longitude','zoom','coordinate_status','source']);
  assert.equal(rows.length, 16);
  assert.equal(rows.length, catalog.countries.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], c = catalog.countries[i];
    assert.equal(r.country_code, c.code);
    assert.equal(r.country_name, c.name);
    assert.equal(Number(r.latitude), c.lat);
    assert.equal(Number(r.longitude), c.lng);
    assert.equal(Number(r.zoom), c.zoom);
    validCoordinates(r);
  }
});
test('export villes : 24 centres indicatifs synchronisés avec le catalogue', () => {
  const rows = csvRows('cities.csv', ['city_name','country_code','latitude','longitude','coordinate_status','source']);
  assert.equal(rows.length, 24);
  assert.equal(rows.length, catalog.cities.length);
  const codes = new Set(catalog.countries.map(c => c.code));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], c = catalog.cities[i];
    assert.equal(r.city_name, c.name);
    assert.equal(r.country_code, c.country);
    assert.ok(codes.has(r.country_code));
    assert.equal(Number(r.latitude), c.lat);
    assert.equal(Number(r.longitude), c.lng);
    validCoordinates(r);
  }
});
