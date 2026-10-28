/* CLIPIA — livrables : tout ce que Clipia crée (image, musique, vidéo, PDF, fichier…) s'affiche avec ses actions
   (télécharger, partager, copier le lien, ouvrir) soit dans la discussion, soit dans un panneau à côté. */
export function installerLivrables({ $, el, esc, API, toast }) {
  const lire = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const liste = [];            // livrables de cette session
  let mode = lire('clipia:livrable', 'discussion');   // 'discussion' | 'cote'

  document.head.append(el(`<style>
  .lv{margin-top:8px;border:1px solid #6d4fd688;border-radius:14px;overflow:hidden;background:#ffffff0a;max-width:min(100%,560px)}
  .lv-aperçu{display:grid;place-items:center;background:#0006;max-height:340px;overflow:hidden}
  .lv-aperçu img{max-width:100%;max-height:340px;display:block;cursor:zoom-in}.lv-aperçu video{max-width:100%;max-height:340px}
  .lv-aperçu audio{width:100%;margin:14px}.lv-aperçu iframe{width:100%;height:320px;border:0;background:#fff}
  .lv-aperçu .lv-ic{font-size:46px;padding:22px}
  .lv-bas{padding:10px 12px}.lv-nom{font-weight:600;font-size:13.5px;word-break:break-all}.lv-sous{font-size:12px;opacity:.7}
  .lv-act{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.lv-act .btn,.lv-act a.btn{font-size:12.5px;padding:6px 11px;text-decoration:none;display:inline-block}
  #lv-panneau{position:fixed;top:0;right:0;bottom:0;width:min(480px,94vw);z-index:85;background:#0e0a28f8;border-left:1px solid #6d4fd6;box-shadow:-20px 0 50px #000a;
    transform:translateX(105%);transition:transform .28s;display:flex;flex-direction:column}
  #lv-panneau.o{transform:none}
  #lv-panneau header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #ffffff22}
  #lv-panneau header b{flex:1}#lv-corps{overflow:auto;padding:12px;display:grid;gap:12px;align-content:start}
  #lv-corps .lv{max-width:100%}#lv-corps .lv-aperçu{max-height:none}#lv-corps .lv-aperçu img{max-height:60vh}
  #lv-bouton{position:fixed;right:14px;bottom:70px;z-index:80;border-radius:99px;padding:8px 14px;border:1px solid #6d4fd6;background:#16295f;color:#fff;cursor:pointer;font-size:13px;display:none}
  </style>`));
  const panneau = el(`<aside id="lv-panneau" aria-label="Livrables"><header><b>📦 Livrables</b>
    <label class="petit" style="font-size:12px">Affichage <select id="lv-mode"><option value="discussion">Dans la discussion</option><option value="cote">Panneau à côté</option><option value="les-deux">Les deux</option></select></label>
    <button class="btn mini" id="lv-x" aria-label="Fermer">✕</button></header><div id="lv-corps"></div></aside>`);
  const bouton = el('<button id="lv-bouton" title="Voir les livrables">📦 Livrables <span id="lv-n"></span></button>');
  document.body.append(panneau, bouton);
  $('#lv-mode', panneau).value = mode;
  $('#lv-mode', panneau).onchange = ev => { mode = ev.target.value; ecrire('clipia:livrable', mode); toast('Les livrables s\'afficheront : ' + ev.target.selectedOptions[0].textContent.toLowerCase() + '.'); };
  const ouvrir = () => panneau.classList.add('o'); const fermer = () => panneau.classList.remove('o');
  $('#lv-x', panneau).onclick = fermer; bouton.onclick = () => panneau.classList.contains('o') ? fermer() : ouvrir();

  const absolu = u => /^(https?:|data:|blob:)/i.test(u) ? u : API + u;
  const genre = (url, nom = '') => { const t = (nom || url).toLowerCase().split('?')[0];
    if (/\.(png|jpe?g|webp|gif|svg|avif)$/.test(t)) return 'image'; if (/\.(mp3|wav|ogg|m4a|flac)$/.test(t)) return 'audio';
    if (/\.(mp4|webm|mov|mkv)$/.test(t)) return 'video'; if (/\.pdf$/.test(t)) return 'pdf';
    if (/\.(txt|md|csv|json|html?|js|py|css)$/.test(t)) return 'texte'; return /image/.test(url) ? 'image' : 'fichier'; };
  const ICONES = { image: '🖼', audio: '🎵', video: '🎬', pdf: '📄', texte: '📝', fichier: '📦' };

  async function partager(l) {
    const url = absolu(l.url);
    try {
      const r = await fetch(url); const blob = await r.blob(); const f = new File([blob], l.nom, { type: blob.type });
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: l.nom }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { if (navigator.share) { await navigator.share({ title: l.nom, url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast('Lien copié. Il ne fonctionne que sur cet ordinateur : pour l\'envoyer à quelqu\'un, télécharge le fichier.', 'ok'); }
    catch { toast('Télécharge le fichier pour le partager.'); }
  }

  /** Une carte de livrable : aperçu + actions. */
  function carte(e, { compact = false } = {}) {
    const url = e.url; const nom = e.nom || decodeURIComponent(String(url).split('?')[0].split('/').pop() || 'livrable');
    const g = genre(url, nom); const l = { url, nom, genre: g };
    const src = absolu(url);
    const apercu = g === 'image' ? `<img src="${esc(src)}" alt="${esc(nom)}">` : g === 'audio' ? `<audio controls src="${esc(src)}"></audio>`
      : g === 'video' ? `<video controls src="${esc(src)}"></video>` : g === 'pdf' ? `<iframe src="${esc(src)}" title="${esc(nom)}"></iframe>` : `<div class="lv-ic">${ICONES[g]}</div>`;
    const dl = src + (src.includes('/api/projets/') ? '?dl=1' : '');
    const c = el(`<div class="lv"><div class="lv-aperçu">${apercu}</div><div class="lv-bas"><div class="lv-nom">${ICONES[g]} ${esc(nom)}</div><div class="lv-sous">${esc(e.outil ? String(e.outil).replace(/_/g, ' ') : 'Livrable')}</div>
      <div class="lv-act"><a class="btn or" href="${esc(dl)}" download="${esc(nom)}">⬇ Télécharger</a><button class="btn" data-a="partager">↗ Partager</button><button class="btn" data-a="copier">🔗 Copier le lien</button>
      <a class="btn" href="${esc(src)}" target="_blank" rel="noopener">⧉ Ouvrir</a>${compact ? '' : '<button class="btn" data-a="cote">▤ Panneau à côté</button>'}</div></div></div>`);
    if (g === 'image') c.querySelector('img').onclick = () => window.open(src);
    c.onclick = async ev => { const b = ev.target.closest('button[data-a]'); if (!b) return;
      if (b.dataset.a === 'partager') partager(l);
      else if (b.dataset.a === 'copier') { try { await navigator.clipboard.writeText(src); toast('Lien copié.', 'ok'); } catch { toast('Copie impossible.'); } }
      else if (b.dataset.a === 'cote') ouvrir(); };
    return c;
  }

  /** Appelé par la discussion pour chaque livrable créé. Renvoie l'élément à mettre dans la discussion (ou null). */
  function livrer(e) {
    liste.push(e);
    const corps = $('#lv-corps', panneau);
    if (mode !== 'discussion') { corps.prepend(carte(e, { compact: true })); }
    else corps.prepend(carte(e, { compact: true }));
    $('#lv-n').textContent = '(' + liste.length + ')'; bouton.style.display = 'block';
    if (mode === 'cote' || mode === 'les-deux') ouvrir();
    return mode === 'cote' ? el(`<div class="petit" style="margin-top:6px">📦 « ${esc(e.nom || 'livrable')} » est prêt — il s'affiche dans le panneau à côté. <a href="#" data-ouvre>Afficher</a></div>`) : carte(e);
  }
  document.addEventListener('click', ev => { if (ev.target.closest('[data-ouvre]')) { ev.preventDefault(); ouvrir(); } });
  window.clipiaLivrables = { livrer, carte, ouvrir, fermer, mode: () => mode };
}
