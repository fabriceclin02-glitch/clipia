/* CLIPIA — Messagerie « type WhatsApp » avec son IA (téléphone ⇄ ordinateur).
 * Même déroulé que le chat de l'ordinateur : réflexion → intention → moteur choisi → exécution → image / vidéo / audio dans la discussion,
 * avec Télécharger, Partager, Plein écran. Utilisé par la page /telephone (servie par le PC) et par l'APK (vue « Mon PC »).
 *
 *   ClipiaChatPC.monter(racine, {
 *     req(methode, chemin, corps, delaiMs) -> Promise<json>   (lève une Error avec .status si HTTP != 2xx)
 *     media(url) -> url absolue lisible par <img>/<video> (ajoute adresse + jeton)
 *     telecharger(url, nom, type), partager(url, nom, type), dicter(cb) : facultatifs
 *     nom : nom du PC,  surRevoque() : appelé si le PC a retiré ce téléphone,  menu : [{t, f}] actions en plus
 *   })
 */
(function () {
  const ESC = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOMS = { image_creer: 'Génération d\'image', video_creer: 'Génération de vidéo', clip_monter: 'Montage du clip', musique_creer: 'Composition musicale', voix_dire: 'Synthèse vocale', transcrire: 'Transcription',
    web_chercher: 'Recherche web', web_lire: 'Lecture de page', ordi_ouvrir_app: 'Ouverture d\'application', ordi_clavier: 'Frappe au clavier', ordi_souris: 'Souris', ordi_capturer: 'Capture d\'écran', ordi_fenetres: 'Fenêtres ouvertes',
    machine_executer: 'Commande', disque_lire: 'Lecture de fichier', disque_ecrire: 'Écriture de fichier', navigateur_ouvrir: 'Navigateur', navigateur_lire: 'Lecture de la page', agent_deleguer: 'Délégation à un agent' };
  const CSS = `
.cpc{--bg:#0b141a;--tete:#202c33;--moi:#005c4b;--eux:#202c33;--txt:#e9edef;--doux:#8696a0;--acc:#00a884;--ligne:#ffffff14;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg);color:var(--txt);font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;position:relative}
@media (prefers-color-scheme:light){.cpc{--bg:#efeae2;--tete:#f0f2f5;--moi:#d9fdd3;--eux:#fff;--txt:#111b21;--doux:#667781;--ligne:#0001}}
.cpc *{box-sizing:border-box}
.cpc-tete{display:flex;align-items:center;gap:10px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:var(--tete);border-bottom:1px solid var(--ligne)}
.cpc-av{width:40px;height:40px;border-radius:50%;flex:none;background:radial-gradient(circle at 32% 28%,#e6dcff,#7c5cff 45%,#241470);box-shadow:0 0 14px #7c5cff77;display:grid;place-items:center;font-weight:800;color:#fff;font-size:15px}
.cpc-nom{font-weight:700;line-height:1.15}.cpc-st{font-size:12.5px;color:var(--doux)}.cpc-st b{color:var(--acc);font-weight:600}
.cpc-tete .cpc-sp{flex:1;min-width:0}.cpc-bt{background:none;border:0;color:var(--doux);font-size:22px;padding:6px 8px;cursor:pointer;border-radius:10px}.cpc-bt:active{background:var(--ligne)}
.cpc-fil{flex:1;min-height:0;overflow-y:auto;padding:12px 10px 8px;display:flex;flex-direction:column;gap:6px;scroll-behavior:smooth;overscroll-behavior:contain}
.cpc-jour{align-self:center;background:var(--tete);color:var(--doux);font-size:12px;padding:3px 10px;border-radius:8px;margin:6px 0}
.cpc-m{max-width:min(92%,640px);padding:7px 10px 5px;border-radius:10px;position:relative;word-wrap:break-word;overflow-wrap:anywhere;box-shadow:0 1px 1px #0004}
.cpc-m.moi{align-self:flex-end;background:var(--moi);border-top-right-radius:2px}.cpc-m.clipia{align-self:flex-start;background:var(--eux);border-top-left-radius:2px;width:min(92%,640px)}
.cpc-h{font-size:11px;color:var(--doux);text-align:right;margin-top:2px;white-space:nowrap}.cpc-h .vu{color:#53bdeb}
.cpc-t{white-space:pre-wrap}.cpc-t code{background:#0003;padding:1px 5px;border-radius:5px;font-size:13px}.cpc-t pre{background:#0004;padding:9px;border-radius:8px;overflow:auto;font-size:12.5px;margin:6px 0;position:relative;white-space:pre}.cpc-t a{color:#53bdeb}
.cpc-cp{position:absolute;top:4px;right:4px;font-size:11px;background:#0006;color:#fff;border:0;border-radius:6px;padding:2px 7px;cursor:pointer}
.cpc-r{margin:2px 0 6px;border:1px solid var(--ligne);border-radius:10px;background:#0002;overflow:hidden}
.cpc-r>summary{cursor:pointer;list-style:none;padding:7px 10px;font-size:13px;color:var(--doux);display:flex;align-items:center;gap:7px;user-select:none}
.cpc-r>summary::-webkit-details-marker{display:none}.cpc-r>summary::after{content:'▾';margin-left:auto;transition:transform .2s}.cpc-r:not([open])>summary::after{transform:rotate(-90deg)}
.cpc-r .cpc-in{padding:2px 10px 9px;display:flex;flex-direction:column;gap:7px;font-size:13.5px}
.cpc-pen{font-style:italic;color:var(--doux);white-space:pre-wrap;max-height:11em;overflow:auto;border-left:3px solid #7c5cff88;padding-left:9px}
.cpc-dit{color:var(--txt)}.cpc-mo{background:#7c5cff22;border:1px solid #7c5cff55;border-radius:9px;padding:6px 9px}.cpc-mo b{color:#b9a8ff}.cpc-mo small{display:block;color:var(--doux);margin-top:2px}
.cpc-ou{display:flex;gap:7px;align-items:flex-start;color:var(--doux)}.cpc-ou .ic{width:18px;text-align:center;flex:none}.cpc-ou.ok{color:var(--txt)}.cpc-ou.erreur{color:#ff8a80}.cpc-ou small{display:block;opacity:.85}
.cpc-sp1{display:inline-block;width:14px;height:14px;border:2px solid var(--doux);border-top-color:var(--acc);border-radius:50%;animation:cpcR 0.8s linear infinite;vertical-align:-2px}
@keyframes cpcR{to{transform:rotate(360deg)}}
.cpc-pts{display:inline-flex;gap:4px;align-items:center}.cpc-pts i{width:6px;height:6px;border-radius:50%;background:var(--doux);animation:cpcP 1.2s infinite ease-in-out}.cpc-pts i:nth-child(2){animation-delay:.18s}.cpc-pts i:nth-child(3){animation-delay:.36s}
@keyframes cpcP{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.cpc-med{margin:6px 0;border-radius:9px;overflow:hidden;background:#0004}
.cpc-med img,.cpc-med video{display:block;width:100%;max-height:60vh;object-fit:contain;background:#000;cursor:zoom-in}.cpc-med audio{width:100%;display:block}
.cpc-act{display:flex;gap:6px;padding:6px;flex-wrap:wrap;background:#0003}.cpc-act button,.cpc-act a{flex:1;min-width:92px;text-align:center;font:inherit;font-size:13px;color:var(--txt);background:#ffffff12;border:1px solid var(--ligne);border-radius:9px;padding:7px 8px;cursor:pointer;text-decoration:none}
.cpc-acc{margin:6px 0;border:1px solid #ffb74d77;background:#ffb74d18;border-radius:10px;padding:9px}.cpc-acc b{display:block;margin-bottom:3px}.cpc-acc .bs{display:flex;gap:8px;margin-top:8px}.cpc-acc button{flex:1;font:inherit;padding:8px;border-radius:9px;border:0;cursor:pointer;font-weight:600}.cpc-acc .ok{background:var(--acc);color:#fff}.cpc-acc .non{background:#ffffff18;color:var(--txt)}
.cpc-sug{display:flex;gap:7px;overflow-x:auto;padding:6px 10px 2px;scrollbar-width:none}.cpc-sug::-webkit-scrollbar{display:none}.cpc-sug button{flex:none;font:inherit;font-size:13px;color:var(--txt);background:var(--tete);border:1px solid var(--ligne);border-radius:16px;padding:6px 12px;cursor:pointer;white-space:nowrap}
.cpc-bas{display:flex;align-items:flex-end;gap:8px;padding:8px 10px;padding-bottom:max(8px,env(safe-area-inset-bottom));background:var(--bg)}
.cpc-zone{flex:1;min-width:0;display:flex;align-items:flex-end;background:var(--tete);border-radius:22px;padding:4px 6px 4px 14px}
.cpc-zone textarea{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--txt);font:inherit;resize:none;max-height:140px;padding:8px 0;line-height:1.35}
.cpc-rond{width:44px;height:44px;border-radius:50%;border:0;background:var(--acc);color:#fff;font-size:19px;cursor:pointer;flex:none;display:grid;place-items:center}.cpc-rond.mic{background:var(--tete);color:var(--doux)}.cpc-rond.mic.on{background:#e5484d;color:#fff}
.cpc-bas .cpc-rond.mic{width:40px;height:40px;align-self:flex-end;margin-bottom:2px}
.cpc-vide{margin:auto;text-align:center;color:var(--doux);padding:20px;max-width:340px}.cpc-vide .cpc-av{margin:0 auto 12px;width:72px;height:72px;font-size:26px}
.cpc-box{position:fixed;inset:0;background:#000d;z-index:99;display:flex;align-items:center;justify-content:center;padding:10px}.cpc-box img,.cpc-box video{max-width:100%;max-height:100%}
.cpc-toast{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);background:#111b21;color:#fff;padding:8px 14px;border-radius:10px;font-size:13px;z-index:5;max-width:90%;text-align:center}
.cpc-menu{position:absolute;right:8px;top:58px;background:var(--tete);border:1px solid var(--ligne);border-radius:12px;box-shadow:0 8px 24px #0008;z-index:6;overflow:hidden}.cpc-menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;padding:12px 18px;cursor:pointer}.cpc-menu button:active{background:var(--ligne)}
`;

  function md(t) {
    let s = ESC(t);
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => `<pre>${c.replace(/\n$/, '')}<button class="cpc-cp" data-cp>Copier</button></pre>`);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }
  const heure = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const jourDe = (iso) => { try { const d = new Date(iso), a = new Date(); const h = new Date(a.getFullYear(), a.getMonth(), a.getDate()); const n = Math.round((h - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return n === 0 ? 'Aujourd\'hui' : n === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return ''; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function monter(racine, o) {
    if (!document.getElementById('cpc-css')) { const st = document.createElement('style'); st.id = 'cpc-css'; st.textContent = CSS; document.head.append(st); }
    racine.innerHTML = `<div class="cpc">
      <div class="cpc-tete"><div class="cpc-av">C</div><div class="cpc-sp"><div class="cpc-nom">Clipia</div><div class="cpc-st" id="cpcSt">connexion…</div></div><button class="cpc-bt" id="cpcMenu" aria-label="Menu">⋮</button></div>
      <div class="cpc-fil" id="cpcFil"></div>
      <div class="cpc-sug" id="cpcSug"></div>
      <div class="cpc-bas"><div class="cpc-zone"><textarea id="cpcQ" rows="1" placeholder="Écris à Clipia…" enterkeyhint="send"></textarea></div><button class="cpc-rond mic" id="cpcMic" aria-label="Dicter">🎙</button><button class="cpc-rond" id="cpcEnv" aria-label="Envoyer">➤</button></div>
    </div>`;
    const $ = (s) => racine.querySelector(s);
    const fil = $('#cpcFil'), zone = $('#cpcQ'), st = $('#cpcSt');
    const msgs = new Map(), els = new Map(); let seq = 0, vivant = true, enLigne = null, accordsTel = false, dernierJour = '';
    let file = []; try { file = JSON.parse(localStorage.getItem('clipia:chat:file') || '[]'); } catch {}
    const sauveFile = () => { try { localStorage.setItem('clipia:chat:file', JSON.stringify(file.slice(-20))); } catch {} };
    const toast = (t) => { const d = document.createElement('div'); d.className = 'cpc-toast'; d.textContent = t; $('.cpc').append(d); setTimeout(() => d.remove(), 3200); };
    let collee = true;   // l'utilisateur est en bas : on suit la conversation ; s'il remonte lire, on ne le bouscule pas
    fil.addEventListener('scroll', () => { collee = fil.scrollHeight - fil.scrollTop - fil.clientHeight < 120; }, { passive: true });
    const bas = (force) => { if (force || collee) { fil.scrollTop = fil.scrollHeight; collee = true; } };
    for (const ev of ['load', 'loadedmetadata']) fil.addEventListener(ev, () => bas(), true);
    const sug = ['🎨 Crée une image d\'un coucher de soleil', '🎬 Crée une vidéo d\'une forêt la nuit', '🎵 Compose un morceau calme', '🖥 Montre mes fenêtres ouvertes', '🔎 Cherche l\'actu du jour'];
    $('#cpcSug').innerHTML = sug.map((s) => `<button>${ESC(s)}</button>`).join('');
    $('#cpcSug').onclick = (e) => { const b = e.target.closest('button'); if (b) { zone.value = b.textContent.replace(/^\S+\s/, ''); envoyer(); } };

    function statut() {
      st.innerHTML = enLigne === false ? '<span style="color:#ff8a80">hors ligne — ton ordinateur est-il allumé avec Clipia ouvert ?</span>' : enLigne === null ? 'connexion…'
        : (() => { const v = [...msgs.values()].find((m) => m.role === 'clipia' && m.statut === 'en_cours'); return v ? `<b>${ESC(v.etat || 'Clipia écrit…')}</b>` : `en ligne · ${ESC(o.nom || 'ordinateur')}`; })();
    }
    const med = (u) => (o.media ? o.media(u) : u);

    function bulleMoi(m) {
      const queue = m.local ? '🕓' : m.statut === 'recu' ? '<span class="vu">✓✓</span>' : '✓';
      return `<div class="cpc-t">${md(m.texte)}</div><div class="cpc-h">${heure(m.createdAt || m.maj)} ${queue}</div>`;
    }
    function etapes(m) {
      const p = m.parties || [], fini = m.statut !== 'en_cours';
      const items = p.filter((x) => x.k === 'pensee' || x.k === 'outil');
      if (!items.length && fini) return '';
      const corps = items.map((x) => {
        if (x.k === 'pensee') return `<div class="cpc-pen">${ESC(x.texte)}</div>`;
        if (x.k === 'outil') { const ic = x.statut === 'ok' ? '✅' : x.statut === 'erreur' ? '❌' : x.statut === 'attente' ? '⏸' : '<span class="cpc-sp1"></span>';
          return `<div class="cpc-ou ${x.statut}"><span class="ic">${ic}</span><div>${ESC(NOMS[x.outil] || x.outil)}${x.resultat ? `<small>${ESC(x.resultat)}</small>` : ''}</div></div>`; }
        return '';
      }).join('');
      const titre = fini ? `💭 Réflexion et étapes (${items.filter((x) => x.k === 'outil').length || items.length})` : '<span class="cpc-sp1"></span> Clipia travaille…';
      return `<details class="cpc-r" ${fini ? '' : 'open'}><summary>${titre}</summary><div class="cpc-in">${corps || '<span class="cpc-pts"><i></i><i></i><i></i></span>'}</div></details>`;
    }
    function annonces(m) {
      return (m.parties || []).filter((x) => x.k === 'dit' || x.k === 'moteur').map((x) => x.k === 'dit' ? `<div class="cpc-dit">${md(x.texte)}</div>`
        : `<div class="cpc-mo">🎛 Moteur choisi : <b>${ESC(x.moteur)}</b>${x.raison ? `<small>${ESC(x.raison)}</small>` : ''}</div>`).join('');
    }
    function carteMedia(x) {
      const u = med(x.url), nom = ESC(x.nom || 'fichier');
      const objet = x.type === 'video' ? `<video src="${ESC(u)}" controls playsinline preload="metadata"></video>` : x.type === 'audio' ? `<audio src="${ESC(u)}" controls></audio>` : x.type === 'image' ? `<img src="${ESC(u)}" alt="${nom}" loading="lazy">` : `<div style="padding:14px">📎 ${nom}</div>`;
      return `<div class="cpc-med" data-u="${ESC(x.url)}" data-n="${nom}" data-t="${x.type}">${objet}<div class="cpc-act"><button data-a="dl">⬇ Télécharger</button><button data-a="sh">↗ Partager</button>${x.type === 'image' || x.type === 'video' ? '<button data-a="fs">⛶ Plein écran</button>' : ''}</div></div>`;
    }
    function bulleClipia(el, m) {
      let zEt = el.querySelector('.z-et'), zDi = el.querySelector('.z-di'), zMe = el.querySelector('.z-me'), zTx = el.querySelector('.z-tx'), zAc = el.querySelector('.z-ac'), zH = el.querySelector('.cpc-h');
      if (!zEt) { el.innerHTML = '<div class="z-et"></div><div class="z-di"></div><div class="z-me"></div><div class="z-tx cpc-t"></div><div class="z-ac"></div><div class="cpc-h"></div>'; return bulleClipia(el, m); }
      const sigEt = JSON.stringify([m.statut, m.parties.filter((x) => x.k === 'pensee' || x.k === 'outil')]);
      const dh = annonces(m); if (zDi.innerHTML !== dh) zDi.innerHTML = dh;
      if (zEt.dataset.sig !== sigEt) { const ouvert = zEt.querySelector('details')?.open; zEt.innerHTML = etapes(m); zEt.dataset.sig = sigEt; const d = zEt.querySelector('details'); if (d && m.statut === 'en_cours' && ouvert === false) d.open = false; }
      for (const x of m.parties.filter((y) => y.k === 'media')) if (!zMe.querySelector(`[data-u="${CSS_ESC(x.url)}"]`)) zMe.insertAdjacentHTML('beforeend', carteMedia(x));
      const t = m.texte || '';
      if (zTx.dataset.t !== t) { zTx.dataset.t = t; zTx.innerHTML = t ? md(t) : (m.statut === 'en_cours' && !m.parties.length ? '<span class="cpc-pts"><i></i><i></i><i></i></span>' : ''); }
      const sigAc = JSON.stringify(m.attente || null) + accordsTel;
      if (zAc.dataset.sig !== sigAc) { zAc.dataset.sig = sigAc;
        zAc.innerHTML = m.attente ? `<div class="cpc-acc"><b>🔒 Autorisation requise</b>${ESC(m.attente.pourquoi || m.attente.resume || 'Cette action demande ton accord.')}${accordsTel ? '<div class="bs"><button class="ok" data-ac="oui">Autoriser</button><button class="non" data-ac="non">Refuser</button></div>' : '<br><small style="color:var(--doux)">À valider sur l\'ordinateur (fenêtre Clipia → « Connecter mon téléphone »).</small>'}</div>` : ''; }
      zH.innerHTML = m.statut === 'en_cours' ? '' : heure(m.maj);
    }
    const CSS_ESC = (s) => String(s).replace(/["\\]/g, '\\$&');

    function afficher(m) {
      let el = els.get(m.id);
      if (!el) {
        const j = jourDe(m.createdAt || m.maj);
        if (j && j !== dernierJour) { dernierJour = j; const d = document.createElement('div'); d.className = 'cpc-jour'; d.textContent = j; fil.append(d); }
        el = document.createElement('div'); el.className = 'cpc-m ' + (m.role === 'moi' ? 'moi' : 'clipia'); el.dataset.id = m.id; fil.append(el); els.set(m.id, el);
      }
      if (m.role === 'moi') el.innerHTML = bulleMoi(m); else bulleClipia(el, m);
    }
    function appliquer(liste) {
      if (liste.length) $('.cpc-vide')?.remove();
      for (const m of liste) {
        if (m.idClient) { const o2 = [...els.entries()].find(([k, e]) => e.dataset.client === m.idClient && k !== m.id); if (o2) { o2[1].remove(); els.delete(o2[0]); msgs.delete(o2[0]); } }
        msgs.set(m.id, m); afficher(m);
        seq = Math.max(seq, m.seq || 0);
      }
      statut(); if (liste.length) bas(liste.some((m) => m.role === 'moi'));
    }
    function vide() {
      if (!fil.children.length) fil.innerHTML = '<div class="cpc-vide"><div class="cpc-av">C</div><b>Discute avec ton IA</b><br>Demande-lui une image, une vidéo, une musique, ou de piloter ton ordinateur. Elle réfléchit, choisit le meilleur moteur, puis t\'affiche le résultat ici.</div>';
    }

    async function boucle() {
      let premier = true;
      while (vivant) {
        try {
          const r = await o.req('GET', `/api/chat/depuis?seq=${seq}&ms=${premier ? 0 : 15000}${premier ? '&init=1' : ''}`, null, 30000);
          if (enLigne !== true) { enLigne = true; vider(); }
          if (premier) { premier = false; try { const e = await o.req('GET', '/api/chat/etat'); accordsTel = !!e.accordsTelephone; if (e.nom) o.nom = e.nom; } catch {} if (!r.messages.length) vide(); }
          appliquer(r.messages || []); seq = Math.max(seq, r.seq || 0); statut();
        } catch (e) {
          if (e.status === 401 || e.status === 403) { vivant = false; o.surRevoque && o.surRevoque(); return; }
          if (enLigne !== false) { enLigne = false; statut(); }
          await sleep(3000);
        }
      }
    }
    async function vider() {
      for (const q of file.slice()) {
        try { await o.req('POST', '/api/chat/envoyer', { texte: q.texte, idClient: q.idClient }); file = file.filter((x) => x.idClient !== q.idClient); sauveFile(); } catch (e) { if (e.status && e.status < 500) { file = file.filter((x) => x.idClient !== q.idClient); sauveFile(); } else break; }
      }
    }
    async function envoyer() {
      const t = zone.value.trim(); if (!t) return;
      zone.value = ''; zone.style.height = 'auto';
      const idClient = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      $('.cpc-vide')?.remove();
      const loc = { id: 'loc_' + idClient, role: 'moi', texte: t, local: true, idClient, createdAt: new Date().toISOString(), parties: [] };
      msgs.set(loc.id, loc); afficher(loc); els.get(loc.id).dataset.client = idClient; bas(true);
      file.push({ texte: t, idClient }); sauveFile();
      if (enLigne === false) { toast('Hors ligne : ton message partira dès que le PC répond.'); return; }
      vider();
    }
    $('#cpcEnv').onclick = envoyer;
    zone.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); envoyer(); } };
    zone.oninput = () => { zone.style.height = 'auto'; zone.style.height = Math.min(140, zone.scrollHeight) + 'px'; };

    /* actions sur les médias, accords, copier, plein écran */
    fil.addEventListener('click', async (e) => {
      const cp = e.target.closest('[data-cp]'); if (cp) { try { await navigator.clipboard.writeText(cp.parentElement.firstChild.textContent); cp.textContent = 'Copié ✓'; } catch { toast('Copie impossible'); } return; }
      const ac = e.target.closest('[data-ac]');
      if (ac) { const id = ac.closest('.cpc-m').dataset.id; try { if (ac.dataset.ac === 'oui') await o.req('POST', '/api/chat/accord', { id }); else await o.req('POST', '/api/chat/refuser', { id }); } catch (x) { toast(x.message); } return; }
      const b = e.target.closest('[data-a]'); const card = e.target.closest('.cpc-med');
      if (b && card) {
        const u = card.dataset.u, n = card.dataset.n, t = card.dataset.t, abs = med(u);
        if (b.dataset.a === 'dl') { try { o.telecharger ? await o.telecharger(u, n, t) : lienTel(abs, n); toast('Téléchargement lancé : ' + n); } catch (x) { toast('Échec : ' + x.message); } }
        if (b.dataset.a === 'sh') { try { o.partager ? await o.partager(u, n, t) : await partagerDef(abs, n, t); } catch (x) { if (x.name !== 'AbortError') toast('Partage impossible : ' + x.message); } }
        if (b.dataset.a === 'fs') plein(abs, t);
      } else if (card && e.target.matches('img')) plein(med(card.dataset.u), 'image');
    });
    function lienTel(u, n) { const a = document.createElement('a'); a.href = u; a.download = n; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); }
    async function partagerDef(u, n, t) {
      try { const r = await fetch(u); const bl = await r.blob(); const f = new File([bl], n, { type: bl.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) return await navigator.share({ files: [f], title: n }); } catch (x) { if (x.name === 'AbortError') return; }
      if (navigator.share) return navigator.share({ title: n, url: u });
      await navigator.clipboard.writeText(u); toast('Lien copié');
    }
    function plein(u, t) { const d = document.createElement('div'); d.className = 'cpc-box'; d.innerHTML = t === 'video' ? `<video src="${ESC(u)}" controls autoplay playsinline></video>` : `<img src="${ESC(u)}" alt="">`; d.onclick = (e) => { if (e.target === d) d.remove(); }; document.body.append(d); }

    /* dictée */
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
    if (!o.dicter && !SR) $('#cpcMic').style.display = 'none';
    $('#cpcMic').onclick = () => {
      const mic = $('#cpcMic'); if (mic.classList.contains('on')) { try { rec && rec.stop(); } catch {} mic.classList.remove('on'); return; }
      mic.classList.add('on');
      const fin = (t) => { mic.classList.remove('on'); if (t) { zone.value = t; envoyer(); } };
      if (o.dicter) return o.dicter(fin);
      rec = new SR(); rec.lang = 'fr-FR'; rec.onresult = (ev) => { zone.value = Array.from(ev.results).map((x) => x[0].transcript).join(' '); }; rec.onend = () => fin(zone.value.trim()); rec.onerror = () => fin(''); try { rec.start(); } catch { fin(''); }
    };

    /* menu */
    $('#cpcMenu').onclick = (e) => {
      e.stopPropagation(); if ($('.cpc-menu')) return $('.cpc-menu').remove();
      const m = document.createElement('div'); m.className = 'cpc-menu';
      const items = [{ t: '🗑 Effacer la discussion', f: async () => { try { await o.req('POST', '/api/chat/effacer', {}); fil.innerHTML = ''; msgs.clear(); els.clear(); dernierJour = ''; vide(); } catch (x) { toast(x.message); } } }, ...(o.menu || [])];
      m.innerHTML = items.map((x, i) => `<button data-i="${i}">${ESC(x.t)}</button>`).join('');
      m.onclick = (ev) => { const b = ev.target.closest('button'); if (b) { m.remove(); items[+b.dataset.i].f(); } };
      $('.cpc').append(m); setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
    };

    boucle();
    return { arreter() { vivant = false; }, ecrire(t) { zone.value = t; envoyer(); } };
  }
  window.ClipiaChatPC = { monter };
})();
