/**
 * CLIPIA — Mémoire associative. Un vrai graphe, pas une métaphore.
 *
 * Un cerveau ne range pas ses souvenirs dans des dossiers : il les relie, et
 * penser consiste largement à laisser l’activation se propager de proche en
 * proche jusqu’à ce qu’un lien inattendu s’allume. Quatre mécanismes connus
 * sont implémentés ici, et chacun fait un calcul réel :
 *
 *  1. PROPAGATION D’ACTIVATION
 *     On allume quelques nœuds, l’énergie se diffuse le long des liens en
 *     s’atténuant à chaque saut. Des nœuds jamais cités remontent parce
 *     qu’ils sont au croisement de plusieurs chemins. C’est le mécanisme des
 *     architectures cognitives classiques, et c’est ce qui donne l’effet
 *     « ça me fait penser à ».
 *
 *  2. RENFORCEMENT HEBBIEN
 *     Deux nœuds activés ensemble voient leur lien se renforcer ; les liens
 *     inutilisés s’affaiblissent avec le temps. « Ce qui s’active ensemble
 *     se lie. » Conséquence directe : le graphe se spécialise sur ce que
 *     l’utilisateur fait vraiment, pas sur ce qu’on avait prévu.
 *
 *  3. AFFINITÉ LEXICALE
 *     Deux textes qui partagent des termes RARES sont probablement liés ;
 *     s’ils ne partagent que des mots courants, ils ne le sont pas. On pèse
 *     donc chaque terme par sa rareté dans le corpus — un terme présent
 *     partout n’informe sur rien.
 *
 *  4. CONSOLIDATION
 *     Périodiquement, les quasi-doublons fusionnent et les liens trop
 *     faibles disparaissent. Sans cela le graphe gonfle et finit par relier
 *     tout à tout, ce qui ne vaut pas mieux que de ne rien relier.
 *
 * Et la fonction qui justifie l’ensemble : DÉCOUVRIR. On cherche les paires
 * fortement reliées par des chemins indirects mais sans lien direct. Ce sont
 * les connexions que personne n’a saisies et que la structure révèle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../lib/env.js';

const FICHIER = path.join(DATA_DIR, 'graphe.json');

export const TYPES_NOEUD = {
  projet:    'un projet, proposé ou en cours',
  objectif:  'un but exprimé par l’utilisateur',
  lecon:     'une leçon tirée d’un résultat réel',
  erreur:    'une erreur rencontrée, avec sa cause',
  methode:   'une façon de faire qui a marché',
  outil:     'un outil, un fournisseur, une capacité',
  fait:      'un fait établi sur l’utilisateur ou son monde',
  concept:   'une notion technique ou métier',
  fichier:   'un fichier du projet',
  resultat:  'un résultat mesuré, avec sa preuve',
  opportunite:'une piste repérée, pas encore instruite'
};

export const TYPES_LIEN = {
  cause:     { nom:'cause',      force:0.9, quoi:'A a produit B' },
  resout:    { nom:'résout',     force:0.9, quoi:'A corrige B' },
  dependde:  { nom:'dépend de',  force:0.8, quoi:'A a besoin de B' },
  partie:    { nom:'partie de',  force:0.8, quoi:'A est un morceau de B' },
  contredit: { nom:'contredit',  force:0.7, quoi:'A et B ne peuvent pas être vrais ensemble' },
  ressemble: { nom:'ressemble',  force:0.5, quoi:'A et B relèvent du même genre' },
  cooccurre: { nom:'co-occurre', force:0.35,quoi:'A et B sont apparus dans le même travail' },
  lexical:   { nom:'lexical',    force:0.3, quoi:'A et B partagent un vocabulaire rare' }
};

/** Mots trop fréquents pour informer sur quoi que ce soit. */
const VIDES = new Set(('le la les un une des du de au aux et ou mais donc or ni car ce cet cette ces ' +
  'je tu il elle on nous vous ils elles mon ma mes ton ta tes son sa ses notre votre leur leurs ' +
  'que qui quoi dont ou quand comment pourquoi est sont etre avoir fait faire pour par avec sans ' +
  'dans sur sous entre vers chez plus moins tres tout tous toute toutes meme aussi alors ainsi ' +
  'pas ne non oui si comme deja encore toujours jamais peut doit faut avant apres pendant depuis ' +
  'cela ceci celui celle ceux the and for with this that from have been will not are was were ' +
  'clipia application fichier chose faire mettre voir savoir dire aller venir').split(/\s+/));

const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

export function termes(texte) {
  return [...new Set(sansAccent(String(texte || '')).toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 4 && t.length <= 24 && !VIDES.has(t) && !/^\d+$/.test(t)))];
}

const VIDE = { noeuds: {}, liens: [], version: 2, consolide: null, activations: 0 };

function lire() {
  try {
    const g = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    return { ...structuredClone(VIDE), ...g };
  } catch { return structuredClone(VIDE); }
}

function ecrire(g) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FICHIER + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(g));
  fs.renameSync(tmp, FICHIER);
  return g;
}

const idDe = (type, titre) =>
  type + ':' + sansAccent(titre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56);

/** ── ÉCRITURE ────────────────────────────────────────────────────────── */

export function ajouter({ type = 'concept', titre, texte = '', poids = 1, source = null, confiance = 'hypothese' }) {
  if (!titre?.trim()) throw new Error('Un nœud a besoin d’un titre.');
  const g = lire();
  const id = idDe(type, titre);
  const maintenant = Date.now();

  if (g.noeuds[id]) {
    const n = g.noeuds[id];
    // On enrichit sans écraser : un nœud revu gagne en importance.
    if (texte && texte.length > (n.texte || '').length) n.texte = texte.slice(0, 1200);
    n.poids = Math.min(10, n.poids + 0.3);
    n.vu = (n.vu || 0) + 1;
    n.dernier = maintenant;
    if (source && !n.sources?.includes(source)) (n.sources ||= []).push(source);
    if (confiance && CONF_RANG[confiance] > CONF_RANG[n.confiance || 'hypothese']) n.confiance = confiance;
  } else {
    g.noeuds[id] = {
      id, type, titre: titre.trim().slice(0, 160), texte: String(texte).slice(0, 1200),
      poids, vu: 1, cree: maintenant, dernier: maintenant,
      sources: source ? [source] : [], confiance,
      termes: termes(titre + ' ' + texte)
    };
  }
  ecrire(g);
  return g.noeuds[id];
}

const CONF_RANG = { hypothese: 1, probable: 2, verifie: 3 };

/**
 * Résout un identifiant OU un titre. Sans cela, tout appelant devrait
 * reconstruire le slug exact — y compris sa troncature — ce qui est une
 * source d’erreurs inutile.
 */
export function resoudre(ref, g = lire()) {
  if (!ref) return null;
  if (g.noeuds[ref]) return ref;
  const cible = sansAccent(String(ref)).toLowerCase().trim();
  // Essai 1 : titre identique, quel que soit le type.
  for (const id in g.noeuds)
    if (sansAccent(g.noeuds[id].titre).toLowerCase().trim() === cible) return id;
  // Essai 2 : identifiant qui commence pareil (slug tronqué).
  const slug = cible.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const id in g.noeuds) {
    const sansType = id.slice(id.indexOf(':') + 1);
    if (sansType === slug || slug.startsWith(sansType) || sansType.startsWith(slug)) return id;
  }
  return null;
}

export function relier({ de, vers, type = 'ressemble', force, pourquoi = '' }) {
  const g = lire();
  de = resoudre(de, g) || de;
  vers = resoudre(vers, g) || vers;
  if (!g.noeuds[de] || !g.noeuds[vers]) {
    const absent = !g.noeuds[de] ? de : vers;
    const proches = Object.values(g.noeuds).map(n => n.titre).slice(0, 5);
    throw new Error(`Nœud inconnu : « ${absent} ». Titres existants, pour mémoire : ${proches.map(t => `« ${t} »`).join(', ')}.`);
  }
  if (de === vers) throw new Error('Un nœud ne se relie pas à lui-même.');
  const f = force ?? (TYPES_LIEN[type]?.force || 0.4);
  const existant = g.liens.find(l =>
    ((l.de === de && l.vers === vers) || (l.de === vers && l.vers === de)) && l.type === type);
  if (existant) {
    existant.force = Math.min(1, existant.force + 0.1);
    existant.usages = (existant.usages || 1) + 1;
    existant.dernier = Date.now();
  } else {
    g.liens.push({ de, vers, type, force: f, usages: 1,
      cree: Date.now(), dernier: Date.now(), pourquoi: pourquoi.slice(0, 200) });
  }
  ecrire(g);
  return { relie: true, de, vers, type };
}

/**
 * Renforcement hebbien : les nœuds cités dans un même travail se relient.
 * C’est ici que le graphe apprend de l’usage, sans qu’on le lui dicte.
 */
export function coActiver(ids, contexte = '') {
  const g = lire();
  const presents = ids.map(i => resoudre(i, g)).filter(Boolean);
  if (presents.length < 2) return { renforces: 0 };
  let n = 0;
  for (let i = 0; i < presents.length; i++) {
    for (let j = i + 1; j < presents.length; j++) {
      const [a, b] = [presents[i], presents[j]];
      const l = g.liens.find(x => (x.de === a && x.vers === b) || (x.de === b && x.vers === a));
      if (l) { l.force = Math.min(1, l.force + 0.08); l.usages = (l.usages || 1) + 1; l.dernier = Date.now(); }
      else g.liens.push({ de: a, vers: b, type: 'cooccurre', force: TYPES_LIEN.cooccurre.force,
        usages: 1, cree: Date.now(), dernier: Date.now(), pourquoi: contexte.slice(0, 160) });
      n++;
    }
    g.noeuds[presents[i]].vu = (g.noeuds[presents[i]].vu || 0) + 1;
    g.noeuds[presents[i]].dernier = Date.now();
  }
  g.activations = (g.activations || 0) + 1;
  ecrire(g);
  return { renforces: n, noeuds: presents.length };
}

/**
 * Affinité lexicale pondérée par la rareté.
 * Deux notes qui partagent « spectrogramme » sont liées ; deux notes qui
 * partagent « projet » ne le sont pas. D’où la pondération par l’inverse
 * de la fréquence documentaire.
 */
export function tisserLexical({ marge = 1.5, plancher = 0.05, maxParNoeud = 3 } = {}) {
  const g = lire();
  const ids = Object.keys(g.noeuds);
  if (ids.length < 3) return { crees: 0, raison: 'Trop peu de nœuds pour que la rareté ait un sens.' };

  const df = {};
  for (const id of ids) for (const t of g.noeuds[id].termes || []) df[t] = (df[t] || 0) + 1;
  const N = ids.length;
  const idf = (t) => Math.log(1 + N / (1 + (df[t] || 0)));

  const poidsDe = {};
  for (const id of ids) {
    const ts = g.noeuds[id].termes || [];
    const p = {}; let norme = 0;
    for (const t of ts) { const w = idf(t); p[t] = w; norme += w * w; }
    poidsDe[id] = { p, norme: Math.sqrt(norme) || 1 };
  }

  const cos = (a, b) => {
    const A = poidsDe[a], B = poidsDe[b];
    let prod = 0;
    for (const t in A.p) if (B.p[t]) prod += A.p[t] * B.p[t];
    return prod / (A.norme * B.norme);
  };

  /**
   * UN SEUIL ABSOLU NE MARCHE PAS, ET C’EST MESURÉ.
   *
   * Sur un corpus de 16 souvenirs techniques, la meilleure paire était juste
   * — « ffmpeg absent » et « moteur de conversion », à 0,143 — mais la
   * deuxième était fausse : « fréquence dans la bande alpha » et
   * « normalisation en deux passes », à 0,107, qui ne partagent que des mots
   * de méthode. Les deux valeurs sont trop proches pour qu’un seuil les
   * sépare : le baisser créerait autant de faux liens que de vrais.
   *
   * Ce qui les sépare, c’est la MARGE. Un vrai lien se détache nettement du
   * deuxième meilleur candidat du même nœud (1,83 ici), un faux non (1,34).
   * On exige donc que le meilleur candidat soit en avance, et que les deux
   * nœuds se choisissent MUTUELLEMENT — un lien que l’un seul revendique est
   * presque toujours un hasard de vocabulaire.
   *
   * C’est le même raisonnement que pour les cibles SSVEP : ce n’est pas le
   * niveau qui informe, c’est l’écart au reste.
   */
  const classement = {};
  for (const id of ids) {
    const autres = ids.filter(x => x !== id).map(x => ({ id: x, cos: cos(id, x) }))
      .sort((a, b) => b.cos - a.cos);
    classement[id] = autres;
  }

  const retenus = [];
  const rejetes = [];
  for (const id of ids) {
    const liste = classement[id];
    if (!liste.length) continue;
    const premier = liste[0], second = liste[1] || { cos: 0 };
    if (premier.cos < plancher) continue;
    const m = premier.cos / (second.cos + 1e-9);
    if (m < marge) {
      rejetes.push({ de: id, vers: premier.id, cos: +premier.cos.toFixed(3), marge: +m.toFixed(2) });
      continue;
    }
    // Choix mutuel : l’autre doit aussi nous placer en tête.
    const retour = classement[premier.id]?.[0];
    if (!retour || retour.id !== id) {
      rejetes.push({ de: id, vers: premier.id, cos: +premier.cos.toFixed(3), marge: +m.toFixed(2),
        pourquoi: 'choix non réciproque' });
      continue;
    }
    retenus.push({ de: id, vers: premier.id, cos: premier.cos, marge: m });
  }

  const compte = {};
  let crees = 0;
  for (const c of retenus.sort((a, b) => b.cos - a.cos)) {
    if ((compte[c.de] || 0) >= maxParNoeud || (compte[c.vers] || 0) >= maxParNoeud) continue;
    if (g.liens.find(l => (l.de === c.de && l.vers === c.vers) || (l.de === c.vers && l.vers === c.de))) continue;
    g.liens.push({ de: c.de, vers: c.vers, type: 'lexical',
      force: Math.min(0.7, 0.25 + c.cos * 2), usages: 1, cree: Date.now(), dernier: Date.now(),
      pourquoi: `vocabulaire rare commun (${c.cos.toFixed(3)}), en avance ${c.marge.toFixed(1)}× sur le candidat suivant, et choix réciproque` });
    compte[c.de] = (compte[c.de] || 0) + 1;
    compte[c.vers] = (compte[c.vers] || 0) + 1;
    crees++;
  }
  ecrire(g);
  return { crees, examines: ids.length, rejetes: rejetes.length,
    exemplesRejetes: rejetes.sort((a, b) => b.cos - a.cos).slice(0, 3),
    regle: `Un lien n’est créé que si le meilleur candidat est au moins ${marge}× devant le suivant ET que le choix est réciproque. ` +
           `Un seuil absolu laissait passer autant de faux liens que de vrais : mesuré.` };
}

/** ── PROPAGATION D’ACTIVATION ────────────────────────────────────────── */

/**
 * On allume les graines, l’énergie se diffuse en s’atténuant.
 * `attenuation` décide de la portée : 0,5 laisse passer deux à trois sauts,
 * ce qui est le bon ordre pour que des liens surprenants sortent sans que
 * tout le graphe s’allume.
 */
export function propager({ graines = [], attenuation = 0.5, sauts = 3, plancher = 0.02 }) {
  const g = lire();
  const voisins = {};
  for (const l of g.liens) {
    (voisins[l.de] ||= []).push({ id: l.vers, force: l.force, type: l.type });
    (voisins[l.vers] ||= []).push({ id: l.de, force: l.force, type: l.type });
  }

  const activation = {};
  const chemins = {};
  const g2 = g;
  for (const ref of graines) {
    const s = resoudre(ref, g2);
    if (s) { activation[s] = 1; chemins[s] = [s]; }
  }
  if (!Object.keys(activation).length) return { activation: [], raison: 'Aucune graine connue du graphe.' };

  let front = { ...activation };
  for (let saut = 0; saut < sauts; saut++) {
    const suivant = {};
    for (const [id, e] of Object.entries(front)) {
      const sorties = voisins[id] || [];
      if (!sorties.length) continue;
      // L’énergie se divise : un nœud très connecté transmet peu à chacun.
      // Sans cette division, les carrefours deviennent des trous noirs.
      const total = sorties.reduce((s, v) => s + v.force, 0) || 1;
      for (const v of sorties) {
        const recu = e * attenuation * (v.force / total) * sorties.length ** 0.5;
        if (recu < plancher) continue;
        suivant[v.id] = (suivant[v.id] || 0) + recu;
        if (!chemins[v.id] || chemins[v.id].length > (chemins[id] || []).length + 1)
          chemins[v.id] = [...(chemins[id] || [id]), v.id];
      }
    }
    for (const [id, e] of Object.entries(suivant)) activation[id] = (activation[id] || 0) + e;
    front = suivant;
    if (!Object.keys(suivant).length) break;
  }

  const activationGraines = new Set(graines.map(x => resoudre(x, g)).filter(Boolean));
  const liste = Object.entries(activation)
    .filter(([id]) => g.noeuds[id])
    .map(([id, e]) => ({
      id, activation: +e.toFixed(4),
      graine: activationGraines.has(id),
      type: g.noeuds[id].type, titre: g.noeuds[id].titre,
      confiance: g.noeuds[id].confiance,
      sauts: Math.max(0, (chemins[id] || [id]).length - 1),
      chemin: (chemins[id] || [id]).map(x => g.noeuds[x]?.titre || x)
    }))
    .sort((a, b) => b.activation - a.activation);

  return { activation: liste, graines, attenuation, sauts };
}

/**
 * DÉCOUVRIR — la fonction qui justifie tout le reste.
 *
 * On cherche les paires que la structure rapproche fortement par plusieurs
 * chemins indirects, alors qu’aucun lien direct ne les unit. Personne ne les
 * a saisies : c’est le graphe qui les révèle. Ce sont des pistes à instruire,
 * jamais des conclusions.
 */
export function decouvrir({ minimum = 0.05, limite = 12 } = {}) {
  const g = lire();
  const ids = Object.keys(g.noeuds);
  if (ids.length < 4) return { liens: [], raison: 'Il faut au moins quatre nœuds pour qu’un lien indirect existe.' };

  const direct = new Set();
  for (const l of g.liens) { direct.add(l.de + '|' + l.vers); direct.add(l.vers + '|' + l.de); }

  const trouves = [];
  for (const source of ids) {
    const { activation } = propager({ graines: [source], attenuation: 0.55, sauts: 3 });
    for (const a of activation) {
      if (a.id === source || a.graine) continue;
      if (direct.has(source + '|' + a.id)) continue;      // déjà relié : rien à découvrir
      if (a.activation < minimum) continue;
      if (a.sauts < 2) continue;                           // un seul saut n’est pas une découverte
      const cle = [source, a.id].sort().join('|');
      if (trouves.some(t => t.cle === cle)) continue;
      trouves.push({
        cle, de: source, vers: a.id,
        deTitre: g.noeuds[source].titre, versTitre: g.noeuds[a.id].titre,
        deType: g.noeuds[source].type, versType: g.noeuds[a.id].type,
        affinite: a.activation, sauts: a.sauts,
        parQuoi: a.chemin.slice(1, -1),
        lecture: `« ${g.noeuds[source].titre} » et « ${g.noeuds[a.id].titre} » ne sont pas reliés, ` +
                 `mais ${a.sauts} sauts les rapprochent en passant par ${a.chemin.slice(1, -1).map(x => `« ${x} »`).join(', ') || 'un intermédiaire'}. Piste à instruire.`
      });
    }
  }
  trouves.sort((a, b) => b.affinite - a.affinite);
  return { liens: trouves.slice(0, limite), examines: ids.length };
}

/** ── ENTRETIEN ───────────────────────────────────────────────────────── */

/**
 * Consolidation. Sans elle, le graphe relie tout à tout et ne dit plus rien.
 * Oubli des liens inutilisés, fusion des quasi-doublons, élagage du faible.
 */
export function consolider({ demiVieJours = 45, forceMin = 0.08, fusionSeuil = 0.86 } = {}) {
  const g = lire();
  const maintenant = Date.now();
  const bilan = { affaiblis: 0, elagues: 0, fusionnes: 0, orphelins: 0 };

  // 1. Oubli : un lien non réutilisé perd la moitié de sa force par demi-vie.
  for (const l of g.liens) {
    const jours = (maintenant - (l.dernier || l.cree || maintenant)) / 86400000;
    if (jours > 1) {
      const avant = l.force;
      l.force = l.force * Math.pow(0.5, jours / demiVieJours);
      if (l.force < avant - 0.001) bilan.affaiblis++;
    }
  }

  // 2. Élagage.
  const avantEl = g.liens.length;
  g.liens = g.liens.filter(l => l.force >= forceMin || l.usages > 3);
  bilan.elagues = avantEl - g.liens.length;

  // 3. Fusion des quasi-doublons de même type.
  const ids = Object.keys(g.noeuds);
  const fusions = {};
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = g.noeuds[ids[i]], b = g.noeuds[ids[j]];
      if (!a || !b || a.type !== b.type) continue;
      const ta = new Set(a.termes || []), tb = new Set(b.termes || []);
      if (!ta.size || !tb.size) continue;
      const inter = [...ta].filter(x => tb.has(x)).length;
      const jaccard = inter / (ta.size + tb.size - inter);
      if (jaccard >= fusionSeuil) {
        // On garde le plus ancien et le plus lourd.
        const [garde, perdu] = a.poids >= b.poids ? [a, b] : [b, a];
        fusions[perdu.id] = garde.id;
        garde.poids = Math.min(10, garde.poids + perdu.poids * 0.5);
        garde.vu = (garde.vu || 0) + (perdu.vu || 0);
        if ((perdu.texte || '').length > (garde.texte || '').length) garde.texte = perdu.texte;
        garde.sources = [...new Set([...(garde.sources || []), ...(perdu.sources || [])])];
        delete g.noeuds[perdu.id];
        bilan.fusionnes++;
      }
    }
  }
  if (bilan.fusionnes) {
    for (const l of g.liens) { if (fusions[l.de]) l.de = fusions[l.de]; if (fusions[l.vers]) l.vers = fusions[l.vers]; }
    g.liens = g.liens.filter(l => l.de !== l.vers && g.noeuds[l.de] && g.noeuds[l.vers]);
  }

  // 4. Liens pointant dans le vide.
  const avantOrph = g.liens.length;
  g.liens = g.liens.filter(l => g.noeuds[l.de] && g.noeuds[l.vers]);
  bilan.orphelins = avantOrph - g.liens.length;

  g.consolide = new Date().toISOString();
  ecrire(g);
  return { ...bilan, noeuds: Object.keys(g.noeuds).length, liens: g.liens.length,
    lecture: `${bilan.fusionnes} doublon(s) fusionné(s), ${bilan.elagues} lien(s) élagué(s), ${bilan.affaiblis} affaibli(s) par le temps.` };
}

/** ── LECTURE ─────────────────────────────────────────────────────────── */

export function etat() {
  const g = lire();
  const ids = Object.keys(g.noeuds);
  const parType = {};
  for (const id of ids) parType[g.noeuds[id].type] = (parType[g.noeuds[id].type] || 0) + 1;
  const degre = {};
  for (const l of g.liens) { degre[l.de] = (degre[l.de] || 0) + 1; degre[l.vers] = (degre[l.vers] || 0) + 1; }
  const carrefours = Object.entries(degre).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, d]) => ({ id, titre: g.noeuds[id]?.titre, liens: d, type: g.noeuds[id]?.type }));

  return {
    noeuds: ids.length, liens: g.liens.length, parType,
    densite: ids.length > 1 ? +(g.liens.length / (ids.length * (ids.length - 1) / 2)).toFixed(4) : 0,
    activations: g.activations || 0,
    consolide: g.consolide,
    isoles: ids.filter(i => !degre[i]).length,
    carrefours,
    lecture: ids.length
      ? `${ids.length} nœuds, ${g.liens.length} liens. ${ids.filter(i => !degre[i]).length} nœud(s) isolé(s).` +
        (carrefours[0] ? ` Le carrefour principal est « ${carrefours[0].titre} » avec ${carrefours[0].liens} liens.` : '')
      : 'Le graphe est vide. Il se remplit en travaillant : chaque objectif, leçon et résultat y entre.'
  };
}

export function voisinage(ref, profondeur = 1) {
  const g = lire();
  const id = resoudre(ref, g);
  if (!id) throw new Error(`Nœud inconnu : ${ref}`);
  const vus = new Set([id]);
  let front = [id];
  const liens = [];
  for (let d = 0; d < profondeur; d++) {
    const suivant = [];
    for (const n of front) {
      for (const l of g.liens) {
        if (l.de !== n && l.vers !== n) continue;
        const autre = l.de === n ? l.vers : l.de;
        if (!g.noeuds[autre]) continue;
        liens.push({ de: l.de, vers: l.vers, type: l.type, force: +l.force.toFixed(3), pourquoi: l.pourquoi });
        if (!vus.has(autre)) { vus.add(autre); suivant.push(autre); }
      }
    }
    front = suivant;
  }
  return {
    centre: g.noeuds[id],
    noeuds: [...vus].map(i => g.noeuds[i]).filter(Boolean),
    liens: liens.filter((l, i, t) => t.findIndex(x => x.de === l.de && x.vers === l.vers && x.type === l.type) === i)
  };
}

/** Bloc de contexte pour l’amorce d’un agent : ce que la mémoire remonte. */
export function contexteAssociatif(texte, { limite = 8 } = {}) {
  const g = lire();
  const ids = Object.keys(g.noeuds);
  if (!ids.length) return '';
  const ts = new Set(termes(texte));
  if (!ts.size) return '';

  const scores = ids.map(id => {
    const n = g.noeuds[id];
    const inter = (n.termes || []).filter(t => ts.has(t)).length;
    return { id, score: inter / Math.sqrt((n.termes || []).length || 1) };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  if (!scores.length) return '';
  const { activation } = propager({ graines: scores.map(s => s.id), attenuation: 0.5, sauts: 2 });
  const retenus = activation.slice(0, limite);
  if (!retenus.length) return '';

  return retenus.map(a => {
    const n = g.noeuds[a.id];
    const marque = { verifie: '[vérifié]', probable: '[probable]', hypothese: '[hypothèse]' }[n.confiance] || '';
    return `— ${marque} ${n.type} · ${n.titre}${n.texte ? ` : ${n.texte.slice(0, 180)}` : ''}` +
           (a.graine ? '' : ` (remonté par association, ${a.sauts} saut${a.sauts > 1 ? 's' : ''})`);
  }).join('\n');
}

export function oublier(ref) {
  const g = lire();
  const id = resoudre(ref, g);
  if (!id) throw new Error(`Nœud inconnu : ${ref}`);
  const titre = g.noeuds[id].titre;
  delete g.noeuds[id];
  const avant = g.liens.length;
  g.liens = g.liens.filter(l => l.de !== id && l.vers !== id);
  ecrire(g);
  return { oublie: id, titre, liensRetires: avant - g.liens.length };
}

export function vider() { return ecrire(structuredClone(VIDE)); }
export function brut() { return lire(); }
