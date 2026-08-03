# LAILA LMS - Deployment Guide

Production deployment for LAILA on a Linux server with PostgreSQL, Nginx, and systemd.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deploy (Automated)](#quick-deploy-automated)
- [Manual Deployment](#manual-deployment)
- [Environment Variables](#environment-variables)
- [Nginx Configuration](#nginx-configuration)
- [Systemd Service](#systemd-service)
- [SSL/HTTPS](#sslhttps)
- [Backups](#backups)
- [Management Commands](#management-commands)
  - [Deployment topologies — why the steps differ per host](#deployment-topologies--why-the-steps-differ-per-host)
  - [Updating an existing host](#updating-an-existing-host)
  - [Verify a deployment](#verify-a-deployment)
  - [Content-Security-Policy and the labs](#content-security-policy-and-the-labs)
- [Database Migration (SQLite to PostgreSQL)](#database-migration)
- [Cloud Platform Deployment](#cloud-platform-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL** (production database)
- **Nginx** (reverse proxy)
- **Certbot** (optional, for Let's Encrypt SSL)
- At least one AI provider API key (OpenAI, Gemini, or local Ollama)

---

## Quick Deploy (Automated)

The project includes an automated deployment script at `deploy/deploy.sh` that handles everything:

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

The script will:

1. Check prerequisites (Node 18+, PostgreSQL, Nginx)
2. Prompt for domain, database credentials, and API keys
3. Create `server/.env` from the production template
4. Switch Prisma from SQLite to PostgreSQL
5. Install dependencies and build both client and server
6. Seed the database (first deploy only)
7. Configure Nginx with the included `deploy/nginx/laila.conf`
8. Obtain Let's Encrypt SSL certificate (if Certbot is installed)
9. Install and start the systemd service

After completion:

- **Application**: `https://your-domain.com`
- **Service status**: `sudo systemctl status laila`
- **Logs**: `sudo journalctl -u laila -f`

---

## Manual Deployment

### 1. Clone and install

```bash
git clone https://github.com/mohsaqr/LAILA-v3.git
cd LAILA-v3

# Install all dependencies
npm run install:all
```

### 2. Configure environment

```bash
cp deploy/.env.production server/.env
```

Edit `server/.env` and fill in all `[REQUIRED]` values (see [Environment Variables](#environment-variables) below).

### 3. Set up PostgreSQL

```bash
# Create database
sudo -u postgres createdb laila
sudo -u postgres createuser laila -P

# Update DATABASE_URL in server/.env:
# DATABASE_URL="postgresql://laila:yourpassword@localhost:5432/laila"
```

### 4. Switch Prisma to PostgreSQL

In `server/prisma/schema.prisma`, change the provider:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 5. Apply schema and seed

```bash
cd server
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
npx tsx prisma/seed.ts
```

### 6. Build

```bash
# From project root
npm run build
```

This creates:
- `server/dist/` - Compiled TypeScript backend
- `client/dist/` - Static Vite frontend

### 7. Configure Nginx

```bash
sudo cp deploy/nginx/laila.conf /etc/nginx/sites-available/laila
sudo ln -sf /etc/nginx/sites-available/laila /etc/nginx/sites-enabled/laila
sudo rm -f /etc/nginx/sites-enabled/default
```

Edit `/etc/nginx/sites-available/laila` and replace placeholders:
- `__DOMAIN__` with your domain (e.g., `laila.example.com`)
- `__INSTALL_DIR__` with the absolute path to the project root

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Configure systemd service

```bash
sudo cp deploy/systemd/laila.service /etc/systemd/system/laila.service
```

Edit `/etc/systemd/system/laila.service` and replace:
- `__INSTALL_DIR__` with the project root path
- `__USER__` with the Linux user to run the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable laila
sudo systemctl start laila
```

### 9. Set up SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Environment Variables

Production environment template is at `deploy/.env.production`. Copy to `server/.env`.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string: `postgresql://user:pass@localhost:5432/laila` |
| `JWT_SECRET` | Auth token secret (generate with `openssl rand -base64 32`) |
| `SESSION_SECRET` | Session secret (generate with `openssl rand -base64 32`) |
| `CLIENT_URL` | Frontend URL for CORS, e.g., `https://laila.example.com` |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `5001` | Backend server port |

### AI Providers (at least one required)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Default: `gpt-4o-mini` |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Default: `gemini-pro` |
| `OPENAI_BASE_URL` | For local LLMs (Ollama/LM Studio): `http://localhost:1234/v1` |

### Optional

| Variable | Description |
|----------|-------------|
| `SEED_ADMIN_PASSWORD` | Custom admin password for seeding (random if unset) |
| `SEED_INSTRUCTOR_PASSWORD` | Custom instructor password for seeding |
| `SEED_STUDENT_PASSWORD` | Custom student password for seeding |
| `SMTP_HOST` | SMTP server for email notifications |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender email address |

---

## Nginx Configuration

The production Nginx config is at `deploy/nginx/laila.conf`. Key features:

- **HTTP to HTTPS redirect** with Let's Encrypt challenge support
- **API reverse proxy** to `http://127.0.0.1:5001` with 120s timeout for AI requests
- **Socket.IO WebSocket proxy** at `/socket.io/` with `Upgrade` and `Connection` headers for real-time notifications
- **Uploaded files proxy** at `/uploads/`
- **Static asset serving** from `client/dist/` with 1-year cache for hashed assets
- **SPA catch-all** with `try_files` fallback to `index.html`
- **Security headers**: X-Frame-Options, X-Content-Type-Options, HSTS, XSS Protection
- **Gzip compression** for text, CSS, JS, JSON, XML, SVG
- **10MB upload limit** (`client_max_body_size`)

---

## Systemd Service

The service unit is at `deploy/systemd/laila.service`. Features:

- Runs `node dist/index.js` in the server directory
- Loads environment from `server/.env`
- Auto-restarts on failure (5s delay, max 5 attempts per minute)
- Security hardening: `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`
- Read-write access only to `server/uploads/` and `server/logs/`
- Logs to journald (view with `journalctl -u laila`)

---

## SSL/HTTPS

### Let's Encrypt (recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot auto-configures Nginx and sets up auto-renewal.

### Manual renewal

```bash
sudo certbot renew --dry-run    # Test
sudo certbot renew              # Actual renewal
```

Auto-renewal is typically set up via systemd timer or cron by Certbot.

---

## Backups

The project includes a backup script at `deploy/backup.sh`.

### Usage

```bash
chmod +x deploy/backup.sh
./deploy/backup.sh                    # Default: saves to ./backups/
./deploy/backup.sh /path/to/backups   # Custom backup directory
```

### What it backs up

- **Database**: `pg_dump` compressed with gzip (`db_YYYYMMDD_HHMMSS.sql.gz`)
- **Uploads**: `tar.gz` of `server/uploads/` (`uploads_YYYYMMDD_HHMMSS.tar.gz`)
- **Auto-prune**: Removes backups older than 30 days (configurable via `KEEP_DAYS`)

### Automated daily backups (cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at midnight
0 0 * * * /path/to/LAILA-v3/deploy/backup.sh /path/to/backups
```

### Restore from backup

```bash
# Database
gunzip -c backups/db_20260216_000000.sql.gz | psql -U laila -d laila

# Uploads
tar -xzf backups/uploads_20260216_000000.tar.gz -C server/
```

---

## Management Commands

### Service management

```bash
sudo systemctl start laila       # Start
sudo systemctl stop laila        # Stop
sudo systemctl restart laila     # Restart
sudo systemctl status laila      # Status
sudo journalctl -u laila -f      # Live logs
sudo journalctl -u laila --since "1 hour ago"  # Recent logs
```

### Database

```bash
cd server
npx prisma studio               # Visual DB editor (port 5555)
npx prisma db push               # Apply schema changes
npx prisma migrate deploy        # Run pending migrations
npx tsx prisma/seed.ts           # Re-seed database
```

### Health check

```bash
curl -sf http://127.0.0.1:5001/api/health
```

### Rebuild and redeploy

```bash
cd /path/to/LAILA-v3
git pull
cd server && npm ci --omit=dev && npx prisma generate && npx prisma migrate deploy && npx tsc
cd ../client && npm ci && npm run build
sudo systemctl restart laila
```

Or the short version (if no schema changes):

```bash
cd /path/to/LAILA-v3
git pull
npm run install:all
npm run build
sudo systemctl restart laila
```

### Deployment topologies — why the steps differ per host

LAILA is deployed in two shapes, and **which one a host uses decides whether it
needs an nginx step at all**. Check with one command:

```bash
curl -sI https://your-host/ | grep -i '^server:'
```

| `Server:` header | Topology | What serves `index.html` | To update |
|---|---|---|---|
| `cloudflare`, or your tunnel | tunnel → Express, **no nginx** | Express, so helmet sets the headers | Code deploy only |
| `nginx/...` | nginx → Express | nginx, from disk — **helmet never sees it** | Code deploy **plus** the nginx snippet |

This is the single most important distinction in this document. On an
nginx-fronted host the Express security headers apply only to `/api/*`
responses, where a JSON body loads no subresources and the policy governs
nothing, while the pages themselves ship with no CSP at all. Deploying code to
such a host does **not** fix its headers.

### Updating an existing host

```bash
# 1. Code
cd /path/to/LAILA-v3
git pull
npm run install:all
npm run build            # NOT `npx tsc` — see the warning below
sudo systemctl restart laila     # or: pm2 restart laila

# 2. nginx-fronted hosts only — install the security-header snippet
sudo bash deploy/update-nginx-headers.sh
#    then add the include line it prints, to the SPA `location /` block
#    and to any nested location that sets its own add_header, then:
sudo nginx -t && sudo systemctl reload nginx

# 3. Confirm from outside
node scripts/verify-deployment.mjs https://your-host --expect-version 3.10.0
```

⚠️ **Use `npm run build`, not `npx tsc`.** `npx tsc` compiles but skips npm
lifecycle scripts, so `prebuild` never runs: no `build-info.json` is written and
`check-versions` never gates the deploy. The server falls back to reading the
commit out of `.git`, so `/api/health` still reports a `gitSha` — but with
`builtAt: null`, which is the signature of a deploy that skipped `prebuild`.

⚠️ **Never run `deploy.sh` to update an existing host.** It is an installer. It
unconditionally overwrites `server/.env` from the template, taking the live
database password, JWT/session secrets and API keys with it, then re-prompts for
all of them and re-runs migrations.

### Verify a deployment

**Always run this after a deploy.** A `git pull` plus a service restart can
succeed while the client is still serving artifacts from an older build — the
service is up, the database is healthy, `/api/health` returns 200, and the
pages are stale. That has happened, and it was only caught by diffing bundle
sizes by hand.

```bash
# From a checkout of the commit you believe is deployed
node scripts/verify-deployment.mjs https://laila.example.com --expect-version 3.10.0

# Skip the bundle download (faster, but does not check the About page)
node scripts/verify-deployment.mjs https://laila.example.com --quick
```

It exits non-zero on failure, so it can gate a deploy. It checks that:

1. the service is up and reports the **commit** it is running — `/api/health`
   returns a `build.gitSha`, which changes every build, unlike the version
2. the **SPA document** carries its security headers. This is the one that
   matters: when nginx serves `index.html` from disk, helmet never sees the
   request, so the CSP ends up only on `/api` responses where it protects
   nothing while the pages ship unprotected
3. the CSP still permits the WebR and Pyodide origins, so the R and Python labs
   can start (see below)
4. the About page — licence and open-source attribution — is in the bundle

### Content-Security-Policy and the labs

The policy is defined once, in **`server/src/config/csp.ts`**. helmet imports it,
and the nginx copies in `deploy/nginx/laila.conf` and `deploy/deploy.sh` are
generated from it:

```bash
cd server
npm run csp:generate    # rewrite the nginx blocks after editing csp.ts
npm run csp:check       # exit 1 if any committed copy has drifted (part of `npm run check`)
```

Never hand-edit between the `# >>> laila-security-headers >>>` markers — the
next generate overwrites it, and `csp.test.ts` fails in the meantime.

#### Applying the headers to a host that is already installed

⚠️ **A `git pull` does not update nginx.** `deploy.sh` writes
`/etc/nginx/sites-available/laila` only during install, so an existing host
keeps whatever config it was installed with — which for at least one deployment
meant no CSP on the SPA document at all. And **re-running `deploy.sh` is not an
update path**: it unconditionally overwrites `server/.env` with the template,
taking the live DB password, JWT secret and API keys with it.

Use the snippet instead. It installs by reference, so a config certbot may be
managing is never rewritten:

```bash
# On the server, from the repo checkout
sudo bash deploy/update-nginx-headers.sh          # install + verify + reload
bash deploy/update-nginx-headers.sh --dry-run     # show what it would do
```

It copies `deploy/nginx/security-headers.conf` to
`/etc/nginx/snippets/laila-security-headers.conf`, backs up any previous copy,
runs `nginx -t`, and reloads. It touches nothing else — not `.env`, not the
database, not systemd, not your certificates.

Then add **one line** to your site config, inside the SPA `location / { … }`
block *and* inside any nested location that sets its own `add_header`:

```nginx
location / {
    try_files $uri $uri/ /index.html;
    include /etc/nginx/snippets/laila-security-headers.conf;

    location = /index.html {
        expires 5m;
        add_header Cache-Control "public, must-revalidate";
        include /etc/nginx/snippets/laila-security-headers.conf;   # repeat — see below
    }
}
```

The repetition is required: nginx drops **every** inherited header from a
location that declares an `add_header` of its own, and headers do not cascade
into nested locations. The script re-runs safely and will tell you if the
snippet is installed but not yet included (in which case it is inert, and nginx
is deliberately not reloaded).

The snippet is HTTPS-only — it sets HSTS and `upgrade-insecure-requests`, both
wrong on a plaintext listener. `deploy.sh`'s inline configs already carry the
`http` variant, so a fresh install needs none of this.

Confirm from outside afterwards:

```bash
node scripts/verify-deployment.mjs https://laila.example.com
```

⚠️ **The labs depend on this policy.** WebR and Pyodide are not bundled; they
download their WebAssembly runtimes and packages at page load from
`webr.r-wasm.org`, `repo.r-wasm.org` and `cdn.jsdelivr.net`. A CSP that omits
those origins from `connect-src` (or omits `'wasm-unsafe-eval'` from
`script-src`, or `blob:` from `worker-src`) stops every R and Python lab from
starting. The failure surfaces inside R as a libcurl
`Timeout was reached` — not as a CSP error — so it is easily misdiagnosed as a
network problem.

Related: data loaded inside a lab must come from a CORS-enabled host.
`github.com/<owner>/<repo>/raw/...` is a redirect that sends no
`Access-Control-Allow-Origin`; use
`raw.githubusercontent.com/<owner>/<repo>/<branch>/...` instead.

### Version consistency

The root, `client/` and `server/` `package.json` versions must agree — the
server reports one via `/api/health` and the client shows another on the About
page. The check runs automatically in the server's `prebuild`:

```bash
npm run check:versions
```

---

## Database Migration

### SQLite (development) to PostgreSQL (production)

1. Update `server/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Set `DATABASE_URL` in `server/.env`:

```env
DATABASE_URL="postgresql://laila:password@localhost:5432/laila"
```

3. Apply schema and seed:

```bash
cd server
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
npx prisma db seed
```

---

## Cloud Platform Deployment

### Railway / Render / Fly.io

1. Connect your GitHub repository
2. Set environment variables in the platform dashboard
3. Build command: `npm run install:all && npm run build`
4. Start command: `cd server && npm start`

### Vercel (frontend only)

```bash
cd client && vercel --prod
```

Set `VITE_API_URL` to your backend URL. Backend must be hosted separately.

---

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u laila -n 50 --no-pager

# Common causes:
# - Missing server/.env or missing required variables
# - PostgreSQL not running: sudo systemctl start postgresql
# - Port 5001 already in use: lsof -ti :5001
# - Build not run: cd /path/to/LAILA-v3 && npm run build
```

### Database connection issues

```bash
# Test PostgreSQL connection
psql -U laila -d laila -c "SELECT 1"

# Reset and reseed
cd server
npx prisma db push --force-reset
npx prisma db seed
```

### Build failures

```bash
# Clean rebuild
rm -rf server/dist client/dist
rm -rf node_modules client/node_modules server/node_modules
npm run install:all
npm run build
```

### Nginx issues

```bash
sudo nginx -t                          # Test config syntax
sudo systemctl reload nginx            # Reload after changes
sudo tail -f /var/log/nginx/error.log  # Check error log
```

### Theme not working

1. Clear localStorage: `localStorage.removeItem('laila-theme-preference')`
2. Hard refresh: Ctrl+Shift+R

### Default accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@laila.edu | admin123 |
| Instructor | instructor@laila.edu | instructor123 |
| Student | student@laila.edu | student123 |

---

## Real-Time Features

### Socket.IO (WebSocket)

The server uses Socket.IO for real-time notifications. Key details:

- **Server**: `server/src/utils/socket.ts` — initializes Socket.IO on the HTTP server
- **Client**: `client/src/services/socket.ts` — connects with user ID for room-based targeting
- **Nginx**: The `/socket.io/` location block proxies WebSocket connections with `Upgrade` headers
- **CSP**: `connect-src` includes `ws:` and `wss:` to allow WebSocket connections

If notifications aren't working in production, verify:
1. Nginx has the `/socket.io/` proxy block with `proxy_set_header Upgrade $http_upgrade`
2. The server CSP allows `ws:` / `wss:` in `connectSrc`

---

## Deploy Directory Structure

```
deploy/
├── .env.production      # Environment template (copy to server/.env)
├── deploy.sh            # Automated deployment script
├── backup.sh            # Database & uploads backup script
├── nginx/
│   └── laila.conf       # Nginx reverse proxy configuration
└── systemd/
    └── laila.service    # Systemd service unit
```
