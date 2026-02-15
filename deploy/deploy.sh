#!/usr/bin/env bash
# =============================================================================
# LAILA — Production Deployment Script
# =============================================================================
# Run from anywhere inside the LAILA-v3 project tree.
# All paths are derived from the project root — nothing is hardcoded.
#
# Usage:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh
#
# What it does:
#   1. Checks prerequisites (Node 18+, PostgreSQL, Nginx)
#   2. Prompts for domain, DB credentials, and API keys
#   3. Creates server/.env from the production template
#   4. Switches Prisma to PostgreSQL and runs migrations
#   5. Builds server (TypeScript) and client (Vite)
#   6. Installs and configures Nginx + systemd
#   7. Obtains Let's Encrypt SSL certificate
#   8. Starts the LAILA service
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths — everything relative to project root
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deploy"
SERVER_DIR="$PROJECT_DIR/server"
CLIENT_DIR="$PROJECT_DIR/client"

echo "============================================="
echo "  LAILA Production Deployment"
echo "============================================="
echo ""
echo "  Project root: $PROJECT_DIR"
echo ""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo -e "\n\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()   { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }
die()   { err "$@"; exit 1; }

prompt_value() {
    local varname="$1" prompt_text="$2" default="${3:-}"
    local value
    if [ -n "$default" ]; then
        read -rp "$prompt_text [$default]: " value
        value="${value:-$default}"
    else
        read -rp "$prompt_text: " value
    fi
    eval "$varname=\"\$value\""
}

prompt_secret() {
    local varname="$1" prompt_text="$2"
    local value
    read -rsp "$prompt_text: " value
    echo ""
    eval "$varname=\"\$value\""
}

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

# Node.js 18+
if ! command -v node &>/dev/null; then
    die "Node.js is not installed. Install Node.js 18+ and try again."
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    die "Node.js 18+ is required (found v$(node -v)). Please upgrade."
fi
ok "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
    die "npm is not installed."
fi
ok "npm $(npm -v)"

# PostgreSQL client
if ! command -v psql &>/dev/null; then
    die "PostgreSQL client (psql) not found. Install PostgreSQL and try again."
fi
ok "PostgreSQL client (psql)"

# Nginx
if ! command -v nginx &>/dev/null; then
    die "Nginx is not installed. Install nginx and try again."
fi
ok "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"

# Certbot (optional but recommended)
if command -v certbot &>/dev/null; then
    ok "Certbot $(certbot --version 2>&1 | awk '{print $2}')"
    HAS_CERTBOT=true
else
    warn "Certbot not found — SSL setup will be skipped."
    warn "Install certbot later and run: certbot --nginx -d <domain>"
    HAS_CERTBOT=false
fi

# ---------------------------------------------------------------------------
# 2. Gather configuration
# ---------------------------------------------------------------------------
info "Gathering configuration..."

prompt_value DOMAIN      "Domain name (e.g. laila.example.com)"
prompt_value DB_NAME     "PostgreSQL database name" "laila"
prompt_value DB_USER     "PostgreSQL username" "laila"
prompt_secret DB_PASS    "PostgreSQL password"
prompt_value DB_HOST     "PostgreSQL host" "localhost"
prompt_value DB_PORT     "PostgreSQL port" "5432"
prompt_value RUN_USER    "Linux user to run the service" "$(whoami)"

echo ""
info "AI provider API keys (leave blank to skip):"
prompt_value OPENAI_KEY  "  OpenAI API key" ""
prompt_value GEMINI_KEY  "  Gemini API key" ""

# Auto-generate secrets
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ok "Generated JWT_SECRET and SESSION_SECRET"

# ---------------------------------------------------------------------------
# 3. Create server/.env
# ---------------------------------------------------------------------------
info "Creating server/.env from production template..."
INSTALL_DIR="$PROJECT_DIR"

cp "$DEPLOY_DIR/.env.production" "$SERVER_DIR/.env"
sed -i "s|__DOMAIN__|$DOMAIN|g"         "$SERVER_DIR/.env"
sed -i "s|__DB_USER__|$DB_USER|g"       "$SERVER_DIR/.env"
sed -i "s|__DB_PASS__|$DB_PASS|g"       "$SERVER_DIR/.env"
sed -i "s|__DB_NAME__|$DB_NAME|g"       "$SERVER_DIR/.env"
sed -i "s|localhost:5432|$DB_HOST:$DB_PORT|g" "$SERVER_DIR/.env"

# Fill in secrets
sed -i "s|^JWT_SECRET=$|JWT_SECRET=$JWT_SECRET|"         "$SERVER_DIR/.env"
sed -i "s|^SESSION_SECRET=$|SESSION_SECRET=$SESSION_SECRET|" "$SERVER_DIR/.env"

# Fill in AI keys (if provided)
[ -n "$OPENAI_KEY" ] && sed -i "s|^OPENAI_API_KEY=$|OPENAI_API_KEY=$OPENAI_KEY|" "$SERVER_DIR/.env"
[ -n "$GEMINI_KEY" ] && sed -i "s|^GEMINI_API_KEY=$|GEMINI_API_KEY=$GEMINI_KEY|" "$SERVER_DIR/.env"

ok "server/.env configured"

# ---------------------------------------------------------------------------
# 4. Create PostgreSQL database (if it doesn't exist)
# ---------------------------------------------------------------------------
info "Ensuring PostgreSQL database exists..."
if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt 2>/dev/null | cut -d\| -f1 | grep -qw "$DB_NAME"; then
    ok "Database '$DB_NAME' already exists"
else
    info "Creating database '$DB_NAME'..."
    if PGPASSWORD="$DB_PASS" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null; then
        ok "Database '$DB_NAME' created"
    else
        warn "Could not create database automatically."
        warn "Please create it manually: CREATE DATABASE $DB_NAME;"
    fi
fi

# ---------------------------------------------------------------------------
# 5. Switch Prisma provider to PostgreSQL
# ---------------------------------------------------------------------------
info "Switching Prisma provider to PostgreSQL..."
SCHEMA_FILE="$SERVER_DIR/prisma/schema.prisma"
sed -i 's|provider = "sqlite"|provider = "postgresql"|g' "$SCHEMA_FILE"
ok "Prisma schema updated to PostgreSQL"

# ---------------------------------------------------------------------------
# 6. Install dependencies & build
# ---------------------------------------------------------------------------
info "Installing server dependencies..."
cd "$SERVER_DIR"
npm ci --omit=dev 2>&1 | tail -1
npm install prisma --save-dev 2>&1 | tail -1
ok "Server dependencies installed"

info "Generating Prisma client & running migrations..."
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
ok "Database schema applied"

info "Building server (TypeScript)..."
npx tsc
ok "Server built → server/dist/"

info "Installing client dependencies..."
cd "$CLIENT_DIR"
npm ci 2>&1 | tail -1
ok "Client dependencies installed"

info "Building client (Vite)..."
npm run build
ok "Client built → client/dist/"

# ---------------------------------------------------------------------------
# 7. Seed database (first deploy)
# ---------------------------------------------------------------------------
cd "$SERVER_DIR"
info "Checking if database needs seeding..."
USER_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -tAc "SELECT COUNT(*) FROM \"User\"" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "" ]; then
    info "Seeding database with initial data..."
    npx tsx prisma/seed.ts
    ok "Database seeded"
else
    ok "Database already has $USER_COUNT user(s), skipping seed"
fi

# ---------------------------------------------------------------------------
# 8. Create uploads & logs directories
# ---------------------------------------------------------------------------
mkdir -p "$SERVER_DIR/uploads" "$SERVER_DIR/logs"
ok "Created uploads/ and logs/ directories"

# ---------------------------------------------------------------------------
# 9. Configure Nginx
# ---------------------------------------------------------------------------
info "Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/laila"
NGINX_ENABLED="/etc/nginx/sites-enabled/laila"

sudo cp "$DEPLOY_DIR/nginx/laila.conf" "$NGINX_CONF"
sudo sed -i "s|__DOMAIN__|$DOMAIN|g"           "$NGINX_CONF"
sudo sed -i "s|__INSTALL_DIR__|$INSTALL_DIR|g"  "$NGINX_CONF"

# Enable the site
sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

# Remove default site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
    info "Removed default Nginx site"
fi

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
ok "Nginx configured and reloaded"

# ---------------------------------------------------------------------------
# 10. SSL with Let's Encrypt
# ---------------------------------------------------------------------------
if [ "$HAS_CERTBOT" = true ]; then
    info "Obtaining SSL certificate..."
    # Create webroot directory for challenge
    sudo mkdir -p /var/www/certbot

    # Check if certificate already exists
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        ok "SSL certificate already exists for $DOMAIN"
    else
        sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
            --register-unsafely-without-email || {
            warn "Certbot failed. You can run it manually later:"
            warn "  sudo certbot --nginx -d $DOMAIN"
        }
    fi
else
    warn "Skipping SSL — install certbot and run:"
    warn "  sudo certbot --nginx -d $DOMAIN"
fi

# ---------------------------------------------------------------------------
# 11. Configure systemd service
# ---------------------------------------------------------------------------
info "Configuring systemd service..."
SYSTEMD_FILE="/etc/systemd/system/laila.service"

sudo cp "$DEPLOY_DIR/systemd/laila.service" "$SYSTEMD_FILE"
sudo sed -i "s|__INSTALL_DIR__|$INSTALL_DIR|g"  "$SYSTEMD_FILE"
sudo sed -i "s|__USER__|$RUN_USER|g"            "$SYSTEMD_FILE"

sudo systemctl daemon-reload
sudo systemctl enable laila
sudo systemctl restart laila
ok "LAILA service started and enabled"

# ---------------------------------------------------------------------------
# 12. Verify
# ---------------------------------------------------------------------------
info "Verifying deployment..."
sleep 2

if systemctl is-active --quiet laila; then
    ok "LAILA service is running"
else
    warn "LAILA service may not have started. Check: sudo journalctl -u laila -f"
fi

# Quick health check
if curl -sf "http://127.0.0.1:5001/api/health" > /dev/null 2>&1; then
    ok "Health check passed (http://127.0.0.1:5001/api/health)"
else
    warn "Health check did not respond yet — service may still be starting."
    warn "Check: curl http://127.0.0.1:5001/api/health"
fi

echo ""
echo "============================================="
echo "  Deployment Complete!"
echo "============================================="
echo ""
echo "  Domain:   https://$DOMAIN"
echo "  Service:  sudo systemctl status laila"
echo "  Logs:     sudo journalctl -u laila -f"
echo "  Backup:   $DEPLOY_DIR/backup.sh"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl restart laila   # Restart"
echo "    sudo systemctl stop laila      # Stop"
echo "    sudo nginx -t && sudo systemctl reload nginx"
echo ""
