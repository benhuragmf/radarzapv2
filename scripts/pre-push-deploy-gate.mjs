#!/usr/bin/env node
/**
 * Gate obrigatório antes de push/merge na main (dispara Deploy GHCR + VPS).
 * Replica o que o CI local NÃO cobre: build do frontend dentro do Docker.
 *
 * Uso: npm run pre-push:gate
 */
import { spawnSync } from 'node:child_process';

const steps = [
  {
    name: 'build backend',
    cmd: 'npm',
    args: ['run', 'build'],
  },
  {
    name: 'build frontend (local)',
    cmd: 'npm',
    args: ['run', 'build', '--prefix', 'src/services/web-dashboard/frontend'],
  },
  {
    name: 'docker frontend-builder (mesmo contexto GHCR)',
    cmd: 'docker',
    args: [
      'build',
      '-f',
      'docker/Dockerfile.monolith',
      '--target',
      'frontend-builder',
      '--progress=plain',
      '.',
    ],
  },
];

console.log('=== RadarZap — pre-push deploy gate ===\n');

let failed = false;
for (const step of steps) {
  const started = Date.now();
  console.log(`▶ ${step.name}\n   ${step.cmd} ${step.args.join(' ')}`);
  const r = spawnSync(step.cmd, step.args, { stdio: 'inherit', shell: true });
  const ok = r.status === 0;
  if (!ok) {
    failed = true;
    console.error(`\n✗ Falhou: ${step.name} (exit ${r.status})`);
    break;
  }
  console.log(`\n✓ OK: ${step.name} (${Math.round((Date.now() - started) / 1000)}s)\n`);
}

if (failed) {
  console.error('\n❌ NÃO faça push na main até corrigir e rodar npm run pre-push:gate de novo.');
  process.exit(1);
}

console.log('✅ Gate verde — seguro para commit/push na main (Deploy).');
process.exit(0);
