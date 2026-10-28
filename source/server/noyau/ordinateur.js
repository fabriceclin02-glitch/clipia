/**
 * CLIPIA V4 — Contrôle de l'ordinateur : applications, clavier, souris, captures d'écran.
 *
 * Garde-fous (dans le code) :
 *   • RIEN ne bouge sans une « session de contrôle » accordée par la personne : une carte
 *     « Autoriser » s'affiche, et le contrôle dure 10 minutes au plus ;
 *   • arrêt d'urgence : outil ordi_stop, route POST /api/ordi/stop, ou fin de la durée ;
 *   • jamais de mot de passe ni de numéro de carte tapés (le texte est refusé s'il y ressemble) ;
 *   • au plus 40 actions par minute, chacune est journalisée ;
 *   • Windows : PowerShell + user32 ; macOS : osascript / screencapture ; Linux : xdotool.
 * Limite honnête : sans modèle « vision », Clipia ne VOIT pas la capture ; elle agit avec les
 * titres de fenêtres, les raccourcis clavier et l'extension navigateur (qui lit le contenu des pages).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { OUTILS, PROJETS_DIR } from './outils.js';
import { consommer } from './machine.js';
import { store } from '../lib/store.js';

const SESSION_MIN = 10;
let jusqua = 0;            // fin de la session de contrôle (ms)
let recentes = [];          // horodatages des actions (limite par minute)
let lanceur = null;         // remplaçable dans les tests
export const _tests = { fixerLanceur: f => { lanceur = f; }, reinit: () => { jusqua = 0; recentes = []; } };

export const sessionActive = () => Date.now() < jusqua;
export const sessionRestante = () => Math.max(0, Math.round((jusqua - Date.now()) / 1000));
export function arreter() { const etait = sessionActive(); jusqua = 0; journal('arrêt', {}); return etait; }
function journal(quoi, d) { try { store.insert('events', { type: 'ordi.' + quoi, ...d, at: new Date().toISOString() }); } catch {} }

const plateforme = () => process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';

function lancer(cmd, args, entree) {
  if (lanceur) return lanceur(cmd, args, entree);
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = '', err = '';
    const t = setTimeout(() => { try { p.kill(); } catch {} ko(new Error('Délai dépassé.')); }, 30000);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('error', e => { clearTimeout(t); ko(new Error(e.code === 'ENOENT' ? `« ${cmd} » n'est pas installé sur cet ordinateur.` : e.message)); });
    p.on('close', c => { clearTimeout(t); c === 0 ? ok(out.trim()) : ko(new Error((err || out || 'code ' + c).trim().slice(0, 400))); });
    if (entree) p.stdin.end(entree); else p.stdin.end();
  });
}
const ps = (script) => lancer('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]);

const PS_USER32 = `Add-Type @"
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,UIntPtr e); }
"@
[W]::SetProcessDPIAware() | Out-Null
`;

/* ── Souris ── */
export function scriptSouris({ action, x, y, x2, y2, defil }) {
  const X = Math.round(+x), Y = Math.round(+y);
  const clic = (d, u) => `[W]::mouse_event(${d},0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 40;[W]::mouse_event(${u},0,0,0,[UIntPtr]::Zero);`;
  let s = PS_USER32 + `[W]::SetCursorPos(${X},${Y}) | Out-Null;Start-Sleep -Milliseconds 60;`;
  if (action === 'clic') s += clic(2, 4);
  else if (action === 'clic_droit') s += clic(8, 16);
  else if (action === 'double_clic') s += clic(2, 4) + 'Start-Sleep -Milliseconds 80;' + clic(2, 4);
  else if (action === 'glisser') s += `[W]::mouse_event(2,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 120;[W]::SetCursorPos(${Math.round(+x2)},${Math.round(+y2)}) | Out-Null;Start-Sleep -Milliseconds 200;[W]::mouse_event(4,0,0,0,[UIntPtr]::Zero);`;
  else if (action === 'defiler') s += `$d=[BitConverter]::ToUInt32([BitConverter]::GetBytes([int]${Math.round(+defil || -120)}),0);[W]::mouse_event(0x800,0,0,$d,[UIntPtr]::Zero);`;
  return s;
}
async function souris(p) {
  const pf = plateforme();
  if (pf === 'win') return ps(scriptSouris(p));
  const { action, x, y } = p;
  if (pf === 'mac') {
    if (action === 'deplacer') return lancer('osascript', ['-e', `tell application "System Events" to set position of (first window of (first process whose frontmost is true)) to {0,0}`]).catch(() => {}) && 'ok';
    return lancer('osascript', ['-e', `tell application "System Events" to click at {${Math.round(x)}, ${Math.round(y)}}`]);
  }
  const base = ['mousemove', String(Math.round(x)), String(Math.round(y))];
  await lancer('xdotool', base);
  if (action === 'clic') return lancer('xdotool', ['click', '1']);
  if (action === 'clic_droit') return lancer('xdotool', ['click', '3']);
  if (action === 'double_clic') return lancer('xdotool', ['click', '--repeat', '2', '--delay', '80', '1']);
  if (action === 'glisser') { await lancer('xdotool', ['mousedown', '1']); await lancer('xdotool', ['mousemove', String(Math.round(p.x2)), String(Math.round(p.y2))]); return lancer('xdotool', ['mouseup', '1']); }
  if (action === 'defiler') return lancer('xdotool', ['click', '--repeat', String(Math.max(1, Math.round(Math.abs(p.defil || 3)))), (p.defil || -1) < 0 ? '5' : '4']);
  return 'ok';
}

/* ── Clavier ── */
const SK = { enter: '{ENTER}', entree: '{ENTER}', tab: '{TAB}', esc: '{ESC}', echap: '{ESC}', suppr: '{DEL}', delete: '{DEL}', retour: '{BS}', backspace: '{BS}', haut: '{UP}', bas: '{DOWN}', gauche: '{LEFT}', droite: '{RIGHT}', debut: '{HOME}', fin: '{END}', espace: ' ', f5: '{F5}', f11: '{F11}', f4: '{F4}', f12: '{F12}' };
export function versSendKeys(combo) {
  const parts = String(combo).toLowerCase().split('+').map(s => s.trim()).filter(Boolean);
  const touche = parts.pop();
  let pre = '';
  for (const m of parts) pre += m === 'ctrl' ? '^' : m === 'alt' ? '%' : m === 'shift' ? '+' : '';
  const k = SK[touche] || (touche.length === 1 ? touche.replace(/[+^%~(){}\[\]]/g, '{$&}') : `{${touche.toUpperCase()}}`);
  return pre + k;
}
const echapperSK = t => String(t).replace(/[+^%~(){}\[\]]/g, '{$&}').replace(/\r?\n/g, '{ENTER}');
const XK = { enter: 'Return', entree: 'Return', tab: 'Tab', esc: 'Escape', echap: 'Escape', suppr: 'Delete', retour: 'BackSpace', backspace: 'BackSpace', haut: 'Up', bas: 'Down', gauche: 'Left', droite: 'Right', espace: 'space', debut: 'Home', fin: 'End' };
async function clavier({ texte, touches }) {
  const pf = plateforme();
  if (texte !== undefined) {
    if (pf === 'win') return ps(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('${echapperSK(texte).replace(/'/g, "''")}')`);
    if (pf === 'mac') return lancer('osascript', ['-e', `tell application "System Events" to keystroke "${String(texte).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`]);
    return lancer('xdotool', ['type', '--delay', '25', '--', String(texte)]);
  }
  if (pf === 'win') return ps(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('${versSendKeys(touches).replace(/'/g, "''")}')`);
  const parts = String(touches).toLowerCase().split('+').map(s => s.trim());
  if (pf === 'mac') {
    const k = parts.pop(); const mod = parts.map(m => ({ ctrl: 'control down', alt: 'option down', shift: 'shift down', cmd: 'command down', commande: 'command down' }[m])).filter(Boolean);
    const code = { enter: 36, entree: 36, tab: 48, esc: 53, echap: 53, espace: 49, suppr: 51 }[k];
    return lancer('osascript', ['-e', code !== undefined ? `tell application "System Events" to key code ${code}${mod.length ? ' using {' + mod.join(', ') + '}' : ''}` : `tell application "System Events" to keystroke "${k}"${mod.length ? ' using {' + mod.join(', ') + '}' : ''}`]);
  }
  return lancer('xdotool', ['key', parts.map(m => XK[m] || m).join('+')]);
}

/* ── Applications, fenêtres, captures ── */
async function ouvrirApp(cible) {
  const pf = plateforme(), c = String(cible);
  if (pf === 'win') return ps(`Start-Process '${c.replace(/'/g, "''")}'`);
  if (pf === 'mac') return lancer('open', /^(https?:|\/)/.test(c) ? [c] : ['-a', c]);
  return lancer('xdg-open', [c]).catch(() => lancer(c, []));
}
async function fenetres() {
  const pf = plateforme();
  if (pf === 'win') return ps(`Get-Process | Where-Object {$_.MainWindowTitle} | ForEach-Object { "$($_.ProcessName) : $($_.MainWindowTitle)" }`);
  if (pf === 'mac') return lancer('osascript', ['-e', 'tell application "System Events" to get name of (processes where background only is false)']);
  return lancer('wmctrl', ['-l']).catch(() => lancer('xdotool', ['search', '--onlyvisible', '--name', '.']));
}
async function focus(titre) {
  const pf = plateforme();
  if (pf === 'win') return ps(`(New-Object -ComObject WScript.Shell).AppActivate('${String(titre).replace(/'/g, "''")}')`);
  if (pf === 'mac') return lancer('osascript', ['-e', `tell application "${String(titre).replace(/"/g, '')}" to activate`]);
  return lancer('wmctrl', ['-a', String(titre)]);
}

/* ── Fermer une fenêtre : par son nom, ou « celle de gauche / de droite » ── */
const PS_FERMER = (mode, cible) => `Add-Type @"
using System; using System.Runtime.InteropServices;
public class WC { [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rr, B; } [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r); }
"@
$mode='${mode}'; $cible='${String(cible).replace(/'/g, "''")}'
$l = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -and $_.MainWindowTitle -notmatch 'Clipia' -and $_.ProcessName -notin 'explorer','ApplicationFrameHost','TextInputHost','SystemSettings','ShellExperienceHost' } | ForEach-Object { $r = New-Object 'WC+R'; [void][WC]::GetWindowRect($_.MainWindowHandle, [ref]$r); [pscustomobject]@{ P = $_; L = $r.L } }
if ($mode -eq 'gauche') { $c = $l | Sort-Object L | Select-Object -First 1 }
elseif ($mode -eq 'droite') { $c = $l | Sort-Object L -Descending | Select-Object -First 1 }
else { $c = $l | Where-Object { $_.P.MainWindowTitle -like "*$cible*" -or $_.P.ProcessName -like "*$cible*" } | Select-Object -First 1 }
if (-not $c) { 'AUCUNE'; exit 0 }
[void]$c.P.CloseMainWindow(); "$($c.P.ProcessName) : $($c.P.MainWindowTitle)"`;
async function fermerFenetre(cible) {
  const pf = plateforme(); const t = String(cible || '').trim(); const m = /gauche|left/i.test(t) ? 'gauche' : /droite|right/i.test(t) ? 'droite' : 'nom';
  if (pf === 'win') return (await ps(PS_FERMER(m, t))).trim();
  if (pf === 'mac') {
    if (m !== 'nom') throw new Error('Sur Mac, dis plutôt le nom de l\'application à fermer (par exemple « ferme Safari »).');
    await lancer('osascript', ['-e', `tell application "${t.replace(/"/g, '')}" to quit`]); return t;
  }
  const l = String(await lancer('wmctrl', ['-lG'])).split('\n').map(x => x.trim().split(/\s+/)).filter(a => a.length >= 8 && !/clipia/i.test(a.slice(7).join(' '))).map(a => ({ id: a[0], x: +a[2], titre: a.slice(7).join(' ') }));
  const c = m === 'gauche' ? l.sort((a, b) => a.x - b.x)[0] : m === 'droite' ? l.sort((a, b) => b.x - a.x)[0] : l.find(w => w.titre.toLowerCase().includes(t.toLowerCase()));
  if (!c) return 'AUCUNE'; await lancer('wmctrl', ['-ic', c.id]); return c.titre;
}
async function capturer(fichier) {
  const pf = plateforme();
  if (pf === 'win') return ps(`Add-Type -AssemblyName System.Windows.Forms,System.Drawing;Add-Type @"
using System.Runtime.InteropServices; public class D { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
[D]::SetProcessDPIAware() | Out-Null
$b=[System.Windows.Forms.SystemInformation]::VirtualScreen;$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;$g=[System.Drawing.Graphics]::FromImage($bmp);$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size);$bmp.Save('${fichier.replace(/'/g, "''")}',[System.Drawing.Imaging.ImageFormat]::Png)`);
  if (pf === 'mac') return lancer('screencapture', ['-x', fichier]);
  return lancer('import', ['-window', 'root', fichier]).catch(() => lancer('scrot', ['-o', fichier]));
}

/* ── Les outils ── */
const SENSIBLE = /(?:\d[ -]?){13,19}|mot de passe|password|passwd|cvv|iban/i;

function accordOuSession(accord, cle) {
  if (sessionActive()) return true;
  if (accord && consommer(accord, cle)) { jusqua = Date.now() + SESSION_MIN * 60000; journal('session', { minutes: SESSION_MIN }); return true; }
  return false;
}
const demande = (quoi) => ({
  resume: `Je voudrais ${quoi}. Je te demande l'autorisation de contrôler l'ordinateur pendant ${SESSION_MIN} minutes (tu peux tout arrêter à tout moment).`,
  arret: 'accord',
  effet: { genre: 'accord', commande: 'ordi:session', categorie: 'ordi', pourquoi: `prend le contrôle de l'ordinateur ${SESSION_MIN} minutes : ${quoi}` },
  preuve: { genre: 'accord-demande', commande: 'ordi:session' }
});
function limite() {
  const t = Date.now(); recentes = recentes.filter(x => t - x < 60000);
  if (recentes.length >= 40) throw new Error('Trop d\'actions en une minute (40 maximum). Ralentis.');
  recentes.push(t);
}
const urlCapture = f => '/api/projets/ordinateur/' + encodeURIComponent(path.basename(f));

Object.assign(OUTILS, {
  ordi_souris: {
    groupe: 'ordinateur',
    description: 'Contrôle la souris. Paramètres : action (deplacer | clic | clic_droit | double_clic | glisser | defiler), x, y (pixels de l\'écran), x2, y2 (pour glisser), defil (nombre, négatif = vers le bas). Demande l\'autorisation de la personne.',
    async run(p) {
      if (!['deplacer', 'clic', 'clic_droit', 'double_clic', 'glisser', 'defiler'].includes(p.action)) throw new Error('action inconnue.');
      if (!Number.isFinite(+p.x) || !Number.isFinite(+p.y)) throw new Error('x et y sont nécessaires.');
      if (!accordOuSession(p.accord, 'ordi:session')) return demande(`${p.action} à l'écran en (${p.x}, ${p.y})`);
      limite(); journal('souris', { action: p.action, x: p.x, y: p.y });
      await souris(p);
      return { resume: `Souris : ${p.action} en (${p.x}, ${p.y}).`, preuve: { genre: 'souris', action: p.action, x: +p.x, y: +p.y } };
    }
  },
  ordi_clavier: {
    groupe: 'ordinateur',
    description: 'Tape au clavier. Paramètres : texte (à saisir tel quel) OU touches (un raccourci : ctrl+c, alt+f4, enter, tab, ctrl+shift+t…). Jamais de mot de passe ni de numéro de carte. Demande l\'autorisation de la personne.',
    async run(p) {
      if (p.texte === undefined && !p.touches) throw new Error('Il faut texte ou touches.');
      if (p.texte !== undefined && SENSIBLE.test(String(p.texte))) throw new Error('Je ne tape jamais de mot de passe ni de numéro de carte : fais-le toi-même.');
      if (!accordOuSession(p.accord, 'ordi:session')) return demande(p.texte !== undefined ? 'taper du texte au clavier' : `appuyer sur ${p.touches}`);
      limite(); journal('clavier', { touches: p.touches || null, nbCaracteres: p.texte !== undefined ? String(p.texte).length : 0 });
      await clavier(p);
      return { resume: p.texte !== undefined ? `Texte tapé (${String(p.texte).length} caractères).` : `Touches : ${p.touches}.`, preuve: { genre: 'clavier', touches: p.touches || null } };
    }
  },
  ordi_ouvrir_app: {
    groupe: 'ordinateur',
    description: 'Ouvre une application, un fichier ou une adresse web (ex. notepad, Spotify, https://…). Paramètre : cible. Demande l\'autorisation de la personne.',
    async run(p) {
      if (!String(p.cible || '').trim()) throw new Error('Il faut une cible.');
      if (!accordOuSession(p.accord, 'ordi:session')) return demande(`ouvrir « ${p.cible} »`);
      limite(); journal('ouvrir', { cible: String(p.cible).slice(0, 200) });
      await ouvrirApp(p.cible);
      return { resume: `« ${p.cible} » ouvert.`, preuve: { genre: 'ouverture', cible: String(p.cible).slice(0, 200) } };
    }
  },
  ordi_fenetres: {
    groupe: 'ordinateur',
    description: 'Liste les fenêtres ouvertes (application : titre). Peut aussi mettre une fenêtre au premier plan avec le paramètre activer (titre). Demande l\'autorisation de la personne.',
    async run(p) {
      if (!accordOuSession(p.accord, 'ordi:session')) return demande('voir les fenêtres ouvertes');
      limite();
      if (p.activer) { await focus(p.activer); return { resume: `Fenêtre « ${p.activer} » mise au premier plan.`, preuve: { genre: 'fenetre', titre: p.activer } }; }
      const l = await fenetres();
      return { resume: l || '(aucune fenêtre trouvée)', preuve: { genre: 'liste', lignes: String(l).split('\n').length } };
    }
  },
  ordi_capturer: {
    groupe: 'ordinateur',
    description: 'Prend une capture de l\'écran entier et la range dans le projet « ordinateur ». Demande l\'autorisation de la personne.',
    async run(p) {
      if (!accordOuSession(p.accord, 'ordi:session')) return demande('prendre une capture de l\'écran');
      limite();
      const dossier = path.join(PROJETS_DIR, 'ordinateur'); fs.mkdirSync(dossier, { recursive: true });
      const f = path.join(dossier, `capture-${Date.now()}.png`);
      await capturer(f);
      if (!fs.existsSync(f)) throw new Error('La capture n\'a pas été créée (outil indisponible sur cet ordinateur).');
      journal('capture', {});
      return { resume: `Capture enregistrée : ${path.basename(f)}`, donnees: { url: urlCapture(f) }, preuve: { genre: 'fichier', chemin: f, octets: fs.statSync(f).size } };
    }
  },
  ordi_fermer_fenetre: {
    groupe: 'ordinateur',
    description: 'Ferme une fenêtre (proprement : l\'application peut demander d\'enregistrer). Paramètre : cible = le nom de l\'application ou un mot du titre (« chrome », « bloc-notes »), ou « gauche » / « droite » pour la fenêtre la plus à gauche / à droite de l\'écran. Demande l\'autorisation de la personne.',
    async run(p) {
      if (!String(p.cible || '').trim()) throw new Error('Il faut dire quelle fenêtre fermer.');
      if (!accordOuSession(p.accord, 'ordi:session')) return demande(`fermer la fenêtre « ${p.cible} »`);
      limite(); journal('fermer', { cible: String(p.cible).slice(0, 100) });
      const r = await fermerFenetre(p.cible);
      if (r === 'AUCUNE' || !r) return { resume: `Je n'ai trouvé aucune fenêtre « ${p.cible} » à fermer.`, preuve: { genre: 'fenetre', titre: String(p.cible), trouve: false } };
      return { resume: `Fenêtre fermée : ${r}`, preuve: { genre: 'fenetre', titre: r, trouve: true } };
    }
  },
  logiciel_installer: {
    groupe: 'ordinateur',
    description: 'Installe un logiciel libre de la Logithèque de Clipia (lmms, audacity, kdenlive, shotcut, obs, handbrake, vlc, blender, gimp, krita, inkscape, vscodium, vscode, git, python, node, ollama, lmstudio, chrome, gemma3…). Paramètre : nom (identifiant ou nom). Demande l\'autorisation de la personne ; si le nom est inconnu, liste ce qui existe.',
    async run(p) {
      const { CATALOGUE, installer } = await import('./logitheque.js');
      const q = String(p.nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      if (!q) throw new Error('Il faut le nom du logiciel.');
      const e = CATALOGUE.find(x => !x.lienSeul && (x.id === q || x.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').includes(q)));
      if (!e) return { resume: `Je ne trouve pas « ${p.nom} » dans la Logithèque. Disponibles : ${CATALOGUE.filter(x => !x.lienSeul).map(x => x.id).join(', ')}. (Menu Logithèque pour les installer en un clic.)`, preuve: { genre: 'liste', lignes: CATALOGUE.length } };
      if (!accordOuSession(p.accord, 'ordi:session')) return demande(`installer ${e.nom} sur l'ordinateur`);
      limite(); journal('installer', { logiciel: e.id }); const lignes = [];
      await installer(e.id, l => lignes.push(l));
      return { resume: `${e.nom} est installé.`, preuve: { genre: 'installation', logiciel: e.id, lignes: lignes.slice(-6) } };
    }
  },
  openclaw_cli: {
    groupe: 'ordinateur',
    description: 'Pont vers OpenClaw installé sur l\'ordinateur. Paramètre : args (ex. "status", "skills list", "models status", "cron list", "channels status", "agent exec <tâche complète>"). Lecture seule, sauf « agent exec » qui lance une tâche d\'OpenClaw (demande l\'accord).',
    async run(p) {
      const { cli } = await import('./pont-openclaw.js');
      const args = Array.isArray(p.args) ? p.args.map(String) : String(p.args || '').match(/"[^"]*"|\S+/g)?.map(x => x.replace(/^"|"$/g, '')) || [];
      if (args[0] === 'agent' && !accordOuSession(p.accord, 'ordi:session')) return demande('confier une tâche à OpenClaw');
      limite(); journal('openclaw', { args: args.slice(0, 3).join(' ') });
      const sortie = await cli(args, { timeout: args[0] === 'agent' ? 280000 : 60000 });
      return { resume: sortie.slice(0, 2400) || 'OpenClaw n\'a rien répondu.', preuve: { genre: 'openclaw', commande: args.slice(0, 3).join(' '), caracteres: sortie.length } };
    }
  },
  openclaw_savoirs: {
    groupe: 'ordinateur',
    description: 'Liste ce qu\'OpenClaw sait faire et les compétences OpenClaw disponibles dans Clipia (avec leur état). Aucun paramètre.',
    async run() {
      const { SAVOIRS, catalogue } = await import('./pont-openclaw.js');
      return { resume: SAVOIRS.map(x => `${x.nom} : ${x.clipia}`).join('\n') + '\nCompétences : ' + catalogue().filter(c => !c.specifique && c.plateforme_ok).map(c => c.cle + (c.importee ? ' ✓' : '')).join(', '), preuve: { genre: 'memoire', sujet: 'openclaw' } };
    }
  },
  app_creer: {
    groupe: 'créer',
    description: 'Lance la construction d\'un SITE WEB, d\'une APPLICATION ou d\'un JEU par une équipe d\'agents (architecte, codeur, testeur, relecteur), en arrière-plan. Paramètres : description (ce que la personne veut), type (site | web | jeu | node | python), nom (facultatif). Rend la main aussitôt : l\'avancement et le résultat sont dans le menu « Atelier d\'apps ».',
    async run(p) {
      const description = String(p.description || '').trim(); if (!description) throw new Error('Il faut décrire ce qu\'il faut créer.');
      const type = ['site', 'web', 'jeu', 'node', 'python'].includes(p.type) ? p.type : 'site';
      const { creerApp } = await import('./forge-app.js');
      creerApp({ description, type, nom: String(p.nom || '') }).catch(e => journal('app-erreur', { message: String(e.message).slice(0, 200) }));
      return { resume: `Construction lancée (${type}). Suis l'avancement dans « Atelier d'apps » : je ne dis « terminé » que si les tests passent.`, preuve: { genre: 'tache', type, description: description.slice(0, 120) } };
    }
  },
  ordi_stop: {
    groupe: 'ordinateur',
    description: 'Arrête immédiatement le contrôle de l\'ordinateur. Aucun paramètre.',
    async run() { const a = arreter(); return { resume: a ? 'Contrôle de l\'ordinateur arrêté.' : 'Le contrôle n\'était pas actif.', preuve: { genre: 'arret' } }; }
  }
});
