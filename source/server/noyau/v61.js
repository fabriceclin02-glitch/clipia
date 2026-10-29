/**
 * CLIPIA V6.1 — quatre fonctions que les autres agents n'ont pas.
 *
 *  1. REMONTER LE TEMPS   Avant chaque écriture de fichier par un agent, un instantané. Un clic annule.
 *  2. RÉPÉTITION À BLANC  Les actions qui engagent quelque chose sont simulées : on voit ce qui serait fait, sans le faire.
 *  3. CONSEIL DE CERVEAUX Sur une question difficile, plusieurs modèles répondent ; un juge compare et montre les désaccords.
 *  4. FORGE DE COMPÉTENCES Une tâche réussie devient une compétence réutilisable, relue et acceptée par la personne.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from '../lib/env.js';
import { store } from '../lib/store.js';
import { chat } from '../providers/gateway.js';
import { chaine } from './demarrage.js';
import { competencesPerso } from './v6.js';

/* ══ 1. REMONTER LE TEMPS ═════════════════════════════════════════════════ */
const TEMPS = path.join(DATA_DIR, 'temps');
const MAX_OCTETS = 25 * 1024 * 1024;
const journal = () => store.setting('temps.journal') || [];
const sauver = (l) => store.setting('temps.journal', l.slice(-400));

/** Les outils qui modifient des fichiers, et comment trouver les chemins touchés. */
export const OUTILS_FICHIERS = {
  fichier_ecrire: (p, projet, PROJETS_DIR) => [path.join(PROJETS_DIR, projet, String(p.chemin || ''))],
  fichier_remplacer: (p, projet, PROJETS_DIR) => [path.join(PROJETS_DIR, projet, String(p.chemin || ''))],
  disque_ecrire: (p, _projet, _D, resoudre) => { try { return [resoudre(String(p.chemin || ''), { pourEcrire: true })]; } catch { return []; } }
};

/** Prend l'instantané avant l'action. Rend un « ticket » à passer à apres(). */
export function avant(nom, params, projet, { PROJETS_DIR, resoudre } = {}) {
  const sel = OUTILS_FICHIERS[nom]; if (!sel) return null;
  let chemins = []; try { chemins = sel(params || {}, projet, PROJETS_DIR, resoudre).filter(Boolean); } catch {}
  if (!chemins.length) return null;
  const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  const dir = path.join(TEMPS, id); fs.mkdirSync(dir, { recursive: true });
  const fichiers = chemins.map((c, i) => {
    let existait = false, sauvegarde = null;
    try {
      const st = fs.statSync(c);
      if (st.isFile()) { existait = true; if (st.size <= MAX_OCTETS) { sauvegarde = `${i}.avant`; fs.copyFileSync(c, path.join(dir, sauvegarde)); } }
    } catch {}
    return { chemin: c, existait, sauvegarde };
  });
  return { id, outil: nom, fichiers, quand: new Date().toISOString() };
}

export function apres(ticket, { ok, resume = '' } = {}) {
  if (!ticket) return;
  const l = journal();
  l.push({ id: ticket.id, quand: ticket.quand, outil: ticket.outil, ok: Boolean(ok), resume: String(resume).slice(0, 200),
           fichiers: ticket.fichiers, etat: ok ? 'fait' : 'echec' });
  sauver(l);
}

export function abandonner(ticket) { if (ticket) try { fs.rmSync(path.join(TEMPS, ticket.id), { recursive: true, force: true }); } catch {} }

export const listeJournal = (n = 80) => journal().slice(-n).reverse().map(e => ({
  id: e.id, quand: e.quand, outil: e.outil, etat: e.etat, resume: e.resume,
  fichiers: e.fichiers.map(f => ({ chemin: f.chemin, existait: f.existait, restaurable: !f.existait || Boolean(f.sauvegarde) }))
}));

/** Remet les fichiers dans l'état d'avant l'action. L'état courant est gardé : annuler est lui-même annulable. */
export function annuler(id) {
  const l = journal(); const e = l.find(x => x.id === id);
  if (!e) throw new Error('Action introuvable.');
  if (e.etat === 'annule') throw new Error('Déjà annulée.');
  const dir = path.join(TEMPS, id); let n = 0; const refus = [];
  e.fichiers.forEach((f, i) => {
    try {
      if (fs.existsSync(f.chemin)) fs.copyFileSync(f.chemin, path.join(dir, `${i}.apres`));
      if (f.existait) {
        if (!f.sauvegarde) { refus.push(f.chemin + ' (trop gros pour être sauvegardé)'); return; }
        fs.mkdirSync(path.dirname(f.chemin), { recursive: true });
        fs.copyFileSync(path.join(dir, f.sauvegarde), f.chemin);
      } else if (fs.existsSync(f.chemin)) {
        fs.renameSync(f.chemin, path.join(dir, `${i}.cree`));   // un fichier créé par l'action est mis de côté, pas détruit
      }
      n++;
    } catch (er) { refus.push(f.chemin + ' : ' + er.message); }
  });
  e.etat = 'annule'; e.annule = new Date().toISOString(); sauver(l);
  return { annule: n, refus };
}

/* ══ 2. RÉPÉTITION À BLANC ════════════════════════════════════════════════ */
export const repetitionBlanc = () => store.setting('blanc') === true;
export const definirBlanc = (v) => { store.setting('blanc', Boolean(v)); return repetitionBlanc(); };
/** Ce qui engage quelque chose : on le simule en mode « à blanc ». */
export const RISQUES = new Set(['fichier_ecrire', 'fichier_remplacer', 'disque_ecrire', 'machine_executer', 'executer',
  'telegram_envoyer', 'slack_envoyer', 'whatsapp_envoyer', 'google_gmail_envoyer', 'google_agenda_creer', 'ms_outlook_envoyer',
  'ms_agenda_creer', 'chrome_cliquer', 'chrome_taper', 'ordi_souris', 'ordi_clavier', 'ordi_ouvrir_app', 'code_clipia_modifier', 'kodi']);
export const decrireSimulation = (nom, params = {}) => {
  const p = { ...params }; delete p.accord;
  for (const k of Object.keys(p)) if (typeof p[k] === 'string' && p[k].length > 300) p[k] = p[k].slice(0, 300) + '…';
  return `[SIMULATION — rien n'a été fait] Avec « ${nom} » j'aurais agi ainsi : ${JSON.stringify(p)}`;
};

/* ══ 3. CONSEIL DE CERVEAUX ═══════════════════════════════════════════════ */
const sansPensee = (t) => String(t || '').replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

export async function conseil({ message, historique = [], system = '', max = 3 } = {}) {
  if (!message) throw new Error('Il faut une question.');
  const ch = chaine('conversation');
  const vus = new Set(), membres = [];
  for (const s of ch) { if (!vus.has(s.provider) && membres.length < max) { vus.add(s.provider); membres.push(s); } }
  if (!membres.length) throw new Error("Aucun cerveau ne répond pour l'instant : ouvre « Cerveau pas à pas ».");
  const fil = [...historique.slice(-8).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })), { role: 'user', content: String(message) }];
  const t0 = Date.now();
  const reps = (await Promise.all(membres.map(async (m) => {
    const t = Date.now();
    try {
      const r = await chat(m.provider, { model: m.model, system: system || 'Tu réponds en français, avec précision et sans inventer.', messages: fil, temperature: 0.4, maxTokens: 1200, timeout: 90000 });
      const texte = sansPensee(r.text); if (!texte) return null;
      return { provider: m.provider, model: r.model || m.model, texte, ms: Date.now() - t };
    } catch { return null; }
  }))).filter(Boolean);
  if (!reps.length) throw new Error("Aucun des cerveaux n'a répondu. Réessaie dans un instant.");
  if (reps.length === 1) return { texte: reps[0].texte, avis: reps, juge: null, desaccords: null, ms: Date.now() - t0, note: 'Un seul cerveau a répondu.' };
  const juge = membres.find(m => m.provider === reps[0].provider) || membres[0];
  const prompt = `Question de la personne :\n${message}\n\n` + reps.map((r, i) => `=== AVIS ${i + 1} (${r.provider}) ===\n${r.texte}`).join('\n\n') +
    `\n\nTu es le juge. 1) Écris la MEILLEURE réponse finale, en français, complète et fiable (corrige les erreurs, garde le meilleur de chacun). 2) Puis une ligne « DÉSACCORDS : » suivie de 1 à 3 points sur lesquels les avis divergent vraiment, ou « aucun ».`;
  let texte = reps[0].texte, desaccords = null;
  try {
    const r = await chat(juge.provider, { model: juge.model, system: 'Tu es un juge rigoureux qui synthétise plusieurs avis.', messages: [{ role: 'user', content: prompt }], temperature: 0.2, maxTokens: 1500, timeout: 90000 });
    const t = sansPensee(r.text);
    if (t) { const i = t.search(/D[ÉE]SACCORDS?\s*:/i); if (i > 0) { texte = t.slice(0, i).trim(); desaccords = t.slice(i).replace(/^D[ÉE]SACCORDS?\s*:\s*/i, '').trim(); } else texte = t; }
  } catch {}
  return { texte, avis: reps, juge: juge.provider, desaccords: desaccords && !/^aucun/i.test(desaccords) ? desaccords : null, ms: Date.now() - t0 };
}

/* ══ 4. FORGE DE COMPÉTENCES ══════════════════════════════════════════════ */
export const propositions = () => store.setting('competences-proposees') || [];
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'competence';

/** Écrit un brouillon de compétence à partir d'une tâche réussie. Rien n'est actif tant que la personne n'a pas accepté. */
export async function proposerCompetence({ tache, etapes = [], nom = '' } = {}) {
  if (!tache) throw new Error('Il faut décrire la tâche réussie.');
  const ch = chaine('conversation'); if (!ch.length) throw new Error("Aucun cerveau ne répond pour l'instant.");
  const resume = (etapes || []).slice(0, 14).map((e, i) => `${i + 1}. ${e.outil || ''} ${e.ok === false ? '(échec)' : ''} ${String(e.resultat || e.resume || '').slice(0, 160)}`).join('\n');
  const prompt = `Une tâche vient d'être réussie. Écris la COMPÉTENCE réutilisable qui permettrait de la refaire.\nTâche : ${tache}\nÉtapes réalisées :\n${resume || '(non détaillées)'}\n\nFormat exact (français, concis, générique, SANS aucune donnée personnelle, mot de passe ni clé) :\nNOM: <3 à 5 mots>\nDESCRIPTION: <une phrase : quand l'utiliser>\n---\n# Quand l'utiliser\n…\n# Méthode\n1. …\n# Vérifier\n…\n# Pièges\n…`;
  let texte = ''; let essai = 0;
  for (const s of ch) { if (essai++ > 2) break; try { const r = await chat(s.provider, { model: s.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, maxTokens: 1200, timeout: 90000 }); texte = sansPensee(r.text); if (texte) break; } catch {} }
  if (!texte) throw new Error("Je n'ai pas réussi à rédiger la compétence pour l'instant.");
  const n = (/^NOM:\s*(.+)$/mi.exec(texte) || [, nom || tache.slice(0, 40)])[1].trim();
  const d = (/^DESCRIPTION:\s*(.+)$/mi.exec(texte) || [, ''])[1].trim();
  const corps = texte.replace(/^NOM:.*$/mi, '').replace(/^DESCRIPTION:.*$/mi, '').replace(/^\s*---\s*$/m, '').trim().slice(0, 8000);
  const p = { id: 'forge-' + slug(n) + '-' + Date.now().toString(36).slice(-4), nom: n, description: d, texte: corps, tache: String(tache).slice(0, 300), cree: new Date().toISOString() };
  store.setting('competences-proposees', [...propositions(), p].slice(-30));
  return p;
}
export function accepterCompetence(id, texteModifie) {
  const l = propositions(); const p = l.find(x => x.id === id); if (!p) throw new Error('Proposition introuvable.');
  const cur = competencesPerso();
  cur.push({ id: p.id, nom: p.nom, description: p.description, texte: String(texteModifie || p.texte).slice(0, 12000), source: 'forge', importe: new Date().toISOString() });
  store.setting('competences', cur); store.setting('competences-proposees', l.filter(x => x.id !== id)); return true;
}
export const refuserCompetence = (id) => { store.setting('competences-proposees', propositions().filter(x => x.id !== id)); return true; };

/* Outils d'agent */
export const OUTILS_V61 = {
  conseil_cerveaux: {
    groupe: 'savoir',
    description: 'Pour une question difficile ou importante : consulte 2 ou 3 cerveaux différents, un juge compare et montre les désaccords. Paramètre : question. Plus lent et plus coûteux : à réserver à ce qui le mérite.',
    async run({ question }) {
      const r = await conseil({ message: question });
      return { resume: r.texte, donnees: { desaccords: r.desaccords, cerveaux: r.avis.map(a => a.provider) }, preuve: { genre: 'conseil', cerveaux: r.avis.length, ms: r.ms } };
    }
  },
  competence_proposer: {
    groupe: 'savoir',
    description: 'Après une tâche à plusieurs étapes RÉUSSIE, propose d\'en faire une compétence réutilisable (la personne la relit et l\'accepte, ou la refuse). Paramètres : tache (ce qui a été accompli), nom (facultatif).',
    async run({ tache, nom }) {
      const p = await proposerCompetence({ tache, nom });
      return { resume: `Compétence « ${p.nom} » proposée : elle attend la relecture de la personne (menu Connexions & compétences).`, preuve: { genre: 'memoire', sujet: p.nom, caracteres: p.texte.length } };
    }
  }
};
