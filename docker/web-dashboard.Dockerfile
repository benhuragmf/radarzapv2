# ── Stage 1: build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY src/services/web-dashboard/frontend/package*.json ./
RUN npm ci

COPY src/services/web-dashboard/frontend/ ./
RUN npm run build
# Output goes to /frontend/dist (vite.config outDir = '../public' relative to frontend,
# but inside Docker we override to dist so we can copy it cleanly)

# ── Stage 2: build Node.js backend ───────────────────────────────────────────
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc --outDir dist --rootDir src --module commonjs --target ES2022 \
    --skipLibCheck --esModuleInterop --resolveJsonModule \
    --experimentalDecorators --emitDecoratorMetadata \
    --baseUrl src 2>/dev/null || true

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend into the public folder served by Express
COPY --from=frontend-builder /frontend/dist ./dist/services/web-dashboard/public

ENV NODE_ENV=production
ENV SERVICE_NAME=web-dashboard

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
