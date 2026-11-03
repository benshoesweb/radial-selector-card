// Chargement, rendu, thèmes, animations, souris, doigt, clavier, réduction automatique, boutons
module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Chargement');
  {
    const t = await h.open(browser, h.cards(['a']));
    const info = await t.page.evaluate(() => ({
      card: !!customElements.get('radial-selector-card'),
      editor: !!customElements.get('radial-selector-card-editor'),
      list: (window.customCards || []).map((c) => c.type),
      stubFr: customElements.get('radial-selector-card').getStubConfig({ states: {}, language: 'fr' }),
      stubEn: customElements.get('radial-selector-card').getStubConfig({ states: {}, language: 'en' }),
      stubReal: customElements.get('radial-selector-card').getStubConfig({ states: window.__states, language: 'fr' }),
    }));
    check('élément de la carte et éditeur déclarés', info.card && info.editor);
    check('carte listée une seule fois dans le sélecteur de cartes', info.list.filter((x) => x === 'radial-selector-card').length === 1, info.list);
    check('configuration d\'exemple en français', info.stubFr.name === 'Éclairage' && info.stubFr.items.length === 6);
    check('configuration d\'exemple en anglais', info.stubEn.name === 'Lighting' && info.stubEn.items[0].name === 'Living room', info.stubEn);
    check('configuration d\'exemple : reprend les vraies lumières', info.stubReal.items.length === 6 && info.stubReal.items.every((i) => i.entity.startsWith('light.')));
    const err = await t.page.evaluate(() => {
      const el = document.getElementById('a');
      const msg = (cfg) => { try { el.setConfig(cfg); return 'ok'; } catch (e) { return e.message; } };
      return [msg({ items: [{ entity: 'light.a' }] }), msg({ items: Array.from({ length: 11 }, (_, i) => ({ entity: `light.l${i}` })) }), msg(null)];
    });
    check('erreurs de configuration explicites (1 ou 11 entrées, vide)', err[0].includes('2') && err[1].includes('10') && err[2].includes('radial-selector-card'), err);
    check('aucune erreur JS au chargement', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Rendu');
  {
    const t = await h.open(browser, h.cards(['a']));
    const r = await t.page.evaluate(() => {
      const el = window.mk('a', {});
      const s = el.shadowRoot;
      const lis = [...s.querySelectorAll('li')];
      return {
        n: lis.length, zones: s.querySelectorAll('.zone').length, seps: s.querySelectorAll('.sep').length,
        on: lis.map((li) => li.classList.contains('on')),
        lvl: lis.map((li) => (li.classList.contains('has-lvl') ? li.querySelector('.lvl').textContent : null)),
        icons: [...s.querySelectorAll('li ha-icon')].map((i) => i.getAttribute('icon')),
        wrap: s.querySelector('.wrap').className,
      };
    });
    check('6 entrées, 6 zones, 6 séparateurs', r.n === 6 && r.zones === 6 && r.seps === 6, r);
    check('entrées allumées repérées', JSON.stringify(r.on) === JSON.stringify([true, false, true, false, true, false]), r.on);
    check('% sous les lumières variables allumées (pas sous la lumière on/off)', r.lvl[0] === '50%' && r.lvl[2] === '78%' && r.lvl[3] === null && r.lvl[1] === null, r.lvl);
    check('icônes choisies', r.icons[0] === 'mdi:sofa' && r.icons[5] === 'mdi:outdoor-lamp');
    check('thème sombre suivi', r.wrap.includes('dark'), r.wrap);
    const hide = await t.page.evaluate(() => {
      const el = window.mk('a', { show_brightness: false });
      return el.shadowRoot.querySelectorAll('li.has-lvl').length;
    });
    check('show_brightness: false masque les valeurs', hide === 0);
    // Même configuration renvoyée par l'éditeur : pas de reconstruction
    const same = await t.page.evaluate(() => {
      const el = document.getElementById('a');
      const cfg = { type: 'custom:radial-selector-card', items: [{ entity: 'light.salon' }, { entity: 'light.cuisine' }] };
      el.setConfig(cfg);
      const before = el.shadowRoot.querySelector('.selector');
      el.setConfig(JSON.parse(JSON.stringify(cfg)));
      const kept = el.shadowRoot.querySelector('.selector') === before;
      el.setConfig({ ...cfg, name: 'X' });
      return { kept, rebuilt: el.shadowRoot.querySelector('.selector') !== before };
    });
    check('configuration identique : la carte n\'est pas reconstruite', same.kept && same.rebuilt, same);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Thèmes, animations, apparence');
  {
    const SK = ['metal', 'ha', 'glass', 'neumorph', 'brass', 'carbon', 'neon'];
    const AN = ['fan', 'bloom', 'spiral', 'cascade', 'pop', 'fade', 'none'];
    const t = await h.open(browser, `<div class="grid">${SK.map((k) => `<radial-selector-card id="s-${k}"></radial-selector-card>`).join('')}${AN.map((k) => `<radial-selector-card id="a-${k}"></radial-selector-card>`).join('')}</div>`, { w: 1300, h: 1400 });
    const r = await t.page.evaluate(({ SK, AN }) => ({
      skins: SK.map((k) => window.mk(`s-${k}`, { knob_theme: k }).shadowRoot.querySelector('.wrap').className.includes(`skin-${k}`)),
      anims: AN.map((k) => window.mk(`a-${k}`, { open_animation: k }).shadowRoot.querySelector('.selector').className.includes(`anim-${k}`)),
      unknown: window.mk('s-metal', { knob_theme: 'xyz', open_animation: 'abc' }).shadowRoot.querySelector('.selector').className,
    }), { SK, AN });
    check('7 thèmes de bouton appliqués', r.skins.every(Boolean), r.skins);
    check('7 animations d\'ouverture appliquées', r.anims.every(Boolean), r.anims);
    check('valeurs inconnues : métal + éventail', r.unknown.includes('anim-fan'), r.unknown);
    // Position finale identique pour toutes les animations
    await t.page.evaluate((AN) => AN.forEach((k) => document.getElementById(`a-${k}`)._toggle()), AN);
    await t.page.waitForTimeout(1800);
    const pos = await t.page.evaluate((AN) => AN.map((k) => {
      const s = window.sr(`a-${k}`);
      const sel = s.querySelector('.selector').getBoundingClientRect();
      return [...s.querySelectorAll('li .icon ha-icon')].map((i) => {
        const b = i.getBoundingClientRect();
        return [b.left + b.width / 2 - sel.left, b.top + b.height / 2 - sel.top, Number(getComputedStyle(i.closest('li')).opacity)];
      });
    }), AN);
    const ref = pos[0];
    const worst = Math.max(...pos.map((list) => Math.max(...list.map((p, j) => Math.hypot(p[0] - ref[j][0], p[1] - ref[j][1])))));
    check('animations : même position finale que l\'éventail', worst < 1.5, worst);
    check('animations : icônes entièrement visibles', pos.every((list) => list.every((p) => p[2] > 0.99)));
    const cs = await t.page.evaluate(() => ['border_only', 'standard', 'background_only', 'transparent'].map((k) => {
      window.mk('s-metal', { card_style: k, card_background: '#123456', card_border_color: '#abcdef' });
      return window.sr('s-metal').querySelector('ha-card').getAttribute('style');
    }));
    check('apparence de la carte : contour seul par défaut', cs[0].includes('--ha-card-background:transparent') && cs[0].includes('--ha-card-border-color:#abcdef'), cs[0]);
    check('apparence : fond + contour', cs[1].includes('--ha-card-background:#123456') && !cs[1].includes('border-width'), cs[1]);
    check('apparence : fond seul / transparente', cs[2].includes('--ha-card-border-width:0px') && cs[3].includes('transparent') && cs[3].includes('border-width:0px'), cs.slice(2));
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
    const t2 = await h.open(browser, h.cards(['r']), { reduce: true });
    const red = await t2.page.evaluate(() => window.mk('r', { open_animation: 'spiral' }).shadowRoot.querySelector('.selector').className);
    check('« réduire les animations » : fondu', red.includes('anim-fade'), red);
    await t2.close();
  }

  group('Souris');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await page.evaluate(() => window.mk('a', { auto_close: 0 }));
    const g = await h.geo(page, 'a');
    await page.mouse.click(g.cx, g.cy);
    await page.waitForTimeout(700);
    const open = await page.evaluate(() => ({ cls: window.sr('a').querySelector('.selector').className, aria: window.sr('a').querySelector('.knob').getAttribute('aria-expanded') }));
    check('clic sur le bouton : ouverture', open.cls.includes('active') && open.aria === 'true', open);
    let p = h.at(g, 2, 1.9, 12);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(100);
    const hov = await page.evaluate(() => {
      const s = window.sr('a');
      return { zone: [...s.querySelectorAll('.zone')].findIndex((z) => z.classList.contains('hot')), lit: [...s.querySelectorAll('li')].findIndex((l) => l.classList.contains('lit')), angle: s.querySelector('.selector').style.getPropertyValue('--rsc-knob-angle') };
    });
    check('survol (hors icône) : zone et icône éclairées, pointeur orienté', hov.zone === 2 && hov.lit === 2 && hov.angle === '30deg', hov);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);
    let c = await h.calls(page);
    check('clic dans la zone : bascule de l\'entité', c.length === 1 && c[0].service === 'toggle' && c[0].data.entity_id === 'light.salle_a_manger', c);
    // Appui long + rotation : variateur
    await h.clearCalls(page);
    p = h.at(g, 0, 1.9, 0);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    const d0 = await page.evaluate(() => ({ cls: window.sr('a').querySelector('.selector').className, pct: window.sr('a').querySelector('.pct').textContent }));
    check('appui long : variateur affiché avec la luminosité actuelle', d0.cls.includes('dimming') && d0.pct === '50%', d0);
    for (let a = 0; a <= 54; a += 6) { const q = h.at(g, 0, 1.9, a); await page.mouse.move(q.x, q.y); }
    await page.waitForTimeout(250);
    const d1 = await page.evaluate(() => ({ pct: window.sr('a').querySelector('.pct').textContent, lvl: window.sr('a').querySelector('li .lvl').textContent }));
    await page.mouse.up();
    await page.waitForTimeout(150);
    c = await h.calls(page);
    const last = c.filter((x) => x.service === 'turn_on').pop();
    check('rotation de 54° : +20 %', d1.pct === '70%' && d1.lvl === '70%', d1);
    check('luminosité envoyée (dernier envoi = 70 %)', last && last.data.brightness_pct === 70 && last.data.entity_id === 'light.salon', c);
    check('pas de bascule après l\'appui long', !c.some((x) => x.service === 'toggle'), c);
    check('variateur fermé au relâchement', !(await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('dimming'))));
    // Molette sur une lumière éteinte
    await h.clearCalls(page);
    p = h.at(g, 1, 1.9, 0);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(1100);
    c = await h.calls(page);
    check('molette (+1 cran) sur une lumière éteinte : 5 %', c.length === 1 && c[0].data.brightness_pct === 5 && c[0].data.entity_id === 'light.cuisine', c);
    // Rotation jusqu'à 0 : extinction
    await h.clearCalls(page);
    p = h.at(g, 4, 1.9, 0);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    for (let a = 0; a >= -200; a -= 8) { const q = h.at(g, 4, 1.9, a); await page.mouse.move(q.x, q.y); }
    await page.mouse.up();
    await page.waitForTimeout(150);
    c = await h.calls(page);
    check('rotation jusqu\'à 0 % : extinction', c.length && c[c.length - 1].service === 'turn_off' && c[c.length - 1].data.entity_id === 'light.escalier', c.slice(-2));
    // Appui long sur une lumière on/off : fenêtre d'infos
    await h.clearCalls(page);
    p = h.at(g, 3, 1.9, 0);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    const ev = await page.evaluate(() => window.__events);
    check('appui long sur une lumière on/off : fenêtre d\'infos', ev.some((e) => e.type === 'more-info' && e.entity === 'light.bureau'), ev);
    // Fermeture
    await page.mouse.click(g.cx, g.cy);
    await page.waitForTimeout(150);
    check('clic sur le bouton : fermeture', !(await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'))));
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Doigt');
  {
    const t = await h.open(browser, h.cards(['a']), { touch: true });
    const { page, touch } = t;
    await page.evaluate(() => window.mk('a', { auto_close: 0 }));
    const g = await h.geo(page, 'a');
    await page.evaluate(() => document.getElementById('a')._toggle());
    await page.waitForTimeout(700);
    // Glisser du bouton vers une entrée puis lever
    await touch.down(g.cx, g.cy);
    for (let f = 0.2; f <= 1.9; f += 0.2) { const q = h.at(g, 4, f); await touch.move(q.x, q.y); }
    await page.waitForTimeout(50);
    const hov = await page.evaluate(() => [...window.sr('a').querySelectorAll('.zone')].findIndex((z) => z.classList.contains('hot')));
    await touch.up();
    await page.waitForTimeout(100);
    let c = await h.calls(page);
    check('glisser le doigt : la zone suit le doigt', hov === 4, hov);
    check('lever le doigt sur une entrée : bascule', c.length === 1 && c[0].data.entity_id === 'light.escalier', c);
    // Appui simple au doigt sur une icône : rien ne reste éclairé ensuite
    await h.clearCalls(page);
    const ic = h.at(g, 1, 1.25);
    await touch.down(ic.x, ic.y);
    await touch.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ hot: window.sr('a').querySelectorAll('.zone.hot').length, hover: document.getElementById('a')._hover }));
    c = await h.calls(page);
    check('appui simple au doigt sur une icône : 1 bascule, plus rien d\'éclairé ensuite', c.length === 1 && c[0].data.entity_id === 'light.cuisine' && after.hot === 0 && after.hover === null, { c, after });
    // Appui long au doigt : variateur
    await h.clearCalls(page);
    const p = h.at(g, 0, 1.9);
    await touch.down(p.x, p.y);
    await page.waitForTimeout(650);
    const dim = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('dimming'));
    for (let a = 0; a >= -27; a -= 3) { const q = h.at(g, 0, 1.9, a); await touch.move(q.x, q.y); }
    await touch.up();
    await page.waitForTimeout(200);
    c = await h.calls(page);
    check('appui long au doigt : variateur', dim);
    check('rotation au doigt (-27°) : -10 %', c.length && c[c.length - 1].data.brightness_pct === 40, c);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Clavier et réduction automatique');
  {
    const t = await h.open(browser, h.cards(['a', 'b']), { h: 900 });
    const { page } = t;
    await page.evaluate(() => { window.mk('a', { auto_close: 1 }); window.mk('b', { auto_close: 0 }); });
    await page.evaluate(() => window.sr('a').querySelector('.knob').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const opened = await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'));
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    let c = await h.calls(page);
    check('clavier : Entrée ouvre, Tab + Espace active la 1re entrée', opened && c.length === 1 && c[0].data.entity_id === 'light.salon', c);
    await h.clearCalls(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const kb = await page.evaluate(() => ({ calls: window.__calls.length, hot: [...window.sr('a').querySelectorAll('.zone')].findIndex((z) => z.classList.contains('hot')) }));
    check('clavier : les flèches déplacent sans rien activer (zone éclairée)', kb.calls === 0 && kb.hot === 2, kb);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    c = await h.calls(page);
    check('clavier : Entrée active l\'entrée choisie', c.length === 1 && c[0].data.entity_id === 'light.salle_a_manger', c);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    check('clavier : Échap ferme', !(await page.evaluate(() => window.sr('a').querySelector('.selector').classList.contains('active'))));
    await page.evaluate(() => { document.getElementById('a')._toggle(); document.getElementById('b')._toggle(); });
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ['a', 'b'].map((id) => window.sr(id).querySelector('.selector').classList.contains('active')));
    check('réduction automatique après 1 s ; 0 = jamais', st[0] === false && st[1] === true, st);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Boutons de coin et ligne de boutons');
  {
    const t = await h.open(browser, h.cards(['a']), { h: 600 });
    const { page } = t;
    await page.evaluate(() => window.mk('a', {
      extra_buttons: [{ icon: 'mdi:television', entity: 'media_player.tv', popup: '#tv' }, { icon: 'mdi:cctv', position: 'top-left', tap_action: { action: 'navigate', navigation_path: '/lovelace/cam' } }, { icon: 'mdi:power', tap_action: { action: 'all_off' } }],
      row_items: [{ entity: 'switch.prise', icon: 'mdi:power-plug' }, { entity: 'cover.volet', style: 'metal', color: '#ff9800' }],
    }));
    const pos = await page.evaluate(() => [...window.sr('a').querySelectorAll('.xbtn')].map((b) => b.className));
    check('coins : position auto puis choisie', pos[0].includes('bottom-right') && pos[1].includes('top-left') && pos[2].includes('bottom-left'), pos);
    await page.evaluate(() => window.sr('a').querySelectorAll('.xbtn')[0].click());
    await page.evaluate(() => window.sr('a').querySelectorAll('.xbtn')[1].click());
    const ev = await page.evaluate(() => window.__events.filter((e) => e.type === 'location-changed').map((e) => e.path));
    check('coins : pop-up (#tv) et vue', ev[0].endsWith('#tv') && ev[1] === '/lovelace/cam', ev);
    check('coins : adresse de la page mise à jour', await page.evaluate(() => location.pathname === '/lovelace/cam'));
    await page.evaluate(() => window.sr('a').querySelectorAll('.xbtn')[2].click());
    let c = await h.calls(page);
    check('coins : action « tout éteindre » (lumières du cercle allumées)', c.length === 1 && c[0].service === 'turn_off' && JSON.stringify(c[0].data.entity_id) === JSON.stringify(['light.salon', 'light.salle_a_manger', 'light.escalier']), c);
    await h.clearCalls(page);
    await page.evaluate(() => window.sr('a').querySelector('.rbtn').click());
    c = await h.calls(page);
    check('ligne : bascule par défaut', c.length === 1 && c[0].service === 'toggle' && c[0].data.entity_id === 'switch.prise', c);
    const on = await page.evaluate(() => [...window.sr('a').querySelectorAll('.rbtn')].map((b) => b.classList.contains('on')));
    check('ligne : voyants allumés', on[0] && on[1], on);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
