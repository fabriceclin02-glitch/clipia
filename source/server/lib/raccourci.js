/**
 * CLIPIA — Création du raccourci de bureau.
 * On laisse Windows fabriquer le .lnk avec sa propre API : un raccourci
 * écrit à la main depuis un autre système risque de s'afficher cassé.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { store } from '../lib/store.js';

/** Le Bureau réel — Windows le redirige souvent vers OneDrive. */
export function bureau() {
  const home = os.homedir();
  const candidats = process.platform === 'win32'
    ? [path.join(home, 'OneDrive', 'Bureau'), path.join(home, 'OneDrive', 'Desktop'),
       path.join(home, 'Bureau'), path.join(home, 'Desktop')]
    : [path.join(home, 'Bureau'), path.join(home, 'Desktop')];
  return candidats.find(d => fs.existsSync(d)) || path.join(home, 'Desktop');
}

export function etatRaccourci() {
  const d = bureau();
  const ext = process.platform === 'win32' ? '.lnk' : process.platform === 'darwin' ? '' : '.desktop';
  const f = path.join(d, 'Clipia' + ext);
  return { bureau: d, chemin: f, existe: fs.existsSync(f), plateforme: process.platform };
}

export function creer({ cible, dossier, icone } = {}) {
  const d = bureau();
  if (!fs.existsSync(d)) throw new Error(`Bureau introuvable : ${d}`);

  const exe = cible || process.execPath;
  const base = dossier || path.dirname(exe);
  const ico = icone || path.join(base, 'clipia.ico');

  if (process.platform === 'win32') {
    const dest = path.join(d, 'Clipia.lnk');
    const ps = [
      `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${dest.replace(/'/g, "''")}')`,
      `$s.TargetPath = '${exe.replace(/'/g, "''")}'`,
      `$s.WorkingDirectory = '${base.replace(/'/g, "''")}'`,
      `$s.Description = 'Clipia - Studio creatif IA'`,
      `$s.IconLocation = '${(fs.existsSync(ico) ? ico : exe + ',0').replace(/'/g, "''")}'`,
      `$s.Save()`
    ].join('; ');
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { encoding: 'utf8', windowsHide: true, timeout: 25000 });
    if (r.status !== 0) throw new Error(`Création refusée : ${(r.stderr || '').slice(0, 220)}`);
    if (!fs.existsSync(dest)) throw new Error('Le raccourci n\'a pas été écrit.');
    store.insert('events', { type: 'raccourci.cree', chemin: dest });
    return { ok: true, chemin: dest };
  }

  if (process.platform === 'linux') {
    const dest = path.join(d, 'Clipia.desktop');
    fs.writeFileSync(dest, `[Desktop Entry]
Type=Application
Name=Clipia
Comment=Studio créatif IA
Exec="${exe}"
Icon=${fs.existsSync(ico) ? ico : path.join(base, 'clipia.png')}
Terminal=false
Categories=AudioVideo;Graphics;
`, { mode: 0o755 });
    return { ok: true, chemin: dest };
  }

  // macOS : un alias se fabrique avec AppleScript
  const dest = path.join(d, 'Clipia');
  const r = spawnSync('osascript', ['-e',
    `tell application "Finder" to make alias file to POSIX file "${exe}" at POSIX file "${d}"`],
    { encoding: 'utf8', timeout: 20000 });
  if (r.status !== 0) throw new Error((r.stderr || 'échec').slice(0, 200));
  return { ok: true, chemin: dest };
}
