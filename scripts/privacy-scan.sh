#!/usr/bin/env bash
set -euo pipefail

patterns=(
  '/[U]sers/[Aa]idi'
  '大[字]典'
  '/one[ ]code/'
  'aidide[M]ac'
  '[.]lan\b'
  'aidi[@]'
  'API[k]ey'
  '/private/[t]mp/'
)

for pattern in "${patterns[@]}"; do
  if rg -n --hidden -g '!**/.git/**' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/build/**' -g '!**/*.lock' "$pattern" .; then
    exit 1
  fi
done
