# LAILA LMS - Deployment Guide

This guide covers deploying LAILA LMS to various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Production Build](#local-production-build)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Database Migration](#database-migration)
- [SSL/HTTPS Setup](#sslhttps-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+
- npm or yarn
- SQLite (included) or PostgreSQL for production
- (Optional) Docker and Docker Compose
- (Optional) Nginx for reverse proxy

## Environment Variables

### Server Environment (`server/.env`)

```env
# Database
DATABASE_URL="file:./prod.db"          # SQLite (development)
# DATABASE_URL="postgresql://..."       # PostgreSQL (production)

# Authentication
JWT_SECRET="your-very-secure-secret-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# AI Providers (at least one required)
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="..."
OPENROUTER_API_KEY="..."

# Server
NODE_ENV="production"
PORT=5000

# Optional
CORS_ORIGIN="https://your-domain.com"
```

### Client Environment (`client/.env`)

```env
VITE_API_URL="https://api.your-domain.com"
```

## Local Production Build

### 1. Build the Application

```bash
# Install dependencies
npm run install:all

# Build both client and server
npm run build
```

This creates:
- `client/dist/` - Static frontend files
- `server/dist/` - Compiled backend

### 2. Run Production Server

```bash
# Set environment
export NODE_ENV=production

# Start server (serves both API and static files)
cd server && npm start
```

### 3. Access

- Application: http://localhost:5000
- API: http://localhost:5000/api

## Docker Deployment

### Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm run install:all

# Copy source code
COPY . .

# Build application
RUN npm run build

# Setup database
RUN cd server && npx prisma generate

WORKDIR /app/server

EXPOSE 5000

CMD ["npm", "start"]
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  laila:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./data/laila.db
      - JWT_SECRET=${JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - laila-data:/app/server/data
    restart: unless-stopped

volumes:
  laila-data:
```

### Deploy with Docker

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Cloud Deployment

### Railway / Render / Fly.io

These platforms support Node.js apps with minimal configuration:

1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Set build command: `npm run install:all && npm run build`
4. Set start command: `cd server && npm start`
5. Deploy

### Vercel (Frontend Only)

For frontend-only deployment on Vercel:

```bash
cd client
vercel --prod
```

Set `VITE_API_URL` to your backend URL.

### AWS / GCP / Azure

For VM-based deployment:

```bash
# On server
git clone <repo>
cd LAILA-v3

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install and build
npm run install:all
npm run build

# Use PM2 for process management
npm install -g pm2
cd server
pm2 start npm --name "laila" -- start
pm2 save
pm2 startup
```

## Database Migration

### Development to Production

```bash
cd server

# Generate migration
npx prisma migrate dev --name init

# Apply in production
npx prisma migrate deploy
```

### SQLite to PostgreSQL

1. Update `server/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Update `DATABASE_URL` to PostgreSQL connection string

3. Run migrations:
```bash
npx prisma migrate deploy
npx prisma db seed
```

## SSL/HTTPS Setup

### Using Nginx as Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Let's Encrypt SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

### Theme Not Working

The dark/light theme uses inline styles via the `useTheme` hook. If themes aren't switching:

1. Clear localStorage: `localStorage.removeItem('laila-theme-preference')`
2. Hard refresh: Ctrl+Shift+R
3. Check browser console for errors

### Database Issues

```bash
# Reset database
cd server
rm prisma/dev.db
npx prisma db push
npx prisma db seed
```

### Build Failures

```bash
# Clear caches
rm -rf node_modules client/node_modules server/node_modules
rm -rf client/dist server/dist
npm run install:all
npm run build
```

### API Connection Issues

1. Check `VITE_API_URL` is set correctly
2. Verify CORS settings in server
3. Check server logs: `pm2 logs laila`

## Health Check

Add to your monitoring:

```bash
curl -f http://localhost:5000/api/health || exit 1
```

## Backup

### Database Backup

```bash
# SQLite
cp server/prisma/prod.db backups/laila-$(date +%Y%m%d).db

# PostgreSQL
pg_dump $DATABASE_URL > backups/laila-$(date +%Y%m%d).sql
```

### Automated Backups (cron)

```bash
0 0 * * * /path/to/backup-script.sh
```
