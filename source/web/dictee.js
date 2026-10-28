/* CLIPIA X7 — dictée partout + grande scène 3D plein écran (écoute / parole), interactive.
   - 🎙 à côté de chaque champ texte de toutes les sections : on parle, ça écrit.
   - Pastille Clipia visible partout (hors chat) : un clic = dicter dans le champ actif.
   - Scène 3D plein écran pendant l'écoute et la parole ; disparaît quand elle travaille. */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function anim3D(canvas, lire) {
  const ctx = canvas.getContext('2d'); let W = 0, H = 0, raf = 0, t = 0, mx = 0, my = 0, ex = 0, ey = 0, boost = 0;
  const N = 420, pts = [];
  for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963; pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, h: 250 + (i % 7) * 8 }); }
  const anneaux = [0, 1].map(k => Array.from({ length: 80 }, (_, i) => ({ a: i / 110 * Math.PI * 2, k })));
  const taille = () => { const d = devicePixelRatio || 1; W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  taille(); addEventListener('resize', taille);
  const move = e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; };
  const clic = () => { boost = 1; };
  addEventListener('pointermove', move); canvas.addEventListener('pointerdown', clic);
  const proj = (x, y, z, ay, ax, R) => {
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y * cx - Z * sx; Z = y * sx + Z * cx;
    const p = 2.6 / (2.6 - Z * .9); return { x: W / 2 + X * R * p, y: H / 2 + Y * R * p, z: Z, p };
  };
  const boucle = () => {
    const etat = lire();                       // 'ecoute' | 'parle' | ''
    const vit = etat === 'parle' ? 2.2 : etat === 'ecoute' ? 1.2 : .8;
    t += .006 * vit; boost *= .94; ex += (mx - ex) * .08; ey += (my - ey) * .08;
    ctx.clearRect(0, 0, W, H);
    const teinte = etat === 'ecoute' ? 150 : 0, R = Math.min(W, H) * (.30 + boost * .04), ay = t * 1.1 + ex * .9, ax = .35 + Math.sin(t * .7) * .25 + ey * .5;
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 1.9);
    g.addColorStop(0, etat === 'ecoute' ? 'rgba(34,197,120,.40)' : 'rgba(124,58,237,.42)'); g.addColorStop(.5, 'rgba(37,99,235,.13)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const pulse = 1 + Math.sin(t * (etat === 'parle' ? 9 : 3)) * (etat === 'parle' ? .06 : .03) + boost * .08;
    const liste = pts.map(q => { const p = proj(q.x * pulse, q.y * pulse, q.z * pulse, ay, ax, R); p.h = q.h - (etat === 'ecoute' ? 100 : 0); return p; }).sort((a, b) => a.z - b.z);
    for (const p of liste) { const a = .25 + (p.z + 1) * .38; ctx.fillStyle = `hsla(${p.h + teinte * 0},90%,${62 + p.z * 14}%,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, (1 + (p.z + 1) * 1.15) * p.p, 0, 7); ctx.fill(); }
    anneaux.forEach((an, k) => an.forEach(q => {
      const a = q.a + t * (k ? -1.6 : 1.3), rr = 1.38 + k * .22 + (etat === 'ecoute' ? Math.sin(t * 5 + q.a * 3) * .05 : 0);
      const p = proj(Math.cos(a) * rr, Math.sin(a) * rr * (k ? .25 : .12), Math.sin(a) * rr, ay * .6 + k, ax + (k ? .9 : -.4), R);
      ctx.fillStyle = k ? 'rgba(79,224,176,.85)' : 'rgba(201,160,255,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + (p.z + 1) * .8, 0, 7); ctx.fill();
    }));
    ctx.font = '800 ' + Math.round(R * .26) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24; ctx.fillText('CLIPIA', W / 2, H / 2); ctx.shadowBlur = 0;
    raf = requestAnimationFrame(boucle);
  };
  boucle();
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', taille); removeEventListener('pointermove', move); };
}

export function installerDictee({ $, el, toast }) {
  if (document.getElementById('clipia-scene3d')) return;
  const st = document.createElement('style');
  st.textContent = `
  body.sc3-on #ecouteur,body.sc3-on #dialogue,body.sc3-on .dlg-vocal,body.sc3-on #atoiScene{display:none!important}
  #clipia-scene3d{position:fixed;inset:0;z-index:300;display:none;background:radial-gradient(ellipse at 50% 45%,#1b1245f2,#070b16f7 70%);color:#fff;font-family:system-ui,sans-serif;touch-action:none}
  #clipia-scene3d.on{display:block;animation:cs3in .45s ease-out}
  @keyframes cs3in{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}
  #clipia-scene3d canvas{position:absolute;inset:0;width:100%;height:100%;cursor:pointer}
  #cs3-txt{position:absolute;left:50%;bottom:11vh;transform:translateX(-50%);width:min(760px,90vw);text-align:center;pointer-events:none}
  #cs3-st{font-size:22px;font-weight:700;letter-spacing:.3px}
  #cs3-liv{margin-top:10px;font-size:17px;opacity:.88;min-height:44px}
  #cs3-x{position:absolute;top:18px;right:20px;border:1px solid #fff4;background:#0006;color:#fff;border-radius:99px;padding:8px 16px;cursor:pointer;font-size:14px}
  #cs3-aide{position:absolute;top:22px;left:24px;font-size:13px;opacity:.7}
  .dic-btn{display:inline-grid;place-items:center;width:30px;height:30px;margin-left:6px;border-radius:50%;border:1px solid #7c5cff88;background:#2a1a7acc;color:#fff;cursor:pointer;font-size:15px;vertical-align:middle;flex:none;padding:0}
  .dic-btn.on{background:#e5484d;border-color:#ff9a9a;animation:dicp 1s infinite}
  @keyframes dicp{50%{box-shadow:0 0 0 7px #e5484d33}}
  .dic-wrap{position:relative}
  textarea+.dic-btn{position:absolute;right:8px;bottom:8px;margin:0}
  #clipia-pastille{position:fixed;right:18px;bottom:18px;z-index:120;width:62px;height:62px;border-radius:50%;border:0;cursor:pointer;color:#fff;font-size:24px;
    background:radial-gradient(circle at 32% 28%,#d8ccff,#7c5cff 45%,#2a1a7a);box-shadow:0 6px 24px #7c5cff77;display:grid;place-items:center}
  #clipia-pastille::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid #a78bfa88;animation:cpa 2.6s infinite}
  @keyframes cpa{to{transform:scale(1.35);opacity:0}}
  #clipia-pastille.on{background:radial-gradient(circle at 32% 28%,#bff5d6,#22c578 45%,#0d5e3a)}
  `;
  document.head.append(st);

  /* ── scène plein écran ── */
  const scene = el(`<div id="clipia-scene3d" role="dialog" aria-label="Clipia"><canvas></canvas><div id="cs3-aide">Touche la sphère : stop / je t'écoute</div><button id="cs3-x">Fermer ✕</button><div id="cs3-txt"><div id="cs3-st"></div><div id="cs3-liv"></div></div></div>`);
  document.body.append(scene);
  let etat = '', arret = null;
  const cv = scene.querySelector('canvas'), stEl = scene.querySelector('#cs3-st'), liv = scene.querySelector('#cs3-liv');
  const TXT = { ecoute: "Je t'écoute…", parle: 'Je parle — dis « stop » ou touche la sphère' };
  function montrer(e) {
    etat = e;
    if (!e || e === 'reflechit') { if (scene.classList.contains('on')) { scene.classList.remove('on'); document.body.classList.remove('sc3-on'); arret?.(); arret = null; } return; }
    stEl.textContent = TXT[e] || '';
    if (!scene.classList.contains('on')) { scene.classList.add('on'); document.body.classList.add('sc3-on'); arret = anim3D(cv, () => etat); }
  }
  scene.querySelector('#cs3-x').onclick = () => { scene.classList.remove('on'); document.body.classList.remove('sc3-on'); arret?.(); arret = null; window.clipiaScene.fermee?.(); };
  cv.addEventListener('click', () => window.clipiaScene.touche?.(etat));
  window.clipiaScene = { etat: montrer, texte: t => { liv.textContent = t || ''; }, touche: null, fermee: null, visible: () => scene.classList.contains('on') };

  /* ── dictée par champ ── */
  let rec = null, cible = null, btnActif = null, deb = '';
  const champ = n => n.matches?.('textarea, input[type=text], input[type=search], input:not([type]), input[type=url], input[type=email]') && !n.dataset.noDic && !n.readOnly && !n.disabled && !n.closest('#clipia-scene3d');
  function fin() { try { rec?.abort(); } catch {} rec = null; btnActif?.classList.remove('on'); btnActif = null; cible = null; }
  function dicter(c, b) {
    if (!SR) return toast?.('La dictée vocale n\'est pas disponible dans ce navigateur (utilise Chrome ou Edge).', 'err');
    if (rec && cible === c) return fin();
    fin(); window.speechSynthesis?.cancel();
    cible = c; btnActif = b; b.classList.add('on'); deb = c.value ? c.value.replace(/\s*$/, ' ') : '';
    const r = new SR(); r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true; rec = r;
    r.onresult = e => {
      const t = Array.from(e.results).map(x => x[0].transcript).join(' ').trim();
      if (/^(?:stop|terminé|c'est tout)$/i.test(t)) return fin();
      c.value = deb + t; c.dispatchEvent(new Event('input', { bubbles: true }));
    };
    r.onerror = e => { if (e.error === 'not-allowed') toast?.('Autorise le micro pour dicter.', 'err'); fin(); };
    r.onend = () => { if (rec === r) { if (cible === c) { deb = c.value.replace(/\s*$/, ' '); try { r.start(); } catch { fin(); } } } };
    try { r.start(); } catch { fin(); }
    c.focus();
  }
  function equiper(c) {
    if (c.dataset.dic || !champ(c)) return;
    if (c.id === 'saisie' || c.closest('#bulles, .chat-entree, .composer')) return; /* le chat a déjà son micro : le bouton recouvrait « Envoyer » */
    c.dataset.dic = '1';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dic-btn'; b.title = 'Dicter (parle, ça s\'écrit)'; b.textContent = '🎙'; b.setAttribute('aria-label', 'Dicter dans ce champ');
    b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); dicter(c, b); });
    if (c.tagName === 'TEXTAREA') { const p = c.parentElement; if (p && getComputedStyle(p).position === 'static') p.style.position = 'relative'; c.after(b); }
    else c.after(b);
  }
  const balayer = (racine = document) => racine.querySelectorAll?.('textarea, input').forEach(equiper);
  let planifie = false;
  new MutationObserver(() => { if (planifie) return; planifie = true; setTimeout(() => { planifie = false; balayer(); }, 150); })
    .observe(document.body, { childList: true, subtree: true });
  balayer();

  /* ── pastille globale (hors chat) : dicte dans le champ actif, sinon dans le 1er champ visible ── */
  const past = el(`<button id="clipia-pastille" title="Clipia — dicter dans le champ actif" aria-label="Dicter">🎙</button>`);
  document.body.append(past);
  let dernier = null;
  addEventListener('focusin', e => { if (champ(e.target)) dernier = e.target; });
  function majPastille() { const id = location.hash.replace(/^#\/?/, '').split('?')[0]; past.style.display = (id === '' || id === 'clipia') ? 'none' : 'grid'; }
  addEventListener('hashchange', majPastille); majPastille();
  past.addEventListener('click', () => {
    let c = (document.activeElement && champ(document.activeElement)) ? document.activeElement : (dernier?.isConnected ? dernier : null);
    if (!c) c = Array.from(document.querySelectorAll('textarea, input')).find(x => champ(x) && x.offsetParent);
    if (!c) return toast?.('Aucun champ à remplir ici.', 'info');
    const b = c.nextElementSibling?.classList?.contains('dic-btn') ? c.nextElementSibling : { classList: { add() {}, remove() {} } };
    dicter(c, b); past.classList.toggle('on', Boolean(rec));
  });
  setInterval(() => past.classList.toggle('on', Boolean(rec)), 400);
  window.clipiaDicter = { fin, balayer };
}
