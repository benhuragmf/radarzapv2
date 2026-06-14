/**
 * Substitui alert() por notify* nos arquivos TSX do painel (fase 3).
 * Uso: node scripts/replace-alerts-with-notify.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'src/services/web-dashboard/frontend/src');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'node_modules') continue;
      walk(full, out);
    } else if (name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function relImport(file) {
  const dir = path.dirname(file);
  const rel = path.relative(dir, path.join(ROOT, 'lib/notify.ts')).replace(/\\/g, '/');
  return rel.startsWith('.') ? rel.replace(/\.ts$/, '') : './' + rel.replace(/\.ts$/, '');
}

const replacements = [
  [/onError:\s*\(\s*err:\s*Error\s*\)\s*=>\s*alert\(err\.message\)/g, 'onError: mutationError'],
  [/onError:\s*\(\s*e:\s*Error\s*\)\s*=>\s*alert\(e\.message(?:\s*\|\|\s*'[^']*')?\)/g, 'onError: mutationError'],
  [/onError:\s*\(\s*err:\s*any\s*\)\s*=>\s*alert\(`Erro: \$\{err\.message\}`\)/g, 'onError: mutationError'],
  [/onError:\s*\(\s*err:\s*Error\s*\)\s*=>\s*alert\(err\.message\s*\?\?\s*'[^']*'\)/g, 'onError: mutationError'],
  [/if\s*\(\s*!err\.message\.includes\('não conectado'\)\s*\)\s*alert\(err\.message\)/g,
    "if (!err.message.includes('não conectado')) notifyError(err.message)"],
  [/\.catch\(e\s*=>\s*alert\(e\.message\)\)/g, '.catch(mutationError)'],
  [/alert\(\(err as Error\)\.message\)/g, 'notifyError((err as Error).message)'],
];

const successPatterns = [
  [/alert\('Dados da empresa salvos\.'\)/g, "notifySuccess('Dados da empresa salvos.')"],
  [/alert\('Solicitação enviada ao dono da empresa para aprovação\.'\)/g,
    "notifySuccess('Solicitação enviada ao dono da empresa para aprovação.')"],
  [/alert\('Atualização enviada ao cliente no WhatsApp\.'\)/g,
    "notifySuccess('Atualização enviada ao cliente no WhatsApp.')"],
  [/alert\('Ticket encaminhado via WhatsApp\.'\)/g, "notifySuccess('Ticket encaminhado via WhatsApp.')"],
  [/alert\(`Convite reenviado/g, 'notifySuccess(`Convite reenviado'],
  [/alert\(`Processado: \$\{data\.enqueued/g, 'notifySuccess(`Processado: ${data.enqueued'],
  [/alert\(`Processado: \$\{res\.enqueued/g, 'notifySuccess(`Processado: ${res.enqueued'],
  [/alert\(`Sweep: \$\{res\.organizationsExpired/g, 'notifySuccess(`Sweep: ${res.organizationsExpired'],
  [/alert\(`\$\{deleted\} contato\(s\) removido\(s\)\.`\)/g, 'notifySuccess(`${deleted} contato(s) removido(s).`)'],
  [/alert\(`\$\{result\.affected/g, 'notifySuccess(`${result.affected'],
  [/alert\(`\$\{res\.affected\} contato\(s\) copiado\(s\)\./g, 'notifySuccess(`${res.affected} contato(s) copiado(s).'],
  [/alert\(`Erro: \$\{e\.message\}`\)/g, 'notifyError(`Erro: ${e.message}`)'],
  [/alert\(data\.inviteEmail\?\.error/g, 'notifyError(data.inviteEmail?.error'],
  [/alert\('Recusa definitiva \(3x\)/g, "notifyInfo('Recusa definitiva (3x)"],
];

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.endsWith('lib/notify.ts') || file.endsWith('ToastContext.tsx')) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('alert(')) continue;

  const original = src;
  for (const [re, rep] of [...replacements, ...successPatterns]) {
    src = src.replace(re, rep);
  }

  // alert genérico restante → notifyError (exceto notify.ts)
  src = src.replace(/\balert\(/g, 'notifyError(');

  const needsNotify = src.includes('notifyError') || src.includes('notifySuccess') || src.includes('mutationError') || src.includes('notifyInfo');
  if (needsNotify && !src.includes("from '../lib/notify'") && !src.includes('from "../../lib/notify"') && !src.includes("from '../../lib/notify'")) {
    const imp = relImport(file);
    const importLine = `import { notifyError, notifySuccess, notifyInfo, mutationError } from '${imp}'\n`;
    const lastImport = src.lastIndexOf('\nimport ');
    if (lastImport >= 0) {
      const end = src.indexOf('\n', lastImport + 1);
      src = src.slice(0, end + 1) + importLine + src.slice(end + 1);
    } else {
      src = importLine + src;
    }
  }

  if (src !== original) {
    fs.writeFileSync(file, src);
    changed++;
    console.log('updated', path.relative(process.cwd(), file));
  }
}
console.log('files changed:', changed);
