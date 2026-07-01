#!/usr/bin/env node
/**
 * Preenche o checklist da auditoria geral com gates automatizáveis.
 *
 * Uso:
 *   npm run qa:auditoria:gate          # gates completos
 *   npm run qa:auditoria:gate -- --quick   # só jest rápidos + build
 *
 * Saída: docs/qa-results/auditoria-geral-YYYY-MM-DD.json
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checklistPath = join(root, 'scripts', 'qa-auditoria-geral-checklist.json');
const checklist = JSON.parse(readFileSync(checklistPath, 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const quick = process.argv.includes('--quick');

const QUICK_GATES = new Set([
  'build',
  'jest-webchat-security',
  'jest-crm-completeness',
  'jest-mask-secret',
]);

const gateResults = {};
const gateRuns = [];
let playwrightInstalled = false;

function ensurePlaywright() {
  if (playwrightInstalled) return true;
  console.log('\n▶ Playwright chromium (pré-requisito E2E)');
  const r = runArgv(['npx', 'playwright', 'install', 'chromium']);
  playwrightInstalled = r.status === 0;
  if (!playwrightInstalled) {
    console.log('✗ Falha ao instalar chromium — gates E2E serão pulados');
  }
  return playwrightInstalled;
}

function quoteShellArg(arg) {
  if (typeof arg !== 'string') return String(arg);
  if (/[|&<>^%!]/.test(arg) || /\s/.test(arg)) {
    if (process.platform === 'win32') {
      return `"${arg.replace(/"/g, '""')}"`;
    }
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return arg;
}

function normalizeCommandList(def) {
  const extras = def.extra ?? [];
  if (!extras.length) return [def.command];
  if (Array.isArray(extras[0])) return [def.command, ...extras];
  return [def.command, extras];
}

function runArgv(parts) {
  const cmd = parts.map(quoteShellArg).join(' ');
  console.log(`   ${cmd}`);
  return spawnSync(cmd, { stdio: 'inherit', shell: true, cwd: root });
}

function runGate(gateId, def) {
  const started = Date.now();
  console.log(`\n▶ ${def.label} (${gateId})`);
  let ok = true;
  const commands = normalizeCommandList(def);
  for (const parts of commands) {
    const r = runArgv(parts);
    if (r.status !== 0) {
      ok = false;
      break;
    }
  }
  const entry = {
    gateId,
    label: def.label,
    ok,
    ms: Date.now() - started,
    mode: quick && !QUICK_GATES.has(gateId) ? 'skipped-quick' : 'executed',
  };
  if (entry.mode === 'skipped-quick') {
    entry.ok = null;
    console.log(`○ Pulado (--quick)`);
  } else {
    console.log(ok ? `✓ OK (${Math.round(entry.ms / 1000)}s)` : `✗ FALHOU`);
  }
  gateRuns.push(entry);
  gateResults[gateId] = entry.ok;
  return ok;
}

console.log('=== Radar Chat — QA Auditoria Geral (automatizável) ===');
console.log(`Versão: ${pkg.version} · Modo: ${quick ? 'quick' : 'full'}\n`);

const gateIds = Object.keys(checklist.gates);
let frontendBuilt = false;

function ensureFrontendBuilt() {
  if (frontendBuilt) return;
  console.log('\n▶ Build frontend (pré-requisito E2E)');
  const r = spawnSync('npm', ['run', 'build', '--prefix', 'src/services/web-dashboard/frontend'], {
    stdio: 'inherit',
    shell: true,
    cwd: root,
  });
  if (r.status !== 0) {
    throw new Error('Build frontend falhou');
  }
  frontendBuilt = true;
}

for (const gateId of gateIds) {
  if (quick && !QUICK_GATES.has(gateId)) continue;
  if (gateId.startsWith('e2e-') && !quick) {
    try {
      ensureFrontendBuilt();
    } catch {
      gateResults[gateId] = false;
      gateRuns.push({
        gateId,
        label: checklist.gates[gateId].label,
        ok: false,
        ms: 0,
        mode: 'executed',
        error: 'frontend build',
      });
      continue;
    }
    if (!ensurePlaywright()) {
      gateResults[gateId] = null;
      gateRuns.push({
        gateId,
        label: checklist.gates[gateId].label,
        ok: null,
        ms: 0,
        mode: 'skipped-playwright',
        error: 'playwright install',
      });
      console.log(`○ Pulado (${gateId} — playwright)`);
      continue;
    }
  }
  runGate(gateId, checklist.gates[gateId]);
}

/** @type {Record<string, { status: string, gate?: string }>} */
const itemResults = {};

for (const section of checklist.sections) {
  for (const item of section.items) {
    const auto = item.automation;
    if (auto === 'manual') {
      itemResults[item.id] = { status: 'pending', mode: 'manual' };
      continue;
    }
    if (!auto?.startsWith('gate:')) {
      itemResults[item.id] = { status: 'pending', mode: 'manual' };
      continue;
    }
    const gateId = auto.slice('gate:'.length);
    const gateOk = gateResults[gateId];
    if (gateOk === null || gateOk === undefined) {
      itemResults[item.id] = { status: 'skipped', gate: gateId, mode: 'automated' };
    } else if (gateOk) {
      itemResults[item.id] = { status: 'pass', gate: gateId, mode: 'automated' };
    } else {
      itemResults[item.id] = { status: 'fail', gate: gateId, mode: 'automated' };
    }
  }
}

let autoPass = 0;
let autoFail = 0;
let autoSkipped = 0;
let manualPending = 0;

const sectionsOut = checklist.sections.map(section => ({
  ...section,
  items: section.items.map(item => {
    const r = itemResults[item.id];
    if (r.mode === 'manual') manualPending += 1;
    else if (r.status === 'pass') autoPass += 1;
    else if (r.status === 'fail') autoFail += 1;
    else if (r.status === 'skipped') autoSkipped += 1;
    return {
      id: item.id,
      title: item.title,
      expected: item.expected,
      automation: item.automation,
      status: r.status,
      gate: r.gate ?? null,
      notes: '',
    };
  }),
}));

const date = new Date().toISOString().slice(0, 10);
const overallStatus =
  autoFail > 0 ? 'FAIL' : autoPass > 0 && manualPending > 0 ? 'PARTIAL' : autoPass > 0 ? 'PASS' : 'PENDING';

const report = {
  schema: checklist.schema,
  auditCycle: checklist.auditCycle,
  version: pkg.version,
  date,
  executedAt: new Date().toISOString(),
  executor: 'qa-auditoria-geral.mjs',
  environment: process.env.RADARCHAT_QA_ENV || 'local',
  mode: quick ? 'quick' : 'full',
  overallStatus,
  summary: {
    automated: {
      pass: autoPass,
      fail: autoFail,
      skipped: autoSkipped,
      total: autoPass + autoFail + autoSkipped,
    },
    manual: { pending: manualPending, total: manualPending },
  },
  gateRuns,
  sections: sectionsOut,
  notes:
    'Itens manual=pending exigem execução humana conforme docs/QA-AUDITORIA-GERAL-SISTEMA.md. ' +
    'Reexecute com npm run qa:auditoria:gate após correções.',
};

const outDir = join(root, 'docs', 'qa-results');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `auditoria-geral-${date}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\nRelatório: ${outPath}`);
console.log(
  `Resumo: ${autoPass} pass · ${autoFail} fail · ${autoSkipped} skipped · ${manualPending} manual pendente`,
);
console.log(overallStatus === 'FAIL' ? '\n❌ GATE VERMELHO (automatizado)' : '\n✅ Automatizado OK (manual pendente)');

process.exit(autoFail > 0 ? 1 : 0);
