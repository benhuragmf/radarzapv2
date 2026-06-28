/**
 * Copia assets estáticos do painel (webchat/leads) para dist/ após tsc.
 * Rotas sendFile em DashboardService usam __dirname relativo a dist/services/web-dashboard/.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcBase = path.join(root, 'src/services/web-dashboard');
const distBase = path.join(root, 'dist/services/web-dashboard');

const STATIC_DIRS = ['webchat', 'leads'];
const STATIC_EXT = new Set(['.html', '.js']);

function copyDir(name) {
  const srcDir = path.join(srcBase, name);
  const distDir = path.join(distBase, name);
  if (!fs.existsSync(srcDir)) {
    console.warn(`[copy-dashboard-static] origem ausente: ${srcDir}`);
    return 0;
  }
  fs.mkdirSync(distDir, { recursive: true });
  let count = 0;
  for (const file of fs.readdirSync(srcDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!STATIC_EXT.has(ext)) continue;
    fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
    count += 1;
  }
  return count;
}

let total = 0;
for (const dir of STATIC_DIRS) {
  total += copyDir(dir);
}

if (total === 0) {
  console.error('[copy-dashboard-static] nenhum arquivo copiado — verifique src/services/web-dashboard/{webchat,leads}');
  process.exit(1);
}

console.log(`[copy-dashboard-static] ${total} arquivo(s) → dist/services/web-dashboard/`);
