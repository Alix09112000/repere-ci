/* Génère l'export GeoJSON indicatif à partir des CSV ArcGIS Pro.
   node scripts/export-arcgis-geojson.cjs [--check]
   Sans dépendances externes ni accès réseau. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data', 'arcgis');
const outputPath = path.join(dataDir, 'centers.geojson');

function rows(filename, columns) {
  const content = fs.readFileSync(path.join(dataDir, filename), 'utf8');
  if (content.startsWith('\uFEFF')) throw new Error(filename + ' : BOM inattendu');
  const lines = content.trimEnd().split(/\r?\n/);
  if (lines.shift() !== columns.join(',')) throw new Error(filename + ' : en-tête inattendu');
  return lines.map((line, i) => {
    const fields = line.split(',');
    if (fields.length !== columns.length || fields.some(v => !v.trim())) {
      throw new Error(filename + ' : ligne ' + (i + 2) + ' invalide');
    }
    return Object.fromEntries(columns.map((key, j) => [key, fields[j]]));
  });
}

function feature(row, kind) {
  if (kind !== 'country' && kind !== 'city') {
    throw new Error('Type de centre GeoJSON invalide : ' + String(kind));
  }
  if (row.coordinate_status !== 'approximate_center' || row.source !== 'repere-west-africa.js') {
    throw new Error('Provenance ou précision non reconnue : ' + (row.city_name || row.country_name));
  }
  // Ne pas accepter les syntaxes implicites de Number() (hexadécimal, exposant, etc.).
  // Les exports ArcGIS sont documentés comme des décimaux à point.
  const decimal = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!decimal.test(row.latitude) || !decimal.test(row.longitude)) {
    throw new Error('Coordonnées non décimales : ' + (row.city_name || row.country_name));
  }
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 ||
      !Number.isFinite(lon) || Math.abs(lon) > 180) {
    throw new Error('Coordonnées invalides : ' + (row.city_name || row.country_name));
  }
  // Le zoom doit être un entier décimal explicite, sans notation hexadécimale ou exponentielle.
  const zoom = kind === 'country' ? Number(row.zoom) : null;
  if (kind === 'country' && (!/^(?:[1-9]|1[0-8])$/.test(String(row.zoom)) || !Number.isInteger(zoom))) {
    throw new Error('Zoom invalide : ' + row.country_name);
  }
  return {
    type: 'Feature',
    properties: {
      name: kind === 'country' ? row.country_name : row.city_name,
      country_code: row.country_code,
      kind: kind + '_center',
      coordinate_status: row.coordinate_status,
      source: row.source,
      zoom
    },
    geometry: { type: 'Point', coordinates: [lon, lat] }
  };
}

function validateCatalog(countries, cities) {
  const codes = new Set(countries.map(row => row.country_code));
  const normalizeCity = name => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  const namedCountries = countries.filter(row => row.country_name != null);
  const countryNames = new Set(namedCountries.map(row => normalizeCity(row.country_name)));
  // Les anciens tests peuvent omettre country_name, mais un nom fourni ne doit pas être vide.
  // Les noms doivent rester des chaînes : String(123) ou String({}) masquerait une donnée invalide.
  const invalidNames = namedCountries.some(row => typeof row.country_name !== 'string' || !normalizeCity(row.country_name)) ||
    cities.some(row => typeof row.city_name !== 'string' || !normalizeCity(row.city_name));
  const cityKeys = new Set(cities.map(row => JSON.stringify([row.country_code, normalizeCity(row.city_name)])));
  if (countries.length !== 16 || codes.size !== 16 || countryNames.size !== namedCountries.length || invalidNames || cities.length !== 24 ||
      countries.some(row => !/^[A-Z]{2}$/.test(row.country_code)) ||
      cities.some(row => !codes.has(row.country_code)) ||
      cityKeys.size !== cities.length) {
    throw new Error('Catalogue de pays ou villes incohérent');
  }
}

function generate() {
  const countries = rows('countries.csv',
    ['country_code', 'country_name', 'latitude', 'longitude', 'zoom', 'coordinate_status', 'source']);
  const cities = rows('cities.csv',
    ['city_name', 'country_code', 'latitude', 'longitude', 'coordinate_status', 'source']);
  validateCatalog(countries, cities);
  const features = [
    ...countries.map(row => feature(row, 'country')),
    ...cities.map(row => feature(row, 'city'))
  ];
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2) + '\n';
}

if (require.main === module) {
  const generated = generate();
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== generated) {
      console.error('centers.geojson est absent ou désynchronisé : relancer node scripts/export-arcgis-geojson.cjs');
      process.exitCode = 1;
    } else {
      console.log('centers.geojson : export synchronisé (40 centres indicatifs)');
    }
  } else {
    fs.writeFileSync(outputPath, generated, 'utf8');
    console.log('Export GeoJSON généré : ' + outputPath);
  }
}
module.exports = { generate, feature, validateCatalog };
