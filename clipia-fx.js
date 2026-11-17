/* Clipia — anneaux verts en orbite + paillettes (même rendu que l'application) */
(function(){
  // Anneaux verts en orbite + paillettes multicolores (comme l'application Clipia)
  const RINGS = [ { r: 1.32, tx: 1.15, tz: 0.2, sp: 0.55, w: 1.6 }, { r: 1.5, tx: 0.55, tz: -0.9, sp: -0.4, w: 1.3 }, { r: 1.7, tx: 1.35, tz: 1.1, sp: 0.3, w: 1.0 } ];
  const SPK = []; for (let i = 0; i < 46; i++) { const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), r = 1.15 + Math.random() * 0.95; SPK.push({ a, b, r, ph: Math.random() * 6.283, sp: 0.6 + Math.random() * 1.8, h: [150, 165, 190, 320, 45, 280][i % 6], sz: 0.8 + Math.random() * 1.8 }); }
  function ringPts(rg, t, n) {
    const out = [], ct = Math.cos(rg.tx), st = Math.sin(rg.tx), cz = Math.cos(rg.tz + t * 0.12), sz = Math.sin(rg.tz + t * 0.12);
    for (let i = 0; i <= n; i++) { const a = i / n * 6.2832; let x = Math.cos(a) * rg.r, y = 0, z = Math.sin(a) * rg.r;
      const y1 = y * ct - z * st, z1 = y * st + z * ct; const x2 = x * cz - y1 * sz, y2 = x * sz + y1 * cz; out.push([x2, y2, z1, a]); }
    return out;
  }
  function drawRings(ctx, cx, cy, R, t, dpr, front, lv) {
    for (let k = 0; k < RINGS.length; k++) {
      const rg = RINGS[k], pts = ringPts(rg, t, 90), head = (t * rg.sp * 2) % 6.2832;
      ctx.lineWidth = rg.w * dpr * 1.9 * Math.max(0.55, Math.min(1.2, R / (110 * dpr)));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1]; if ((a[2] >= 0) !== front) continue;
        let d = ((a[3] - head) % 6.2832 + 6.2832) % 6.2832; const glow = Math.exp(-d * 1.4);
        ctx.strokeStyle = `hsla(${150 + k * 12},95%,${58 + glow * 28}%,${(front ? 0.5 : 0.22) + glow * 0.5 + lv * 0.2})`;
        ctx.beginPath(); ctx.moveTo(cx + a[0] * R, cy + a[1] * R); ctx.lineTo(cx + b[0] * R, cy + b[1] * R); ctx.stroke();
      }
      // petite comète lumineuse sur chaque anneau
      const hp = ringPts({ ...rg }, t, 1); const ang = head, ct = Math.cos(rg.tx), st = Math.sin(rg.tx), cz = Math.cos(rg.tz + t * 0.12), sz = Math.sin(rg.tz + t * 0.12);
      let x = Math.cos(ang) * rg.r, z = Math.sin(ang) * rg.r; const y1 = -z * st, z1 = z * ct; const x2 = x * cz - y1 * sz, y2 = x * sz + y1 * cz;
      if ((z1 >= 0) === front) { const gr = ctx.createRadialGradient(cx + x2 * R, cy + y2 * R, 0, cx + x2 * R, cy + y2 * R, (5 + 9 * Math.min(1, R / (110 * dpr))) * dpr); gr.addColorStop(0, 'rgba(190,255,220,.95)'); gr.addColorStop(1, 'rgba(52,211,153,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx + x2 * R, cy + y2 * R, (5 + 9 * Math.min(1, R / (110 * dpr))) * dpr, 0, 7); ctx.fill(); }
    }
  }
  function drawSparks(ctx, cx, cy, R, t, dpr, front) {
    for (const p of SPK) {
      const a = p.a + t * 0.18 * (p.r > 1.5 ? -1 : 1), sx = Math.sin(p.b) * Math.cos(a) * p.r, sy = Math.cos(p.b) * p.r, sz2 = Math.sin(p.b) * Math.sin(a) * p.r;
      if ((sz2 >= 0) !== front) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * p.sp * 3 + p.ph), hue = (p.h + Math.sin(t * 0.7 + p.ph) * 25 + t * 6) % 360;
      ctx.fillStyle = `hsla(${hue},95%,${68 + tw * 22}%,${0.15 + tw * 0.85})`;
      const s = p.sz * (0.5 + tw) * dpr * Math.max(0.35, Math.min(1.2, R / (110 * dpr))); ctx.beginPath(); ctx.arc(cx + sx * R, cy + sy * R, s, 0, 7); ctx.fill();
      if (tw > 0.85) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.8 * dpr; ctx.beginPath(); ctx.moveTo(cx + sx * R - s * 3, cy + sy * R); ctx.lineTo(cx + sx * R + s * 3, cy + sy * R); ctx.moveTo(cx + sx * R, cy + sy * R - s * 3); ctx.lineTo(cx + sx * R, cy + sy * R + s * 3); ctx.stroke(); }
    }
  }

  window.ClipiaFX = { back: function (c, x, y, R, t, d, lv) { drawRings(c, x, y, R, t, d, false, lv || 0); drawSparks(c, x, y, R, t, d, false); }, front: function (c, x, y, R, t, d, lv) { drawRings(c, x, y, R, t, d, true, lv || 0); drawSparks(c, x, y, R, t, d, true); } };
})();
