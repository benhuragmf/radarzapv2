FROM node:20-alpine

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
RUN npm ci --ignore-scripts && npm run build && npm prune --production \
    && node -e "require('mongodb'); require('ioredis')" \
    && npm cache clean --force

# Copy setup scripts
COPY scripts/setup.js ./scripts/

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# This is a one-time setup service, no health check needed
# It will exit after completing setup

# Start the setup service
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "scripts/setup.js"]



