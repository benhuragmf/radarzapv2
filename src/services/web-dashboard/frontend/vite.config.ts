import path from 'path'
import { readFileSync } from 'node:fs'
import { createLogger, defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const radarchatVersion = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../package.json'), 'utf8'),
).version as string

const API_TARGET = 'http://localhost:3001'
const PROXY_ERROR_COOLDOWN_MS = 15_000

let lastProxyWarnAt = 0

/** Ruído esperado quando o backend reinicia (ts-node-dev) ou Socket.IO reconecta. */
function isTransientProxyNoise(msg: string): boolean {
  return (
    msg.includes('http proxy error') ||
    msg.includes('ws proxy error') ||
    msg.includes('ws proxy socket error') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNABORTED')
  )
}

/** Suprime stacks repetidos do Vite; aviso único a cada 15s só se API realmente offline. */
const viteLogger = createLogger()
const viteError = viteLogger.error.bind(viteLogger)
viteLogger.error = (msg, options) => {
  const text = typeof msg === 'string' ? msg : String(msg)
  if (isTransientProxyNoise(text)) {
    return
  }
  viteError(msg, options)
}

function warnApiOffline(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  // ECONNRESET/ABORTED = backend reiniciou ou WS reconectou — não é "API offline"
  if (msg.includes('ECONNRESET') || msg.includes('ECONNABORTED')) {
    return
  }
  const now = Date.now()
  if (now - lastProxyWarnAt < PROXY_ERROR_COOLDOWN_MS) return
  lastProxyWarnAt = now
  console.warn(
    `\n[vite] API offline — inicie o backend com "npm run dev" (${API_TARGET}).` +
      (msg ? ` (${msg})` : '') +
      ` Próximo aviso em ${PROXY_ERROR_COOLDOWN_MS / 1000}s.\n`,
  )
}

function createApiProxy(): ProxyOptions {
  return {
    target: API_TARGET,
    changeOrigin: true,
    timeout: 120_000,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq, req) => {
        const host = req.headers.host;
        if (host) {
          proxyReq.setHeader('x-forwarded-host', host);
          proxyReq.setHeader('x-forwarded-proto', 'http');
        }
      });
      proxy.on('error', (err, _req, res) => {
        warnApiOffline(err)
        if (res && !res.headersSent && 'writeHead' in res) {
          res.writeHead!(503, { 'Content-Type': 'application/json' })
          res.end!(
            JSON.stringify({
              error: 'backend_offline',
              message: 'API indisponível. Execute npm run dev na raiz do projeto.',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  customLogger: viteLogger,
  define: {
    'import.meta.env.VITE_RADARCHAT_VERSION': JSON.stringify(radarchatVersion),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@radarchat-types': path.resolve(__dirname, '../../../types'),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts';
            if (id.includes('@tanstack')) return 'query';
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': createApiProxy(),
      '/auth': createApiProxy(),
      '/socket.io': {
        target: API_TARGET,
        ws: true,
        configure(proxy) {
          proxy.on('error', err => {
            warnApiOffline(err)
          })
        },
      },
      '/webchat': createApiProxy(),
      '/leads': createApiProxy(),
    },
  },
})
