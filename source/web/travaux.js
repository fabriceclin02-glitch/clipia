/* CLIPIA X8 — Les deux cerveaux : suivi en direct des travaux d'arrière-plan, annonces vocales, réponses instantanées. */
export function installerTravaux({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  const T = new Map();                       // id -> travail
  let file = [];                             // annonces à dire
  let niveau = 'route';                      // silence | important | route
  try { niveau = localStorage.getItem('clipia:x8:annonces') || 'route'; } catch {}

  document.head.append(el(`<style>
  #x8-tray{position:fixed;left:14px;bottom:14px;z-index:60;width:min(360px,calc(100vw - 28px));font-size:13px;display:none}
  #x8-tray.on{display:block}
  #x8-tray .tete{display:flex;align-items:center;gap:8px;background:#161226ee;border:1px solid #ffffff33;border-radius:14px;padding:9px 12px;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 8px 30px #0008}
  #x8-tray .tete b{flex:1}
  #x8-tray .pt{width:9px;height:9px;border-radius:50%;background:#00e0a4;box-shadow:0 0 10px #00e0a4;animation:x8p 1.4s infinite}
  @keyframes x8p{50%{opacity:.35}}
  #x8-tray .corps{display:none;margin-top:8px;background:#161226f2;border:1px solid #ffffff2a;border-radius:14px;padding:8px;max-height:52vh;overflow:auto;backdrop-filter:blur(8px)}
  #x8-tray.ouvert .corps{display:block}
  .x8-job{border:1px solid #ffffff1f;border-radius:12px;padding:10px;margin:6px 0;background:#ffffff0a}
  .x8-job .ti{display:flex;gap:6px;align-items:center}.x8-job .ti b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .x8-job .qq{opacity:.85;margin:5px 0 7px;line-height:1.35}
  .x8-job .bar{height:4px;border-radius:3px;background:#ffffff22;overflow:hidden}.x8-job .bar i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#00d6ff);transition:width .5s}
  .x8-job .ac{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
  .x8-job button,.x8 button.mini{font-size:12px;padding:5px 9px;border-radius:9px;border:1px solid #ffffff33;background:#ffffff14;color:inherit;cursor:pointer}
  .x8-job .att{background:#ffb74d22;border:1px solid #ffb74d66;border-radius:10px;padding:8px;margin-top:8px}
  .x8 .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:16px;margin:12px 0}
  .x8 textarea{width:100%;min-height:90px;border-radius:12px;padding:12px;background:#0003;border:1px solid #ffffff2a;color:inherit;font:inherit}
  .x8 .journal{font-size:12px;opacity:.85;border-left:2px solid #ffffff33;padding-left:10px;margin:6px 0}
  </style>`));

  const tray = el(`<div id="x8-tray"><div class="tete" id="x8-tete"><span class="pt"></span><b id="x8-titre">Clipia travaille</b><span id="x8-fl">▴</span></div><div class="corps" id="x8-corps"></div></div>`);
  document.body.append(tray);
  $('#x8-tete').onclick = () => { tray.classList.toggle('ouvert'); $('#x8-fl').textContent = tray.classList.contains('ouvert') ? '▾' : '▴'; };

  const actif = t => ['en_cours', 'en_file', 'attente'].includes(t.statut);
  const progression = t => t.etape ? Math.round(100 * (t.etape.n - 1) / t.etape.total) : Math.min(90, 8 + (t.nbOutils || 0) * 6);
  const ETIQ = { en_cours: 'en cours', en_file: 'en file', attente: 'attend ton accord', termine: 'terminé', arrete: 'arrêté', echec: 'échec', interrompu: 'interrompu' };

  function carteJob(t, { journal = false } = {}) {
    const att = t.statut === 'attente' && t.attente;
    return `<div class="x8-job" data-id="${t.id}">
      <div class="ti"><span>${t.statut === 'termine' ? '✅' : t.statut === 'echec' ? '⚠️' : t.statut === 'attente' ? '✋' : actif(t) ? '⚙️' : '⏹'}</span><b title="${esc(t.titre)}">${esc(t.titre)}</b><small style="opacity:.7">${ETIQ[t.statut] || t.statut}</small></div>
      <div class="qq">${esc(t.maintenant || '')}</div>
      ${actif(t) ? `<div class="bar"><i style="width:${progression(t)}%"></i></div>` : (t.resultat ? `<div class="journal">${esc(String(t.resultat).slice(0, 400))}</div>` : '')}
      ${att ? `<div class="att">${esc(t.attente.resume || 'Une action sensible attend ton accord.')}${t.attente.commande ? `<code style="display:block;margin-top:5px;font-size:11px;word-break:break-all">${esc(t.attente.commande)}</code>` : ''}<div class="ac"><button data-a="accord">Autoriser et continuer</button><button data-a="stop">Refuser (arrêter)</button></div></div>` : ''}
      ${journal ? (t.journal || []).slice().reverse().slice(0, 8).map(j => `<div class="journal">${esc(j.texte)}</div>`).join('') : ''}
      <div class="ac">
        ${actif(t) ? `<button data-a="stop">⏹ Arrêter</button>` : `<button data-a="relancer">↻ Relancer</button>`}
        <button data-a="dis">🔊 Explique-moi</button>
      </div></div>`;
  }
  function brancher(racine) {
    racine.querySelectorAll('.x8-job').forEach(c => {
      const id = c.dataset.id;
      c.querySelectorAll('button[data-a]').forEach(b => b.onclick = async e => {
        e.stopPropagation(); const a = b.dataset.a;
        try {
          if (a === 'stop') await api(`/api/travaux/${id}/arreter`, { method: 'POST', headers: H, body: '{}' });
          else if (a === 'relancer') await api(`/api/travaux/${id}/relancer`, { method: 'POST', headers: H, body: '{}' });
          else if (a === 'dis') { const d = await api(`/api/travaux/${id}/detail`, { headers: H }); dire(d.texte); }
          else if (a === 'accord') {
            const t = T.get(id); const att = t.attente;
            const r = await api('/api/noyau/accord', { method: 'POST', headers: H, body: JSON.stringify({ commande: att.commande, categorie: att.categorie }) });
            await api(`/api/travaux/${id}/reprendre`, { method: 'POST', headers: H, body: JSON.stringify({ accord: r.accord }) });
          }
        } catch (er) { toast(er.message, 'err'); }
      });
    });
  }
  function dessiner() {
    const tous = [...T.values()].sort((a, b) => String(b.debut).localeCompare(String(a.debut)));
    const a = tous.filter(actif), recents = tous.filter(t => !actif(t)).slice(0, 2);
    tray.classList.toggle('on', a.length > 0 || (recents.length > 0 && Date.now() - new Date(recents[0].fin || recents[0].debut) < 120000));
    $('#x8-titre').textContent = a.length ? `Clipia travaille sur ${a.length} projet${a.length > 1 ? 's' : ''} — parle-moi quand tu veux` : 'Travaux terminés';
    $('#x8-corps').innerHTML = [...a, ...recents].map(t => carteJob(t)).join('');
    brancher($('#x8-corps'));
    if (a.some(t => t.statut === 'attente')) tray.classList.add('ouvert');
    document.title = (a.length ? `⚙${a.length} · ` : '') + document.title.replace(/^⚙\d+ · /, '');
    window.dispatchEvent(new CustomEvent('clipia:travaux', { detail: [...T.values()] }));
  }

  /* ── Voix : elle dit ce qu'elle fait, sans te couper la parole ─────────── */
  function dire(texte) {
    const t = String(texte || '').trim(); if (!t) return;
    if (window.clipiaVoix && document.querySelector('#bulles')) { window.clipiaVoix.bulle(t); window.clipiaVoix.parler(t); }
    else { toast(t, 'ok'); try { const u = new SpeechSynthesisUtterance(t.replace(/«|»/g, '')); u.lang = 'fr-FR'; window.speechSynthesis?.speak(u); } catch {} }
  }
  function enfiler(e) {
    if (niveau === 'silence') return;
    if (e.niveau === 'route' && niveau !== 'route') return;
    const nbActifs = [...T.values()].filter(actif).length;
    let t = String(e.texte || '');
    if (nbActifs > 1 && !/^(J'ai terminé|J'ai arrêté)/.test(t)) t = `Pour « ${String(e.titre).slice(0, 40)} » : ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    const fort = /terminé|arrêté|n'a pas abouti|accord/i.test(e.texte);
    if (!fort) file = file.filter(x => x.id !== e.id || x.fort);   // une seule annonce « de route » en attente par travail
    file.push({ id: e.id, texte: t, fort }); if (file.length > 6) file = file.filter(x => x.fort).slice(-6);
  }
  setInterval(() => {
    if (!file.length) return;
    const v = document.querySelector('#bulles') ? window.clipiaVoix : null; const libre = v ? v.libre() : Date.now() - (window.__paroleUser || 0) > 2500 && !window.speechSynthesis?.speaking;
    if (!libre) return;
    const a = file.shift(); dire(a.texte);
  }, 1500);

  /* ── Réponses instantanées (sans modèle) : elle répond TOUT DE SUITE ──── */
  const ACTIFS = () => [...T.values()].filter(actif);
  window.clipiaTravaux = {
    liste: () => [...T.values()], actifs: ACTIFS,
    async rapide(phrase) {
      const t = String(phrase || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, "'");
      if (!ACTIFS().length) return null;
      if (/\b(arrete|stoppe|annule|coupe)\b.{0,20}\b(tout|travail|travaux|tache|taches|mission|missions|projet|projets)\b|\barrete tout\b/.test(t)) {
        const n = (await api('/api/travaux/arreter-tout', { method: 'POST', headers: H, body: '{}' })).arretes;
        return { texte: n ? `D'accord, j'ai arrêté ${n} travail${n > 1 ? 'aux' : ''}. Je suis toute à toi.` : 'Rien à arrêter pour le moment.' };
      }
      if (/(ou|où) en (es|est)[- ]tu|tu en es ou|sur quoi (tu )?travaill|qu'est[- ]ce que tu (fais|as fait)|tu fais quoi|(donne|fais)[- ]moi (un |le )?point|etat d'avancement|avancement|ou ca en est|quoi de neuf|des nouvelles/.test(t))
        return { texte: (await api('/api/travaux/point', { headers: H })).texte };
      if (/explique[- ]moi (ce que tu fais|en detail|ce que tu es en train)|detaille|pourquoi tu (fais|as)|raconte[- ]moi ce que tu fais/.test(t)) {
        const a = ACTIFS()[0]; return { texte: (await api(`/api/travaux/${a.id}/detail`, { headers: H })).texte };
      }
      return null;
    },
    dire
  };

  /* ── Flux en direct (fetch en streaming : l'en-tête de sécurité est obligatoire) ── */
  async function suivre() {
    for (;;) {
      try {
        const r = await fetch(API + '/api/travaux/flux', { headers: H });
        const lecteur = r.body.getReader(), dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { done, value } = await lecteur.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          const blocs = buf.split('\n\n'); buf = blocs.pop();
          for (const b of blocs) {
            if (!b.startsWith('data:')) continue;
            let e; try { e = JSON.parse(b.slice(5)); } catch { continue; }
            if (e.type === 'etat') { T.clear(); (e.travaux || []).forEach(t => T.set(t.id, t)); }
            else if (e.job) T.set(e.job.id, e.job);
            if (e.type === 'annonce') enfiler(e);
            if (e.type === 'fin') window.dispatchEvent(new CustomEvent('clipia:travail-fin', { detail: e }));
            dessiner(); if (location.hash.startsWith('#/travaux')) vueMaj?.();
          }
        }
      } catch { /* serveur en redémarrage : on retente */ }
      await new Promise(r => setTimeout(r, 2500));
    }
  }
  suivre();

  /* ── Vue « Travaux » ───────────────────────────────────────────────────── */
  let vueMaj = null;
  VUES.travaux = async v => {
    v.className = 'x8';
    v.innerHTML = `<h1>⚙️ Travaux en arrière-plan</h1>
      <p>Clipia a <b>deux cerveaux</b> : un qui te répond toujours, et des <b>travailleurs</b> qui avancent en parallèle (jusqu'à 3). Tu peux lui parler, l'interrompre ou lui demander « où en es-tu ? » à tout moment : elle répond tout de suite.</p>
      <div class="carte"><h2 style="margin-top:0">Confier une mission</h2>
        <textarea id="x8-m" placeholder="Ex. : Crée le site de mon salon de coiffure à Flize, avec une page tarifs et un formulaire de rendez-vous."></textarea>
        <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="x8-r"> Mode rigoureux (plan + vérification de chaque étape, plus lent mais plus fiable)</label>
        <button class="btn or" id="x8-go">🚀 Lancer en arrière-plan</button></div>
      <div class="carte"><h2 style="margin-top:0">Me tenir au courant à voix haute</h2>
        <select id="x8-niv"><option value="route">Tout ce qu'elle fait (recommandé)</option><option value="important">Seulement le début, la fin et les accords</option><option value="silence">Silence (je regarde la liste)</option></select></div>
      <div id="x8-liste"></div>`;
    $('#x8-niv').value = niveau; $('#x8-niv').onchange = e => { niveau = e.target.value; try { localStorage.setItem('clipia:x8:annonces', niveau); } catch {} };
    $('#x8-go').onclick = async () => {
      const m = $('#x8-m').value.trim(); if (m.length < 4) return toast('Dis-moi ce que je dois faire.', 'err');
      try { await api('/api/travaux/lancer', { method: 'POST', headers: H, body: JSON.stringify({ mission: m, rigoureux: $('#x8-r').checked }) }); $('#x8-m').value = ''; toast('C’est lancé : je continue d’être là.', 'ok'); }
      catch (e) { toast(e.message, 'err'); }
    };
    vueMaj = () => { const l = $('#x8-liste'); if (!l) return; const tous = [...T.values()].sort((a, b) => String(b.debut).localeCompare(String(a.debut))); l.innerHTML = tous.map(t => carteJob(t, { journal: true })).join('') || '<i style="opacity:.7">Aucun travail pour l’instant.</i>'; brancher(l); };
    try { const r = await api('/api/travaux', { headers: H }); (r.travaux || []).forEach(t => T.set(t.id, t)); } catch {}
    vueMaj();
  };
}
