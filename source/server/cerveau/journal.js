/**
 * CLIPIA — Journal structuré. La mémoire qui rend la charte contraignante.
 *
 * La charte répète trois fois la même exigence : ne jamais affirmer sans
 * preuve, ne jamais confondre hypothèse et fait, ne jamais simuler un outil
 * absent. Écrire cela dans une amorce ne suffit pas — un modèle de langue
 * produit très volontiers le compte rendu plausible d’un travail qu’il n’a
 * pas fait, et il le produit d’autant mieux qu’on le lui a interdit.
 *
 * Donc ici une preuve n’est pas une phrase : c’est un objet d’un type connu
 * qu’on peut ROUVRIR. Un fichier se re-vérifie par son empreinte, une
 * commande par son code de sortie, une requête par son code HTTP, une mesure
 * par sa méthode. `verifier()` rouvre les preuves et dégrade ce qui ne tient
 * plus. Une tâche sans preuve valide ne peut pas passer à « fait » : la
 * fonction refuse, et c’est tout.
 *
 * C’est la différence entre un système qui promet d’être honnête et un
 * système dans lequel mentir ne marche pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from '../lib/env.js';
import { CONFIANCES } from './charte.js';
import * as graphe from './graphe.js';

const FICHIER = path.join(DATA_DIR, 'journal.json');

/** Les catégories exigées par la charte, et rien d’autre. */
const VIDE = {
  version: 1,
  objectifs: [],      // ce que l’utilisateur veut
  projets: [],        // proposés, acceptés, refusés, terminés
  decisions: [],      // ce qui a été tranché, et pourquoi
  plans: [],          // suites d’étapes
  tests: [],          // résultats de tests, avec preuve
  erreurs: [],        // erreurs rencontrées et leurs corrections
  versions: [],       // états successifs du système
  ameliorations: [],  // propositions et leurs effets mesurés
  cycles: []          // rapports proactifs produits
};

const ETATS_PROJET = ['propose', 'accepte', 'refuse', 'encours', 'termine', 'abandonne'];

function lire() {
  try { return { ...structuredClone(VIDE), ...JSON.parse(fs.readFileSync(FICHIER, 'utf8')) }; }
  catch { return structuredClone(VIDE); }
}

function ecrire(j) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FICHIER + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(j));
  fs.renameSync(tmp, FICHIER);
  return j;
}

const uid = (p) => `${p}_${crypto.randomBytes(5).toString('hex')}`;
const maintenant = () => new Date().toISOString();

/** ── PREUVES ─────────────────────────────────────────────────────────── */

export const TYPES_PREUVE = {
  fichier:  'Un fichier existe, avec sa taille et son empreinte. Revérifiable par lecture du disque.',
  commande: 'Une commande a tourné, avec son code de sortie et sa sortie. Revérifiable en la relançant.',
  http:     'Une requête a reçu une réponse, avec son code. Revérifiable en la rejouant.',
  mesure:   'Une grandeur a été mesurée, avec sa méthode et son unité. Revérifiable en remesurant.',
  citation: 'Une source dit quelque chose, avec son adresse et l’extrait. Revérifiable en l’ouvrant.'
};

/** Construit une preuve de fichier en lisant réellement le disque. */
export function preuveFichier(chemin) {
  const st = fs.statSync(chemin);                       // lève si absent : c’est voulu
  const md5 = crypto.createHash('md5').update(fs.readFileSync(chemin)).digest('hex').slice(0, 16);
  return { kind: 'fichier', chemin, octets: st.size, md5, le: maintenant() };
}

export function preuveCommande({ commande, code, sortie = '' }) {
  if (code === undefined || code === null) throw new Error('Une preuve de commande exige son code de sortie.');
  return { kind: 'commande', commande: String(commande).slice(0, 400), code,
    sortie: String(sortie).slice(0, 2000), le: maintenant() };
}

export function preuveHttp({ url, code, extrait = '' }) {
  if (!url || code === undefined) throw new Error('Une preuve HTTP exige une adresse et un code.');
  return { kind: 'http', url: String(url).slice(0, 400), code, extrait: String(extrait).slice(0, 600), le: maintenant() };
}

export function preuveMesure({ quoi, valeur, unite = '', methode }) {
  if (!methode) throw new Error('Une mesure sans méthode n’est pas une preuve : il faut dire comment elle a été obtenue.');
  if (valeur === undefined || valeur === null) throw new Error('Une mesure exige une valeur.');
  return { kind: 'mesure', quoi: String(quoi).slice(0, 200), valeur, unite,
    methode: String(methode).slice(0, 400), le: maintenant() };
}

export function preuveCitation({ url, extrait }) {
  if (!url || !extrait) throw new Error('Une citation exige son adresse et l’extrait cité.');
  return { kind: 'citation', url: String(url).slice(0, 400), extrait: String(extrait).slice(0, 600), le: maintenant() };
}

/**
 * Rouvre une preuve et dit si elle tient encore.
 * Un fichier supprimé ou modifié invalide la preuve qui le citait — et donc
 * l’affirmation qui s’appuyait dessus.
 */
export function verifierPreuve(p) {
  if (!p?.kind) return { valide: false, pourquoi: 'Ce n’est pas une preuve : aucun type.' };
  switch (p.kind) {
    case 'fichier': {
      if (!fs.existsSync(p.chemin))
        return { valide: false, pourquoi: `Le fichier ${p.chemin} n’existe plus.` };
      const md5 = crypto.createHash('md5').update(fs.readFileSync(p.chemin)).digest('hex').slice(0, 16);
      if (p.md5 && md5 !== p.md5)
        return { valide: false, pourquoi: `Le fichier ${p.chemin} a changé depuis la preuve (empreinte ${md5} au lieu de ${p.md5}).` };
      return { valide: true, pourquoi: `Fichier présent, empreinte conforme.` };
    }
    case 'commande':
      return p.code === 0
        ? { valide: true, pourquoi: `La commande a réussi (code 0).` }
        : { valide: false, pourquoi: `La commande a échoué (code ${p.code}) : ce n’est pas une preuve de réussite.` };
    case 'http':
      return p.code >= 200 && p.code < 400
        ? { valide: true, pourquoi: `Réponse HTTP ${p.code}.` }
        : { valide: false, pourquoi: `HTTP ${p.code} : la requête n’a pas abouti.` };
    case 'mesure':
      return { valide: true, pourquoi: `Mesure « ${p.quoi} » = ${p.valeur} ${p.unite}, par : ${p.methode}.` };
    case 'citation':
      return { valide: true, pourquoi: `Source citée : ${p.url}` };
    default:
      return { valide: false, pourquoi: `Type de preuve inconnu : ${p.kind}` };
  }
}

/** ── LE GARDE-FOU ────────────────────────────────────────────────────── */

/**
 * La confiance qu’un élément peut atteindre, étant donné ses preuves.
 * Impossible de réclamer « vérifié » sans preuve valide : la fonction
 * rabaisse, elle ne demande pas la permission.
 */
export function confianceReelle({ confiance = 'hypothese', preuves = [], sources = [] }) {
  const valides = preuves.map(verifierPreuve).filter(v => v.valide).length;
  const demande = CONFIANCES[confiance] ? confiance : 'hypothese';

  if (valides > 0) return { confiance: demande, plafond: 'verifie', preuvesValides: valides };
  if (sources.length) {
    const plafond = 'probable';
    return { confiance: CONFIANCES[demande].rang > CONFIANCES[plafond].rang ? plafond : demande,
      plafond, preuvesValides: 0,
      abaisse: CONFIANCES[demande].rang > CONFIANCES[plafond].rang
        ? 'Ramené à « probable » : une source, mais aucune preuve rouverte ici.' : null };
  }
  return { confiance: 'hypothese', plafond: 'hypothese', preuvesValides: 0,
    abaisse: demande !== 'hypothese'
      ? `Ramené à « hypothèse » : ni preuve ni source. « ${demande} » ne peut pas être accordé sur une affirmation nue.` : null };
}

/** ── ÉCRITURE ────────────────────────────────────────────────────────── */

function ajouterDans(categorie, element, { max = 300, alimenterGraphe = null } = {}) {
  const j = lire();
  if (!j[categorie]) throw new Error(`Catégorie inconnue : ${categorie}. Disponibles : ${Object.keys(VIDE).filter(k => k !== 'version').join(', ')}.`);

  // Dédoublonnage : la charte l’exige explicitement.
  const signature = (x) => `${x.titre || ''}|${(x.texte || x.quoi || '').slice(0, 120)}`.toLowerCase();
  const sig = signature(element);
  const deja = j[categorie].find(x => signature(x) === sig);
  if (deja) {
    deja.vu = (deja.vu || 1) + 1;
    deja.dernier = maintenant();
    if (element.preuves?.length) deja.preuves = [...(deja.preuves || []), ...element.preuves].slice(-8);
    ecrire(j);
    return { ...deja, doublon: true };
  }

  const el = { id: uid(categorie.slice(0, 3)), le: maintenant(), vu: 1, ...element };
  j[categorie].push(el);
  if (j[categorie].length > max) j[categorie] = j[categorie].slice(-max);
  ecrire(j);

  if (alimenterGraphe) {
    try {
      graphe.ajouter({ type: alimenterGraphe, titre: el.titre || el.quoi || categorie,
        texte: el.texte || el.detail || '', confiance: el.confiance || 'hypothese',
        source: `journal:${categorie}:${el.id}` });
    } catch { /* le graphe est un bonus, pas une dépendance */ }
  }
  return el;
}

export const journal = {
  tout: lire,

  objectif({ titre, texte = '', priorite = 2, source = 'utilisateur' }) {
    return ajouterDans('objectifs', { titre, texte, priorite, source, etat: 'actif' },
      { alimenterGraphe: 'objectif' });
  },

  /** Un projet proposé. Les douze champs de la charte sont vérifiés. */
  projet({ titre, etat = 'propose', champs = {}, scores = {}, confiance = 'hypothese', preuves = [], sources = [] }) {
    if (!ETATS_PROJET.includes(etat)) throw new Error(`État inconnu : ${etat}. Attendus : ${ETATS_PROJET.join(', ')}.`);
    const c = confianceReelle({ confiance, preuves, sources });
    return ajouterDans('projets', {
      titre, etat, champs, scores, preuves, sources,
      confiance: c.confiance, confianceAbaissee: c.abaisse || null,
      texte: champs.probleme || ''
    }, { alimenterGraphe: 'projet' });
  },

  decision({ titre, choix, pourquoi, alternatives = [], confiance = 'hypothese', preuves = [], sources = [] }) {
    const c = confianceReelle({ confiance, preuves, sources });
    return ajouterDans('decisions', { titre, choix, pourquoi, alternatives,
      preuves, sources, confiance: c.confiance, confianceAbaissee: c.abaisse || null,
      texte: `${choix} — ${pourquoi}` });
  },

  plan({ objectif, etapes = [] }) {
    return ajouterDans('plans', { titre: objectif, etapes: etapes.map((e, i) => ({
      n: i + 1, quoi: typeof e === 'string' ? e : e.quoi,
      etat: 'attente', preuves: [], ...(typeof e === 'object' ? e : {}) })), texte: objectif });
  },

  /**
   * Un test. Sans preuve valide, il est enregistré en échec de vérification —
   * jamais en réussite. C’est le point dur de tout le module.
   */
  test({ quoi, attendu, obtenu, reussi, preuves = [] }) {
    const valides = preuves.map(verifierPreuve);
    const auMoinsUne = valides.some(v => v.valide);
    if (reussi && !auMoinsUne) {
      return ajouterDans('tests', {
        titre: quoi, attendu, obtenu, reussi: false, preuves,
        confiance: 'hypothese',
        refus: 'Déclaré réussi sans preuve rouvrable : refusé. Fournir une preuve de type ' +
               Object.keys(TYPES_PREUVE).join(', ') + '.',
        texte: `${quoi} — attendu ${attendu}, obtenu ${obtenu}`
      }, { alimenterGraphe: 'resultat' });
    }
    return ajouterDans('tests', {
      titre: quoi, attendu, obtenu, reussi: Boolean(reussi), preuves,
      confiance: auMoinsUne ? 'verifie' : 'hypothese',
      verification: valides.map(v => v.pourquoi),
      texte: `${quoi} — attendu ${attendu}, obtenu ${obtenu}`
    }, { alimenterGraphe: 'resultat' });
  },

  erreur({ quoi, cause = '', correction = '', corrigee = false, preuves = [] }) {
    const el = ajouterDans('erreurs', { titre: quoi, cause, correction,
      corrigee: Boolean(corrigee) && preuves.some(p => verifierPreuve(p).valide),
      corrigeeSansPreuve: Boolean(corrigee) && !preuves.some(p => verifierPreuve(p).valide),
      preuves, texte: `${quoi}${cause ? ` — cause : ${cause}` : ''}` },
      { alimenterGraphe: 'erreur' });
    // Lien causal dans le graphe : l’erreur cause la leçon.
    if (correction) {
      try {
        graphe.ajouter({ type: 'lecon', titre: correction.slice(0, 140), texte: `Vient de : ${quoi}`,
          confiance: el.corrigee ? 'verifie' : 'hypothese' });
        graphe.relier({ de: quoi, vers: correction.slice(0, 140), type: 'cause',
          pourquoi: 'l’erreur a produit la leçon' });
      } catch { /* bonus */ }
    }
    return el;
  },

  version({ etiquette, quoi, fichiers = [], preuves = [] }) {
    return ajouterDans('versions', { titre: etiquette, texte: quoi, fichiers, preuves,
      confiance: preuves.some(p => verifierPreuve(p).valide) ? 'verifie' : 'hypothese' });
  },

  amelioration({ titre, quoi, attendu, mesure = null, applique = false, preuves = [] }) {
    return ajouterDans('ameliorations', { titre, texte: quoi, attendu, mesure,
      applique: Boolean(applique), preuves,
      confiance: mesure && preuves.some(p => verifierPreuve(p).valide) ? 'verifie' : 'hypothese' });
  },

  cycle(rapport) {
    return ajouterDans('cycles', { titre: `Cycle du ${new Date().toLocaleString('fr-FR')}`, ...rapport }, { max: 60 });
  },

  /** Passer une étape de plan à « fait » exige une preuve valide. */
  avancerPlan({ planId, etape, preuves = [], note = '' }) {
    const j = lire();
    const p = j.plans.find(x => x.id === planId);
    if (!p) throw new Error(`Plan inconnu : ${planId}`);
    const e = p.etapes.find(x => x.n === etape);
    if (!e) throw new Error(`Étape ${etape} absente de ce plan.`);
    const valides = preuves.map(verifierPreuve);
    if (!valides.some(v => v.valide)) {
      e.etat = 'echec-verification';
      e.refus = 'Pas de preuve rouvrable : l’étape ne peut pas passer à « fait ».';
      ecrire(j);
      return { avance: false, etape: e, pourquoi: e.refus };
    }
    e.etat = 'fait'; e.preuves = preuves; e.note = note; e.le = maintenant();
    delete e.refus;
    ecrire(j);
    return { avance: true, etape: e, verification: valides.map(v => v.pourquoi) };
  },

  changerEtatProjet({ id, etat, pourquoi = '' }) {
    if (!ETATS_PROJET.includes(etat)) throw new Error(`État inconnu : ${etat}`);
    const j = lire();
    const p = j.projets.find(x => x.id === id);
    if (!p) throw new Error(`Projet inconnu : ${id}`);
    (p.historique ||= []).push({ de: p.etat, vers: etat, le: maintenant(), pourquoi });
    p.etat = etat;
    ecrire(j);
    return p;
  },

  retirer(id) {
    const j = lire();
    let trouve = null;
    for (const c of Object.keys(VIDE)) {
      if (c === 'version' || !Array.isArray(j[c])) continue;
      const i = j[c].findIndex(x => x.id === id);
      if (i >= 0) { trouve = { categorie: c, element: j[c][i] }; j[c].splice(i, 1); break; }
    }
    if (!trouve) throw new Error(`Élément inconnu : ${id}`);
    ecrire(j);
    return trouve;
  },

  /**
   * Repasse sur toutes les preuves et dégrade ce qui ne tient plus.
   * À lancer avant tout rapport : un résultat prouvé par un fichier effacé
   * n’est plus un résultat prouvé.
   */
  verifier() {
    const j = lire();
    const bilan = { examines: 0, invalides: 0, degrades: [] };
    for (const c of ['projets', 'decisions', 'tests', 'erreurs', 'versions', 'ameliorations']) {
      for (const el of j[c] || []) {
        if (!el.preuves?.length) continue;
        bilan.examines += el.preuves.length;
        const v = el.preuves.map(verifierPreuve);
        const tombees = v.filter(x => !x.valide);
        if (tombees.length) bilan.invalides += tombees.length;
        if (!v.some(x => x.valide) && el.confiance === 'verifie') {
          el.confiance = 'hypothese';
          el.degrade = `Ramené à « hypothèse » : plus aucune preuve ne tient. ${tombees[0]?.pourquoi || ''}`;
          bilan.degrades.push({ categorie: c, id: el.id, titre: el.titre, pourquoi: el.degrade });
        }
      }
    }
    ecrire(j);
    return { ...bilan,
      lecture: bilan.degrades.length
        ? `${bilan.degrades.length} affirmation(s) rétrogradée(s) : leurs preuves ne tiennent plus.`
        : `${bilan.examines} preuve(s) réexaminée(s), toutes valides.` };
  },

  /** Ce qu’il faut savoir pour commencer un cycle. */
  resume() {
    const j = lire();
    const parEtat = {};
    for (const p of j.projets) parEtat[p.etat] = (parEtat[p.etat] || 0) + 1;
    const testsReussis = j.tests.filter(t => t.reussi).length;
    const erreursOuvertes = j.erreurs.filter(e => !e.corrigee).length;
    return {
      objectifs: j.objectifs.filter(o => o.etat === 'actif').length,
      projets: j.projets.length, parEtat,
      tests: { total: j.tests.length, reussis: testsReussis,
        refuses: j.tests.filter(t => t.refus).length },
      erreurs: { total: j.erreurs.length, ouvertes: erreursOuvertes },
      ameliorations: j.ameliorations.length,
      cycles: j.cycles.length,
      versions: j.versions.length,
      lecture: `${j.objectifs.filter(o => o.etat === 'actif').length} objectif(s) actif(s), ` +
               `${j.projets.length} projet(s), ${testsReussis}/${j.tests.length} test(s) réussi(s), ` +
               `${erreursOuvertes} erreur(s) ouverte(s).` +
               (j.tests.filter(t => t.refus).length
                 ? ` ${j.tests.filter(t => t.refus).length} test(s) refusé(s) pour absence de preuve.` : '')
    };
  },

  /** Contexte textuel pour l’amorce d’un agent. */
  contexte({ limite = 6 } = {}) {
    const j = lire();
    const bloc = [];
    const actifs = j.objectifs.filter(o => o.etat === 'actif').slice(-limite);
    if (actifs.length) bloc.push('OBJECTIFS ACTIFS\n' + actifs.map(o => `— ${o.titre}`).join('\n'));

    const encours = j.projets.filter(p => ['accepte', 'encours'].includes(p.etat)).slice(-limite);
    if (encours.length) bloc.push('PROJETS EN COURS\n' + encours.map(p => `— ${p.titre} (${p.etat})`).join('\n'));

    const ouvertes = j.erreurs.filter(e => !e.corrigee).slice(-limite);
    if (ouvertes.length) bloc.push('ERREURS NON CORRIGÉES\n' + ouvertes.map(e =>
      `— ${e.titre}${e.cause ? ` — cause : ${e.cause}` : ''}`).join('\n'));

    const lecons = j.erreurs.filter(e => e.corrigee && e.correction).slice(-limite);
    if (lecons.length) bloc.push('LEÇONS DÉJÀ PAYÉES — ne pas refaire ces erreurs\n' + lecons.map(e =>
      `— ${e.correction}`).join('\n'));

    const refuses = j.projets.filter(p => p.etat === 'refuse').slice(-4);
    if (refuses.length) bloc.push('DÉJÀ REFUSÉ — ne pas reproposer\n' + refuses.map(p => `— ${p.titre}`).join('\n'));

    return bloc.length ? `\n\n--- JOURNAL ---\n${bloc.join('\n\n')}\n--- fin du journal ---\n` : '';
  }
};

export { ETATS_PROJET };
