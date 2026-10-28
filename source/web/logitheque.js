/* CLIPIA X7 — Logithèque : logiciels libres (musique, vidéo, image, code, IA locale) et outils Google, installés un par un, pas à pas, sous tes yeux. */
export function installerLogitheque({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'x-clipia-accord': '1' };
  document.head.append(el(`<style>
  .lg h2{margin:18px 0 8px}.lg .grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}
  .lg .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:12px;display:grid;gap:6px;transition:transform .2s,border-color .2s}.lg .carte:hover{transform:translateY(-2px);border-color:#a99bff}
  .lg .carte h3{margin:0;font-size:15px}.lg .petit{font-size:12.5px;opacity:.78}.lg code{background:#0008;padding:1px 6px;border-radius:6px;font-size:11.5px}.lg .ligne{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .lg .ok{color:#6ee7b7}.lg #lg-log{background:#05030f;border:1px solid #6d4fd6;border-radius:12px;padding:10px;font:12px/1.5 ui-monospace,monospace;max-height:260px;overflow:auto;white-space:pre-wrap;display:none}
  .lg #lg-bar{position:sticky;top:0;z-index:5;background:#0e0a28ee;padding:10px;border-radius:12px;border:1px solid #6d4fd6;margin:8px 0}
  </style>`));
  const flux = async (id, log) => {
    const r = await fetch(API + '/api/logitheque/installer', { method: 'POST', headers: { 'content-type': 'application/json', ...H }, body: JSON.stringify({ id }) });
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', ok = false, err = null;
    while (true) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); const l = buf.split('\n'); buf = l.pop();
      for (const L of l) { if (!L.startsWith('data:')) continue; const x = JSON.parse(L.slice(5)); if (x.ligne) log(x.ligne); if (x.fini) ok = true; if (x.erreur) err = x; } }
    if (err) { log('⚠ ' + err.erreur); if (err.aide) log('💡 ' + err.aide.titre + ' — ' + err.aide.etapes[0]); }
    return ok;
  };
  VUES.logitheque = async v => {
    v.className = 'lg'; v.innerHTML = '<h1>📦 Logithèque</h1><p class="petit">Chargement…</p>';
    const { categories, liste, plateforme } = await api('/api/logitheque');
    const sys = plateforme === 'win32' ? 'Windows (winget)' : plateforme === 'darwin' ? 'macOS (Homebrew)' : 'Linux (apt)';
    const carte = e => `<div class="carte" data-id="${esc(e.id)}"><h3>${esc(e.nom)} ${e.installe ? '<span class="ok">✓ installé</span>' : ''}</h3><div class="petit">${esc(e.quoi)}</div>
      ${e.licence ? `<div class="petit">Licence : ${esc(e.licence)}</div>` : ''}${e.commande ? `<div class="petit">Commande : <code>${esc(e.commande)}</code></div>` : ''}
      ${e.necessite ? `<div class="petit">Demande d'abord : ${esc(e.necessite)}</div>` : ''}
      <div class="ligne">${e.possible && !e.installe ? `<label class="petit"><input type="checkbox" data-sel="${esc(e.id)}"> Sélectionner</label><button class="btn or" data-a="inst">Installer</button>` : ''}${e.lien ? `<a class="btn" href="${esc(e.lien)}" target="_blank" rel="noopener">${e.lienSeul ? 'Ouvrir ↗' : 'Site officiel ↗'}</a>` : ''}<span class="petit" data-m></span></div></div>`;
    v.innerHTML = `<h1>📦 Logithèque</h1><p class="petit">Des logiciels libres et gratuits pour créer : ils s'installent sur ton ordinateur (${esc(sys)}), un par un, avec la commande affichée. Rien n'est installé sans ton clic. Sur Windows, l'installateur de Clipia propose aussi de les cocher dès le départ.</p>
      <div id="lg-bar"><div class="ligne"><button class="btn or" id="lg-tout">▶ Installer la sélection pas à pas</button><button class="btn" id="lg-aucun">Tout décocher</button><span class="petit" id="lg-n"></span></div><pre id="lg-log"></pre></div>
      ${Object.entries(categories).map(([k, t]) => `<h2>${esc(t)}</h2><div class="grille">${liste.filter(e => e.cat === k || (k === 'musique' && e.id === 'udio' && false)).map(carte).join('')}</div>`).join('')}`;
    const log = (l) => { const p = $('#lg-log', v); p.style.display = 'block'; p.textContent += l + '\n'; p.scrollTop = 1e9; };
    const n = () => { $('#lg-n', v).textContent = v.querySelectorAll('[data-sel]:checked').length + ' sélectionné(s)'; }; n();
    v.onchange = n;
    async function faire(id) {
      const c = v.querySelector(`[data-id="${id}"]`), m = c?.querySelector('[data-m]'); const nom = liste.find(x => x.id === id)?.nom || id;
      log(`\n══ ${nom} ══`); if (m) m.textContent = 'Installation…';
      const ok = await flux(id, log).catch(e => { log('⚠ ' + e.message); return false; });
      if (m) m.textContent = ok ? '✓ Installé' : '⚠ Échec (voir le journal)'; if (ok) { c?.querySelector('h3')?.insertAdjacentHTML('beforeend', ' <span class="ok">✓ installé</span>'); }
      return ok;
    }
    v.onclick = async ev => {
      const b = ev.target.closest('[data-a="inst"]'); if (!b) return; b.disabled = true; await faire(b.closest('[data-id]').dataset.id); b.disabled = false;
    };
    $('#lg-aucun', v).onclick = () => { v.querySelectorAll('[data-sel]').forEach(c => c.checked = false); n(); };
    $('#lg-tout', v).onclick = async () => {
      const ids = [...v.querySelectorAll('[data-sel]:checked')].map(c => c.dataset.sel); if (!ids.length) { toast('Coche d\'abord un ou plusieurs logiciels.'); return; }
      $('#lg-tout', v).disabled = true; let bons = 0;
      for (let i = 0; i < ids.length; i++) { $('#lg-n', v).textContent = `Étape ${i + 1}/${ids.length}…`; if (await faire(ids[i])) bons++; }
      $('#lg-n', v).textContent = `Terminé : ${bons}/${ids.length} installé(s).`; $('#lg-tout', v).disabled = false; toast(`${bons}/${ids.length} logiciel(s) installé(s).`);
    };
  };
}
