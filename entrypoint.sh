#!/bin/sh
set -e

case "$DATABASE_URL" in
  enc:v1:*)
    echo "🔐 Encrypted environment detected, decrypting..."
    if [ -x node_modules/.bin/tsx ]; then
      eval "$(node_modules/.bin/tsx scripts/env-export.ts)"
      echo "✅ Environment decrypted"
    else
      echo "✖ Environment is encrypted but tsx is unavailable in this image." >&2
      echo "  Pass plain values from your orchestrator's secret store instead." >&2
      exit 1
    fi
    ;;
esac

echo "⏳ Waiting for PostgreSQL..."

until pg_isready \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER"; do
  sleep 2
done

echo "✅ PostgreSQL is ready"
echo "🚀 Applying migrations"
npx prisma migrate deploy
echo "✅ Migrations up to date"

echo "🚀 Starting application"
exec "$@"
