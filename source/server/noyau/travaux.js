/**
 * CLIPIA X8 — Les DEUX CERVEAUX.
 *
 *  • Le cerveau d'ACCUEIL : la conversation (voix, chat). Il ne se bloque jamais
 *    sur une longue tâche : il confie le travail et reste disponible.
 *  • Les TRAVAILLEURS : des missions qui tournent en ARRIÈRE-PLAN, en parallèle
 *    (jusqu'à MAX_PARALLELE), chacune avec son propre fil, son journal en direct,
 *    son bouton stop, et la possibilité de demander ton accord sans bloquer le reste.
 *
 * Ce module est le pont entre les deux : il lance, suit, arrête, raconte (en
 * français parlé) ce que font les travailleurs, et diffuse leurs événements en
 * temps réel pour que Clipia puisse te dire « je travaille sur ceci maintenant ».
 */
import { store, uid } from '../lib/store.js';
import { converser } from './boucle.js';
import * as autonome from './autonome.js';
import * as archive from './archive.js';
import { OUTILS } from './outils.js';

export const MAX_PARALLELE = 3;
const MAX_JOURNAL = 80;
const COLL = 'travaux';
const actifs = new Map();       // id -> { ctl, promesse }
const abonnes = new Set();      // fonctions (evenement) => void
const maintenant = () => new Date().toISOString();

/* ── Noms d'outils en français parlé ─────────────────────────────────────── */
const VERBES = {
  web_chercher: 'je cherche sur le web', web_lire: 'je lis une page web', fichier_ecrire: "j'écris un fichier", fichier_lire: 'je lis un fichier',
  fichier_remplacer: 'je modifie un fichier', fichier_lister: 'je regarde les fichiers', executer: 'je lance une commande', image_creer: 'je crée une image',
  musique_creer: 'je compose un morceau', clip_monter: 'je monte une vidéo', voix_dire: 'je prépare une voix', transcrire: 'je transcris un son',
  app_creer: 'je construis une application', ordi_ouvrir_app: "j'ouvre un logiciel", ordi_capturer: 'je regarde ton écran', ordi_souris: "j'utilise la souris",
  ordi_clavier: 'je tape au clavier', chrome_ouvrir: "j'ouvre une page dans Chrome", chrome_lire: 'je lis la page', chrome_cliquer: 'je clique dans la page',
  chrome_taper: 'je remplis un champ', logiciel_installer: "j'installe un logiciel", memoire_noter: 'je note ce que j’ai appris', plan_poser: 'je pose mon plan',
  openclaw_cli: 'je passe par OpenClaw', competence_lire: 'je lis une méthode', agent_deleguer: 'je confie une partie à un sous-agent'
};
const verbe = nom => VERBES[nom] || `j'utilise l'outil ${String(nom).replace(/_/g, ' ')}`;

/* ── Diffusion en direct ─────────────────────────────────────────────────── */
function diffuser(evt) { for (const f of [...abonnes]) { try { f(evt); } catch { abonnes.delete(f); } } }
export function abonner(f) { abonnes.add(f); return () => abonnes.delete(f); }

/* ── Représentation ──────────────────────────────────────────────────────── */
const publique = t => t && ({
  id: t.id, titre: t.titre, mission: t.mission, mode: t.mode, statut: t.statut, debut: t.debut, fin: t.fin || null,
  maintenant: t.maintenant || '', etape: t.etape || null, nbOutils: t.nbOutils || 0, resultat: t.resultat || '', attente: t.attente ? { resume: t.attente.resume, outil: t.attente.outil, genre: t.attente.genre, commande: t.attente.commande, categorie: t.attente.categorie, propositions: t.attente.propositions } : null,
  journal: (t.journal || []).slice(-12)
});
export const liste = () => store.all(COLL).slice().sort((a, b) => String(b.debut).localeCompare(String(a.debut))).map(publique);
export const actifsListe = () => store.all(COLL).filter(t => ['en_cours', 'en_file', 'attente'].includes(t.statut)).map(publique);
export const trouver = id => publique(store.find(COLL, t => t.id === id));
const brut = id => store.find(COLL, t => t.id === id);

function note(id, texte, genre = 'info', extra = {}) {
  const t = brut(id); if (!t) return;
  const journal = [...(t.journal || []), { t: maintenant(), genre, texte: String(texte).slice(0, 400) }].slice(-MAX_JOURNAL);
  const patch = { journal, ...extra };
  store.update(COLL, id, patch);
  diffuser({ type: (genre === 'annonce' || genre === 'route') ? 'annonce' : 'progres', niveau: genre === 'route' ? 'route' : 'important', id, titre: t.titre, texte: String(texte).slice(0, 400), job: publique(brut(id)) });
}

/* ── Lancer ──────────────────────────────────────────────────────────────── */
function titreDe(mission) { return String(mission).replace(/\s+/g, ' ').replace(/^(mission\s*:|peux-tu|tu peux|s'il te plaît,?)\s*/i, '').slice(0, 60).trim() || 'Mission'; }

export function lancer({ mission, titre = '', mode = 'simple', projet = 'studio' } = {}) {
  mission = String(mission || '').trim();
  if (mission.length < 4) throw new Error('Il faut dire ce que je dois faire.');
  const enCours = actifsListe().filter(t => t.statut === 'en_cours' || t.statut === 'attente').length;
  const t = store.insert(COLL, { id: uid('trv'), titre: String(titre || titreDe(mission)).slice(0, 80), mission: mission.slice(0, 4000), mode: mode === 'rigoureux' ? 'rigoureux' : 'simple',
    projet, statut: enCours >= MAX_PARALLELE ? 'en_file' : 'en_cours', debut: maintenant(), journal: [], nbOutils: 0, maintenant: 'Je démarre…' });
  diffuser({ type: 'nouveau', id: t.id, titre: t.titre, job: publique(t) });
  if (t.statut === 'en_cours') demarrer(t.id);
  else note(t.id, `En attente d'une place : ${MAX_PARALLELE} travaux tournent déjà.`, 'info');
  return publique(brut(t.id));
}

function prochain() {
  const enCours = store.all(COLL).filter(t => t.statut === 'en_cours' || t.statut === 'attente').length;
  if (enCours >= MAX_PARALLELE) return;
  const suivant = store.all(COLL).filter(t => t.statut === 'en_file').sort((a, b) => String(a.debut).localeCompare(String(b.debut)))[0];
  if (suivant) { store.update(COLL, suivant.id, { statut: 'en_cours' }); demarrer(suivant.id); }
}

let derniereAnnonce = new Map();      // id -> ts : une annonce vocale « de route » au plus toutes les 25 s par travail
function annonceDeRoute(id, texte) {
  const dernier = derniereAnnonce.get(id) || 0;
  if (Date.now() - dernier < 25000) return;
  derniereAnnonce.set(id, Date.now()); note(id, texte, 'route');
}

function surEvenement(id, e) {
  const t = brut(id); if (!t) return;
  switch (e.type) {
    case 'phase': case 'plan': {
      const txt = e.texte || (e.etapes ? `Mon plan : ${e.etapes.length} étapes.` : '');
      if (txt) note(id, txt, e.type === 'plan' ? 'annonce' : 'info', { maintenant: txt }); break;
    }
    case 'etape': {
      const txt = `Étape ${e.index + 1} sur ${e.total} : ${e.titre}.`;
      note(id, txt, 'route', { maintenant: txt, etape: { n: e.index + 1, total: e.total, titre: e.titre } }); break;
    }
    case 'message': { if (e.texte) { annonceDeRoute(id, e.texte.slice(0, 220)); store.update(COLL, id, { maintenant: e.texte.slice(0, 220) }); } break; }
    case 'outil': {
      const txt = `${verbe(e.outil)}${e.parametres ? ' — ' + String(e.parametres).slice(0, 90) : ''}`;
      store.update(COLL, id, { nbOutils: (t.nbOutils || 0) + 1, maintenant: txt.charAt(0).toUpperCase() + txt.slice(1) });
      note(id, txt, 'outil');
      break;
    }
    case 'resultat': if (e.ok === false) note(id, `Un essai n'a pas marché : ${String(e.resultat || '').slice(0, 140)}`, 'info'); break;
    case 'verdict': note(id, e.ok ? 'Étape vérifiée : OK.' : `Étape à reprendre : ${e.raison || ''}`, 'info'); break;
    case 'attente': note(id, `J'ai besoin de ton accord pour continuer : ${e.resume || e.outil || ''}`, 'annonce'); break;
    default: break;
  }
}

async function demarrer(id) {
  const t = brut(id); if (!t || actifs.has(id)) return;
  const ctl = new AbortController();
  const entree = { ctl, promesse: null }; actifs.set(id, entree);
  note(id, `Je commence : ${t.titre}.`, 'annonce', { statut: 'en_cours', maintenant: 'Je démarre…' });
  entree.promesse = (async () => {
    try {
      let res;
      if (t.mode === 'rigoureux') {
        res = await autonome.lancer({ objectif: t.mission, projet: t.projet, signal: ctl.signal, accords: { ignorerQuestions: true }, onEvent: e => surEvenement(id, e) });
        if (res.statut === 'en_attente') return mettreEnAttente(id, res.attente);
        return terminer(id, res.statut === 'interrompu' ? 'arrete' : (res.statut === 'echec' ? 'echec' : 'termine'), res.texte || '');
      }
      res = await converser({
        message: `MISSION EN ARRIÈRE-PLAN (tu travailles seule, la personne continue de te parler ailleurs) :\n${t.mission}\n\nAvance étape par étape avec tes outils, explique en une phrase ce que tu fais à chaque étape importante, vérifie tes résultats, et termine par un résumé court de ce qui est réellement fait (fichiers, liens).`,
        historique: [], projet: t.projet, atelier: true, maxEtapes: 30, signal: ctl.signal
      }, e => surEvenement(id, e));
      if (res.attente) return mettreEnAttente(id, res.attente);
      if (res.interrompu || ctl.signal.aborted) return terminer(id, 'arrete', res.texte || '');
      return terminer(id, 'termine', res.texte || '');
    } catch (e) {
      return terminer(id, ctl.signal.aborted ? 'arrete' : 'echec', ctl.signal.aborted ? '' : e.message);
    }
  })();
}

const fermes = new Set();
function mettreEnAttente(id, attente) {
  if (fermes.has(id)) return;
  actifs.delete(id);
  store.update(COLL, id, { statut: 'attente', attente, maintenant: 'J\'attends ton accord.' });
  note(id, `J'ai besoin de ton accord : ${attente.resume || attente.outil}`, 'annonce', { statut: 'attente', attente });
  prochain();
}

function terminer(id, statut, texte) {
  if (fermes.has(id)) return;
  fermes.add(id); actifs.delete(id); derniereAnnonce.delete(id);
  const t = brut(id); if (!t) return;
  const fin = statut === 'termine' ? `J'ai terminé « ${t.titre} ». ${String(texte).slice(0, 300)}`
            : statut === 'arrete' ? `J'ai arrêté « ${t.titre} ».`
            : `« ${t.titre} » n'a pas abouti : ${String(texte).slice(0, 200)}`;
  store.update(COLL, id, { statut, fin: maintenant(), resultat: String(texte).slice(0, 4000), attente: null, maintenant: statut === 'termine' ? 'Terminé.' : statut === 'arrete' ? 'Arrêté.' : 'Échec.' });
  note(id, fin, 'annonce');
  diffuser({ type: 'fin', id, statut, titre: t.titre, job: publique(brut(id)) });
  try { archive.archiver({ genre: 'agent', titre: `Travail : ${t.titre}`, texte: String(texte).slice(0, 2000), ok: statut === 'termine', meta: { outil: 'travaux' } }); } catch {}
  prochain();
}

/* ── Arrêter / reprendre / relancer ─────────────────────────────────────── */
export function arreter(id) {
  const t = brut(id); if (!t) return false;
  const a = actifs.get(id);
  if (a) { a.ctl.abort(); terminer(id, 'arrete', ''); return true; }
  if (['en_file', 'attente'].includes(t.statut)) { terminer(id, 'arrete', ''); return true; }
  return false;
}
export function arreterTout() { let n = 0; for (const t of actifsListe()) if (arreter(t.id)) n++; return n; }

export async function reprendre(id, accord) {
  const t = brut(id); if (!t || t.statut !== 'attente' || !t.attente) throw new Error('Rien n\'attend ton accord ici.');
  const att = t.attente; const ctl = new AbortController(); actifs.set(id, { ctl, promesse: null });
  store.update(COLL, id, { statut: 'en_cours', attente: null, maintenant: 'Je reprends.' });
  note(id, 'Merci, je reprends.', 'annonce');
  actifs.get(id).promesse = (async () => {
    try {
      const res = await converser({
        message: 'Continue la mission en cours : ' + t.mission, historique: [], projet: t.projet, atelier: true, maxEtapes: 30, signal: ctl.signal,
        reprise: { outil: att.outil, parametres: att.parametres, accord }
      }, e => surEvenement(id, e));
      if (res.attente) return mettreEnAttente(id, res.attente);
      return terminer(id, ctl.signal.aborted ? 'arrete' : 'termine', res.texte || '');
    } catch (e) { return terminer(id, ctl.signal.aborted ? 'arrete' : 'echec', e.message); }
  })();
  return trouver(id);
}

export function relancer(id) {
  const t = brut(id); if (!t) throw new Error('Travail introuvable.');
  return lancer({ mission: t.mission, titre: t.titre, mode: t.mode, projet: t.projet });
}

/* ── Au démarrage : ce qui tournait avant la fermeture est marqué interrompu ─ */
export function reprisePostDemarrage() {
  for (const t of store.all(COLL)) if (['en_cours', 'en_file', 'attente'].includes(t.statut))
    store.update(COLL, t.id, { statut: 'interrompu', maintenant: 'Interrompu : Clipia a été fermée.', fin: maintenant() });
}

/* ── Raconter à voix haute (réponse instantanée, sans appeler de modèle) ─── */
const liste2 = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1];
export function pointVocal() {
  const a = actifsListe();
  if (!a.length) {
    const dernier = liste().find(t => t.statut === 'termine');
    return dernier ? `Je ne travaille sur rien en ce moment. Le dernier travail terminé : ${dernier.titre}.` : 'Je ne travaille sur rien en ce moment : je suis toute à toi.';
  }
  const lignes = a.map(t => {
    const quoi = t.statut === 'attente' ? `elle attend ton accord (${t.attente?.resume || 'une action sensible'})` : t.statut === 'en_file' ? 'elle attend son tour' : (t.maintenant || 'elle avance');
    return `« ${t.titre} » : ${quoi.replace(/^je /i, 'je ').replace(/\.$/, '')}`;
  });
  return a.length === 1 ? `Je travaille sur ${lignes[0]}.` : `Je travaille sur ${a.length} projets en parallèle. ${lignes.map((l, i) => `${['Le premier', 'Le deuxième', 'Le troisième'][i] || 'Un autre'} : ${l}.`).join(' ')}`;
}
export function detailVocal(ref) {
  const r = String(ref || '').toLowerCase();
  const t = liste().find(x => x.id === ref) || liste().find(x => x.titre.toLowerCase().includes(r)) || actifsListe()[0];
  if (!t) return 'Je ne vois pas de travail correspondant.';
  const j = (t.journal || []).filter(x => x.genre !== 'info').slice(-4).map(x => x.texte);
  return `« ${t.titre} » — ${t.statut === 'termine' ? 'terminé' : t.statut === 'attente' ? 'en attente de ton accord' : t.statut === 'arrete' ? 'arrêté' : t.statut === 'echec' ? 'en échec' : 'en cours'}. ${t.maintenant || ''} ${j.length ? 'Récemment : ' + j.join(' ') : ''}`.trim();
}

/** Bloc injecté dans le prompt du cerveau d'accueil : la vérité sur ce que font les travailleurs. */
export function contextePourPrompt() {
  const a = actifsListe(); const recents = liste().filter(t => ['termine', 'echec', 'arrete'].includes(t.statut)).slice(0, 3);
  if (!a.length && !recents.length) return '';
  const l = [];
  if (a.length) { l.push('TRAVAUX EN ARRIÈRE-PLAN (tes travailleurs ; tu peux en parler, et la personne peut te parler pendant qu\'ils avancent) :'); for (const t of a) l.push(`- [${t.id}] « ${t.titre} » — ${t.statut} — ${t.maintenant || ''} (${t.nbOutils} actions)`); }
  if (recents.length) { l.push('Récemment terminés :'); for (const t of recents) l.push(`- [${t.id}] « ${t.titre} » — ${t.statut} — ${String(t.resultat || '').slice(0, 160)}`); }
  return l.join('\n');
}

/* ── OUTILS du cerveau d'accueil ─────────────────────────────────────────── */
Object.assign(OUTILS, {
  travail_lancer: {
    groupe: 'travaux',
    description: 'Confie une mission longue ou complexe à un travailleur en ARRIÈRE-PLAN et rends la main tout de suite à la personne. Utilise-le pour tout ce qui demande plusieurs étapes ou plus d\'une minute (créer un site, une étude de marché, un dossier, une campagne…). Paramètres : mission (consigne complète et autonome), titre (court), rigoureux (true : plan + vérification de chaque étape, plus lent mais plus fiable). Jusqu\'à 3 travaux en parallèle.',
    async run({ mission, titre, rigoureux }) {
      const t = lancer({ mission, titre, mode: rigoureux ? 'rigoureux' : 'simple' });
      return { resume: `Travail « ${t.titre} » lancé en arrière-plan (${t.statut === 'en_file' ? 'en file d\'attente' : 'en cours'}). La personne peut continuer à te parler.`, preuve: { genre: 'travail', id: t.id, titre: t.titre } };
    }
  },
  travail_statut: {
    groupe: 'travaux',
    description: 'Dit où en sont les travaux en arrière-plan. Paramètre facultatif : id ou mot du titre pour le détail d\'un travail.',
    async run({ id } = {}) { return { resume: id ? detailVocal(id) : pointVocal(), preuve: { genre: 'liste', lignes: actifsListe().length } }; }
  },
  travail_arreter: {
    groupe: 'travaux',
    description: 'Arrête un travail en arrière-plan (id) ou tous (id = "tout").',
    async run({ id } = {}) {
      if (String(id || '').toLowerCase() === 'tout') { const n = arreterTout(); return { resume: `${n} travail(aux) arrêté(s).`, preuve: { genre: 'arret', n } }; }
      const ok = arreter(String(id || '')); if (!ok) throw new Error('Aucun travail actif avec cet identifiant.');
      return { resume: 'Travail arrêté.', preuve: { genre: 'arret', id } };
    }
  }
});
