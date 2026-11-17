// Animation d'aperçu du README (images/demo.gif) : une couronne avec lumière, thermostat, volet, ampli,
// ventilateur et un groupe, pilotée à la souris dans Chrome sans interface (banc d'essai des tests).
// Usage : node scripts/demo-gif.js [sortie.gif]      (demande ffmpeg ; après « npm install »)
const h = require('../tests/harness.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GIF = path.resolve(process.argv[2] || path.join(__dirname, '..', 'images', 'demo.gif'));
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'rsc-demo-'));
const Z = 1.5;              // agrandissement (zoom CSS) : image plus nette
const CW = 400, CH = 450;   // carte de 380 px de large, avant agrandissement
const W = Math.round(CW * Z), H = Math.round(CH * Z);

const ITEMS = [
  { name: 'Salon', icon: 'mdi:sofa', entity: 'light.salon' },
  { name: 'Thermostat', icon: 'mdi:thermostat', entity: 'climate.salon' },
  { name: 'Volet', icon: 'mdi:window-shutter', entity: 'cover.volet' },
  { name: 'Ampli', icon: 'mdi:speaker', entity: 'media_player.ampli' },
  { name: 'VMC', icon: 'mdi:fan', entity: 'fan.vmc' },
  {
    name: 'Étage', icon: 'mdi:stairs-up',
    items: [
      { name: 'Chambre 1', icon: 'mdi:bed', entity: 'light.chambre_1' },
      { name: 'Chambre 2', icon: 'mdi:bed-double', entity: 'light.chambre_2' },
      { name: 'Salle de bain', icon: 'mdi:shower', entity: 'light.salle_de_bain' },
    ],
  },
];

(async () => {
  const b = await h.launch();
  const t = await h.open(b, `<div style="width:${CW - 20}px;padding:10px"><radial-selector-card id="a"></radial-selector-card></div>
    <div id="cur"></div>
    <style>
      html, body { overflow: hidden; cursor: none }
      body { zoom: ${Z} }
      #cur { position: fixed; left: 0; top: 0; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; background: rgb(190 194 202 / 0.75); border: 2px solid #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 0.5); pointer-events: none; z-index: 99999; transition: width .12s, height .12s, margin .12s, background .12s; will-change: transform }
      #cur.down { width: 14px; height: 14px; margin: -7px 0 0 -7px; background: rgb(255 255 255 / 0.9) }
    </style>`, { w: W, h: H, dsf: 1 });
  const { page } = t;

  // Faux Home Assistant : les appels de service modifient les états, comme le ferait HA
  await page.evaluate(([items, ZOOM]) => {
    const cur = document.getElementById('cur');
    window.addEventListener('mousemove', (e) => { cur.style.transform = 'translate(' + e.clientX / ZOOM + 'px,' + e.clientY / ZOOM + 'px)'; }, true);
    window.addEventListener('mousedown', () => cur.classList.add('down'), true);
    window.addEventListener('mouseup', () => cur.classList.remove('down'), true);
    const set = (id, state, attrs) => { const p = window.__states[id]; window.__states = { ...window.__states, [id]: { state: state == null ? p.state : state, attributes: { ...p.attributes, ...(attrs || {}) } } }; };
    const onoff = (id, want) => {
      const d = id.split('.')[0]; const p = window.__states[id];
      const isOn = !['off', 'closed', 'unavailable'].includes(p.state);
      const on = want == null ? !isOn : want;
      if (d === 'light') set(id, on ? 'on' : 'off', on ? { brightness: p.attributes.brightness || p.attributes._last || 153 } : { _last: p.attributes.brightness, brightness: null });
      else if (d === 'cover') set(id, on ? 'open' : 'closed', { current_position: on ? 100 : 0 });
      else if (d === 'climate') set(id, on ? 'heat' : 'off');
      else set(id, on ? 'on' : 'off');
    };
    const refresh = () => document.querySelectorAll('radial-selector-card').forEach((el) => { el.hass = window.makeHass(); });
    window.makeHass = () => ({
      states: window.__states, themes: { darkMode: true }, language: 'fr', locale: { language: 'fr' },
      config: { unit_system: { temperature: '°C' } },
      callService(domain, service, data) {
        const ids = [].concat((data && data.entity_id) || []);
        ids.forEach((id) => {
          if (service === 'toggle') onoff(id, null);
          else if (service === 'turn_off') onoff(id, false);
          else if (service === 'turn_on' && domain === 'light' && data.brightness_pct != null) set(id, 'on', { brightness: Math.round(data.brightness_pct * 2.55) });
          else if (service === 'turn_on') onoff(id, true);
          else if (service === 'set_cover_position') set(id, data.position > 0 ? 'open' : 'closed', { current_position: data.position });
          else if (service === 'set_temperature') set(id, 'heat', { temperature: data.temperature });
          else if (service === 'volume_set') set(id, 'on', { volume_level: data.volume_level });
          else if (service === 'set_percentage') set(id, data.percentage > 0 ? 'on' : 'off', { percentage: data.percentage });
        });
        setTimeout(refresh, 60);
        return Promise.resolve();
      },
    });
    const el = document.getElementById('a');
    el.setConfig({ type: 'custom:radial-selector-card', name: 'Maison', auto_close: 0, show_names: true, show_label: true, items });
    el.hass = window.makeHass();
  }, [ITEMS, Z]);
  await page.waitForTimeout(400);

  // Souris : déplacements fluides
  let pos = { x: W - 48 * Z, y: H - 62 * Z };
  await page.mouse.move(pos.x, pos.y);
  const sleep = (ms) => page.waitForTimeout(ms);
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  // Mouvement réglé sur l'horloge (durée tenue même si le navigateur est lent)
  const sweep = async (ms, point) => {
    const t0 = Date.now();
    for (;;) {
      const u = Math.min(1, (Date.now() - t0) / ms);
      const q = point(ease(u)); await page.mouse.move(q.x, q.y); pos = q;
      if (u >= 1) break;
      await sleep(8);
    }
  };
  const glide = (to, ms = 500) => { const from = pos; return sweep(ms, (e) => ({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e })); };
  const F = 1.75;
  // Appui long sur l'entrée i, puis rotation de deg degrés autour du bouton
  const dial = async (g, i, deg, ms = 1300) => {
    await glide(h.at(g, i, F), 550);
    await sleep(250);
    await page.mouse.down();
    await sleep(900);
    await sweep(ms, (e) => h.at(g, i, F, deg * e));
    await sleep(650);
    await page.mouse.up();
    await sleep(500);
  };
  const click = async (p, after = 600) => { await glide(p, 500); await sleep(150); await page.mouse.down(); await sleep(110); await page.mouse.up(); await sleep(after); };

  // Capture : flux d'images du navigateur (une image à chaque changement d'écran)
  const cdp = await t.ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ t: f.metadata.timestamp, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  const T0 = Date.now();

  await sleep(900);
  let g = await h.geo(page, 'a');
  const centre = { x: g.cx, y: g.cy };
  await click(centre, 1100);                 // ouverture
  g = await h.geo(page, 'a');
  await dial(g, 0, 78);                      // lumière du salon : 50 % → ~80 %
  await dial(g, 1, 24, 1000);                // thermostat : 20,5° → ~22,5°
  await dial(g, 2, -95);                     // volet : 60 % → ~25 %
  await dial(g, 3, 54, 1100);                // ampli : volume 35 % → ~55 %
  await click(h.at(g, 4, F), 900);           // VMC : arrêt d'un appui
  await click(h.at(g, 5, F), 1100);          // groupe « Étage »
  g = await h.geo(page, 'a');
  await click(h.at(g, 1, F), 900);           // Chambre 2 : allumée
  await dial(g, 0, 68, 1100);                // Chambre 1 : 25 % → ~50 %
  await click(centre, 1100);                 // retour au cercle principal
  await click(centre, 400);                  // fermeture
  await glide({ x: W - 48 * Z, y: H - 62 * Z }, 700);
  await sleep(1500);

  await cdp.send('Page.stopScreencast');
  const total = (Date.now() - T0) / 1000;
  // Liste pour ffmpeg (durée réelle de chaque image)
  let list = '';
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, '0')}.png`;
    fs.writeFileSync(path.join(OUT, name), Buffer.from(f.data, 'base64'));
    const d = i + 1 < frames.length ? frames[i + 1].t - f.t : 0.5;
    list += `file '${name}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`;
  });
  list += `file 'f${String(frames.length - 1).padStart(5, '0')}.png'\n`;
  fs.writeFileSync(path.join(OUT, 'list.txt'), list);
  await t.close(); await b.close();
  if (t.errors.length) { console.error('Erreurs JS :', t.errors); process.exit(1); }
  // Assemblage : 12,5 images/s, palette de 160 couleurs calculée sur les changements
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
    '-vf', 'fps=12.5,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop', '0', GIF], { cwd: OUT, stdio: 'inherit' });
  fs.rmSync(OUT, { recursive: true, force: true });
  if (r.status !== 0) { console.error('ffmpeg a échoué'); process.exit(1); }
  console.log(`${path.relative(process.cwd(), GIF)} : ${frames.length} images capturées, ${total.toFixed(1)} s, ${(fs.statSync(GIF).size / 1e6).toFixed(1)} Mo`);
})();
