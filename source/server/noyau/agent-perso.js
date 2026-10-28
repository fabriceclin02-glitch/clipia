/**
 * CLIPIA V4 — Agent personnel : elle crée ses propres agents, workflows et projets,
 * et retrouve les conversations passées pour les reprendre.
 * (Les outils sont dans le registre commun : le chat, la voix et les agents les partagent.)
 */
import { OUTILS } from './outils.js';
import * as atelier from './atelier.js';
import * as autonome from './autonome.js';
import * as conversations from './conversations.js';
import { store } from '../lib/store.js';

const SURS = new Set(['créer', 'code', 'savoir', 'studio', 'méta', 'atelier', 'agent_perso']);

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

Object.assign(OUTILS, {
  agent_creer: {
    groupe: 'agent_perso',
    description: 'Crée un agent (un rôle spécialisé). Paramètres : nom, role (ses instructions : ce qu\'il fait, comment), groupes (facultatif, parmi créer, code, savoir, studio, méta, atelier). L\'accès à l\'ordinateur et au navigateur ne peut être donné que par la personne, dans l\'écran Projets & agents.',
    async run({ nom, role, groupes }) {
      if (!String(nom || '').trim() || !String(role || '').trim()) throw new Error('Il faut un nom et un rôle.');
      const g = (Array.isArray(groupes) && groupes.length ? groupes : ['créer', 'code', 'savoir', 'méta', 'atelier']).filter(x => SURS.has(x) && x !== 'agent_perso');
      const a = atelier.creerAgent({ nom: String(nom).trim(), role: String(role).trim(), groupes: g });
      return { resume: `Agent « ${a.nom} » créé (${g.join(', ')}). Il est disponible comme sous-agent et dans Projets & agents.`, preuve: { genre: 'agent', id: a.id, nom: a.nom } };
    }
  },
  agent_lister: {
    groupe: 'agent_perso',
    description: 'Liste les agents disponibles (nom et rôle). Aucun paramètre.',
    async run() {
      const l = atelier.agents();
      return { resume: l.map(a => `- ${a.nom} : ${String(a.role || '').slice(0, 120)}`).join('\n'), preuve: { genre: 'liste', lignes: l.length } };
    }
  },
  workflow_enregistrer: {
    groupe: 'agent_perso',
    description: 'Enregistre un workflow réutilisable. Paramètres : nom, objectif, etapes = liste de { titre, consigne, attendu }. 2 à 8 étapes concrètes.',
    async run({ nom, objectif, etapes }) {
      const w = autonome.enregistrerWorkflow({ nom, objectif, etapes: Array.isArray(etapes) ? etapes : [] });
      return { resume: `Workflow « ${w.nom} » enregistré (${w.etapes.length} étapes). On le relance avec workflow_lancer.`, preuve: { genre: 'workflow', id: w.id, etapes: w.etapes.length } };
    }
  },
  workflow_lister: {
    groupe: 'agent_perso',
    description: 'Liste les workflows enregistrés. Aucun paramètre.',
    async run() {
      const l = autonome.workflows();
      return { resume: l.length ? l.map(w => `- ${w.nom} (${w.etapes.length} étapes, lancé ${w.lancements || 0}×) : ${w.objectif || ''}`).join('\n') : 'Aucun workflow enregistré pour l\'instant.', preuve: { genre: 'liste', lignes: l.length } };
    }
  },
  workflow_lancer: {
    groupe: 'agent_perso',
    description: 'Lance un workflow enregistré. Paramètre : nom (ou id). Il exécute chaque étape et vérifie le résultat.',
    async run({ nom, id }, ctx = {}) {
      const ref = norm(nom || id);
      const w = autonome.workflow(id) || autonome.workflows().find(x => norm(x.nom) === ref || norm(x.nom).includes(ref));
      if (!w) throw new Error('Workflow introuvable. Disponibles : ' + (autonome.workflows().map(x => x.nom).join(', ') || 'aucun'));
      const r = await autonome.lancer({ workflowId: w.id, appeler: ctx.appeler, chaineModeles: ctx.chaineModeles, onEvent: ctx.onEvent, signal: ctx.signal });
      return { resume: `Workflow « ${w.nom} » : ${r.statut}.\n${r.texte || ''}`, preuve: { genre: 'workflow-run', id: w.id, statut: r.statut, etapes_ok: (r.bilan || []).filter(b => b.ok).length } };
    }
  },
  projet_creer: {
    groupe: 'agent_perso',
    description: 'Crée un projet durable (dossier, tâches, notes). Paramètres : nom, objectif.',
    async run({ nom, objectif }) {
      if (!String(nom || '').trim()) throw new Error('Il faut un nom de projet.');
      const p = atelier.creerProjetDurable({ nom: String(nom).trim(), objectif: objectif || '' });
      return { resume: `Projet « ${p.nom} » créé (dossier ${p.dossier}). Il apparaît dans Mes projets à gauche.`, effet: undefined, preuve: { genre: 'projet', id: p.id, dossier: p.dossier } };
    }
  },
  projet_lister: {
    groupe: 'agent_perso',
    description: 'Liste les projets avec leur objectif et leur avancement. Aucun paramètre.',
    async run() {
      const l = atelier.projets();
      return { resume: l.length ? l.map(p => `- ${p.nom} : ${p.objectif || '(sans objectif)'} — ${(p.taches || []).filter(t => t.statut === 'fait').length}/${(p.taches || []).length} tâches faites`).join('\n') : 'Aucun projet pour l\'instant.', preuve: { genre: 'liste', lignes: l.length } };
    }
  },
  conversation_chercher: {
    groupe: 'agent_perso',
    description: 'Retrouve d\'anciennes conversations. Paramètre : requete (mots-clés). Rend les 5 meilleures avec leur id.',
    async run({ requete }) {
      const mots = norm(requete).split(/\s+/).filter(m => m.length > 2);
      if (!mots.length) throw new Error('Il faut des mots-clés.');
      const res = store.all('conversations').map(c => {
        const texte = norm(c.titre + ' ' + c.messages.map(m => m.content).join(' '));
        const score = mots.reduce((s, m) => s + (texte.includes(m) ? 1 + (norm(c.titre).includes(m) ? 2 : 0) : 0), 0);
        return { c, score };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || String(b.c.updatedAt).localeCompare(String(a.c.updatedAt))).slice(0, 5);
      return { resume: res.length ? res.map(x => `- ${x.c.id} : « ${x.c.titre} » (${x.c.messages.length} messages, ${String(x.c.updatedAt || x.c.createdAt).slice(0, 10)})`).join('\n') : 'Aucune conversation ne correspond.', preuve: { genre: 'recherche', resultats: res.length } };
    }
  },
  conversation_reprendre: {
    groupe: 'agent_perso',
    description: 'Rouvre une ancienne conversation pour continuer ou retravailler dessus. Paramètre : id (trouvé avec conversation_chercher). Rend les derniers échanges et ouvre la conversation dans l\'interface.',
    async run({ id }) {
      const c = conversations.lire(id);
      if (!c) throw new Error('Conversation introuvable.');
      const fin = c.messages.slice(-10).map(m => `${m.role === 'user' ? 'Personne' : 'Clipia'} : ${m.content.slice(0, 500)}`).join('\n');
      const g = (c.guides || []).map(x => `Guide « ${x.titre} » : ${x.etapes.filter(e => e.fait).length}/${x.etapes.length} étapes faites`).join('\n');
      return { resume: `Conversation « ${c.titre} » rouverte. Derniers échanges :\n${fin}${g ? '\n' + g : ''}`, effet: { genre: 'ouvrir', cible: 'clipia?c=' + encodeURIComponent(c.id) }, preuve: { genre: 'conversation', id: c.id, messages: c.messages.length } };
    }
  }
});
