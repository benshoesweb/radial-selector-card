// Molette multi-appareils (volume, volet, thermostat, ventilateur, input_number) et modes couleur des lumières
const ITEMS = [
  { name: 'Salon', icon: 'mdi:sofa', entity: 'light.salon' },
  { name: 'Salle à manger', icon: 'mdi:table-furniture', entity: 'light.salle_a_manger' },
  { name: 'Ampli', icon: 'mdi:speaker', entity: 'media_player.ampli' },
  { name: 'Volet', icon: 'mdi:window-shutter', entity: 'cover.volet' },
  { name: 'Thermostat', icon: 'mdi:thermostat', entity: 'climate.salon' },
  { name: 'VMC', icon: 'mdi:fan', entity: 'fan.vmc' },
  { name: 'Volume cible', icon: 'mdi:volume-high', entity: 'input_number.volume_cible' },
  { name: 'Prise', icon: 'mdi:power-plug', entity: 'switch.prise' },
];

module.exports = async (browser, h) => {
  const { check, group } = h;

  const hold = async (page, g, i, ms = 650) => {
    const p = h.at(g, i, 1.9);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
  };
  const rotate = async (page, g, i, deg) => {
    const s = Math.sign(deg) * 4;
    for (let a = s; Math.abs(a) < Math.abs(deg); a += s) { const q = h.at(g, i, 1.9, a); await page.mouse.move(q.x, q.y); }
    const q = h.at(g, i, 1.9, deg);
    await page.mouse.move(q.x, q.y);
  };
  const wheel = async (page, g, i, notches) => {
    const p = h.at(g, i, 1.9);
    await page.mouse.move(p.x, p.y);
    for (let k = 0; k < Math.abs(notches); k++) { await page.mouse.wheel(0, notches > 0 ? -100 : 100); await page.waitForTimeout(40); }
    await page.waitForTimeout(1100);
  };
  const center = (page) => page.evaluate(() => {
    const s = window.sr('a');
    return { cls: s.querySelector('.selector').className, b: (s.querySelector('.pct b') || {}).textContent, small: (s.querySelector('.pct small') || {}).textContent || '', dots: s.querySelectorAll('.pct .dots i').length, on: [...s.querySelectorAll('.pct .dots i')].findIndex((i) => i.classList.contains('on')), arc: s.querySelector('.arc').style.getPropertyValue('--rsc-arc-color') };
  });

  group('Valeurs sous les icônes');
  {
    const t = await h.open(browser, h.cards(['a']));
    const r = await t.page.evaluate((items) => {
      const el = window.mk('a', {}, items);
      return {
        lvl: [...el.shadowRoot.querySelectorAll('li')].map((li) => (li.classList.contains('has-lvl') ? li.querySelector('.lvl').textContent : null)),
        ctl: items.map((_, i) => el._holdDims(i)),
      };
    }, ITEMS);
    check('molette disponible : lumières, ampli, volet, thermostat, VMC, input_number (pas la prise)', JSON.stringify(r.ctl) === JSON.stringify([true, true, true, true, true, true, true, false]), r.ctl);
    check('valeurs : 50 %, 78 %, volume 35 %, volet 60 %, 20,5°, 50 %, 12 dB', JSON.stringify(r.lvl) === JSON.stringify(['50%', '78%', '35%', '60%', '20,5°', '50%', '12 dB', null]), r.lvl);
    const en = await h.open(browser, h.cards(['a']), { lang: 'en' });
    const lvlEn = await en.page.evaluate((items) => window.mk('a', {}, items).shadowRoot.querySelectorAll('li')[4].querySelector('.lvl').textContent, ITEMS);
    check('en anglais : 20.5°', lvlEn === '20.5°', lvlEn);
    await en.close();
    const off = await t.page.evaluate(() => {
      window.setState('climate.salon', 'off');
      window.setState('media_player.ampli', 'off', { volume_level: undefined });
      window.setState('cover.volet', 'closed', { current_position: 0 });
      const s = window.sr('a');
      return [2, 3, 4].map((i) => s.querySelectorAll('li')[i].classList.contains('has-lvl'));
    });
    check('appareils éteints / fermés : pas de valeur', off.every((x) => !x), off);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Molette (souris)');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await page.evaluate((items) => { window.mk('a', { auto_close: 0 }, items); document.getElementById('a')._toggle(); }, ITEMS);
    await page.waitForTimeout(700);
    const g = await h.geo(page, 'a');

    await wheel(page, g, 4, 1);
    let c = await h.calls(page);
    check('thermostat : +1 cran = +0,5°', c.length === 1 && c[0].domain === 'climate' && c[0].service === 'set_temperature' && c[0].data.temperature === 21, c);
    await h.clearCalls(page);
    await wheel(page, g, 4, -3);
    c = await h.calls(page);
    check('thermostat : -3 crans = 19°', c.length && c[c.length - 1].data.temperature === 19, c);

    await h.clearCalls(page);
    await wheel(page, g, 2, 1);
    c = await h.calls(page);
    check('ampli : volume 35 % -> 40 %', c.length === 1 && c[0].service === 'volume_set' && c[0].data.volume_level === 0.4, c);

    await h.clearCalls(page);
    await wheel(page, g, 5, 1);
    c = await h.calls(page);
    check('VMC (pas de 25 %) : 50 % -> 75 %', c.length === 1 && c[0].service === 'set_percentage' && c[0].data.percentage === 75, c);

    await h.clearCalls(page);
    await wheel(page, g, 6, 1);
    c = await h.calls(page);
    check('input_number (pas de 2) : 12 -> 14', c.length === 1 && c[0].domain === 'input_number' && c[0].service === 'set_value' && c[0].data.value === 14, c);

    await h.clearCalls(page);
    await hold(page, g, 3);
    const ce = await center(page);
    await rotate(page, g, 3, -54);
    await page.mouse.up();
    await page.waitForTimeout(200);
    c = await h.calls(page);
    check('volet : appui long affiche la position', ce.cls.includes('dimming') && ce.b === '60%', ce);
    check('volet : rotation -54° = position 40 %', c.length && c[c.length - 1].service === 'set_cover_position' && c[c.length - 1].data.position === 40, c);

    await h.clearCalls(page);
    await hold(page, g, 4);
    const th = await center(page);
    await page.mouse.up();
    check('thermostat : consigne au centre (« 20,5° »), sans modes', th.b === '20,5°' && th.dots === 0, th);

    await h.clearCalls(page);
    await hold(page, g, 7);
    await page.mouse.up();
    const ev = await page.evaluate(() => window.__events);
    check('prise : appui long = fenêtre d\'infos', ev.some((e) => e.type === 'more-info' && e.entity === 'switch.prise'), ev);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Lumière couleur : luminosité -> blanc -> couleur');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await page.evaluate((items) => { window.mk('a', { auto_close: 0 }, items); document.getElementById('a')._toggle(); }, ITEMS);
    await page.waitForTimeout(700);
    const g = await h.geo(page, 'a');

    await hold(page, g, 1);
    const m1 = await center(page);
    await page.mouse.up();
    check('1er appui long : luminosité (78 %), 3 points dont le 1er actif', m1.b === '78%' && m1.small === 'Luminosité' && m1.dots === 3 && m1.on === 0, m1);
    await page.waitForTimeout(300);

    await h.clearCalls(page);
    await hold(page, g, 1);
    const m2 = await center(page);
    await rotate(page, g, 1, 60);
    const m2b = await center(page);
    await page.mouse.up();
    await page.waitForTimeout(200);
    let c = await h.calls(page);
    const k = c.filter((x) => 'color_temp_kelvin' in x.data).pop();
    check('2e appui long (< 3 s) : blanc, 3000 K', m2.cls.includes('mode-temp') && m2.b === '3000 K' && m2.small === 'Blanc' && m2.on === 1, m2);
    check('blanc : rotation +60° = plus froid (pas de 50 K)', k && k.data.color_temp_kelvin > 3800 && k.data.color_temp_kelvin % 50 === 0 && k.data.entity_id === 'light.salle_a_manger', k);
    check('blanc : repère de la couleur du blanc réglé', /^rgb\(/.test(m2b.arc), m2b.arc);
    check('blanc : la luminosité sous l\'icône ne change pas', await page.evaluate(() => window.sr('a').querySelectorAll('li')[1].querySelector('.lvl').textContent === '78%'));

    await h.clearCalls(page);
    await hold(page, g, 1);
    const m3 = await center(page);
    await rotate(page, g, 1, 40);
    await page.mouse.up();
    await page.waitForTimeout(200);
    c = await h.calls(page);
    const hs = c.filter((x) => 'hs_color' in x.data).pop();
    check('3e appui long : couleur, teinte 30°', m3.cls.includes('mode-hue') && m3.b === '30°' && m3.small === 'Couleur' && m3.on === 2, m3);
    check('couleur : rotation +40° = teinte ≈ 83°, saturation conservée (80)', hs && Math.abs(hs.data.hs_color[0] - 83) <= 2 && hs.data.hs_color[1] === 80, hs);

    await hold(page, g, 1);
    const m4 = await center(page);
    await page.mouse.up();
    check('4e appui long : retour à la luminosité', m4.small === 'Luminosité' && !m4.cls.includes('mode-'), m4);

    await page.waitForTimeout(3300);
    await hold(page, g, 1);
    await page.mouse.up();
    await page.waitForTimeout(100);
    await hold(page, g, 1);
    const m5 = await center(page);
    await page.mouse.up();
    check('plus de 3 s après : on repart de la luminosité (le suivant est donc le blanc)', m5.small === 'Blanc', m5);

    await page.waitForTimeout(3300);
    await hold(page, g, 0);
    await page.mouse.up();
    await hold(page, g, 0);
    const m6 = await center(page);
    await page.mouse.up();
    check('lumière sans couleur : toujours la luminosité, sans points', m6.b === '50%' && m6.dots === 0 && !m6.cls.includes('mode-'), m6);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Option dimmer');
  {
    const t = await h.open(browser, h.cards(['a']));
    const r = await t.page.evaluate((items) => {
      const el = window.mk('a', { dimmer: false }, items.map((it, i) => (i === 0 ? { ...it, dimmer: true } : it)));
      const a = items.map((_, i) => el._holdDims(i));
      const el2 = window.mk('a', {}, items.map((it, i) => (i === 4 ? { ...it, dimmer: false } : (i === 2 ? { ...it, hold_action: { action: 'toggle' } } : it))));
      return { a, b: items.map((_, i) => el2._holdDims(i)), lvl: el2.shadowRoot.querySelectorAll('li')[4].classList.contains('has-lvl') };
    }, ITEMS);
    check('dimmer: false (carte) désactive tout, sauf l\'entrée forcée', JSON.stringify(r.a) === JSON.stringify([true, false, false, false, false, false, false, false]), r.a);
    check('dimmer: false (entrée) et hold_action ont la priorité', r.b[4] === false && r.b[2] === false && r.b[3] === true, r.b);
    check('dimmer: false : pas de valeur sous l\'icône', r.lvl === false);
    await t.close();
  }
};
