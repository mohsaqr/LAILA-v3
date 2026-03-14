#!/usr/bin/env bash
# =============================================================================
# LAILA — Production Deployment Script (macOS + Linux)
# =============================================================================
# Run from anywhere inside the LAILA-v3 project tree.
# All paths are derived from the project root — nothing is hardcoded.
#
# Usage:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh
#
# What it does:
#   1. Detects OS (macOS / Linux) and adapts accordingly
#   2. Checks prerequisites (Node 18+, PostgreSQL, Nginx, pm2)
#   3. Prompts for domain, DB credentials, and API keys
#   4. Creates server/.env from the production template
#   5. Switches Prisma to PostgreSQL and runs migrations
#   6. Builds server (TypeScript) and client (Vite)
#   7. Installs and configures Nginx
#   8. Obtains Let's Encrypt SSL certificate (non-localhost)
#   9. Starts the LAILA service with pm2
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

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
OS="$(uname)"
IS_MAC=false
IS_LINUX=false

if [ "$OS" = "Darwin" ]; then
    IS_MAC=true
    ARCH="$(uname -m)"
    if [ "$ARCH" = "arm64" ]; then
        HOMEBREW_PREFIX="/opt/homebrew"
    else
        HOMEBREW_PREFIX="/usr/local"
    fi
elif [ "$OS" = "Linux" ]; then
    IS_LINUX=true
else
    echo "Unsupported OS: $OS"
    exit 1
fi

echo "============================================="
echo "  LAILA Production Deployment"
if $IS_MAC; then
    echo "  Platform: macOS ($ARCH)"
else
    echo "  Platform: Linux"
fi
echo "============================================="
echo ""
echo "  Project root: $PROJECT_DIR"
echo ""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf "\n\033[1;34m[INFO]\033[0m  %s\n" "$*"; }
ok()    { printf "\033[1;32m[OK]\033[0m    %s\n" "$*"; }
warn()  { printf "\033[1;33m[WARN]\033[0m  %s\n" "$*"; }
err()   { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*" >&2; }
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

# Cross-platform sed in-place
sed_i() {
    if $IS_MAC; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# Cross-platform nginx reload
nginx_reload() {
    if $IS_MAC; then
        brew services restart nginx
    else
        sudo systemctl reload nginx
    fi
}

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

# macOS: check Homebrew
if $IS_MAC; then
    if ! command -v brew &>/dev/null; then
        die "Homebrew is not installed. Install from https://brew.sh and try again."
    fi
    ok "Homebrew $(brew --version | head -1 | awk '{print $2}')"
fi

# Node.js 18+
if ! command -v node &>/dev/null; then
    if $IS_MAC; then
        die "Node.js is not installed. Install with: brew install node"
    else
        die "Node.js is not installed. Install Node.js 18+ and try again."
    fi
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    die "Node.js 18+ is required (found $(node -v)). Please upgrade."
fi
ok "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
    die "npm is not installed."
fi
ok "npm $(npm -v)"

# pm2
if ! command -v pm2 &>/dev/null; then
    info "Installing pm2 globally..."
    npm install -g pm2
fi
ok "pm2 $(pm2 -v)"

# PostgreSQL client
if ! command -v psql &>/dev/null; then
    if $IS_MAC; then
        die "PostgreSQL not found. Install with: brew install postgresql@16"
    else
        die "PostgreSQL client (psql) not found. Install PostgreSQL and try again."
    fi
fi
ok "PostgreSQL client (psql)"

# Ensure PostgreSQL is running
if $IS_MAC; then
    PG_SERVICE=$(brew services list 2>/dev/null | grep -i postgres | awk '{print $1}')
    if [ -n "$PG_SERVICE" ]; then
        PG_STATUS=$(brew services list 2>/dev/null | grep -i postgres | awk '{print $2}')
        if [ "$PG_STATUS" != "started" ]; then
            info "Starting PostgreSQL..."
            brew services start "$PG_SERVICE"
            sleep 2
        fi
        ok "PostgreSQL server is running ($PG_SERVICE)"
    else
        warn "No Homebrew PostgreSQL service found — make sure PostgreSQL is running."
    fi
else
    if command -v systemctl &>/dev/null; then
        if ! systemctl is-active --quiet postgresql 2>/dev/null; then
            info "Starting PostgreSQL..."
            sudo systemctl start postgresql
        fi
        ok "PostgreSQL server is running"
    fi
fi

# Nginx
if ! command -v nginx &>/dev/null; then
    if $IS_MAC; then
        die "Nginx is not installed. Install with: brew install nginx"
    else
        die "Nginx is not installed. Install nginx and try again."
    fi
fi
ok "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"

# Certbot (optional)
HAS_CERTBOT=false
if command -v certbot &>/dev/null; then
    ok "Certbot $(certbot --version 2>&1 | awk '{print $2}')"
    HAS_CERTBOT=true
else
    warn "Certbot not found — SSL setup will be skipped."
fi

# ---------------------------------------------------------------------------
# 2. Gather configuration
# ---------------------------------------------------------------------------
info "Gathering configuration..."

prompt_value DOMAIN      "Domain name (e.g. laila.example.com or localhost)" "localhost"
prompt_value DB_NAME     "PostgreSQL database name" "laila"
if $IS_MAC; then
    prompt_value DB_USER "PostgreSQL username" "$(whoami)"
    prompt_secret DB_PASS "PostgreSQL password (leave empty for local trust auth)"
else
    prompt_value DB_USER "PostgreSQL username" "laila"
    prompt_secret DB_PASS "PostgreSQL password"
fi
prompt_value DB_HOST     "PostgreSQL host" "localhost"
prompt_value DB_PORT     "PostgreSQL port" "5432"

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
sed_i "s|__DOMAIN__|$DOMAIN|g"         "$SERVER_DIR/.env"
sed_i "s|__DB_USER__|$DB_USER|g"       "$SERVER_DIR/.env"
sed_i "s|__DB_PASS__|$DB_PASS|g"       "$SERVER_DIR/.env"
sed_i "s|__DB_NAME__|$DB_NAME|g"       "$SERVER_DIR/.env"
sed_i "s|localhost:5432|$DB_HOST:$DB_PORT|g" "$SERVER_DIR/.env"

# Fill in secrets
sed_i "s|^JWT_SECRET=$|JWT_SECRET=$JWT_SECRET|"         "$SERVER_DIR/.env"
sed_i "s|^SESSION_SECRET=$|SESSION_SECRET=$SESSION_SECRET|" "$SERVER_DIR/.env"

# Fill in AI keys (if provided)
[ -n "$OPENAI_KEY" ] && sed_i "s|^OPENAI_API_KEY=$|OPENAI_API_KEY=$OPENAI_KEY|" "$SERVER_DIR/.env"
[ -n "$GEMINI_KEY" ] && sed_i "s|^GEMINI_API_KEY=$|GEMINI_API_KEY=$GEMINI_KEY|" "$SERVER_DIR/.env"

ok "server/.env configured"

# ---------------------------------------------------------------------------
# 4. Create PostgreSQL database (if it doesn't exist)
# ---------------------------------------------------------------------------
info "Ensuring PostgreSQL database exists..."

# Build psql connection args
PSQL_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER")
if [ -n "$DB_PASS" ]; then
    export PGPASSWORD="$DB_PASS"
fi

if psql "${PSQL_ARGS[@]}" -lqt 2>/dev/null | cut -d\| -f1 | grep -qw "$DB_NAME"; then
    ok "Database '$DB_NAME' already exists"
else
    info "Creating database '$DB_NAME'..."
    if createdb "${PSQL_ARGS[@]}" "$DB_NAME" 2>/dev/null; then
        ok "Database '$DB_NAME' created"
    else
        warn "Could not create database automatically."
        warn "Please create it manually: createdb $DB_NAME"
    fi
fi

# ---------------------------------------------------------------------------
# 5. Switch Prisma provider to PostgreSQL
# ---------------------------------------------------------------------------
info "Switching Prisma provider to PostgreSQL..."
SCHEMA_FILE="$SERVER_DIR/prisma/schema.prisma"
sed_i 's|provider = "sqlite"|provider = "postgresql"|g' "$SCHEMA_FILE"
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
ok "Server built -> server/dist/"

info "Installing client dependencies..."
cd "$CLIENT_DIR"
npm ci 2>&1 | tail -1
ok "Client dependencies installed"

info "Building client (Vite)..."
npm run build
ok "Client built -> client/dist/"

# ---------------------------------------------------------------------------
# 7. Seed database (first deploy)
# ---------------------------------------------------------------------------
cd "$SERVER_DIR"
info "Checking if database needs seeding..."

PSQL_DB_ARGS=("${PSQL_ARGS[@]}" -d "$DB_NAME")
USER_COUNT=$(psql "${PSQL_DB_ARGS[@]}" -tAc "SELECT COUNT(*) FROM \"User\"" 2>/dev/null || echo "0")

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

# Determine Nginx config path based on OS
if $IS_MAC; then
    NGINX_SERVERS_DIR="$HOMEBREW_PREFIX/etc/nginx/servers"
    mkdir -p "$NGINX_SERVERS_DIR"
    NGINX_CONF="$NGINX_SERVERS_DIR/laila.conf"
else
    NGINX_CONF="/etc/nginx/sites-available/laila"
    NGINX_ENABLED="/etc/nginx/sites-enabled/laila"
fi

# For localhost, generate a simple config without SSL
if [ "$DOMAIN" = "localhost" ] || [ "$DOMAIN" = "127.0.0.1" ]; then
    NGINX_CONTENT="# LAILA — Nginx config (local, no SSL)
server {
    listen 80;
    server_name $DOMAIN;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml;

    # Upload size
    client_max_body_size 10M;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host              \\\$host;
        proxy_set_header X-Real-IP         \\\$remote_addr;
        proxy_set_header X-Forwarded-For   \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout    120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout    120s;
    }

    # Socket.IO WebSocket proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           \\\$http_upgrade;
        proxy_set_header Connection        \"upgrade\";
        proxy_set_header Host              \\\$host;
        proxy_set_header X-Real-IP         \\\$remote_addr;
        proxy_set_header X-Forwarded-For   \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout    86400s;
        proxy_send_timeout    86400s;
    }

    # Uploaded files proxy
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host              \\\$host;
        proxy_set_header X-Real-IP         \\\$remote_addr;
        proxy_set_header X-Forwarded-For   \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }

    # Static assets (client build)
    location /assets/ {
        alias $INSTALL_DIR/client/dist/assets/;
        expires 1y;
        add_header Cache-Control \"public, immutable\";
        access_log off;
    }

    # SPA catch-all
    location / {
        root $INSTALL_DIR/client/dist;
        try_files \\\$uri \\\$uri/ /index.html;

        location = /index.html {
            expires 5m;
            add_header Cache-Control \"public, must-revalidate\";
        }
    }
}"

    if $IS_MAC; then
        echo "$NGINX_CONTENT" > "$NGINX_CONF"
    else
        echo "$NGINX_CONTENT" | sudo tee "$NGINX_CONF" > /dev/null
    fi
else
    # For real domain, use the template config with SSL
    if $IS_MAC; then
        cp "$DEPLOY_DIR/nginx/laila.conf" "$NGINX_CONF"
        sed_i "s|__DOMAIN__|$DOMAIN|g"           "$NGINX_CONF"
        sed_i "s|__INSTALL_DIR__|$INSTALL_DIR|g"  "$NGINX_CONF"
    else
        sudo cp "$DEPLOY_DIR/nginx/laila.conf" "$NGINX_CONF"
        sudo sed -i "s|__DOMAIN__|$DOMAIN|g"           "$NGINX_CONF"
        sudo sed -i "s|__INSTALL_DIR__|$INSTALL_DIR|g"  "$NGINX_CONF"
    fi
fi

# Enable site (Linux only — uses sites-enabled symlink)
if $IS_LINUX; then
    sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
    # Remove default site if it exists
    if [ -f /etc/nginx/sites-enabled/default ]; then
        sudo rm /etc/nginx/sites-enabled/default
        info "Removed default Nginx site"
    fi
fi

# Test and reload
if $IS_MAC; then
    nginx -t
else
    sudo nginx -t
fi
nginx_reload
ok "Nginx configured and restarted"

# ---------------------------------------------------------------------------
# 10. SSL with Let's Encrypt (non-localhost only)
# ---------------------------------------------------------------------------
if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
    if [ "$HAS_CERTBOT" = true ]; then
        info "Obtaining SSL certificate..."
        if $IS_LINUX; then
            sudo mkdir -p /var/www/certbot
        fi
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
fi

# ---------------------------------------------------------------------------
# 11. Start LAILA with pm2
# ---------------------------------------------------------------------------
info "Configuring pm2..."

cd "$SERVER_DIR"

# Stop existing instance if running
pm2 delete laila 2>/dev/null || true

# Start with pm2
pm2 start dist/index.js \
    --name laila \
    --cwd "$SERVER_DIR" \
    --env production \
    --log "$SERVER_DIR/logs/laila.log" \
    --time

# Save pm2 process list so it restarts on reboot
pm2 save

# Configure pm2 to start on system boot (Linux only — needs systemd)
if $IS_LINUX; then
    RUN_USER="${RUN_USER:-$(whoami)}"
    pm2 startup -u "$RUN_USER" --hp "$(eval echo ~"$RUN_USER")" 2>/dev/null || {
        warn "Could not configure pm2 startup automatically."
        warn "Run the command printed above with sudo to enable auto-start."
    }
fi

ok "LAILA started with pm2"

# ---------------------------------------------------------------------------
# 12. Verify
# ---------------------------------------------------------------------------
info "Verifying deployment..."
sleep 3

# Check pm2 status
if pm2 list | grep -q "laila.*online"; then
    ok "LAILA is running (pm2)"
else
    warn "LAILA may not have started. Check: pm2 status"
fi

# Quick health check
if curl -sf "http://127.0.0.1:5001/api/health" > /dev/null 2>&1; then
    ok "Health check passed (http://127.0.0.1:5001/api/health)"
else
    warn "Health check did not respond yet — service may still be starting."
    warn "Check: curl http://127.0.0.1:5001/api/health"
    warn "Logs:  pm2 logs laila"
fi

# Clean up PGPASSWORD
unset PGPASSWORD 2>/dev/null || true

echo ""
echo "============================================="
echo "  Deployment Complete!"
echo "============================================="
echo ""
if [ "$DOMAIN" = "localhost" ] || [ "$DOMAIN" = "127.0.0.1" ]; then
    echo "  URL:      http://$DOMAIN"
else
    echo "  URL:      https://$DOMAIN"
fi
echo "  Service:  pm2 status"
echo "  Logs:     pm2 logs laila"
echo ""
echo "  Useful commands:"
echo "    pm2 restart laila              # Restart"
echo "    pm2 stop laila                 # Stop"
echo "    pm2 logs laila --lines 100     # View logs"
echo "    pm2 monit                      # Monitor dashboard"
if $IS_MAC; then
    echo "    brew services restart nginx    # Restart Nginx"
else
    echo "    sudo nginx -t && sudo systemctl reload nginx"
fi
echo "    nginx -t                       # Test Nginx config"
echo ""
