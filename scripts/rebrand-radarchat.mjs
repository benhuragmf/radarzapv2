#!/usr/bin/env node
/**
 * Substitui RadarZap/radarzap/RADARZAP por Radar Chat / radarchat / RADARCHAT.
 * Uso: node scripts/rebrand-radarchat.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'sessions',
  'data',
  'test-results',
  'mocker',
  'coverage',
]);

const SKIP_FILES = new Set(['package-lock.json', 'rebrand-radarchat.mjs']);

const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot']);

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name);
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name)) continue;
      walk(path.join(dir, ent.name), out);
      continue;
    }
    const full = path.join(dir, ent.name);
    const ext = path.extname(ent.name).toLowerCase();
    if (SKIP_FILES.has(ent.name) || SKIP_EXT.has(ext)) continue;
    out.push(full);
  }
  return out;
}

function transform(content) {
  let s = content;
  // Ordem: variantes específicas antes das genéricas
  s = s.replace(/RadarZap/g, 'Radar Chat');
  s = s.replace(/RADARZAP/g, 'RADARCHAT');
  s = s.replace(/radarzap/g, 'radarchat');
  // URL legado Firebase (radar-zap → radar-chat)
  s = s.replace(/radar-zap\.web\.app/g, 'radar-chat.web.app');
  return s;
}

const files = walk(ROOT);
let changed = 0;

for (const file of files) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (!/radarzap|RadarZap|RADARZAP/i.test(raw)) continue;
  const next = transform(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next, 'utf8');
    changed += 1;
  }
}

console.log(`Rebrand concluído: ${changed} arquivo(s) alterado(s).`);
