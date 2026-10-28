/**
 * CLIPIA — Utilitaires. Tout en local, tout gratuit, rien qui sort d’ici.
 *
 * Ces outils travaillent sur TES fichiers, avec ffmpeg et les outils du
 * système. Aucun service distant, aucun quota, aucune limite de taille.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  SUR SUNO ET YOUTUBE, UNE MISE AU POINT NÉCESSAIRE
 * ────────────────────────────────────────────────────────────────────────
 *  Suno : tes morceaux à toi se téléchargent depuis Suno, en MP3 ou en WAV,
 *  par le bouton de téléchargement de la plateforme. Clipia reprend ensuite
 *  le fichier pour le convertir, le normaliser au niveau des plateformes,
 *  séparer les pistes, en tirer un clip. C’est le bon chemin, et il est
 *  entièrement légitime : c’est ton œuvre.
 *
 *  YouTube : Clipia ne télécharge pas l’audio de vidéos YouTube. Ce n’est
 *  pas de la pudeur, c’est que les conditions d’utilisation de YouTube
 *  l’interdisent et que la musique qu’on y trouve appartient à quelqu’un.
 *  Un outil qui t’aiderait à récupérer l’œuvre d’un autre te mettrait en
 *  faute, et je ne vais pas te mettre en faute.
 *
 *  En revanche, pour TES propres vidéos — la chaîne @FABRICEclin — YouTube
 *  Studio propose le téléchargement de tes fichiers d’origine : menu Contenu,
 *  les trois points sur la vidéo, « Télécharger ». Tu récupères ton master,
 *  et Clipia fait tout le reste ici. Même chose pour TikTok et Instagram :
 *  tes publications se retéléchargent depuis ton propre compte.
 *
 *  Et pour la musique d’autrui dont tu as besoin légalement, les banques
 *  libres de droits existent : la bibliothèque audio de YouTube Studio,
 *  Free Music Archive, ccMixter, Pixabay Music.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';
import { ffmpegBin, ffprobeBin, binaire } from '../lib/env.js';

const SORTIE = (ext, p = 'util') => path.join(MEDIA_DIR, `${uid(p)}.${ext}`);

function ff(args, duree = 600000) {
  const r = spawnSync(ffmpegBin(), ['-y', '-hide_banner', ...args],
    { encoding: 'utf8', timeout: duree, maxBuffer: 1 << 26, windowsHide: true });
  if (r.error) throw new Error(`ffmpeg n’a pas pu démarrer : ${r.error.message}`);
  if (r.status !== 0) {
    const lignes = String(r.stderr || '').trim().split('\n');
    const utile = lignes.filter(l => /rror|nvalid|o such|nknown|ailed|ermission/i.test(l));
    throw new Error((utile.length ? utile : lignes.slice(-3)).join(' · ').slice(0, 420));
  }
  return r.stderr || '';
}

/** Le nom d’origine, sans le préfixe technique du téléversement. */
function nomLisible(chemin) {
  return path.basename(String(chemin || '')).replace(/^up_[0-9a-f]+_/, '');
}

function deposer(fichier, kind, nom, detail = {}) {
  const st = fs.statSync(fichier);
  return store.insert('assets', {
    file: fichier, ext: path.extname(fichier).slice(1), bytes: st.size, kind,
    url: `/media/${path.basename(fichier)}`, nom, detail
  });
}

/** Ce que contient réellement un fichier, avant de décider quoi en faire. */
import { sondeJson } from '../lib/sonde.js';
export function sonder(chemin) {
  const j = sondeJson(chemin);
  const a = (j.streams || []).find(s => s.codec_type === 'audio');
  const v = (j.streams || []).find(s => s.codec_type === 'video');
  return {
    duree: +(+j.format?.duration || 0).toFixed(2),
    octets: +j.format?.size || 0,
    conteneur: j.format?.format_name,
    debit: j.format?.bit_rate ? Math.round(j.format.bit_rate / 1000) + ' kbit/s' : null,
    audio: a ? { codec: a.codec_name, canaux: a.channels, echantillonnage: +a.sample_rate } : null,
    video: v ? { codec: v.codec_name, largeur: v.width, hauteur: v.height,
                 images: v.r_frame_rate ? +(eval(v.r_frame_rate)).toFixed(2) : null } : null,
    titre: j.format?.tags?.title || null,
    artiste: j.format?.tags?.artist || null
  };
}

/** ── FORMATS ─────────────────────────────────────────────────────────── */
export const FORMATS_AUDIO = {
  mp3:  { ext:'mp3',  args:['-c:a','libmp3lame','-q:a','1'],         quoi:'Le plus compatible. Qualité ~245 kbit/s en variable.' },
  mp3_320:{ ext:'mp3',args:['-c:a','libmp3lame','-b:a','320k'],      quoi:'MP3 au maximum, 320 kbit/s constant. Pour la diffusion.' },
  wav:  { ext:'wav',  args:['-c:a','pcm_s16le'],                     quoi:'Sans perte, non compressé. Pour le montage et le mastering.' },
  flac: { ext:'flac', args:['-c:a','flac','-compression_level','8'], quoi:'Sans perte et compressé : la qualité du WAV, la moitié du poids.' },
  m4a:  { ext:'m4a',  args:['-c:a','aac','-b:a','256k'],             quoi:'AAC. Le format d’Apple, excellent rendement.' },
  opus: { ext:'opus', args:['-c:a','libopus','-b:a','128k'],         quoi:'Le plus efficace aujourd’hui. Idéal pour la voix et le web.' },
  ogg:  { ext:'ogg',  args:['-c:a','libvorbis','-q:a','6'],          quoi:'Libre, bien supporté par les navigateurs.' }
};

export const FORMATS_VIDEO = {
  mp4:   { ext:'mp4',  args:['-c:v','libx264','-preset','medium','-crf','21','-c:a','aac','-b:a','192k','-movflags','+faststart'], quoi:'Le format universel. Lisible partout.' },
  mp4_hd:{ ext:'mp4',  args:['-c:v','libx264','-preset','slow','-crf','18','-c:a','aac','-b:a','256k','-movflags','+faststart'],   quoi:'Même format, qualité supérieure, fichier plus lourd.' },
  webm:  { ext:'webm', args:['-c:v','libvpx-vp9','-crf','32','-b:v','0','-c:a','libopus','-b:a','128k'],                            quoi:'Libre et léger, pour le web. Encodage plus lent.' },
  gif:   { ext:'gif',  args:[],                                                                                                     quoi:'Image animée, sans son. Lourd : réservé aux extraits courts.' }
};

/** Niveaux visés par les plateformes. Vérifiés, pas inventés. */
export const CIBLES_SONORES = {
  youtube:   { lufs:-14, pic:-1.0, quoi:'YouTube normalise à -14 LUFS. Au-delà, la plateforme baisse le volume elle-même.' },
  spotify:   { lufs:-14, pic:-1.0, quoi:'Spotify vise -14 LUFS en réglage normal.' },
  tiktok:    { lufs:-14, pic:-1.0, quoi:'TikTok et Instagram tournent autour de -14 LUFS.' },
  soundcloud:{ lufs:-14, pic:-1.0, quoi:'SoundCloud ne normalise pas, mais -14 reste un bon repère.' },
  podcast:   { lufs:-16, pic:-1.0, quoi:'Norme usuelle du podcast : -16 LUFS en stéréo.' },
  diffusion: { lufs:-23, pic:-1.0, quoi:'Norme européenne EBU R128 pour la télévision et la radio.' }
};

/** ── CONVERSION ──────────────────────────────────────────────────────── */
export function convertirAudio({ chemin, format = 'mp3', depart, duree }) {
  const f = FORMATS_AUDIO[format];
  if (!f) throw new Error(`Format inconnu : ${format}. Choisir parmi ${Object.keys(FORMATS_AUDIO).join(', ')}.`);
  const avant = sonder(chemin);
  const out = SORTIE(f.ext, 'conv');
  ff([...(depart ? ['-ss', String(depart)] : []), '-i', chemin,
      ...(duree ? ['-t', String(duree)] : []), '-vn', ...f.args, out]);
  const apres = sonder(out);
  return deposer(out, 'conversion', `${nomLisible(chemin).slice(0, 44)} → ${format}`, {
    format, avant, apres,
    gain: avant.octets ? `${(100 - apres.octets / avant.octets * 100).toFixed(0)} % de poids en moins` : null,
    quoi: f.quoi
  });
}

/** Extraire la bande son d’une vidéo — y compris la tienne, récupérée chez toi. */
export function extraireAudio({ chemin, format = 'mp3' }) {
  const info = sonder(chemin);
  if (!info.audio) throw new Error('Ce fichier ne contient aucune piste audio.');
  const r = convertirAudio({ chemin, format });
  r.nom = `Bande son extraite — ${format}`;
  r.detail.source = info.video ? `vidéo ${info.video.largeur}×${info.video.hauteur}` : 'audio';
  return r;
}

export function convertirVideo({ chemin, format = 'mp4', largeur }) {
  const f = FORMATS_VIDEO[format];
  if (!f) throw new Error(`Format inconnu : ${format}.`);
  const avant = sonder(chemin);
  const out = SORTIE(f.ext, 'vid');

  if (format === 'gif') {
    // Palette dédiée : sans elle, un GIF est sale et bien plus lourd.
    const l = largeur || 480;
    const pal = SORTIE('png', 'pal');
    ff(['-i', chemin, '-vf', `fps=12,scale=${l}:-1:flags=lanczos,palettegen=stats_mode=diff`, pal]);
    ff(['-i', chemin, '-i', pal, '-lavfi',
        `fps=12,scale=${l}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, out]);
    try { fs.unlinkSync(pal); } catch {}
  } else {
    ff(['-i', chemin, ...(largeur ? ['-vf', `scale=${largeur}:-2`] : []), ...f.args, out]);
  }
  return deposer(out, 'conversion', `Vidéo → ${format}`, { format, avant, apres: sonder(out), quoi: f.quoi });
}

/** ── MASTERING ───────────────────────────────────────────────────────── */

/**
 * Normalisation en deux passes : la première mesure, la seconde corrige.
 * Une seule passe ne fait qu’estimer et rate la cible de plusieurs décibels.
 */
export function normaliser({ chemin, cible = 'youtube' }) {
  const c = CIBLES_SONORES[cible];
  if (!c) throw new Error(`Cible inconnue : ${cible}. Choisir parmi ${Object.keys(CIBLES_SONORES).join(', ')}.`);

  const mesure = ff(['-i', chemin, '-af', `loudnorm=I=${c.lufs}:TP=${c.pic}:LRA=11:print_format=json`,
                     '-f','null','-']);
  const bloc = mesure.slice(mesure.lastIndexOf('{'), mesure.lastIndexOf('}') + 1);
  let m = {};
  try { m = JSON.parse(bloc); } catch { /* on continuera en une passe */ }

  const out = SORTIE('wav', 'norm');
  const filtre = m.input_i
    ? `loudnorm=I=${c.lufs}:TP=${c.pic}:LRA=11:measured_I=${m.input_i}:measured_LRA=${m.input_lra}` +
      `:measured_TP=${m.input_tp}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : `loudnorm=I=${c.lufs}:TP=${c.pic}:LRA=11`;
  ff(['-i', chemin, '-af', filtre, '-c:a','pcm_s24le', out]);

  return deposer(out, 'mastering', `Normalisé pour ${cible} — ${c.lufs} LUFS`, {
    cible, visee: c, deuxPasses: Boolean(m.input_i),
    avant: m.input_i ? { lufs: +m.input_i, pic: +m.input_tp, plage: +m.input_lra } : null,
    apres: m.output_i ? { lufs: +m.output_i, pic: +m.output_tp, plage: +m.output_lra } : null,
    quoi: c.quoi,
    lecture: m.input_i
      ? `Mesuré à ${(+m.input_i).toFixed(1)} LUFS, corrigé de ${(c.lufs - m.input_i).toFixed(1)} dB.`
      : 'Normalisation en une passe : la mesure n’a pas pu être lue, le résultat est approché.'
  });
}

export function couperSilences({ chemin, seuil = -45, duree = 0.6 }) {
  const out = SORTIE('wav', 'sil');
  const avant = sonder(chemin);
  ff(['-i', chemin, '-af',
      `silenceremove=start_periods=1:start_duration=${duree}:start_threshold=${seuil}dB:` +
      `stop_periods=-1:stop_duration=${duree}:stop_threshold=${seuil}dB:detection=peak`,
      '-c:a','pcm_s16le', out]);
  const apres = sonder(out);
  return deposer(out, 'montage', 'Silences retirés', {
    avant: avant.duree, apres: apres.duree,
    gagne: +(avant.duree - apres.duree).toFixed(2),
    lecture: `${(avant.duree - apres.duree).toFixed(1)} seconde(s) de silence retirée(s) sur ${avant.duree.toFixed(1)}.`
  });
}

/** Changer la vitesse. Sans toucher à la hauteur si on ne le demande pas. */
export function vitesse({ chemin, facteur = 1.0, garderHauteur = true }) {
  if (facteur < 0.25 || facteur > 4) throw new Error('Facteur hors limites : entre 0,25 et 4.');
  const out = SORTIE('wav', 'vit');
  let filtre;
  if (garderHauteur) {
    // atempo ne va que de 0,5 à 2 : on enchaîne pour aller au-delà.
    const etapes = [];
    let reste = facteur;
    while (reste > 2) { etapes.push(2); reste /= 2; }
    while (reste < 0.5) { etapes.push(0.5); reste /= 0.5; }
    etapes.push(+reste.toFixed(4));
    filtre = etapes.map(e => `atempo=${e}`).join(',');
  } else {
    filtre = `asetrate=48000*${facteur},aresample=48000`;
  }
  ff(['-i', chemin, '-af', filtre, '-c:a','pcm_s16le', out]);
  return deposer(out, 'montage', `Vitesse ×${facteur}`, {
    facteur, garderHauteur,
    quoi: garderHauteur
      ? 'La hauteur des notes est préservée : seul le tempo change.'
      : 'La hauteur suit la vitesse, comme un disque accéléré.'
  });
}

export function decouper({ chemin, depart = 0, fin, fondu = 0 }) {
  const info = sonder(chemin);
  const duree = (fin != null ? fin : info.duree) - depart;
  if (duree <= 0) throw new Error('Intervalle vide : la fin doit suivre le début.');
  const audioSeul = !info.video;
  const out = SORTIE(audioSeul ? 'wav' : 'mp4', 'coupe');
  const af = fondu
    ? ['-af', `afade=t=in:d=${fondu},afade=t=out:st=${Math.max(0, duree - fondu)}:d=${fondu}`]
    : [];
  ff(['-ss', String(depart), '-i', chemin, '-t', String(duree), ...af,
      ...(audioSeul ? ['-c:a','pcm_s16le'] : ['-c:v','libx264','-crf','20','-c:a','aac','-b:a','192k']), out]);
  return deposer(out, 'montage', `Extrait ${depart}s → ${(depart + duree).toFixed(1)}s`,
    { depart, duree: +duree.toFixed(2), fondu });
}

export function assembler({ chemins = [], fondu = 0 }) {
  if (chemins.length < 2) throw new Error('Il faut au moins deux fichiers à assembler.');
  const out = SORTIE('wav', 'assemble');
  const entrees = chemins.flatMap(c => ['-i', c]);
  const filtre = fondu
    ? chemins.map((_, i) => `[${i}:a]`).join('') +
      `concat=n=${chemins.length}:v=0:a=1,afade=t=in:d=${fondu},afade=t=out:d=${fondu}[a]`
    : chemins.map((_, i) => `[${i}:a]`).join('') + `concat=n=${chemins.length}:v=0:a=1[a]`;
  ff([...entrees, '-filter_complex', filtre, '-map','[a]','-c:a','pcm_s16le', out]);
  return deposer(out, 'montage', `${chemins.length} fichiers assemblés`,
    { nombre: chemins.length, duree: sonder(out).duree });
}

/** ── IMAGES DU SON ───────────────────────────────────────────────────── */
export function formeOnde({ chemin, largeur = 1600, hauteur = 400, couleur = 'c9a0ff' }) {
  const out = SORTIE('png', 'onde');
  ff(['-i', chemin, '-filter_complex',
      `showwavespic=s=${largeur}x${hauteur}:colors=0x${couleur}:split_channels=1`,
      '-frames:v','1', out]);
  return deposer(out, 'visuel', 'Forme d’onde', { largeur, hauteur });
}

export function spectrogramme({ chemin, largeur = 1600, hauteur = 600 }) {
  const out = SORTIE('png', 'spectre');
  ff(['-i', chemin, '-lavfi',
      `showspectrumpic=s=${largeur}x${hauteur}:legend=1:color=intensity:scale=log`, out]);
  return deposer(out, 'visuel', 'Spectrogramme', {
    largeur, hauteur,
    lecture: 'Le temps en abscisse, la fréquence en ordonnée, l’intensité en couleur. Un mur net vers 16 kHz trahit un MP3 ; un spectre qui monte jusqu’à 22 kHz indique une source sans perte.'
  });
}

export function vignette({ chemin, seconde = 1, largeur = 1280 }) {
  const out = SORTIE('jpg', 'vig');
  ff(['-ss', String(seconde), '-i', chemin, '-frames:v','1',
      '-vf', `scale=${largeur}:-2`, '-q:v','2', out]);
  return deposer(out, 'visuel', `Vignette à ${seconde} s`, { seconde, largeur });
}

/** ── ÉTIQUETTES ──────────────────────────────────────────────────────── */
export function etiqueter({ chemin, titre, artiste, album, annee, genre, pochette }) {
  const ext = path.extname(chemin).slice(1) || 'mp3';
  const out = SORTIE(ext, 'tag');
  const meta = [];
  for (const [k, v] of Object.entries({ title: titre, artist: artiste, album, date: annee, genre }))
    if (v) meta.push('-metadata', `${k}=${v}`);
  const args = ['-i', chemin];
  if (pochette) args.push('-i', pochette);
  args.push('-map','0:a', ...(pochette ? ['-map','1:v','-disposition:v','attached_pic'] : []),
            '-c','copy', ...meta, out);
  ff(args);
  return deposer(out, 'conversion', `Étiquettes : ${titre || nomLisible(chemin)}`,
    { titre, artiste, album, annee, genre, pochette: Boolean(pochette) });
}

/** ── DOCUMENTS ───────────────────────────────────────────────────────── */
export function outilsSysteme() {
  const liste = {
    ffmpeg:    { bin: binaire('ffmpeg'),  quoi:'audio et vidéo', requis: true },
    ffprobe:   { bin: binaire('ffprobe'), quoi:'analyse des fichiers', requis: true },
    convert:   { bin: binaire('convert'), quoi:'images : recadrage, conversion, planches' },
    pdftoppm:  { bin: binaire('pdftoppm'),quoi:'PDF vers images' },
    pdftotext: { bin: binaire('pdftotext'),quoi:'texte d’un PDF' },
    tesseract: { bin: binaire('tesseract'),quoi:'reconnaissance de texte sur image (OCR)' },
    demucs:    { bin: binaire('demucs'),  quoi:'séparation des pistes : voix, batterie, basse' }
  };
  const manquants = Object.entries(liste).filter(([, v]) => !v.bin).map(([k]) => k);
  return {
    outils: liste, manquants,
    verdict: liste.ffmpeg.bin
      ? `ffmpeg est en place. ${manquants.length ? `Outils absents, donc fonctions désactivées : ${manquants.join(', ')}.` : 'Tous les outils sont présents.'}`
      : 'ffmpeg manque : aucune conversion n’est possible. C’est la seule dépendance vraiment indispensable.'
  };
}

export function pdfVersImages({ chemin, resolution = 150 }) {
  if (!binaire('pdftoppm')) throw new Error('pdftoppm absent : la conversion de PDF en images n’est pas disponible sur cette machine.');
  const base = path.join(MEDIA_DIR, uid('pdf'));
  const r = spawnSync(binaire('pdftoppm'), ['-png','-r', String(resolution), chemin, base],
    { encoding: 'utf8', timeout: 300000, windowsHide: true });
  if (r.status !== 0) throw new Error('Conversion impossible : ' + String(r.stderr).slice(0, 200));
  const pages = fs.readdirSync(MEDIA_DIR).filter(f => f.startsWith(path.basename(base))).sort();
  return {
    pages: pages.map(f => ({ nom: f, url: `/media/${f}` })),
    nombre: pages.length, resolution
  };
}

export function texteDuPdf({ chemin }) {
  if (!binaire('pdftotext')) throw new Error('pdftotext absent sur cette machine.');
  const r = spawnSync(binaire('pdftotext'), ['-layout', chemin, '-'],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 1 << 26, windowsHide: true });
  if (r.status !== 0) throw new Error('Lecture impossible : ' + String(r.stderr).slice(0, 200));
  const texte = r.stdout || '';
  return {
    texte, caracteres: texte.length, mots: texte.split(/\s+/).filter(Boolean).length,
    lecture: texte.trim().length < 40
      ? 'Presque aucun texte extrait : ce PDF est probablement un scan. Passez par la reconnaissance de texte (OCR).'
      : `${texte.split(/\s+/).filter(Boolean).length} mots extraits.`
  };
}

/** Les langues dont les données sont réellement installées. */
export function languesOcr() {
  const t = binaire('tesseract');
  if (!t) return [];
  const r = spawnSync(t, ['--list-langs'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
  return String(r.stdout || '').split('\n').slice(1).map(x => x.trim()).filter(Boolean);
}

export function ocr({ chemin, langue = 'fra' }) {
  if (!binaire('tesseract')) throw new Error('tesseract absent : la reconnaissance de texte n’est pas disponible sur cette machine.');

  /**
   * Chaque langue de tesseract a son fichier de données, installé séparément.
   * Demander « fra » sans le paquet français donne une erreur de chemin
   * incompréhensible. On vérifie donc avant, et on propose ce qui existe.
   */
  const dispo = languesOcr();
  if (dispo.length && !dispo.includes(langue)) {
    const repli = dispo.includes('eng') ? 'eng' : dispo[0];
    if (!repli) throw new Error('Aucune langue installée pour la reconnaissance de texte.');
    const r2 = spawnSync(binaire('tesseract'), [chemin, 'stdout', '-l', repli],
      { encoding: 'utf8', timeout: 180000, maxBuffer: 1 << 26, windowsHide: true });
    if (r2.status !== 0) throw new Error('OCR impossible : ' + String(r2.stderr).slice(0, 200));
    const txt = r2.stdout || '';
    return { texte: txt, caracteres: txt.length, langue: repli, langueDemandee: langue,
      languesDisponibles: dispo,
      lecture: `Les données « ${langue} » ne sont pas installées : lecture faite en « ${repli} », donc les accents et les mots français peuvent être mal reconnus. Langues disponibles ici : ${dispo.join(', ')}.` };
  }

  const r = spawnSync(binaire('tesseract'), [chemin, 'stdout', '-l', langue],
    { encoding: 'utf8', timeout: 180000, maxBuffer: 1 << 26, windowsHide: true });
  if (r.status !== 0) {
    const e = String(r.stderr);
    if (/data file|tessdata/i.test(e))
      throw new Error(`Les données de langue « ${langue} » sont absentes. Installées ici : ${dispo.join(', ') || 'aucune'}.`);
    throw new Error('OCR impossible : ' + e.slice(0, 220));
  }
  const texte = r.stdout || '';
  return { texte, caracteres: texte.length, langue, languesDisponibles: dispo,
    lecture: texte.trim() ? `${texte.split(/\s+/).filter(Boolean).length} mots reconnus.` : 'Aucun texte reconnu sur cette image.' };
}

/** ── LE CATALOGUE, POUR L’INTERFACE ──────────────────────────────────── */
export const CATALOGUE = [
  { groupe:'Audio', outils:[
    { id:'convertir-audio', nom:'Convertir un audio', entree:'audio',
      quoi:'Vers MP3, WAV, FLAC, M4A, Opus, OGG. Y compris tes fichiers Suno.',
      options:{ format:Object.keys(FORMATS_AUDIO) } },
    { id:'extraire-audio', nom:'Extraire la bande son d’une vidéo', entree:'video',
      quoi:'La piste audio d’une vidéo, en MP3 ou sans perte. Pour tes propres vidéos récupérées depuis ton compte.',
      options:{ format:Object.keys(FORMATS_AUDIO) } },
    { id:'normaliser', nom:'Normaliser pour une plateforme', entree:'audio',
      quoi:'Amène le morceau au niveau attendu par YouTube, Spotify, TikTok. Mesure puis corrige, en deux passes.',
      options:{ cible:Object.keys(CIBLES_SONORES) } },
    { id:'couper-silences', nom:'Retirer les silences', entree:'audio',
      quoi:'Enlève les blancs au début, à la fin et au milieu. Pratique sur une voix enregistrée.' },
    { id:'vitesse', nom:'Changer la vitesse', entree:'audio',
      quoi:'Accélère ou ralentit, en gardant la hauteur des notes — ou pas, si tu veux l’effet.' },
    { id:'decouper', nom:'Découper un extrait', entree:'audio',
      quoi:'Un passage précis, avec fondus optionnels.' },
    { id:'assembler', nom:'Assembler plusieurs fichiers', entree:'audio-multiple',
      quoi:'Met bout à bout, avec fondus entre les morceaux.' },
    { id:'etiqueter', nom:'Étiquettes et pochette', entree:'audio',
      quoi:'Titre, artiste, album, année, genre et image de couverture.' }
  ]},
  { groupe:'Vidéo et images', outils:[
    { id:'convertir-video', nom:'Convertir une vidéo', entree:'video',
      quoi:'Vers MP4, WebM ou GIF animé, avec redimensionnement.',
      options:{ format:Object.keys(FORMATS_VIDEO) } },
    { id:'vignette', nom:'Extraire une image', entree:'video',
      quoi:'Une image à la seconde choisie. Pour une miniature.' },
    { id:'forme-onde', nom:'Dessiner la forme d’onde', entree:'audio',
      quoi:'L’image du son, aux couleurs de Clipia. Pour un visuel de clip.' },
    { id:'spectrogramme', nom:'Spectrogramme', entree:'audio',
      quoi:'Révèle la qualité réelle d’un fichier : un mur à 16 kHz trahit un MP3 réencodé.' }
  ]},
  { groupe:'Texte et documents', outils:[
    { id:'traduire', nom:'Traduire', entree:'texte',
      quoi:'Vers une trentaine de langues, par les modèles gratuits ou un modèle local.' },
    { id:'transcrire', nom:'Transcrire un audio', entree:'audio',
      quoi:'La parole en texte, avec sous-titres horodatés.' },
    { id:'texte-pdf', nom:'Texte d’un PDF', entree:'document', quoi:'Extraction du texte en conservant la mise en page.' },
    { id:'pdf-images', nom:'PDF vers images', entree:'document', quoi:'Une image par page.' },
    { id:'ocr', nom:'Lire le texte d’une image', entree:'image',
      quoi:'Reconnaissance de caractères, y compris sur un scan ou une photo de document.' }
  ]}
];

export const SUR_YOUTUBE = {
  reponse: 'Clipia ne télécharge pas l’audio des vidéos YouTube.',
  pourquoi: 'Les conditions d’utilisation de YouTube l’interdisent, et la musique qu’on y trouve appartient à quelqu’un. Un outil qui t’aiderait à récupérer l’œuvre d’un autre te mettrait en faute — et te mettre en faute serait un mauvais service.',
  tesVideos: 'Pour TES vidéos, c’est différent et c’est simple : YouTube Studio → Contenu → les trois points sur la vidéo → Télécharger. Tu récupères ton fichier d’origine, et tous les outils ci-dessus s’appliquent. Même principe pour tes publications TikTok et Instagram.',
  tesMorceaux: 'Pour Suno, le bouton de téléchargement de la plateforme donne le MP3 ou le WAV de tes créations. Clipia reprend ensuite la main : conversion, normalisation au niveau des plateformes, forme d’onde, clip.',
  musiqueLibre: 'Et pour de la musique d’autrui utilisable légalement : la bibliothèque audio de YouTube Studio, Free Music Archive, ccMixter, Pixabay Music. Libre de droits, et aucune mauvaise surprise le jour où une vidéo marche.'
};
