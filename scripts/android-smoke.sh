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
  # эмулятор — x86_64: ставим тестовую сборку под него (в телефонах — ARM, это ulei-godot.apk)
  APK=download/ulei-godot-x86_64.apk; [ -f "$APK" ] || APK=download/ulei-godot.apk
  if adb install -r "$APK"; then echo "INSTALL: OK ($APK)"; else echo "INSTALL: FAIL ($APK)"; fi
  echo "== запуск"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
  sleep 25
  if adb shell pidof "$PKG" >/dev/null; then echo "RUN: OK (процесс жив через 25 с)"; else echo "RUN: FAIL (процесс не жив)"; fi
} 2>&1 | tee "$OUT/result.txt"
adb exec-out screencap -p > "$OUT/screen.png" || true
adb logcat -d -v brief | grep -iE "godot|FATAL|AndroidRuntime|libc|DEBUG" | tail -300 > "$OUT/logcat.txt" || true
grep -q "INSTALL: OK" "$OUT/result.txt"
