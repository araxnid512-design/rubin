#!/usr/bin/env bash
# Выложить папку status/ в ветку tripo-status (одним коммитом, с заменой) — оттуда её читает Claude.
# Нужны GH_TOKEN и GITHUB_REPOSITORY (есть в GitHub Actions).
set -e
[ -d status ] || exit 0
tmp=$(mktemp -d)
cp -r status/. "$tmp/"
cd "$tmp"
git init -q
git checkout -q -b tripo-status
git add -A
git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -q -m "Tripo: статус $(date -u +%H:%M:%S)"
git push -q -f "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" tripo-status 2>&1 | grep -v "x-access-token" || true
cd - >/dev/null
rm -rf "$tmp"
