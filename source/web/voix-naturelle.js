/* CLIPIA V4 — voix la plus humaine disponible dans le navigateur + intonation par phrases. */
const PREF = [/natural|naturel/i, /neural/i, /online/i, /premium|enhanced|am[ée]lior/i, /google/i, /denise|henri|vivienne|eloise|remy|thomas|am[ée]lie|audrey/i];
export function scoreVoix(v) {
  if (!v || !/^fr/i.test(v.lang || '')) return -1;
  let s = 1; PREF.forEach((r, i) => { if (r.test(v.name || '')) s += (PREF.length - i) * 3; });
  if (/^fr[-_]FR/i.test(v.lang)) s += 2;
  if (v.localService === false) s += 1;
  return s;
}
const FEM = /denise|vivienne|eloise|élo?ise|am[ée]lie|audrey|julie|hortense|brigitte|c[ée]line|marie|l[ée]a|female|femme/i, MASC = /henri|remy|rémy|thomas|paul|claude|antoine|guillaume|nicolas|male|homme/i;
export function choisirVoix(voix, preferee = '', genre = '') {
  const liste = (voix || []).filter(v => scoreVoix(v) > 0);
  if (genre && !preferee) { const bon = liste.filter(v => (genre === 'f' ? FEM : MASC).test(v.name || '') && !(genre === 'f' ? MASC : FEM).test(v.name || '')); if (bon.length) return bon.sort((a, b) => scoreVoix(b) - scoreVoix(a))[0]; }
  if (preferee) { const p = liste.find(v => v.name === preferee); if (p) return p; }
  return liste.sort((a, b) => scoreVoix(b) - scoreVoix(a))[0] || null;
}
/** Découpe en phrases et donne à chacune une intonation : question → monte, exclamation → vive, fin → pose. */
export function phrases(texte) {
  const brut = String(texte || '').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
  const morceaux = brut.match(/[^.!?…:;]+[.!?…:;]*/g) || [];
  return morceaux.map(m => m.trim()).filter(Boolean).map((t, i, tout) => {
    const fin = t.slice(-1);
    const q = fin === '?', ex = fin === '!', virgules = (t.match(/,/g) || []).length;
    return {
      texte: t,
      pitch: q ? 1.08 : ex ? 1.05 : 0.98 + ((i % 3) - 1) * 0.015,
      rate: ex ? 1.08 : q ? 1.0 : t.length > 110 ? 1.06 : 0.99 - Math.min(virgules, 3) * 0.01,
      pause: q || fin === '.' || fin === '…' ? 220 : ex ? 160 : 90
    };
  });
}
/** Parle phrase par phrase ; renvoie une fonction qui coupe. */
export function parlerNaturel(texte, { preferee = '', genre = '', onstart, onend } = {}) {
  const ss = window.speechSynthesis;
  if (!ss) { onend?.(); return () => {}; }
  ss.cancel();
  const liste = phrases(texte).slice(0, 40);
  const voix = choisirVoix(ss.getVoices(), preferee, genre);
  let stop = false, i = 0;
  const suite = () => {
    if (stop) return;
    if (i >= liste.length) { onend?.(); return; }
    const p = liste[i++], u = new SpeechSynthesisUtterance(p.texte);
    u.lang = 'fr-FR'; u.rate = p.rate; u.pitch = genre === 'h' ? p.pitch - 0.12 : p.pitch; if (voix) u.voice = voix;
    if (i === 1) u.onstart = () => onstart?.();
    u.onend = () => (i >= liste.length ? suite() : setTimeout(suite, p.pause)); u.onerror = () => setTimeout(suite, 0);
    ss.speak(u);
  };
  suite();
  return () => { stop = true; try { ss.cancel(); } catch {} };
}
