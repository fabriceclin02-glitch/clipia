// Stockage JSON atomique — aucune dépendance, aucun binaire natif.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './env.js';

const FILE = path.join(DATA_DIR, 'clipia.json');
const EMPTY = {
  users: [], sessions: [], projects: [], jobs: [], assets: [],
  connections: [], events: [], usage: [], settings: {}, workflows: [],
  atelier_projets: [], atelier_agents: [], atelier_executions: [], archive: [], conversations: [], workflows: [], autonome_runs: [], travaux: []
};

let db = null;
function load() {
  if (db) return db;
  if (fs.existsSync(FILE)) {
    try { db = { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
    catch { try { fs.copyFileSync(FILE, FILE + '.corrompu-' + Date.now()); } catch {} db = structuredClone(EMPTY); }
  } else db = structuredClone(EMPTY);
  return db;
}
let pending = null;
function ecrire() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const contenu = JSON.stringify(db, null, 2);
  const tmp = FILE + '.tmp';
  for (let essai = 0; essai < 5; essai++) {
    try {
      fs.writeFileSync(tmp, contenu);
      fs.renameSync(tmp, FILE);
      return true;
    } catch (e) {
      // Windows : antivirus ou indexeur qui tient le fichier une fraction de seconde
      try { fs.writeFileSync(FILE, contenu); return true; } catch {}
      const t = Date.now(); while (Date.now() - t < 40 * (essai + 1)) { /* courte attente */ }
    }
  }
  console.error('[clipia] enregistrement impossible : ' + FILE);
  return false;
}
function save() {
  if (pending) return;
  pending = setTimeout(() => { pending = null; try { ecrire(); } catch (e) { console.error('[clipia] enregistrement :', e.message); } }, 25);
}
export function flush() {
  if (pending) { clearTimeout(pending); pending = null; }
  if (db) { try { ecrire(); } catch {} }
}

export const uid = (p = 'id') => `${p}_${crypto.randomBytes(9).toString('hex')}`;

export const store = {
  all(coll) { return load()[coll] || []; },
  find(coll, fn) { return this.all(coll).find(fn); },
  filter(coll, fn) { return this.all(coll).filter(fn); },
  insert(coll, doc) {
    const d = load();
    const row = { id: doc.id || uid(coll.slice(0, 3)), createdAt: new Date().toISOString(), ...doc };
    d[coll].push(row); save(); return row;
  },
  update(coll, id, patch) {
    const rows = this.all(coll); const i = rows.findIndex(r => r.id === id);
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
    save(); return rows[i];
  },
  remove(coll, id) {
    const d = load(); const before = d[coll].length;
    d[coll] = d[coll].filter(r => r.id !== id); save(); return d[coll].length < before;
  },
  garder(coll, fn) { const d = load(); const avant = d[coll].length; d[coll] = d[coll].filter(fn); save(); return avant - d[coll].length; },
  setting(k, v) { const d = load(); if (v === undefined) return d.settings[k]; d.settings[k] = v; save(); return v; },
  settings() { return load().settings; }
};
