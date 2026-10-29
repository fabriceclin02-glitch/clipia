/**
 * CLIPIA — Sauvegarde de TON IA : tout ce qui fait ta Clipia (conversations, mémoire, projets, médias, réglages,
 * compétences) dans un seul fichier « .clipiabak », compressé et — si tu mets un mot de passe — chiffré (AES-256-GCM).
 *
 * Où l'envoyer : un dossier (clé USB, dossier synchronisé Dropbox / MEGA / OneDrive), Dropbox directement
 * (jeton saisi par toi dans le coffre), ou simple téléchargement. MEGA n'a pas d'API publique simple : on passe par
 * le dossier de l'application MEGA, qui synchronise ensuite tout seul.
 * Les clés et mots de passe (coffre) ne sont inclus QUE si tu choisis un mot de passe de sauvegarde.
 * Restaurer : le contenu est d'abord vérifié et déposé en attente ; il est appliqué au prochain démarrage, et
 * l'ancien contenu est mis de côté (jamais supprimé).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { DATA_DIR } from '../lib/env.js';
import { store, flush } from '../lib/store.js';
import { vault } from '../lib/vault.js';
import { STAGE } from '../lib/restauration.js';

export const EXT = '.clipiabak';
const MAGIC = Buffer.from('CLIPIABAK1');
export const DOSSIER_LOCAL = path.join(DATA_DIR, 'sauvegardes');
const SECRETS = new Set(['secrets.json', 'vault.enc', 'extension-jeton.txt']);
const IGNORER = (rel) => /^(\.restauration|sauvegardes|avant-restauration-[^/]*)(\/|$)/.test(rel) || /\.corrompu-\d+$/.test(rel) || /\.tmp$/.test(rel);
const DROPBOX = () => process.env.CLIPIA_API_DROPBOX || 'https://api.dropboxapi.com';
const DROPBOX_C = () => process.env.CLIPIA_API_DROPBOX_CONTENT || 'https://content.dropboxapi.com';
const nomFichier = () => 'clipia-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, m => m === 'T' ? '-' : '') + EXT;

function parcourir(dir, base = '', out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    if (IGNORER(rel)) continue;
    if (e.isDirectory()) parcourir(path.join(dir, e.name), rel, out);
    else if (e.isFile()) out.push(rel);
  }
  return out;
}
async function ecrire(flux, buf) { if (!flux.write(buf)) await once(flux, 'drain'); }

/** Crée la sauvegarde dans `dossier`. Renvoie {fichier, octets, fichiers, chiffre, secrets}. */
export async function creer({ dossier = DOSSIER_LOCAL, motdepasse = '' } = {}) {
  try { flush(); } catch {}
  const chiffre = Boolean(motdepasse);
  fs.mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, nomFichier());
  const tmp = fichier + '.tmp';
  const sortie = fs.createWriteStream(tmp);
  const fin = once(sortie, 'close');
  let flux = sortie, cle = null, iv = null, salt = null, chif = null;
  sortie.write(MAGIC);
  sortie.write(Buffer.from([chiffre ? 1 : 0]));
  const gz = zlib.createGzip({ level: 6 });
  if (chiffre) {
    salt = crypto.randomBytes(16); iv = crypto.randomBytes(12);
    cle = crypto.scryptSync(motdepasse, salt, 32);
    sortie.write(salt); sortie.write(iv);
    chif = crypto.createCipheriv('aes-256-gcm', cle, iv);
    gz.pipe(chif).pipe(sortie, { end: false });
    flux = gz;
  } else { gz.pipe(sortie, { end: false }); flux = gz; }
  const fini = new Promise((ok, ko) => { (chif || gz).on('end', ok); gz.on('error', ko); if (chif) chif.on('error', ko); });
  let n = 0;
  try {
    for (const rel of parcourir(DATA_DIR)) {
      if (SECRETS.has(rel) && !chiffre) continue;
      const abs = path.join(DATA_DIR, rel); let st; try { st = fs.statSync(abs); } catch { continue; }
      const nom = Buffer.from(rel, 'utf8'), tete = Buffer.alloc(4 + nom.length + 8);
      tete.writeUInt32BE(nom.length, 0); nom.copy(tete, 4); tete.writeBigUInt64BE(BigInt(st.size), 4 + nom.length);
      await ecrire(flux, tete);
      let lus = 0;
      for await (const c of fs.createReadStream(abs)) { const k = Math.min(c.length, st.size - lus); if (k <= 0) break; lus += k; await ecrire(flux, k === c.length ? c : c.subarray(0, k)); }
      if (lus < st.size) await ecrire(flux, Buffer.alloc(st.size - lus));
      n++;
    }
    flux.end(); await fini;
    if (chif) sortie.write(chif.getAuthTag());
    sortie.end(); await fin;
    fs.renameSync(tmp, fichier);
  } catch (e) { try { sortie.destroy(); fs.rmSync(tmp, { force: true }); } catch {} throw e; }
  const octets = fs.statSync(fichier).size;
  store.setting('sauvegarde:derniere', { quand: new Date().toISOString(), fichier: path.basename(fichier), octets, chiffre });
  return { fichier, nom: path.basename(fichier), octets, fichiers: n, chiffre, secrets: chiffre };
}

/** Vérifie et dépose le contenu en attente (appliqué au prochain démarrage). */
export async function preparerRestauration(fichier, motdepasse = '') {
  const st = fs.statSync(fichier);
  const fd = fs.openSync(fichier, 'r');
  const tete = Buffer.alloc(11); fs.readSync(fd, tete, 0, 11, 0);
  if (!tete.subarray(0, 10).equals(MAGIC)) { fs.closeSync(fd); throw new Error("Ce fichier n'est pas une sauvegarde Clipia."); }
  const chiffre = tete[10] === 1;
  let debut = 11, fin = st.size, decip = null;
  if (chiffre) {
    if (!motdepasse) { fs.closeSync(fd); const e = new Error('Cette sauvegarde est protégée : entre son mot de passe.'); e.mdp = true; throw e; }
    const ent = Buffer.alloc(28); fs.readSync(fd, ent, 0, 28, 11);
    const tag = Buffer.alloc(16); fs.readSync(fd, tag, 0, 16, st.size - 16);
    decip = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(motdepasse, ent.subarray(0, 16), 32), ent.subarray(16, 28));
    decip.setAuthTag(tag); debut = 39; fin = st.size - 16;
  }
  fs.closeSync(fd);
  fs.rmSync(STAGE, { recursive: true, force: true });
  const contenu = path.join(STAGE, 'contenu'); fs.mkdirSync(contenu, { recursive: true });
  let src = fs.createReadStream(fichier, { start: debut, end: fin - 1 });
  const gunzip = zlib.createGunzip();
  let buf = Buffer.alloc(0), etat = 'tete', cur = null, reste = 0n, rel = '', n = 0;
  const sur = (r) => { const p = path.normalize(r); if (path.isAbsolute(p) || p.startsWith('..') || p.includes('\0') || IGNORER(r.replace(/\\/g, '/'))) throw new Error('Sauvegarde invalide (chemin refusé).'); return path.join(contenu, p); };
  try {
    await pipeline(src, ...(decip ? [decip] : []), gunzip, async function (chaine) {
    for await (const c of chaine) {
      buf = buf.length ? Buffer.concat([buf, c]) : c;
      for (;;) {
        if (etat === 'tete') {
          if (buf.length < 4) break; const l = buf.readUInt32BE(0);
          if (l === 0 || l > 1024) throw new Error('Sauvegarde corrompue.');
          if (buf.length < 4 + l + 8) break;
          rel = buf.subarray(4, 4 + l).toString('utf8'); reste = buf.readBigUInt64BE(4 + l); buf = buf.subarray(4 + l + 8);
          const dst = sur(rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); cur = fs.createWriteStream(dst); etat = 'data'; n++;
        }
        if (etat === 'data') {
          if (reste === 0n) { cur.end(); await once(cur, 'close'); cur = null; etat = 'tete'; continue; }
          if (!buf.length) break;
          const k = Number(reste < BigInt(buf.length) ? reste : BigInt(buf.length));
          await ecrire(cur, buf.subarray(0, k)); buf = buf.subarray(k); reste -= BigInt(k);
          if (reste === 0n) { cur.end(); await once(cur, 'close'); cur = null; etat = 'tete'; continue; }
          break;
        }
      }
    }
    if (etat === 'data' && reste === 0n && cur) { cur.end(); await once(cur, 'close'); etat = 'tete'; }
    if (etat !== 'tete' || buf.length) throw new Error('Sauvegarde incomplète.');
    });
  } catch (e) {
    try { cur?.destroy(); } catch {}
    fs.rmSync(STAGE, { recursive: true, force: true });
    if (decip && /authenticate|auth|decrypt|bad|Unsupported state/i.test(e.message)) { const x = new Error('Mot de passe incorrect, ou fichier abîmé.'); x.mdp = true; throw x; }
    throw e;
  }
  if (!n || !fs.existsSync(path.join(contenu, 'clipia.json'))) { fs.rmSync(STAGE, { recursive: true, force: true }); throw new Error("La sauvegarde ne contient pas les données de Clipia."); }
  fs.writeFileSync(path.join(STAGE, 'PRET'), new Date().toISOString());
  return { fichiers: n, secrets: fs.existsSync(path.join(contenu, 'vault.enc')) };
}
export const annulerRestauration = () => fs.rmSync(STAGE, { recursive: true, force: true });

// ── où sauvegarder ──────────────────────────────────────────────────────────
export function destinations() {
  const home = os.homedir(), d = [];
  const essais = [
    ['Dropbox (dossier synchronisé)', path.join(home, 'Dropbox')], ['MEGA (dossier synchronisé)', path.join(home, 'MEGA')],
    ['MEGA (dossier synchronisé)', path.join(home, 'MEGAsync')], ['OneDrive', path.join(home, 'OneDrive')], ['Google Drive', path.join(home, 'Google Drive')],
    ['Documents', path.join(home, 'Documents')]];
  for (const [nom, p] of essais) if (fs.existsSync(p)) d.push({ nom, type: 'dossier', chemin: p });
  if (process.platform === 'win32') for (const L of 'DEFGHIJKLMNOPQRSTUVWXYZ') { const p = L + ':\\'; if (fs.existsSync(p)) d.push({ nom: 'Lecteur ' + L + ': (clé USB ou disque)', type: 'usb', chemin: p }); }
  else for (const base of ['/Volumes', '/media/' + os.userInfo().username, '/media', '/run/media/' + os.userInfo().username, '/mnt']) {
    try { for (const e of fs.readdirSync(base, { withFileTypes: true })) if (e.isDirectory() && !(base === '/Volumes' && e.name === 'Macintosh HD')) d.push({ nom: 'Clé / disque : ' + e.name, type: 'usb', chemin: path.join(base, e.name) }); } catch {}
  }
  return d;
}
export function liste(dossier) {
  try { return fs.readdirSync(dossier).filter(f => f.endsWith(EXT)).map(f => { const s = fs.statSync(path.join(dossier, f)); return { nom: f, octets: s.size, quand: s.mtime.toISOString(), dossier }; }).sort((a, b) => b.quand.localeCompare(a.quand)); } catch { return []; }
}
export const cheminLocal = nom => { if (!/^[\w.-]+$/.test(nom) || !nom.endsWith(EXT)) throw new Error('Nom invalide.'); return path.join(DOSSIER_LOCAL, nom); };

// ── Dropbox (jeton saisi par l'utilisateur dans le coffre : « sauvegarde:dropbox ») ─────────
const jeton = () => vault.resolve('sauvegarde:dropbox', 'CLIPIA_DROPBOX_TOKEN');
export const dropboxPret = () => Boolean(jeton());
export async function dropboxEnvoyer(fichier) {
  if (!jeton()) throw new Error("Colle d'abord ton jeton Dropbox dans le coffre (« sauvegarde:dropbox »).");
  const st = fs.statSync(fichier); if (st.size > 140 * 1024 * 1024) throw new Error('Plus de 140 Mo : utilise le dossier Dropbox synchronisé (ou la clé USB) pour cette taille.');
  const r = await fetch(DROPBOX_C() + '/2/files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton(), 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: '/Clipia/' + path.basename(fichier), mode: 'overwrite', mute: true }) }, body: fs.readFileSync(fichier) });
  if (!r.ok) throw new Error('Dropbox a refusé (' + r.status + ') : ' + (await r.text()).slice(0, 160));
  return { ok: true, chemin: '/Clipia/' + path.basename(fichier) };
}
export async function dropboxListe() {
  const r = await fetch(DROPBOX() + '/2/files/list_folder', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton(), 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/Clipia' }) });
  if (!r.ok) { if (r.status === 409) return []; throw new Error('Dropbox a refusé (' + r.status + ').'); }
  return ((await r.json()).entries || []).filter(e => e.name.endsWith(EXT)).map(e => ({ nom: e.name, octets: e.size, quand: e.server_modified })).sort((a, b) => b.quand.localeCompare(a.quand));
}
export async function dropboxRecuperer(nom) {
  if (!/^[\w.-]+$/.test(nom)) throw new Error('Nom invalide.');
  const r = await fetch(DROPBOX_C() + '/2/files/download', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton(), 'Dropbox-API-Arg': JSON.stringify({ path: '/Clipia/' + nom }) } });
  if (!r.ok) throw new Error('Dropbox a refusé (' + r.status + ').');
  fs.mkdirSync(DOSSIER_LOCAL, { recursive: true });
  const f = path.join(DOSSIER_LOCAL, nom); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f;
}

/** Ménage : garde les `garder` plus récentes dans le dossier. */
export function elaguer(dossier, garder = 7) { for (const f of liste(dossier).slice(garder)) try { fs.rmSync(path.join(dossier, f.nom)); } catch {} }
export const etat = () => ({ derniere: store.setting('sauvegarde:derniere') || null, dossierLocal: DOSSIER_LOCAL, locales: liste(DOSSIER_LOCAL), destinations: destinations(), dropbox: dropboxPret(), auto: store.setting('sauvegarde:auto') || null, enAttente: fs.existsSync(path.join(STAGE, 'PRET')) });

/** Sauvegarde automatique (réglée par l'utilisateur) : au plus une par jour, au démarrage puis toutes les heures. */
let minuterie = null;
export async function auto() {
  const a = store.setting('sauvegarde:auto'); if (!a || !a.actif) return null;
  const d = store.setting('sauvegarde:derniere');
  if (d && Date.now() - Date.parse(d.quand) < 23 * 3600000) return null;
  const dossier = a.dossier || DOSSIER_LOCAL;
  const r = await creer({ dossier, motdepasse: a.motdepasse ? vault.get('sauvegarde:motdepasse') : '' });
  elaguer(dossier, 7); return r;
}
export function demarrer() { if (minuterie) return; setTimeout(() => auto().catch(() => {}), 60000).unref?.(); minuterie = setInterval(() => auto().catch(() => {}), 3600000); minuterie.unref?.(); }
