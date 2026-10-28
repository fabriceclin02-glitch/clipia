/* CLIPIA X8 — Communauté & évolution : idées, bugs, mises à jour, circuit d'amélioration automatique via GitHub. */
export function installerCommunaute({ $, el, esc, api, API, VUES, toast }) {
  document.head.append(el(`<style>.cm .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:16px;margin:12px 0}.cm input,.cm textarea{width:100%;border-radius:10px;padding:10px;background:#0003;border:1px solid #ffffff2a;color:inherit;font:inherit;margin:6px 0}.cm ol li{margin:8px 0}.cm .petit{font-size:13px;opacity:.8}.cm .nv{background:#00e0a422;border:1px solid #00e0a488;border-radius:12px;padding:12px;margin:10px 0}</style>`));
  async function majBandeau(force) {
    const z = $('#cm-maj'); if (!z) return;
    z.textContent = 'Vérification…';
    try {
      const m = await api('/api/maj' + (force ? '?force=1' : ''));
      if (m.erreur) z.innerHTML = `<span class="petit">${esc(m.erreur)}</span>`;
      else if (m.nouvelle) z.innerHTML = `<div class="nv"><b>Nouvelle version disponible : ${esc(m.derniere)}</b> (tu as la ${esc(m.actuelle)}).<br><a class="btn or" style="display:inline-block;margin-top:8px" href="${esc(m.page)}" target="_blank" rel="noopener">⬇ Télécharger la dernière version</a> <a href="${esc(m.releases)}" target="_blank" rel="noopener">Toutes les versions</a></div>`;
      else z.innerHTML = `✅ Tu as la dernière version (${esc(m.actuelle)}). <a href="${esc(m.releases)}" target="_blank" rel="noopener">Anciennes versions</a>`;
    } catch (e) { z.textContent = e.message; }
  }
  VUES.communaute = async v => {
    v.className = 'cm';
    let L = {}, ver = '';
    try { const r = await api('/api/communaute'); L = r.liens; ver = r.version; } catch {}
    v.innerHTML = `<h1>🌍 Communauté & évolution</h1>
      <p>Clipia est faite <b>avec</b> toi. Chacun peut proposer une idée ; le propriétaire du projet l'approuve, Clipia prépare l'amélioration, les tests la vérifient, et une <b>nouvelle version</b> est publiée — les anciennes restent téléchargeables.</p>
      <div class="carte"><h2 style="margin-top:0">Mises à jour</h2><div id="cm-maj">…</div><button class="btn" id="cm-v" style="margin-top:8px">Vérifier maintenant</button><p class="petit">Version installée : ${esc(ver)}</p></div>
      <div class="carte"><h2 style="margin-top:0">💡 Proposer une idée</h2>
        <input id="cm-t" placeholder="Titre court (ex. : Pouvoir exporter mes factures en PDF)">
        <textarea id="cm-b" rows="4" placeholder="Ce que tu voudrais, et pourquoi. Clipia en fera une proposition claire."></textarea>
        <button class="btn or" id="cm-i">Ouvrir sur GitHub (je valide moi-même)</button> <button class="btn" id="cm-bug">🐞 Signaler un bug</button>
        <p class="petit">Un compte GitHub gratuit est nécessaire pour publier. Clipia n'envoie rien à ta place : c'est toi qui cliques « Submit » sur GitHub.</p></div>
      <div class="carte"><h2 style="margin-top:0">Comment l'évolution automatique fonctionne</h2><ol>
        <li><b>Idée</b> publiée sur GitHub (formulaire guidé).</li>
        <li><b>Approbation</b> : le propriétaire ajoute l'étiquette « approuvé ». Rien n'est modifié sans cette étape (protection contre les idées piégées).</li>
        <li><b>Clipia réfléchit et propose</b> un changement dans une « pull request », avec explications.</li>
        <li><b>Tests automatiques</b> : le code doit démarrer et passer les contrôles.</li>
        <li><b>Validation humaine</b> : le propriétaire accepte la proposition.</li>
        <li><b>Nouvelle version</b> compilée et publiée (Windows, Mac, Linux), numérotée ; <b>les anciennes versions restent sur GitHub</b>.</li></ol></div>
      <div class="carte"><h2 style="margin-top:0">Liens</h2><p><a href="${esc(L.idees || '#')}" target="_blank" rel="noopener">Idées de la communauté</a> · <a href="${esc(L.discussions || '#')}" target="_blank" rel="noopener">Discussions</a> · <a href="${esc(L.versions || '#')}" target="_blank" rel="noopener">Toutes les versions</a> · <a href="${esc(L.contribuer || '#')}" target="_blank" rel="noopener">Contribuer au code</a></p></div>`;
    majBandeau(false);
    $('#cm-v').onclick = () => majBandeau(true);
    const ouvrir = async type => {
      try { const r = await api('/api/communaute/idee', { method: 'POST', body: JSON.stringify({ titre: $('#cm-t').value, texte: $('#cm-b').value, type }) }); window.open(r.url, '_blank', 'noopener'); }
      catch (e) { toast(e.message, 'err'); }
    };
    $('#cm-i').onclick = () => ouvrir('idee'); $('#cm-bug').onclick = () => ouvrir('bug');
  };
  // Vérification discrète au démarrage : une pastille dans le menu si une version plus récente existe
  setTimeout(async () => { try { const m = await api('/api/maj'); if (m.nouvelle) toast(`Clipia ${m.derniere} est disponible — ouvre « Communauté & évolution ».`, 'ok'); } catch {} }, 6000);
}
