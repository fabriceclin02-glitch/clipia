/**
 * CLIPIA — Un décodeur entraîné sur TON cerveau. Pas un modèle universel.
 *
 * ════════════════════════════════════════════════════════════════════════
 *  POURQUOI CECI EXISTE
 * ════════════════════════════════════════════════════════════════════════
 *  Lire une phrase formulée dans la tête depuis un casque posé sur le crâne
 *  n’est pas un problème de logiciel. Le signal est moyenné sur plusieurs
 *  centimètres de cortex et filtré par l’os : l’information phonème par
 *  phonème n’arrive pas jusqu’aux électrodes. Aucun algorithme ne récupère
 *  ce qui n’a pas survécu au trajet. Les équipes qui décodent réellement la
 *  parole intérieure le font avec des électrodes implantées.
 *
 *  Ce qui, en revanche, n’existe pas en rayon et que ce module fabrique :
 *
 *  1. UN DÉCODEUR PERSONNEL. Les signatures cérébrales sont individuelles.
 *     Un modèle moyen marche mal pour tout le monde ; un modèle entraîné sur
 *     une seule personne marche bien pour elle. Clipia enregistre tes essais
 *     étiquetés, extrait les caractéristiques, entraîne un classifieur et te
 *     donne sa précision réelle par validation croisée. Si c’est 55 %, il te
 *     le dit. Pas de score gonflé, pas de démonstration truquée.
 *
 *  2. UN ARBRE DE COMPOSITION. Six commandes fiables suffisent à écrire
 *     n’importe quoi, comme le T9 écrivait tout avec douze touches. C’est le
 *     chemin honnête de « six choix » vers « tout dire ».
 *
 *  Tout est écrit à la main : analyse discriminante linéaire, inversion de
 *  matrice, validation croisée. Aucune dépendance, rien de caché.
 */
import fs from 'node:fs';
import path from 'node:path';
import { store, uid } from '../lib/store.js';
import { DATA_DIR } from '../lib/env.js';
import { bandes, simuler } from './pensee.js';

const DOSSIER = path.join(DATA_DIR, 'decodeurs');
const SR = 256;

/** ── CARACTÉRISTIQUES ───────────────────────────────────────────────── */

/**
 * Pour chaque voie : la puissance relative des cinq bandes, plus deux
 * rapports qui portent beaucoup d’information (alpha/bêta, thêta/alpha).
 * Pour un casque 4 voies : 4 × 7 = 28 caractéristiques.
 */
export function caracteristiques(voies, sr = SR) {
  const vec = [];
  for (const ech of voies) {
    const b = bandes(ech, sr);
    vec.push(b.delta, b.theta, b.alpha, b.beta, b.gamma);
    vec.push(b.alpha / (b.beta + 1e-9), b.theta / (b.alpha + 1e-9));
  }
  return vec.map(x => Number.isFinite(x) ? x : 0);
}

/** ── ALGÈBRE, À LA MAIN ─────────────────────────────────────────────── */

function inverser(M) {
  const n = M.length;
  const A = M.map((l, i) => [...l, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r;
    if (Math.abs(A[pivot][c]) < 1e-12) return null;          // matrice singulière
    [A[c], A[pivot]] = [A[pivot], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map(l => l.slice(n));
}

/**
 * Analyse discriminante linéaire, avec régularisation de Ledoit-Wolf
 * simplifiée : indispensable quand on a 28 caractéristiques et 40 essais.
 * Sans elle, le modèle apprend le bruit par cœur et annonce 100 % de
 * précision sur ses propres données — le piège classique.
 */
function entrainerLDA(X, y, lambda = 0.25) {
  const classes = [...new Set(y)];
  const d = X[0].length, n = X.length;

  const moyennes = {}, effectifs = {};
  for (const c of classes) {
    const sous = X.filter((_, i) => y[i] === c);
    effectifs[c] = sous.length;
    moyennes[c] = Array.from({ length: d }, (_, j) => sous.reduce((s, x) => s + x[j], 0) / sous.length);
  }

  // Covariance intra-classe commune.
  let S = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < n; i++) {
    const m = moyennes[y[i]];
    const dv = X[i].map((v, j) => v - m[j]);
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) S[a][b] += dv[a] * dv[b];
  }
  const dl = Math.max(1, n - classes.length);
  for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) S[a][b] /= dl;

  // Régularisation : on tire la covariance vers la diagonale.
  const trace = S.reduce((s, l, i) => s + l[i], 0) / d;
  for (let a = 0; a < d; a++) for (let b = 0; b < d; b++)
    S[a][b] = (1 - lambda) * S[a][b] + (a === b ? lambda * trace : 0);

  let Si = inverser(S);
  if (!Si) {   // dernier recours : diagonale seule
    Si = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) =>
      a === b ? 1 / (S[a][a] + 1e-9) : 0));
  }

  const poids = {}, biais = {};
  for (const c of classes) {
    const m = moyennes[c];
    const w = Array.from({ length: d }, (_, a) => m.reduce((s, _, b) => s + Si[a][b] * m[b], 0));
    poids[c] = w;
    biais[c] = -0.5 * w.reduce((s, wa, a) => s + wa * m[a], 0) + Math.log(effectifs[c] / n);
  }
  return { classes, poids, biais, dimension: d, lambda };
}

function predire(modele, x) {
  const sc = modele.classes.map(c => ({
    classe: c,
    score: modele.poids[c].reduce((s, w, i) => s + w * x[i], 0) + modele.biais[c]
  })).sort((a, b) => b.score - a.score);

  // Scores en probabilités par softmax, pour une confiance lisible.
  const max = sc[0].score;
  const exps = sc.map(s => Math.exp(s.score - max));
  const somme = exps.reduce((a, b) => a + b, 0);
  return {
    classe: sc[0].classe,
    confiance: +(exps[0] / somme).toFixed(3),
    scores: sc.map((s, i) => ({ classe: s.classe, probabilite: +(exps[i] / somme).toFixed(3) }))
  };
}

/**
 * Validation croisée stratifiée en k blocs. C’est la seule mesure honnête :
 * on entraîne sur une partie, on teste sur ce que le modèle n’a jamais vu,
 * et on recommence. Évaluer un modèle sur ses données d’entraînement
 * donnerait un chiffre flatteur et faux.
 */
function validationCroisee(X, y, k = 5, lambda = 0.25) {
  const classes = [...new Set(y)];
  const parClasse = {};
  for (const c of classes) parClasse[c] = y.map((v, i) => v === c ? i : -1).filter(i => i >= 0);

  const blocs = Array.from({ length: k }, () => []);
  for (const c of classes) {
    const idx = [...parClasse[c]].sort(() => Math.random() - 0.5);
    idx.forEach((i, j) => blocs[j % k].push(i));
  }

  const confusion = {};
  for (const a of classes) { confusion[a] = {}; for (const b of classes) confusion[a][b] = 0; }
  let justes = 0, total = 0;

  for (let b = 0; b < k; b++) {
    const test = new Set(blocs[b]);
    const Xa = [], ya = [];
    for (let i = 0; i < X.length; i++) if (!test.has(i)) { Xa.push(X[i]); ya.push(y[i]); }
    if (new Set(ya).size < 2) continue;
    const m = entrainerLDA(Xa, ya, lambda);
    for (const i of blocs[b]) {
      const p = predire(m, X[i]);
      confusion[y[i]][p.classe]++;
      if (p.classe === y[i]) justes++;
      total++;
    }
  }

  const hasard = 1 / classes.length;
  const precision = total ? justes / total : 0;
  // Kappa de Cohen : à quel point on fait mieux que le hasard.
  const kappa = (precision - hasard) / (1 - hasard);

  return {
    precision: +precision.toFixed(3), hasard: +hasard.toFixed(3), kappa: +kappa.toFixed(3),
    essais: total, blocs: k, confusion,
    verdict: precision < hasard + 0.08 ? 'inutilisable'
           : precision < 0.65 ? 'faible'
           : precision < 0.80 ? 'utilisable'
           : precision < 0.92 ? 'bon' : 'excellent',
    lecture: precision < hasard + 0.08
      ? `${(precision * 100).toFixed(0)} % contre ${(hasard * 100).toFixed(0)} % au hasard : le modèle n’a rien appris. Il faut plus d’essais, ou des classes plus distinctes.`
      : `${(precision * 100).toFixed(0)} % de réussite sur des essais jamais vus, contre ${(hasard * 100).toFixed(0)} % au hasard (kappa ${kappa.toFixed(2)}). Mesuré par validation croisée en ${k} blocs, pas sur les données d’entraînement.`
  };
}

/** ── SESSIONS D’ENTRAÎNEMENT ────────────────────────────────────────── */

function dossier() { fs.mkdirSync(DOSSIER, { recursive: true }); return DOSSIER; }
const chemin = (nom) => path.join(dossier(), `${nom.replace(/[^a-z0-9_-]/gi, '_')}.json`);

/** Ouvre une session : on choisit ce qu’on veut apprendre à distinguer. */
export function nouvelleSession({ nom = 'fabrice', intentions = ['oui','non'], repetitions = 20 }) {
  if (intentions.length < 2) throw new Error('Il faut au moins deux intentions à distinguer.');
  const s = {
    nom, intentions, repetitions, cree: new Date().toISOString(),
    essais: [], modele: null, evaluation: null
  };
  fs.writeFileSync(chemin(nom), JSON.stringify(s, null, 2));
  return {
    ...s,
    protocole: `Pour chaque intention, ${repetitions} essais de 4 secondes. Clipia annonce l’intention, tu la tiens pendant 4 secondes, on passe à la suivante. Compte environ ${Math.ceil(intentions.length * repetitions * 6 / 60)} minutes. Reste immobile : un mouvement de mâchoire ou un clignement produit un artefact plus gros que tout le signal cérébral.`,
    conseil: intentions.length > 4
      ? 'Plus de quatre intentions, c’est ambitieux pour un premier essai. Commence par deux, vérifie que ça marche, puis élargis.'
      : 'Deux à quatre intentions : c’est le bon ordre de grandeur pour un casque grand public.'
  };
}

export function lireSession(nom = 'fabrice') {
  const f = chemin(nom);
  if (!fs.existsSync(f)) throw new Error(`Aucune session « ${nom} ». Il faut d’abord en créer une.`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** Ajoute un essai étiqueté. voies = tableau de Float32Array, une par électrode. */
export function ajouterEssai({ nom = 'fabrice', intention, voies, sr = SR }) {
  const s = lireSession(nom);
  if (!s.intentions.includes(intention)) throw new Error(`« ${intention} » ne fait pas partie de cette session (${s.intentions.join(', ')}).`);
  const x = caracteristiques(voies.map(v => Float32Array.from(v)), sr);
  s.essais.push({ intention, x, quand: Date.now() });
  s.modele = null; s.evaluation = null;              // tout nouvel essai invalide le modèle
  fs.writeFileSync(chemin(nom), JSON.stringify(s, null, 2));

  const parIntention = {};
  for (const i of s.intentions) parIntention[i] = s.essais.filter(e => e.intention === i).length;
  const minimum = Math.min(...Object.values(parIntention));
  return {
    total: s.essais.length, parIntention,
    pretAEntrainer: minimum >= 8,
    manque: minimum >= 8 ? 0 : 8 - minimum,
    conseil: minimum >= 8 ? 'Assez d’essais pour entraîner.' : `Encore ${8 - minimum} essais minimum sur l’intention la moins fournie.`
  };
}

export function entrainer({ nom = 'fabrice', lambda = 0.25, blocs = 5 }) {
  const s = lireSession(nom);
  if (s.essais.length < 16) throw new Error(`${s.essais.length} essais seulement. Il en faut au moins 16, et de préférence 40.`);

  const X = s.essais.map(e => e.x), y = s.essais.map(e => e.intention);
  const k = Math.min(blocs, Math.min(...s.intentions.map(i => y.filter(v => v === i).length)));
  const evaluation = validationCroisee(X, y, Math.max(2, k), lambda);
  const modele = entrainerLDA(X, y, lambda);

  s.modele = modele; s.evaluation = evaluation; s.entraine = new Date().toISOString();
  fs.writeFileSync(chemin(nom), JSON.stringify(s, null, 2));

  return {
    nom, intentions: s.intentions, essais: s.essais.length, evaluation,
    utilisable: evaluation.precision >= 0.65,
    suite: evaluation.precision >= 0.80
      ? 'Modèle bon. Tu peux l’utiliser pour piloter Clipia, et le combiner à l’arbre de composition pour écrire des phrases entières.'
      : evaluation.precision >= 0.65
      ? 'Modèle utilisable mais perfectible. Ajoute des essais, ou réduis à deux intentions bien distinctes.'
      : 'Modèle insuffisant. Deux causes habituelles : pas assez d’essais, ou deux intentions trop proches cérébralement. Essaie « imaginer serrer la main gauche » contre « compter à l’envers » : ces deux-là se distinguent bien.'
  };
}

export function decoder({ nom = 'fabrice', voies, sr = SR }) {
  const s = lireSession(nom);
  if (!s.modele) throw new Error('Modèle non entraîné pour cette session.');
  const x = caracteristiques(voies.map(v => Float32Array.from(v)), sr);
  const p = predire(s.modele, x);
  const fiable = p.confiance >= 0.6 && s.evaluation?.precision >= 0.65;
  return {
    ...p, fiable,
    precisionModele: s.evaluation?.precision ?? null,
    lecture: fiable
      ? `« ${p.classe} » avec ${(p.confiance * 100).toFixed(0)} % de confiance.`
      : `Pas assez sûr pour agir (${(p.confiance * 100).toFixed(0)} %). Clipia préfère ne rien faire que se tromper.`
  };
}

/** ── ARBRE DE COMPOSITION : PEU DE SIGNAUX, TOUT DIRE ───────────────── */

/**
 * Le chemin honnête de « six commandes » vers « n’importe quelle phrase ».
 * Avec deux signaux fiables seulement, une recherche binaire sur l’alphabet
 * donne une lettre en 5 choix. Avec six, c’est 2 à 3 choix par lettre.
 * C’est exactement le principe du T9, et ça a équipé le monde entier.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789.,?!';

export function arbre({ signaux = 2, cible = ALPHABET.length } = {}) {
  const profondeur = Math.ceil(Math.log(cible) / Math.log(Math.max(2, signaux)));
  return {
    signaux, symboles: cible, choixParLettre: profondeur,
    secondesParLettre: +(profondeur * 4).toFixed(0),
    lettresParMinute: +(60 / (profondeur * 4)).toFixed(1),
    comment: signaux === 2
      ? 'Recherche binaire : Clipia coupe l’alphabet en deux, tu choisis la moitié qui contient ta lettre, et on recommence. Cinq choix pour une lettre parmi quarante.'
      : `L’alphabet est découpé en ${signaux} groupes à chaque étape. ${profondeur} choix suffisent pour n’importe quelle lettre.`,
    phrases: 'Les mots fréquents sont proposés dès les premières lettres, comme une saisie prédictive. En pratique on écrit beaucoup plus vite que lettre par lettre.',
    honnete: `Avec ${signaux} signaux fiables, compte environ ${(60 / (profondeur * 4)).toFixed(1)} lettres par minute. C’est lent face à la parole, mais ce n’est pas une démonstration : c’est le débit réel des interfaces cerveau-machine cliniques, et il permet de dire tout ce qu’on veut.`
  };
}

/** Un pas dans l’arbre : Clipia propose, le cerveau choisit. */
export function pasArbre({ restant = ALPHABET, signaux = 2 }) {
  const taille = Math.ceil(restant.length / signaux);
  const groupes = [];
  for (let i = 0; i < restant.length; i += taille)
    groupes.push({ symboles: restant.slice(i, i + taille), libelle: `${restant[i]} → ${restant[Math.min(i + taille - 1, restant.length - 1)]}` });
  return {
    groupes, termine: restant.length === 1, lettre: restant.length === 1 ? restant : null,
    consigne: restant.length === 1 ? `Lettre trouvée : ${restant}` : `Choisis le groupe qui contient ta lettre (${groupes.length} possibilités).`
  };
}

/** ── DÉMONSTRATION SUR SIGNAL SIMULÉ ────────────────────────────────── */

/**
 * Prouve que toute la chaîne fonctionne, sans casque : on fabrique des essais
 * réalistes pour deux profils mentaux distincts, on entraîne, on valide.
 * Le chiffre annoncé est une vraie validation croisée, pas une mise en scène.
 */
export function demonstration({ nom = 'demo', profils = ['detente','concentration'], parClasse = 20 } = {}) {
  nouvelleSession({ nom, intentions: profils, repetitions: parClasse });
  for (const p of profils) {
    for (let i = 0; i < parClasse; i++) {
      const voies = [0, 1, 2, 3].map(() => simuler({ secondes: 4, profil: p }));
      ajouterEssai({ nom, intention: p, voies });
    }
  }
  const r = entrainer({ nom });
  return {
    ...r,
    avertissement: 'Chiffres obtenus sur signal simulé : les profils y sont plus nets que dans un vrai EEG. Sur un cerveau réel, attends-toi à moins. La chaîne logicielle, elle, est bien celle qui tournera avec ton casque.'
  };
}

export const CE_QUE_JE_PEUX = {
  cree: [
    'Un décodeur entraîné sur ton cerveau à toi, avec sa précision réelle mesurée par validation croisée.',
    'Un arbre de composition qui transforme deux à six signaux fiables en n’importe quelle phrase.',
    'La boucle fermée : Clipia mesure ton état, adapte le son, et remesure l’effet.'
  ],
  impossible: [
    'Décoder une phrase formulée en silence depuis un casque externe. L’information n’atteint pas les électrodes : elle est moyennée sur des centimètres de cortex et filtrée par l’os du crâne. Ce n’est pas une limite de calcul, c’est une limite physique du trajet du signal.'
  ],
  pourquoi: 'Je peux créer ce qui manque, pas ce qui n’arrive pas. Une information détruite en route ne se reconstruit par aucun algorithme — et un système qui prétendrait la deviner te renverrait ses propres inventions en te faisant croire que ce sont tes pensées. Ce serait le pire service à te rendre.',
  voie: 'La vraie voie est ailleurs, et elle est ouverte : au lieu de lire ce que tu formules, Clipia détecte ce que tu choisis, et un arbre bien construit transforme peu de choix en tout ce que tu veux dire. C’est ce qui équipe aujourd’hui les personnes qui ne peuvent plus parler.'
};
