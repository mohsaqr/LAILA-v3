# LAILA backup and disaster recovery

Everything here answers one question: **if a LAILA host is destroyed right now,
what comes back, how quickly, and who proved it?**

> Host names, addresses and schedules for a particular deployment live in
> `/etc/laila-backup/laila-backup.conf` **on that host**, never in this
> repository. Run `sudo laila-restore.sh list` on a host to see where its
> backups actually go.

## What is protected

| tier | contents | cadence |
|---|---|---|
| **data** | PostgreSQL dump (custom format), `server/.env`, nginx config, systemd/pm2 config, crontabs, Let's Encrypt renewal config, a provenance manifest, and exact per-table row counts | daily |
| **uploads** | `server/uploads` — slides, PDFs, course media | daily, but re-packed only when a content fingerprint changes |

`server/.env` is the reason every bundle is encrypted: it holds `JWT_SECRET`,
`OIDC_PRIVATE_KEY`, `DATABASE_URL` and every LLM provider API key. A database
restore without it leaves every session, every OIDC client and every integration
broken.

## Where the copies live

Three copies of everything, on at least two machines:

```
   LAILA host                          off-site host
   └── /var/backups/laila     ──scp──► ~/LAILA-Backups/<hostname>/
       ├── laila-data_*.gpg   ──rclone (optional)──► cloud remote
       └── laila-uploads_*.gpg
```

Only the AES256 blob is ever transferred, so **the off-site host never holds
anything it can read**, and its SSH key should be added with the `restrict`
option (no port forwarding, no agent forwarding, no pty).

Give each LAILA host its own subdirectory off-site. Retention is scoped to the
host that wrote a bundle, but separate directories make that obvious.

Prefer an off-site host on **different infrastructure from the LAILA host**. Two
machines from the same provider survive a disk failure or an accidental
deletion, but not an account-level problem — which is what the optional rclone
route to a second provider is for.

## Retention

| tier | on the host | off-site |
|---|---|---|
| data | last 14 days, **plus** the newest bundle of each of the last 12 months | last 30 |
| uploads | last 4, **plus** the newest of each of the last 6 months | last 4 |

The monthly tier matters more than it looks: pure "keep the last N" retention
rotates out your last good copy when corruption goes unnoticed for a few weeks.

## Schedule

Installed as `/etc/cron.d/laila-backup`, offset by `BACKUP_HOUR` (default 2) so
a host that already runs other backup jobs can be given a free window:

| | time |
|---|---|
| data bundle | `HH:30` |
| uploads bundle | `HH:45` |
| ship off-site | `HH+1:15` |
| **restore test** | Sunday `HH+2:00` |
| audit | hourly, `:20` |

**RPO** (data you could lose): up to 24 h, bounded by the daily cycle.
**RTO** (time to be running again): roughly 15 minutes for the database on an
existing host; longer if the host itself must be rebuilt.

## The part most backup systems skip: proof

Nothing here is called a success because a command exited 0.

1. `pg_dump`'s exit status is checked — never `|| true`.
2. The dump is parsed back with `pg_restore --list` and must contain at least
   `MIN_TABLES` tables. This catches a dump that "succeeded" against an empty
   or wrong database.
3. The finished `.gpg` is **decrypted again, with the passphrase file on disk**,
   and read through `tar`. That proves the stored bytes open with the stored key.
4. The entry count out must equal the count in.
5. A SHA256 is recorded and re-checked hourly, and again before every upload.
6. The off-site copy is hashed **on the remote host** and compared — not by
   size, which passes happily on a truncated file.
7. **Weekly, the newest bundle is restored into a throwaway database and every
   table's row count is compared against the manifest.** A backup that has never
   been restored is a belief, not a plan.

The hourly audit (`laila-backup-audit.sh`) re-derives all of this from what is
actually on disk and off-site, and mails `ALERT_EMAIL` when anything fails. It
also fails if the restore test has not passed in 8 days — so the system
complains about its *own* verification going stale.

## Daily use

```bash
sudo laila-backup-audit.sh          # is everything actually fine?
sudo laila-restore.sh list          # what exists, locally and off-site
sudo laila-restore.sh inspect       # open the newest bundle and look inside
sudo laila-restore.sh verify        # full restore test, on demand
```

## Recovery

### The database is wrong and you want yesterday back

```bash
sudo laila-restore.sh list                       # pick a bundle
sudo laila-restore.sh verify /var/backups/laila/laila-data_<host>_<stamp>.tar.gz.gpg
sudo laila-restore.sh db /var/backups/laila/laila-data_<host>_<stamp>.tar.gz.gpg \
     --into laila --yes-i-am-sure
# then restart the app (systemctl or pm2, depending on the host)
```

`db` refuses to run without `--into` and `--yes-i-am-sure`, and takes its own
safety dump of the current database first — so a restore of the wrong bundle is
itself recoverable.

### Uploads are missing

```bash
sudo laila-restore.sh uploads --into /path/to/server/uploads
```

Copies in without deleting, so it is safe to run over a partially intact tree.

### The whole host is gone

1. Build a host, install PostgreSQL, Node, nginx.
2. Fetch a bundle from the off-site host (see that host's config for the path).
3. Decrypt with the escrowed passphrase:
   ```bash
   gpg --decrypt laila-data_*.tar.gz.gpg | tar -xz
   ```
   The only tools needed are `gpg` and `tar` — deliberately, so recovery never
   depends on this repository still existing.
4. `secrets/server.env` → `server/.env`; `system/` holds the nginx, systemd and
   cron configuration to put back.
5. `createdb laila && pg_restore --no-owner -d laila db/laila.dump`
6. Restore the uploads bundle the same way.
7. Compare against `db/row-counts.txt`, which travels inside the bundle.

## Key escrow — the one thing that can make all of this worthless

Every bundle is AES256 with a per-host passphrase at
`PASSFILE` (see the config). **Use a different passphrase on each host**, so
compromising one host does not expose another's archives.

Read each one once and store it in a password manager *and* somewhere that
survives losing the password manager. If a passphrase is lost, every copy of
that host's data — local, off-site, and any future one — is unreadable. There is
no recovery path and no support line.

## Adding a second provider (recommended)

An off-site copy on the same provider as the LAILA host does not survive an
account-level problem. On a host, once, with a browser available:

```bash
sudo rclone config          # create a remote, e.g. `gdrive`
sudo sed -i 's|^RCLONE_REMOTE=.*|RCLONE_REMOTE="gdrive:LAILA-Backups"|' \
     /etc/laila-backup/laila-backup.conf
sudo laila-backup-offsite.sh
```

The scp and rclone routes are independent — either alone is a complete recovery
path — and the audit reports on both.

## Installing / reinstalling

Idempotent, and **never** overwrites an existing config, passphrase or SSH key:

```bash
cd deploy/backup && sudo ./install.sh              # schedule at 02:xx
cd deploy/backup && sudo BACKUP_HOUR=6 ./install.sh   # or at 06:xx
```

Then edit `/etc/laila-backup/laila-backup.conf`, authorise
`/etc/laila-backup/id_ed25519_offsite.pub` on the off-site host, escrow the
passphrase, and prove the whole chain:

```bash
sudo laila-backup.sh all && sudo laila-backup-offsite.sh \
  && sudo laila-restore.sh verify && sudo laila-backup-audit.sh
```

## Design limits

- **Point-in-time recovery is not available.** These are daily logical dumps;
  anything written between them is lost if the host is. Continuous archiving
  (WAL shipping) is the next step if a 24 h RPO is ever too coarse.
- **A single off-site provider is a correlated failure.** Enable the rclone
  route above.
- **Retention assumes the audit is being read.** Nothing here can tell you that
  the alert mail is going to an address someone still checks; verify the channel
  with `laila-backup-alert.mjs --check`.
