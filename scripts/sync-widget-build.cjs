/**
 * Sincroniza WIDGET_BUILD em widget.js com a versão do package.json raiz.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const widgetPath = path.join(root, 'src/services/web-dashboard/webchat/widget.js');
const src = fs.readFileSync(widgetPath, 'utf8');
const pattern = /var WIDGET_BUILD = '[^']+';/;

if (!pattern.test(src)) {
  console.warn('[sync-widget-build] WIDGET_BUILD não encontrado em widget.js');
  process.exit(1);
}

const next = `var WIDGET_BUILD = '${pkg.version}';`;
if (src.includes(next)) {
  console.log(`[sync-widget-build] já em sync (${pkg.version})`);
  process.exit(0);
}

fs.writeFileSync(widgetPath, src.replace(pattern, next));
console.log(`[sync-widget-build] WIDGET_BUILD → ${pkg.version}`);
