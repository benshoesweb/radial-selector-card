// Éditeur visuel : langues, clés conservées, saisie temporisée, groupes, bouton central, mode nuit
module.exports = async (browser, h) => {
  const { check, group } = h;
  const BASE = {
    type: 'custom:radial-selector-card', name: 'Éclairage',
    items: [{ entity: 'light.salon' }, { entity: 'light.cuisine', icon: 'mdi:stove' }, { entity: 'light.bureau' }],
    grid_options: { columns: 6, rows: 4 }, visibility: [{ condition: 'user', users: ['abc'] }],
    card_mod: { style: 'ha-card { color: red }' }, view_layout: { position: 'main' }, cle_inconnue: 42,
  };
  const setup = (page, lang = 'fr', cfg = BASE) => page.evaluate(({ cfg, lang }) => {
    document.getElementById('host').innerHTML = '';
    const ed = document.createElement('radial-selector-card-editor');
    document.getElementById('host').appendChild(ed);
    window.__log = [];
    ed.addEventListener('config-changed', (e) => { window.__log.push(e.detail.config); queueMicrotask(() => ed.setConfig(e.detail.config)); });
    ed.hass = { ...window.makeHass(), language: lang, locale: { language: lang } };
    ed.setConfig(cfg);
    window.ed = ed;
    window.$ = (sel) => ed.shadowRoot.querySelector(sel);
    window.$$ = (sel) => [...ed.shadowRoot.querySelectorAll(sel)];
    window.top$ = (k) => ed.shadowRoot.querySelector(`[data-list="__top"] [data-field="${k}"]`);
    window.card$ = (scope, i) => ed.shadowRoot.querySelector(`[data-list="${scope}"][data-idx="${i}"]`);
    window.own$ = (card, sel) => [...card.querySelectorAll(sel)].filter((el) => el.closest('[data-list]') === card);
    window.choose = (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); };
    window.tick = (el, on) => { el.checked = on; el.dispatchEvent(new Event('change')); };
    window.typeIn = (el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); };
    window.last = () => window.__log[window.__log.length - 1];
  }, { cfg, lang });
  const tick = (page) => page.waitForTimeout(30);

  const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
  const { page } = t;

  group('Éditeur : langues');
  {
    await setup(page, 'fr');
    const fr = await page.evaluate(() => ({ title: $('.section-title').textContent.trim(), add: $('[data-add="items"]').textContent.trim(), skins: [...top$('knob_theme').options].map((o) => o.textContent) }));
    check('français : titres, boutons, 7 thèmes', fr.title === 'Paramètres généraux' && fr.add === '+ Ajouter' && fr.skins.length === 7 && fr.skins[0] === 'Métal brossé (défaut)', fr);
    await page.evaluate(() => { window.ed.hass = { ...window.makeHass(), language: 'en', locale: { language: 'en' } }; });
    const en = await page.evaluate(() => ({ title: $('.section-title').textContent.trim(), anims: [...top$('open_animation').options].map((o) => o.textContent), item: $('[data-list="items"] .item-header span').textContent }));
    check('passage à l\'anglais : l\'éditeur se retraduit', en.title === 'General settings' && en.anims[0] === 'Fan (default)' && en.item === 'Dial position #1', en);
    await setup(page, 'de');
    const de = await page.evaluate(() => $('.section-title').textContent.trim());
    check('autre langue : anglais par défaut', de === 'General settings', de);
  }

  group('Éditeur : clés conservées et saisie');
  {
    await setup(page, 'fr');
    await page.evaluate(() => typeIn(top$('name'), 'Lumières RDC'));
    await tick(page);
    let L = await page.evaluate(() => last());
    const kept = ['grid_options', 'visibility', 'card_mod', 'view_layout', 'cle_inconnue'].every((k) => JSON.stringify(L[k]) === JSON.stringify(BASE[k]));
    check('nom enregistré, grid_options / visibility / card_mod / clés inconnues conservés', L.name === 'Lumières RDC' && kept, L);
    // Saisie temporisée : une seule mise à jour pour plusieurs frappes
    const n0 = await page.evaluate(() => window.__log.length);
    await page.evaluate(() => { const el = top$('name'); el.focus(); ['L', 'Lu', 'Lum', 'Lumi'].forEach((v) => { el.value = v; el.dispatchEvent(new Event('input')); }); });
    const n1 = await page.evaluate(() => window.__log.length);
    await page.waitForTimeout(400);
    const n2 = await page.evaluate(() => ({ n: window.__log.length, name: last().name }));
    check('frappe : rien d\'envoyé tout de suite, une seule mise à jour 250 ms après', n1 === n0 && n2.n === n0 + 1 && n2.name === 'Lumi', { n0, n1, n2 });
    await page.evaluate(() => { const el = top$('name'); el.value = 'Lumière'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
    const n3 = await page.evaluate(() => ({ n: window.__log.length, name: last().name }));
    await page.waitForTimeout(400);
    const n4 = await page.evaluate(() => window.__log.length);
    check('en quittant le champ : envoi immédiat, sans doublon ensuite', n3.n === n2.n + 1 && n3.name === 'Lumière' && n4 === n3.n, { n3, n4 });
    await page.evaluate(() => typeIn(top$('auto_close'), '0'));
    await tick(page);
    L = await page.evaluate(() => last());
    check('réduction automatique 0 enregistrée', L.auto_close === 0, L.auto_close);
    await page.evaluate(() => typeIn(top$('auto_close'), ''));
    await tick(page);
    L = await page.evaluate(() => last());
    check('champ vidé : clé retirée', !('auto_close' in L));
    const cbs = await page.evaluate(() => ['show_count', 'show_halo', 'haptics', 'show_brightness'].map((k) => {
      tick(top$(k), false); const a = last()[k];
      tick(top$(k), true); const b = k in last();
      return [a, b];
    }));
    check('options actives par défaut : décochées = false, recochées = clé retirée', cbs.every(([a, b]) => a === false && b === false), cbs);
    await page.evaluate(() => { tick(top$('show_label'), true); });
    L = await page.evaluate(() => last());
    check('option inactive par défaut : cochée = true', L.show_label === true);
    const sel = await page.evaluate(() => { choose(top$('knob_theme'), 'neon'); const a = last().knob_theme; choose(top$('knob_theme'), 'metal'); return [a, 'knob_theme' in last()]; });
    check('liste : choix enregistré, défaut = clé retirée', sel[0] === 'neon' && sel[1] === false, sel);
    // Entrée : couleur, appui long, icône, entité
    const it = await page.evaluate(() => {
      const c = card$('items', 1);
      typeIn(own$(c, 'input[type="text"][data-field="color"]')[0], '#00bcd4');
      const col = last().items[1].color;
      choose(own$(card$('items', 1), 'select[data-field="dimmer"]')[0], 'off');
      const off = last().items[1].dimmer;
      choose(own$(card$('items', 1), 'select[data-field="dimmer"]')[0], 'force');
      const force = last().items[1].dimmer;
      choose(own$(card$('items', 1), 'select[data-field="dimmer"]')[0], 'auto');
      const auto = 'dimmer' in last().items[1];
      own$(card$('items', 0), 'ha-entity-picker')[0].pick('light.escalier');
      const ent = last().items[0].entity;
      return { col, off, force, auto, ent, swatch: own$(card$('items', 1), '[data-swatch="color"]')[0].value };
    });
    check('entrée : couleur (et pastille)', it.col === '#00bcd4' && it.swatch === '#00bcd4', it);
    check('entrée : appui long auto / forcé / désactivé', it.off === false && it.force === true && it.auto === false, it);
    check('entrée : entité choisie', it.ent === 'light.escalier', it);
    check('clés conservées après toutes ces modifications', await page.evaluate(() => last().cle_inconnue === 42 && last().grid_options.columns === 6));
  }

  group('Éditeur : groupes');
  {
    await setup(page, 'fr');
    const g = await page.evaluate(() => {
      tick(own$(card$('items', 1), 'input[data-field="__group"]')[0], true);
      const a = last().items[1];
      const nested = $$('[data-list="items/1/items"]').length;
      $('[data-add="items/1/items"]').click();
      const b = last().items[1].items.length;
      typeIn(own$(card$('items/1/items', 2), 'input[data-field="name"]')[0], 'Chambre');
      const c = last().items[1].items[2];
      own$(card$('items/1/items', 0), 'ha-entity-picker')[0].pick('light.chambre_1');
      const d = last().items[1].items[0];
      own$(card$('items/1/items', 1), '[data-del]')[0].click();
      const e = last().items[1].items.map((x) => x.name || x.entity || '');
      const delDisabled = (() => { own$(card$('items/1/items', 0), '[data-del]')[0].click(); return own$(card$('items/1/items', 0), '[data-del]')[0].disabled; })();
      const f = last().items[1].items.length;
      $('[data-add="items/1/items"]').click();
      own$(card$('items/1/items', 1), 'ha-entity-picker')[0].pick('light.chambre_2');
      own$(card$('items/1/items', 0), '[data-move="1"]')[0].click();
      const moved = last().items[1].items.map((x) => x.name || x.entity || '');
      const top = last().items.length;
      tick(own$(card$('items', 1), 'input[data-field="__group"]')[0], false);
      const h = last().items[1];
      return { a, nested, b, c, d, e, delDisabled, f, moved, top, h };
    });
    check('cocher « Groupe » : 2 entrées vides créées et affichées', Array.isArray(g.a.items) && g.a.items.length === 2 && g.nested === 2, g);
    check('ajouter une entrée au groupe', g.b === 3, g.b);
    check('nommer et choisir l\'entité d\'une entrée du groupe', g.c.name === 'Chambre' && g.d.entity === 'light.chambre_1', g);
    check('supprimer une entrée du groupe, la dernière ne se supprime pas', JSON.stringify(g.e) === JSON.stringify(['light.chambre_1', 'Chambre']) && g.f === 1 && g.delDisabled, g);
    check('réordonner dans le groupe', JSON.stringify(g.moved) === JSON.stringify(['light.chambre_2', 'Chambre']), g.moved);
    check('le cercle principal garde ses 3 entrées', g.top === 3);
    check('décocher « Groupe » : sous-entrées retirées', !('items' in g.h), g.h);
    // La carte accepte la configuration produite
    const ok = await page.evaluate(() => {
      tick(own$(card$('items', 2), 'input[data-field="__group"]')[0], true);
      const el = document.createElement('radial-selector-card');
      document.body.appendChild(el);
      el.setConfig(last());
      el.hass = window.makeHass();
      return el.shadowRoot.querySelectorAll('li.group').length;
    });
    check('configuration produite acceptée par la carte (groupe affiché)', ok === 1, ok);
  }

  group('Éditeur : bouton central et mode nuit');
  {
    await setup(page, 'fr');
    const c = await page.evaluate(() => {
      const kinds = [...top$('center_kind').options].map((o) => o.value);
      choose(top$('center_kind'), 'all_off');
      const a = last().center_hold_action;
      choose(top$('center_kind'), 'popup');
      typeIn(top$('center_value'), 'scenes');
      const b = last().center_hold_action;
      choose(top$('center_kind'), 'scene');
      const picker = $('[data-list="__top"] ha-entity-picker[data-key="center_scene"]');
      const domains = picker && picker.includeDomains;
      picker.pick('scene.soiree');
      const s = last().center_hold_action;
      choose(top$('center_kind'), 'none');
      const n = 'center_hold_action' in last();
      return { kinds, a, b, domains, s, n };
    });
    check('appui long au centre : 5 choix', JSON.stringify(c.kinds) === JSON.stringify(['none', 'all_off', 'popup', 'navigate', 'scene']), c.kinds);
    check('« tout éteindre » enregistré', JSON.stringify(c.a) === JSON.stringify({ action: 'all_off' }), c.a);
    check('pop-up : « # » ajouté', c.b.action === 'navigate' && c.b.navigation_path === '#scenes', c.b);
    check('scène : sélecteur limité aux scènes, cible enregistrée', JSON.stringify(c.domains) === '["scene"]' && c.s.perform_action === 'scene.turn_on' && c.s.target.entity_id === 'scene.soiree', c);
    check('aucune action : clé retirée', c.n === false);
    const custom = await page.evaluate(() => {
      window.ed.setConfig({ ...last(), center_hold_action: { action: 'url', url_path: 'https://x' } });
      return { dis: top$('center_kind').disabled, val: top$('center_kind').value };
    });
    check('action YAML personnalisée : conservée, liste verrouillée', custom.dis && custom.val === 'custom', custom);
    const n = await page.evaluate(() => {
      const r0 = !!top$('night_level');
      choose(top$('night_mode'), 'sun');
      const a = last().night_mode;
      const r1 = !!top$('night_level');
      const rg = top$('night_level');
      rg.value = '40'; rg.dispatchEvent(new Event('input'));
      const lab = $('[data-range-label="night_level"]').textContent;
      rg.dispatchEvent(new Event('change'));
      const b = last().night_level;
      choose(top$('night_mode'), 'entity');
      $('[data-list="__top"] ha-entity-picker[data-key="night_entity"]').pick('input_boolean.nuit');
      const e = last().night_entity;
      const rg2 = top$('night_level'); rg2.value = '60'; rg2.dispatchEvent(new Event('change'));
      const d = 'night_level' in last();
      choose(top$('night_mode'), 'off');
      return { r0, a, r1, lab, b, e, d, off: 'night_mode' in last() };
    });
    check('mode nuit : réglages affichés seulement s\'il est activé', !n.r0 && n.r1, n);
    check('mode nuit : soleil, niveau 40 %, entité', n.a === 'sun' && n.lab === '40' && n.b === 40 && n.e === 'input_boolean.nuit', n);
    check('mode nuit : niveau par défaut (60) et « désactivé » retirent les clés', n.d === false && n.off === false, n);
    const act = await page.evaluate(() => {
      window.ed.setConfig({ ...last(), row_items: [{ entity: 'switch.prise' }] });
      const opt = [...own$(card$('row_items', 0), 'select[data-field="action"]')[0].options].map((o) => o.value);
      choose(own$(card$('row_items', 0), 'select[data-field="action"]')[0], 'all_off');
      return { opt, a: last().row_items[0].tap_action };
    });
    check('boutons : action « tout éteindre » proposée', act.opt.includes('all_off') && act.a.action === 'all_off', act);
    const cp = await page.evaluate(() => {
      const sel = top$('count_position');
      const opts = [...sel.options].map((o) => o.textContent);
      choose(sel, 'badge');
      const a = last().count_position;
      choose(top$('count_position'), 'knob');
      return { opts, a, b: 'count_position' in last() };
    });
    check('nombre d\'entités allumées : voyant (défaut) ou pastille', cp.opts[0] === 'Dans le voyant du bouton (défaut)' && cp.a === 'badge' && cp.b === false, cp);
    const cc = await page.evaluate(() => {
      const empty = { bg: top$('count_background').value, ph: top$('count_background').placeholder, swatch: $('[data-swatch="count_background"]').value, inkSwatch: $('[data-swatch="count_color"]').value };
      const pos = choose(top$('count_position'), 'badge');
      typeIn(top$('count_background'), '#7b1fa2');
      const a = last().count_background;
      const sw = $('[data-swatch="count_color"]');
      sw.value = '#ffeb3b'; sw.dispatchEvent(new Event('change'));
      const b = last().count_color;
      const kept = last().count_position;
      $('[data-clear="count_background"]').click();
      const c = 'count_background' in last();
      const resetSwatch = $('[data-swatch="count_background"]').value;
      $('[data-clear="count_color"]').click();
      const d = 'count_color' in last();
      choose(top$('count_position'), 'knob');
      return { empty, a, b, kept, c, resetSwatch, d };
    });
    check('couleurs du nombre : vides par défaut, le sélecteur montre la couleur du thème HA', cc.empty.bg === '' && cc.empty.ph === 'Thème HA' && cc.empty.swatch === '#03a9f4' && cc.empty.inkSwatch === '#ffffff', cc);
    check('couleurs du nombre : fond et chiffre enregistrés, position conservée', cc.a === '#7b1fa2' && cc.b === '#ffeb3b' && cc.kept === 'badge', cc);
    check('couleurs du nombre : ✕ retire la clé et revient à la couleur du thème', cc.c === false && cc.d === false && cc.resetSwatch === '#03a9f4', cc);
    const lateTheme = await page.evaluate(() => {
      const ed = document.createElement('radial-selector-card-editor');
      ed.hass = window.makeHass();
      ed.setConfig({ items: [{ entity: 'light.salon' }, { entity: 'light.bureau' }] });
      const host = document.createElement('div');
      host.style.setProperty('--primary-color', '#ff5722');
      host.appendChild(ed);
      document.body.appendChild(host);
      const v = ed.shadowRoot.querySelector('[data-swatch="count_background"]').value;
      host.remove();
      return v;
    });
    check('éditeur créé avant d\'entrer dans la page : couleur du thème lue à l\'arrivée', lateTheme === '#ff5722', lateTheme);
  }
  check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
  await t.close();
};
