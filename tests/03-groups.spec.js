// Groupes : sous-cercle, retour, appui long sur un groupe, réduction automatique
const ITEMS = [
  { name: 'Salon', icon: 'mdi:sofa', entity: 'light.salon' },
  {
    name: 'Étage', icon: 'mdi:stairs-up',
    items: [
      { name: 'Chambre 1', icon: 'mdi:bed', entity: 'light.chambre_1' },
      { name: 'Chambre 2', icon: 'mdi:bed-double', entity: 'light.chambre_2' },
      { name: 'Salle de bain', icon: 'mdi:shower', entity: 'light.salle_de_bain' },
    ],
  },
  { name: 'Cuisine', icon: 'mdi:stove', entity: 'light.cuisine' },
  { name: 'Bureau', icon: 'mdi:desk', entity: 'light.bureau' },
];

module.exports = async (browser, h) => {
  const { check, group } = h;
  const state = (page) => page.evaluate(() => {
    const el = document.getElementById('a');
    const s = el.shadowRoot;
    const sel = s.querySelector('.selector');
    return {
      n: s.querySelectorAll('li').length,
      names: [...s.querySelectorAll('li input')].map((i) => i.getAttribute('aria-label')),
      inGroup: sel.classList.contains('in-group'), active: sel.classList.contains('active'),
      aria: s.querySelector('.knob').getAttribute('aria-label'),
      crumb: s.querySelector('.crumb-icon').getAttribute('icon'),
      crumbOp: Number(getComputedStyle(s.querySelector('.crumb')).opacity),
      angle: sel.style.getPropertyValue('--rsc-angle'),
      opac: [...s.querySelectorAll('li')].map((li) => Number(getComputedStyle(li).opacity)),
      label: s.querySelector('.label').textContent,
    };
  });

  group('Groupes');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    const r0 = await page.evaluate((items) => {
      const el = window.mk('a', { auto_close: 0, show_label: true }, items);
      const li = el.shadowRoot.querySelectorAll('li')[1];
      return { group: li.classList.contains('group'), on: li.classList.contains('on'), lvl: li.querySelector('.lvl').textContent, badge: el.shadowRoot.querySelector('.badge').textContent };
    }, ITEMS);
    check('entrée groupe repérée, allumée si un enfant l\'est, « 2/3 » sous l\'icône', r0.group && r0.on && r0.lvl === '2/3', r0);
    check('nombre sur le bouton fermé : enfants des groupes compris (3)', r0.badge === '3', r0);

    await page.evaluate(() => document.getElementById('a')._toggle());
    await page.waitForTimeout(700);
    let g = await h.geo(page, 'a');
    let p = h.at(g, 1, 1.9);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(60);
    const mid = await state(page);
    await page.waitForTimeout(1000);
    const s1 = await state(page);
    check('appui sur le groupe : sous-cercle de 3 entrées', s1.n === 3 && s1.inGroup && s1.active && s1.names[0] === 'Chambre 1', s1);
    check('sous-cercle : animation d\'ouverture rejouée', mid.opac.some((o) => o < 0.9) && s1.opac.every((o) => o > 0.99), { mid: mid.opac, fin: s1.opac });
    check('icône du groupe au centre, bouton = « Retour »', s1.crumb === 'mdi:stairs-up' && s1.crumbOp > 0.8 && s1.aria.startsWith('Retour'), s1);
    check('aucune commande envoyée en ouvrant le groupe', (await h.calls(page)).length === 0);

    g = await h.geo(page, 'a');
    p = h.at(g, 1, 1.9);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(100);
    let c = await h.calls(page);
    check('appui sur un enfant : bascule de l\'enfant', c.length === 1 && c[0].data.entity_id === 'light.chambre_2', c);

    // Appui long sur un enfant variable : variateur dans le sous-cercle
    await h.clearCalls(page);
    p = h.at(g, 0, 1.9);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    const pct = await page.evaluate(() => window.sr('a').querySelector('.pct').textContent);
    await page.mouse.up();
    check('appui long sur un enfant : variateur (25 %)', pct === '25%', pct);

    await page.mouse.click(g.cx, g.cy);
    await page.waitForTimeout(900);
    const s2 = await state(page);
    check('appui sur le bouton : retour au cercle principal, groupe sélectionné', s2.n === 4 && !s2.inGroup && s2.active && s2.angle === '0deg', s2);

    // Échap : retour
    await page.mouse.click(h.at(g = await h.geo(page, 'a'), 1, 1.9).x, h.at(g, 1, 1.9).y);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.sr('a').querySelector('.selector').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await page.waitForTimeout(300);
    const s3 = await state(page);
    check('Échap dans un groupe : retour (cercle toujours ouvert)', s3.n === 4 && s3.active, s3);

    // Appui long sur un groupe sans entité : tout éteindre / tout allumer
    await h.clearCalls(page);
    g = await h.geo(page, 'a');
    p = h.at(g, 1, 1.9);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    c = await h.calls(page);
    check('appui long sur le groupe : éteint les enfants allumés', c.length === 1 && c[0].service === 'turn_off' && JSON.stringify(c[0].data.entity_id) === JSON.stringify(['light.chambre_1', 'light.salle_de_bain']), c);
    await page.evaluate(() => { window.setState('light.chambre_1', 'off'); window.setState('light.salle_de_bain', 'off'); });
    await h.clearCalls(page);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    c = await h.calls(page);
    const off = await page.evaluate(() => window.sr('a').querySelectorAll('li')[1].classList.contains('on'));
    check('tout éteint : l\'appui long allume tout le groupe', c.length === 1 && c[0].service === 'turn_on' && c[0].data.entity_id.length === 3, c);
    check('groupe éteint : plus de repère allumé', off === false);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Groupes : fermeture et variantes');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await page.evaluate((items) => { window.mk('a', { auto_close: 1 }, items); document.getElementById('a')._toggle(); }, ITEMS);
    await page.waitForTimeout(600);
    let g = await h.geo(page, 'a');
    let p = h.at(g, 1, 1.9);
    await page.mouse.click(p.x, p.y);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(2000);
    const s = await state(page);
    check('réduction automatique dans un groupe : fermé puis revenu au cercle principal', !s.active && s.n === 4 && !s.inGroup, s);
    await page.evaluate(() => document.getElementById('a')._toggle());
    await page.waitForTimeout(100);
    check('réouverture : cercle principal', (await state(page)).n === 4);

    // Fermeture puis réouverture immédiate depuis un groupe
    await page.evaluate(() => { const el = document.getElementById('a'); el._activate(1); el._toggle(); el._toggle(); });
    await page.waitForTimeout(100);
    const s2 = await state(page);
    check('fermer dans un groupe puis rouvrir tout de suite : cercle principal', s2.n === 4 && s2.active && !s2.inGroup, s2);

    // Groupe avec entité (groupe de lumières HA) : variateur ; groupe avec tap_action : action
    const items2 = ITEMS.map((it, i) => (i === 1 ? { ...it, entity: 'light.etage' } : it)).concat([{ name: 'Tout', icon: 'mdi:home', tap_action: { action: 'more-info', entity: 'light.etage' }, items: [{ entity: 'light.salon' }] }]);
    await page.evaluate((items) => { window.mk('a', { auto_close: 0 }, items); document.getElementById('a')._toggle(); }, items2);
    await page.waitForTimeout(700);
    g = await h.geo(page, 'a');
    p = h.at(g, 1, 1.9);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    const pct = await page.evaluate(() => window.sr('a').querySelector('.pct').textContent);
    await page.mouse.up();
    check('groupe avec entité : appui long = variateur de l\'entité du groupe (43 %)', pct === '43%', pct);
    const lvl = await page.evaluate(() => window.sr('a').querySelectorAll('li')[1].querySelector('.lvl').textContent);
    check('groupe avec entité : sa luminosité sous l\'icône', lvl === '43%', lvl);
    await h.clearCalls(page);
    p = h.at(g, 4, 1.9);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(300);
    const ev = await page.evaluate(() => window.__events);
    check('groupe avec tap_action : l\'action est lancée au lieu d\'ouvrir', ev.some((e) => e.type === 'more-info' && e.entity === 'light.etage') && (await state(page)).n === 5, ev);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
