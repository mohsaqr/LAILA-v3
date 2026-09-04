#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# laila-backup-offsite.sh — copy the newest verified bundles to somewhere that
# is not this machine.
#
# A backup that lives only on the machine it backs up is not a backup. It is a
# copy that dies in exactly the same accidents as the original: the VM is
# deleted, the disk fails, the provider suspends the account, ransomware walks
# the filesystem. This script is the part that makes the plan survive losing the
# whole host.
#
# Two independent routes, either of which is sufficient on its own:
#   1. scp to a separate host (OFFSITE_HOST) — different machine, different
#      failure domain.
#   2. rclone to a cloud remote (RCLONE_REMOTE) — different provider, so an
#      account loss or a billing accident at one does not take both.
#
# Only the .gpg blob is ever transferred. The destination never holds anything
# it could read, so neither destination has to be trusted with LAILA's data,
# its API keys or its OIDC signing key.
#
# VERIFICATION: the remote copy is hashed WITH SHA256 ON THE REMOTE HOST and
# compared against the local hash. Comparing sizes — which is what most backup
# scripts do — passes happily on a file that was truncated to the same length or
# corrupted in transit.
#
# The upload lands under a temporary .part name and is renamed only after that
# remote hash matches, so nothing under a real bundle name is ever anything but
# a verified copy. Before sending, the remote filesystem is asked for its free
# space: a full destination (2026-09-04, both hosts) leaves a right-sized file
# of zeros behind, and "disk full on the off-site host" is a far more useful
# thing to be told than "hash mismatch".
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

STAMP="$(date +%Y-%m-%d_%H%M%S)"
LOG_DIR="$BACKUP_DIR/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/offsite-${STAMP}.log"
exec >>"$LOG" 2>&1

say(){ echo "$(date +%H:%M:%S) $*"; logger -t laila-offsite "$*" 2>/dev/null || true; }

fail(){
  say "FAILED — $1"
  { echo "STATUS: FAILED"; echo "WHEN: $(date -Is)"; echo "WHY: $1"; echo "LOG: $LOG"; } \
    > "$BACKUP_DIR/LAST-OFFSITE-STATUS.txt"
  exit 1
}

HOST="$(hostname -s)"
# Headroom the off-site filesystem must keep AFTER a bundle lands there. A
# destination that is merely large enough for one more file is one bad night
# from being full, and a full destination is the one failure scp cannot report
# honestly (see ship_scp).
OFFSITE_MIN_FREE_MB="${OFFSITE_MIN_FREE_MB:-512}"
say "===== off-site START ====="

SHIPPED=()
FAILURES=0

# OFFSITE_SSH / OFFSITE_SCP exist so a config can point at a wrapper and so
# test-offsite.sh can stand in a sandbox for the remote host. PATH is pinned
# above for cron safety, so this cannot be done by shadowing the binaries.
offsite_ssh(){
  "${OFFSITE_SSH:-ssh}" -i "$OFFSITE_KEY" -o BatchMode=yes -o ConnectTimeout=20 \
      -o StrictHostKeyChecking=accept-new "$OFFSITE_USER@$OFFSITE_HOST" "$@"
}
offsite_scp(){ # offsite_scp <local file> <remote path>
  "${OFFSITE_SCP:-scp}" -l "$SCP_LIMIT_KBIT" -i "$OFFSITE_KEY" -o BatchMode=yes \
      -o StrictHostKeyChecking=accept-new "$1" "$OFFSITE_USER@$OFFSITE_HOST:$2"
}
# Free KB on the filesystem holding OFFSITE_DIR, or empty when it cannot be read.
offsite_free_kb(){
  offsite_ssh "df -Pk '$OFFSITE_DIR' 2>/dev/null | awk 'NR==2{print \$4}'" 2>/dev/null
}

# ── route 1: scp to a separate host ──────────────────────────────────────────
ship_scp(){
  local prefix="$1" keep="$2"
  local local_file
  local_file="$(ls -1t "$BACKUP_DIR/${prefix}_"*.tar.gz.gpg 2>/dev/null | head -1)"
  [ -n "$local_file" ] || { say "no $prefix bundle to ship"; return 0; }

  local name; name="$(basename "$local_file")"
  local hash_file="${local_file%.tar.gz.gpg}.sha256"
  local local_hash
  local_hash="$(cat "$hash_file" 2>/dev/null)"
  [ -n "$local_hash" ] || { say "ERROR: no recorded hash for $name"; FAILURES=$((FAILURES+1)); return 1; }

  # Re-hash before shipping: this is the cheapest possible check for a local
  # bundle that rotted on disk since it was written, and it costs one read.
  local now_hash
  now_hash="$(sha256sum "$local_file" | awk '{print $1}')"
  if [ "$now_hash" != "$local_hash" ]; then
    say "ERROR: $name no longer matches its recorded SHA256 — local corruption, refusing to ship it"
    FAILURES=$((FAILURES+1)); return 1
  fi

  offsite_ssh "mkdir -p '$OFFSITE_DIR' && chmod 700 '$OFFSITE_DIR'" \
    || { say "ERROR: cannot reach $OFFSITE_USER@$OFFSITE_HOST (key not authorised, or port 22 blocked)"; FAILURES=$((FAILURES+1)); return 1; }

  # Already there and intact? Then this tier simply had nothing new today —
  # normal for uploads, which only re-pack when they change.
  local remote_path="$OFFSITE_DIR/$name" part="$OFFSITE_DIR/$name.part"
  local remote_hash
  remote_hash="$(offsite_ssh "sha256sum '$remote_path' 2>/dev/null | cut -d' ' -f1" || true)"
  if [ "$remote_hash" = "$local_hash" ]; then
    say "$name is already off-site and verified — nothing to send"
    SHIPPED+=("$name (already present)")
    return 0
  fi

  # A file under the real name that does not hash to the bundle is not a
  # backup of anything, whatever its size says. Bundle names carry their
  # timestamp, so a same-named file can only be a damaged copy of this one —
  # take it out before anyone recovering in a hurry mistakes it for the newest
  # bundle. A .part is what a previous run left when it died mid-transfer.
  if [ -n "$remote_hash" ]; then
    say "$name is on $OFFSITE_HOST but does NOT match its hash — removing that copy before re-sending"
  fi
  offsite_ssh "rm -f '$remote_path' '$part'" \
    || say "WARNING: could not remove the old copy of $name on $OFFSITE_HOST"

  # Room for it? A full destination is the one failure scp cannot report
  # honestly: in SFTP mode the remote file is extended to full length first,
  # then the writes start failing, and what is left is a file of the right
  # NAME and the right SIZE holding zeros — which the 2026-09-04 incident
  # looked like from this side. Ask before sending, and say the number.
  local size_kb free_kb need_kb
  size_kb=$(( $(stat -c %s "$local_file") / 1024 + 1 ))
  free_kb="$(offsite_free_kb)"
  need_kb=$(( size_kb + OFFSITE_MIN_FREE_MB * 1024 ))
  if [ -z "$free_kb" ]; then
    say "WARNING: could not read free space on $OFFSITE_HOST — sending anyway"
  elif [ "$free_kb" -lt "$need_kb" ]; then
    say "ERROR: $OFFSITE_HOST has only $((free_kb/1024))MB free where $OFFSITE_DIR lives; $name needs $((size_kb/1024))MB plus ${OFFSITE_MIN_FREE_MB}MB headroom — the OFF-SITE disk is full, nothing will ship until space is freed there"
    FAILURES=$((FAILURES+1)); return 1
  fi

  # Upload under a temporary name and rename only after the remote hash
  # matches, so the real name is never anything but a verified copy. Whatever
  # a failed transfer leaves behind is removed, not left to look like a backup.
  say "uploading $name ($(du -h "$local_file" | cut -f1)) → $OFFSITE_USER@$OFFSITE_HOST:$OFFSITE_DIR/"
  if ! offsite_scp "$local_file" "$part"; then
    say "ERROR: scp of $name failed — removing the partial remote file"
    offsite_ssh "rm -f '$part'" || say "WARNING: could not remove $part on $OFFSITE_HOST"
    FAILURES=$((FAILURES+1)); return 1
  fi

  remote_hash="$(offsite_ssh "sha256sum '$part' 2>/dev/null | cut -d' ' -f1" || true)"
  if [ "$remote_hash" != "$local_hash" ]; then
    say "ERROR: remote SHA256 mismatch for $name (local $local_hash, remote ${remote_hash:-none}) — removing the remote copy"
    offsite_ssh "rm -f '$part'" || say "WARNING: could not remove $part on $OFFSITE_HOST"
    FAILURES=$((FAILURES+1)); return 1
  fi
  if ! offsite_ssh "mv -f '$part' '$remote_path'"; then
    say "ERROR: could not rename $part into place on $OFFSITE_HOST"
    offsite_ssh "rm -f '$part'" || true
    FAILURES=$((FAILURES+1)); return 1
  fi
  say "verified off-site copy of $name by SHA256"
  SHIPPED+=("$name")

  # Rotate on the remote. Newest-first, drop past $keep.
  # Glob on ${prefix}_${HOST}_ and never on ${prefix}_ alone: if a second LAILA
  # host ever ships into the same directory, a host-blind glob would count its
  # bundles towards this host's keep-limit and delete them.
  # The glob ends in .tar.gz.gpg, so an in-flight .part is never counted or
  # rotated away.
  offsite_ssh \
    "cd '$OFFSITE_DIR' 2>/dev/null && ls -1t ${prefix}_${HOST}_*.tar.gz.gpg 2>/dev/null | tail -n +$((keep+1)) | xargs -r rm -f" \
    || say "WARNING: remote rotation for $prefix did not complete"
}

if [ -n "${OFFSITE_HOST:-}" ]; then
  [ -r "${OFFSITE_KEY:-}" ] || fail "OFFSITE_KEY $OFFSITE_KEY is missing or unreadable"
  ship_scp "laila-data"    "$KEEP_OFFSITE_DATA"
  ship_scp "laila-uploads" "$KEEP_OFFSITE_UPLOADS"
else
  say "scp route disabled (OFFSITE_HOST is empty)"
fi

# ── route 2: rclone to a cloud remote ────────────────────────────────────────
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null; then
    say "ERROR: RCLONE_REMOTE is set but rclone is not installed"
    FAILURES=$((FAILURES+1))
  else
    for prefix in laila-data laila-uploads; do
      f="$(ls -1t "$BACKUP_DIR/${prefix}_"*.tar.gz.gpg 2>/dev/null | head -1)"
      [ -n "$f" ] || continue
      say "rclone → $RCLONE_REMOTE/$(basename "$f")"
      if rclone copy --bwlimit "$RCLONE_BWLIMIT" "$f" "$RCLONE_REMOTE/" 2>&1; then
        # rclone verifies its own transfers by checksum, but confirm the object
        # is actually listable afterwards — "copied" with nothing at the far end
        # is a real failure mode when a token has silently expired.
        if rclone lsf "$RCLONE_REMOTE/$(basename "$f")" >/dev/null 2>&1; then
          say "verified $RCLONE_REMOTE/$(basename "$f")"
          SHIPPED+=("$(basename "$f") → $RCLONE_REMOTE")
        else
          say "ERROR: $(basename "$f") is not listable at $RCLONE_REMOTE after copy"
          FAILURES=$((FAILURES+1))
        fi
      else
        say "ERROR: rclone copy of $(basename "$f") failed"
        FAILURES=$((FAILURES+1))
      fi
    done
    # Keep the same number of data bundles remotely as on the scp route.
    rclone lsf "$RCLONE_REMOTE/" 2>/dev/null | grep "^laila-data_${HOST}_" | sort -r \
      | tail -n +$((KEEP_OFFSITE_DATA + 1)) \
      | while read -r old; do rclone delete "$RCLONE_REMOTE/$old" 2>/dev/null; done
  fi
else
  say "rclone route disabled (RCLONE_REMOTE is empty)"
fi

# ── stamp ────────────────────────────────────────────────────────────────────
if [ "$FAILURES" -gt 0 ]; then
  fail "$FAILURES off-site transfer(s) failed — see $LOG"
fi

if [ "${#SHIPPED[@]}" -eq 0 ]; then
  fail "no bundles were shipped and no route was enabled — nothing is off-site"
fi

{ echo "STATUS: SUCCESS"
  echo "WHEN: $(date -Is)"
  echo "ROUTES: ${OFFSITE_HOST:+scp:$OFFSITE_USER@$OFFSITE_HOST:$OFFSITE_DIR }${RCLONE_REMOTE:+rclone:$RCLONE_REMOTE}"
  printf 'SHIPPED: %s\n' "${SHIPPED[@]}"
  echo "VERIFIED: SHA256 recomputed on the destination and matched"
  echo "LOG: $LOG"
} > "$BACKUP_DIR/LAST-OFFSITE-STATUS.txt"

find "$LOG_DIR" -name 'offsite-*.log' -mtime +30 -delete 2>/dev/null
say "===== off-site DONE (${#SHIPPED[@]} bundle(s)) ====="
exit 0
