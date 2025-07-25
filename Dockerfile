# Multi-stage build for Pictallion
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application using production build script
RUN chmod +x scripts/build-production.sh && ./scripts/build-production.sh

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy production package.json
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy shared directory
COPY --from=builder /app/shared ./shared

# Copy configuration
COPY --from=builder /app/drizzle.config.ts ./

# Create media directories
RUN mkdir -p data/media/bronze data/media/silver data/media/gold

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S pictallion -u 1001
RUN chown -R pictallion:nodejs /app
USER pictallion

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["node", "dist/index.js"]