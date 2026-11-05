/*
 * radial-selector-card — sélecteur rotatif pour Home Assistant
 * https://github.com/benshoesweb/radial-selector-card
 *
 * Fonctionnalités incluses :
 *   - Éditeur visuel intégré (composants natifs HA <ha-entity-picker>, <ha-icon-picker>)
 *     qui conserve toutes les autres clés de la configuration (grid_options, visibility, card_mod…)
 *     Carte et éditeur en français ou en anglais selon la langue de Home Assistant.
 *   - Entités dans le cercle (items : 2 à 10), couleur au choix par entrée (color, sinon arc-en-ciel)
 *   - Groupes : une entrée avec ses propres « items » ouvre un sous-cercle (appui sur le bouton = retour)
 *   - Molette à l'appui long : luminosité (puis blanc et couleur par appuis longs successifs),
 *     volume (media_player), position (cover), consigne (climate), vitesse (fan), input_number / number
 *   - Appui long sur le bouton central (center_hold_action) : all_off (tout éteindre), pop-up, vue, scène…
 *   - Bouton fermé : nombre d'entités allumées (show_count) dans le voyant du bouton, ou en pastille
 *     dans le coin (count_position: badge), aux couleurs du thème Home Assistant ou au choix
 *     (count_background, count_color), et halo coloré (show_halo)
 *   - Retour haptique au doigt (haptics), mode nuit (night_mode: sun | entity | always, night_entity, night_level)
 *   - Entités en ligne en dessous (row_items) : style tile/metal, action, couleurs
 *   - Boutons dans les coins (extra_buttons, 4 max) : coin, style, action / pop-up, couleurs
 *   - Réduction automatique (auto_close)
 *   - Jumeau d'un bouton rotatif physique (sync_entity : input_text / input_select partagé avec le
 *     blueprint blueprints/radial_knob_twin.yaml) : la carte s'ouvre et pointe l'entrée choisie au
 *     bouton (sync_open), et un appui dans la carte choisit l'entrée que le bouton pilotera
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
 * Nombre d'entités allumées (bouton fermé) :
 *   count_position    knob (défaut : dans le voyant) | badge (pastille dans le coin)
 *   count_background  couleur du fond (défaut : couleur principale du thème HA)
 *   count_color       couleur du chiffre (défaut : texte sur couleur principale du thème HA, ou noir / blanc
 *                     s'il n'est pas lisible ; si seul le fond est choisi : noir ou blanc, le plus lisible)
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

  // Lit une couleur CSS (hex, rgb, hsl, nom…) : [r, g, b], ou null si elle n'est pas lisible (ex. var(--x))
  const colorRgb = (v) => {
    const c = String(v ?? '').trim();
    if (!c) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Une couleur refusée laisse la précédente : deux essais différents la révèlent
      ctx.fillStyle = '#000';
      ctx.fillStyle = c;
      const a = ctx.fillStyle;
      ctx.fillStyle = '#fff';
      ctx.fillStyle = c;
      if (a !== ctx.fillStyle) return null;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    } catch (e) { return null; }
  };

  // Luminance relative (WCAG) ; au-dessus de 0,179, le noir est plus lisible que le blanc
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((x) => { const u = x / 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const isLightColor = (rgb) => luminance(rgb) > 0.179;
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // En dessous, la couleur de texte du thème n'est plus lisible sur sa couleur principale
  // (le bleu par défaut de Home Assistant avec du blanc est à 2,6)
  const MIN_COUNT_CONTRAST = 2.5;

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
      /* Nombre d'entités allumées : couleurs du thème HA, remplacées par count_background / count_color */
      --rsc-count-tint: var(--primary-color, #03a9f4);
      --rsc-count-ink: var(--text-primary-color, #fff);
      --rsc-count-bg: linear-gradient(to bottom, color-mix(in srgb, var(--rsc-count-tint) 78%, #000), var(--rsc-count-tint) 80%);
      --rsc-count-face: linear-gradient(to bottom, var(--rsc-count-tint), color-mix(in srgb, var(--rsc-count-tint) 82%, #000));
      --rsc-count-color: var(--rsc-count-ink);
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
      display: grid;
      place-items: center;
      position: absolute;
      left: 50%;
      width: 4%;
      min-width: 3px;
      height: 14%;
      top: calc(var(--radius) * 0.13);
      padding: 0;
      overflow: hidden;
      white-space: nowrap;
      color: transparent;
      font: 700 max(10px, calc(var(--radius) * 0.13)) / 1 Roboto, "Segoe UI", sans-serif;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      background: var(--rsc-knob-color);
      border-radius: 9999px;
      box-shadow:
        0 0 1px rgb(0 0 0 / 40%),
        0 0 2px 1px rgb(0 0 0 / 20%),
        inset 0 1px 2px var(--rsc-knob-on),
        inset 0 -1px 2px var(--rsc-knob-on-darker),
        0 0 calc(var(--rsc-is-active) * 4px) var(--rsc-knob-on),
        0 0 calc(var(--rsc-is-active) * 16px) var(--rsc-knob-glow);
      transform: translateX(-50%) rotate(var(--rsc-v-rot, 0deg)) scale(var(--rsc-v-scale, 1));
      transition:
        width 0.3s cubic-bezier(0.34, 1.4, 0.5, 1),
        height 0.3s cubic-bezier(0.34, 1.4, 0.5, 1),
        top 0.3s cubic-bezier(0.34, 1.4, 0.5, 1),
        transform 0.4s var(--rsc-cubic),
        color 0.2s ease,
        background 0.3s ease;
    }
    .knob:active::after { --rsc-v-scale: 0.95; }

    /* Bouton fermé avec des entités allumées : le voyant s'élargit en un petit bouton légèrement
       enfoncé dans la face, le nombre incrusté dedans. Les chiffres restent droits quelle que soit
       l'orientation du bouton (contre-rotation).
       Couleurs : --rsc-count-tint (fond) et --rsc-count-ink (chiffre), thème HA ou choix de l'utilisateur.
       Par thème du bouton : --rsc-count-shadow (incrustation), --rsc-count-box (biseau du creux),
       --rsc-badge-shadow et --rsc-badge-box (pastille) */
    .selector.count-on:not(.active):not(.count-badge) .knob::after {
      --rsc-v-h: max(16px, calc(var(--radius) * 0.21));
      --rsc-v-rot: calc(-1 * var(--rsc-knob-rot, calc(var(--rsc-knob-angle, var(--rsc-angle)) + var(--rsc-angle-offset))));
      content: attr(data-count);
      width: calc(var(--rsc-v-h) * (0.62 + 0.38 * var(--rsc-v-digits, 1)));
      min-width: var(--rsc-v-h);
      height: var(--rsc-v-h);
      top: calc(var(--radius) * 0.2 - var(--rsc-v-h) / 2);
      padding-top: 1px;
      font-size: max(9px, calc(var(--radius) * 0.118));
      color: var(--rsc-count-color);
      text-shadow: var(--rsc-count-shadow, 0 -1px 0 rgb(0 0 0 / 0.55), 0 1px 0 rgb(255 255 255 / 0.12));
      background: var(--rsc-count-bg);
      box-shadow: var(--rsc-count-box,
        inset 0 2px 4px rgb(0 0 0 / 0.6),
        inset 0 -1px 1px rgb(255 255 255 / 0.16),
        0 1px 0 rgb(255 255 255 / 0.5),
        0 -1px 0 rgb(0 0 0 / 0.3));
      transition-delay: 0.15s, 0.15s, 0.15s, 0s, 0.15s, 0s;
    }
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
    /* Pendant le réglage, repère du bouton raccourci vers l'extérieur (place pour la valeur) */
    .selector.dimming .knob::after { height: 9%; top: calc(var(--radius) * 0.1); }
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
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: calc(var(--radius) * 0.035);
      pointer-events: none;
      font: 600 calc(var(--radius) * 0.17) / 1 Roboto, "Segoe UI", sans-serif;
      font-variant-numeric: tabular-nums;
      color: var(--rsc-pct-color);
      text-shadow: var(--rsc-pct-shadow);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .pct b { font-weight: 600; white-space: nowrap; }
    .pct b.s { font-size: 0.86em; }
    .pct b.xs { font-size: 0.7em; }
    .pct small {
      font-size: max(8px, calc(var(--radius) * 0.065));
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .pct .dots { display: flex; gap: 4px; }
    .pct .dots i {
      width: max(4px, calc(var(--radius) * 0.035));
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.3;
    }
    .pct .dots i.on { opacity: 1; }
    .selector.dimming .pct { opacity: 1; }
    /* Lumière : blanc chaud -> froid, puis teinte (appuis longs successifs) */
    .selector.mode-temp .arc-ring {
      background: conic-gradient(from 225deg, #ff9329 0deg, #ffc58f 70deg, #fff1e0 135deg, #e6efff 200deg, #a9c6ff 270deg, transparent 270deg 360deg);
    }
    .selector.mode-hue .arc-ring {
      background: conic-gradient(from 225deg, hsl(0 100% 55%) 0deg, hsl(60 100% 50%) 45deg, hsl(120 100% 45%) 90deg,
        hsl(180 100% 45%) 135deg, hsl(240 100% 62%) 180deg, hsl(300 100% 55%) 225deg, hsl(360 100% 55%) 270deg, transparent 270deg 360deg);
    }
    .selector.mode-temp .arc-ring, .selector.mode-hue .arc-ring {
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
    }

    /* ---------- Groupes : sous-cercle ouvert ---------- */
    .crumb {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: grid;
      place-items: center;
      pointer-events: none;
      color: var(--rsc-icon-color);
      opacity: 0;
      transform: scale(0.6);
      transition: opacity 0.25s ease, transform 0.3s ease;
    }
    .crumb .crumb-icon {
      --mdc-icon-size: calc(var(--radius) * 0.3);
      display: flex;
      filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.35));
    }
    .crumb .crumb-back {
      --mdc-icon-size: max(12px, calc(var(--radius) * 0.13));
      position: absolute;
      left: 50%;
      top: 69%;
      transform: translateX(-50%);
      display: flex;
      opacity: 0.75;
    }
    .selector.active.in-group .crumb { opacity: 0.9; transform: scale(1); }
    .selector.dimming .crumb { opacity: 0; }
    /* Repère discret sous l'icône d'un groupe (fermé) */
    li.group:not(.has-lvl) .icon::after {
      content: "";
      position: absolute;
      left: 50%;
      top: calc(50% + var(--radius) * 0.15);
      width: calc(var(--radius) * 0.13);
      height: max(3px, calc(var(--radius) * 0.03));
      transform: translateX(-50%);
      background: radial-gradient(circle closest-side, currentColor 70%, transparent 75%) 0 0 / 33.4% 100% repeat-x;
      opacity: 0.7;
    }

    /* ---------- Bouton fermé : nombre d'entités allumées et halo ---------- */
    .badge {
      position: absolute;
      top: -1%;
      right: -1%;
      z-index: 4;
      min-width: max(18px, calc(var(--radius) * 0.22));
      height: max(18px, calc(var(--radius) * 0.22));
      padding: 0 calc(var(--radius) * 0.05);
      box-sizing: border-box;
      border-radius: 9999px;
      display: grid;
      place-items: center;
      font: 700 max(10px, calc(var(--radius) * 0.12)) / 1 Roboto, "Segoe UI", sans-serif;
      font-variant-numeric: tabular-nums;
      color: var(--rsc-count-color);
      text-shadow: var(--rsc-badge-shadow, 0 1px 1px rgb(0 0 0 / 0.45));
      background: var(--rsc-count-face);
      box-shadow: var(--rsc-badge-box,
        0 0 0 2px var(--rsc-outer-bg),
        0 2px 5px rgb(0 0 0 / 0.4),
        inset 0 1px 0 rgb(255 255 255 / 0.3),
        inset 0 -1px 1px rgb(0 0 0 / 0.25));
      pointer-events: none;
      opacity: 0;
      transform: scale(0.3);
      transition: opacity 0.2s ease, transform 0.35s cubic-bezier(0.34, 1.6, 0.5, 1);
    }
    .selector.count-badge.count-on:not(.active) .badge { opacity: 1; transform: scale(1); transition-delay: 0.15s; }
    .halo {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 0;
      width: calc(100% + var(--radius) / 9 + 16px);
      aspect-ratio: 1 / 1;
      transform: translate(-50%, -50%);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s ease;
    }
    .halo-ring, .halo-glow {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: var(--rsc-halo, none);
    }
    .halo-ring {
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px));
    }
    .halo-glow {
      inset: -4px;
      filter: blur(5px);
      opacity: 0.75;
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 9px), #000 calc(100% - 4px), transparent 100%);
      mask: radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 9px), #000 calc(100% - 4px), transparent 100%);
    }
    .selector.halo-on:not(.active) .halo { opacity: 1; transition-delay: 0.25s; }

    /* ---------- Appui long au centre : onde de confirmation ---------- */
    .flash-ring {
      position: absolute;
      inset: 0;
      z-index: 3;
      border-radius: 50%;
      pointer-events: none;
    }
    @keyframes rsc-flash {
      0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--rsc-flash, var(--primary-color, #03a9f4)) 75%, transparent); }
      100% { box-shadow: 0 0 0 calc(var(--radius) * 0.45) transparent; }
    }
    .selector.flash .flash-ring { animation: rsc-flash 0.65s ease-out; }
    .selector.flash::after { transform: scale(0.94); }

    /* ---------- Mode nuit ---------- */
    .wrap { transition: filter 1.2s ease; }
    .wrap.night { filter: brightness(var(--rsc-night, 0.6)) saturate(0.8); }

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

    /* Nombre d'entités allumées : les couleurs suivent le thème HA (ou le choix de l'utilisateur),
       le relief du creux et de la pastille reste adapté à chaque thème du bouton */
    .wrap.skin-ha {
      --rsc-count-shadow: 0 -1px 0 rgb(0 0 0 / 0.35);
      --rsc-count-box: inset 0 2px 3px rgb(0 0 0 / 0.45), inset 0 -1px 1px rgb(255 255 255 / 0.2), 0 1px 0 color-mix(in srgb, var(--card-background-color, #fff) 70%, #fff), 0 -1px 0 rgb(0 0 0 / 0.18);
      --rsc-badge-shadow: none;
    }
    .wrap.skin-glass {
      --rsc-count-shadow: 0 -1px 0 rgb(0 0 0 / 0.3);
      --rsc-count-box: inset 0 2px 3px rgb(0 0 0 / 0.32), inset 0 -1px 1px rgb(255 255 255 / 0.5), 0 1px 0 rgb(255 255 255 / 0.75), 0 -1px 0 rgb(0 0 0 / 0.14);
      --rsc-badge-box: 0 0 0 1px rgb(255 255 255 / 0.6), 0 3px 8px rgb(0 0 0 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.5);
    }
    .wrap.skin-neumorph {
      --rsc-count-shadow: none;
      --rsc-count-box: inset 2px 2px 5px var(--rsc-neu-d), inset -2px -2px 4px var(--rsc-neu-l);
      --rsc-badge-shadow: none;
      --rsc-badge-box: -2px -2px 5px var(--rsc-neu-l), 3px 3px 6px var(--rsc-neu-d), inset 0 1px 0 rgb(255 255 255 / 0.12), 0 0 0 1px color-mix(in srgb, var(--rsc-neu) 85%, #fff);
    }
    .wrap.skin-brass {
      --rsc-count-shadow: 0 -1px 0 rgb(0 0 0 / 0.5);
      --rsc-count-box: inset 0 2px 3px rgb(0 0 0 / 0.7), inset 0 -1px 1px rgb(246 216 146 / 0.18), 0 1px 0 rgb(255 236 190 / 0.6), 0 -1px 0 rgb(0 0 0 / 0.4);
      --rsc-badge-box: 0 0 0 2px var(--rsc-outer-bg), 0 2px 5px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 248 220 / 0.5), inset 0 -1px 1px rgb(110 79 28 / 0.6);
    }
    .wrap.skin-carbon {
      --rsc-count-shadow: 0 -1px 0 rgb(0 0 0 / 0.6);
      --rsc-count-box: inset 0 2px 3px rgb(0 0 0 / 0.7), inset 0 -1px 1px rgb(255 255 255 / 0.18), 0 1px 0 rgb(255 255 255 / 0.16), 0 -1px 0 #000, 0 0 7px color-mix(in srgb, var(--rsc-count-tint) 35%, transparent);
      --rsc-badge-box: 0 0 0 2px var(--rsc-outer-bg), 0 0 9px color-mix(in srgb, var(--rsc-count-tint) 50%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.3);
    }
    .wrap.skin-neon {
      --rsc-count-shadow: 0 0 4px color-mix(in srgb, var(--rsc-count-ink) 60%, transparent);
      --rsc-count-box: inset 0 0 0 1px color-mix(in srgb, var(--rsc-count-tint) 70%, #fff), inset 0 2px 5px rgb(0 0 0 / 0.4), 0 0 6px color-mix(in srgb, var(--rsc-count-tint) 40%, transparent);
      --rsc-badge-shadow: 0 0 4px color-mix(in srgb, var(--rsc-count-ink) 60%, transparent);
      --rsc-badge-box: 0 0 0 2px var(--rsc-outer-bg), 0 0 0 3px var(--rsc-count-tint), 0 0 12px color-mix(in srgb, var(--rsc-count-tint) 55%, transparent);
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

  // ---------- Traductions (suit la langue de Home Assistant ; anglais par défaut) ----------
  const I18N = {
    fr: {
      selector: 'Sélecteur', back: 'Retour', button: 'Bouton', entity_fb: 'Entité',
      m_brightness: 'Luminosité', m_temp: 'Blanc', m_hue: 'Couleur',
      err_config: 'radial-selector-card : configuration invalide.',
      err_items: 'radial-selector-card : "items" (entités du cercle) doit contenir entre 2 et 10 entrées.',
      stub_name: 'Éclairage', stub_1: 'Séjour', stub_2: 'Salon', stub_3: 'Cuisine', stub_4: 'Entrée', stub_5: 'Chambre', stub_6: 'Terrasse', stub_covers: 'Volets',
      card_desc: 'Sélecteur rotatif : entités en cercle, groupes, molette (luminosité, couleur, volume, volets, thermostat), boutons de coin et ligne de boutons.',

      sec_general: 'Paramètres généraux', card_name: 'Nom de la carte', card_name_ph: 'Éclairage',
      auto_close: 'Réduction automatique (secondes, 0 = jamais)', size: 'Taille du bouton central (px)', auto: 'Auto',
      theme: 'Thème', theme_auto: 'Auto (thème HA)', theme_dark: 'Sombre', theme_light: 'Clair',
      show_label: 'Afficher le libellé sous le cercle',
      close_on_select: 'Réduire immédiatement après une sélection',
      show_brightness: 'Afficher la valeur sous l\'icône (luminosité, volume, position, consigne…)',
      show_count: 'Afficher le nombre d\'entités allumées sur le bouton fermé',
      show_halo: 'Halo coloré des entrées allumées autour du bouton fermé',
      haptics: 'Retour haptique (vibration) sur écran tactile',

      sec_knob: 'Style du bouton', knob_theme: 'Thème du bouton',
      skin_metal: 'Métal brossé (défaut)', skin_ha: 'Thème Home Assistant (suit le thème actif)', skin_glass: 'Verre dépoli',
      skin_neumorph: 'Doux (relief mat)', skin_brass: 'Laiton vintage', skin_carbon: 'Carbone', skin_neon: 'Néon',
      open_animation: 'Animation d\'ouverture',
      anim_fan: 'Éventail (défaut)', anim_bloom: 'Éclosion', anim_spiral: 'Spirale', anim_cascade: 'Cascade', anim_pop: 'Rebond', anim_fade: 'Fondu', anim_none: 'Aucune',
      palette: 'Couleurs des entrées sans couleur choisie', pal_rainbow: 'Arc-en-ciel (défaut)', pal_theme: 'Couleur principale du thème HA',
      zone_opacity: 'Remplissage de la zone survolée :',
      knob_hint: '« Thème Home Assistant » reprend les couleurs du thème actif et change avec lui. Si « réduire les animations » est activé sur l\'appareil, l\'ouverture se fait en fondu.',

      sec_center: 'Bouton central', center_hold: 'Appui long sur le bouton central',
      count_position: 'Nombre d\'entités allumées', cp_knob: 'Dans le voyant du bouton (défaut)', cp_badge: 'Pastille dans le coin',
      count_background: 'Fond du nombre', count_color: 'Couleur du chiffre',
      count_hint: 'Vides, ces deux couleurs suivent le thème Home Assistant actif (couleur principale et son texte). Sans couleur de chiffre, celui-ci passe en noir ou en blanc si le texte du thème est peu lisible, ou si seul le fond est choisi.',
      c_none: 'Aucune action (défaut)', c_all_off: 'Tout éteindre (entités du cercle)', c_popup: 'Ouvrir une pop-up (#…)',
      c_navigate: 'Aller à une vue / une page', c_scene: 'Activer une scène', c_custom: 'Personnalisée (YAML)',
      center_hint: 'Un appui simple ouvre ou ferme le cercle (ou revient en arrière dans un groupe). « Tout éteindre » concerne les lumières, prises, ventilateurs et interrupteurs virtuels du cercle et de ses groupes.',
      popup_hash: 'Pop-up (hash Bubble Card)', path: 'Chemin', scene: 'Scène',
      custom_hint: 'Action définie en YAML : elle est conservée telle quelle.',

      sec_night: 'Mode nuit', night_mode: 'Activation',
      n_off: 'Désactivé (défaut)', n_sun: 'Au coucher du soleil', n_entity: 'Quand une entité est allumée', n_always: 'Toujours',
      night_entity: 'Entité (ex. input_boolean.nuit)', night_level: 'Luminosité de la carte la nuit :',
      night_hint: 'Les couleurs de la carte sont atténuées pour ne pas éblouir (écran mural, chambre).',

      sec_sync: 'Bouton rotatif physique', sync_entity: 'Synchroniser avec (aide Texte ou Liste déroulante)',
      sync_open: 'Ouvrir la carte quand on tourne le bouton physique',
      sync_hint: 'À utiliser avec le blueprint « bouton rotatif jumeau » : la carte pointe l\'entrée choisie au bouton, et un appui sur une entrée de la carte la fait piloter par le bouton.',

      sec_card: 'Apparence de la carte', card_style: 'Fond et contour',
      cs_border_only: 'Contour sans fond (défaut)', cs_standard: 'Fond + contour (thème HA)', cs_background_only: 'Fond sans contour', cs_transparent: 'Transparente (ni fond ni contour)',
      card_background: 'Couleur du fond', card_border_color: 'Couleur du contour', theme_ha: 'Thème HA',

      sec_items: 'Entités dans le cercle ({n}/10)', add: '+ Ajouter',
      items_hint: 'Entre 2 et 10 entrées autour du cadran. Couleur vide : arc-en-ciel selon la position.',
      hold_hint: 'Appui long = molette : luminosité, volume, position de volet, consigne de thermostat, vitesse de ventilateur, valeur numérique. Sur une lumière couleur, appuis longs successifs : luminosité → blanc → couleur.',
      item_title: 'Position cercle #{n}', sub_title: 'Entrée #{n}', entity: 'Entité',
      name_opt: 'Nom (optionnel)', name_ph: 'Nom de l\'entité', icon_opt: 'Icône (optionnel)',
      color: 'Couleur', color_auto: 'Auto (arc-en-ciel)', hold: 'Appui long',
      hold_auto: 'Molette si possible (défaut)', hold_force: 'Molette forcée (lumière)', hold_off: 'Fenêtre d\'infos HA',
      is_group: 'Groupe : ouvre un sous-cercle d\'entrées',
      group_hint: 'Appui = ouvre le groupe ; appui sur le bouton central = retour. Entité du groupe facultative (ex. un groupe de lumières HA) : sans entité, l\'appui long allume ou éteint tout le groupe.',
      sub_items: 'Entrées du groupe ({n}/10)',

      sec_extra: 'Boutons dans les coins ({n}/4)', extra_hint: 'Accès direct, même cadran fermé : pop-up Bubble Card, vue, appareil…',
      no_extra: 'Aucun bouton de coin.', extra_title: 'Bouton de coin #{n}',
      extra_entity_hint: 'L\'entité sert au voyant (allumé / éteint) et à la fenêtre d\'infos ; elle est facultative.',
      name_tip: 'Nom / info-bulle', name_auto: 'Nom auto', icon: 'Icône', corner: 'Coin',
      pos_auto: 'Auto (premier coin libre)', 'pos_bottom-right': 'Bas droite', 'pos_bottom-left': 'Bas gauche', 'pos_top-right': 'Haut droite', 'pos_top-left': 'Haut gauche',
      style: 'Style', st_tile: 'Tuile', st_metal: 'Métal', colors: 'Couleurs', c_on: 'Allumé', c_off: 'Éteint', c_bg: 'Fond de la tuile', theme_ph: 'Thème',

      sec_rows: 'Entités en ligne en dessous ({n})', rows_hint: 'Boutons d\'accès rapide alignés sous le cercle.',
      no_rows: 'Aucune entité en ligne.', row_title: 'Bouton en ligne #{n}',

      tap_action: 'Action à l\'appui', a_default: 'Par défaut ({d})', a_popup: 'Ouvrir une pop-up (#…)', a_navigate: 'Aller à une vue / une page',
      a_toggle: 'Allumer / éteindre', 'a_more-info': 'Fenêtre d\'infos HA', a_all_off: 'Tout éteindre (entités du cercle)', a_none: 'Aucune', a_custom: 'Personnalisée (YAML)',
      def_toggle: 'allumer / éteindre', def_more: 'fenêtre d\'infos',
      up: 'Monter', down: 'Descendre', delete: 'Supprimer', clear: 'Couleur par défaut',
    },
    en: {
      selector: 'Selector', back: 'Back', button: 'Button', entity_fb: 'Entity',
      m_brightness: 'Brightness', m_temp: 'White', m_hue: 'Color',
      err_config: 'radial-selector-card: invalid configuration.',
      err_items: 'radial-selector-card: "items" (dial entities) must contain between 2 and 10 entries.',
      stub_name: 'Lighting', stub_1: 'Living room', stub_2: 'Lounge', stub_3: 'Kitchen', stub_4: 'Hallway', stub_5: 'Bedroom', stub_6: 'Terrace', stub_covers: 'Shutters',
      card_desc: 'Rotary selector: entities around a dial, groups, rotary control (brightness, color, volume, covers, thermostat), corner buttons and a row of buttons.',

      sec_general: 'General settings', card_name: 'Card name', card_name_ph: 'Lighting',
      auto_close: 'Auto-collapse (seconds, 0 = never)', size: 'Center knob size (px)', auto: 'Auto',
      theme: 'Theme', theme_auto: 'Auto (HA theme)', theme_dark: 'Dark', theme_light: 'Light',
      show_label: 'Show the label under the dial',
      close_on_select: 'Collapse right after a selection',
      show_brightness: 'Show the value under the icon (brightness, volume, position, setpoint…)',
      show_count: 'Show how many entities are on, on the closed knob',
      show_halo: 'Colored halo of the entries that are on, around the closed knob',
      haptics: 'Haptic feedback (vibration) on touch screens',

      sec_knob: 'Knob style', knob_theme: 'Knob theme',
      skin_metal: 'Brushed metal (default)', skin_ha: 'Home Assistant theme (follows the active theme)', skin_glass: 'Frosted glass',
      skin_neumorph: 'Soft (neumorphic)', skin_brass: 'Vintage brass', skin_carbon: 'Carbon', skin_neon: 'Neon',
      open_animation: 'Opening animation',
      anim_fan: 'Fan (default)', anim_bloom: 'Bloom', anim_spiral: 'Spiral', anim_cascade: 'Cascade', anim_pop: 'Pop', anim_fade: 'Fade', anim_none: 'None',
      palette: 'Colors of entries without a chosen color', pal_rainbow: 'Rainbow (default)', pal_theme: 'HA theme primary color',
      zone_opacity: 'Hovered zone fill:',
      knob_hint: '"Home Assistant theme" uses the colors of the active theme and changes with it. If "reduce motion" is enabled on the device, the dial opens with a fade.',

      sec_center: 'Center knob', center_hold: 'Long press on the center knob',
      count_position: 'Number of entities on', cp_knob: 'Inside the knob indicator (default)', cp_badge: 'Corner badge',
      count_background: 'Number background', count_color: 'Digit color',
      count_hint: 'Left empty, both colors follow the active Home Assistant theme (primary color and its text). Without a digit color, the digit turns black or white if the theme\'s text is hard to read, or if only the background is set.',
      c_none: 'No action (default)', c_all_off: 'Turn everything off (dial entities)', c_popup: 'Open a pop-up (#…)',
      c_navigate: 'Go to a view / page', c_scene: 'Activate a scene', c_custom: 'Custom (YAML)',
      center_hint: 'A short press opens or closes the dial (or goes back inside a group). "Turn everything off" applies to the lights, switches, fans and input booleans of the dial and its groups.',
      popup_hash: 'Pop-up (Bubble Card hash)', path: 'Path', scene: 'Scene',
      custom_hint: 'Action defined in YAML: it is kept as is.',

      sec_night: 'Night mode', night_mode: 'Activation',
      n_off: 'Off (default)', n_sun: 'After sunset', n_entity: 'When an entity is on', n_always: 'Always',
      night_entity: 'Entity (e.g. input_boolean.night)', night_level: 'Card brightness at night:',
      night_hint: 'The card\'s colors are dimmed so they don\'t dazzle (wall screen, bedroom).',

      sec_sync: 'Physical rotary knob', sync_entity: 'Sync with (text or dropdown helper)',
      sync_open: 'Open the card when the physical knob is turned',
      sync_hint: 'Use with the "physical knob twin" blueprint: the card points at the entry chosen with the knob, and tapping an entry in the card makes the knob control it.',

      sec_card: 'Card appearance', card_style: 'Background and border',
      cs_border_only: 'Border, no background (default)', cs_standard: 'Background + border (HA theme)', cs_background_only: 'Background, no border', cs_transparent: 'Transparent (no background, no border)',
      card_background: 'Background color', card_border_color: 'Border color', theme_ha: 'HA theme',

      sec_items: 'Dial entities ({n}/10)', add: '+ Add',
      items_hint: 'Between 2 and 10 entries around the dial. Empty color: rainbow by position.',
      hold_hint: 'Long press = rotary control: brightness, volume, cover position, thermostat setpoint, fan speed, number value. On a color light, successive long presses: brightness → white → color.',
      item_title: 'Dial position #{n}', sub_title: 'Entry #{n}', entity: 'Entity',
      name_opt: 'Name (optional)', name_ph: 'Entity name', icon_opt: 'Icon (optional)',
      color: 'Color', color_auto: 'Auto (rainbow)', hold: 'Long press',
      hold_auto: 'Rotary control when possible (default)', hold_force: 'Force rotary control (light)', hold_off: 'HA more-info dialog',
      is_group: 'Group: opens a sub-dial of entries',
      group_hint: 'Tap = opens the group; tap on the center knob = back. Optional group entity (e.g. an HA light group): without an entity, a long press turns the whole group on or off.',
      sub_items: 'Group entries ({n}/10)',

      sec_extra: 'Corner buttons ({n}/4)', extra_hint: 'Direct access, even with the dial closed: Bubble Card pop-up, view, device…',
      no_extra: 'No corner button.', extra_title: 'Corner button #{n}',
      extra_entity_hint: 'The entity drives the indicator (on / off) and the more-info dialog; it is optional.',
      name_tip: 'Name / tooltip', name_auto: 'Auto name', icon: 'Icon', corner: 'Corner',
      pos_auto: 'Auto (first free corner)', 'pos_bottom-right': 'Bottom right', 'pos_bottom-left': 'Bottom left', 'pos_top-right': 'Top right', 'pos_top-left': 'Top left',
      style: 'Style', st_tile: 'Tile', st_metal: 'Metal', colors: 'Colors', c_on: 'On', c_off: 'Off', c_bg: 'Tile background', theme_ph: 'Theme',

      sec_rows: 'Row of entities below ({n})', rows_hint: 'Quick-access buttons lined up under the dial.',
      no_rows: 'No row entity.', row_title: 'Row button #{n}',

      tap_action: 'Tap action', a_default: 'Default ({d})', a_popup: 'Open a pop-up (#…)', a_navigate: 'Go to a view / page',
      a_toggle: 'Turn on / off', 'a_more-info': 'HA more-info dialog', a_all_off: 'Turn everything off (dial entities)', a_none: 'None', a_custom: 'Custom (YAML)',
      def_toggle: 'turn on / off', def_more: 'more-info dialog',
      up: 'Move up', down: 'Move down', delete: 'Delete', clear: 'Default color',
    },
  };

  const langOf = (hass) => {
    const l = String((hass && ((hass.locale && hass.locale.language) || hass.language))
      || (typeof navigator !== 'undefined' && navigator.language) || 'en').toLowerCase();
    return l.startsWith('fr') ? 'fr' : 'en';
  };

  const tr = (lang, key, vars) => {
    let s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
    return s;
  };

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

  // Groupe : entrée qui ouvre un sous-cercle (items: [...])
  const isGroup = (it) => !!it && Array.isArray(it.items) && it.items.length > 0;

  // Normalise les entrées du cercle et leurs sous-groupes (10 entrées max par cercle)
  const normalizeTree = (list, depth = 0) => [].concat(list || []).map((it) => normalizeItem(it)).filter(Boolean).map((it) => {
    if (!Array.isArray(it.items)) return it;
    const kids = depth < 3 ? normalizeTree(it.items, depth + 1).slice(0, 10) : [];
    const { items, ...rest } = it;
    return kids.length ? { ...rest, items: kids } : rest;
  });

  // Entités « feuilles » d'une liste (les sous-groupes sont parcourus)
  const leaves = (list, out = []) => {
    (list || []).forEach((it) => {
      if (isGroup(it)) leaves(it.items, out);
      else if (it && it.entity) out.push(String(it.entity));
    });
    return out;
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r2 = (x) => Math.round(x * 100) / 100;

  // Valeur réglée par la molette, arrondie au pas de l'appareil
  const quant = (ctl, frac) => {
    const raw = ctl.min + clamp(frac, 0, 1) * (ctl.max - ctl.min);
    const v = ctl.min + Math.round((raw - ctl.min) / ctl.step) * ctl.step;
    return clamp(Number(v.toFixed(6)), ctl.min, ctl.max);
  };
  const fracOf = (ctl, v) => (ctl.max > ctl.min ? clamp((v - ctl.min) / (ctl.max - ctl.min), 0, 1) : 0);
  const decimals = (step) => (step < 1 ? Math.min(3, (String(step).split('.')[1] || '').length) : 0);

  // Couleur approximative d'une température de blanc (K)
  const kelvinRgb = (k) => {
    const t = k / 100;
    let r; let g; let b;
    if (t <= 66) {
      r = 255;
      g = 99.4708 * Math.log(t) - 161.1196;
      b = t <= 19 ? 0 : 138.5177 * Math.log(t - 10) - 305.0448;
    } else {
      r = 329.6987 * Math.pow(t - 60, -0.1332);
      g = 288.1222 * Math.pow(t - 60, -0.0755);
      b = 255;
    }
    const c = (x) => Math.round(clamp(x, 0, 255));
    return `rgb(${c(r)} ${c(g)} ${c(b)})`;
  };

  // « Tout éteindre » (appui long au centre) : domaines concernés
  const ALL_OFF_DOMAINS = ['light', 'switch', 'fan', 'input_boolean'];
  // Appui long sur un groupe sans entité : domaines jamais basculés
  const NO_TOGGLE = ['scene', 'script', 'button', 'input_button', 'lock', 'sensor', 'binary_sensor', 'camera', 'sun', 'weather', 'person', 'zone'];
  const COLOR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
  const HOLD_MS = 500;
  const CENTER_HOLD_MS = 600;
  const MODE_WINDOW = 3000;     // appuis longs successifs sur une lumière : luminosité -> blanc -> couleur
  const VIBRATE = { selection: 6, light: 10, medium: 18, heavy: 30, success: [12, 40, 12], warning: [20, 60, 20], failure: [30, 50, 30] };

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
      this._lastFinger = 0;    // dernier geste au doigt (retour haptique)
      this._lastDrag = 0;
      this._knobHeld = false;
      this._autoClose = 10;
      this._closeTimer = null;
      this._armedAt = 0;
      this._path = [];         // groupes ouverts (indices), [] = cercle principal
      this._ringKey = '';
      this._lastMode = null;
      this._uid = Math.random().toString(36).slice(2, 8);
    }

    connectedCallback() {
      if (this._open) this._armClose();
      this._refreshCountInk();
    }
    disconnectedCallback() { clearTimeout(this._closeTimer); this._closeTimer = null; }

    _t(key, vars) { return tr(langOf(this._hass), key, vars); }

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
      const L = langOf(hass);
      const t = (k) => tr(L, k);
      // Si possible, part des vraies lumières de l'installation
      const lights = hass && hass.states ? Object.keys(hass.states).filter((e) => e.startsWith('light.')).slice(0, 6) : [];
      if (lights.length >= 2) {
        return { name: t('stub_name'), auto_close: 10, items: lights.map((entity) => ({ entity })) };
      }
      return {
        name: t('stub_name'),
        auto_close: 10,
        show_label: true,
        items: [
          { name: t('stub_1'), icon: 'mdi:table-furniture', entity: 'light.sejour' },
          { name: t('stub_2'), icon: 'mdi:sofa', entity: 'light.salon' },
          { name: t('stub_3'), icon: 'mdi:silverware-fork-knife', entity: 'light.cuisine' },
          { name: t('stub_4'), icon: 'mdi:door', entity: 'light.entree' },
          { name: t('stub_5'), icon: 'mdi:bed', entity: 'light.chambre' },
          { name: t('stub_6'), icon: 'mdi:outdoor-lamp', entity: 'light.terrasse' },
        ],
        row_items: [
          { name: 'TV', icon: 'mdi:television', entity: 'media_player.tv', style: 'tile' },
          { name: t('stub_covers'), icon: 'mdi:window-shutter', entity: 'cover.volets', style: 'tile' },
        ],
      };
    }

    setConfig(config) {
      if (!config) {
        throw new Error(this._t('err_config'));
      }
      // Même configuration qu'avant (l'éditeur renvoie souvent la même) : rien à reconstruire
      let key = null;
      try { key = JSON.stringify(config); } catch (e) { key = null; }
      if (key && key === this._cfgKey && this._wrap) return;

      const rawItems = normalizeTree(config.items || config.circle_entities || []);
      if (rawItems.length < 2 || rawItems.length > 10) {
        throw new Error(this._t('err_items'));
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
      this._cfgKey = key;

      const ac = config.auto_close === false ? 0 : Number(config.auto_close ?? 10);
      this._autoClose = Number.isFinite(ac) && ac >= 0 ? ac : 10;
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
      this._open = false;
      this._selected = 0;
      this._hover = null;
      this._path = [];
      this._lastMode = null;
      this._haloKey = null;
      this._syncSeen = undefined;   // dernière valeur lue dans l'aide de synchronisation
      this._syncWrote = null;       // valeur écrite par la carte (son écho ne doit pas rouvrir la carte)
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
      if (!cfg) return fallback;
      if (cfg.name) return cfg.name;
      if (this._hass && cfg.entity && this._hass.states[cfg.entity]) {
        const attrs = this._hass.states[cfg.entity].attributes;
        if (attrs && attrs.friendly_name) return attrs.friendly_name;
      }
      return cfg.entity || fallback;
    }

    _build() {
      const c = this._config;
      const size = Number(c.size);
      const stageStyle = size > 0 ? ` style="--radius:${size}px"` : '';

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
        <button class="${cls}" data-x="${j}" style="${vars.join(';')}" aria-label="${esc(this._getEntityName(b, this._t('button')))}" title="${esc(this._getEntityName(b))}">
          <ha-icon data-x-icon="${j}" icon="${esc(this._getEntityIcon(b, 'mdi:power'))}"></ha-icon>
        </button>`;
      }).join('');

      const rbtns = c.row_items.map((b, k) => {
        const vars = btnVars(b);
        const cls = ['rbtn', b.style === 'tile' ? 'tile' : '', b.entity ? 'has-state' : '', b.off_color ? 'has-off' : ''].filter(Boolean).join(' ');
        return `
        <div class="bottom-item">
          <button class="${cls}" data-r="${k}" style="${vars.join(';')}" aria-label="${esc(this._getEntityName(b, this._t('entity_fb')))}" title="${esc(this._getEntityName(b))}">
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
          <div class="wrap skin-${this._skin()}" style="${this._countStyle()}">
            <div class="stage"${stageStyle}>
              <div class="selector anim-${this._anim()}">
                <div class="halo" aria-hidden="true"><div class="halo-glow"></div><div class="halo-ring"></div></div>
                <div class="knob" role="button" tabindex="0" aria-expanded="false" aria-label="${esc(c.name || this._t('selector'))}"></div>
                <ul></ul>
                <div class="arc"><div class="arc-ring"></div><div class="tick"></div></div>
                <div class="pct"></div>
                <div class="crumb" aria-hidden="true"><ha-icon class="crumb-icon" icon="mdi:folder-multiple-outline"></ha-icon><ha-icon class="crumb-back" icon="mdi:arrow-u-left-top"></ha-icon></div>
                <div class="flash-ring" aria-hidden="true"></div>
                <span class="badge" aria-hidden="true"></span>
              </div>
              <div class="frame">${xbtns}</div>
            </div>
            <div class="label"></div>
            ${bottomRowHtml}
          </div>
        </ha-card>`;

      const root = this.shadowRoot;
      this._wrap = root.querySelector('.wrap');
      this._countKey = null;
      this._sel = root.querySelector('.selector');
      this._knob = root.querySelector('.knob');
      this._label = root.querySelector('.label');
      this._pct = root.querySelector('.pct');
      this._ul = root.querySelector('ul');
      this._arc = root.querySelector('.arc');
      this._crumb = root.querySelector('.crumb');
      this._badge = root.querySelector('.badge');
      this._halo = root.querySelector('.halo');

      const bindBtnEvents = (el, cfg, defaultTapAction) => {
        let timer = null;
        let held = false;
        const clear = () => { clearTimeout(timer); timer = null; };
        el.addEventListener('pointerdown', (ev) => {
          held = false;
          clear();
          if (ev.pointerType === 'touch') this._lastFinger = Date.now();
          timer = setTimeout(() => { timer = null; held = true; this._haptic('medium'); this._runBtn(cfg, 'hold', defaultTapAction); }, HOLD_MS);
        });
        el.addEventListener('pointerup', clear);
        el.addEventListener('pointerleave', clear);
        el.addEventListener('pointercancel', clear);
        el.addEventListener('contextmenu', (ev) => ev.preventDefault());
        el.addEventListener('click', (ev) => {
          if (held) { held = false; ev.preventDefault(); return; }
          this._haptic('light');
          this._runBtn(cfg, 'tap', defaultTapAction);
        });
      };

      // Boutons satellites (coins)
      this._xbtns = [...root.querySelectorAll('.xbtn')].map((el, j) => ({ el, cfg: c.extra_buttons[j] }));
      this._xbtns.forEach(({ el, cfg }) => bindBtnEvents(el, cfg, 'more-info'));

      // Boutons en ligne en dessous (row_items : par défaut toggle au clic simple)
      this._rbtns = [...root.querySelectorAll('.rbtn')].map((el, k) => ({ el, cfg: c.row_items[k] }));
      this._rbtns.forEach(({ el, cfg }) => bindBtnEvents(el, cfg, 'toggle'));

      // Bouton central : appui = ouvrir / fermer (ou revenir en arrière dans un groupe),
      // appui long = action globale (center_hold_action)
      const kn = this._knob;
      let kTimer = null;
      let kx = 0;
      let ky = 0;
      const kClear = () => { clearTimeout(kTimer); kTimer = null; };
      kn.addEventListener('pointerdown', (e) => {
        kClear();
        this._knobHeld = false;
        if (!this._centerAction() || (e.pointerType === 'mouse' && e.button !== 0)) return;
        kx = e.clientX; ky = e.clientY;
        kTimer = setTimeout(() => { kTimer = null; this._centerHold(); }, CENTER_HOLD_MS);
      });
      kn.addEventListener('pointermove', (e) => { if (kTimer && Math.hypot(e.clientX - kx, e.clientY - ky) > 8) kClear(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => kn.addEventListener(t, kClear));
      kn.addEventListener('contextmenu', (e) => { if (this._centerAction()) e.preventDefault(); });
      kn.addEventListener('click', () => {
        // le « click » qui suit un appui long au centre ne doit pas ouvrir / fermer
        if (this._knobHeld) { this._knobHeld = false; return; }
        if (Date.now() - this._lastDrag < 500) return;
        this._knobTap();
      });
      kn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._knobTap(); }
      });

      const sel = this._sel;
      // Doigt et souris passent par les zones (secteurs) : toute la zone d'une entrée réagit,
      // pas seulement son icône (appui, appui long / variateur, survol)
      sel.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') this._lastFinger = Date.now();
        this._bump();
        this._ptr = { x: e.clientX, y: e.clientY };
        this._touchDown(e);
        this._mouseDown(e);
      });
      sel.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') this._lastFinger = Date.now();
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
      // Échap : revenir en arrière dans un groupe, sinon fermer.
      // Toute touche relance la réduction automatique, comme un geste à la souris ou au doigt.
      sel.addEventListener('keydown', (e) => {
        this._bump();
        if (e.key === 'Escape' && this._open) { e.preventDefault(); this._knobTap(); }
      });

      this._buildRing();
      this._updateLabel();
    }

    // Liste affichée : cercle principal ou sous-cercle du groupe ouvert
    _level() {
      let list = this._config.items;
      let parent = null;
      const ok = [];
      for (const i of this._path) {
        const it = list[i];
        if (!isGroup(it)) break;
        parent = it;
        list = it.items;
        ok.push(i);
      }
      this._path = ok;
      return { list, parent };
    }

    // (Re)construit les entrées du cercle affiché
    _buildRing() {
      const { list, parent } = this._level();
      this._items = list;
      this._parent = parent;
      this._ringKey = this._path.join('/');
      const n = list.length;
      this._step = 360 / n;
      this._colors = list.map((_, i) => this._itemColors(i));

      // Zones tactiles : un secteur de 360°/n par entrée, centré sur son icône, séparé des voisins
      // par un trait ; la zone se remplit de la couleur de l'entrée sous la souris ou le doigt
      const S = this._step;
      const zoneOp = this._zoneOpacity();
      const zones = list.map((_, i) => `<div class="zone" style="--rsc-zc:${this._colors[i].c};background:conic-gradient(from ${r2(S * i - S / 2)}deg, transparent 0deg 0.4deg, var(--rsc-zc) 1.2deg ${r2(S - 1.2)}deg, transparent ${r2(S - 0.4)}deg)"></div>`).join('')
        + (n > 1 ? list.map((_, i) => `<div class="sep" style="transform:rotate(${r2(S * i - S / 2)}deg)"></div>`).join('') : '');

      const lis = list.map((it, i) => `
        <li data-index="${i}" class="${isGroup(it) ? 'group' : ''}" style="--rsc-n:${i + 1};--rsc-rot:${this._step * i}deg;--rsc-c:${this._colors[i].c};--rsc-cd:${this._colors[i].d};--rsc-ci:${this._colors[i].i}">
          <div class="icon"><ha-icon data-circle-icon="${i}" icon="${esc(this._getEntityIcon(it, isGroup(it) ? 'mdi:folder-multiple-outline' : 'mdi:lightbulb'))}"></ha-icon><span class="lvl" aria-hidden="true"></span></div>
          <input type="radio" name="rsc-${this._uid}" aria-label="${esc(this._getEntityName(it))}" ${i === 0 ? 'checked' : ''}>
        </li>`).join('');

      this._ul.innerHTML = `<div class="zones" aria-hidden="true" style="--rsc-zone-a-hot:${zoneOp}">${zones}</div>${lis}`;
      this._lis = [...this._ul.querySelectorAll('li')];
      this._zones = [...this._ul.querySelectorAll('.zone')];
      this._radios = [...this._ul.querySelectorAll('input[type="radio"]')];

      // Les icônes (boutons radio) ne servent plus qu'au clavier : Tab puis Espace / Entrée.
      // Un clic souris ou un appui tactile a déjà été traité par la zone.
      this._radios.forEach((radio, i) => {
        radio.addEventListener('click', (ev) => {
          if (this._suppressClick || Date.now() - this._lastTouch < 700) { ev.preventDefault(); return; }
          this._activate(i);
        });
        // Clavier : flèches = se déplacer (sans rien activer), Entrée / Espace = activer
        radio.addEventListener('keydown', (ev) => {
          const n = this._radios.length;
          let to = null;
          if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') to = (i + 1) % n;
          else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') to = (i - 1 + n) % n;
          else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this._activate(i); return; }
          if (to == null) return;
          ev.preventDefault();
          this._radios[to].focus();
        });
        radio.addEventListener('focus', () => {
          let kbd = true;
          try { kbd = radio.matches(':focus-visible'); } catch (e) { /* ancien navigateur */ }
          if (kbd && this._open && !this._mouse && !this._touch && Date.now() - this._lastTouch > 700) this._setHover(i);
        });
        radio.addEventListener('blur', () => { if (this._hover === i && !this._mouse && !this._touch) this._setHover(null); });
      });

      // Groupe ouvert : son icône au centre du bouton (appui sur le bouton = retour)
      this._sel.classList.toggle('in-group', !!parent);
      const ci = this._crumb.querySelector('.crumb-icon');
      if (parent) ci.setAttribute('icon', this._getEntityIcon(parent, 'mdi:folder-multiple-outline'));
      this._knob.setAttribute('aria-label', parent
        ? `${this._t('back')} (${this._getEntityName(parent, '')})`
        : (this._config.name || this._t('selector')));

      this._hover = null;
      this._select(0);
    }

    // Change de cercle (entrée / sortie d'un groupe) en rejouant l'animation d'ouverture
    _rebuildRing() {
      if (this._dim) this._dimEnd();
      this._touchEnd();
      this._mouseEnd();
      const open = this._open;
      if (open) this._sel.classList.remove('active');
      this._buildRing();
      this._updateStates();
      if (open) {
        void this._sel.offsetWidth;     // repart de l'état fermé pour animer les nouvelles icônes
        this._sel.classList.add('active');
      }
      this._updateLabel();
      this._armClose();
    }

    _enter(i) {
      this._path = [...this._path, i];
      this._haptic('light');
      this._rebuildRing();
    }

    _back() {
      const from = this._path[this._path.length - 1];
      this._path = this._path.slice(0, -1);
      this._haptic('light');
      this._rebuildRing();
      if (from != null && from < this._items.length) this._select(from);
    }

    _knobTap() {
      if (this._open && this._path.length) this._back();
      else this._toggle();
    }

    // ---------- Molette : ce que l'appui long règle sur une entrée ----------
    // Lumière (luminosité, puis blanc et couleur), média (volume), volet (position),
    // thermostat (consigne), ventilateur (vitesse), input_number / number (valeur).
    _control(it, mode) {
      if (!it || !it.entity || !this._hass) return null;
      const opt = it.dimmer !== undefined ? it.dimmer : this._config.dimmer;
      if (opt === false) return null;
      const entity = String(it.entity);
      const domain = entity.split('.')[0];
      const st = this._hass.states[entity];
      const a = (st && st.attributes) || {};
      const feat = Number(a.supported_features) || 0;
      const hass = this._hass;
      const L = langOf(hass);
      const num = (v, step) => Number(v).toLocaleString(L === 'fr' ? 'fr-FR' : 'en-US', { minimumFractionDigits: decimals(step), maximumFractionDigits: decimals(step) });
      const pct = (v) => `${Math.round(v)}%`;
      const base = { domain, entity, mode: 'value', modes: null, min: 0, max: 100, step: 1, wheel: 0.05, fmt: pct, lvl: (v) => (v > 0 ? pct(v) : null), label: null };

      switch (domain) {
        case 'light': {
          const cm = Array.isArray(a.supported_color_modes) ? a.supported_color_modes : null;
          const dims = opt === true || (cm ? cm.some((m) => m !== 'onoff') : 'brightness' in a);
          if (!dims) return null;
          if (!st && opt !== true) return null;
          const hasColor = !!cm && cm.some((m) => COLOR_MODES.includes(m));
          const hasTemp = !!cm && (cm.includes('color_temp') || hasColor);
          const modes = ['brightness'].concat(hasTemp ? ['temp'] : [], hasColor ? ['hue'] : []);
          const m = modes.includes(mode) ? mode : 'brightness';
          const on = !!st && st.state === 'on';
          if (m === 'temp') {
            const min = Number(a.min_color_temp_kelvin) || 2000;
            const max = Math.max(min + 100, Number(a.max_color_temp_kelvin) || 6500);
            const cur = Number(a.color_temp_kelvin);
            return {
              ...base, mode: m, modes, min, max, step: 50, wheel: 0.05,
              value: Number.isFinite(cur) && cur > 0 ? clamp(cur, min, max) : Math.round((min + max) / 200) * 100,
              fmt: (v) => `${Math.round(v)} K`, lvl: () => null,
              send: (v) => hass.callService('light', 'turn_on', { entity_id: entity, color_temp_kelvin: Math.round(v) }),
            };
          }
          if (m === 'hue') {
            const hs = Array.isArray(a.hs_color) ? a.hs_color : null;
            const sat = hs && Number(hs[1]) > 20 ? Number(hs[1]) : 100;
            return {
              ...base, mode: m, modes, min: 0, max: 360, step: 1, wheel: 1 / 36,
              value: hs && Number.isFinite(Number(hs[0])) ? Math.round(Number(hs[0])) : 0,
              fmt: (v) => `${Math.round(v)}°`, lvl: () => null,
              send: (v) => hass.callService('light', 'turn_on', { entity_id: entity, hs_color: [Math.round(v) % 360, sat] }),
            };
          }
          const b = Number(a.brightness);
          const value = on ? (Number.isFinite(b) && b > 0 ? Math.max(1, Math.round((b / 255) * 100)) : 100) : 0;
          return {
            ...base, mode: 'brightness', modes, value,
            label: on && Number.isFinite(b) && b > 0 ? pct(value) : null,
            send: (v) => (v <= 0
              ? hass.callService('light', 'turn_off', { entity_id: entity })
              : hass.callService('light', 'turn_on', { entity_id: entity, brightness_pct: Math.round(v) })),
          };
        }
        case 'media_player': {
          if (!st || (!(feat & 4) && !('volume_level' in a))) return null;
          const value = Math.round((Number(a.volume_level) || 0) * 100);
          return {
            ...base, value, lvl: pct,
            label: !OFF_STATES.includes(st.state) && 'volume_level' in a ? pct(value) : null,
            send: (v) => hass.callService('media_player', 'volume_set', { entity_id: entity, volume_level: Math.round(v) / 100 }),
          };
        }
        case 'cover': {
          if (!st || (!(feat & 4) && !('current_position' in a))) return null;
          const value = Math.round(Number(a.current_position) || 0);
          return {
            ...base, value,
            label: 'current_position' in a && value > 0 ? pct(value) : null,
            send: (v) => hass.callService('cover', 'set_cover_position', { entity_id: entity, position: Math.round(v) }),
          };
        }
        case 'fan': {
          if (!st || (!(feat & 1) && !('percentage' in a))) return null;
          const step = clamp(Number(a.percentage_step) || 1, 1, 100);
          const value = st.state === 'on' ? Math.round(Number(a.percentage) || 0) : 0;
          return {
            ...base, step, wheel: Math.max(0.05, step / 100), value,
            label: st.state === 'on' && value > 0 ? pct(value) : null,
            send: (v) => hass.callService('fan', 'set_percentage', { entity_id: entity, percentage: Math.round(v) }),
          };
        }
        case 'climate': {
          if (!st || typeof a.temperature !== 'number') return null;
          const F = hass.config && hass.config.unit_system && hass.config.unit_system.temperature === '°F';
          const min = Number.isFinite(Number(a.min_temp)) ? Number(a.min_temp) : (F ? 45 : 7);
          const max = Number.isFinite(Number(a.max_temp)) && Number(a.max_temp) > min ? Number(a.max_temp) : (F ? 95 : 35);
          const step = Number(a.target_temp_step) > 0 ? Number(a.target_temp_step) : (F ? 1 : 0.5);
          const fmt = (v) => `${num(v, step)}°`;
          return {
            ...base, min, max, step, wheel: step / (max - min), value: clamp(a.temperature, min, max), fmt, lvl: fmt,
            label: st.state !== 'off' ? fmt(a.temperature) : null,
            send: (v) => hass.callService('climate', 'set_temperature', { entity_id: entity, temperature: v }),
          };
        }
        case 'input_number':
        case 'number': {
          if (!st) return null;
          const min = Number.isFinite(Number(a.min)) ? Number(a.min) : 0;
          const max = Number.isFinite(Number(a.max)) && Number(a.max) > min ? Number(a.max) : min + 100;
          const step = Number(a.step) > 0 ? Number(a.step) : 1;
          const unit = a.unit_of_measurement ? String(a.unit_of_measurement) : '';
          const cur = Number(st.state);
          const short = (v) => `${num(v, step)}${unit && unit.length <= 3 ? (unit === '%' ? '%' : ` ${unit}`) : ''}`;
          return {
            ...base, min, max, step, wheel: Math.max(0.01, step / (max - min)),
            value: Number.isFinite(cur) ? clamp(cur, min, max) : min,
            fmt: (v) => `${num(v, step)}${unit ? (unit === '%' ? '%' : ` ${unit}`) : ''}`, lvl: short,
            label: Number.isFinite(cur) ? short(cur) : null,
            send: (v) => hass.callService(domain, 'set_value', { entity_id: entity, value: v }),
          };
        }
        default:
          return null;
      }
    }

    // Noms historiques (compatibilité)
    _canDim(i) { return !!this._control(this._items[i]); }
    _holdDims(i) { const it = this._items[i]; return !!it && !it.hold_action && !!this._control(it); }

    _polar(x, y) {
      const r = this._sel.getBoundingClientRect();
      const R = r.width / 2;
      const dx = x - (r.left + R);
      const dy = y - (r.top + r.height / 2);
      return { deg: (Math.atan2(dy, dx) * 180) / Math.PI, dist: Math.hypot(dx, dy), R };
    }

    _dimStart(i, pointerId, wheel = false) {
      if (this._dim) this._dimEnd();
      const it = this._items[i];
      const first = this._control(it);
      if (!first) return false;
      // Appuis longs successifs sur la même lumière (moins de 3 s) : luminosité -> blanc -> couleur
      let mode = first.mode;
      const lm = this._lastMode;
      if (first.modes && first.modes.length > 1 && lm && lm.it === it && Date.now() - lm.t < MODE_WINDOW) {
        const k = first.modes.indexOf(lm.mode);
        mode = wheel ? lm.mode : first.modes[(k + 1) % first.modes.length];
      }
      const ctl = mode === first.mode ? first : (this._control(it, mode) || first);
      const v = fracOf(ctl, ctl.value);
      const last = this._ptr ? this._polar(this._ptr.x, this._ptr.y).deg : null;
      this._dim = {
        i, it, ctl, v, id: pointerId, last,
        sent: quant(ctl, v), lastSend: 0, timer: null, wheelTimer: null, wheel: false, bucket: undefined,
      };
      this._sel.classList.add('dimming');
      this._sel.classList.toggle('mode-temp', ctl.mode === 'temp');
      this._sel.classList.toggle('mode-hue', ctl.mode === 'hue');
      this._dimRender();
      if (pointerId != null) {
        try { this._sel.setPointerCapture(pointerId); } catch (err) { /* ignore */ }
      }
      return true;
    }

    _dimRender() {
      const d = this._dim;
      if (!d) return;
      const ctl = d.ctl;
      const val = quant(ctl, d.v);
      this._sel.style.setProperty('--rsc-dim', String(fracOf(ctl, val)));
      const multi = ctl.modes && ctl.modes.length > 1;
      const txt = ctl.fmt(val);
      // texte long (« 3300 K », « 21,5° ») : plus petit pour ne pas toucher le repère du bouton
      const size = txt.length >= 6 ? ' class="xs"' : (txt.length === 5 ? ' class="s"' : '');
      this._pct.innerHTML = `<b${size}>${esc(txt)}</b>${multi
        ? `<small>${esc(this._t(`m_${ctl.mode}`))}</small><span class="dots">${ctl.modes.map((m) => `<i class="${m === ctl.mode ? 'on' : ''}"></i>`).join('')}</span>`
        : ''}`;
      // Repère de l'arc : couleur réglée (blanc chaud / froid, teinte)
      if (ctl.mode === 'temp') this._arc.style.setProperty('--rsc-arc-color', kelvinRgb(val));
      else if (ctl.mode === 'hue') this._arc.style.setProperty('--rsc-arc-color', `hsl(${Math.round(val)} 100% 55%)`);
      else this._arc.style.removeProperty('--rsc-arc-color');
      // La petite valeur sous l'icône suit le réglage en direct
      if (this._config.show_brightness !== false && ctl.mode !== 'temp' && ctl.mode !== 'hue') this._setLevel(d.i, ctl.lvl(val));
      // Un léger « clic » haptique tous les 10 % (ou à chaque pas, s'il y en a peu)
      const steps = Math.round((ctl.max - ctl.min) / ctl.step);
      const bucket = steps <= 40 ? Math.round((val - ctl.min) / ctl.step) : Math.floor(fracOf(ctl, val) * 10 + 1e-9);
      if (d.bucket !== undefined && bucket !== d.bucket) this._haptic('selection');
      d.bucket = bucket;
    }

    // Affiche (texte) ou masque (null) la petite valeur sous l'icône d'une entrée
    _setLevel(i, text) {
      const li = this._lis && this._lis[i];
      if (!li) return;
      const el = li.querySelector('.lvl');
      const show = text != null && text !== '';
      li.classList.toggle('has-lvl', show);
      if (el) el.textContent = show ? String(text) : '';
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
      d.v = clamp(v, 0, 1);
      this._dimRender();
      this._dimSend(false);
    }

    _dimSend(final) {
      const d = this._dim;
      if (!d || !this._hass) return;
      const val = quant(d.ctl, d.v);
      const now = Date.now();
      if (!final && now - d.lastSend < 120) {
        if (!d.timer) {
          d.timer = setTimeout(() => { d.timer = null; if (this._dim === d) this._dimSend(false); }, 120 - (now - d.lastSend));
        }
        return;
      }
      clearTimeout(d.timer);
      d.timer = null;
      if (val === d.sent) return;
      d.sent = val;
      d.lastSend = now;
      d.ctl.send(val);
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
      if (d.ctl.modes && d.ctl.modes.length > 1) this._lastMode = { it: d.it, mode: d.ctl.mode, t: Date.now() };
      this._dim = null;
      this._sel.classList.remove('dimming', 'mode-temp', 'mode-hue');
      setTimeout(() => { this._suppressClick = false; }, 50);
    }

    _wheel(e) {
      if (!this._open) return;
      const i = this._dim ? this._dim.i : this._hover;
      if (i == null) return;
      if (this._dim && !this._dim.wheel) return;
      if (!this._dim && !this._control(this._items[i])) return;
      e.preventDefault();
      if (!this._dim && !this._dimStart(i, null, true)) return;
      const d = this._dim;
      d.wheel = true;
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      this._dimSet(d.v - (clamp(dy, -100, 100) / 100) * d.ctl.wheel);
      clearTimeout(d.wheelTimer);
      d.wheelTimer = setTimeout(() => { if (this._dim === d) this._dimEnd(); }, 900);
    }

    // Appui simple sur une entrée : ouvre le groupe, sinon lance son action
    _activate(i) {
      const it = this._items[i];
      if (!it) return;
      if (isGroup(it) && !it.tap_action) { this._enter(i); return; }
      this._select(i);
      this._haptic('light');
      this._syncWrite(it);
      this._run(i, 'tap');
      if (this._config.close_on_select) setTimeout(() => { if (this._open) this._toggle(); }, 450);
    }

    // Appui long sur une entrée : molette si possible, sinon action « hold »
    _hold(i, pointerId) {
      const it = this._items[i];
      if (!it) return;
      this._select(i);
      this._haptic('medium');
      this._syncWrite(it);
      if (!it.hold_action && this._control(it) && this._dimStart(i, pointerId)) return;
      if (!it.hold_action && isGroup(it) && !it.entity) { this._toggleGroup(it); return; }
      this._run(i, 'hold');
    }

    _pointAt(e) {
      const r = this._sel.getBoundingClientRect();
      const R = r.width / 2;
      const dx = e.clientX - (r.left + R);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const rel = (((deg + 90) % 360) + 360) % 360;
      const idx = Math.round(rel / this._step) % this._items.length;
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
        this._hold(m.idx, m.id);
      }, HOLD_MS);
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
            this._hold(q.idx, t.id);
          }, HOLD_MS);
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
        if (next !== this._hover) {
          if (next != null) this._haptic('selection');
          this._setHover(next);
        }
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
      if (this._lis) this._setHover(null);
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

    // Couleurs d'une entrée : couleur choisie, sinon couleur du thème HA (palette: theme),
    // sinon arc-en-ciel selon sa position dans son cercle
    _colorOf(it, i, n) {
      const custom = it && it.color ? cssColor(it.color)
        : (this._config.palette === 'theme' ? 'var(--primary-color, #03a9f4)' : '');
      if (custom) {
        return { c: custom, d: `color-mix(in srgb, ${custom} 80%, #000)`, i: custom, a: custom };
      }
      const hue = (360 / (n || 6)) * i - 90;
      return {
        c: `hsl(${hue}deg 100% 72%)`,
        d: `hsl(${hue}deg 98% 61%)`,
        i: `hsl(${hue}deg 90% var(--rsc-on-lightness))`,
        a: `hsl(${hue}deg 100% var(--rsc-on-lightness))`,
      };
    }

    _itemColors(i) {
      const list = this._items || this._config.items;
      return this._colorOf(list[i], i, list.length);
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

    // Couleurs choisies pour le nombre d'entités allumées ; rien de choisi = thème HA (voir CARD_STYLES)
    _countStyle() {
      const c = this._config;
      const v = [];
      if (c.count_background) v.push(`--rsc-count-tint:${cssColor(c.count_background)}`);
      if (c.count_color) v.push(`--rsc-count-ink:${cssColor(c.count_color)}`);
      return v.join(';');
    }

    // Chiffre sans couleur choisie : texte du thème s'il reste lisible, sinon noir ou blanc.
    // Lit les couleurs réelles : le thème peut changer à tout moment.
    _refreshCountInk() {
      if (!this._wrap || !this.isConnected) return;
      const c = this._config;
      const cs = getComputedStyle(this._wrap);
      const tint = cs.getPropertyValue('--rsc-count-tint');
      const themeInk = cs.getPropertyValue('--text-primary-color') || '#fff';
      const key = `${tint}|${themeInk}|${c.count_color || ''}`;
      if (key === this._countKey) return;
      this._countKey = key;
      const style = this._wrap.style;
      if (!c.count_color) {
        const bg = colorRgb(tint);
        const theme = colorRgb(themeInk);
        const unreadable = bg && (c.count_background || !theme || contrast(bg, theme) < MIN_COUNT_CONTRAST);
        if (unreadable) style.setProperty('--rsc-count-ink', isLightColor(bg) ? '#14171c' : '#ffffff');
        else style.removeProperty('--rsc-count-ink');
      }
      // Chiffre foncé : incrustation claire plutôt que sombre
      const ink = colorRgb(cs.getPropertyValue('--rsc-count-ink'));
      ['--rsc-count-shadow', '--rsc-badge-shadow'].forEach((name) => {
        if (ink && !isLightColor(ink)) style.setProperty(name, '0 1px 0 rgb(255 255 255 / 0.35)');
        else style.removeProperty(name);
      });
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
      // Réouverture : toujours sur le cercle principal
      if (this._open && this._ringKey !== this._path.join('/')) { this._buildRing(); this._updateStates(); }
      this._sel.classList.toggle('active', this._open);
      this._knob.setAttribute('aria-expanded', String(this._open));
      if (!this._open) {
        if (this._path.length) {
          // Fermeture dans un groupe : retour au cercle principal une fois l'animation finie
          this._path = [];
          clearTimeout(this._resetTimer);
          this._resetTimer = setTimeout(() => {
            if (!this._open && this._ringKey !== '') { this._buildRing(); this._updateStates(); this._select(this._restIndex()); this._updateLabel(); }
          }, 600);
        } else this._select(this._restIndex());
      }
      this._updateLabel();
      this._armClose();
    }

    _armClose() {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
      this._armedAt = Date.now();
      this._lastBump = this._armedAt;
      if (!this._open || !(this._autoClose > 0)) return;
      this._scheduleClose(this._autoClose * 1000);
    }

    _scheduleClose(ms) {
      this._closeTimer = setTimeout(() => {
        this._closeTimer = null;
        if (!this._open) return;
        if (this._dim || this._touch) { this._armClose(); return; }
        // Un geste arrivé pendant la limitation (moins de 250 ms après une relance) compte aussi :
        // le délai repart de ce dernier geste au lieu de fermer trop tôt
        const left = this._autoClose * 1000 - (Date.now() - (this._lastBump || 0));
        if (left > 15) { this._scheduleClose(left); return; }
        this._toggle();
      }, ms);
    }

    _bump() {
      if (!this._open || !(this._autoClose > 0)) return;
      const now = Date.now();
      this._lastBump = now;
      // Limitation : la minuterie n'est pas recréée plus d'une fois toutes les 250 ms
      if (now - this._armedAt < 250) return;
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
        text = this._getEntityName(this._items[k], '');
      }
      this._label.textContent = text;
      this._label.style.display = c.show_label ? '' : 'none';
    }

    // ---------- États ----------
    _entOn(entity) {
      const st = this._hass && this._hass.states[entity];
      return !!st && ON_STATES.includes(st.state);
    }

    _isOn(it) {
      if (!it) return false;
      if (it.entity) return this._entOn(it.entity);
      if (isGroup(it)) return leaves(it.items).some((e) => this._entOn(e));
      return false;
    }

    // Petite valeur sous l'icône : %, volume, position, consigne… ; « 2/4 » pour un groupe
    _levelText(it) {
      if (isGroup(it) && !it.entity) {
        const ents = [...new Set(leaves(it.items))];
        const on = ents.filter((e) => this._entOn(e)).length;
        return on ? `${on}/${ents.length}` : null;
      }
      const ctl = this._control(it);
      return ctl ? ctl.label : null;
    }

    _isNight() {
      const c = this._config;
      const h = this._hass;
      if (!h) return false;
      const mode = c.night_mode === true ? 'sun' : c.night_mode;
      if (mode === 'always') return true;
      if (mode === 'sun') {
        const s = h.states['sun.sun'];
        return !!s && s.state === 'below_horizon';
      }
      if (mode === 'entity') {
        const s = c.night_entity && h.states[c.night_entity];
        return !!s && (ON_STATES.includes(s.state) || s.state === 'below_horizon');
      }
      return false;
    }

    _nightLevel() {
      const v = Number(this._config.night_level ?? 60);
      return Number.isFinite(v) ? clamp(v, 10, 100) / 100 : 0.6;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._wrap) return;
      this._updateStates();
      this._syncFromHelper();
    }

    // ---------- Jumeau d'un bouton physique (sync_entity) ----------
    // L'aide (input_text / input_select) contient l'entity_id de l'entrée choisie au bouton.
    _syncValue() {
      const e = this._config.sync_entity;
      const st = e && this._hass && this._hass.states[e];
      return st && !['unknown', 'unavailable', ''].includes(st.state) ? String(st.state) : null;
    }

    // Place d'une entité dans l'arbre des entrées : [groupe…, index], ou null
    _findPath(entity) {
      const walk = (list, prefix) => {
        const i = list.findIndex((it) => it && it.entity === entity);
        if (i >= 0) return [...prefix, i];
        for (let k = 0; k < list.length; k += 1) {
          if (isGroup(list[k])) {
            const r = walk(list[k].items, [...prefix, k]);
            if (r) return r;
          }
        }
        return null;
      };
      return entity ? walk(this._config.items, []) : null;
    }

    // Entrée pointée par le bouton fermé : celle de l'aide (ou son groupe), sinon la 1re
    _restIndex() {
      const p = this._findPath(this._syncValue());
      return p ? p[0] : 0;
    }

    _syncFromHelper() {
      if (!this._config.sync_entity) return;
      const v = this._syncValue();
      if (v === this._syncSeen) return;
      const first = this._syncSeen === undefined;
      this._syncSeen = v;
      // Écho d'une valeur écrite par la carte elle-même : ne pas rouvrir la carte
      const echo = v != null && v === this._syncWrote;
      if (echo) this._syncWrote = null;
      const p = this._findPath(v);
      if (!p || this._dim || this._touch || this._mouse) return;
      const group = p.slice(0, -1);
      const idx = p[p.length - 1];
      if (first || echo || this._config.sync_open === false) {
        // Première lecture, écho ou ouverture désactivée : la carte pointe l'entrée sans s'ouvrir
        if (!this._open) this._select(p[0]);
        else if (this._ringKey === group.join('/')) this._select(idx);
        return;
      }
      if (!this._open) {
        this._path = group;
        this._toggle();
      } else if (this._ringKey !== group.join('/')) {
        this._path = group;
        this._rebuildRing();
      } else {
        this._setHover(null);
        this._armClose();
      }
      this._select(idx);
    }

    // Appui dans la carte : l'entrée touchée devient celle que le bouton pilote
    _syncWrite(it) {
      const helper = this._config.sync_entity;
      if (!helper || !it || !it.entity || !this._hass || this._config.sync_from_card === false) return;
      const v = String(it.entity);
      if (this._syncValue() === v) return;
      const domain = String(helper).split('.')[0];
      if (domain === 'input_text' || domain === 'text') {
        this._syncWrote = v;
        this._hass.callService(domain, 'set_value', { entity_id: helper, value: v });
      } else if (domain === 'input_select' || domain === 'select') {
        const st = this._hass.states[helper];
        const options = (st && st.attributes && st.attributes.options) || [];
        if (!options.includes(v)) return;
        this._syncWrote = v;
        this._hass.callService(domain, 'select_option', { entity_id: helper, option: v });
      }
    }

    _updateStates() {
      const hass = this._hass;
      if (!hass || !this._wrap) return;
      const c = this._config;
      const dark = c.theme === 'dark' || (c.theme === 'auto' && hass.themes && hass.themes.darkMode);
      this._wrap.classList.toggle('dark', !!dark);

      // Mode nuit : carte atténuée
      const night = this._isNight();
      this._wrap.classList.toggle('night', night);
      if (night) this._wrap.style.setProperty('--rsc-night', String(this._nightLevel()));
      else this._wrap.style.removeProperty('--rsc-night');

      this._items.forEach((it, i) => {
        const li = this._lis[i];
        if (!li) return;
        li.classList.toggle('on', this._isOn(it));
        // Valeur sous l'icône (sauf pendant son réglage)
        if (!(this._dim && this._dim.i === i)) {
          this._setLevel(i, c.show_brightness !== false ? this._levelText(it) : null);
        }
        const st = it.entity && hass.states[it.entity];
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

      this._updateIndicators();
      this._updateLabel();
    }

    // Bouton fermé : nombre d'entités allumées + halo coloré à la place de chaque entrée allumée
    _updateIndicators() {
      const c = this._config;
      const root = c.items;
      const n = root.length;
      const S = 360 / n;
      const ents = [...new Set(leaves(root))];
      const count = ents.filter((e) => this._entOn(e)).length;
      const showCount = c.show_count !== false && count > 0;
      this._badge.textContent = showCount ? String(count) : '';
      this._sel.classList.toggle('count-on', showCount);
      this._sel.classList.toggle('count-badge', c.count_position === 'badge');
      this._knob.setAttribute('data-count', showCount ? String(count) : '');
      this._refreshCountInk();
      this._knob.style.setProperty('--rsc-v-digits', String(showCount ? String(count).length : 1));

      const lit = root.map((it, i) => (this._isOn(it) ? i : -1)).filter((i) => i >= 0);
      const showHalo = c.show_halo !== false && lit.length > 0;
      const key = showHalo ? `${lit.join(',')}|${c.palette || ''}` : '';
      if (key !== this._haloKey) {
        this._haloKey = key;
        if (showHalo) {
          const w = Math.min(S * 0.62, 46);
          const stops = lit.map((i) => {
            const col = this._colorOf(root[i], i, n).c;
            const mid = S * i + S / 2;
            return `transparent ${r2(mid - w / 2)}deg, ${col} ${r2(mid - w / 2 + 3)}deg, ${col} ${r2(mid + w / 2 - 3)}deg, transparent ${r2(mid + w / 2)}deg`;
          });
          this._halo.style.setProperty('--rsc-halo', `conic-gradient(from ${r2(-S / 2)}deg, transparent 0deg, ${stops.join(', ')}, transparent 360deg)`);
        } else this._halo.style.removeProperty('--rsc-halo');
      }
      this._sel.classList.toggle('halo-on', showHalo);
    }

    // ---------- Retour haptique (appli HA mobile, sinon vibreur du navigateur) ----------
    _haptic(type) {
      if (this._config.haptics === false) return;
      if (Date.now() - this._lastFinger > 2000) return;    // seulement au doigt
      if (this._hass && this._hass.vibrate === false) return;
      try { window.dispatchEvent(new CustomEvent('haptic', { detail: type })); } catch (e) { /* ignore */ }
      const inApp = !!(window.externalApp || (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.externalBus));
      if (!inApp && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(VIBRATE[type] || 10); } catch (e) { /* ignore */ }
      }
    }

    // ---------- Appui long sur le bouton central ----------
    _centerAction() {
      const a = this._config.center_hold_action;
      if (!a) return null;
      if (typeof a === 'string') return a === 'none' ? null : { action: a };
      if (!a.action || a.action === 'none') return null;
      if (a.action === 'navigate' && (!a.navigation_path || a.navigation_path === '#')) return null;
      if ((a.perform_action || a.service) === 'scene.turn_on' && !(a.target && a.target.entity_id) && !(a.data && a.data.entity_id)) return null;
      return a;
    }

    _centerHold() {
      const a = this._centerAction();
      if (!a) return;
      this._knobHeld = true;
      this._haptic('heavy');
      const s = this._sel;
      s.classList.remove('flash');
      void s.offsetWidth;
      s.classList.add('flash');
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(() => s.classList.remove('flash'), 700);
      this._exec(a, a.entity);
      this._armClose();
    }

    _allOff() {
      if (!this._hass) return;
      const ents = [...new Set(leaves(this._config.items))]
        .filter((e) => ALL_OFF_DOMAINS.includes(e.split('.')[0]) && this._entOn(e));
      if (ents.length) this._hass.callService('homeassistant', 'turn_off', { entity_id: ents });
    }

    // Appui long sur un groupe sans entité : tout éteindre s'il y a quelque chose d'allumé, sinon tout allumer
    _toggleGroup(it) {
      if (!this._hass) return;
      const ents = [...new Set(leaves(it.items))].filter((e) => !NO_TOGGLE.includes(e.split('.')[0]));
      if (!ents.length) return;
      const on = ents.filter((e) => this._entOn(e));
      if (on.length) this._hass.callService('homeassistant', 'turn_off', { entity_id: on });
      else this._hass.callService('homeassistant', 'turn_on', { entity_id: ents });
    }

    _run(i, kind) {
      const item = this._items[i];
      if (!item) return;
      const def = kind === 'hold'
        ? (item.entity ? { action: 'more-info' } : { action: 'none' })
        : (item.entity ? { action: 'toggle' } : { action: 'none' });
      const cfg = (kind === 'hold' ? item.hold_action : item.tap_action) || def;
      this._exec(cfg, cfg.entity || item.entity);
    }

    _navigate(path) {
      if (!path) return;
      history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
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
          this._navigate(cfg.navigation_path);
          break;
        case 'popup':
          this._navigate(cfg.popup || cfg.navigation_path);
          break;
        case 'all_off':
          this._allOff();
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
      /* Couleur de remplissage des champs du thème (comme les champs natifs de Home Assistant),
         jamais le fond du tableau de bord (--lovelace-background peut être une image ou un dégradé) */
      background: var(--input-fill-color, var(--mdc-text-field-fill-color, var(--secondary-background-color, #f5f5f5)));
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
    .group-box {
      border-left: 3px solid var(--primary-color, #03a9f4);
      border-radius: 4px;
      padding: 10px 0 2px 12px;
      margin-top: 2px;
    }
    .group-box .section-title { font-size: 13px; }
    .item-card.nested { background: rgba(128, 128, 128, 0.07); }
    .sub-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--secondary-text-color);
      margin-top: 4px;
    }
  `;

  // Valeurs proposées par l'éditeur (libellés traduits par tr())
  const ACTION_KINDS = ['default', 'popup', 'navigate', 'toggle', 'more-info', 'all_off', 'none'];
  const CENTER_KINDS = ['none', 'all_off', 'popup', 'navigate', 'scene'];
  const NIGHT_MODES = ['off', 'sun', 'entity', 'always'];
  // Options actives par défaut : l'éditeur n'écrit que « false »
  const DEFAULT_TRUE = ['show_brightness', 'show_count', 'show_halo', 'haptics', 'sync_open'];
  // Valeur par défaut des listes : choisir le défaut retire la clé
  const SELECT_DEFAULTS = { theme: 'auto', card_style: 'border_only', knob_theme: 'metal', open_animation: 'fan', palette: 'rainbow', night_mode: 'off', count_position: 'knob' };
  const RANGE_DEFAULTS = { zone_opacity: 80, night_level: 60 };

  // Type d'action d'un bouton, pour l'éditeur
  const actionKind = (b) => {
    const a = b && b.tap_action;
    if (a && typeof a === 'object') {
      if (['navigate', 'toggle', 'more-info', 'all_off', 'none'].includes(a.action)) return a.action;
      return 'custom';
    }
    if (b && b.popup) return 'popup';
    return 'default';
  };

  // Type d'appui long du bouton central, pour l'éditeur
  const centerKind = (a) => {
    if (!a) return 'none';
    if (typeof a === 'string') return ['none', 'all_off'].includes(a) ? a : 'custom';
    switch (a.action) {
      case 'none': return 'none';
      case 'all_off': return 'all_off';
      case 'navigate': return String(a.navigation_path || '').startsWith('#') ? 'popup' : 'navigate';
      case 'perform-action':
      case 'call-service':
        return (a.perform_action || a.service) === 'scene.turn_on' && !a.data ? 'scene' : 'custom';
      default: return 'custom';
    }
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
      this._lang = langOf(null);
    }

    _t(key, vars) { return tr(this._lang, key, vars); }

    connectedCallback() {
      // Les couleurs du thème ne sont lisibles qu'une fois l'éditeur dans la page
      if (this._config && this.shadowRoot.querySelector('.editor-wrap')) this._render();
    }

    // Couleur d'une variable du thème actif, au format du sélecteur de couleur natif
    _themeHex(name, fallback) {
      const rgb = colorRgb(getComputedStyle(this).getPropertyValue(name));
      return rgb ? `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}` : fallback;
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
      cfg.items = [].concat(cfg.items || []).map((it) => normalizeItem(it)).filter(Boolean).map((it) => (
        Array.isArray(it.items) ? { ...it, items: it.items.map((k) => normalizeItem(k)).filter(Boolean) } : it));
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
      if (!this.shadowRoot.querySelector('.editor-wrap') || langOf(hass) !== this._lang) { this._render(); return; }
      this.shadowRoot.querySelectorAll('ha-entity-picker, ha-icon-picker').forEach((el) => { el.hass = hass; });
    }

    // Ce qui change la structure de l'éditeur (nombre d'entrées, champs affichés, langue)
    _signature() {
      const c = this._config;
      const rowDefault = c.row_style || 'tile';
      return JSON.stringify([
        langOf(this._hass),
        c.items.map((it) => (Array.isArray(it.items) ? it.items.length : -1)),
        (c.row_items || []).map((b) => [b.style || rowDefault, actionKind(b)]),
        (c.extra_buttons || []).map((b) => [b.style === 'tile' ? 'tile' : 'metal', actionKind(b)]),
        CARD_STYLES_LIST.includes(c.card_style) ? c.card_style : 'border_only',
        centerKind(c.center_hold_action),
        NIGHT_MODES.includes(c.night_mode) ? c.night_mode : 'off',
        !!c.sync_entity,
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

    // ---------- Listes : 'items', 'row_items', 'extra_buttons' ou un sous-groupe 'items/3/items' ----------
    _getList(scope) {
      const parts = scope.split('/');
      let list = this._config[parts[0]] || [];
      for (let k = 1; k + 1 < parts.length; k += 2) {
        const it = list[Number(parts[k])];
        list = (it && it[parts[k + 1]]) || [];
      }
      return list;
    }

    _getItem(scope, idx) {
      return scope === '__top' ? this._config : this._getList(scope)[idx];
    }

    _withList(scope, arr) {
      const rec = (obj, p) => {
        if (p.length === 1) return { ...obj, [p[0]]: arr };
        const [key, idx, ...rest] = p;
        const list = [...(obj[key] || [])];
        list[Number(idx)] = rec(list[Number(idx)] || {}, rest);
        return { ...obj, [key]: list };
      };
      return rec(this._config, scope.split('/'));
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
        const arr = [...this._getList(scope)];
        if (!arr[idx]) return;
        arr[idx] = apply(arr[idx]);
        this._config = this._withList(scope, arr);
      }
      this._afterChange();
    }

    _setList(scope, arr) {
      this._config = this._withList(scope, arr);
      this._afterChange();
    }

    _setAction(scope, idx, kind) {
      const arr = [...this._getList(scope)];
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
      const arr = [...this._getList(scope)];
      const it = { ...arr[idx] };
      const v = raw.trim();
      const kind = actionKind(it);
      if (kind === 'popup') it.popup = v ? (v.startsWith('#') || v.startsWith('/') ? v : `#${v}`) : '#';
      else if (kind === 'navigate') it.tap_action = { ...it.tap_action, navigation_path: v };
      else return;
      arr[idx] = it;
      this._setList(scope, arr);
    }

    _setCenterKind(kind) {
      let a;
      switch (kind) {
        case 'none': a = undefined; break;
        case 'all_off': a = { action: 'all_off' }; break;
        case 'popup': a = { action: 'navigate', navigation_path: '#' }; break;
        case 'navigate': a = { action: 'navigate', navigation_path: '' }; break;
        case 'scene': a = { action: 'perform-action', perform_action: 'scene.turn_on' }; break;
        default: return;
      }
      this._patch('__top', 0, { center_hold_action: a });
    }

    _setCenterValue(raw) {
      const a = this._config.center_hold_action;
      const kind = centerKind(a);
      const v = String(raw || '').trim();
      if (kind === 'popup') this._patch('__top', 0, { center_hold_action: { ...a, navigation_path: v ? (v.startsWith('#') ? v : `#${v}`) : '#' } });
      else if (kind === 'navigate') this._patch('__top', 0, { center_hold_action: { ...a, navigation_path: v } });
      else if (kind === 'scene') {
        const { target, ...rest } = a;
        this._patch('__top', 0, { center_hold_action: v ? { ...rest, target: { entity_id: v } } : rest });
      }
    }

    _centerValue(a) {
      const kind = centerKind(a);
      if (kind === 'popup') return a.navigation_path === '#' ? '' : a.navigation_path || '';
      if (kind === 'navigate') return a.navigation_path || '';
      if (kind === 'scene') return (a.target && a.target.entity_id) || '';
      return '';
    }

    // ---------- Gabarits ----------
    _colorField(key, val, label, def, placeholder) {
      return `
        <div class="field">
          <label>${esc(label)}</label>
          <div class="color-row">
            <input type="color" data-swatch="${key}" data-default="${def}" value="${toHex(val) || def}">
            <input type="text" data-field="${key}" value="${esc(val || '')}" placeholder="${esc(placeholder)}">
            <button type="button" class="btn-clear" data-clear="${key}" title="${esc(this._t('clear'))}">✕</button>
          </div>
        </div>`;
    }

    _actionFields(b, defaultLabel) {
      const t = (k, v) => this._t(k, v);
      const kind = actionKind(b);
      const list = ACTION_KINDS.map((v) => [v, v === 'default' ? t('a_default', { d: defaultLabel }) : t(`a_${v}`)]);
      if (kind === 'custom') list.push(['custom', t('a_custom')]);
      let valueField = '';
      if (kind === 'popup') {
        valueField = `<div class="field"><label>${esc(t('popup_hash'))}</label>
          <input type="text" data-field="action_value" value="${esc(b.popup === '#' ? '' : b.popup || '')}" placeholder="#tv-salon"></div>`;
      } else if (kind === 'navigate') {
        valueField = `<div class="field"><label>${esc(t('path'))}</label>
          <input type="text" data-field="action_value" value="${esc((b.tap_action && b.tap_action.navigation_path) || '')}" placeholder="/lovelace/salon"></div>`;
      } else if (kind === 'custom') {
        valueField = `<div class="hint" style="margin:0">${esc(t('custom_hint'))}</div>`;
      }
      return `
        <div class="item-subgrid">
          <div class="field"><label>${esc(t('tap_action'))}</label>
            <select data-field="action" ${kind === 'custom' ? 'disabled' : ''}>${opts(list, kind)}</select></div>
          ${valueField}
        </div>`;
    }

    _itemHeader(title, idx, len, canDelete) {
      return `
        <div class="item-header">
          <span>${esc(title)}</span>
          <div class="item-actions">
            <button type="button" class="btn-mini" data-move="-1" title="${esc(this._t('up'))}" ${idx === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-mini" data-move="1" title="${esc(this._t('down'))}" ${idx === len - 1 ? 'disabled' : ''}>▼</button>
            <button type="button" class="btn-del" data-del title="${esc(this._t('delete'))}" ${canDelete ? '' : 'disabled'}>${esc(this._t('delete'))}</button>
          </div>
        </div>`;
    }

    // Entrée du cercle (ou d'un groupe : nested)
    _circleCard(it, scope, idx, len, nested) {
      const t = (k, v) => this._t(k, v);
      const hold = it.dimmer === false ? 'off' : (it.dimmer === true ? 'force' : 'auto');
      let group = '';
      if (!nested) {
        const kids = Array.isArray(it.items) ? it.items : null;
        group = `<label class="switch-label"><input type="checkbox" data-field="__group" ${kids ? 'checked' : ''}> ${esc(t('is_group'))}</label>`;
        if (kids) {
          const kscope = `${scope}/${idx}/items`;
          group += `
          <div class="group-box">
            <div class="hint" style="margin:0 0 10px">${esc(t('group_hint'))}</div>
            <div class="section-title">
              <span>${esc(t('sub_items', { n: kids.length }))}</span>
              <button type="button" class="btn" data-add="${kscope}" ${kids.length >= 10 ? 'disabled' : ''}>${esc(t('add'))}</button>
            </div>
            ${kids.map((k, j) => this._circleCard(k, kscope, j, kids.length, true)).join('')}
          </div>`;
        }
      }
      return `
        <div class="item-card${nested ? ' nested' : ''}" data-list="${scope}" data-idx="${idx}">
          ${this._itemHeader(nested ? t('sub_title', { n: idx + 1 }) : t('item_title', { n: idx + 1 }), idx, len, nested ? len > 1 : len > 2)}
          <ha-entity-picker allow-custom-entity></ha-entity-picker>
          <div class="item-subgrid">
            <div class="field"><label>${esc(t('name_opt'))}</label>
              <input type="text" data-field="name" placeholder="${esc(t('name_ph'))}" value="${esc(it.name || '')}"></div>
            <div class="field"><label>${esc(t('icon_opt'))}</label><ha-icon-picker></ha-icon-picker></div>
          </div>
          <div class="color-grid">
            ${this._colorField('color', it.color, t('color'), this._defaultHex(idx, len), t('color_auto'))}
            <div class="field"><label>${esc(t('hold'))}</label>
              <select data-field="dimmer">${opts([['auto', t('hold_auto')], ['force', t('hold_force')], ['off', t('hold_off')]], hold)}</select></div>
          </div>
          ${group}
        </div>`;
    }

    _render() {
      if (!this._config) return;
      this._lang = langOf(this._hass);
      const t = (k, v) => this._t(k, v);
      const c = this._config;
      this._sig = this._signature();
      const rows = c.row_items || [];
      const extras = c.extra_buttons || [];
      const rowDefault = c.row_style || 'tile';
      const cardStyle = CARD_STYLES_LIST.includes(c.card_style) ? c.card_style : 'border_only';
      const cardHasBg = cardStyle === 'standard' || cardStyle === 'background_only';
      const cardHasBorder = cardStyle === 'standard' || cardStyle === 'border_only';
      const cKind = centerKind(c.center_hold_action);
      const nMode = NIGHT_MODES.includes(c.night_mode) ? c.night_mode : 'off';

      const circleCards = c.items.map((it, idx) => this._circleCard(it, 'items', idx, c.items.length, false)).join('');

      const colorBlock = (it, style) => `
          <div class="sub-title">${esc(t('colors'))}</div>
          <div class="color-grid">
            ${this._colorField('color', it.color, t('c_on'), '#a3be8c', '#a3be8c')}
            ${this._colorField('off_color', it.off_color, t('c_off'), style === 'tile' ? '#bf616a' : '#888888', style === 'tile' ? '#bf616a' : t('theme_ph'))}
            ${style === 'tile' ? this._colorField('background', it.background, t('c_bg'), '#434c5e', '#434c5e') : ''}
          </div>`;

      const rowCards = rows.map((it, idx) => {
        const style = it.style || rowDefault;
        return `
        <div class="item-card" data-list="row_items" data-idx="${idx}">
          ${this._itemHeader(t('row_title', { n: idx + 1 }), idx, rows.length, true)}
          <ha-entity-picker allow-custom-entity></ha-entity-picker>
          <div class="item-subgrid-3">
            <div class="field"><label>${esc(t('name_tip'))}</label>
              <input type="text" data-field="name" placeholder="${esc(t('name_auto'))}" value="${esc(it.name || '')}"></div>
            <div class="field"><label>${esc(t('icon_opt'))}</label><ha-icon-picker></ha-icon-picker></div>
            <div class="field"><label>${esc(t('style'))}</label>
              <select data-field="style">${opts([['tile', t('st_tile')], ['metal', t('st_metal')]], style)}</select></div>
          </div>
          ${this._actionFields(it, t('def_toggle'))}
          ${colorBlock(it, style)}
        </div>`;
      }).join('');

      const extraCards = extras.map((it, idx) => {
        const style = it.style === 'tile' ? 'tile' : 'metal';
        return `
        <div class="item-card" data-list="extra_buttons" data-idx="${idx}">
          ${this._itemHeader(t('extra_title', { n: idx + 1 }), idx, extras.length, true)}
          <ha-entity-picker allow-custom-entity></ha-entity-picker>
          <div class="hint" style="margin:0">${esc(t('extra_entity_hint'))}</div>
          <div class="item-subgrid">
            <div class="field"><label>${esc(t('name_tip'))}</label>
              <input type="text" data-field="name" placeholder="${esc(t('name_auto'))}" value="${esc(it.name || '')}"></div>
            <div class="field"><label>${esc(t('icon'))}</label><ha-icon-picker></ha-icon-picker></div>
            <div class="field"><label>${esc(t('corner'))}</label>
              <select data-field="position">${opts([['', t('pos_auto')], ...POSITIONS.map((p) => [p, t(`pos_${p}`)])], POSITIONS.includes(it.position) ? it.position : '')}</select></div>
            <div class="field"><label>${esc(t('style'))}</label>
              <select data-field="style">${opts([['metal', t('st_metal')], ['tile', t('st_tile')]], style)}</select></div>
          </div>
          ${this._actionFields(it, t('def_more'))}
          ${colorBlock(it, style)}
        </div>`;
      }).join('');

      let centerValue = '';
      if (cKind === 'popup') {
        centerValue = `<div class="field"><label>${esc(t('popup_hash'))}</label>
          <input type="text" data-field="center_value" value="${esc(this._centerValue(c.center_hold_action))}" placeholder="#scenes"></div>`;
      } else if (cKind === 'navigate') {
        centerValue = `<div class="field"><label>${esc(t('path'))}</label>
          <input type="text" data-field="center_value" value="${esc(this._centerValue(c.center_hold_action))}" placeholder="/lovelace/lumieres"></div>`;
      } else if (cKind === 'scene') {
        centerValue = `<div class="field"><label>${esc(t('scene'))}</label><ha-entity-picker data-key="center_scene" allow-custom-entity></ha-entity-picker></div>`;
      } else if (cKind === 'custom') {
        centerValue = `<div class="hint" style="margin:0">${esc(t('custom_hint'))}</div>`;
      }
      const centerList = CENTER_KINDS.map((k) => [k, t(`c_${k}`)]);
      if (cKind === 'custom') centerList.push(['custom', t('c_custom')]);

      const sw = (key, checked, label) => `<label class="switch-label"><input type="checkbox" data-field="${key}" ${checked ? 'checked' : ''}> ${esc(label)}</label>`;

      this.shadowRoot.innerHTML = `
        <style>${EDITOR_STYLES}</style>
        <div class="editor-wrap">
          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">${esc(t('sec_general'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('card_name'))}</label>
                <input type="text" data-field="name" value="${esc(c.name || '')}" placeholder="${esc(t('card_name_ph'))}"></div>
              <div class="field"><label>${esc(t('auto_close'))}</label>
                <input type="number" data-field="auto_close" min="0" max="3600" value="${esc(c.auto_close ?? '')}" placeholder="10"></div>
              <div class="field"><label>${esc(t('size'))}</label>
                <input type="number" data-field="size" min="60" max="300" value="${esc(c.size || '')}" placeholder="${esc(t('auto'))}"></div>
              <div class="field"><label>${esc(t('theme'))}</label>
                <select data-field="theme">${opts([['auto', t('theme_auto')], ['dark', t('theme_dark')], ['light', t('theme_light')]], c.theme || 'auto')}</select></div>
            </div>
            <div class="switches">
              ${sw('show_label', !!c.show_label, t('show_label'))}
              ${sw('close_on_select', !!c.close_on_select, t('close_on_select'))}
              ${sw('show_brightness', c.show_brightness !== false, t('show_brightness'))}
              ${sw('show_count', c.show_count !== false, t('show_count'))}
              ${sw('show_halo', c.show_halo !== false, t('show_halo'))}
              ${sw('haptics', c.haptics !== false, t('haptics'))}
            </div>
          </div>

          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">${esc(t('sec_knob'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('knob_theme'))}</label>
                <select data-field="knob_theme">${opts(SKINS.map((k) => [k, t(`skin_${k}`)]), SKINS.includes(c.knob_theme) ? c.knob_theme : 'metal')}</select></div>
              <div class="field"><label>${esc(t('open_animation'))}</label>
                <select data-field="open_animation">${opts(ANIMS.map((k) => [k, t(`anim_${k}`)]), ANIMS.includes(c.open_animation) ? c.open_animation : 'fan')}</select></div>
              <div class="field"><label>${esc(t('palette'))}</label>
                <select data-field="palette">${opts([['rainbow', t('pal_rainbow')], ['theme', t('pal_theme')]], c.palette === 'theme' ? 'theme' : 'rainbow')}</select></div>
              <div class="field"><label>${esc(t('zone_opacity'))} <span data-range-label="zone_opacity">${esc(c.zone_opacity ?? 80)}</span> %</label>
                <input type="range" data-field="zone_opacity" min="0" max="100" step="5" value="${esc(c.zone_opacity ?? 80)}"></div>
            </div>
            <div class="hint" style="margin:10px 0 0">${esc(t('knob_hint'))}</div>
          </div>

          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">${esc(t('sec_center'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('center_hold'))}</label>
                <select data-field="center_kind" ${cKind === 'custom' ? 'disabled' : ''}>${opts(centerList, cKind)}</select></div>
              ${centerValue}
              <div class="field"><label>${esc(t('count_position'))}</label>
                <select data-field="count_position">${opts([['knob', t('cp_knob')], ['badge', t('cp_badge')]], c.count_position === 'badge' ? 'badge' : 'knob')}</select></div>
              ${this._colorField('count_background', c.count_background, t('count_background'), this._themeHex('--primary-color', '#03a9f4'), t('theme_ha'))}
              ${this._colorField('count_color', c.count_color, t('count_color'), this._themeHex('--text-primary-color', '#ffffff'), t('theme_ha'))}
            </div>
            <div class="hint" style="margin:10px 0 0">${esc(t('center_hint'))}</div>
            <div class="hint" style="margin:6px 0 0">${esc(t('count_hint'))}</div>
          </div>

          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">${esc(t('sec_night'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('night_mode'))}</label>
                <select data-field="night_mode">${opts(NIGHT_MODES.map((k) => [k, t(`n_${k}`)]), nMode)}</select></div>
              ${nMode === 'entity' ? `<div class="field"><label>${esc(t('night_entity'))}</label><ha-entity-picker data-key="night_entity" allow-custom-entity></ha-entity-picker></div>` : ''}
              ${nMode !== 'off' ? `<div class="field"><label>${esc(t('night_level'))} <span data-range-label="night_level">${esc(c.night_level ?? 60)}</span> %</label>
                <input type="range" data-field="night_level" min="20" max="100" step="5" value="${esc(c.night_level ?? 60)}"></div>` : ''}
            </div>
            <div class="hint" style="margin:10px 0 0">${esc(t('night_hint'))}</div>
          </div>

          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">${esc(t('sec_sync'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('sync_entity'))}</label><ha-entity-picker data-key="sync_entity" allow-custom-entity></ha-entity-picker></div>
            </div>
            ${c.sync_entity ? `<div class="switches">${sw('sync_open', c.sync_open !== false, t('sync_open'))}</div>` : ''}
            <div class="hint" style="margin:10px 0 0">${esc(t('sync_hint'))}</div>
          </div>

          <div class="section" data-list="__top" data-idx="0">
            <div class="section-title">${esc(t('sec_card'))}</div>
            <div class="grid-2">
              <div class="field"><label>${esc(t('card_style'))}</label>
                <select data-field="card_style">${opts(CARD_STYLES_LIST.map((k) => [k, t(`cs_${k}`)]), cardStyle)}</select></div>
              ${cardHasBg ? this._colorField('card_background', c.card_background, t('card_background'), '#2b303d', t('theme_ha')) : ''}
              ${cardHasBorder ? this._colorField('card_border_color', c.card_border_color, t('card_border_color'), '#5e6472', t('theme_ha')) : ''}
            </div>
          </div>

          <div class="section">
            <div class="section-title">
              <span>${esc(t('sec_items', { n: c.items.length }))}</span>
              <button type="button" class="btn" data-add="items" ${c.items.length >= 10 ? 'disabled' : ''}>${esc(t('add'))}</button>
            </div>
            <div class="hint">${esc(t('items_hint'))}</div>
            <div class="hint">${esc(t('hold_hint'))}</div>
            ${circleCards}
          </div>

          <div class="section">
            <div class="section-title">
              <span>${esc(t('sec_extra', { n: extras.length }))}</span>
              <button type="button" class="btn" data-add="extra_buttons" ${extras.length >= 4 ? 'disabled' : ''}>${esc(t('add'))}</button>
            </div>
            <div class="hint">${esc(t('extra_hint'))}</div>
            ${extraCards || `<div class="hint">${esc(t('no_extra'))}</div>`}
          </div>

          <div class="section">
            <div class="section-title">
              <span>${esc(t('sec_rows', { n: rows.length }))}</span>
              <button type="button" class="btn" data-add="row_items">${esc(t('add'))}</button>
            </div>
            <div class="hint">${esc(t('rows_hint'))}</div>
            ${rowCards || `<div class="hint">${esc(t('no_rows'))}</div>`}
          </div>
        </div>`;

      this._bind();
      this._syncValues();
    }

    _defaultHex(i, n) {
      // Couleur arc-en-ciel par défaut d'une entrée, en hex pour le sélecteur natif
      const h = (((360 / (n || 1)) * i - 90) % 360 + 360) % 360;
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
        const arr = [...this._getList(scope)];
        if ((scope === 'items' || scope.includes('/')) && arr.length >= 10) return;
        if (scope === 'extra_buttons' && arr.length >= POSITIONS.length) return;
        arr.push(scope === 'extra_buttons' ? { icon: 'mdi:television' } : {});
        this._setList(scope, arr);
      }));

      root.querySelectorAll('[data-list]').forEach((card) => {
        const scope = card.getAttribute('data-list');
        const idx = Number(card.getAttribute('data-idx'));
        const isTop = scope === '__top';

        // Les cartes d'entrée ne doivent pas capter les champs des cartes imbriquées
        const own = (sel) => [...card.querySelectorAll(sel)].filter((el) => el.closest('[data-list]') === card);

        own('ha-entity-picker').forEach((ep) => {
          const key = ep.getAttribute('data-key') || 'entity';
          ep.hass = this._hass;
          if (key === 'entity') ep.label = this._t('entity');
          if (key === 'center_scene') ep.includeDomains = ['scene'];
          if (key === 'sync_entity') ep.includeDomains = ['input_text', 'input_select'];
          ep.addEventListener('value-changed', (ev) => {
            ev.stopPropagation();
            const v = ev.detail.value || undefined;
            if (key === 'center_scene') { this._setCenterValue(v || ''); return; }
            const cur = this._getItem(scope, idx);
            if (cur && cur[key] === v) return;
            this._patch(scope, idx, { [key]: v });
          });
        });
        own('ha-icon-picker').forEach((ip) => {
          ip.hass = this._hass;
          ip.addEventListener('value-changed', (ev) => {
            ev.stopPropagation();
            const v = ev.detail.value || undefined;
            const cur = this._getItem(scope, idx);
            if (cur && cur.icon === v) return;
            this._patch(scope, idx, { icon: v });
          });
        });

        own('input[data-field]').forEach((inp) => {
          const key = inp.getAttribute('data-field');
          if (inp.type === 'checkbox') {
            if (key === '__group') {
              inp.addEventListener('change', () => this._patch(scope, idx, { items: inp.checked ? [{}, {}] : undefined }));
              return;
            }
            // Options actives par défaut : on n'écrit que « false »
            const defTrue = DEFAULT_TRUE.includes(key);
            inp.addEventListener('change', () => this._patch(scope, idx, {
              [key]: inp.checked ? (defTrue ? undefined : true) : (defTrue ? false : undefined),
            }));
            return;
          }
          if (inp.type === 'range') {
            const lab = own(`[data-range-label="${key}"]`)[0];
            inp.addEventListener('input', () => { if (lab) lab.textContent = inp.value; });
            // valeur enregistrée au relâchement du curseur (évite de reconstruire la carte en continu)
            inp.addEventListener('change', () => {
              const n = Number(inp.value);
              this._patch(scope, idx, { [key]: n === RANGE_DEFAULTS[key] ? undefined : n });
            });
            return;
          }
          // Texte et nombres : enregistrés 250 ms après la dernière frappe (ou en quittant le champ),
          // pour ne pas reconstruire l'aperçu de la carte à chaque touche
          let timer = null;
          const commit = () => {
            clearTimeout(timer);
            timer = null;
            if (key === 'action_value') { this._setActionValue(scope, idx, inp.value); return; }
            if (key === 'center_value') { this._setCenterValue(inp.value); return; }
            const cur = this._getItem(scope, idx);
            if (!cur) return;
            let v;
            if (inp.type === 'number') {
              const n = inp.value === '' ? undefined : Number(inp.value);
              v = Number.isFinite(n) && n >= 0 ? n : undefined;
            } else {
              const isColor = !!own(`[data-swatch="${key}"]`)[0];
              v = (isColor ? inp.value.trim() : inp.value) || undefined;
            }
            if (cur[key] === v) return;
            this._patch(scope, idx, { [key]: v });
          };
          inp.addEventListener('input', () => {
            const sw = own(`[data-swatch="${key}"]`)[0];
            const hex = toHex(inp.value);
            if (sw && hex) sw.value = hex;
            clearTimeout(timer);
            timer = setTimeout(commit, 250);
          });
          inp.addEventListener('change', commit);
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
          else if (key === 'center_kind') this._setCenterKind(v);
          else if (key === 'dimmer') this._patch(scope, idx, { dimmer: v === 'force' ? true : (v === 'off' ? false : undefined) });
          else if (key in SELECT_DEFAULTS) this._patch(scope, idx, { [key]: v === SELECT_DEFAULTS[key] ? undefined : v });
          else this._patch(scope, idx, { [key]: v || undefined });
        }));

        if (!isTop) {
          own('[data-move]').forEach((btn) => btn.addEventListener('click', () => {
            const to = idx + Number(btn.getAttribute('data-move'));
            const arr = [...this._getList(scope)];
            if (to < 0 || to >= arr.length) return;
            [arr[idx], arr[to]] = [arr[to], arr[idx]];
            this._setList(scope, arr);
            this._render();   // l'ordre a changé : on redessine
          }));
          own('[data-del]').forEach((btn) => btn.addEventListener('click', () => {
            const arr = [...this._getList(scope)];
            if (scope === 'items' && arr.length <= 2) return;
            if (scope.includes('/') && arr.length <= 1) return;
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
        const it = this._getItem(scope, idx);
        if (!it) return;
        const own = (sel) => [...card.querySelectorAll(sel)].filter((el) => el.closest('[data-list]') === card);
        own('ha-entity-picker').forEach((ep) => {
          const key = ep.getAttribute('data-key') || 'entity';
          const v = key === 'center_scene' ? this._centerValue(it.center_hold_action) : (it[key] || '');
          if (ep.value !== v) ep.value = v;
        });
        own('ha-icon-picker').forEach((ip) => { if (ip.value !== (it.icon || '')) ip.value = it.icon || ''; });
        own('input[data-field]').forEach((inp) => {
          if (inp === focused) return;
          const key = inp.getAttribute('data-field');
          if (inp.type === 'checkbox') {
            if (key === '__group') inp.checked = Array.isArray(it.items);
            else inp.checked = DEFAULT_TRUE.includes(key) ? it[key] !== false : !!it[key];
            return;
          }
          if (inp.type === 'range') {
            const v = String(it[key] ?? RANGE_DEFAULTS[key]);
            if (inp.value !== v) inp.value = v;
            const lab = own(`[data-range-label="${key}"]`)[0];
            if (lab) lab.textContent = v;
            return;
          }
          let v;
          if (key === 'action_value') {
            v = actionKind(it) === 'popup' ? (it.popup === '#' ? '' : it.popup || '') : ((it.tap_action && it.tap_action.navigation_path) || '');
          } else if (key === 'center_value') {
            v = this._centerValue(it.center_hold_action);
          } else v = it[key] ?? '';
          if (inp.value !== String(v)) inp.value = String(v);
          const sw = own(`[data-swatch="${key}"]`)[0];
          if (sw) sw.value = toHex(v) || sw.getAttribute('data-default');
        });
        // Listes simples (modifiées éventuellement dans l'éditeur YAML)
        own('select[data-field]').forEach((sel) => {
          if (sel === focused) return;
          const key = sel.getAttribute('data-field');
          let v;
          if (key === 'dimmer') v = it.dimmer === false ? 'off' : (it.dimmer === true ? 'force' : 'auto');
          else if (key === 'position') v = POSITIONS.includes(it.position) ? it.position : '';
          else if (key in SELECT_DEFAULTS && key !== 'card_style' && key !== 'night_mode') v = it[key] || SELECT_DEFAULTS[key];
          else return;
          if ([...sel.options].some((o) => o.value === v) && sel.value !== v) sel.value = v;
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
    description: tr(langOf(null), 'card_desc'),
    documentationURL: 'https://github.com/benshoesweb/radial-selector-card',
  });
})();
