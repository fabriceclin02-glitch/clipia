// Coffre de secrets : AES-256-GCM, chiffré au repos, jamais exposé au client.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './env.js';

const FILE = path.join(DATA_DIR, 'vault.enc');
const ALG = 'aes-256-gcm';

const key = () => Buffer.from(process.env.CLIPIA_MASTER_KEY, 'hex');

function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALG, key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}
function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv(ALG, key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
}

let cache = null;
function read() {
  if (cache) return cache;
  if (!fs.existsSync(FILE)) { cache = {}; return cache; }
  try { cache = decrypt(fs.readFileSync(FILE, 'utf8')); }
  catch { console.error('[vault] déchiffrement impossible — clé maîtresse différente ?'); cache = {}; }
  return cache;
}
function write() { fs.writeFileSync(FILE, encrypt(cache || {}), { mode: 0o600 }); }

export const vault = {
  /** Lit un secret : coffre d'abord, variables d'environnement ensuite. */
  get(id) { const v = read()[id]; return v && v.value ? v.value : ''; },
  /** Secret effectif pour un fournisseur : coffre > .env */
  resolve(id, envKey) { return this.get(id) || (envKey ? (process.env[envKey] || '') : ''); },
  set(id, value, meta = {}) {
    read(); cache[id] = { value, updatedAt: new Date().toISOString(), ...meta }; write();
    return true;
  },
  remove(id) { read(); delete cache[id]; write(); return true; },
  /** Inventaire SANS valeurs — c'est tout ce que le navigateur reçoit. */
  inventory() {
    const r = read();
    return Object.entries(r).map(([id, v]) => ({
      id, updatedAt: v.updatedAt || null, hint: v.value ? mask(v.value) : '', label: v.label || id
    }));
  },
  has(id, envKey) { return Boolean(this.resolve(id, envKey)); }
};

export function mask(s) {
  if (!s) return '';
  if (s.length <= 8) return '•'.repeat(s.length);
  return s.slice(0, 4) + '•'.repeat(Math.min(12, s.length - 8)) + s.slice(-4);
}
