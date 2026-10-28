/**
 * CLIPIA — Outils de l'agent développeur.
 * Tout est confiné au dossier du projet : l'agent ne peut rien toucher ailleurs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DATA_DIR } from '../lib/env.js';

export const PROJETS_DIR = path.join(DATA_DIR, 'projets');
fs.mkdirSync(PROJETS_DIR, { recursive: true });

/** Binaires autorisés. Tout le reste est refusé. */
const BINAIRES = new Set(['node','npm','npx','git','python3','pip3','ls','cat','mkdir','mv','cp','echo','sed','grep','find','wc','head','tail','ffmpeg','tsc','vite','esbuild']);

/** Découpe une ligne de commande en respectant les guillemets. */
function decouper(ligne) {
  const out = []; let cur = ''; let quote = null;
  for (const c of String(ligne).trim()) {
    if (quote) { if (c === quote) quote = null; else cur += c; }
    else if (c === '"' || c === "'") quote = c;
    else if (/\s/.test(c)) { if (cur) { out.push(cur); cur = ''; } }
    else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

export class AgentError extends Error {}

/** Résout un chemin en garantissant qu'il reste dans le projet. */
function dans(projet, rel = '.') {
  const base = path.resolve(PROJETS_DIR, projet);
  if (!base.startsWith(PROJETS_DIR)) throw new AgentError('Nom de projet invalide.');
  const cible = path.resolve(base, rel);
  if (!cible.startsWith(base)) throw new AgentError(`Chemin hors du projet : ${rel}`);
  return cible;
}

export function creerProjet(nom) {
  const safe = nom.replace(/[^\w.\-]/g, '-').slice(0, 60) || 'projet';
  const dir = path.join(PROJETS_DIR, safe);
  fs.mkdirSync(dir, { recursive: true });
  return safe;
}

export function listerProjets() {
  return fs.readdirSync(PROJETS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const dir = path.join(PROJETS_DIR, d.name);
      const st = fs.statSync(dir);
      return { nom: d.name, modifie: st.mtime.toISOString(), fichiers: compter(dir) };
    })
    .sort((a, b) => b.modifie.localeCompare(a.modifie));
}

function compter(dir, n = 0) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    n = e.isDirectory() ? compter(path.join(dir, e.name), n) : n + 1;
  }
  return n;
}

export function arborescence(projet, rel = '.', profondeur = 0) {
  const dir = dans(projet, rel);
  if (profondeur > 4) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const r = path.posix.join(rel === '.' ? '' : rel, e.name);
    if (e.isDirectory()) out.push({ type: 'dossier', chemin: r, enfants: arborescence(projet, r, profondeur + 1) });
    else out.push({ type: 'fichier', chemin: r, octets: fs.statSync(path.join(dir, e.name)).size });
  }
  return out;
}

/** ── Les outils proprement dits ──────────────────────────────────────── */
export const OUTILS = {
  ecrire_fichier: {
    description: "Crée ou remplace un fichier. Paramètres : chemin (relatif au projet), contenu.",
    async run({ chemin, contenu }, ctx) {
      const f = dans(ctx.projet, chemin);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, contenu ?? '');
      return `Écrit : ${chemin} (${Buffer.byteLength(contenu ?? '')} octets)`;
    }
  },
  lire_fichier: {
    description: "Lit un fichier existant. Paramètre : chemin.",
    async run({ chemin }, ctx) {
      const f = dans(ctx.projet, chemin);
      if (!fs.existsSync(f)) return `Introuvable : ${chemin}`;
      const t = fs.readFileSync(f, 'utf8');
      return t.length > 20000 ? t.slice(0, 20000) + '\n…(tronqué)' : t;
    }
  },
  remplacer_dans_fichier: {
    description: "Remplace un passage exact dans un fichier. Paramètres : chemin, ancien, nouveau.",
    async run({ chemin, ancien, nouveau }, ctx) {
      const f = dans(ctx.projet, chemin);
      if (!fs.existsSync(f)) throw new AgentError(`Introuvable : ${chemin}`);
      const t = fs.readFileSync(f, 'utf8');
      const n = t.split(ancien).length - 1;
      if (n === 0) throw new AgentError(`Passage absent de ${chemin}.`);
      if (n > 1) throw new AgentError(`Passage présent ${n} fois dans ${chemin} : précisez davantage.`);
      fs.writeFileSync(f, t.replace(ancien, nouveau ?? ''));
      return `Modifié : ${chemin}`;
    }
  },
  lister_fichiers: {
    description: "Liste l'arborescence du projet. Aucun paramètre.",
    async run(_, ctx) {
      const plat = [];
      (function parcourir(n) { for (const e of n) { plat.push(e.chemin); if (e.enfants) parcourir(e.enfants); } })(arborescence(ctx.projet));
      return plat.length ? plat.join('\n') : '(projet vide)';
    }
  },
  supprimer_fichier: {
    description: "Supprime un fichier. Paramètre : chemin.",
    async run({ chemin }, ctx) {
      const f = dans(ctx.projet, chemin);
      if (fs.existsSync(f)) fs.rmSync(f, { recursive: true });
      return `Supprimé : ${chemin}`;
    }
  },
  executer: {
    description: "Exécute une commande dans le projet (node, npm, npx, git, python3…). Paramètre : commande.",
    async run({ commande }, ctx) {
      const parts = decouper(commande);
      if (!parts.length) throw new AgentError('Commande vide.');
      if (!BINAIRES.has(parts[0])) throw new AgentError(`Commande refusée : « ${parts[0] } ». Autorisées : ${[...BINAIRES].join(', ')}`);
      const cwd = dans(ctx.projet);
      return new Promise((resolve) => {
        const ps = spawn(parts[0], parts.slice(1), { cwd, timeout: 120000 });
        let out = '';
        ps.stdout.on('data', d => { out += d; });
        ps.stderr.on('data', d => { out += d; });
        ps.on('error', e => resolve(`Échec : ${e.message}`));
        ps.on('close', c => resolve(`(code ${c})\n${out.slice(-4000) || '(aucune sortie)'}`));
      });
    }
  },
  terminer: {
    description: "À appeler quand la tâche est finie. Paramètre : resume (ce qui a été fait).",
    async run({ resume }) { return resume || 'Terminé.'; }
  }
};

export const catalogueOutils = () =>
  Object.entries(OUTILS).map(([nom, o]) => `- ${nom} : ${o.description}`).join('\n');
