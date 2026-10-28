#!/usr/bin/env node
/** CLIPIA — auto-test sans dépendance : syntaxe, garde-fous d'évolution, démarrage du serveur. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cheminAutorise, extraireJson, appliquerPlan } from './evolution.mjs';

const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let ok = 0; const t = (nom, f) => { f(); ok++; console.log('  ✓ ' + nom); };

// 1. Syntaxe de tous les JS
const js = [];
(function marche(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (['node_modules', 'data', 'dist', '.git', 'android', 'desktop'].includes(e.name)) continue;
  const p = path.join(d, e.name); e.isDirectory() ? marche(p) : /\.(js|mjs)$/.test(e.name) && js.push(p); } })(racine);
t(`syntaxe de ${js.length} fichiers`, () => { for (const f of js) { const r = spawnSync(process.execPath, ['--check', f]); assert.equal(r.status, 0, f + '\n' + r.stderr); } });

// 2. Garde-fous de l'agent d'évolution
t('chemins interdits refusés', () => {
  for (const p of ['../x', '/etc/passwd', '.github/workflows/x.yml', 'package.json', '.env', 'server/../.env', 'data/x', 'scripts/evolution.mjs', 'server/', 'a\\b', ''])
    assert.equal(cheminAutorise(p), false, p);
});
t('chemins autorisés acceptés', () => { for (const p of ['server/noyau/x.js', 'web/app.js', 'docs/a.md', 'README.md']) assert.equal(cheminAutorise(p), true, p); });
t('extraction JSON', () => { assert.deepEqual(extraireJson('```json\n{"a":1}\n```'), { a: 1 }); assert.equal(extraireJson('rien'), null); });
t('plan appliqué / ambigu refusé', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'evo-')); fs.mkdirSync(path.join(d, 'web'));
  fs.writeFileSync(path.join(d, 'web/a.js'), 'x=1;y=1;');
  assert.throws(() => appliquerPlan({ edits: [{ chemin: 'web/a.js', ancien: '1', nouveau: '2' }] }, d), /ambigu/);
  assert.throws(() => appliquerPlan({ fichiers: [{ chemin: '.github/workflows/p.yml', contenu: 'x' }] }, d), /refusé/);
  appliquerPlan({ edits: [{ chemin: 'web/a.js', ancien: 'x=1', nouveau: 'x=2' }], fichiers: [{ chemin: 'web/b.js', contenu: 'ok' }] }, d);
  assert.equal(fs.readFileSync(path.join(d, 'web/a.js'), 'utf8'), 'x=2;y=1;');
  fs.rmSync(d, { recursive: true });
});

// 3. Le serveur démarre et répond
const port = 4700 + Math.floor(Math.random() * 200);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipia-data-'));
const srv = spawn(process.execPath, ['server/index.js'], { cwd: racine, env: { ...process.env, PORT: String(port), CLIPIA_DATA_DIR: dataDir }, stdio: 'ignore' });
let vivant = false;
for (let i = 0; i < 40 && !vivant; i++) {
  await new Promise(r => setTimeout(r, 250));
  try { vivant = (await fetch(`http://127.0.0.1:${port}/api/etat`)).ok; } catch {}
}
srv.kill();
await new Promise(r => { srv.once('exit', r); setTimeout(r, 1500); });
t('le serveur répond sur /api/etat', () => assert.ok(vivant, 'serveur injoignable'));
try { fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
console.log(`\n${ok} vérifications réussies`);
