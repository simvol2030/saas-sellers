#!/bin/bash
# Security Audit Script for Express.js Backend
# Runs various security checks and generates a report

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🔒 Security Audit for Express.js Backend${NC}"
echo ""

# 1. NPM Audit
echo -e "${BLUE}1️⃣  Running npm audit...${NC}"
npm audit --audit-level=moderate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ No vulnerabilities found${NC}"
else
    echo -e "${YELLOW}⚠️  Vulnerabilities detected! Run 'npm audit fix' to resolve${NC}"
fi
echo ""

# 2. Check for secrets in code
echo -e "${BLUE}2️⃣  Checking for hardcoded secrets...${NC}"
if command -v git &> /dev/null; then
    # Check for common secret patterns
    SECRETS_FOUND=0

    # API keys
    if git grep -E "(api[_-]?key|api[_-]?secret|password|secret[_-]?key)\s*=\s*['\"][^'\"]+['\"]" -- '*.ts' '*.js' 2>/dev/null | grep -v "process.env" | grep -v "TODO"; then
        echo -e "${RED}❌ Hardcoded secrets found!${NC}"
        SECRETS_FOUND=1
    fi

    # JWT secrets
    if git grep -E "jwt[_-]?secret\s*=\s*['\"][^'\"]+['\"]" -- '*.ts' '*.js' 2>/dev/null | grep -v "process.env"; then
        echo -e "${RED}❌ Hardcoded JWT secrets found!${NC}"
        SECRETS_FOUND=1
    fi

    if [ $SECRETS_FOUND -eq 0 ]; then
        echo -e "${GREEN}✅ No hardcoded secrets detected${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Git not found, skipping secret scan${NC}"
fi
echo ""

# 3. Check for SQL injection vulnerabilities
echo -e "${BLUE}3️⃣  Checking for potential SQL injection...${NC}"
SQL_INJECTION_FOUND=0

# Check for string concatenation in SQL
if git grep -E "SELECT.*\+|INSERT.*\+|UPDATE.*\+|DELETE.*\+" -- '*.ts' '*.js' 2>/dev/null; then
    echo -e "${RED}❌ Potential SQL injection via string concatenation!${NC}"
    SQL_INJECTION_FOUND=1
fi

# Check for sql.raw with variables
if git grep -E "sql\.raw\([^\$]" -- '*.ts' '*.js' 2>/dev/null; then
    echo -e "${RED}❌ Potential SQL injection via sql.raw()!${NC}"
    SQL_INJECTION_FOUND=1
fi

if [ $SQL_INJECTION_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No obvious SQL injection patterns detected${NC}"
fi
echo ""

# 4. Check environment variables
echo -e "${BLUE}4️⃣  Checking environment variables setup...${NC}"

REQUIRED_VARS=(
    "JWT_SECRET"
    "DATABASE_URL"
    "NODE_ENV"
)

ENV_VARS_OK=1

if [ -f ".env.example" ]; then
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^${var}=" .env.example 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Missing ${var} in .env.example${NC}"
            ENV_VARS_OK=0
        fi
    done

    if [ $ENV_VARS_OK -eq 1 ]; then
        echo -e "${GREEN}✅ Environment variables documented${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.example not found${NC}"
fi
echo ""

# 5. Check for HTTPS enforcement
echo -e "${BLUE}5️⃣  Checking HTTPS enforcement...${NC}"

if git grep -E "requireHTTPS|helmet.*hsts" -- '*.ts' '*.js' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ HTTPS enforcement found${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS enforcement not detected${NC}"
fi
echo ""

# 6. Check for rate limiting
echo -e "${BLUE}6️⃣  Checking rate limiting...${NC}"

if git grep -E "express-rate-limit|rateLimit" -- '*.ts' '*.js' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Rate limiting found${NC}"
else
    echo -e "${YELLOW}⚠️  Rate limiting not detected${NC}"
fi
echo ""

# 7. Check for CORS configuration
echo -e "${BLUE}7️⃣  Checking CORS configuration...${NC}"

if git grep -E "cors\(" -- '*.ts' '*.js' >/dev/null 2>&1; then
    # Check if CORS allows all origins
    if git grep -E "origin:\s*['\*]" -- '*.ts' '*.js' >/dev/null 2>&1; then
        echo -e "${RED}❌ CORS allows all origins (*)${NC}"
    else
        echo -e "${GREEN}✅ CORS configured with whitelist${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  CORS not configured${NC}"
fi
echo ""

# 8. Check for helmet middleware
echo -e "${BLUE}8️⃣  Checking Helmet middleware...${NC}"

if git grep -E "helmet\(" -- '*.ts' '*.js' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Helmet middleware found${NC}"
else
    echo -e "${YELLOW}⚠️  Helmet middleware not detected${NC}"
fi
echo ""

# 9. Check for input validation
echo -e "${BLUE}9️⃣  Checking input validation...${NC}"

if git grep -E "(zod|joi|yup|express-validator)" -- '*.ts' '*.js' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Input validation library found${NC}"
else
    echo -e "${YELLOW}⚠️  Input validation library not detected${NC}"
fi
echo ""

# 10. Check dependencies age
echo -e "${BLUE}🔟  Checking outdated dependencies...${NC}"
npm outdated || true
echo ""

# Summary
echo -e "${BLUE}📊 Security Audit Summary:${NC}"
echo ""
echo -e "  ${GREEN}✅${NC} = Check passed"
echo -e "  ${YELLOW}⚠️${NC}  = Warning"
echo -e "  ${RED}❌${NC} = Critical issue"
echo ""
echo -e "${BLUE}Recommendations:${NC}"
echo "  1. Run 'npm audit fix' to resolve vulnerabilities"
echo "  2. Never commit secrets to git"
echo "  3. Always use parameterized queries (ORM)"
echo "  4. Use environment variables for all secrets"
echo "  5. Enable HTTPS in production"
echo "  6. Configure rate limiting for all endpoints"
echo "  7. Use CORS whitelist (not '*')"
echo "  8. Add Helmet middleware for security headers"
echo "  9. Validate all user inputs"
echo "  10. Keep dependencies up to date"
echo ""
