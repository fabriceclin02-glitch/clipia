/** CLIPIA X7 — « Pont OpenClaw » : reprend les compétences et les savoir-faire d'OpenClaw (MIT, OpenClaw Foundation).
 *  • 50 compétences officielles (SKILL.md) livrées avec Clipia, + celles trouvées sur l'ordinateur (OpenClaw déjà installé) ;
 *  • elles sont lues comme des DONNÉES (méthodes), jamais comme des ordres qui l'emportent sur la personne ;
 *  • un pont vers la commande `openclaw` (état, compétences, agent) quand il est installé. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { store } from '../lib/store.js';
import * as v6 from './v6.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const DOSSIER_FOURNI = path.join(ICI, 'openclaw-skills');
const PLATEFORME = { win32: 'win32', darwin: 'darwin', linux: 'linux' }[process.platform] || process.platform;

/* Compétences qui ne servent qu'à piloter OpenClaw lui-même : inutiles dans Clipia. */
const SPECIFIQUES = new Set(['control-ui', 'node-connect', 'healthcheck', 'create-claw', 'clawhub', 'skill-creator']);
const CATEGORIES = {
  'Communication & agenda': ['himalaya', 'gog', 'xurl', 'goplaces', 'weather', 'blogwatcher', 'summarize'],
  'Notes & tâches': ['apple-notes', 'apple-reminders', 'bear-notes', 'obsidian', 'notion', 'trello', 'things-mac'],
  'Code & développement': ['coding-agent', 'github', 'gh-issues', 'gemini', 'oracle', 'tmux', 'node-inspect-debugger', 'python-debugpy', 'spike', 'mcporter'],
  'Audio, voix & musique': ['openai-whisper', 'openai-whisper-api', 'sherpa-onnx-tts', 'sag', 'songsee', 'spotify-player', 'sonoscli', 'blucli'],
  'Image, vidéo & documents': ['diagram-maker', 'visualize', 'meme-maker', 'gifgrep', 'nano-pdf', 'camsnap', 'peekaboo'],
  'Maison & vie pratique': ['openhue', 'eightctl', 'ordercli', '1password', 'model-usage']
};
const categorieDe = (n) => Object.entries(CATEGORIES).find(([, l]) => l.includes(n))?.[0] || 'Autres';

function entete(texte) {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(texte); const o = {};
  if (m) for (const l of m[1].split('\n')) { const k = /^([\w-]+):\s*(.*)$/.exec(l); if (k) o[k[1]] = k[2].replace(/^["']|["']$/g, ''); }
  const meta = m ? m[1] : '';
  const os_ = /"os"\s*:\s*\[([^\]]*)\]/.exec(meta); const bins = /"(?:anyBins|bins)"\s*:\s*\[([^\]]*)\]/.exec(meta); const em = /"emoji"\s*:\s*"([^"]+)"/.exec(meta);
  o._os = os_ ? [...os_[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
  o._bins = bins ? [...bins[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
  o._emoji = em ? em[1] : '🧩';
  return o;
}
const quelBin = (b) => { try { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [b], { timeout: 3000, shell: process.platform === 'win32' }); return r.status === 0; } catch { return false; } };

const dossiersLocaux = () => {
  const h = os.homedir(); const sortie = [];
  for (const d of [path.join(h, '.openclaw', 'skills'), path.join(h, '.openclaw', 'workspace', 'skills'), path.join(h, '.agents', 'skills'),
                   process.env.OPENCLAW_STATE_DIR && path.join(process.env.OPENCLAW_STATE_DIR, 'skills')].filter(Boolean)) sortie.push(d);
  try { const r = spawnSync('npm', ['root', '-g'], { timeout: 5000, shell: process.platform === 'win32' }); const g = String(r.stdout).trim();
        if (g) sortie.push(path.join(g, 'openclaw', 'skills')); } catch {}
  if (process.env.APPDATA) sortie.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'openclaw', 'skills'));
  return sortie;
};

export function catalogue() {
  const vus = new Map(); const manque = new Map();
  const lire = (base, source) => {
    let noms = []; try { noms = fs.readdirSync(base); } catch { return; }
    for (const n of noms) {
      const f = path.join(base, n, 'SKILL.md'); let t; try { t = fs.readFileSync(f, 'utf8'); } catch { continue; }
      if (t.length > 80000) continue;
      const e = entete(t); const id = 'oc-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const bins = e._bins; if (!manque.has(bins.join())) manque.set(bins.join(), bins.length ? bins.some(quelBin) : true);
      const ok_os = !e._os.length || e._os.includes(PLATEFORME);
      vus.set(id, { id, cle: n, nom: e.name || n, icone: e._emoji, description: (e.description || '').slice(0, 240), categorie: categorieDe(n), source, fichier: f, taille: t.length,
        plateforme_ok: ok_os, os: e._os, outils: bins, outil_present: manque.get(bins.join()), specifique: SPECIFIQUES.has(n) });
    }
  };
  lire(DOSSIER_FOURNI, 'fourni');
  for (const d of dossiersLocaux()) lire(d, 'ordinateur');      // les versions de TON OpenClaw l'emportent
  const importees = new Set(v6.competencesPerso().filter(c => c.source === 'openclaw').map(c => c.id));
  return [...vus.values()].map(s => ({ ...s, importee: importees.has(s.id) })).sort((a, b) => a.categorie.localeCompare(b.categorie) || a.nom.localeCompare(b.nom));
}

export function importerTout({ ids = null } = {}) {
  const liste = catalogue().filter(s => ids ? ids.includes(s.id) : (!s.specifique && s.plateforme_ok));
  const cur = v6.competencesPerso(); let n = 0;
  for (const s of liste) {
    let t = ''; try { t = fs.readFileSync(s.fichier, 'utf8'); } catch { continue; }
    const corps = t.replace(/^---[\s\S]*?\n---\s*/, '').slice(0, 12000);
    const ent = { id: s.id, nom: s.nom, description: s.description, texte: corps, source: 'openclaw', importe: new Date().toISOString() };
    const i = cur.findIndex(c => c.id === s.id); if (i >= 0) cur[i] = ent; else cur.push(ent); n++;
  }
  store.setting('competences', cur); return { importees: n, total: cur.length };
}
export function retirerTout() { const cur = v6.competencesPerso().filter(c => c.source !== 'openclaw'); store.setting('competences', cur); return { ok: true }; }

/* Ce qu'OpenClaw sait faire, et comment Clipia le reprend. */
export const SAVOIRS = [
  { id: 'canaux', icone: '💬', nom: 'Messageries', openclaw: 'WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, Google Chat, Matrix, IRC, LINE, Twitch… (20+ canaux)', clipia: 'WhatsApp, Telegram et le téléphone (X7) sont natifs ; les autres canaux passent par OpenClaw via le pont.', pont: true },
  { id: 'skills', icone: '🧩', nom: 'Compétences (SKILL.md)', openclaw: '50 compétences officielles : mail, agenda Google, GitHub, Notion, Obsidian, Trello, Whisper, TTS local, Spotify, Sonos, Hue, diagrammes, PDF…', clipia: 'Toutes reprises dans Clipia (menu Pont OpenClaw), cochables, lues comme méthodes.', pont: false },
  { id: 'navigateur', icone: '🌐', nom: 'Navigateur piloté', openclaw: 'Contrôle d’un navigateur (clics, formulaires, captures).', clipia: 'Extension Chrome de Clipia + outils navigateur_* ; OpenClaw en renfort pour les cas difficiles.', pont: true },
  { id: 'cron', icone: '⏰', nom: 'Tâches planifiées', openclaw: 'Cron intégré : tâches récurrentes, rappels, veilles.', clipia: 'Planificateur de Clipia (workflows) ; `openclaw cron` accessible via le pont.', pont: true },
  { id: 'memoire', icone: '🧠', nom: 'Mémoire', openclaw: 'Mémoire durable (fichiers, LanceDB, wiki).', clipia: 'Mémoire de Clipia (memoire_noter) + lecture de ton workspace OpenClaw.', pont: false },
  { id: 'agents', icone: '🤖', nom: 'Agents & harnais de code', openclaw: 'Délègue à Codex, Claude Code, OpenCode ; sous-agents ; ACP.', clipia: 'Atelier d’agents de Clipia ; `openclaw agent` appelable via l’outil openclaw_cli.', pont: true },
  { id: 'mcp', icone: '🔌', nom: 'MCP', openclaw: 'Serveurs MCP (mcporter), relais MCP.', clipia: 'Serveur MCP de Clipia pour le téléphone (X7) et connexions MCP.', pont: false },
  { id: 'voix', icone: '🎙', nom: 'Voix', openclaw: 'Whisper local, TTS local (sherpa-onnx), ElevenLabs, appels vocaux.', clipia: 'Voix et dictée natives ; Whisper/sherpa installables par la Logithèque.', pont: false },
  { id: 'noeuds', icone: '📱', nom: 'Applis & nœuds', openclaw: 'Apps macOS/iOS/Android : caméra, écran, canvas.', clipia: 'Appli téléphone Clipia (X7). Les nœuds OpenClaw restent côté OpenClaw.', pont: true }
];

/* ── le pont vers la commande `openclaw` ───────────────────────────────── */
export const binaireOpenClaw = () => { try { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['openclaw'], { timeout: 4000, shell: process.platform === 'win32' }); return r.status === 0 ? String(r.stdout).trim().split(/\r?\n/)[0] : ''; } catch { return ''; } };
const PERMIS = [/^status$/, /^gateway status$/, /^skills( list| info \S+| check)?$/, /^models( list| status)?$/, /^cron list$/, /^channels( list| status)?$/, /^health$/, /^agent exec$/, /^agent$/, /^sessions( list)?$/, /^doctor$/];
export function cli(args, { timeout = 120000 } = {}) {
  const liste = (Array.isArray(args) ? args : String(args || '').split(/\s+/)).filter(Boolean).map(String);
  const tete = liste.filter(a => !a.startsWith('-')).slice(0, 3);
  const cmd = liste[0] === 'agent' ? (liste[1] === 'exec' ? 'agent exec' : 'agent') : tete.join(' ');
  const base = liste[0] === 'agent' ? cmd : (PERMIS.find(r => r.test(tete.join(' '))) ? tete.join(' ') : '');
  if (!base && !PERMIS.some(r => r.test(cmd))) throw new Error(`Commande OpenClaw non autorisée par le pont : « ${liste.slice(0, 3).join(' ')} ». Autorisées : status, skills, models, cron list, channels, health, sessions, doctor, agent exec "<tâche>".`);
  const bin = binaireOpenClaw(); if (!bin) throw new Error('OpenClaw n’est pas trouvé sur cet ordinateur (commande `openclaw` absente). Installe-le : npm install -g openclaw@latest');
  return new Promise((res, rej) => {
    const p = spawn(bin.endsWith('.cmd') || process.platform === 'win32' ? 'openclaw' : bin, liste, { shell: process.platform === 'win32', windowsHide: true }); let out = '', err = '';
    const t = setTimeout(() => { try { p.kill(); } catch {} rej(new Error('OpenClaw met trop de temps à répondre.')); }, timeout);
    p.stdout.on('data', d => { out += d; if (out.length > 60000) out = out.slice(-60000); }); p.stderr.on('data', d => { err += d; if (err.length > 8000) err = err.slice(-8000); });
    p.on('error', e => { clearTimeout(t); rej(e); }); p.on('close', c => { clearTimeout(t); c === 0 ? res(out.trim()) : rej(new Error((err || out || 'code ' + c).slice(-600))); });
  });
}

export async function etat() {
  const base = await v6.detecterOpenClaw();
  const cat = catalogue();
  return { ...base, skills: undefined, catalogue: cat, plateforme: PLATEFORME, savoirs: SAVOIRS,
    resume: { total: cat.length, importees: cat.filter(s => s.importee).length, compatibles: cat.filter(s => s.plateforme_ok && !s.specifique).length, pretes: cat.filter(s => s.plateforme_ok && !s.specifique && s.outil_present).length },
    licence: 'MIT — © OpenClaw Foundation (compétences livrées avec leur licence)' };
}
