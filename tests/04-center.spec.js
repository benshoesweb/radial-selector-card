// Appui long au centre, nombre et halo sur le bouton fermé, retour haptique, mode nuit
const ITEMS = [
  { name: 'Salon', icon: 'mdi:sofa', entity: 'light.salon' },
  { name: 'Cuisine', icon: 'mdi:stove', entity: 'light.cuisine' },
  { name: 'Prise', icon: 'mdi:power-plug', entity: 'switch.prise' },
  { name: 'Ampli', icon: 'mdi:speaker', entity: 'media_player.ampli' },
  { name: 'Volet', icon: 'mdi:window-shutter', entity: 'cover.volet' },
  { name: 'Escalier', icon: 'mdi:stairs', entity: 'light.escalier', color: '#ff9800' },
];

module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Nombre et halo sur le bouton fermé');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    const read = () => page.evaluate(() => {
      const s = window.sr('a');
      const sel = s.querySelector('.selector');
      const v = getComputedStyle(s.querySelector('.knob'), '::after');
      return {
        count: sel.classList.contains('count-on'), text: s.querySelector('.badge').textContent,
        badgeOp: Number(getComputedStyle(s.querySelector('.badge')).opacity),
        voyant: v.content, vw: parseFloat(v.width), vh: parseFloat(v.height), vcolor: v.color,
        halo: sel.classList.contains('halo-on'), haloOp: Number(getComputedStyle(s.querySelector('.halo')).opacity),
        grad: s.querySelector('.halo').style.getPropertyValue('--rsc-halo'),
      };
    });
    await page.evaluate((items) => window.mk('a', { auto_close: 0 }, items), ITEMS);
    await page.waitForTimeout(800);
    const r = await read();
    check('5 entités allumées (lumières, prise, ampli, volet) : nombre dans le voyant élargi', r.count && r.voyant === '"5"' && r.vw >= 16 && r.vh >= 16 && r.vcolor !== 'rgba(0, 0, 0, 0)', r);
    check('… sans l\'ancienne pastille dans le coin', r.badgeOp < 0.01, r);
    check('halo visible', r.halo && r.haloOp > 0.99, r);
    check('halo : arc de chaque entrée allumée, à sa couleur', (r.grad.match(/transparent \d/g) || []).length === 12 && r.grad.includes('#ff9800') && !r.grad.includes('hsl(-30deg'), r.grad);
    await page.evaluate(() => document.getElementById('a')._toggle());
    await page.waitForTimeout(600);
    const o = await read();
    check('cercle ouvert : nombre et halo masqués, voyant normal', o.badgeOp < 0.01 && o.haloOp < 0.01 && (o.voyant === 'none' || o.voyant === '""') && o.vw < 10, o);
    await page.evaluate(() => { document.getElementById('a')._toggle(); ['light.salon', 'switch.prise', 'media_player.ampli', 'cover.volet', 'light.escalier'].forEach((e) => window.setState(e, e.startsWith('cover') ? 'closed' : 'off')); });
    await page.waitForTimeout(600);
    const z = await read();
    check('tout éteint : ni nombre ni halo, voyant au repos inchangé', !z.count && !z.halo && z.text === '' && (z.voyant === 'none' || z.voyant === '""') && z.vw < 10 && z.vh > z.vw * 2, z);
    await page.evaluate((items) => { window.setState('light.salon', 'on'); window.mk('a', { show_count: false, show_halo: false }, items); }, ITEMS);
    const d = await read();
    check('show_count / show_halo : false les désactivent', !d.count && !d.halo && d.vw < 10, d);
    await page.evaluate((items) => { window.setState('switch.prise', 'on'); window.mk('a', { count_position: 'badge' }, items); }, ITEMS);
    await page.waitForTimeout(600);
    const bd = await read();
    check('count_position: badge : ancienne pastille, voyant normal', bd.count && bd.text === '2' && bd.badgeOp > 0.99 && bd.vw < 10, bd);
    // Pastille aux couleurs du thème, voyant en creux avec le chiffre incrusté
    const themed = await page.evaluate((items) => {
      const out = {};
      ['metal', 'brass', 'carbon', 'neon'].forEach((skin) => {
        const el = window.mk('a', { knob_theme: skin, count_position: 'badge' }, items);
        const bs = getComputedStyle(el.shadowRoot.querySelector('.badge'));
        out[skin] = { bg: bs.backgroundImage + bs.backgroundColor, color: bs.color };
      });
      const el = window.mk('a', { knob_theme: 'metal' }, items);
      const v = getComputedStyle(el.shadowRoot.querySelector('.knob'), '::after');
      out.recess = v.boxShadow;
      out.emboss = v.textShadow;
      return out;
    }, ITEMS);
    await page.waitForTimeout(400);
    check('pastille : couleurs du thème (métal, laiton, carbone, néon toutes différentes)', new Set(['metal', 'brass', 'carbon', 'neon'].map((k) => themed[k].bg)).size === 4 && themed.brass.color === 'rgb(43, 29, 8)' && themed.neon.color === 'rgb(184, 247, 255)', themed);
    check('voyant : petit bouton enfoncé (ombre intérieure) et chiffre incrusté', /inset/.test(themed.recess) && themed.emboss !== 'none', themed);
    // 10 entités ou plus : deux chiffres, voyant plus large
    const many = await page.evaluate(() => {
      const items = Array.from({ length: 10 }, (_, k) => ({ entity: `light.n${k}` }));
      items.forEach((it) => { window.__states[it.entity] = { state: 'on', attributes: {} }; });
      items.push({ name: 'G', items: [{ entity: 'light.n10' }, { entity: 'light.n11' }] });
      window.__states['light.n10'] = { state: 'on', attributes: {} };
      window.mk('a', { auto_close: 0 }, items.slice(0, 9).concat([items[10]]));
      return null;
    });
    void many;
    await page.waitForTimeout(600);
    const two = await read();
    check('10 entités allumées : « 10 » dans un voyant plus large que haut', two.voyant === '"10"' && two.vw > two.vh * 1.2, two);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Appui long sur le bouton central');
  {
    const t = await h.open(browser, h.cards(['a']), { touch: true });
    const { page, touch } = t;
    const cfg = (a) => page.evaluate(({ items, a }) => window.mk('a', { auto_close: 0, center_hold_action: a }, items), { items: ITEMS, a });
    await cfg({ action: 'all_off' });
    const g = await h.geo(page, 'a');
    await page.mouse.move(g.cx, g.cy);
    await page.mouse.down();
    await page.waitForTimeout(700);
    const flash = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('flash'));
    await page.mouse.up();
    await page.waitForTimeout(150);
    let c = await h.calls(page);
    let active = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'));
    check('« tout éteindre » : lumières et prise allumées seulement (pas l\'ampli ni le volet)', c.length === 1 && c[0].domain === 'homeassistant' && c[0].service === 'turn_off' && JSON.stringify(c[0].data.entity_id) === JSON.stringify(['light.salon', 'switch.prise', 'light.escalier']), c);
    check('onde de confirmation, cercle resté fermé', flash && !active, { flash, active });
    await h.clearCalls(page);
    await page.mouse.click(g.cx, g.cy);
    await page.waitForTimeout(150);
    active = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'));
    check('appui court : ouvre toujours le cercle', active && (await h.calls(page)).length === 0);
    // Cercle ouvert : l'appui long marche aussi, sans fermer
    await page.mouse.move(g.cx, g.cy);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(150);
    c = await h.calls(page);
    active = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'));
    check('cercle ouvert : appui long au centre = action, cercle reste ouvert', c.length === 1 && active, { c, active });
    await page.evaluate(() => document.getElementById('a')._toggle());

    await cfg('all_off');
    await h.clearCalls(page);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    check('forme courte « center_hold_action: all_off »', (await h.calls(page)).length === 1);

    await cfg({ action: 'navigate', navigation_path: '#scenes' });
    await h.clearCalls(page);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    let ev = await page.evaluate(() => window.__events.filter((e) => e.type === 'location-changed'));
    check('pop-up (#scenes)', ev.length === 1 && ev[0].path.endsWith('#scenes'), ev);

    await cfg({ action: 'perform-action', perform_action: 'scene.turn_on', target: { entity_id: 'scene.soiree' } });
    await h.clearCalls(page);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    c = await h.calls(page);
    check('scène', c.length === 1 && c[0].domain === 'scene' && c[0].target.entity_id === 'scene.soiree', c);

    await cfg({ action: 'navigate', navigation_path: '#' });
    await h.clearCalls(page);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    await page.waitForTimeout(100);
    active = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'));
    check('action incomplète (pop-up vide) : ignorée, l\'appui garde son effet normal', (await h.calls(page)).length === 0 && active, active);
    await page.evaluate(() => document.getElementById('a')._toggle());

    // Au doigt
    await cfg({ action: 'all_off' });
    await h.clearCalls(page);
    await touch.down(g.cx, g.cy);
    await page.waitForTimeout(700);
    await touch.up();
    await page.waitForTimeout(200);
    c = await h.calls(page);
    const hap = await page.evaluate(() => ({ h: window.__haptics, v: window.__vibrate }));
    active = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'));
    check('au doigt : action, sans ouvrir le cercle', c.length === 1 && !active, { c, active });
    check('au doigt : retour haptique « heavy » (événement HA + vibreur)', hap.h.includes('heavy') && hap.v.length >= 1, hap);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Retour haptique');
  {
    const t = await h.open(browser, h.cards(['a']), { touch: true });
    const { page, touch } = t;
    const drag = async () => {
      const g = await h.geo(page, 'a');
      await page.evaluate(() => { const el = document.getElementById('a'); if (!el._open) el._toggle(); });
      await page.waitForTimeout(600);
      await h.clearCalls(page);
      let p = h.at(g, 0, 1.9);
      await touch.down(p.x, p.y);
      for (let a = 0; a <= 130; a += 10) { p = h.at(g, 0, 1.9, a); await touch.move(p.x, p.y); }
      await touch.up();
      await page.waitForTimeout(100);
      return page.evaluate(() => ({ h: window.__haptics, v: window.__vibrate.length }));
    };
    await page.evaluate((items) => window.mk('a', { auto_close: 0 }, items), ITEMS);
    const a = await drag();
    check('glisser au doigt sur 3 entrées : un « selection » par entrée + « light » au lâcher', a.h.filter((x) => x === 'selection').length === 2 && a.h[a.h.length - 1] === 'light', a);
    await page.evaluate((items) => window.mk('a', { auto_close: 0, haptics: false }, items), ITEMS);
    const b = await drag();
    check('haptics: false : aucun retour', b.h.length === 0 && b.v === 0, b);
    await page.evaluate((items) => { window.mk('a', { auto_close: 0 }, items); window.makeHass0 = window.makeHass; window.makeHass = () => ({ ...window.makeHass0(), vibrate: false }); document.getElementById('a').hass = window.makeHass(); }, ITEMS);
    const v = await drag();
    check('vibration désactivée dans le profil HA : aucun retour', v.h.length === 0, v);
    await page.evaluate((items) => { window.makeHass = window.makeHass0; window.mk('a', { auto_close: 0 }, items); window.externalApp = {}; }, ITEMS);
    const app = await drag();
    check('dans l\'appli HA : événement « haptic » seulement (pas de double vibration)', app.h.length >= 2 && app.v === 0, app);
    await t.close();

    const m = await h.open(browser, h.cards(['a']));
    await m.page.evaluate((items) => { window.mk('a', { auto_close: 0 }, items); document.getElementById('a')._toggle(); }, ITEMS);
    await m.page.waitForTimeout(600);
    const g = await h.geo(m.page, 'a');
    const p = h.at(g, 1, 1.9);
    await m.page.mouse.click(p.x, p.y);
    const mh = await m.page.evaluate(() => window.__haptics.length + window.__vibrate.length);
    check('à la souris : aucun retour haptique', mh === 0, mh);
    await m.close();
  }

  group('Mode nuit');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    const read = () => page.evaluate(() => {
      const w = window.sr('a').querySelector('.wrap');
      return { night: w.classList.contains('night'), level: w.style.getPropertyValue('--rsc-night'), filter: getComputedStyle(w).filter };
    });
    await page.evaluate((items) => window.mk('a', { night_mode: 'sun' }, items), ITEMS);
    const day = await read();
    await page.evaluate(() => window.setState('sun.sun', 'below_horizon'));
    await page.waitForTimeout(1400);
    const night = await read();
    check('soleil levé : normal ; couché : carte atténuée (60 % par défaut)', !day.night && night.night && night.level === '0.6' && night.filter.includes('brightness(0.6)'), { day, night });
    await page.evaluate(() => window.setState('sun.sun', 'above_horizon'));
    check('le jour revient : mode nuit retiré', !(await read()).night);
    await page.evaluate((items) => window.mk('a', { night_mode: 'entity', night_entity: 'input_boolean.nuit', night_level: 35 }, items), ITEMS);
    const e0 = await read();
    await page.evaluate(() => window.setState('input_boolean.nuit', 'on'));
    const e1 = await read();
    check('mode nuit piloté par une entité, niveau 35 %', !e0.night && e1.night && e1.level === '0.35', { e0, e1 });
    await page.evaluate((items) => window.mk('a', { night_mode: 'always', night_level: 2 }, items), ITEMS);
    const al = await read();
    check('« always » + niveau trop bas ramené à 10 %', al.night && al.level === '0.1', al);
    await page.evaluate((items) => window.mk('a', {}, items), ITEMS);
    check('par défaut : pas de mode nuit', !(await read()).night);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
