/* CLIPIA — Applique une restauration en attente AVANT que le stockage ne soit chargé (importé en premier). */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './env.js';

export const STAGE = path.join(DATA_DIR, '.restauration');
const GARDER = new Set(['.restauration', 'sauvegardes']);

function copier(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copier(s, d); }
    else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); }
  }
}
export function appliquer() {
  const pret = path.join(STAGE, 'PRET'), contenu = path.join(STAGE, 'contenu');
  if (!fs.existsSync(pret) || !fs.existsSync(contenu)) return false;
  try {
    const filet = path.join(DATA_DIR, 'avant-restauration-' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(filet, { recursive: true });
    for (const e of fs.readdirSync(DATA_DIR)) {
      if (GARDER.has(e) || e.startsWith('avant-restauration-')) continue;
      fs.renameSync(path.join(DATA_DIR, e), path.join(filet, e));        // rien n'est supprimé : tout est mis de côté
    }
    copier(contenu, DATA_DIR);
    fs.rmSync(STAGE, { recursive: true, force: true });
    console.log('[sauvegarde] restauration appliquée. Ancien contenu conservé dans ' + filet);
    return true;
  } catch (e) { console.error('[sauvegarde] restauration impossible :', e.message); return false; }
}
appliquer();
