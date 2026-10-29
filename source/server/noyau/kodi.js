/** CLIPIA X8 — Kodi piloté à la voix.
 *  Kodi (centre multimédia libre) s'installe depuis la Logithèque ou l'installateur. Clipia le commande ensuite par son interface
 *  JSON-RPC locale (http://127.0.0.1:8080). Cette interface est désactivée par défaut dans Kodi : l'action « activer » la
 *  met en marche (avec un mot de passe aléatoire gardé dans les données de Clipia) — uniquement avec l'accord de la personne.
 *  Clipia ne fournit aucun contenu : elle pilote le Kodi de la personne (ses fichiers, ses extensions légales). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { DATA_DIR } from '../lib/env.js';

const PF = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
const FICHIER = path.join(DATA_DIR, 'kodi.json');
const lire = () => { try { return JSON.parse(fs.readFileSync(FICHIER, 'utf8')); } catch { return {}; } };
const ecrire = (o) => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FICHIER, JSON.stringify(o), { mode: 0o600 }); };

export function binaire() {
  const cands = PF === 'win'
    ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Kodi', 'kodi.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Kodi', 'kodi.exe')]
    : PF === 'mac' ? ['/Applications/Kodi.app/Contents/MacOS/Kodi'] : [];
  for (const c of cands) if (fs.existsSync(c)) return c;
  if (PF === 'linux') { const r = spawnSync('which', ['kodi'], { encoding: 'utf8' }); if (r.status === 0) return r.stdout.trim(); }
  return null;
}
const dossierReglages = () => PF === 'win' ? path.join(process.env.APPDATA || '', 'Kodi', 'userdata')
  : PF === 'mac' ? path.join(os.homedir(), 'Library', 'Application Support', 'Kodi', 'userdata') : path.join(os.homedir(), '.kodi', 'userdata');

export function ouvrir() {
  const b = binaire();
  if (!b) throw new Error('Kodi n\'est pas installé : installe-le depuis la Logithèque (catégorie Vidéo) ou relance l\'installateur de Clipia.');
  const p = spawn(b, PF === 'linux' ? [] : [], { detached: true, stdio: 'ignore' }); p.unref();
  return 'Kodi est lancé.';
}

async function rpc(methode, params = {}, ms = 5000) {
  const c = lire(); const port = c.port || 8080;
  const h = { 'content-type': 'application/json' };
  if (c.mdp) h.authorization = 'Basic ' + Buffer.from(`${c.utilisateur || 'clipia'}:${c.mdp}`).toString('base64');
  let r;
  try { r = await fetch(`http://127.0.0.1:${port}/jsonrpc`, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: methode, params }), signal: AbortSignal.timeout(ms) }); }
  catch { throw new Error('Kodi ne répond pas. Il est peut-être fermé (action « ouvrir »), ou sa commande à distance est désactivée (action « activer », avec ton accord).'); }
  if (r.status === 401) throw new Error('Kodi refuse l\'accès : relance l\'action « activer » pour resynchroniser le mot de passe.');
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error('Kodi : ' + (j.error.message || 'erreur'));
  return j.result;
}

/** Active le serveur web de Kodi (réglages écrits dans guisettings.xml ; Kodi doit être fermé). */
export function activer() {
  const d = dossierReglages(); const f = path.join(d, 'guisettings.xml');
  if (!fs.existsSync(f)) throw new Error('Kodi n\'a jamais été lancé : ouvre-le une fois (action « ouvrir »), ferme-le, puis recommence.');
  if (PF === 'win' ? /kodi\.exe/i.test(spawnSync('tasklist', { encoding: 'utf8' }).stdout || '') : spawnSync('pgrep', ['-x', PF === 'mac' ? 'Kodi' : 'kodi.bin']).status === 0 || (PF === 'linux' && spawnSync('pgrep', ['-x', 'kodi']).status === 0))
    throw new Error('Ferme Kodi d\'abord (il réécrit ses réglages en quittant), puis recommence.');
  const c = lire(); const mdp = c.mdp || crypto.randomBytes(9).toString('base64url'); const utilisateur = 'clipia'; const port = c.port || 8080;
  let x = fs.readFileSync(f, 'utf8'); fs.copyFileSync(f, f + '.clipia-avant');
  const regler = (id, v) => {
    const re = new RegExp(`<setting id="${id.replace(/\./g, '\\.')}"[^>]*?(/>|>[^<]*</setting>)`);
    const ligne = `<setting id="${id}">${v}</setting>`;
    x = re.test(x) ? x.replace(re, ligne) : x.replace('</settings>', `    ${ligne}\n</settings>`);
  };
  regler('services.webserver', 'true'); regler('services.webserverport', port); regler('services.webserverauthentication', 'true');
  regler('services.webserverusername', utilisateur); regler('services.webserverpassword', mdp);
  fs.writeFileSync(f, x); ecrire({ utilisateur, mdp, port });
  return 'La commande à distance de Kodi est activée (mot de passe aléatoire gardé par Clipia). Relance Kodi : « ouvre Kodi ».';
}

const TOUCHES = { haut: 'Input.Up', bas: 'Input.Down', gauche: 'Input.Left', droite: 'Input.Right', ok: 'Input.Select', valider: 'Input.Select', retour: 'Input.Back', accueil: 'Input.Home', info: 'Input.Info', menu: 'Input.ContextMenu' };
const FENETRES = { films: 'videos', videos: 'videos', musique: 'music', photos: 'pictures', images: 'pictures', tv: 'tvchannels', radio: 'radiochannels', extensions: 'addonbrowser', reglages: 'settings', meteo: 'weather', accueil: 'home' };
const joueur = async () => { const l = await rpc('Player.GetActivePlayers'); return l?.[0]?.playerid ?? null; };

export async function piloter({ action, valeur, chemin }) {
  const a = String(action || '').toLowerCase().trim();
  if (a === 'ouvrir') return ouvrir();
  if (a === 'etat') {
    const id = await joueur(); const v = await rpc('Application.GetProperties', { properties: ['volume', 'muted'] });
    if (id == null) return `Kodi est ouvert, rien en lecture. Volume ${v.volume} %${v.muted ? ' (muet)' : ''}.`;
    const it = await rpc('Player.GetItem', { playerid: id, properties: ['title', 'artist', 'file'] });
    const p = await rpc('Player.GetProperties', { playerid: id, properties: ['speed', 'percentage'] });
    return `${p.speed ? 'Lecture' : 'En pause'} : « ${it.item?.title || it.item?.label || it.item?.file || 'sans titre'} » (${Math.round(p.percentage || 0)} %). Volume ${v.volume} %.`;
  }
  if (a === 'lecture' || a === 'pause' || a === 'play') { const id = await joueur(); if (id == null) throw new Error('Rien n\'est en lecture : ouvre un contenu (films, musique…) ou utilise « jouer ».'); await rpc('Player.PlayPause', { playerid: id }); return 'Lecture / pause basculée.'; }
  if (a === 'stop' || a === 'arreter') { const id = await joueur(); if (id == null) return 'Rien à arrêter.'; await rpc('Player.Stop', { playerid: id }); return 'Lecture arrêtée.'; }
  if (a === 'suivant' || a === 'precedent') { const id = await joueur(); if (id == null) throw new Error('Rien n\'est en lecture.'); await rpc('Player.GoTo', { playerid: id, to: a === 'suivant' ? 'next' : 'previous' }); return a === 'suivant' ? 'Piste suivante.' : 'Piste précédente.'; }
  if (a === 'avancer' || a === 'reculer') { const id = await joueur(); if (id == null) throw new Error('Rien n\'est en lecture.'); await rpc('Player.Seek', { playerid: id, value: { step: a === 'avancer' ? 'bigforward' : 'bigbackward' } }); return a === 'avancer' ? 'J\'avance d\'un bond.' : 'Je recule d\'un bond.'; }
  if (a === 'volume') {
    const v = String(valeur ?? '').toLowerCase();
    if (v === 'plus' || v === 'monter') { await rpc('Application.SetVolume', { volume: 'increment' }); return 'Volume augmenté.'; }
    if (v === 'moins' || v === 'baisser') { await rpc('Application.SetVolume', { volume: 'decrement' }); return 'Volume baissé.'; }
    const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Volume : un nombre de 0 à 100, ou « plus » / « moins ».');
    await rpc('Application.SetVolume', { volume: n }); return `Volume réglé à ${n} %.`;
  }
  if (a === 'muet') { await rpc('Application.SetMute', { mute: 'toggle' }); return 'Son coupé / rétabli.'; }
  if (TOUCHES[a]) { await rpc(TOUCHES[a]); return `Touche « ${a} » envoyée.`; }
  if (a === 'aller') {
    const w = FENETRES[String(valeur || '').toLowerCase().trim()]; if (!w) throw new Error(`Où aller ? ${Object.keys(FENETRES).join(', ')}.`);
    await rpc('GUI.ActivateWindow', { window: w }); return `Kodi affiche : ${valeur}.`;
  }
  if (a === 'jouer') {
    const c = String(chemin || '').trim(); if (!c) throw new Error('Il faut un chemin de fichier ou une adresse http(s).');
    if (!/^https?:\/\//i.test(c) && !fs.existsSync(c)) throw new Error('Fichier introuvable : ' + c);
    await rpc('Player.Open', { item: { file: c } }); return 'Lecture lancée.';
  }
  if (a === 'quitter') { await rpc('Application.Quit'); return 'Kodi est fermé.'; }
  throw new Error('Action inconnue. Actions : ouvrir, activer, etat, lecture, pause, stop, suivant, precedent, avancer, reculer, volume, muet, haut, bas, gauche, droite, ok, retour, accueil, menu, info, aller, jouer, quitter.');
}
