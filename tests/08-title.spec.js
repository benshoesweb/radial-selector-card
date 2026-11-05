// Nom de la carte en titre (show_title), sans doublon avec le libellé sous le cercle
module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Titre de la carte');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    const read = () => page.evaluate(() => {
      const el = document.getElementById('a');
      const s = el.shadowRoot;
      const title = s.querySelector('.title');
      const label = s.querySelector('.label');
      return {
        title: title ? title.textContent : null,
        titleShown: !!title && getComputedStyle(title).display !== 'none',
        titleFirst: !!title && title.nextElementSibling === s.querySelector('.stage'),
        label: label.textContent, labelShown: getComputedStyle(label).display !== 'none',
        rows: el.getGridOptions().rows, size: el.getCardSize(),
      };
    });

    await page.evaluate(() => window.mk('a', { name: 'Mon salon', auto_close: 0 }));
    const def = await read();
    check('par défaut : pas de titre (cartes existantes inchangées)', def.title === null && def.rows === 4, def);

    await page.evaluate(() => window.mk('a', { name: 'Mon salon', auto_close: 0, show_title: true }));
    const on = await read();
    check('show_title : le nom en titre, au-dessus du cercle', on.title === 'Mon salon' && on.titleShown && on.titleFirst, on);
    check('… une ligne de plus dans la grille', on.rows === 5 && on.size === 5, on);
    await page.evaluate(() => document.getElementById('a')._toggle());
    const open = await read();
    check('… toujours visible cercle ouvert', open.title === 'Mon salon' && open.titleShown, open);
    await page.evaluate(() => document.getElementById('a')._toggle());

    await page.evaluate(() => window.mk('a', { name: 'Mon salon', auto_close: 0, show_title: true, show_label: true }));
    const both = await read();
    await page.evaluate(() => document.getElementById('a')._toggle());
    const bothOpen = await read();
    check('titre + libellé : pas de doublon cercle fermé, entrée affichée cercle ouvert', both.title === 'Mon salon' && both.label === '' && bothOpen.label === 'Salon', { both, bothOpen });
    await page.evaluate(() => document.getElementById('a')._toggle());

    await page.evaluate(() => window.mk('a', { name: 'Mon salon', auto_close: 0, show_label: true }));
    const lab = await read();
    check('sans titre : le libellé affiche toujours le nom, cercle fermé', lab.title === null && lab.label === 'Mon salon' && lab.labelShown, lab);

    await page.evaluate(() => window.mk('a', { name: '', auto_close: 0, show_title: true }));   // mk() met « Éclairage » par défaut
    const noname = await read();
    check('show_title sans nom : pas de titre vide', noname.title === null && noname.rows === 4, noname);

    await page.evaluate(() => window.mk('a', { name: '<b>Salon & cuisine</b>', auto_close: 0, show_title: true }));
    const escd = await read();
    check('nom affiché tel quel (pas de HTML interprété)', escd.title === '<b>Salon & cuisine</b>', escd);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Éditeur : titre');
  {
    const t = await h.open(browser, '<div id="host" style="width:620px"></div>', { w: 700, h: 900 });
    const { page } = t;
    const r = await page.evaluate(() => {
      const ed = document.createElement('radial-selector-card-editor');
      document.getElementById('host').appendChild(ed);
      const log = [];
      ed.addEventListener('config-changed', (e) => { log.push(e.detail.config); ed.setConfig(e.detail.config); });
      ed.hass = window.makeHass();
      ed.setConfig({ type: 'custom:radial-selector-card', name: 'Mon salon', items: [{ entity: 'light.salon' }, { entity: 'light.cuisine' }] });
      const $ = (q) => ed.shadowRoot.querySelector(q);
      const box = $('[data-list="__top"] [data-field="show_title"]');
      const label = box.closest('label').textContent.trim();
      const first = $('.switches input').getAttribute('data-field');
      box.checked = true; box.dispatchEvent(new Event('change'));
      const a = log[log.length - 1].show_title;
      const box2 = $('[data-list="__top"] [data-field="show_title"]');
      box2.checked = false; box2.dispatchEvent(new Event('change'));
      const hint = [...ed.shadowRoot.querySelectorAll('.section')][0].querySelector('.hint').textContent;
      return { label, first, a, b: 'show_title' in log[log.length - 1], hint };
    });
    check('case « Afficher le nom en titre », en premier', r.label === 'Afficher le nom en titre en haut de la carte' && r.first === 'show_title', r);
    check('cochée : show_title: true ; décochée : clé retirée', r.a === true && r.b === false, r);
    check('indication sur l\'affichage du nom', r.hint.includes('en titre') && r.hint.includes('sous le cercle fermé'), r);
    check('éditeur : aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
