#!/usr/bin/env bash
# Сборка APK BUNKER SURVIVAL:
#  1) импорт ресурсов Godot, 2) упаковка игры (export-pack .zip, ETC2/ASTC текстуры),
#  3) распаковка в android/app/build/godot_assets, 4) Gradle собирает APK с библиотекой Godot 4.6.3.
# GODOT — путь к редактору Godot 4.6.3 (по умолчанию /home/user/godotengine/godot4).
set -e
cd "$(dirname "$0")/.."
GODOT=${GODOT:-/home/user/godotengine/godot4}
mkdir -p export
# библиотека Godot для Android (официальная, Maven Central) — не хранится в репозитории
AAR=android/app/libs/godot-4.6.3.stable.aar
if [ ! -f "$AAR" ]; then
  mkdir -p android/app/libs
  curl -sfL -o "$AAR" https://repo1.maven.org/maven2/org/godotengine/godot/4.6.3.stable/godot-4.6.3.stable.aar
fi
"$GODOT" --headless --path . --import > export/import.log 2>&1 || true
python3 tools/fix_imports.py
"$GODOT" --headless --path . --import >> export/import.log 2>&1 || true
rm -f export/bunker.zip
"$GODOT" --headless --path . --export-pack "Android" export/bunker.zip > export/pack.log 2>&1
A=android/app/build/godot_assets
rm -rf "$A" && mkdir -p "$A"
unzip -q export/bunker.zip -d "$A"
(cd android && ./gradlew assembleRelease -q)
cp android/app/build/outputs/apk/release/app-release.apk export/BunkerSurvival.apk
ls -la export/BunkerSurvival.apk
