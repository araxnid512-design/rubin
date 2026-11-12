#!/usr/bin/env bash
# Забрать готовые модели из ветки tripo-status в art3d/src/dw (только новые и изменившиеся)
cd "$(dirname "$0")/../.." || exit 1
git fetch -q origin tripo-status || exit 1
mkdir -p art3d/src/dw
for f in $(git ls-tree --name-only FETCH_HEAD files/ | sed 's#files/##'); do
  # без скелета модели людей и мутантов не нужны (скелет — в файлах с движениями _a/_b)
  case "$f" in *_rig.glb) continue;; c_*_[ab].glb|m_*_[ab].glb) ;; c_*.glb|m_*.glb) continue;; esac
  new=$(git rev-parse "FETCH_HEAD:files/$f")
  old=$( [ -f "art3d/src/dw/$f" ] && git hash-object "art3d/src/dw/$f" )
  # уже ужатые не перекачиваем: отметка — исходный хэш в art3d/src/dw/.got
  grep -q "^$f $new$" art3d/src/dw/.got 2>/dev/null && continue
  if [ "$new" != "$old" ]; then git show "FETCH_HEAD:files/$f" > "art3d/src/dw/$f"; echo "$f $new" >> art3d/src/dw/.got; echo "новый: $f"; fi
done
