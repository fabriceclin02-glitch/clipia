/**
 * CLIPIA — Le cycle proactif.
 *
 * DÉTECTER · ANALYSER · PROPOSER · PLANIFIER · EXÉCUTER · TESTER · APPRENDRE · AMÉLIORER
 *
 * C’est ici que Clipia cesse d’attendre. Un cycle part de ce qui existe
 * réellement — le journal, le graphe associatif, l’état de la machine —,
 * repère ce qui mérite d’être fait, le soumet aux rôles, et produit le
 * rapport en sept sections que demande la charte.
 *
 * Deux refus structurels, qui ne sont pas négociables :
 *
 *   — Sans modèle qui répond, le cycle s’arrête et le dit. Il ne rédige pas
 *     un rapport vraisemblable. Un rapport inventé serait lu comme vrai, et
 *     c’est exactement le genre de service qu’il ne faut pas rendre.
 *
 *   — Le cycle PROPOSE les actions sensibles, il ne les exécute jamais :
 *     dépenser, publier, supprimer, écrire à un tiers, toucher à la
 *     production. La charte l’exige, et c’est la seule façon qu’une boucle
 *     autonome reste sûre quand personne ne regarde.
 *
 * Ce qu’il exécute de lui-même : lire, mesurer, analyser, consolider sa
 * propre mémoire. Des actions internes et réversibles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SECTIONS_RAPPORT, CHAMPS_PROJET, CRITERES_TRI, SENSIBLE, amorce } from './charte.js';
import { journal, preuveMesure, preuveFichier } from './journal.js';
import * as graphe from './graphe.js';
import { conseil, modeleDisponible, consulter } from './roles.js';
import { chat } from '../providers/gateway.js';
import { etatOutils, ROOT, DATA_DIR } from '../lib/env.js';

/** ── DÉTECTER : ce que la machine dit d’elle-même, sans modèle ────────── */

/**
 * Observations factuelles, obtenues par mesure. Aucune n’est une opinion :
 * chacune porte sa méthode, donc chacune peut devenir une preuve.
 */
export function detecter() {
  const faits = [];
  const ajoute = (quoi, valeur, unite, methode, lecture) =>
    faits.push({ quoi, valeur, unite, methode, lecture, preuve: preuveMesure({ quoi, valeur, unite, methode }) });

  // Outils réellement présents.
  const outils = etatOutils();
  ajoute('ffmpeg disponible', outils.present ? 1 : 0, 'booléen',
    'appel de -version sur chaque chemin candidat',
    outils.present ? `Conversion audio et vidéo opérationnelle (${outils.ffmpeg}).` : outils.quoi);

  // Mémoire : volume et santé.
  const g = graphe.etat();
  ajoute('nœuds du graphe', g.noeuds, 'nœuds', 'comptage du fichier graphe.json', g.lecture);
  ajoute('nœuds isolés', g.isoles, 'nœuds', 'nœuds sans aucun lien',
    g.isoles > g.noeuds * 0.4 && g.noeuds > 6
      ? `${g.isoles} nœuds sur ${g.noeuds} ne sont reliés à rien : la mémoire stocke sans relier. Un tissage lexical y remédie.`
      : 'Le graphe est correctement tissé.');

  const j = journal.resume();
  ajoute('erreurs ouvertes', j.erreurs.ouvertes, 'erreurs', 'comptage du journal',
    j.erreurs.ouvertes ? `${j.erreurs.ouvertes} erreur(s) connue(s) et non corrigée(s).` : 'Aucune erreur en attente.');
  ajoute('tests refusés faute de preuve', j.tests.refuses, 'tests', 'comptage du journal',
    j.tests.refuses ? `${j.tests.refuses} test(s) déclaré(s) réussi(s) sans preuve : refusés.` : 'Tous les tests enregistrés portent une preuve.');

  // Place disque du dossier de données.
  try {
    const du = spawnSync('du', ['-sm', DATA_DIR], { encoding: 'utf8', timeout: 20000 });
    if (du.status === 0) {
      const mo = parseInt(du.stdout) || 0;
      ajoute('données sur disque', mo, 'Mo', 'du -sm sur le dossier de données',
        mo > 2000 ? `${mo} Mo de données : les médias anciens méritent un tri.` : `${mo} Mo de données.`);
    }
  } catch { /* du peut manquer */ }

  // Dette : fichiers du projet les plus gros, qui sont les plus durs à tenir.
  try {
    const srv = path.join(ROOT, 'server');
    if (fs.existsSync(srv)) {
      const gros = [];
      const parcourir = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) parcourir(p);
          else if (e.name.endsWith('.js')) {
            const lignes = fs.readFileSync(p, 'utf8').split('\n').length;
            gros.push({ fichier: path.relative(ROOT, p), lignes });
          }
        }
      };
      parcourir(srv);
      gros.sort((a, b) => b.lignes - a.lignes);
      const enorme = gros.filter(x => x.lignes > 900);
      if (enorme.length) ajoute('fichiers de plus de 900 lignes', enorme.length, 'fichiers',
        'comptage des lignes de chaque fichier du serveur',
        `${enorme.map(x => `${x.fichier} (${x.lignes} lignes)`).join(', ')} — un fichier trop long devient difficile à corriger sans rien casser.`);
    }
  } catch { /* lecture facultative */ }

  // Les liens que le graphe révèle de lui-même : la vraie détection.
  const d = graphe.decouvrir({ minimum: 0.04, limite: 5 });
  for (const l of d.liens.slice(0, 3)) {
    faits.push({ quoi: 'lien non saisi', valeur: l.affinite, unite: 'affinité',
      methode: 'propagation d’activation dans le graphe associatif',
      lecture: l.lecture, association: l });
  }

  return {
    faits,
    outils, graphe: g, journal: j,
    lecture: `${faits.length} observation(s) mesurée(s), dont ${d.liens.length} lien(s) que personne n’avait saisi(s).`
  };
}

/** ── LE CYCLE ────────────────────────────────────────────────────────── */

/**
 * Un cycle complet. `profondeur` décide du nombre de rôles consultés :
 * 'rapide' n’en appelle qu’un, 'complet' tient le conseil entier.
 */
export async function cycle({ profondeur = 'normal', objectif = null, capacites = {}, surAvancement = null } = {}) {
  const debut = Date.now();
  surAvancement?.({ etape: 'detecter', quoi: 'mesure de l’état réel' });

  // 1. On rouvre les preuves avant tout : un résultat prouvé par un fichier
  //    effacé n’est plus un résultat prouvé, et le rapport ne doit pas s’y fier.
  const verif = journal.verifier();

  // 2. DÉTECTER — sans modèle, par la mesure.
  const observe = detecter();

  // 3. Un modèle est-il là ? Sinon on s’arrête ici, avec ce qu’on a de vrai.
  surAvancement?.({ etape: 'modele', quoi: 'recherche d’un modèle qui répond' });
  const voie = await modeleDisponible();
  if (!voie) {
    const rapport = {
      le: new Date().toISOString(), partiel: true,
      verification: verif, observations: observe,
      sections: {
        opportunites: observe.faits.filter(f => f.association || /mérite|remédie|refusés|non corrigée/.test(f.lecture || ''))
          .map(f => ({ quoi: f.lecture, confiance: 'verifie', mesure: `${f.valeur} ${f.unite}` })),
        idees: [], immediat: [], ameliorations: [], encours: [], resultats: [], prochaines: []
      },
      pourquoiPartiel:
        'Aucun modèle ne répond, donc le cycle s’arrête après la phase de mesure. ' +
        'Ce qui est au-dessus est mesuré et vrai. Ce qui manque — les idées de projets, les analyses, les propositions — ' +
        'exige un modèle, et je ne vais pas l’inventer : un rapport fabriqué serait lu comme vrai. ' +
        'Pour débloquer : un modèle local depuis « Modèles locaux » (400 Mo, et rien ne sort de la machine), ou une clé gratuite.',
      secondes: +((Date.now() - debut) / 1000).toFixed(1)
    };
    journal.cycle({ partiel: true, observations: observe.faits.length, pourquoi: 'aucun modèle' });
    return rapport;
  }

  // 4. ANALYSER et PROPOSER — par les rôles.
  const sujet = objectif
    ? `Objectif : ${objectif}`
    : `Faire avancer Clipia. Voici ce que la machine dit d’elle-même, mesuré :\n` +
      observe.faits.map(f => `— ${f.quoi} : ${f.valeur} ${f.unite} — ${f.lecture}`).join('\n') +
      `\n\nQue faut-il faire, et dans quel ordre ?`;

  const roles = profondeur === 'rapide' ? ['strategie']
    : profondeur === 'complet' ? ['recherche', 'strategie', 'innovateur', 'developpeur', 'auditeur', 'analyste']
    : ['strategie', 'innovateur', 'auditeur'];

  surAvancement?.({ etape: 'conseil', quoi: `consultation de ${roles.length} rôles` });
  const c = await conseil({ sujet, roles, capacites,
    etat: observe.faits.map(f => `${f.quoi} : ${f.valeur} ${f.unite}`).join(' · '),
    surAvancement: (e) => surAvancement?.({ etape: 'conseil', quoi: e.etape, fait: e.fait, sur: e.sur }) });

  // 5. Mise en forme du rapport, par le modèle, en JSON strict.
  surAvancement?.({ etape: 'rapport', quoi: 'mise en forme des sept sections' });
  const sections = await structurer({ voie, observe, conseilRendu: c });

  // 6. APPRENDRE — on écrit ce qui est vrai dans le journal et le graphe.
  for (const f of observe.faits) {
    if (f.association) {
      try {
        graphe.relier({ de: f.association.de, vers: f.association.vers, type: 'ressemble',
          force: 0.3, pourquoi: 'lien proposé par le cycle, à instruire' });
      } catch { /* le lien peut être devenu invalide */ }
    }
  }
  const consolidation = graphe.consolider();
  const tissage = graphe.tisserLexical();

  // Les idées de projet entrent au journal à l’état « proposé », en hypothèse.
  const enregistres = [];
  for (const idee of (sections.idees || []).slice(0, 3)) {
    try {
      const p = journal.projet({ titre: idee.titre, etat: 'propose',
        champs: idee.champs || {}, scores: idee.scores || {},
        confiance: 'hypothese' });   // jamais mieux : rien n’est encore vérifié
      enregistres.push({ id: p.id, titre: p.titre, doublon: Boolean(p.doublon) });
    } catch { /* titre vide ou autre */ }
  }

  const rapport = {
    le: new Date().toISOString(), partiel: false,
    verification: verif, observations: observe,
    conseil: { avis: c.avis, synthese: c.synthese, echecs: c.echecs, par: c.par, local: c.local },
    sections,
    memoire: { consolidation, tissage, graphe: graphe.etat() },
    projetsEnregistres: enregistres,
    sensible: SENSIBLE,
    regle: 'Les actions sensibles — dépenser, publier, supprimer, écrire à un tiers, toucher à la production — ' +
           'sont proposées, jamais exécutées par le cycle. Elles attendent votre accord.',
    par: c.par, local: c.local,
    secondes: +((Date.now() - debut) / 1000).toFixed(1)
  };

  journal.cycle({ partiel: false, observations: observe.faits.length,
    idees: (sections.idees || []).length, par: c.par });
  return rapport;
}

/**
 * Demande au modèle de ranger le travail dans les sept sections, en JSON.
 * Si le JSON ne vient pas, on rend le texte brut plutôt que d’inventer une
 * structure : une structure fausse est plus trompeuse qu’un texte en vrac.
 */
async function structurer({ voie, observe, conseilRendu }) {
  const consigne = `Range le travail ci-dessous dans ces sept sections, en JSON STRICT et rien d’autre.

{
 "opportunites":[{"quoi":"...","confiance":"verifie|probable|hypothese","pourquoi":"..."}],
 "idees":[{"titre":"...","scores":{"priorite":1-5,"faisabilite":1-5,"utilite":1-5,"cout":1-5,"delai":1-5,"potentiel":1-5},
           "champs":{${CHAMPS_PROJET.map(c => `"${c.cle}":"..."`).join(',')}}}],
 "immediat":[{"quoi":"...","pourquoi":"...","sensible":true|false}],
 "ameliorations":[{"quoi":"...","attendu":"...","reversible":true|false}],
 "encours":[{"quoi":"...","blocage":"..."}],
 "resultats":[{"quoi":"...","preuve":"...","confiance":"verifie|probable|hypothese"}],
 "prochaines":[{"quoi":"...","pourquoi":"..."}]
}

Règles :
— Au plus trois idées, les meilleures, classées par priorité décroissante.
— Pour "cout" et "delai", 5 veut dire FAIBLE coût et COURT délai : un bon score est toujours un bon signe.
— "confiance":"verifie" seulement si une mesure est citée dans les observations. Sinon "probable" ou "hypothese".
— "sensible":true pour tout ce qui dépense, publie, supprime, écrit à un tiers ou touche à la production.
— Pas de rentabilité annoncée sans chiffre vérifié : écris "à mesurer" dans "interet".
— Si une section est vide, rends un tableau vide. Ne la remplis pas pour faire bonne figure.`;

  const matiere =
    `OBSERVATIONS MESURÉES\n${observe.faits.map(f => `— ${f.quoi} : ${f.valeur} ${f.unite} — ${f.lecture}`).join('\n')}\n\n` +
    `AVIS DES RÔLES\n${conseilRendu.avis.map(a => `### ${a.nom}\n${a.texte}`).join('\n\n')}` +
    (conseilRendu.synthese ? `\n\n### Coordinateur\n${conseilRendu.synthese.texte}` : '');

  const r = await chat(voie.id, {
    model: voie.modele, temperature: 0.2, max_tokens: 2600,
    messages: [
      { role: 'system', content: amorce({ role: 'coordinateur', capacites: {} }) },
      { role: 'user', content: `${consigne}\n\n${matiere}` }
    ]
  });

  const t = String(r.text || '');
  const i = t.indexOf('{'), f = t.lastIndexOf('}');
  if (i < 0 || f <= i) return { brut: t, structure: false,
    pourquoi: 'Le modèle n’a pas rendu de JSON. Texte brut conservé tel quel : fabriquer une structure à partir de rien serait pire.' };
  try {
    const j = JSON.parse(t.slice(i, f + 1));
    for (const s of SECTIONS_RAPPORT) j[s.cle] ||= [];
    // Garde-fou : aucune confiance « verifie » ne passe sans mesure citée.
    const mesures = observe.faits.map(x => String(x.quoi).toLowerCase());
    for (const liste of ['opportunites', 'resultats']) {
      for (const el of j[liste]) {
        if (el.confiance === 'verifie') {
          const cite = mesures.some(m => String(el.quoi || '').toLowerCase().includes(m.split(' ')[0]));
          if (!cite) { el.confiance = 'probable'; el.abaisse = 'Ramené à « probable » : aucune mesure correspondante dans les observations.'; }
        }
      }
    }
    return { ...j, structure: true, criteres: CRITERES_TRI };
  } catch (e) {
    return { brut: t, structure: false, pourquoi: `JSON illisible (${e.message.slice(0, 90)}). Texte brut conservé.` };
  }
}

/** ── AMÉLIORER : proposer une modification, versionnée et réversible ──── */

const PROPOSITIONS = path.join(DATA_DIR, 'propositions');

/**
 * Enregistre une proposition de modification d’un fichier du projet.
 * Elle n’est JAMAIS appliquée ici : on garde le contenu d’origine pour que
 * le retour arrière soit possible, et on attend un accord humain. La charte
 * l’exige, et c’est la condition pour qu’un système qui se modifie lui-même
 * reste sûr.
 */
export function proposerModification({ fichier, nouveauContenu, pourquoi, attendu }) {
  const abs = path.resolve(ROOT, fichier);
  if (!abs.startsWith(ROOT)) throw new Error('Refusé : un fichier hors du dossier du projet.');
  if (!fs.existsSync(abs)) throw new Error(`Fichier inconnu : ${fichier}`);
  if (!pourquoi || !attendu) throw new Error('Une proposition exige son motif et l’effet attendu : sans quoi on ne pourra pas juger si elle a marché.');

  fs.mkdirSync(PROPOSITIONS, { recursive: true });
  const origine = fs.readFileSync(abs, 'utf8');
  const id = 'prop_' + Date.now().toString(36);
  const dossier = path.join(PROPOSITIONS, id);
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, 'origine'), origine);
  fs.writeFileSync(path.join(dossier, 'propose'), nouveauContenu);

  const meta = { id, fichier, pourquoi, attendu, le: new Date().toISOString(),
    etat: 'en-attente', octetsAvant: origine.length, octetsApres: nouveauContenu.length };
  fs.writeFileSync(path.join(dossier, 'meta.json'), JSON.stringify(meta, null, 2));

  journal.amelioration({ titre: `Modification proposée : ${fichier}`, quoi: pourquoi, attendu, applique: false,
    preuves: [preuveFichier(path.join(dossier, 'propose'))] });

  return { ...meta,
    reversible: true,
    regle: 'Rien n’est appliqué. Le contenu d’origine est conservé, donc le retour arrière est garanti. ' +
           'Il faut votre accord explicite pour appliquer, et un test après application pour mesurer l’effet.' };
}

export function listerPropositions() {
  if (!fs.existsSync(PROPOSITIONS)) return [];
  return fs.readdirSync(PROPOSITIONS).map(id => {
    try { return JSON.parse(fs.readFileSync(path.join(PROPOSITIONS, id, 'meta.json'), 'utf8')); }
    catch { return null; }
  }).filter(Boolean).sort((a, b) => b.le.localeCompare(a.le));
}

export function voirProposition(id) {
  const d = path.join(PROPOSITIONS, id);
  if (!fs.existsSync(d)) throw new Error(`Proposition inconnue : ${id}`);
  return {
    meta: JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8')),
    origine: fs.readFileSync(path.join(d, 'origine'), 'utf8'),
    propose: fs.readFileSync(path.join(d, 'propose'), 'utf8')
  };
}

/** Applique, uniquement sur accord humain explicite, et garde le retour arrière. */
export function appliquerProposition({ id, accord }) {
  if (accord !== 'je confirme')
    throw new Error('Refusé : une modification du système exige l’accord explicite. Renvoyer accord = « je confirme ».');
  const p = voirProposition(id);
  const abs = path.resolve(ROOT, p.meta.fichier);
  const actuel = fs.readFileSync(abs, 'utf8');
  if (actuel !== p.origine)
    throw new Error('Refusé : le fichier a changé depuis la proposition. Le retour arrière ne serait plus fiable. Refaire la proposition sur la version actuelle.');

  fs.writeFileSync(abs, p.propose);
  const meta = { ...p.meta, etat: 'applique', applique: new Date().toISOString() };
  fs.writeFileSync(path.join(PROPOSITIONS, id, 'meta.json'), JSON.stringify(meta, null, 2));
  journal.version({ etiquette: `${p.meta.fichier} — ${id}`, quoi: p.meta.pourquoi,
    fichiers: [p.meta.fichier], preuves: [preuveFichier(abs)] });
  return { ...meta, retourArriere: `Pour revenir : annulerProposition('${id}').`,
    rappel: 'Mesurez maintenant l’effet attendu. Une amélioration non mesurée n’est pas une amélioration.' };
}

export function annulerProposition(id) {
  const p = voirProposition(id);
  const abs = path.resolve(ROOT, p.meta.fichier);
  fs.writeFileSync(abs, p.origine);
  const meta = { ...p.meta, etat: 'annule', annule: new Date().toISOString() };
  fs.writeFileSync(path.join(PROPOSITIONS, id, 'meta.json'), JSON.stringify(meta, null, 2));
  return { ...meta, retabli: p.meta.fichier };
}

export { SECTIONS_RAPPORT };
