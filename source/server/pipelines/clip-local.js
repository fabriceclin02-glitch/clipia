/**
 * CLIPIA — Un clip, à partir du son seul. Sans modèle, sans clé, sans réseau.
 *
 * POURQUOI CE FICHIER EXISTE
 * La fonction d’origine de Clipia — faire un clip depuis une musique — exige
 * un modèle de texte pour le scénario et un fournisseur d’images pour les
 * plans. Sans l’un des deux, rien ne sort. Résultat : sur une machine fraîche,
 * la raison d’être de l’application ne marche pas, et c’est la première chose
 * que l’utilisateur essaie.
 *
 * Ce module produit un vrai clip avec ce qui est déjà là : le son, et ffmpeg.
 * Pas une image fixe sur une piste — un visuel qui RÉAGIT à la musique, monté
 * sur son tempo réel.
 *
 * COMMENT, CONCRÈTEMENT
 * ffmpeg sait transformer un signal audio en image : showcqt donne un spectre
 * accordé sur les notes de la gamme, showwaves la forme d’onde, showfreqs les
 * bandes de fréquences, avectorscope la figure de Lissajous du stéréo. Ces
 * filtres ne décorent pas : ils dessinent le contenu réel du son, image par
 * image. On les superpose à un fond qui dérive lentement, on cale les
 * changements de plan sur le tempo mesuré, et on obtient un clip abstrait qui
 * suit vraiment la musique.
 *
 * CE QUE ÇA N’EST PAS
 * Ce n’est pas une mise en scène narrative : il n’y a ni personnage, ni récit,
 * ni plan tourné. Pour ça il faut un modèle et des images, et c’est l’autre
 * chemin. Celui-ci donne un clip utilisable tout de suite, honnêtement
 * abstrait, de la qualité d’un bon visualiseur — pas d’un film.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';
import { ffmpegBin, ffprobeBin } from '../lib/env.js';
import { analyser } from '../sciences/audio.js';

const e = (s) => String(s).replace(/,/g, '\\,');

/** Les formats que demandent les plateformes. */
export const FORMATS = {
  paysage: { l: 1920, h: 1080, nom: '16:9 — YouTube' },
  carre:   { l: 1080, h: 1080, nom: '1:1 — Instagram' },
  vertical:{ l: 1080, h: 1920, nom: '9:16 — TikTok, Reels, Shorts' },
  cinema:  { l: 1920, h: 816,  nom: '2.35:1 — cinémascope' }
};

/**
 * Les ambiances. Chacune choisit un visualiseur, une palette et un traitement.
 * Les couleurs suivent celles de Clipia : violet, magenta, bleu.
 */
/**
 * Les ambiances.
 *
 * Deux réglages découverts à l’usage, et qui changent tout :
 *   axis=0:text=0 — sans eux, showcqt dessine en travers de l’image une
 *     légende des noms de notes, en rouge, qui gâche le rendu. Le réglage
 *     par défaut est fait pour l’analyse, pas pour un clip.
 *   cscheme — six nombres, trois pour les barres et trois pour le sonogramme.
 *     Sans lui le visuel sort en orange et bleu, pas aux couleurs de Clipia.
 *
 * Violet #c9a0ff → 0.79|0.63|1   ·   Magenta #ff7ad9 → 1|0.48|0.85
 */
/**
 * Des couleurs DÉSATURÉES se délavent vers le blanc aux pics d’intensité :
 * le premier essai sortait gris-lavande au lieu de violet. Il faut donc
 * creuser l’écart entre les canaux — baisser franchement le vert pour un
 * violet, le vert ET le bleu pour un magenta. La couleur tient alors même
 * à pleine intensité.
 */
/** showcqt refuse toute hauteur impaire : 713 est rejeté, 712 accepté. */
const pair = (n) => { const x = Math.round(n); return x % 2 ? x - 1 : x; };

const VIOLET = '0.62|0.18|1', MAGENTA = '1|0.20|0.68', BLEU = '0.18|0.62|1';

export const AMBIANCES = {
  spectre: {
    nom: 'Spectre accordé',
    quoi: 'Un spectre aligné sur les notes de la gamme : on voit les accords monter et descendre. Le plus lisible musicalement.',
    visuel: (L, H) =>
      `[0:a]showcqt=s=${L}x${pair(H)}:fps=30:count=4:axis=0:text=0:bar_g=2:sono_g=2.6:` +
      `bar_v=11:sono_v=14:cscheme=${VIOLET}|${MAGENTA},` +
      `format=yuv420p[vis]`,
    fond: '0x140a28', accent: 'c9a0ff'
  },
  onde: {
    nom: 'Onde',
    quoi: 'La forme d’onde en miroir, qui respire avec le morceau. Sobre et net.',
    visuel: (L, H) =>
      `[0:a]showwaves=s=${L}x${Math.round(H * 0.56)}:rate=30:mode=cline:` +
      `colors=0xffa0d9|0x7ec8ff:draw=full:scale=sqrt,format=yuva420p,gblur=sigma=1.1,` +
      `pad=${L}:${H}:0:(oh-ih)/2:color=0x00000000[vis]`,
    fond: '0x120a24', accent: 'ff7ad9'
  },
  bandes: {
    nom: 'Bandes de fréquences',
    quoi: 'Des barres par bande, graves à gauche, aigus à droite. L’effet « égaliseur », très rythmique.',
    visuel: (L, H) =>
      // cmode=combined n'applique que la première couleur et sort en blanc ;
      // en séparant les canaux, chacun prend la sienne et le dégradé apparaît.
      `[0:a]showfreqs=s=${L}x${Math.round(H * 0.58)}:rate=30:mode=bar:ascale=cbrt:fscale=log:` +
      `win_size=2048:cmode=separate:colors=0xc9a0ff|0xff7ad9,format=yuva420p,` +
      `pad=${L}:${H}:0:(oh-ih)/2:color=0x00000000[vis]`,
    fond: '0x14092a', accent: '5ec8ff'
  },
  lissajous: {
    nom: 'Figure stéréo',
    quoi: 'La figure que dessinent les deux canaux l’un contre l’autre. Hypnotique sur un mixage large — mais sur un morceau mono, les deux canaux étant identiques, la figure se réduit à une simple ligne verticale. Réservé aux mixages stéréo.',
    visuel: (L, H) => {
      const c = Math.round(Math.min(L, H) * 0.86);
      return `[0:a]avectorscope=s=${c}x${c}:rate=30:mode=lissajous:zoom=1.5:draw=line:` +
             `rc=190:gc=140:bc=255:rf=14:gf=6:bf=34,format=yuva420p,gblur=sigma=0.7,` +
             `pad=${L}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x00000000[vis]`;
    },
    fond: '0x0e0620', accent: 'c9a0ff'
  },
  double: {
    nom: 'Spectre et onde',
    quoi: 'Le spectre en haut, l’onde en bas. Le plus riche, et le plus proche d’un clip de festival.',
    visuel: (L, H) =>
      `[0:a]asplit=2[a1][a2];` +
      `[a1]showcqt=s=${L}x${pair(H * 0.66)}:fps=30:count=3:axis=0:text=0:bar_g=2:sono_g=2.4:` +
      `bar_v=10:sono_v=13:cscheme=${VIOLET}|${BLEU},` +
      `format=yuva420p[sp];` +
      `[a2]showwaves=s=${L}x${H - pair(H * 0.66)}:rate=30:mode=cline:colors=0xffa0d9|0x9ad0ff:draw=full:scale=sqrt,` +
      `format=yuva420p[on];` +
      `[sp][on]vstack=inputs=2,format=yuva420p[vis]`,
    fond: '0x120a24', accent: 'ff7ad9'
  }
};

/** Un fond qui dérive : des dégradés lents, pas une couleur plate. */
/**
 * QUELLES OPTIONS CETTE VERSION DE FFMPEG CONNAÎT-ELLE ?
 *
 * Les filtres gagnent des options au fil des versions. « gradients » accepte
 * « type=radial » depuis une version récente — sur ffmpeg 4.4, très répandu,
 * l'option n'existe pas et TOUT le rendu échoue sur ce seul mot.
 *
 * Supposer qu'une option existe, c'est fabriquer une panne pour quiconque a
 * une autre version. On demande donc à ffmpeg ce qu'il sait faire, une fois,
 * et on construit le filtre avec ce qui est réellement là.
 */
const OPTIONS_CACHE = {};

function optionsDe(filtre) {
  if (OPTIONS_CACHE[filtre]) return OPTIONS_CACHE[filtre];
  const r = spawnSync(ffmpegBin(), ['-hide_banner', '-h', `filter=${filtre}`],
    { encoding: 'utf8', timeout: 15000, windowsHide: true });
  const noms = new Set();
  for (const l of String(r.stdout || '').split('\n')) {
    const m = l.match(/^\s{2,}([a-z_0-9]+)\s+<[a-z_0-9]+>/i);
    if (m) noms.add(m[1]);
  }
  OPTIONS_CACHE[filtre] = noms;
  return noms;
}

function fondAnime({ L, H, secondes, ambiance, bpm }) {
  /**
   * Le fond doit rester EN ARRIÈRE. Le premier essai sortait un aplat
   * magenta saturé qui mangeait le visuel : le dégradé était aussi lumineux
   * que le sujet. On garde donc trois teintes très sombres et proches, et on
   * corrige la luminosité ensuite. Ce qui doit se voir, c'est le son.
   *
   * La dérive suit le tempo : une oscillation complète toutes les huit mesures.
   */
  const periode = bpm ? (60 / bpm) * 32 : 26;
  // speed est borné entre 1e-5 et 1 : on reste dans l'intervalle quoi qu'il arrive.
  const vitesse = Math.min(1, Math.max(0.00001, 1 / periode));
  const dispo = optionsDe('gradients');

  const args = [`s=${L}x${H}`];
  if (dispo.has('type')) args.push('type=radial');   // absent avant ffmpeg 5
  args.push(`c0=${ambiance.fond}`, 'c1=0x1e0f3a', 'c2=0x0c0618');
  if (dispo.has('nb_colors')) args.push('nb_colors=3');
  if (dispo.has('seed')) args.push('seed=11');
  if (dispo.has('duration')) args.push(`duration=${secondes}`);
  if (dispo.has('speed')) args.push(`speed=${vitesse.toFixed(5)}`);

  return `gradients=${args.join(':')},` +
         `format=yuv420p,eq=brightness=0.02:saturation=1.0:contrast=1.08[fond]`;
}

/**
 * Le montage sur le tempo : une pulsation de zoom à chaque temps fort.
 * `zoompan` prend une expression du temps, donc on peut y mettre le battement.
 */
function pulsation({ bpm, L, H, intensite = 0.035 }) {
  if (!bpm) return '';
  const periode = 60 / bpm;
  const attaque = (periode * 0.55).toFixed(4);
  /**
   * zoompan exige une taille réelle, « largeur x hauteur » : un littéral
   * comme « IWxIH » est refusé. Le défaut est resté invisible tant que le
   * tempo n’était pas détecté — en réparant la détection, on l’a fait sortir.
   * Une correction peut ainsi révéler un bug que la panne précédente cachait.
   *
   * La forme de l’enveloppe compte autant que la période : montée instantanée
   * sur le temps, puis relâchement au carré. C’est ce qui donne la sensation
   * du coup, là où une oscillation douce ne donnerait qu’un balancement mou.
   */
  return `,zoompan=z='1+${intensite}*pow(max(0\\,1-mod(time\\,${periode.toFixed(4)})/${attaque})\\,2)':` +
         `d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${L}x${H}:fps=30`;
}

export async function clipLocal({
  audio, format = 'paysage', ambiance = 'double',
  titre = '', artiste = 'CLENDAX', pulse = true, duree = null
} = {}) {
  if (!audio || !fs.existsSync(audio)) throw new Error(`Fichier audio introuvable : ${audio}`);
  const F = FORMATS[format];
  if (!F) throw new Error(`Format inconnu : ${format}. Choisir parmi ${Object.keys(FORMATS).join(', ')}.`);
  const A = AMBIANCES[ambiance];
  if (!A) throw new Error(`Ambiance inconnue : ${ambiance}. Choisir parmi ${Object.keys(AMBIANCES).join(', ')}.`);

  // On mesure le son pour de vrai : tempo, niveau, spectre.
  const mesure = await analyser(audio);
  const secondes = duree ? Math.min(duree, mesure.duree) : mesure.duree;
  if (!secondes || secondes < 1) throw new Error('Ce fichier audio ne dure rien.');

  const { l: L, h: H } = F;
  const graphe = [];

  // 1. Le visuel, calculé depuis le son lui-même.
  // Chaque ambiance déclare elle-même son entrée [0:a] : on ne la préfixe pas,
  // sinon le filtre reçoit deux fois la même source et le graphe refuse.
  graphe.push(A.visuel(L, H));

  // 2. Le fond animé.
  graphe.push(fondAnime({ L, H, secondes, ambiance: A, bpm: mesure.bpm }));

  // 3. Superposition, centrée.
  /**
   * Le halo. Un visualiseur brut est clinique : des traits nets sur du noir.
   * On duplique le visuel, on le floute largement, et on le rajoute par
   * transparence sous l’original. Les crêtes se mettent alors à rayonner —
   * c’est ce qui distingue une image de clip d’une courbe de laboratoire.
   */
  graphe.push(`[vis]split=2[v1][v2]`);
  graphe.push(`[v2]gblur=sigma=${Math.round(H / 48)},eq=brightness=0.04[halo]`);
  graphe.push(`[fond][halo]overlay=(W-w)/2:(H-h)/2:format=auto[avec_halo]`);
  graphe.push(`[avec_halo][v1]overlay=(W-w)/2:(H-h)/2:format=auto,` +
              /**
               * « eq » plutôt que « huesaturation » : ce dernier n'existe pas
               * avant ffmpeg 5, et sur une version 4.4 — très répandue — tout
               * le rendu échouait sur ce seul filtre. « eq » est présent depuis
               * des années partout, et sa saturation est un multiplicateur :
               * 1.18 au lieu du décalage 0.20 de l'autre.
               */
              `eq=saturation=1.18:brightness=0.015,format=yuv420p[sur]`);

  // 4. Pulsation sur le tempo, puis vignettage.
  const pul = pulse ? pulsation({ bpm: mesure.bpm, L, H }) : '';
  graphe.push(`[sur]scale=${L}:${H}${pul},vignette=PI/4.2,format=yuv420p[fini]`);

  // 5. Le titre, s’il y en a un. drawtext n’est pas toujours compilé :
  //    on vérifie avant, plutôt que de faire échouer tout le rendu pour un texte.
  const aTexte = spawnSync(ffmpegBin(), ['-hide_banner', '-filters'], { encoding: 'utf8', timeout: 15000 })
    .stdout?.includes('drawtext');
  let dernier = 'fini';
  if (titre && aTexte) {
    const t = e(titre.replace(/'/g, ''));
    const ar = e(String(artiste).replace(/'/g, ''));
    graphe.push(
      `[fini]drawtext=text='${t}':fontsize=${Math.round(H / 16)}:fontcolor=white@0.92:` +
      `x=(w-text_w)/2:y=h*0.08:box=0:alpha='min(1\\,max(0\\,(t-0.6)/1.2))*min(1\\,max(0\\,(5.5-t)/1.2))',` +
      `drawtext=text='${ar}':fontsize=${Math.round(H / 34)}:fontcolor=0x${A.accent}@0.85:` +
      `x=(w-text_w)/2:y=h*0.08+${Math.round(H / 13)}:` +
      `alpha='min(1\\,max(0\\,(t-1.1)/1.2))*min(1\\,max(0\\,(5.5-t)/1.2))'[titre]`);
    dernier = 'titre';
  }

  const sortie = path.join(MEDIA_DIR, `${uid('clip')}.mp4`);
  const args = ['-y', '-hide_banner',
    '-i', audio,
    '-filter_complex', graphe.join(';'),
    '-map', `[${dernier}]`, '-map', '0:a',
    '-t', String(secondes),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart',
    '-r', '30', sortie];

  const r = spawnSync(ffmpegBin(), args, { encoding: 'utf8', timeout: 1800000, maxBuffer: 1 << 26 });
  if (r.status !== 0) {
    const lignes = String(r.stderr || '').trim().split('\n');
    const utile = lignes.filter(l => /rror|nvalid|o such|nknown|ailed/i.test(l));
    throw new Error('Rendu impossible : ' + (utile.length ? utile : lignes.slice(-4)).join(' · ').slice(0, 420));
  }

  const st = fs.statSync(sortie);
  return store.insert('assets', {
    file: sortie, ext: 'mp4', bytes: st.size, kind: 'clip',
    url: `/media/${path.basename(sortie)}`,
    nom: titre || `Clip ${A.nom} — ${Math.round(secondes)} s`,
    detail: {
      type: 'clip-local', ambiance, format, formatNom: F.nom, ambianceNom: A.nom,
      secondes: +secondes.toFixed(1), largeur: L, hauteur: H,
      bpm: mesure.bpm, loudness: mesure.loudness?.integre ?? null,
      pulse: Boolean(pulse && mesure.bpm), titre: titre || null,
      mesure: {
        tempo: mesure.bpm ? `${mesure.bpm} battements/minute, mesuré sur les attaques` : 'tempo non détecté',
        niveau: mesure.loudness?.integre != null ? `${mesure.loudness.integre} LUFS` : null,
        spectre: mesure.spectre?.slice(0, 3).map(s => `${s.bande} ${s.dB} dB`).join(' · ')
      },
      sansModele: true,
      quoi: `Visuel calculé à partir du son lui-même : ${A.quoi.toLowerCase()} ` +
            (mesure.bpm && pulse ? `Les plans pulsent sur ${mesure.bpm} battements par minute, mesurés sur ce morceau.` : ''),
      honnete: 'Clip abstrait, fabriqué sans aucun modèle d’intelligence artificielle et sans réseau. ' +
               'Pour un clip avec des plans et un récit, il faut un modèle de texte et un fournisseur d’images : c’est l’autre chemin, dans « Clip ».'
    }
  });
}

/** Ce que ce chemin exige : rien. On le dit, parce que c’est l’argument. */
export function exigences() {
  const ff = ffmpegBin();
  const ok = spawnSync(ff, ['-version'], { encoding: 'utf8', timeout: 10000 }).status === 0;
  const filtres = ok ? spawnSync(ff, ['-hide_banner', '-filters'], { encoding: 'utf8', timeout: 15000 }).stdout || '' : '';
  const dispo = {};
  for (const f of ['showcqt', 'showwaves', 'showfreqs', 'avectorscope', 'gradients', 'zoompan', 'drawtext', 'vignette'])
    dispo[f] = filtres.includes(f);
  const manquants = Object.entries(dispo).filter(([, v]) => !v).map(([k]) => k);

  return {
    ffmpeg: ok, filtres: dispo, manquants,
    modele: false, cle: false, reseau: false,
    ambiances: Object.fromEntries(Object.entries(AMBIANCES)
      .filter(([, a]) => !manquants.some(m => String(a.visuel).includes(m)))
      .map(([k, a]) => [k, { nom: a.nom, quoi: a.quoi }])),
    verdict: !ok
      ? 'ffmpeg manque : aucun clip n’est possible, même par ce chemin.'
      : manquants.length
      ? `Possible, mais ${manquants.join(', ')} manque(nt) dans cette version de ffmpeg : certaines ambiances seront absentes.`
      : 'Possible tout de suite. Aucun modèle, aucune clé, aucun réseau : seulement le son et ffmpeg.'
  };
}
