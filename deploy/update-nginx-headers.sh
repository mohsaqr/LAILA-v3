#!/usr/bin/env bash
# =============================================================================
# LAILA — install the SPA security-header snippet on an already-deployed host
# =============================================================================
# Usage:
#   sudo bash deploy/update-nginx-headers.sh            # install + reload
#   bash deploy/update-nginx-headers.sh --dry-run       # show, change nothing
#
# WHY THIS EXISTS
# deploy.sh writes the nginx config only during install. A routine update
# (git pull, rebuild, restart) never touches /etc/nginx, so an existing host
# keeps whatever config it was installed with — which for at least one
# deployment meant no Content-Security-Policy on the SPA document at all.
# Re-running deploy.sh is not an alternative: it unconditionally overwrites
# server/.env with the template, taking the live DB password, JWT secret and
# API keys with it.
#
# So this does exactly one thing: install
# deploy/nginx/security-headers.conf as an nginx snippet, verify the config
# still parses, and reload. It never touches .env, the database, systemd, the
# site config, or certbot's certificates. If the site config does not yet
# include the snippet it tells you where to add the line rather than editing
# the file for you — that config may be certbot-managed, and rewriting it
# unattended is how a host loses HTTPS.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE="$PROJECT_DIR/deploy/nginx/security-headers.conf"

SNIPPET_DIR="/etc/nginx/snippets"
SNIPPET="$SNIPPET_DIR/laila-security-headers.conf"
INCLUDE_LINE="include $SNIPPET;"

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

info() { printf "\n\033[1;34m[INFO]\033[0m  %s\n" "$*"; }
ok()   { printf "\033[1;32m[OK]\033[0m    %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m  %s\n" "$*"; }
die()  { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*" >&2; exit 1; }

# Only escalate when we are not already root, so the script works both under
# sudo and as root in a container.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || die "Not root and sudo is unavailable."
    SUDO="sudo"
fi

[ -f "$SOURCE" ] || die "Missing $SOURCE — run 'cd server && npm run csp:generate' first."
command -v nginx >/dev/null 2>&1 || die "nginx is not installed on this host."

# Refuse to install a snippet whose generated block is empty or absent: that
# would silently install a no-op and look like success.
grep -q '^add_header Content-Security-Policy' "$SOURCE" \
    || die "$SOURCE has no generated headers. Run 'cd server && npm run csp:generate'."

info "Source: $SOURCE"
grep -c '^add_header' "$SOURCE" | xargs printf "        %s headers to install\n"

if $DRY_RUN; then
    warn "--dry-run: nothing will be written."
    echo ""
    sed -n '/^add_header/p' "$SOURCE"
    echo ""
    info "Would install to: $SNIPPET"
    exit 0
fi

# --- Install ---------------------------------------------------------------
$SUDO mkdir -p "$SNIPPET_DIR"

if [ -f "$SNIPPET" ] && cmp -s "$SOURCE" "$SNIPPET"; then
    ok "Snippet already up to date: $SNIPPET"
else
    if [ -f "$SNIPPET" ]; then
        BACKUP="$SNIPPET.bak-$(date +%Y%m%d-%H%M%S)"
        $SUDO cp "$SNIPPET" "$BACKUP"
        info "Backed up previous snippet to $BACKUP"
    fi
    $SUDO cp "$SOURCE" "$SNIPPET"
    ok "Installed $SNIPPET"
fi

# --- Verify before reloading ----------------------------------------------
# A snippet that is never included is inert, so this passing does not by
# itself mean the headers are live — the include check below is what matters.
info "Testing nginx configuration..."
if ! $SUDO nginx -t; then
    die "nginx -t failed. The snippet is installed but nginx was NOT reloaded; fix the config first."
fi
ok "nginx configuration is valid"

# --- Is it actually included? ---------------------------------------------
SITE_CONFIGS=$(grep -rl "laila" /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null || true)
INCLUDED=false
for conf in $SITE_CONFIGS; do
    if grep -q "laila-security-headers.conf" "$conf" 2>/dev/null; then
        INCLUDED=true
        ok "Included by $conf"
    fi
done

if $INCLUDED; then
    info "Reloading nginx..."
    if command -v systemctl >/dev/null 2>&1; then
        $SUDO systemctl reload nginx
    else
        $SUDO nginx -s reload
    fi
    ok "nginx reloaded — headers are live"
    echo ""
    info "Confirm from outside with:"
    echo "        node scripts/verify-deployment.mjs https://<your-domain>"
else
    echo ""
    warn "The snippet is installed but NOT included by any site config, so it"
    warn "is doing nothing yet. nginx was not reloaded."
    echo ""
    info "Add this line inside the SPA 'location / { … }' block:"
    echo ""
    echo "        $INCLUDE_LINE"
    echo ""
    info "Add it to any nested location that sets its own add_header too —"
    info "nginx drops all inherited headers from a location that declares one"
    info "of its own, and does not cascade into nested locations. In the"
    info "shipped config that means both 'location /' and 'location = /index.html'."
    echo ""
    if [ -n "$SITE_CONFIGS" ]; then
        info "Candidate config file(s):"
        for conf in $SITE_CONFIGS; do echo "        $conf"; done
    fi
    echo ""
    info "Then: sudo nginx -t && sudo systemctl reload nginx"
    exit 1
fi
