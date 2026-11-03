#!/bin/bash
# Сборка ZIP-архива исходного проекта Godot (без кэша .godot и сборок).
cd "$(dirname "$0")/.."
OUT="build/dolg_vozrozhdenie_project.zip"
mkdir -p build
rm -f "$OUT"
git ls-files -z | xargs -0 zip -q -9 "$OUT"
ls -la "$OUT"
