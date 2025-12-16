#!/bin/bash
# Monitoring Health Check Script
# Performs comprehensive checks on the loyalty system application

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"

echo ""
echo -e "${BLUE}🔍 Loyalty System - Monitoring Health Check${NC}"
echo ""

OVERALL_STATUS=0

# 1. Backend Health Check
echo -e "${BLUE}1️⃣  Checking backend health...${NC}"
if curl -f -s "${BACKEND_URL}/health" > /dev/null; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    OVERALL_STATUS=1
fi

# Check deep health (database + redis)
if curl -f -s "${BACKEND_URL}/health/ready" > /dev/null; then
    echo -e "${GREEN}✅ Backend is ready (DB + Redis connected)${NC}"
else
    echo -e "${RED}❌ Backend dependencies not ready${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 2. Frontend Health Check
echo -e "${BLUE}2️⃣  Checking frontend...${NC}"
if curl -f -s -I "${FRONTEND_URL}" | grep -q "200\|304"; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is not accessible (may not be running)${NC}"
fi
echo ""

# 3. Prometheus Metrics Endpoint
echo -e "${BLUE}3️⃣  Checking Prometheus metrics endpoint...${NC}"
if curl -f -s "${BACKEND_URL}/metrics" | grep -q "loyalty_transactions_total"; then
    echo -e "${GREEN}✅ Metrics endpoint is working${NC}"

    # Show some key metrics
    echo ""
    echo "Key metrics:"
    curl -s "${BACKEND_URL}/metrics" | grep -E "loyalty_transactions_total|http_request_duration|loyalty_active_users" | head -5
else
    echo -e "${RED}❌ Metrics endpoint not working${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 4. Prometheus Server
echo -e "${BLUE}4️⃣  Checking Prometheus server...${NC}"
if curl -f -s "${PROMETHEUS_URL}/-/healthy" > /dev/null; then
    echo -e "${GREEN}✅ Prometheus is running${NC}"

    # Check if backend is being scraped
    TARGETS=$(curl -s "${PROMETHEUS_URL}/api/v1/targets" | grep -o '"health":"up"' | wc -l)
    echo "Active targets: ${TARGETS}"
else
    echo -e "${YELLOW}⚠️  Prometheus is not accessible${NC}"
fi
echo ""

# 5. Grafana Dashboard
echo -e "${BLUE}5️⃣  Checking Grafana...${NC}"
if curl -f -s "${GRAFANA_URL}/api/health" > /dev/null; then
    echo -e "${GREEN}✅ Grafana is running${NC}"
else
    echo -e "${YELLOW}⚠️  Grafana is not accessible${NC}"
fi
echo ""

# 6. Check Error Rate
echo -e "${BLUE}6️⃣  Checking error rate...${NC}"
if command -v jq &> /dev/null && curl -f -s "${PROMETHEUS_URL}" > /dev/null; then
    # Query Prometheus for error rate
    ERROR_RATE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=rate(loyalty_transactions_total{status=\"error\"}[5m])" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")

    if (( $(echo "$ERROR_RATE > 0.1" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "${RED}❌ High error rate detected: ${ERROR_RATE}${NC}"
        OVERALL_STATUS=1
    elif (( $(echo "$ERROR_RATE > 0.05" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "${YELLOW}⚠️  Elevated error rate: ${ERROR_RATE}${NC}"
    else
        echo -e "${GREEN}✅ Error rate is normal: ${ERROR_RATE}${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot check error rate (jq or Prometheus not available)${NC}"
fi
echo ""

# 7. Check API Latency
echo -e "${BLUE}7️⃣  Checking API latency...${NC}"
START_TIME=$(date +%s%N)
curl -f -s "${BACKEND_URL}/health" > /dev/null
END_TIME=$(date +%s%N)
LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds

if [ $LATENCY -lt 100 ]; then
    echo -e "${GREEN}✅ API latency is good: ${LATENCY}ms${NC}"
elif [ $LATENCY -lt 500 ]; then
    echo -e "${YELLOW}⚠️  API latency is elevated: ${LATENCY}ms${NC}"
else
    echo -e "${RED}❌ API latency is high: ${LATENCY}ms${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 8. Check Sentry Configuration
echo -e "${BLUE}8️⃣  Checking Sentry configuration...${NC}"
if [ -n "${SENTRY_DSN}" ]; then
    echo -e "${GREEN}✅ SENTRY_DSN is configured${NC}"
else
    echo -e "${YELLOW}⚠️  SENTRY_DSN not set (errors won't be tracked)${NC}"
fi

if [ -n "${SENTRY_AUTH_TOKEN}" ]; then
    echo -e "${GREEN}✅ SENTRY_AUTH_TOKEN is configured${NC}"
else
    echo -e "${YELLOW}⚠️  SENTRY_AUTH_TOKEN not set (releases won't be tracked)${NC}"
fi
echo ""

# 9. Check Log Files
echo -e "${BLUE}9️⃣  Checking recent errors in logs...${NC}"
if [ -f "logs/app.log" ]; then
    ERROR_COUNT=$(grep -c '"level":"error"' logs/app.log 2>/dev/null || echo "0")

    if [ $ERROR_COUNT -gt 10 ]; then
        echo -e "${RED}❌ High number of errors in logs: ${ERROR_COUNT}${NC}"
        echo "Recent errors:"
        grep '"level":"error"' logs/app.log | tail -3
        OVERALL_STATUS=1
    elif [ $ERROR_COUNT -gt 5 ]; then
        echo -e "${YELLOW}⚠️  Some errors in logs: ${ERROR_COUNT}${NC}"
    else
        echo -e "${GREEN}✅ Log error count is normal: ${ERROR_COUNT}${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Log file not found at logs/app.log${NC}"
fi
echo ""

# 10. Check Disk Space
echo -e "${BLUE}🔟  Checking disk space...${NC}"
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')

if [ $DISK_USAGE -gt 90 ]; then
    echo -e "${RED}❌ Disk usage critical: ${DISK_USAGE}%${NC}"
    OVERALL_STATUS=1
elif [ $DISK_USAGE -gt 80 ]; then
    echo -e "${YELLOW}⚠️  Disk usage high: ${DISK_USAGE}%${NC}"
else
    echo -e "${GREEN}✅ Disk usage is normal: ${DISK_USAGE}%${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}📊 Health Check Summary:${NC}"
echo ""
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "System is healthy and ready for production."
else
    echo -e "${RED}❌ Some critical checks failed!${NC}"
    echo ""
    echo "Please review the errors above and take action."
    exit 1
fi
echo ""

# Optional: Send to Telegram if webhook is configured
if [ -n "${TELEGRAM_WEBHOOK_URL}" ]; then
    MESSAGE="🔍 Monitoring Health Check\n\nStatus: $([ $OVERALL_STATUS -eq 0 ] && echo '✅ Healthy' || echo '❌ Issues Detected')\nLatency: ${LATENCY}ms\nError Rate: ${ERROR_RATE}\nDisk Usage: ${DISK_USAGE}%"

    curl -s -X POST "${TELEGRAM_WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"${MESSAGE}\"}" > /dev/null
fi
