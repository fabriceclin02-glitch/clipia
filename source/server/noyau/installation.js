/**
 * CLIPIA V4 — Assistant d'installation : ce qui est prêt, ce qui manque, et comment l'obtenir.
 * Aucune clé ne peut être « obtenue » à la place de la personne (elle exige son compte) :
 * Clipia détecte, guide pas à pas, teste la clé collée, et installe ce qui s'installe sans compte.
 */
import { spawn, spawnSync } from 'node:child_process';
import { PROVIDERS, byId } from '../providers/registry.js';
import { credential } from '../providers/gateway.js';
import { etatOutils, DATA_DIR, oublierBinaires } from '../lib/env.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ollamaPresent } from '../providers/installeur.js';
import { store } from '../lib/store.js';
import * as ext from './extension.js';
import { profil } from './personnalite.js';

const a = (id) => { const p = byId(id); if (!p) return false; try { const c = credential(p); return Boolean(c) && c !== 'libre' && c !== 'local'; } catch { return false; } };
const trouve = (cmd, args = ['--version']) => { try { const r = spawnSync(cmd, args, { timeout: 8000, shell: process.platform === 'win32' }); return r.status === 0 ? String(r.stdout).trim().split('\n')[0].slice(0, 80) : ''; } catch { return ''; } };

export async function etat() {
  const oll = await ollamaPresent().catch(() => ({ ok: false }));
  const modeleQwen = (oll.modeles || []).some(m => /qwen/i.test(m.nom));
  const outils = etatOutils();
  const ignores = store.setting('installation.ignores') || [];
  const etapes = [
    { id: 'groq', fait: a('groq'), titre: 'Cerveau rapide : Groq (gratuit)', optionnel: false },
    { id: 'local', fait: modeleQwen, titre: 'Cerveau local : Qwen (hors ligne, sans clé)', optionnel: false, info: { ollama: oll.ok } },
    { id: 'claude', fait: a('anthropic'), titre: 'Claude (Anthropic) — raisonnement avancé', optionnel: true },
    { id: 'claudecode', fait: Boolean(trouve('claude')), titre: 'Claude Code — coder dans ton ordinateur', optionnel: true },
    { id: 'images', fait: PROVIDERS.some(p => (p.modalities || []).includes('image') && (p.sansCle || a(p.id))), titre: 'Images', optionnel: false },
    { id: 'video', fait: outils.present, titre: 'Vidéos (ffmpeg)', optionnel: false },
    { id: 'musique', fait: PROVIDERS.some(p => (p.modalities || []).includes('musique') && (p.sansCle || a(p.id))), titre: 'Musique', optionnel: true },
    { id: 'voix', fait: true, titre: 'Voix naturelle', optionnel: false },
    { id: 'code', fait: true, titre: 'Coder et se coder elle-même', optionnel: false },
    { id: 'agents', fait: true, titre: 'Agents, workflows, projets', optionnel: false },
    { id: 'ordinateur', fait: true, titre: 'Contrôle de l\'ordinateur (clavier, souris, applications)', optionnel: true },
    { id: 'chrome', fait: ext.connectee(), titre: 'Extension Chrome', optionnel: true }
  ].map(e => ({ ...e, ignore: ignores.includes(e.id) }));
  const cerveau = etapes.find(e => e.id === 'groq').fait || etapes.find(e => e.id === 'local').fait || PROVIDERS.some(p => p.tier === 'cloud-gratuit' && a(p.id));
  return { etapes, cerveau, termine: Boolean(store.setting('installation.termine')) || process.env.CLIPIA_SANS_ASSISTANT === '1', configure: Boolean(profil().configure) || process.env.CLIPIA_SANS_ASSISTANT === '1', plateforme: process.platform, extension: { dossier: ext.DOSSIER, connectee: ext.connectee() } };
}
export const ignorer = (id, oui = true) => {
  const l = new Set(store.setting('installation.ignores') || []); oui ? l.add(id) : l.delete(id);
  store.setting('installation.ignores', [...l]); return [...l];
};
export const terminer = () => store.setting('installation.termine', true);

/** Installe Claude Code (npm). Appelé seulement après un clic dans l'interface. */
export function installerClaudeCode(sortie) {
  return new Promise((ok, ko) => {
    if (!trouve('npm')) return ko(new Error('npm est introuvable : installe Node.js (nodejs.org) puis réessaie.'));
    const p = spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'], { shell: process.platform === 'win32' });
    let err = '';
    p.stdout.on('data', d => sortie?.(String(d).trim().slice(-160)));
    p.stderr.on('data', d => { err += d; sortie?.(String(d).trim().slice(-160)); });
    p.on('error', ko);
    p.on('close', c => c === 0 ? ok(true) : ko(new Error(err.trim().slice(-300) || 'npm a échoué (code ' + c + ').')));
  });
}

/** Télécharge ffmpeg (build statique officiel BtbN, GitHub) dans le dossier de données de Clipia. Appelé après un clic. */
export async function installerFfmpeg(sortie) {
  if (etatOutils().present) return true;
  const win = process.platform === 'win32', lin = process.platform === 'linux';
  if (!win && !lin) throw new Error('Sur Mac, installe ffmpeg avec Homebrew : « brew install ffmpeg », puis clique sur Revérifier.');
  const arch = process.arch === 'arm64' ? 'linuxarm64' : 'linux64';
  const nom = win ? 'ffmpeg-master-latest-win64-gpl.zip' : `ffmpeg-master-latest-${arch}-gpl.tar.xz`;
  const url = `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${nom}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clipia-ff-'));
  const archive = path.join(tmp, nom);
  try {
    sortie?.({ message: 'Téléchargement de ffmpeg (≈ 150 Mo)…', pct: 0 });
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok || !r.body) throw new Error(`Téléchargement refusé (${r.status}). Vérifie ta connexion, ou place ffmpeg.exe dans le dossier « outils ».`);
    const total = Number(r.headers.get('content-length')) || 0; let recu = 0, dernier = 0;
    const f = fs.createWriteStream(archive);
    for await (const morceau of r.body) {
      f.write(morceau); recu += morceau.length;
      const pct = total ? Math.floor(recu / total * 100) : 0; if (pct >= dernier + 5) { dernier = pct; sortie?.({ message: 'Téléchargement de ffmpeg…', pct }); }
    }
    await new Promise((ok, ko) => f.end(e => e ? ko(e) : ok()));
    sortie?.({ message: 'Décompression…' });
    const dest = path.join(tmp, 'x'); fs.mkdirSync(dest);
    const t = spawnSync('tar', ['-xf', archive, '-C', dest], { timeout: 300000, windowsHide: true });
    if (t.status !== 0) throw new Error('Décompression impossible : ' + String(t.stderr || t.error?.message || '').slice(0, 200));
    const exe = win ? 'ffmpeg.exe' : 'ffmpeg', exeP = win ? 'ffprobe.exe' : 'ffprobe';
    const trouver = (d, n) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const c = path.join(d, e.name); if (e.isDirectory()) { const x = trouver(c, n); if (x) return x; } else if (e.name === n) return c; } return null; };
    const cible = path.join(DATA_DIR, 'outils'); fs.mkdirSync(cible, { recursive: true });
    for (const n of [exe, exeP]) { const src = trouver(dest, n); if (src) { fs.copyFileSync(src, path.join(cible, n)); if (!win) fs.chmodSync(path.join(cible, n), 0o755); } }
    oublierBinaires();
    if (!etatOutils().present) throw new Error('ffmpeg est installé mais ne démarre pas (antivirus ?). Autorise le dossier « ' + cible + ' ».');
    sortie?.({ message: 'ffmpeg est prêt.' }); return true;
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
}
