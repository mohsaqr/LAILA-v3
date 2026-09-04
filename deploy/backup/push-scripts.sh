#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# push-scripts.sh — update the backup scripts on an already-installed host.
#
# This is the *update* path, not the install path. It replaces the scripts in
# /usr/local/sbin and touches nothing else: not the cron file, not the config,
# not the passphrase, not the off-site key.
#
# Use install.sh instead ONLY for a first-time install on a new host — it
# rewrites /etc/cron.d/laila-backup from BACKUP_HOUR, which defaults to 2. On a
# host that runs its backups at another hour that silently reschedules
# everything, so if you do run it, pass the right BACKUP_HOUR (see the ops
# runbook for each host's value).
#
# It verifies before it changes anything: the regression suite runs on the host,
# then the new audit runs against the real config with mail suppressed, so you
# see exactly what the hourly cron will report. Without --install it stops there
# and the host is left untouched.
#
#   ./push-scripts.sh <ssh-target> <ssh-key>            # verify only (default)
#   ./push-scripts.sh <ssh-target> <ssh-key> --install  # verify, then install
#
# Host addresses and key paths are deliberately not in this file. See
# deploy/lailalms-ops-runbook.md (git-ignored) for the exact invocations.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

TARGET="${1:?usage: push-scripts.sh <ssh-target> <ssh-key> [--install]}"
KEY="${2:?usage: push-scripts.sh <ssh-target> <ssh-key> [--install]}"
INSTALL=0
[ "${3:-}" = "--install" ] && INSTALL=1

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS=(laila-backup.sh laila-backup-offsite.sh laila-restore.sh laila-backup-audit.sh)
STAMP="$(date +%Y-%m-%d)"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=30 -o IdentitiesOnly=yes -i "$KEY")
sh_(){ ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }

die(){ echo "ABORT: $*" >&2; exit 1; }

echo "=== $TARGET ==="
HOST="$(sh_ 'hostname -s' 2>&1)" || die "cannot reach $TARGET — $HOST"
echo "connected: $HOST"
sh_ 'sudo -n true' >/dev/null 2>&1 || die "no passwordless sudo on $HOST"

echo "--- copying ---"
scp -q "${SSH_OPTS[@]}" "${SCRIPTS[@]/#/$SRC/}" "$SRC/laila-backup-alert.mjs" \
      "$SRC/test-audit.sh" "$SRC/test-offsite.sh" "$TARGET:/tmp/" || die "scp failed"

# 1. The regression suites, in a sandbox. Never touch the real backups.
# Capture, then print: piping the run into `tail` would hand us the pager's exit
# status and a failed suite would look like a pass.
run_suite(){ # run_suite <test script> <script under test>
  echo "--- regression tests: $1 ---"
  sh_ "out=\"\$(bash /tmp/$1 /tmp/$2)\"; rc=\$?; echo \"\$out\" | tail -2; exit \$rc" || {
    sh_ 'rm -f /tmp/laila-*.sh /tmp/laila-*.mjs /tmp/test-audit.sh /tmp/test-offsite.sh'
    die "$1 FAILED on $HOST — nothing installed"
  }
}
run_suite test-audit.sh   laila-backup-audit.sh
run_suite test-offsite.sh laila-backup-offsite.sh

# 2. The new audit against the real config, with mail suppressed so a problem
#    found here does not page anyone before we have decided to install.
echo "--- dry run against the real config (mail suppressed) ---"
sh_ '
  sudo -n sed "s/^ALERT_EMAIL=.*/ALERT_EMAIL=\"\"/" /etc/laila-backup/laila-backup.conf > /tmp/audit-dryrun.conf
  sudo -n env LAILA_BACKUP_CONF=/tmp/audit-dryrun.conf bash /tmp/laila-backup-audit.sh
  rc=$?; rm -f /tmp/audit-dryrun.conf; exit $rc
'
DRY_RC=$?
[ "$DRY_RC" -eq 0 ] || echo "NOTE: the dry run reported problems (exit $DRY_RC) — read them above before installing"

if [ "$INSTALL" -eq 0 ]; then
  sh_ 'rm -f /tmp/laila-backup*.sh /tmp/laila-restore.sh /tmp/laila-backup-alert.mjs /tmp/test-audit.sh /tmp/test-offsite.sh'
  echo
  echo "verify-only run: $HOST was NOT modified. Re-run with --install to apply."
  exit "$DRY_RC"
fi

# 3. Install at the same modes install.sh uses, keeping the previous copy.
echo "--- installing ---"
for s in "${SCRIPTS[@]}" laila-backup-alert.mjs; do
  sh_ "
    sudo -n cp -a /usr/local/sbin/$s /usr/local/sbin/.$s.bak-$STAMP 2>/dev/null
    sudo -n install -m 0750 -o root -g root /tmp/$s /usr/local/sbin/$s
  " || die "install of $s failed on $HOST"
  echo "  installed /usr/local/sbin/$s (previous kept as .$s.bak-$STAMP)"
done
sh_ 'rm -f /tmp/laila-backup*.sh /tmp/laila-restore.sh /tmp/laila-backup-alert.mjs /tmp/test-audit.sh /tmp/test-offsite.sh'

# 4. Prove the installed copy runs the way cron will run it.
echo "--- live audit, exactly as cron invokes it ---"
sh_ 'sudo -n /usr/local/sbin/laila-backup-audit.sh --quiet; echo "exit=$?"'
echo
echo "done: $HOST"
