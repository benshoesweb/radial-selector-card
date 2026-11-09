// Voyant du bouton fermé : couleur stable au repos sur écran tactile (pas de « survol collant »)
// Les téléphones gardent l'état :hover sur le dernier élément touché ; on l'impose ici avec Chrome DevTools.
module.exports = async (browser, h) => {
  const { check, group } = h;
  const knobColor = (page) => page.evaluate(() => {
    const k = document.getElementById('a').shadowRoot.querySelector('.knob');
    return getComputedStyle(k, '::after').backgroundImage;
  });
  // Impose (ou retire) l'état :hover sur le bouton central, comme un doigt resté « posé » dessus
  const forceHover = async (t, on) => {
    // Une seule session DevTools par page : l'état imposé lui appartient
    if (!t.cdp) {
      t.cdp = await t.ctx.newCDPSession(t.page);
      await t.cdp.send('DOM.enable');
      await t.cdp.send('CSS.enable');
    }
    const cdp = t.cdp;
    // Le bouton est cherché une seule fois : DOM.getDocument renumérote les éléments à chaque appel
    if (!t.knobId) {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
      const find = (n) => {
        if (n.attributes) {
          for (let i = 0; i < n.attributes.length; i += 2) {
            if (n.attributes[i] === 'class' && n.attributes[i + 1].split(' ').includes('knob')) return n;
          }
        }
        for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) { const f = find(c); if (f) return f; }
        return null;
      };
      t.knobId = find(root).nodeId;
    }
    const knob = { nodeId: t.knobId };
    await cdp.send('CSS.forcePseudoState', { nodeId: knob.nodeId, forcedPseudoClasses: on ? ['hover'] : [] });
    await t.page.waitForTimeout(450);
  };

  group('Voyant sur téléphone : même couleur au repos');
  {
    const t = await h.open(browser, h.cards(['a']), { w: 412, h: 800, mobile: true });
    const { page } = t;
    const media = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    check('téléphone simulé : pas de survol (hover: none)', media === false, media);
    await page.evaluate(() => window.mk('a', { auto_close: 0, show_count: false }));
    await page.waitForTimeout(300);
    const rest = await knobColor(page);
    await forceHover(t, true);
    const stuck = await knobColor(page);
    check('« survol » resté après un appui (comme sur un vrai téléphone) : le voyant garde sa couleur de repos', stuck === rest, { rest, stuck });
    await page.evaluate(() => document.getElementById('a')._toggle());
    await page.waitForTimeout(500);
    const opened = await knobColor(page);
    check('cercle ouvert : le voyant prend la couleur de l\'entrée choisie', opened !== rest, { rest, opened });
    await page.evaluate(() => document.getElementById('a')._toggle());
    await page.waitForTimeout(500);
    check('cercle refermé : couleur de repos', (await knobColor(page)) === rest);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }

  group('Voyant avec une souris : survol conservé');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    await page.evaluate(() => window.mk('a', { auto_close: 0, show_count: false }));
    await page.waitForTimeout(300);
    const rest = await knobColor(page);
    await forceHover(t, true);
    const hover = await knobColor(page);
    await forceHover(t, false);
    const back = await knobColor(page);
    check('souris sur le bouton : le voyant prend la couleur de l\'entrée choisie', hover !== rest, { rest, hover });
    check('souris partie : couleur de repos', back === rest, { rest, back });
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
