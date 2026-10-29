/* CLIPIA X8 — « Outils MCP » et « Tâches planifiées » : étendre Clipia sans coder, et lui confier des routines. */
export function installerPouvoirs({ $, el, esc, api, VUES, toast }) {
  const H = { 'x-clipia-accord': '1' };
  const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const style = `<style>.pv .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:16px;margin:12px 0}.pv input,.pv select{border-radius:10px;padding:9px;border:1px solid #ffffff33;background:#0b0818;color:#fff;margin:3px 4px 3px 0}.pv .petit{opacity:.7;font-size:12.5px}.pv .rang{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pv code{background:#ffffff14;padding:1px 6px;border-radius:6px}</style>`;

  VUES.mcp = async v => {
    v.className = 'pv';
    const r = await api('/api/mcp');
    v.innerHTML = style + `<h1>🔌 Outils MCP</h1>
      <p>MCP est le standard qui permet de brancher des outils externes à une IA (fichiers, mémoire, navigateur, bases de données, services…). Chaque outil branché devient utilisable par Clipia, <b>avec ton accord à chaque appel</b> (sauf si tu fais confiance à un serveur).</p>
      <div class="carte"><h2 style="margin-top:0">Serveurs branchés</h2><div id="pv-liste"></div></div>
      <div class="carte"><h2 style="margin-top:0">Ajouter en un clic</h2><div id="pv-presets"></div>
        <p class="petit">« npx » télécharge le paquet au premier lancement (Node.js et Internet nécessaires). Les serveurs tournent sur ton ordinateur et ne reçoivent <b>aucune</b> de tes clés Clipia.</p></div>
      <div class="carte"><h2 style="margin-top:0">Ajouter un serveur à la main</h2>
        <div class="rang"><input id="pv-n" placeholder="Nom"><input id="pv-c" placeholder="Programme (npx, node, uvx, python…)"><input id="pv-a" style="min-width:260px" placeholder="Arguments séparés par des espaces"></div>
        <button class="btn or" id="pv-add">Brancher</button>
        <p class="petit">N'ajoute que des serveurs dont tu connais l'origine : un serveur MCP exécute du code sur ta machine. Un agent ne peut jamais en ajouter à ta place.</p></div>`;
    const rendre = async () => {
      const d = await api('/api/mcp');
      $('#pv-liste').innerHTML = d.serveurs.length ? d.serveurs.map(s => `<div class="rang" style="justify-content:space-between;border-top:1px solid #ffffff14;padding:8px 0">
        <div><b>${esc(s.nom)}</b> <span class="petit">${esc(s.commande)} ${esc((s.args || []).join(' ')).slice(0, 90)}</span><div id="o-${s.id}" class="petit"></div></div>
        <div class="rang"><select data-conf="${s.id}"><option value="demander"${s.confiance === 'demander' ? ' selected' : ''}>Demander à chaque appel</option><option value="libre"${s.confiance === 'libre' ? ' selected' : ''}>Confiance libre</option></select>
        <button class="btn mini" data-test="${s.id}">Tester</button><button class="btn mini danger" data-del="${s.id}">Retirer</button></div></div>`).join('') : '<p class="petit">Aucun serveur branché pour l\'instant.</p>';
      $('#pv-liste').querySelectorAll('[data-test]').forEach(b => b.onclick = async () => {
        const z = $('#o-' + b.dataset.test); z.textContent = 'Démarrage…';
        try { const o = await api('/api/mcp/' + b.dataset.test + '/outils', { method: 'POST', headers: H, body: '{}' }); z.textContent = o.outils.length + ' outil(s) : ' + o.outils.map(x => x.nom).slice(0, 12).join(', '); }
        catch (e) { z.textContent = '⚠ ' + e.message; }
      });
      $('#pv-liste').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await api('/api/mcp/' + b.dataset.del, { method: 'DELETE', headers: H }); rendre(); });
      $('#pv-liste').querySelectorAll('[data-conf]').forEach(s => s.onchange = async () => {
        if (s.value === 'libre' && !confirm('Confiance libre : Clipia pourra utiliser TOUS les outils de ce serveur sans te demander. À réserver aux serveurs dont tu es sûr. Continuer ?')) { s.value = 'demander'; return; }
        await api('/api/mcp/' + s.dataset.conf + '/confiance', { method: 'POST', headers: H, body: JSON.stringify({ confiance: s.value }) }); toast('Réglage enregistré', 'ok');
      });
    };
    $('#pv-presets').innerHTML = r.presets.map(p => `<div class="rang" style="justify-content:space-between;border-top:1px solid #ffffff14;padding:8px 0"><div><b>${esc(p.nom)}</b><div class="petit">${esc(p.quoi)}</div></div><button class="btn mini or" data-pre="${p.id}">Brancher</button></div>`).join('');
    $('#pv-presets').querySelectorAll('[data-pre]').forEach(b => b.onclick = async () => {
      const p = r.presets.find(x => x.id === b.dataset.pre); let args = p.args;
      if (p.besoin === 'dossier') { const d = prompt('Quel dossier peut-elle lire et écrire ? (chemin complet, ex. C:\\Users\\moi\\Documents\\Clipia)'); if (!d) return; args = args.map(a => a === '{dossier}' ? d : a); }
      try { await api('/api/mcp', { method: 'POST', headers: H, body: JSON.stringify({ nom: p.nom, commande: p.commande, args }) }); toast('Branché', 'ok'); rendre(); } catch (e) { toast(e.message, 'err'); }
    });
    $('#pv-add').onclick = async () => {
      try { await api('/api/mcp', { method: 'POST', headers: H, body: JSON.stringify({ nom: $('#pv-n').value, commande: $('#pv-c').value, args: $('#pv-a').value.trim().split(/\s+/).filter(Boolean) }) }); toast('Branché', 'ok'); rendre(); }
      catch (e) { toast(e.message, 'err'); }
    };
    rendre();
  };

  VUES.planning = async v => {
    v.className = 'pv';
    v.innerHTML = style + `<h1>⏰ Tâches planifiées</h1>
      <p>Confie une routine à Clipia : « tous les matins à 8 h, fais-moi la veille de mon secteur ». À l'heure dite, elle lance le travail <b>en arrière-plan</b> et reste disponible pour toi. Si une action sensible est nécessaire, le travail <b>attend ton accord</b>.</p>
      <div class="carte"><h2 style="margin-top:0">Mes routines</h2><div id="pl-liste"></div></div>
      <div class="carte"><h2 style="margin-top:0">Nouvelle routine</h2>
        <div class="rang"><input id="pl-t" placeholder="Titre (ex. Veille du matin)"></div>
        <textarea id="pl-m" rows="3" style="width:100%;border-radius:10px;padding:9px;border:1px solid #ffffff33;background:#0b0818;color:#fff" placeholder="Ce qu'elle doit faire, comme si tu lui parlais."></textarea>
        <div class="rang"><select id="pl-f"><option value="quotidien">Chaque jour à</option><option value="intervalle">Toutes les</option></select>
          <input id="pl-h" type="time" value="08:00"><input id="pl-i" type="number" min="15" value="60" style="width:90px;display:none"> <span id="pl-u" style="display:none">minutes</span></div>
        <div class="rang" id="pl-j">${JOURS.map((j, i) => `<label><input type="checkbox" data-j="${i + 1}" checked> ${j}</label>`).join('')}</div>
        <button class="btn or" id="pl-add">Programmer</button>
        <p class="petit">Minimum 15 minutes entre deux exécutions, 10 routines actives au plus. Clipia doit être lancée à l'heure prévue (sinon, une seule exécution est rattrapée si le retard est inférieur à 12 h).</p></div>`;
    const rendre = async () => {
      const d = await api('/api/planning');
      const quand = f => f.type === 'intervalle' ? `toutes les ${f.minutes} min` : `à ${f.heure}${f.jours?.length && f.jours.length < 7 ? ' (' + f.jours.map(j => JOURS[j - 1]).join(', ') + ')' : ' chaque jour'}`;
      $('#pl-liste').innerHTML = d.taches.length ? d.taches.map(t => `<div class="rang" style="justify-content:space-between;border-top:1px solid #ffffff14;padding:8px 0">
        <div><b>${esc(t.titre)}</b> <span class="petit">${quand(t.frequence)}${t.actif ? ' · prochaine : ' + new Date(t.prochaine).toLocaleString('fr-FR') : ' · en pause'}</span><div class="petit">${esc(t.mission).slice(0, 140)}</div></div>
        <div class="rang"><button class="btn mini" data-act="${t.id}" data-v="${t.actif ? 0 : 1}">${t.actif ? 'Pause' : 'Reprendre'}</button><button class="btn mini danger" data-del="${t.id}">Supprimer</button></div></div>`).join('') : '<p class="petit">Aucune routine.</p>';
      $('#pl-liste').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await api('/api/planning/' + b.dataset.del, { method: 'DELETE', headers: H }); rendre(); });
      $('#pl-liste').querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { try { await api('/api/planning/' + b.dataset.act + '/activer', { method: 'POST', headers: H, body: JSON.stringify({ actif: b.dataset.v === '1' }) }); rendre(); } catch (e) { toast(e.message, 'err'); } });
    };
    const maj = () => { const q = $('#pl-f').value === 'quotidien'; $('#pl-h').style.display = q ? '' : 'none'; $('#pl-j').style.display = q ? '' : 'none'; $('#pl-i').style.display = q ? 'none' : ''; $('#pl-u').style.display = q ? 'none' : ''; };
    $('#pl-f').onchange = maj; maj();
    $('#pl-add').onclick = async () => {
      const q = $('#pl-f').value === 'quotidien';
      const frequence = q ? { type: 'quotidien', heure: $('#pl-h').value, jours: [...v.querySelectorAll('[data-j]:checked')].map(c => +c.dataset.j) } : { type: 'intervalle', minutes: +$('#pl-i').value };
      try { await api('/api/planning', { method: 'POST', headers: H, body: JSON.stringify({ titre: $('#pl-t').value, mission: $('#pl-m').value, frequence }) }); toast('Routine programmée', 'ok'); $('#pl-t').value = ''; $('#pl-m').value = ''; rendre(); }
      catch (e) { toast(e.message, 'err'); }
    };
    rendre();
  };
}
