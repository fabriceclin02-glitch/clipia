/**
 * CLIPIA OS — pont entre l'interface (Réglages, installeur, bienvenue) et le système Linux.
 * Actif seulement dans Clipia OS (variable CLIPIA_OS=1, posée par le service). Ailleurs : { os:false }.
 * Tout ce qui MODIFIE le système demande l'en-tête x-clipia-accord (clic dans l'interface) ; les valeurs sont
 * validées (listes blanches), jamais passées à un shell.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import * as machine from './machine.js';

export const ACTIF = () => process.env.CLIPIA_OS === '1';
const DATA = process.env.CLIPIA_DATA_DIR || '/var/lib/clipia/data';
const FLAG_BIENVENUE = path.join(DATA, 'os-bienvenue.ok');
const LOG_INSTALL = '/var/log/clipia-installation.log';
const UID = (() => { try { return process.getuid(); } catch { return 1000; } })();
const ENV_GRAPHIQUE = { ...process.env, DISPLAY: ':0', XDG_RUNTIME_DIR: `/run/user/${UID}`, LANG: 'fr_FR.UTF-8', GSK_RENDERER: 'cairo', GDK_BACKEND: 'x11', WEBKIT_DISABLE_COMPOSITING_MODE: '1', WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS: '1' };

const CLAVIERS = { fr: 'Français (AZERTY)', be: 'Belge', ch: 'Suisse', de: 'Allemand', es: 'Espagnol', it: 'Italien', pt: 'Portugais', gb: 'Anglais (Royaume-Uni)', us: 'Anglais (États-Unis)' };
const APPLIS = {
  clipia: ['/usr/local/bin/clipia-fenetre'],
  epiphany: ['epiphany', '--new-window'], falkon: ['falkon'],
  fichiers: ['thunar'], terminal: ['xfce4-terminal'], editeur: ['mousepad'],
  son: ['pavucontrol'], reseau: ['nm-connection-editor'],
  pilotes: ['xfce4-terminal', '-e', '/usr/local/bin/clipia-pilotes'],
  bienvenue: ['epiphany', '--new-window', 'http://127.0.0.1:8787/os.html#/bienvenue'],
  reglages: ['epiphany', '--new-window', 'http://127.0.0.1:8787/os.html#/reglages'],
  installeur: ['epiphany', '--new-window', 'http://127.0.0.1:8787/os.html#/installer']
};

const sh = (cmd, args, { env = process.env, timeout = 15000 } = {}) => new Promise(res => {
  execFile(cmd, args, { env, timeout, maxBuffer: 4 << 20 }, (err, out, errout) => res({ ok: !err, out: String(out || '').trim(), err: String(errout || err?.message || '').trim() }));
});
const lire = (f) => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; } };

export function estLive() { return fs.existsSync('/rofs') || fs.existsSync('/cdrom'); }
export function estInstalle() { return fs.existsSync('/etc/clipia-installe'); }

async function disqueLive() {
  const r = await sh('findmnt', ['-n', '-o', 'SOURCE', '/cdrom']);
  if (!r.ok || !r.out) return '';
  const p = await sh('lsblk', ['-no', 'PKNAME', r.out]);
  return p.out.split('\n')[0] ? '/dev/' + p.out.split('\n')[0] : r.out;
}

export async function disques() {
  const live = await disqueLive();
  const r = await sh('lsblk', ['-J', '-b', '-dpno', 'NAME,SIZE,MODEL,TYPE,RM,TRAN']);
  let l = []; try { l = JSON.parse(r.out).blockdevices || []; } catch {}
  return l.filter(d => d.type === 'disk' && !/^\/dev\/(loop|ram|sr|zram)/.test(d.name) && d.name !== live && Number(d.size) >= 10e9)
    .map(d => ({ nom: d.name, taille: Number(d.size), modele: (d.model || '').trim() || 'Disque', amovible: d.rm === true || d.rm === '1' || d.tran === 'usb', transport: d.tran || '' }));
}

export async function etat() {
  const uefi = fs.existsSync('/sys/firmware/efi');
  const nm = await sh('nmcli', ['-t', '-f', 'CONNECTIVITY', 'general']);
  const actif = await sh('nmcli', ['-t', '-f', 'ACTIVE,SSID,TYPE', 'connection', 'show', '--active']);
  const clavier = (lire('/etc/default/keyboard').match(/XKBLAYOUT="?([a-z]+)/) || [])[1] || 'fr';
  const fuseau = (await sh('timedatectl', ['show', '-p', 'Timezone', '--value'])).out || lire('/etc/timezone') || 'Europe/Paris';
  const df = await sh('df', ['-B1', '--output=avail,size', '/var/lib/clipia']);
  const [dispo, taille] = (df.out.split('\n')[1] || '').trim().split(/\s+/).map(Number);
  const rel = lire('/etc/os-release').match(/PRETTY_NAME="([^"]+)"/);
  return {
    os: true, nom: rel ? rel[1] : 'Clipia OS', live: estLive() && !estInstalle(), installe: estInstalle(), uefi,
    machine: os.hostname(), cpu: (os.cpus()[0] || {}).model || '?', coeurs: os.cpus().length, ram: os.totalmem(),
    reseau: nm.out || 'inconnu', connexions: actif.out ? actif.out.split('\n').filter(Boolean) : [],
    clavier, claviers: CLAVIERS, fuseau, sansPersistance: fs.existsSync('/run/clipia-sans-persistance'),
    stockage: { dispo: dispo || 0, taille: taille || 0 },
    bienvenueFaite: fs.existsSync(FLAG_BIENVENUE), zones: machine.zones(), accesComplet: machine.zones().includes('/'),
    lectureSeule: machine.lectureSeule(), applis: Object.keys(APPLIS)
  };
}

export async function wifi() {
  await sh('nmcli', ['device', 'wifi', 'rescan'], { timeout: 6000 });
  const r = await sh('nmcli', ['-t', '-f', 'SSID,SIGNAL,SECURITY,IN-USE', 'device', 'wifi', 'list']);
  const vus = new Map();
  for (const ligne of r.out.split('\n')) {
    const m = ligne.match(/^(.*?):(\d+):(.*?):(.*)$/); if (!m || !m[1]) continue;
    const ssid = m[1].replace(/\\:/g, ':'); const n = { ssid, signal: +m[2], securite: m[3] || 'ouvert', connecte: m[4] === '*' };
    if (!vus.has(ssid) || vus.get(ssid).signal < n.signal) vus.set(ssid, n);
  }
  return [...vus.values()].sort((a, b) => b.signal - a.signal);
}

const lancerGraphique = (cmd, args) => { const c = spawn(cmd, args, { env: ENV_GRAPHIQUE, detached: true, stdio: 'ignore' }); c.on('error', () => {}); c.unref(); };

let installation = null;   // { debut, fini, code, pid }
function suiviInstallation() {
  const brut = lire(LOG_INSTALL).slice(-60000).split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const prog = l => /^[\d.,]+\s+(\d+)%/.exec(l);
  let dernierPct = null; const log = [];
  for (const l of brut) { const m = prog(l); if (m) dernierPct = m[1]; else log.push(l); }
  if (dernierPct !== null) log.push(`  Copie du système : ${dernierPct} %`);
  const dernier = log.join('\n');
  return { enCours: Boolean(installation && !installation.fini), fini: Boolean(installation?.fini), reussi: Boolean(installation?.fini && installation.code === 0 && /✓ Clipia OS est installé/.test(dernier)), journal: log.slice(-14) };
}

/** Renvoie true si la requête a été traitée. */
export async function gerer(req, res, p, { json, jbody }) {
  if (!p.startsWith('/api/os/')) return false;
  if (!ACTIF()) { json(res, { os: false }); return true; }
  const garde = () => { if (req.headers['x-clipia-accord'] !== '1') { json(res, { erreur: "Réservé à l'interface." }, 403); return false; } return true; };
  const post = req.method === 'POST';
  try {
    if (p === '/api/os/etat') { json(res, await etat()); return true; }
    if (p === '/api/os/disques') { json(res, { disques: await disques() }); return true; }
    if (p === '/api/os/wifi' && !post) { json(res, { reseaux: await wifi() }); return true; }
    if (p === '/api/os/installer/etat') { json(res, suiviInstallation()); return true; }

    if (!post) return json(res, { erreur: 'Inconnu.' }, 404), true;
    if (!garde()) return true;
    const b = await jbody(req);

    if (p === '/api/os/wifi') {
      const ssid = String(b.ssid || ''); if (!ssid || ssid.length > 64 || /[\n\r\0]/.test(ssid)) return json(res, { erreur: 'Nom de réseau invalide.' }, 400), true;
      const a = ['device', 'wifi', 'connect', ssid]; if (b.motdepasse) a.push('password', String(b.motdepasse).slice(0, 128));
      const r = await sh('nmcli', a, { timeout: 40000 });
      return json(res, r.ok ? { ok: true } : { erreur: (r.err || r.out || 'Connexion impossible.').replace(/Error: /, '') }, r.ok ? 200 : 400), true;
    }
    if (p === '/api/os/clavier') {
      const d = String(b.disposition || ''); if (!CLAVIERS[d]) return json(res, { erreur: 'Disposition inconnue.' }, 400), true;
      await sh('sudo', ['sed', '-i', `s/^XKBLAYOUT=.*/XKBLAYOUT="${d}"/`, '/etc/default/keyboard']);
      await sh('setxkbmap', [d], { env: ENV_GRAPHIQUE }); await sh('sudo', ['loadkeys', d]);
      return json(res, { ok: true, clavier: d }), true;
    }
    if (p === '/api/os/fuseau') {
      const z = String(b.zone || ''); if (!/^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+){0,2}$/.test(z) || !fs.existsSync('/usr/share/zoneinfo/' + z)) return json(res, { erreur: 'Fuseau inconnu.' }, 400), true;
      const r = await sh('sudo', ['timedatectl', 'set-timezone', z]); return json(res, r.ok ? { ok: true } : { erreur: r.err }, r.ok ? 200 : 400), true;
    }
    if (p === '/api/os/nom') {
      const n = String(b.nom || ''); if (!/^[a-z0-9][a-z0-9-]{0,30}$/i.test(n)) return json(res, { erreur: 'Nom : lettres, chiffres et tirets (31 max).' }, 400), true;
      const r = await sh('sudo', ['hostnamectl', 'set-hostname', n]); return json(res, r.ok ? { ok: true } : { erreur: r.err }, r.ok ? 200 : 400), true;
    }
    if (p === '/api/os/volume') {
      const v = Math.max(0, Math.min(100, Math.round(+b.pct))); if (!Number.isFinite(v)) return json(res, { erreur: 'Volume invalide.' }, 400), true;
      const r = await sh('pactl', ['set-sink-volume', '@DEFAULT_SINK@', v + '%'], { env: ENV_GRAPHIQUE }); return json(res, { ok: r.ok }), true;
    }
    if (p === '/api/os/lancer') {
      const a = APPLIS[String(b.app || '')]; if (!a) return json(res, { erreur: 'Application inconnue.' }, 400), true;
      lancerGraphique(a[0], a.slice(1)); return json(res, { ok: true }), true;
    }
    if (p === '/api/os/alimentation') {
      const act = { eteindre: 'poweroff', redemarrer: 'reboot' }[String(b.action || '')]; if (!act) return json(res, { erreur: 'Action inconnue.' }, 400), true;
      setTimeout(() => sh('sudo', ['systemctl', act]), 1500); return json(res, { ok: true }), true;
    }
    if (p === '/api/os/bienvenue-fait') { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FLAG_BIENVENUE, new Date().toISOString()); return json(res, { ok: true }), true; }
    if (p === '/api/os/acces') {
      // Étend (ou referme) la zone de travail de Clipia. Les emplacements sensibles (clés, système) restent fermés quoi qu'il arrive.
      try { if (b.complet) machine.ajouterZone('/'); else machine.retirerZone('/'); } catch (e) { return json(res, { erreur: e.message }, 400), true; }
      if (typeof b.lectureSeule === 'boolean') machine.definirLectureSeule(b.lectureSeule);
      return json(res, { ok: true, zones: machine.zones(), accesComplet: machine.zones().includes('/'), lectureSeule: machine.lectureSeule() }), true;
    }
    if (p === '/api/os/installer') {
      if (!estLive() || estInstalle()) return json(res, { erreur: "L'installation se lance depuis la clé ou l'ISO (système live)." }, 400), true;
      if (installation && !installation.fini) return json(res, { erreur: 'Une installation est déjà en cours.' }, 409), true;
      const d = String(b.disque || ''); const ok = (await disques()).find(x => x.nom === d);
      if (!ok) return json(res, { erreur: 'Disque inconnu ou interdit (la clé de démarrage est exclue).' }, 400), true;
      if (b.confirmation !== 'EFFACER') return json(res, { erreur: 'Confirmation manquante : tape EFFACER.' }, 400), true;
      const env = { ...process.env, CLIPIA_INSTALL_AUTO: d, CLIPIA_INSTALL_CONFIRME: 'EFFACER' };
      if (CLAVIERS[b.clavier]) env.CLIPIA_INSTALL_CLAVIER = b.clavier;
      if (/^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+){0,2}$/.test(String(b.fuseau || ''))) env.CLIPIA_INSTALL_FUSEAU = b.fuseau;
      if (/^[a-z0-9][a-z0-9-]{0,30}$/i.test(String(b.nom || ''))) env.CLIPIA_INSTALL_NOM = b.nom;
      try { fs.writeFileSync(LOG_INSTALL, ''); } catch {}
      installation = { debut: Date.now(), fini: false, code: null };
      const c = spawn('sudo', ['-E', '/usr/local/sbin/clipia-installer-disque'], { env, stdio: 'ignore' });
      c.on('exit', code => { installation.fini = true; installation.code = code; }); c.on('error', () => { installation.fini = true; installation.code = 1; });
      return json(res, { ok: true }), true;
    }
    json(res, { erreur: 'Inconnu.' }, 404); return true;
  } catch (e) { json(res, { erreur: e.message }, 500); return true; }
}
