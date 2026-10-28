// Chargement .env sans dépendance externe
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = process.env.CLIPIA_DATA_DIR || path.join(ROOT, 'data');

function parseEnv(txt) {
  const out = {};
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

export function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (fs.existsSync(file)) {
    const vals = parseEnv(fs.readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(vals)) if (process.env[k] === undefined && v !== '') process.env[k] = v;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Auto-génération des secrets manquants, persistés hors du .env
  const secFile = path.join(DATA_DIR, 'secrets.json');
  let sec = {};
  if (fs.existsSync(secFile)) { try { sec = JSON.parse(fs.readFileSync(secFile, 'utf8')); } catch { sec = {}; } }
  let changed = false;
  if (!process.env.CLIPIA_MASTER_KEY) {
    if (!sec.masterKey) { sec.masterKey = crypto.randomBytes(32).toString('hex'); changed = true; }
    process.env.CLIPIA_MASTER_KEY = sec.masterKey;
  }
  if (!process.env.CLIPIA_JWT_SECRET) {
    if (!sec.jwtSecret) { sec.jwtSecret = crypto.randomBytes(48).toString('hex'); changed = true; }
    process.env.CLIPIA_JWT_SECRET = sec.jwtSecret;
  }
  if (changed) fs.writeFileSync(secFile, JSON.stringify(sec, null, 2), { mode: 0o600 });
  return process.env;
}

export const env = (k, d = '') => (process.env[k] && process.env[k] !== '' ? process.env[k] : d);
export const flag = (k, d = false) => { const v = env(k, ''); return v === '' ? d : /^(1|true|yes|on)$/i.test(v); };

/**
 * TROUVER FFMPEG, VRAIMENT.
 *
 * Sous Windows, « ffmpeg » tout court ne résout rien : le binaire n’est pas
 * dans le PATH. L’application cherchait donc une commande inexistante, et
 * TOUT ce qui touche au son ou à la vidéo échouait sans dire pourquoi —
 * les clips, les programmes sonores, le modem, les analyses.
 *
 * On cherche maintenant dans cet ordre, et on garde le premier qui répond
 * réellement à « -version » : un fichier qui existe mais ne s’exécute pas
 * ne compte pas.
 */
const CACHE_BIN = {};

/**
 * Chaque outil annonce sa version à sa façon : ffmpeg veut « -version »,
 * pdftoppm « -v », tesseract « --version ». Tester avec le mauvais drapeau
 * ferait passer un outil présent pour absent.
 */
const DRAPEAUX = {
  ffmpeg:['-version'], ffprobe:['-version'],
  convert:['-version'], magick:['-version'],
  pdftoppm:['-v'], pdftotext:['-v'], pdfinfo:['-v'],
  tesseract:['--version'], demucs:['--help'],
  qrencode:['--version'], exiftool:['-ver'], sox:['--version'],
  ollama:['--version'], python3:['--version']
};

function executable(chemin, nom) {
  const essais = DRAPEAUX[nom] ? [DRAPEAUX[nom]] : [['-version'], ['--version'], ['-v']];
  for (const args of essais) {
    try {
      const r = spawnSync(chemin, args, { timeout: 8000, stdio: 'ignore', windowsHide: true });
      // Beaucoup d’outils renvoient 0, certains 1 tout en fonctionnant :
      // ce qui compte est qu’ils aient démarré, donc l’absence d’erreur.
      if (!r.error && (r.status === 0 || r.status === 1)) return true;
    } catch { /* on essaie le drapeau suivant */ }
  }
  return false;
}

const TROUVES_NON_EXEC = {};

export function oublierBinaires() { for (const k of Object.keys(CACHE_BIN)) delete CACHE_BIN[k]; for (const k of Object.keys(TROUVES_NON_EXEC)) delete TROUVES_NON_EXEC[k]; }

export function binaire(nom) {
  if (CACHE_BIN[nom] !== undefined) return CACHE_BIN[nom];

  const variable = nom === 'ffmpeg' ? 'FFMPEG_BIN' : nom === 'ffprobe' ? 'FFPROBE_BIN' : null;
  const exe = process.platform === 'win32' ? `${nom}.exe` : nom;

  const pistes = [
    variable && process.env[variable],                    // réglage explicite
    path.join(DATA_DIR, 'outils', exe),                   // installé par Clipia elle-même (Installation guidée → Réparer)
    path.join(ROOT, 'outils', exe),                       // à côté du serveur
    path.join(ROOT, '..', 'outils', exe),                 // resources/app → app/..
    path.join(ROOT, '..', '..', 'outils', exe),           // resources/app → racine de l’installation
    path.join(ROOT, '..', '..', '..', 'outils', exe),
    path.join(path.dirname(process.execPath), 'outils', exe),
    path.join(path.dirname(process.execPath), exe),
    nom                                                    // dernier recours : le PATH
  ].filter(Boolean);

  for (const piste of pistes) {
    const absolu = piste === nom ? nom : path.resolve(piste);
    if (absolu !== nom && !fs.existsSync(absolu)) continue;
    if (executable(absolu, nom)) { CACHE_BIN[nom] = absolu; return absolu; }
    // Le fichier est là mais ne tourne pas : binaire d’un autre système,
    // droits manquants, ou antivirus qui le bloque. À dire, pas à taire.
    if (absolu !== nom) (TROUVES_NON_EXEC[nom] ||= []).push(absolu);
  }
  CACHE_BIN[nom] = null;
  return null;
}

/** Le chemin si on l’a, sinon le nom nu — l’appelant verra l’échec et le dira. */
export const ffmpegBin  = () => binaire('ffmpeg')  || 'ffmpeg';
export const ffprobeBin = () => binaire('ffprobe') || 'ffprobe';

/** Diagnostic honnête, affichable dans l’interface. */
export function etatOutils() {
  const f = binaire('ffmpeg'), p = binaire('ffprobe');
  const bloques = TROUVES_NON_EXEC.ffmpeg || [];
  return {
    ffmpeg: f, ffprobe: p, present: Boolean(f),
    presentsMaisBloques: bloques,
    quoi: f
      ? `ffmpeg trouvé : ${f}`
      : bloques.length
      ? `ffmpeg a été trouvé à ${bloques[0]} mais refuse de s’exécuter. Trois causes possibles : un antivirus le met en quarantaine, les droits d’exécution manquent, ou c’est un binaire destiné à un autre système. C’est le plus facile à corriger : lancez-le une fois à la main pour voir ce que Windows en dit.`
      : 'ffmpeg introuvable. Sans lui, aucun son ni aucune vidéo ne peut être produit : ni les programmes sonores, ni les clips, ni le modem, ni les analyses. Placez ffmpeg.exe et ffprobe.exe dans un dossier « outils » à côté de l’application, ou renseignez FFMPEG_BIN.'
  };
}
