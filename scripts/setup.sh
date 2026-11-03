#!/usr/bin/env bash
# Crée le dépôt GitHub public, le configure pour HACS / Marketplace et publie la première version.
# Prérequis : git et GitHub CLI (gh) connecté à votre compte personnel (gh auth login).
# Usage : ./scripts/setup.sh [version]      (par défaut v1.0.0)
set -euo pipefail

cd "$(dirname "$0")/.."
REPO=radial-selector-card
VERSION="${1:-v1.0.0}"

command -v gh >/dev/null || { echo "GitHub CLI (gh) est requis : https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Connectez-vous d'abord : gh auth login"; exit 1; }
OWNER="$(gh api user --jq .login)"
echo "Compte GitHub : $OWNER"

# 1. Remplace le nom du compte dans le README, la licence et la carte
for f in README.md LICENSE dist/radial-selector-card.js; do
  perl -pi -e "s/__OWNER__/${OWNER}/g" "$f"
done

# 2. Premier commit
if [ ! -d .git ]; then
  git init -q -b main
fi
chmod +x scripts/*.sh
git add -A
git commit -q -m "Radial Selector Card ${VERSION}" || true

# 3. Dépôt public + description, sujets, tickets (exigés par le catalogue)
gh repo create "${OWNER}/${REPO}" --public --source . --remote origin --push \
  --description "Sélecteur rotatif pour les tableaux de bord Home Assistant : lumières, variateur, zones tactiles, thèmes et animations."
gh repo edit "${OWNER}/${REPO}" --enable-issues \
  --add-topic home-assistant --add-topic hacs --add-topic lovelace \
  --add-topic dashboard --add-topic custom-card --add-topic lovelace-custom-card

# 4. Première version : le tag déclenche le workflow « Release »
git tag "${VERSION}"
git push -q origin "${VERSION}"

echo
echo "C'est publié. Suivi des workflows : https://github.com/${OWNER}/${REPO}/actions"
echo "Installation par lien (avant l'entrée dans le catalogue) :"
echo "  https://my.home-assistant.io/redirect/hacs_repository/?owner=${OWNER}&repository=${REPO}&category=plugin"
echo "Quand « Validate » et « Release » sont verts : ./scripts/submit-to-hacs-default.sh"
