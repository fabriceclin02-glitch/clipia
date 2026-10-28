/* CLIPIA X7 — « Skills & extensions » : cerveaux gratuits de Google, méthodes activables, clés dans le coffre chiffré. */
export function installerExtensions({ $, el, esc, api, VUES, toast }) {
  const H = { 'x-clipia-accord': '1' };
  const post = (u, b) => api(u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
  document.head.append(el(`<style>
  .ex h2{margin:20px 0 8px}.ex .grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
  .ex .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:16px;padding:14px;transition:transform .2s,border-color .2s}
  .ex .carte:hover{transform:translateY(-3px);border-color:#a99bff}.ex .carte h3{margin:0 0 4px;font-size:15.5px}
  .ex .petit{opacity:.78;font-size:12.5px}.ex .ligne{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
  .ex .carte h3{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.ex .puce{display:inline-block;font-size:11px;padding:2px 8px;border-radius:99px;background:#4b3bb055;margin-left:6px}
  .ex input{flex:1;min-width:150px;padding:7px 10px;border-radius:9px;border:1px solid #6d4fd6;background:#0d0a28;color:inherit}
  .ex code{background:#0008;padding:2px 6px;border-radius:6px}
  </style>`));
  const PUCE = { api: 'clé', local: 'local', web: 'web', skill: 'méthode' };
  const carte = e => `<div class="carte" data-id="${esc(e.id)}"><h3>${e.icone} ${esc(e.nom)}<span class="puce">${PUCE[e.statut] || ''}</span></h3>
    <div class="petit">${esc(e.quoi)}</div>
    ${e.commande ? `<div class="petit" style="margin-top:6px">Commande : <code>${esc(e.commande)}</code></div>` : ''}
    ${e.guide.length ? `<details><summary class="petit">Comment faire ?</summary><ol class="petit">${e.guide.map(g => `<li>${esc(g)}</li>`).join('')}</ol></details>` : ''}
    ${e.cle ? `<div class="ligne"><input type="password" autocomplete="off" data-cle placeholder="${esc((e.cle.rempli ? '✓ enregistrée — ' : '') + e.cle.label)}"><button class="btn or" data-a="save">Enregistrer</button><button class="btn" data-a="test">Tester</button>${e.cle.rempli ? '<button class="btn" data-a="del">Oublier</button>' : ''}</div>` : ''}
    <div class="ligne">${e.methode ? `<label class="petit"><input type="checkbox" data-a="skill" ${e.actif ? 'checked' : ''} style="flex:none;min-width:0"> Activer la méthode</label>` : ''}${e.lien ? `<a class="btn" href="${esc(e.lien)}" target="_blank" rel="noopener">Ouvrir ↗</a>` : ''}<span class="petit" data-m></span></div></div>`;
  VUES.extensions = async v => {
    v.className = 'ex';
    const liste = await api('/api/ext');
    v.innerHTML = `<h1>🧩 Skills &amp; extensions</h1>
      <p class="petit">Tes clés sont rangées dans le <b>coffre chiffré</b> de ton ordinateur (jamais en clair, jamais envoyées ailleurs que vers le service concerné). Une méthode activée devient une compétence que Clipia lit quand la demande s'y prête.</p>
      <h2>🔵 Les outils gratuits de Google</h2><div class="petit">Seuls Gemini (clé AI Studio) et Gemma (en local) se branchent directement comme cerveau de Clipia. Les autres outils Google (Antigravity, Flow, Whisk, Jules, NotebookLM) s'utilisent sur le site de Google : Clipia te prépare les prompts et le cahier des charges. Les quotas et pays disponibles sont décidés par Google.</div>
      <div class="grille">${liste.filter(e => e.groupe === 'google').map(carte).join('')}</div>
      <h2>🧰 Skills &amp; extensions connectables</h2>
      <div class="grille">${liste.filter(e => e.groupe === 'skill').map(carte).join('')}</div>
      <p class="petit" style="margin-top:16px">Tu veux ajouter ta propre compétence ou connecter Gmail, Slack, WhatsApp, Telegram ? C'est dans <a href="#/connexions">Connexions &amp; compétences</a>.</p>`;
    v.onclick = async ev => {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const c = b.closest('[data-id]'), e = liste.find(x => x.id === c.dataset.id), m = c.querySelector('[data-m]'), a = b.dataset.a;
      try {
        if (a === 'save') {
          const val = c.querySelector('[data-cle]').value.trim(); if (!val) { m.textContent = 'Colle ta clé d\'abord.'; return; }
          m.textContent = 'Vérification…';
          let ok = true; try { const r = await api('/api/coffre/tester', { method: 'POST', body: JSON.stringify({ fournisseur: e.cle.fournisseur, valeur: val }) }); ok = r.ok !== false; if (!ok) m.textContent = '⚠ ' + (r.message || 'Clé refusée') + ' — enregistrée quand même ?'; } catch {}
          if (!ok && !confirm('La clé n\'a pas été validée. L\'enregistrer quand même ?')) return;
          await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: e.cle.vault, valeur: val, label: e.cle.label }) });
          toast('Clé enregistrée dans le coffre.'); VUES.extensions(v);
        } else if (a === 'test') {
          m.textContent = 'Test…'; const r = await api('/api/coffre/tester', { method: 'POST', body: JSON.stringify({ fournisseur: e.cle.fournisseur }) }); m.textContent = (r.ok === false ? '⚠ ' : '✓ ') + (r.message || 'Clé valide.');
        } else if (a === 'del') { await api('/api/coffre/' + encodeURIComponent(e.cle.vault), { method: 'DELETE' }); VUES.extensions(v); }
        else if (a === 'skill') { await post('/api/ext/activer', { id: e.id, actif: b.checked }); toast(b.checked ? 'Méthode activée.' : 'Méthode retirée.'); }
      } catch (err) { m.textContent = '⚠ ' + err.message; }
    };
  };
}
