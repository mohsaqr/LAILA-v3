#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-offsite.sh — regression test for laila-backup-offsite.sh's scp route.
#
# The incident this exists to prevent (2026-09-04, both hosts): the off-site
# disk filled up, scp died part-way and left a file of the right name and the
# right size holding zeros, and the only symptom was a hash mismatch that read
# like corruption. The shipper must now (a) refuse to send into a full disk and
# say so in MB, (b) never leave a damaged file under a real bundle name, and
# (c) replace a damaged copy it finds there with a verified one.
#
# Runs entirely in a sandbox: a stub ssh runs "remote" commands in a local
# directory, a stub scp copies (or half-copies) files into it, and a shim df
# reports whatever free space the case asks for. Needs GNU coreutils, so run it
# on the Linux host, not macOS:
#
#   scp deploy/backup/{test-offsite.sh,laila-backup-offsite.sh} host:/tmp/
#   ssh host 'bash /tmp/test-offsite.sh /tmp/laila-backup-offsite.sh'
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
SHIP="${1:?usage: test-offsite.sh /path/to/laila-backup-offsite.sh}"
SBX="$(mktemp -d /tmp/laila-offsite-test-XXXXXX)"
trap 'rm -rf "$SBX"' EXIT

PASS=0; FAIL=0
H="$(hostname -s)"                   # bundle names carry the host; rotation globs on it
REMOTE="$SBX/remote"                 # the off-site user's $HOME
RDIR="$REMOTE/LAILA-Backups/test"    # OFFSITE_DIR, relative to it

# ── stubs ────────────────────────────────────────────────────────────────────
mkdir -p "$SBX/bin" "$SBX/remote-bin"

# ssh: the remote command is the last argument; run it in the sandbox home
# with the df shim first on PATH. "down" mode is an unreachable host.
cat > "$SBX/bin/ssh" <<'STUB'
#!/usr/bin/env bash
[ "$(cat "$SBXDIR/ssh-mode" 2>/dev/null || echo up)" = "down" ] && exit 255
cmd="${!#}"
cd "$SBXDIR/remote" || exit 1
PATH="$SBXDIR/remote-bin:$PATH" bash -c "$cmd"
STUB

# scp: <opts...> <local file> user@host:<remote path>. "fail" mode writes half
# the file and exits 1 — what a transfer into a full disk looks like.
cat > "$SBX/bin/scp" <<'STUB'
#!/usr/bin/env bash
src="${@: -2:1}"; dst="${!#}"; path="${dst#*:}"
cd "$SBXDIR/remote" || exit 1
if [ "$(cat "$SBXDIR/scp-mode" 2>/dev/null || echo ok)" = "fail" ]; then
  head -c $(( $(stat -c %s "$src") / 2 )) "$src" > "$path"; exit 1
fi
cp "$src" "$path"
STUB

# df: one line, column 4 = free KB from the case's setting.
cat > "$SBX/remote-bin/df" <<'STUB'
#!/usr/bin/env bash
free="$(cat "$SBXDIR/remote-free-kb" 2>/dev/null || echo 99999999)"
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf '/dev/sandbox 100000000 1 %s 1%% /\n' "$free"
STUB
chmod +x "$SBX/bin/ssh" "$SBX/bin/scp" "$SBX/remote-bin/df"

# ── fixtures ─────────────────────────────────────────────────────────────────
bundle(){ # bundle <prefix> <stamp> — a fake bundle with its recorded hash
  local b="$SBX/backups/${1}_${H}_${2}.tar.gz.gpg"
  head -c 20480 /dev/urandom > "$b"
  sha256sum "$b" | awk '{print $1}' > "${b%.tar.gz.gpg}.sha256"
}
setup(){ # fresh local backups, empty remote, healthy modes
  rm -rf "$SBX/backups" "$REMOTE"
  mkdir -p "$SBX/backups" "$REMOTE"
  bundle laila-data    2026-01-01_000000
  bundle laila-uploads 2026-01-01_000000
  printf 'up\n' > "$SBX/ssh-mode"; printf 'ok\n' > "$SBX/scp-mode"
  rm -f "$SBX/remote-free-kb"
  cat > "$SBX/conf" <<CONF
BACKUP_DIR="$SBX/backups"
OFFSITE_HOST="offsite.test"
OFFSITE_USER="backup"
OFFSITE_DIR="LAILA-Backups/test"
OFFSITE_KEY="$SBX/conf"
KEEP_OFFSITE_DATA=30
KEEP_OFFSITE_UPLOADS=4
SCP_LIMIT_KBIT=1
RCLONE_REMOTE=""
OFFSITE_MIN_FREE_MB=1
OFFSITE_SSH="$SBX/bin/ssh"
OFFSITE_SCP="$SBX/bin/scp"
CONF
}
run(){ # run -> RC, LOG (newest log's text), STATUS (LAST-OFFSITE-STATUS.txt)
  SBXDIR="$SBX" LAILA_BACKUP_CONF="$SBX/conf" bash "$SHIP" >/dev/null 2>&1; RC=$?
  LOG="$(cat "$(ls -1t "$SBX/backups/logs"/offsite-*.log | head -1)")"
  STATUS="$(cat "$SBX/backups/LAST-OFFSITE-STATUS.txt" 2>/dev/null)"
  sleep 1   # log names carry a 1 s stamp; keep consecutive runs distinct
}
hash_of(){ sha256sum "$1" | awk '{print $1}'; }
local_hash(){ cat "$SBX/backups/${1}_${H}_2026-01-01_000000.sha256"; }
remote_file(){ echo "$RDIR/${1}_${H}_2026-01-01_000000.tar.gz.gpg"; }

assert(){ # assert <case> <condition-description> <test...>
  if "${@:3}"; then PASS=$((PASS+1)); printf '  pass  %-52s %s\n' "$1" "$2"
  else FAIL=$((FAIL+1)); printf '  FAIL  %-52s %s\n' "$1" "$2"; fi
}
log_has(){ echo "$LOG" | grep -qF -- "$1"; }
remote_matches(){ [ -f "$(remote_file "$1")" ] && [ "$(hash_of "$(remote_file "$1")")" = "$(local_hash "$1")" ]; }
no_parts(){ [ -z "$(find "$REMOTE" -name '*.part' 2>/dev/null)" ]; }

echo "=== off-site shipping ==="

setup; run
assert "healthy: both tiers ship"       "exit 0"                    [ "$RC" -eq 0 ]
assert "healthy: both tiers ship"       "data copy hash-verified"   remote_matches laila-data
assert "healthy: both tiers ship"       "uploads copy hash-verified" remote_matches laila-uploads
assert "healthy: both tiers ship"       "no .part left behind"      no_parts
assert "healthy: both tiers ship"       "status SUCCESS"            grep -q 'STATUS: SUCCESS' <<< "$STATUS"

run
assert "second run, nothing new"        "exit 0"                    [ "$RC" -eq 0 ]
assert "second run, nothing new"        "reports already off-site"  log_has "already off-site and verified"

setup; printf '1\n' > "$SBX/remote-free-kb"; run
assert "off-site disk full"             "exit 1"                    [ "$RC" -eq 1 ]
assert "off-site disk full"             "names the MB free"         log_has "has only 0MB free"
assert "off-site disk full"             "says the OFF-SITE disk is full" log_has "OFF-SITE disk is full"
assert "off-site disk full"             "sent nothing"              [ ! -e "$(remote_file laila-data)" ]
assert "off-site disk full"             "no .part left behind"      no_parts
assert "off-site disk full"             "status FAILED"             grep -q 'STATUS: FAILED' <<< "$STATUS"

setup; printf 'fail\n' > "$SBX/scp-mode"; run
assert "scp dies part-way"              "exit 1"                    [ "$RC" -eq 1 ]
assert "scp dies part-way"              "nothing under the real name" [ ! -e "$(remote_file laila-data)" ]
assert "scp dies part-way"              "partial file removed"      no_parts
assert "scp dies part-way"              "log says partial removed"  log_has "removing the partial remote file"

# a damaged copy already sitting under the real name — the 2026-09-04 state
setup; mkdir -p "$RDIR"
head -c 20480 /dev/zero > "$(remote_file laila-data)"
printf 'stale\n' > "$(remote_file laila-data).part"
run
assert "damaged copy already off-site"  "exit 0"                    [ "$RC" -eq 0 ]
assert "damaged copy already off-site"  "log names the mismatch"    log_has "does NOT match its hash — removing"
assert "damaged copy already off-site"  "replaced by a verified copy" remote_matches laila-data
assert "damaged copy already off-site"  "stale .part cleaned up"    no_parts

# a damaged copy AND a full disk: the bad file must still go, so nobody
# recovering by hand takes it for the newest bundle
setup; mkdir -p "$RDIR"
head -c 20480 /dev/zero > "$(remote_file laila-data)"
printf '1\n' > "$SBX/remote-free-kb"; run
assert "damaged copy + full disk"       "exit 1"                    [ "$RC" -eq 1 ]
assert "damaged copy + full disk"       "damaged copy removed"      [ ! -e "$(remote_file laila-data)" ]

setup; printf 'down\n' > "$SBX/ssh-mode"; run
assert "off-site host unreachable"      "exit 1"                    [ "$RC" -eq 1 ]
assert "off-site host unreachable"      "log says cannot reach"     log_has "cannot reach"

# rotation must never count an in-flight .part, and must keep exactly $keep
setup; mkdir -p "$RDIR"
for i in 1 2 3 4 5; do head -c 100 /dev/urandom > "$RDIR/laila-data_${H}_2025-0${i}-01_000000.tar.gz.gpg"; done
sed -i 's/^KEEP_OFFSITE_DATA=.*/KEEP_OFFSITE_DATA=3/' "$SBX/conf"
run
assert "remote rotation"                "keeps KEEP_OFFSITE_DATA newest" [ "$(ls "$RDIR"/laila-data_"$H"_*.tar.gz.gpg | wc -l)" -eq 3 ]
assert "remote rotation"                "newest survives"           remote_matches laila-data

echo
echo "passed $PASS, failed $FAIL"
[ "$FAIL" -eq 0 ]
