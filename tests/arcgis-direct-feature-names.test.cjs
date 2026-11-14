'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { feature } = require('../scripts/export-arcgis-geojson.cjs');

const base = {
  country_code: 'SN',
  country_name: 'Sénégal',
  city_name: 'Dakar',
  latitude: '14.7',
  longitude: '-17.4',
  zoom: '7',
  coordinate_status: 'approximate_center',
  source: 'repere-west-africa.js'
};

for (const kind of ['country', 'city']) {
  const field = kind === 'country' ? 'country_name' : 'city_name';
  test('feature rejects invalid ' + field + ' on direct call', () => {
    for (const value of [undefined, null, '', '   ', 123, {}]) {
      assert.throws(() => feature({ ...base, [field]: value }, kind), /Nom géographique invalide/);
    }
  });
  test('feature preserves valid ' + field, () => {
    const result = feature(base, kind);
    assert.equal(result.properties.name, base[field]);
    assert.deepEqual(result.geometry.coordinates, [-17.4, 14.7]);
  });
}
