# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Amélioré
- **Nombre d'entités allumées dans le voyant** : sur le bouton fermé, le voyant s'élargit en un petit bouton légèrement enfoncé, où le nombre est incrusté (au repos, il garde sa forme habituelle). Les chiffres restent droits quelle que soit l'orientation du bouton. Creux, biseau et chiffres sont adaptés à chaque thème (métal, Home Assistant, verre, doux, laiton, carbone, néon).
- Nouvelle option **`count_position`** : `knob` (défaut, dans le voyant) ou `badge` (pastille dans le coin, qui masque le nombre du voyant). La pastille prend désormais les couleurs du thème au lieu du bleu fixe. Réglable dans l'éditeur, section « Bouton central ».

## [1.2.1] — 2026-11-04

### Corrigé
- **Clavier et réduction automatique** : les touches (flèches, Tab, Entrée, Espace) relancent maintenant le délai `auto_close`, comme un geste à la souris ou au doigt. Avant, le cercle pouvait se refermer pendant qu'on le parcourait au clavier.

### Maintenance
- Workflow « Tests » : `actions/setup-node` passe à la version 7 (la version 4 utilisait Node.js 20, abandonné par GitHub).

## [1.2.0] — 2026-11-04

### Ajouté
- **Bouton rotatif physique (jumeau)** : blueprint `blueprints/radial_knob_twin.yaml`. Tourner = entrée suivante / précédente, appuyer = allumer / éteindre, appuyer en tournant (ou double / triple appui) = luminosité, volume, position, consigne, vitesse ou valeur. Mode réglage optionnel (minuteur ou interrupteur) pour les boutons qui ne savent que tourner, geste « tout éteindre ». Modèles Tuya / Moes, IKEA Symfonisk, Philips Hue Tap Dial ; sources Zigbee2MQTT (MQTT), ZHA, entité événement ou capteur d'action, et événement `radial_selector_knob`.
- **`sync_entity`** (aide `input_text` / `input_select`) : la carte s'ouvre et pointe l'entrée choisie au bouton, y compris dans un groupe ; le bouton fermé la pointe aussi. `sync_open: false` : la carte reste fermée. Un appui sur une entrée de la carte la fait piloter par le bouton (`sync_from_card: false` pour désactiver). Section « Bouton rotatif physique » dans l'éditeur.
- 19 vérifications automatiques de plus (189 au total).

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

## [1.0.0] — 2026-11-03

Première version publique : cercle de 2 à 10 entrées, zones tactiles, variateur (appui long, molette), pourcentage sous les lumières, boutons de coin, ligne de boutons, 7 thèmes, 7 animations d'ouverture, apparence de la carte, éditeur visuel complet, écran tactile, souris et clavier, réduction automatique.

[1.2.1]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.2.1
[1.2.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.2.0
[1.1.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.1.0
[1.0.0]: https://github.com/benshoesweb/radial-selector-card/releases/tag/v1.0.0
