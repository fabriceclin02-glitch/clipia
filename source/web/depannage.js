/* CLIPIA X7 — « Résoudre un problème » : texte ou capture d'écran → diagnostic, étapes, réparation en un clic. Aussi : bloc « Solution » sous chaque erreur. */
export function installerDepannage({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'x-clipia-accord': '1' };
  document.head.append(el(`<style>
  .dp .carte,.dp-sol{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:14px;margin:10px 0}.dp-sol{border-color:#ffb36b88;background:#7a3d1222;font-size:13.5px}
  .dp textarea{width:100%;box-sizing:border-box;min-height:120px;padding:10px;border-radius:12px;border:1px solid #6d4fd6;background:#0d0a28;color:inherit;font:inherit}
  .dp .ligne,.dp-sol .ligne{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.dp .petit{font-size:12.5px;opacity:.78}
  .dp #dp-zone{border:2px dashed #6d4fd6;border-radius:14px;padding:14px;text-align:center;cursor:pointer;margin:8px 0}.dp #dp-zone.sur{background:#4b3bb033}.dp #dp-zone img{max-width:100%;max-height:220px;border-radius:10px}
  .conseil{margin-top:8px;padding:8px 12px;border-radius:10px;background:linear-gradient(135deg,#2a1d6e66,#16295f66);border:1px solid #6d4fd6;font-size:13px;line-height:1.45;animation:cs .5s ease}@keyframes cs{from{opacity:0;transform:translateY(6px)}}
  .dp-sol ol{margin:6px 0 0 18px;padding:0}.dp .ia{white-space:pre-wrap;line-height:1.5}
  </style>`));
  const blocRegle = (r) => `<div><b>💡 ${esc(r.titre)}</b><div class="petit" style="margin-top:3px">${esc(r.cause)}</div><ol>${r.etapes.map(e => `<li>${esc(e)}</li>`).join('')}</ol>
    ${r.reinstaller && !/^rien/.test(r.reinstaller) ? `<div class="petit">À réinstaller : <b>${esc(r.reinstaller)}</b></div>` : ''}
    <div class="ligne">${(r.actions || []).map((a, i) => a.type === 'lien' ? `<a class="btn" href="${esc(a.lien)}">${esc(a.label)}</a>` : `<button class="btn or" data-act="${esc(a.type)}">${esc(a.label)}</button>`).join('')}<span class="petit" data-etat></span></div></div>`;
  async function ffmpegInstall(etat) {
    etat.textContent = 'Téléchargement…';
    try {
      const r = await fetch(API + '/api/v4/ffmpeg', { method: 'POST', headers: { 'content-type': 'application/json', ...H }, body: '{}' });
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', ok = false;
      while (true) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); const l = buf.split('\n'); buf = l.pop();
        for (const L of l) { if (!L.startsWith('data:')) continue; const x = JSON.parse(L.slice(5)); if (x.erreur) { etat.textContent = '⚠ ' + x.erreur; return; } if (x.fini) ok = true; else etat.textContent = (x.message || 'en cours…') + (x.pct != null ? ' — ' + x.pct + ' %' : ''); } }
      etat.textContent = ok ? '✓ ffmpeg est installé. Relance ta demande.' : '⚠ L\'installation n\'a pas abouti : essaie la commande indiquée ci-dessus.';
    } catch (e) { etat.textContent = '⚠ ' + e.message; }
  }
  const clic = (cont) => cont.addEventListener('click', ev => { const b = ev.target.closest('[data-act="ffmpeg"]'); if (b) ffmpegInstall(b.parentElement.querySelector('[data-etat]')); });

  /* Sous chaque erreur du chat : la solution tout de suite. */
  window.clipiaAide = {
    async sous(noeud, message) {
      try {
        const { regle } = await api('/api/depannage/regle', { method: 'POST', body: JSON.stringify({ texte: message }) });
        const bloc = el(`<div class="dp-sol">${regle ? blocRegle(regle) : '<b>💡 Je ne connais pas encore cette erreur.</b><div class="ligne"><a class="btn or" href="#/depanner">🩺 Comprendre et résoudre</a></div>'}${regle ? '<div class="ligne"><a class="btn" href="#/depanner">🩺 Plus de détails avec une capture d\'écran</a></div>' : ''}</div>`);
        clic(bloc); noeud.parentElement?.append(bloc);
      } catch {}
    }
  };

  VUES.depanner = async v => {
    v.className = 'dp'; let image = null;
    v.innerHTML = `<h1>🩺 Résoudre un problème</h1><p class="petit">Colle le message d'erreur ou ajoute une capture d'écran : Clipia cherche la cause, te dit quoi réinstaller et quoi faire, étape par étape. Tu peux coller une image avec Ctrl+V.</p>
      <textarea id="dp-t" placeholder="Colle ici le message d'erreur, ou décris ce qui ne marche pas…"></textarea>
      <div id="dp-zone" tabindex="0">📎 Clique, dépose ou colle (Ctrl+V) une capture d'écran<input type="file" id="dp-f" accept="image/*" hidden></div>
      <div class="ligne"><button class="btn or" id="dp-go">🔍 Diagnostiquer</button><span class="petit" id="dp-m"></span></div><div id="dp-res"></div>`;
    const zone = $('#dp-zone', v);
    const poser = (f) => { if (!f || !/^image\//.test(f.type)) return; const r = new FileReader(); r.onload = () => { image = r.result; zone.innerHTML = `<img src="${image}" alt="capture">`; }; r.readAsDataURL(f); };
    zone.onclick = () => $('#dp-f', v).click(); $('#dp-f', v).onchange = e => poser(e.target.files[0]);
    zone.ondragover = e => { e.preventDefault(); zone.classList.add('sur'); }; zone.ondragleave = () => zone.classList.remove('sur');
    zone.ondrop = e => { e.preventDefault(); zone.classList.remove('sur'); poser(e.dataTransfer.files[0]); };
    const collage = e => { const f = [...(e.clipboardData?.files || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); poser(f); } };
    v.addEventListener('paste', collage);
    clic(v);
    $('#dp-go', v).onclick = async () => {
      const texte = $('#dp-t', v).value.trim(), m = $('#dp-m', v), res = $('#dp-res', v);
      if (!texte && !image) { m.textContent = 'Colle un message ou ajoute une capture.'; return; }
      m.textContent = 'Je cherche la cause…'; res.innerHTML = '';
      try {
        const r = await api('/api/depannage', { method: 'POST', headers: H, body: JSON.stringify({ texte, image }) });
        m.textContent = '';
        res.innerHTML = `${r.regle ? `<div class="carte">${blocRegle(r.regle)}</div>` : ''}${r.ia ? `<div class="carte"><b>🧠 Analyse${r.par ? ' (' + esc(r.par) + ')' : ''}</b><div class="ia">${esc(r.ia)}</div></div>` : ''}${r.note ? `<div class="petit">${esc(r.note)}</div>` : ''}`;
        const h = $('#dp-hist', v);
      } catch (e) { m.textContent = '⚠ ' + e.message; }
    };
  };
}
