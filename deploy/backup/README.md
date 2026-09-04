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
6. The off-site copy of **both tiers** is hashed **on the remote host** and
   compared — not by size, which passes happily on a truncated file. A bundle
   packed less than `OFFSITE_GRACE_HOURS` ago is reported as not-yet-shipped
   rather than missing, because the daily shipping run may not have finished.
   Every upload lands under a `.part` name and is renamed only after that
   remote hash matches, so a real bundle name never holds anything but a
   verified copy; a damaged copy found under a real name is removed and
   re-sent.
7. The off-site host is asked for its **free space** before every upload and
   at every audit. A full destination is the failure scp cannot report
   honestly — it leaves a right-sized file of zeros — so the shipper refuses
   to send into one and the audit says, in MB, that the far disk is the
   problem (`OFFSITE_MIN_FREE_MB` is the headroom it insists on).
8. **Weekly, the newest bundle is restored into a throwaway database and every
   table's row count is compared against the manifest.** A backup that has never
   been restored is a belief, not a plan.

The hourly audit (`laila-backup-audit.sh`) re-derives all of this from what is
actually on disk and off-site, and mails `ALERT_EMAIL` when anything fails. It
also fails if the restore test has not passed in 8 days — so the system
complains about its *own* verification going stale.

### Why an old uploads bundle can still be healthy

Uploads are only re-packed when the tree changes, so on a quiet host the newest
uploads bundle sails past `STALE_UPLOADS_HOURS` while nothing is wrong. Age
alone cannot answer "what would we get back?" for that tier, so the audit
forgives an old uploads bundle **only** when it can establish both of:

- the live `server/uploads` tree still hashes to the fingerprint recorded when
  that bundle was written — so the bundle is a complete copy of today's
  uploads, whatever its date; and
- the daily uploads job has run within `UPLOADS_JOB_MAX_AGE_HOURS` (30) — so a
  dead cron is still caught while the tree happens to be static.

Both are computed by the audit itself; neither is taken from a status file's
headline. When it does fail, the message says which condition broke — "the live
uploads tree NO LONGER matches it" and "the cron looks dead" are the same age
reading but very different jobs.

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

## Updating the scripts on a host that already has them

Do **not** re-run `install.sh` just to ship a script change. It rewrites
`/etc/cron.d/laila-backup` from `BACKUP_HOUR`, which defaults to `2` — on a host
that backs up at another hour, that silently reschedules everything. (lacarm
runs at 06:xx precisely because its own whole-server backups own 00:00–05:00.)

Use `push-scripts.sh`, which replaces only the files in `/usr/local/sbin` and
leaves the cron file, config, passphrase and off-site key alone:

```bash
cd deploy/backup
./push-scripts.sh <ssh-target> <ssh-key>              # verify only — changes nothing
./push-scripts.sh <ssh-target> <ssh-key> --install    # verify, then install
```

It refuses to install unless it has first, **on that host**:

1. run the regression suites (`test-audit.sh`, `test-offsite.sh`) in a
   sandbox, and
2. run the new audit against the host's real config with `ALERT_EMAIL` blanked,
   so you see exactly what the hourly cron will report — without paging anyone.

Then it installs at `0750` keeping each previous copy as
`/usr/local/sbin/.<name>.bak-<date>`, and runs the audit the way cron does.
Roll back by copying a `.bak-<date>` file back over the original.

Host addresses, SSH keys and each host's `BACKUP_HOUR` live in
`deploy/lailalms-ops-runbook.md`, which is git-ignored. **Run it against every
host** — the two production hosts have opposite uploads profiles (one a few MB
that almost never change, one ~580 MB re-packed daily), and that difference has
already hidden a bug once.

## Design limits

- **Point-in-time recovery is not available.** These are daily logical dumps;
  anything written between them is lost if the host is. Continuous archiving
  (WAL shipping) is the next step if a 24 h RPO is ever too coarse.
- **A single off-site provider is a correlated failure.** Enable the rclone
  route above.
- **The off-site host is shared, and its disk is not ours.** Other systems
  ship there too. When the audit reports the off-site disk full, the fix is on
  that host, and it is usually somebody else's files (2026-09-04: a 23 GB VM
  image and 49 GB of another server's bundles on a 77 GB disk, LAILA at 2.4 GB).
- **Retention assumes the audit is being read.** Nothing here can tell you that
  the alert mail is going to an address someone still checks; verify the channel
  with `laila-backup-alert.mjs --check`.
