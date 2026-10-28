/**
 * CLIPIA — Programmes sonores pour le stress et l’attention.
 *
 * Honnêteté d’abord : aucun son n’augmente durablement l’intelligence.
 * Ce qui marche vraiment, et que ce module fabrique :
 *   1. la respiration guidée à 6 cycles/minute (cohérence cardiaque) —
 *      c’est le levier le mieux documenté contre le stress aigu ;
 *   2. le masquage par bruit coloré — effet solide sur la distraction ;
 *   3. les battements binauraux — effet modeste et discuté, ajoutés en
 *      complément, jamais présentés comme le moteur du programme.
 *
 * Le son ne fait pas le travail : il tient le rythme pendant que la
 * respiration, elle, agit réellement sur le système nerveux autonome.
 */
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../pipelines/music-to-clip.js';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';
import { env, ffmpegBin, binaire } from '../lib/env.js';
import { programmeWav } from './synthese.js';
import { BANDES } from './audio.js';

const FFMPEG = () => ffmpegBin();
const e = (s) => String(s).replace(/,/g, '\\,');   // virgules dans un filtregraphe

/** Gammes pentatoniques douces : pas de demi-ton, donc pas de tension. */
const ACCORDS = {
  chaud:  [110.00, 164.81, 220.00, 329.63],   // La — quinte, octave, douzième
  profond:[ 73.42, 110.00, 146.83, 220.00],   // Ré grave
  clair:  [146.83, 220.00, 293.66, 440.00]    // Ré médium
};

export const PROGRAMMES = {
  'anti-stress': {
    nom: 'Anti-stress — cohérence cardiaque',
    pourquoi: 'Respiration à 6 cycles par minute : 5 secondes d’inspiration, 5 d’expiration. C’est la fréquence qui maximise la variabilité cardiaque et fait basculer le système nerveux du mode alerte vers le mode récupération.',
    minutes: 5, accord: 'chaud', bruit: 'pink', niveauBruit: 0.10,
    phases: [{ minutes: 5, inspire: 5, pause: 0, expire: 5 }],
    binaural: 'alpha', preuve: 'solide',
    protocole: 'Trois fois par jour, 5 minutes, assis, dos droit. Le matin, avant le repas de midi, en fin d’après-midi. Les effets sur le stress perçu apparaissent après une à deux semaines de régularité.'
  },
  'calme-profond': {
    nom: 'Calme profond — descente progressive',
    pourquoi: 'Le rythme ralentit de 6 à 4 cycles par minute sur vingt minutes. L’expiration s’allonge plus que l’inspiration : c’est elle qui active le frein vagal.',
    minutes: 20, accord: 'profond', bruit: 'brown', niveauBruit: 0.12,
    phases: [{ minutes: 6, inspire: 5, pause: 0, expire: 5 },
             { minutes: 7, inspire: 4, pause: 1, expire: 7 },
             { minutes: 7, inspire: 4, pause: 2, expire: 9 }],
    binaural: 'theta', preuve: 'solide',
    protocole: 'Une fois par jour, allongé ou assis. À éviter en conduisant : la somnolence est fréquente sur la fin.'
  },
  sommeil: {
    nom: 'Endormissement',
    pourquoi: 'Expiration deux fois plus longue que l’inspiration, puis le guide s’efface et il ne reste que le bruit brun. Le fondu final dure trois minutes pour ne pas réveiller.',
    minutes: 30, accord: 'profond', bruit: 'brown', niveauBruit: 0.14,
    phases: [{ minutes: 8, inspire: 4, pause: 0, expire: 6 },
             { minutes: 8, inspire: 4, pause: 2, expire: 8 },
             { minutes: 14, inspire: 0, pause: 0, expire: 0 }],
    binaural: 'delta', preuve: 'partagé', fonduFinal: 180,
    protocole: 'Au coucher, volume très bas. Le silence du guide sur la fin est voulu : il laisse l’endormissement venir.'
  },
  concentration: {
    nom: 'Concentration — travail profond',
    pourquoi: 'Pas de respiration guidée ici : elle détournerait l’attention. Uniquement un bruit brun de masquage et un bourdon stable, sans événement sonore qui puisse attirer l’oreille.',
    minutes: 45, accord: 'clair', bruit: 'brown', niveauBruit: 0.16,
    phases: [{ minutes: 45, inspire: 0, pause: 0, expire: 0 }],
    binaural: 'beta', preuve: 'solide',
    protocole: 'Au casque, pendant une séance de travail d’un seul tenant. L’effet vient surtout du masquage des bruits alentour.'
  },
  recuperation: {
    nom: 'Récupération courte',
    pourquoi: 'Dix minutes à 6 cycles par minute pour redescendre entre deux tâches lourdes, sans basculer dans le sommeil.',
    minutes: 10, accord: 'chaud', bruit: 'pink', niveauBruit: 0.11,
    phases: [{ minutes: 10, inspire: 5, pause: 0, expire: 5 }],
    binaural: 'alpha', preuve: 'solide',
    protocole: 'Entre deux blocs de travail, assis, les yeux fermés.'
  }
};

/** Enveloppe de respiration : montée douce, plateau, descente douce. */
function enveloppe(ph) {
  const T = ph.inspire + ph.pause + ph.expire;
  if (!T) return null;
  const ti = ph.inspire, tp = ti + ph.pause;
  const u = `mod(t,${T})`;
  const montee  = `pow(sin(PI/2*${u}/${ti}),2)`;
  const descente = `pow(sin(PI/2*max(0,1-(${u}-${tp})/${ph.expire})),2)`;
  return `if(lt(${u},${ti}),${montee},if(lt(${u},${tp}),1,${descente}))`;
}

export async function programme({ id = 'anti-stress', minutes, volume = 1, avecBinaural = true }) {
  const p = PROGRAMMES[id];
  if (!p) throw new Error(`Programme inconnu : ${id}. Choisir parmi ${Object.keys(PROGRAMMES).join(', ')}.`);

  // Mise à l’échelle si l’utilisateur demande une autre durée.
  const facteur = minutes ? Math.max(0.2, Math.min(6, minutes / p.minutes)) : 1;
  const phases = p.phases.map(ph => ({ ...ph, minutes: ph.minutes * facteur }));
  const total = Math.round(phases.reduce((s, ph) => s + ph.minutes, 0) * 60);
  const accord = ACCORDS[p.accord];
  const fonduOut = p.fonduFinal || 12;

  const sansFfmpeg = !binaire('ffmpeg');
  const sortie = path.join(MEDIA_DIR, `${uid('neuro')}.wav`);
  const args = ['-y'];
  const chaine = [];
  let n = 0;

  // 1. Lit de bruit, sur toute la durée.
  args.push('-f','lavfi','-i',`anoisesrc=d=${total}:c=${p.bruit}:r=48000:a=${p.niveauBruit * volume}`);
  const iBruit = n++;
  chaine.push(`[${iBruit}:a]lowpass=f=${p.bruit === 'brown' ? 1800 : 3200},aformat=channel_layouts=stereo[bruit]`);

  // 2. Bourdon : deux notes de l’accord, tenues, très bas.
  for (const f of [accord[0], accord[1]]) {
    args.push('-f','lavfi','-i',`sine=frequency=${f}:duration=${total}:sample_rate=48000`);
    chaine.push(`[${n}:a]volume=${(0.05 * volume).toFixed(3)},aformat=channel_layouts=stereo[dr${n}]`);
    n++;
  }
  const drones = [`[dr1]`, `[dr2]`];

  // 3. Guide de respiration : un segment par phase, puis concaténation.
  const segments = [];
  let curseur = 0;
  for (const ph of phases) {
    const sec = Math.round(ph.minutes * 60);
    const env2 = enveloppe(ph);
    if (env2) {
      const note = accord[2];
      const expr = `${(0.17 * volume).toFixed(3)}*(${env2})*sin(2*PI*${note}*t)`;
      args.push('-f','lavfi','-i',`aevalsrc=${e(expr)}:d=${sec}:s=48000`);
    } else {
      args.push('-f','lavfi','-i',`anullsrc=r=48000:cl=mono:d=${sec}`);
    }
    chaine.push(`[${n}:a]aformat=channel_layouts=stereo,afade=t=in:d=2,afade=t=out:st=${Math.max(0,sec-2)}:d=2[seg${n}]`);
    segments.push(`[seg${n}]`); n++; curseur += sec;
  }
  chaine.push(`${segments.join('')}concat=n=${segments.length}:v=0:a=1[guide]`);

  // 4. Battement binaural, en complément assumé.
  let binaural = '';
  if (avecBinaural && p.binaural) {
    const b = BANDES[p.binaural];
    args.push('-f','lavfi','-i',`sine=frequency=${b.porteuse}:duration=${total}:sample_rate=48000`);
    const g = n++;
    args.push('-f','lavfi','-i',`sine=frequency=${b.porteuse + b.hz}:duration=${total}:sample_rate=48000`);
    const d = n++;
    /**
     * amerge doit recevoir des formats explicites. Sur ffmpeg 4.4 — celui
     * livré avec beaucoup de systèmes — il refuse de deviner et le rendu
     * échoue avec « could not choose their formats ». Les ffmpeg récents
     * sont tolérants, ce qui masque le problème jusqu’au jour où l’outil
     * tourne ailleurs. Donc on l’impose des deux côtés.
     */
    chaine.push(
      `[${g}:a]volume=${(0.07 * volume).toFixed(3)},aformat=sample_fmts=fltp:channel_layouts=mono[bg];` +
      `[${d}:a]volume=${(0.07 * volume).toFixed(3)},aformat=sample_fmts=fltp:channel_layouts=mono[bd];` +
      `[bg][bd]amerge=inputs=2,aformat=sample_fmts=fltp:channel_layouts=stereo[bin]`);
    binaural = '[bin]';
  }

  // 5. Mélange final.
  const entrees = ['[bruit]', ...drones, '[guide]', binaural].filter(Boolean);
  chaine.push(`${entrees.join('')}amix=inputs=${entrees.length}:duration=longest:normalize=0,` +
              `afade=t=in:d=6,afade=t=out:st=${Math.max(1, total - fonduOut)}:d=${fonduOut},` +
              `alimiter=limit=0.89,aformat=sample_fmts=s16:channel_layouts=stereo[out]`);

  if (sansFfmpeg) {   // ffmpeg absent : synthèse en Node pur, le programme se génère quand même
    const b = avecBinaural && p.binaural ? BANDES[p.binaural] : null;
    programmeWav(sortie, { phases, accord, bruit: p.bruit, niveauBruit: p.niveauBruit, volume, fonduFinal: fonduOut, binaural: b ? { f0: b.porteuse, hz: b.hz } : null });
  } else {
    args.push('-filter_complex', chaine.join(';'), '-map','[out]','-c:a','pcm_s16le', sortie);
    await run(FFMPEG(), args);
  }

  const st = fs.statSync(sortie);
  const cycles = phases.filter(x => x.inspire).reduce((s, x) =>
    s + Math.round(x.minutes * 60 / (x.inspire + x.pause + x.expire)), 0);

  return store.insert('assets', {
    file: sortie, ext: 'wav', bytes: st.size, kind: 'audio-cognitif',
    url: `/media/${path.basename(sortie)}`,
    nom: `${p.nom} — ${Math.round(total / 60)} min`,
    detail: {
      type: 'programme-neuro', id, minutes: Math.round(total / 60), cycles,
      rythme: phases.filter(x => x.inspire).map(x => `${x.inspire}-${x.pause}-${x.expire}`),
      bruit: p.bruit, binaural: avecBinaural ? p.binaural : null, accord: p.accord,
      pourquoi: p.pourquoi, protocole: p.protocole, preuve: p.preuve
    }
  });
}

/** Ce qu’on sait, par mécanisme. Affiché tel quel dans l’application. */
export const SAVOIR = {
  respiration: { niveau: 'solide',
    texte: 'La respiration lente autour de 6 cycles par minute augmente la variabilité cardiaque et réduit le stress perçu et l’anxiété. C’est le mécanisme actif de ces programmes, mesuré dans de nombreux essais contrôlés.' },
  masquage: { niveau: 'solide',
    texte: 'Un bruit large bande masque les bruits parasites et réduit la distraction. Effet immédiat, bien documenté, surtout en environnement ouvert.' },
  binaural: { niveau: 'partagé',
    texte: 'Les résultats divergent et les effets mesurés sont modestes. Présent ici comme complément, au casque, jamais comme promesse.' },
  limites: 'Aucun son ne rend plus intelligent et aucun n’augmente durablement les capacités cognitives. Ce qui transforme réellement un cerveau, dans cet ordre : le sommeil, l’activité physique, l’apprentissage exigeant et répété, les liens sociaux. Ces programmes servent à abaisser le stress et à tenir l’attention — un cadre, pas un traitement. En cas d’anxiété durable, de troubles du sommeil installés ou de douleurs thoraciques, c’est un médecin qu’il faut voir, pas un générateur de sons.'
};
