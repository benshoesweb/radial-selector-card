# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/). Chaque version est décrite en français, puis en anglais.

*Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), following [semantic versioning](https://semver.org/). Each version is described in French, then in English.*

## [1.6.0] — 2026-11-05

### Ajouté
- **Nom de la carte en titre** : nouvelle option **`show_title`** (« Afficher le nom en titre en haut de la carte » dans l'éditeur). Le nom s'affiche en haut de la carte, toujours visible, comme dans Day Wheel Card. Désactivée par défaut : les cartes existantes ne changent pas.
- Avec le titre affiché, le libellé sous le cercle ne répète pas le nom quand le cercle est fermé ; il affiche toujours l'entrée survolée ou choisie quand il est ouvert. La carte prend une ligne de plus dans la grille.
- Éditeur : une indication explique où s'affiche le nom de la carte.
- 13 vérifications automatiques de plus (235 au total).

#### English

##### Added
- **Card name as a title**: new **`show_title`** option ("Show the name as a title at the top of the card" in the editor). The name is shown at the top of the card, always visible, as in Day Wheel Card. Off by default: existing cards don't change.
- With the title shown, the label under the dial doesn't repeat the name while the dial is closed; it still shows the hovered or selected entry when open. The card takes one more row in the grid.
- Editor: a hint explains where the card name is shown.
- 13 more automated checks (235 in total).

## [1.5.0] — 2026-11-05

### Modifié
- **Noms des entités comme dans Home Assistant** : sans `name` choisi, une entrée prend le nom que Home Assistant affiche lui-même (`hass.formatEntityName`, fourni par les versions récentes de Home Assistant), au lieu de l'attribut `friendly_name`, dont la suppression est annoncée. Depuis 2026.11, ce nom est souvent celui de l'appareil suivi de celui de l'entité (ex. « Séjour Plafonnier »), comme dans les cartes de Home Assistant. Pour garder un nom court, choisissez-le dans l'éditeur (champ « Nom ») ou avec `name`. Sur les versions qui ne le fournissent pas, rien ne change (`friendly_name`).

### Corrigé
- **Lecteurs d'écran** : les noms des entrées, des boutons de coin et de la ligne de boutons sont mis à jour avec les états de Home Assistant ; avant, ils pouvaient rester sur l'entity_id.
- 7 vérifications automatiques de plus (222 au total).

#### English

##### Changed
- **Entity names like Home Assistant's**: without a chosen `name`, an entry uses the name Home Assistant itself displays (`hass.formatEntityName`, provided by recent Home Assistant versions), instead of the `friendly_name` attribute, whose removal has been announced. Since 2026.11, this name is often the device name followed by the entity name (e.g. "Living room Ceiling"), as in Home Assistant's cards. To keep a short name, set it in the editor ("Name" field) or with `name`. On versions that don't provide it, nothing changes (`friendly_name`).

##### Fixed
- **Screen readers**: the names of the entries, corner buttons and button row are updated with Home Assistant's states; they could previously stay on the entity_id.
- 7 more automated checks (222 in total).

## [1.4.1] — 2026-11-05

### Corrigé
- **Éditeur : fond des champs et des listes** : ils reprenaient l'image de fond du tableau de bord (`--lovelace-background`). Avec un thème au fond en dégradé ou en image (par exemple une aurore boréale), chaque champ en affichait une version réduite et floue. Ils prennent maintenant la couleur de champ du thème (`--input-fill-color`, à défaut la couleur secondaire), comme les champs de Home Assistant.

#### English

##### Fixed
- **Editor: field and dropdown background**: they used the dashboard's background image (`--lovelace-background`). With a theme whose background is a gradient or an image (an aurora, for example), every field showed a small, blurry copy of it. They now use the theme's field color (`--input-fill-color`, or the secondary background color), like Home Assistant's own fields.

## [1.4.0] — 2026-11-04

### Ajouté
- **Couleurs du nombre d'entités allumées** : nouvelles options **`count_background`** (fond) et **`count_color`** (chiffre), réglables dans l'éditeur, section « Bouton central », pour le voyant comme pour la pastille. L'option `count_position` ne change pas.

### Modifié
- **Le thème Home Assistant devient le défaut** : sans réglage, le fond prend la couleur principale du thème actif (`--primary-color`) et le chiffre sa couleur de texte (`--text-primary-color`), quel que soit le thème du bouton, et suivent le thème quand il change. Chaque thème du bouton garde son relief. Les couleurs propres aux thèmes laiton, carbone, néon, etc. ne sont donc plus appliquées d'office : elles se retrouvent en les choisissant dans les options.
- **Chiffre toujours lisible** : sans couleur de chiffre choisie, celui-ci passe en noir ou en blanc si le texte du thème est peu lisible sur sa couleur principale (contraste inférieur à 2,5), ou si seul le fond est choisi.

#### English

##### Added
- **Colors of the number of entities on**: new **`count_background`** (background) and **`count_color`** (digit) options, available in the editor, "Center knob" section, for both the indicator and the badge. The `count_position` option is unchanged.

##### Changed
- **The Home Assistant theme is now the default**: with nothing set, the background uses the active theme's primary color (`--primary-color`) and the digit its text color (`--text-primary-color`), whatever the knob theme, and they follow the theme when it changes. Each knob theme keeps its own relief. The colors specific to the brass, carbon, neon… themes are therefore no longer applied automatically: pick them in the options to get them back.
- **Always readable digit**: without a chosen digit color, the digit turns black or white if the theme's text is hard to read on its primary color (contrast below 2.5), or if only the background is set.

## [1.3.1] — 2026-11-04

### Corrigé
- **Réduction automatique** : un geste (touche, souris, doigt) arrivé moins de 250 ms après le précédent ne repoussait pas la fermeture, si bien que le cercle pouvait se refermer jusqu'à 250 ms trop tôt. Le délai repart maintenant toujours du dernier geste. Le test de navigation au clavier, qui échouait parfois pour cette raison, est désormais stable.

#### English

##### Fixed
- **Auto-collapse**: a gesture (key, mouse, touch) arriving less than 250 ms after the previous one did not push back the closing, so the dial could close up to 250 ms too early. The delay now always restarts from the latest gesture. The keyboard navigation test, which sometimes failed for this reason, is now stable.

## [1.3.0] — 2026-11-04

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

[1.6.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.6.0
[1.5.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.5.0
[1.4.1]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.4.1
[1.4.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.4.0
[1.3.1]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.3.1
[1.3.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.3.0
[1.2.1]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.2.1
[1.2.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.2.0
[1.1.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.1.0
[1.0.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.0.0
