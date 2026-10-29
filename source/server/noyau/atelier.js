/**
 * CLIPIA — L'atelier : projets durables, agents et sous-agents.
 *
 * Un PROJET a un objectif, des tâches, des notes, un dossier de fichiers et un
 * journal. Il survit aux redémarrages : on le rouvre, on voit où on en était,
 * on relance un agent dessus.
 *
 * Un AGENT est un rôle : des instructions, des outils autorisés, un moteur
 * préféré (ou « auto »). Un agent peut confier une sous-tâche à un autre agent
 * (un SOUS-AGENT) avec l'outil `agent_deleguer`.
 *
 * Garde-fous (ils ont tous une raison, et ils sont dans le code, pas dans un prompt) :
 *   • profondeur de délégation limitée à 2 ;
 *   • 4 délégations au plus par exécution ;
 *   • un agent ne peut pas déléguer à un agent déjà dans sa chaîne (pas de cycle) ;
 *   • 6 exécutions simultanées au plus ;
 *   • un sous-agent ne peut jamais obtenir l'accord de la personne : une action
 *     sensible lui est refusée et remonte dans son résumé ;
 *   • l'accès à la machine et au navigateur n'est JAMAIS donné par défaut à un
 *     agent : il faut le cocher explicitement, agent par agent ;
 *   • chaque exécution est enregistrée avec ses preuves et peut être annulée.
 */
import { store, uid } from '../lib/store.js';
import { OUTILS, creerProjet } from './outils.js';
import { converser } from './boucle.js';
import * as archive from './archive.js';
import * as graphe from '../cerveau/graphe.js';

export const MAX_PROFONDEUR = 2;
export const MAX_DELEGATIONS = 4;
export const MAX_ACTIFS = 6;
const COLL = { p: 'atelier_projets', a: 'atelier_agents', e: 'atelier_executions' };

const GROUPES_SURS = ['créer', 'code', 'savoir', 'studio', 'méta', 'atelier'];
export const GROUPES = {
  'créer': 'Images, musique, voix, clips, transcription',
  'code': 'Fichiers et commandes dans le dossier du projet',
  'savoir': 'Recherche web, lecture de pages, mémoire',
  'studio': 'Ouvrir les sections de l\'application',
  'méta': 'Plan, vérification, questions',
  'atelier': 'Gérer le projet et déléguer à des sous-agents',
  'agent': 'Confier une tâche à OpenClaw',
  'agent_perso': 'Créer des agents, workflows et projets ; reprendre d\'anciennes conversations',
  'ordinateur': 'Souris, clavier, applications et captures d\'écran (autorisation de 10 min)',
  'autocode': 'Lire et modifier le propre code de Clipia (accord requis, sauvegarde automatique)',
  'machine': 'Lire/écrire sur la machine, lancer des commandes (accord requis)',
  'navigateur': 'Piloter un navigateur (accord requis pour les clics sensibles)',
  'mcp': 'Outils externes branchés par MCP (accord requis à chaque appel)'
};

/* ══ LES AGENTS DE DÉPART ═════════════════════════════════════════════════ */
const DEPART = [
  { id: 'agt_chef', nom: 'Chef de projet', groupes: [...GROUPES_SURS],
    role: "Tu pilotes le projet. Tu découpes l'objectif en tâches (projet_tache), tu délègues chaque tâche au bon agent (agent_deleguer) et tu vérifies ce qu'ils rendent avant de dire que c'est fait. Tu ne fais pas toi-même ce qu'un spécialiste ferait mieux." },
  { id: 'agt_dev', nom: 'Développeur', groupes: ['code', 'savoir', 'méta', 'atelier'],
    role: "Tu écris du code complet et qui tourne : jamais de TODO. Tu le lances toi-même (executer) et tu ne dis qu'il marche que si la commande a réussi." },
  { id: 'agt_art', nom: 'Directeur artistique', groupes: ['créer', 'savoir', 'méta', 'atelier'],
    role: "Tu crées des images et des visuels. Tu écris des descriptions précises (sujet, lumière, style, cadrage), tu génères, puis tu juges le résultat avant de le rendre." },
  { id: 'agt_mus', nom: 'Compositeur', groupes: ['créer', 'méta', 'atelier'],
    role: "Tu composes la musique et les voix : style, tempo, instruments, durée. Tu proposes une variante si la première ne colle pas au brief." },
  { id: 'agt_vid', nom: 'Monteur', groupes: ['créer', 'code', 'méta', 'atelier'],
    role: "Tu montes les clips et vidéos à partir des sons et visuels du projet, calés sur le tempo. Tu vérifies que le fichier final existe et se lit." },
  { id: 'agt_red', nom: 'Rédacteur', groupes: ['savoir', 'code', 'méta', 'atelier'],
    role: "Tu rédiges : textes, scripts, fiches, descriptions. Tu écris pour la cible indiquée, sans remplissage, et tu enregistres le résultat dans un fichier du projet." },
  { id: 'agt_rec', nom: 'Chercheur', groupes: ['savoir', 'méta', 'atelier'],
    role: "Tu cherches et tu recoupes. Tu cites tes sources, tu distingues ce qui est établi de ce qui est probable, et tu notes l'essentiel dans le projet." }
];

function groupesVersOutils(groupes) {
  const set = new Set(groupes || GROUPES_SURS);
  return Object.entries(OUTILS).filter(([, o]) => set.has(o.groupe)).map(([n]) => n);
}

export function agents() {
  if (!store.all(COLL.a).length) {
    for (const a of DEPART) store.insert(COLL.a, { ...a, modele: null, parentId: null, integre: true, instructions: a.role });
  }
  return store.all(COLL.a);
}
const agentParRef = (ref) => {
  const l = agents(); const r = String(ref || '').trim().toLowerCase();
  return l.find(a => a.id === ref) || l.find(a => a.nom.toLowerCase() === r) || l.find(a => a.nom.toLowerCase().includes(r) && r.length > 2);
};

export function creerAgent({ nom, role, groupes, modele = null, parentId = null }) {
  nom = String(nom || '').trim().slice(0, 60);
  if (!nom) throw new Error("Un agent a besoin d'un nom.");
  if (agents().some(a => a.nom.toLowerCase() === nom.toLowerCase())) throw new Error(`Un agent « ${nom} » existe déjà.`);
  const g = (Array.isArray(groupes) ? groupes : GROUPES_SURS).filter(x => GROUPES[x]);
  return store.insert(COLL.a, {
    id: uid('agt'), nom, role: String(role || '').slice(0, 3000), instructions: String(role || '').slice(0, 3000),
    groupes: g, modele: modele?.provider ? { provider: String(modele.provider), model: modele.model ? String(modele.model) : undefined } : null,
    parentId: parentId || null, integre: false
  });
}
export function modifierAgent(id, patch) {
  const a = store.find(COLL.a, x => x.id === id);
  if (!a) throw new Error('Agent introuvable.');
  const p = {};
  if (patch.role !== undefined) { p.role = String(patch.role).slice(0, 3000); p.instructions = p.role; }
  if (Array.isArray(patch.groupes)) p.groupes = patch.groupes.filter(x => GROUPES[x]);
  if (patch.modele !== undefined) p.modele = patch.modele?.provider ? { provider: String(patch.modele.provider), model: patch.modele.model || undefined } : null;
  if (patch.parentId !== undefined) p.parentId = patch.parentId || null;
  return store.update(COLL.a, id, p);
}
export function supprimerAgent(id) {
  const a = store.find(COLL.a, x => x.id === id);
  if (!a) return false;
  for (const f of store.filter(COLL.a, x => x.parentId === id)) store.update(COLL.a, f.id, { parentId: null });
  return store.remove(COLL.a, id);
}
/** Les sous-agents déclarés d'un agent. */
export const sousAgents = (id) => agents().filter(a => a.parentId === id);

/* ══ LES PROJETS ══════════════════════════════════════════════════════════ */
export const projets = () => store.all(COLL.p).slice().sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
export const projet = (id) => store.find(COLL.p, p => p.id === id) || null;

export function creerProjetDurable({ nom, objectif = '' }) {
  nom = String(nom || '').trim().slice(0, 80);
  if (!nom) throw new Error('Un projet a besoin d\'un nom.');
  const dossier = creerProjet(nom);
  const np = store.insert(COLL.p, { nom, objectif: String(objectif).slice(0, 2000), statut: 'actif', dossier, taches: [], notes: [], journal: [] });
  archive.archiver({ genre: 'projet', titre: `Projet créé : ${nom}`, texte: objectif, projetId: np.id });
  return np;
}
export function modifierProjet(id, patch) {
  const p = projet(id); if (!p) throw new Error('Projet introuvable.');
  const m = {};
  if (patch.nom !== undefined) m.nom = String(patch.nom).slice(0, 80) || p.nom;
  if (patch.objectif !== undefined) m.objectif = String(patch.objectif).slice(0, 2000);
  if (['actif', 'termine', 'archive'].includes(patch.statut)) m.statut = patch.statut;
  return store.update(COLL.p, id, m);
}
/** Retire le projet de la liste. Les FICHIERS du projet ne sont jamais supprimés. */
export const retirerProjet = (id) => store.remove(COLL.p, id);

export function ajouterTache(projetId, { titre, agentId = null }) {
  const p = projet(projetId); if (!p) throw new Error('Projet introuvable.');
  const t = { id: uid('tch'), titre: String(titre || '').slice(0, 200), statut: 'a_faire', agentId, resultat: '', creeLe: new Date().toISOString() };
  if (!t.titre) throw new Error('Une tâche a besoin d\'un titre.');
  store.update(COLL.p, projetId, { taches: [...p.taches, t] });
  return t;
}
export function majTache(projetId, tacheId, patch) {
  const p = projet(projetId); if (!p) throw new Error('Projet introuvable.');
  let trouve = null;
  const taches = p.taches.map(t => {
    if (t.id !== tacheId) return t;
    trouve = { ...t };
    if (['a_faire', 'en_cours', 'fait', 'bloque'].includes(patch.statut)) trouve.statut = patch.statut;
    if (patch.titre !== undefined) trouve.titre = String(patch.titre).slice(0, 200);
    if (patch.resultat !== undefined) trouve.resultat = String(patch.resultat).slice(0, 1500);
    if (patch.agentId !== undefined) trouve.agentId = patch.agentId || null;
    return trouve;
  });
  if (!trouve) throw new Error('Tâche introuvable.');
  store.update(COLL.p, projetId, { taches });
  return trouve;
}
export function ajouterNote(projetId, texte, source = 'personne') {
  const p = projet(projetId); if (!p) throw new Error('Projet introuvable.');
  const n = { quand: new Date().toISOString(), texte: String(texte).slice(0, 1500), source };
  store.update(COLL.p, projetId, { notes: [...p.notes, n].slice(-100) });
  return n;
}
function journaliser(projetId, entree) {
  const p = projet(projetId); if (!p) return;
  store.update(COLL.p, projetId, { journal: [...p.journal, { quand: new Date().toISOString(), ...entree }].slice(-200) });
}

/* ══ LES EXÉCUTIONS ═══════════════════════════════════════════════════════ */
export const executions = ({ projetId = null, limite = 40 } = {}) =>
  store.all(COLL.e).filter(e => !projetId || e.projetId === projetId).slice(-limite).reverse();

/** Au démarrage : ce qui était « en cours » a été interrompu par l'arrêt du serveur. */
export function marquerInterrompus() {
  let n = 0;
  for (const e of store.all(COLL.e)) if (e.statut === 'en_cours') { store.update(COLL.e, e.id, { statut: 'interrompu', fin: new Date().toISOString() }); n++; }
  return n;
}

let actifs = 0;
const controleurs = new Map();
export const annuler = (execId) => { const c = controleurs.get(execId); if (c) { c.abort(); return true; } return false; };
export const etatActifs = () => ({ actifs, max: MAX_ACTIFS });

function contexteProjet(p) {
  if (!p) return '';
  const l = [`PROJET « ${p.nom} » — objectif : ${p.objectif || 'non précisé'}`];
  if (p.taches.length) l.push('Tâches :\n' + p.taches.map(t => `- [${t.statut}] ${t.titre}${t.resultat ? ' → ' + t.resultat.slice(0, 120) : ''}`).join('\n'));
  if (p.notes.length) l.push('Notes récentes :\n' + p.notes.slice(-5).map(n => `- ${n.texte}`).join('\n'));
  const dern = p.journal.slice(-4);
  if (dern.length) l.push('Déjà fait :\n' + dern.map(j => `- ${j.agent || ''} : ${String(j.resume || '').slice(0, 160)}`).join('\n'));
  l.push(`Les fichiers du projet sont dans le dossier « ${p.dossier} » (les outils de fichiers y travaillent déjà).`);
  return l.join('\n');
}

/**
 * Lance un agent sur une tâche. Rend { execId, statut, texte, preuves, attente? }.
 * `reprise` : { outil, parametres, accord } pour reprendre une action qui attendait l'accord.
 */
export async function lancer({ agentId, projetId = null, tache, onEvent = () => {}, chaineModeles,
                               profondeur = 0, parentExecId = null, chaine = [], reprise = null, signal = null, appeler }) {
  const agent = store.find(COLL.a, a => a.id === agentId) || agentParRef(agentId);
  if (!agent) throw new Error('Agent introuvable.');
  if (!String(tache || '').trim() && !reprise) throw new Error('Il faut une tâche.');
  if (actifs >= MAX_ACTIFS) throw new Error(`Déjà ${MAX_ACTIFS} exécutions en cours : attends qu'une se termine.`);
  const p = projetId ? projet(projetId) : null;
  if (projetId && !p) throw new Error('Projet introuvable.');

  const exec = store.insert(COLL.e, {
    id: uid('exe'), agentId: agent.id, agentNom: agent.nom, projetId: p?.id || null, tache: String(tache || '').slice(0, 2000),
    statut: 'en_cours', debut: new Date().toISOString(), profondeur, parentExecId, texte: '', preuves: [], etapes: []
  });
  const ctl = new AbortController();
  if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
  controleurs.set(exec.id, ctl);
  actifs++;

  const ctxOutils = { projetId: p?.id || null, agentId: agent.id, execId: exec.id, profondeur,
                      chaine: [...chaine, agent.id], delegations: { n: 0 }, onEvent, appeler, chaineModeles, signal: ctl.signal };
  const permis = groupesVersOutils(agent.groupes);
  const role = [agent.instructions || agent.role, contexteProjet(p),
    profondeur > 0 ? "Tu travailles comme sous-agent : tu fais UNE sous-tâche, tu rends un résumé court et vérifiable (fichiers créés, résultats). Tu ne peux pas demander d'accord à la personne." : ''].filter(Boolean).join('\n\n');

  let res;
  try {
    res = await converser({
      message: String(tache || ''), historique: [], vocal: false, projet: p?.dossier || 'atelier', reprise,
      roleSysteme: role, outilsPermis: permis, atelier: true, sansAccord: profondeur > 0,
      ctxOutils, maxEtapes: profondeur > 0 ? 8 : 14, signal: ctl.signal, appeler,
      chaineModeles: chaineModeles?.length ? chaineModeles : (agent.modele?.provider ? [agent.modele] : undefined)
    }, (e) => onEvent({ ...e, agent: agent.nom, execId: exec.id }));
  } catch (e) {
    actifs--; controleurs.delete(exec.id);
    store.update(COLL.e, exec.id, { statut: 'echec', fin: new Date().toISOString(), texte: String(e.message).slice(0, 1500) });
    if (p) journaliser(p.id, { agent: agent.nom, execId: exec.id, resume: 'Échec : ' + String(e.message).slice(0, 200) });
    throw e;
  }
  actifs--; controleurs.delete(exec.id);

  const statut = res.attente ? 'en_attente' : res.interrompu ? 'interrompu' : 'termine';
  const resume = String(res.texte || '').slice(0, 3000);
  const fiche = store.update(COLL.e, exec.id, {
    statut, fin: new Date().toISOString(), texte: resume, attente: res.attente || null,
    preuves: (res.preuves || []).slice(0, 60), etapes: (res.etapes || []).slice(0, 60)
  });
  if (p && statut !== 'en_attente') {
    journaliser(p.id, { agent: agent.nom, execId: exec.id, resume: resume.slice(0, 400), preuves: (res.preuves || []).filter(x => x.ok).length });
    archive.archiver({ genre: 'agent', titre: `${agent.nom} sur « ${p.nom} » : ${statut}`, texte: resume, ok: statut === 'termine' ? true : statut === 'echec' ? false : null, projetId: p.id, meta: { outil: 'agent:' + agent.nom } });
    try { graphe.ajouter({ type: 'projet', titre: `${p.nom} — ${agent.nom}`, texte: resume.slice(0, 600), confiance: 'rapporte' }); } catch {}
  }
  return { execId: exec.id, statut, texte: resume, preuves: res.preuves || [], attente: res.attente || null, fiche };
}

/** Reprend une exécution interrompue, en échec ou en attente d'accord. */
export async function reprendre({ execId, accord = null, onEvent, signal, appeler }) {
  const e = store.find(COLL.e, x => x.id === execId);
  if (!e) throw new Error('Exécution introuvable.');
  if (e.statut === 'en_attente' && e.attente && accord) {
    return lancer({ agentId: e.agentId, projetId: e.projetId, tache: e.tache, onEvent, signal, appeler, profondeur: e.profondeur || 0,
      reprise: { outil: e.attente.outil, parametres: e.attente.parametres, accord } });
  }
  if (e.statut === 'en_attente') throw new Error("Cette exécution attend ton accord : donne-le d'abord.");
  const fait = (e.etapes || []).filter(x => x.ok).map(x => `${x.outil} : ${x.resultat || ''}`).slice(-8).join('\n');
  const tache = `Reprends ce travail interrompu : ${e.tache}\n` + (fait ? `Ce qui avait déjà été fait (vérifie-le avant de t'y fier) :\n${fait}` : "Rien n'avait abouti.");
  return lancer({ agentId: e.agentId, projetId: e.projetId, tache, onEvent, signal, appeler, profondeur: e.profondeur || 0 });
}

/* ══ LES OUTILS QUE LES AGENTS ONT EN PLUS ════════════════════════════════ */
Object.assign(OUTILS, {
  agent_deleguer: {
    groupe: 'atelier',
    description: `Confie une sous-tâche à un autre agent (un sous-agent). Paramètres : agent (nom), tache (précise et autonome : il ne voit pas ta conversation). Limites : profondeur ${MAX_PROFONDEUR}, ${MAX_DELEGATIONS} délégations par exécution. Agents : ${DEPART.map(a => a.nom).join(', ')} et les agents créés par la personne.`,
    async run({ agent, tache }, ctx = {}) {
      if (!ctx.execId) throw new Error('La délégation n\'existe que dans un projet ou une exécution d\'agent.');
      if (!tache) throw new Error('Il faut décrire la sous-tâche.');
      if ((ctx.profondeur || 0) >= MAX_PROFONDEUR) throw new Error(`Profondeur maximale (${MAX_PROFONDEUR}) atteinte : fais cette tâche toi-même.`);
      if ((ctx.delegations?.n || 0) >= MAX_DELEGATIONS) throw new Error(`${MAX_DELEGATIONS} délégations déjà faites dans cette exécution.`);
      const sub = agentParRef(agent);
      if (!sub) throw new Error(`Agent « ${agent} » introuvable. Disponibles : ${agents().map(a => a.nom).join(', ')}.`);
      if ((ctx.chaine || []).includes(sub.id)) throw new Error(`« ${sub.nom} » est déjà dans la chaîne de délégation : pas de boucle.`);
      ctx.delegations.n++;
      const r = await lancer({
        agentId: sub.id, projetId: ctx.projetId, tache, profondeur: (ctx.profondeur || 0) + 1, parentExecId: ctx.execId,
        chaine: ctx.chaine, onEvent: ctx.onEvent, signal: ctx.signal, appeler: ctx.appeler, chaineModeles: ctx.chaineModeles
      });
      const ok = r.statut === 'termine';
      return { resume: `${sub.nom} ${ok ? 'a terminé' : 'n\'a pas terminé (' + r.statut + ')'} :\n${r.texte}`,
               preuve: { genre: 'sous-agent', agent: sub.nom, execId: r.execId, statut: r.statut, actions_reussies: r.preuves.filter(x => x.ok).length } };
    }
  },
  projet_etat: {
    groupe: 'atelier',
    description: 'Montre l\'état du projet en cours : objectif, tâches, notes, derniers résultats.',
    async run(_, ctx = {}) {
      const p = ctx.projetId ? projet(ctx.projetId) : null;
      if (!p) throw new Error('Aucun projet n\'est attaché à cette exécution.');
      return { resume: contexteProjet(p), preuve: { genre: 'projet', id: p.id, taches: p.taches.length } };
    }
  },
  projet_tache: {
    groupe: 'atelier',
    description: 'Gère les tâches du projet. Paramètres : action (ajouter | statut), titre (pour ajouter), id (pour changer le statut), statut (a_faire, en_cours, fait, bloque), resultat (une ligne, facultatif).',
    async run({ action, titre, id, statut, resultat }, ctx = {}) {
      if (!ctx.projetId) throw new Error('Aucun projet n\'est attaché à cette exécution.');
      if (action === 'ajouter') { const t = ajouterTache(ctx.projetId, { titre, agentId: ctx.agentId }); return { resume: `Tâche ajoutée : ${t.titre} (id ${t.id})`, preuve: { genre: 'tache-projet', id: t.id } }; }
      if (action === 'statut') {
        const t = majTache(ctx.projetId, id, { statut, resultat });
        return { resume: `Tâche « ${t.titre} » → ${t.statut}`, preuve: { genre: 'tache-projet', id: t.id, statut: t.statut } };
      }
      throw new Error('action : ajouter ou statut.');
    }
  },
  projet_note: {
    groupe: 'atelier',
    description: 'Note une information durable dans le projet (décision, résultat, blocage). Paramètre : texte.',
    async run({ texte }, ctx = {}) {
      if (!ctx.projetId) throw new Error('Aucun projet n\'est attaché à cette exécution.');
      if (!texte) throw new Error('Il faut un texte.');
      ajouterNote(ctx.projetId, texte, ctx.agentId || 'agent');
      return { resume: 'Note enregistrée dans le projet.', preuve: { genre: 'note-projet', octets: String(texte).length } };
    }
  }
});
