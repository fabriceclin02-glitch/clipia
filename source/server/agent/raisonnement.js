/**
 * CLIPIA — Raisonnement.
 *
 * Quatre facultés qui manquent à un simple enchaînement d'outils :
 *   planifier    — décomposer avant d'agir, et prévoir les écueils
 *   ameliorer    — réécrire un prompt vague en consigne exploitable
 *   diagnostiquer— comprendre un échec et proposer une autre voie
 *   critiquer    — juger son propre résultat et dire quoi reprendre
 *
 * Les échecs compris sont retenus : la même erreur ne se répète pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chat } from '../providers/gateway.js';
import { DATA_DIR } from '../lib/env.js';
import { memoire } from '../memoire/index.js';

const LECONS = path.join(DATA_DIR, 'lecons.json');

function lireLecons() {
  if (!fs.existsSync(LECONS)) return [];
  try { return JSON.parse(fs.readFileSync(LECONS, 'utf8')); } catch { return []; }
}
export function lecons() { return lireLecons(); }
export function enregistrerLecon(contexte, lecon) {
  const l = lireLecons();
  const t = String(lecon).trim().slice(0, 300);
  if (!t || l.some(x => x.lecon.toLowerCase() === t.toLowerCase())) return l;
  l.push({ id: 'l_' + Math.random().toString(36).slice(2, 9), contexte: String(contexte).slice(0, 120),
    lecon: t, le: new Date().toISOString() });
  const garde = l.slice(-80);
  fs.writeFileSync(LECONS, JSON.stringify(garde, null, 2));
  return garde;
}
export function oublierLecon(id) {
  const l = lireLecons().filter(x => x.id !== id);
  fs.writeFileSync(LECONS, JSON.stringify(l, null, 2));
  return l;
}
export function contexteLecons() {
  const l = lireLecons().slice(-14);
  return l.length ? `\n\nLEÇONS DES FOIS PRÉCÉDENTES — n'y retombez pas :\n${l.map(x => `- ${x.lecon}`).join('\n')}\n` : '';
}

const json1 = t => { const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('Réponse non exploitable.'); return JSON.parse(m[0]); };

/** ── PLANIFIER ──────────────────────────────────────────────────────── */
export async function planifier({ objectif, provider, model, capacites = {}, etatStudio = '' }) {
  const system = `Tu es un chef de production méthodique. Tu réponds UNIQUEMENT en JSON valide.`;
  const prompt = `Objectif : ${objectif}

Moyens réellement disponibles :
${etatStudio}

Capacités mobilisables : ${Object.keys(capacites).join(', ')}
${memoire.contexte()}${contexteLecons()}
Produis un plan. Pour chaque étape, dis ce qu'elle produit concrètement.
Signale les risques sérieux, et ce qui te manque pour réussir.

{"lecture":"ce que la demande veut vraiment, en une phrase",
 "etapes":[{"n":1,"quoi":"...","capacite":"clip|image|...","produit":"le fichier ou le texte obtenu","risque":"ce qui peut rater"}],
 "manques":["ce qui est indispensable et absent"],
 "alternative":"une autre façon de s'y prendre si la première échoue",
 "duree":"estimation honnête"}`;

  const r = await chat(provider, { model, system, messages: [{ role: 'user', content: prompt }],
    temperature: 0.4, maxTokens: 2200 });
  return json1(r.text);
}

/** ── AMÉLIORER UN PROMPT ────────────────────────────────────────────── */
const METIER = {
  image: `Un bon prompt d'image nomme : le sujet, le cadrage, la lumière, la matière, la palette, le style, l'ambiance. Il écarte ce qui n'est pas voulu. Il reste en anglais, les moteurs y répondent mieux.`,
  video: `Un bon prompt vidéo ajoute le mouvement : celui du sujet, celui de la caméra, le rythme. Une seule action par plan.`,
  musique: `Un bon prompt musical nomme : le genre, le tempo, les instruments, l'ambiance, la structure, la référence sonore.`,
  texte: `Un bon prompt de texte fixe : le rôle, le destinataire, le ton, la longueur, le format attendu, et ce qu'il faut éviter.`,
  code: `Un bon prompt de code précise : le langage, les contraintes, les entrées et sorties, les cas limites, et le critère de réussite.`
};

export async function ameliorer({ brut, medium = 'image', provider, model, intention = '' }) {
  const system = `Tu réécris des consignes pour qu'elles donnent de meilleurs résultats. Tu réponds UNIQUEMENT en JSON.`;
  const prompt = `Voici une demande telle qu'elle a été écrite :
« ${brut} »

${METIER[medium] || METIER.texte}
${intention ? `\nContexte : ${intention}` : ''}${memoire.contexte()}

Réécris-la en trois versions, de la plus fidèle à la plus audacieuse.
Explique en une phrase ce qui manquait à l'originale.

{"manquait":"...",
 "versions":[{"nom":"fidèle","prompt":"...","pourquoi":"..."},
             {"nom":"enrichie","prompt":"...","pourquoi":"..."},
             {"nom":"audacieuse","prompt":"...","pourquoi":"..."}],
 "aEviter":"ce qu'il vaut mieux exclure du rendu"}`;

  const r = await chat(provider, { model, system, messages: [{ role: 'user', content: prompt }],
    temperature: 0.8, maxTokens: 1800 });
  return json1(r.text);
}

/** ── DIAGNOSTIQUER UN ÉCHEC ─────────────────────────────────────────── */
export async function diagnostiquer({ tache, payload, erreur, objectif, provider, model, etatStudio = '' }) {
  const system = `Tu diagnostiques des échecs techniques. Tu es direct et tu ne supposes rien. Tu réponds UNIQUEMENT en JSON.`;
  const prompt = `Une étape a échoué.

Objectif général : ${objectif}
Étape : ${tache}
Paramètres : ${JSON.stringify(payload).slice(0, 700)}
Erreur : ${String(erreur).slice(0, 900)}

Moyens disponibles :
${etatStudio}
${contexteLecons()}
Dis la cause la plus probable, puis une correction précise et applicable.
Si c'est un moyen manquant, dis-le franchement plutôt que d'inventer un contournement.

{"cause":"...",
 "reparable":true,
 "correction":{"capacite":"...","payload":{}},
 "explication":"ce que vous changez et pourquoi",
 "lecon":"la règle à retenir pour la prochaine fois, en une phrase"}`;

  const r = await chat(provider, { model, system, messages: [{ role: 'user', content: prompt }],
    temperature: 0.3, maxTokens: 1400 });
  const d = json1(r.text);
  if (d.lecon) enregistrerLecon(tache, d.lecon);
  return d;
}

/** ── CRITIQUER SON PROPRE RÉSULTAT ──────────────────────────────────── */
export async function critiquer({ objectif, resultat, provider, model }) {
  const system = `Tu juges un travail avec exigence mais sans mauvaise foi. Tu réponds UNIQUEMENT en JSON.`;
  const prompt = `Objectif demandé : ${objectif}

Ce qui a été produit :
${typeof resultat === 'string' ? resultat.slice(0, 2500) : JSON.stringify(resultat).slice(0, 2500)}

L'objectif est-il atteint ? Sois précis : ce qui va, ce qui ne va pas, et ce qu'il faut refaire.
Ne complimente pas pour complimenter.

{"atteint":true,
 "note":7,
 "reussi":["..."],
 "manque":["..."],
 "aRefaire":[{"quoi":"...","comment":"..."}],
 "verdict":"une phrase franche"}`;

  const r = await chat(provider, { model, system, messages: [{ role: 'user', content: prompt }],
    temperature: 0.3, maxTokens: 1400 });
  return json1(r.text);
}
