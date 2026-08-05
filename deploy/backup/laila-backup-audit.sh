#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# laila-backup-audit.sh — decide, independently, whether the backups are real.
#
# Every other script in this directory reports on its own work. This one trusts
# none of them: it re-reads what is actually on disk and off-site and answers
# the only question that matters — "if the host died right now, what would we
# get back, and how old would it be?"
#
# The failure this exists to prevent is the standard one: cron stops running,
# or a disk fills, or an SSH key expires, and the backups quietly stop for four
# months while every status file still says SUCCESS from the last good night.
#
# Checks:
#   1. a data bundle exists and is younger than STALE_DATA_HOURS
#   2. an uploads bundle exists and is younger than STALE_UPLOADS_HOURS
#   3. the newest bundles still hash to their recorded SHA256 (bit rot / truncation)
#   4. the off-site copy exists AND matches by hash, computed remotely
#   5. a restore test has passed in the last RESTORE_TEST_MAX_AGE_DAYS
#   6. the backup filesystem has room to write tomorrow's bundle
#
# Exits non-zero and mails ALERT_EMAIL if any check fails. Run hourly.
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

RESTORE_TEST_MAX_AGE_DAYS="${RESTORE_TEST_MAX_AGE_DAYS:-8}"
MIN_FREE_MB="${MIN_FREE_MB:-2048}"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

PROBLEMS=()
NOTES=()
ok(){   NOTES+=("OK    $*");    [ "$QUIET" -eq 1 ] || echo "OK    $*"; }
bad(){  PROBLEMS+=("$*");       [ "$QUIET" -eq 1 ] || echo "FAIL  $*"; }
info(){ NOTES+=("      $*");    [ "$QUIET" -eq 1 ] || echo "      $*"; }

age_hours(){ # age_hours <file> -> whole hours since mtime
  local f="$1"
  [ -f "$f" ] || { echo 999999; return; }
  echo $(( ( $(date +%s) - $(stat -c %Y "$f") ) / 3600 ))
}

newest(){ ls -1t "$BACKUP_DIR/${1}_"*.tar.gz.gpg 2>/dev/null | head -1; }

# ── 1 & 2: do current bundles exist at all ───────────────────────────────────
check_tier(){
  local prefix="$1" label="$2" max_hours="$3"
  local f; f="$(newest "$prefix")"
  if [ -z "$f" ]; then
    bad "$label: no bundle exists at all in $BACKUP_DIR"
    return
  fi
  local h; h="$(age_hours "$f")"
  if [ "$h" -gt "$max_hours" ]; then
    bad "$label: newest bundle is ${h}h old (limit ${max_hours}h) — $(basename "$f")"
  else
    ok "$label: ${h}h old, $(du -h "$f" | cut -f1) — $(basename "$f")"
  fi

  # ── 3: has it rotted where it sits ──
  local recorded; recorded="$(cat "${f%.tar.gz.gpg}.sha256" 2>/dev/null)"
  if [ -z "$recorded" ]; then
    bad "$label: no recorded SHA256 beside $(basename "$f")"
  else
    local now; now="$(sha256sum "$f" | awk '{print $1}')"
    if [ "$now" != "$recorded" ]; then
      bad "$label: SHA256 MISMATCH — $(basename "$f") has changed on disk since it was written"
    else
      ok "$label: integrity verified against its recorded SHA256"
    fi
  fi
}

echo "=== LAILA backup audit — $(hostname -s) — $(date -Is) ==="
check_tier laila-data    "data   " "$STALE_DATA_HOURS"
check_tier laila-uploads "uploads" "$STALE_UPLOADS_HOURS"

# ── 4: is it actually off-site ───────────────────────────────────────────────
if [ -n "${OFFSITE_HOST:-}" ]; then
  LOCAL_DATA="$(newest laila-data)"
  if [ -n "$LOCAL_DATA" ]; then
    NAME="$(basename "$LOCAL_DATA")"
    LOCAL_HASH="$(cat "${LOCAL_DATA%.tar.gz.gpg}.sha256" 2>/dev/null)"
    REMOTE_HASH="$(ssh -i "$OFFSITE_KEY" -o BatchMode=yes -o ConnectTimeout=20 \
                    -o StrictHostKeyChecking=accept-new "$OFFSITE_USER@$OFFSITE_HOST" \
                    "sha256sum '$OFFSITE_DIR/$NAME' 2>/dev/null | cut -d' ' -f1" 2>/dev/null || true)"
    if [ -z "$REMOTE_HASH" ]; then
      bad "off-site: $NAME is NOT on $OFFSITE_HOST (or the host is unreachable)"
    elif [ "$REMOTE_HASH" != "$LOCAL_HASH" ]; then
      bad "off-site: $NAME exists on $OFFSITE_HOST but its SHA256 does not match"
    else
      ok "off-site: $NAME present on $OFFSITE_HOST and hash-verified"
    fi
  fi
else
  bad "off-site: no OFFSITE_HOST configured — every copy is on this machine"
fi

if [ -n "${RCLONE_REMOTE:-}" ]; then
  if rclone lsf "$RCLONE_REMOTE/" >/dev/null 2>&1; then
    N="$(rclone lsf "$RCLONE_REMOTE/" 2>/dev/null | grep -c '^laila-' || true)"
    ok "cloud: $RCLONE_REMOTE reachable, ${N:-0} bundle(s)"
  else
    bad "cloud: $RCLONE_REMOTE is not reachable (expired token?)"
  fi
fi

# ── 5: has a restore actually been proven to work ────────────────────────────
RT="$BACKUP_DIR/LAST-RESTORE-TEST.txt"
if [ ! -f "$RT" ]; then
  bad "restore test: has never run — these backups are unproven"
else
  RH="$(age_hours "$RT")"
  if ! grep -q 'STATUS: SUCCESS' "$RT"; then
    bad "restore test: last run FAILED ($((RH/24))d ago)"
  elif [ "$RH" -gt $(( RESTORE_TEST_MAX_AGE_DAYS * 24 )) ]; then
    bad "restore test: last passed $((RH/24))d ago (limit ${RESTORE_TEST_MAX_AGE_DAYS}d)"
  else
    ok "restore test: passed $((RH/24))d ago"
  fi
fi

# ── 6: room to write tomorrow ────────────────────────────────────────────────
FREE_MB="$(df -Pm "$BACKUP_DIR" | awk 'NR==2{print $4}')"
if [ "${FREE_MB:-0}" -lt "$MIN_FREE_MB" ]; then
  bad "disk: only ${FREE_MB}MB free on $(df -P "$BACKUP_DIR" | awk 'NR==2{print $1}') (need ${MIN_FREE_MB}MB)"
else
  ok "disk: ${FREE_MB}MB free"
fi

# ── report ───────────────────────────────────────────────────────────────────
printf '{"host":"%s","generated":"%s","status":"%s","problems":%d,"detail":[' \
  "$(hostname -s)" "$(date -Is)" "$([ "${#PROBLEMS[@]}" -eq 0 ] && echo healthy || echo degraded)" \
  "${#PROBLEMS[@]}" > "$BACKUP_DIR/status.json"
first=1
for p in "${PROBLEMS[@]:-}"; do
  [ -z "$p" ] && continue
  [ "$first" -eq 1 ] || printf ',' >> "$BACKUP_DIR/status.json"
  printf '"%s"' "$(echo "$p" | sed 's/"/\\"/g')" >> "$BACKUP_DIR/status.json"
  first=0
done
printf ']}\n' >> "$BACKUP_DIR/status.json"

if [ "${#PROBLEMS[@]}" -eq 0 ]; then
  echo
  echo "RESULT: healthy"
  exit 0
fi

echo
echo "RESULT: ${#PROBLEMS[@]} problem(s)"
BODY="LAILA backup audit on $(hostname -f 2>/dev/null || hostname) found ${#PROBLEMS[@]} problem(s) at $(date -Is):

$(printf '  - %s\n' "${PROBLEMS[@]}")

Current state:
$(printf '%s\n' "${NOTES[@]}")

Investigate on the host with:
  sudo laila-backup-audit.sh
  sudo laila-restore.sh list
"

if [ -n "${ALERT_EMAIL:-}" ]; then
  ALERT_SCRIPT="$(dirname "$(readlink -f "$0")")/laila-backup-alert.mjs"
  if [ -f "$ALERT_SCRIPT" ] && [ -r "$APP_DIR/server/.env" ] && command -v node >/dev/null; then
    LAILA_SERVER_DIR="$APP_DIR/server" \
      node --env-file="$APP_DIR/server/.env" "$ALERT_SCRIPT" \
        "$ALERT_EMAIL" "[LAILA] backup problem on $(hostname -s)" <<< "$BODY" \
      && echo "alert mailed to $ALERT_EMAIL" \
      || echo "WARNING: could not send the alert mail"
  else
    echo "WARNING: ALERT_EMAIL is set but the alert channel is not usable"
  fi
fi

exit 1
