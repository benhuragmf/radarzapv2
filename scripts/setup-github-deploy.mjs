#!/usr/bin/env node
/**
 * Configuração única: chave SSH para GitHub Actions + secrets + GHCR no VPS.
 *
 * Uso (na raiz do repo):
 *   VPS_PASSWORD=... node scripts/setup-github-deploy.mjs
 *
 * Opcional: GHCR_PAT=ghp_... (PAT com read:packages) para login no VPS.
 * Requer: gh auth login (para gravar secrets no GitHub).
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'ssh2';

const root = join(import.meta.dirname, '..');
const keysDir = join(root, '.deploy-keys');
const keyPath = join(keysDir, 'github_actions_ed25519');
const host = process.env.VPS_HOST || '151.247.210.180';
const user = process.env.VPS_USER || 'ubuntu';
const password = process.env.VPS_PASSWORD;
const deployPath = process.env.DEPLOY_PATH || '/opt/radarchat';
const repo = process.env.GITHUB_REPOSITORY || 'benhuragmf/radarchatv2';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
}

function ghAvailable() {
  try {
    run('gh auth status');
    return true;
  } catch {
    return false;
  }
}

function ensureKeyPair() {
  mkdirSync(keysDir, { recursive: true });
  if (!existsSync(keyPath)) {
    console.log('[1/4] Gerando chave SSH ed25519 (não commitar .deploy-keys/)...');
    spawnSync(
      'ssh-keygen',
      ['-t', 'ed25519', '-f', keyPath, '-N', '', '-C', 'github-actions-radarchat'],
      { stdio: 'inherit' },
    );
  } else {
    console.log('[1/4] Reutilizando chave em .deploy-keys/');
  }
  return {
    privateKey: readFileSync(keyPath, 'utf8'),
    publicKey: readFileSync(`${keyPath}.pub`, 'utf8').trim(),
  };
}

function sshExec(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
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
      })
      .on('error', reject)
      .connect({ host, port: 22, username: user, password });
  });
}

async function installPublicKey(publicKey) {
  if (!password) {
    console.warn('VPS_PASSWORD não definido — pule instalação da chave no VPS.');
    console.log('Adicione manualmente em ~/.ssh/authorized_keys no servidor:\n', publicKey);
    return;
  }
  console.log('[2/4] Instalando chave pública no VPS...');
  const escaped = publicKey.replace(/'/g, `'\\''`);
  await sshExec(
    `mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qxF '${escaped}' ~/.ssh/authorized_keys 2>/dev/null || echo '${escaped}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`,
  );
}

async function ghcrLoginOnVps() {
  const pat = process.env.GHCR_PAT;
  if (!pat || !password) return;
  console.log('[3/4] docker login ghcr.io no VPS...');
  const owner = repo.split('/')[0];
  await sshExec(`echo '${pat.replace(/'/g, `'\\''`)}' | sudo docker login ghcr.io -u ${owner} --password-stdin`);
}

function setGithubSecrets(privateKey) {
  if (!ghAvailable()) {
    console.warn('[4/4] gh CLI não autenticado — configure secrets manualmente no GitHub:');
    console.log(`
  Settings → Environments → production → Secrets:
    DEPLOY_HOST     = ${host}
    DEPLOY_USER     = ${user}
    DEPLOY_PATH     = ${deployPath}
    DEPLOY_SSH_KEY  = (conteúdo de ${keyPath})
    GHCR_PAT        = PAT com read:packages (github.com/settings/tokens)
`);
    return;
  }
  console.log('[4/4] Gravando secrets no repositório GitHub...');
  const set = (name, value) => {
    const r = spawnSync('gh', ['secret', 'set', name, '--body', value], {
      stdio: 'inherit',
      cwd: root,
    });
    if (r.status !== 0) {
      console.error(`Falha ao gravar secret ${name}`);
      process.exit(1);
    }
  };
  set('DEPLOY_HOST', host);
  set('DEPLOY_USER', user);
  set('DEPLOY_PATH', deployPath);
  set('DEPLOY_SSH_KEY', privateKey);
  if (process.env.GHCR_PAT) set('GHCR_PAT', process.env.GHCR_PAT);
  console.log('Secrets gravados no repositório.');
}

async function main() {
  const { privateKey, publicKey } = ensureKeyPair();
  await installPublicKey(publicKey);
  await ghcrLoginOnVps();
  setGithubSecrets(privateKey);
  console.log(`
Pronto. Fluxo rápido a partir de agora:
  git push origin main   → GitHub builda + deploy automático (~5–8 min total)
  ou Actions → Deploy → Run workflow

Imagem: ghcr.io/${repo}:<sha> e :latest
`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
