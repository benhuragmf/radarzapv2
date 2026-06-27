#!/usr/bin/env node
/**
 * Sincroniza chaves do .env local → /opt/radarzap/.env no VPS.
 * Não sobrescreve FRONTEND_URL, MONGODB_URL docker, SESSION_* gerados no servidor.
 * Uso: VPS_PASSWORD=... node scripts/vps-sync-local-env.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';

const SYNC_KEYS = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_GUILD_ID',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RADARZAP_SYSTEM_ADMIN_DISCORD_IDS',
  'RADARZAP_SYSTEM_MODERATOR_DISCORD_IDS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_STARTER',
  'STRIPE_PRICE_ID_PRO',
  'RADARZAP_AI_OPENAI_KEY',
  'GEMINI_API_KEY',
  'RESEND_API_KEY',
];

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream
        .on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}\n${out}`))))
        .on('data', (d) => {
          process.stdout.write(d);
          out += d.toString();
        })
        .stderr.on('data', (d) => process.stderr.write(d));
    });
  });
}

function upload(conn, localContent, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.writeFile(remotePath, localContent, (e) => (e ? reject(e) : resolve()));
    });
  });
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = parseEnv(readFileSync(resolve(root, '.env'), 'utf8'));
const payload = {};
for (const k of SYNC_KEYS) {
  const v = local[k]?.trim();
  if (v) payload[k] = v;
}
if (!payload.DISCORD_TOKEN || !payload.DISCORD_CLIENT_ID) {
  console.error('DISCORD_TOKEN/CLIENT_ID ausentes no .env local.');
  process.exit(1);
}

const password = process.env.VPS_PASSWORD;
if (!password) {
  console.error('Defina VPS_PASSWORD.');
  process.exit(1);
}

const patchPy = `import json, re, sys
p, j = sys.argv[1], sys.argv[2]
data = json.load(open(j, encoding="utf-8"))
t = open(p, encoding="utf-8").read()
for k, v in data.items():
    line = k + "=" + json.dumps(v)
    if re.search(rf"^{re.escape(k)}=", t, flags=re.M):
        t = re.sub(rf"^{re.escape(k)}=.*", line, t, flags=re.M)
    else:
        t += chr(10) + line + chr(10)
open(p, "w", encoding="utf-8").write(t)
print("[sync]", len(data), "chaves ->", p)
`;

const conn = new Client();
conn
  .on('ready', async () => {
    try {
      await upload(conn, JSON.stringify(payload), '/tmp/radarzap-env-sync.json');
      await upload(conn, patchPy, '/tmp/radarzap-patch-env.py');
      await exec(conn, 'python3 /tmp/radarzap-patch-env.py /opt/radarzap/.env /tmp/radarzap-env-sync.json');
      await exec(conn, 'rm -f /tmp/radarzap-env-sync.json /tmp/radarzap-patch-env.py');
      await exec(conn, 'cd /opt/radarzap && export USE_SUDO_DOCKER=1 && bash scripts/vps-validate-env.sh');
      await exec(conn, 'cd /opt/radarzap && git fetch origin main && git reset --hard origin/main && export USE_SUDO_DOCKER=1 && bash scripts/deploy-remote.sh radarzap:production');
      conn.end();
    } catch (e) {
      console.error(e.message || e);
      conn.end();
      process.exit(1);
    }
  })
  .on('error', (e) => {
    console.error('SSH:', e.message);
    process.exit(1);
  })
  .connect({
    host: process.env.VPS_HOST || '151.247.210.180',
    port: 22,
    username: process.env.VPS_USER || 'ubuntu',
    password,
    readyTimeout: 30000,
  });
