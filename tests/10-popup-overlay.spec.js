// Pop-up par-dessus le tableau de bord (Bubble Card…) : la carte entière passe sous son fond flou
module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Sous le fond flou d\'une pop-up');
  {
    // Comme Bubble Card : un fond fixe, flouté, au-dessus du tableau de bord (z-index 4), puis la pop-up
    const body = `${h.cards(['a'])}
      <div id="backdrop" style="position:fixed;inset:0;z-index:4;backdrop-filter:blur(10px);background:rgb(0 0 0 / .3)"></div>
      <div id="popup" style="position:fixed;left:20px;right:20px;top:20px;height:120px;z-index:5;background:#333"></div>`;
    const t = await h.open(browser, body, { w: 440, h: 700 });
    const { page } = t;
    const r = await page.evaluate(() => {
      const el = window.mk('a', { auto_close: 0, extra_buttons: [
        { entity: 'light.salon', icon: 'mdi:leaf', position: 'bottom_left' },
        { entity: 'media_player.tv', icon: 'mdi:television', position: 'bottom_right' },
        { entity: 'light.cuisine', icon: 'mdi:stove', position: 'top_left' },
      ] });
      const s = el.shadowRoot;
      const top = (q) => [...s.querySelectorAll(q)].map((b) => {
        const rc = b.getBoundingClientRect();
        const hit = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
        return hit ? (hit.id || hit.tagName.toLowerCase()) : null;
      });
      const knob = s.querySelector('.knob').getBoundingClientRect();
      const knobHit = document.elementFromPoint(knob.left + knob.width / 2, knob.top + knob.height / 2);
      return { corners: top('.xbtn'), knob: knobHit && (knobHit.id || knobHit.tagName.toLowerCase()), isolation: getComputedStyle(s.querySelector('ha-card')).isolation };
    });
    check('boutons de coin sous le fond de la pop-up (floutés avec le reste) ou sous la pop-up, jamais par-dessus', r.corners.length === 3 && r.corners.every((x) => x === 'backdrop' || x === 'popup'), r);
    check('… comme le bouton central et le reste de la carte', r.knob === 'backdrop', r);
    check('les z-index restent dans la carte (isolation)', r.isolation === 'isolate', r);
    // Sans pop-up : les boutons de coin restent cliquables, au-dessus du cercle
    const r2 = await page.evaluate(() => {
      document.getElementById('backdrop').remove(); document.getElementById('popup').remove();
      const s = document.getElementById('a').shadowRoot;
      const b = s.querySelector('.xbtn'); const rc = b.getBoundingClientRect();
      const inner = s.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
      return { onTop: !!inner && (inner === b || b.contains(inner)) };
    });
    check('sans pop-up : les boutons de coin restent au-dessus du cercle, cliquables', r2.onTop, r2);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
