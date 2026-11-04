# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/). Chaque version est décrite en français, puis en anglais.

*Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), following [semantic versioning](https://semver.org/). Each version is described in French, then in English.*

## [Non publié]

### Amélioré
- **Nombre d'entités allumées dans le voyant** : sur le bouton fermé, le voyant s'élargit en un petit bouton légèrement enfoncé, où le nombre est incrusté (au repos, il garde sa forme habituelle). Les chiffres restent droits quelle que soit l'orientation du bouton. Creux, biseau et chiffres sont adaptés à chaque thème (métal, Home Assistant, verre, doux, laiton, carbone, néon).
- Nouvelle option **`count_position`** : `knob` (défaut, dans le voyant) ou `badge` (pastille dans le coin, qui masque le nombre du voyant). La pastille prend désormais les couleurs du thème au lieu du bleu fixe. Réglable dans l'éditeur, section « Bouton central ».

#### English

##### Improved
- **Number of entities on, inside the indicator**: on the closed knob, the indicator widens into a small, slightly recessed button with the number inlaid in it (at rest, it keeps its usual shape). The digits stay upright whatever the knob's orientation. The recess, bevel and digits match each knob theme (metal, Home Assistant, glass, soft, brass, carbon, neon).
- New **`count_position`** option: `knob` (default, inside the indicator) or `badge` (corner badge, which hides the number in the indicator). The badge now uses the theme's colors instead of a fixed blue. Available in the editor, "Center knob" section.

## [1.2.1] — 2026-11-04

### Corrigé
- **Clavier et réduction automatique** : les touches (flèches, Tab, Entrée, Espace) relancent maintenant le délai `auto_close`, comme un geste à la souris ou au doigt. Avant, le cercle pouvait se refermer pendant qu'on le parcourait au clavier.

### Maintenance
- Workflow « Tests » : `actions/setup-node` passe à la version 7 (la version 4 utilisait Node.js 20, abandonné par GitHub).

#### English

##### Fixed
- **Keyboard and auto-collapse**: keys (arrows, Tab, Enter, Space) now restart the `auto_close` timer, like a mouse or touch gesture. Before, the dial could close while you were navigating it with the keyboard.

##### Maintenance
- "Tests" workflow: `actions/setup-node` moves to version 7 (version 4 used Node.js 20, retired by GitHub).

## [1.2.0] — 2026-11-04

### Ajouté
- **Bouton rotatif physique (jumeau)** : blueprint `blueprints/radial_knob_twin.yaml`. Tourner = entrée suivante / précédente, appuyer = allumer / éteindre, appuyer en tournant (ou double / triple appui) = luminosité, volume, position, consigne, vitesse ou valeur. Mode réglage optionnel (minuteur ou interrupteur) pour les boutons qui ne savent que tourner, geste « tout éteindre ». Modèles Tuya / Moes, IKEA Symfonisk, Philips Hue Tap Dial ; sources Zigbee2MQTT (MQTT), ZHA, entité événement ou capteur d'action, et événement `radial_selector_knob`.
- **`sync_entity`** (aide `input_text` / `input_select`) : la carte s'ouvre et pointe l'entrée choisie au bouton, y compris dans un groupe ; le bouton fermé la pointe aussi. `sync_open: false` : la carte reste fermée. Un appui sur une entrée de la carte la fait piloter par le bouton (`sync_from_card: false` pour désactiver). Section « Bouton rotatif physique » dans l'éditeur.
- 19 vérifications automatiques de plus (189 au total).

#### English

##### Added
- **Physical rotary knob (twin)**: blueprint `blueprints/radial_knob_twin.yaml`. Turn = next / previous entry, press = toggle, press and turn (or double / triple press) = brightness, volume, position, setpoint, speed or value. Optional adjust mode (timer or switch) for knobs that can only turn, "all off" gesture. Tuya / Moes, IKEA Symfonisk and Philips Hue Tap Dial presets; sources: Zigbee2MQTT (MQTT), ZHA, event entity or action sensor, and the `radial_selector_knob` event.
- **`sync_entity`** (`input_text` / `input_select` helper): the card opens and points at the entry chosen with the knob, including inside a group; the closed knob points at it too. `sync_open: false`: the card stays closed. Tapping an entry in the card makes the knob control it (`sync_from_card: false` to disable). "Physical rotary knob" section in the editor.
- 19 more automated checks (189 in total).

## [1.1.0] — 2026-11-03

### Ajouté
- **Molette pour d'autres appareils** : l'appui long règle le volume d'un `media_player`, la position d'un volet (`cover`), la consigne d'un thermostat (`climate`, au pas de l'appareil), la vitesse d'un ventilateur (`fan`) et la valeur d'un `input_number` / `number`. La valeur s'affiche sous l'icône (35 %, 20,5°, 12 dB…).
- **Lumières couleur** : appuis longs successifs (moins de 3 s d'écart) = luminosité → blanc (température en kelvins) → couleur (teinte). Arc dégradé, valeur et nom du mode au centre.
- **Groupes** : une entrée avec ses propres `items` ouvre un sous-cercle ; appui sur le bouton central (ou Échap) = retour. Sans entité, l'appui long sur le groupe allume ou éteint tout le groupe ; « 2/3 » sous l'icône.
- **Appui long sur le bouton central** (`center_hold_action`) : tout éteindre (`all_off`), pop-up, vue, scène ou action YAML, avec une onde de confirmation.
- **Bouton fermé** : nombre d'entités allumées (`show_count`) et halo coloré à la place de chaque entrée allumée (`show_halo`).
- **Retour haptique** au doigt (`haptics`) : application Home Assistant (respecte le réglage « Vibration » du profil) ou vibreur du navigateur.
- **Mode nuit** (`night_mode`: `sun`, `entity`, `always`, avec `night_entity` et `night_level`) : carte atténuée la nuit.
- Action **`all_off`** disponible aussi pour les boutons de coin et la ligne de boutons.
- **Anglais** : carte et éditeur suivent la langue de Home Assistant (français ou anglais).
- **Tests automatiques** (170 vérifications dans Chrome) lancés par GitHub Actions à chaque modification.

### Amélioré
- **Éditeur plus rapide** : les champs texte sont enregistrés 250 ms après la dernière frappe (ou en quittant le champ) ; la carte ne se reconstruit plus si la configuration n'a pas changé.
- Éditeur : sections « Bouton central » et « Mode nuit », réglage de l'appui long par entrée, édition des groupes.
- Clavier : les flèches parcourent les entrées sans rien activer, Entrée / Espace activent.

### Corrigé
- Clavier : Espace sur l'entrée déjà sélectionnée ne faisait rien, et les flèches activaient chaque entrée au passage.

#### English

##### Added
- **Rotary control for more devices**: a long press adjusts a `media_player`'s volume, a `cover`'s position, a `climate` setpoint (at the device's step), a `fan`'s speed and an `input_number` / `number` value. The value is shown under the icon (35 %, 20.5°, 12 dB…).
- **Color lights**: successive long presses (less than 3 s apart) = brightness → white (color temperature in kelvins) → color (hue). Gradient arc, value and mode name in the center.
- **Groups**: an entry with its own `items` opens a sub-dial; press the center knob (or Esc) to go back. Without an entity, a long press on the group turns the whole group on or off; "2/3" under the icon.
- **Long press on the center knob** (`center_hold_action`): turn everything off (`all_off`), pop-up, view, scene or YAML action, with a confirmation ripple.
- **Closed knob**: number of entities on (`show_count`) and a colored halo in place of each entry that is on (`show_halo`).
- **Haptic feedback** on touch (`haptics`): Home Assistant app (follows the profile's "Vibrate" setting) or the browser's vibration.
- **Night mode** (`night_mode`: `sun`, `entity`, `always`, with `night_entity` and `night_level`): dimmed card at night.
- **`all_off`** action also available for corner buttons and the button row.
- **English**: the card and its editor follow Home Assistant's language (French or English).
- **Automated tests** (170 checks in Chrome) run by GitHub Actions on every change.

##### Improved
- **Faster editor**: text fields are saved 250 ms after the last keystroke (or when leaving the field); the card is no longer rebuilt when the configuration hasn't changed.
- Editor: "Center knob" and "Night mode" sections, per-entry long press setting, group editing.
- Keyboard: arrows move between entries without activating anything, Enter / Space activate.

##### Fixed
- Keyboard: Space on the already selected entry did nothing, and the arrows activated every entry along the way.

## [1.0.0] — 2026-11-03

Première version publique : cercle de 2 à 10 entrées, zones tactiles, variateur (appui long, molette), pourcentage sous les lumières, boutons de coin, ligne de boutons, 7 thèmes, 7 animations d'ouverture, apparence de la carte, éditeur visuel complet, écran tactile, souris et clavier, réduction automatique.

#### English

First public release: dial of 2 to 10 entries, touch zones, dimmer (long press, mouse wheel), percentage under lights, corner buttons, button row, 7 themes, 7 opening animations, card appearance, full visual editor, touch screen, mouse and keyboard, auto-collapse.

[1.2.1]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.2.1
[1.2.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.2.0
[1.1.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.1.0
[1.0.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.0.0
