FROM node:24-alpine

# Install system dependencies for WhatsApp Web (Puppeteer)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
# Copy source code
COPY src/ ./src/

# Install, build and prune
RUN npm ci --ignore-scripts && npm run build && npm prune --production && npm cache clean --force

# Create directories for sessions and media
RUN mkdir -p /app/sessions /app/media && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check (WhatsApp service doesn't expose HTTP, so check process)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD pgrep -f "node.*whatsapp" || exit 1

# Set service name for selective startup
ENV SERVICE_NAME=whatsapp-service

# Start the service
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]



