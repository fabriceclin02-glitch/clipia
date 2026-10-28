/**
 * CLIPIA — Synthèse sonore en Node pur, sans ffmpeg.
 * Sert quand ffmpeg est absent de l'ordinateur : les programmes sonores doivent toujours se générer.
 * Sortie : WAV 16 bits stéréo à 24 kHz (suffisant : tout le contenu est sous 4 kHz), écrit par blocs.
 */
import fs from 'node:fs';

export const SR = 24000;

/** Générateurs de bruit coloré (1 échantillon à la fois), puis passe-bas à un pôle. */
function bruitCouleur(couleur, lowHz = 0) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brun = 0, prec = 0, bas = 0;
  const a = lowHz ? 1 - Math.exp(-2 * Math.PI * lowHz / SR) : 1;
  return () => {
    const w = Math.random() * 2 - 1; let x;
    if (couleur === 'white') x = w * 0.6;
    else if (couleur === 'brown') { brun = (brun + 0.02 * w) / 1.02; x = brun * 3.5; }
    else if (couleur === 'violet') { x = (w - prec) * 0.5; prec = w; }
    else if (couleur === 'blue') { x = (w - prec) * 0.5; prec = w; }
    else { // rose (Paul Kellet)
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      x = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    bas += a * (x - bas); return lowHz ? bas : x;
  };
}

/**
 * Écrit un WAV. `echantillon(i, t)` renvoie [gauche, droite] dans [-1, 1].
 * Fondus d'entrée/sortie appliqués ici.
 */
export function ecrireWav(fichier, secondes, echantillon, { fonduIn = 0, fonduOut = 0 } = {}) {
  const n = Math.round(secondes * SR), fd = fs.openSync(fichier, 'w');
  const entete = Buffer.alloc(44);
  entete.write('RIFF', 0); entete.writeUInt32LE(36 + n * 4, 4); entete.write('WAVEfmt ', 8); entete.writeUInt32LE(16, 16);
  entete.writeUInt16LE(1, 20); entete.writeUInt16LE(2, 22); entete.writeUInt32LE(SR, 24); entete.writeUInt32LE(SR * 4, 28);
  entete.writeUInt16LE(4, 32); entete.writeUInt16LE(16, 34); entete.write('data', 36); entete.writeUInt32LE(n * 4, 40);
  fs.writeSync(fd, entete);
  const BLOC = 48000, buf = Buffer.alloc(BLOC * 4);
  const cl = v => Math.max(-0.89, Math.min(0.89, v));
  try {
    for (let d = 0; d < n; d += BLOC) {
      const m = Math.min(BLOC, n - d);
      for (let k = 0; k < m; k++) {
        const i = d + k, t = i / SR;
        let [l, r] = echantillon(i, t);
        let g = 1;
        if (fonduIn && t < fonduIn) g = t / fonduIn;
        if (fonduOut && t > secondes - fonduOut) g = Math.min(g, Math.max(0, (secondes - t) / fonduOut));
        buf.writeInt16LE(Math.round(cl(l * g) * 32767), k * 4); buf.writeInt16LE(Math.round(cl(r * g) * 32767), k * 4 + 2);
      }
      fs.writeSync(fd, buf, 0, m * 4);
    }
  } finally { fs.closeSync(fd); }
  return fs.statSync(fichier).size;
}

const TAU = Math.PI * 2;

export function bruitWav(fichier, { couleur = 'brown', secondes, volume = 0.2 }) {
  const g = bruitCouleur(couleur);
  return ecrireWav(fichier, secondes, () => { const x = g() * volume; return [x, x]; }, { fonduIn: 8, fonduOut: 8 });
}
export function binauralWav(fichier, { f0, hz, secondes, volume = 0.25, fondu = 15 }) {
  return ecrireWav(fichier, secondes, (i, t) => [Math.sin(TAU * f0 * t) * volume, Math.sin(TAU * (f0 + hz) * t) * volume], { fonduIn: fondu, fonduOut: fondu });
}
export function isochroneWav(fichier, { frequence, porteuse, secondes, volume = 0.3 }) {
  return ecrireWav(fichier, secondes, (i, t) => {
    const mod = 1 - 0.95 * (0.5 - 0.5 * Math.cos(TAU * frequence * t)); const x = Math.sin(TAU * porteuse * t) * mod * volume; return [x, x];
  }, { fonduIn: 10, fonduOut: 10 });
}

/** Programme complet : bruit + bourdon + guide de respiration par phases + battement binaural. */
export function programmeWav(fichier, { phases, accord, bruit, niveauBruit, volume = 1, binaural = null, fonduFinal = 12 }) {
  const total = phases.reduce((s, ph) => s + Math.round(ph.minutes * 60), 0);
  const gb = bruitCouleur(bruit, bruit === 'brown' ? 1800 : 3200);
  const bornes = []; let c = 0; for (const ph of phases) { const s = Math.round(ph.minutes * 60); bornes.push([c, c + s, ph]); c += s; }
  let idx = 0;
  const env = (ph, t) => {
    const T = ph.inspire + ph.pause + ph.expire; if (!T) return 0;
    const u = t % T, ti = ph.inspire, tp = ti + ph.pause;
    if (u < ti) return Math.pow(Math.sin(Math.PI / 2 * u / ti), 2);
    if (u < tp) return 1;
    return Math.pow(Math.sin(Math.PI / 2 * Math.max(0, 1 - (u - tp) / ph.expire)), 2);
  };
  return ecrireWav(fichier, total, (i, t) => {
    while (idx < bornes.length - 1 && t >= bornes[idx][1]) idx++;
    const [debut, fin, ph] = bornes[idx], tl = t - debut;
    let a = 1; if (tl < 2) a = tl / 2; if (fin - t < 2) a = Math.min(a, (fin - t) / 2);
    const n = gb() * niveauBruit * volume * 2.2;
    const dr = (Math.sin(TAU * accord[0] * t) + Math.sin(TAU * accord[1] * t)) * 0.05 * volume;
    const guide = env(ph, tl) * a * 0.17 * volume * Math.sin(TAU * accord[2] * t);
    let l = n + dr + guide, r = l;
    if (binaural) { l += Math.sin(TAU * binaural.f0 * t) * 0.07 * volume; r += Math.sin(TAU * (binaural.f0 + binaural.hz) * t) * 0.07 * volume; }
    return [l, r];
  }, { fonduIn: 6, fonduOut: fonduFinal });
}
