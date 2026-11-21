/**
 * CLIPIA — Compositeur de musique embarqué : hors ligne, sans clé, sans installation.
 * Génère un morceau original (batterie, basse, accords, mélodie) en WAV 44,1 kHz stéréo,
 * à partir d'une description libre (« électro joyeuse », « calme pour méditer », « rap sombre »…).
 */
import fs from 'node:fs';
import path from 'node:path';

const STYLES = {
  calme:   { bpm: 72,  mode: 'majeur', batterie: 'douce',  grille: [0, 5, 9, 7] },
  joyeux:  { bpm: 118, mode: 'majeur', batterie: 'pop',    grille: [0, 7, 9, 5] },
  electro: { bpm: 124, mode: 'mineur', batterie: 'house',  grille: [0, 8, 3, 10] },
  rap:     { bpm: 88,  mode: 'mineur', batterie: 'trap',   grille: [0, 8, 5, 7] },
  rock:    { bpm: 132, mode: 'majeur', batterie: 'rock',   grille: [0, 5, 7, 5] },
  triste:  { bpm: 66,  mode: 'mineur', batterie: 'douce',  grille: [0, 8, 3, 7] },
  epique:  { bpm: 96,  mode: 'mineur', batterie: 'epique', grille: [0, 8, 10, 7] }
};
const MOTS = [
  ['calme', /calm|zen|médit|medit|ambian|ambient|relax|doux|douce|sommeil|lofi|lo-fi|piano/i],
  ['electro', /électro|electro|house|techno|edm|club|dance|synth/i],
  ['rap', /rap|trap|hip.?hop|drill|urbain|boom/i],
  ['rock', /rock|guitare|metal|punk|énerg|energ/i],
  ['triste', /trist|mélanc|melanc|pluie|nostalg|sad/i],
  ['epique', /épique|epique|film|cinéma|cinema|bande.?annonce|trailer|héro|hero|orchestr/i],
  ['joyeux', /joie|joyeu|happy|gai|pop|danse|été|ete|fête|fete|enfant/i]
];
export function styleDe(description = '') {
  for (const [s, re] of MOTS) if (re.test(description)) return s;
  return 'joyeux';
}

/** Générateur pseudo-aléatoire reproductible (même description = même morceau). */
function graine(txt) { let h = 2166136261; for (const c of String(txt)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
const freq = m => 440 * Math.pow(2, (m - 69) / 12);

export function composer({ description = '', duree = 30, dossier }) {
  const style = styleDe(description), S = STYLES[style], rnd = graine(description + style);
  const sr = 44100, d = Math.max(5, Math.min(300, +duree || 30)), N = Math.floor(d * sr);
  const L = new Float32Array(N), R = new Float32Array(N);
  const tonique = 48 + Math.floor(rnd() * 7), beat = 60 / S.bpm;
  const gamme = S.mode === 'majeur' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  const ajoute = (t0, dur, gen, gL = 1, gR = 1) => {
    const s = Math.floor(t0 * sr), n = Math.min(Math.floor(dur * sr), N - s);
    for (let i = 0; i < n; i++) { const v = gen(i / sr); L[s + i] += v * gL; R[s + i] += v * gR; }
  };
  const nbTemps = Math.floor(d / beat);
  for (let b = 0; b < nbTemps; b++) {
    const t = b * beat, mesure = Math.floor(b / 4), temps = b % 4;
    const deg = S.grille[mesure % S.grille.length], racine = tonique + deg;
    const tierce = racine + (S.mode === 'majeur' && [0, 5, 7].includes(deg) ? 4 : 3);
    // batterie
    const kick = (x) => Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-x * 35)) * x) * Math.exp(-x * 8) * 0.8;
    const bruit = (x, k) => (rnd() * 2 - 1) * Math.exp(-x * k);
    if (S.batterie === 'house' || S.batterie === 'pop' || S.batterie === 'rock' || temps === 0 || (S.batterie === 'trap' && temps === 2 && rnd() > .4)) ajoute(t, .35, kick);
    if (temps === 1 || temps === 3) { if (S.batterie !== 'douce') ajoute(t, .2, x => bruit(x, 22) * .35); }
    if (S.batterie !== 'douce') { const sub = S.batterie === 'trap' ? 4 : 2; for (let k = 0; k < sub; k++) ajoute(t + k * beat / sub, .05, x => bruit(x, 90) * .12, .7, 1); }
    if (S.batterie === 'epique' && temps === 0) ajoute(t, 1.2, x => Math.sin(2 * Math.PI * 40 * x) * Math.exp(-x * 2) * .5);
    // basse
    ajoute(t, beat * .9, x => Math.sin(2 * Math.PI * freq(racine - 12) * x) * Math.exp(-x * 2.5) * .35);
    // accords (nappe)
    if (temps === 0) for (const m of [racine, tierce, racine + 7]) ajoute(t, beat * 4, x => {
      const env = Math.min(1, x * 3) * Math.exp(-x * (S.batterie === 'douce' ? .4 : 1.1));
      return (Math.sin(2 * Math.PI * freq(m + 12) * x) + .3 * Math.sin(2 * Math.PI * freq(m + 24) * x * 1.002)) * env * .06;
    }, .8, 1.2);
    // mélodie (à partir de la 3e mesure)
    if (mesure >= 2 && rnd() > (S.batterie === 'douce' ? .45 : .3)) {
      const note = tonique + 24 + gamme[Math.floor(rnd() * gamme.length)];
      const dur = beat * (rnd() > .7 ? 2 : 1);
      ajoute(t + (rnd() > .7 ? beat / 2 : 0), dur, x => (Math.sin(2 * Math.PI * freq(note) * x) + .25 * Math.sin(4 * Math.PI * freq(note) * x)) * Math.exp(-x * 3) * .14, 1.1, .8);
    }
  }
  // fondus, normalisation, écriture WAV 16 bits
  const f = Math.floor(2 * sr); let max = 0;
  for (let i = 0; i < N; i++) { const g = Math.min(1, i / f, (N - i) / f); L[i] *= g; R[i] *= g; max = Math.max(max, Math.abs(L[i]), Math.abs(R[i])); }
  const k = max > 0 ? 0.9 / max : 1, buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4); }
  fs.mkdirSync(dossier, { recursive: true });
  const nom = `musique-${style}-${Date.now().toString(36)}.wav`;
  fs.writeFileSync(path.join(dossier, nom), buf);
  return { fichier: nom, chemin: path.join(dossier, nom), style, bpm: S.bpm, duree: d };
}
