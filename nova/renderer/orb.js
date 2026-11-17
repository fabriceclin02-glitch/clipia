/* Sphère 3D animée de Clipia : réagit à la voix, à la souris et à l'état de la conversation. */
(function () {
  const PALETTE = {
    idle:      { h1: 215, h2: 300, sat: 90, glow: 'rgba(139,92,246,' },
    listening: { h1: 185, h2: 230, sat: 95, glow: 'rgba(56,189,248,' },
    thinking:  { h1: 255, h2: 290, sat: 90, glow: 'rgba(168,85,247,' },
    speaking:  { h1: 290, h2: 335, sat: 95, glow: 'rgba(236,72,153,' },
    tor:       { h1: 265, h2: 285, sat: 60, glow: 'rgba(126,87,194,' }
  };
  const all = new Set();

  class Orb {
    constructor(canvas, opt = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.n = opt.points || 900; this.full = !!opt.full; this.scale = opt.scale || 0.4; this.cyf = opt.cy || 0.5;
      this.state = 'idle'; this.level = 0; this.lv = 0; this.ax = 0.3; this.ay = 0; this.vx = 0; this.vy = 0.006;
      this.mx = 0; this.my = 0; this.cur = { ...PALETTE.idle }; this.alive = true; this.t0 = performance.now();
      const g = Math.PI * (3 - Math.sqrt(5)); this.pts = [];
      for (let i = 0; i < this.n; i++) { const y = 1 - (i / (this.n - 1)) * 2, r = Math.sqrt(1 - y * y); this.pts.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r, Math.random() * 6.28]); }
      if (opt.interactive) this.bind();
      all.add(this);
      requestAnimationFrame(this.frame.bind(this));
    }
    bind() {
      let drag = null;
      this.c.style.cursor = 'grab';
      this.c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; this.c.setPointerCapture(e.pointerId); this.c.style.cursor = 'grabbing'; });
      this.c.addEventListener('pointermove', e => {
        const r = this.c.getBoundingClientRect();
        this.mx = ((e.clientX - r.left) / r.width - 0.5); this.my = ((e.clientY - r.top) / r.height - 0.5);
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
        this.vy = dx * 0.0009; this.vx = dy * 0.0009; drag.x = e.clientX; drag.y = e.clientY;
      });
      const up = e => { if (drag && drag.moved < 6 && this.onClick) this.onClick(e); drag = null; this.c.style.cursor = 'grab'; };
      this.c.addEventListener('pointerup', up);
      this.c.addEventListener('pointerleave', () => { this.mx = this.my = 0; });
    }
    setState(s) { this.state = s; }
    setLevel(v) { this.level = Math.max(0, Math.min(1, v)); }
    destroy() { this.alive = false; all.delete(this); }
    frame(now) {
      if (!this.alive) return;
      if (!this.c.isConnected) { this.destroy(); return; }
      const ctx = this.ctx, dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, (this.full ? innerWidth : this.c.clientWidth) * dpr), H = Math.max(1, (this.full ? innerHeight : this.c.clientHeight) * dpr);
      if (this.c.width !== W || this.c.height !== H) { this.c.width = W; this.c.height = H; }
      const t = (now - this.t0) / 1000;
      const P = PALETTE[this.state] || PALETTE.idle;
      for (const k of ['h1', 'h2', 'sat']) this.cur[k] += (P[k] - this.cur[k]) * 0.06;
      // niveau sonore lissé (voix de l'utilisateur ou de Clipia)
      let target = this.level;
      if (this.state === 'speaking' && target < 0.05) target = 0.35 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23) * 0.1;
      if (this.state === 'thinking') target = 0.15;
      this.lv += (target - this.lv) * 0.25;
      // rotation avec inertie, ramenée doucement vers une rotation lente
      this.vy += ((this.state === 'thinking' ? 0.02 : 0.006) - this.vy) * 0.02; this.vx += (0 - this.vx) * 0.03;
      this.ay += this.vy; this.ax += this.vx + (this.my * 0.4 - (this.ax - 0.3)) * 0.02;
      ctx.clearRect(0, 0, W, H);
      const R0 = Math.min(W, H) * this.scale;
      const breathe = 1 + Math.sin(t * 1.6) * 0.025 + this.lv * 0.12;
      const R = R0 * breathe;
      const cx = W / 2 + this.mx * R0 * 0.15, cy = H * this.cyf + this.my * R0 * 0.15;
      // halo
      const g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.9);
      g.addColorStop(0, P.glow + (0.45 + this.lv * 0.4) + ')'); g.addColorStop(0.5, P.glow + '0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, 7); ctx.fill();
      // anneaux (réflexion)
      if (this.state === 'thinking' || this.state === 'listening') {
        ctx.lineWidth = 1.2 * dpr;
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `hsla(${this.cur.h1 + i * 25},90%,70%,${0.25 - i * 0.06})`;
          ctx.beginPath(); ctx.ellipse(cx, cy, R * (1.25 + i * 0.12), R * (0.35 + i * 0.05), t * (0.6 + i * 0.3) * (i % 2 ? -1 : 1), 0, 7); ctx.stroke();
        }
      }
      const ca = Math.cos(this.ay), sa = Math.sin(this.ay), cb = Math.cos(this.ax), sb = Math.sin(this.ax);
      const pts = [];
      for (const [x0, y0, z0, ph] of this.pts) {
        const wave = 1 + Math.sin(t * 2.2 + y0 * 6 + ph) * 0.03 + this.lv * 0.22 * Math.sin(t * 7 + ph * 3 + x0 * 5);
        let x = x0 * ca - z0 * sa, z = x0 * sa + z0 * ca, y = y0 * cb - z * sb; z = y0 * sb + z * cb;
        pts.push([x * wave, y * wave, z, y0]);
      }
      pts.sort((a, b) => a[2] - b[2]);
      for (const [x, y, z, y0] of pts) {
        const d = (z + 1.6) / 2.6;
        const hue = this.cur.h1 + (y0 + 1) / 2 * (this.cur.h2 - this.cur.h1);
        ctx.fillStyle = `hsla(${hue},${this.cur.sat}%,${55 + d * 22}%,${0.12 + d * 0.88})`;
        const s = (0.55 + d * 1.9) * dpr * (this.n < 400 ? 0.8 : 1);
        ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, s, 0, 7); ctx.fill();
      }
      requestAnimationFrame(this.frame.bind(this));
    }
  }
  Orb.setAll = (state, level) => { for (const o of all) { if (state) o.setState(state); if (level !== undefined) o.setLevel(level); } };
  window.Orb = Orb;
})();
