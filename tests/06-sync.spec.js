// Jumeau d'un bouton rotatif physique : sync_entity (input_text / input_select), sync_open, éditeur
const ITEMS = [
  { name: 'Salon', icon: 'mdi:sofa', entity: 'light.salon' },
  { name: 'Cuisine', icon: 'mdi:stove', entity: 'light.cuisine' },
  {
    name: 'Étage', icon: 'mdi:stairs-up',
    items: [
      { name: 'Chambre 1', icon: 'mdi:bed', entity: 'light.chambre_1' },
      { name: 'Salle de bain', icon: 'mdi:shower', entity: 'light.salle_de_bain' },
    ],
  },
  { name: 'Prise', icon: 'mdi:power-plug', entity: 'switch.prise' },
];

module.exports = async (browser, h) => {
  const { check, group } = h;
  const read = (page) => page.evaluate(() => {
    const el = document.getElementById('a');
    return { open: el._open, sel: el._selected, ring: el._ringKey, angle: el._sel.style.getPropertyValue('--rsc-angle') };
  });

  group('Bouton physique → carte');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await page.evaluate((items) => {
      window.setState('input_text.bouton', 'light.cuisine');
      window.mk('a', { auto_close: 0, sync_entity: 'input_text.bouton' }, items);
    }, ITEMS);
    await page.waitForTimeout(200);
    const r0 = await read(page);
    check('au chargement : pointe l\'entrée de l\'aide, sans s\'ouvrir', !r0.open && r0.sel === 1 && r0.angle === '0deg', r0);
    await page.evaluate(() => { window.setState('light.cuisine', 'on'); window.setState('light.salon', 'on'); });
    await page.evaluate(() => { const el = document.getElementById('a'); el._config.sync_open = false; window.setState('input_text.bouton', 'switch.prise'); });
    await page.waitForTimeout(700);
    const up = await page.evaluate(() => {
      const k = window.sr('a').querySelector('.knob');
      const ang = (m) => { const v = m.match(/matrix\(([^)]+)\)/); if (!v) return 0; const [a, b] = v[1].split(',').map(Number); return Math.atan2(b, a) * 180 / Math.PI; };
      const kn = ang(getComputedStyle(k).transform);
      const af = ang(getComputedStyle(k, '::after').transform);
      return { kn: Math.round(kn), total: Math.round(((kn + af) % 360 + 540) % 360 - 180), content: getComputedStyle(k, '::after').content };
    });
    check('bouton tourné vers une autre entrée : le nombre du voyant reste droit', up.content !== 'none' && up.content !== '""' && Math.abs(up.kn) >= 45 && Math.abs(up.total) <= 1, up);
    await page.evaluate(() => { document.getElementById('a')._config.sync_open = true; window.setState('input_text.bouton', 'light.cuisine'); document.getElementById('a')._open && document.getElementById('a')._toggle(); });
    await page.waitForTimeout(300);

    await page.evaluate(() => window.setState('input_text.bouton', 'switch.prise'));
    await page.waitForTimeout(200);
    const r1 = await read(page);
    check('le bouton tourne : la carte s\'ouvre sur l\'entrée choisie', r1.open && r1.sel === 3 && r1.ring === '', r1);

    await page.evaluate(() => window.setState('input_text.bouton', 'light.salle_de_bain'));
    await page.waitForTimeout(200);
    const r2 = await read(page);
    check('entrée dans un groupe : le sous-cercle s\'ouvre sur elle', r2.open && r2.ring === '2' && r2.sel === 1, r2);

    await page.evaluate(() => window.setState('input_text.bouton', 'light.salon'));
    await page.waitForTimeout(200);
    const r3 = await read(page);
    check('retour au cercle principal', r3.open && r3.ring === '' && r3.sel === 0, r3);

    await page.evaluate(() => window.setState('input_text.bouton', 'light.inconnue'));
    await page.waitForTimeout(100);
    const r4 = await read(page);
    check('entité absente de la carte : rien ne change', r4.open && r4.sel === 0, r4);

    await page.evaluate(() => { window.setState('input_text.bouton', 'light.cuisine'); document.getElementById('a')._toggle(); });
    await page.waitForTimeout(700);
    const r5 = await read(page);
    check('carte refermée : le bouton fermé pointe toujours l\'entrée choisie', !r5.open && r5.sel === 1, r5);

    await page.evaluate((items) => {
      window.setState('input_text.bouton', 'light.salon');
      window.mk('a', { auto_close: 0, sync_entity: 'input_text.bouton', sync_open: false }, items);
      window.setState('input_text.bouton', 'switch.prise');
    }, ITEMS);
    await page.waitForTimeout(200);
    const r6 = await read(page);
    check('sync_open: false : pointe l\'entrée sans ouvrir la carte', !r6.open && r6.sel === 3, r6);

    await page.evaluate((items) => {
      window.mk('a', { auto_close: 1, sync_entity: 'input_text.bouton' }, items);
      window.setState('input_text.bouton', 'light.cuisine');
    }, ITEMS);
    await page.waitForTimeout(200);
    const r7 = await read(page);
    await page.waitForTimeout(1300);
    const r8 = await read(page);
    check('réduction automatique après un geste au bouton', r7.open && !r8.open && r8.sel === 1, { r7, r8 });
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Carte → bouton physique');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await page.evaluate((items) => {
      window.setState('input_text.bouton', 'light.salon');
      window.mk('a', { auto_close: 0, sync_entity: 'input_text.bouton' }, items);
      document.getElementById('a')._toggle();
    }, ITEMS);
    await page.waitForTimeout(600);
    let g = await h.geo(page, 'a');
    await h.clearCalls(page);
    let p = h.at(g, 1, 1.9);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
    const c1 = await h.calls(page);
    const set = c1.find((c) => c.domain === 'input_text');
    check('appui sur une entrée : l\'aide reçoit son entité', set && set.service === 'set_value' && set.data.entity_id === 'input_text.bouton' && set.data.value === 'light.cuisine', c1);
    check('… et l\'entrée est basculée comme d\'habitude', c1.some((c) => c.domain === 'homeassistant' && c.service === 'toggle'), c1);
    // L'écho de l'aide (Home Assistant renvoie la nouvelle valeur) ne doit rien déranger
    await page.evaluate(() => { document.getElementById('a')._toggle(); window.setState('input_text.bouton', 'light.cuisine'); });
    await page.waitForTimeout(700);
    const e = await read(page);
    check('écho de la valeur écrite par la carte : la carte reste fermée', !e.open && e.sel === 1, e);

    // input_select : seulement une option existante
    await page.evaluate((items) => {
      window.setState('input_select.bouton', 'light.salon', { options: ['light.salon', 'light.cuisine'] });
      window.mk('a', { auto_close: 0, sync_entity: 'input_select.bouton' }, items);
      document.getElementById('a')._toggle();
    }, ITEMS);
    await page.waitForTimeout(600);
    g = await h.geo(page, 'a');
    await h.clearCalls(page);
    p = h.at(g, 1, 1.9);
    await page.mouse.click(p.x, p.y);
    p = h.at(g, 3, 1.9);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
    const c2 = (await h.calls(page)).filter((c) => c.domain === 'input_select');
    check('input_select : select_option pour une option existante, rien sinon', c2.length === 1 && c2[0].service === 'select_option' && c2[0].data.option === 'light.cuisine', c2);

    await page.evaluate((items) => {
      window.mk('a', { auto_close: 0, sync_entity: 'input_text.bouton', sync_from_card: false }, items);
      document.getElementById('a')._toggle();
    }, ITEMS);
    await page.waitForTimeout(600);
    g = await h.geo(page, 'a');
    await h.clearCalls(page);
    p = h.at(g, 3, 1.9);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
    const c3 = (await h.calls(page)).filter((c) => c.domain === 'input_text');
    check('sync_from_card: false : la carte n\'écrit pas dans l\'aide', c3.length === 0, c3);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Éditeur : bouton physique');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
    const { page } = t;
    const r = await page.evaluate(() => {
      const ed = document.createElement('radial-selector-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (e) => { log.push(e.detail.config); queueMicrotask(() => ed.setConfig(e.detail.config)); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:radial-selector-card', items: [{ entity: 'light.salon' }, { entity: 'light.cuisine' }] });
      const $ = (s) => ed.shadowRoot.querySelector(s);
      const picker = $('ha-entity-picker[data-key="sync_entity"]');
      const before = { picker: !!picker, domains: picker && picker.includeDomains, sw: !!$('[data-field="sync_open"]') };
      picker.pick('input_text.bouton');
      return new Promise((res) => setTimeout(() => {
        const a = log[log.length - 1];
        const box = $('[data-field="sync_open"]');
        box.checked = false; box.dispatchEvent(new Event('change'));
        setTimeout(() => {
          const b = log[log.length - 1];
          const box2 = $('[data-field="sync_open"]');
          box2.checked = true; box2.dispatchEvent(new Event('change'));
          setTimeout(() => res({ before, a: a.sync_entity, b: b.sync_open, c: 'sync_open' in log[log.length - 1] }), 30);
        }, 30);
      }, 30));
    });
    check('champ « Synchroniser avec » limité aux aides Texte et Liste déroulante', r.before.picker && JSON.stringify(r.before.domains) === JSON.stringify(['input_text', 'input_select']), r);
    check('option d\'ouverture affichée seulement avec une aide', !r.before.sw && r.a === 'input_text.bouton', r);
    check('sync_open : seul « false » est écrit', r.b === false && r.c === false, r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
