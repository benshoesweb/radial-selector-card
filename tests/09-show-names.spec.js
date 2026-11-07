// Noms en petit sous l'icône de chaque entrée et groupe (show_names)
const ITEMS = [
  { icon: 'mdi:sofa', entity: 'light.salon' },
  { name: 'Ma cuisine', icon: 'mdi:stove', entity: 'light.cuisine' },
  { name: 'Étage', icon: 'mdi:stairs-up', items: [{ icon: 'mdi:shower', entity: 'light.salle_de_bain' }, { name: 'Palier', icon: 'mdi:stairs', entity: 'light.etage' }] },
  { name: 'Salle à manger du rez-de-chaussée, côté jardin', icon: 'mdi:table-furniture', entity: 'light.salle_a_manger' },
];

module.exports = async (browser, h) => {
  const { check, group } = h;
  const read = (page) => page.evaluate(() => {
    const el = document.getElementById('a');
    const s = el.shadowRoot;
    return {
      names: [...s.querySelectorAll('li')].map((li) => { const n = li.querySelector('.nm'); return n ? n.textContent : null; }),
      hidden: [...s.querySelectorAll('.nm')].every((n) => n.getAttribute('aria-hidden') === 'true'),
      cls: s.querySelector('.selector').classList.contains('names'),
      aria: [...s.querySelectorAll('li input')].map((i) => i.getAttribute('aria-label')),
    };
  });
  const open = (page, cfg, items) => page.evaluate(({ cfg, items }) => {
    const el = window.mk('a', { auto_close: 0, name: '', ...cfg }, items);
    if (!el._open) el._toggle();
  }, { cfg, items });

  group('Noms sous les icônes');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await open(page, {}, ITEMS);
    await page.waitForTimeout(150);
    let r = await read(page);
    check('par défaut : pas de nom sous les icônes (cartes existantes inchangées)', r.names.every((n) => n === null) && !r.cls, r);
    await open(page, { show_names: true }, ITEMS);
    await page.waitForTimeout(700);
    r = await read(page);
    check('show_names : le nom choisi, sinon celui de Home Assistant, groupe compris', JSON.stringify(r.names) === JSON.stringify(['Salon', 'Ma cuisine', 'Étage', 'Salle à manger du rez-de-chaussée, côté jardin']) && r.cls, r.names);
    check('… pas lu deux fois par les lecteurs d\'écran (le nom est déjà dans l\'étiquette de l\'entrée)', r.hidden && r.aria[1] === 'Ma cuisine', r);
    const geo = await page.evaluate(() => {
      const s = document.getElementById('a').shadowRoot;
      const li = s.querySelectorAll('li')[0];
      const ic = li.querySelector('ha-icon').getBoundingClientRect();
      const nm = li.querySelector('.nm').getBoundingClientRect();
      const lv = li.querySelector('.lvl').getBoundingClientRect();
      const long = s.querySelectorAll('li')[3].querySelector('.nm');
      const cs = getComputedStyle(long);
      return { order: ic.bottom <= nm.top + 1 && nm.bottom <= lv.top + 1, lvl: li.classList.contains('has-lvl'), lvlText: li.querySelector('.lvl').textContent,
        ellipsis: cs.textOverflow === 'ellipsis' && long.scrollWidth > long.clientWidth, w4: long.getBoundingClientRect().width };
    });
    check('icône, puis le nom, puis la valeur (50 %), sans chevauchement', geo.order && geo.lvl && geo.lvlText === '50%', geo);
    check('nom trop long : coupé avec « … »', geo.ellipsis, geo);
    // Le nom de Home Assistant change : le nom affiché suit
    await page.evaluate(() => window.setState('light.salon', 'on', { friendly_name: 'Séjour' }));
    await page.waitForTimeout(60);
    check('nom changé dans Home Assistant : mis à jour sous l\'icône', (await read(page)).names[0] === 'Séjour', (await read(page)).names);
    await page.evaluate(() => window.setState('light.salon', 'on', { friendly_name: 'Salon' }));
    // Sous-cercle d'un groupe
    await page.evaluate(() => document.getElementById('a')._activate(2));
    await page.waitForTimeout(700);
    r = await read(page);
    check('dans un groupe : noms des entrées du groupe', JSON.stringify(r.names) === JSON.stringify(['Salle de bain', 'Palier']), r.names);
    // Plus d'entrées : noms plus étroits
    const w10 = await page.evaluate(() => {
      const ents = ['light.salon', 'light.cuisine', 'light.salle_a_manger', 'light.bureau', 'light.escalier', 'light.exterieur', 'light.salle_de_bain', 'light.etage', 'media_player.ampli', 'cover.volet'];
      const items = ents.map((e) => ({ entity: e, name: e === 'light.salle_a_manger' ? 'Salle à manger du rez-de-chaussée, côté jardin' : undefined }));
      const el = window.mk('a', { auto_close: 0, name: '', show_names: true }, items);
      if (!el._open) el._toggle();
      return el.shadowRoot.querySelectorAll('li')[2].querySelector('.nm').getBoundingClientRect().width;
    });
    await page.waitForTimeout(100);
    check('10 entrées : la place du nom se réduit pour ne pas toucher les voisins', w10 < geo.w4 * 0.75 && w10 > 30, { w4: geo.w4, w10 });
    await open(page, { show_names: true }, [{ entity: 'light.salon', name: '<b>Salon & co</b>' }, { entity: 'light.cuisine' }]);
    await page.waitForTimeout(100);
    const esc = await page.evaluate(() => { const n = document.getElementById('a').shadowRoot.querySelector('.nm'); return { t: n.textContent, b: !!n.querySelector('b') }; });
    check('nom affiché tel quel (pas de HTML interprété)', esc.t === '<b>Salon & co</b>' && !esc.b, esc);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Éditeur : noms sous les icônes');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
    const r = await t.page.evaluate(() => {
      const ed = document.createElement('radial-selector-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (e) => { log.push(e.detail.config); ed.setConfig(e.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:radial-selector-card', items: [{ entity: 'light.salon' }, { entity: 'light.cuisine' }] });
      const box = ed.shadowRoot.querySelector('[data-field="show_names"]');
      const label = box.closest('label').textContent.trim();
      const on = box.checked;
      box.checked = true; box.dispatchEvent(new Event('change'));
      const a = log[log.length - 1].show_names;
      const box2 = ed.shadowRoot.querySelector('[data-field="show_names"]');
      box2.checked = false; box2.dispatchEvent(new Event('change'));
      return { label, on, a, b: 'show_names' in log[log.length - 1] };
    });
    check('case « Afficher le nom en petit sous l\'icône… », décochée par défaut', r.label.startsWith('Afficher le nom en petit sous l\'icône') && !r.on, r);
    check('cochée : show_names: true ; décochée : clé retirée', r.a === true && r.b === false, r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
