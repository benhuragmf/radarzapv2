/** Carregado antes do ts-node-dev: terminal legível no `npm run dev`. */
process.env.LOG_FORMAT = 'pretty';
if (!process.env.RADARZAP_KEEP_NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
