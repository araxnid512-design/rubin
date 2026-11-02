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
  # в эмуляторе графика программная — локация грузится долго: снимки через 40 и 100 с
  sleep 40
  adb exec-out screencap -p > "$OUT/screen-40s.png" || true
  adb shell dumpsys meminfo "$PKG" > "$OUT/meminfo-40s.txt" 2>&1 || true
  sleep 60
  if adb shell pidof "$PKG" >/dev/null; then echo "RUN: OK (процесс жив через 100 с)"; else echo "RUN: FAIL (процесс не жив)"; fi
} 2>&1 | tee "$OUT/result.txt"
adb exec-out screencap -p > "$OUT/screen.png" || true
adb logcat -d -v brief | grep -iE "godot|FATAL|AndroidRuntime|libc|DEBUG|lowmemory|lmkd|ulei|crash|tombstone" | tail -400 > "$OUT/logcat.txt" || true
adb logcat -d -v brief | tail -2500 > "$OUT/logcat-full.txt" || true
# почему процесс завершился (Android 11+): нехватка памяти, падение, сигнал
adb shell dumpsys activity exit-info "$PKG" > "$OUT/exit-info.txt" 2>&1 || true
adb shell dumpsys meminfo "$PKG" > "$OUT/meminfo.txt" 2>&1 || true
grep -q "INSTALL: OK" "$OUT/result.txt"
