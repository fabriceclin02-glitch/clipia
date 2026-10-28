/**
 * CLIPIA — Pipeline MUSIQUE → CLIP VIDÉO.
 *
 *  1. Analyse  : durée, BPM, énergie, détection des temps forts (ffmpeg)
 *  2. Paroles  : transcription horodatée mot à mot (Whisper / AssemblyAI / whisper.cpp)
 *  3. Scénario : un LLM découpe le morceau en scènes visuelles synchronisées
 *  4. Visuels  : génération des images/plans (Flux, SDXL, ComfyUI local…)
 *  5. Animation: image→vidéo (Luma, Runway, Kling) OU mouvement Ken Burns local
 *  6. Montage  : assemblage ffmpeg sur les temps forts + sous-titres karaoké
 *  7. Export   : 16:9 YouTube, 9:16 TikTok/Shorts/Reels, 1:1 Instagram
 *
 * Tout fonctionne hors ligne si vous utilisez Ollama + ComfyUI + whisper.cpp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { MEDIA_DIR } from '../providers/media.js';
import { generateImage, generateVideo, pollVideo, transcribe } from '../providers/media.js';
import { chat } from '../providers/gateway.js';
import { store, uid } from '../lib/store.js';
import { env, ffmpegBin, ffprobeBin } from '../lib/env.js';

const FFMPEG = () => ffmpegBin();
import { sondeJson } from '../lib/sonde.js';
const FFPROBE = () => ffprobeBin();

export function run(bin, args, { onLog } = {}) {
  return new Promise((resolve, reject) => {
    const ps = spawn(bin, args);
    let out = '', err = '';
    ps.stdout.on('data', d => { out += d; onLog?.(d.toString()); });
    ps.stderr.on('data', d => { err += d; onLog?.(d.toString()); });
    ps.on('error', e => reject(e.code === 'ENOENT'
      ? new Error(`L'outil « ${String(bin).replace(/\.exe$/i, '').split(/[\\/]/).pop()} » n'est pas installé sur cet ordinateur. Ouvre « Installation guidée » dans le menu : Clipia peut l'installer pour toi (ou place-le dans le dossier « outils » de Clipia).`)
      : e));
    ps.on('close', code => code === 0 ? resolve({ out, err }) : reject(new Error(`${bin} code ${code}\n${err.slice(-1500)}`)));
  });
}

export const RATIOS = {
  'youtube':   { w: 1920, h: 1080, label: '16:9 — YouTube' },
  'tiktok':    { w: 1080, h: 1920, label: '9:16 — TikTok / Shorts / Reels' },
  'instagram': { w: 1080, h: 1080, label: '1:1 — Instagram' },
  'cinema':    { w: 1920, h: 816,  label: '2.35:1 — cinéma' }
};

/** ÉTAPE 1 — Analyse audio : durée, BPM estimé, pics d'énergie. */
export async function analyzeAudio(audioPath) {
  const meta = sondeJson(audioPath);
  const duration = parseFloat(meta.format?.duration || 0);

  // Détection des onsets via le filtre de volume ffmpeg (échantillonnage 100 ms)
  const tmp = path.join(MEDIA_DIR, `${uid('an')}.txt`);
  await run(FFMPEG(), ['-hide_banner','-i', audioPath,
    '-af','astats=metadata=1:reset=0.1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=' + tmp,
    '-f','null','-']).catch(() => {});
  let levels = [];
  if (fs.existsSync(tmp)) {
    const txt = fs.readFileSync(tmp, 'utf8');
    for (const m of txt.matchAll(/frame:(\d+)\s+pts:\d+\s+pts_time:([\d.]+)[\s\S]*?RMS_level=(-?[\d.inf]+)/g)) {
      const v = parseFloat(m[3]);
      if (!Number.isNaN(v)) levels.push({ t: parseFloat(m[2]), db: v });
    }
    fs.unlinkSync(tmp);
  }
  // BPM estimé : intervalle médian entre les pics d'énergie
  const avg = levels.reduce((a, b) => a + b.db, 0) / (levels.length || 1);
  const peaks = levels.filter((l, i) => l.db > avg + 4 && (i === 0 || l.t - levels[i-1].t > 0.25)).map(l => l.t);
  const gaps = peaks.slice(1).map((t, i) => t - peaks[i]).filter(g => g > 0.25 && g < 2).sort((a,b)=>a-b);
  const medGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0.5;
  const bpm = Math.round(60 / medGap);

  return {
    duration,
    bpm: bpm > 50 && bpm < 220 ? bpm : 120,
    peaks: peaks.slice(0, 400),
    bitrate: meta.format?.bit_rate,
    channels: meta.streams?.[0]?.channels,
    sampleRate: meta.streams?.[0]?.sample_rate
  };
}

/** ÉTAPE 2 — Paroles horodatées. */
export async function extractLyrics(audioPath, { provider = 'openai-whisper', language = 'fr' } = {}) {
  if (provider === 'whispercpp') {
    const bin = env('WHISPERCPP_BIN', '');
    if (!bin) throw new Error('WHISPERCPP_BIN non défini');
    const outBase = path.join(MEDIA_DIR, uid('lyr'));
    await run(bin, ['-m', env('WHISPERCPP_MODEL','models/ggml-base.bin'), '-f', audioPath,
      '-l', language, '-oj', '-ml', '1', '-of', outBase]);
    const j = JSON.parse(fs.readFileSync(outBase + '.json', 'utf8'));
    const words = (j.transcription || []).map(s => ({
      word: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000
    }));
    return { text: words.map(w => w.word).join(' '), words, provider };
  }
  return transcribe({ provider, filePath: audioPath, language, wordTimestamps: true });
}

/** ÉTAPE 3 — Scénario : le LLM découpe la musique en scènes. */
export async function storyboard({ analysis, lyrics, style, provider = 'ollama', model = 'llama3.3', sceneCount, secondesParPlan = 8, genre = 'clip' }) {
  const n = sceneCount || Math.max(3, Math.min(30, Math.round(analysis.duration / secondesParPlan)));
  const ROLES = {
    clip: 'directeur artistique de clips musicaux',
    lyric: 'concepteur de lyric videos',
    explicative: 'réalisateur de vidéos explicatives',
    audiogramme: 'monteur d\'extraits de podcast',
    pub: 'directeur de création publicitaire',
    narratif: 'réalisateur de courts métrages',
    formation: 'concepteur pédagogique vidéo',
    diaporama: 'monteur de diaporamas'
  };
  const system = `Tu es ${ROLES[genre] || ROLES.clip}. Tu produis UNIQUEMENT du JSON valide, sans texte autour.`;
  const prompt = `Découpe cette piste sonore en ${n} scènes visuelles.
Durée totale : ${analysis.duration.toFixed(1)} s. BPM : ${analysis.bpm}.
Style visuel demandé : ${style || 'cinématographique, contrasté, grain argentique'}.
${lyrics?.text ? `Transcription :\n${lyrics.text.slice(0, 3000)}` : 'Piste sans paroles : appuie-toi sur le rythme et l\'ambiance.'}

Réponds avec ce JSON exact :
{"title":"...","palette":["#hex","#hex","#hex"],"scenes":[
 {"index":1,"start":0,"end":8,"prompt":"description visuelle riche en anglais pour un générateur d'images",
  "camera":"zoom lent avant","mood":"tendu","transition":"cut"}]}
Les scènes doivent couvrir 0 à ${analysis.duration.toFixed(1)} s sans trou ni chevauchement.`;

  const r = await chat(provider, { model, system, messages: [{ role: 'user', content: prompt }], temperature: 0.9, maxTokens: 4000 });
  const m = r.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Le modèle n\'a pas renvoyé de JSON exploitable.');
  const sb = JSON.parse(m[0]);
  // Garde-fou : on recale les bornes sur la durée réelle
  const step = analysis.duration / sb.scenes.length;
  sb.scenes = sb.scenes.map((s, i) => ({ ...s, index: i + 1, start: +(i * step).toFixed(2), end: +((i + 1) * step).toFixed(2) }));
  return sb;
}

/** ÉTAPE 4+5 — Visuels puis animation de chaque scène. */
export async function renderScenes(sb, { imageProvider = 'fal', imageModel, videoProvider = null, videoModel, ratio = 'youtube', onProgress } = {}) {
  const R = RATIOS[ratio] || RATIOS.youtube;
  const shots = [];
  for (const sc of sb.scenes) {
    onProgress?.({ step: 'image', scene: sc.index, total: sb.scenes.length });
    const full = `${sc.prompt}. ${sc.mood || ''}. ${sc.camera || ''}. cinematic, high detail, ${R.w}x${R.h}`;
    const imgs = await generateImage({ provider: imageProvider, model: imageModel, prompt: full, size: `${R.w}x${R.h}` });
    const img = imgs[0];
    let shot = { ...sc, image: img.url || img.file, duration: sc.end - sc.start };

    if (videoProvider) {
      onProgress?.({ step: 'animation', scene: sc.index, total: sb.scenes.length });
      const v = await generateVideo({ provider: videoProvider, model: videoModel, prompt: sc.prompt,
        imageUrl: img.url, duration: Math.min(10, Math.ceil(shot.duration)), ratio: ratio === 'tiktok' ? '9:16' : '16:9' });
      if (v.poll) {
        for (let i = 0; i < 100; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const s = await pollVideo(v);
          if (s.url) { shot.video = s.url; break; }
          if (/fail|error/i.test(s.state)) break;
        }
      } else shot.video = v.url;
    }
    shots.push(shot);
  }
  return shots;
}

/** Télécharge une URL distante dans le dossier média. */
async function fetchTo(url, ext) {
  if (!/^https?:/.test(url)) return url; // déjà local
  const r = await fetch(url);
  const file = path.join(MEDIA_DIR, `${uid('dl')}.${ext}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

/** ÉTAPE 6 — Sous-titres karaoké (.ass) mot à mot. */
export function buildKaraoke(words, { w, h, fontSize = 64, primary = '&H00FFFFFF', accent = '&H0000D7FF' }) {
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 2

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Clipia,Montserrat,${fontSize},${primary},${accent},&H00101010,&H88000000,-1,0,0,0,100,100,0,0,1,3.5,2,2,80,80,${Math.round(h*0.09)},1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;
  const ts = s => {
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = (s % 60);
    return `${hh}:${String(mm).padStart(2,'0')}:${ss.toFixed(2).padStart(5,'0')}`;
  };
  // Regroupement en lignes de 6 mots max / 3,5 s max
  const lines = []; let cur = [];
  for (const w2 of words) {
    cur.push(w2);
    const span = cur[cur.length-1].end - cur[0].start;
    if (cur.length >= 6 || span > 3.5) { lines.push(cur); cur = []; }
  }
  if (cur.length) lines.push(cur);

  const events = lines.map(line => {
    const start = line[0].start, end = line[line.length - 1].end + 0.15;
    const txt = line.map(wd => {
      const cs = Math.max(1, Math.round((wd.end - wd.start) * 100));
      return `{\\k${cs}}${wd.word.replace(/[{}\\]/g, '')} `;
    }).join('');
    return `Dialogue: 0,${ts(start)},${ts(end)},Clipia,,0,0,0,,{\\fad(120,120)}${txt.trim()}`;
  });
  return head + events.join('\n') + '\n';
}

/** ÉTAPE 7 — Montage final ffmpeg. */
export async function assemble({ audioPath, shots, analysis, lyrics, ratio = 'youtube', outName,
  karaoke = true, kenBurns = true, onLog } = {}) {
  const R = RATIOS[ratio] || RATIOS.youtube;
  const work = path.join(MEDIA_DIR, uid('clip'));
  fs.mkdirSync(work, { recursive: true });

  // 1) Chaque plan devient un segment vidéo à la bonne durée
  const segs = [];
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const seg = path.join(work, `seg${String(i).padStart(3,'0')}.mp4`);
    const d = Math.max(0.5, s.duration);
    if (s.video) {
      const src = await fetchTo(s.video, 'mp4');
      await run(FFMPEG(), ['-y','-i',src,'-t',String(d),
        '-vf',`scale=${R.w}:${R.h}:force_original_aspect_ratio=increase,crop=${R.w}:${R.h},fps=30`,
        '-c:v','libx264','-pix_fmt','yuv420p','-an',seg], { onLog });
    } else {
      const src = await fetchTo(s.image, 'png');
      // Ken Burns : zoom/panoramique lent pour donner vie à une image fixe
      const frames = Math.round(d * 30);
      const zp = kenBurns
        ? `zoompan=z='min(zoom+0.0012,1.25)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${R.w}x${R.h}:fps=30`
        : `scale=${R.w}:${R.h}`;
      await run(FFMPEG(), ['-y','-loop','1','-i',src,'-t',String(d),
        '-vf',`scale=${R.w*2}:-2,${zp},format=yuv420p`,
        '-c:v','libx264','-r','30',seg], { onLog });
    }
    segs.push(seg);
  }

  // 2) Concaténation
  const listFile = path.join(work, 'list.txt');
  fs.writeFileSync(listFile, segs.map(s => `file '${s}'`).join('\n'));
  const silent = path.join(work, 'video.mp4');
  await run(FFMPEG(), ['-y','-f','concat','-safe','0','-i',listFile,'-c','copy',silent], { onLog });

  // 3) Sous-titres karaoké
  let vfilter = [];
  if (karaoke && lyrics?.words?.length) {
    const ass = path.join(work, 'lyrics.ass');
    fs.writeFileSync(ass, buildKaraoke(lyrics.words, { w: R.w, h: R.h, fontSize: ratio === 'tiktok' ? 72 : 56 }));
    vfilter.push(`subtitles='${ass.replace(/'/g, "\\'")}'`);
  }
  // Léger étalonnage + vignettage pour un rendu "clip"
  vfilter.push('eq=contrast=1.08:saturation=1.12', 'vignette=PI/5');

  const out = path.join(MEDIA_DIR, `${outName || uid('final')}.mp4`);
  await run(FFMPEG(), ['-y','-i',silent,'-i',audioPath,
    '-vf', vfilter.join(','),
    '-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart', out], { onLog });

  fs.rmSync(work, { recursive: true, force: true });
  const stat = fs.statSync(out);
  return store.insert('assets', {
    file: out, ext: 'mp4', bytes: stat.size, kind: 'video',
    url: `/media/${path.basename(out)}`, ratio, duration: analysis?.duration, scenes: shots.length
  });
}

/** Orchestration complète. */
export async function musicToClip(opts) {
  const { audioPath, style, ratio = 'youtube', genre = 'clip', secondesParPlan = 8,
    llm = { provider: 'ollama', model: 'llama3.3' },
    imageProvider = 'fal', imageModel, videoProvider = null, videoModel,
    lyricsProvider = 'openai-whisper', language = 'fr', withLyrics = true, onProgress } = opts;

  onProgress?.({ step: 'analyse', pct: 5 });
  const analysis = await analyzeAudio(audioPath);

  let lyrics = null;
  if (withLyrics) {
    onProgress?.({ step: 'paroles', pct: 15 });
    try { lyrics = await extractLyrics(audioPath, { provider: lyricsProvider, language }); }
    catch (e) { onProgress?.({ step: 'paroles', warn: e.message }); }
  }

  onProgress?.({ step: 'scénario', pct: 30 });
  const sb = await storyboard({ analysis, lyrics, style, genre, secondesParPlan, provider: llm.provider, model: llm.model });

  onProgress?.({ step: 'visuels', pct: 40 });
  const shots = await renderScenes(sb, { imageProvider, imageModel, videoProvider, videoModel, ratio,
    onProgress: p => onProgress?.({ ...p, pct: 40 + Math.round(40 * p.scene / p.total) }) });

  onProgress?.({ step: 'montage', pct: 85 });
  const asset = await assemble({ audioPath, shots, analysis, lyrics, ratio, karaoke: withLyrics });

  onProgress?.({ step: 'terminé', pct: 100 });
  return { asset, analysis, storyboard: sb, shots, lyrics };
}
