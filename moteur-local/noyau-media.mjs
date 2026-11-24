/**
 * CLIPIA — fabrique de média, sans aucune dépendance.
 *
 * Tout ce qui suit n'utilise que Node et ce que la machine a déjà. Pas de npm,
 * pas de modèle à télécharger, pas de compte. C'est volontaire : chaque
 * dépendance en plus est une raison de plus que « ça ne marche pas ».
 *
 *   wav()        écrit un fichier WAV 16 bits à partir d'échantillons
 *   png()        écrit un PNG RGBA à partir de pixels (zlib est dans Node)
 *   composer()   transforme un prompt en vraie musique : accords, basse,
 *                batterie, arpège, structure
 *   ffmpeg()     trouve le ffmpeg déjà installé et l'appelle
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

export const SR = 44100;

/* ─── WAV ──────────────────────────────────────────────────────────────── */
export function wav(fichier, gauche, droite = null) {
  const n = gauche.length, canaux = droite ? 2 : 1;
  const data = Buffer.alloc(n * canaux * 2);
  for (let i = 0; i < n; i++) {
    const e = (v) => Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
    data.writeInt16LE(e(gauche[i]), i * canaux * 2);
    if (droite) data.writeInt16LE(e(droite[i]), i * canaux * 2 + 2);
  }
  const t = Buffer.alloc(44);
  t.write('RIFF', 0); t.writeUInt32LE(36 + data.length, 4); t.write('WAVE', 8);
  t.write('fmt ', 12); t.writeUInt32LE(16, 16); t.writeUInt16LE(1, 20);
  t.writeUInt16LE(canaux, 22); t.writeUInt32LE(SR, 24);
  t.writeUInt32LE(SR * canaux * 2, 28); t.writeUInt16LE(canaux * 2, 32);
  t.writeUInt16LE(16, 34); t.write('data', 36); t.writeUInt32LE(data.length, 40);
  fs.writeFileSync(fichier, Buffer.concat([t, data]));
  return { fichier, secondes: +(n / SR).toFixed(2), octets: 44 + data.length };
}

/* ─── PNG ──────────────────────────────────────────────────────────────── */
const crcT = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = b => { let c = -1; for (const o of b) c = crcT[(c ^ o) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const bloc = (type, don) => {
  const t = Buffer.from(type, 'ascii'), lg = Buffer.alloc(4), cr = Buffer.alloc(4);
  lg.writeUInt32BE(don.length); cr.writeUInt32BE(crc(Buffer.concat([t, don])));
  return Buffer.concat([lg, t, don, cr]);
};
export function png(fichier, L, H, pixels) {
  const brut = Buffer.alloc((L * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    brut[y * (L * 4 + 1)] = 0;
    pixels.copy ? pixels.copy(brut, y * (L * 4 + 1) + 1, y * L * 4, (y + 1) * L * 4)
                : Buffer.from(pixels.slice(y * L * 4, (y + 1) * L * 4)).copy(brut, y * (L * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(L, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(fichier, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut, { level: 9 })), bloc('IEND', Buffer.alloc(0))
  ]));
  return { fichier, taille: `${L}×${H}`, octets: fs.statSync(fichier).size };
}

/* ─── ffmpeg déjà présent ──────────────────────────────────────────────── */
export function trouverFfmpeg() {
  const L = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const pistes = [
    path.join(L, 'Programs', 'Clipia', 'outils', 'ffmpeg.exe'),
    path.join(L, 'Programs', 'Kdenlive', 'bin', 'ffmpeg.exe'),
    path.join(L, 'Programs', 'Shotcut', 'ffmpeg.exe'),
    'ffmpeg'
  ];
  for (const p of pistes) {
    const r = spawnSync(p, ['-version'], { encoding: 'utf8', shell: p === 'ffmpeg', timeout: 15000 });
    if (r.status === 0) return { chemin: p, version: String(r.stdout).split('\n')[0].slice(0, 70) };
  }
  return null;
}
export function ffmpeg(exe, args, delai = 300000) {
  const r = spawnSync(exe, args, { encoding: 'utf8', timeout: delai, shell: exe === 'ffmpeg' });
  return { ok: r.status === 0, sortie: (String(r.stderr || '') + String(r.stdout || '')).slice(-1400) };
}

/* ─── LE COMPOSITEUR ───────────────────────────────────────────────────────
 * Un prompt en français devient une vraie structure musicale. Pas un modèle
 * d'IA : des règles de musique. Ça a deux avantages qui comptent ici — ça
 * marche hors ligne, tout de suite, et le résultat est reproductible.
 * ───────────────────────────────────────────────────────────────────────── */
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const freq = (nom, octave) => 440 * Math.pow(2, (NOTE[nom] + (octave - 4) * 12 - 9) / 12);

const AMBIANCES = {
  epique:   { bpm: 92,  mode: 'min', mots: /épique|epique|cinéma|cinema|bande.?annonce|trailer|puissant|héro|hero|grandiose/i,
              prog: [0, 5, 3, 4], sat: .9, batterie: 'lourde' },
  energique:{ bpm: 128, mode: 'min', mots: /énerg|energ|percutant|dance|club|techno|house|rapide|punch|motiv/i,
              prog: [0, 5, 3, 4], sat: .8, batterie: 'quatre' },
  sombre:   { bpm: 84,  mode: 'min', mots: /sombre|dark|tension|angoiss|inquiét|inquiet|mystèr|myster|trash|hard/i,
              prog: [0, 1, 5, 0], sat: .95, batterie: 'lourde' },
  calme:    { bpm: 72,  mode: 'maj', mots: /calme|doux|douce|zen|relax|ambiant|ambient|médit|medit|piano|lent/i,
              prog: [0, 4, 5, 3], sat: .3, batterie: 'aucune' },
  joyeux:   { bpm: 112, mode: 'maj', mots: /joyeux|gai|solaire|pop|lumineux|entraînant|entrainant|été|ete|positif/i,
              prog: [0, 4, 5, 3], sat: .5, batterie: 'quatre' },
  hiphop:   { bpm: 90,  mode: 'min', mots: /hip.?hop|rap|boom.?bap|trap|beat|instru/i,
              prog: [0, 3, 5, 4], sat: .7, batterie: 'boombap' }
};

/** Lit le prompt : ambiance, tempo, tonalité, durée. Ce qu'il ne dit pas, on le choisit. */
export function lirePrompt(p) {
  const t = String(p || '');
  let a = AMBIANCES.energique, nom = 'energique';
  for (const [k, v] of Object.entries(AMBIANCES)) if (v.mots.test(t)) { a = v; nom = k; break; }
  const bpmDit = t.match(/(\d{2,3})\s*(?:bpm|battements)/i);
  const bpm = bpmDit ? Math.max(50, Math.min(200, +bpmDit[1])) : a.bpm;
  const tonDit = t.match(/\b(?:en|tonalité|tonalite|clé|cle)\s+(do|ré|re|mi|fa|sol|la|si)\b/i);
  const FR = { do: 'C', ré: 'D', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
  const tonique = tonDit ? FR[tonDit[1].toLowerCase()] : (a.mode === 'min' ? 'A' : 'C');
  const durDit = t.match(/(\d{1,3})\s*(?:s|sec|secondes?|min|minutes?)/i);
  let duree = 32;
  if (durDit) duree = /min/i.test(durDit[0]) ? +durDit[1] * 60 : +durDit[1];
  duree = Math.max(8, Math.min(300, duree));
  return { ambiance: nom, bpm, tonique, mode: a.mode, prog: a.prog, sat: a.sat, batterie: a.batterie, duree };
}

export function composer(prompt) {
  const P = lirePrompt(prompt);
  const n = Math.round(P.duree * SR);
  const G = new Float32Array(n), D = new Float32Array(n);
  const noire = 60 / P.bpm, mesure = noire * 4;
  const GAMME = P.mode === 'min' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const base = NOTE[P.tonique];
  const demi = (deg) => base + GAMME[deg % 7] + 12 * Math.floor(deg / 7);
  const hz = (st, oct) => 440 * Math.pow(2, (st + (oct - 4) * 12 - 9) / 12);

  const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);
  const ajoute = (i, g, d) => { if (i >= 0 && i < n) { G[i] += g; D[i] += d; } };

  /* structure : intro, montée, corps, pont, final */
  const sections = Math.max(4, Math.round(P.duree / mesure));
  for (let m = 0; m < sections; m++) {
    const t0 = m * mesure;
    const part = m / sections;
    const intensite = part < .12 ? .45 : part < .3 ? .75 : part > .88 ? 1 : .92;
    const accord = P.prog[m % P.prog.length];

    /* nappe d'accord : trois voix, légèrement désaccordées pour l'épaisseur */
    for (const [k, deg] of [[0, accord], [1, accord + 2], [2, accord + 4]]) {
      const f = hz(demi(deg), 3);
      for (let i = 0; i < Math.round(mesure * SR); i++) {
        const t = i / SR, s = Math.round(t0 * SR) + i;
        const e = Math.min(1, t / .08) * Math.min(1, (mesure - t) / .25);
        const v = (Math.sin(2 * Math.PI * f * t) + .45 * Math.sin(2 * Math.PI * f * 1.003 * t)
                 + .3 * Math.sin(2 * Math.PI * f * 2 * t)) * .035 * e * intensite;
        ajoute(s, v * (k === 1 ? .7 : 1), v * (k === 2 ? .7 : 1));
      }
    }

    /* basse : la fondamentale, à la noire */
    for (let b = 0; b < 4; b++) {
      const f = hz(demi(accord), 2);
      for (let i = 0; i < Math.round(noire * SR); i++) {
        const t = i / SR, s = Math.round((t0 + b * noire) * SR) + i;
        const v = Math.sin(2 * Math.PI * f * t) * .22 * env(t, .004, .13) * intensite;
        ajoute(s, v, v);
      }
    }

    /* arpège : ce qui donne le mouvement */
    if (part > .12) {
      const motif = [0, 2, 4, 6, 4, 2, 4, 2];
      for (let k = 0; k < 8; k++) {
        const f = hz(demi(accord + motif[k]), 5);
        for (let i = 0; i < Math.round(noire / 2 * SR); i++) {
          const t = i / SR, s = Math.round((t0 + k * noire / 2) * SR) + i;
          const v = Math.sin(2 * Math.PI * f * t) * .055 * env(t, .003, .07) * intensite;
          ajoute(s, v * (k % 2 ? .75 : 1), v * (k % 2 ? 1 : .75));
        }
      }
    }

    /* batterie */
    if (P.batterie !== 'aucune' && part > .1) {
      const grosse = P.batterie === 'boombap' ? [0, 2.5] : P.batterie === 'lourde' ? [0, 2] : [0, 1, 2, 3];
      for (const b of grosse) {
        for (let i = 0; i < Math.round(.2 * SR); i++) {
          const t = i / SR, s = Math.round((t0 + b * noire) * SR) + i;
          const f = 118 * Math.exp(-t * 26) + 42;
          const v = Math.sin(2 * Math.PI * f * t) * .55 * Math.exp(-t / .07) * intensite;
          ajoute(s, v, v);
        }
      }
      for (const b of [1, 3]) {          /* caisse claire */
        for (let i = 0; i < Math.round(.14 * SR); i++) {
          const t = i / SR, s = Math.round((t0 + b * noire) * SR) + i;
          const v = (Math.random() * 2 - 1) * .2 * Math.exp(-t / .035) * intensite;
          ajoute(s, v, v * .9);
        }
      }
      for (let k = 0; k < 8; k++) {       /* charleston */
        for (let i = 0; i < Math.round(.045 * SR); i++) {
          const t = i / SR, s = Math.round((t0 + k * noire / 2) * SR) + i;
          const v = (Math.random() * 2 - 1) * .055 * Math.exp(-t / .012) * intensite;
          ajoute(s, v * (k % 2 ? .6 : 1), v * (k % 2 ? 1 : .6));
        }
      }
    }

    /* impact sur les changements de section */
    if (m > 0 && m % 4 === 0) {
      for (let i = 0; i < Math.round(1.1 * SR); i++) {
        const t = i / SR, s = Math.round(t0 * SR) + i;
        const v = ((Math.random() * 2 - 1) * .5 + Math.sin(2 * Math.PI * (58 * Math.exp(-t * 3)) * t))
                  * .3 * Math.exp(-t / .34);
        ajoute(s, v, v);
      }
    }
  }

  /* collage final : saturation douce puis normalisation */
  let crete = 0;
  for (let i = 0; i < n; i++) { G[i] = Math.tanh(G[i] * (1 + P.sat)); D[i] = Math.tanh(D[i] * (1 + P.sat));
    crete = Math.max(crete, Math.abs(G[i]), Math.abs(D[i])); }
  const gain = crete > 0 ? .89 / crete : 1;
  const fondu = Math.round(.9 * SR);
  for (let i = 0; i < n; i++) {
    let f = 1;
    if (i < fondu) f = i / fondu;
    if (i > n - fondu) f = (n - i) / fondu;
    G[i] *= gain * f; D[i] *= gain * f;
  }
  return { gauche: G, droite: D, plan: P };
}
