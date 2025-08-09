# Single-stage build for Pictallion frontend web deployment
FROM node:20-alpine

WORKDIR /app

# Install serve globally and wget for health checks
RUN npm install -g serve && \
    apk add --no-cache wget

# Copy frontend package files
COPY frontend/package*.json ./

# Install all dependencies (needed for build)
# Using npm install instead of npm ci due to package-lock.json sync issues
RUN npm install --no-audit

# Copy frontend source and shared directory
COPY frontend/ ./
COPY shared/ ../shared/

# Build the frontend
RUN npm run build

# Clean up dev dependencies after build
RUN npm prune --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S pictallion && \
    adduser -S pictallion -u 1001 -G pictallion

# Set ownership of the app directory
RUN chown -R pictallion:pictallion /app

# Switch to non-root user
USER pictallion

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start the application using serve
CMD ["serve", "-s", "dist", "-l", "8080"]