#!/bin/bash
# Проверка компиляции всех скриптов проекта (с автозагрузками).
cd "$(dirname "$0")/.."
timeout 120 godot --headless --path . -s tools/check_all.gd 2>&1 | grep -vE "^ALSA|audio|Godot Engine" | grep -E "ERROR|FAILED|CANNOT|CHECK DONE|Parse|at:" | head -60
