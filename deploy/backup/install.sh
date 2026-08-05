#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# install.sh — install the LAILA backup system on this host. Idempotent: safe to
# re-run after every deploy, which is how the scripts stay current.
#
#   sudo ./install.sh                     # install/update, schedule at 02:xx
#   sudo BACKUP_HOUR=6 ./install.sh       # schedule at 06:xx instead
#
# NEVER overwrites an existing /etc/laila-backup/laila-backup.conf, passphrase
# or SSH key — re-running must not silently make yesterday's archives
# undecryptable. It only fills in what is missing.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo $0" >&2; exit 1; }

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETC=/etc/laila-backup
SBIN=/usr/local/sbin
BACKUP_HOUR="${BACKUP_HOUR:-2}"

echo "=== installing the LAILA backup system ==="

# ── scripts ──────────────────────────────────────────────────────────────────
install -d -m 0755 "$SBIN"
for s in laila-backup.sh laila-backup-offsite.sh laila-restore.sh laila-backup-audit.sh; do
  install -m 0750 -o root -g root "$SRC/$s" "$SBIN/$s"
  echo "  installed $SBIN/$s"
done
install -m 0750 -o root -g root "$SRC/laila-backup-alert.mjs" "$SBIN/laila-backup-alert.mjs"

# ── config ───────────────────────────────────────────────────────────────────
install -d -m 0750 -o root -g root "$ETC"
if [ -f "$ETC/laila-backup.conf" ]; then
  echo "  keeping existing $ETC/laila-backup.conf"
else
  install -m 0640 -o root -g root "$SRC/laila-backup.conf.example" "$ETC/laila-backup.conf"
  echo "  created $ETC/laila-backup.conf  ← EDIT THIS (APP_DIR, OFFSITE_*, ALERT_EMAIL)"
fi

# ── passphrase ───────────────────────────────────────────────────────────────
# The single most destructive mistake this script could make is to regenerate a
# passphrase that already protects archives. Existence is enough to leave alone.
PASS="$ETC/backup.pass"
if [ -f "$PASS" ]; then
  echo "  keeping existing passphrase $PASS"
else
  ( umask 077; openssl rand -base64 48 | tr -d '\n' > "$PASS" )
  chmod 0400 "$PASS"; chown root:root "$PASS"
  echo "  generated $PASS  ← ESCROW THIS NOW (see the note at the end)"
fi

# ── off-site key ─────────────────────────────────────────────────────────────
KEY="$ETC/id_ed25519_offsite"
if [ -f "$KEY" ]; then
  echo "  keeping existing off-site key $KEY"
else
  ssh-keygen -t ed25519 -N '' -f "$KEY" -C "laila-backup@$(hostname -s)" >/dev/null
  chmod 0400 "$KEY"
  echo "  generated $KEY  ← its .pub must be authorised on the off-site host"
fi

# ── local backup store ───────────────────────────────────────────────────────
install -d -m 0700 -o root -g root /var/backups/laila
echo "  ensured /var/backups/laila (0700 root)"

# ── schedule ─────────────────────────────────────────────────────────────────
# Written as a single /etc/cron.d file so the whole schedule is one artefact
# that can be read, diffed and removed — rather than lines accreting in a user
# crontab where nobody can tell what put them there.
cat > /etc/cron.d/laila-backup <<EOF
# LAILA backup schedule — installed by deploy/backup/install.sh. Do not edit by
# hand; edit the repo copy and re-run the installer.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# database + secrets + system config, every day
30 ${BACKUP_HOUR} * * *  root  nice -n 19 ionice -c2 -n7 ${SBIN}/laila-backup.sh data
# uploads, every day, but only re-packed when they actually changed
45 ${BACKUP_HOUR} * * *  root  nice -n 19 ionice -c2 -n7 ${SBIN}/laila-backup.sh uploads
# ship whatever is newest off this machine
15 $(( (BACKUP_HOUR + 1) % 24 )) * * *  root  nice -n 19 ionice -c2 -n7 ${SBIN}/laila-backup-offsite.sh
# prove a restore still works, weekly, into a throwaway database
0 $(( (BACKUP_HOUR + 2) % 24 )) * * 0   root  nice -n 19 ionice -c2 -n7 ${SBIN}/laila-restore.sh verify >> /var/backups/laila/logs/restore-test.log 2>&1
# and check, hourly, that all of the above is actually true
20 * * * *  root  ${SBIN}/laila-backup-audit.sh --quiet >> /var/backups/laila/logs/audit.log 2>&1
EOF
chmod 0644 /etc/cron.d/laila-backup
echo "  scheduled /etc/cron.d/laila-backup (data ${BACKUP_HOUR}:30, uploads ${BACKUP_HOUR}:45, off-site $(( (BACKUP_HOUR+1)%24 )):15, restore test Sun $(( (BACKUP_HOUR+2)%24 )):00, audit hourly)"

install -d -m 0700 /var/backups/laila/logs

echo
echo "=== installed ==="
echo
echo "NEXT, and none of it is optional:"
echo
echo "  1. Edit $ETC/laila-backup.conf — APP_DIR, OFFSITE_*, ALERT_EMAIL."
echo
echo "  2. Authorise the off-site key. On THIS host:"
echo "       sudo cat $KEY.pub"
echo "     then append that line to ~/.ssh/authorized_keys on the off-site host."
echo
echo "  3. ESCROW THE PASSPHRASE. Read it once:"
echo "       sudo cat $PASS"
echo "     and store it in a password manager AND somewhere that survives losing"
echo "     the password manager. Every archive is AES256 and undecryptable"
echo "     without it — including the copies that are off-site precisely because"
echo "     this host might be gone."
echo
echo "  4. Prove it works, now, rather than finding out later:"
echo "       sudo laila-backup.sh all"
echo "       sudo laila-backup-offsite.sh"
echo "       sudo laila-restore.sh verify"
echo "       sudo laila-backup-audit.sh"
