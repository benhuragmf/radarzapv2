/** Carregado antes do ts-node-dev: terminal legível no `npm run dev`. */
process.env.LOG_FORMAT = 'pretty';
if (!process.env.RADARCHAT_KEEP_NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
/** Envio WhatsApp mais folgado em dev (Discord → WA com várias mensagens seguidas). */
if (!process.env.WHATSAPP_RATE_LIMIT) {
  process.env.WHATSAPP_RATE_LIMIT = '120';
}
/** Evita segundo backend se o Cursor abrir outro terminal com npm run dev. */
if (!process.env.RADARCHAT_DEV) {
  process.env.RADARCHAT_DEV = '1';
}
