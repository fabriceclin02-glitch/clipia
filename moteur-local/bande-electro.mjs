/**
 * La bande-son du film : une montée électro avec un vrai drop.
 *
 * 128 BPM, mesure = 1,875 s, drop à la mesure 10 (18,75 s), 20 mesures en tout.
 * Tout est calé sur la grille : c'est ce calage, et pas le volume, qui fait
 * qu'un drop « percute ». Synthèse directe, aucune dépendance.
 */
import { wav, SR } from '../banc/noyau-media.mjs';

const BPM = 128, NOIRE = 60 / BPM, MES = NOIRE * 4;
const DROP = MES * 10, TOT = MES * 20;
const n = Math.round(TOT * SR);
const G = new Float32Array(n), D = new Float32Array(n);
const put = (i, g, d) => { if (i >= 0 && i < n) { G[i] += g; D[i] += d; } };
const hz = (st) => 440 * Math.pow(2, (st - 9) / 12);
/* La mineur : la tonalité des bandes-annonces. */
const LA = -12, GAMME = [0, 2, 3, 5, 7, 8, 10];
const deg = (d, oct = 0) => LA + GAMME[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);

/* ── grosse caisse : attaque courte, descente de hauteur ── */
function kick(t0, force = 1) {
  for (let i = 0; i < Math.round(.34 * SR); i++) {
    const t = i / SR;
    const f = 128 * Math.exp(-t * 32) + 44;
    const v = (Math.sin(2 * Math.PI * f * t) + .25 * Math.sin(4 * Math.PI * f * t))
            * .95 * force * Math.exp(-t / .085);
    put(Math.round(t0 * SR) + i, v, v);
  }
}
/* ── claque : bruit filtré, corps court ── */
function clap(t0, force = 1) {
  for (let i = 0; i < Math.round(.2 * SR); i++) {
    const t = i / SR;
    const v = ((Math.random() * 2 - 1) * .8 + Math.sin(2 * Math.PI * 190 * t) * .3)
            * .42 * force * Math.exp(-t / .055);
    put(Math.round(t0 * SR) + i, v, v * .92);
  }
}
function hat(t0, force = 1, ouvert = false) {
  const d = ouvert ? .17 : .04;
  for (let i = 0; i < Math.round(d * 1.6 * SR); i++) {
    const t = i / SR;
    const v = (Math.random() * 2 - 1) * .16 * force * Math.exp(-t / d);
    put(Math.round(t0 * SR) + i, v * .85, v);
  }
}
/* ── basse saturée, note tenue ── */
function basse(t0, dur, st, force = 1) {
  const f = hz(st);
  for (let i = 0; i < Math.round(dur * SR); i++) {
    const t = i / SR;
    const e = Math.min(1, t / .006) * Math.min(1, (dur - t) / .03);
    const sc = ((t * f) % 1) * 2 - 1;                      /* dent de scie */
    const v = Math.tanh((Math.sin(2 * Math.PI * f * t) * .7 + sc * .55) * 2.1) * .3 * force * e;
    put(Math.round(t0 * SR) + i, v, v);
  }
}
/* ── lead : supersaw, trois voix désaccordées ── */
function lead(t0, dur, st, force = 1) {
  const f = hz(st);
  for (let i = 0; i < Math.round(dur * SR); i++) {
    const t = i / SR;
    const e = Math.min(1, t / .008) * Math.exp(-t / (dur * .9));
    let v = 0;
    for (const dt of [-0.14, 0, 0.15]) {
      const ff = f * Math.pow(2, dt / 12);
      v += (((t * ff) % 1) * 2 - 1) * .33;
    }
    v = Math.tanh(v * 1.5) * .17 * force * e;
    put(Math.round(t0 * SR) + i, v * .92, v);
  }
}
/* ── nappe d'accord ── */
function nappe(t0, dur, degre, force = 1) {
  for (const d of [0, 2, 4]) {
    const f = hz(deg(degre + d, 1));
    for (let i = 0; i < Math.round(dur * SR); i++) {
      const t = i / SR;
      const e = Math.min(1, t / .25) * Math.min(1, (dur - t) / .4);
      const v = (Math.sin(2 * Math.PI * f * t) + .4 * Math.sin(2 * Math.PI * f * 1.004 * t)) * .05 * force * e;
      put(Math.round(t0 * SR) + i, v, v * .95);
    }
  }
}
/* ── riser : bruit qui monte en fréquence et en volume ── */
function riser(t0, dur) {
  let ph = 0;
  for (let i = 0; i < Math.round(dur * SR); i++) {
    const t = i / SR, k = t / dur;
    const f = 220 * Math.pow(2, k * 3.4);
    ph += 2 * Math.PI * f / SR;
    const bruit = (Math.random() * 2 - 1) * .5 * k * k;
    const v = (Math.sin(ph) * .35 + bruit) * .22 * k * k;   /* bridé : le riser ne doit pas atteindre le niveau du drop */
    const pan = Math.sin(k * Math.PI * 6) * .3;
    put(Math.round(t0 * SR) + i, v * (1 - pan), v * (1 + pan));
  }
}
/* ── roulement de caisse : il accélère, c'est lui qui crée l'attente ── */
function roulement(t0, dur) {
  let t = 0, pas = NOIRE / 2;
  while (t < dur) {
    clap(t0 + t, .22 + .46 * (t / dur));
    t += pas;
    pas = Math.max(NOIRE / 16, pas * 0.88);
  }
}
/* ── impact : le choc du drop ── */
function impact(t0) {
  for (let i = 0; i < Math.round(2.4 * SR); i++) {
    const t = i / SR;
    const f = 64 * Math.exp(-t * 2.4);
    const v = (Math.sin(2 * Math.PI * f * t) * .8 + (Math.random() * 2 - 1) * .5 * Math.exp(-t / .13))
            * .5 * Math.exp(-t / .62);
    put(Math.round(t0 * SR) + i, v, v);
  }
}

/* ═══ LE MORCEAU ═══════════════════════════════════════════════════════ */
const PROG = [0, 5, 3, 4];                       /* Am - F - Dm - Em */

for (let m = 0; m < 20; m++) {
  const t0 = m * MES;
  const acc = PROG[m % 4];
  const avant = t0 < DROP;
  const k = avant ? m / 10 : 1;                  /* l'énergie monte jusqu'au drop */

  nappe(t0, MES, acc, avant ? .3 + k * .55 : 1.2);

  if (m >= 2) for (let b = 0; b < 4; b++) kick(t0 + b * NOIRE, avant ? .28 + k * .42 : 1.18);
  if (m >= 4) for (const b of [1, 3]) clap(t0 + b * NOIRE, avant ? .24 + k * .42 : 1.05);
  if (m >= 3) for (let h = 0; h < 8; h++) hat(t0 + h * NOIRE / 2, (avant ? .4 + k * .5 : .9) * (h % 2 ? 1 : .55), h === 7);

  if (m >= 5) {                                  /* basse en croches, racine */
    for (let b = 0; b < 8; b++)
      basse(t0 + b * NOIRE / 2, NOIRE / 2 * .92, deg(acc, 0), avant ? .3 + k * .42 : 1.2);
  }
  if (!avant) {                                  /* après le drop : le thème */
    const motif = [0, 4, 2, 4, 6, 4, 2, 0];
    for (let s = 0; s < 8; s++)
      lead(t0 + s * NOIRE / 2, NOIRE / 2 * 1.1, deg(acc + motif[s], 2), 1.45);
  }
}

/* la montée finale : deux mesures de roulement et un riser */
roulement(DROP - MES * 2, MES * 2);
riser(DROP - MES * 2.2, MES * 2.2);
impact(DROP);
/* silence d'une croche juste avant le drop : le vide fait le choc */
for (let i = Math.round((DROP - NOIRE / 2) * SR); i < Math.round(DROP * SR); i++) {
  const k = (Math.round(DROP * SR) - i) / (NOIRE / 2 * SR);
  G[i] *= k * .35; D[i] *= k * .35;
}

/* mastering : saturation douce, normalisation, fondu de sortie */
let crete = 0;
for (let i = 0; i < n; i++) {
  G[i] = Math.tanh(G[i] * 1.25); D[i] = Math.tanh(D[i] * 1.25);
  const a = Math.max(Math.abs(G[i]), Math.abs(D[i])); if (a > crete) crete = a;
}
const gain = .92 / crete, sortie = Math.round(2.6 * SR);
for (let i = 0; i < n; i++) {
  let f = 1;
  if (i < SR * .05) f = i / (SR * .05);
  if (i > n - sortie) f = Math.pow((n - i) / sortie, 1.4);
  G[i] *= gain * f; D[i] *= gain * f;
}
console.log(JSON.stringify(wav('bande-electro.wav', G, D)), 'drop à', DROP, 's');
