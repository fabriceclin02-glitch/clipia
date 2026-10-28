/* CLIPIA V6.0.2 — deux widgets toujours visibles : la météo locale (à gauche) et le choix du cerveau (à droite). */
export function installerWidgets({ $, el, esc, api }) {
  if (document.getElementById('wg-barre')) return;
  const lire = (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  document.head.append(el(`<style>
  #wg-barre .wg{position:fixed;top:12px;z-index:70;font-size:13px}
  #wg-meteo{left:min(470px,34vw)} #wg-cerveau{left:calc(256px + (100vw - 256px)/2);transform:translateX(-50%)}
  .wg>button{display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:99px;cursor:pointer;color:var(--texte,#eee);
    background:linear-gradient(135deg,#2a1d6e,#16295f);border:1px solid #6d4fd6;box-shadow:0 8px 24px #0007;font-weight:600;max-width:300px}
  .wg>button:hover{border-color:#a99bff;box-shadow:0 0 0 3px #7c5cff33,0 8px 24px #0007}
  .wg>button .ico{font-size:20px;line-height:1}.wg>button small{font-weight:400;opacity:.75;display:block;font-size:11px;line-height:1.1}
  .wg>button .tx{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
  .wg-pop{position:absolute;top:calc(100% + 8px);width:320px;max-height:70vh;overflow:auto;border-radius:16px;padding:12px;background:rgba(14,10,40,.97);
    border:1px solid #6d4fd6;box-shadow:0 20px 50px #000a;display:none;color:var(--texte,#eee)}
  #wg-meteo .wg-pop{left:0} #wg-cerveau .wg-pop{right:0}
  .wg.ouvert .wg-pop{display:block}
  .wg-pop h4{margin:0 0 8px;font-size:14px}
  .wg-opt{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:10px;border:1px solid transparent;background:none;color:inherit;cursor:pointer;font-size:13px}
  .wg-opt:hover{background:#ffffff12}.wg-opt.on{background:#4b3bb055;border-color:#7c5cff}
  .wg-opt small{display:block;opacity:.7;font-size:11.5px;margin-top:2px}
  .wg-grp{font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.6;margin:10px 4px 4px}
  .wg-jours{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}
  .wg-jours div{text-align:center;background:#ffffff0d;border-radius:10px;padding:6px 4px;font-size:12px}
  .wg-pop input{width:100%;padding:7px 10px;border-radius:9px;border:1px solid #6d4fd6;background:#0d0a28;color:inherit;margin-top:6px}
  @media (max-width:1300px){#wg-cerveau{left:auto;transform:none;right:14px;top:58px}#wg-meteo{left:auto;right:14px;top:104px}}
  @media (max-width:700px){#wg-barre .wg>button .tx{display:none}}
  </style>`));
  const barre = el(`<div id="wg-barre">
    <div class="wg" id="wg-meteo"><button type="button" aria-label="Météo locale"><span class="ico">🌤</span><span class="tx" id="wm-t">Météo…<small>locale</small></span></button><div class="wg-pop" id="wm-pop"></div></div>
    <div class="wg" id="wg-cerveau"><button type="button" aria-label="Choisir le modèle"><span class="ico">🧠</span><span class="tx" id="wc-t">Auto<small>meilleur cerveau</small></span></button><div class="wg-pop" id="wc-pop"></div></div>
  </div>`);
  document.body.append(barre);
  const fermer = () => barre.querySelectorAll('.wg.ouvert').forEach(w => w.classList.remove('ouvert'));
  for (const w of barre.querySelectorAll('.wg')) w.querySelector('button').onclick = (e) => { e.stopPropagation(); const o = w.classList.contains('ouvert'); fermer(); if (!o) w.classList.add('ouvert'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.wg')) fermer(); });

  /* ═════════ MÉTÉO (Open-Meteo : gratuit, sans clé) ═════════ */
  const CODES = [[0, '☀️', 'Ciel dégagé'], [1, '🌤', 'Plutôt dégagé'], [2, '⛅', 'Nuageux par moments'], [3, '☁️', 'Couvert'], [45, '🌫', 'Brouillard'], [51, '🌦', 'Bruine'],
    [61, '🌧', 'Pluie'], [66, '🌧', 'Pluie verglaçante'], [71, '🌨', 'Neige'], [80, '🌦', 'Averses'], [85, '🌨', 'Averses de neige'], [95, '⛈', 'Orage']];
  const decode = (c) => { let r = CODES[0]; for (const x of CODES) if (c >= x[0]) r = x; return r; };
  const jour = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short' });
  const mPop = barre.querySelector('#wm-pop'), mTxt = barre.querySelector('#wm-t'), mIco = barre.querySelector('#wg-meteo .ico');
  let lieu = lire('clipia:lieu');

  async function geoloc() {
    if (!navigator.geolocation) throw new Error('indisponible');
    const p = await new Promise((ok, ko) => navigator.geolocation.getCurrentPosition(ok, ko, { timeout: 8000, maximumAge: 3600e3 }));
    let nom = 'Ma position';
    try {
      const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&language=fr`)).json();
      nom = r.results?.[0]?.name || nom;
    } catch {}
    return { lat: p.coords.latitude, lon: p.coords.longitude, nom };
  }
  async function chercherVille(q) {
    const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=fr`)).json();
    const x = r.results?.[0]; if (!x) throw new Error('Ville introuvable');
    return { lat: x.latitude, lon: x.longitude, nom: x.name + (x.admin1 ? ', ' + x.admin1 : '') };
  }
  function formVille(msg = '') {
    return `<div class="wg-grp">Changer de lieu</div><form id="wm-f"><input id="wm-v" placeholder="Ville (ex. Charleville-Mézières)" autocomplete="off"></form>${msg ? `<p style="color:#ffb84d;margin:6px 0 0">${esc(msg)}</p>` : ''}`;
  }
  async function meteo() {
    try {
      if (!lieu) { try { lieu = await geoloc(); ecrire('clipia:lieu', lieu); } catch {} }
      if (!lieu) { mTxt.innerHTML = 'Météo<small>choisir la ville</small>'; mPop.innerHTML = `<h4>Météo locale</h4><div>Dis-moi où tu es pour afficher la météo.</div>${formVille()}`; branche(); return; }
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lieu.lat}&longitude=${lieu.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4`;
      const j = await (await fetch(u)).json(); const c = j.current, d = j.daily;
      const [, ico, txt] = decode(c.weather_code);
      mIco.textContent = ico; mTxt.innerHTML = `${Math.round(c.temperature_2m)}°C<small>${esc(lieu.nom)}</small>`;
      mPop.innerHTML = `<h4>${ico} ${esc(lieu.nom)} — ${Math.round(c.temperature_2m)}°C</h4>
        <div>${txt} · ressenti ${Math.round(c.apparent_temperature)}° · humidité ${c.relative_humidity_2m}% · vent ${Math.round(c.wind_speed_10m)} km/h</div>
        <div class="wg-jours">${[1, 2, 3].map(i => `<div><b>${jour(d.time[i])}</b><br>${decode(d.weather_code[i])[1]}<br>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°<br><small>${d.precipitation_probability_max[i] ?? 0}% pluie</small></div>`).join('')}</div>
        <div>Aujourd'hui : ${Math.round(d.temperature_2m_min[0])}° / ${Math.round(d.temperature_2m_max[0])}°, pluie ${d.precipitation_probability_max[0] ?? 0}%</div>${formVille()}`;
      branche();
    } catch { mTxt.innerHTML = 'Météo<small>indisponible</small>'; mPop.innerHTML = `<h4>Météo indisponible</h4><div>Pas de connexion pour l'instant.</div>${formVille()}`; branche(); }
  }
  function branche() {
    const f = mPop.querySelector('#wm-f'); if (!f) return;
    f.onsubmit = async (e) => { e.preventDefault(); const q = mPop.querySelector('#wm-v').value.trim(); if (!q) return;
      try { lieu = await chercherVille(q); ecrire('clipia:lieu', lieu); meteo(); } catch (er) { mPop.insertAdjacentHTML('beforeend', `<p style="color:#ffb84d">${esc(er.message)}</p>`); } };
  }
  meteo(); setInterval(meteo, 20 * 60e3);

  /* ═════════ CERVEAU : Auto ou un modèle précis ═════════ */
  const cPop = barre.querySelector('#wc-pop'), cTxt = barre.querySelector('#wc-t');
  let choix = lire('clipia:cerveau', { provider: '', model: '' });
  const etiquette = (f) => f ? f.label : '';
  function afficher(fours) {
    const f = fours.find(x => x.id === choix.provider);
    cTxt.innerHTML = choix.provider && f ? `${esc(etiquette(f))}<small>${esc(choix.model || 'modèle par défaut')}</small>` : `Auto<small>meilleur cerveau</small>`;
  }
  async function cerveaux() {
    let fours = [];
    try { fours = (await api('/api/fournisseurs')).filter(f => f.configure && ['openai', 'anthropic', 'gemini', 'ollama'].includes(f.kind)); } catch {}
    afficher(fours);
    const opt = (p, m, titre, sous) => `<button class="wg-opt ${choix.provider === p && (choix.model || '') === (m || '') ? 'on' : ''}" data-p="${esc(p)}" data-m="${esc(m || '')}">${titre}${sous ? `<small>${sous}</small>` : ''}</button>`;
    cPop.innerHTML = `<h4>Avec quel cerveau travailler ?</h4>` +
      opt('', '', '⚡ Auto — Clipia choisit', 'Elle réfléchit, prend le meilleur cerveau disponible et bascule seule si besoin. Recommandé.') +
      (fours.length ? '<div class="wg-grp">Ou forcer un moteur</div>' : '<p>Aucun moteur configuré : ouvre « Cerveau pas à pas ».</p>') +
      fours.map(f => opt(f.id, f.models?.[0] || '', esc(f.label), esc(f.tier === 'local-gratuit' ? 'Sur ton ordinateur' : f.tier === 'cloud-gratuit' ? 'Gratuit en ligne' : 'Avec ta clé'))).join('') +
      `<div class="wg-grp">Réglages</div><a href="#/cerveau-etapes" style="color:#a99bff">🧠 Cerveau pas à pas (Ollama, Qwen, Groq)</a>`;
    cPop.querySelectorAll('.wg-opt').forEach(b => b.onclick = async () => {
      choix = { provider: b.dataset.p, model: b.dataset.m }; ecrire('clipia:cerveau', choix);
      const sel = document.getElementById('modele');          // si la conversation est ouverte, on la synchronise
      if (sel) { sel.value = choix.provider; sel.dispatchEvent(new Event('change')); setTimeout(() => { const v = document.getElementById('variante'); if (v && choix.model) v.value = choix.model; }, 600); }
      fermer(); cerveaux();
    });
  }
  cerveaux();
  window.addEventListener('clipia:cerveau', () => { choix = lire('clipia:cerveau', { provider: '', model: '' }); cerveaux(); });
  window.addEventListener('hashchange', () => setTimeout(cerveaux, 400));
  window.clipiaCerveau = () => ({ ...choix });
}
