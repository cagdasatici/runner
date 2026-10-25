#!/bin/bash
# Redeploys the latest main to the home server: fetches origin/main into a throwaway
# worktree (so your own checkout and uncommitted work are never touched), installs,
# then runs the normal deploy (tests + build + copy). Run from anywhere in the repo:
#   scripts/redeploy.sh
set -euo pipefail
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
TMP="$(mktemp -d)/subway-runner-main"
cleanup() { git -C "$REPO" worktree remove --force "$TMP" 2>/dev/null || true; }
trap cleanup EXIT

git -C "$REPO" fetch origin main
git -C "$REPO" worktree add --detach "$TMP" origin/main
echo "Deploying $(git -C "$TMP" log -1 --format='%h %s')"
cd "$TMP/web"
npm ci --no-audit --no-fund
npm run deploy
