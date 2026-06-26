#!/usr/bin/env node
/**
 * Executa comando remoto via SSH (senha via env VPS_PASSWORD — nunca commitar).
 * Uso: VPS_PASSWORD=... node scripts/vps-ssh-run.mjs "uname -a"
 *      VPS_PASSWORD=... node scripts/vps-ssh-run.mjs --upload scripts/vps-bootstrap-production.sh /tmp/bootstrap.sh
 */
import { readFileSync } from 'node:fs';
import { Client } from 'ssh2';

const host = process.env.VPS_HOST || '151.247.210.180';
const user = process.env.VPS_USER || 'ubuntu';
const password = process.env.VPS_PASSWORD;
const args = process.argv.slice(2);

if (!password) {
  console.error('Defina VPS_PASSWORD no ambiente.');
  process.exit(1);
}

function runRemote(conn, cmd) {
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

function upload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const data = readFileSync(localPath);
      sftp.writeFile(remotePath, data, { mode: 0o755 }, (e) => (e ? reject(e) : resolve()));
    });
  });
}

const conn = new Client();
conn
  .on('ready', async () => {
    try {
      if (args[0] === '--upload' && args.length >= 3) {
        await upload(conn, args[1], args[2]);
        console.log(`Uploaded ${args[1]} -> ${args[2]}`);
      } else {
        const cmd = args.join(' ') || 'echo connected';
        await runRemote(conn, cmd);
      }
      conn.end();
    } catch (e) {
      console.error(e.message || e);
      conn.end();
      process.exit(1);
    }
  })
  .on('error', (e) => {
    console.error('SSH error:', e.message);
    process.exit(1);
  })
  .connect({ host, port: 22, username: user, password, readyTimeout: 30000 });
