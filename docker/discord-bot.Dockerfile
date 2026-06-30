FROM node:24-alpine

# Install system dependencies
RUN apk add --no-cache curl dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
# Copy source code
COPY src/ ./src/

# Install, build and prune
RUN npm ci --ignore-scripts && npm run build && npm prune --production && npm cache clean --force

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check (Discord bot doesn't expose HTTP, so check process)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD pgrep -f "node.*discord" || exit 1

# Set service name for selective startup
ENV SERVICE_NAME=discord-bot

# Start the service
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]



