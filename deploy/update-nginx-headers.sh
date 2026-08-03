#!/usr/bin/env bash
# =============================================================================
# LAILA — install the SPA security headers on an already-deployed host
# =============================================================================
# Usage:
#   sudo bash deploy/update-nginx-headers.sh              # do it
#   bash deploy/update-nginx-headers.sh --dry-run         # show, change nothing
#   bash deploy/update-nginx-headers.sh --check           # exit 1 if not applied
#   sudo bash deploy/update-nginx-headers.sh --config /etc/nginx/sites-available/laila
#
# WHY THIS EXISTS
# deploy.sh writes the nginx config only at install time. A routine update
# (git pull, rebuild, restart) never touches /etc/nginx, so an existing host
# keeps whatever it was installed with — which for at least one deployment
# meant no security headers on the SPA document at all. Re-running deploy.sh is
# not an alternative: it unconditionally overwrites server/.env with the
# template, taking the live DB password, JWT secret and API keys with it.
#
# WHAT IT DOES
#   1. installs deploy/nginx/security-headers.conf as an nginx snippet
#   2. adds `include <snippet>;` to every location serving the SPA document
#   3. runs `nginx -t`, and RESTORES THE BACKUP if that fails
#   4. reloads nginx
#
# It never touches server/.env, the database, systemd units, or certbot's
# certificates, and it is idempotent — safe to re-run, and safe from a cron.
#
# The one thing it cannot do is find its way onto the server. Someone with
# access has to run it once.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE="$PROJECT_DIR/deploy/nginx/security-headers.conf"
PATCHER="$PROJECT_DIR/deploy/patch-nginx-include.mjs"

SNIPPET_DIR="/etc/nginx/snippets"
SNIPPET="$SNIPPET_DIR/laila-security-headers.conf"

DRY_RUN=false
CHECK_ONLY=false
CONFIG=""

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) DRY_RUN=true ;;
        --check)   CHECK_ONLY=true ;;
        --config)  CONFIG="${2:-}"; shift ;;
        *) echo "Unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done

info() { printf "\n\033[1;34m[INFO]\033[0m  %s\n" "$*"; }
ok()   { printf "\033[1;32m[OK]\033[0m    %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m  %s\n" "$*"; }
die()  { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*" >&2; exit 1; }

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || die "Not root and sudo is unavailable."
    SUDO="sudo"
fi

[ -f "$SOURCE" ]  || die "Missing $SOURCE — run 'cd server && npm run csp:generate' first."
[ -f "$PATCHER" ] || die "Missing $PATCHER."
command -v nginx >/dev/null 2>&1 || die "nginx is not installed on this host."
command -v node  >/dev/null 2>&1 || die "node is not installed on this host."

# Refuse to install a snippet whose generated block is empty: that would
# quietly install a no-op and still look like success.
grep -q '^add_header Content-Security-Policy' "$SOURCE" \
    || die "$SOURCE has no generated headers. Run 'cd server && npm run csp:generate'."

# --- Locate the site config ------------------------------------------------
if [ -z "$CONFIG" ]; then
    for candidate in /etc/nginx/sites-available/laila /etc/nginx/conf.d/laila.conf; do
        [ -f "$candidate" ] && { CONFIG="$candidate"; break; }
    done
fi
if [ -z "$CONFIG" ]; then
    CONFIG=$(grep -rl "client/dist" /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null | head -1 || true)
fi
[ -n "$CONFIG" ] && [ -f "$CONFIG" ] \
    || die "Could not find the LAILA nginx config. Pass it with --config <path>."

info "Snippet: $SOURCE"
info "Config:  $CONFIG"

# --- --check ---------------------------------------------------------------
if $CHECK_ONLY; then
    STATUS=0
    if [ ! -f "$SNIPPET" ] || ! cmp -s "$SOURCE" "$SNIPPET"; then
        warn "Snippet is missing or out of date at $SNIPPET"
        STATUS=1
    fi
    node "$PATCHER" "$CONFIG" --snippet "$SNIPPET" --check >/dev/null || STATUS=1
    node "$PATCHER" "$CONFIG" --snippet "$SNIPPET" --check >/dev/null 2>&1 || true
    if [ "$STATUS" -eq 0 ]; then ok "Headers are applied and up to date."; else
        warn "Not applied. Run: sudo bash deploy/update-nginx-headers.sh"
    fi
    exit "$STATUS"
fi

# --- --dry-run -------------------------------------------------------------
if $DRY_RUN; then
    warn "--dry-run: nothing will be written."
    echo ""
    sed -n '/^add_header/p' "$SOURCE"
    echo ""
    info "Would install to: $SNIPPET"
    info "Would patch:      $CONFIG"
    node "$PATCHER" "$CONFIG" --snippet "$SNIPPET" >/dev/null || true
    exit 0
fi

# --- 1. Install the snippet ------------------------------------------------
$SUDO mkdir -p "$SNIPPET_DIR"
if [ -f "$SNIPPET" ] && cmp -s "$SOURCE" "$SNIPPET"; then
    ok "Snippet already up to date"
else
    $SUDO cp "$SOURCE" "$SNIPPET"
    ok "Installed $SNIPPET"
fi

# --- 2. Patch the site config ----------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$CONFIG.laila-bak-$STAMP"
PATCHED="$(mktemp)"
trap 'rm -f "$PATCHED"' EXIT

if node "$PATCHER" "$CONFIG" --snippet "$SNIPPET" > "$PATCHED"; then
    if [ -s "$PATCHED" ]; then
        $SUDO cp "$CONFIG" "$BACKUP"
        info "Backed up config to $BACKUP"
        $SUDO cp "$PATCHED" "$CONFIG"
        ok "Patched $CONFIG"
        PATCHED_CONFIG=true
    else
        # Patcher exited 0 with no output: nothing needed changing.
        ok "Config already includes the snippet"
        PATCHED_CONFIG=false
    fi
else
    die "Failed to patch $CONFIG — nothing was changed."
fi

# --- 3. Test, and roll back if the result is invalid -----------------------
info "Testing nginx configuration..."
if ! $SUDO nginx -t; then
    if [ "$PATCHED_CONFIG" = true ]; then
        $SUDO cp "$BACKUP" "$CONFIG"
        warn "nginx -t failed — restored $CONFIG from $BACKUP. Nothing was reloaded."
    fi
    die "nginx configuration is invalid. The site is untouched and still running."
fi
ok "nginx configuration is valid"

# --- 4. Reload -------------------------------------------------------------
info "Reloading nginx..."
if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl reload nginx
else
    $SUDO nginx -s reload
fi
ok "nginx reloaded — the headers are live"

echo ""
info "Confirm with:"
echo "        curl -sI https://<your-domain>/ | grep -i 'content-security-policy\\|x-frame\\|x-content-type\\|referrer\\|strict-transport'"
echo "        node scripts/verify-deployment.mjs https://<your-domain>"
