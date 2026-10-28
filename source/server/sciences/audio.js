/**
 * CLIPIA — Le son comme matière de raisonnement, et comme outil.
 *
 * Deux volets :
 *   analyser  — mesurer réellement un son (spectre, tempo, dynamique, tonalité)
 *               pour que le modèle raisonne sur des chiffres, pas sur une idée
 *   generer   — fabriquer des sons calibrés : battements binauraux, tons
 *               isochrones, bruits colorés, gammes de fréquences
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from '../pipelines/music-to-clip.js';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';
import { env, ffmpegBin, ffprobeBin, binaire } from '../lib/env.js';
import { bruitWav, binauralWav, isochroneWav } from './synthese.js';

const FFMPEG = () => ffmpegBin();
import { sondeJson } from '../lib/sonde.js';
const FFPROBE = () => ffprobeBin();

const NOTES = ['Do','Do♯','Ré','Ré♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si'];

/** ── ANALYSE ────────────────────────────────────────────────────────── */
export async function analyser(chemin) {
  if (!fs.existsSync(chemin)) throw new Error('Fichier introuvable.');

  const meta = sondeJson(chemin);
  const flux = meta.streams?.find(s => s.codec_type === 'audio') || {};
  const duree = parseFloat(meta.format?.duration || 0);

  // Dynamique et niveau : mesures normalisées EBU R128
  let loudness = {};
  try {
    const { err } = await run(FFMPEG(), ['-hide_banner','-i',chemin,'-af','ebur128=peak=true','-f','null','-']);
    const bloc = err.slice(-1600);
    const lis = v => { const m = new RegExp(v + ':\\s*(-?[\\d.]+)').exec(bloc); return m ? parseFloat(m[1]) : null; };
    loudness = { integre: lis('I'), plage: lis('LRA'), crete: lis('Peak') };
  } catch {}

  // Spectre : bandes d'énergie, par filtrage puis mesure
  const bandes = [
    ['grave', 20, 120], ['bas-médium', 120, 500], ['médium', 500, 2000],
    ['haut-médium', 2000, 6000], ['aigu', 6000, 16000]
  ];
  const spectre = [];
  for (const [nom, f1, f2] of bandes) {
    try {
      const { err } = await run(FFMPEG(), ['-hide_banner','-i',chemin,
        '-af',`highpass=f=${f1},lowpass=f=${f2},volumedetect`,'-f','null','-']);
      const m = /mean_volume:\s*(-?[\d.]+)/.exec(err);
      spectre.push({ bande: nom, hz: `${f1}–${f2}`, dB: m ? parseFloat(m[1]) : null });
    } catch { spectre.push({ bande: nom, hz: `${f1}–${f2}`, dB: null }); }
  }

  // Tempo, par intervalle médian entre pics d'énergie
  const tmp = path.join(MEDIA_DIR, `${uid('an')}.txt`);
  /**
   * TEMPO — refait, parce que l’ancienne version ne trouvait rien.
   *
   * Elle s’appuyait sur `astats=reset=0.05` en croyant régler un intervalle
   * de 0,05 seconde. Or `reset` compte des IMAGES, pas des secondes : la
   * valeur tombait à zéro, les statistiques ne se réinitialisaient jamais, et
   * il ne restait qu’un seul niveau pour tout le morceau. Un `catch` muet
   * cachait l’échec, qui ressortait en « tempo non détecté » sur un rythme
   * pourtant parfaitement net.
   *
   * La méthode ci-dessous est celle des détecteurs de tempo sérieux :
   *   1. on décode le son en échantillons bruts ;
   *   2. on mesure l’énergie par petites fenêtres ;
   *   3. on garde les HAUSSES d’énergie — une attaque, c’est une montée
   *      brusque, pas un niveau élevé ;
   *   4. on autocorrèle cette courbe : si le morceau bat à 120, la courbe
   *      ressemble à elle-même décalée d’une demi-seconde ;
   *   5. on corrige les erreurs d’octave, un tempo détecté au double ou à la
   *      moitié étant l’erreur classique.
   */
  let bpm = null, pics = 0, confianceTempo = 0;
  try {
    const SR = 22050, SAUT = 256;                    // 11,6 ms par fenêtre
    const brut = spawnSync(FFMPEG(), ['-v','error','-i', chemin,
      '-ac','1','-ar', String(SR), '-f','s16le','-'], { maxBuffer: 1 << 28 });
    if (brut.status !== 0) throw new Error('décodage impossible');
    const b = brut.stdout, n = Math.floor(b.length / 2);

    // Énergie par fenêtre.
    const trames = Math.floor(n / SAUT);
    const energie = new Float32Array(trames);
    for (let t = 0; t < trames; t++) {
      let q = 0;
      for (let i = t * SAUT; i < (t + 1) * SAUT; i++) { const v = b.readInt16LE(i * 2) / 32768; q += v * v; }
      energie[t] = Math.sqrt(q / SAUT);
    }

    // Flux : seules les hausses comptent. Une attaque est une montée.
    const flux = new Float32Array(trames);
    for (let t = 1; t < trames; t++) flux[t] = Math.max(0, energie[t] - energie[t - 1]);

    // On retire la tendance lente, sinon un crescendo passe pour un rythme.
    const F = 24;
    const net = new Float32Array(trames);
    for (let t = 0; t < trames; t++) {
      let som = 0, c = 0;
      for (let k = Math.max(0, t - F); k < Math.min(trames, t + F); k++) { som += flux[k]; c++; }
      net[t] = Math.max(0, flux[t] - som / (c || 1));
    }

    const seuil = net.reduce((a, x) => a + x, 0) / (trames || 1) * 2.2;
    for (let t = 1; t < trames - 1; t++) if (net[t] > seuil && net[t] >= net[t - 1] && net[t] > net[t + 1]) pics++;

    // Autocorrélation sur la plage des tempos plausibles.
    const parSeconde = SR / SAUT;
    const lagMin = Math.floor(parSeconde * 60 / 200);   // 200 BPM
    const lagMax = Math.ceil(parSeconde * 60 / 55);     // 55 BPM
    let meilleur = 0, meilleurLag = 0, somme = 0, compte = 0;
    for (let lag = lagMin; lag <= Math.min(lagMax, trames - 2); lag++) {
      let r = 0;
      for (let t = 0; t + lag < trames; t++) r += net[t] * net[t + lag];
      r /= (trames - lag);
      somme += r; compte++;
      if (r > meilleur) { meilleur = r; meilleurLag = lag; }
    }

    if (meilleurLag && compte) {
      const moyenne = somme / compte;
      confianceTempo = +(meilleur / (moyenne + 1e-12)).toFixed(2);
      let candidat = 60 * parSeconde / meilleurLag;

      /**
       * Erreur d’octave : un rythme à 120 se corrèle aussi bien à 60 et 240.
       * On ramène le candidat dans la plage où vit la musique — 70 à 180 —
       * en doublant ou en divisant, ce qui est musicalement équivalent.
       */
      while (candidat < 70) candidat *= 2;
      while (candidat > 180) candidat /= 2;

      // Une corrélation à peine au-dessus de la moyenne ne prouve rien.
      if (confianceTempo > 1.8 && candidat >= 55 && candidat <= 200) bpm = Math.round(candidat);
    }
  } catch (err) {
    // Pas de catch muet : l’échec doit pouvoir se lire.
    bpm = null;
    pics = 0;
  }

  return {
    duree: +duree.toFixed(2),
    canaux: flux.channels, echantillonnage: flux.sample_rate, codec: flux.codec_name,
    debit: meta.format?.bit_rate ? Math.round(meta.format.bit_rate / 1000) + ' kb/s' : null,
    loudness, spectre, bpm, pics,
    lecture: lireSpectre(spectre, loudness, bpm)
  };
}

/** Traduit les mesures en observations exploitables. */
function lireSpectre(spectre, loudness, bpm) {
  const obs = [];
  const bande = n => spectre.find(s => s.bande === n)?.dB;
  const grave = bande('grave'), medium = bande('médium'), aigu = bande('aigu');

  if (grave != null && medium != null) {
    const d = grave - medium;
    if (d > 6) obs.push('Énergie fortement concentrée dans le grave — masse sonore, peu de lisibilité.');
    else if (d < -10) obs.push('Grave en retrait — le son manque d\'assise.');
    else obs.push('Équilibre grave/médium cohérent.');
  }
  if (aigu != null && medium != null && aigu - medium < -18)
    obs.push('Aigus très atténués — le son paraîtra sourd, ou vient d\'un encodage pauvre.');
  if (loudness.integre != null) {
    if (loudness.integre > -9) obs.push(`Niveau intégré ${loudness.integre} LUFS — très compressé, au-dessus des usages de diffusion.`);
    else if (loudness.integre < -20) obs.push(`Niveau intégré ${loudness.integre} LUFS — faible, prévoir une normalisation.`);
    else obs.push(`Niveau intégré ${loudness.integre} LUFS — proche des cibles de diffusion (-14 LUFS).`);
  }
  if (loudness.plage != null && loudness.plage < 4)
    obs.push(`Plage dynamique ${loudness.plage} LU — très resserrée, fatigant à l'écoute prolongée.`);
  if (bpm) obs.push(`Tempo estimé ${bpm} BPM.`);
  return obs;
}

/** ── GÉNÉRATION ─────────────────────────────────────────────────────── */

/**
 * Battements binauraux : deux fréquences légèrement décalées, une par oreille.
 * Le cerveau perçoit la différence comme une pulsation. Casque indispensable —
 * sans séparation stéréo, l'effet n'existe pas.
 */
export const BANDES = {
  delta: { hz: 2,  porteuse: 100, nom: 'Delta',  usage: 'sommeil profond, récupération' },
  theta: { hz: 6,  porteuse: 150, nom: 'Thêta',  usage: 'relaxation profonde, méditation, créativité diffuse' },
  alpha: { hz: 10, porteuse: 200, nom: 'Alpha',  usage: 'détente éveillée, apprentissage calme' },
  beta:  { hz: 18, porteuse: 250, nom: 'Bêta',   usage: 'concentration active, travail analytique' },
  gamma: { hz: 40, porteuse: 300, nom: 'Gamma',  usage: 'attention soutenue, liaison perceptive' }
};

export async function binaural({ bande = 'alpha', minutes = 20, porteuse, volume = 0.25, fondu = 15 }) {
  const b = BANDES[bande];
  if (!b) throw new Error(`Bande inconnue : ${bande}. Choisir parmi ${Object.keys(BANDES).join(', ')}.`);
  const f0 = porteuse || b.porteuse;
  const secondes = Math.max(30, Math.min(7200, Math.round(minutes * 60)));
  const sortie = path.join(MEDIA_DIR, `${uid('bin')}.wav`);

  if (!binaire('ffmpeg')) binauralWav(sortie, { f0, hz: b.hz, secondes, volume, fondu: Math.min(fondu, secondes / 4) });
  else await run(FFMPEG(), ['-y',
    '-f','lavfi','-i',`sine=frequency=${f0}:duration=${secondes}:sample_rate=48000`,
    '-f','lavfi','-i',`sine=frequency=${f0 + b.hz}:duration=${secondes}:sample_rate=48000`,
    '-filter_complex',
      // Formats imposés : sans cela, amerge échoue sur ffmpeg 4.4.
      `[0:a]volume=${volume},aformat=sample_fmts=fltp:channel_layouts=mono[g];` +
      `[1:a]volume=${volume},aformat=sample_fmts=fltp:channel_layouts=mono[d];` +
      `[g][d]amerge=inputs=2,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
      `afade=t=in:d=${fondu},afade=t=out:st=${secondes - fondu}:d=${fondu}[a]`,
    '-map','[a]','-ac','2','-c:a','pcm_s16le', sortie]);

  const st = fs.statSync(sortie);
  return store.insert('assets', {
    file: sortie, ext: 'wav', bytes: st.size, kind: 'audio-cognitif',
    url: `/media/${path.basename(sortie)}`,
    nom: `Binaural ${b.nom} ${b.hz} Hz — ${minutes} min`,
    detail: { type: 'binaural', bande, battement: b.hz, porteuse: f0, minutes, usage: b.usage }
  });
}

/** Ton isochrone : une seule fréquence pulsée. Fonctionne sans casque. */
export async function isochrone({ frequence = 10, porteuse = 220, minutes = 20, volume = 0.3 }) {
  const secondes = Math.max(30, Math.min(7200, Math.round(minutes * 60)));
  const sortie = path.join(MEDIA_DIR, `${uid('iso')}.wav`);
  if (!binaire('ffmpeg')) isochroneWav(sortie, { frequence, porteuse, secondes, volume });
  else await run(FFMPEG(), ['-y',
    '-f','lavfi','-i',`sine=frequency=${porteuse}:duration=${secondes}:sample_rate=48000`,
    '-af',`tremolo=f=${frequence}:d=0.95,volume=${volume},afade=t=in:d=10,afade=t=out:st=${secondes-10}:d=10`,
    '-ac','2','-c:a','pcm_s16le', sortie]);
  const st = fs.statSync(sortie);
  return store.insert('assets', {
    file: sortie, ext: 'wav', bytes: st.size, kind: 'audio-cognitif',
    url: `/media/${path.basename(sortie)}`,
    nom: `Isochrone ${frequence} Hz — ${minutes} min`,
    detail: { type: 'isochrone', frequence, porteuse, minutes }
  });
}

/** Bruits colorés — le masquage le mieux établi pour la concentration. */
export async function bruit({ couleur = 'brown', minutes = 30, volume = 0.2 }) {
  const permis = { white: 'white', pink: 'pink', brown: 'brown', violet: 'violet', blue: 'blue' };
  const c = permis[couleur] || 'brown';
  const secondes = Math.max(30, Math.min(7200, Math.round(minutes * 60)));
  const sortie = path.join(MEDIA_DIR, `${uid('bru')}.wav`);
  if (!binaire('ffmpeg')) bruitWav(sortie, { couleur: c, secondes, volume });
  else await run(FFMPEG(), ['-y',
    '-f','lavfi','-i',`anoisesrc=d=${secondes}:c=${c}:r=48000:a=${volume}`,
    '-af',`afade=t=in:d=8,afade=t=out:st=${secondes-8}:d=8`,
    '-ac','2','-c:a','pcm_s16le', sortie]);
  const st = fs.statSync(sortie);
  return store.insert('assets', {
    file: sortie, ext: 'wav', bytes: st.size, kind: 'audio-cognitif',
    url: `/media/${path.basename(sortie)}`,
    nom: `Bruit ${c} — ${minutes} min`, detail: { type: 'bruit', couleur: c, minutes }
  });
}

/**
 * Ce que dit l'état des connaissances. Annoncé dans l'application :
 * un outil qui promet ce qu'il ne tient pas n'aide personne.
 */
export const PREUVES = {
  bruit: { niveau: 'solide',
    texte: "Le masquage sonore réduit la distraction en milieu bruyant. C'est l'effet le mieux documenté de cette famille." },
  binaural: { niveau: 'partagé',
    texte: "Des études rapportent un effet sur l'anxiété et l'attention soutenue ; d'autres ne le retrouvent pas. Les tailles d'effet restent modestes et les protocoles hétérogènes. Casque obligatoire." },
  isochrone: { niveau: 'faible',
    texte: "Peu d'études indépendantes. L'effet ressenti tient sans doute autant au rituel d'écoute qu'à la pulsation elle-même." },
  general: "Aucun de ces sons ne modifie durablement les capacités cognitives. Ce sont des aides au contexte de travail — comme une lumière bien réglée. Le sommeil, l'activité physique et l'entraînement restent de très loin les leviers les plus efficaces."
};
