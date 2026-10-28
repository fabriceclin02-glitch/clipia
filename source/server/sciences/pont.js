/**
 * CLIPIA — Le pont : du satellite jusqu’au cerveau humain.
 *
 * La chaîne complète, maillon par maillon, avec ce qui est vrai à chaque étape :
 *
 *   [machine] → [satellite ou radio] → [son] → [oreille] → [cerveau]
 *       réel          réel             réel      réel      ← ici, la limite
 *
 * Ce qui est possible, et que ce module fait vraiment :
 *   un seul fichier son porte TROIS couches superposées :
 *
 *   COUCHE 1 — DONNÉES (1200 / 2200 Hz)  → lue par la machine, exactement
 *              Le texte en FSK. Une autre machine le récupère au caractère près.
 *
 *   COUCHE 2 — SENS (100 à 900 Hz)       → perçue par l’humain, immédiatement
 *              Sonification : l’urgence devient tempo, la nature du message
 *              devient timbre et mode, l’intensité devient hauteur. On entend
 *              « c’est urgent et c’est une alerte » avant de comprendre un mot.
 *              C’est exactement ce que fait un moniteur cardiaque, ou une sirène.
 *
 *   COUCHE 3 — ÉTAT (respiration, bruit) → agit sur le corps, mesurablement
 *              Le lit respiratoire qui ralentit ou soutient l’attention.
 *
 * Ce qui n’est PAS possible, et qu’aucun algorithme ne changera :
 *   un son ne dépose pas d’information directement dans un cerveau. Il n’existe
 *   pas de clé qui transformerait une musique en pensée reçue. Le son passe par
 *   l’oreille, puis par la perception, puis par le sens — et le sens s’apprend.
 *
 * Donc la couche 2 est un LANGAGE, pas une injection. Elle se comprend d’abord
 * d’instinct (grave et lent = calme ; aigu et rapide = urgent), et se lit
 * finement après entraînement — comme un opérateur radio lit le morse. C’est
 * la seule voie honnête entre une machine et un cerveau par le son, et elle
 * fonctionne : c’est celle des pilotes, des anesthésistes et des sonars.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';
import { env, ffmpegBin } from '../lib/env.js';
import { moduler, demoduler, VOIES } from './liaison.js';

const FFMPEG = () => ffmpegBin();
const e = (s) => String(s).replace(/,/g, '\\,');

/** ── LE LANGAGE SONORE ──────────────────────────────────────────────── */

/** Chaque nature de message a son empreinte : on la reconnaît sans réfléchir. */
export const NATURES = {
  alerte:    { nom:'Alerte',    notes:[233.08, 277.18, 329.63], mode:'mineur tendu',
               timbre:'carré', signature:'trois notes qui montent, serrées', instinct:'tension immédiate' },
  demande:   { nom:'Demande',   notes:[220.00, 293.66, 220.00], mode:'suspensif',
               timbre:'triangle', signature:'aller-retour qui reste ouvert', instinct:'attente, question' },
  reponse:   { nom:'Réponse',   notes:[261.63, 329.63, 392.00], mode:'majeur',
               timbre:'sinus', signature:'accord qui se referme', instinct:'résolution, c’est fait' },
  position:  { nom:'Position',  notes:[196.00, 196.00, 293.66], mode:'ouvert',
               timbre:'sinus', signature:'deux notes tenues puis une quinte', instinct:'repère, balise' },
  mesure:    { nom:'Mesure',    notes:[174.61, 261.63, 174.61], mode:'neutre',
               timbre:'triangle', signature:'symétrique, sans direction', instinct:'donnée froide' },
  detresse:  { nom:'Détresse',  notes:[311.13, 207.65, 311.13, 207.65], mode:'quinte diminuée',
               timbre:'carré', signature:'bascule insistante, deux tons qui refusent de s’accorder', instinct:'alarme, on ne peut pas l’ignorer' }
};

/** L’urgence se lit au tempo. Six paliers, nettement séparés à l’oreille. */
export const URGENCES = [
  { n:0, nom:'veille',    bpm: 40, instinct:'rien ne presse' },
  { n:1, nom:'routine',   bpm: 60, instinct:'information ordinaire' },
  { n:2, nom:'attention', bpm: 84, instinct:'à regarder bientôt' },
  { n:3, nom:'pressant',  bpm:112, instinct:'maintenant' },
  { n:4, nom:'urgent',    bpm:144, instinct:'tout de suite' },
  { n:5, nom:'critique',  bpm:184, instinct:'on lâche tout' }
];

const TIMBRES = {
  sinus:    (f) => `sin(2*PI*${f}*t)`,
  triangle: (f) => `(2/PI)*asin(sin(2*PI*${f}*t))`,
  carre:    (f) => `(0.6*sin(2*PI*${f}*t)+0.2*sin(2*PI*${3 * f}*t)+0.12*sin(2*PI*${5 * f}*t))`
};
const timbre = (nom, f) => (TIMBRES[nom === 'carré' ? 'carre' : nom] || TIMBRES.sinus)(f);

/**
 * Compose le son à trois couches.
 * Le résultat est UN fichier : la machine y lit le texte exact, l’humain y
 * entend la nature et l’urgence, et son corps reçoit le lit respiratoire.
 */
export async function composer({
  texte, nature = 'reponse', urgence = 2, intensite = 0.5,
  respiration = true, voie = 'audio', repetitions = 2
}) {
  const nat = NATURES[nature];
  if (!nat) throw new Error(`Nature inconnue : ${nature}. Choisir parmi ${Object.keys(NATURES).join(', ')}.`);
  const urg = URGENCES[Math.max(0, Math.min(5, Math.round(urgence)))];

  // ── Couche 1 : les données. On la fabrique d’abord.
  const donnees = moduler(texte);

  // ── Couche 2 : le sens. Motif rythmique sur les notes de la nature.
  const battement = 60 / urg.bpm;
  const transposition = 1 + (intensite - 0.5) * 0.5;      // l’intensité monte la hauteur
  const motifs = [];
  for (let r = 0; r < Math.max(1, repetitions); r++) {
    nat.notes.forEach((f, i) => {
      motifs.push({ note: f * transposition, debut: (r * nat.notes.length + i) * battement, duree: battement * 0.85 });
    });
    motifs.push({ note: 0, debut: (r * nat.notes.length + nat.notes.length) * battement, duree: battement * 1.6 });
  }
  const finMotif = motifs[motifs.length - 1].debut + motifs[motifs.length - 1].duree;

  /**
   * La durée doit couvrir le motif ET la couche de données qui le suit.
   * Un tempo lent allonge le motif, donc décale les données d’autant : sans
   * ce calcul, le fichier se termine avant la fin de la trame et la machine
   * ne peut plus la relire. Bug trouvé en cliquant dans l’interface, pas en
   * relisant le code.
   */
  const duree = Math.ceil(finMotif + donnees.detail.secondes) + 2;

  const args = ['-y'];
  const graphe = [];
  let n = 0;

  // Les données entrent comme fichier, décalées pour laisser la phrase sonore s’annoncer.
  args.push('-i', donnees.file);
  const iD = n++;
  graphe.push(`[${iD}:a]volume=0.34,adelay=${Math.round(finMotif * 1000)}|${Math.round(finMotif * 1000)},` +
              `aformat=channel_layouts=stereo[data]`);

  // Chaque note du motif : une impulsion avec attaque et chute douces.
  const voix = [];
  for (const mo of motifs.filter(x => x.note)) {
    const t0 = mo.debut.toFixed(3), d = mo.duree.toFixed(3);
    const env2 = `pow(sin(PI*(t-${t0})/${d}),1.6)`;
    const expr = `${(0.26 * (0.6 + intensite * 0.5)).toFixed(3)}*if(between(t,${t0},${(mo.debut + mo.duree).toFixed(3)}),${env2}*${timbre(nat.timbre, mo.note.toFixed(2))},0)`;
    args.push('-f','lavfi','-i',`aevalsrc=${e(expr)}:d=${duree}:s=48000`);
    graphe.push(`[${n}:a]aformat=channel_layouts=stereo[v${n}]`);
    voix.push(`[v${n}]`); n++;
  }

  // ── Couche 3 : l’état. Lit respiratoire 6/min + bruit doux, sous tout le reste.
  let lit = '';
  if (respiration) {
    const T = 10, ti = 5;
    const envR = `if(lt(mod(t,${T}),${ti}),pow(sin(PI/2*mod(t,${T})/${ti}),2),pow(sin(PI/2*max(0,1-(mod(t,${T})-${ti})/${T - ti})),2))`;
    args.push('-f','lavfi','-i',`aevalsrc=${e(`0.09*(${envR})*sin(2*PI*110*t)`)}:d=${duree}:s=48000`);
    graphe.push(`[${n}:a]aformat=channel_layouts=stereo[resp]`); n++;
    args.push('-f','lavfi','-i',`anoisesrc=d=${duree}:c=pink:r=48000:a=0.05`);
    graphe.push(`[${n}:a]lowpass=f=900,aformat=channel_layouts=stereo[bed]`); n++;
    lit = '[resp][bed]';
  }

  const entrees = ['[data]', ...voix, lit].filter(Boolean).join('');
  const nb = 1 + voix.length + (respiration ? 2 : 0);
  graphe.push(`${entrees}amix=inputs=${nb}:duration=longest:normalize=0,` +
              `alimiter=limit=0.9,afade=t=in:d=0.4,afade=t=out:st=${(duree - 1.2).toFixed(2)}:d=1.2,` +
              `aformat=sample_fmts=s16:channel_layouts=stereo[out]`);

  const sortie = path.join(MEDIA_DIR, `${uid('pont')}.wav`);
  args.push('-filter_complex', graphe.join(';'), '-map','[out]','-c:a','pcm_s16le', sortie);
  const r = spawnSync(FFMPEG(), args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('Composition impossible : ' + String(r.stderr).slice(-400));

  const st = fs.statSync(sortie);
  const transport = VOIES.find(v => v.id === voie) || VOIES[0];

  return store.insert('assets', {
    file: sortie, ext: 'wav', bytes: st.size, kind: 'pont',
    url: `/media/${path.basename(sortie)}`,
    nom: `${nat.nom} — ${urg.nom} — ${Math.round(duree)} s`,
    detail: {
      type: 'pont-trois-couches', texte,
      couche1: { quoi:'données', bande:'1200 / 2200 Hz', octets: donnees.detail.octets,
                 lecteur:'machine', exact: true },
      couche2: { quoi:'sens', bande:'100 à 900 Hz', nature, urgence: urg.nom, bpm: urg.bpm,
                 signature: nat.signature, instinct: nat.instinct, lecteur:'humain', exact: false },
      couche3: { quoi:'état', respiration: respiration ? '6 cycles/minute' : 'aucune',
                 lecteur:'système nerveux autonome', mesurable: true },
      transport: { voie: transport.id, nom: transport.nom, pret: transport.pret,
                   portee: transport.portee, debit: transport.debit },
      secondes: duree
    }
  });
}

/** Relit un son composé : la machine récupère le texte, et on décrit ce que l’humain perçoit. */
export function lire(chemin) {
  const d = demoduler(chemin);
  return {
    ...d,
    humain: 'La couche de sens se juge à l’oreille : tempo pour l’urgence, timbre et mode pour la nature. Elle n’est pas « décodée » par la machine, c’est l’humain qui la lit.',
    machine: 'La couche de données est récupérée au caractère près, contrôle d’intégrité compris.'
  };
}

/** Exercice d’entraînement : on apprend à lire le langage, comme le morse. */
export function entrainement({ niveau = 1 } = {}) {
  const natures = Object.keys(NATURES);
  const pool = niveau <= 1 ? ['alerte','reponse'] : niveau === 2 ? ['alerte','reponse','demande','detresse'] : natures;
  const nature = pool[Math.floor(Math.random() * pool.length)];
  const urgence = niveau <= 1 ? (Math.random() < .5 ? 1 : 4) : Math.floor(Math.random() * 6);
  return {
    nature, urgence,
    consigne: niveau <= 1
      ? 'Écoutez, puis dites si c’est une alerte ou une réponse, et si c’est calme ou urgent.'
      : 'Écoutez, puis nommez la nature exacte et le palier d’urgence.',
    choix: pool.map(k => ({ id: k, nom: NATURES[k].nom })),
    paliers: URGENCES.map(u => ({ n: u.n, nom: u.nom })),
    solution: { nature, nom: NATURES[nature].nom, urgence, palier: URGENCES[urgence].nom,
                pourquoi: `${NATURES[nature].signature} — ${NATURES[nature].instinct}. Tempo ${URGENCES[urgence].bpm} battements/minute : ${URGENCES[urgence].instinct}.` }
  };
}

/** La chaîne, maillon par maillon, avec le statut réel de chacun. */
export const CHAINE = [
  { etape:1, nom:'Machine → trame', statut:'fait', comment:'Clipia encode le message en trame de 255 octets maximum, avec contrôle d’intégrité CRC-8.' },
  { etape:2, nom:'Trame → transport', statut:'fait pour le son, prêt pour la radio',
    comment:'Le modem audio fonctionne tout de suite. Pour le LoRa et l’Iridium, le code de trame est le même : il manque seulement le module à brancher en USB.' },
  { etape:3, nom:'Satellite', statut:'matériel requis',
    comment:'Iridium Short Burst Data : 340 octets par message, couverture mondiale. Modem RockBLOCK 9603, environ 270 € puis un abonnement mensuel. Rien d’autre à développer : la trame Clipia passe telle quelle.' },
  { etape:4, nom:'Transport → son à trois couches', statut:'fait',
    comment:'Un seul fichier porte les données exactes pour la machine, le sens perceptible pour l’humain, et le lit respiratoire pour le corps.' },
  { etape:5, nom:'Son → oreille', statut:'fait', comment:'Un haut-parleur, un casque. Rien de spécial.' },
  { etape:6, nom:'Oreille → perception', statut:'réel, et c’est la limite',
    comment:'Le cerveau reçoit le son, pas le message. L’urgence et la nature se perçoivent d’instinct — c’est pour ça que les sirènes fonctionnent. Le détail, lui, s’apprend : avec l’entraînement, on lit ce langage comme un opérateur lit le morse. Aucun algorithme ne remplace cet apprentissage, et quiconque prétend le contraire vend du rêve.' },
  { etape:7, nom:'Cerveau → état', statut:'mesurable',
    comment:'Le lit respiratoire à 6 cycles/minute agit réellement sur la variabilité cardiaque et le stress. Ce maillon-là est documenté par des essais contrôlés.' }
];

export const HONNETE = 'Cette chaîne est entièrement réelle, sauf une chose qu’il faut dire clairement : le son n’écrit pas dans un cerveau. Il n’existe aucun algorithme qui transforme une musique en information reçue directement, sans passer par l’écoute et par l’apprentissage du sens. Ce que Clipia fait ici est la version honnête et qui marche vraiment : un son que la machine lit exactement, que l’humain comprend d’abord d’instinct puis finement avec l’entraînement, et qui agit sur l’état du corps de façon mesurée. C’est ce qu’utilisent les cockpits et les salles de réanimation — et c’est déjà beaucoup.';
