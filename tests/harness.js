// Banc d'essai : Chrome sans interface (Playwright) + faux Home Assistant (ha-card, ha-icon, sélecteurs, hass)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mdi = require('@mdi/js');

const CARD = path.resolve(process.env.CARD || path.join(__dirname, '..', 'dist', 'radial-selector-card.js'));

// Icônes MDI utilisées par les tests (les autres s'affichent en point d'interrogation)
const ICON_NAMES = ['sofa', 'stove', 'table-furniture', 'desk', 'stairs', 'outdoor-lamp', 'television', 'cctv', 'lightbulb',
  'lightbulb-group', 'folder-multiple-outline', 'arrow-u-left-top', 'speaker', 'window-shutter', 'thermostat', 'fan',
  'bed', 'bed-double', 'shower', 'power', 'power-plug', 'home', 'ceiling-light', 'lamp', 'floor-lamp', 'volume-high',
  'tune-vertical', 'stairs-up', 'silverware-fork-knife', 'door', 'circle-outline', 'help-circle-outline', 'weather-night',
  'led-strip-variant', 'desk-lamp', 'wall-sconce-round', 'toilet', 'baby-face-outline', 'teddy-bear', 'washing-machine'];
const camel = (n) => 'mdi' + n.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
const ICONS = Object.fromEntries(ICON_NAMES.map((n) => [camel(n), mdi[camel(n)] || mdi.mdiHelpCircleOutline]));

// États de base de la maison de test
const dimmable = (b, extra = {}) => ({ supported_color_modes: ['brightness'], color_mode: 'brightness', brightness: b, ...extra });
const STATES = {
  'light.salon': { state: 'on', attributes: dimmable(128, { friendly_name: 'Salon' }) },
  'light.cuisine': { state: 'off', attributes: dimmable(null, { friendly_name: 'Cuisine' }) },
  'light.salle_a_manger': {
    state: 'on',
    attributes: {
      friendly_name: 'Salle à manger', supported_color_modes: ['color_temp', 'hs'], color_mode: 'color_temp', brightness: 200,
      color_temp_kelvin: 3000, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500, hs_color: [30, 80],
    },
  },
  'light.bureau': { state: 'off', attributes: { friendly_name: 'Bureau', supported_color_modes: ['onoff'] } },
  'light.escalier': { state: 'on', attributes: dimmable(128, { friendly_name: 'Escalier' }) },
  'light.exterieur': { state: 'off', attributes: dimmable(null, { friendly_name: 'Extérieur' }) },
  'light.chambre_1': { state: 'on', attributes: dimmable(64, { friendly_name: 'Chambre 1' }) },
  'light.chambre_2': { state: 'off', attributes: dimmable(null, { friendly_name: 'Chambre 2' }) },
  'light.salle_de_bain': { state: 'on', attributes: dimmable(255, { friendly_name: 'Salle de bain' }) },
  'light.etage': { state: 'on', attributes: dimmable(110, { friendly_name: 'Étage' }) },
  'media_player.ampli': { state: 'on', attributes: { friendly_name: 'Ampli', volume_level: 0.35, is_volume_muted: false, supported_features: 4 | 8 | 128 | 256 } },
  'media_player.tv': { state: 'off', attributes: { friendly_name: 'TV', supported_features: 4 } },
  'cover.volet': { state: 'open', attributes: { friendly_name: 'Volet', current_position: 60, supported_features: 15 } },
  'climate.salon': { state: 'heat', attributes: { friendly_name: 'Thermostat', temperature: 20.5, current_temperature: 19.8, min_temp: 7, max_temp: 30, target_temp_step: 0.5, supported_features: 1 } },
  'fan.vmc': { state: 'on', attributes: { friendly_name: 'VMC', percentage: 50, percentage_step: 25, supported_features: 1 } },
  'input_number.volume_cible': { state: '12', attributes: { friendly_name: 'Volume cible', min: 0, max: 40, step: 2, unit_of_measurement: 'dB' } },
  'switch.prise': { state: 'on', attributes: { friendly_name: 'Prise' } },
  'sun.sun': { state: 'above_horizon', attributes: {} },
  'input_boolean.nuit': { state: 'off', attributes: {} },
  'scene.soiree': { state: 'scening', attributes: { friendly_name: 'Soirée' } },
};

const ITEMS6 = [
  { name: 'Salon', icon: 'mdi:sofa', entity: 'light.salon' },
  { name: 'Cuisine', icon: 'mdi:stove', entity: 'light.cuisine' },
  { name: 'Salle à manger', icon: 'mdi:table-furniture', entity: 'light.salle_a_manger' },
  { name: 'Bureau', icon: 'mdi:desk', entity: 'light.bureau' },
  { name: 'Escalier', icon: 'mdi:stairs', entity: 'light.escalier' },
  { name: 'Extérieur', icon: 'mdi:outdoor-lamp', entity: 'light.exterieur' },
];

const THEMES = {
  dark: '--primary-text-color:#e1e1e1;--secondary-text-color:#9ba0a8;--divider-color:rgba(225,225,225,.14);--card-background-color:#1c1f26;--primary-background-color:#111318;--secondary-background-color:#262a33;--primary-color:#03a9f4;',
  light: '--primary-text-color:#212121;--secondary-text-color:#727272;--divider-color:rgba(0,0,0,.12);--card-background-color:#ffffff;--primary-background-color:#f0f2f5;--secondary-background-color:#e5e8ec;--primary-color:#03a9f4;',
};

const page = (body, opts) => `<!doctype html><html lang="${opts.lang}"><head><meta charset="utf-8"><style>
  body { margin:0; font-family: Roboto, "Segoe UI", sans-serif; background:#111318; ${THEMES[opts.theme] || ''} ${opts.bodyStyle || ''} }
  .grid { display:grid; grid-template-columns: repeat(${opts.cols || 4}, ${opts.colWidth || 300}px); gap:16px; padding:16px; }
  h4 { margin: 0 0 8px; font-size: 13px; color: var(--secondary-text-color); text-align:center; font-weight:500 }
</style></head><body>${body}
<script>
window.__mdi = ${JSON.stringify(ICONS)};
window.__calls = []; window.__events = []; window.__haptics = []; window.__vibrate = [];
window.__states = ${JSON.stringify(STATES)};
window.__lang = ${JSON.stringify(opts.lang)};
window.__dark = ${opts.theme !== 'light'};
navigator.vibrate = (p) => { window.__vibrate.push(p); return true; };
window.addEventListener('haptic', (e) => window.__haptics.push(e.detail));
window.addEventListener('location-changed', () => window.__events.push({ type: 'location-changed', path: location.pathname + location.hash }));
document.addEventListener('hass-more-info', (e) => window.__events.push({ type: 'more-info', entity: e.detail.entityId }));
customElements.define('ha-icon', class extends HTMLElement {
  static get observedAttributes() { return ['icon']; }
  connectedCallback() { this.render(); } attributeChangedCallback() { this.render(); }
  render() {
    const n = (this.getAttribute('icon') || '').replace('mdi:', '');
    const key = n ? 'mdi' + n.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('') : '';
    this.innerHTML = '<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor;display:block"><path d="' + (window.__mdi[key] || '') + '"/></svg>';
  }
});
customElements.define('ha-card', class extends HTMLElement {
  // Comme le vrai ha-card : l'attribut « header » devient un titre <h1 class="card-header">
  static get observedAttributes() { return ['header']; }
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const h = this.getAttribute('header');
    const esc = (v) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    this.shadowRoot.innerHTML = '<style>:host{display:block;background:var(--ha-card-background,var(--card-background-color,#fff));border-radius:var(--ha-card-border-radius,12px);border-width:var(--ha-card-border-width,1px);border-style:solid;border-color:var(--ha-card-border-color,var(--divider-color,#e0e0e0));box-shadow:var(--ha-card-box-shadow,none);color:var(--primary-text-color)}.card-header{color:var(--ha-card-header-color,var(--primary-text-color));font-family:var(--ha-card-header-font-family,inherit);font-size:var(--ha-card-header-font-size,24px);letter-spacing:-.012em;line-height:1.2;padding:20px 16px 24px;font-weight:400;margin-block:0;display:block}</style>' + (h ? '<h1 class="card-header">' + esc(h) + '</h1>' : '') + '<slot></slot>';
  }
});
const picker = () => class extends HTMLElement {
  set value(v) { this._v = v; } get value() { return this._v || ''; }
  set hass(h) { this._hass = h; } set label(l) { this._label = l; }
  set includeDomains(d) { this._domains = d; } get includeDomains() { return this._domains; }
  pick(v) { this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v }, bubbles: true, composed: true })); }
};
customElements.define('ha-entity-picker', picker());
customElements.define('ha-icon-picker', picker());
window.makeHass = () => ({
  states: window.__states,
  themes: { darkMode: window.__dark },
  language: window.__lang,
  locale: { language: window.__lang },
  config: { unit_system: { temperature: '°C' } },
  callService(domain, service, data, target) { window.__calls.push({ domain, service, data: JSON.parse(JSON.stringify(data || {})), target }); return Promise.resolve(); },
});
window.mk = (id, cfg, items) => {
  const el = document.getElementById(id);
  el.setConfig({ type: 'custom:radial-selector-card', name: 'Éclairage', items: items || ${JSON.stringify(ITEMS6)}, ...cfg });
  el.hass = window.makeHass();
  return el;
};
window.setState = (entity, state, attributes) => {
  const prev = window.__states[entity] || { attributes: {} };
  window.__states = { ...window.__states, [entity]: { state, attributes: { ...prev.attributes, ...(attributes || {}) } } };
  document.querySelectorAll('radial-selector-card').forEach((el) => { if (el._config) el.hass = window.makeHass(); });
};
window.sr = (id) => document.getElementById(id).shadowRoot;
</script>
<script src="/radial-selector-card.js"></script>
</body></html>`;

// ---------- Résultats ----------
const results = [];
let section = '';
const check = (label, ok, extra = '') => {
  results.push({ label: `${section}${label}`, ok: !!ok });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${!ok && extra ? `  →  ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`);
};
const group = (name) => { section = `${name} : `; console.log(`\n${name}`); };

// Petit serveur HTTP local : pages de test + carte (comme dans Home Assistant, pas en file://)
let server = null;
let base = '';
const pages = new Map();
function serve() {
  if (server) return Promise.resolve();
  server = http.createServer((req, res) => {
    const url = req.url.split('?')[0].split('#')[0];
    if (url === '/radial-selector-card.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(CARD));
    } else if (pages.has(url)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(pages.get(url));
    } else {
      // Toute autre adresse (navigation d'une vue) : page vide
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>vue</title>');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }));
}

async function launch() {
  await serve();
  const opts = { args: ['--no-sandbox'] };
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(opts);
  const close = browser.close.bind(browser);
  browser.close = async () => { await close(); if (server) { server.close(); server = null; } };
  return browser;
}

// Ouvre une page de test. body : HTML (cartes <radial-selector-card id="…">)
async function open(browser, body, o = {}) {
  const opts = { lang: 'fr', theme: 'dark', w: 420, h: 520, dsf: 1, ...o };
  const ctx = await browser.newContext({
    viewport: { width: opts.w, height: opts.h }, deviceScaleFactor: opts.dsf, hasTouch: !!opts.touch || !!opts.mobile, isMobile: !!opts.mobile,
    reducedMotion: opts.reduce ? 'reduce' : 'no-preference', locale: opts.lang === 'fr' ? 'fr-FR' : 'en-US',
    ...(opts.video ? { recordVideo: opts.video } : {}),
  });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  const name = `/page-${Math.random().toString(36).slice(2, 8)}.html`;
  pages.set(name, page(body, opts));
  await pg.goto(base + name);
  await pg.waitForTimeout(100);
  let cdp = null;
  const touch = {
    async client() { if (!cdp) cdp = await ctx.newCDPSession(pg); return cdp; },
    async down(x, y) { await (await this.client()).send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); },
    async move(x, y) { await (await this.client()).send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); },
    async up() { await (await this.client()).send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
  };
  return { page: pg, ctx, errors, touch, close: () => ctx.close() };
}

// Géométrie d'une carte : centre et rayon du bouton, nombre d'entrées du cercle affiché
const geo = (pg, id) => pg.evaluate((id) => {
  const el = document.getElementById(id);
  const r = el.shadowRoot.querySelector('.selector').getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: r.width / 2, n: el._items.length };
}, id);

// Point au milieu du secteur i (f = distance au centre, en rayons du bouton)
const at = (g, i, f = 1.8, extraDeg = 0) => {
  const a = ((360 / g.n) * i - 90 + extraDeg) * (Math.PI / 180);
  return { x: g.cx + Math.cos(a) * g.R * f, y: g.cy + Math.sin(a) * g.R * f };
};

const calls = (pg) => pg.evaluate(() => window.__calls);
const clearCalls = (pg) => pg.evaluate(() => { window.__calls = []; window.__events = []; window.__haptics = []; window.__vibrate = []; });
const cards = (list) => list.map((id) => `<div style="width:380px;padding:10px"><radial-selector-card id="${id}"></radial-selector-card></div>`).join('');

function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
  if (failed.length) {
    console.log('Échecs :');
    failed.forEach((r) => console.log(`  - ${r.label}`));
  }
  return failed.length === 0;
}

module.exports = { launch, open, geo, at, calls, clearCalls, cards, check, group, summary, CARD, STATES, ITEMS6, ICONS };
