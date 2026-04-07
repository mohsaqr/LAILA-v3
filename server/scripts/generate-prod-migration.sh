#!/bin/bash
# Generate a PostgreSQL migration file without needing a running database.
# Diffs the committed prod schema (git HEAD) against the current working copy.
#
# Usage: npm run db:migrate:prod -- --name migration_name

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PRISMA_DIR="$SCRIPT_DIR/../prisma/prod"
SCHEMA_FILE="$PRISMA_DIR/schema.prisma"

# Parse --name argument
NAME=""
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --name) NAME="$2"; shift ;;
    *) ;;
  esac
  shift
done

if [ -z "$NAME" ]; then
  echo "Usage: npm run db:migrate:prod -- --name <migration_name>"
  exit 1
fi

# Get the last committed version of the schema as a temp file
PREV_SCHEMA=$(mktemp)
trap "rm -f $PREV_SCHEMA" EXIT

git show HEAD:"server/prisma/prod/schema.prisma" > "$PREV_SCHEMA" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "No previous schema found in git — generating full migration from empty."
  DIFF_FROM="--from-empty"
else
  DIFF_FROM="--from-schema-datamodel $PREV_SCHEMA"
fi

# Generate the diff SQL
SQL=$(npx prisma migrate diff \
  $DIFF_FROM \
  --to-schema-datamodel "$SCHEMA_FILE" \
  --script 2>&1)

if [ $? -ne 0 ]; then
  echo "Error generating migration diff:"
  echo "$SQL"
  exit 1
fi

# Check if there are actual changes
if [ -z "$SQL" ] || echo "$SQL" | grep -q "^-- This is an empty migration"; then
  echo "No schema changes detected — nothing to migrate."
  exit 0
fi

# Create migration directory
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_DIR="$PRISMA_DIR/migrations/${TIMESTAMP}_${NAME}"
mkdir -p "$MIGRATION_DIR"

# Write the SQL file
echo "$SQL" > "$MIGRATION_DIR/migration.sql"

echo "Migration created: prisma/prod/migrations/${TIMESTAMP}_${NAME}/migration.sql"
echo ""
cat "$MIGRATION_DIR/migration.sql"
