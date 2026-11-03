/*
 * radial-selector-card — sélecteur rotatif pour Home Assistant (v5)
 *
 * Fonctionnalités incluses :
 *   - Éditeur visuel intégré (composants natifs HA <ha-entity-picker>, <ha-icon-picker>)
 *     qui conserve toutes les autres clés de la configuration (grid_options, visibility, card_mod…)
 *   - Entités dans le cercle (items : 2 à 10), couleur au choix par entrée (color, sinon arc-en-ciel)
 *   - Entités en ligne en dessous (row_items) : style tile/metal, action, couleurs
 *   - Boutons dans les coins (extra_buttons, 4 max) : coin, style, action / pop-up, couleurs
 *   - Réduction automatique (auto_close)
 *   - Apparence de la carte (card_style, card_background, card_border_color)
 *
 * Options de couleur (boutons en ligne et de coin) :
 *   color       couleur « allumé » (défaut #a3be8c)
 *   off_color   couleur « éteint » (style tile : défaut #bf616a ; style métal : icône du thème si absent)
 *   background  fond de la tuile (style tile, défaut #434c5e)
 * Style du bouton :
 *   knob_theme        metal (défaut) | ha (suit le thème Home Assistant actif) | glass (verre dépoli)
 *                     | neumorph (doux, relief mat) | brass (laiton vintage) | carbon | neon
 *   open_animation    fan (éventail, défaut) | bloom (éclosion) | spiral | cascade | pop (rebond)
 *                     | fade (fondu) | none — « réduire les animations » du système => fondu
 *   palette           rainbow (défaut, arc-en-ciel) | theme (couleur principale du thème HA)
 *                     pour les entrées du cercle sans couleur choisie
 *   show_brightness   true (défaut) : petit % sous l'icône des lumières variables allumées ; false = masqué
 *   zone_opacity      0–100 (défaut 80) : intensité du remplissage de la zone tactile éclairée.
 *                     Un secteur par entrée, séparé par un trait ; il se remplit de la couleur de
 *                     l'entrée uniquement sous la souris ou le doigt. 0 = jamais rempli (zones toujours
 *                     actives). Appui, appui long et variateur fonctionnent dans toute la zone.
 * Apparence de la carte :
 *   card_style        border_only (défaut : contour sans fond) | standard (fond + contour)
 *                     | background_only (fond sans contour) | transparent (ni fond ni contour)
 *   card_background   couleur de fond (standard / background_only)
 *   card_border_color couleur du contour (standard / border_only)
 */
(() => {
  const TAG = 'radial-selector-card';
  // Remplacé par le numéro de version (tag GitHub) lors de la publication d'une release
  const VERSION = '__VERSION__';
  console.info(`%c RADIAL-SELECTOR-CARD %c ${VERSION} `,
    'color:#fff;background:#5e81ac;font-weight:700;border-radius:3px 0 0 3px',
    'color:#5e81ac;background:#eceff4;border-radius:0 3px 3px 0');
  const EDITOR_TAG = 'radial-selector-card-editor';

  // Enregistrement des propriétés CSS au niveau du document pour le Shadow DOM
  const registerProps = () => {
    if (!window.CSS || !CSS.registerProperty) return;
    const reg = (name, syntax, initialValue) => {
      try { CSS.registerProperty({ name, syntax, inherits: true, initialValue }); } catch (e) { /* déjà déclarée */ }
    };
    reg('--rsc-icon-offset', '<number>', '0');
    reg('--rsc-selector-width', '<number>', '100');
    reg('--rsc-border-width', '<number>', '0');
    reg('--rsc-item-opacity', '<number>', '0');
    reg('--rsc-is-selected', '<number>', '0');
    reg('--rsc-accent-on', '<color>', 'rgb(0 0 0)');
    reg('--rsc-accent-on-darker', '<color>', 'rgb(0 0 0)');
    reg('--rsc-knob-on', '<color>', 'rgb(0 0 0)');
    reg('--rsc-knob-on-darker', '<color>', 'rgb(0 0 0)');
    reg('--rsc-knob-glow', '<color>', 'rgb(0 0 0)');
    reg('--rsc-ring-on', '<color>', 'rgb(0 0 0)');
    reg('--rsc-ring-on-darker', '<color>', 'rgb(0 0 0)');
    reg('--rsc-is-active', '<number>', '0');
    reg('--rsc-dim', '<number>', '0');
  };
  registerProps();

  const ON_STATES = ['on', 'open', 'opening', 'playing', 'unlocked', 'cleaning', 'heat', 'cool', 'heat_cool', 'home'];
  const OFF_STATES = ['off', 'standby', 'unavailable', 'unknown'];
  const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  const CARD_STYLES_LIST = ['border_only', 'standard', 'background_only', 'transparent'];
  // Thèmes du bouton (knob_theme) et animations d'ouverture (open_animation) ; le 1er est le défaut
  const SKINS = ['metal', 'ha', 'glass', 'neumorph', 'brass', 'carbon', 'neon'];
  const ANIMS = ['fan', 'bloom', 'spiral', 'cascade', 'pop', 'fade', 'none'];

  // Valeur CSS de couleur sûre pour un attribut style (pas de ; ni de guillemets)
  const cssColor = (v) => String(v ?? '').replace(/[;"'<>{}]/g, '').trim();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const CARD_STYLES = `
    :host { display: block; }
    /* Le fond et le contour viennent de ha-card (thème HA), réglés par card_style via
       --ha-card-background / --ha-card-border-width / --ha-card-border-color / --ha-card-box-shadow */
    ha-card {
      overflow: hidden;
      transition: background 0.2s ease;
    }

    .wrap {
      container-type: inline-size;
      padding: 8px 0 10px;

      --rsc-bg: var(--rsc-scene-bg, var(--ha-card-background, var(--card-background-color, hsl(307 4% 94%))));
      --rsc-grey: hsl(0 0% 87%);
      --rsc-dark-grey: hsl(0 0% 95.69%);
      --rsc-inner-bg: hsl(0 0% 90.98%);
      --rsc-outer-bg: hsl(223.81 0% 93%);
      --rsc-border-bg: hsl(0 0% 85%);
      --rsc-icon-color: #000;
      --rsc-pct-color: #1c1f26;
      --rsc-pct-shadow: 0 1px 0 rgb(255 255 255 / 0.55);
      --rsc-metal-dark: hsl(220 6% 60%);
      --rsc-metal-mid: hsl(220 6% 80%);
      --rsc-metal-light: hsl(220 10% 97%);
      --rsc-on-lightness: 42%;
      --rsc-accent-off: hsl(267 16% 43%);
      --rsc-accent-off-darker: hsl(258 29% 39%);
      --rsc-cubic: cubic-bezier(0.44, -0.9, 0.31, 1.55);
      --rsc-shadow:
        rgba(0, 0, 0, 0.125) 0px 0px 2px -0.5px,
        rgba(0, 0, 0, 0.125) 0px 1px 5px -1px,
        rgba(0, 0, 0, 0.125) 0px 4px 12px -1.5px,
        rgba(0, 0, 0, 0.125) 0px 9px 28px -2px,
        rgba(0, 0, 0, 0.125) 0px 24px 72px -2.5px;
    }
    .wrap.dark {
      --rsc-grey: hsl(0 0% 10%);
      --rsc-inner-bg: hsl(200 15% 10.98%);
      --rsc-outer-bg: hsl(200 19% 6%);
      --rsc-border-bg: hsl(200 10% 8%);
      --rsc-icon-color: #fff;
      --rsc-pct-color: #fff;
      --rsc-pct-shadow: 0 1px 2px rgb(0 0 0 / 0.7);
      --rsc-metal-dark: hsl(220 8% 11%);
      --rsc-metal-mid: hsl(220 8% 24%);
      --rsc-metal-light: hsl(220 10% 44%);
      --rsc-on-lightness: 66%;
    }

    .stage {
      --radius: 100px;
      position: relative;
      display: grid;
      place-items: center;
      width: 100%;
      height: calc(var(--radius) * 2.8);
    }
    @supports (width: 1cqw) {
      .stage { --radius: min(calc(100cqw / 2.8), 150px); }
    }

    .label {
      text-align: center;
      min-height: 1.4em;
      padding: 4px 12px 2px;
      font-size: 14px;
      font-weight: 500;
      color: var(--primary-text-color);
    }

    /* ---------- Sélecteur ---------- */
    .selector {
      --rsc-angle: -90deg;
      --rsc-angle-offset: 90deg;
      --rsc-is-active: 0;
      --rsc-dim: 0;
      --rsc-icon-opacity: 0.4;
      --rsc-icon-offset: 100;
      --rsc-knob-color: linear-gradient(to bottom, var(--rsc-accent-off), var(--rsc-accent-off-darker));
      --rsc-accent-on-code: var(--rsc-angle) 100% 72%;
      --rsc-accent-on-darker-code: var(--rsc-angle) 98% 61%;
      --rsc-accent-on: hsl(var(--rsc-accent-on-code) / 1);
      --rsc-accent-on-darker: hsl(var(--rsc-accent-on-darker-code) / 1);

      width: var(--radius);
      aspect-ratio: 1 / 1;
      position: relative;
      border-radius: 9999px;
      background: var(--rsc-dark-grey);
      box-shadow:
        inset rgba(0, 0, 0, 0.13) 0px 0px 2px -1px,
        inset rgba(0, 0, 0, 0.13) 0px 2px 8px -2px,
        inset rgba(0, 0, 0, 0.13) 0px 8px 34px -2px;
    }
    .selector *, .selector *::before, .selector *::after { box-sizing: border-box; }

    .knob {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      transform: rotate(var(--rsc-knob-rot, calc(var(--rsc-knob-angle, var(--rsc-angle)) + var(--rsc-angle-offset))));
      transition:
        transform 0.4s var(--rsc-cubic),
        --rsc-knob-on 0.3s ease,
        --rsc-knob-on-darker 0.3s ease,
        --rsc-knob-glow 0.3s ease;
      /* Couleur de la cible (entrée survolée, sinon sélectionnée) : --rsc-cur, posée par le JS */
      --rsc-knob-on: var(--rsc-cur, hsl(0 0% 72%));
      --rsc-knob-on-darker: var(--rsc-cur-d, hsl(0 0% 61%));
      --rsc-knob-glow: color-mix(in srgb, var(--rsc-cur, hsl(0 0% 72%)) 50%, transparent);
      z-index: 2;
      cursor: pointer;
      border-radius: 9999px;
      outline: none;
      -webkit-tap-highlight-color: transparent;
    }
    .knob::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      pointer-events: none;
      background: var(--rsc-knurl,
        radial-gradient(farthest-side, transparent 88%, rgb(0 0 0 / 0.55) 89%, transparent 91.5%),
        repeating-conic-gradient(rgb(0 0 0 / 0.3) 0 2deg, rgb(255 255 255 / 0.12) 2deg 4deg));
      -webkit-mask: radial-gradient(farthest-side, transparent 87.5%, #000 88%);
      mask: radial-gradient(farthest-side, transparent 87.5%, #000 88%);
    }
    .knob::after {
      content: "";
      display: block;
      position: absolute;
      width: 4%;
      min-width: 3px;
      height: 14%;
      top: calc(var(--radius) * 0.13);
      background: var(--rsc-knob-color);
      border-radius: 9999px;
      box-shadow:
        0 0 1px rgb(0 0 0 / 40%),
        0 0 2px 1px rgb(0 0 0 / 20%),
        inset 0 1px 2px var(--rsc-knob-on),
        inset 0 -1px 2px var(--rsc-knob-on-darker),
        0 0 calc(var(--rsc-is-active) * 4px) var(--rsc-knob-on),
        0 0 calc(var(--rsc-is-active) * 16px) var(--rsc-knob-glow);
    }
    .knob:active::after { transform: scale(0.95); }
    .knob:hover { --rsc-knob-color: linear-gradient(to top, var(--rsc-knob-on), var(--rsc-knob-on-darker)); }
    .knob:focus-visible::after { outline: 2px solid var(--primary-color); outline-offset: 2px; }

    .selector::after {
      content: "";
      display: block;
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      /* Face du bouton : --rsc-face / --rsc-face-shadow redéfinis par les thèmes, métal sinon */
      background: var(--rsc-face,
        radial-gradient(120% 90% at 30% 14%, rgb(255 255 255 / 0.3), transparent 55%),
        radial-gradient(circle at 50% 50%, transparent 60%, rgb(0 0 0 / 0.22) 100%),
        repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.05) 0 1px, rgb(0 0 0 / 0.05) 1px 2px),
        conic-gradient(
          from 30deg,
          var(--rsc-metal-dark) 0%,
          var(--rsc-metal-light) 10%,
          var(--rsc-metal-mid) 22%,
          var(--rsc-metal-dark) 35%,
          var(--rsc-metal-mid) 50%,
          var(--rsc-metal-light) 62%,
          var(--rsc-metal-mid) 78%,
          var(--rsc-metal-dark) 100%
        ));
      box-shadow: var(--rsc-face-shadow,
        inset 0 1px 1px rgb(255 255 255 / 0.5),
        inset 0 -2px 4px rgb(0 0 0 / 0.45),
        inset 0 0 0 1px rgb(0 0 0 / 0.3),
        0 calc(var(--radius) * 0.015) calc(var(--radius) * 0.03) rgb(0 0 0 / 0.5),
        0 calc(var(--radius) * 0.06) calc(var(--radius) * 0.16) rgb(0 0 0 / 0.35));
      transition: transform 0.15s ease, box-shadow 0.3s ease;
      transform: scale(1);
    }
    .selector:has(.knob:active)::after { transform: scale(0.95); }

    .selector.active {
      --rsc-is-active: 1;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      transition:
        --rsc-accent-on 0.3s ease 0.2s,
        --rsc-accent-on-darker 0.3s ease 0.2s;
    }
    .selector.active .knob {
      --rsc-knob-color: linear-gradient(to top, var(--rsc-knob-on), var(--rsc-knob-on-darker));
    }

    ul {
      --rsc-selector-width: 90;
      --rsc-border-width: 0;
      position: absolute;
      inset: 0;
      padding: 0;
      margin: 0;
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    ul::before, ul::after { content: ""; display: block; position: absolute; }

    ul::before {
      transition: --rsc-selector-width 0.3s ease;
      width: calc(var(--rsc-selector-width) * 1%);
      height: calc(var(--rsc-selector-width) * 1%);
      border-radius: 9999px;
      box-shadow:
        var(--rsc-shadow),
        0 calc(var(--radius) / -10) 120px calc(var(--radius) / 5) rgb(0 0 0 / 0.05);
      background: var(--rsc-inner-bg);
    }

    ul::after {
      --rsc-ring-on: color-mix(in srgb, var(--rsc-cur, hsl(0 0% 72%)) 60%, transparent);
      --rsc-ring-on-darker: color-mix(in srgb, var(--rsc-cur-d, hsl(0 0% 61%)) 60%, transparent);
      --rsc-shadow-width: calc(max(var(--rsc-is-active), 0) * calc(var(--radius) / 13));
      transition:
        --rsc-border-width 0.35s var(--rsc-cubic) 0.2s,
        --rsc-is-active 0.35s ease 0.2s,
        --rsc-ring-on 0.3s ease,
        --rsc-ring-on-darker 0.3s ease;
      width: calc(calc(100% + calc(var(--radius) / 9)) + calc(calc(var(--rsc-border-width) * 2) * 1px));
      height: calc(calc(100% + calc(var(--radius) / 9)) + calc(calc(var(--rsc-border-width) * 2) * 1px));
      border-radius: 9999px;
      box-shadow:
        0 0 calc(max(var(--rsc-is-active), 0) * 2px) var(--rsc-ring-on-darker),
        0 0 calc(max(var(--rsc-is-active), 0) * 6px) var(--rsc-ring-on),
        0 0 0 var(--rsc-shadow-width) var(--rsc-outer-bg),
        var(--rsc-shadow);
      background: var(--rsc-border-bg);
    }

    .selector.active ul {
      --rsc-selector-width: 260;
      --rsc-border-width: 13;
      --rsc-icon-offset: 7;
      --rsc-item-opacity: 1;
    }
    .selector.active ul::before {
      box-shadow:
        inset 0 0 10px rgb(0 0 0 / 0.2),
        rgba(0, 0, 0, 0.18) 0px 0px 1px -1px inset,
        rgba(0, 0, 0, 0.16) 0px 2px 5px -2px inset,
        rgba(0, 0, 0, 0.063) 0px 8px 24px -4px inset;
    }

    li {
      position: absolute;
      width: 25%;
      height: 120%;
      left: 0;
      right: 0;
      top: -70%;
      margin: auto;
      transform-origin: bottom center;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      opacity: var(--rsc-item-opacity);
      transition:
        transform 0.35s ease,
        --rsc-icon-offset 0.35s ease,
        --rsc-item-opacity 0.25s ease;
    }
    .selector.active li {
      transform: rotate(var(--rsc-rot));
      transition:
        transform 0.5s ease calc(var(--rsc-n) * 0.05s),
        --rsc-icon-offset 0.5s ease,
        --rsc-item-opacity 0.5s ease 0.2s;
    }
    li.hot { --rsc-is-selected: 1; --rsc-icon-opacity: 1; }

    li::before {
      content: "";
      display: block;
      position: absolute;
      width: 100%;
      aspect-ratio: 1 / 1;
      background: var(--rsc-c);
      box-shadow: 0 0 6px var(--rsc-cd);
      transform: translateY(175%) scaleX(1.5);
      filter: blur(12px) opacity(var(--rsc-is-selected)) saturate(2);
      transition: --rsc-is-selected 0.2s ease 0.1s;
      pointer-events: none;
    }

    .icon {
      position: absolute;
      left: 0;
      top: calc(var(--rsc-icon-offset) * 1%);
      width: 100%;
      aspect-ratio: 1 / 1;
      display: grid;
      place-items: center;
      pointer-events: none;
      opacity: var(--rsc-icon-opacity);
      color: var(--rsc-icon-color);
      transform: rotate(0deg);
      transition: transform 0.35s ease, color 0.3s ease, opacity 0.2s ease;
    }
    .icon ha-icon { --mdc-icon-size: calc(var(--radius) * 0.22); display: flex; }
    .selector.active .icon {
      transform: rotate(calc(var(--rsc-rot) * -1));
      transition: transform 0.5s ease calc(var(--rsc-n) * 0.05s), color 0.3s ease, opacity 0.2s ease;
    }
    li.on .icon {
      color: var(--rsc-ci);
      opacity: 1;
    }

    li > input[type="radio"] {
      all: unset;
      position: absolute;
      left: 0;
      top: calc(var(--rsc-icon-offset) * 1%);
      width: 100%;
      aspect-ratio: 1 / 1;
      cursor: pointer;
      border-radius: 50%;
    }
    li > input[type="radio"]:focus-visible { outline: 2px solid var(--primary-color); }
    .selector:not(.active) li > input[type="radio"] { pointer-events: none; }

    /* ---------- Zones tactiles : un secteur par entrée, de la couleur de l'entrée ---------- */
    .zones {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 260%;
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.6);
      transition: opacity 0.2s ease, transform 0.25s ease;
      /* uniquement dans la couronne : entre le liseré du bouton et le bord du disque */
      -webkit-mask: radial-gradient(closest-side, transparent calc(var(--radius) * 0.64 + 12px), #000 calc(var(--radius) * 0.64 + 24px), #000 calc(100% - 14px), transparent 100%);
      mask: radial-gradient(closest-side, transparent calc(var(--radius) * 0.64 + 12px), #000 calc(var(--radius) * 0.64 + 24px), #000 calc(100% - 14px), transparent 100%);
    }
    .selector.active .zones {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
      transition: opacity 0.35s ease 0.12s, transform 0.45s cubic-bezier(0.2, 1.2, 0.4, 1);
    }
    .selector.anim-fade .zones { transform: translate(-50%, -50%); }
    .selector.anim-none .zones { transition: none !important; }
    .zone {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .zone.hot { opacity: var(--rsc-zone-a-hot, 0.8); }
    /* Traits de séparation entre les zones (coupés au centre et au bord par le masque des zones) */
    .sep {
      position: absolute;
      left: 50%;
      bottom: 50%;
      width: 1.5px;
      height: 50%;
      margin-left: -0.75px;
      transform-origin: 50% 100%;
      background: var(--rsc-sep, color-mix(in srgb, var(--rsc-icon-color, #fff) 24%, transparent));
      border-radius: 1px;
    }
    /* Pourcentage des lumières variables allumées, en petit sous l'icône */
    .lvl {
      position: absolute;
      left: 50%;
      top: calc(50% + var(--radius) * 0.125);
      transform: translateX(-50%);
      display: none;
      font: 600 max(9px, calc(var(--radius) * 0.085)) / 1 Roboto, "Segoe UI", sans-serif;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      white-space: nowrap;
      color: inherit;
      opacity: 0.9;
      pointer-events: none;
    }
    li.has-lvl .lvl { display: block; }
    /* Icône lisible sur la zone éclairée */
    li.lit .icon {
      color: #fff;
      opacity: 1;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
    }
    .selector.active ul::before { cursor: pointer; }

    /* ---------- Variateur ---------- */
    .selector.dimming .knob {
      --rsc-knob-rot: calc(225deg + var(--rsc-dim) * 270deg);
      transition:
        transform 0.12s linear,
        --rsc-knob-on 0.3s ease,
        --rsc-knob-on-darker 0.3s ease,
        --rsc-knob-glow 0.3s ease;
    }
    .arc {
      --rsc-arc-color: var(--rsc-cur-i, hsl(0 0% 66%));
      position: absolute;
      left: 50%;
      top: 50%;
      width: calc(100% + var(--radius) / 9 + 32px);
      aspect-ratio: 1 / 1;
      transform: translate(-50%, -50%);
      z-index: 1;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease, --rsc-dim 0.12s linear;
    }
    .selector.dimming .arc { opacity: 1; }
    .arc-ring {
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      background: conic-gradient(
        from 225deg,
        var(--rsc-arc-color) 0deg calc(var(--rsc-dim) * 270deg),
        rgb(128 128 128 / 0.3) calc(var(--rsc-dim) * 270deg) 270deg,
        transparent 270deg 360deg
      );
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px));
    }
    .tick {
      position: absolute;
      inset: 0;
      transform: rotate(calc(225deg + var(--rsc-dim) * 270deg));
    }
    .tick::after {
      content: "";
      position: absolute;
      top: -1px;
      left: 50%;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 6px var(--rsc-arc-color), 0 0 0 1.5px var(--rsc-arc-color);
    }
    .pct {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: grid;
      place-items: center;
      pointer-events: none;
      font: 600 calc(var(--radius) * 0.17) / 1 Roboto, "Segoe UI", sans-serif;
      font-variant-numeric: tabular-nums;
      color: var(--rsc-pct-color);
      text-shadow: var(--rsc-pct-shadow);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .selector.dimming .pct { opacity: 1; }

    /* ---------- Boutons satellites (coins) ---------- */
    .frame {
      position: absolute;
      left: 50%;
      top: 50%;
      width: calc(var(--radius) * 2.8);
      height: calc(var(--radius) * 2.8);
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 5;
    }
    .xbtn, .rbtn {
      --rsc-xcolor: #a3be8c;
      --rsc-xbtn-shadow:
        inset 0 1px 1px rgb(255 255 255 / 0.5),
        inset 0 -2px 3px rgb(0 0 0 / 0.4),
        inset 0 0 0 1px rgb(0 0 0 / 0.3),
        0 2px 3px rgb(0 0 0 / 0.45),
        0 6px 14px rgb(0 0 0 / 0.3);
      --rsc-xsize: max(40px, calc(var(--radius, 100px) * 0.34));
      pointer-events: auto;
      width: var(--rsc-xsize);
      aspect-ratio: 1 / 1;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      cursor: pointer;
      display: grid;
      place-items: center;
      color: var(--rsc-icon-color);
      /* Même matière que le bouton principal (suit le thème choisi) */
      background: var(--rsc-face,
        radial-gradient(120% 90% at 30% 14%, rgb(255 255 255 / 0.3), transparent 55%),
        repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.05) 0 1px, rgb(0 0 0 / 0.05) 1px 2px),
        conic-gradient(from 30deg,
          var(--rsc-metal-dark) 0%, var(--rsc-metal-light) 22%, var(--rsc-metal-mid) 42%,
          var(--rsc-metal-dark) 60%, var(--rsc-metal-light) 80%, var(--rsc-metal-dark) 100%));
      box-shadow: var(--rsc-xbtn-shadow);
      transition: transform 0.12s ease, box-shadow 0.3s ease, color 0.3s ease;
      -webkit-tap-highlight-color: transparent;
      outline: none;
      position: relative;
    }
    .xbtn { position: absolute; }
    .xbtn ha-icon, .rbtn ha-icon {
      --mdc-icon-size: max(20px, calc(var(--radius, 100px) * 0.18));
      display: flex;
      transition: filter 0.3s ease;
    }
    .xbtn:active, .rbtn:active { transform: scale(0.93); }
    .xbtn:focus-visible, .rbtn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 3px; }
    .xbtn.on, .rbtn.on {
      color: var(--rsc-xcolor);
      box-shadow:
        var(--rsc-xbtn-shadow),
        0 0 0 2px color-mix(in srgb, var(--rsc-xcolor) 70%, transparent),
        0 0 12px color-mix(in srgb, var(--rsc-xcolor) 55%, transparent);
    }
    .wrap:not(.dark) .xbtn.on, .wrap:not(.dark) .rbtn.on { color: color-mix(in srgb, var(--rsc-xcolor) 62%, #000); }
    .xbtn.on ha-icon, .rbtn.on ha-icon { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--rsc-xcolor) 70%, transparent)); }

    @keyframes rsc-spin { to { transform: rotate(360deg); } }
    .xbtn.tile, .rbtn.tile {
      --rsc-xbg: #434c5e;
      --rsc-xoff: #bf616a;
      border-radius: calc(var(--rsc-xsize) * 0.22);
      background: var(--rsc-xbg);
      box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
      overflow: hidden;
      isolation: isolate;
    }
    .xbtn.tile.has-state, .rbtn.tile.has-state { color: var(--rsc-xoff); }
    /* Couleur « éteint » choisie pour un bouton métal */
    .xbtn.has-off:not(.on), .rbtn.has-off:not(.on) { color: var(--rsc-xoff); }
    .xbtn.tile::before, .rbtn.tile::before {
      content: "";
      position: absolute;
      left: -30%;
      top: -30%;
      width: 160%;
      height: 160%;
      z-index: 0;
      pointer-events: none;
      background: conic-gradient(from 0deg, transparent 0 55%, var(--rsc-xcolor) 100%);
      opacity: 0;
      transition: opacity 0.6s ease;
      animation: rsc-spin 6s linear infinite;
    }
    .xbtn.tile::after, .rbtn.tile::after {
      content: "";
      position: absolute;
      inset: 2px;
      border-radius: max(2px, calc(var(--rsc-xsize) * 0.22 - 2px));
      background: var(--rsc-xbg);
      z-index: 1;
      pointer-events: none;
    }
    .xbtn.tile ha-icon, .rbtn.tile ha-icon { position: relative; z-index: 2; --mdc-icon-size: calc(var(--rsc-xsize) * 0.55); }
    .xbtn.tile.on, .rbtn.tile.on,
    .wrap:not(.dark) .xbtn.tile.on, .wrap:not(.dark) .rbtn.tile.on { color: var(--rsc-xcolor); box-shadow: 0 2px 6px rgb(0 0 0 / 0.35); }
    .xbtn.tile.on::before, .rbtn.tile.on::before { opacity: 1; }
    .xbtn.tile.on ha-icon, .rbtn.tile.on ha-icon { filter: none; }
    @media (prefers-reduced-motion: reduce) {
      .xbtn.tile::before, .rbtn.tile::before { animation: none; background: var(--rsc-xcolor); }
    }
    .xbtn.bottom-right { right: calc(var(--radius) * 0.08); bottom: calc(var(--radius) * 0.08); }
    .xbtn.bottom-left  { left:  calc(var(--radius) * 0.08); bottom: calc(var(--radius) * 0.08); }
    .xbtn.top-right    { right: calc(var(--radius) * 0.08); top:    calc(var(--radius) * 0.08); }
    .xbtn.top-left     { left:  calc(var(--radius) * 0.08); top:    calc(var(--radius) * 0.08); }

    /* ---------- Ligne d'entités en dessous (row_items) ---------- */
    .bottom-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 12px;
      padding: 10px 16px 6px;
      margin-top: 4px;
      border-top: 1px solid rgb(128 128 128 / 0.15);
    }
    .bottom-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .rbtn {
      --rsc-xsize: 42px;
    }
    .rbtn ha-icon {
      --mdc-icon-size: 22px;
    }

    /* =====================================================================
     * THÈMES DU BOUTON (knob_theme) — classe skin-xxx sur .wrap
     * ===================================================================== */

    /* Thème Home Assistant : reprend les couleurs du thème actif (fond, cartes, texte, couleur principale) */
    .wrap.skin-ha {
      --rsc-inner-bg: var(--secondary-background-color, var(--primary-background-color, #f5f5f5));
      --rsc-border-bg: var(--primary-background-color, #fafafa);
      --rsc-outer-bg: var(--card-background-color, #ffffff);
      --rsc-dark-grey: var(--card-background-color, #ffffff);
      --rsc-icon-color: var(--primary-text-color, #212121);
      --rsc-pct-color: var(--primary-text-color, #212121);
      --rsc-pct-shadow: none;
      --rsc-accent-off: var(--primary-color, #03a9f4);
      --rsc-accent-off-darker: color-mix(in srgb, var(--primary-color, #03a9f4) 72%, #000);
      --rsc-face:
        radial-gradient(120% 90% at 30% 14%, rgb(255 255 255 / 0.1), transparent 55%),
        radial-gradient(circle at 50% 35%,
          color-mix(in srgb, var(--card-background-color, #fff) 90%, #fff) 0%,
          var(--card-background-color, #fff) 62%,
          color-mix(in srgb, var(--card-background-color, #fff) 86%, #000) 100%);
      --rsc-face-shadow:
        0 0 0 1px var(--divider-color, rgb(0 0 0 / 0.12)),
        0 0 0 3px color-mix(in srgb, var(--primary-color, #03a9f4) 22%, transparent),
        0 4px 14px rgb(0 0 0 / 0.28);
      --rsc-knurl: none;
      --rsc-shadow: 0 2px 10px rgb(0 0 0 / 0.16), 0 10px 30px rgb(0 0 0 / 0.12);
    }
    .wrap.skin-ha .xbtn, .wrap.skin-ha .rbtn {
      --rsc-xbtn-shadow: 0 0 0 1px var(--divider-color, rgb(0 0 0 / 0.12)), 0 2px 6px rgb(0 0 0 / 0.25);
    }

    /* Verre dépoli : surfaces translucides et floutées (idéal sur un fond dégradé) */
    .wrap.skin-glass {
      --rsc-inner-bg: rgb(255 255 255 / 0.18);
      --rsc-border-bg: rgb(255 255 255 / 0.14);
      --rsc-outer-bg: rgb(255 255 255 / 0.1);
      --rsc-dark-grey: transparent;
      --rsc-face: linear-gradient(150deg, rgb(255 255 255 / 0.5), rgb(255 255 255 / 0.14) 55%, rgb(255 255 255 / 0.26));
      --rsc-face-shadow:
        inset 0 1px 1px rgb(255 255 255 / 0.75),
        inset 0 0 0 1px rgb(255 255 255 / 0.4),
        0 8px 24px rgb(0 0 0 / 0.22);
      --rsc-knurl: none;
      --rsc-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
      --rsc-accent-off: rgb(255 255 255 / 0.95);
      --rsc-accent-off-darker: rgb(255 255 255 / 0.7);
    }
    .wrap.skin-glass.dark {
      --rsc-inner-bg: rgb(255 255 255 / 0.09);
      --rsc-border-bg: rgb(255 255 255 / 0.07);
      --rsc-outer-bg: rgb(255 255 255 / 0.05);
      --rsc-face: linear-gradient(150deg, rgb(255 255 255 / 0.26), rgb(255 255 255 / 0.05) 55%, rgb(255 255 255 / 0.12));
    }
    .wrap.skin-glass ul::before,
    .wrap.skin-glass ul::after,
    .wrap.skin-glass .selector::after,
    .wrap.skin-glass .xbtn,
    .wrap.skin-glass .rbtn {
      -webkit-backdrop-filter: blur(14px) saturate(1.6);
      backdrop-filter: blur(14px) saturate(1.6);
    }
    .wrap.skin-glass ul::before { outline: 1px solid rgb(255 255 255 / 0.25); outline-offset: -1px; }
    .wrap.skin-glass .xbtn, .wrap.skin-glass .rbtn {
      --rsc-xbtn-shadow: inset 0 1px 1px rgb(255 255 255 / 0.6), inset 0 0 0 1px rgb(255 255 255 / 0.32), 0 4px 12px rgb(0 0 0 / 0.2);
    }

    /* Doux (neumorphique) : relief mat de la couleur des cartes du thème */
    .wrap.skin-neumorph {
      --rsc-neu: var(--card-background-color, #e4e8ee);
      --rsc-neu-l: color-mix(in srgb, var(--rsc-neu) 55%, #fff);
      --rsc-neu-d: color-mix(in srgb, var(--rsc-neu) 80%, #000);
      --rsc-inner-bg: var(--rsc-neu);
      --rsc-border-bg: var(--rsc-neu);
      --rsc-outer-bg: var(--rsc-neu);
      --rsc-dark-grey: var(--rsc-neu);
      --rsc-face: linear-gradient(145deg, color-mix(in srgb, var(--rsc-neu) 88%, #fff), color-mix(in srgb, var(--rsc-neu) 92%, #000));
      --rsc-face-shadow: -5px -5px 12px var(--rsc-neu-l), 6px 6px 14px var(--rsc-neu-d);
      --rsc-knurl: none;
      --rsc-shadow: -9px -9px 22px var(--rsc-neu-l), 10px 10px 24px var(--rsc-neu-d);
      --rsc-icon-color: color-mix(in srgb, var(--primary-text-color, #444) 70%, transparent);
      --rsc-pct-color: var(--primary-text-color, #333);
      --rsc-pct-shadow: none;
      --rsc-accent-off: var(--secondary-text-color, #8a94a6);
      --rsc-accent-off-darker: color-mix(in srgb, var(--secondary-text-color, #8a94a6) 75%, #000);
    }
    .wrap.skin-neumorph.dark {
      --rsc-neu-l: color-mix(in srgb, var(--rsc-neu) 90%, #fff);
      --rsc-neu-d: color-mix(in srgb, var(--rsc-neu) 45%, #000);
    }
    .wrap.skin-neumorph .xbtn, .wrap.skin-neumorph .rbtn {
      --rsc-xbtn-shadow: -3px -3px 8px var(--rsc-neu-l), 4px 4px 9px var(--rsc-neu-d);
    }

    /* Laiton vintage : bouton doré, couronne sombre et chaude */
    .wrap.skin-brass {
      --rsc-metal-dark: #6e4f1c;
      --rsc-metal-mid: #b98a3c;
      --rsc-metal-light: #f6d892;
      --rsc-inner-bg: #2b221b;
      --rsc-border-bg: #1f1813;
      --rsc-outer-bg: #16110d;
      --rsc-dark-grey: #2b221b;
      --rsc-icon-color: #e8d6ae;
      --rsc-pct-color: #2b1d08;
      --rsc-pct-shadow: 0 1px 0 rgb(255 236 190 / 0.6);
      --rsc-accent-off: #3d2b12;
      --rsc-accent-off-darker: #22170a;
      --rsc-on-lightness: 66%;
      --rsc-shadow: 0 6px 18px rgb(0 0 0 / 0.35), 0 18px 48px rgb(0 0 0 / 0.25);
    }

    /* Carbone : noir mat tressé, repère rouge */
    .wrap.skin-carbon {
      --rsc-metal-dark: #0c0d0f;
      --rsc-metal-mid: #1d1f24;
      --rsc-metal-light: #3a3d44;
      --rsc-inner-bg:
        repeating-linear-gradient(45deg, rgb(255 255 255 / 0.035) 0 3px, transparent 3px 6px),
        repeating-linear-gradient(-45deg, #17181c 0 3px, #101114 3px 6px);
      --rsc-border-bg: #0b0c0e;
      --rsc-outer-bg: #08090a;
      --rsc-dark-grey: #101114;
      --rsc-face:
        radial-gradient(120% 90% at 30% 14%, rgb(255 255 255 / 0.16), transparent 55%),
        repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 3px),
        radial-gradient(circle at 50% 40%, #26282e 0%, #0b0c0e 75%);
      --rsc-icon-color: #cfd3da;
      --rsc-pct-color: #ffffff;
      --rsc-pct-shadow: 0 1px 2px #000;
      --rsc-accent-off: #ff3b30;
      --rsc-accent-off-darker: #b3261e;
      --rsc-on-lightness: 66%;
    }

    /* Néon : fond nuit, bouton cerclé d'une lueur à la couleur de la cible */
    .wrap.skin-neon {
      --rsc-metal-dark: #05070d;
      --rsc-metal-mid: #10162a;
      --rsc-metal-light: #1d2747;
      --rsc-inner-bg: #0a0e19;
      --rsc-border-bg: #060912;
      --rsc-outer-bg: #04060c;
      --rsc-dark-grey: #060912;
      --rsc-face: radial-gradient(circle at 50% 40%, #151c2e 0%, #070a12 75%);
      --rsc-knurl: none;
      --rsc-icon-color: #8fa3c8;
      --rsc-pct-color: #e8fbff;
      --rsc-pct-shadow: 0 0 8px rgb(0 229 255 / 0.8);
      --rsc-accent-off: #00e5ff;
      --rsc-accent-off-darker: #00a8c0;
      --rsc-on-lightness: 66%;
    }
    .wrap.skin-neon .selector::after {
      box-shadow:
        0 0 0 2px var(--rsc-cur, #00e5ff),
        0 0 16px color-mix(in srgb, var(--rsc-cur, #00e5ff) 55%, transparent),
        inset 0 0 16px color-mix(in srgb, var(--rsc-cur, #00e5ff) 30%, transparent);
    }
    .wrap.skin-neon .selector ul::before,
    .wrap.skin-neon .selector.active ul::before {
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--rsc-cur, #00e5ff) 45%, transparent),
        0 0 26px color-mix(in srgb, var(--rsc-cur, #00e5ff) 18%, transparent),
        inset 0 0 30px rgb(0 0 0 / 0.6);
    }
    .wrap.skin-neon li.on .icon { filter: drop-shadow(0 0 4px currentColor); }
    .wrap.skin-neon .xbtn, .wrap.skin-neon .rbtn {
      --rsc-xbtn-shadow: 0 0 0 1px rgb(0 229 255 / 0.45), 0 0 10px rgb(0 229 255 / 0.25);
    }

    /* =====================================================================
     * ANIMATIONS D'OUVERTURE (open_animation) — classe anim-xxx sur .selector
     * « fan » (éventail) = comportement de base défini plus haut.
     * ===================================================================== */

    /* Éclosion : les icônes sortent du centre toutes ensemble, avec un léger rebond */
    .selector.anim-bloom li {
      transform: rotate(var(--rsc-rot)) scale(0.35);
      transition: transform 0.25s ease, --rsc-icon-offset 0.25s ease, --rsc-item-opacity 0.2s ease;
    }
    .selector.anim-bloom.active li {
      transform: rotate(var(--rsc-rot)) scale(1);
      transition:
        transform 0.55s cubic-bezier(0.2, 1.45, 0.4, 1),
        --rsc-icon-offset 0.55s cubic-bezier(0.2, 1.45, 0.4, 1),
        --rsc-item-opacity 0.3s ease 0.05s;
    }
    .selector.anim-bloom ul::before { transition: --rsc-selector-width 0.5s cubic-bezier(0.2, 1.45, 0.4, 1); }

    /* Spirale : les icônes tournent d'un demi-tour avant de se poser */
    .selector.anim-spiral li { transform: rotate(calc(var(--rsc-rot) - 240deg)); }
    .selector.anim-spiral .icon { transform: rotate(calc(240deg - var(--rsc-rot))); }
    .selector.anim-spiral.active li {
      transform: rotate(var(--rsc-rot));
      transition:
        transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1) calc(var(--rsc-n) * 0.04s),
        --rsc-icon-offset 0.8s cubic-bezier(0.25, 0.8, 0.25, 1),
        --rsc-item-opacity 0.4s ease 0.1s;
    }
    .selector.anim-spiral.active .icon {
      transform: rotate(calc(var(--rsc-rot) * -1));
      transition:
        transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1) calc(var(--rsc-n) * 0.04s),
        color 0.3s ease, opacity 0.2s ease;
    }

    /* Cascade : les icônes apparaissent une par une, dans le sens des aiguilles d'une montre */
    .selector.anim-cascade li {
      transform: rotate(var(--rsc-rot));
      transition: --rsc-icon-offset 0.2s ease, --rsc-item-opacity 0.15s ease;
    }
    .selector.anim-cascade.active li {
      transition:
        --rsc-icon-offset 0.45s cubic-bezier(0.3, 1.6, 0.5, 1) calc(var(--rsc-n) * 0.08s),
        --rsc-item-opacity 0.25s ease calc(var(--rsc-n) * 0.08s);
    }

    /* Rebond : éventail élastique, les icônes grossissent en arrivant */
    .selector.anim-pop.active li {
      transition:
        transform 0.65s cubic-bezier(0.34, 1.7, 0.5, 1) calc(var(--rsc-n) * 0.035s),
        --rsc-icon-offset 0.65s cubic-bezier(0.34, 1.7, 0.5, 1),
        --rsc-item-opacity 0.3s ease 0.1s;
    }
    .selector.anim-pop.active .icon {
      transition:
        transform 0.65s cubic-bezier(0.34, 1.7, 0.5, 1) calc(var(--rsc-n) * 0.035s),
        color 0.3s ease, opacity 0.2s ease;
    }
    .selector.anim-pop .icon ha-icon { transform: scale(0.3); transition: transform 0.2s ease; }
    .selector.anim-pop.active .icon ha-icon {
      transform: scale(1);
      transition: transform 0.5s cubic-bezier(0.34, 1.8, 0.5, 1) calc(var(--rsc-n) * 0.05s + 0.12s);
    }
    .selector.anim-pop ul::before { transition: --rsc-selector-width 0.45s cubic-bezier(0.34, 1.5, 0.5, 1); }

    /* Fondu : les icônes apparaissent sur place, sans mouvement */
    .selector.anim-fade li {
      --rsc-icon-offset: 7;
      transform: rotate(var(--rsc-rot));
      transition: --rsc-item-opacity 0.3s ease;
    }
    .selector.anim-fade.active li { transition: --rsc-item-opacity 0.35s ease 0.05s; }
    .selector.anim-fade ul::before { transition: --rsc-selector-width 0.25s ease; }

    /* Icônes droites dès le départ pour les animations sans rotation */
    .selector.anim-bloom .icon,
    .selector.anim-cascade .icon,
    .selector.anim-fade .icon,
    .selector.anim-none .icon {
      transform: rotate(calc(var(--rsc-rot) * -1));
      transition: color 0.3s ease, opacity 0.2s ease;
    }

    /* Aucune : ouverture instantanée */
    .selector.anim-none li { transform: rotate(var(--rsc-rot)); }
    .selector.anim-none ul::before,
    .selector.anim-none ul::after,
    .selector.anim-none li,
    .selector.anim-none .icon {
      transition: none !important;
    }
  `;

  // Normalise une entrée (accepte une string 'light.salon' ou un objet complet)
  const normalizeItem = (it, defaultStyle = null) => {
    if (typeof it === 'string') {
      return { entity: it, ...(defaultStyle ? { style: defaultStyle } : {}) };
    }
    if (it && typeof it === 'object') {
      return { ...(defaultStyle && !it.style ? { style: defaultStyle } : {}), ...it };
    }
    return null;
  };

  class RadialSelectorCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._open = false;
      this._selected = 0;
      this._suppressClick = false;
      this._dim = null;
      this._ptr = null;
      this._touch = null;
      this._mouse = null;      // appui souris en cours dans une zone
      this._lastTouch = 0;
      this._lastDrag = 0;
      this._autoClose = 10;
      this._closeTimer = null;
      this._armedAt = 0;
      this._uid = Math.random().toString(36).slice(2, 8);
    }

    connectedCallback() { if (this._open) this._armClose(); }
    disconnectedCallback() { clearTimeout(this._closeTimer); this._closeTimer = null; }

    static async getConfigElement() {
      if (!customElements.get('ha-entity-picker') || !customElements.get('ha-icon-picker')) {
        try {
          const helpers = await window.loadCardHelpers?.();
          if (helpers) {
            const entitiesCard = await helpers.createCardElement({ type: 'entities', entities: [] });
            if (entitiesCard?.constructor?.getConfigElement) {
              await entitiesCard.constructor.getConfigElement();
            }
          }
        } catch (e) { /* ignore */ }
      }
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig(hass) {
      // Si possible, part des vraies lumières de l'installation
      const lights = hass && hass.states ? Object.keys(hass.states).filter((e) => e.startsWith('light.')).slice(0, 6) : [];
      if (lights.length >= 2) {
        return { name: 'Éclairage', auto_close: 10, items: lights.map((entity) => ({ entity })) };
      }
      return {
        name: 'Éclairage',
        auto_close: 10,
        show_label: true,
        items: [
          { name: 'Séjour', icon: 'mdi:table-furniture', entity: 'light.sejour' },
          { name: 'Salon', icon: 'mdi:sofa', entity: 'light.salon' },
          { name: 'Cuisine', icon: 'mdi:silverware-fork-knife', entity: 'light.cuisine' },
          { name: 'Entrée', icon: 'mdi:door', entity: 'light.entree' },
          { name: 'Chambre', icon: 'mdi:bed', entity: 'light.chambre' },
          { name: 'Terrasse', icon: 'mdi:outdoor-lamp', entity: 'light.terrasse' },
        ],
        row_items: [
          { name: 'TV', icon: 'mdi:television', entity: 'media_player.tv', style: 'tile' },
          { name: 'Volets', icon: 'mdi:window-shutter', entity: 'cover.volets', style: 'tile' }
        ]
      };
    }

    setConfig(config) {
      if (!config) {
        throw new Error('radial-selector-card : configuration invalide.');
      }
      const rawItems = (config.items || config.circle_entities || []).map((it) => normalizeItem(it)).filter(Boolean);
      if (rawItems.length < 2 || rawItems.length > 10) {
        throw new Error('radial-selector-card : "items" (entités du cercle) doit contenir entre 2 et 10 entrées.');
      }

      // Boutons satellites dans les 4 coins (optionnel)
      const rawExtra = [].concat(config.extra_buttons || config.extra_button || []).map((b) => normalizeItem(b)).filter(Boolean);
      const taken = new Set(rawExtra.map((b) => b.position).filter((p) => POSITIONS.includes(p)));
      const xb = rawExtra.slice(0, POSITIONS.length).map((b) => {
        if (POSITIONS.includes(b.position)) return b;
        const free = POSITIONS.find((p) => !taken.has(p)) || 'bottom-right';
        taken.add(free);
        return { ...b, position: free };
      });

      // Entités en ligne en dessous (row_items / bottom_entities)
      const rawRow = [].concat(config.row_items || config.bottom_entities || []).map((b) => normalizeItem(b, config.row_style || 'tile')).filter(Boolean);

      this._config = {
        show_label: false,
        theme: 'auto',
        close_on_select: false,
        ...config,
        items: rawItems,
        extra_buttons: xb,
        row_items: rawRow,
      };

      const ac = config.auto_close === false ? 0 : Number(config.auto_close ?? 10);
      this._autoClose = Number.isFinite(ac) && ac >= 0 ? ac : 10;
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
      this._open = false;
      this._selected = 0;
      this._hover = null;
      this._build();
      if (this._hass) this.hass = this._hass;
    }

    getCardSize() {
      return this._config && this._config.row_items && this._config.row_items.length ? 5 : 4;
    }

    getGridOptions() {
      const hasRow = this._config && this._config.row_items && this._config.row_items.length > 0;
      return { columns: 6, rows: hasRow ? 5 : 4, min_columns: 3, min_rows: 3 };
    }

    _getEntityIcon(cfg, fallback = 'mdi:circle-outline') {
      if (cfg.icon) return cfg.icon;
      if (this._hass && cfg.entity && this._hass.states[cfg.entity]) {
        const attrs = this._hass.states[cfg.entity].attributes;
        if (attrs && attrs.icon) return attrs.icon;
      }
      return fallback;
    }

    _getEntityName(cfg, fallback = '') {
      if (cfg.name) return cfg.name;
      if (this._hass && cfg.entity && this._hass.states[cfg.entity]) {
        const attrs = this._hass.states[cfg.entity].attributes;
        if (attrs && attrs.friendly_name) return attrs.friendly_name;
      }
      return cfg.entity || fallback;
    }

    _build() {
      const c = this._config;
      const n = c.items.length;
      this._step = 360 / n;
      const size = Number(c.size);
      const stageStyle = size > 0 ? ` style="--radius:${size}px"` : '';

      this._colors = c.items.map((_, i) => this._itemColors(i));

      // Zones tactiles : un secteur de 360°/n par entrée, centré sur son icône, séparé des voisins
      // par un trait ; la zone se remplit de la couleur de l'entrée sous la souris ou le doigt
      const r2 = (x) => Math.round(x * 100) / 100;
      const S = this._step;
      const zoneOp = this._zoneOpacity();
      const zones = c.items.map((_, i) => `<div class="zone" style="--rsc-zc:${this._colors[i].c};background:conic-gradient(from ${r2(S * i - S / 2)}deg, transparent 0deg 0.4deg, var(--rsc-zc) 1.2deg ${r2(S - 1.2)}deg, transparent ${r2(S - 0.4)}deg)"></div>`).join('')
        + c.items.map((_, i) => `<div class="sep" style="transform:rotate(${r2(S * i - S / 2)}deg)"></div>`).join('');

      const lis = c.items.map((it, i) => `
        <li data-index="${i}" style="--rsc-n:${i + 1};--rsc-rot:${this._step * i}deg;--rsc-c:${this._colors[i].c};--rsc-cd:${this._colors[i].d};--rsc-ci:${this._colors[i].i}">
          <div class="icon"><ha-icon data-circle-icon="${i}" icon="${esc(this._getEntityIcon(it, 'mdi:lightbulb'))}"></ha-icon><span class="lvl" aria-hidden="true"></span></div>
          <input type="radio" name="rsc-${this._uid}" aria-label="${esc(this._getEntityName(it))}" ${i === 0 ? 'checked' : ''}>
        </li>`).join('');

      const btnVars = (b) => {
        const vars = [`--rsc-xcolor:${cssColor(b.color) || '#a3be8c'}`];
        if (b.off_color) vars.push(`--rsc-xoff:${cssColor(b.off_color)}`);
        if (b.background) vars.push(`--rsc-xbg:${cssColor(b.background)}`);
        return vars;
      };

      const xbtns = c.extra_buttons.map((b, j) => {
        const vars = btnVars(b);
        const cls = ['xbtn', b.position, b.style === 'tile' ? 'tile' : '', b.entity ? 'has-state' : '', b.off_color ? 'has-off' : ''].filter(Boolean).join(' ');
        return `
        <button class="${cls}" data-x="${j}" style="${vars.join(';')}" aria-label="${esc(this._getEntityName(b, 'Bouton'))}" title="${esc(this._getEntityName(b))}">
          <ha-icon data-x-icon="${j}" icon="${esc(this._getEntityIcon(b, 'mdi:power'))}"></ha-icon>
        </button>`;
      }).join('');

      const rbtns = c.row_items.map((b, k) => {
        const vars = btnVars(b);
        const cls = ['rbtn', b.style === 'tile' ? 'tile' : '', b.entity ? 'has-state' : '', b.off_color ? 'has-off' : ''].filter(Boolean).join(' ');
        return `
        <div class="bottom-item">
          <button class="${cls}" data-r="${k}" style="${vars.join(';')}" aria-label="${esc(this._getEntityName(b, 'Entité'))}" title="${esc(this._getEntityName(b))}">
            <ha-icon data-r-icon="${k}" icon="${esc(this._getEntityIcon(b, 'mdi:power'))}"></ha-icon>
          </button>
        </div>`;
      }).join('');

      const bottomRowHtml = c.row_items.length > 0
        ? `<div class="bottom-row">${rbtns}</div>`
        : '';

      this.shadowRoot.innerHTML = `
        <style>${CARD_STYLES}</style>
        <ha-card style="${this._cardStyle()}">
          <div class="wrap skin-${this._skin()}">
            <div class="stage"${stageStyle}>
              <div class="selector anim-${this._anim()}">
                <div class="knob" role="button" tabindex="0" aria-expanded="false" aria-label="${esc(c.name || 'Sélecteur')}"></div>
                <ul><div class="zones" aria-hidden="true" style="--rsc-zone-a-hot:${zoneOp}">${zones}</div>${lis}</ul>
                <div class="arc"><div class="arc-ring"></div><div class="tick"></div></div>
                <div class="pct"></div>
              </div>
              <div class="frame">${xbtns}</div>
            </div>
            <div class="label"></div>
            ${bottomRowHtml}
          </div>
        </ha-card>`;

      const root = this.shadowRoot;
      this._wrap = root.querySelector('.wrap');
      this._sel = root.querySelector('.selector');
      this._knob = root.querySelector('.knob');
      this._label = root.querySelector('.label');
      this._pct = root.querySelector('.pct');
      this._lis = [...root.querySelectorAll('li')];
      this._zones = [...root.querySelectorAll('.zone')];
      this._radios = [...root.querySelectorAll('input[type="radio"]')];

      const bindBtnEvents = (el, cfg, defaultTapAction) => {
        let timer = null;
        let held = false;
        const clear = () => { clearTimeout(timer); timer = null; };
        el.addEventListener('pointerdown', () => {
          held = false;
          clear();
          timer = setTimeout(() => { timer = null; held = true; this._runBtn(cfg, 'hold', defaultTapAction); }, 500);
        });
        el.addEventListener('pointerup', clear);
        el.addEventListener('pointerleave', clear);
        el.addEventListener('pointercancel', clear);
        el.addEventListener('contextmenu', (ev) => ev.preventDefault());
        el.addEventListener('click', (ev) => {
          if (held) { held = false; ev.preventDefault(); return; }
          this._runBtn(cfg, 'tap', defaultTapAction);
        });
      };

      // Boutons satellites (coins)
      this._xbtns = [...root.querySelectorAll('.xbtn')].map((el, j) => ({ el, cfg: c.extra_buttons[j] }));
      this._xbtns.forEach(({ el, cfg }) => bindBtnEvents(el, cfg, 'more-info'));

      // Boutons en ligne en dessous (row_items : par défaut toggle au clic simple)
      this._rbtns = [...root.querySelectorAll('.rbtn')].map((el, k) => ({ el, cfg: c.row_items[k] }));
      this._rbtns.forEach(({ el, cfg }) => bindBtnEvents(el, cfg, 'toggle'));

      this._knob.addEventListener('click', () => {
        if (Date.now() - this._lastDrag < 500) return;
        this._toggle();
      });
      this._knob.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._toggle(); }
      });

      const sel = this._sel;
      // Doigt et souris passent par les zones (secteurs) : toute la zone d'une entrée réagit,
      // pas seulement son icône (appui, appui long / variateur, survol)
      sel.addEventListener('pointerdown', (e) => {
        this._bump();
        this._ptr = { x: e.clientX, y: e.clientY };
        this._touchDown(e);
        this._mouseDown(e);
      });
      sel.addEventListener('pointermove', (e) => {
        this._bump();
        this._ptr = { x: e.clientX, y: e.clientY };
        if (this._dim && e.pointerId === this._dim.id) this._dimMove(e);
        else { this._touchMove(e); this._mouseMove(e); }
      });
      sel.addEventListener('pointerup', (e) => {
        this._armClose();
        if (this._dim && e.pointerId === this._dim.id) this._dimEnd();
        this._touchUp(e);
        this._mouseUp(e);
      });
      sel.addEventListener('pointercancel', (e) => {
        if (this._dim && e.pointerId === this._dim.id) this._dimEnd();
        this._touchEnd();
        this._mouseEnd();
      });
      sel.addEventListener('pointerleave', (e) => {
        if (e.pointerType !== 'touch' && !this._mouse && !this._dim) this._setHover(null);
      });
      sel.addEventListener('wheel', (e) => { this._bump(); this._wheel(e); }, { passive: false });
      sel.addEventListener('contextmenu', (e) => { if (this._open) e.preventDefault(); });

      // Les icônes (boutons radio) ne servent plus qu'au clavier : Tab puis Espace / Entrée.
      // Un clic souris ou un appui tactile a déjà été traité par la zone.
      this._radios.forEach((radio, i) => {
        radio.addEventListener('click', (ev) => {
          if (this._suppressClick || Date.now() - this._lastTouch < 700) { ev.preventDefault(); return; }
          this._activate(i);
        });
      });

      this._select(0);
      this._updateLabel();
    }

    _canDim(i) {
      const it = this._config.items[i];
      const mode = it.dimmer !== undefined ? it.dimmer : (this._config.dimmer !== undefined ? this._config.dimmer : 'auto');
      if (mode === false || !it.entity || !String(it.entity).startsWith('light.')) return false;
      if (mode === true) return true;
      const st = this._hass && this._hass.states[it.entity];
      const attrs = st && st.attributes;
      if (!attrs) return false;
      return Array.isArray(attrs.supported_color_modes)
        ? attrs.supported_color_modes.some((m) => m !== 'onoff')
        : 'brightness' in attrs;
    }

    _holdDims(i) {
      return !this._config.items[i].hold_action && this._canDim(i);
    }

    _polar(x, y) {
      const r = this._sel.getBoundingClientRect();
      const R = r.width / 2;
      const dx = x - (r.left + R);
      const dy = y - (r.top + r.height / 2);
      return { deg: (Math.atan2(dy, dx) * 180) / Math.PI, dist: Math.hypot(dx, dy), R };
    }

    _dimStart(i, pointerId) {
      if (this._dim) this._dimEnd();
      const it = this._config.items[i];
      const st = this._hass && this._hass.states[it.entity];
      let v = 0;
      if (st && st.state === 'on') {
        const b = Number(st.attributes && st.attributes.brightness);
        v = Number.isFinite(b) && b > 0 ? b / 255 : 1;
      }
      const last = this._ptr ? this._polar(this._ptr.x, this._ptr.y).deg : null;
      this._dim = {
        i, entity: it.entity, v, v0: v, id: pointerId, last,
        sent: Math.round(v * 100), lastSend: 0, timer: null, wheelTimer: null, wheel: false,
      };
      this._sel.classList.add('dimming');
      this._dimRender();
      if (pointerId != null) {
        try { this._sel.setPointerCapture(pointerId); } catch (err) { /* ignore */ }
      }
    }

    _dimRender() {
      const d = this._dim;
      if (!d) return;
      this._sel.style.setProperty('--rsc-dim', String(d.v));
      const pct = Math.round(d.v * 100);
      this._pct.textContent = `${pct}%`;
      // Le petit pourcentage sous l'icône suit le réglage en direct
      if (this._config.show_brightness !== false) this._setLevel(d.i, pct > 0 ? pct : null);
    }

    // Affiche (valeur) ou masque (null) le pourcentage sous l'icône d'une entrée
    _setLevel(i, pct) {
      const li = this._lis && this._lis[i];
      if (!li) return;
      const el = li.querySelector('.lvl');
      li.classList.toggle('has-lvl', pct != null);
      if (el) el.textContent = pct != null ? `${pct}%` : '';
    }

    _dimMove(e) {
      const d = this._dim;
      const p = this._polar(e.clientX, e.clientY);
      if (p.dist < p.R * 0.3) return;
      if (d.last == null) { d.last = p.deg; return; }
      let dd = p.deg - d.last;
      if (dd > 180) dd -= 360;
      if (dd < -180) dd += 360;
      d.last = p.deg;
      this._dimSet(d.v + dd / 270);
    }

    _dimSet(v) {
      const d = this._dim;
      if (!d) return;
      d.v = Math.min(1, Math.max(0, v));
      this._dimRender();
      this._dimSend(false);
    }

    _dimSend(final) {
      const d = this._dim;
      if (!d || !this._hass) return;
      const pct = Math.round(d.v * 100);
      const now = Date.now();
      if (!final && now - d.lastSend < 120) {
        if (!d.timer) {
          d.timer = setTimeout(() => { d.timer = null; if (this._dim === d) this._dimSend(false); }, 120 - (now - d.lastSend));
        }
        return;
      }
      clearTimeout(d.timer);
      d.timer = null;
      if (pct === d.sent) return;
      d.sent = pct;
      d.lastSend = now;
      if (pct === 0) this._hass.callService('light', 'turn_off', { entity_id: d.entity });
      else this._hass.callService('light', 'turn_on', { entity_id: d.entity, brightness_pct: pct });
    }

    _dimEnd() {
      const d = this._dim;
      if (!d) return;
      clearTimeout(d.wheelTimer);
      this._dimSend(true);
      clearTimeout(d.timer);
      if (d.id != null) {
        try { this._sel.releasePointerCapture(d.id); } catch (err) { /* ignore */ }
      }
      this._dim = null;
      this._sel.classList.remove('dimming');
      setTimeout(() => { this._suppressClick = false; }, 50);
    }

    _wheel(e) {
      if (!this._open) return;
      const i = this._dim ? this._dim.i : this._hover;
      if (i == null || !this._canDim(i)) return;
      if (this._dim && !this._dim.wheel) return;
      e.preventDefault();
      if (!this._dim) this._dimStart(i, null);
      const d = this._dim;
      d.wheel = true;
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      this._dimSet(d.v - (Math.max(-100, Math.min(100, dy)) / 100) * 0.05);
      clearTimeout(d.wheelTimer);
      d.wheelTimer = setTimeout(() => { if (this._dim === d) this._dimEnd(); }, 900);
    }

    _activate(i) {
      this._select(i);
      this._run(i, 'tap');
      if (this._config.close_on_select) setTimeout(() => { if (this._open) this._toggle(); }, 450);
    }

    _pointAt(e) {
      const r = this._sel.getBoundingClientRect();
      const R = r.width / 2;
      const dx = e.clientX - (r.left + R);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const rel = (((deg + 90) % 360) + 360) % 360;
      const idx = Math.round(rel / this._step) % this._config.items.length;
      // valid : geste tactile (on peut partir du bouton) ; ring : dans la couronne des zones
      return { idx, valid: dist >= R * 0.2 && dist <= R * 2.9, ring: dist >= R * 1.05 && dist <= R * 2.65 };
    }

    // ---------- Souris dans les zones ----------
    _mouseDown(e) {
      if (e.pointerType === 'touch' || e.button !== 0 || !this._open || this._mouse) return;
      if (e.composedPath().includes(this._knob)) return;   // clic sur le bouton : ouverture / fermeture
      const p = this._pointAt(e);
      if (!p.ring) return;
      const m = { id: e.pointerId, x0: e.clientX, y0: e.clientY, idx: p.idx, held: false, moved: false, timer: null };
      this._mouse = m;
      this._setHover(p.idx);
      m.timer = setTimeout(() => {
        m.timer = null;
        if (this._mouse !== m || m.moved) return;
        m.held = true;
        this._suppressClick = true;
        this._select(m.idx);
        if (this._holdDims(m.idx)) this._dimStart(m.idx, m.id);
        else this._run(m.idx, 'hold');
      }, 500);
    }

    _mouseMove(e) {
      if (e.pointerType === 'touch' || !this._open) return;
      const m = this._mouse;
      if (m && e.pointerId === m.id) {
        if (!m.moved && Math.hypot(e.clientX - m.x0, e.clientY - m.y0) > 8) {
          m.moved = true;
          clearTimeout(m.timer); m.timer = null;
        }
        if (m.held) return;
      }
      const p = this._pointAt(e);
      const next = p.ring ? p.idx : null;
      if (next !== this._hover) this._setHover(next);
    }

    _mouseUp(e) {
      const m = this._mouse;
      if (!m || e.pointerId !== m.id) return;
      this._mouseEnd();
      this._lastTouch = Date.now();   // le « click » qui suit sur l'icône est ignoré
      setTimeout(() => { this._suppressClick = false; }, 50);
      if (m.held) return;
      const p = this._pointAt(e);
      if (p.ring) this._activate(p.idx);
    }

    _mouseEnd() {
      const m = this._mouse;
      if (m) clearTimeout(m.timer);
      this._mouse = null;
    }

    // Intensité du remplissage de la zone éclairée (0–100 %, défaut 80)
    _zoneOpacity() {
      const v = Number(this._config.zone_opacity ?? 80);
      return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) / 100 : 0.8;
    }

    _touchDown(e) {
      if (e.pointerType !== 'touch' || !this._open || this._touch) return;
      this._lastTouch = Date.now();
      const onKnob = e.composedPath().includes(this._knob);
      const t = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, held: false, onKnob, timer: null };
      this._touch = t;
      if (!onKnob) {
        const p = this._pointAt(e);
        this._setHover(p.valid ? p.idx : null);
        if (p.valid) {
          t.timer = setTimeout(() => {
            t.timer = null;
            const q = this._pointAt(e);
            if (t.moved || !q.valid) return;
            t.held = true;
            this._select(q.idx);
            if (this._holdDims(q.idx)) this._dimStart(q.idx, t.id);
            else this._run(q.idx, 'hold');
          }, 500);
        }
      }
    }

    _touchMove(e) {
      const t = this._touch;
      if (!t || e.pointerId !== t.id) return;
      this._lastTouch = Date.now();
      if (!t.moved && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 8) {
        t.moved = true;
        clearTimeout(t.timer); t.timer = null;
      }
      if (t.held) return;
      if (t.moved || !t.onKnob) {
        const p = this._pointAt(e);
        const next = p.valid ? p.idx : null;
        if (next !== this._hover) this._setHover(next);
      }
    }

    _touchUp(e) {
      const t = this._touch;
      if (!t || e.pointerId !== t.id) return;
      this._lastTouch = Date.now();
      if (t.moved) this._lastDrag = Date.now();
      const p = this._pointAt(e);
      const wasHeld = t.held;
      const justTap = t.onKnob && !t.moved;
      this._touchEnd();
      if (wasHeld || justTap) return;
      if (p.valid) this._activate(p.idx);
    }

    _touchEnd() {
      const t = this._touch;
      if (t) clearTimeout(t.timer);
      this._touch = null;
      this._setHover(null);
    }

    _refreshHot() {
      const h = this._hover != null ? this._hover : this._selected;
      this._lis.forEach((li, k) => li.classList.toggle('hot', k === h));
      // La zone ne s'éclaire que sous la souris ou le doigt (pas pour la simple sélection)
      const lit = this._hover;
      (this._zones || []).forEach((z, k) => z.classList.toggle('hot', k === lit));
      this._lis.forEach((li, k) => li.classList.toggle('lit', k === lit));
      // Couleur de la cible pour le pointeur, le liseré, le halo du bouton et l'arc du variateur
      const col = (this._colors && this._colors[h]) || this._itemColors(h);
      const s = this._sel.style;
      s.setProperty('--rsc-cur', col.c);
      s.setProperty('--rsc-cur-d', col.d);
      s.setProperty('--rsc-cur-i', col.a);
    }

    _skin() {
      return SKINS.includes(this._config.knob_theme) ? this._config.knob_theme : 'metal';
    }

    // Animation d'ouverture ; « réduire les animations » du système => fondu
    _anim() {
      const a = ANIMS.includes(this._config.open_animation) ? this._config.open_animation : 'fan';
      const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return reduce && a !== 'none' ? 'fade' : a;
    }

    // Couleurs d'une entrée du cercle : couleur choisie, sinon couleur du thème HA (palette: theme),
    // sinon arc-en-ciel selon sa position
    _itemColors(i) {
      const it = (this._config.items && this._config.items[i]) || {};
      const custom = it.color ? cssColor(it.color)
        : (this._config.palette === 'theme' ? 'var(--primary-color, #03a9f4)' : '');
      if (custom) {
        return { c: custom, d: `color-mix(in srgb, ${custom} 80%, #000)`, i: custom, a: custom };
      }
      const hue = (this._step || 60) * i - 90;
      return {
        c: `hsl(${hue}deg 100% 72%)`,
        d: `hsl(${hue}deg 98% 61%)`,
        i: `hsl(${hue}deg 90% var(--rsc-on-lightness))`,
        a: `hsl(${hue}deg 100% var(--rsc-on-lightness))`,
      };
    }

    // Apparence de la carte : réglée via les variables de ha-card (respecte le thème par défaut)
    _cardStyle() {
      const c = this._config;
      const mode = CARD_STYLES_LIST.includes(c.card_style) ? c.card_style : 'border_only';
      const hasBg = mode === 'standard' || mode === 'background_only';
      const hasBorder = mode === 'standard' || mode === 'border_only';
      const v = [];
      if (!hasBg) v.push('--ha-card-background:transparent');
      else if (c.card_background) v.push(`--ha-card-background:${cssColor(c.card_background)}`);
      if (!hasBorder) v.push('--ha-card-border-width:0px');
      else if (c.card_border_color) v.push(`--ha-card-border-color:${cssColor(c.card_border_color)}`);
      if (mode !== 'standard') v.push('--ha-card-box-shadow:none');
      return v.join(';');
    }

    _setHover(i) {
      this._hover = i;
      this._refreshHot();
      if (i === null) this._sel.style.removeProperty('--rsc-knob-angle');
      else this._sel.style.setProperty('--rsc-knob-angle', `${this._step * i - 90}deg`);
      this._updateLabel();
    }

    _toggle() {
      if (this._dim) this._dimEnd();
      this._setHover(null);
      this._open = !this._open;
      this._sel.classList.toggle('active', this._open);
      this._knob.setAttribute('aria-expanded', String(this._open));
      if (!this._open) this._select(0);
      this._updateLabel();
      this._armClose();
    }

    _armClose() {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
      this._armedAt = Date.now();
      if (!this._open || !(this._autoClose > 0)) return;
      this._closeTimer = setTimeout(() => {
        this._closeTimer = null;
        if (!this._open) return;
        if (this._dim || this._touch) { this._armClose(); return; }
        this._toggle();
      }, this._autoClose * 1000);
    }

    _bump() {
      if (!this._open || !(this._autoClose > 0)) return;
      if (Date.now() - this._armedAt < 250) return;
      this._armClose();
    }

    _select(i) {
      this._selected = i;
      this._radios.forEach((r, k) => { r.checked = k === i; });
      this._refreshHot();
      this._sel.style.setProperty('--rsc-angle', `${this._step * i - 90}deg`);
      this._updateLabel();
    }

    _updateLabel() {
      if (!this._label) return;
      const c = this._config;
      let text = c.name || '';
      if (this._open) {
        const k = this._hover != null ? this._hover : this._selected;
        text = this._getEntityName(c.items[k], '');
      }
      this._label.textContent = text;
      this._label.style.display = c.show_label ? '' : 'none';
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._wrap) return;
      const c = this._config;
      const dark = c.theme === 'dark' || (c.theme === 'auto' && hass.themes && hass.themes.darkMode);
      this._wrap.classList.toggle('dark', !!dark);

      c.items.forEach((it, i) => {
        const st = it.entity && hass.states[it.entity];
        this._lis[i].classList.toggle('on', !!st && ON_STATES.includes(st.state));
        // Pourcentage sous l'icône : lumière allumée avec variateur (sauf pendant son réglage)
        if (!(this._dim && this._dim.i === i)) {
          const b = st && st.attributes ? Number(st.attributes.brightness) : NaN;
          const show = c.show_brightness !== false && !!st && st.state === 'on' && this._canDim(i) && Number.isFinite(b) && b > 0;
          this._setLevel(i, show ? Math.max(1, Math.round((b / 255) * 100)) : null);
        }
        const ic = this.shadowRoot.querySelector(`[data-circle-icon="${i}"]`);
        if (ic && !it.icon && st && st.attributes && st.attributes.icon) {
          ic.setAttribute('icon', st.attributes.icon);
        }
      });

      this._xbtns.forEach(({ el, cfg }, j) => {
        const st = cfg.entity && hass.states[cfg.entity];
        el.classList.toggle('on', !!st && !OFF_STATES.includes(st.state));
        const ic = this.shadowRoot.querySelector(`[data-x-icon="${j}"]`);
        if (ic && !cfg.icon && st && st.attributes && st.attributes.icon) {
          ic.setAttribute('icon', st.attributes.icon);
        }
      });

      this._rbtns.forEach(({ el, cfg }, k) => {
        const st = cfg.entity && hass.states[cfg.entity];
        el.classList.toggle('on', !!st && !OFF_STATES.includes(st.state));
        const ic = this.shadowRoot.querySelector(`[data-r-icon="${k}"]`);
        if (ic && !cfg.icon && st && st.attributes && st.attributes.icon) {
          ic.setAttribute('icon', st.attributes.icon);
        }
      });

      this._updateLabel();
    }

    _run(i, kind) {
      const item = this._config.items[i];
      const def = kind === 'hold'
        ? (item.entity ? { action: 'more-info' } : { action: 'none' })
        : (item.entity ? { action: 'toggle' } : { action: 'none' });
      const cfg = (kind === 'hold' ? item.hold_action : item.tap_action) || def;
      this._exec(cfg, cfg.entity || item.entity);
    }

    _exec(cfg, entity) {
      const hass = this._hass;

      switch (cfg.action) {
        case 'toggle':
          if (entity) this._toggleEntity(entity);
          break;
        case 'more-info':
          if (entity) {
            this.dispatchEvent(new CustomEvent('hass-more-info', {
              bubbles: true, composed: true, detail: { entityId: entity },
            }));
          }
          break;
        case 'navigate':
          if (cfg.navigation_path) {
            history.pushState(null, '', cfg.navigation_path);
            window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
          }
          break;
        case 'url':
          if (cfg.url_path) window.open(cfg.url_path, cfg.new_tab === false ? '_self' : '_blank');
          break;
        case 'perform-action':
        case 'call-service': {
          const svc = cfg.perform_action || cfg.service;
          if (!svc || !hass) break;
          const [domain, service] = svc.split('.');
          const data = { ...(cfg.data || cfg.service_data || {}) };
          const target = cfg.target || (entity && !data.entity_id ? { entity_id: entity } : undefined);
          hass.callService(domain, service, data, target);
          break;
        }
        default:
          break;
      }
    }

    _runBtn(cfg, kind, defaultTap = 'more-info') {
      let a = kind === 'hold' ? cfg.hold_action : cfg.tap_action;
      if (!a) {
        if (kind === 'tap' && cfg.popup) a = { action: 'navigate', navigation_path: cfg.popup };
        else if (kind === 'tap') a = cfg.entity ? { action: defaultTap } : { action: 'none' };
        else a = cfg.entity ? { action: 'more-info' } : { action: 'none' };
      }
      this._exec(a, a.entity || cfg.entity);
    }

    _toggleEntity(entity) {
      const hass = this._hass;
      if (!hass) return;
      const domain = entity.split('.')[0];
      if (domain === 'button' || domain === 'input_button') {
        hass.callService(domain, 'press', { entity_id: entity });
      } else if (domain === 'scene') {
        hass.callService('scene', 'turn_on', { entity_id: entity });
      } else if (domain === 'lock') {
        const st = hass.states[entity];
        hass.callService('lock', st && st.state === 'locked' ? 'unlock' : 'lock', { entity_id: entity });
      } else {
        hass.callService('homeassistant', 'toggle', { entity_id: entity });
      }
    }
  }

  /* ============================================================================
   * ÉDITEUR VISUEL (composants natifs HA <ha-entity-picker> & <ha-icon-picker>)
   * La configuration complète est conservée : seules les clés modifiées changent.
   * grid_options, visibility, view_layout, card_mod, actions personnalisées… ne sont
   * donc jamais perdus quand on modifie quelque chose dans l'éditeur.
   * ============================================================================ */
  const EDITOR_STYLES = `
    .editor-wrap {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      color: var(--primary-text-color);
    }
    .section {
      border: 1px solid var(--divider-color, rgba(128,128,128,0.25));
      border-radius: 12px;
      padding: 16px;
      background: var(--card-background-color, transparent);
    }
    .section-title {
      font-weight: 600;
      font-size: 15px;
      margin: 0 0 12px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .grid-2, .item-subgrid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 12px;
      align-items: end;
    }
    .item-subgrid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px 12px;
      align-items: end;
    }
    @media (max-width: 520px) {
      .grid-2, .item-subgrid, .item-subgrid-3 { grid-template-columns: 1fr; }
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .field label {
      font-size: 12px;
      color: var(--secondary-text-color);
      font-weight: 500;
    }
    .field input[type="text"],
    .field input[type="number"],
    .field select {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--lovelace-background, var(--primary-background-color, #fff));
      color: var(--primary-text-color);
      font-size: 14px;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
    }
    .field input[type="range"] {
      width: 100%;
      margin: 10px 0 4px;
      accent-color: var(--primary-color, #03a9f4);
    }
    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 10px 12px;
    }
    .color-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .color-row input[type="color"] {
      flex: none;
      width: 40px;
      height: 40px;
      padding: 2px;
      border-radius: 8px;
      border: 1px solid var(--divider-color, #ccc);
      background: transparent;
      cursor: pointer;
    }
    .color-row input[type="text"] { flex: 1; }
    .switches {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
    }
    .switch-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      cursor: pointer;
    }
    .item-card {
      border: 1px solid var(--divider-color, rgba(128,128,128,0.2));
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      background: rgba(128, 128, 128, 0.05);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--secondary-text-color);
    }
    .item-actions { display: flex; gap: 6px; }
    ha-entity-picker, ha-icon-picker {
      display: block;
      width: 100%;
    }
    .btn {
      padding: 7px 14px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      background: var(--primary-color, #03a9f4);
      color: #fff;
      white-space: nowrap;
    }
    .btn-del, .btn-mini, .btn-clear {
      padding: 5px 10px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    }
    .btn-del { background: #e53935; color: #fff; }
    .btn-mini, .btn-clear {
      background: rgba(128, 128, 128, 0.18);
      color: var(--primary-text-color);
    }
    .btn-clear { flex: none; height: 40px; }
    .btn:disabled, .btn-del:disabled, .btn-mini:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .hint {
      font-size: 12px;
      color: var(--secondary-text-color);
      margin: 0 0 10px 0;
    }
    .sub-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--secondary-text-color);
      margin-top: 4px;
    }
  `;

  const ACTIONS = [
    ['default', 'Par défaut'],
    ['popup', 'Ouvrir une pop-up (#…)'],
    ['navigate', 'Aller à une vue / une page'],
    ['toggle', 'Allumer / éteindre'],
    ['more-info', 'Fenêtre d\'infos HA'],
    ['none', 'Aucune'],
  ];
  const POS_LABELS = [
    ['', 'Auto (premier coin libre)'],
    ['bottom-right', 'Bas droite'],
    ['bottom-left', 'Bas gauche'],
    ['top-right', 'Haut droite'],
    ['top-left', 'Haut gauche'],
  ];
  const CARD_STYLE_LABELS = [
    ['border_only', 'Contour sans fond (défaut)'],
    ['standard', 'Fond + contour (thème HA)'],
    ['background_only', 'Fond sans contour'],
    ['transparent', 'Transparente (ni fond ni contour)'],
  ];
  const SKIN_LABELS = [
    ['metal', 'Métal brossé (défaut)'],
    ['ha', 'Thème Home Assistant (suit le thème actif)'],
    ['glass', 'Verre dépoli'],
    ['neumorph', 'Doux (relief mat)'],
    ['brass', 'Laiton vintage'],
    ['carbon', 'Carbone'],
    ['neon', 'Néon'],
  ];
  const ANIM_LABELS = [
    ['fan', 'Éventail (défaut)'],
    ['bloom', 'Éclosion'],
    ['spiral', 'Spirale'],
    ['cascade', 'Cascade'],
    ['pop', 'Rebond'],
    ['fade', 'Fondu'],
    ['none', 'Aucune'],
  ];
  const PALETTE_LABELS = [
    ['rainbow', 'Arc-en-ciel (défaut)'],
    ['theme', 'Couleur principale du thème HA'],
  ];

  // Type d'action d'un bouton, pour l'éditeur
  const actionKind = (b) => {
    const a = b && b.tap_action;
    if (a && typeof a === 'object') {
      if (['navigate', 'toggle', 'more-info', 'none'].includes(a.action)) return a.action;
      return 'custom';
    }
    if (b && b.popup) return 'popup';
    return 'default';
  };

  // '#abc' / '#aabbcc' -> '#aabbcc' (pour le sélecteur de couleur natif), sinon null
  const toHex = (v) => {
    const s = String(v || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s.slice(1).split('').map((ch) => ch + ch).join('')).toLowerCase();
    return null;
  };

  const opts = (list, current) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(l)}</option>`).join('');

  class RadialSelectorCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = null;
      this._hass = null;
      this._sig = null;
    }

    setConfig(config) {
      // Copie complète : aucune clé n'est perdue
      const cfg = JSON.parse(JSON.stringify(config || {}));
      // Clés alternatives -> clés canoniques
      if (!cfg.items && cfg.circle_entities) cfg.items = cfg.circle_entities;
      delete cfg.circle_entities;
      if (!cfg.row_items && cfg.bottom_entities) cfg.row_items = cfg.bottom_entities;
      delete cfg.bottom_entities;
      if (!cfg.extra_buttons && cfg.extra_button) cfg.extra_buttons = [].concat(cfg.extra_button);
      delete cfg.extra_button;
      cfg.items = [].concat(cfg.items || []).map((it) => normalizeItem(it)).filter(Boolean);
      ['row_items', 'extra_buttons'].forEach((k) => {
        if (cfg[k] !== undefined) cfg[k] = [].concat(cfg[k] || []).map((it) => normalizeItem(it)).filter(Boolean);
      });
      this._config = cfg;
      if (this._signature() !== this._sig || !this.shadowRoot.querySelector('.editor-wrap')) this._render();
      else this._syncValues();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._config) return;
      if (!this.shadowRoot.querySelector('.editor-wrap')) { this._render(); return; }
      this.shadowRoot.querySelectorAll('ha-entity-picker, ha-icon-picker').forEach((el) => { el.hass = hass; });
    }

    // Ce qui change la structure de l'éditeur (nombre d'entrées, champs affichés)
    _signature() {
      const c = this._config;
      const rowDefault = c.row_style || 'tile';
      return JSON.stringify([
        c.items.length,
        (c.row_items || []).map((b) => [b.style || rowDefault, actionKind(b)]),
        (c.extra_buttons || []).map((b) => [b.style === 'tile' ? 'tile' : 'metal', actionKind(b)]),
        CARD_STYLES_LIST.includes(c.card_style) ? c.card_style : 'border_only',
      ]);
    }

    _emit() {
      const { type, ...rest } = this._config;
      const out = { type: type || `custom:${TAG}`, ...rest };
      ['row_items', 'extra_buttons'].forEach((k) => {
        if (Array.isArray(out[k]) && out[k].length === 0) delete out[k];
      });
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: out }, bubbles: true, composed: true }));
    }

    _afterChange() {
      this._emit();
      if (this._signature() !== this._sig) this._render();
    }

    // Modifie des clés : au niveau de la carte (scope '__top') ou d'une entrée de liste
    _patch(scope, idx, patch) {
      const apply = (obj) => {
        const o = { ...obj };
        Object.entries(patch).forEach(([k, v]) => {
          if (v === undefined || v === null || v === '') delete o[k];
          else o[k] = v;
        });
        return o;
      };
      if (scope === '__top') {
        this._config = apply(this._config);
      } else {
        const arr = [...(this._config[scope] || [])];
        if (!arr[idx]) return;
        arr[idx] = apply(arr[idx]);
        this._config = { ...this._config, [scope]: arr };
      }
      this._afterChange();
    }

    _setList(scope, arr) {
      this._config = { ...this._config, [scope]: arr };
      this._afterChange();
    }

    _setAction(scope, idx, kind) {
      const arr = [...(this._config[scope] || [])];
      const it = { ...arr[idx] };
      const prev = it.popup || (it.tap_action && it.tap_action.navigation_path) || '';
      if (kind === 'custom') return;
      delete it.popup;
      if (kind === 'default') delete it.tap_action;
      else if (kind === 'popup') { delete it.tap_action; it.popup = prev && prev.startsWith('#') ? prev : '#'; }
      else if (kind === 'navigate') it.tap_action = { action: 'navigate', navigation_path: prev };
      else it.tap_action = { action: kind };
      arr[idx] = it;
      this._setList(scope, arr);
    }

    _setActionValue(scope, idx, raw) {
      const arr = [...(this._config[scope] || [])];
      const it = { ...arr[idx] };
      const v = raw.trim();
      const kind = actionKind(it);
      if (kind === 'popup') it.popup = v ? (v.startsWith('#') || v.startsWith('/') ? v : `#${v}`) : '#';
      else if (kind === 'navigate') it.tap_action = { ...it.tap_action, navigation_path: v };
      else return;
      arr[idx] = it;
      this._setList(scope, arr);
    }

    // ---------- Gabarits ----------
    _colorField(key, val, label, def, placeholder) {
      return `
        <div class="field">
          <label>${esc(label)}</label>
          <div class="color-row">
            <input type="color" data-swatch="${key}" data-default="${def}" value="${toHex(val) || def}">
            <input type="text" data-field="${key}" value="${esc(val || '')}" placeholder="${esc(placeholder)}">
            <button type="button" class="btn-clear" data-clear="${key}" title="Couleur par défaut">✕</button>
          </div>
        </div>`;
    }

    _actionFields(b, defaultLabel) {
      const kind = actionKind(b);
      const list = ACTIONS.map(([v, l]) => (v === 'default' ? [v, `${l} (${defaultLabel})`] : [v, l]));
      if (kind === 'custom') list.push(['custom', 'Personnalisée (YAML)']);
      let valueField = '';
      if (kind === 'popup') {
        valueField = `<div class="field"><label>Pop-up (hash Bubble Card)</label>
          <input type="text" data-field="action_value" value="${esc(b.popup === '#' ? '' : b.popup || '')}" placeholder="#tv-salon"></div>`;
      } else if (kind === 'navigate') {
        valueField = `<div class="field"><label>Chemin</label>
          <input type="text" data-field="action_value" value="${esc((b.tap_action && b.tap_action.navigation_path) || '')}" placeholder="/lovelace/salon ou /lovelace/salon#tv-salon"></div>`;
      } else if (kind === 'custom') {
        valueField = '<div class="hint" style="margin:0">Action définie en YAML : elle est conservée telle quelle.</div>';
      }
      return `
        <div class="item-subgrid">
          <div class="field"><label>Action à l'appui</label>
            <select data-field="action" ${kind === 'custom' ? 'disabled' : ''}>${opts(list, kind)}</select></div>
          ${valueField}
        </div>`;
    }

    _itemHeader(title, scope, idx, len, canDelete) {
      return `
        <div class="item-header">
          <span>${title}</span>
          <div class="item-actions">
            <button type="button" class="btn-mini" data-move="-1" title="Monter" ${idx === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-mini" data-move="1" title="Descendre" ${idx === len - 1 ? 'disabled' : ''}>▼</button>
            <button type="button" class="btn-del" data-del title="Supprimer" ${canDelete ? '' : 'disabled'}>Supprimer</button>
          </div>
        </div>`;
    }

    _render() {
      if (!this._config) return;
      const c = this._config;
      this._sig = this._signature();
      const rows = c.row_items || [];
      const extras = c.extra_buttons || [];
      const rowDefault = c.row_style || 'tile';
      const cardStyle = CARD_STYLES_LIST.includes(c.card_style) ? c.card_style : 'border_only';
      const cardHasBg = cardStyle === 'standard' || cardStyle === 'background_only';
      const cardHasBorder = cardStyle === 'standard' || cardStyle === 'border_only';

      const circleCards = c.items.map((it, idx) => `
        <div class="item-card" data-list="items" data-idx="${idx}">
          ${this._itemHeader(`Position cercle #${idx + 1}`, 'items', idx, c.items.length, c.items.length > 2)}
          <ha-entity-picker allow-custom-entity></ha-entity-picker>
          <div class="item-subgrid">
            <div class="field"><label>Nom (optionnel)</label>
              <input type="text" data-field="name" placeholder="Nom de l'entité" value="${esc(it.name || '')}"></div>
            <div class="field"><label>Icône (optionnel)</label><ha-icon-picker></ha-icon-picker></div>
          </div>
          <div class="color-grid">
            ${this._colorField('color', it.color, 'Couleur', this._defaultHex(idx), 'Auto (arc-en-ciel)')}
          </div>
        </div>`).join('');

      const rowCards = rows.map((it, idx) => {
        const style = it.style || rowDefault;
        return `
        <div class="item-card" data-list="row_items" data-idx="${idx}">
          ${this._itemHeader(`Bouton en ligne #${idx + 1}`, 'row_items', idx, rows.length, true)}
          <ha-entity-picker allow-custom-entity></ha-entity-picker>
          <div class="item-subgrid-3">
            <div class="field"><label>Nom / info-bulle</label>
              <input type="text" data-field="name" placeholder="Nom auto" value="${esc(it.name || '')}"></div>
            <div class="field"><label>Icône (optionnel)</label><ha-icon-picker></ha-icon-picker></div>
            <div class="field"><label>Style</label>
              <select data-field="style">${opts([['tile', 'Tuile'], ['metal', 'Métal']], style)}</select></div>
          </div>
          ${this._actionFields(it, 'allumer / éteindre')}
          <div class="sub-title">Couleurs</div>
          <div class="color-grid">
            ${this._colorField('color', it.color, 'Allumé', '#a3be8c', '#a3be8c')}
            ${this._colorField('off_color', it.off_color, 'Éteint', style === 'tile' ? '#bf616a' : '#888888', style === 'tile' ? '#bf616a' : 'Thème')}
            ${style === 'tile' ? this._colorField('background', it.background, 'Fond de la tuile', '#434c5e', '#434c5e') : ''}
          </div>
        </div>`;
      }).join('');

      const extraCards = extras.map((it, idx) => {
        const style = it.style === 'tile' ? 'tile' : 'metal';
        return `
        <div class="item-card" data-list="extra_buttons" data-idx="${idx}">
          ${this._itemHeader(`Bouton de coin #${idx + 1}`, 'extra_buttons', idx, extras.length, true)}
          <ha-entity-picker allow-custom-entity></ha-entity-picker>
          <div class="hint" style="margin:0">L'entité sert au voyant (allumé / éteint) et à la fenêtre d'infos ; elle est facultative.</div>
          <div class="item-subgrid">
            <div class="field"><label>Nom / info-bulle</label>
              <input type="text" data-field="name" placeholder="Nom auto" value="${esc(it.name || '')}"></div>
            <div class="field"><label>Icône</label><ha-icon-picker></ha-icon-picker></div>
            <div class="field"><label>Coin</label>
              <select data-field="position">${opts(POS_LABELS, POSITIONS.includes(it.position) ? it.position : '')}</select></div>
            <div class="field"><label>Style</label>
              <select data-field="style">${opts([['metal', 'Métal'], ['tile', 'Tuile']], style)}</select></div>
          </div>
          ${this._actionFields(it, 'fenêtre d\'infos')}
          <div class="sub-title">Couleurs</div>
          <div class="color-grid">
            ${this._colorField('color', it.color, 'Allumé', '#a3be8c', '#a3be8c')}
            ${this._colorField('off_color', it.off_color, 'Éteint', style === 'tile' ? '#bf616a' : '#888888', style === 'tile' ? '#bf616a' : 'Thème')}
            ${style === 'tile' ? this._colorField('background', it.background, 'Fond de la tuile', '#434c5e', '#434c5e') : ''}
          </div>
        </div>`;
      }).join('');

      this.shadowRoot.innerHTML = `
        <style>${EDITOR_STYLES}</style>
        <div class="editor-wrap">
          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">Paramètres généraux</div>
            <div class="grid-2">
              <div class="field"><label>Nom de la carte</label>
                <input type="text" data-field="name" value="${esc(c.name || '')}" placeholder="Éclairage"></div>
              <div class="field"><label>Réduction automatique (secondes, 0 = jamais)</label>
                <input type="number" data-field="auto_close" min="0" max="3600" value="${esc(c.auto_close ?? '')}" placeholder="10"></div>
              <div class="field"><label>Taille du bouton central (px)</label>
                <input type="number" data-field="size" min="60" max="300" value="${esc(c.size || '')}" placeholder="Auto"></div>
              <div class="field"><label>Thème</label>
                <select data-field="theme">${opts([['auto', 'Auto (thème HA)'], ['dark', 'Sombre'], ['light', 'Clair']], c.theme || 'auto')}</select></div>
            </div>
            <div class="switches">
              <label class="switch-label"><input type="checkbox" data-field="show_label" ${c.show_label ? 'checked' : ''}>
                Afficher le libellé sous le cercle</label>
              <label class="switch-label"><input type="checkbox" data-field="close_on_select" ${c.close_on_select ? 'checked' : ''}>
                Réduire immédiatement après une sélection</label>
              <label class="switch-label"><input type="checkbox" data-field="show_brightness" ${c.show_brightness !== false ? 'checked' : ''}>
                Afficher le % sous les lumières variables allumées</label>
            </div>
          </div>

          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">Style du bouton</div>
            <div class="grid-2">
              <div class="field"><label>Thème du bouton</label>
                <select data-field="knob_theme">${opts(SKIN_LABELS, SKINS.includes(c.knob_theme) ? c.knob_theme : 'metal')}</select></div>
              <div class="field"><label>Animation d'ouverture</label>
                <select data-field="open_animation">${opts(ANIM_LABELS, ANIMS.includes(c.open_animation) ? c.open_animation : 'fan')}</select></div>
              <div class="field"><label>Couleurs des entrées sans couleur choisie</label>
                <select data-field="palette">${opts(PALETTE_LABELS, c.palette === 'theme' ? 'theme' : 'rainbow')}</select></div>
              <div class="field"><label>Remplissage de la zone survolée : <span data-range-label="zone_opacity">${esc(c.zone_opacity ?? 80)}</span> %</label>
                <input type="range" data-field="zone_opacity" min="0" max="100" step="5" value="${esc(c.zone_opacity ?? 80)}"></div>
            </div>
            <div class="hint" style="margin:10px 0 0">« Thème Home Assistant » reprend les couleurs du thème actif et change avec lui.
              Si « réduire les animations » est activé sur l'appareil, l'ouverture se fait en fondu.</div>
          </div>

          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">Apparence de la carte</div>
            <div class="grid-2">
              <div class="field"><label>Fond et contour</label>
                <select data-field="card_style">${opts(CARD_STYLE_LABELS, cardStyle)}</select></div>
              ${cardHasBg ? this._colorField('card_background', c.card_background, 'Couleur du fond', '#2b303d', 'Thème HA') : ''}
              ${cardHasBorder ? this._colorField('card_border_color', c.card_border_color, 'Couleur du contour', '#5e6472', 'Thème HA') : ''}
            </div>
          </div>

          <div class="section">
            <div class="section-title">
              <span>Entités dans le cercle (${c.items.length}/10)</span>
              <button type="button" class="btn" data-add="items" ${c.items.length >= 10 ? 'disabled' : ''}>+ Ajouter</button>
            </div>
            <div class="hint">Entre 2 et 10 entités autour du cadran. Couleur vide : arc-en-ciel selon la position.</div>
            ${circleCards}
          </div>

          <div class="section">
            <div class="section-title">
              <span>Boutons dans les coins (${extras.length}/4)</span>
              <button type="button" class="btn" data-add="extra_buttons" ${extras.length >= 4 ? 'disabled' : ''}>+ Ajouter</button>
            </div>
            <div class="hint">Accès direct, même cadran fermé : pop-up Bubble Card, vue, appareil…</div>
            ${extraCards || '<div class="hint">Aucun bouton de coin.</div>'}
          </div>

          <div class="section">
            <div class="section-title">
              <span>Entités en ligne en dessous (${rows.length})</span>
              <button type="button" class="btn" data-add="row_items">+ Ajouter</button>
            </div>
            <div class="hint">Boutons d'accès rapide alignés sous le cercle.</div>
            ${rowCards || '<div class="hint">Aucune entité en ligne.</div>'}
          </div>
        </div>`;

      this._bind();
      this._syncValues();
    }

    _defaultHex(i) {
      // Couleur arc-en-ciel par défaut d'une entrée du cercle, en hex pour le sélecteur natif
      const n = this._config.items.length || 1;
      const h = (((360 / n) * i - 90) % 360 + 360) % 360;
      const s = 1, l = 0.72;
      const k = (m) => (m + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (m) => l - a * Math.max(-1, Math.min(k(m) - 3, Math.min(9 - k(m), 1)));
      return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
    }

    _bind() {
      const root = this.shadowRoot;

      root.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-add');
        const arr = [...(this._config[scope] || [])];
        if (scope === 'items' && arr.length >= 10) return;
        if (scope === 'extra_buttons' && arr.length >= POSITIONS.length) return;
        arr.push(scope === 'extra_buttons' ? { icon: 'mdi:television' } : {});
        this._setList(scope, arr);
      }));

      root.querySelectorAll('[data-list]').forEach((card) => {
        const scope = card.getAttribute('data-list');
        const idx = Number(card.getAttribute('data-idx'));
        const isTop = scope === '__top';

        // Les cartes d'entrée ne doivent pas capter les champs des sections imbriquées
        const own = (sel) => [...card.querySelectorAll(sel)].filter((el) => el.closest('[data-list]') === card);

        own('ha-entity-picker').forEach((ep) => {
          ep.hass = this._hass;
          ep.label = 'Entité';
          ep.addEventListener('value-changed', (ev) => {
            ev.stopPropagation();
            this._patch(scope, idx, { entity: ev.detail.value || undefined });
          });
        });
        own('ha-icon-picker').forEach((ip) => {
          ip.hass = this._hass;
          ip.addEventListener('value-changed', (ev) => {
            ev.stopPropagation();
            this._patch(scope, idx, { icon: ev.detail.value || undefined });
          });
        });

        own('input[data-field]').forEach((inp) => {
          const key = inp.getAttribute('data-field');
          if (inp.type === 'checkbox') {
            // show_brightness est actif par défaut : on n'écrit que « false »
            const onTrue = key === 'show_brightness' ? undefined : true;
            const onFalse = key === 'show_brightness' ? false : undefined;
            inp.addEventListener('change', () => this._patch(scope, idx, { [key]: inp.checked ? onTrue : onFalse }));
            return;
          }
          if (inp.type === 'range') {
            const lab = own(`[data-range-label="${key}"]`)[0];
            inp.addEventListener('input', () => { if (lab) lab.textContent = inp.value; });
            // valeur enregistrée au relâchement du curseur (évite de reconstruire la carte en continu)
            inp.addEventListener('change', () => {
              const n = Number(inp.value);
              this._patch(scope, idx, { [key]: n === 80 ? undefined : n });
            });
            return;
          }
          inp.addEventListener('input', () => {
            if (key === 'action_value') { this._setActionValue(scope, idx, inp.value); return; }
            if (inp.type === 'number') {
              const n = inp.value === '' ? undefined : Number(inp.value);
              this._patch(scope, idx, { [key]: Number.isFinite(n) && n >= 0 ? n : undefined });
              return;
            }
            const isColor = !!card.querySelector(`[data-swatch="${key}"]`);
            const v = isColor ? inp.value.trim() : inp.value;
            this._patch(scope, idx, { [key]: v || undefined });
            const sw = own(`[data-swatch="${key}"]`)[0];
            if (sw && toHex(v)) sw.value = toHex(v);
          });
        });

        own('input[type="color"][data-swatch]').forEach((sw) => {
          sw.addEventListener('change', () => {
            const key = sw.getAttribute('data-swatch');
            const txt = own(`input[type="text"][data-field="${key}"]`)[0];
            if (txt) txt.value = sw.value;
            this._patch(scope, idx, { [key]: sw.value });
          });
        });

        own('[data-clear]').forEach((btn) => btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-clear');
          const txt = own(`input[type="text"][data-field="${key}"]`)[0];
          const sw = own(`[data-swatch="${key}"]`)[0];
          if (txt) txt.value = '';
          if (sw) sw.value = sw.getAttribute('data-default');
          this._patch(scope, idx, { [key]: undefined });
        }));

        own('select[data-field]').forEach((sel) => sel.addEventListener('change', () => {
          const key = sel.getAttribute('data-field');
          const v = sel.value;
          if (key === 'action') this._setAction(scope, idx, v);
          else if (key === 'theme') this._patch(scope, idx, { theme: v === 'auto' ? undefined : v });
          else if (key === 'card_style') this._patch(scope, idx, { card_style: v === 'border_only' ? undefined : v });
          else if (key === 'knob_theme') this._patch(scope, idx, { knob_theme: v === 'metal' ? undefined : v });
          else if (key === 'open_animation') this._patch(scope, idx, { open_animation: v === 'fan' ? undefined : v });
          else if (key === 'palette') this._patch(scope, idx, { palette: v === 'rainbow' ? undefined : v });
          else this._patch(scope, idx, { [key]: v || undefined });
        }));

        if (!isTop) {
          own('[data-move]').forEach((btn) => btn.addEventListener('click', () => {
            const to = idx + Number(btn.getAttribute('data-move'));
            const arr = [...(this._config[scope] || [])];
            if (to < 0 || to >= arr.length) return;
            [arr[idx], arr[to]] = [arr[to], arr[idx]];
            this._setList(scope, arr);
            this._render();   // l'ordre a changé : on redessine
          }));
          own('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
            const arr = [...(this._config[scope] || [])];
            if (scope === 'items' && arr.length <= 2) return;
            arr.splice(idx, 1);
            this._setList(scope, arr);
          }));
        }
      });
    }

    // Remet les valeurs affichées en phase avec la configuration (sans toucher au champ en cours de saisie)
    _syncValues() {
      const root = this.shadowRoot;
      if (!root || !this._config) return;
      const focused = root.activeElement;
      root.querySelectorAll('[data-list]').forEach((card) => {
        const scope = card.getAttribute('data-list');
        const idx = Number(card.getAttribute('data-idx'));
        const it = scope === '__top' ? this._config : (this._config[scope] || [])[idx];
        if (!it) return;
        const own = (sel) => [...card.querySelectorAll(sel)].filter((el) => el.closest('[data-list]') === card);
        own('ha-entity-picker').forEach((ep) => { if (ep.value !== (it.entity || '')) ep.value = it.entity || ''; });
        own('ha-icon-picker').forEach((ip) => { if (ip.value !== (it.icon || '')) ip.value = it.icon || ''; });
        own('input[data-field]').forEach((inp) => {
          if (inp === focused) return;
          const key = inp.getAttribute('data-field');
          if (inp.type === 'checkbox') { inp.checked = key === 'show_brightness' ? it[key] !== false : !!it[key]; return; }
          if (inp.type === 'range') {
            const v = String(it[key] ?? 80);
            if (inp.value !== v) inp.value = v;
            const lab = own(`[data-range-label="${key}"]`)[0];
            if (lab) lab.textContent = v;
            return;
          }
          let v;
          if (key === 'action_value') {
            v = actionKind(it) === 'popup' ? (it.popup === '#' ? '' : it.popup || '') : ((it.tap_action && it.tap_action.navigation_path) || '');
          } else v = it[key] ?? '';
          if (inp.value !== String(v)) inp.value = String(v);
          const sw = own(`[data-swatch="${key}"]`)[0];
          if (sw) sw.value = toHex(v) || sw.getAttribute('data-default');
        });
      });
    }
  }

  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, RadialSelectorCardEditor);
  if (!customElements.get(TAG)) customElements.define(TAG, RadialSelectorCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: TAG,
    name: 'Radial Selector Card',
    preview: true,
    description: 'Sélecteur rotatif : entités en cercle, boutons de coin, ligne de boutons, variateur et réduction temporisée.',
    documentationURL: 'https://github.com/benshoesweb/radial-selector-card',
  });
})();
