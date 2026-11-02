#!/usr/bin/env bash
# Проверка APK на Android-эмуляторе (CI): установка, запуск, жив ли процесс через 25 с, снимок экрана, журнал.
# Результаты — в android-test/ (их выкладывает сборка, чтобы посмотреть со стороны).
set -u
PKG=com.araxnid.ulei.godot
OUT=android-test
mkdir -p "$OUT"
{
  echo "== устройство"; adb shell getprop ro.build.version.release; adb shell getprop ro.product.cpu.abilist
  echo "== установка"
  if adb install -r download/ulei-godot.apk; then echo "INSTALL: OK"; else echo "INSTALL: FAIL"; fi
  echo "== запуск"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
  sleep 25
  if adb shell pidof "$PKG" >/dev/null; then echo "RUN: OK (процесс жив через 25 с)"; else echo "RUN: FAIL (процесс не жив)"; fi
} 2>&1 | tee "$OUT/result.txt"
adb exec-out screencap -p > "$OUT/screen.png" || true
adb logcat -d -v brief | grep -iE "godot|FATAL|AndroidRuntime|libc|DEBUG" | tail -300 > "$OUT/logcat.txt" || true
grep -q "INSTALL: OK" "$OUT/result.txt"
