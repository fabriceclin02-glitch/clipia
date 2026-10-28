/* CLIPIA X7 — Pont OpenClaw : reprend les compétences et savoir-faire d'OpenClaw (déjà installé sur ton ordinateur ou livrés avec Clipia). */
export function installerOpenClaw({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>
  .oc h2{margin:18px 0 8px}.oc .grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
  .oc .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:12px;display:grid;gap:6px}.oc .carte h3{margin:0;font-size:15px}
  .oc .petit{font-size:12.5px;opacity:.8}.oc .ok{color:#6ee7b7}.oc .att{color:#fbbf24}.oc .ligne{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .oc .badge{display:inline-block;border-radius:99px;padding:1px 9px;font-size:11.5px;background:#7c5cff33;border:1px solid #7c5cff66}
  .oc #oc-bar{position:sticky;top:0;z-index:5;background:#0e0a28ee;padding:10px;border-radius:12px;border:1px solid #6d4fd6;margin:8px 0}
  .oc pre{background:#05030f;border:1px solid #6d4fd6;border-radius:12px;padding:10px;max-height:240px;overflow:auto;white-space:pre-wrap;font-size:12px}
  </style>`));
  VUES.openclaw = async v => {
    v.className = 'oc'; v.innerHTML = '<h1>🦞 Pont OpenClaw</h1><p class="petit">Analyse…</p>';
    const e = await api('/api/openclaw'); const r = e.resume;
    const cats = [...new Set(e.catalogue.map(s => s.categorie))];
    const carte = s => `<label class="carte"><div class="ligne"><input type="checkbox" data-id="${esc(s.id)}" ${s.importee ? 'checked' : ''} ${s.specifique || !s.plateforme_ok ? 'disabled' : ''}><h3>${esc(s.icone)} ${esc(s.nom)}</h3></div>
      <div class="petit">${esc(s.description)}</div><div class="ligne">
      ${s.importee ? '<span class="badge ok">✓ dans Clipia</span>' : ''}${s.source === 'ordinateur' ? '<span class="badge">ta version OpenClaw</span>' : ''}
      ${!s.plateforme_ok ? `<span class="badge att">autre système (${esc(s.os.join('/'))})</span>` : ''}${s.specifique ? '<span class="badge">spécifique OpenClaw</span>' : ''}
      ${s.outils.length ? `<span class="badge ${s.outil_present ? 'ok' : 'att'}">${s.outil_present ? '✓' : '⚠ à installer'} ${esc(s.outils.join(' / '))}</span>` : ''}</div></label>`;
    v.innerHTML = `<h1>🦞 Pont OpenClaw</h1>
      <p>${e.present ? '<b class="ok">OpenClaw est présent sur cet ordinateur</b>' + (e.passerelle ? ' — passerelle active (port 18789).' : '.') : '<b class="att">OpenClaw n\'est pas détecté ici.</b> Les 50 compétences officielles sont quand même livrées avec Clipia.'}
      Clipia lit ces compétences comme des <b>méthodes</b> (jamais comme des ordres) et les applique avec ses propres outils.</p>
      <div id="oc-bar" class="ligne"><b>${r.importees}/${r.compatibles}</b> compétences actives · ${r.pretes} prêtes (outil déjà installé)
        <button id="oc-tout" class="btn">⚡ Tout importer (compatibles)</button><button id="oc-sel" class="btn">Importer la sélection</button><button id="oc-ret" class="btn">Retirer les compétences OpenClaw</button>
        <button id="oc-test" class="btn">🔎 Tester le pont</button></div><pre id="oc-sortie" hidden></pre>
      <h2>Ce que fait OpenClaw → et comment Clipia le reprend</h2>
      <div class="grille">${e.savoirs.map(x => `<div class="carte"><h3>${esc(x.icone)} ${esc(x.nom)}</h3><div class="petit"><b>OpenClaw :</b> ${esc(x.openclaw)}</div><div class="petit"><b>Dans Clipia :</b> ${esc(x.clipia)}</div>${x.pont ? '<span class="badge">via le pont (outil openclaw_cli)</span>' : ''}</div>`).join('')}</div>
      ${cats.map(c => `<h2>${esc(c)}</h2><div class="grille">${e.catalogue.filter(s => s.categorie === c).map(carte).join('')}</div>`).join('')}
      <p class="petit" style="margin-top:20px">${esc(e.licence)}. Dis simplement à Clipia : « utilise la compétence météo », « demande à OpenClaw de… ».</p>`;
    const sortie = v.querySelector('#oc-sortie');
    const importer = async (corps, msg) => { const x = await fetch(API + '/api/openclaw/importer', { method: 'POST', headers: H, body: JSON.stringify(corps) }).then(r => r.json()); toast(msg(x), 'ok'); VUES.openclaw(v); };
    v.querySelector('#oc-tout').onclick = () => importer({}, x => `${x.importees} compétences OpenClaw importées`);
    v.querySelector('#oc-sel').onclick = () => importer({ ids: [...v.querySelectorAll('[data-id]:checked')].map(i => i.dataset.id) }, x => `${x.importees} compétences importées`);
    v.querySelector('#oc-ret').onclick = () => importer({ retirer: true }, () => 'Compétences OpenClaw retirées');
    v.querySelector('#oc-test').onclick = async () => {
      sortie.hidden = false; sortie.textContent = 'Test en cours…';
      const x = await fetch(API + '/api/openclaw/cli', { method: 'POST', headers: H, body: JSON.stringify({ args: 'status' }) }).then(r => r.json());
      sortie.textContent = x.erreur ? '⚠ ' + x.erreur : x.sortie || '(aucune sortie)';
    };
  };
}
