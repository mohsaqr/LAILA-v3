#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-audit.sh — regression test for laila-backup-audit.sh's uploads logic.
#
# The bug this exists to prevent: uploads only re-pack when the tree changes,
# so a quiet host's newest bundle ages past STALE_UPLOADS_HOURS and the audit
# used to cry stale while the backup was perfect. Crying wolf hourly is how a
# real alert gets ignored, so the forgiveness has to be exact — it must still
# fail when uploads changed and were never packed, and when the cron dies.
#
# Runs entirely in a sandbox; touches no real backup. Needs GNU coreutils
# (find -printf, stat -c, touch -d), so run it on the Linux host, not macOS:
#
#   scp deploy/backup/{test-audit.sh,laila-backup-audit.sh} host:/tmp/
#   ssh host 'bash /tmp/test-audit.sh /tmp/laila-backup-audit.sh'
#
# Asserts on the uploads and off-site lines only: the sandbox has no restore
# test, so the overall exit status is expected to be non-zero throughout.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
AUDIT="${1:?usage: test-audit.sh /path/to/laila-backup-audit.sh}"
SBX="$(mktemp -d /tmp/laila-audit-test-XXXXXX)"
trap 'rm -rf "$SBX"' EXIT

PASS=0; FAIL=0
setup(){ # setup <bundle_age_hours> <stamp_age_hours> <tree_state>
  rm -rf "$SBX/backups" "$SBX/app"
  mkdir -p "$SBX/backups" "$SBX/app/server/uploads"
  printf 'course material\n' > "$SBX/app/server/uploads/a.pdf"
  printf 'more material\n'   > "$SBX/app/server/uploads/b.pdf"
  touch -d "@1750000000" "$SBX/app/server/uploads"/*.pdf

  local b="$SBX/backups/laila-uploads_test_2026-01-01_000000.tar.gz.gpg"
  printf 'pretend ciphertext\n' > "$b"
  sha256sum "$b" | awk '{print $1}' > "${b%.tar.gz.gpg}.sha256"
  touch -d "$(date -d "-$1 hours" -Is)" "$b"

  # the fingerprint recorded when that bundle was written
  find "$SBX/app/server/uploads" -type f -printf '%P %s %T@\n' | LC_ALL=C sort \
    | sha256sum | awk '{print $1}' > "$SBX/backups/.uploads-fingerprint"

  # a data bundle so tier 1 does not distract
  local d="$SBX/backups/laila-data_test_2026-01-01_000000.tar.gz.gpg"
  printf 'pretend ciphertext\n' > "$d"
  sha256sum "$d" | awk '{print $1}' > "${d%.tar.gz.gpg}.sha256"

  printf 'STATUS: SUCCESS (unchanged)\n' > "$SBX/backups/LAST-SUCCESS-uploads.txt"
  touch -d "$(date -d "-$2 hours" -Is)" "$SBX/backups/LAST-SUCCESS-uploads.txt"

  # tree_state=changed: mutate uploads AFTER the fingerprint was recorded
  if [ "$3" = "changed" ]; then
    printf 'a file nobody backed up\n' > "$SBX/app/server/uploads/c.pdf"
  fi

  cat > "$SBX/conf" <<EOF
APP_DIR="$SBX/app"
BACKUP_DIR="$SBX/backups"
STALE_DATA_HOURS=30
STALE_UPLOADS_HOURS=200
UPLOADS_JOB_MAX_AGE_HOURS=30
ALERT_EMAIL=""
MIN_FREE_MB=1
EOF
}

check(){ # check <name> <expect: OK|FAIL> [expected substring in the message]
  local out line
  out="$(LAILA_BACKUP_CONF="$SBX/conf" bash "$AUDIT" 2>&1)"
  line="$(echo "$out" | grep -E '^(OK|FAIL) +uploads' | head -1)"
  local got; got="$(echo "$line" | awk '{print $1}')"
  if [ "$got" != "$2" ]; then
    FAIL=$((FAIL+1)); printf '  FAIL  %-46s expected %s, got: %s\n' "$1" "$2" "${line:-<no uploads line>}"
  elif [ -n "${3:-}" ] && ! echo "$line" | grep -qF "$3"; then
    FAIL=$((FAIL+1)); printf '  FAIL  %-46s message lacks %q: %s\n' "$1" "$3" "$line"
  else
    PASS=$((PASS+1)); printf '  pass  %-46s %s\n' "$1" "$line"
  fi
}

echo "=== uploads staleness logic ==="
setup 20  1 unchanged; check "fresh bundle"                          OK
setup 220 1 unchanged; check "old bundle, tree unchanged, job ran"   OK   "but current"
setup 220 1 changed;   check "old bundle, tree CHANGED"              FAIL "NO LONGER matches"
setup 220 99 unchanged; check "old bundle, unchanged, job DEAD"      FAIL "cron looks dead"

# the stamp must not be believed on its own
setup 220 1 unchanged
rm -f "$SBX/backups/.uploads-fingerprint"
check "old bundle, no recorded fingerprint"                          FAIL "no fingerprint was recorded"

setup 220 1 unchanged
printf 'STATUS: FAILED\n' > "$SBX/backups/LAST-SUCCESS-uploads.txt"
check "old bundle, last job reported FAILURE"                        FAIL "not reported success"

setup 220 1 unchanged
rm -rf "$SBX/app/server/uploads"
check "old bundle, uploads tree GONE"                                FAIL "uploads directory"

# ── off-site verification, both tiers ────────────────────────────────────────
# A stub `ssh` on PATH keeps this hermetic: no network, no key, no remote host.
# It answers the reachability probe and the remote sha256sum from files under
# $SBX/offsite, which stand in for what has actually been shipped.
make_stub_ssh(){
  mkdir -p "$SBX/bin"
  cat > "$SBX/bin/ssh" <<'STUB'
#!/usr/bin/env bash
[ "$(cat "$SBXDIR/ssh-mode" 2>/dev/null || echo up)" = "down" ] && exit 255
cmd="${!#}"                      # the audit passes the remote command last
[ "$cmd" = "true" ] && exit 0    # reachability probe
case "$cmd" in df*)              # free-space probe: the audit awk's out column 4
  cat "$SBXDIR/remote-free-kb" 2>/dev/null || echo 99999999; exit 0;; esac
name="$(echo "$cmd" | grep -oE 'laila-[a-z]+_[a-z0-9]+_[0-9_-]+\.tar\.gz\.gpg' | head -1)"
[ -n "$name" ] && [ -f "$SBXDIR/offsite/$name" ] && cat "$SBXDIR/offsite/$name"
exit 0
STUB
  chmod +x "$SBX/bin/ssh"
}

enable_offsite(){
  rm -rf "$SBX/offsite"; mkdir -p "$SBX/offsite"
  printf 'up\n' > "$SBX/ssh-mode"; rm -f "$SBX/remote-free-kb"
  cat >> "$SBX/conf" <<EOF
OFFSITE_HOST="offsite.test"
OFFSITE_USER="backup"
OFFSITE_KEY="$SBX/fake.key"
OFFSITE_DIR="LAILA-Backups/test"
OFFSITE_GRACE_HOURS=3
OFFSITE_SSH="$SBX/bin/ssh"
EOF
}

ship(){ # ship <prefix> [wrong] — place the newest bundle of that tier off-site
  local f n; f="$(ls -1t "$SBX/backups/${1}_"*.tar.gz.gpg | head -1)"; n="$(basename "$f")"
  if [ "${2:-}" = "wrong" ]; then printf 'deadbeef\n' > "$SBX/offsite/$n"
  else cat "${f%.tar.gz.gpg}.sha256" > "$SBX/offsite/$n"; fi
}

checkos(){ # checkos <name> <must contain> [must NOT contain]
  local out block
  out="$(SBXDIR="$SBX" LAILA_BACKUP_CONF="$SBX/conf" bash "$AUDIT" 2>&1)"
  block="$(echo "$out" | grep -E '^(OK|FAIL) +off-site' | sed 's/^/    /')"
  if ! echo "$block" | grep -qF "$2"; then
    FAIL=$((FAIL+1)); printf '  FAIL  %-46s lacks %q\n%s\n' "$1" "$2" "$block"
  elif [ -n "${3:-}" ] && echo "$block" | grep -qF "$3"; then
    FAIL=$((FAIL+1)); printf '  FAIL  %-46s should not mention %q\n%s\n' "$1" "$3" "$block"
  else
    PASS=$((PASS+1)); printf '  pass  %-46s %s\n' "$1" "$(echo "$block" | sed 's/^ *//' | tr '\n' ';')"
  fi
}

echo
echo "=== off-site verification ==="
make_stub_ssh

setup 220 1 unchanged; enable_offsite; ship laila-data; ship laila-uploads
checkos "both tiers shipped and hash-verified" "laila-uploads_test_2026-01-01_000000.tar.gz.gpg present" "FAIL"

# the whole point of the change: uploads used to be invisible to this check
setup 220 1 unchanged; enable_offsite; ship laila-data
checkos "uploads missing off-site, bundle old"  "laila-uploads_test_2026-01-01_000000.tar.gz.gpg is NOT on"

setup 1 1 unchanged;   enable_offsite; ship laila-data
checkos "uploads not shipped yet, within grace" "has not shipped yet" "is NOT on"

setup 220 1 unchanged; enable_offsite; ship laila-data; ship laila-uploads wrong
checkos "uploads off-site but hash mismatch"    "SHA256 does not match"

setup 220 1 unchanged; enable_offsite; ship laila-data; ship laila-uploads
printf 'down\n' > "$SBX/ssh-mode"
checkos "off-site host unreachable"             "is unreachable" "is NOT on"

# ── the off-site disk itself ─────────────────────────────────────────────────
# 2026-09-04: the off-site host filled up, scp left a right-sized file of
# zeros, and "SHA256 does not match" was all anyone was told. The audit must
# say how much room is left there, and blame the disk when it is the cause.
setup 220 1 unchanged; enable_offsite; ship laila-data; ship laila-uploads
checkos "off-site free space reported"          "MB free" "FAIL"

setup 220 1 unchanged; enable_offsite; ship laila-data; ship laila-uploads
printf '0\n' > "$SBX/remote-free-kb"
checkos "off-site disk full, copies intact"     "has only 0MB free"

setup 220 1 unchanged; enable_offsite; ship laila-data wrong; ship laila-uploads
printf '0\n' > "$SBX/remote-free-kb"
checkos "off-site disk full, copy damaged"      "died part-way"

setup 220 1 unchanged; enable_offsite; ship laila-data wrong; ship laila-uploads
checkos "copy damaged, disk NOT full"           "SHA256 does not match" "died part-way"

echo
echo "passed $PASS, failed $FAIL"
[ "$FAIL" -eq 0 ]
