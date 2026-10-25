#!/bin/bash
# Builds the game and copies it into the folder the home HTTPS server serves (outside the repo).
# Run from web/:  npm run deploy
# The iPad gets the new version the next time it opens the game on the home Wi-Fi
# (the service worker's cache name changes on every build).
set -euo pipefail
SITE="${SUBWAY_RUNNER_SITE:-$HOME/Library/Application Support/SubwayRunner}"   # override only for testing
if [ "${SKIP_TESTS:-0}" = 1 ]; then echo "Skipping tests (SKIP_TESTS=1)"; else echo "Running tests (~6 min, prints when done)..."; npm test; fi
npm run build
mkdir -p "$SITE/www"
rsync -a --delete dist/ "$SITE/www/"
# private face pictures (Arel, Nora) live outside git in $SITE/faces; the build never contains them
[ -d "$SITE/faces" ] && cp -R "$SITE/faces" "$SITE/www/faces"
mkdir -p "$SITE/www/support" && cp ../docs/site/*.html "$SITE/www/support/"   # privacy + support pages
cp scripts/serve-https.mjs "$SITE/serve-https.mjs"
echo "Deployed to $SITE/www:"
(cd "$SITE/www" && find . -type f | sort)
echo "Open https://$(scutil --get LocalHostName).local:8843/ on the iPad (home Wi-Fi)."
