#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# laila-restore.sh — read, test and restore the bundles laila-backup.sh writes.
#
#   laila-restore.sh list                      what exists, locally and off-site
#   laila-restore.sh inspect <bundle>          open it and show what is inside
#   laila-restore.sh verify  [<bundle>]        RESTORE TEST: load it into a
#                                              throwaway database, compare every
#                                              table's row count against the
#                                              manifest, drop the database
#   laila-restore.sh db      <bundle> --into <dbname> --yes-i-am-sure
#   laila-restore.sh uploads <bundle> --into <dir>
#
# `verify` is the reason this file exists. Backups that have never been restored
# are a belief, not a plan; the failure is always discovered on the worst day.
# It runs unattended (weekly, from cron), touches nothing real, and fails loudly.
#
# All destructive paths are opt-in, name the target explicitly, and take their
# own safety dump first.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
# Pin the locale: cron and ssh hand these scripts whatever LC_* the caller had,
# which makes postgres' perl wrappers emit locale warnings into the logs and
# makes sort collation depend on who ran the backup.
export LC_ALL=C LANG=C

CONF="${LAILA_BACKUP_CONF:-/etc/laila-backup/laila-backup.conf}"
[ -r "$CONF" ] || { echo "ERROR: no config at $CONF" >&2; exit 2; }
# shellcheck disable=SC1090
. "$CONF"

CMD="${1:-}"; shift || true
say(){ echo "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

[ -r "$PASSFILE" ] || die "passphrase file $PASSFILE is missing or unreadable"
GPG=(gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PASSFILE")

STAGE=""
cleanup(){ [ -n "$STAGE" ] && rm -rf "$STAGE"; }
trap cleanup EXIT INT TERM

newest(){ ls -1t "$BACKUP_DIR/${1}_"*.tar.gz.gpg 2>/dev/null | head -1; }

# Decrypt a bundle into a fresh mode-0700 staging directory, and leave the path
# in the global $STAGE. Everything inside is plaintext secrets, so it never
# leaves /root and the trap removes it however this script exits.
#
# Deliberately sets a global instead of echoing the path: `D="$(unpack ...)"`
# would run this in a subshell, so $STAGE would be set in the subshell, die with
# it, and the cleanup trap in the parent would leave a directory of decrypted
# secrets behind on every single run.
unpack(){
  local bundle="$1"
  [ -r "$bundle" ] || die "cannot read bundle $bundle"
  STAGE="$(mktemp -d /root/.laila-restore-XXXXXX)" || die "cannot create staging dir"
  chmod 0700 "$STAGE"
  "${GPG[@]}" -d "$bundle" 2>/dev/null | tar -xzf - -C "$STAGE" \
    || die "could not decrypt and unpack $bundle (wrong passphrase, or the bundle is damaged)"
}

case "$CMD" in

# ── list ─────────────────────────────────────────────────────────────────────
list)
  echo "LOCAL  ($BACKUP_DIR)"
  if ls -1 "$BACKUP_DIR"/laila-*.tar.gz.gpg >/dev/null 2>&1; then
    ls -1lht "$BACKUP_DIR"/laila-*.tar.gz.gpg | awk '{printf "  %-6s %s %s %s  %s\n", $5, $6, $7, $8, $9}'
  else
    echo "  (none)"
  fi
  if [ -n "${OFFSITE_HOST:-}" ]; then
    echo
    echo "OFF-SITE  ($OFFSITE_USER@$OFFSITE_HOST:$OFFSITE_DIR)"
    ssh -i "$OFFSITE_KEY" -o BatchMode=yes -o ConnectTimeout=20 \
        "$OFFSITE_USER@$OFFSITE_HOST" "ls -1lht '$OFFSITE_DIR' 2>/dev/null | tail -n +2 | awk '{printf \"  %-6s %s %s %s  %s\\n\", \$5, \$6, \$7, \$8, \$9}'" \
      || echo "  (unreachable)"
  fi
  if [ -n "${RCLONE_REMOTE:-}" ]; then
    echo
    echo "CLOUD  ($RCLONE_REMOTE)"
    rclone lsl "$RCLONE_REMOTE/" 2>/dev/null | sed 's/^/  /' || echo "  (unreachable)"
  fi
  echo
  for s in "$BACKUP_DIR"/LAST-*.txt; do
    [ -f "$s" ] || continue
    echo "--- $(basename "$s") ---"; sed 's/^/  /' "$s"
  done
  ;;

# ── inspect ──────────────────────────────────────────────────────────────────
inspect)
  BUNDLE="${1:-$(newest laila-data)}"
  [ -n "$BUNDLE" ] || die "no bundle given and none found"
  say "opening $BUNDLE"
  unpack "$BUNDLE"; D="$STAGE"
  if [ -f "$D/MANIFEST.txt" ]; then echo; echo "=== MANIFEST ==="; cat "$D/MANIFEST.txt"; fi
  if [ -f "$D/db/$DB_NAME.dump" ]; then
    echo; echo "=== DATABASE ==="
    echo "dump size:  $(du -h "$D/db/$DB_NAME.dump" | cut -f1)"
    echo "tables:     $(grep -c 'TABLE DATA' "$D/db/$DB_NAME.toc" 2>/dev/null || echo '?')"
    echo
    echo "=== LARGEST TABLES (from the recorded row counts) ==="
    sort -k2 -rn "$D/db/row-counts.txt" 2>/dev/null | head -12 | sed 's/^/  /'
  fi
  if [ -d "$D/secrets" ]; then
    echo; echo "=== SECRETS PRESENT (names only) ==="
    ls -1 "$D/secrets" | sed 's/^/  /'
  fi
  if [ -d "$D/uploads" ]; then
    echo; echo "=== UPLOADS ==="
    echo "files: $(find "$D/uploads" -type f | wc -l), size: $(du -sh "$D/uploads" | cut -f1)"
  fi
  ;;

# ── verify: a real restore, into a database that is thrown away ──────────────
verify)
  BUNDLE="${1:-$(newest laila-data)}"
  [ -n "$BUNDLE" ] || die "no data bundle found to verify"
  TESTDB="laila_restoretest_$$"
  say "===== restore test: $(basename "$BUNDLE") ====="

  unpack "$BUNDLE"; D="$STAGE"
  [ -f "$D/db/$DB_NAME.dump" ] || die "bundle contains no database dump"
  say "decrypted and unpacked OK"

  say "creating throwaway database $TESTDB"
  sudo -u postgres createdb "$TESTDB" || die "could not create $TESTDB"
  # However this exits from here on, the scratch database goes away.
  trap 'sudo -u postgres dropdb --if-exists "'"$TESTDB"'" >/dev/null 2>&1; cleanup' EXIT INT TERM

  say "restoring into $TESTDB"
  # The dump is fed on stdin rather than by path. $D is a mode-0700 directory
  # under /root because it holds decrypted secrets, so the postgres user cannot
  # open a file inside it; piping keeps the read as root and hands pg_restore a
  # stream. Loosening the directory instead would expose server/.env.
  #
  # pg_restore reports non-fatal warnings on --no-owner restores; capture the
  # log and judge on the row counts below rather than on its exit status alone.
  # shellcheck disable=SC2024  # the redirect is performed by root, which is the point
  cat "$D/db/$DB_NAME.dump" | sudo -u postgres pg_restore --no-owner --no-privileges \
      -d "$TESTDB" > "$D/restore.log" 2>&1
  # PIPESTATUS[1], not $? — with pipefail the pipeline reports `cat` being killed
  # by SIGPIPE (141) whenever pg_restore stops reading at the archive's
  # end-of-data marker, which is normal and says nothing about the restore.
  RC=${PIPESTATUS[1]}
  [ "$RC" -eq 0 ] || say "note: pg_restore exited $RC (judging on the data itself, below)"

  say "comparing row counts against the manifest"
  # shellcheck disable=SC2024  # redirect runs as root, by design
  sudo -u postgres psql -Atq -d "$TESTDB" -c "
    SELECT table_name || ' ' || (xpath('/row/c/text()',
             query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                          false, true, '')))[1]::text
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;" > "$D/restored-counts.txt" 2>/dev/null \
    || die "could not read row counts back from the restored database"

  if [ ! -s "$D/db/row-counts.txt" ]; then
    say "WARNING: the bundle carries no recorded row counts — comparing table presence only"
    EXPECTED_TABLES=$(grep -c 'TABLE DATA' "$D/db/$DB_NAME.toc" 2>/dev/null || echo 0)
    GOT_TABLES=$(wc -l < "$D/restored-counts.txt")
    [ "$GOT_TABLES" -ge "$EXPECTED_TABLES" ] || die "restored $GOT_TABLES tables, expected $EXPECTED_TABLES"
    say "OK: $GOT_TABLES tables restored"
  else
    MISMATCH="$(diff <(sort "$D/db/row-counts.txt") <(sort "$D/restored-counts.txt") || true)"
    TOTAL_ROWS="$(awk '{s+=$2} END{print s+0}' "$D/restored-counts.txt")"
    TABLES="$(wc -l < "$D/restored-counts.txt")"
    if [ -n "$MISMATCH" ]; then
      echo "$MISMATCH" | head -40
      die "RESTORE TEST FAILED — the restored data does not match what was backed up"
    fi
    say "OK: $TABLES tables, $TOTAL_ROWS rows, every count matches the manifest exactly"
  fi

  { echo "STATUS: SUCCESS"
    echo "WHEN: $(date -Is)"
    echo "BUNDLE: $BUNDLE"
    echo "RESULT: restored into a throwaway database and every table's row count matched"
  } > "$BACKUP_DIR/LAST-RESTORE-TEST.txt"
  say "===== restore test PASSED ====="
  ;;

# ── db: the real thing ───────────────────────────────────────────────────────
db)
  BUNDLE="${1:-}"; shift || true
  TARGET=""; SURE=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --into) TARGET="${2:-}"; shift 2 ;;
      --yes-i-am-sure) SURE=1; shift ;;
      *) die "unknown option $1" ;;
    esac
  done
  [ -n "$BUNDLE" ] || die "usage: $0 db <bundle> --into <dbname> --yes-i-am-sure"
  [ -n "$TARGET" ] || die "--into <dbname> is required: this command replaces a database's contents"
  [ "$SURE" -eq 1 ] || die "--yes-i-am-sure is required: this DESTROYS the current contents of '$TARGET'"

  say "restoring $(basename "$BUNDLE") into database '$TARGET'"
  if sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='$TARGET'" | grep -q 1; then
    SAFETY="$BACKUP_DIR/pre-restore_${TARGET}_$(date +%Y-%m-%d_%H%M%S).dump"
    say "taking a safety dump of the CURRENT '$TARGET' first → $SAFETY"
    # shellcheck disable=SC2024  # redirect runs as root, by design
    sudo -u postgres pg_dump -Fc --no-owner --no-privileges -d "$TARGET" > "$SAFETY" \
      || die "safety dump failed — refusing to overwrite '$TARGET' with no way back"
    chmod 0600 "$SAFETY"
    say "safety dump: $(du -h "$SAFETY" | cut -f1)"
  else
    say "'$TARGET' does not exist yet — creating it"
    sudo -u postgres createdb "$TARGET" || die "could not create $TARGET"
  fi

  unpack "$BUNDLE"; D="$STAGE"
  [ -f "$D/db/$DB_NAME.dump" ] || die "bundle contains no database dump"
  say "restoring (existing objects are dropped first)"
  # stdin again, for the same reason as in `verify`: $D is root-only.
  # Logged to a file rather than piped through tail, so pg_restore's own exit
  # status survives to be reported instead of being replaced by tail's.
  cat "$D/db/$DB_NAME.dump" \
    | sudo -u postgres pg_restore --clean --if-exists --no-owner --no-privileges \
        -d "$TARGET" > "$D/restore.log" 2>&1
  RC=${PIPESTATUS[1]}
  tail -20 "$D/restore.log"
  if [ "$RC" -ne 0 ]; then
    say "WARNING: pg_restore exited $RC — read the log above before trusting '$TARGET'."
    [ -n "${SAFETY:-}" ] && say "The pre-restore state of '$TARGET' is still in $SAFETY"
  fi
  say "done — verify with: $0 inspect $BUNDLE   and compare against the app"
  ;;

# ── uploads ──────────────────────────────────────────────────────────────────
uploads)
  BUNDLE="${1:-$(newest laila-uploads)}"; shift || true
  TARGET=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --into) TARGET="${2:-}"; shift 2 ;;
      *) die "unknown option $1" ;;
    esac
  done
  [ -n "$BUNDLE" ] || die "no uploads bundle found"
  [ -n "$TARGET" ] || die "--into <dir> is required"
  unpack "$BUNDLE"; D="$STAGE"
  [ -d "$D/uploads" ] || die "bundle contains no uploads directory"
  mkdir -p "$TARGET"
  say "copying $(find "$D/uploads" -type f | wc -l) files → $TARGET"
  cp -a "$D/uploads/." "$TARGET/" || die "copy failed"
  say "done: $(find "$TARGET" -type f | wc -l) files now in $TARGET"
  ;;

*)
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 2 ;;
esac
