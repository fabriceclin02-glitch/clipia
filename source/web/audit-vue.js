/* Vue « Audit du PC & de Clipia » : un clic, un rapport clair, copiable, avec la cause et le geste à faire pour chaque ✗. */
export function installerAudit({ el, esc, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>.au .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:14px;margin:10px 0}.au .ligne{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.au .petit{font-size:12.5px;opacity:.78}
  .au .r{padding:7px 0;border-bottom:1px solid #ffffff14;display:flex;gap:10px}.au .r:last-child{border:0}.au .ok{color:#38d9a9}.au .ko{color:#ff7a7a}.au pre{white-space:pre-wrap;background:#05030f;border:1px solid #6d4fd644;border-radius:10px;padding:10px;font-size:12.5px;max-height:420px;overflow:auto}</style>`));
  VUES.audit = async v => {
    v.className = 'au';
    v.innerHTML = `<h1>🔎 Audit du PC &amp; de Clipia</h1>
      <div class="carte"><p>Deux contrôles que Clipia fait <b>lui-même</b>, sans rien installer :</p>
      <p><b>🖥 Audit complet du PC</b> : système, mémoire, espace disque, dossier de données, FFmpeg, Internet, Ollama, redémarrage.<br>
      <b>🧪 Audit avancé de Clipia</b> : il teste pour de vrai le réseau, les moteurs, une image, un clip, la prise en main du PC, les agents et les messageries, puis te donne la cause de chaque ✗.</p>
      <div class="ligne"><button class="btn or" id="au-tout">Tout auditer</button><button class="btn" id="au-pc">Audit du PC</button><button class="btn" id="au-cl">Audit de Clipia</button></div>
      <p class="petit">L'audit de Clipia dure jusqu'à 1–2 minutes (il génère une vraie image de test). Il ne modifie rien et n'envoie rien en dehors de tes moteurs.</p></div><div id="au-res"></div>`;
    const lancer = async (mode) => {
      const z = v.querySelector('#au-res'); z.innerHTML = '<div class="carte">⏳ Audit en cours… ne ferme pas cette page.</div>';
      v.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        const r = await fetch(API + '/api/audit/lancer', { method: 'POST', headers: H, body: JSON.stringify({ mode }) }).then(x => x.json());
        let h = '', txt = '';
        if (r.pc) { const ko = r.pc.filter(x => !x.ok).length; h += `<div class="carte"><h2 style="margin-top:0">🖥 PC — ${ko ? ko + ' point(s) à voir' : 'tout est bon'}</h2>${r.pc.map(x => `<div class="r"><span class="${x.ok ? 'ok' : 'ko'}">${x.ok ? '✓' : '✗'}</span><div><b>${esc(x.titre)}</b><div class="petit">${esc(x.detail)}</div></div></div>`).join('')}</div>`; txt += 'AUDIT PC\n' + r.pc.map(x => `${x.ok ? '✓' : '✗'} ${x.titre} — ${x.detail}`).join('\n') + '\n\n'; }
        if (r.clipia) { h += `<div class="carte"><h2 style="margin-top:0">🧪 Clipia — ${r.clipia.ok ? 'tout est bon' : 'des points à corriger'}</h2><pre>${esc(r.clipia.texte)}</pre></div>`; txt += r.clipia.texte; }
        z.innerHTML = h + `<div class="ligne"><button class="btn" id="au-cp">Copier le rapport</button><button class="btn" id="au-dem">Me faire corriger ça</button></div>`;
        z.querySelector('#au-cp').onclick = () => { navigator.clipboard?.writeText(txt).then(() => toast('Rapport copié', 'ok')); };
        z.querySelector('#au-dem').onclick = () => { try { sessionStorage.setItem('clipia:amorce', 'Voici mon audit. Corrige ce que tu peux toi-même, étape par étape, et dis-moi précisément ce qui reste à faire de mon côté :\n\n' + txt.slice(0, 6000)); } catch {} location.hash = '#/clipia?n=' + Date.now(); };
      } catch (e) { z.innerHTML = `<div class="carte ko">Audit impossible : ${esc(e.message)}</div>`; }
      v.querySelectorAll('button').forEach(b => b.disabled = false);
    };
    v.querySelector('#au-tout').onclick = () => lancer('tout'); v.querySelector('#au-pc').onclick = () => lancer('pc'); v.querySelector('#au-cl').onclick = () => lancer('clipia');
  };
}
