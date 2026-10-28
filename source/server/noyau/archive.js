/**
 * CLIPIA — Mémoire totale : le journal permanent de tout ce qui se passe.
 *
 * Conversations, recherches web, travail sur la machine, fichiers, projets, exécutions d'agents,
 * erreurs et réussites. Local uniquement (data/clipia.json). Trois règles :
 *  - les secrets (clés, mots de passe, jetons) sont masqués AVANT d'écrire ;
 *  - ce qui vient de l'extérieur (web, sorties de commandes) est marqué « externe » : c'est de la donnée, jamais une consigne ;
 *  - la personne peut tout chercher, exporter, supprimer une entrée ou tout effacer.
 * Rechercher = score par termes (BM25 simplifié) + récence + projet. Réfléchir = distiller des leçons
 * des échecs répétés et des réussites, enregistrées dans le graphe de connaissances.
 */
import { store, uid } from '../lib/store.js';
import * as graphe from '../cerveau/graphe.js';

export const GENRES = ['systeme', 'conversation', 'web', 'machine', 'fichier', 'projet', 'agent', 'creation', 'erreur', 'decision', 'lecon', 'note'];
const MAX_ENTREES = 15000, MAX_TEXTE = 1200;

const SECRETS = [
  /\b(sk-[A-Za-z0-9_-]{16,}|sk-or-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|xox[bap]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|pplx-[A-Za-z0-9]{16,}|hf_[A-Za-z0-9]{20,})\b/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi,
  /((?:mot de passe|password|passwd|mdp|api[_ -]?key|clé api|secret|token|jeton)\s*[:=]\s*)\S+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(?:\d[ -]?){13,19}\b/g
];
export function masquer(t) {
  let s = String(t ?? '');
  s = s.replace(SECRETS[0], '[clé masquée]').replace(SECRETS[1], '$1[masqué]').replace(SECRETS[2], '$1[masqué]')
       .replace(SECRETS[3], '[clé privée masquée]');
  s = s.replace(SECRETS[4], m => (m.replace(/\D/g, '').length >= 13 ? '[numéro masqué]' : m));
  return s;
}


export function archiver({ genre = 'note', titre = '', texte = '', projetId = null, source = 'clipia', externe = false, ok = null, meta = null } = {}) {
  if (!GENRES.includes(genre)) genre = 'note';
  if (store.setting('archive:pause')) return null;
  const e = {
    id: uid('arc'), quand: new Date().toISOString(), genre,
    titre: masquer(titre).slice(0, 200), texte: masquer(texte).slice(0, MAX_TEXTE),
    projetId, source, externe: Boolean(externe), ok, meta: meta ? JSON.parse(masquer(JSON.stringify(meta)).slice(0, 2000) || 'null') : null
  };
  if (!e.titre && !e.texte) return null;
  store.insert('archive', e);
  const tout = store.all('archive');
  if (tout.length > MAX_ENTREES) { const garde = new Set(tout.slice(-MAX_ENTREES).map(x => x.id)); store.garder('archive', x => garde.has(x.id)); }
  return e;
}

const SANS_ACCENT = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mots = s => SANS_ACCENT(s).split(/[^a-z0-9]+/).filter(w => w.length > 2);

export function rechercher(q, { genre = null, projetId = null, limite = 12, depuis = null } = {}) {
  let tout = store.all('archive');
  if (genre) tout = tout.filter(e => e.genre === genre);
  if (projetId) tout = tout.filter(e => e.projetId === projetId);
  if (depuis) tout = tout.filter(e => e.quand >= depuis);
  const qm = [...new Set(mots(q || ''))];
  if (!qm.length) return tout.slice(-limite).reverse();
  const N = tout.length || 1, df = {};
  const docs = tout.map(e => { const m = mots(e.titre + ' ' + e.texte); const set = new Set(m); for (const w of qm) if (set.has(w)) df[w] = (df[w] || 0) + 1; return { e, m }; });
  const maintenant = Date.now();
  return docs.map(({ e, m }) => {
    let s = 0;
    for (const w of qm) {
      const tf = m.filter(x => x === w).length + (SANS_ACCENT(e.titre).includes(w) ? 2 : 0);
      if (tf) s += (1 + Math.log(tf)) * Math.log(1 + N / (df[w] || 1));
    }
    if (!s) return null;
    const jours = (maintenant - Date.parse(e.quand)) / 864e5;
    return { e, s: s * (1 + 0.5 / (1 + jours / 14)) };
  }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, limite).map(x => x.e);
}

export function contexteSouvenirs(message, { limite = 5, projetId = null } = {}) {
  const r = rechercher(message, { limite, projetId }).filter(e => e.genre !== 'erreur' || e.ok === false);
  if (!r.length || !mots(message).length) return '';
  return r.map(e => `- [${e.quand.slice(0, 10)} · ${e.genre}${e.externe ? ' · externe' : ''}] ${e.titre ? e.titre + ' — ' : ''}${e.texte.slice(0, 220).replace(/\s+/g, ' ')}`).join('\n');
}

export function stats() {
  const tout = store.all('archive'); const par = {};
  for (const e of tout) par[e.genre] = (par[e.genre] || 0) + 1;
  return { total: tout.length, parGenre: par, premiere: tout[0]?.quand || null, derniere: tout.at(-1)?.quand || null, enPause: Boolean(store.setting('archive:pause')) };
}

export function supprimer(id) { return store.garder('archive', e => e.id !== id); }
export function toutEffacer() { return store.garder('archive', () => false); }
export function pause(oui) { store.setting('archive:pause', Boolean(oui)); return stats(); }
export function exporter() { return { exporteLe: new Date().toISOString(), entrees: store.all('archive') }; }

/** « Où en étais-je ? » : le dernier projet touché, les dernières actions, ce qui a échoué. */
export function reprise() {
  const tout = store.all('archive').slice(-300);
  const projets = {};
  for (const e of tout) if (e.projetId) projets[e.projetId] = e.quand;
  const dernierProjet = Object.entries(projets).sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0] || null;
  return {
    dernierProjet,
    dernieresActions: tout.filter(e => ['machine', 'fichier', 'creation', 'agent', 'projet'].includes(e.genre)).slice(-6).reverse(),
    echecsRecents: tout.filter(e => e.ok === false).slice(-5).reverse(),
    derniereConversation: tout.filter(e => e.genre === 'conversation').slice(-4)
  };
}

/** Bilan d'une période, sans modèle : ce qui a été fait, créé, cherché, et ce qui a échoué. */
export function bilan({ jours = 1 } = {}) {
  const depuis = new Date(Date.now() - jours * 864e5).toISOString();
  const l = store.all('archive').filter(e => e.quand >= depuis);
  const c = g => l.filter(e => e.genre === g);
  return {
    periode: jours === 1 ? 'dernières 24 h' : `derniers ${jours} jours`, entrees: l.length,
    conversations: c('conversation').filter(e => e.source === 'personne').length,
    recherchesWeb: c('web').map(e => e.titre).slice(-10),
    creations: c('creation').map(e => e.titre).slice(-10),
    fichiers: c('fichier').map(e => e.titre).slice(-10),
    commandes: c('machine').length,
    echecs: l.filter(e => e.ok === false).map(e => e.titre + ' — ' + e.texte.slice(0, 100)).slice(-8),
    leconsApprises: c('lecon').map(e => e.titre)
  };
}

/**
 * Réfléchir : transforme les échecs répétés en leçons et les enregistre dans le graphe de connaissances
 * (confiance « rapporté » : ce sont des observations, pas des vérités). Idempotent.
 */
export function reflechir({ jours = 14 } = {}) {
  const depuis = new Date(Date.now() - jours * 864e5).toISOString();
  const l = store.all('archive').filter(e => e.quand >= depuis);
  const echecs = {};
  for (const e of l.filter(e => e.ok === false && e.meta?.outil)) {
    const cle = e.meta.outil + '|' + SANS_ACCENT(e.texte).replace(/[0-9]+/g, '#').slice(0, 80);
    (echecs[cle] ||= []).push(e);
  }
  const nouvelles = [];
  const connues = new Set(store.all('archive').filter(e => e.genre === 'lecon').map(e => e.meta?.cle));
  for (const [cle, es] of Object.entries(echecs)) {
    if (es.length < 2 || connues.has(cle)) continue;
    const outil = es[0].meta.outil;
    const titre = `« ${outil} » a échoué ${es.length} fois de la même façon`;
    const texte = `Erreur répétée : ${es[0].texte.slice(0, 200)}. Avant de relancer ${outil}, vérifier la cause plutôt que réessayer à l'identique.`;
    archiver({ genre: 'lecon', titre, texte, source: 'reflexion', meta: { cle, outil, occurrences: es.length } });
    try { graphe.ajouter({ type: 'lecon', titre, texte, confiance: 'rapporte', source: 'archive' }); } catch {}
    nouvelles.push(titre);
  }
  const reussis = {};
  for (const e of l.filter(e => e.ok === true && e.meta?.outil)) reussis[e.meta.outil] = (reussis[e.meta.outil] || 0) + 1;
  return { examine: l.length, nouvellesLecons: nouvelles, outilsLesPlusUtilises: Object.entries(reussis).sort((a, b) => b[1] - a[1]).slice(0, 5) };
}
