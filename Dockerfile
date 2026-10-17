# ==============================================================================
# Gram2City Backend — Multi-Stage Production Dockerfile
# ==============================================================================

# --- Stage 1: Build & Compile TypeScript ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# --- Stage 2: Minimal Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=5000

# Install runtime utilities (wget for Docker/Kubernetes health probes)
RUN apk add --no-cache wget

# Copy package descriptors and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Use non-root system user for container security
USER node

# Expose internal service port (Render binds dynamically via $PORT)
EXPOSE 5000

# Automated container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Start the Node.js production server with graceful signal handling
CMD ["node", "dist/server.js"]
