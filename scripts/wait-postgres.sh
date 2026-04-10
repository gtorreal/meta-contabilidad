#!/usr/bin/env bash
# Espera a que Postgres del docker-compose acepte conexiones (hasta ~60 s).
set -euo pipefail
cd "$(dirname "$0")/.."
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U meta -d meta_contabilidad >/dev/null 2>&1; then
    echo "Postgres listo (meta_contabilidad)."
    exit 0
  fi
  sleep 1
done
echo "Timeout: el contenedor postgres no respondió a pg_isready. ¿Está Docker Desktop en marcha? ¿Corrió \`docker compose up -d postgres\`?" >&2
exit 1
