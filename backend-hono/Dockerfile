# Multi-stage Dockerfile for Hono backend
# Supports both development and production builds

# Stage 1: Base dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Install necessary build tools for native dependencies
RUN apk add --no-cache libc6-compat

# Stage 2: Dependencies installation
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY ../prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 3: Development dependencies
FROM base AS dev-deps

COPY package*.json ./
COPY ../prisma ./prisma/

# Install all dependencies including dev
RUN npm ci

# Stage 4: Builder
FROM base AS builder

COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .

# Copy Prisma schema from parent directory
RUN mkdir -p ../prisma && \
    cp prisma/schema.prisma ../prisma/ || echo "Prisma schema will be mounted"

# Generate Prisma Client
RUN npm run prisma:generate

# Build TypeScript
RUN npm run build

# Stage 5: Production runner
FROM base AS production

ENV NODE_ENV=production

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Copy Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hono

USER hono

EXPOSE 3001

CMD ["node", "dist/index.js"]

# Stage 6: Development runner
FROM base AS development

ENV NODE_ENV=development

# Install all dependencies
COPY --from=dev-deps /app/node_modules ./node_modules

# Copy source code (will be overridden by volume mount)
COPY . .

# Copy Prisma schema
RUN mkdir -p ../prisma

EXPOSE 3001

CMD ["npm", "run", "dev"]
