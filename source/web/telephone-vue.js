/* CLIPIA X7 — vue « Téléphone & MCP » : active l'accès, QR code, lien d'installation, config MCP. */
export function installerTelephone({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>.tl h2{margin:20px 0 8px}.tl .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:14px;margin:10px 0}
  .tl code,.tl pre{background:#05030f;border:1px solid #6d4fd644;border-radius:8px;padding:2px 7px;font-size:12.5px;word-break:break-all}.tl pre{padding:10px;white-space:pre-wrap}
  .tl .qr{width:210px;background:#fff;border-radius:12px;padding:6px}.tl .ligne{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.tl .petit{font-size:12.5px;opacity:.8}.tl .att{color:#fbbf24}</style>`));
  VUES.telephone = async v => {
    v.className = 'tl';
    const e = await fetch(API + '/api/acces-distant', { headers: H }).then(r => r.json());
    const base = e.adresses[0]?.url || `http://${location.hostname}:${e.port}`;
    const lien = e.actif ? `${base}/telephone#t=${e.jeton}` : '';
    const mcp = e.actif ? JSON.stringify({ mcpServers: { clipia: { type: 'http', url: `${base}/mcp`, headers: { Authorization: 'Bearer ' + e.jeton } } } }, null, 2) : '';
    v.innerHTML = `<h1>📱 Téléphone & MCP</h1>
      <p>Parle à Clipia depuis ton téléphone, de n'importe où, et laisse-la agir sur ton ordinateur. Rien n'est ouvert tant que tu n'actives pas l'accès ; tout passe par un <b>jeton secret</b> et le <b>contrôle de l'ordinateur demande toujours ton accord sur le PC</b>.</p>
      <div class="carte ligne"><label><input type="checkbox" id="tl-on" ${e.actif ? 'checked' : ''}> <b>Activer l'accès téléphone + MCP</b></label>
        ${e.actif ? '<button class="btn" id="tl-re">Nouveau jeton (déconnecte les anciens)</button>' : ''}</div>
      ${e.actif ? `<div class="carte"><h2 style="margin-top:0">1 · Installer l'appli sur le téléphone</h2><div class="ligne"><img class="qr" alt="QR" src="${API}/api/acces-distant/qr?u=${encodeURIComponent(lien)}">
        <div><p>Téléphone et PC sur le <b>même Wi-Fi</b> : scanne ce QR code avec l'appareil photo, puis :</p>
        <p>• <b>Android</b> (Chrome) : menu ⋮ → « Installer l'application ».<br>• <b>iPhone</b> (Safari) : Partager → « Sur l'écran d'accueil ».</p>
        <p class="petit">Lien : <code>${esc(lien)}</code></p></div></div></div>
        <div class="carte"><h2 style="margin-top:0">2 · De n'importe où (hors de chez toi)</h2>
        <p>Il faut un tunnel privé entre ton téléphone et ton PC. Deux options gratuites, installables depuis la <b>Logithèque</b> :</p>
        <p>• <b>Tailscale</b> (recommandé, privé) : installe-le sur le PC et le téléphone, même compte ; remplace l'adresse ci-dessus par l'adresse Tailscale du PC.<br>
        • <b>Cloudflare Tunnel</b> : <code>cloudflared tunnel --url http://localhost:${e.port}</code> donne une adresse https publique (protégée par le jeton).</p>
        <p class="petit att">Ne partage jamais le lien : il contient le jeton.</p></div>
        <div class="carte"><h2 style="margin-top:0">3 · Serveur MCP</h2><p>Clipia est aussi un <b>serveur MCP</b> (<code>${esc(base)}/mcp</code>) : outils <code>clipia_demander</code>, <code>clipia_etat</code>, <code>clipia_competences</code>. Colle ceci dans ton client MCP (Claude, OpenClaw, Cursor…) :</p><pre>${esc(mcp)}</pre></div>
        <p class="petit">Adresses réseau trouvées : ${e.adresses.map(a => `<code>${esc(a.url)}</code>`).join(' ') || 'aucune (Wi-Fi coupé ?)'}</p>` : ''}`;
    v.querySelector('#tl-on').onchange = async ev => { await fetch(API + '/api/acces-distant', { method: 'POST', headers: H, body: JSON.stringify({ actif: ev.target.checked }) }); VUES.telephone(v); };
    v.querySelector('#tl-re')?.addEventListener('click', async () => { await fetch(API + '/api/acces-distant', { method: 'POST', headers: H, body: JSON.stringify({ regenerer: true }) }); toast('Nouveau jeton créé', 'ok'); VUES.telephone(v); });
  };
}
