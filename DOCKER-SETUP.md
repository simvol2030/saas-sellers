# Docker Setup Guide

## Overview

This project provides production-ready Docker containerization for all three backend frameworks (Express, Hono, Fastify) with:

- Multi-stage builds (development & production)
- Hot-reload support for development
- Shared Prisma schema and database
- Health checks and auto-restart
- **Solves Fastify WSL2 incompatibility** by running in Linux containers

## Quick Start

### Start All Backends

```bash
# Start all 3 backends with hot-reload
docker-compose --profile backend up

# Or start in detached mode
docker-compose --profile backend up -d
```

**Access:**
- Express: http://localhost:3000/health
- Hono: http://localhost:3001/health
- Fastify: http://localhost:3002/health

### Start Specific Backend

```bash
# Express only
docker-compose up backend-expressjs

# Hono only
docker-compose up backend-hono

# Fastify only (SOLVES WSL2 /mnt/c issue!)
docker-compose up backend-fastify
```

### Stop All Services

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## Features

### 1. Multi-Stage Dockerfiles

Each backend has a multi-stage Dockerfile with:

**Stages:**
- `base` - Base Node.js 20 Alpine image
- `deps` - Production dependencies only
- `dev-deps` - All dependencies including dev
- `builder` - TypeScript build stage
- `production` - Optimized production image
- `development` - Development with hot-reload

**Benefits:**
- Small production images (~150MB)
- Fast development with hot-reload
- Separated build dependencies

### 2. Hot-Reload Development

Source code changes are reflected instantly without rebuilding:

```yaml
volumes:
  - ./backend-expressjs/src:/app/src  # Hot-reload
  - /app/node_modules                  # Preserved
```

**How it works:**
- Source files mounted as volumes
- `tsx watch` auto-reloads on changes
- node_modules stay in container (not overwritten)

### 3. Shared Database

All backends share the same SQLite database:

```yaml
volumes:
  - ./prisma:/app/../prisma  # Shared schema
  - ./data:/app/../data      # Shared database
```

**Benefits:**
- Single source of truth
- Easy data sharing between backends
- Consistent schema across all frameworks

### 4. Health Checks

Automatic health monitoring with auto-restart:

```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Monitor status:**
```bash
docker-compose ps
```

---

## Production Deployment

### Build Production Images

```bash
# Build specific backend
docker build --target production -t my-express-api ./backend-expressjs

# Or use docker-compose for production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### Production Environment Variables

Create `.env.production`:

```env
NODE_ENV=production
DATABASE_URL=file:../data/db/app.db
PORT=3000
LOG_LEVEL=warn
```

### Production Features

- **Non-root user** - Runs as `nodejs:1001`
- **Small image size** - ~150MB (vs ~1GB with dev deps)
- **Security** - No dev dependencies, minimal attack surface
- **Optimized** - Production-only node_modules

---

## Fastify WSL2 Solution

### Problem

Fastify v5.6.2 **hangs indefinitely** when run from `/mnt/c` (Windows FS in WSL2) due to synchronous file operations in the avvio plugin loader deadlocking in the WSL2 NTFS translation layer.

### Solution: Docker

Running Fastify in a Docker container solves this issue:

```bash
# ❌ HANGS: Direct execution in /mnt/c
cd /mnt/c/dev/box-app/project-box-combo/backend-fastify
npm run dev
# (infinite hang, no output)

# ✅ WORKS: Docker with Linux filesystem
docker-compose up backend-fastify
# Server starts successfully!
```

**Why it works:**
- Container uses native Linux filesystem
- Source code mounted as volumes, but node_modules stay in container
- Fastify's file operations execute in Linux environment, avoiding WSL2 FUSE bottleneck

### Alternative Solutions

If you don't want to use Docker:

1. **Linux FS** - Move project to `~/projects/` (see `backend-fastify/docs/DEVELOPMENT-SETUP.md`)
2. **Express/Hono** - Use alternative frameworks that work in `/mnt/c`

---

## Docker Commands Reference

### Build Commands

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend-fastify

# Build without cache
docker-compose build --no-cache

# Build production image manually
docker build --target production -t backend-express-prod ./backend-expressjs
```

### Run Commands

```bash
# Start all backends
docker-compose --profile backend up

# Start with rebuild
docker-compose --profile backend up --build

# Start in background
docker-compose --profile backend up -d

# Start with logs
docker-compose --profile backend up --force-recreate
```

### Logs Commands

```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Logs for specific service
docker-compose logs -f backend-fastify

# Last 100 lines
docker-compose logs --tail=100
```

### Container Management

```bash
# List running containers
docker-compose ps

# Stop all services
docker-compose stop

# Restart specific service
docker-compose restart backend-hono

# Remove stopped containers
docker-compose rm

# Stop and remove everything
docker-compose down

# Remove volumes too
docker-compose down -v
```

### Debugging

```bash
# Execute command in running container
docker-compose exec backend-expressjs sh

# Inside container, check logs
docker-compose exec backend-hono cat /app/logs/app.log

# Check health status
docker-compose exec backend-fastify wget -O- http://localhost:3002/health

# Inspect container
docker inspect backend-express-dev
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows
```

### Container Keeps Restarting

```bash
# Check logs
docker-compose logs backend-hono

# Check health status
docker-compose ps

# Common causes:
# - Missing environment variables
# - Database not accessible
# - Port conflict
# - Syntax error in code
```

### Database Connection Failed

```bash
# Ensure database file exists
ls -la data/db/app.db

# Check permissions
chmod 644 data/db/app.db

# Regenerate Prisma client
docker-compose exec backend-expressjs npm run prisma:generate
```

### Hot-Reload Not Working

```bash
# Rebuild container
docker-compose up --build backend-fastify

# Check volume mounts
docker-compose exec backend-fastify ls -la /app/src

# Ensure tsconfig.json is mounted
docker-compose exec backend-fastify cat /app/tsconfig.json
```

### Fastify Still Not Starting

If Fastify hangs even in Docker:

1. Check Docker is using Linux containers (not Windows containers)
2. Verify Dockerfile target: `target: development`
3. Check logs: `docker-compose logs backend-fastify`
4. Try rebuilding: `docker-compose build --no-cache backend-fastify`

---

## Performance Optimization

### Development

```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build

# Limit resources
docker-compose up --scale backend-expressjs=1 --memory="512m"
```

### Production

```bash
# Enable clustering via PM2 (inside container)
CMD ["pm2-runtime", "start", "ecosystem.config.js"]

# Use multi-stage build
docker build --target production

# Optimize layers (already done in Dockerfiles)
# - Copy package*.json first
# - Install deps before code
# - Use .dockerignore
```

---

## File Structure

```
project-box-combo/
├── docker-compose.yml          # Orchestration (all services)
├── DOCKER-SETUP.md            # This file
├── prisma/                    # Shared Prisma schema
│   └── schema.prisma
├── data/                      # Shared database
│   └── db/
│       └── app.db
├── backend-expressjs/
│   ├── Dockerfile             # Multi-stage build
│   ├── .dockerignore          # Build optimization
│   └── src/                   # Hot-reloaded
├── backend-hono/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── src/
└── backend-fastify/
    ├── Dockerfile             # SOLVES WSL2 issue
    ├── .dockerignore
    ├── docs/                  # Additional documentation
    │   ├── README.md
    │   ├── DEVELOPMENT-SETUP.md
    │   └── PRODUCTION-OPTIMIZATION.md
    └── src/
```

---

## Next Steps

1. **Try Docker Setup:**
   ```bash
   docker-compose --profile backend up
   ```

2. **Verify Health Checks:**
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3001/health
   curl http://localhost:3002/health
   ```

3. **Test Hot-Reload:**
   - Edit `backend-expressjs/src/index.ts`
   - Save file
   - Check logs: `docker-compose logs -f backend-expressjs`
   - Verify changes reflected instantly

4. **Read Fastify Docs:**
   - See `backend-fastify/docs/` for WSL2 solutions
   - Production optimization guide
   - PM2 clustering setup

---

**Created**: 2025-11-30
**Docker Compose Version**: 3.8
**Node.js Version**: 20 Alpine
**Works With**: Express v5.1.0, Hono latest, Fastify v5.6.2
