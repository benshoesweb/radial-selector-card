// Noms des entités : comme Home Assistant (hass.formatEntityName depuis 2026.11), repli friendly_name
const ITEMS = [
  { entity: 'light.salon', icon: 'mdi:sofa' },
  { entity: 'light.cuisine', icon: 'mdi:stove', name: 'Ma cuisine' },
  { entity: 'light.bureau', icon: 'mdi:desk' },
];

module.exports = async (browser, h) => {
  const { check, group } = h;

  group('Noms des entités');
  {
    const t = await h.open(browser, h.cards(['a']));
    const { page } = t;
    // hass de HA 2026.11 : nom de l'appareil puis de l'entité ; « Bureau » sans friendly_name
    const run = (mode) => page.evaluate(({ items, mode }) => {
      const base = window.makeHass();
      const states = { ...base.states, 'light.bureau': { state: 'off', attributes: { supported_color_modes: ['onoff'] } } };
      const fmt = {
        modern: (st) => ({ 'light.salon': 'Séjour Plafonnier', 'light.cuisine': 'Cuisine Suspension', 'light.bureau': 'Bureau Lampe' })[st.entity_id],
        throws: () => { throw new Error('ancienne interface'); },
        empty: () => '',
      }[mode];
      // entity_id dans l'état, comme dans Home Assistant
      Object.keys(states).forEach((id) => { states[id] = { entity_id: id, ...states[id] }; });
      const hass = { ...base, states, ...(fmt ? { formatEntityName: fmt } : {}) };
      const el = document.getElementById('a');
      el.setConfig({ type: 'custom:radial-selector-card', show_label: true, auto_close: 0, items, extra_buttons: [{ entity: 'light.salon', icon: 'mdi:sofa' }] });
      el.hass = hass;
      if (!el._open) el._toggle();   // même configuration d'un essai à l'autre : le cercle reste ouvert
      const s = el.shadowRoot;
      return {
        names: items.map((it) => el._getEntityName(it)),
        aria: [...s.querySelectorAll('li input[type="radio"]')].map((r) => r.getAttribute('aria-label')),
        label: s.querySelector('.label').textContent,
        corner: s.querySelector('.xbtn').getAttribute('title'),
      };
    }, { items: ITEMS, mode });

    const m = await run('modern');
    check('HA 2026.11 : noms de hass.formatEntityName (appareil + entité)', JSON.stringify(m.names) === JSON.stringify(['Séjour Plafonnier', 'Ma cuisine', 'Bureau Lampe']), m);
    check('… nom choisi dans la carte (name) prioritaire', m.names[1] === 'Ma cuisine', m);
    check('… repris pour les lecteurs d\'écran, le libellé et l\'infobulle des boutons', JSON.stringify(m.aria) === JSON.stringify(m.names) && m.label === 'Séjour Plafonnier' && m.corner === 'Séjour Plafonnier', m);
    const old = await run('none');
    check('HA plus ancien : friendly_name, puis entity_id', JSON.stringify(old.names) === JSON.stringify(['Salon', 'Ma cuisine', 'light.bureau']) && old.label === 'Salon', old);
    const thr = await run('throws');
    check('formatEntityName en erreur : repli sans planter', JSON.stringify(thr.names) === JSON.stringify(['Salon', 'Ma cuisine', 'light.bureau']), thr);
    const emp = await run('empty');
    check('formatEntityName vide : repli sur friendly_name', emp.names[0] === 'Salon' && emp.names[2] === 'light.bureau', emp);
    check('aucune erreur JS', t.errors.length === 0, t.errors);
    await t.close();
  }
};
