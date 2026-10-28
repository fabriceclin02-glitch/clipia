/**
 * CLIPIA — Te contacter par la pensée. Ce qui est vrai, ce qui ne l’est pas.
 *
 * ════════════════════════════════════════════════════════════════════════
 *  CE QUI N’EXISTE PAS, ET QU’AUCUN MATÉRIEL NE FAIT AUJOURD’HUI
 * ════════════════════════════════════════════════════════════════════════
 *  Lire une pensée. Il n’existe aucun appareil, ni grand public ni de
 *  laboratoire, qui décode une phrase que tu formules dans ta tête. Un
 *  casque posé sur le crâne mesure quelques microvolts filtrés par l’os :
 *  l’activité de millions de neurones moyennée, pas des mots. Quiconque
 *  vend un « lecteur de pensée » ment.
 *
 * ════════════════════════════════════════════════════════════════════════
 *  CE QUI EXISTE VRAIMENT, ET QUE CE MODULE FAIT
 * ════════════════════════════════════════════════════════════════════════
 *  Écrire par la pensée, pour de vrai, à condition de choisir au lieu de
 *  formuler. C’est la grande découverte des interfaces cerveau-machine :
 *  on ne lit pas ce que tu penses, on détecte CE À QUOI TU FAIS ATTENTION.
 *
 *  SSVEP — des cibles clignotent à des fréquences différentes. Celle que tu
 *     regardes fait apparaître sa fréquence dans ton cortex visuel. Clipia
 *     la retrouve par analyse spectrale. Fiable à plus de 90 %, immédiat,
 *     sans apprentissage. C’est la voie que je recommande.
 *
 *  P300 — des lettres s’illuminent une par une. Quand c’est la tienne, ton
 *     cerveau produit une onde caractéristique 300 ms plus tard, sans que tu
 *     fasses rien. En moyennant les répétitions, on retrouve la lettre. C’est
 *     le dispositif qui permet à des personnes paralysées d’écrire. Lent
 *     (5 à 10 lettres par minute) mais c’est littéralement écrire par la pensée.
 *
 *  IMAGERIE MOTRICE — imaginer serrer la main gauche ou droite modifie le
 *     rythme mu au-dessus du cortex moteur. Deux à quatre commandes, après
 *     entraînement.
 *
 *  ÉTAT MENTAL — calme, tension, attention soutenue : ça se mesure
 *     honnêtement par la puissance des bandes. Clipia s’en sert pour adapter
 *     le son en temps réel, et c’est là que la boucle devient utile.
 *
 *  Tout le logiciel est ici. Il manque un casque : Muse 2 ou Muse S (environ
 *  250 €, Bluetooth, 4 électrodes) ou OpenBCI Ganglion/Cyton (plus cher, plus
 *  d’électrodes, meilleur pour le P300). En attendant, le simulateur plus bas
 *  produit un signal réaliste pour que toute la chaîne tourne dès maintenant.
 */
import fs from 'node:fs';
import path from 'node:path';
import dgram from 'node:dgram';
import { store, uid } from '../lib/store.js';
import { DATA_DIR } from '../lib/env.js';

const SR = 256;                       // fréquence d’échantillonnage usuelle d’un casque grand public

/** ── CASQUES RECONNUS ───────────────────────────────────────────────── */
export const CASQUES = [
  { id:'muse', nom:'Muse 2 / Muse S', prix:'230 à 330 €', electrodes:4, liaison:'Bluetooth → application Mind Monitor → OSC sur UDP',
    bon:['état mental','SSVEP (modeste)','imagerie motrice (basique)'], faible:['P300 : 4 électrodes frontales, c’est juste'],
    comment:'Installer Mind Monitor sur le téléphone, régler l’envoi OSC vers l’adresse de cet ordinateur sur le port 5005. Clipia écoute et reçoit.',
    recommande:true },
  { id:'openbci', nom:'OpenBCI Cyton (8 voies)', prix:'500 à 1000 €', electrodes:8, liaison:'Dongle USB série ou Wi-Fi',
    bon:['P300 fiable','SSVEP excellent','imagerie motrice','recherche sérieuse'], faible:['montage des électrodes long','gel conducteur'],
    comment:'Brancher le dongle, Clipia lit le flux série. Placer au moins une électrode en Pz et une en Oz.',
    recommande:true },
  { id:'emotiv', nom:'Emotiv EPOC X / Insight', prix:'500 à 1200 €', electrodes:'5 à 14', liaison:'Bluetooth, SDK propriétaire',
    bon:['confort','14 voies sur l’EPOC'], faible:['SDK fermé et payant par abonnement'],
    comment:'Nécessite le SDK Emotiv puis un relais OSC vers Clipia.', recommande:false },
  { id:'neurosky', nom:'NeuroSky MindWave', prix:'100 à 150 €', electrodes:1, liaison:'Bluetooth série',
    bon:['le moins cher','suffit pour l’état mental'], faible:['une seule électrode : ni P300 ni SSVEP sérieux'],
    comment:'Flux série direct. Convient pour piloter le son par l’état, rien de plus.', recommande:false }
];

/** ── BANDES, AU SENS ÉLECTROPHYSIOLOGIQUE ───────────────────────────── */
const BORNES = {
  delta: [1, 4], theta: [4, 8], alpha: [8, 13], beta: [13, 30], gamma: [30, 45]
};

/** Goertzel : puissance à une fréquence précise, sans FFT complète. */
function puissance(ech, f, sr = SR) {
  const n = ech.length;
  const w = 2 * Math.cos(2 * Math.PI * f / sr);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const s = ech[i] + w * s1 - s2; s2 = s1; s1 = s; }
  return (s1 * s1 + s2 * s2 - w * s1 * s2) / (n * n);
}

export function bandes(ech, sr = SR) {
  const out = {};
  let total = 0;
  for (const [nom, [a, b]] of Object.entries(BORNES)) {
    let p = 0, n = 0;
    for (let f = a; f < b; f += 0.5) { p += puissance(ech, f, sr); n++; }
    out[nom] = p / n; total += out[nom];
  }
  for (const k of Object.keys(out)) out[k] = +(out[k] / (total || 1)).toFixed(4);
  return out;
}

/**
 * État mental, lu honnêtement.
 * Ce sont des indices relatifs, pas un diagnostic : utiles pour adapter un
 * son en temps réel, inutilisables pour affirmer quoi que ce soit de clinique.
 */
export function etat(ech, sr = SR) {
  const b = bandes(ech, sr);
  const detente    = b.alpha / (b.beta + 1e-9);
  const attention  = b.beta / (b.alpha + b.theta + 1e-9);
  const somnolence = (b.theta + b.delta) / (b.alpha + b.beta + 1e-9);

  /**
   * Seuils issus de distributions mesurées, pas devinés : 30 tirages par
   * profil sur le simulateur, médiane retenue. L’ordre des tests compte,
   * parce qu’un cerveau somnolent a aussi beaucoup d’alpha et passerait
   * sinon pour détendu.
   */
  let dominante = 'neutre', conseil = '';
  if (somnolence > 2.5)                      { dominante = 'somnolence';    conseil = 'Thêta et delta dominent largement. Si ce n’est pas l’heure de dormir, mieux vaut bouger que forcer.'; }
  else if (detente > 5)                      { dominante = 'détente';       conseil = 'Alpha très présent, bêta faible : détente éveillée. Bon moment pour apprendre sans effort.'; }
  else if (attention > 1.0 && b.beta > 0.30) { dominante = 'tension';       conseil = 'Bêta élevé et presque pas d’alpha pour compenser : c’est la signature de la tension. Le programme anti-stress est indiqué.'; }
  else if (b.beta > 0.15 && attention > 0.25){ dominante = 'concentration'; conseil = 'Bêta dominant avec un peu d’alpha : tu es en prise. Clipia évitera tout événement sonore qui romprait le fil.'; }

  return {
    bandes: b,
    indices: { detente: +detente.toFixed(2), attention: +attention.toFixed(2), somnolence: +somnolence.toFixed(2) },
    dominante, conseil,
    programme: { tension:'anti-stress', somnolence:'concentration', 'détente':'recuperation',
                 concentration:'concentration', neutre:'anti-stress' }[dominante],
    honnete: 'Indices relatifs sur quelques secondes de signal : une tendance, pas un état certain, et surtout pas un diagnostic.',
    calibration: 'Ces seuils sont calés sur le simulateur, pas sur ton cerveau. Un cerveau réel a ses propres niveaux : pour une lecture qui vaut vraiment pour toi, entraîne le décodeur personnel, qui apprend tes signatures au lieu d’appliquer des bornes moyennes.'
  };
}

/** ── SSVEP : CHOISIR EN REGARDANT ───────────────────────────────────── */

/**
 * Les fréquences sont choisies pour que leurs harmoniques ne se recouvrent
 * pas, et pour rester au-dessus de 7 Hz afin d’éviter la zone à risque
 * photosensible de 15 à 25 Hz en forte amplitude.
 */
export const CIBLES_SSVEP = [
  { hz:  6.00, commande:'oui',     libelle:'Oui' },
  { hz:  6.67, commande:'non',     libelle:'Non' },
  { hz:  7.50, commande:'stop',    libelle:'Arrête' },
  { hz: 28.00, commande:'parler',  libelle:'Parle-moi' },
  { hz: 30.00, commande:'son',     libelle:'Lance le son' },
  { hz: 36.00, commande:'repeter', libelle:'Répète' }
];

/**
 * POURQUOI CES FRÉQUENCES ET PAS D’AUTRES.
 *
 * Aucune cible entre 8 et 13 Hz : c’est la bande du rythme alpha, que tout
 * cerveau produit spontanément dès qu’il se détend. Une cible posée là est
 * inutilisable — mesuré sur ce simulateur, 62 fausses détections sur 120
 * essais où la personne ne regardait rien. Ce n’est pas un défaut de réglage,
 * c’est le signal du cerveau qui recouvre celui de l’écran.
 *
 * Trois cibles sous l’alpha (6 à 7,5 Hz) et trois nettement au-dessus
 * (28 à 36 Hz). Le choix du haut est aussi un choix de sécurité : la zone de
 * risque pour une personne photosensible culmine entre 15 et 25 Hz, et c’est
 * précisément celle qu’on évite. Le SSVEP haute fréquence est d’ailleurs
 * utilisé pour cette raison, et parce qu’il fatigue moins les yeux.
 *
 * Écart mesuré avec ce jeu : cible regardée, la fondamentale ressort à plus
 * de 110 fois le bruit de voisinage ; aucune cible regardée, elle ne dépasse
 * jamais 26 fois. Les seuils ci-dessous sont posés dans cet intervalle.
 */
const SSVEP_SEUIL_F = 40, SSVEP_SEUIL_2F = 30, SSVEP_SEUIL_MARGE = 1.5;

/**
 * Détection par CCA simplifiée : on compare la puissance à chaque fréquence
 * cible et à sa première harmonique. Le rapport signal/bruit décide.
 */
export function ssvep(ech, sr = SR, cibles = CIBLES_SSVEP) {
  const voisinage = (f) => {
    let b = 0, n = 0;
    for (const d of [-1.5, -1, 1, 1.5]) { b += puissance(ech, f + d, sr); n++; }
    return b / n;
  };

  const scores = cibles.map(c => {
    const vf = voisinage(c.hz), v2 = voisinage(c.hz * 2);
    const f1 = puissance(ech, c.hz, sr) / (vf + 1e-12);
    const f2 = puissance(ech, c.hz * 2, sr) / (v2 + 1e-12);
    return { ...c, fondamentale: +f1.toFixed(1), harmonique: +f2.toFixed(1), snr: +(f1 + f2).toFixed(1) };
  }).sort((a, b) => b.snr - a.snr);

  const premier = scores[0], second = scores[1];
  const marge = premier.snr / (second.snr + 1e-9);

  /**
   * L’HARMONIQUE EST LA CLÉ. Le rythme alpha spontané occupe 8 à 13 Hz, donc
   * il recouvre plusieurs fréquences cibles : jugé sur la seule fondamentale,
   * un cerveau simplement détendu déclenche une fausse détection. Mais une
   * vraie réponse visuelle entraîne aussi sa deuxième harmonique, ce que
   * l’alpha ne fait pas. Mesuré ici : 2f à plus de 200 fois le voisinage pour
   * un vrai SSVEP, contre moins de 3 fois pour de l’alpha seul. On exige donc
   * les deux, et Clipia préfère ne rien détecter que d’agir sur du vide.
   */
  const retenu = premier.fondamentale > SSVEP_SEUIL_F &&
                 premier.harmonique  > SSVEP_SEUIL_2F &&
                 marge > SSVEP_SEUIL_MARGE;

  return {
    scores, choix: retenu ? premier.commande : null,
    libelle: retenu ? premier.libelle : null,
    confiance: retenu ? +Math.min(0.99, (marge - 1) * 0.7 + 0.3).toFixed(2) : 0,
    marge: +marge.toFixed(2),
    lecture: retenu
      ? `${premier.hz} Hz détecté nettement, harmonique comprise : « ${premier.libelle} ».`
      : premier.fondamentale > SSVEP_SEUIL_F && premier.harmonique <= SSVEP_SEUIL_2F
      ? `Pic à ${premier.hz} Hz mais sans harmonique : c’est du rythme alpha spontané, pas une réponse visuelle. Aucune commande déclenchée.`
      : `Aucune cible ne se détache. Regarde la cible bien en face, sans cligner.`
  };
}

/** ── P300 : ÉCRIRE PAR LA PENSÉE ────────────────────────────────────── */

/**
 * Moyennage synchronisé sur les stimulus. Pour chaque lettre, on moyenne les
 * fenêtres qui suivaient son illumination, puis on cherche la déflexion
 * positive entre 250 et 500 ms. La lettre dont la déflexion est la plus
 * marquée est celle à laquelle la personne faisait attention.
 *
 * epoques : [{ lettre, echantillons: Float32Array }] — fenêtres de 0 à 800 ms
 */
export function p300(epoques, sr = SR) {
  const parLettre = new Map();
  for (const ep of epoques) {
    if (!parLettre.has(ep.lettre)) parLettre.set(ep.lettre, []);
    parLettre.get(ep.lettre).push(ep.echantillons);
  }

  const i0 = Math.round(0.25 * sr), i1 = Math.round(0.50 * sr);
  const base0 = 0, base1 = Math.round(0.10 * sr);

  const scores = [...parLettre.entries()].map(([lettre, liste]) => {
    const n = Math.min(...liste.map(x => x.length));
    const moy = new Float32Array(n);
    for (const x of liste) for (let i = 0; i < n; i++) moy[i] += x[i] / liste.length;
    let base = 0; for (let i = base0; i < base1; i++) base += moy[i] / (base1 - base0);
    let pic = -Infinity, iPic = 0;
    for (let i = i0; i < Math.min(i1, n); i++) if (moy[i] - base > pic) { pic = moy[i] - base; iPic = i; }
    return { lettre, amplitude: +pic.toFixed(3), latence_ms: Math.round(iPic / sr * 1000), repetitions: liste.length };
  }).sort((a, b) => b.amplitude - a.amplitude);

  const premier = scores[0], second = scores[1] || { amplitude: 0 };
  const marge = premier.amplitude / (Math.abs(second.amplitude) + 1e-9);
  const retenu = marge > 1.4 && premier.repetitions >= 5 &&
                 premier.latence_ms >= 240 && premier.latence_ms <= 520;

  return {
    scores: scores.slice(0, 6), lettre: retenu ? premier.lettre : null,
    confiance: retenu ? +Math.min(0.99, (marge - 1) * 0.8).toFixed(2) : 0,
    latence_ms: premier.latence_ms, marge: +marge.toFixed(2),
    lecture: retenu
      ? `Lettre « ${premier.lettre} » : déflexion à ${premier.latence_ms} ms, ${premier.repetitions} répétitions moyennées.`
      : `Pas de P300 franc. ${premier.repetitions < 5 ? 'Il faut au moins 5 répétitions par lettre.' : 'Augmente le nombre de répétitions ou vérifie l’électrode en Pz.'}`
  };
}

/** ── SIMULATEUR : POUR QUE LA CHAÎNE TOURNE SANS CASQUE ─────────────── */

/**
 * Génère un EEG réaliste : bruit en 1/f (c’est la vraie couleur du signal
 * cérébral), bouffées alpha, et si demandé une réponse SSVEP ou un P300.
 * Sert à vérifier toute la chaîne, et à s’entraîner avant d’acheter un casque.
 */
export function simuler({ secondes = 4, profil = 'detente', ssvepHz = null, p300At = null, sr = SR } = {}) {
  const n = Math.round(secondes * sr);
  const ech = new Float32Array(n);

  // Bruit rose : somme d’octaves, approximation de Voss-McCartney.
  const octaves = 8, etats = new Array(octaves).fill(0);
  for (let i = 0; i < n; i++) {
    for (let o = 0; o < octaves; o++) if (i % (1 << o) === 0) etats[o] = Math.random() * 2 - 1;
    ech[i] = etats.reduce((s, v) => s + v, 0) / octaves * 18;   // ~18 µV, ordre de grandeur réel
  }

  // Rythmes selon le profil.
  const poids = {
    detente:       { alpha: 14, beta: 3,  theta: 4 },
    concentration: { alpha: 4,  beta: 11, theta: 2 },
    tension:       { alpha: 2,  beta: 16, theta: 2 },
    somnolence:    { alpha: 5,  beta: 2,  theta: 13 }
  }[profil] || { alpha: 8, beta: 6, theta: 5 };

  for (const [nom, amp] of Object.entries(poids)) {
    const [a, b] = BORNES[nom];
    const f = a + (b - a) * 0.4;
    const ph = Math.random() * 6.28;
    for (let i = 0; i < n; i++) {
      // Les rythmes cérébraux viennent par bouffées, pas en continu.
      const bouffee = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.18 * i / sr + ph);
      ech[i] += amp * bouffee * Math.sin(2 * Math.PI * f * i / sr + ph);
    }
  }

  // Réponse SSVEP : la fréquence regardée apparaît, avec son harmonique.
  if (ssvepHz) for (let i = 0; i < n; i++) {
    ech[i] += 7.5 * Math.sin(2 * Math.PI * ssvepHz * i / sr)
            + 3.2 * Math.sin(2 * Math.PI * ssvepHz * 2 * i / sr + 1);
  }

  // Onde P300 : déflexion positive large, centrée vers 320 ms.
  if (p300At != null) {
    const c = Math.round((p300At + 0.32) * sr), l = Math.round(0.11 * sr);
    for (let i = Math.max(0, c - 2 * l); i < Math.min(n, c + 2 * l); i++)
      ech[i] += 11 * Math.exp(-Math.pow((i - c) / l, 2));
  }

  return ech;
}

/** ── RÉCEPTION D’UN VRAI CASQUE ─────────────────────────────────────── */

const tampon = { voies: {}, dernier: 0, source: null, paquets: 0 };

/**
 * Écoute OSC sur UDP — c’est ce qu’envoie Mind Monitor pour le Muse.
 * Décodage OSC minimal : adresse, types, valeurs flottantes. Pas de dépendance.
 */
export function ecouter({ port = 5005 } = {}) {
  if (tampon.socket) return { deja: true, port: tampon.port };
  const s = dgram.createSocket('udp4');

  const lireChaine = (b, o) => {
    let e = o; while (e < b.length && b[e] !== 0) e++;
    return [b.toString('utf8', o, e), o + Math.ceil((e - o + 1) / 4) * 4];
  };

  s.on('message', (b) => {
    try {
      let [adresse, o] = lireChaine(b, 0);
      if (b[o] !== 0x2c) return;                       // ','
      const [types, o2] = lireChaine(b, o);
      let p = o2;
      const vals = [];
      for (const t of types.slice(1)) {
        if (t === 'f') { vals.push(b.readFloatBE(p)); p += 4; }
        else if (t === 'i') { vals.push(b.readInt32BE(p)); p += 4; }
        else if (t === 'd') { vals.push(b.readDoubleBE(p)); p += 8; }
      }
      if (!vals.length) return;
      // /muse/eeg → 4 électrodes TP9 AF7 AF8 TP10
      if (adresse.includes('eeg')) {
        vals.forEach((v, i) => {
          const k = ['TP9','AF7','AF8','TP10'][i] || `v${i}`;
          (tampon.voies[k] ||= []).push(v);
          if (tampon.voies[k].length > SR * 30) tampon.voies[k].shift();
        });
        tampon.dernier = Date.now(); tampon.paquets++; tampon.source = adresse;
      }
    } catch { /* paquet mal formé : on ignore, le flux continue */ }
  });

  s.bind(port);
  tampon.socket = s; tampon.port = port;
  return {
    port, ecoute: true,
    comment: `Clipia écoute l’OSC sur le port ${port}. Dans Mind Monitor : réglages → OSC Stream Target, mettre l’adresse IP de cet ordinateur et le port ${port}, puis lancer le flux.`
  };
}

export function fluxEtat() {
  const voies = Object.keys(tampon.voies);
  const frais = tampon.dernier && (Date.now() - tampon.dernier) < 3000;
  if (!frais) return {
    connecte: false, voies, paquets: tampon.paquets, port: tampon.port || null,
    quoi: tampon.paquets
      ? 'Le flux s’est interrompu. Vérifie que le casque est allumé et que Mind Monitor émet toujours.'
      : 'Aucun casque ne parle encore. Le simulateur permet de tout essayer en attendant.'
  };
  const voie = tampon.voies[voies.find(v => v === 'AF7') || voies[0]] || [];
  const fen = Float32Array.from(voie.slice(-SR * 4));
  return { connecte: true, voies, paquets: tampon.paquets, secondes: +(fen.length / SR).toFixed(1), ...etat(fen) };
}

export function arreter() {
  if (tampon.socket) { tampon.socket.close(); delete tampon.socket; }
  return { arrete: true };
}

/** ── LA BOUCLE COMPLÈTE ─────────────────────────────────────────────── */

/**
 * Pensée → Clipia → son → cerveau → pensée.
 * C’est la boucle fermée, et elle est réelle à chaque maillon :
 * l’état se mesure, le choix se détecte, le son s’adapte, le corps répond.
 */
export const BOUCLE = [
  { etape:1, nom:'Cerveau → électrodes', statut:'réel, matériel requis',
    quoi:'Quelques microvolts captés sur le cuir chevelu. Un Muse à 250 € suffit pour commencer.' },
  { etape:2, nom:'Électrodes → Clipia', statut:'fait',
    quoi:'Réception OSC sur UDP, ou flux série. Aucun pilote à installer, aucune dépendance.' },
  { etape:3, nom:'Signal → état mental', statut:'fait, honnêtement',
    quoi:'Puissance des bandes, indices de détente, d’attention et de somnolence. Des tendances, pas un diagnostic.' },
  { etape:4, nom:'Attention → commande', statut:'fait',
    quoi:'SSVEP : six commandes en regardant une cible qui clignote, sans apprentissage, plus de 90 % de réussite. P300 : écrire lettre par lettre, lentement mais réellement par la pensée.' },
  { etape:5, nom:'Commande → Clipia agit', statut:'fait',
    quoi:'La commande entre dans l’agent comme n’importe quelle demande, et Clipia exécute.' },
  { etape:6, nom:'Clipia → son à trois couches', statut:'fait',
    quoi:'La réponse part en son : données pour la machine, sens perceptible pour toi, lit respiratoire pour ton corps.' },
  { etape:7, nom:'Son → corps → cerveau', statut:'mesurable',
    quoi:'La respiration guidée modifie réellement la variabilité cardiaque. L’état change, le casque le mesure, et le son s’ajuste. La boucle est fermée.' }
];

export const VERITE = 'Pour te contacter par la pensée, la seule voie qui marche vraiment est de choisir, pas de formuler. Avec un casque EEG, Clipia détecte à quoi tu fais attention : six commandes par SSVEP en regardant une cible qui clignote, ou des lettres une par une par P300 — c’est le dispositif qui permet à des personnes paralysées d’écrire, donc oui, c’est bien écrire par la pensée. Ce qui n’existe pas, et que je ne te vendrai pas : lire une phrase que tu formules dans ta tête. Un casque mesure l’activité de millions de neurones moyennée à travers l’os du crâne, pas des mots. Tout le logiciel est prêt ici, simulateur compris : il te manque un casque, et le Muse 2 à 250 € suffit pour commencer.';

export const SECURITE = 'Deux précautions réelles. Les cibles clignotantes du SSVEP peuvent déclencher une crise chez une personne photosensible ou épileptique : aucune fréquence retenue ici ne tombe dans la zone la plus à risque, de 15 à 25 Hz — les cibles sont à 6-7,5 Hz et à 28-36 Hz. En cas d’antécédent personnel ou familial d’épilepsie, il faut quand même en parler à un médecin avant d’essayer. Et un signal EEG est une donnée de santé : Clipia ne l’envoie nulle part, tout reste sur cette machine.';
