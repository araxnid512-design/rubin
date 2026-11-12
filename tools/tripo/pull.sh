#!/usr/bin/env bash
# Забрать готовые модели из ветки tripo-status в art3d/src/dw (только новые и изменившиеся)
cd "$(dirname "$0")/../.." || exit 1
git fetch -q origin tripo-status || exit 1
mkdir -p art3d/src/dw
for f in $(git ls-tree --name-only FETCH_HEAD files/ | sed 's#files/##'); do
  case "$f" in *_rig.glb) continue;; esac
  new=$(git rev-parse "FETCH_HEAD:files/$f")
  old=$( [ -f "art3d/src/dw/$f" ] && git hash-object "art3d/src/dw/$f" )
  if [ "$new" != "$old" ]; then git show "FETCH_HEAD:files/$f" > "art3d/src/dw/$f"; echo "новый: $f"; fi
done
