#!/usr/bin/env bash
# Проверка APK браузерной игры на Android-эмуляторе (CI, после выкладки в релиз): скачать APK по той же открытой
# ссылке, что у игроков, поставить, поставить поверх (обновление), запустить, снимки экрана, журнал.
# Результаты — в apk-test/ (сборка выкладывает их в gh-pages/apk-test/api<N>/, читать через raw.githubusercontent.com).
set -u
PKG=com.araxnid.ulei17
OUT=apk-test
URL=https://github.com/araxnid512-design/rubin/releases/download/game/ulei-cluster17.apk
mkdir -p "$OUT"
{
  echo "== устройство: Android $(adb shell getprop ro.build.version.release | tr -d '\r'), API $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "== APK из релиза (как у игроков)"
  curl -sSL --retry 3 -o "$OUT/ulei.apk" "$URL" && ls -l "$OUT/ulei.apk"
  echo "== установка"
  if adb install "$OUT/ulei.apk"; then echo "INSTALL: OK"; else echo "INSTALL: FAIL"; fi
  echo "== установка поверх (обновление той же подписью)"
  if adb install -r "$OUT/ulei.apk"; then echo "UPDATE: OK"; else echo "UPDATE: FAIL"; fi
  adb shell dumpsys package "$PKG" | grep -E "versionCode|versionName|firstInstallTime|lastUpdateTime" | head -4
  echo "== запуск"
  adb logcat -c || true
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
  # программная графика эмулятора: игра грузится долго — снимки через 30 и 90 с
  sleep 30
  adb exec-out screencap -p > "$OUT/screen-30s.png" || true
  sleep 60
  adb exec-out screencap -p > "$OUT/screen-90s.png" || true
  if adb shell pidof "$PKG" >/dev/null; then echo "RUN: OK (процесс жив через 90 с)"; else echo "RUN: FAIL (процесс не жив)"; fi
} 2>&1 | tee "$OUT/result.txt"
rm -f "$OUT/ulei.apk"
# журнал: падения и сообщения страницы игры (консоль WebView)
adb logcat -d -v brief | grep -iE "FATAL|AndroidRuntime|chromium|Console|ulei|crash" | tail -300 > "$OUT/logcat.txt" || true
adb shell dumpsys activity exit-info "$PKG" > "$OUT/exit-info.txt" 2>&1 || true
grep -q "INSTALL: OK" "$OUT/result.txt"
