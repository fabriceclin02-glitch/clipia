/**
 * CLIPIA X8 — Communauté et évolution.
 * Vérifie s'il existe une version plus récente (liens.json publié sur le site GitHub) et prépare
 * les adresses GitHub pour proposer une idée ou signaler un bug (la personne valide elle-même sur GitHub).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store } from '../lib/store.js';

export const DEPOT = 'fabriceclin02-glitch/clipia';
export const SITE = 'https://fabriceclin02-glitch.github.io/clipia/';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const versionInstallee = () => { try { return JSON.parse(fs.readFileSync(path.join(RACINE, 'package.json'), 'utf8')).version; } catch { return '0.0.0'; } };
const num = v => String(v || '0').split('.').map(x => parseInt(x, 10) || 0);
export function plusRecent(a, b) { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }

export async function verifierMaj({ force = false } = {}) {
  const cache = store.setting('x8.maj');
  if (!force && cache && Date.now() - cache.t < 6 * 3600 * 1000) return { ...cache.v, cache: true };
  const actuelle = versionInstallee();
  let v;
  try {
    const r = await fetch(SITE + 'liens.json?t=' + Date.now(), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    v = { actuelle, derniere: j.version, nouvelle: plusRecent(j.version, actuelle), fichiers: j.fichiers || {}, page: SITE, notes: j.notes || '', releases: `https://github.com/${DEPOT}/releases` };
  } catch (e) { v = { actuelle, derniere: null, nouvelle: false, erreur: "Impossible de joindre GitHub pour l'instant (" + String(e.message).slice(0, 80) + ').', page: SITE, releases: `https://github.com/${DEPOT}/releases` }; }
  if (!v.erreur) store.setting('x8.maj', { t: Date.now(), v });
  return v;
}

export function adresseIdee({ titre = '', texte = '', type = 'idee' } = {}) {
  const base = `https://github.com/${DEPOT}/issues/new`;
  const q = new URLSearchParams({ template: type === 'bug' ? 'bug.yml' : 'idee.yml', title: String(titre).slice(0, 120), ...(texte ? { besoin: String(texte).slice(0, 1500) } : {}) });
  return `${base}?${q}`;
}
export const liens = () => ({ depot: `https://github.com/${DEPOT}`, idees: `https://github.com/${DEPOT}/issues?q=is%3Aissue+label%3Aidee`, discussions: `https://github.com/${DEPOT}/discussions`, versions: `https://github.com/${DEPOT}/releases`, contribuer: `https://github.com/${DEPOT}/blob/main/CONTRIBUTING.md`, site: SITE });
