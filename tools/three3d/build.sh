#!/bin/bash
# Сборка game/js/lib/three.min.js (обычный скрипт, ES2019 — WebView Android 8+)
cd "$(dirname "$0")" && ./node_modules/.bin/esbuild entry.js --bundle --minify --format=iife --target=es2019 --legal-comments=eof --outfile=../../game/js/lib/three.min.js
