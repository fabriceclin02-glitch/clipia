/**
 * CLIPIA — fabrique d'images, en pixels purs. Aucune bibliothèque graphique.
 * Sert à deux choses : les plans d'une vidéo, et une image seule quand aucun
 * moteur distant ne répond. Ce n'est pas de l'IA : c'est du dessin
 * déterministe, et ça a le mérite de toujours marcher.
 */
import { png } from './noyau-media.mjs';

const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;

/** Un plan Clipia : dégradé, halo, nuage de points en sphère, deux anneaux. */
export function plan(fichier, L, H, { t = 0, intensite = 1, teinte = 262 } = {}) {
  const px = Buffer.alloc(L * H * 4);
  const cx = L / 2, cy = H / 2, R = Math.min(L, H) * 0.3 * (1 + 0.04 * Math.sin(t * 3));

  /* fond : dégradé radial sombre, violet au centre */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      /* Le halo doit se deviner, pas éclairer : au premier essai il noyait
         complètement le nuage de points. Chute rapide, et base très sombre. */
      const d = Math.hypot(x - cx, y - cy) / (Math.min(L, H) * 0.62);
      const h = Math.exp(-d * d * 3.4) * intensite;
      const i = (y * L + x) * 4;
      px[i]     = clamp(6 + h * 34);
      px[i + 1] = clamp(6 + h * 14);
      px[i + 2] = clamp(14 + h * 72);
      px[i + 3] = 255;
    }
  }

  /* la sphère : spirale de Fibonacci, projetée, triée par profondeur */
  const N = 520, pts = [];
  const ay = t * 1.1, ax = 0.35 + Math.sin(t * 0.7) * 0.25;
  const cyr = Math.cos(ay), syr = Math.sin(ay), cxr = Math.cos(ax), sxr = Math.sin(ax);
  for (let k = 0; k < N; k++) {
    const yy = 1 - (k / (N - 1)) * 2, rr = Math.sqrt(1 - yy * yy), a = k * 2.399963;
    const x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr;
    const X = x0 * cyr + z0 * syr; let Z = -x0 * syr + z0 * cyr;
    const Y = yy * cxr - Z * sxr; Z = yy * sxr + Z * cxr;
    const p = 2.6 / (2.6 - Z * 0.9);
    pts.push({ x: cx + X * R * p, y: cy + Y * R * p, z: Z, p, h: teinte + (k % 7) * 8 });
  }
  pts.sort((a, b) => a.z - b.z);

  const pose = (x, y, r, g, b, a) => {
    const x0 = Math.max(0, Math.floor(x - 2)), x1 = Math.min(L - 1, Math.ceil(x + 2));
    const y0 = Math.max(0, Math.floor(y - 2)), y1 = Math.min(H - 1, Math.ceil(y + 2));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const d = Math.hypot(xx - x, yy - y);
      const al = a * Math.max(0, 1 - d / 2);
      if (al <= 0) continue;
      const i = (yy * L + xx) * 4;
      px[i]     = clamp(px[i]     * (1 - al) + r * al);
      px[i + 1] = clamp(px[i + 1] * (1 - al) + g * al);
      px[i + 2] = clamp(px[i + 2] * (1 - al) + b * al);
    }
  };

  /* hsl -> rgb, pour garder les couleurs de Clipia */
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = tt => { tt = (tt + 1) % 1;
      return tt < 1 / 6 ? p + (q - p) * 6 * tt : tt < .5 ? q : tt < 2 / 3 ? p + (q - p) * (2 / 3 - tt) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  };

  for (const q of pts) {
    const [r, g, b] = hsl(q.h, .9, .62 + q.z * .14);
    pose(q.x, q.y, r, g, b, Math.min(1, (.30 + (q.z + 1) * .46) * intensite));
  }

  /* deux anneaux, un violet un cyan */
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 90; i++) {
      const A = i / 90 * Math.PI * 2 + t * (k ? -1.6 : 1.3), rr = 1.38 + k * .22;
      const x0 = Math.cos(A) * rr, y0 = Math.sin(A) * rr * (k ? .25 : .12), z0 = Math.sin(A) * rr;
      const b2 = ay * .6 + k, a2 = ax + (k ? .9 : -.4);
      const c1 = Math.cos(b2), s1 = Math.sin(b2), c2 = Math.cos(a2), s2 = Math.sin(a2);
      const X = x0 * c1 + z0 * s1; let Z = -x0 * s1 + z0 * c1;
      const Y = y0 * c2 - Z * s2; Z = y0 * s2 + Z * c2;
      const p = 2.6 / (2.6 - Z * .9);
      const [r, g, b] = k ? [79, 224, 176] : [201, 160, 255];
      pose(cx + X * R * p, cy + Y * R * p, r, g, b, Math.min(1, .95 * intensite));
    }
  }
  return png(fichier, L, H, px);
}
