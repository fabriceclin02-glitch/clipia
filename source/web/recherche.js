/* CLIPIA — recherche globale (barre du haut, Ctrl+K) : menu, conversations (texte complet), compétences, apps, texte de la page. */
export function installerRecherche({ $, el, esc, api }) {
  if (document.getElementById('rch')) return;
  document.head.append(el(`<style>
  #rch{position:relative;margin-right:10px}
  #rch input{width:min(230px,18vw);padding:7px 12px 7px 32px;border-radius:99px;border:1px solid #6d4fd6;background:#0d0a28;color:inherit;font:inherit;font-size:13px}
  #rch:before{content:'🔍';position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;opacity:.8}
  #rch-r{position:absolute;right:0;top:calc(100% + 8px);width:min(460px,92vw);max-height:70vh;overflow:auto;border-radius:16px;padding:10px;background:rgba(14,10,40,.98);border:1px solid #6d4fd6;box-shadow:0 20px 50px #000a;display:none;z-index:95}
  #rch-r.o{display:block}#rch-r h5{margin:10px 6px 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.6}
  #rch-r a{display:block;padding:8px 10px;border-radius:10px;color:inherit;text-decoration:none;font-size:13px;cursor:pointer}
  #rch-r a:hover,#rch-r a.s{background:#4b3bb055}#rch-r a small{display:block;opacity:.7;font-size:11.5px;margin-top:2px}
  #rch-r mark{background:#ffd36b;color:#000;border-radius:3px;padding:0 2px}.rch-trouve{outline:2px solid #ffd36b;outline-offset:3px;border-radius:6px}
  @media (max-width:1100px){#plein{font-size:0!important;padding:6px 9px}#plein:before{content:'⛶';font-size:14px}}
  @media (max-width:700px){#rch input{width:120px}}
  </style>`));
  const zone = el(`<div id="rch"><input id="rch-i" type="search" placeholder="Rechercher… (Ctrl+K)" autocomplete="off" aria-label="Rechercher dans Clipia"><div id="rch-r"></div></div>`);
  const pousse = document.querySelector('.entete .pousse'); (pousse || document.querySelector('.entete')).prepend(zone);
  const pl = el(`<button class="btn mini" id="plein" title="Plein écran (F11)" aria-label="Plein écran" style="margin-right:10px">⛶ Plein écran</button>`);
  zone.after(pl);
  const majPlein = () => { const f = Boolean(document.fullscreenElement); pl.textContent = f ? '🗗 Quitter le plein écran' : '⛶ Plein écran'; };
  pl.onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { pl.title = 'Le navigateur refuse le plein écran : appuie sur F11.'; } majPlein(); };
  document.addEventListener('fullscreenchange', majPlein);
  const inp = $('#rch-i', zone), res = $('#rch-r', zone);
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const surligne = (t, q) => { const s = String(t); const i = norm(s).indexOf(norm(q)); return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length)); };
  let minuteur = 0, seq = 0;
  const fermer = () => res.classList.remove('o');
  async function chercher() {
    const q = inp.value.trim(); if (q.length < 2) { fermer(); return; }
    const moi = ++seq; let r = { conversations: [], competences: [], apps: [] };
    try { r = await api('/api/recherche?q=' + encodeURIComponent(q)); } catch {}
    if (moi !== seq) return;
    const menus = [...document.querySelectorAll('#nav a[data-id]')].filter(a => norm(a.textContent).includes(norm(q))).slice(0, 8);
    // texte visible de la page en cours
    const hits = []; const racine = document.querySelector('main') || document.body;
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    let nd; while ((nd = w.nextNode()) && hits.length < 6) {
      const p = nd.parentElement; if (!p || p.closest('#rch, #nav, script, style, textarea, input')) continue;
      if (norm(nd.nodeValue).includes(norm(q)) && nd.nodeValue.trim().length > 2) hits.push(p);
    }
    let h = '';
    if (menus.length) h += '<h5>Aller à</h5>' + menus.map(a => `<a href="${a.getAttribute('href')}">${a.querySelector('.ic')?.textContent || ''} ${surligne(a.textContent.replace(a.querySelector('.ic')?.textContent || '', '').trim(), q)}</a>`).join('');
    if (r.conversations.length) h += '<h5>Conversations</h5>' + r.conversations.map(c => `<a href="#/clipia?c=${encodeURIComponent(c.id)}">${surligne(c.titre, q)}<small>${surligne(c.extrait || '', q)}</small></a>`).join('');
    if (r.competences.length) h += '<h5>Compétences</h5>' + r.competences.map(c => `<a href="#/connexions">${surligne(c.nom, q)}<small>${esc(c.description)}</small></a>`).join('');
    if (r.apps.length) h += '<h5>Applications créées</h5>' + r.apps.map(a => `<a href="#/atelierapps">${surligne(a.nom, q)}<small>${esc(a.statut || '')}</small></a>`).join('');
    if (hits.length) h += '<h5>Sur cette page</h5>' + hits.map((p, i) => `<a data-hit="${i}">${surligne(p.textContent.trim().slice(0, 110), q)}</a>`).join('');
    res.innerHTML = h || '<a style="opacity:.7">Aucun résultat. Essaie un autre mot.</a>'; res.classList.add('o');
    res.querySelectorAll('[data-hit]').forEach(a => a.onclick = () => { const p = hits[+a.dataset.hit]; fermer(); p.scrollIntoView({ behavior: 'smooth', block: 'center' }); p.classList.add('rch-trouve'); setTimeout(() => p.classList.remove('rch-trouve'), 3500); });
    res.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', () => { fermer(); inp.value = ''; }));
  }
  inp.addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(chercher, 220); });
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { fermer(); inp.blur(); }
    if (ev.key === 'Enter') { const a = res.querySelector('a[href], a[data-hit]'); if (a) a.click(); }
  });
  document.addEventListener('click', ev => { if (!zone.contains(ev.target)) fermer(); });
  addEventListener('keydown', ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); inp.focus(); inp.select(); } });
}
