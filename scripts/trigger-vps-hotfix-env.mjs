#!/usr/bin/env node
/**
 * Sync DISCORD_* do .env local → GitHub Secrets → workflow VPS hotfix env (~1–2 min).
 * Uso: npm run vps:hotfix:env
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(resolve(root, '.env'), 'utf8');
const vars = {};
for (const line of env.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 1) continue;
  vars[t.slice(0, i)] = t.slice(i + 1);
}

const required = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_GUILD_ID',
  'RADARCHAT_SYSTEM_ADMIN_DISCORD_IDS',
];
const optional = ['RADARCHAT_SYSTEM_MODERATOR_DISCORD_IDS'];

for (const k of required) {
  const v = vars[k]?.trim();
  if (!v) {
    console.error(`Falta ${k} no .env`);
    process.exit(1);
  }
  execSync(`gh secret set ${k} --body ${JSON.stringify(v)}`, { stdio: 'inherit' });
}
for (const k of optional) {
  const v = vars[k]?.trim();
  if (v) {
    execSync(`gh secret set ${k} --body ${JSON.stringify(v)}`, { stdio: 'inherit' });
  }
}

execSync('gh workflow run "VPS hotfix env"', { stdio: 'inherit' });
console.log('\nHotfix disparado. Acompanhe: gh run list --workflow="VPS hotfix env" --limit 1');
