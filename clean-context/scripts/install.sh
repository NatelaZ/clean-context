#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/skills/clean-context"
if [ -L "$DEST" ] || [ -e "$DEST" ]; then rm -rf "$DEST"; fi
ln -s "$SRC" "$DEST"
echo "Симлинк создан: $DEST -> $SRC"
