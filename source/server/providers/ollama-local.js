/**
 * CLIPIA — Gestion d'Ollama sans ligne de commande.
 *
 * Choix : on n'embarque pas Ollama dans l'archive (près d'un gigaoctet, et une
 * version figée qui vieillit mal). Clipia le trouve, le démarre, et au besoin
 * le télécharge depuis le site officiel — pour l'utilisateur, le résultat est
 * le même qu'un logiciel embarqué, sans le poids.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { baseUrl, byId } from './registry.js';
import { store } from '../lib/store.js';

let processus = null;

/** Emplacements habituels du binaire selon le système. */
function cheminsPossibles() {
  const home = os.homedir();
  if (process.platform === 'win32') return [
    path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
    path.join(home, 'AppData', 'Local', 'Ollama', 'ollama.exe')
  ];
  if (process.platform === 'darwin') return [
    '/usr/local/bin/ollama', '/opt/homebrew/bin/ollama',
    '/Applications/Ollama.app/Contents/Resources/ollama'
  ];
  return ['/usr/local/bin/ollama', '/usr/bin/ollama', path.join(home, '.local/bin/ollama')];
}

/** Le binaire, qu'il soit dans le PATH ou à un emplacement connu. */
export function trouverBinaire() {
  const ou = process.platform === 'win32' ? 'where' : 'which';
  try {
    const r = spawnSync(ou, ['ollama'], { encoding: 'utf8', windowsHide: true });
    const l = (r.stdout || '').split(/\r?\n/).find(x => x.trim());
    if (l && fs.existsSync(l.trim())) return l.trim();
  } catch {}
  return cheminsPossibles().find(p => fs.existsSync(p)) || null;
}

export async function repond() {
  try {
    const r = await fetch(baseUrl(byId('ollama')) + '/api/tags', { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch { return false; }
}

export async function etat() {
  const bin = trouverBinaire();
  const actif = await repond();
  let modeles = [];
  if (actif) {
    try {
      const j = await (await fetch(baseUrl(byId('ollama')) + '/api/tags')).json();
      modeles = (j.models || []).map(m => ({ nom: m.name, octets: m.size }));
    } catch {}
  }
  return {
    installe: Boolean(bin), binaire: bin, actif, modeles,
    demarreParClipia: Boolean(processus && !processus.killed),
    plateforme: process.platform
  };
}

/** Démarre le serveur Ollama en arrière-plan. */
export async function demarrer() {
  if (await repond()) return { deja: true, actif: true };
  const bin = trouverBinaire();
  if (!bin) throw new Error("Ollama n'est pas installé sur cette machine.");

  processus = spawn(bin, ['serve'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' }
  });
  processus.unref?.();
  store.insert('events', { type: 'ollama.demarre' });

  // Ollama met quelques secondes à ouvrir son port.
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 600));
    if (await repond()) return { actif: true, demarre: true };
  }
  throw new Error("Ollama a été lancé mais n'a pas répondu en 15 secondes.");
}

export function arreter() {
  if (processus && !processus.killed) { processus.kill(); processus = null; return { arrete: true }; }
  return { arrete: false, raison: "Ollama n'a pas été démarré par Clipia." };
}

/** Adresse de l'installateur officiel selon le système. */
export function lienInstallateur() {
  if (process.platform === 'win32') return { url: 'https://ollama.com/download/OllamaSetup.exe', fichier: 'OllamaSetup.exe', taille: '~700 Mo' };
  if (process.platform === 'darwin') return { url: 'https://ollama.com/download/Ollama-darwin.zip', fichier: 'Ollama-darwin.zip', taille: '~450 Mo' };
  return { url: 'https://ollama.com/install.sh', fichier: 'install.sh', taille: 'script' };
}

/** Télécharge l'installateur officiel et le lance. */
export async function installer(onProgres) {
  const { url, fichier } = lienInstallateur();
  const dest = path.join(os.tmpdir(), fichier);

  onProgres({ etape: 'telechargement', pct: 0 });
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`Téléchargement refusé (${r.status}).`);
  const total = Number(r.headers.get('content-length') || 0);

  const flux = fs.createWriteStream(dest);
  const rd = r.body.getReader();
  let recu = 0, dernier = -1;
  while (true) {
    const { done, value } = await rd.read();
    if (done) break;
    flux.write(Buffer.from(value));
    recu += value.length;
    const pct = total ? Math.round(recu / total * 100) : null;
    if (pct !== dernier) { dernier = pct; onProgres({ etape: 'telechargement', pct, recu, total }); }
  }
  await new Promise(res => flux.end(res));

  onProgres({ etape: 'installation', pct: 100 });
  if (process.platform === 'win32') {
    spawn(dest, ['/SILENT'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return { lance: true, message: "L'installateur Ollama s'exécute. Patientez une minute, puis revérifiez." };
  }
  if (process.platform === 'linux') {
    spawn('sh', [dest], { detached: true, stdio: 'ignore' }).unref();
    return { lance: true, message: 'Installation en cours.' };
  }
  return { lance: false, fichier: dest,
    message: `Archive téléchargée dans ${dest}. Ouvrez-la et glissez Ollama dans Applications.` };
}
