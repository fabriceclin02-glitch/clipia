/* Clipia Clips — fil façon TikTok sur le réseau Nostr (même compte que Clipia Communauté).
   Clips et stories = notes Nostr (kind 1) étiquetées « clipiaclips » / « clipiastory » ;
   j'aime = réactions (kind 7) ; commentaires = notes en réponse. Médias envoyés sur un serveur
   Blossom public, avec repli NIP-96 (nostr.build). Aucun serveur Clipia à faire tourner. */
'use strict';
const K = window.NostrKit;
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band'];
const T_CLIP = 'clipiaclips', T_STORY = 'clipiastory';
const BLOSSOM = ['https://blossom.primal.net', 'https://blossom.band', 'https://nostr.download'];
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Math.floor(Date.now() / 1000);
let SK = null, PK = null;
try { const s = localStorage.getItem('cc.sk'); if (s) { SK = K.hexToBytes(s); PK = K.getPublicKey(SK); } } catch { SK = null; }
const pool = new K.SimplePool({ enablePing: true, enableReconnect: true });
const clips = new Map(), stories = new Map(), profils = {}, likes = {}, mesLikes = new Set(), coms = {};
const caches = new Set(JSON.parse(localStorage.getItem('clips.caches') || '[]'));
let filtre = 'tout', rendu = null;

function toast(t) { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', 3200); }
function signer(ev) { return K.finalizeEvent(ev, SK); }
async function publier(ev) { const s = signer(ev); await Promise.any(pool.publish(RELAYS, s)); return s; }

/* ---------- lecture des médias ---------- */
function urlMedia(ev) {
  const im = ev.tags.find(t => t[0] === 'imeta');
  if (im) { const u = im.find(x => x.startsWith('url ')); if (u) return u.slice(4); }
  const m = ev.content.match(/https?:\/\/\S+/g); return m ? m[m.length - 1] : '';
}
function typeMedia(ev, url) {
  const im = ev.tags.find(t => t[0] === 'imeta'); const m = im && im.find(x => x.startsWith('m '));
  const mime = m ? m.slice(2) : '';
  if (mime.startsWith('video') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return 'video';
  if (mime.startsWith('audio') || /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(url)) return 'audio';
  if (mime.startsWith('image') || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) return 'image';
  return 'lien';
}
function texteSansLien(ev, url) { return ev.content.replace(url, '').trim(); }
function nomDe(pk) { const p = profils[pk]; return p ? (p.emoji || '') + ' ' + (p.name || 'Membre') : 'Membre ' + pk.slice(0, 6); }

/* ---------- réseau ---------- */
function abonner() {
  const depuis = now() - 60 * 86400;
  pool.subscribe(RELAYS, { kinds: [1], '#t': [T_CLIP], since: depuis, limit: 300 }, { onevent: e => { if (!e.tags.some(t => t[0] === 'e')) { clips.set(e.id, e); voirProfil(e.pubkey); planifier(); } }, oneose: planifier });
  pool.subscribe(RELAYS, { kinds: [1], '#t': [T_STORY], since: now() - 86400, limit: 100 }, { onevent: e => { stories.set(e.id, e); voirProfil(e.pubkey); afficherStories(); } });
}
const demandes = new Set();
function voirProfil(pk) {
  if (profils[pk] || demandes.has(pk)) return; demandes.add(pk);
  pool.subscribe(RELAYS, { kinds: [0], authors: [pk], limit: 1 }, { onevent: e => { try { profils[pk] = JSON.parse(e.content); planifier(); afficherStories(); } catch {} } });
}
function suivreLikes(ids) {
  if (!ids.length) return;
  pool.subscribe(RELAYS, { kinds: [7], '#e': ids }, { onevent: e => {
    const cible = (e.tags.find(t => t[0] === 'e') || [])[1]; if (!cible) return;
    (likes[cible] = likes[cible] || new Set()).add(e.pubkey); if (e.pubkey === PK) mesLikes.add(cible);
    const c = document.querySelector(`[data-nb="${cible}"]`); if (c) c.textContent = likes[cible].size;
  } });
  pool.subscribe(RELAYS, { kinds: [1], '#e': ids }, { onevent: e => {
    const cible = (e.tags.find(t => t[0] === 'e') || [])[1]; if (!cible) return;
    (coms[cible] = coms[cible] || new Map()).set(e.id, e); voirProfil(e.pubkey);
    const c = document.querySelector(`[data-nc="${cible}"]`); if (c) c.textContent = coms[cible].size;
  } });
}

/* ---------- affichage du fil ---------- */
function planifier() { clearTimeout(planifier.t); planifier.t = setTimeout(afficher, 250); }
function afficher() {
  const fil = $('#fil');
  let liste = [...clips.values()].filter(e => !caches.has(e.id)).sort((a, b) => b.created_at - a.created_at);
  if (filtre === 'musique') liste = liste.filter(e => typeMedia(e, urlMedia(e)) === 'audio');
  if (!liste.length) { fil.innerHTML = '<div id="vide"><div><h2>Le fil est vide pour l\'instant</h2><p>Sois le premier : appuie sur <b>+</b> pour publier une vidéo, une musique, une image ou une story.</p></div></div>'; return; }
  const cle = liste.map(e => e.id).join(',') + filtre; if (cle === rendu) return; rendu = cle;
  const position = fil.scrollTop;
  fil.innerHTML = liste.map(carte).join('');
  fil.scrollTop = position;
  suivreLikes(liste.map(e => e.id).filter(id => !likes[id]));
  liste.forEach(e => { likes[e.id] = likes[e.id] || new Set(); });
  observer();
}
function carte(ev) {
  const url = urlMedia(ev), type = typeMedia(ev, url), u = esc(url);
  let media;
  if (type === 'video') media = `<video src="${u}" loop muted playsinline preload="metadata"></video><button class="son">🔇 Toucher pour le son</button>`;
  else if (type === 'audio') media = `<div class="fondaudio"><div><div class="disque">🎵</div><audio src="${u}" loop preload="none"></audio></div></div><button class="son">▶ Écouter</button>`;
  else if (type === 'image') media = `<img class="media" src="${u}" alt="" loading="lazy">`;
  else media = `<div class="lien"><p>🔗 Lien partagé</p><a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a></div>`;
  const nl = likes[ev.id] ? likes[ev.id].size : 0, nc = coms[ev.id] ? coms[ev.id].size : 0;
  return `<section class="clip" data-id="${ev.id}">${media}
    <div class="info"><div class="aut">${esc(nomDe(ev.pubkey))}</div><div class="txt">${esc(texteSansLien(ev, url))}</div></div>
    <div class="actions">
      <button data-act="like" aria-label="J'aime">${mesLikes.has(ev.id) ? '❤️' : '🤍'}</button><small data-nb="${ev.id}">${nl}</small>
      <button data-act="com" aria-label="Commentaires">💬</button><small data-nc="${ev.id}">${nc}</small>
      <button data-act="partage" aria-label="Partager">↗</button>
      <button data-act="cacher" aria-label="Masquer ce contenu">🚫</button>
    </div></section>`;
}
let obs;
function observer() {
  if (obs) obs.disconnect();
  obs = new IntersectionObserver(es => es.forEach(x => {
    const v = x.target.querySelector('video'), a = x.target.querySelector('audio');
    if (x.isIntersecting) { if (v) v.play().catch(() => {}); }
    else { if (v) v.pause(); if (a) a.pause(); }
  }), { threshold: .6 });
  document.querySelectorAll('.clip').forEach(c => obs.observe(c));
}
$('#fil').addEventListener('click', async e => {
  const sec = e.target.closest('.clip'); if (!sec) return; const id = sec.dataset.id;
  if (e.target.classList.contains('son')) {
    const v = sec.querySelector('video'), a = sec.querySelector('audio');
    if (v) { v.muted = !v.muted; v.play(); e.target.textContent = v.muted ? '🔇 Toucher pour le son' : '🔊'; if (!v.muted) setTimeout(() => e.target.style.opacity = 0, 800); }
    if (a) { if (a.paused) { a.play(); e.target.textContent = '⏸'; } else { a.pause(); e.target.textContent = '▶ Écouter'; } }
    return;
  }
  const act = e.target.closest('[data-act]'); if (!act) return;
  const ev = clips.get(id);
  if (act.dataset.act === 'like') {
    if (!SK) return demanderConnexion(); if (mesLikes.has(id)) return;
    mesLikes.add(id); act.textContent = '❤️';
    try { await publier({ kind: 7, created_at: now(), tags: [['e', id], ['p', ev.pubkey], ['t', T_CLIP]], content: '+' }); } catch { toast('J\'aime non envoyé (réseau)'); }
  } else if (act.dataset.act === 'com') ouvrirComs(id);
  else if (act.dataset.act === 'partage') {
    const lien = urlMedia(ev) || location.href;
    if (navigator.share) navigator.share({ title: 'Clipia Clips', text: texteSansLien(ev, lien).slice(0, 120), url: lien }).catch(() => {});
    else { navigator.clipboard && navigator.clipboard.writeText(lien); toast('Lien copié'); }
  } else if (act.dataset.act === 'cacher') {
    if (!confirm('Masquer ce contenu sur cet appareil ?')) return;
    caches.add(id); localStorage.setItem('clips.caches', JSON.stringify([...caches])); rendu = null; afficher();
  }
});

/* ---------- commentaires ---------- */
let comOuvert = null;
function ouvrirComs(id) {
  comOuvert = id; const l = coms[id] ? [...coms[id].values()].sort((a, b) => a.created_at - b.created_at) : [];
  $('#listeCom').innerHTML = l.length ? l.map(c => `<div class="com"><b>${esc(nomDe(c.pubkey))}</b> ${esc(c.content)}</div>`).join('') : '<p class="note">Aucun commentaire pour l\'instant.</p>';
  $('#fCom').classList.add('on');
}
$('#cEnvoyer').onclick = async () => {
  if (!SK) return demanderConnexion();
  const t = $('#cTexte').value.trim(); if (!t || !comOuvert) return;
  const ev = clips.get(comOuvert);
  try {
    const s = await publier({ kind: 1, created_at: now(), tags: [['e', comOuvert, RELAYS[0], 'root'], ['p', ev.pubkey], ['t', T_CLIP + '-com']], content: t });
    (coms[comOuvert] = coms[comOuvert] || new Map()).set(s.id, s); $('#cTexte').value = ''; ouvrirComs(comOuvert);
  } catch { toast('Commentaire non envoyé (réseau)'); }
};

/* ---------- stories ---------- */
function afficherStories() {
  const parAuteur = {};
  [...stories.values()].filter(s => s.created_at > now() - 86400 && !caches.has(s.id)).sort((a, b) => a.created_at - b.created_at).forEach(s => { (parAuteur[s.pubkey] = parAuteur[s.pubkey] || []).push(s); });
  const b = $('#stories');
  b.innerHTML = `<button class="story" id="maStory"><i><span>＋</span></i>Ma story</button>` + Object.entries(parAuteur).map(([pk, l]) => {
    const p = profils[pk] || {}, u = urlMedia(l[l.length - 1]), img = typeMedia(l[l.length - 1], u) === 'image';
    return `<button class="story" data-pk="${pk}"><i><span>${img ? `<img src="${esc(u)}" alt="">` : esc(p.emoji || '👤')}</span></i>${esc((p.name || 'Membre').slice(0, 10))}</button>`;
  }).join('');
  b.onclick = e => { const s = e.target.closest('.story'); if (!s) return; if (s.id === 'maStory') { ouvrirPub('story'); return; } lireStories(parAuteur[s.dataset.pk] || []); };
}
function lireStories(l) {
  const v = $('#vueStory'); let i = 0;
  const suivant = () => {
    if (i >= l.length) { v.classList.remove('on'); $('#storyMedia').innerHTML = ''; return; }
    const s = l[i++], u = urlMedia(s), t = typeMedia(s, u), d = t === 'video' ? 15000 : 6000;
    $('.qui', v).textContent = nomDe(s.pubkey) + ' · ' + texteSansLien(s, u).slice(0, 80);
    $('#storyMedia').innerHTML = t === 'video' ? `<video src="${esc(u)}" autoplay playsinline style="max-width:100vw;max-height:100vh"></video>` : t === 'image' ? `<img src="${esc(u)}" style="max-width:100vw;max-height:100vh" alt="">` : t === 'audio' ? `<div class="disque" style="width:200px;height:200px;border-radius:50%;background:conic-gradient(#ffd27a,#ff6fb5,#7c5cff,#ffd27a)"></div><audio src="${esc(u)}" autoplay></audio>` : `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`;
    const barre = $('.barre i', v); barre.style.transition = 'none'; barre.style.width = '0';
    requestAnimationFrame(() => { barre.style.transition = `width ${d}ms linear`; barre.style.width = '100%'; });
    clearTimeout(lireStories.t); lireStories.t = setTimeout(suivant, d);
  };
  v.onclick = () => { clearTimeout(lireStories.t); suivant(); };
  v.classList.add('on'); suivant();
}

/* ---------- publication ---------- */
function demanderConnexion() { ouvrirPub('clip'); }
function ouvrirPub(type) {
  $('#pasCo').style.display = SK ? 'none' : 'block'; $('#formPub').style.display = SK ? 'block' : 'none';
  $('#pType').value = type; $('#fPub').classList.add('on');
}
$('#plus').onclick = () => ouvrirPub('clip');
document.querySelectorAll('[data-ferme]').forEach(b => b.onclick = () => b.closest('.fen').classList.remove('on'));
const b64 = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
async function hacher(fichier) { const h = await crypto.subtle.digest('SHA-256', await fichier.arrayBuffer()); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function envoyerFichier(f, etat) {
  const sha = await hacher(f);
  for (const srv of BLOSSOM) {
    try {
      etat('Envoi vers ' + new URL(srv).host + '…');
      const auth = signer({ kind: 24242, created_at: now(), tags: [['t', 'upload'], ['x', sha], ['expiration', String(now() + 600)]], content: 'Upload ' + f.name });
      const r = await fetch(srv + '/upload', { method: 'PUT', body: f, headers: { Authorization: 'Nostr ' + b64(auth), 'Content-Type': f.type || 'application/octet-stream' } });
      if (r.ok) { const j = await r.json(); if (j.url) return { url: j.url, mime: f.type, sha }; }
    } catch {}
  }
  etat('Envoi vers nostr.build…');
  const u = 'https://nostr.build/api/v2/upload/files';
  const auth = signer({ kind: 27235, created_at: now(), tags: [['u', u], ['method', 'POST']], content: '' });
  const fd = new FormData(); fd.append('file', f);
  const r = await fetch(u, { method: 'POST', body: fd, headers: { Authorization: 'Nostr ' + b64(auth) } });
  const j = await r.json(); const t = j && j.nip94_event && j.nip94_event.tags.find(x => x[0] === 'url');
  if (t) return { url: t[1], mime: f.type, sha };
  throw new Error((j && j.message) || 'aucun hébergeur n\'a accepté le fichier');
}
$('#pEnvoyer').onclick = async () => {
  const etat = t => $('#pEtat').textContent = t, f = $('#pFichier').files[0], lien = $('#pLien').value.trim(), texte = $('#pTexte').value.trim(), type = $('#pType').value;
  if (!f && !/^https?:\/\//.test(lien)) return etat('Choisis un fichier ou colle un lien.');
  if (f && f.size > 100 * 1024 * 1024) return etat('Fichier trop lourd (100 Mo maximum).');
  const btn = $('#pEnvoyer'); btn.disabled = true;
  try {
    let url = lien, mime = '', sha = '';
    if (f) ({ url, mime, sha } = await envoyerFichier(f, etat));
    const tags = [['t', type === 'story' ? T_STORY : T_CLIP], ['t', 'clipia']];
    (texte.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 8).forEach(h => tags.push(['t', h.slice(1).toLowerCase()]));
    if (f) tags.push(['imeta', 'url ' + url, 'm ' + (mime || 'application/octet-stream'), ...(sha ? ['x ' + sha] : [])]);
    if (type === 'story') tags.push(['expiration', String(now() + 86400)]);
    etat('Publication…');
    const s = await publier({ kind: 1, created_at: now(), tags, content: (texte ? texte + '\n' : '') + url });
    if (type === 'story') { stories.set(s.id, s); afficherStories(); } else { clips.set(s.id, s); rendu = null; afficher(); $('#fil').scrollTop = 0; }
    etat(''); $('#fPub').classList.remove('on'); $('#pFichier').value = ''; $('#pLien').value = ''; $('#pTexte').value = '';
    toast('Publié ✓');
  } catch (e) { etat('⚠ ' + (e.message || e)); }
  finally { btn.disabled = false; }
};
$('#tPour').onclick = () => { filtre = 'tout'; $('#tPour').classList.add('on'); $('#tMusique').classList.remove('on'); rendu = null; afficher(); };
$('#tMusique').onclick = () => { filtre = 'musique'; $('#tMusique').classList.add('on'); $('#tPour').classList.remove('on'); rendu = null; afficher(); };

afficherStories();
abonner();
setTimeout(() => { if (!clips.size) afficher(); }, 6000);
