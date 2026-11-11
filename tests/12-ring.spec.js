// Couronne ouverte : géométrie (open_size, knob_shrink, icon_radius, zone_gap, zone_edge), forme de la zone
// (zone_style), séparateurs, pression et onde. Sans option : forme d'origine, au pixel près.
module.exports = async (browser, h) => {
  const { check, group } = h;
  const open = async (page, cfg) => {
    await page.evaluate((cfg) => { const el = window.mk('a', { auto_close: 0, name: '', ...cfg }); if (!el._open) el._toggle(); }, cfg);
    await page.waitForTimeout(650);
  };
  // Mesures : bouton, liseré, disque, icônes (en diamètres de bouton D), masque des zones, classes
  const measure = (page) => page.evaluate(() => {
    const el = document.getElementById('a'); const s = el.shadowRoot; const sel = s.querySelector('.selector');
    const r = sel.getBoundingClientRect(); const D = r.width; const cx = r.left + D / 2, cy = r.top + r.height / 2;
    const knob = s.querySelector('.knob').getBoundingClientRect();
    const ic = s.querySelector('li .icon ha-icon').getBoundingClientRect();
    const zones = s.querySelector('.zones'); const zcs = getComputedStyle(zones);
    const ring = getComputedStyle(s.querySelector('ul'), '::after');
    const zone = getComputedStyle(s.querySelector('.zone'));
    const sep = getComputedStyle(s.querySelector('.sep'));
    const R = D / 2;
    const at = (f) => el._pointAt({ clientX: cx + R * f, clientY: cy });
    const px = (str, i = 0) => { const m = str.match(/([\d.]+)px/g); return m && m[i] ? parseFloat(m[i]) : null; };
    const zm = zcs.maskImage || zcs.webkitMaskImage; const hm = zone.maskImage || zone.webkitMaskImage;
    return {
      D: +D.toFixed(1), inner: px(zm, 0), edge: /100% - ([\d.]+)px/.test(zm) ? parseFloat(RegExp.$1) : 0, haloStops: !hm.includes('radial') ? null : (hm.match(/([\d.]+)px/g) || []).map(parseFloat), haloAt: /circle at ([\d.]+)% ([\d.]+)%/.test(hm) ? [parseFloat(RegExp.$1), parseFloat(RegExp.$2)] : null,
      knob: +(knob.width / D).toFixed(2), zonesW: +(zones.getBoundingClientRect().width / D).toFixed(2),
      icon: +(Math.hypot(ic.left + ic.width / 2 - cx, ic.top + ic.height / 2 - cy) / D).toFixed(2),
      ringW: +(parseFloat(ring.width) / D).toFixed(2), arcW: +(parseFloat(getComputedStyle(s.querySelector('.arc')).width) / D).toFixed(2),
      mask: zcs.maskImage || zcs.webkitMaskImage, zoneMask: zone.maskImage || zone.webkitMaskImage,
      sepOpacity: sep.opacity, sepDisplay: sep.display, cls: sel.className,
      knobAnim: getComputedStyle(s.querySelector('.knob')).animationName, waveAnim: getComputedStyle(zones, '::after').animationName,
      hit: { r104: at(1.04).ring, r106: at(1.06).ring, r264: at(2.64).ring, r266: at(2.66).ring, r085: at(0.86).ring, r284: at(2.84).ring },
    };
  });
  // Étendue éclairée par la zone 0 le long d'un rayon à 22° (différence d'image survolée / au repos)
  const litSpan = async (page, angleDeg = 8) => {
    const geo = await page.evaluate(() => { const r = document.getElementById('a').shadowRoot.querySelector('.selector').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, D: r.width }; });
    const clip = { x: geo.x - geo.D * 1.45, y: geo.y - geo.D * 1.45, width: geo.D * 2.9, height: geo.D * 2.9 };
    const shots = [];
    for (const hot of [false, true]) {
      await page.evaluate((hot) => document.getElementById('a').shadowRoot.querySelector('.zone').classList.toggle('hot', hot), hot);
      await page.waitForTimeout(260);
      shots.push((await page.screenshot({ clip })).toString('base64'));
    }
    return page.evaluate(async ([a, b, angleDeg]) => {
      const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const cv = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x; };
      const xa = cv(ia), xb = cv(ib); const w = ia.width; const D = w / 2.9; const cx = w / 2, cy = w / 2; const ang = angleDeg * Math.PI / 180;
      const lit = [];
      for (let k = 0; k < 30; k += 1) {
        const r = (0.3 + k * 0.04) * D; const px = Math.round(cx + r * Math.sin(ang)), py = Math.round(cy - r * Math.cos(ang));
        const pa = xa.getImageData(px, py, 1, 1).data, pb = xb.getImageData(px, py, 1, 1).data;
        lit.push(Math.max(Math.abs(pa[0] - pb[0]), Math.abs(pa[1] - pb[1]), Math.abs(pa[2] - pb[2])) > 60 ? 1 : 0);
      }
      const idx = lit.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      return { count: idx.length, from: idx.length ? +(0.3 + Math.min(...idx) * 0.04).toFixed(2) : null, to: idx.length ? +(0.3 + Math.max(...idx) * 0.04).toFixed(2) : null };
    }, [...shots, angleDeg]);
  };

  group('Couronne : sans option, la forme d\'origine');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await open(page, {});
    const m = await measure(page);
    check('bouton entier, disque à 2,6 D, icônes à 0,99 D, liseré et arc comme avant', m.knob === 1 && m.zonesW === 2.6 && m.icon === 0.99 && m.ringW > 1.1 && m.arcW > 1.1, m);
    check('zones dès 0,64 D + 12 px, jusqu\'à 14 px du bord (masque d\'origine)', Math.abs(m.inner - (0.64 * m.D + 12)) < 0.6 && m.edge === 14, { D: m.D, inner: m.inner, edge: m.edge });
    check('zone pleine (secteur seul), traits normaux, pas d\'animation ajoutée', m.zoneMask.startsWith('conic-gradient') && !m.zoneMask.includes('radial') && m.sepOpacity === '1' && m.knobAnim === 'none' && m.waveAnim === 'none' && !/press|wave|zone-|sep-/.test(m.cls), m);
    check('zones réactives de 1,05 R à 2,65 R comme avant', !m.hit.r104 && m.hit.r106 && m.hit.r264 && !m.hit.r266, m.hit);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Couronne : options de géométrie');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await open(page, { knob_shrink: 0.8 });
    let m = await measure(page);
    check('knob_shrink: 0.8 → bouton à 0,80 D une fois ouvert, liseré et arc du variateur le suivent', m.knob === 0.8 && Math.abs(m.ringW - (0.8 + 1 / 9 + 26 / m.D)) < 0.02 && Math.abs(m.arcW - (0.8 + 1 / 9 + 32 / m.D)) < 0.02, m);
    check('… creux « auto » : les zones suivent le liseré (0,54 D + 12 px)', Math.abs(m.inner - (0.54 * m.D + 12)) < 0.6, { D: m.D, inner: m.inner });
    check('… zones réactives dès 0,85 R', m.hit.r085 && !(await page.evaluate(() => { const el = document.getElementById('a'); const r = el.shadowRoot.querySelector('.selector').getBoundingClientRect(); return el._pointAt({ clientX: r.left + r.width / 2 + r.width / 2 * 0.83, clientY: r.top + r.height / 2 }).ring; })), m.hit);
    const closed = await page.evaluate(async () => { const el = document.getElementById('a'); el._toggle(); await new Promise((r) => setTimeout(r, 600)); const s = el.shadowRoot; return +(s.querySelector('.knob').getBoundingClientRect().width / s.querySelector('.selector').getBoundingClientRect().width).toFixed(2); });
    check('… refermé : le bouton reprend sa taille', closed === 1, closed);
    await open(page, { open_size: 280 });
    m = await measure(page);
    check('open_size: 280 → disque et zones à 2,8 D, réactives jusqu\'à 2,85 R', m.zonesW === 2.8 && m.hit.r284 && m.hit.r266, m);
    await open(page, { icon_radius: 0.85, show_brightness: false });
    m = await measure(page);
    check('icon_radius: 0.85 → icônes à 0,85 D', Math.abs(m.icon - 0.85) <= 0.02, m.icon);
    // Garde-fou : le nom et la valeur sous l'icône restent hors du bouton, quoi qu'on demande
    const textOut = (page) => page.evaluate(() => {
      const s = document.getElementById('a').shadowRoot; const sel = s.querySelector('.selector').getBoundingClientRect(); const D = sel.width; const cy = sel.top + D / 2;
      const li = s.querySelectorAll('li')[0]; const rim = parseFloat(getComputedStyle(s.querySelector('ul'), '::after').width) / 2 / D;
      const low = (q) => { const e = li.querySelector(q); if (!e || (q === '.lvl' && !li.classList.contains('has-lvl'))) return null; return +((cy - e.getBoundingClientRect().bottom) / D).toFixed(3); };
      const ic = li.querySelector('ha-icon').getBoundingClientRect(); const nm = li.querySelector('.nm');
      return { rim: +(rim + 1 / 13).toFixed(3), name: low('.nm'), value: low('.lvl'), gapIconName: nm ? +((nm.getBoundingClientRect().top - ic.bottom) / D).toFixed(3) : null };
    });
    await open(page, { icon_radius: 0.8 });
    let o = await textOut(page); m = await measure(page);
    check('icon_radius: 0.8 avec la valeur affichée : les icônes s\'arrêtent plus haut (≈ 0,95 D), la valeur reste hors du bouton et de son anneau d\'ombre', m.icon > 0.92 && o.value !== null && o.value > o.rim, { icon: m.icon, ...o });
    await open(page, { icon_radius: 0.8, show_names: true });
    o = await textOut(page);
    check('… avec le nom et la valeur : le nom est sous l\'icône (pas derrière), la valeur sous le nom, le tout hors du bouton', o.gapIconName > 0.03 && o.name > o.value && o.value > o.rim, o);
    await open(page, { icon_radius: 0.8, show_names: true, knob_shrink: 0.7 });
    const o2 = await textOut(page); const m2 = await measure(page);
    check('… bouton réduit : les icônes peuvent descendre davantage, le texte reste hors du bouton', m2.icon < m.icon && o2.value > o2.rim, { icon: m2.icon, ...o2 });
    await open(page, { icon_radius: 0.8, show_brightness: false });
    m = await measure(page);
    check('… sans nom ni valeur : les icônes descendent jusqu\'à toucher l\'anneau du bouton (≈ 0,85 D), pas dessous', Math.abs(m.icon - 0.854) <= 0.02, m.icon);
    await open(page, { zone_gap: 12 });
    m = await measure(page);
    check('zone_gap: 12 = le creux actuel (0,64 D + 12 px)', Math.abs(m.inner - (0.64 * m.D + 12)) < 0.6, { D: m.D, inner: m.inner });
    await open(page, { zone_gap: 0, zone_edge: 6, knob_shrink: 0.8 });
    m = await measure(page);
    check('zone_gap: 0 + bouton réduit → zones dès le liseré (0,5 × 0,8 + 1/18 = 0,4556 D + 13 px) ; zone_edge: 6', Math.abs(m.inner - (0.4556 * m.D + 13)) < 0.6 && m.edge === 6, { D: m.D, inner: m.inner, edge: m.edge });
    await open(page, { open_size: 999, knob_shrink: 0.1, icon_radius: 5, zone_edge: -3 });
    m = await measure(page);
    check('valeurs hors limites bornées (280, 0,5, 1,1, 0)', m.zonesW === 2.8 && m.knob === 0.5 && m.edge === 0 && m.icon <= 1.1 && m.icon > 1.05, m);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Couronne : forme de la zone, traits, pression, onde');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await open(page, {});
    const fill = await litSpan(page);
    const fillSide = await litSpan(page, 22);
    await open(page, { zone_style: 'halo' });
    let m = await measure(page);
    const halo = await litSpan(page);
    const haloSide = await litSpan(page, 22);
    check('halo : disque de lumière centré sur l\'icône de la zone (en haut, à 0,99 D du centre), plein à 0,13 D, fondu à 0,3 D', m.cls.includes('zone-halo') && m.haloStops && m.haloStops.length === 3
      && Math.abs(m.haloStops[0] - 0.99 * m.D) < 0.6 && Math.abs(m.haloStops[1] - 0.13 * m.D) < 0.6 && Math.abs(m.haloStops[2] - 0.3 * m.D) < 0.6, { D: m.D, stops: m.haloStops });
    check('… en cercle : étroit le long de l\'icône, et rien à 22° de côté là où le plein éclaire encore', halo.count >= 4 && halo.count <= fill.count * 0.7 && halo.from >= 0.76 && halo.to <= 1.22 && fillSide.count >= 8 && haloSide.count <= 1, { fill, halo, fillSide, haloSide });
    await open(page, { zone_style: 'halo', icon_radius: 0.8, knob_shrink: 0.7 });
    const halo2 = await litSpan(page);
    check('… et il suit les icônes quand elles se rapprochent (icon_radius: 0.8, bouton réduit)', halo2.to < halo.to && halo2.from < halo.from, { halo, halo2 });
    await open(page, { zone_style: 'band' });
    const band = await litSpan(page);
    check('band : seulement un bandeau au bord du disque', band.count <= 5 && band.to === fill.to && band.from >= 1.1, band);
    await open(page, { zone_style: 'fill' });
    check('fill : comme sans option (clé par défaut)', !(await measure(page)).zoneMask.includes('radial'));
    // Fondu de la zone : vers le bord (actuel), vers le bouton (profondeur), aucun
    const stops = (page) => page.evaluate(() => { const z = document.getElementById('a').shadowRoot.querySelector('.zones'); const cs = getComputedStyle(z); return (cs.maskImage || cs.webkitMaskImage); });
    const pxs = (str) => (str.match(/([\d.]+)px/g) || []).map(parseFloat);
    await open(page, { zone_fade: 'none', zone_gap: 0 });
    m = await measure(page);
    const mn = await stops(page); const noneFade = await litSpan(page);
    check('zone_fade: none → nette des deux côtés (rampes de 1,5 px), éclairée du liseré à la marge du bord', m.cls.includes('fade-none') && Math.abs(pxs(mn)[1] - pxs(mn)[0] - 1.5) < 0.1 && /calc\(100% - 12\.5px\)/.test(mn) && noneFade.from <= 0.78 && noneFade.to >= 1.14, { mn, noneFade });
    await open(page, { zone_fade: 'knob', zone_gap: 0 });
    m = await measure(page);
    const mk = await stops(page); const knobFade = await litSpan(page);
    // Luminosité de la zone éclairée le long du rayon : au pied du bouton, au milieu, contre la paroi
    const shade = async () => {
      const geo = await page.evaluate(() => { const r = document.getElementById('a').shadowRoot.querySelector('.selector').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, D: r.width }; });
      await page.evaluate(() => document.getElementById('a').shadowRoot.querySelector('.zone').classList.add('hot'));
      await page.waitForTimeout(260);
      const b64 = (await page.screenshot({ clip: { x: geo.x - geo.D * 1.45, y: geo.y - geo.D * 1.45, width: geo.D * 2.9, height: geo.D * 2.9 } })).toString('base64');
      return page.evaluate(async (b64) => {
        const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const w = im.width; const D = w / 2.9; const ang = 8 * Math.PI / 180;
        const lum = (r) => { const p = x.getImageData(Math.round(w / 2 + r * D * Math.sin(ang)), Math.round(w / 2 - r * D * Math.cos(ang)), 1, 1).data; return Math.round(0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]); };
        return { foot: lum(0.76), mid: lum(0.93), wall: lum(1.17), rim: lum(1.27) };
      }, b64);
    };
    await open(page, { zone_fade: 'none', zone_gap: 0, zone_edge: 24 });
    const shNone = await shade();
    await open(page, { zone_fade: 'knob', zone_gap: 0, zone_edge: 24 });
    const shKnob = await shade();
    check('zone_fade: knob → la zone va jusqu\'au bord du disque (masque net au pied du bouton, plein à 100 %)', m.cls.includes('fade-knob') && Math.abs(pxs(mk)[1] - pxs(mk)[0] - 1.5) < 0.1 && /rgb\(0, 0, 0\) 100%\)/.test(mk) && knobFade.to > noneFade.to, { mk, noneFade, knobFade });
    check('… ombrée depuis le bord (zone_edge) et au pied du bouton, claire au milieu (profondeur)', shKnob.rim <= shKnob.mid - 40 && shKnob.wall < shKnob.mid && shKnob.foot <= shNone.foot - 15 && Math.abs(shKnob.mid - shNone.mid) <= 12, { shNone, shKnob });
    await open(page, { zone_fade: 'knob', zone_gap: 0, zone_edge: 40 });
    const shWide = await shade();
    check('… zone_edge élargit l\'ombre depuis le bord : à 40 px, le point à 1,17 D est plus sombre qu\'à 24 px', shWide.wall < shKnob.wall - 10, { shKnob, shWide });
    await open(page, { zone_gap: 0 });
    const edgeFade = await litSpan(page);
    check('zone_fade: edge (défaut) → nette côté bouton, estompée vers le bord du disque (au-delà de la marge nette de none)', edgeFade.from < knobFade.from && edgeFade.to > noneFade.to, { edgeFade, knobFade, noneFade });
    await open(page, { zone_fade: 'edge' });
    check('zone_fade: edge = défaut (pas de classe)', !/fade-/.test((await measure(page)).cls));
    await open(page, { separators: 'soft' });
    m = await measure(page);
    check('separators: soft → traits à 35 %', m.sepOpacity === '0.35' && m.cls.includes('sep-soft'), m);
    await open(page, { separators: 'none' });
    check('separators: none → pas de traits', (await measure(page)).sepDisplay === 'none');
    await page.evaluate(() => { const el = window.mk('a', { auto_close: 0, name: '', knob_press: true, open_wave: true, knob_shrink: 0.8 }); el._toggle(); });
    await page.waitForTimeout(120);
    m = await measure(page);
    check('knob_press + open_wave : animations « pression » du bouton et « onde » dans la couronne à l\'ouverture', m.cls.includes('press') && m.cls.includes('wave') && m.knobAnim === 'rsc-press' && m.waveAnim === 'rsc-wave', m);
    await page.waitForTimeout(900);
    m = await measure(page);
    check('… puis le bouton se cale à 0,80 D', m.knob === 0.8, m.knob);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Éditeur : toutes les sections en menus dépliants');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 1400 });
    const r = await t.page.evaluate(() => {
      const ed = document.createElement('radial-selector-card-editor');
      document.getElementById('host').appendChild(ed);
      ed.addEventListener('config-changed', (e) => ed.setConfig(e.detail.config));
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:radial-selector-card', items: [{ entity: 'light.salon' }, { entity: 'light.cuisine' }] });
      const secs = () => [...ed.shadowRoot.querySelectorAll('.editor-wrap > .section')];
      const state = () => secs().map((d) => [d.getAttribute('data-sec'), d.open]);
      const r = { tags: [...new Set(secs().map((d) => d.tagName))], summaries: secs().every((d) => d.firstElementChild.tagName === 'SUMMARY' && d.firstElementChild.classList.contains('section-title')),
        init: state(), firstTitle: ed.shadowRoot.querySelector('.section-title').textContent.trim(), plain: secs().filter((d) => d.querySelector(':scope > .section-title:not(summary)')).length,
        btnInSummary: ed.shadowRoot.querySelectorAll('summary button').length,
        addBelow: ['items', 'extra', 'rows'].every((k) => { const d = secs().find((x) => x.getAttribute('data-sec') === k); const row = d.querySelector(':scope > summary + .sec-actions'); return !!row && !!row.querySelector('[data-add]'); }) };
      // Ouvrir « Style du bouton » et « Entités », puis ajouter une entrée (nouveau rendu) : états gardés
      const knob = secs()[1]; knob.open = true; knob.dispatchEvent(new Event('toggle'));
      const items = secs().find((d) => d.getAttribute('data-sec') === 'items'); items.open = true; items.dispatchEvent(new Event('toggle'));
      items.querySelector('.sec-actions [data-add="items"]').click();
      r.afterAdd = state(); r.n = ed._config.items.length;
      return r;
    });
    check('10 sections, toutes en <details> avec un <summary> pour titre', r.tags.join() === 'DETAILS' && r.init.length === 10 && r.summaries && r.plain === 0, r);
    check('à l\'ouverture de l\'éditeur : toutes repliées', r.init.every(([, o]) => !o) && r.firstTitle === 'Paramètres généraux', r.init);
    check('« + Ajouter » sous l\'en-tête, jamais dans le titre (pas de clic par mégarde)', r.btnInSummary === 0 && r.addBelow, r);
    check('états gardés après un nouveau rendu ; « + Ajouter » ajoute sans replier', r.n === 3 && JSON.stringify(r.afterAdd.filter(([, o]) => o).map(([k]) => k)) === '["knob","items"]', r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Éditeur : section dépliante « Couronne ouverte »');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 1400 });
    const r = await t.page.evaluate(() => {
      const ed = document.createElement('radial-selector-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (e) => { log.push(e.detail.config); ed.setConfig(e.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:radial-selector-card', items: [{ entity: 'light.salon' }, { entity: 'light.cuisine' }] });
      const $ = (q) => ed.shadowRoot.querySelector(q);
      const last = () => log[log.length - 1];
      const det = $('details.section.ring');
      const r = { closed: det && !det.open, title: det.querySelector('summary > span').textContent.trim(), fields: [...det.querySelectorAll('[data-field]')].map((f) => f.getAttribute('data-field')) };
      const zf = $('[data-field="zone_fade"]'); zf.value = 'knob'; zf.dispatchEvent(new Event('change')); r.zf = log[log.length - 1].zone_fade; zf.value = 'edge'; zf.dispatchEvent(new Event('change')); r.zf2 = 'zone_fade' in log[log.length - 1];
      det.open = true; det.dispatchEvent(new Event('toggle'));
      const range = (key, v) => { const i = $(`[data-field="${key}"]`); i.value = String(v); i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); };
      range('open_size', 270); r.a = last().open_size; r.openAfter = $('details.section.ring').open;
      range('open_size', 260); r.b = 'open_size' in last();
      range('knob_shrink', 0.8); r.c = last().knob_shrink;
      range('icon_radius', 0.9); r.d = last().icon_radius;
      range('zone_edge', 6); r.e = last().zone_edge;
      range('zone_gap', 0); r.f = last().zone_gap;
      range('zone_gap', 12); r.g = 'zone_gap' in last();
      const sel = $('[data-field="zone_style"]'); sel.value = 'halo'; sel.dispatchEvent(new Event('change')); r.h = last().zone_style;
      sel.value = 'fill'; sel.dispatchEvent(new Event('change')); r.i = 'zone_style' in last();
      const sep = $('[data-field="separators"]'); sep.value = 'none'; sep.dispatchEvent(new Event('change')); r.j = last().separators;
      const press = $('[data-field="knob_press"]'); press.checked = true; press.dispatchEvent(new Event('change')); r.k = last().knob_press;
      const wave = $('[data-field="open_wave"]'); wave.checked = true; wave.dispatchEvent(new Event('change')); r.l = last().open_wave;
      wave.checked = false; wave.dispatchEvent(new Event('change')); r.m = 'open_wave' in last();
      zf.value = 'knob'; zf.dispatchEvent(new Event('change'));
      r.before = Object.keys(last()).filter((k) => ['knob_shrink', 'icon_radius', 'zone_edge', 'separators', 'knob_press', 'zone_fade'].includes(k)).length;
      $('[data-ring-reset]').click(); r.after = Object.keys(last()).filter((k) => ['open_size', 'knob_shrink', 'icon_radius', 'zone_gap', 'zone_edge', 'zone_style', 'zone_fade', 'separators', 'knob_press', 'open_wave'].includes(k)).length;
      r.stillOpen = $('details.section.ring').open;
      return r;
    });
    check('section fermée par défaut, titre « Couronne ouverte : zones et icônes », 10 réglages', r.closed && r.title === 'Couronne ouverte : zones et icônes' && r.fields.length === 10, r);
    check('fondu de la zone : knob écrit, edge (défaut) retiré', r.zf === 'knob' && r.zf2 === false, r);
    check('curseurs : valeur écrite, valeur par défaut retirée ; la section reste ouverte', r.a === 270 && r.b === false && r.openAfter && r.c === 0.8 && r.d === 0.9 && r.e === 6, r);
    check('creux (curseur) : 0 écrit, 12 (= actuel) retiré', r.f === 0 && r.g === false, r);
    check('listes et cases : halo / fill retiré, none, pression, onde', r.h === 'halo' && r.i === false && r.j === 'none' && r.k === true && r.l === true && r.m === false, r);
    check('« Revenir à la forme d\'origine » retire tous les réglages de la section', r.before === 6 && r.after === 0 && r.stillOpen, r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
    const e = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 1400, lang: 'en' });
    const en = await e.page.evaluate(() => {
      const ed = document.createElement('radial-selector-card-editor');
      document.getElementById('host').appendChild(ed);
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:radial-selector-card', items: [{ entity: 'light.salon' }, { entity: 'light.cuisine' }] });
      const det = ed.shadowRoot.querySelector('details.section.ring');
      return { title: det.querySelector('summary > span').textContent.trim(), opt: [...det.querySelector('[data-field="zone_style"]').options].map((o) => o.textContent) };
    });
    check('anglais : « Open dial: zones and icons », formes de zone traduites', en.title === 'Open dial: zones and icons' && en.opt.length === 3 && en.opt.includes('Halo: disc of light centered on the icon'), en);
    await e.close();
  }
};
