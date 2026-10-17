/* Node.js --test : aucun appel réseau ni dépendance tierce. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lire = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const source = lire('repere-app.js');

const configStart = source.indexOf('const STYLES_PAR_MODE =');
const configEnd = source.indexOf('/* Dessine le tracé réel', configStart);
if (configStart < 0 || configEnd < 0) throw Error('Profils de tracés introuvables');
const styles = vm.runInNewContext(source.slice(configStart, configEnd) + '\nSTYLES_PAR_MODE');
const affichageStart = source.indexOf('function afficherAlternatives(routes, dest, nom) {');
const affichageEnd = source.indexOf('\nfunction replierEtapes()', affichageStart);
if (affichageStart < 0 || affichageEnd < 0) throw Error('Comparateur introuvable');

class Élément {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.className = '';
    this.hidden = false;
    this.textContent = '';
  }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, cb) { this.listeners[event] = cb; }
  click() { this.listeners.click?.(); }
  querySelectorAll(query) {
    return query === '.repere-route-option'
      ? this.children.filter(el => el.className.includes('repere-route-option'))
      : [];
  }
  get classList() {
    return {
      toggle: (name, active) => {
        const all = new Set(this.className.split(/\s+/).filter(Boolean));
        if (active) all.add(name); else all.delete(name);
        this.className = [...all].join(' ');
      }
    };
  }
}
const route = (distance, duration) => ({
  distance, duration,
  geometry: { type: 'LineString', coordinates: [[-4.02,5.348],[-4.015,5.354]] },
  legs: [{steps:[]}]
});

function comparateur(mode) {
  const panel = new Élément('div');
  const overlays = [];
  const selections = [];
  const context = {
    document: { createElement: tag => new Élément(tag) },
    $: name => name === 'tAlternatives' ? panel : undefined,
    lireOptionsTrajet: () => ({mode, critere:'rapide'}),
    STYLES_PAR_MODE: styles,
    fmt: { duree: n => Math.round(n / 60) + ' min',
      distance: n => (n / 1000).toFixed(1) + ' km' },
    afficherRoute: r => { selections.push(r); overlays.splice(0); },
    L: { polyline: (coords, options) => ({
      addTo() { overlays.push({coords,options}); return this; },
      bringToBack() { return this; }
    }) },
    coucheAlternatives: {}
  };
  const fn = vm.runInNewContext(
    source.slice(affichageStart, affichageEnd) + '\nafficherAlternatives',
    context
  );
  return { fn, panel, overlays, selections };
}

test('aucun choix manuel de plus court / plus long dans l’interface', () => {
  const html = lire('index.html');
  assert.doesNotMatch(html, /id="routeCritere"/);
  for (const mode of ['voiture','velo','pied']) {
    assert.match(html, new RegExp('name="routeMode" value="' + mode + '"'));
  }
  assert.match(html, /Choix automatique/);
});

test('les trois tracés ont des styles et couleurs distincts', () => {
  const profils = ['voiture','velo','pied'].map(mode => styles[mode]);
  assert.equal(new Set(profils.map(p => p.couleur)).size, 3);
  assert.equal(styles.voiture.dash, null);
  assert.match(styles.velo.dash, /\d+\s+\d+/);
  assert.match(styles.pied.dash, /\d+\s+\d+/);
  assert.equal(styles.voiture.animation, true);
  assert.equal(styles.velo.animation, false);
  assert.equal(styles.pied.animation, false);
});

test('légende du tracé cohérente avec le mode choisi', () => {
  const css = lire('repere-maps.css');
  assert.match(css, /#trajet\[data-mode="velo"\] \.repere-route-legend-line/);
  assert.match(css, /#trajet\[data-mode="pied"\] \.repere-route-legend-line/);
  assert.match(source, /repereRouteVisualDescription/);
  assert.match(source, /repere-route-main repere-route-/);
});

test('détection automatique plus rapide, plus court et plus long proposé', () => {
  const {fn,panel,overlays} = comparateur('voiture');
  const routes = [route(7000,600),route(5200,780),route(8100,950)];
  fn(routes,{lat:5.36,lng:-4.01},'Marché');
  assert.equal(panel.children.length, 3);
  assert.equal(panel.children[0].attributes['aria-pressed'],'true');
  const noms = panel.children.map(c => c.children[0].textContent);
  assert.match(noms[0], /le plus rapide proposé/);
  assert.match(noms[1], /le plus court proposé/);
  assert.match(noms[2], /le plus long proposé/);
  assert.equal(overlays.length,2);
  assert.equal(overlays[0].options.color,styles.voiture.couleur);
});

test('sélection d’une alternative et redraw des autres options', () => {
  const {fn,panel,overlays,selections} = comparateur('velo');
  const routes = [route(7000,600),route(5200,780),route(8100,950)];
  fn(routes,{lat:5.36,lng:-4.01},'Marché');
  panel.children[1].click();
  assert.equal(panel.children[0].attributes['aria-pressed'],'false');
  assert.equal(panel.children[1].attributes['aria-pressed'],'true');
  assert.equal(selections.length,1);
  assert.equal(selections[0],routes[1]);
  assert.equal(overlays.length,2);
  assert.equal(overlays[0].options.color,styles.velo.couleur);
});

test('aucune alternative inventée si le moteur retourne une seule route', () => {
  const {fn,panel,overlays} = comparateur('pied');
  fn([route(1500,1300)],{lat:5.36,lng:-4.01},'Marché');
  assert.equal(panel.hidden,true);
  assert.equal(panel.children.length,0);
  assert.equal(overlays.length,0);
});
