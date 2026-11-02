#!/usr/bin/env bash
# Вход программы tripo по аккаунту (CI, .github/workflows/tripo-cli.yml).
# 1) Есть сохранённая сессия (ветка tripo-session, session.enc, шифр — секрет SESSION_PASS) — восстановить.
# 2) Иначе tripo auth login: почта — из секрета TRIPO_EMAIL, Tripo шлёт на неё код. Код в журналы и в ветки
#    открытым текстом не попадает: сборка «Tripo: код» (tripo-code.yml) берёт его из секрета TRIPO_CODE и
#    шифрует открытым ключом этой сборки (status/pubkey.pem) вместе с разовой меткой (status/nonce.txt) —
#    файл code.enc в ветке tripo-code; здесь он расшифровывается и вводится в программу.
# 3) После входа сессия шифруется и сохраняется в ветку tripo-session — следующие запуски без кода.
set +e
mkdir -p status
repo="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
mask() { sed -e 's/\x1b\[[0-9;]*m//g' -e "s/${TRIPO_EMAIL:-@@@}/<почта>/g"; }
note() { { echo "# Вход в Tripo ($(date -u +%H:%M:%S) UTC)"; echo; echo "$1"; echo; echo '```'; [ -f login.log ] && mask < login.log | head -40; echo '```'; } > status/login.md; bash scripts/tripo-publish.sh; }
logged_in() { tripo account balance > /tmp/bal.txt 2>&1 && ! grep -qiE "not logged|unauthor|login first|auth login" /tmp/bal.txt; }

touch /tmp/start-marker
if [ -n "$SESSION_PASS" ] && git fetch -q origin tripo-session 2>/dev/null && git show FETCH_HEAD:session.enc > /tmp/session.enc 2>/dev/null; then
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:SESSION_PASS -in /tmp/session.enc 2>/dev/null | tar xz -C "$HOME" 2>/dev/null
fi
if logged_in; then
  echo "вход: сохранённая сессия"; note "Вход по сохранённой сессии — код не нужен."; exit 0
fi
if [ -z "$TRIPO_EMAIL" ]; then note "Нет секрета TRIPO_EMAIL (почта аккаунта Tripo)."; exit 1; fi

openssl genrsa -out /tmp/key.pem 2048 2>/dev/null
openssl rsa -in /tmp/key.pem -pubout -out status/pubkey.pem 2>/dev/null
nonce=$(openssl rand -hex 12); echo "$nonce" > status/nonce.txt
mkfifo /tmp/login.in
tripo auth login < /tmp/login.in > login.log 2>&1 &
lpid=$!
exec 3>/tmp/login.in
printf '%s\n' "$TRIPO_EMAIL" >&3
sleep 8
note "Ждём код из письма Tripo: положите его в секрет TRIPO_CODE, затем Claude запустит сборку «Tripo: код»."
got=""
for i in $(seq 1 150); do
  kill -0 $lpid 2>/dev/null || break
  sleep 8
  git fetch -q origin tripo-code 2>/dev/null || continue
  git show FETCH_HEAD:code.enc 2>/dev/null | base64 -d > /tmp/code.enc 2>/dev/null || continue
  msg=$(openssl pkeyutl -decrypt -inkey /tmp/key.pem -in /tmp/code.enc 2>/dev/null) || continue
  [ "${msg%%:*}" = "$nonce" ] || continue
  printf '%s\n' "${msg#*:}" >&3
  got=1; echo "код получен и введён"; break
done
for i in $(seq 1 30); do kill -0 $lpid 2>/dev/null || break; sleep 2; done
exec 3>&-
kill $lpid 2>/dev/null
if logged_in; then
  # сохранить сессию: файлы программы tripo, изменённые при входе (кроме самой программы)
  files=$(cd "$HOME" && find . -newer /tmp/start-marker -type f \( -path '*tripo*' -o -path '*Tripo*' \) ! -path './.npm/*' ! -path '*/node_modules/*' 2>/dev/null)
  if [ -n "$SESSION_PASS" ] && [ -n "$files" ]; then
    (cd "$HOME" && tar czf - $files) | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -pass env:SESSION_PASS -out /tmp/session.enc
    d=$(mktemp -d); cp /tmp/session.enc "$d/"; (cd "$d" && git init -q && git checkout -q -b tripo-session && git add -A && git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -qm "Tripo: сессия (зашифрована)" && git push -qf "$repo" tripo-session 2>&1 | grep -v x-access-token)
  fi
  note "Вход выполнен$([ -n "$got" ] && echo ' по коду из письма'). Сессия сохранена — в следующий раз код не понадобится."
  exit 0
fi
note "Вход не удался$([ -z "$got" ] && echo ': код так и не пришёл (секрет TRIPO_CODE / сборка «Tripo: код»)')."
exit 1
