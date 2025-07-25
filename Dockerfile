# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application (client and server)
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./

# Copy package.json and install production dependencies
COPY package*.json ./
RUN npm ci --production

# Create non-root user
RUN addgroup -g 1001 -S pictallion && \
    adduser -S pictallion -u 1001

# Create data directories
RUN mkdir -p data/media/{bronze,silver,gold,dropzone,archive} && \
    mkdir -p data/media/dropzone/duplicates && \
    mkdir -p uploads/temp && \
    chown -R pictallion:pictallion data uploads

# Switch to non-root user
USER pictallion

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/stats', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "dist/index.js"]
