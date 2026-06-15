import path from 'path'
import { createLogger, defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = 'http://localhost:3001'
const PROXY_ERROR_COOLDOWN_MS = 15_000

let lastProxyWarnAt = 0

/** Suprime stacks repetidos de "http proxy error" do Vite; aviso único a cada 15s. */
const viteLogger = createLogger()
const viteError = viteLogger.error.bind(viteLogger)
viteLogger.error = (msg, options) => {
  const text = typeof msg === 'string' ? msg : String(msg)
  if (text.includes('http proxy error') || text.includes('ECONNREFUSED')) {
    return
  }
  viteError(msg, options)
}

function warnApiOffline(err: unknown): void {
  const now = Date.now()
  if (now - lastProxyWarnAt < PROXY_ERROR_COOLDOWN_MS) return
  lastProxyWarnAt = now
  const msg = err instanceof Error ? err.message : String(err)
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
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': createApiProxy(),
      '/auth': createApiProxy(),
      '/socket.io': {
        target: API_TARGET,
        ws: true,
      },
    },
  },
})
