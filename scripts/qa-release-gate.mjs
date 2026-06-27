#!/usr/bin/env node
/**
 * Gate automatizado pós-deploy / pré-main:
 * build + testes campanha + E2E painel + atendimento + smoke produção (opcional).
 *
 * Uso: npm run qa:release-gate
 * Produção: RADARZAP_PUBLIC_URL=https://seu-dominio npm run qa:release-gate
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const steps = [];
let failed = false;

function run(name, cmd, args, opts = {}) {
  const started = Date.now();
  console.log(`\n▶ ${name}\n   ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    ...opts,
  });
  const ok = r.status === 0;
  const entry = {
    name,
    ok,
    ms: Date.now() - started,
    status: r.status,
  };
  steps.push(entry);
  if (!ok) {
    failed = true;
    console.error(`\n✗ Falhou: ${name} (exit ${r.status})`);
  } else {
    console.log(`\n✓ OK: ${name} (${Math.round(entry.ms / 1000)}s)`);
  }
  return ok;
}

async function productionSmoke() {
  const base = (process.env.RADARZAP_PUBLIC_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (!base) {
    steps.push({ name: 'smoke produção (pulado — sem RADARZAP_PUBLIC_URL)', ok: true, skipped: true });
    console.log('\n○ Smoke produção pulado — defina RADARZAP_PUBLIC_URL para validar VPS');
    return true;
  }
  const started = Date.now();
  console.log(`\n▶ smoke produção\n   GET ${base}/health`);
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(15_000) });
    const ok = res.ok;
    steps.push({
      name: `smoke produção ${base}/health`,
      ok,
      ms: Date.now() - started,
      status: res.status,
    });
    if (!ok) {
      failed = true;
      console.error(`✗ Health HTTP ${res.status}`);
      return false;
    }
    console.log(`✓ Produção respondeu HTTP ${res.status}`);
    return true;
  } catch (e) {
    steps.push({
      name: `smoke produção ${base}/health`,
      ok: false,
      ms: Date.now() - started,
      error: String(e),
    });
    failed = true;
    console.error('✗ Smoke produção:', e);
    return false;
  }
}

console.log('=== RadarZap — QA Release Gate (automático) ===\n');

run('jest campanha/limites', 'npm', ['run', 'qa:campaign-limits']);
run('build backend', 'npm', ['run', 'build']);
run('build frontend', 'npm', ['run', 'build', '--prefix', 'src/services/web-dashboard/frontend']);
run('playwright install chromium', 'npx', ['playwright', 'install', 'chromium']);
run('E2E limites campanha', 'npx', ['playwright', 'test', 'e2e/qa-campaign-limits.spec.ts', '--project=chromium']);

if (!failed) {
  run('qa atendimento gate', 'npm', ['run', 'qa:atendimento:gate']);
}

if (!failed) {
  run('E2E fase1 painel', 'npm', ['run', 'qa:fase1:e2e']);
}

await productionSmoke();

const reportDir = join(process.cwd(), 'docs', 'qa-results');
mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportPath = join(reportDir, `release-gate-${stamp}.json`);
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
writeFileSync(
  reportPath,
  JSON.stringify({ at: new Date().toISOString(), version: pkg.version, failed, steps }, null, 2),
);

console.log(`\nRelatório: ${reportPath}`);
console.log(failed ? '\n❌ GATE VERMELHO' : '\n✅ GATE VERDE');
process.exit(failed ? 1 : 0);
