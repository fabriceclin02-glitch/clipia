/* Audit intégré : « PC complet » (machine, disque, mémoire, outils) et « Clipia » (le script audit-complet qui teste vraiment les fonctions). */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(ICI, '../../scripts/audit-complet.mjs');

const go = (n) => (n / 1073741824).toFixed(1) + ' Go';
const essai = (cmd, args) => { try { const r = spawnSync(cmd, args, { timeout: 6000, encoding: 'utf8', shell: process.platform === 'win32' }); return r.status === 0 ? String(r.stdout || '').trim().split(/\r?\n/)[0] : null; } catch { return null; } };

function disque(dossier) {
  try { const s = fs.statfsSync(dossier); return { libre: s.bavail * s.bsize, total: s.blocks * s.bsize }; } catch { return null; }
}

export async function auditPC({ dossierDonnees, ffmpegBin } = {}) {
  const L = []; const p = (ok, t, d = '') => L.push({ ok, titre: t, detail: d });
  const cpu = os.cpus(); p(true, 'Système', `${os.platform()} ${os.release()} · ${os.arch()} · ${cpu.length} cœurs (${(cpu[0] || {}).model || '?'})`);
  const lib = os.freemem(), tot = os.totalmem();
  p(lib > 1.5e9, 'Mémoire vive', `${go(lib)} libres sur ${go(tot)}${lib <= 1.5e9 ? ' — peu : ferme des programmes avant de générer des vidéos' : ''}`);
  const d = disque(dossierDonnees || os.homedir());
  if (d) p(d.libre > 5e9, 'Espace disque', `${go(d.libre)} libres sur ${go(d.total)}${d.libre <= 5e9 ? ' — moins de 5 Go : libère de la place (les vidéos sont lourdes)' : ''}`);
  if (dossierDonnees) { try { const f = path.join(dossierDonnees, '.audit-ecriture'); fs.writeFileSync(f, 'ok'); fs.unlinkSync(f); p(true, 'Dossier de données', `écriture possible (${dossierDonnees})`); } catch (e) { p(false, 'Dossier de données', `écriture impossible : ${e.message}`); } }
  p(true, 'Node intégré', process.version);
  const ff = ffmpegBin && essai(ffmpegBin, ['-version']); p(!!ff, 'FFmpeg (montage, vidéo)', ff ? ff.slice(0, 60) : 'introuvable : réinstalle Clipia');
  const gpu = process.platform === 'win32' ? essai('wmic', ['path', 'win32_VideoController', 'get', 'name']) : null; if (gpu) p(true, 'Carte graphique', gpu);
  let ol = false; try { const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2500) }); ol = r.ok; } catch {}
  p(ol, 'Ollama (IA locale, facultatif)', ol ? 'actif' : 'non détecté — utile seulement pour travailler sans Internet');
  let net = false; try { const r = await fetch('https://image.pollinations.ai', { signal: AbortSignal.timeout(6000) }); net = !!r.status; } catch {}
  p(net, 'Internet', net ? 'les moteurs en ligne sont joignables' : 'injoignable : pare-feu, antivirus ou VPN ?');
  const proc = process.memoryUsage(); p(true, 'Mémoire utilisée par Clipia', go(proc.rss));
  p(os.uptime() < 14 * 86400, 'Dernier redémarrage du PC', `il y a ${(os.uptime() / 86400).toFixed(1)} jour(s)${os.uptime() >= 14 * 86400 ? ' — redémarre-le pour retrouver de la fluidité' : ''}`);
  return L;
}

export function auditClipia(port) {
  return new Promise((resolve) => {
    if (!fs.existsSync(SCRIPT)) return resolve({ ok: false, texte: 'Script d\'audit introuvable dans cette installation.' });
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'clipia-audit-'));
    const c = spawn(process.execPath, [SCRIPT], { cwd, env: { ...process.env, PORT: String(port) }, windowsHide: true });
    let sortie = ''; const stop = setTimeout(() => { try { c.kill(); } catch {} }, 240000);
    c.stdout.on('data', (b) => { sortie += b; }); c.stderr.on('data', (b) => { sortie += b; });
    c.on('close', () => { clearTimeout(stop); let t = sortie; try { t = fs.readFileSync(path.join(cwd, 'Audit-Clipia.txt'), 'utf8'); } catch {} try { fs.rmSync(cwd, { recursive: true, force: true }); } catch {} resolve({ ok: !/✗/.test(t), texte: t }); });
    c.on('error', (e) => { clearTimeout(stop); resolve({ ok: false, texte: 'Audit impossible : ' + e.message }); });
  });
}
