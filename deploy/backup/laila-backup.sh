#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# laila-backup.sh — create a verified, encrypted backup bundle of a LAILA host.
#
#   laila-backup.sh data       # database + secrets + system config  (daily)
#   laila-backup.sh uploads    # server/uploads, only if it changed  (daily)
#   laila-backup.sh all        # both
#
# Run as root: server/.env is root-only, and the dump goes through the postgres
# system user.
#
# WHAT "VERIFIED" MEANS HERE
# A backup script that only checks whether commands exited 0 will happily
# produce an empty archive every night for a year. Every bundle this script
# writes has been put through all five of these before it is called a success:
#
#   1. pg_dump's exit status is checked — never `|| true`, never discarded.
#   2. The dump is parsed back with `pg_restore --list` and must contain at
#      least MIN_TABLES tables. This is what catches a dump that "succeeded"
#      against an empty or wrong database.
#   3. The finished .gpg is decrypted again with the passphrase FROM THE FILE
#      ON DISK and piped through tar. So the check proves the exact bytes that
#      were stored can be opened with the exact key that was stored — the two
#      failures (corrupt blob, wrong passphrase) that turn a year of backups
#      into noise.
#   4. The entry count from that decryption must match what went in.
#   5. A SHA256 is recorded, so a later audit can prove the file has not rotted
#      in place.
#
# Failing any of them deletes the bad bundle and stamps FAILED — a bundle that
# cannot be proven good is worse than no bundle, because it stops you looking.
#
# The bundle is encrypted AT CREATION, not on the way out. Nothing unencrypted
# is ever written outside a mode-0700 staging directory that is removed on exit,
# because the data tier contains server/.env: the JWT secret, the OIDC signing
# key, every LLM provider API key and the database password.
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

MODE="${1:-all}"
HOST="$(hostname -s)"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
STATUS_DIR="$BACKUP_DIR"
LOG_DIR="$BACKUP_DIR/logs"

mkdir -p "$BACKUP_DIR" "$LOG_DIR" || { echo "ERROR: cannot create $BACKUP_DIR" >&2; exit 2; }
chmod 0700 "$BACKUP_DIR"

LOG="$LOG_DIR/${MODE}-${STAMP}.log"
exec >>"$LOG" 2>&1

say(){ echo "$(date +%H:%M:%S) $*"; logger -t laila-backup "$*" 2>/dev/null || true; }

STAGE=""
cleanup(){ [ -n "$STAGE" ] && rm -rf "$STAGE"; }
trap cleanup EXIT INT TERM

# Record a failure where a human and the auditor will both find it. TIER is set
# by whichever tier was running; the audit reads these stamps, so a failure that
# is not stamped is a failure nobody hears about.
fail(){
  say "FAILED [${TIER:-$MODE}] — $1"
  { echo "STATUS: FAILED"
    echo "TIER: ${TIER:-$MODE}"
    echo "WHEN: $(date -Is)"
    echo "WHY: $1"
    echo "LOG: $LOG"
  } > "$STATUS_DIR/LAST-BACKUP-STATUS.txt"
  exit 1
}

need(){ command -v "$1" >/dev/null || fail "$1 is not installed"; }
need pg_dump; need pg_restore; need gpg; need tar; need sha256sum

[ -r "$PASSFILE" ] || fail "passphrase file $PASSFILE is missing or unreadable"
[ -s "$PASSFILE" ] || fail "passphrase file $PASSFILE is empty"
[ -d "$APP_DIR" ]  || fail "APP_DIR $APP_DIR does not exist"

GPG_COMMON=(--batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PASSFILE")

# ── retention ────────────────────────────────────────────────────────────────
# Keep the newest $keep_d bundles unconditionally, then additionally keep the
# newest bundle of each distinct month until $keep_m months are represented.
# The monthly tier is the one that survives a corruption nobody notices for six
# weeks — pure "keep the last N" retention rotates the last good copy out.
prune(){
  local prefix="$1" keep_d="$2" keep_m="$3"
  local -a files=()
  mapfile -t files < <(ls -1t "$BACKUP_DIR/${prefix}_"*.tar.gz.gpg 2>/dev/null)
  [ "${#files[@]}" -gt 0 ] || return 0

  local -A months=()
  local i=0 f month removed=0
  for f in "${files[@]}"; do
    i=$((i + 1))
    month="$(basename "$f" | grep -oE '[0-9]{4}-[0-9]{2}' | head -1)"
    if [ "$i" -le "$keep_d" ]; then
      [ -n "$month" ] && months["$month"]=1
      continue
    fi
    if [ -n "$month" ] && [ -z "${months[$month]:-}" ] && [ "${#months[@]}" -lt "$keep_m" ]; then
      months["$month"]=1
      continue
    fi
    rm -f "$f" "${f%.tar.gz.gpg}.sha256" && removed=$((removed + 1))
  done
  say "retention [$prefix]: kept $(( ${#files[@]} - removed )), removed $removed"
}

# ── seal a staged directory into a verified, encrypted bundle ────────────────
# Takes a staging dir and a name; leaves $BACKUP_DIR/<name>_<host>_<stamp>.tar.gz.gpg
# plus a .sha256 beside it. Returns only if every check passed.
seal(){
  local src="$1" prefix="$2"
  local base="${prefix}_${HOST}_${STAMP}"
  local plain="$STAGE/$base.tar.gz"
  local enc="$BACKUP_DIR/$base.tar.gz.gpg"

  say "packing $(basename "$src") → $base.tar.gz"
  tar --warning=no-file-changed -czf "$plain" -C "$src" . || fail "tar failed"

  local entries_in
  entries_in="$(tar -tzf "$plain" | wc -l)" || fail "cannot list the archive just written"
  [ "$entries_in" -gt 0 ] || fail "archive is empty"

  say "encrypting → $(basename "$enc")"
  gpg "${GPG_COMMON[@]}" --symmetric --cipher-algo AES256 --compress-algo none \
      -o "$enc" "$plain" || fail "gpg encryption failed"
  chmod 0600 "$enc"

  # THE check: decrypt what is actually on disk, with the passphrase actually on
  # disk, and read the whole archive out of it. Anything less proves nothing.
  say "verifying: decrypt + read back"
  local entries_out
  entries_out="$(gpg "${GPG_COMMON[@]}" -d "$enc" 2>/dev/null | tar -tzf - 2>/dev/null | wc -l)" \
    || { rm -f "$enc"; fail "verification failed: the encrypted bundle could not be decrypted and read back"; }
  [ "$entries_out" = "$entries_in" ] \
    || { rm -f "$enc"; fail "verification failed: $entries_in entries in, $entries_out out"; }

  sha256sum "$enc" | awk '{print $1}' > "${enc%.tar.gz.gpg}.sha256" || fail "sha256 failed"

  local size
  size="$(du -h "$enc" | cut -f1)"
  { echo "STATUS: SUCCESS"
    echo "TIER: $prefix"
    echo "WHEN: $(date -Is)"
    echo "FILE: $enc"
    echo "SIZE: $size"
    echo "ENTRIES: $entries_out"
    echo "SHA256: $(cat "${enc%.tar.gz.gpg}.sha256")"
    echo "VERIFIED: decrypted with $PASSFILE and read back, $entries_out entries"
  } > "$STATUS_DIR/LAST-SUCCESS-${prefix}.txt"
  say "OK $base.tar.gz.gpg ($size, $entries_out entries)"
}

# ── tier: data ───────────────────────────────────────────────────────────────
# The database, the secrets, and enough system configuration to rebuild the host.
backup_data(){
  TIER=data
  STAGE="$(mktemp -d /root/.laila-backup-XXXXXX)" || fail "cannot create staging dir"
  chmod 0700 "$STAGE"
  local d="$STAGE/data"
  mkdir -p "$d/db" "$d/secrets" "$d/system"

  # --- database ---
  say "pg_dump $DB_NAME (custom format)"
  # shellcheck disable=SC2024
  # The redirect is performed by this script's shell, which is root — that is
  # deliberate, and is why the postgres user never needs write access to the
  # mode-0700 staging directory. `| sudo tee` would be strictly worse here.
  sudo -u postgres pg_dump -Fc --no-owner --no-privileges -d "$DB_NAME" > "$d/db/$DB_NAME.dump"
  local st=$?
  [ "$st" -eq 0 ] || fail "pg_dump exited $st"
  [ -s "$d/db/$DB_NAME.dump" ] || fail "pg_dump produced an empty file"

  # Parse the dump back. A dump that pg_restore cannot list is not a backup, and
  # a dump listing far too few tables means we dumped the wrong (or an empty)
  # database — the failure that hides for months.
  pg_restore --list "$d/db/$DB_NAME.dump" > "$d/db/$DB_NAME.toc" 2>/dev/null \
    || fail "pg_restore --list could not parse the dump"
  local tables
  tables="$(grep -c 'TABLE DATA' "$d/db/$DB_NAME.toc" || true)"
  [ "${tables:-0}" -ge "$MIN_TABLES" ] \
    || fail "dump contains only ${tables:-0} tables with data, expected at least $MIN_TABLES"
  say "dump OK: $tables tables, $(du -h "$d/db/$DB_NAME.dump" | cut -f1)"

  # Exact row counts travel with the bundle, so a restore can be checked against
  # what was actually there rather than against "it didn't error".
  # shellcheck disable=SC2024  # redirect runs as root, by design
  sudo -u postgres psql -Atq -d "$DB_NAME" -c "
    SELECT table_name || ' ' || (xpath('/row/c/text()',
             query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                          false, true, '')))[1]::text
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;" > "$d/db/row-counts.txt" 2>/dev/null \
    || say "WARNING: could not collect row counts (bundle is still valid)"

  # --- secrets ---
  # server/.env holds JWT_SECRET, OIDC_PRIVATE_KEY, DATABASE_URL and every LLM
  # provider key. Losing it means every session, every OIDC client and every
  # integration breaks even after a perfect database restore.
  if [ -f "$APP_DIR/server/.env" ]; then
    cp -a "$APP_DIR/server/.env" "$d/secrets/server.env"
  else
    say "WARNING: $APP_DIR/server/.env not found"
  fi
  [ -f "$APP_DIR/client/.env" ] && cp -a "$APP_DIR/client/.env" "$d/secrets/client.env"
  [ -f "$APP_DIR/.env" ] && cp -a "$APP_DIR/.env" "$d/secrets/root.env"

  # --- system configuration ---
  cp -a /etc/nginx/sites-available "$d/system/nginx-sites-available" 2>/dev/null
  cp -a /etc/nginx/snippets        "$d/system/nginx-snippets"        2>/dev/null
  cp -a /etc/systemd/system/laila.service "$d/system/" 2>/dev/null
  cp -a /etc/letsencrypt/renewal   "$d/system/letsencrypt-renewal"   2>/dev/null
  cp -a /var/spool/cron/crontabs   "$d/system/crontabs"              2>/dev/null
  command -v pm2 >/dev/null && pm2 jlist > "$d/system/pm2-processes.json" 2>/dev/null

  # --- provenance: what this bundle is a backup OF ---
  { echo "host: $(hostname -f 2>/dev/null || hostname)"
    echo "when: $(date -Is)"
    echo "app_dir: $APP_DIR"
    echo "git_commit: $(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
    echo "git_branch: $(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    echo "node: $(node --version 2>/dev/null || echo absent)"
    echo "postgres: $(sudo -u postgres psql -Atqc 'SHOW server_version' 2>/dev/null || echo unknown)"
    echo "db_tables_with_data: $tables"
    echo "os: $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")"
  } > "$d/MANIFEST.txt"

  seal "$d" "laila-data"
  prune "laila-data" "$KEEP_DATA_DAILY" "$KEEP_DATA_MONTHLY"
  rm -rf "$STAGE"; STAGE=""
}

# ── tier: uploads ────────────────────────────────────────────────────────────
# Hundreds of MB of course material with UUID filenames — effectively immutable,
# so re-packing and re-shipping it nightly is pure waste. A manifest fingerprint
# (path + size + mtime of every file) decides whether anything actually changed.
backup_uploads(){
  TIER=uploads
  local up="$APP_DIR/server/uploads"
  if [ ! -d "$up" ] || [ -z "$(ls -A "$up" 2>/dev/null)" ]; then
    say "uploads directory is missing or empty — nothing to do"
    return 0
  fi

  local fp_file="$BACKUP_DIR/.uploads-fingerprint"
  local fp
  fp="$(find "$up" -type f -printf '%P %s %T@\n' 2>/dev/null | LC_ALL=C sort | sha256sum | awk '{print $1}')"
  [ -n "$fp" ] || fail "could not fingerprint the uploads directory"

  if [ -f "$fp_file" ] && [ "$fp" = "$(cat "$fp_file")" ] \
     && ls -1 "$BACKUP_DIR/laila-uploads_"*.tar.gz.gpg >/dev/null 2>&1; then
    say "uploads unchanged since the last bundle — skipping"
    # Touch the stamp so the auditor knows this tier was checked and is current,
    # rather than concluding the backup stopped running.
    { echo "STATUS: SUCCESS (unchanged)"
      echo "TIER: uploads"
      echo "WHEN: $(date -Is)"
      echo "FILE: $(ls -1t "$BACKUP_DIR/laila-uploads_"*.tar.gz.gpg | head -1)"
      echo "FINGERPRINT: $fp"
      echo "VERIFIED: content identical to the newest bundle, which was verified when written"
    } > "$STATUS_DIR/LAST-SUCCESS-uploads.txt"
    return 0
  fi

  STAGE="$(mktemp -d /root/.laila-backup-XXXXXX)" || fail "cannot create staging dir"
  chmod 0700 "$STAGE"
  local d="$STAGE/uploads"
  mkdir -p "$d"
  say "uploads changed — packing $(du -sh "$up" | cut -f1), $(find "$up" -type f | wc -l) files"
  # Hardlink rather than copy: staging exists only so MANIFEST.txt can sit
  # beside the tree, and copying hundreds of MB to achieve that is pure waste.
  # Hardlinks need one filesystem, so fall back to a real copy if /root and
  # APP_DIR are ever on different mounts.
  cp -al "$up" "$d/uploads" 2>/dev/null \
    || cp -a "$up" "$d/uploads" \
    || fail "could not stage the uploads directory"
  find "$up" -type f -printf '%P %s %T@\n' 2>/dev/null | LC_ALL=C sort > "$d/MANIFEST-files.txt"
  { echo "host: $(hostname -f 2>/dev/null || hostname)"
    echo "when: $(date -Is)"
    echo "source: $up"
    echo "files: $(find "$up" -type f | wc -l)"
    echo "bytes: $(du -sb "$up" | cut -f1)"
    echo "fingerprint: $fp"
  } > "$d/MANIFEST.txt"

  seal "$d" "laila-uploads"
  echo "$fp" > "$fp_file"
  prune "laila-uploads" "$KEEP_UPLOADS_DAILY" "$KEEP_UPLOADS_MONTHLY"
  rm -rf "$STAGE"; STAGE=""
}

# ── main ─────────────────────────────────────────────────────────────────────
say "===== laila-backup [$MODE] START on $HOST ====="
case "$MODE" in
  data)    backup_data ;;
  uploads) backup_uploads ;;
  all)     backup_data; backup_uploads ;;
  *)       echo "usage: $0 {data|uploads|all}" >&2; exit 2 ;;
esac

{ echo "STATUS: SUCCESS"
  echo "MODE: $MODE"
  echo "WHEN: $(date -Is)"
  echo "LOG: $LOG"
} > "$STATUS_DIR/LAST-BACKUP-STATUS.txt"

# Logs are the only thing here that grows without bound.
find "$LOG_DIR" -name '*.log' -mtime +30 -delete 2>/dev/null

say "===== laila-backup [$MODE] DONE ====="
exit 0
