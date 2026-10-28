/* CLIPIA V6.1 — Atelier d'apps, Connexions & compétences, Remonter le temps, répétition à blanc, Conseil de cerveaux. */
export function installerV61({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'x-clipia-accord': '1' };
  const post = (u, b) => api(u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
  const lire = (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const quand = iso => { try { return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso || ''; } };

  document.head.append(el(`<style>
  .v61 h2{margin:18px 0 8px}.v61 .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:14px;margin:10px 0}
  .v61 .carte h3{margin:0 0 4px;font-size:16px}.v61 .petit{opacity:.75;font-size:12.5px}
  .v61 .ligne{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
  .v61 input,.v61 textarea,.v61 select{padding:8px 10px;border-radius:9px;border:1px solid #6d4fd6;background:#0d0a28;color:inherit;font:inherit}
  .v61 textarea{width:100%;min-height:90px;box-sizing:border-box}.v61 .ok{color:var(--ok,#5fe3a1)}.v61 .ko{color:var(--alerte,#ff8c8c)}
  .v61 ol{margin:6px 0 6px 18px;padding:0;font-size:13px}.v61 .journal{display:grid;gap:6px}
  .v61 .evt{padding:6px 10px;border-radius:9px;background:#ffffff0a;font-size:13px}
  #v61-bar{position:fixed;left:14px;bottom:14px;z-index:70;display:flex;gap:8px}
  #v61-bar button{padding:7px 12px;border-radius:99px;border:1px solid #6d4fd6;background:#16295f;color:#fff;cursor:pointer;font-size:12.5px}
  #v61-bar button.on{background:#b4561a;border-color:#ffb36b}
  .simule{border:1px dashed #ffb36b;border-radius:10px;padding:8px 10px;margin-top:6px;font-size:12.5px}
  </style>`));

  /* ── Barre : répétition à blanc + conseil ── */
  const barre = el(`<div id="v61-bar"><button id="v61-blanc" title="Clipia décrit ce qu'elle ferait sans rien modifier">🎭 À blanc</button><button id="v61-conseil" title="Plusieurs cerveaux répondent, un juge tranche">🧠 Conseil</button></div>`);
  document.body.append(barre);
  const majBlanc = () => $('#v61-blanc', barre).classList.toggle('on', lire('clipia:blanc', false) === true);
  majBlanc();
  $('#v61-blanc', barre).onclick = () => {
    const v = !(lire('clipia:blanc', false) === true); ecrire('clipia:blanc', v); majBlanc();
    toast(v ? 'Répétition à blanc activée : Clipia simule les actions risquées sans rien modifier.' : 'Répétition à blanc désactivée : Clipia agit pour de vrai (avec tes accords).');
  };
  $('#v61-conseil', barre).onclick = async () => {
    const champ = document.getElementById('txt'); const q = (champ?.value || '').trim();
    if (!q) { toast('Écris ta question dans la zone de message, puis clique sur Conseil.'); return; }
    const b = $('#v61-conseil', barre); b.disabled = true; b.textContent = '🧠 Réflexion…';
    try {
      const r = await post('/api/v61/conseil', { message: q });
      const fen = el(`<div class="v61" style="position:fixed;inset:6vh 8vw;z-index:90;overflow:auto;background:#0e0a28f5;border:1px solid #6d4fd6;border-radius:18px;padding:20px;box-shadow:0 30px 80px #000c">
        <button class="btn mini" style="float:right" id="cf">Fermer</button><h2 style="margin-top:0">🧠 Conseil de cerveaux</h2>
        <div class="carte"><h3>Réponse retenue${r.juge ? ' <span class="petit">(juge : ' + esc(r.juge) + ')</span>' : ''}</h3><div style="white-space:pre-wrap">${esc(r.texte || '')}</div></div>
        ${r.desaccords ? `<div class="carte"><h3>⚠ Points de désaccord</h3><div style="white-space:pre-wrap">${esc(String(r.desaccords))}</div></div>` : '<div class="petit">Les cerveaux sont d\'accord sur l\'essentiel.</div>'}
        <details><summary>Voir l'avis de chaque cerveau</summary>${(r.avis || []).map(a => `<div class="carte"><h3>${esc(a.provider || '')} <span class="petit">${esc(a.model || '')}</span></h3><div style="white-space:pre-wrap">${esc(a.texte || a.erreur || '')}</div></div>`).join('')}</details></div>`);
      document.body.append(fen); $('#cf', fen).onclick = () => fen.remove();
    } catch (e) { toast('Conseil impossible : ' + e.message, 'err'); }
    b.disabled = false; b.textContent = '🧠 Conseil';
  };

  /* ── Atelier d'apps ── */
  VUES.atelierapps = async v => {
    v.className = 'v61';
    v.innerHTML = `<h1>🛠 Atelier d'apps</h1>
      <p class="petit">Décris l'application ou le logiciel voulu. Une équipe d'agents travaille : un architecte planifie, un codeur écrit les fichiers, un testeur lance vraiment les tests, un relecteur corrige (3 tours maximum). Résultat : un dossier, un aperçu et un zip.</p>
      <div class="carte"><textarea id="ap-d" placeholder="Ex : une application de suivi de dépenses avec graphique et export CSV"></textarea>
        <div class="ligne"><select id="ap-t"><option value="site">Site web complet (vitrine, portfolio, boutique…)</option><option value="web">Application web (HTML/JS)</option><option value="jeu">Jeu dans le navigateur</option><option value="node">Programme Node.js</option><option value="python">Programme Python</option></select>
        <input id="ap-n" placeholder="Nom (facultatif)"><button class="btn or" id="ap-go">Créer l'application</button></div></div>
      <div id="ap-suivi"></div><h2>Mes applications</h2><div id="ap-liste"></div>`;
    const rendreListe = async () => {
      const apps = await api('/api/v61/apps').catch(() => []);
      $('#ap-liste', v).innerHTML = apps.length ? apps.map(a => carteApp(a)).join('') : '<div class="petit">Aucune application pour l\'instant.</div>';
    };
    const carteApp = a => `<div class="carte"><h3>${esc(a.nom || a.slug)} <span class="${a.statut === 'vérifiée' ? 'ok' : 'ko'}">${esc(a.statut || '')}</span></h3>
      <div class="petit">${esc(a.description || '')}</div><div class="ligne">
      ${['web','site','jeu'].includes(a.type) ? `<a class="btn" target="_blank" rel="noopener" href="${API}/apercu/${esc(a.slug)}/">▶ Aperçu</a>` : ''}
      <a class="btn" href="${API}/api/v61/apps/${esc(a.slug)}/zip">⬇ Télécharger (.zip)</a></div></div>`;
    $('#ap-go', v).onclick = async () => {
      const description = $('#ap-d', v).value.trim(); if (description.length < 8) { toast('Décris ton application en une phrase au moins.'); return; }
      const b = $('#ap-go', v); b.disabled = true; const suivi = $('#ap-suivi', v); suivi.innerHTML = '<div class="carte"><b>Travail en cours…</b><div class="journal" id="ap-j"></div></div>';
      const j = $('#ap-j', v);
      try {
        const r = await fetch(API + '/api/v61/apps/creer', { method: 'POST', headers: { 'content-type': 'application/json', ...H }, body: JSON.stringify({ description, type: $('#ap-t', v).value, nom: $('#ap-n', v).value }) });
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', fin = null;
        for (;;) {
          const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
          const l = buf.split('\n'); buf = l.pop();
          for (const L of l) if (L.startsWith('data:')) {
            let e; try { e = JSON.parse(L.slice(5)); } catch { continue; }
            if (e.type === 'etape-app') j.append(el(`<div class="evt">🧩 <b>${esc(e.etape)}</b> — ${esc(e.detail || '')}</div>`));
            else if (e.type === 'outil') j.append(el(`<div class="evt">⚙ ${esc(e.role || '')} : ${esc(String(e.outil).replace(/_/g, ' '))} ${esc(e.parametres || '')}</div>`));
            else if (e.type === 'rapport') j.append(el(`<div class="evt ${e.ok ? 'ok' : 'ko'}">${e.ok ? '✓' : '✗'} ${esc(String(e.texte || '').slice(0, 300))}</div>`));
            else if (e.type === 'erreur') throw new Error(e.message);
            else if (e.type === 'termine') fin = e.app;
          }
        }
        suivi.innerHTML = fin ? '<h2>Résultat</h2>' + carteApp(fin) : '';
        if (!fin) toast('La création s\'est interrompue.', 'err');
      } catch (e) { suivi.innerHTML = `<div class="carte ko">⚠ ${esc(e.message)}</div>`; }
      b.disabled = false; rendreListe();
    };
    rendreListe();
  };

  /* ── Connexions & compétences ── */
  VUES.connexions = async v => {
    v.className = 'v61';
    const e = await api('/api/v61/etat');
    const cx = e.connexions.map(c => `<div class="carte" data-c="${esc(c.id)}"><h3>${c.icone || ''} ${esc(c.nom)} <span class="${c.connecte ? 'ok' : 'petit'}">${c.connecte ? '● connecté' : '○ non connecté'}</span></h3>
      <div class="petit">${esc(c.quoi || '')}</div>
      <details><summary>Comment faire ?</summary><ol>${(c.guide || []).map(g => `<li>${esc(g)}</li>`).join('')}</ol>${c.lien ? `<a href="${esc(c.lien)}" target="_blank" rel="noopener">Ouvrir la page officielle ↗</a>` : ''}</details>
      <div class="ligne">${c.champs.map(f => `<input data-k="${esc(f.cle)}" type="${f.secret ? 'password' : 'text'}" autocomplete="off" placeholder="${esc((f.rempli ? '✓ enregistré — ' : '') + (f.label || '') + (f.placeholder ? ' ' + f.placeholder : ''))}" style="flex:1;min-width:200px">`).join('')}</div>
      <div class="ligne"><button class="btn or" data-a="save">Enregistrer</button>${c.oauth ? '<button class="btn" data-a="oauth">Se connecter</button>' : ''}<button class="btn" data-a="test">Tester</button><button class="btn mini" data-a="del">Oublier</button><span class="petit" data-m></span></div></div>`).join('');
    const comp = e.competences.map(c => `<label class="carte" style="display:block"><input type="checkbox" data-int="${esc(c.id)}" ${c.actif ? 'checked' : ''} ${c.source === 'integree' ? '' : 'disabled'}> <b>${esc(c.nom)}</b> <span class="petit">${c.source === 'integree' ? 'intégrée' : esc(c.source || 'personnelle')}</span><div class="petit">${esc(c.description || '')}</div></label>`).join('');
    const prop = e.propositions.map(p => `<div class="carte" data-p="${esc(p.id)}"><h3>💡 ${esc(p.nom)}</h3><div class="petit">${esc(p.description || '')}</div><details><summary>Voir le texte</summary><pre style="white-space:pre-wrap">${esc(p.texte)}</pre></details><div class="ligne"><button class="btn or" data-a="ok">Accepter</button><button class="btn mini" data-a="non">Refuser</button></div></div>`).join('');
    v.innerHTML = `<h1>🔌 Connexions & compétences</h1>
      <p class="petit">Les clés restent dans le coffre chiffré de ton ordinateur. Chaque envoi (message, e-mail, invitation) demande toujours ton accord.</p>
      ${cx}<h2>Compétences</h2>${comp}
      ${prop ? '<h2>Propositions de Clipia</h2>' + prop : ''}
      <h2>Ajouter une compétence</h2><div class="carte"><div class="ligne"><input id="cp-u" placeholder="Adresse https d'un fichier SKILL.md" style="flex:1;min-width:240px"><button class="btn" id="cp-l">Charger</button></div>
      <textarea id="cp-t" placeholder="…ou colle ici le texte d'une compétence (SKILL.md)"></textarea><div class="ligne"><input id="cp-n" placeholder="Nom"><button class="btn or" id="cp-a">Ajouter</button></div>
      <div class="petit">⚠ Une compétence est un texte écrit par quelqu'un d'autre : relis-le avant d'accepter.</div></div>`;
    v.onclick = async ev => {
      const b = ev.target.closest('button[data-a]'); if (!b) return;
      const carte = b.closest('[data-c]'), a = b.dataset.a, m = carte?.querySelector('[data-m]'); const id = carte?.dataset.c;
      try {
        if (a === 'save') {
          const valeurs = Object.fromEntries([...carte.querySelectorAll('input[data-k]')].map(i => [i.dataset.k, i.value]));
          await post('/api/v61/connexions/enregistrer', { id, valeurs }); m.textContent = '✓ Enregistré'; carte.querySelectorAll('input').forEach(i => i.value = '');
        } else if (a === 'test') { m.textContent = 'Test…'; const r = await post('/api/v61/connexions/tester', { id }); m.textContent = (r.ok ? '✓ ' : '⚠ ') + r.message; }
        else if (a === 'del') { await post('/api/v61/connexions/oublier', { id }); VUES.connexions(v); }
        else if (a === 'oauth') { const r = await post('/api/v61/oauth/demarrer', { service: carte.querySelector('[data-a=oauth]') && (id === 'microsoft' ? 'microsoft' : 'google') }); window.open(r.url, '_blank', 'noopener'); m.textContent = 'Termine dans la fenêtre qui s\'est ouverte, puis clique sur Tester.'; }
        else if (a === 'ok' || a === 'non') { const p = b.closest('[data-p]').dataset.p; await post(a === 'ok' ? '/api/v61/forge/accepter' : '/api/v61/forge/refuser', { id: p }); toast(a === 'ok' ? 'Compétence ajoutée.' : 'Proposition refusée.'); VUES.connexions(v); }
        else if (b.id === 'cp-l') {}
      } catch (err) { if (m) m.textContent = '⚠ ' + err.message; else toast(err.message, 'err'); }
    };
    v.onchange = async ev => { const i = ev.target.closest('[data-int]'); if (i) { try { await post('/api/v61/integree', { id: i.dataset.int, actif: i.checked }); } catch (err) { toast(err.message, 'err'); } } };
    $('#cp-l', v).onclick = async () => { try { const r = await post('/api/v61/competence/url', { url: $('#cp-u', v).value.trim() }); $('#cp-t', v).value = r.texte || ''; if (r.nom) $('#cp-n', v).value = r.nom; } catch (err) { toast(err.message, 'err'); } };
    $('#cp-a', v).onclick = async () => { try { await post('/api/v61/competence/ajouter', { nom: $('#cp-n', v).value.trim(), texte: $('#cp-t', v).value }); toast('Compétence ajoutée.'); VUES.connexions(v); } catch (err) { toast(err.message, 'err'); } };
  };

  /* ── Remonter le temps ── */
  VUES.temps = async v => {
    v.className = 'v61';
    const e = await api('/api/v61/etat'); const blanc = lire('clipia:blanc', false) === true;
    v.innerHTML = `<h1>⏪ Remonter le temps</h1>
      <p class="petit">Avant chaque action qui modifie des fichiers, Clipia garde une copie. Tu peux revenir en arrière en un clic — et annuler l'annulation.</p>
      <div class="carte"><label><input type="checkbox" id="tp-b" ${blanc ? 'checked' : ''}> <b>🎭 Répétition à blanc</b></label><div class="petit">Clipia décrit ce qu'elle ferait (fichiers, commandes, envois) sans rien exécuter. Tu relis, puis tu relances « pour de vrai ».</div></div>
      <h2>Journal</h2><div class="journal">${e.journal.length ? e.journal.map(j => `<div class="carte"><b>${esc(String(j.outil).replace(/_/g, ' '))}</b> <span class="petit">${esc(quand(j.quand))} — ${esc(j.etat || '')}</span>
        <div class="petit">${esc(j.resume || '')}</div><div class="petit">${j.fichiers.map(f => esc(f.chemin)).join(', ')}</div>
        ${j.fichiers.length ? `<div class="ligne"><button class="btn" data-id="${esc(j.id)}">↩ Annuler cette action</button></div>` : ''}</div>`).join('') : '<div class="petit">Rien pour l\'instant.</div>'}</div>`;
    $('#tp-b', v).onchange = ev => { ecrire('clipia:blanc', ev.target.checked); majBlanc(); };
    v.onclick = async ev => { const b = ev.target.closest('button[data-id]'); if (!b) return; try { const r = await post('/api/v61/annuler', { id: b.dataset.id }); toast('Action annulée' + (r.annule ? ' (' + r.annule + ' fichier(s) restauré(s))' : '') + '.'); VUES.temps(v); } catch (err) { toast(err.message, 'err'); } };
  };

  /* ── Fenêtre « autre modèle » quand une réponse échoue ── */
  async function proposerAutreModele({ erreur, essayer }) {
    document.getElementById('v61-secours')?.remove();
    let fours = [];
    try { fours = (await api('/api/fournisseurs')).filter(f => f.configure && ['openai', 'anthropic', 'gemini', 'ollama'].includes(f.kind)); } catch {}
    const actuel = (lire('clipia:cerveau', {}) || {}).provider || '';
    const ordre = f => (f.tier === 'cloud-gratuit' ? 0 : f.tier === 'local-gratuit' ? 1 : f.tier === 'sans-cle' ? 3 : 2);
    fours = fours.filter(f => f.id !== actuel).sort((a, b) => ordre(a) - ordre(b));
    const fen = el(`<div id="v61-secours" class="v61" style="position:fixed;inset:0;z-index:99;background:#000a;display:grid;place-items:center">
      <div style="width:min(520px,92vw);max-height:84vh;overflow:auto;background:#0e0a28;border:1px solid #6d4fd6;border-radius:18px;padding:20px;box-shadow:0 30px 80px #000c">
        <h2 style="margin:0 0 6px">⚠ Ce cerveau n'a pas pu répondre</h2>
        <div class="petit" style="margin-bottom:10px">${esc(String(erreur || '').slice(0, 220))}</div>
        <p style="margin:6px 0">Choisis un autre cerveau : je relance ta question avec lui, tout de suite.</p>
        <div id="v61-sec-l" style="display:grid;gap:6px">
          <button class="btn or" data-p="" data-m="">⚡ Auto — essayer tous les cerveaux disponibles</button>
          ${fours.map(f => `<button class="btn" data-p="${esc(f.id)}" data-m="${esc(f.models?.[0] || '')}" style="text-align:left">${esc(f.label)} <span class="petit">${esc(f.models?.[0] || '')} — ${f.tier === 'local-gratuit' ? 'sur ton ordinateur' : f.tier === 'cloud-gratuit' ? 'gratuit en ligne' : f.tier === 'sans-cle' ? 'sans clé' : 'avec ta clé'}</span></button>`).join('')}
        </div>
        <div class="ligne"><a href="#/cerveau-etapes" class="btn mini" id="v61-sec-cp">🧠 Configurer un cerveau</a><button class="btn mini" id="v61-sec-x">Fermer</button><span class="petit" id="v61-sec-m"></span></div>
      </div></div>`);
    document.body.append(fen);
    const fermer = () => fen.remove();
    $('#v61-sec-x', fen).onclick = fermer; $('#v61-sec-cp', fen).onclick = fermer;
    $('#v61-sec-l', fen).onclick = async ev => {
      const b = ev.target.closest('button[data-p]'); if (!b) return;
      fen.querySelectorAll('button').forEach(x => x.disabled = true); $('#v61-sec-m', fen).textContent = 'Je relance avec ' + (b.dataset.p || 'Auto') + '…';
      const r = await essayer(b.dataset.p, b.dataset.m);
      if (r === true) fermer();
      else { fen.querySelectorAll('button').forEach(x => x.disabled = false); $('#v61-sec-m', fen).textContent = '⚠ Celui-ci non plus. Essaie un autre.'; b.remove(); }
    };
  }

  /* ── Hooks pour le chat ── */
  window.clipiaV61 = {
    proposerAutreModele,
    blanc: () => lire('clipia:blanc', false) === true,
    carteSimule(conteneur, e, refaire) {
      const d = el(`<div class="simule v61">🎭 <b>Simulé</b> — ${esc(String(e.outil).replace(/_/g, ' '))} ${esc(e.parametres || '')}<div class="petit">${esc(e.detail || '')}</div></div>`);
      conteneur.append(d); return d;
    }
  };
}
