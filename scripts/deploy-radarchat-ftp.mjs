#!/usr/bin/env node
/**
 * Publica site/radarchat/ no FTP Locaweb (radarchat.com.br).
 * Credenciais: env RADARCHAT_FTP_* ou config/infra-credentials.local.md (gitignored).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT, 'site', 'radarchat');
const CREDENTIALS_FILE = path.join(ROOT, 'config', 'infra-credentials.local.md');

function parseCredentialsFromMarkdown(content) {
  const host = content.match(/\|\s*Host\s*\|\s*`([^`]+)`/)?.[1];
  const user = content.match(/\|\s*Usuário\s*\|\s*`([^`]+)`/)?.[1];
  const pass = content.match(/\|\s*Senha\s*\|\s*`([^`]+)`/)?.[1];
  const port = content.match(/\|\s*Porta\s*\|\s*`?(\d+)`?/)?.[1] ?? '21';
  return { host, user, pass, port };
}

function loadCredentials() {
  const fromEnv = {
    host: process.env.RADARCHAT_FTP_HOST,
    user: process.env.RADARCHAT_FTP_USER,
    pass: process.env.RADARCHAT_FTP_PASS,
    port: process.env.RADARCHAT_FTP_PORT ?? '21',
    remoteDir: process.env.RADARCHAT_FTP_REMOTE_DIR ?? '/public_html',
  };
  if (fromEnv.host && fromEnv.user && fromEnv.pass) return fromEnv;

  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(
      'Credenciais FTP ausentes. Defina RADARCHAT_FTP_HOST/USER/PASS ou crie config/infra-credentials.local.md',
    );
  }
  const parsed = parseCredentialsFromMarkdown(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  return {
    host: fromEnv.host ?? parsed.host,
    user: fromEnv.user ?? parsed.user,
    pass: fromEnv.pass ?? parsed.pass,
    port: fromEnv.port ?? parsed.port,
    remoteDir: fromEnv.remoteDir,
  };
}

function listSiteFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = path.posix.join(base, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSiteFiles(abs, rel));
    } else {
      files.push({ rel: rel.replace(/\\/g, '/'), abs });
    }
  }
  return files;
}

function curlUpload({ host, user, pass, port, remoteDir, localFile, remoteFile }) {
  const remotePath = `${remoteDir.replace(/\/$/, '')}/${remoteFile}`.replace(/\/+/g, '/');
  const url = `ftp://${host}:${port}${remotePath}`;
  const args = [
    '--silent',
    '--show-error',
    '--fail',
    '--ftp-create-dirs',
    '-T',
    localFile,
    '--user',
    `${user}:${pass}`,
    url,
  ];
  const result = spawnSync('curl', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(`Falha ao enviar ${remoteFile}: ${err || `exit ${result.status}`}`);
  }
  return remotePath;
}

function main() {
  if (!fs.existsSync(SITE_DIR)) {
    throw new Error(`Pasta do site não encontrada: ${SITE_DIR}`);
  }

  const creds = loadCredentials();
  if (!creds.host || !creds.user || !creds.pass) {
    throw new Error('Host, usuário ou senha FTP incompletos.');
  }

  const files = listSiteFiles(SITE_DIR);
  if (!files.length) {
    throw new Error('Nenhum arquivo em site/radarchat/');
  }

  console.log(`Publicando ${files.length} arquivo(s) em ftp://${creds.host}${creds.remoteDir} ...`);

  for (const file of files) {
    const remotePath = curlUpload({
      ...creds,
      localFile: file.abs,
      remoteFile: file.rel,
    });
    console.log(`  ✓ ${file.rel} → ${remotePath}`);
  }

  console.log('\nDeploy concluído: https://radarchat.com.br');
}

try {
  main();
} catch (error) {
  console.error(`\n[deploy-radarchat-ftp] ${error.message}`);
  process.exit(1);
}
