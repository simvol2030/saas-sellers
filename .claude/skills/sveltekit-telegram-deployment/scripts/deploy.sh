#!/bin/bash
# Production Deployment Script for SvelteKit Telegram Mini App
# Zero-downtime deployment with automatic rollback on failure
#
# Usage:
#   ./deploy.sh
#
# Prerequisites:
#   - PM2 installed and configured
#   - Git repository initialized
#   - ecosystem.config.js in project root
#   - Health check endpoint at /health

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
APP_DIR="/var/www/loyalty-app"
APP_NAME="loyalty-app"
HEALTH_CHECK_URL="http://localhost:3000/health"
HEALTH_CHECK_TIMEOUT=30  # seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✅ ${NC}$1"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${NC}$1"
}

log_error() {
    echo -e "${RED}❌ ${NC}$1"
}

# Start deployment
echo ""
log_info "🚀 Starting deployment of ${APP_NAME}..."
echo ""

cd $APP_DIR

# 1. Create backup
log_info "📦 Creating backup..."
BACKUP_DIR="/var/backups/${APP_NAME}/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

if [ -d "build" ]; then
    cp -r build $BACKUP_DIR/
    log_success "Build directory backed up"
fi

if [ -f "package.json" ]; then
    cp package.json package-lock.json $BACKUP_DIR/ 2>/dev/null || true
    log_success "Package files backed up"
fi

# 2. Pull latest code
log_info "📥 Pulling latest code from main branch..."
git fetch origin
git reset --hard origin/main
log_success "Code updated to latest version"

# 3. Check if dependencies changed
log_info "📚 Checking dependencies..."
if ! cmp -s package-lock.json $BACKUP_DIR/package-lock.json 2>/dev/null; then
    log_warning "Dependencies changed, running npm ci..."
    npm ci --production
    log_success "Dependencies installed"
else
    log_info "Dependencies unchanged, skipping installation"
fi

# 4. Build application
log_info "🔨 Building application..."
npm run build

if [ ! -d "build" ]; then
    log_error "Build directory not found!"
    exit 1
fi

log_success "Build complete"

# 5. Run database migrations (uncomment if needed)
# log_info "🗄️  Running database migrations..."
# npm run migrate
# log_success "Migrations complete"

# 6. Reload PM2 (zero-downtime)
log_info "🔄 Reloading PM2 (zero-downtime)..."
pm2 reload ecosystem.config.js --env production --update-env

log_success "PM2 reloaded"

# 7. Wait for application to start
log_info "⏳ Waiting for application to start..."
sleep 3

# 8. Health check
log_info "🏥 Running health check..."

HEALTH_CHECK_PASSED=false
for i in $(seq 1 $HEALTH_CHECK_TIMEOUT); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL || echo "000")

    if [ "$HTTP_CODE" -eq "200" ]; then
        HEALTH_CHECK_PASSED=true
        log_success "Health check passed (HTTP $HTTP_CODE)"
        break
    fi

    if [ $i -eq $HEALTH_CHECK_TIMEOUT ]; then
        log_error "Health check timeout after ${HEALTH_CHECK_TIMEOUT}s (HTTP $HTTP_CODE)"
        break
    fi

    sleep 1
done

# 9. Rollback if health check failed
if [ "$HEALTH_CHECK_PASSED" = false ]; then
    log_error "Deployment failed! Rolling back..."

    # Restore build directory
    if [ -d "$BACKUP_DIR/build" ]; then
        rm -rf $APP_DIR/build
        cp -r $BACKUP_DIR/build $APP_DIR/
        log_info "Build directory restored from backup"
    fi

    # Restore dependencies if changed
    if [ -f "$BACKUP_DIR/package-lock.json" ]; then
        if ! cmp -s package-lock.json $BACKUP_DIR/package-lock.json 2>/dev/null; then
            cp $BACKUP_DIR/package.json $BACKUP_DIR/package-lock.json $APP_DIR/
            npm ci --production
            log_info "Dependencies restored from backup"
        fi
    fi

    # Reload PM2 with old code
    pm2 reload $APP_NAME
    log_success "Rollback complete"

    echo ""
    log_error "⏪ Deployment failed and was rolled back"
    exit 1
fi

# 10. Cleanup old backups (keep last 5)
log_info "🧹 Cleaning up old backups..."
BACKUPS_DIR="/var/backups/${APP_NAME}"
if [ -d "$BACKUPS_DIR" ]; then
    cd $BACKUPS_DIR
    ls -t | tail -n +6 | xargs rm -rf 2>/dev/null || true
    log_success "Old backups cleaned (keeping last 5)"
fi

# 11. Display PM2 status
echo ""
log_info "📊 PM2 Status:"
pm2 list | grep $APP_NAME

# 12. Display application info
echo ""
log_info "📱 Application Info:"
echo "   Health: $HEALTH_CHECK_URL"
echo "   Logs:   pm2 logs $APP_NAME"
echo "   Monit:  pm2 monit"

echo ""
log_success "🎉 Deployment successful!"
echo ""
