#!/usr/bin/env bash
# Atualiza clone em DEPLOY_PATH para origin/main (evita race em fetch concorrente).
set -euo pipefail
DEPLOY_PATH="${1:-${DEPLOY_PATH:-/opt/radarzap}}"
cd "$DEPLOY_PATH"
for attempt in 1 2 3 4 5; do
  if git fetch origin +refs/heads/main:refs/remotes/origin/main -q 2>/dev/null; then
    git reset --hard origin/main -q
    exit 0
  fi
  sleep 2
done
git fetch origin main --force -q
git reset --hard origin/main -q
