#!/usr/bin/env bash
# check-rls.sh — Static analysis: every CREATE TABLE in public schema
# must have a corresponding ENABLE ROW LEVEL SECURITY across all migrations.
# Runs in CI (no DB connection needed).

set -euo pipefail

MIGRATIONS_DIR="${1:-supabase/migrations}"
EXIT_CODE=0
ALL_SQL_FILE=$(mktemp)
trap 'rm -f "$ALL_SQL_FILE"' EXIT

# Concatenate all migrations into a temp file (avoids shell variable limits)
cat "$MIGRATIONS_DIR"/*.sql > "$ALL_SQL_FILE" 2>/dev/null || true

if [ ! -s "$ALL_SQL_FILE" ]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

# Find all CREATE TABLE statements targeting public schema (or unqualified = public default)
TABLES=$(grep -ioP 'CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?(?!.*\b(pg_|_timescaledb))\K[a-z_][a-z0-9_]*' "$ALL_SQL_FILE" | sort -u || true)

for table in $TABLES; do
  # Check if RLS is enabled anywhere (with or without public. prefix)
  if ! grep -qiP "ALTER\s+TABLE\s+(public\.)?${table}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY" "$ALL_SQL_FILE"; then
    SOURCE=$(grep -liP "CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?${table}\b" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | head -1)
    echo "🔴 MISSING RLS: public.${table}"
    echo "   Created in: ${SOURCE:-unknown}"
    echo "   Fix: Add ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY + policy"
    EXIT_CODE=1
  fi
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All public tables have RLS enabled."
fi

exit $EXIT_CODE
