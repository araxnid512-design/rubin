#!/bin/bash
# Обновить кэш классов/импорт (нужно после добавления новых class_name).
cd "$(dirname "$0")/.."
timeout 120 godot --headless --path . --import >/dev/null 2>&1
echo "import done"
