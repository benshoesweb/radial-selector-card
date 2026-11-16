// Ombre native du thème (--ha-card-box-shadow) reprise par les boutons de coin et de ligne
module.exports = async (browser, h) => {
  const { check, group } = h;
  const NORD = 'rgba(0, 0, 0, 0.35) 0px 6px 6px 0px';
  const body = '<div id="theme">' + h.cards(['a']) + '</div>';
  const setup = (page, cfg) => page.evaluate((cfg) => {
    window.mk('a', {
      auto_close: 0, name: '',
      extra_buttons: [{ entity: 'light.salon', icon: 'mdi:sofa', position: 'bottom_left' }, { entity: 'media_player.tv', icon: 'mdi:television', position: 'bottom_right', style: 'tile' }],
      row_items: [{ entity: 'light.cuisine', icon: 'mdi:stove', style: 'metal' }, { entity: 'light.bureau', icon: 'mdi:desk', style: 'tile' }],
      ...cfg,
    });
  }, cfg);
  const read = (page) => page.evaluate(() => {
    const s = document.getElementById('a').shadowRoot;
    const q = (sel) => s.querySelector(sel);
    const sh = (el, pseudo) => getComputedStyle(el, pseudo).boxShadow;
    return {
      corner: sh(q('.xbtn:not(.tile)'), '::before'), cornerOwn: sh(q('.xbtn:not(.tile)')), cornerTile: sh(q('.xbtn.tile')),
      row: sh(q('.rbtn:not(.tile)'), '::before'), rowTile: sh(q('.rbtn.tile')),
      card: getComputedStyle(q('ha-card')).boxShadow,
      layer: getComputedStyle(q('.xbtn:not(.tile)'), '::before').content,
    };
  });
  // Les tuiles passent d'une ombre à l'autre en 0,3 s (transition) : on attend la fin avant de mesurer
  const theme = async (page, v) => {
    await page.evaluate((v) => { const t = document.getElementById('theme'); if (v === null) t.style.removeProperty('--ha-card-box-shadow'); else t.style.setProperty('--ha-card-box-shadow', v); }, v);
    await page.waitForTimeout(450);
  };

  group('Ombre du thème sur les boutons de coin et de ligne');
  {
    const t = await h.open(browser, body, { w: 440, h: 620 });
    const { page } = t;
    await setup(page, { knob_theme: 'ha' });
    await page.waitForTimeout(150);
    let r = await read(page);
    check('thème sans ombre définie : ombre propre à la carte, comme avant', r.corner === 'rgba(0, 0, 0, 0.25) 0px 2px 6px 0px' && r.row === r.corner && r.cornerTile === 'rgba(0, 0, 0, 0.35) 0px 2px 6px 0px' && r.rowTile === r.cornerTile, r);
    await theme(page, '0px 6px 6px 0px rgba(0, 0, 0, 0.35)');
    r = await read(page);
    check('thème avec ombre (Radial Nord) : boutons de coin et de ligne, ronds et tuiles, prennent l\'ombre du thème', r.corner === NORD && r.row === NORD && r.cornerTile === NORD && r.rowTile === NORD, r);
    check('… alors que la carte elle-même n\'a pas d\'ombre (card_style par défaut : contour sans fond)', r.card === 'none', r.card);
    check('… le liseré du bouton rond reste (1 px), l\'ombre est sur un calque à part', /0px 0px 0px 1px/.test(r.cornerOwn) && !r.cornerOwn.includes('6px') && r.layer !== 'none', r);
    await theme(page, '0px 4px 10px 0px rgba(46, 52, 64, 0.1)');
    r = await read(page);
    check('changement de thème (clair) : l\'ombre des boutons suit, sans recharger', r.corner === 'rgba(46, 52, 64, 0.1) 0px 4px 10px 0px' && r.rowTile === r.corner, r);
    await theme(page, 'none');
    r = await read(page);
    check('thème sans ombre (none) : boutons sans ombre portée, liseré conservé', r.corner === 'none' && r.row === 'none' && r.cornerTile === 'none' && /0px 0px 0px 1px/.test(r.cornerOwn), r);
    await theme(page, '0px 6px 6px 0px rgba(0, 0, 0, 0.35)');
    await page.evaluate(() => window.setState('light.salon', 'on'));
    await page.waitForTimeout(80);
    const on = await page.evaluate(() => { const b = document.getElementById('a').shadowRoot.querySelector('.xbtn:not(.tile)'); return { on: b.classList.contains('on'), own: getComputedStyle(b).boxShadow, layer: getComputedStyle(b, '::before').boxShadow }; });
    check('bouton allumé : anneau coloré conservé, ombre du thème toujours là', on.on && on.own.split('px,').length >= 2 && on.layer === NORD, on);
    await setup(page, { knob_theme: 'ha', card_style: 'standard' });
    r = await read(page);
    check('card_style standard : la carte et les boutons ont la même ombre', r.card === NORD && r.corner === NORD, r);
    await setup(page, { knob_theme: 'metal' });
    r = await read(page);
    check('thème « métal » : le bouton rond garde son relief propre (pas de calque), les tuiles suivent le thème', r.layer === 'none' && /inset/.test(r.cornerOwn) && r.cornerTile === NORD, r);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
