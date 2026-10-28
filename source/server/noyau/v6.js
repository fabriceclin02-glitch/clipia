/**
 * CLIPIA V6 — capacités à cocher, détection d'OpenClaw, compétences importées, agents de départ.
 *
 * Principe de sécurité : une case cochée AUTORISE un type d'outil à exister ; elle ne dispense jamais
 * de la carte « Autoriser » au moment d'une action sensible (ordinateur, Chrome, commandes).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { store } from '../lib/store.js';
import { INTEGREES } from './competences-integrees.js';

/* ══ LES CAPACITÉS ═══════════════════════════════════════════════════════ */
export const CAPACITES = [
  { id: 'ordinateur', nom: 'Clavier, souris et applications', quoi: 'Ouvrir des applications, taper, cliquer, lire les fenêtres.', outils: /^ordi_/ },
  { id: 'chrome',     nom: 'Navigateur Chrome',               quoi: 'Ouvrir des pages, lire, cliquer, remplir (avec l\'extension).', outils: /^(chrome_|navigateur_)/ },
  { id: 'fichiers',   nom: 'Fichiers de l\'ordinateur',        quoi: 'Lire, écrire et ranger des fichiers dans les dossiers autorisés.', outils: /^fichier_/ },
  { id: 'code',       nom: 'Coder et exécuter',               quoi: 'Écrire du code, lancer des commandes, se corriger elle-même.', outils: /^(executer|machine_executer|code_clipia_)/ },
  { id: 'micro',      nom: 'Microphone',                      quoi: 'T\'entendre quand tu lui parles.', outils: null },
  { id: 'son',        nom: 'Son et voix',                     quoi: 'Parler à voix haute, jouer des sons et de la musique.', outils: /^(voix_dire|son_apaisant|musique_creer)$/ },
  { id: 'systeme',    nom: 'Système',                         quoi: 'Connaître l\'état de la machine (mémoire, disque, programmes).', outils: /^(systeme_|etat_machine)/ },
  { id: 'connexions', nom: 'Messageries et comptes',        quoi: 'Telegram, Slack, WhatsApp, Gmail, Agenda, Drive, Outlook, OneDrive (envois : toujours avec ton accord).', outils: /^(telegram_|slack_|whatsapp_|google_|ms_)/ },
  { id: 'openclaw',   nom: 'OpenClaw',                        quoi: 'Confier des tâches à ton agent OpenClaw s\'il est installé.', outils: /^openclaw_/ }
];

/** Tant que la personne n'a rien décidé, tout reste permis (comportement des versions précédentes). */
export const capacitesChoisies = () => store.setting('capacites') || null;
export const definirCapacites = (c) => {
  const propre = {}; for (const x of CAPACITES) propre[x.id] = Boolean(c?.[x.id]);
  store.setting('capacites', propre); return propre;
};
export function outilAutorise(nom) {
  const c = capacitesChoisies(); if (!c) return { ok: true };
  const cap = CAPACITES.find(x => x.outils && x.outils.test(nom));
  if (!cap || c[cap.id] !== false) return { ok: true };
  return { ok: false, message: `La capacité « ${cap.nom} » est désactivée. Active-la dans Configuration → Accès de Clipia.` };
}

/* ══ OPENCLAW : détection chez la personne ═══════════════════════════════ */
const dossiersCandidats = () => {
  const h = os.homedir();
  return [path.join(h, '.openclaw'), path.join(h, '.clawdbot'), path.join(h, '.moltbot'),
          process.env.OPENCLAW_HOME, process.env.APPDATA && path.join(process.env.APPDATA, 'openclaw')].filter(Boolean);
};
const portOuvert = (port, hote = '127.0.0.1', ms = 700) => new Promise(res => {
  const s = net.connect({ port, host: hote }); const fin = v => { try { s.destroy(); } catch {} res(v); };
  s.setTimeout(ms, () => fin(false)); s.on('connect', () => fin(true)); s.on('error', () => fin(false));
});
const binaire = () => {
  try { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['openclaw'], { timeout: 4000, shell: process.platform === 'win32' });
        return r.status === 0 ? String(r.stdout).trim().split(/\r?\n/)[0] : ''; } catch { return ''; }
};

function lireEntete(texte) {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(texte); const o = {};
  if (m) for (const l of m[1].split('\n')) { const k = /^([\w-]+):\s*(.*)$/.exec(l.trim()); if (k) o[k[1]] = k[2].replace(/^["']|["']$/g, ''); }
  return o;
}
export function skillsOpenClaw() {
  const trouves = [];
  for (const d of dossiersCandidats()) {
    for (const sous of ['skills', path.join('workspace', 'skills')]) {
      const base = path.join(d, sous);
      let noms = []; try { noms = fs.readdirSync(base); } catch { continue; }
      for (const n of noms) {
        const f = path.join(base, n, 'SKILL.md');
        try {
          const t = fs.readFileSync(f, 'utf8');
          if (t.length > 60000) continue;
          const e = lireEntete(t);
          trouves.push({ id: 'oc-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-'), nom: e.name || n, description: (e.description || '').slice(0, 220), fichier: f, taille: t.length });
        } catch {}
      }
    }
  }
  return trouves.filter((s, i, t) => t.findIndex(x => x.id === s.id) === i);
}
export async function detecterOpenClaw() {
  const dossiers = dossiersCandidats().filter(d => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
  const bin = binaire();
  const passerelle = await portOuvert(18789);
  const skills = skillsOpenClaw();
  return { present: Boolean(dossiers.length || bin || passerelle), dossiers, binaire: bin, passerelle, skills,
           importees: competences().filter(c => c.source === 'openclaw').length };
}

/* ══ COMPÉTENCES IMPORTÉES (SKILL.md) ════════════════════════════════════
   Ce sont des textes écrits par d'autres : Clipia les lit comme des DONNÉES (méthodes à suivre),
   jamais comme des ordres qui l'emporteraient sur la personne. Seules celles que tu coches sont importées. */
export const INTEGREES_LISTE = INTEGREES;
export const competencesPerso = () => store.setting('competences') || [];
export const integreesOff = () => store.setting('competences-integrees-off') || [];
export const basculerIntegree = (id, actif) => { const o = new Set(integreesOff()); if (actif) o.delete(id); else o.add(id); store.setting('competences-integrees-off', [...o]); return [...o]; };
export const competences = () => [...INTEGREES.filter(i => !integreesOff().includes(i.id)), ...competencesPerso()];
export function importerSkills(ids = []) {
  const dispo = skillsOpenClaw(); const cur = competencesPerso(); let n = 0;
  for (const s of dispo) {
    if (!ids.includes(s.id)) continue;
    let texte = ''; try { texte = fs.readFileSync(s.fichier, 'utf8'); } catch { continue; }
    const corps = texte.replace(/^---[\s\S]*?\n---\s*/, '').slice(0, 12000);
    const i = cur.findIndex(c => c.id === s.id);
    const ent = { id: s.id, nom: s.nom, description: s.description, texte: corps, source: 'openclaw', importe: new Date().toISOString() };
    if (i >= 0) cur[i] = ent; else cur.push(ent);
    n++;
  }
  store.setting('competences', cur); return { importees: n, total: cur.length };
}
export const retirerCompetence = (id) => { store.setting('competences', competencesPerso().filter(c => c.id !== id)); return true; };
export const listeCompetencesCourte = () => competences().map(c => `${c.nom} — ${c.description || 'sans description'}`).slice(0, 30);
export const lireCompetence = (nom) => {
  const r = String(nom || '').trim().toLowerCase();
  return competences().find(c => c.id === nom || c.nom.toLowerCase() === r) || competences().find(c => c.nom.toLowerCase().includes(r) && r.length > 2) || null;
};

/* ══ AGENTS DE DÉPART ════════════════════════════════════════════════════ */
export const AGENTS_DEPART = [
  { id: 'codeur', nom: 'Codeur', role: 'Tu es un développeur senior. Tu écris du code simple, testé, commenté en français, et tu expliques ce que tu as fait en une phrase.', groupes: ['code', 'machine', 'savoir'], modeleConseille: 'qwen2.5-coder:7b' },
  { id: 'chercheur', nom: 'Chercheur', role: 'Tu fais des recherches sur le web, tu croises les sources, tu cites tes sources et tu dis ce dont tu n\'es pas sûre.', groupes: ['savoir'] },
  { id: 'redacteur', nom: 'Rédacteur', role: 'Tu écris des textes clairs et vivants en français : posts, e-mails, fiches produit, articles. Tu proposes deux variantes.', groupes: ['savoir', 'code'] },
  { id: 'planificateur', nom: 'Planificateur', role: 'Tu transformes un objectif en plan daté : étapes, priorités, risques, prochaine action. Tu suis l\'avancement.', groupes: ['savoir', 'méta'] },
  { id: 'promoteur', nom: 'Promoteur', role: 'Tu fais la promotion de Clipia à la place de la personne : tu suis la compétence « Promotion de Clipia » (competence_lire promotion-clipia), tu prépares les textes, tu remplis les formulaires dans son Chrome déjà connecté, et tu demandes TOUJOURS son accord avant de publier ou d\'envoyer. Jamais de mot de passe, jamais de faux compte ni de faux avis.', groupes: ['savoir', 'ordinateur', 'navigateur', 'créer', 'agent_perso', 'méta'] },
  { id: 'entrepreneur', nom: 'Coach entrepreneur', role: "Tu aides la personne à lancer et développer son entreprise ou son activité : tu suis la compétence « Lancer mon entreprise » (competence_lire integree-entreprise-lancer) et ses compétences sœurs (offre, prix, prospection, démarches). Tu restes honnête : aucune promesse de revenus, repères légaux avec sources officielles, jamais d'envoi ni de dépôt de dossier sans accord.", groupes: ['savoir', 'créer', 'code', 'méta', 'agent_perso'] },
  { id: 'veilleur', nom: 'Veilleur d\'opportunités', role: "Tu cherches pour la personne des aides, appels à projets, concours, marchés et tendances (competence_lire integree-veille-opportunites). Tu cites tes sources officielles, les dates limites, et tu signales ce qui est à vérifier.", groupes: ['savoir', 'méta'] },
  { id: 'solidaire', nom: 'Aide aux autres', role: "Tu aides à monter une action solidaire ou une association utile (competence_lire integree-aider-les-autres) : besoin local, partenaires, financement, protection des personnes.", groupes: ['savoir', 'créer', 'méta'] },
  { id: 'secretaire', nom: 'Secrétaire', role: "Tu prépares courriers, devis, factures, comptes rendus et plannings dans des fichiers propres. Tu ne les envoies jamais sans l'accord de la personne.", groupes: ['savoir', 'code', 'méta'] },
  { id: 'createur', nom: 'Créateur visuel et sonore', role: 'Tu crées des images, des clips et de la musique avec les outils de Clipia, et tu proposes plusieurs pistes.', groupes: ['créer', 'code'] }
];
export async function creerAgentsDepart(ids = []) {
  const atelier = await import('./atelier.js');   // import différé : atelier dépend de la boucle, qui dépend de ce module
  const faits = [], deja = [];
  for (const a of AGENTS_DEPART) {
    if (!ids.includes(a.id)) continue;
    try { atelier.creerAgent({ nom: a.nom, role: a.role, groupes: a.groupes.filter(g => atelier.GROUPES[g]) }); faits.push(a.nom); }
    catch (e) { deja.push(a.nom + ' (' + e.message + ')'); }
  }
  return { faits, deja };
}

/* ══ ÉTAT GLOBAL POUR L'ASSISTANT ════════════════════════════════════════ */
export const termine = () => store.setting('assistant-v6.termine') || false;
export const marquerTermine = () => store.setting('assistant-v6.termine', true);
