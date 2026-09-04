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
#   2. an uploads bundle exists and is younger than STALE_UPLOADS_HOURS — or,
#      if it is older, the live uploads tree still hashes to what that bundle
#      holds and the daily uploads job has run within UPLOADS_JOB_MAX_AGE_HOURS
#   3. the newest bundles still hash to their recorded SHA256 (bit rot / truncation)
#   4. the off-site copy of BOTH tiers exists AND matches by hash, computed
#      remotely — with OFFSITE_GRACE_HOURS of slack for a bundle still in flight
#      — and the off-site filesystem has room for the next shipment
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
UPLOADS_JOB_MAX_AGE_HOURS="${UPLOADS_JOB_MAX_AGE_HOURS:-30}"
OFFSITE_GRACE_HOURS="${OFFSITE_GRACE_HOURS:-3}"
OFFSITE_MIN_FREE_MB="${OFFSITE_MIN_FREE_MB:-512}"
MIN_FREE_MB="${MIN_FREE_MB:-2048}"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

PROBLEMS=()
NOTES=()
EXCUSE_NOTE=""
EXCUSE_FAIL=""
ok(){   NOTES+=("OK    $*");    [ "$QUIET" -eq 1 ] || echo "OK    $*"; }
bad(){  PROBLEMS+=("$*");       [ "$QUIET" -eq 1 ] || echo "FAIL  $*"; }
info(){ NOTES+=("      $*");    [ "$QUIET" -eq 1 ] || echo "      $*"; }

age_hours(){ # age_hours <file> -> whole hours since mtime
  local f="$1"
  [ -f "$f" ] || { echo 999999; return; }
  echo $(( ( $(date +%s) - $(stat -c %Y "$f") ) / 3600 ))
}

newest(){ ls -1t "$BACKUP_DIR/${1}_"*.tar.gz.gpg 2>/dev/null | head -1; }

# ── an old uploads bundle is not automatically a stale one ───────────────────
# The uploads tier only re-packs when the tree actually changes (backup_uploads
# in laila-backup.sh), so on a quiet host the newest bundle ages past
# STALE_UPLOADS_HOURS while nothing at all is wrong. Age alone therefore cannot
# answer this script's one question — "what would we get back?" — for uploads.
#
# An old uploads bundle is current if BOTH of these hold, and this script
# establishes both itself rather than believing any status file's headline:
#   a) the live tree still hashes to the fingerprint recorded when that bundle
#      was written, so the bundle IS a complete copy of today's uploads, and
#   b) the daily uploads job has run recently, so a dead cron is still caught
#      even while the tree happens to be static.
#
# On success it sets EXCUSE_NOTE to the reason the old bundle was accepted; on
# failure it sets EXCUSE_FAIL to which of the two conditions broke. check_tier
# reports either, because "uploads changed and were never packed" and "the
# uploads job stopped running" are the same age reading but different 4am jobs.
uploads_bundle_still_current(){
  EXCUSE_NOTE=""; EXCUSE_FAIL=""
  local up="$APP_DIR/server/uploads"
  if [ ! -d "$up" ]; then
    EXCUSE_FAIL="and the uploads directory $up is gone"
    return 1
  fi

  # This must stay identical to the fingerprint in laila-backup.sh:backup_uploads.
  # If the two ever drift the hashes stop matching and this audit starts failing
  # — the safe direction for a check to break in.
  local live
  live="$(find "$up" -type f -printf '%P %s %T@\n' 2>/dev/null | LC_ALL=C sort \
          | sha256sum | awk '{print $1}')"
  local recorded; recorded="$(cat "$BACKUP_DIR/.uploads-fingerprint" 2>/dev/null)"
  if [ -z "$recorded" ]; then
    EXCUSE_FAIL="and no fingerprint was recorded for it, so it cannot be shown to match the live tree"
    return 1
  fi
  if [ -z "$live" ] || [ "$live" != "$recorded" ]; then
    EXCUSE_FAIL="and the live uploads tree NO LONGER matches it — uploads changed and were never re-packed"
    return 1
  fi

  # Every daily run either packs a new bundle or writes this stamp, so a stamp
  # older than one run means the job itself stopped.
  local stamp="$BACKUP_DIR/LAST-SUCCESS-uploads.txt"
  if ! grep -q 'STATUS: SUCCESS' "$stamp" 2>/dev/null; then
    EXCUSE_FAIL="and the uploads job has not reported success — see $stamp"
    return 1
  fi
  local sh; sh="$(age_hours "$stamp")"
  if [ "$sh" -gt "$UPLOADS_JOB_MAX_AGE_HOURS" ]; then
    EXCUSE_FAIL="and the uploads job itself last ran ${sh}h ago (limit ${UPLOADS_JOB_MAX_AGE_HOURS}h) — the cron looks dead"
    return 1
  fi

  EXCUSE_NOTE="the live tree still hashes to it and the daily job ran ${sh}h ago"
}

# ── 1 & 2: do current bundles exist at all ───────────────────────────────────
# $4, if given, names a function that may excuse a bundle older than $3 by
# proving the tier is unchanged rather than unbacked.
check_tier(){
  local prefix="$1" label="$2" max_hours="$3" excuse="${4:-}"
  EXCUSE_NOTE=""; EXCUSE_FAIL=""   # never report one tier's reason against another
  local f; f="$(newest "$prefix")"
  if [ -z "$f" ]; then
    bad "$label: no bundle exists at all in $BACKUP_DIR"
    return
  fi
  local h; h="$(age_hours "$f")"
  if [ "$h" -le "$max_hours" ]; then
    ok "$label: ${h}h old, $(du -h "$f" | cut -f1) — $(basename "$f")"
  elif [ -n "$excuse" ] && "$excuse"; then
    ok "$label: ${h}h old but current — $EXCUSE_NOTE — $(basename "$f")"
  else
    bad "$label: newest bundle is ${h}h old (limit ${max_hours}h)${EXCUSE_FAIL:+ $EXCUSE_FAIL} — $(basename "$f")"
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
check_tier laila-uploads "uploads" "$STALE_UPLOADS_HOURS" uploads_bundle_still_current

# ── 4: is it actually off-site ───────────────────────────────────────────────
# Both tiers. Uploads are shipped too (ship_scp in laila-backup-offsite.sh), and
# an off-site copy nobody verifies is worth the same as one that is not there.
# OFFSITE_SSH exists so a config can point at a wrapper (a proxy command, a
# different ssh binary) and so test-audit.sh can stub the remote host out. PATH
# is pinned above for cron safety, so this cannot be done by shadowing `ssh`.
offsite_ssh(){
  "${OFFSITE_SSH:-ssh}" -i "$OFFSITE_KEY" -o BatchMode=yes -o ConnectTimeout=20 \
      -o StrictHostKeyChecking=accept-new "$OFFSITE_USER@$OFFSITE_HOST" "$@"
}

if [ -n "${OFFSITE_HOST:-}" ]; then
  # Probe reachability once. Otherwise an unreachable host reports "NOT on the
  # remote" once per tier, which reads like two missing bundles rather than one
  # dead network path.
  if ! offsite_ssh true >/dev/null 2>&1; then
    bad "off-site: $OFFSITE_HOST is unreachable — cannot confirm any copy left this machine"
  else
    # Room on the far end for a full shipment of both tiers, plus headroom.
    # This is the 2026-09-04 failure on both hosts: the off-site disk filled
    # up with someone else's files, scp died mid-transfer and left a file of
    # the right size holding zeros, and the only symptom from here was a hash
    # mismatch that read like corruption. Ask the number and say it.
    OS_FULL=""
    OS_FREE_KB="$(offsite_ssh "df -Pk '$OFFSITE_DIR' 2>/dev/null | awk 'NR==2{print \$4}'" 2>/dev/null || true)"
    if [ -n "$OS_FREE_KB" ]; then
      OS_NEED_KB=$(( OFFSITE_MIN_FREE_MB * 1024 ))
      for OS_PREFIX in laila-data laila-uploads; do
        LOCAL_F="$(newest "$OS_PREFIX")"
        [ -n "$LOCAL_F" ] && OS_NEED_KB=$(( OS_NEED_KB + $(stat -c %s "$LOCAL_F") / 1024 ))
      done
      if [ "$OS_FREE_KB" -lt "$OS_NEED_KB" ]; then
        OS_FULL=1
        bad "off-site: $OFFSITE_HOST has only $((OS_FREE_KB/1024))MB free where $OFFSITE_DIR lives — a shipment of both tiers needs $((OS_NEED_KB/1024))MB; nothing will ship until space is freed THERE"
      else
        ok "off-site: $OFFSITE_HOST has $((OS_FREE_KB/1024))MB free (a shipment of both tiers needs $((OS_NEED_KB/1024))MB)"
      fi
    else
      info "off-site: could not read free space on $OFFSITE_HOST"
    fi

    for OS_PREFIX in laila-data laila-uploads; do
      LOCAL_F="$(newest "$OS_PREFIX")"
      [ -n "$LOCAL_F" ] || continue
      NAME="$(basename "$LOCAL_F")"
      LOCAL_HASH="$(cat "${LOCAL_F%.tar.gz.gpg}.sha256" 2>/dev/null)"
      REMOTE_HASH="$(offsite_ssh "sha256sum '$OFFSITE_DIR/$NAME' 2>/dev/null | cut -d' ' -f1" 2>/dev/null || true)"
      if [ -n "$REMOTE_HASH" ] && [ "$REMOTE_HASH" = "$LOCAL_HASH" ]; then
        ok "off-site: $NAME present on $OFFSITE_HOST and hash-verified"
      elif [ -n "$REMOTE_HASH" ]; then
        bad "off-site: $NAME exists on $OFFSITE_HOST but its SHA256 does not match${OS_FULL:+ — its disk is full, so this is a transfer that died part-way, not corruption}"
      elif [ "$(age_hours "$LOCAL_F")" -le "$OFFSITE_GRACE_HOURS" ]; then
        # Bundles are packed shortly before the daily shipping run, so a
        # brand-new one legitimately has not left yet — and a big uploads
        # bundle can still be in flight. Alarming here would flap every time
        # uploads actually change, which is exactly when the alert must be
        # believed. Say it plainly instead; the next hourly audit verifies it.
        ok "off-site: $NAME was packed $(age_hours "$LOCAL_F")h ago and has not shipped yet — unverified, grace ${OFFSITE_GRACE_HOURS}h"
      else
        bad "off-site: $NAME is NOT on $OFFSITE_HOST"
      fi
    done
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
