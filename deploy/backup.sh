#!/usr/bin/env bash
# =============================================================================
# LAILA — Database & Uploads Backup Script
# =============================================================================
# Usage:  ./backup.sh [backup_dir]
#
# Defaults:
#   backup_dir  = ../backups  (relative to this script's location)
#
# Creates timestamped backups of the PostgreSQL database and uploads directory.
# Keeps the last 30 daily backups by default (configurable via KEEP_DAYS).
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${1:-$PROJECT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# Load environment for DB credentials
if [ -f "$PROJECT_DIR/server/.env" ]; then
    set -a
    source "$PROJECT_DIR/server/.env"
    set +a
else
    echo "ERROR: $PROJECT_DIR/server/.env not found. Cannot read DB credentials."
    exit 1
fi

# ---------------------------------------------------------------------------
# Parse DATABASE_URL for pg_dump
# ---------------------------------------------------------------------------
# Expected format: postgresql://user:pass@host:port/dbname
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
    echo "ERROR: DATABASE_URL does not look like a PostgreSQL connection string."
    echo "       Backup only supports PostgreSQL databases."
    exit 1
fi

# Extract components
DB_USER="$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')"
DB_PASS="$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')"
DB_HOST="$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')"
DB_PORT="$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')"
DB_NAME="$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')"

# ---------------------------------------------------------------------------
# Create backup directory
# ---------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
echo "=== LAILA Backup — $TIMESTAMP ==="
echo "    Project:   $PROJECT_DIR"
echo "    Output:    $BACKUP_DIR"

# ---------------------------------------------------------------------------
# 1. Database backup
# ---------------------------------------------------------------------------
DB_BACKUP_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
echo ""
echo "--- Backing up database ($DB_NAME)..."
PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    | gzip > "$DB_BACKUP_FILE"
echo "    Saved: $DB_BACKUP_FILE ($(du -h "$DB_BACKUP_FILE" | cut -f1))"

# ---------------------------------------------------------------------------
# 2. Uploads backup
# ---------------------------------------------------------------------------
UPLOADS_DIR="$PROJECT_DIR/server/uploads"
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
    echo ""
    echo "--- Backing up uploads directory..."
    tar -czf "$UPLOADS_BACKUP_FILE" -C "$PROJECT_DIR/server" uploads
    echo "    Saved: $UPLOADS_BACKUP_FILE ($(du -h "$UPLOADS_BACKUP_FILE" | cut -f1))"
else
    echo ""
    echo "--- Uploads directory is empty or missing, skipping."
fi

# ---------------------------------------------------------------------------
# 3. Prune old backups
# ---------------------------------------------------------------------------
echo ""
echo "--- Pruning backups older than $KEEP_DAYS days..."
PRUNED=$(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +"$KEEP_DAYS" -delete -print | wc -l)
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +"$KEEP_DAYS" -delete
echo "    Removed $PRUNED old backup(s)."

echo ""
echo "=== Backup complete ==="
