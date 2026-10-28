/** CLIPIA X7 — Studio montage : prompt → plan de scènes → images / musique → timeline → export MP4 (ffmpeg), façon CapCut / Canva.
 *  Marche même sans service d'images : une carte colorée de secours remplace l'image, et le dit. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { MEDIA_DIR } from '../providers/media.js';
import { ffmpegBin } from '../lib/env.js';
import { chat } from '../providers/gateway.js';
import { chaine } from './demarrage.js';

const FORMATS = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1080, 1080] };
const FILTRES = { aucun: '', noirblanc: 'hue=s=0', chaud: 'colorbalance=rs=.15:gs=.03:bs=-.12', froid: 'colorbalance=rs=-.1:bs=.15', vif: 'eq=saturation=1.5:contrast=1.08', sombre: 'eq=brightness=-0.12:contrast=1.1' };
const PALETTES = [['#4b3bb0', '#0e0a28'], ['#0f766e', '#042f2e'], ['#be185d', '#3b0a24'], ['#b45309', '#2b1503'], ['#1d4ed8', '#0a1030']];
const sansPensee = (t) => String(t || '').replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
const id = () => crypto.randomBytes(4).toString('hex');
const sur = (nom) => { const b = path.basename(String(nom || '')); const p = path.join(MEDIA_DIR, b); return b && fs.existsSync(p) ? p : null; };

export function police() {
  const l = ['C:/Windows/Fonts/arial.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'];
  return l.find(f => fs.existsSync(f)) || null;
}

function ff(args, ms = 240000) {
  return new Promise((ok, ko) => {
    let err = ''; let p; try { p = spawn(ffmpegBin(), ['-y', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true }); } catch (e) { return ko(e); }
    const t = setTimeout(() => { try { p.kill(); } catch {} ko(new Error('Le montage prend trop de temps.')); }, ms);
    p.stderr.on('data', d => { err += d; if (err.length > 4000) err = err.slice(-4000); });
    p.on('error', e => { clearTimeout(t); ko(e.code === 'ENOENT' ? new Error('ffmpeg est introuvable : ouvre « Installation guidée » et clique « Installer pour moi ».') : e); });
    p.on('close', c => { clearTimeout(t); c === 0 ? ok() : ko(new Error('ffmpeg a refusé ce montage : ' + err.trim().split('\n').slice(-3).join(' ').slice(0, 300))); });
  });
}
export const etat = () => ({ police: Boolean(police()), formats: Object.keys(FORMATS), filtres: Object.keys(FILTRES) });

/* ── 1. Le plan : un prompt devient 3 à 8 scènes ── */
export async function planifier({ prompt, nb = 5, duree = 4 } = {}) {
  const sujet = String(prompt || '').trim(); if (!sujet) throw new Error('Décris la vidéo voulue.');
  nb = Math.max(2, Math.min(10, +nb || 5)); duree = Math.max(2, Math.min(10, +duree || 4));
  let scenes = null, source = 'modèle';
  try {
    const ch = chaine('conversation')[0]; if (!ch) throw new Error('aucun cerveau');
    const r = await chat(ch.provider, { model: ch.model, temperature: 0.7, maxTokens: 1400, timeout: 45000,
      system: 'Tu es monteur vidéo. Réponds UNIQUEMENT par un tableau JSON, sans texte autour.',
      messages: [{ role: 'user', content: `Vidéo : « ${sujet} ». Écris ${nb} scènes. Format : [{"texte":"phrase courte à l'écran (max 8 mots, en français)","visuel":"description de l'image en anglais, précise (sujet, lumière, style)"}]` }] });
    const m = sansPensee(r.text).match(/\[[\s\S]*\]/);
    const j = m ? JSON.parse(m[0]) : null;
    if (Array.isArray(j) && j.length) scenes = j.slice(0, nb).map(s => ({ texte: String(s.texte || '').slice(0, 90), visuel: String(s.visuel || sujet).slice(0, 400) }));
  } catch {}
  if (!scenes) {   // plan de secours, sans modèle
    source = 'secours';
    const morceaux = sujet.split(/[.!?\n;]+/).map(x => x.trim()).filter(Boolean);
    const base = morceaux.length >= 2 ? morceaux : ['Découvre', sujet, 'Pourquoi c\'est unique', 'Comment ça marche', 'Essaie maintenant'];
    scenes = base.slice(0, nb).map(t => ({ texte: t.slice(0, 60), visuel: `${sujet}, ${t}, cinematic lighting, high quality` }));
  }
  return { source, scenes: scenes.map((s, i) => ({ ...s, duree, filtre: 'aucun', couleur: PALETTES[i % PALETTES.length][0], taille: 54, couleurTexte: '#ffffff', position: 'bas' })) };
}

/* ── 2. Les matières premières ── */
export function importer({ nom = 'image.png', donnees = '' } = {}) {
  const m = /^data:(image\/(?:png|jpe?g|webp)|audio\/(?:mpeg|wav|x-wav|mp4|ogg));base64,(.+)$/.exec(String(donnees)); if (!m) throw new Error('Format non pris en charge (png, jpg, webp, mp3, wav, ogg).');
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 25e6) throw new Error('Fichier trop lourd (25 Mo maximum).');
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' }[m[1]];
  fs.mkdirSync(MEDIA_DIR, { recursive: true }); const f = `studio-${id()}.${ext}`; fs.writeFileSync(path.join(MEDIA_DIR, f), buf); return { fichier: f, url: '/media/' + f };
}

export async function carteSecours(couleur = '#4b3bb0', [w, h] = FORMATS['16:9']) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true }); const f = `studio-${id()}.png`;
  const c = /^#[0-9a-f]{6}$/i.test(couleur) ? couleur.replace('#', '0x') : '0x4b3bb0';
  await ff(['-f', 'lavfi', '-i', `gradients=s=${w}x${h}:c0=${c}:c1=0x0e0a28:x0=0:y0=0:x1=${w}:y1=${h}:d=1:r=1`, '-frames:v', '1', path.join(MEDIA_DIR, f)], 60000)
    .catch(() => ff(['-f', 'lavfi', '-i', `color=c=${c}:s=${w}x${h}:d=1:r=1`, '-frames:v', '1', path.join(MEDIA_DIR, f)], 60000));
  return { fichier: f, url: '/media/' + f };
}

export async function imageScene({ description, couleur, format = '16:9' }, creer) {
  try {
    const r = await creer({ description: String(description || 'abstract background').slice(0, 800), largeur: FORMATS[format]?.[0] || 1280, hauteur: FORMATS[format]?.[1] || 720 });
    const f = r?.donnees?.fichier; if (f && fs.existsSync(f)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true }); const b = path.basename(f);
      if (path.dirname(path.resolve(f)) !== path.resolve(MEDIA_DIR)) fs.copyFileSync(f, path.join(MEDIA_DIR, b));
      return { fichier: b, url: '/media/' + b, secours: false };
    }
    throw new Error('aucun fichier');
  } catch (e) {
    const c = await carteSecours(couleur, FORMATS[format]);
    return { ...c, secours: true, raison: String(e.message || e).slice(0, 160) };
  }
}

export async function musiqueSecours(duree = 30) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true }); const f = `studio-${id()}.wav`; const d = Math.max(5, Math.min(300, +duree || 30));
  const expr = '0.10*sin(2*PI*220*t)+0.08*sin(2*PI*277.18*t)+0.08*sin(2*PI*329.63*t)+0.05*sin(2*PI*440*t)*(0.5+0.5*sin(2*PI*0.25*t))';
  await ff(['-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=${d}`, '-af', `afade=t=in:d=2,afade=t=out:st=${Math.max(0, d - 3)}:d=3`, path.join(MEDIA_DIR, f)], 90000);
  return { fichier: f, url: '/media/' + f, secours: true };
}

/* ── 3. L'export ── */
export async function exporter({ scenes = [], musique = null, format = '16:9', titre = '', onEvent = () => {} } = {}) {
  if (!Array.isArray(scenes) || !scenes.length) throw new Error('La timeline est vide : ajoute au moins une scène.');
  const [W, H] = FORMATS[format] || FORMATS['16:9']; const fpol = police();
  const tmp = path.join(MEDIA_DIR, '.studio-' + id()); fs.mkdirSync(tmp, { recursive: true });
  const segs = []; const avert = [];
  try {
    for (let i = 0; i < Math.min(scenes.length, 30); i++) {
      const s = scenes[i]; const d = Math.max(1, Math.min(20, +s.duree || 4)); const seg = path.join(tmp, `s${i}.mp4`);
      onEvent({ type: 'export', etape: i + 1, total: scenes.length });
      const img = sur(s.fichier);
      const entree = img ? ['-i', img] : ['-f', 'lavfi', '-i', `color=c=${/^#[0-9a-f]{6}$/i.test(s.couleur) ? s.couleur.replace('#', '0x') : '0x0e0a28'}:s=${W}x${H}:d=${d}:r=25`];
      const f = [];
      if (img) f.push(`scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase`, `crop=${W * 2}:${H * 2}`, `zoompan=z='min(zoom+0.0012,1.12)':d=${Math.round(d * 25)}:s=${W}x${H}:fps=25`);
      else f.push(`scale=${W}:${H}`);
      if (FILTRES[s.filtre]) f.push(FILTRES[s.filtre]);
      const texte = String(s.texte || '').trim();
      if (texte && fpol) {
        const tf = path.join(tmp, `t${i}.txt`); fs.writeFileSync(tf, texte.replace(/%/g, '%%'), 'utf8');
        const fp = fpol.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:'); const tp = tf.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:');
        const taille = Math.max(18, Math.min(140, +s.taille || 54) * (W / 1280 > 1 ? 1 : 1)); const col = /^#[0-9a-f]{6}$/i.test(s.couleurTexte) ? s.couleurTexte.replace('#', '0x') : 'white';
        const y = s.position === 'haut' ? 'h*0.1' : s.position === 'milieu' ? '(h-text_h)/2' : 'h*0.8-text_h';
        f.push(`drawtext=fontfile='${fp}':textfile='${tp}':fontcolor=${col}:fontsize=${Math.round(taille * (Math.min(W, H) / 720))}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.45:boxborderw=14`);
      } else if (texte && !fpol && !avert.includes('police')) avert.push('police');
      f.push(`fade=t=in:d=0.35`, `fade=t=out:st=${Math.max(0, d - 0.35)}:d=0.35`, 'format=yuv420p');
      await ff([...entree, '-vf', f.join(','), '-r', '25', '-t', String(d), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-an', seg]);
      segs.push(seg);
    }
    fs.writeFileSync(path.join(tmp, 'liste.txt'), segs.map(s => `file '${s.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    const sortie = `studio-${id()}.mp4`; const out = path.join(MEDIA_DIR, sortie); const mus = musique?.fichier ? sur(musique.fichier) : null;
    onEvent({ type: 'export', etape: 'assemblage' });
    if (mus) {
      const vol = Math.max(0, Math.min(2, +musique.volume || 0.8));
      await ff(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'liste.txt'), '-stream_loop', '-1', '-i', mus, '-filter_complex', `[1:a]volume=${vol},afade=t=in:d=1[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]);
    } else await ff(['-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'liste.txt'), '-c', 'copy', '-movflags', '+faststart', out]);
    return { ok: true, fichier: sortie, url: '/media/' + sortie, avertissements: avert.map(a => a === 'police' ? 'Aucune police trouvée sur cet ordinateur : les textes n\'ont pas été incrustés.' : a) };
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
}

/* ── 4. Édition simple d'un morceau (Studio musique) ── */
export async function editerAudio({ fichier, debut = 0, fin = 0, volume = 1, fondEntree = 0, fondSortie = 0, boucles = 1 } = {}) {
  const src = sur(fichier); if (!src) throw new Error('Morceau introuvable.');
  const d0 = Math.max(0, +debut || 0), d1 = Math.max(0, +fin || 0), vol = Math.max(0, Math.min(3, +volume || 1)), fi = Math.max(0, Math.min(10, +fondEntree || 0)), fo = Math.max(0, Math.min(10, +fondSortie || 0));
  const dur = d1 > d0 ? d1 - d0 : 0; const af = [`volume=${vol}`]; if (fi) af.push(`afade=t=in:d=${fi}`); if (fo && dur) af.push(`afade=t=out:st=${Math.max(0, dur - fo)}:d=${fo}`);
  const sortie = `studio-${id()}.mp3`;
  await ff([...(boucles > 1 ? ['-stream_loop', String(Math.min(10, boucles) - 1)] : []), '-ss', String(d0), ...(dur ? ['-t', String(dur)] : []), '-i', src, '-af', af.join(','), '-c:a', 'libmp3lame', '-b:a', '192k', path.join(MEDIA_DIR, sortie)]);
  return { ok: true, fichier: sortie, url: '/media/' + sortie };
}
