/* CLIPIA X7 — vue « Téléphone & MCP » : active l'accès, QR code, lien d'installation, config MCP. */
export function installerTelephone({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>.tl h2{margin:20px 0 8px}.tl .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:14px;margin:10px 0}
  .tl code,.tl pre{background:#05030f;border:1px solid #6d4fd644;border-radius:8px;padding:2px 7px;font-size:12.5px;word-break:break-all}.tl pre{padding:10px;white-space:pre-wrap}
  .tl .qr{width:210px;background:#fff;border-radius:12px;padding:6px}.tl .ligne{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.tl .petit{font-size:12.5px;opacity:.8}.tl .att{color:#fbbf24}</style>`));

  /* ── Discuter avec ton IA depuis le téléphone : QR code, appareils appairés, accords en attente ── */
  function chatPanneau(zone, vue) {
    let chrono = null, sonde = null;
    const fin = () => { clearInterval(chrono); clearInterval(sonde); };
    const j = (m, p, b) => fetch(API + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erreur || r.status); return d; });
    async function rendre(qr) {
      fin();
      const a = await j('GET', '/api/appairage/appareils').catch(() => ({ appareils: [], accordsTelephone: false }));
      zone.innerHTML = `<div class="carte" style="border-color:#00a88488"><h2 style="margin-top:0">💬 Discuter avec ton IA depuis ton téléphone</h2>
        <p class="petit">Une messagerie façon WhatsApp, uniquement entre ton téléphone et Clipia. Elle réfléchit, choisit le meilleur moteur, puis affiche l'image ou la vidéo dans la discussion. Téléphone et ordinateur sur le même Wi-Fi.</p>
        ${qr ? `<div class="ligne"><div style="text-align:center"><div style="width:210px;background:#fff;border-radius:12px;padding:6px">${qr.qrApp}</div><b>Application Clipia (Android)</b><div class="petit">Scanne avec l'appareil photo → « Ouvrir dans Clipia »</div></div>
          ${qr.qrNav ? `<div style="text-align:center"><div style="width:210px;background:#fff;border-radius:12px;padding:6px">${qr.qrNav}</div><b>Navigateur du téléphone</b><div class="petit">Sans application (Android et iPhone)</div></div>` : ''}
          <div><p>Ce QR code expire dans <b id="tl-cd">2:00</b> et ne sert qu'une fois.</p><button class="btn" id="tl-nq">Nouveau QR code</button>
          <p class="petit">Code manuel : <code>${esc(qr.code)}</code><br>Adresse : <code>${esc((qr.adresses[0] || {}).url || '')}</code></p></div></div>`
          : '<button class="btn or" id="tl-cr">📷 Connecter mon téléphone</button>'}
        <h3>Téléphones connectés</h3>
        ${a.appareils.length ? a.appareils.map(x => `<div class="ligne" style="justify-content:space-between"><span>📱 <b>${esc(x.nom)}</b> <span class="petit">· dernière activité ${new Date(x.dernierVu).toLocaleString('fr-FR')}</span></span><button class="btn" data-rev="${esc(x.id)}">Déconnecter</button></div>`).join('') : '<p class="petit">Aucun pour l\'instant.</p>'}
        <label class="petit" style="display:block;margin-top:10px"><input type="checkbox" id="tl-acc" ${a.accordsTelephone ? 'checked' : ''}> Autoriser aussi les <b>accords</b> (contrôle du PC, commandes) depuis le téléphone — par défaut ils se valident ici, sur l'ordinateur.</label>
        <div id="tl-att"></div></div>`;
      zone.querySelector('#tl-cr')?.addEventListener('click', creer); zone.querySelector('#tl-nq')?.addEventListener('click', creer);
      zone.querySelectorAll('[data-rev]').forEach(b => b.onclick = async () => { await j('DELETE', '/api/appairage/appareils/' + encodeURIComponent(b.dataset.rev)); toast('Téléphone déconnecté'); rendre(); });
      zone.querySelector('#tl-acc').onchange = e => j('POST', '/api/appairage/reglages', { accordsTelephone: e.target.checked });
      if (qr) { chrono = setInterval(() => { const r = Math.max(0, Math.round((qr.expire - Date.now()) / 1000)); const c = zone.querySelector('#tl-cd'); if (!c || !zone.isConnected) return fin(); c.textContent = Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0'); if (!r) rendre(); }, 1000); }
      const att = async () => { if (!zone.isConnected) return fin(); const d = await j('GET', '/api/chat/attente').catch(() => ({ attente: [] })); const z = zone.querySelector('#tl-att'); if (!z) return;
        z.innerHTML = d.attente.length ? '<h3>🔒 Demandes du téléphone en attente</h3>' + d.attente.map(x => `<div class="ligne"><span style="flex:1">${esc(x.pourquoi || x.resume || x.outil)}</span><button class="btn or" data-ok="${esc(x.id)}">Autoriser</button><button class="btn" data-no="${esc(x.id)}">Refuser</button></div>`).join('') : '';
        z.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => { try { await j('POST', '/api/chat/accord', { id: b.dataset.ok }); toast('Autorisé'); } catch (e) { toast(e.message); } att(); });
        z.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => { await j('POST', '/api/chat/refuser', { id: b.dataset.no }); att(); }); };
      att(); sonde = setInterval(att, 3000);
    }
    async function creer() { try { rendre(await j('POST', '/api/appairage/creer')); } catch (e) { toast(e.message); } }
    rendre();
  }
  VUES.telephone = async v => {
    v.className = 'tl';
    const e = await fetch(API + '/api/acces-distant', { headers: H }).then(r => r.json());
    const base = e.adresses[0]?.url || `http://${location.hostname}:${e.port}`;
    const lien = e.actif ? `${base}/telephone#t=${e.jeton}` : '';
    const mcp = e.actif ? JSON.stringify({ mcpServers: { clipia: { type: 'http', url: `${base}/mcp`, headers: { Authorization: 'Bearer ' + e.jeton } } } }, null, 2) : '';
    v.innerHTML = `<h1>📱 Téléphone & MCP</h1><div id="tl-chat"></div>
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
    chatPanneau(v.querySelector('#tl-chat'), v);
    v.querySelector('#tl-on').onchange = async ev => { await fetch(API + '/api/acces-distant', { method: 'POST', headers: H, body: JSON.stringify({ actif: ev.target.checked }) }); VUES.telephone(v); };
    v.querySelector('#tl-re')?.addEventListener('click', async () => { await fetch(API + '/api/acces-distant', { method: 'POST', headers: H, body: JSON.stringify({ regenerer: true }) }); toast('Nouveau jeton créé', 'ok'); VUES.telephone(v); });
  };
}
