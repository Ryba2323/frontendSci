#!/usr/bin/env bash
# Sprawdza schemat bazy na prawdziwym Postgresie (lokalnym, tymczasowym):
#   1. czy notes/supabase-testy-dane.sql i supabase-wnioski-dane.sql są zgodne z plikami *-dane.js aplikacji,
#   2. czy wszystkie pliki notes/supabase-*.sql wgrywają się po kolei na czystą bazę,
#   3. testy uprawnień (RLS), zgód, podlewania, wniosków, prób, liczenia wyników i usuwania (narzedzia/baza/test.sql),
#      w tym porównanie wyników z bazy z wynikami liczonymi w aplikacji dla losowych odpowiedzi.
#
# Wymaga: Node i serwer PostgreSQL 15+ (initdb, pg_ctl, psql; np. `apt install postgresql`).
# macOS: `brew install postgresql@17`, potem PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" bash narzedzia/sprawdz-baze.sh
# Użycie:  bash narzedzia/sprawdz-baze.sh
# Niczego nie zostawia: baza powstaje w katalogu tymczasowym i znika po testach.
set -euo pipefail
cd "$(dirname "$0")/.."
# macOS: bez poprawnego LC_ALL serwer kończy start błędem „postmaster became multithreaded during startup”
if [ "$(uname)" = Darwin ]; then export LC_ALL="${LC_ALL:-en_US.UTF-8}"; fi

BIN=$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")
[ -x "$BIN/initdb" ] || { echo "Nie znaleziono PostgreSQL (initdb). Zainstaluj: apt install postgresql"; exit 1; }

node narzedzia/baza/generuj-dane-testow.js --sprawdz
node narzedzia/baza/generuj-dane-wnioskow.js --sprawdz
node narzedzia/baza/generuj-porownanie.js > narzedzia/baza/_wyniki.sql

DIR=$(mktemp -d /tmp/releaf-baza.XXXXXX)
PORT=54329
# Postgres nie startuje jako root: w kontenerze uruchamiamy go jako użytkownik „postgres”
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; RUN=(su postgres -c); else RUN=(bash -c); fi
stop() { "${RUN[@]}" "'$BIN/pg_ctl' -D '$DIR/data' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR" narzedzia/baza/_wyniki.sql; }
trap stop EXIT

"${RUN[@]}" "'$BIN/initdb' -D '$DIR/data' -A trust -U postgres --locale=C.UTF-8 >/dev/null"
"${RUN[@]}" "'$BIN/pg_ctl' -D '$DIR/data' -o '-p $PORT -k $DIR -c listen_addresses=' -l '$DIR/log' -w start >/dev/null"

PSQL=("$BIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
for f in narzedzia/baza/atrapa-supabase.sql notes/supabase-schema.sql notes/supabase-testy.sql notes/supabase-testy-dane.sql \
         notes/supabase-wnioski.sql notes/supabase-wnioski-dane.sql; do
  echo "wgrywam $f"
  "${PSQL[@]}" -f "$f"
done
echo "testy"
"${PSQL[@]}" -At -f narzedzia/baza/test.sql
