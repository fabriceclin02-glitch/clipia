/* CLIPIA V5 — « Cerveau pas à pas » : Ollama → Qwen → Groq (rapide) → essai réel. */
export function installerV5({ $, el, esc, api, API, VUES, toast }) {
  const octets = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' Go' : n > 1e6 ? Math.round(n / 1e6) + ' Mo' : Math.round((n || 0) / 1e3) + ' ko';

  /** POST qui renvoie un flux d'événements « data: {...} » ; appelle onEv pour chacun. */
  async function flux(url, corps, onEv) {
    const r = await fetch(API + url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-clipia-accord': '1' }, body: JSON.stringify(corps || {}) });
    if (!r.ok && !r.body) throw new Error('Le serveur a refusé (' + r.status + ').');
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', dernier = null;
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const l = buf.split('\n'); buf = l.pop();
      for (const L of l) if (L.startsWith('data:')) { try { dernier = JSON.parse(L.slice(5)); onEv(dernier); } catch {} }
    }
    return dernier;
  }

  VUES['cerveau-etapes'] = async (v) => {
    let e;
    try { e = await api('/api/v5/cerveau'); }
    catch (err) { v.append(el(`<div class="carte"><b>Le serveur de Clipia ne répond pas.</b><p>${esc(err.message)}</p></div>`)); return; }

    v.append(el(`<h1>Cerveau pas à pas</h1>
      <p class="sous">Quatre étapes, dans l'ordre, jusqu'à ce que Clipia réponde vraiment. Tout se télécharge ici : rien à taper. Ton ordinateur a <b>${e.ram} Go</b> de mémoire.</p>
      <div id="v5-etapes" style="display:grid;gap:12px;max-width:820px"></div>`));
    const zone = $('#v5-etapes', v);
    const carte = (n, titre, etat, corps) => {
      const c = el(`<div class="carte" data-n="${n}"><div class="rang" style="justify-content:space-between"><b>Étape ${n} — ${esc(titre)}</b><span class="etiq ${etat === 'fait' ? 'ok' : 'neutre'}" data-etat>${etat === 'fait' ? '✓ fait' : 'à faire'}</span></div><div style="margin-top:8px">${corps}</div></div>`);
      zone.append(c); return c;
    };
    const marquer = (c, ok) => { const t = c.querySelector('[data-etat]'); t.textContent = ok ? '✓ fait' : 'à faire'; t.className = 'etiq ' + (ok ? 'ok' : 'neutre'); };
    const barre = (c) => {
      const b = c.querySelector('.v5-barre'); b.style.display = 'block';
      return (pct, txt) => { b.querySelector('i').style.width = (pct ?? 5) + '%'; b.querySelector('span').textContent = txt || ''; };
    };
    const BARRE = '<div class="v5-barre" style="display:none"><div class="v5-piste"><i></i></div><span></span></div>';

    // ── 1. Ollama ───────────────────────────────────────────────────────
    const c1 = carte(1, 'Le moteur local (Ollama)', e.ollama.installe ? 'fait' : 'a-faire', `
      <p class="v4-p">Ollama fait tourner les modèles Qwen sur ton ordinateur, sans internet et sans clé. Téléchargement : ${esc(e.ollama.installeur?.taille || '')}.</p>
      <div class="rang"><button class="btn or" id="v5-oll">${e.ollama.installe ? (e.ollama.actif ? '✓ Ollama est en marche' : 'Démarrer Ollama') : 'Télécharger et installer Ollama'}</button><button class="btn mini" id="v5-oll2">Revérifier</button></div>
      ${BARRE}<div class="v4-msg" id="v5-m1"></div>`);
    $('#v5-oll2', c1).onclick = () => route2();
    $('#v5-oll', c1).onclick = async () => {
      const m = $('#v5-m1', c1), p = barre(c1); const b = $('#v5-oll', c1); b.disabled = true;
      try {
        if (e.ollama.installe) {
          m.textContent = 'Démarrage…'; await api('/api/ollama/demarrer', { method: 'POST' }); m.textContent = 'Ollama est démarré.'; return route2();
        }
        const fin = await flux('/api/ollama/installer', {}, ev => {
          if (ev.erreur) m.textContent = '⚠ ' + ev.erreur;
          else if (ev.etape === 'telechargement') { p(ev.pct, ev.total ? `${octets(ev.recu)} / ${octets(ev.total)}` : 'Téléchargement…'); m.textContent = 'Téléchargement de l\'installateur officiel…'; }
          else if (ev.etape === 'installation') { p(100, ''); m.textContent = 'Installation en cours — une fenêtre Windows peut te demander l\'autorisation. Accepte, puis clique sur « Revérifier ».'; }
          else if (ev.message) m.textContent = ev.message;
        });
        if (fin?.message) m.textContent = fin.message;
        if (!fin?.erreur) setTimeout(route2, 15000);
      } catch (err) { m.textContent = '⚠ ' + err.message + ' — tu peux aussi installer Ollama à la main : https://ollama.com/download'; }
      finally { b.disabled = false; }
    };

    // ── 2. Qwen ─────────────────────────────────────────────────────────
    const aQwen = e.modeles.some(n => /qwen/i.test(n));
    const opts = e.qwens.map(q => `<option value="${esc(q.nom)}" ${q.nom === e.recommande ? 'selected' : ''}>${esc(q.label)} — ${esc(q.taille)}${q.nom === e.recommande ? ' (recommandé)' : ''}</option>`).join('');
    const c2 = carte(2, 'Le modèle Qwen (téléchargement)', aQwen ? 'fait' : 'a-faire', `
      <p class="v4-p">${aQwen ? 'Déjà installé : ' + esc(e.modeles.filter(n => /qwen/i.test(n)).join(', ')) + '.' : 'Je choisis pour toi le meilleur Qwen qui tient dans ta mémoire. Un modèle plus petit répond plus vite.'}</p>
      <div class="rang"><select id="v5-mod" style="flex:1;min-width:240px">${opts || '<option value="qwen2.5:1.5b">Qwen 2.5 — 1,5 milliard</option>'}</select><button class="btn or" id="v5-dl" ${e.ollama.actif ? '' : 'disabled title="Étape 1 d\'abord"'}>Télécharger</button></div>
      ${BARRE}<div class="v4-msg" id="v5-m2">${e.ollama.actif ? '' : 'Commence par l\'étape 1 : Ollama doit être en marche.'}</div>`);
    $('#v5-dl', c2).onclick = async () => {
      const m = $('#v5-m2', c2), p = barre(c2), b = $('#v5-dl', c2); b.disabled = true;
      try {
        const fin = await flux('/api/modeles-locaux/installer', { modele: $('#v5-mod', c2).value }, ev => {
          if (ev.erreur) m.textContent = '⚠ ' + ev.erreur;
          else if (ev.fini) m.textContent = '✓ Modèle installé.';
          else { p(ev.pct, ev.total ? `${octets(ev.recu)} / ${octets(ev.total)} — ${ev.etat || ''}` : (ev.etat || '')); m.textContent = 'Téléchargement en cours… ne ferme pas Clipia.'; }
        });
        if (fin?.fini) { marquer(c2, true); await api('/api/v5/cerveau/reevaluer', { method: 'POST' }).catch(() => {}); toast('Qwen installé', 'ok'); }
      } catch (err) { m.textContent = '⚠ ' + err.message; }
      finally { b.disabled = false; }
    };

    // ── 3. Groq ─────────────────────────────────────────────────────────
    const c3 = carte(3, 'Le cerveau rapide : Groq (gratuit)', e.groq ? 'fait' : 'a-faire', `
      <ol class="v4-ol"><li>Ouvre <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> et connecte-toi.</li>
        <li><b>Create API Key</b> → copie la clé (elle commence par <code>gsk_</code>).</li><li>Colle-la ici :</li></ol>
      <div class="rang"><input type="password" id="v5-gk" placeholder="gsk_…" autocomplete="off" style="flex:1;min-width:220px"><button class="btn or" id="v5-gb">Tester et activer</button></div>
      <div class="v4-msg" id="v5-m3">${e.groq ? 'Une clé Groq est déjà enregistrée.' : ''}</div>`);
    $('#v5-gb', c3).onclick = async () => {
      const valeur = $('#v5-gk', c3).value.trim(), m = $('#v5-m3', c3);
      m.textContent = 'Test de la clé…';
      try {
        const t = await api('/api/coffre/tester', { method: 'POST', body: JSON.stringify({ fournisseur: 'groq', valeur }) });
        if (!t.ok) { m.textContent = '⚠ ' + t.message; return; }
        await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: 'provider:groq', valeur }) });
        $('#v5-gk', c3).value = ''; m.textContent = '✓ ' + t.message; marquer(c3, true);
        await api('/api/v5/cerveau/reevaluer', { method: 'POST' }).catch(() => {});
      } catch (err) { m.textContent = '⚠ ' + err.message; }
    };

    // ── 4. Essai réel ───────────────────────────────────────────────────
    const c4 = carte(4, 'Essai réel', 'a-faire', `
      <p class="v4-p">Je pose une vraie question au meilleur moteur disponible et j'affiche sa réponse. C'est la seule preuve qui compte.</p>
      <div class="rang"><button class="btn or" id="v5-es">Tester Clipia maintenant</button><a class="btn mini" href="#/clipia" id="v5-go" style="display:none">Parler à Clipia →</a></div>
      <div class="v4-msg" id="v5-m4"></div>`);
    $('#v5-es', c4).onclick = async () => {
      const m = $('#v5-m4', c4); m.textContent = 'Je cherche le meilleur moteur, puis je pose la question…';
      try {
        const r0 = await api('/api/v5/cerveau/reevaluer', { method: 'POST' });
        const r = await api('/api/v5/cerveau/essai', { method: 'POST' });
        if (r.ok) { m.innerHTML = `✓ <b>${esc(r.moteur)}</b> a répondu en ${r.ms} ms : « ${esc(r.texte)} »`; marquer(c4, true); $('#v5-go', c4).style.display = ''; }
        else m.innerHTML = `⚠ Pas de réponse. ${esc(r.message || '')}<br><small>Reprends les étapes 1 à 3 : il faut Qwen installé <b>ou</b> une clé Groq.${r0?.resume ? ' ' + esc(r0.resume) : ''}</small>`;
      } catch (err) { m.textContent = '⚠ ' + err.message; }
    };

    function route2() { location.hash = '#/cerveau-etapes?r=' + Date.now(); }
  };
}
