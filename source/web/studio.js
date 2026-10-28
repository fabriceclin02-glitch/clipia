/* CLIPIA X7 — Studio montage (vidéo + musique) : on écrit un prompt, Clipia propose les scènes, les images et la musique ; tu règles et tu exportes. */
export function installerStudio({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'x-clipia-accord': '1' };
  const post = (u, b) => api(u, { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
  const CLE = 'clipia:studio';
  const charge = () => { try { return JSON.parse(localStorage.getItem(CLE)) || null; } catch { return null; } };
  const garde = (p) => { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch {} };
  document.head.append(el(`<style>
  .st{display:grid;gap:12px}.st h1{margin:0}.st .onglets{display:flex;gap:8px}.st .onglets button{padding:8px 16px;border-radius:99px;border:1px solid #6d4fd6;background:#ffffff0d;color:inherit;cursor:pointer}.st .onglets button.on{background:#4b3bb0}
  .st .cadre{display:grid;grid-template-columns:260px minmax(0,1fr) 280px;gap:12px;align-items:start}@media(max-width:1100px){.st .cadre{grid-template-columns:1fr}}
  .st .pan{background:#ffffff0d;border:1px solid #ffffff22;border-radius:16px;padding:12px;display:grid;gap:8px}.st .pan h3{margin:0;font-size:14px}
  .st textarea,.st input[type=text],.st input[type=number],.st select{width:100%;box-sizing:border-box;padding:7px 10px;border-radius:9px;border:1px solid #6d4fd6;background:#0d0a28;color:inherit;font:inherit;font-size:13px}
  .st textarea{min-height:70px;resize:vertical}.st .ap{position:relative;background:#000;border-radius:14px;overflow:hidden;margin:auto;max-height:52vh;box-shadow:0 20px 50px #0009}
  .st .ap img,.st .ap .fond{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.st .ap .tx{position:absolute;left:5%;right:5%;text-align:center;font-weight:800;text-shadow:0 2px 8px #000;padding:6px 10px;background:#0006;border-radius:8px;line-height:1.2}
  .st .tl{display:flex;gap:8px;overflow:auto;padding:6px 2px}.st .sc{flex:none;width:118px;border:2px solid #ffffff22;border-radius:10px;overflow:hidden;cursor:pointer;background:#0d0a28;transition:transform .15s}
  .st .sc:hover{transform:translateY(-3px)}.st .sc.on{border-color:#a99bff}.st .sc .im{height:66px;background-size:cover;background-position:center;position:relative}.st .sc .im b{position:absolute;left:4px;bottom:3px;font-size:10px;background:#000a;padding:1px 5px;border-radius:6px}
  .st .sc small{display:block;padding:3px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
  .st .ligne{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.st .petit{font-size:12px;opacity:.75}.st video,.st audio{width:100%;border-radius:12px}
  </style>`));
  const defaut = () => ({ format: '16:9', scenes: [], musique: null, volume: 0.8, titre: '' });
  VUES.studio = async v => {
    v.className = 'st'; let P = charge() || defaut(), sel = 0, onglet = 'video', occupe = false; const etat = await api('/api/studio/etat').catch(() => ({ filtres: ['aucun'] }));
    const ratio = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }; const FILT = { aucun: 'none', noirblanc: 'grayscale(1)', chaud: 'sepia(.35) saturate(1.2)', froid: 'hue-rotate(15deg) saturate(1.1) brightness(.97)', vif: 'saturate(1.6) contrast(1.08)', sombre: 'brightness(.85) contrast(1.1)' };
    const maj = () => { garde(P); dessiner(); };
    const chargeImg = f => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
    async function occuper(msg, fn) { if (occupe) return; occupe = true; $('#st-m', v).textContent = msg + '…'; try { await fn(); $('#st-m', v).textContent = ''; } catch (e) { $('#st-m', v).textContent = '⚠ ' + e.message; } occupe = false; }
    function dessiner() {
      const s = P.scenes[sel]; const r = ratio[P.format] || 1.78; const L = Math.round(Math.min(560, 440 * r));
      v.innerHTML = `<h1>🎬 Studio montage</h1><div class="onglets"><button data-o="video" class="${onglet === 'video' ? 'on' : ''}">🎞 Vidéo</button><button data-o="musique" class="${onglet === 'musique' ? 'on' : ''}">🎵 Musique</button></div>
      ${onglet === 'musique' ? vueMusique() : `<div class="cadre">
        <div class="pan"><h3>✨ Décris ta vidéo</h3><textarea id="st-p" placeholder="Ex. : une pub de 20 secondes pour un café de quartier, ambiance chaleureuse">${esc(P.titre)}</textarea>
          <div class="ligne"><select id="st-nb" style="width:auto"><option>3</option><option selected>5</option><option>7</option><option>10</option></select> scènes
          <select id="st-f" style="width:auto">${['16:9', '9:16', '1:1'].map(f => `<option ${f === P.format ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
          <button class="btn or" id="st-plan">Créer le plan</button>
          <h3 style="margin-top:6px">🎵 Musique du film</h3><div class="petit">${P.musique ? '✓ ' + esc(P.musique.nom || 'morceau') : 'Aucune pour l\'instant'}</div>
          ${P.musique ? `<audio controls src="${API}${esc(P.musique.url)}"></audio><div class="ligne"><span class="petit">Volume</span><input type="range" min="0" max="1.5" step=".1" value="${P.volume}" id="st-vol"></div>` : ''}
          <input type="text" id="st-mp" placeholder="Style de musique (ex. lofi doux)"><div class="ligne"><button class="btn" id="st-mg">Composer</button><label class="btn">Importer<input type="file" id="st-mi" accept="audio/*" hidden></label>${P.musique ? '<button class="btn" id="st-mx">Retirer</button>' : ''}</div></div>
        <div style="min-width:0"><div class="ap" style="width:${L}px;aspect-ratio:${r}">${s ? `${s.url ? `<img src="${API}${esc(s.url)}" style="filter:${FILT[s.filtre] || 'none'}">` : `<div class="fond" style="background:linear-gradient(135deg,${esc(s.couleur || '#4b3bb0')},#0e0a28);filter:${FILT[s.filtre] || 'none'}"></div>`}${s.texte ? `<div class="tx" style="color:${esc(s.couleurTexte || '#fff')};font-size:${Math.round((s.taille || 54) * L / 1280 * 1.6)}px;${s.position === 'haut' ? 'top:8%' : s.position === 'milieu' ? 'top:42%' : 'bottom:10%'}">${esc(s.texte)}</div>` : ''}` : '<div style="position:absolute;inset:0;display:grid;place-items:center;opacity:.6;text-align:center;padding:20px">Écris un prompt à gauche, puis « Créer le plan ».</div>'}</div>
          <div class="tl" id="st-tl">${P.scenes.map((x, i) => `<div class="sc ${i === sel ? 'on' : ''}" data-i="${i}"><div class="im" style="background-image:${x.url ? `url(${API}${esc(x.url)})` : `linear-gradient(135deg,${esc(x.couleur || '#4b3bb0')},#0e0a28)`}"><b>${x.duree}s</b></div><small>${i + 1}. ${esc(x.texte || '—')}</small></div>`).join('')}<div class="sc" id="st-add" style="display:grid;place-items:center;height:92px;font-size:26px">＋</div></div>
          <div class="ligne"><button class="btn or" id="st-exp" ${P.scenes.length ? '' : 'disabled'}>⬇ Exporter en MP4</button><button class="btn" id="st-imgs" ${P.scenes.length ? '' : 'disabled'}>🖼 Générer toutes les images</button><span class="petit" id="st-m"></span></div>
          <div id="st-res"></div></div>
        <div class="pan">${s ? `<h3>Scène ${sel + 1}</h3><label class="petit">Texte à l'écran</label><input type="text" id="s-t" value="${esc(s.texte || '')}">
          <div class="ligne"><div style="flex:1"><label class="petit">Durée (s)</label><input type="number" id="s-d" min="1" max="20" value="${s.duree}"></div><div style="flex:1"><label class="petit">Taille</label><input type="number" id="s-z" min="18" max="140" value="${s.taille || 54}"></div></div>
          <div class="ligne"><div style="flex:1"><label class="petit">Position</label><select id="s-p">${['bas', 'milieu', 'haut'].map(x => `<option ${x === (s.position || 'bas') ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div><label class="petit">Couleur</label><br><input type="color" id="s-c" value="${esc(s.couleurTexte || '#ffffff')}"></div></div>
          <label class="petit">Filtre</label><select id="s-f">${(etat.filtres || ['aucun']).map(x => `<option ${x === (s.filtre || 'aucun') ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <label class="petit">Image (description)</label><textarea id="s-v">${esc(s.visuel || '')}</textarea>
          <div class="ligne"><button class="btn" id="s-g">🖼 Générer</button><label class="btn">Importer<input type="file" id="s-i" accept="image/*" hidden></label></div>
          ${s.secours ? '<div class="petit">⚠ Aucun service d\'images n\'a répondu : une carte colorée est utilisée. Branche une clé dans « Skills &amp; extensions » ou importe ta photo.</div>' : ''}
          <div class="ligne"><button class="btn" id="s-l">←</button><button class="btn" id="s-r">→</button><button class="btn" id="s-dup">Dupliquer</button><button class="btn" id="s-x">Supprimer</button></div>` : '<div class="petit">Sélectionne une scène dans la timeline.</div>'}</div></div>`}`;
      lier();
    }
    function vueMusique() {
      const m = P.morceau;
      return `<div class="cadre" style="grid-template-columns:minmax(0,420px) minmax(0,1fr)"><div class="pan"><h3>🎼 Décris ta musique</h3><textarea id="m-p" placeholder="Ex. : piano doux et pluie, 60 secondes">${esc(P.promptMusique || '')}</textarea>
        <div class="ligne"><span class="petit">Durée</span><input type="number" id="m-d" min="10" max="300" value="${P.dureeMusique || 30}" style="width:90px"> s</div><div class="ligne"><button class="btn or" id="m-g">Composer</button><label class="btn">Importer<input type="file" id="m-i" accept="audio/*" hidden></label><span class="petit" id="st-m"></span></div></div>
        <div class="pan"><h3>🎚 Édition</h3>${m ? `<audio controls src="${API}${esc(m.url)}"></audio>
          <div class="ligne"><div style="flex:1"><label class="petit">Début (s)</label><input type="number" id="e-a" value="0" min="0"></div><div style="flex:1"><label class="petit">Fin (s, 0 = tout)</label><input type="number" id="e-b" value="0" min="0"></div></div>
          <div class="ligne"><div style="flex:1"><label class="petit">Volume</label><input type="number" id="e-v" value="1" step=".1" min="0" max="3"></div><div style="flex:1"><label class="petit">Fondu entrée</label><input type="number" id="e-fi" value="1" min="0" max="10"></div><div style="flex:1"><label class="petit">Fondu sortie</label><input type="number" id="e-fo" value="2" min="0" max="10"></div><div style="flex:1"><label class="petit">Boucles</label><input type="number" id="e-bo" value="1" min="1" max="10"></div></div>
          <div class="ligne"><button class="btn or" id="e-ok">Appliquer</button><a class="btn" download href="${API}${esc(m.url)}">⬇ Télécharger</a><button class="btn" id="e-film">🎬 Utiliser dans la vidéo</button></div>${m.secours ? '<div class="petit">Musique de secours (accord simple) : aucun service de musique n\'a répondu.</div>' : ''}` : '<div class="petit">Compose ou importe un morceau pour l\'éditer.</div>'}</div></div>`;
    }
    function lier() {
      v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { onglet = b.dataset.o; dessiner(); });
      const q = (id) => $(id, v); const sc = P.scenes[sel];
      const imp = async (f, cb) => { if (!f) return; await occuper('Import', async () => { const r = await post('/api/studio/importer', { nom: f.name, donnees: await chargeImg(f) }); cb(r); maj(); }); };
      if (onglet === 'musique') {
        q('#m-g').onclick = () => { P.promptMusique = q('#m-p').value; P.dureeMusique = +q('#m-d').value || 30; occuper('Composition en cours', async () => { const r = await post('/api/studio/musique', { description: P.promptMusique, duree: P.dureeMusique }); P.morceau = { ...r, nom: P.promptMusique.slice(0, 40) }; maj(); }); };
        q('#m-i').onchange = e => imp(e.target.files[0], r => { P.morceau = { ...r, nom: e.target.files[0].name }; });
        if (P.morceau) {
          q('#e-ok').onclick = () => occuper('Édition', async () => { const r = await post('/api/studio/audio', { fichier: P.morceau.fichier, debut: +q('#e-a').value, fin: +q('#e-b').value, volume: +q('#e-v').value, fondEntree: +q('#e-fi').value, fondSortie: +q('#e-fo').value, boucles: +q('#e-bo').value }); P.morceau = { ...r, nom: (P.morceau.nom || 'morceau') + ' (édité)' }; maj(); toast('Morceau édité.'); });
          q('#e-film').onclick = () => { P.musique = { ...P.morceau }; onglet = 'video'; maj(); toast('Musique ajoutée à la vidéo.'); };
        }
        return;
      }
      q('#st-plan').onclick = () => { P.titre = q('#st-p').value; P.format = q('#st-f').value; occuper('Je prépare le plan', async () => { const r = await post('/api/studio/plan', { prompt: P.titre, nb: +q('#st-nb').value }); P.scenes = r.scenes; sel = 0; maj(); if (r.source === 'secours') toast('Aucun cerveau n\'a répondu : plan simple créé à partir de ta phrase.'); }); };
      q('#st-f').onchange = () => { P.format = q('#st-f').value; maj(); };
      q('#st-tl').onclick = e => { const c = e.target.closest('.sc[data-i]'); if (c) { sel = +c.dataset.i; dessiner(); } };
      q('#st-add').onclick = () => { P.scenes.push({ texte: '', visuel: P.titre, duree: 4, filtre: 'aucun', couleur: '#4b3bb0', taille: 54, couleurTexte: '#ffffff', position: 'bas' }); sel = P.scenes.length - 1; maj(); };
      q('#st-mg').onclick = () => occuper('Composition en cours', async () => { const r = await post('/api/studio/musique', { description: q('#st-mp').value || P.titre || 'ambient', duree: Math.min(120, P.scenes.reduce((a, x) => a + (+x.duree || 4), 0) || 30) }); P.musique = { ...r, nom: q('#st-mp').value || 'musique' }; maj(); });
      q('#st-mi').onchange = e => imp(e.target.files[0], r => { P.musique = { ...r, nom: e.target.files[0].name }; });
      q('#st-mx')?.addEventListener('click', () => { P.musique = null; maj(); });
      q('#st-vol')?.addEventListener('input', e => { P.volume = +e.target.value; garde(P); });
      q('#st-imgs').onclick = () => occuper('Images en cours (une par scène)', async () => { for (let i = 0; i < P.scenes.length; i++) { const x = P.scenes[i]; $('#st-m', v).textContent = `Image ${i + 1}/${P.scenes.length}…`; const r = await post('/api/studio/image', { description: x.visuel || P.titre, couleur: x.couleur, format: P.format }); Object.assign(x, { fichier: r.fichier, url: r.url, secours: r.secours }); garde(P); } dessiner(); });
      q('#st-exp').onclick = () => occuper('Export en cours — quelques instants', async () => {
        const r = await post('/api/studio/exporter', { scenes: P.scenes, musique: P.musique ? { fichier: P.musique.fichier, volume: P.volume } : null, format: P.format });
        $('#st-res', v).innerHTML = `<video controls src="${API}${esc(r.url)}"></video><div class="ligne"><a class="btn or" download href="${API}${esc(r.url)}">⬇ Télécharger la vidéo</a></div>${(r.avertissements || []).map(a => `<div class="petit">⚠ ${esc(a)}</div>`).join('')}`; });
      if (!sc) return;
      const M = (id, k, f = x => x) => { const n = q(id); n.oninput = n.onchange = () => { sc[k] = f(n.value); garde(P); if (k !== 'visuel') { const g = $('#st-tl', v); dessiner(); } }; };
      q('#s-t').oninput = e => { sc.texte = e.target.value; garde(P); const t = v.querySelector('.ap .tx'); if (t) t.textContent = sc.texte; else dessiner(); };
      for (const [id, k, f] of [['#s-d', 'duree', x => Math.max(1, Math.min(20, +x || 4))], ['#s-z', 'taille', x => +x || 54], ['#s-p', 'position'], ['#s-c', 'couleurTexte'], ['#s-f', 'filtre']]) { const n = q(id); n.onchange = () => { sc[k] = f ? f(n.value) : n.value; maj(); }; }
      q('#s-v').oninput = e => { sc.visuel = e.target.value; garde(P); };
      q('#s-g').onclick = () => occuper('Image en cours', async () => { const r = await post('/api/studio/image', { description: sc.visuel || sc.texte || P.titre, couleur: sc.couleur, format: P.format }); Object.assign(sc, { fichier: r.fichier, url: r.url, secours: r.secours }); maj(); });
      q('#s-i').onchange = e => imp(e.target.files[0], r => Object.assign(sc, { fichier: r.fichier, url: r.url, secours: false }));
      q('#s-l').onclick = () => { if (sel > 0) { [P.scenes[sel - 1], P.scenes[sel]] = [P.scenes[sel], P.scenes[sel - 1]]; sel--; maj(); } };
      q('#s-r').onclick = () => { if (sel < P.scenes.length - 1) { [P.scenes[sel + 1], P.scenes[sel]] = [P.scenes[sel], P.scenes[sel + 1]]; sel++; maj(); } };
      q('#s-dup').onclick = () => { P.scenes.splice(sel + 1, 0, { ...sc }); sel++; maj(); };
      q('#s-x').onclick = () => { P.scenes.splice(sel, 1); sel = Math.max(0, sel - 1); maj(); };
    }
    dessiner();
  };
}
