/**
 * CLIPIA — Apprendre sans qu’on le demande.
 *
 * La différence entre un cerveau qui PEUT apprendre et un cerveau qui
 * apprend tient à une seule chose : est-ce que quelqu’un doit penser à
 * l’alimenter ? Si oui, il reste vide — parce qu’on travaille, et qu’on ne
 * pense pas à nourrir sa mémoire pendant qu’on travaille.
 *
 * Ce module se greffe donc sur le passage obligé : la file de travaux. Tout
 * ce qui s’exécute dans Clipia y passe. Chaque tâche qui réussit dépose un
 * résultat, chaque tâche qui échoue dépose une erreur, et les deux tissent
 * des liens dans le graphe. Personne n’a rien à faire.
 *
 * Deux principes qui évitent que la mémoire devienne une poubelle :
 *
 *  1. ON NE RETIENT PAS TOUT. Une tâche banale qui réussit comme d’habitude
 *     n’apprend rien. On retient ce qui surprend : les échecs, les premières
 *     fois, les durées anormales, les corrections. C’est aussi ce que fait
 *     un cerveau — l’habitude ne laisse pas de souvenir.
 *
 *  2. LA PREUVE VIENT DU RÉEL. Un fichier produit par une tâche donne une
 *     preuve de fichier, construite en lisant le disque. Jamais une
 *     déclaration de réussite : le journal la refuserait, et il aurait raison.
 */
import fs from 'node:fs';
import { journal, preuveFichier, preuveMesure } from './journal.js';
import * as graphe from './graphe.js';
import { observer } from '../jobs/queue.js';
import { store } from '../lib/store.js';

/** Une durée lisible : « 61 ms » plutôt que « 0 s », qui ne dit rien. */
const lisible = (ms) => ms < 2000 ? `${Math.round(ms)} ms`
  : ms < 90000 ? `${(ms / 1000).toFixed(1)} s`
  : `${Math.round(ms / 60000)} min`;

/** Durées de référence, apprises au fil de l’eau : sert à repérer l’anormal. */
const REF = 'cerveau:durees';

function referenceDuree(type, ms) {
  const d = store.setting(REF) || {};
  const e = d[type] || { n: 0, moyenne: 0, max: 0 };
  const avant = e.moyenne;
  e.moyenne = (e.moyenne * e.n + ms) / (e.n + 1);
  e.n++;
  e.max = Math.max(e.max, ms);
  d[type] = e;
  store.setting(REF, d);
  // Anormal : plus de trois fois la moyenne, après au moins quatre passages.
  return { moyenne: Math.round(e.moyenne), n: e.n, avant: Math.round(avant),
    anormal: e.n > 4 && ms > e.moyenne * 3 };
}

/** Les fichiers réellement produits par une tâche, vérifiés sur le disque. */
function preuvesDe(resultat) {
  const preuves = [];
  const candidats = [];
  const fouiller = (o, p = 0) => {
    if (!o || p > 3) return;
    if (typeof o === 'string') { if (/^[/A-Za-z]:?[\\/].+\.\w{2,5}$/.test(o)) candidats.push(o); return; }
    if (Array.isArray(o)) { for (const x of o.slice(0, 20)) fouiller(x, p + 1); return; }
    if (typeof o === 'object') {
      for (const [k, val] of Object.entries(o)) {
        if (/^(file|fichier|chemin|path|sortie)$/i.test(k) && typeof val === 'string') candidats.push(val);
        else fouiller(val, p + 1);
      }
    }
  };
  fouiller(resultat);
  for (const c of [...new Set(candidats)].slice(0, 5)) {
    try { if (fs.existsSync(c) && fs.statSync(c).isFile()) preuves.push(preuveFichier(c)); } catch { /* ignoré */ }
  }
  return preuves;
}

/**
 * Décide si un événement mérite une trace. C’est le filtre qui garde la
 * mémoire utile : sans lui, le graphe se remplit de « conversion réussie »
 * et ne dit plus rien de personne.
 */
function meriteTrace({ type, echec, ms, duree, premiere }) {
  if (echec) return { oui: true, pourquoi: 'un échec apprend toujours quelque chose' };
  if (premiere) return { oui: true, pourquoi: `première réussite d’une tâche « ${type} »` };
  if (duree?.anormal) return { oui: true,
    pourquoi: `durée anormale : ${lisible(ms)} contre ${lisible(duree.moyenne)} en moyenne sur ${duree.n} passage(s)` };
  return { oui: false, pourquoi: 'réussite ordinaire : rien de neuf à retenir' };
}

/** Les types de tâches déjà vus : sert à repérer les premières fois. */
const VUS = 'cerveau:types-vus';

export function brancher() {
  const deja = store.setting('cerveau:branche');
  if (deja) return { deja: true, depuis: deja };

  observer((job) => {
    try { traiter(job); } catch { /* l’apprentissage ne doit jamais casser une tâche */ }
  });

  store.setting('cerveau:branche', new Date().toISOString());
  return { branche: true,
    quoi: 'Chaque tâche qui passe par la file alimente désormais le journal et la mémoire associative. ' +
          'Seuls les échecs, les premières fois et les durées anormales laissent une trace : une réussite ' +
          'ordinaire n’apprend rien, et une mémoire qui retient tout ne dit plus rien.' };
}

/** Pour ne consigner qu'une fois par tâche, même si la file réémet. */
const traites = new Set();

function traiter(j) {
  if (!j?.id || !j.type) return;
  // La file travaille en français dans ses états : « terminé » ou « échec ».
  if (j.status !== 'terminé' && j.status !== 'échec') return;
  if (traites.has(j.id)) return;
  traites.add(j.id);
  if (traites.size > 400) traites.delete(traites.values().next().value);

  const type = j.type;
  const echec = j.status === 'échec';
  const ms = j.finishedAt && j.startedAt ? new Date(j.finishedAt) - new Date(j.startedAt) : 0;
  const duree = ms ? referenceDuree(type, ms) : null;

  const vus = store.setting(VUS) || {};
  const premiere = !echec && !vus[type];
  if (!echec) { vus[type] = (vus[type] || 0) + 1; store.setting(VUS, vus); }

  const verdict = meriteTrace({ type, echec, ms, duree, premiere });
  if (!verdict.oui) return;

  if (echec) {
    const message = String(j.error || 'échec sans message').slice(0, 400);
    journal.erreur({
      quoi: `${type} : ${message.split('\n')[0].slice(0, 140)}`,
      cause: message, corrigee: false
    });
    // L’outil et le type de tâche se reliént à l’erreur : c’est ce lien qui,
    // plus tard, fera remonter « ça ressemble à ce qui a déjà cassé ».
    try {
      graphe.ajouter({ type: 'erreur', titre: `${type} en échec`, texte: message.slice(0, 400),
        confiance: 'verifie', source: `tache:${j.id}` });
      graphe.ajouter({ type: 'outil', titre: `tâche ${type}`, texte: `Type de travail exécuté par Clipia.`,
        confiance: 'verifie' });
      graphe.coActiver([`${type} en échec`, `tâche ${type}`], `échec de ${type}`);
    } catch { /* bonus */ }
    return;
  }

  // Réussite notable : on la consigne avec les preuves réelles du disque.
  const preuves = preuvesDe(j.result);
  if (duree) preuves.push(preuveMesure({ quoi: `durée de ${type}`, valeur: Math.round(ms), unite: 'ms',
    methode: 'écart entre le début et la fin du travail, horodaté par la file' }));

  journal.test({
    quoi: `${type} — ${verdict.pourquoi}`,
    attendu: 'tâche menée à son terme',
    obtenu: preuves.length > 1 ? `${preuves.length - 1} fichier(s) produit(s) en ${lisible(ms)}`
                               : `terminée en ${lisible(ms)}`,
    reussi: true, preuves
  });

  try {
    const methode = `tâche ${type}`;
    graphe.ajouter({ type: 'methode', titre: methode,
      texte: `Fonctionne. Durée moyenne ${lisible(duree?.moyenne || ms)} sur ${duree?.n || 1} passage(s).`,
      confiance: 'verifie', source: `tache:${j.id}` });

    const resultat = `${type} — ${verdict.pourquoi}`.slice(0, 140);
    graphe.ajouter({ type: 'resultat', titre: resultat,
      texte: `${preuves.length} preuve(s). ${lisible(ms)}.`, confiance: 'verifie', source: `tache:${j.id}` });

    // Le résultat vient de la méthode : lien causal, pas simple voisinage.
    graphe.relier({ de: methode, vers: resultat, type: 'cause', pourquoi: 'la méthode a produit ce résultat' });

    // Un échec passé du même type éclaire la réussite d’aujourd’hui.
    graphe.coActiver([methode, resultat, `${type} en échec`], `passage de ${type}`);
  } catch { /* bonus */ }
}

/**
 * Entretien périodique : consolider la mémoire et rouvrir les preuves.
 * À appeler de loin en loin, pas à chaque tâche — la consolidation est un
 * travail de fond, comme le sommeil.
 */
export function entretenir() {
  const v = journal.verifier();
  const c = graphe.consolider();
  const t = graphe.tisserLexical();
  return { verification: v, consolidation: c, tissage: t,
    lecture: `${v.lecture} ${c.lecture} ${t.crees} lien(s) tissé(s) par vocabulaire.` };
}

/**
 * Amorce la mémoire avec ce qui est déjà connu de l’application : les leçons
 * déjà enregistrées et les erreurs du journal existant. Sans cela, le graphe
 * démarre vide alors que l’expérience existe déjà ailleurs.
 */
export function amorcer({ lecons = [], faits = [] } = {}) {
  let n = 0;
  for (const l of lecons) {
    try {
      graphe.ajouter({ type: 'lecon', titre: String(l.lecon || l).slice(0, 140),
        texte: String(l.contexte || '').slice(0, 400), confiance: 'verifie', source: 'lecons' });
      n++;
    } catch { /* titre vide */ }
  }
  for (const f of faits) {
    try {
      graphe.ajouter({ type: f.type || 'fait', titre: String(f.titre).slice(0, 140),
        texte: String(f.texte || '').slice(0, 600), confiance: f.confiance || 'verifie', source: f.source || 'amorce' });
      n++;
    } catch { /* titre vide */ }
  }
  const t = graphe.tisserLexical();
  return { ajoutes: n, liens: t.crees, graphe: graphe.etat() };
}

export function etatApprentissage() {
  const durees = store.setting(REF) || {};
  const vus = store.setting(VUS) || {};
  return {
    branche: store.setting('cerveau:branche') || null,
    typesConnus: Object.keys(vus).length,
    passages: Object.values(vus).reduce((s, x) => s + x, 0),
    durees: Object.entries(durees).map(([type, d]) => ({
      type, passages: d.n, moyenneSecondes: +(d.moyenne / 1000).toFixed(1),
      maxSecondes: +(d.max / 1000).toFixed(1) })).sort((a, b) => b.passages - a.passages),
    quoi: Object.keys(vus).length
      ? `${Object.keys(vus).length} type(s) de tâche connu(s), ${Object.values(vus).reduce((s, x) => s + x, 0)} passage(s). ` +
        `Clipia connaît maintenant la durée normale de chacun, donc il peut repérer l’anormal.`
      : 'Aucune tâche encore passée. La mémoire se remplira en travaillant.'
  };
}
