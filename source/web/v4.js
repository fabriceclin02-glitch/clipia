/* CLIPIA V4 — agent personnel : installation guidée, « Créer mon IA », animation finale et questionnaire. */
import { parlerNaturel, choisirVoix } from './voix-naturelle.js';

export const phraseAppel = (p) => {
  if (!p || !p.configure) return 'Oui, que puis-je faire pour toi ?';
  const nom = p.prenom ? ', ' + p.prenom : '';
  const vous = p.vouvoiement === true || p.mode === 'pro';
  const t = {
    entrepreneur: vous ? 'Oui, je vous écoute. On fait quoi ?' : `Oui${nom}, je t'écoute. On fait quoi ?`,
    pro: 'Oui, je vous écoute.', direct: 'Oui ?', cash: 'Je t\'écoute.', drole: `Oui${nom} ! Tu as besoin de mes talents ?`,
    pedagogue: `Oui${nom}, je t'écoute. Qu'est-ce qu'on apprend ?`, createur: `Oui${nom} ! On crée quoi ?`,
    ami: `Oui${nom} ? Je t'écoute.`
  }[p.mode];
  return t || (vous ? 'Oui, que puis-je faire pour vous ?' : 'Oui, que puis-je faire pour toi ?');
};

export function installerV4({ $, el, esc, api, API, VUES, route, toast, MENU }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let coupe = null;
  const dire = (t, apres) => {
    try { coupe?.(); } catch {}
    if (localStorage.getItem('clipia:muet') === '1') { apres?.(); return; }
    coupe = parlerNaturel(t, { preferee: localStorage.getItem('clipia:voixNav') || '', onend: apres });
  };
  const profilCharge = () => api('/api/noyau/personnalite').then(r => { window.__profil = r.profil; return r; }).catch(() => ({ profil: {}, modes: [] }));
  profilCharge();

  /* ═════════ INSTALLATION GUIDÉE ═════════ */
  VUES.installation = async (v) => {
    const e = await api('/api/v4/etat');
    const par = Object.fromEntries(e.etapes.map(x => [x.id, x]));
    const aide = {
      groq: { c: 'Le cerveau le plus rapide, gratuit.', corps: `
        <ol class="v4-ol"><li>Ouvre <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> et connecte-toi (e-mail ou Google).</li>
        <li>Clique <b>Create API Key</b>, donne un nom, copie la clé (elle commence par <code>gsk_</code>).</li><li>Colle-la ci-dessous : je la teste pour toi.</li></ol>${cle('groq', 'gsk_…')}`,
        voix: 'Étape un : le cerveau rapide. Ouvre le lien, crée une clé Groq, puis colle-la dans la case. Je la teste pour toi.' },
      local: { c: 'Un cerveau qui marche sans internet ni clé.', corps: `
        <p class="v4-p">Je télécharge Qwen avec Ollama (quelques Go). ${par.local.info?.ollama ? '<b>Ollama est prêt.</b>' : 'Ollama n\'est pas installé : <a href="https://ollama.com/download" target="_blank" rel="noopener">télécharge-le ici</a>, installe-le, puis reviens.'}</p>
        <div class="rang"><button class="btn or" data-act="local">Installer Qwen</button><button class="btn mini" data-act="reverifier">Revérifier</button></div><div class="v4-msg" data-msg="local"></div>`,
        voix: 'Étape deux : un cerveau local, gratuit, qui fonctionne sans internet. Clique sur Installer Qwen.' },
      claude: { c: 'Raisonnement avancé. Facultatif, payant à l\'usage.', corps: `
        <ol class="v4-ol"><li>Va sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com/settings/keys</a>.</li>
        <li>Crée un compte, ajoute un petit crédit, puis <b>Create Key</b> (elle commence par <code>sk-ant-</code>).</li><li>Colle-la ici.</li></ol>${cle('anthropic', 'sk-ant-…')}`,
        voix: 'Claude est facultatif. Si tu as une clé, colle-la ici, sinon passe cette étape.' },
      claudecode: { c: 'L\'outil de code de Claude, installé sur ton ordinateur.', corps: `
        <p class="v4-p">Il s'installe avec Node.js (<code>npm install -g @anthropic-ai/claude-code</code>). Il demandera ensuite de te connecter à ton compte Claude : je ne peux pas le faire à ta place.</p>
        <div class="rang"><button class="btn or" data-act="claudecode">Installer pour moi</button><button class="btn mini" data-act="copier" data-txt="npm install -g @anthropic-ai/claude-code">Copier la commande</button></div><div class="v4-msg" data-msg="claudecode"></div>`,
        voix: 'Claude Code, pour coder. Je peux l\'installer pour toi : clique sur Installer pour moi.' },
      images: { c: 'Images gratuites sans clé, ou de meilleure qualité avec une clé.', corps: `<p class="v4-p">Le moteur gratuit est branché : demande-moi une image dans la conversation. Pour une meilleure qualité, ajoute une clé OpenAI, Stability ou Gemini dans le <a href="#/coffre">coffre de clés</a>.</p>`, voix: 'Les images fonctionnent déjà, gratuitement.' },
      video: { c: 'Montage et conversion vidéo.', corps: par.video.fait ? '<p class="v4-p">ffmpeg est présent. ✓</p>' : '<p class="v4-p">ffmpeg est introuvable. Je peux le télécharger pour toi (≈ 150 Mo, depuis GitHub) : clique sur « Installer pour moi ». Les sons de « Son &amp; cerveau » marchent déjà sans lui.</p><div class="rang"><button class="btn or" data-act="ffmpeg">Installer pour moi</button><button class="btn mini" data-act="reverifier">Revérifier</button></div><div class="v4-msg" data-msg="video"></div>', voix: par.video.fait ? 'La vidéo est prête.' : 'Pour la vidéo, il me manque ffmpeg. Les instructions sont affichées.' },
      musique: { c: 'Musique gratuite, ou Suno pour des morceaux complets.', corps: '<p class="v4-p">Des moteurs gratuits sont utilisables. Pour des morceaux complets : <a href="https://suno.com" target="_blank" rel="noopener">suno.com</a> (compte gratuit), puis tu importes le morceau dans Clipia.</p>', voix: 'La musique est facultative.' },
      voix: { c: 'Choisis la voix la plus naturelle de ton ordinateur.', corps: '<div id="v4-voix"></div>', voix: 'Choisis ma voix. Les voix marquées Natural ou Neural sonnent le plus humain.' },
      code: { c: 'Je sais écrire du code, le tester, et me modifier moi-même avec ton accord.', corps: '<p class="v4-p">Rien à installer. Chaque modification de mon propre code te demande une autorisation et peut être annulée.</p>', voix: 'Je sais coder, et me coder moi-même, avec ton accord.' },
      agents: { c: 'Agents, sous-agents, workflows, projets : tout est enregistré.', corps: '<p class="v4-p">Rien à installer. Va dans <a href="#/moi">Créer mon IA</a> pour les créer.</p>', voix: 'Les agents et workflows sont prêts.' },
      ordinateur: { c: 'Je peux utiliser ton clavier, ta souris et tes applications — seulement avec ton autorisation.', corps: `
        <p class="v4-p">À la première action, une carte « Autoriser » s'affiche : le contrôle dure 10 minutes. Je ne tape jamais de mot de passe ni de carte. Arrêt d'urgence à tout moment :</p>
        <button class="btn" data-act="stopordi">⏹ Arrêter le contrôle de l'ordinateur</button>`, voix: 'Je peux contrôler ton ordinateur, seulement avec ton autorisation, et tu peux m\'arrêter à tout moment.' },
      chrome: { c: 'Mes mains dans Chrome : onglets, pages, clics, avec ton autorisation.', corps: `
        <ol class="v4-ol"><li><button class="btn mini or" data-act="dossier">Ouvrir le dossier de l'extension</button></li>
        <li>Dans Chrome, tape <code>chrome://extensions</code> dans la barre d'adresse <button class="btn mini" data-act="copier" data-txt="chrome://extensions">copier</button></li>
        <li>Active <b>Mode développeur</b> (en haut à droite).</li><li>Clique <b>Charger l'extension non empaquetée</b> et choisis le dossier ouvert.</li></ol>
        <p class="v4-p" id="v4-chemin" style="font-size:12.5px"></p><div class="v4-msg" data-msg="chrome">En attente de l'extension…</div>`,
        voix: 'Dernière étape, facultative : l\'extension Chrome. Suis les quatre instructions, je vérifie la connexion.' }
    };
    function cle(id, ph) { return `<div class="rang"><input type="password" data-cle="${id}" placeholder="${ph}" autocomplete="off" style="flex:1;min-width:220px"><button class="btn or" data-act="tester" data-id="${id}">Tester et activer</button></div><div class="v4-msg" data-msg="${id}"></div>`; }

    const sante = await api('/api/v5/sante').catch(() => null);
    const carteSante = sante ? `<div class="carte" style="margin-bottom:14px"><div class="rang" style="justify-content:space-between"><b>🩺 Santé de Clipia : ${sante.ok ? '<span style="color:var(--ok)">tout est en ordre</span>' : '<span style="color:var(--alerte)">un point demande attention</span>'}</b><span><button class="btn mini" id="v5-rep">🔧 Réparer</button> <button class="btn mini" id="v5-jr">📄 Journal</button></span></div>
      <div style="display:grid;gap:3px;margin-top:8px;font-size:13.5px">${sante.controles.map(c => `<div>${c.ok ? '✅' : '⚠️'} <b>${esc(c.nom)}</b> <span style="color:var(--texte-doux)">${esc(c.detail)}</span></div>`).join('')}</div><pre id="v5-sortie" style="display:none;max-height:220px;overflow:auto;margin-top:10px;font-size:12px"></pre></div>` : '';
    v.append(el(`<h1>Installation guidée</h1><p class="sous">Tout en un seul endroit, pas à pas. Je te parle à chaque étape ; tu peux me couper la voix avec le bouton 🔊.</p>
      ${carteSante}<div class="rang" style="margin-bottom:14px"><button class="btn or" id="v4-tout">⚡ Tout installer d'un coup</button><button class="btn mini" id="v4-son">🔊 Voix : ${localStorage.getItem('clipia:muet') === '1' ? 'coupée' : 'active'}</button><span class="etiq ${e.cerveau ? 'ok' : 'err'}">${e.cerveau ? 'Cerveau prêt' : 'Il me faut un cerveau (étape 1 ou 2)'}</span></div><div id="v4-etapes" style="display:grid;gap:12px"></div>
      <div class="carte" style="margin-top:16px;text-align:center"><button class="btn or" id="v4-fin" style="padding:12px 26px;font-size:16px" ${e.cerveau ? '' : 'disabled'}>✔ Terminer l'installation</button><p class="v4-p" style="margin-top:8px">Tu pourras tout reprendre ici plus tard.</p></div>`));
    const zone = $('#v4-etapes', v);
    e.etapes.forEach((s, i) => {
      const a = aide[s.id];
      const c = el(`<div class="carte v4-etape ${s.fait ? 'fait' : ''}" data-id="${s.id}"><div class="rang" style="justify-content:space-between"><div><b>${i + 1}. ${esc(s.titre)}</b><div class="v4-p" style="margin:2px 0 0">${esc(a.c)}</div></div>
        <div class="rang"><span class="etiq ${s.fait ? 'ok' : s.ignore ? 'neutre' : s.optionnel ? 'neutre' : 'err'}">${s.fait ? '✓ prêt' : s.ignore ? 'ignorée' : s.optionnel ? 'facultatif' : 'à faire'}</span>
        <button class="btn mini" data-act="lire">🔊</button>${!s.fait && s.optionnel ? `<button class="btn mini" data-act="passer" data-id="${s.id}">${s.ignore ? 'Reprendre' : 'Passer'}</button>` : ''}</div></div>
        <details ${!s.fait && !s.ignore ? 'open' : ''} style="margin-top:8px"><summary style="cursor:pointer;color:var(--texte-doux)">Détails</summary><div class="v4-corps" style="margin-top:8px">${a.corps}</div></details></div>`);
      c.dataset.voix = a.voix; zone.append(c);
    });
    // voix
    const vz = $('#v4-voix', v);
    if (vz) {
      const maj = () => {
        const fr = speechSynthesis.getVoices().filter(x => /^fr/i.test(x.lang)); const cur = localStorage.getItem('clipia:voixNav') || (choisirVoix(fr)?.name || '');
        vz.innerHTML = fr.length ? `<div class="rang"><select id="v4-sel" style="flex:1;min-width:200px">${fr.map(x => `<option ${x.name === cur ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button class="btn or" id="v4-essai">▶ Écouter</button></div>` : '<p class="v4-p">Aucune voix française trouvée sur cet ordinateur. Dans Windows : Paramètres → Heure et langue → Voix → Ajouter des voix → Français.</p>';
        const sel = $('#v4-sel', vz); if (sel) { sel.onchange = () => { localStorage.setItem('clipia:voixNav', sel.value); }; $('#v4-essai', vz).onclick = () => { localStorage.setItem('clipia:voixNav', sel.value); dire('Bonjour, voici ma voix. Qu\'en penses-tu ? On peut commencer quand tu veux.'); }; }
      };
      maj(); speechSynthesis.onvoiceschanged = maj;
    }
    const msg = (id, t, c) => { const m = v.querySelector(`[data-msg="${id}"]`); if (m) { m.style.color = c || 'var(--texte-doux)'; m.textContent = t; } };
    const flux = async (url, corps, id, accord) => {
      const r = await fetch(API + url, { method: 'POST', headers: { 'content-type': 'application/json', ...(accord ? { 'x-clipia-accord': '1' } : {}) }, body: JSON.stringify(corps || {}) });
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', ok = false;
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); const l = buf.split('\n'); buf = l.pop();
        for (const L of l) { if (!L.startsWith('data:')) continue; const x = JSON.parse(L.slice(5));
          if (x.erreur) { msg(id, x.erreur, 'var(--erreur)'); return false; }
          if (x.fini) { ok = true; msg(id, '✓ Terminé.', 'var(--ok)'); } else msg(id, (x.message || 'en cours…') + (x.pct != null ? ' — ' + x.pct + ' %' : '')); }
      }
      return ok;
    };
    const faireLocal = async () => {
      if (!par.local.info?.ollama) { msg('local', 'Ollama n\'est pas installé : installe-le (lien ci-dessus) puis clique sur Revérifier.', 'var(--alerte)'); return false; }
      msg('local', 'Préparation…'); return flux('/api/auto/preparer', { avecModele: true }, 'local');
    };
    const faireCode = async () => { msg('claudecode', 'Installation en cours (une à deux minutes)…'); return flux('/api/v4/claude-code', {}, 'claudecode', true); };
    v.onclick = async (ev) => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      try {
        if (act === 'lire') dire(b.closest('.v4-etape').dataset.voix);
        else if (act === 'reverifier') route();
        else if (act === 'copier') { await navigator.clipboard?.writeText(b.dataset.txt); toast('Copié', 'ok'); }
        else if (act === 'passer') { await api('/api/v4/ignorer', { method: 'POST', body: JSON.stringify({ id: b.dataset.id, oui: !par[b.dataset.id].ignore }) }); route(); }
        else if (act === 'tester') {
          const id = b.dataset.id, valeur = v.querySelector(`[data-cle="${id}"]`).value.trim();
          msg(id, 'Test de la clé…');
          const t = await api('/api/coffre/tester', { method: 'POST', body: JSON.stringify({ fournisseur: id, valeur }) });
          if (!t.ok) { msg(id, t.message, 'var(--erreur)'); dire('La clé n\'est pas valide. ' + t.message.slice(0, 120)); return; }
          await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: 'provider:' + id, valeur }) });
          msg(id, '✓ ' + t.message, 'var(--ok)'); dire('Clé validée. Étape suivante.'); setTimeout(route, 1500);
        }
        else if (act === 'local') { if (await faireLocal()) { dire('Qwen est installé.'); setTimeout(route, 1200); } }
        else if (act === 'ffmpeg') { msg('video', 'Téléchargement en cours…'); if (await flux('/api/v4/ffmpeg', {}, 'video', true)) { dire('La vidéo est prête.'); setTimeout(route, 1200); } }
        else if (act === 'claudecode') { if (await faireCode()) { dire('Claude Code est installé.'); setTimeout(route, 1200); } }
        else if (act === 'stopordi') { await api('/api/ordi/stop', { method: 'POST' }); await api('/api/ext/stop', { method: 'POST' }); toast('Contrôle arrêté', 'ok'); }
        else if (act === 'dossier') { const r = await fetch(API + '/api/v4/ouvrir-dossier', { method: 'POST', headers: { 'x-clipia-accord': '1' } }).then(x => x.json()); $('#v4-chemin', v).textContent = 'Dossier : ' + r.dossier; }
      } catch (err) { toast(err.message, 'err'); }
    };
    const sortie = $('#v5-sortie', v);
    if ($('#v5-rep', v)) {
      $('#v5-rep', v).onclick = async () => { const r = await fetch(API + '/api/v5/reparer', { method: 'POST', headers: { 'x-clipia-accord': '1' } }).then(x => x.json()); sortie.style.display = 'block'; sortie.textContent = r.faits.join('\n'); setTimeout(route, 2500); };
      $('#v5-jr', v).onclick = async () => { const r = await api('/api/v5/journal'); sortie.style.display = 'block'; sortie.textContent = r.journal || '(journal vide)'; sortie.scrollTop = 1e9; };
    }
    $('#v4-son', v).onclick = () => { const m = localStorage.getItem('clipia:muet') === '1'; localStorage.setItem('clipia:muet', m ? '0' : '1'); if (!m) try { coupe?.(); } catch {} route(); };
    $('#v4-tout', v).onclick = async () => {
      dire('C\'est parti : j\'installe tout ce qui peut l\'être sans toi.');
      if (!par.local.fait) await faireLocal();
      if (!par.claudecode.fait) await faireCode();
      const reste = e.etapes.find(s => !s.fait && !s.optionnel && ['groq'].includes(s.id) && !e.cerveau);
      const cible = reste ? v.querySelector(`[data-id="${reste.id}"]`) : null;
      if (cible) { cible.scrollIntoView({ behavior: 'smooth' }); dire('Il me reste une chose que je ne peux pas faire à ta place : la clé Groq.'); }
      else { dire('Tout est installé.'); route(); }
    };
    $('#v4-fin', v).onclick = async () => { await api('/api/v4/terminer', { method: 'POST' }); finale(); };
    // extension Chrome : suivi en direct
    const chr = v.querySelector('[data-msg="chrome"]');
    if (chr) { fetch(API + '/api/ext/etat').then(r => r.json()).then(x => { const p = $('#v4-chemin', v); if (p) p.textContent = 'Dossier : ' + x.dossier; }).catch(() => {});
      const t = setInterval(async () => { if (!document.body.contains(chr)) return clearInterval(t); try { const x = await api('/api/ext/etat'); if (x.connectee) { msg('chrome', '✓ Extension connectée.', 'var(--ok)'); clearInterval(t); } else msg('chrome', 'En attente de l\'extension…'); } catch {} }, 3000); }
    // narration de la première étape à faire
    const premiere = e.etapes.find(s => !s.fait && !s.optionnel);
    if (premiere) { const g = () => dire(aide[premiere.id].voix); addEventListener('pointerdown', g, { once: true }); }
  };

  /* ═════════ CRÉER MON IA ═════════ */
  const MODELES = {
    agent: { t: 'Agent', ic: '🤖', ph: 'Ex : un agent qui surveille mes idées de vidéos et me propose chaque matin 3 sujets', amorce: (x) => `Crée-moi un agent (outil agent_creer) : ${x}. Choisis un nom, un rôle précis et les outils sûrs nécessaires, puis explique-moi en deux phrases comment l'utiliser.` },
    sous: { t: 'Sous-agent', ic: '🧩', ph: 'Ex : un sous-agent spécialiste des titres YouTube pour mon agent principal', amorce: (x) => `Crée-moi un sous-agent (outil agent_creer, avec parent) : ${x}. Dis-moi à quel agent il est rattaché.` },
    workflow: { t: 'Workflow', ic: '⇄', ph: 'Ex : chaque jour, chercher les actus de mon secteur, résumer, m\'écrire un brief', amorce: (x) => `Construis un workflow réutilisable (outil workflow_enregistrer) : ${x}. Donne-lui un nom, des étapes claires, puis propose de le lancer.` },
    projet: { t: 'Projet', ic: '❖', ph: 'Ex : lancer ma chaîne YouTube de musique afro-house', amorce: (x) => `Crée un projet (outil projet_creer) : ${x}. Prépare la structure, une première liste d'actions, et dis-moi par quoi commencer.` }
  };
  VUES.moi = async (v) => {
    const [pers, atl, aut, convs] = await Promise.all([api('/api/noyau/personnalite'), api('/api/atelier'), api('/api/autonome'), api('/api/conversations')]);
    const p = pers.profil; let type = 'agent';
    v.append(el(`<h1>✨ Créer mon IA</h1>
      <p class="sous">${p.prenom ? esc(p.prenom) + ', ' : ''}je suis ton agent personnel : je crée des agents et des sous-agents, des workflows, des projets — et je me souviens de tout, pour que tu puisses reprendre ce qu'on a commencé.</p>
      <div class="carte" style="border-color:var(--or-sombre)"><div class="rang" id="v4-types">${Object.entries(MODELES).map(([k, m]) => `<button class="btn ${k === type ? 'or' : ''}" data-t="${k}">${m.ic} ${m.t}</button>`).join('')}</div>
        <label class="champ" style="margin-top:12px"><span>Décris ce que tu veux (à voix haute ou au clavier)</span><textarea id="v4-desc" style="min-height:92px" placeholder="${esc(MODELES.agent.ph)}"></textarea></label>
        <div class="rang"><button class="btn or" id="v4-creer">✨ Créer avec Clipia</button><button class="btn" id="v4-micro">🎤 Dicter</button></div></div>
      <div class="grille g2" style="margin-top:16px;align-items:start">
        <div class="carte"><b>🤖 Mes agents</b><div id="v4-ag" style="margin-top:8px;display:grid;gap:6px"></div></div>
        <div class="carte"><b>⇄ Mes workflows</b><div id="v4-wf" style="margin-top:8px;display:grid;gap:6px"></div></div>
        <div class="carte"><b>❖ Mes projets</b><div id="v4-pj" style="margin-top:8px;display:grid;gap:6px"></div></div>
        <div class="carte"><b>💬 Reprendre une conversation</b><div id="v4-cv" style="margin-top:8px;display:grid;gap:6px"></div></div>
      </div>
      <div class="carte creux" style="margin-top:16px"><b>Mon profil</b><p class="v4-p">${p.configure ? `Style : ${esc(pers.modes.find(m => m.id === p.mode)?.nom || p.mode)} · ${p.vouvoiement === true ? 'vouvoiement' : 'tutoiement'}${p.fait ? ' · ' + esc(p.fait) : ''}` : 'Je ne te connais pas encore : fais le questionnaire pour que je te parle comme tu veux.'}</p>
        <div class="rang"><button class="btn or" id="v4-conf">${p.configure ? 'Reconfigurer' : 'Faire le questionnaire'}</button><a class="btn" href="#/installation">Installation guidée</a></div></div>`));
    const liste = (id, items, vide) => { const z = $(id, v); if (!items.length) z.innerHTML = `<span class="v4-p">${vide}</span>`; else items.forEach(h => z.append(h)); };
    liste('#v4-ag', (atl.agents || []).map(a => el(`<div class="rang" style="justify-content:space-between"><span>${a.parentId ? '↳ ' : ''}<b>${esc(a.nom)}</b> ${a.integre ? '<span class="etiq neutre">de base</span>' : ''}</span><button class="btn mini" data-ag="${esc(a.nom)}">Utiliser</button></div>`)), 'Aucun agent.');
    liste('#v4-wf', (aut.workflows || []).map(w => el(`<div class="rang" style="justify-content:space-between"><span><b>${esc(w.nom)}</b></span><button class="btn mini" data-wf="${esc(w.nom)}">Lancer</button></div>`)), 'Aucun workflow enregistré.');
    liste('#v4-pj', (atl.projets || []).map(x => el(`<a class="rang" href="#/atelier?p=${encodeURIComponent(x.id)}">▸ ${esc(x.nom)}</a>`)), 'Aucun projet.');
    liste('#v4-cv', (convs || []).slice(0, 8).map(c => el(`<a class="rang" href="#/clipia?c=${encodeURIComponent(c.id)}" title="${esc(c.titre)}">▸ ${esc(c.titre).slice(0, 60)}</a>`)), 'Aucune conversation encore.');
    const desc = $('#v4-desc', v);
    $('#v4-types', v).onclick = (ev) => { const b = ev.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; v.querySelectorAll('#v4-types .btn').forEach(x => x.classList.toggle('or', x === b)); desc.placeholder = MODELES[type].ph; };
    const aller = (txt) => { try { sessionStorage.setItem('clipia:amorce', txt); } catch {} location.hash = '#/clipia?n=' + Date.now(); };
    $('#v4-creer', v).onclick = () => { const x = desc.value.trim(); if (!x) return toast('Décris d\'abord ce que tu veux.', 'err'); aller(MODELES[type].amorce(x)); };
    $('#v4-micro', v).onclick = () => { if (!SR) return toast('La dictée demande Chrome ou Edge.', 'err'); const r = new SR(); r.lang = 'fr-FR'; r.interimResults = false; r.onresult = (e2) => { desc.value = (desc.value + ' ' + e2.results[0][0].transcript).trim(); }; try { r.start(); } catch {} };
    v.onclick = (ev) => {
      const a = ev.target.closest('[data-ag]'), w = ev.target.closest('[data-wf]');
      if (a) aller(`Délègue à l'agent « ${a.dataset.ag} » : ${desc.value.trim() || 'dis-moi ce qu\'il sait faire et propose-moi une première tâche.'}`);
      if (w) aller(`Lance mon workflow « ${w.dataset.wf} » (outil workflow_lancer) et dis-moi le résultat.`);
    };
    $('#v4-conf', v).onclick = () => questionnaire();
  };

  /* ═════════ ANIMATION FINALE ═════════ */
  const couche = (html, cls = '') => { document.getElementById('v4-couche')?.remove(); const c = el(`<div id="v4-couche" class="${cls}">${html}</div>`); document.body.append(c); return c; };
  const fermer = () => { try { coupe?.(); } catch {} document.getElementById('v4-couche')?.remove(); };
  async function finale() {
    const c = couche(`<div class="v4-final"><div class="v4-orbe"><i></i><i></i><i></i></div><h1 class="v4-t1">Bonjour, je suis configuré.</h1><p class="v4-t2">Tu peux maintenant me parler.</p><button class="btn or" id="v4-go" style="margin-top:22px;opacity:0">Continuer</button></div>`, 'v4-plein');
    const go = c.querySelector('#v4-go'); let suite = false;
    const enchainer = async () => { if (suite) return; suite = true; fermer(); const r = await profilCharge(); if (!r.profil.configure) questionnaire(); else location.hash = '#/clipia?n=' + Date.now(); };
    go.onclick = enchainer; setTimeout(() => { go.style.opacity = 1; }, 2600);
    const debut = Date.now();
    setTimeout(() => dire('Bonjour, je suis configuré. Tu peux maintenant me parler.', () => setTimeout(enchainer, Math.max(900, 6000 - (Date.now() - debut)))), 700);
  }
  window.addEventListener('clipia:finale', finale);

  /* ═════════ QUESTIONNAIRE ═════════ */
  const QUESTIONS = [
    { k: 'prenom', q: 'Comment dois-je t\'appeler ?', type: 'texte', ph: 'Ton prénom ou surnom' },
    { k: 'vouvoiement', q: 'Je te tutoie ou je te vouvoie ?', type: 'choix', choix: [['Je te tutoie', false], ['Je te vouvoie', true]] },
    { k: 'mode', q: 'Comment dois-je te parler ?', type: 'mode' },
    { k: 'fait', q: 'Qu\'est-ce que tu fais, ou sur quoi travailles-tu en ce moment ?', type: 'texte', ph: 'Ex : je fais de la musique et des vidéos', long: true },
    { k: 'objectifs', q: 'Qu\'est-ce que tu voudrais accomplir avec moi ?', type: 'texte', ph: 'Ex : lancer ma chaîne, gagner du temps, apprendre…', long: true },
    { k: 'longueur', q: 'Tes réponses : courtes, moyennes ou détaillées ?', type: 'choix', choix: [['Courtes', 'courte'], ['Moyennes', 'moyenne'], ['Détaillées', 'longue']] },
    { k: 'emoji', q: 'Je peux mettre des emojis dans mes messages ?', type: 'choix', choix: [['Oui', true], ['Non', false]] },
    { k: 'tonLibre', q: 'Quelque chose d\'autre que je dois savoir pour te parler comme tu aimes ?', type: 'texte', ph: 'Ex : n\'hésite pas à me contredire. (Facultatif)', long: true, facultatif: true }
  ];
  async function questionnaire() {
    const pers = await profilCharge(); const rep = {}; let i = 0, ecoute = null;
    const c = couche(`<div class="v4-quest"><div class="rang" style="justify-content:space-between"><b>🧬 Faisons connaissance</b><span id="v4-n" class="v4-p"></span></div><div class="v4-barre"><i id="v4-b"></i></div><h2 id="v4-q" style="margin:18px 0 12px"></h2><div id="v4-r"></div><div class="rang" style="margin-top:16px;justify-content:space-between"><button class="btn mini" id="v4-prec">← Précédent</button><span><button class="btn mini" id="v4-ign">Plus tard</button> <button class="btn or" id="v4-suiv">Suivant →</button></span></div></div>`, 'v4-fond');
    const stopEcoute = () => { try { ecoute?.abort(); } catch {} ecoute = null; };
    const enregistrer = async (final) => {
      const patch = { ...rep }; if (final) patch.configure = true;
      await api('/api/noyau/personnalite', { method: 'POST', body: JSON.stringify(patch) }); await profilCharge();
    };
    const montrer = () => {
      stopEcoute(); const Q = QUESTIONS[i], z = c.querySelector('#v4-r');
      c.querySelector('#v4-q').textContent = Q.q; c.querySelector('#v4-n').textContent = `${i + 1} / ${QUESTIONS.length}`; c.querySelector('#v4-b').style.width = ((i + 1) / QUESTIONS.length * 100) + '%';
      c.querySelector('#v4-prec').style.visibility = i ? 'visible' : 'hidden'; c.querySelector('#v4-suiv').textContent = i === QUESTIONS.length - 1 ? 'Terminer ✓' : 'Suivant →';
      const actuel = rep[Q.k] !== undefined ? rep[Q.k] : pers.profil[Q.k];
      if (Q.type === 'texte') {
        z.innerHTML = `<${Q.long ? 'textarea style="min-height:90px"' : 'input type="text"'} id="v4-in" placeholder="${esc(Q.ph || '')}" ${Q.long ? '' : `value="${esc(actuel || '')}"`}>${Q.long ? esc(actuel || '') + '</textarea>' : ''}${SR ? '<div class="rang" style="margin-top:8px"><button class="btn" id="v4-mic">🎤 Répondre à voix haute</button><span class="v4-p" id="v4-ec"></span></div>' : ''}`;
        const inp = z.querySelector('#v4-in'); inp.focus(); inp.oninput = () => { rep[Q.k] = inp.value; };
        const mic = z.querySelector('#v4-mic');
        if (mic) mic.onclick = () => {
          stopEcoute(); const r = new SR(); r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true; ecoute = r; let cumul = '', t = null;
          const fin = () => { stopEcoute(); z.querySelector('#v4-ec').textContent = ''; };
          r.onresult = (ev) => { cumul = Array.from(ev.results).map(x => x[0].transcript).join(' ').trim(); inp.value = cumul; rep[Q.k] = cumul; z.querySelector('#v4-ec').textContent = '🎤 Je t\'écoute…'; clearTimeout(t); t = setTimeout(() => { fin(); suivant(); }, 3000); };
          r.onerror = fin; try { r.start(); z.querySelector('#v4-ec').textContent = '🎤 Je t\'écoute…'; } catch {}
        };
      } else if (Q.type === 'choix') {
        z.innerHTML = `<div class="rang">${Q.choix.map(([l, val]) => `<button class="btn v4-ch ${actuel === val ? 'or' : ''}" data-v='${JSON.stringify(val)}'>${l}</button>`).join('')}</div>`;
        z.onclick = (ev) => { const b = ev.target.closest('.v4-ch'); if (!b) return; rep[Q.k] = JSON.parse(b.dataset.v); z.querySelectorAll('.v4-ch').forEach(x => x.classList.toggle('or', x === b)); setTimeout(suivant, 350); };
      } else {
        const ordre = ['ami', 'entrepreneur', 'pro', 'direct', 'drole', 'pedagogue', 'cash', 'createur', 'modere'];
        const ms = ordre.map(id => pers.modes.find(m => m.id === id)).filter(Boolean);
        z.innerHTML = `<div class="v4-modes">${ms.map(m => `<button class="v4-mode ${actuel === m.id ? 'actif' : ''}" data-m="${m.id}"><span>${m.emoji}</span><b>${esc(m.nom)}</b><small>${esc(m.quoi)}</small></button>`).join('')}</div>`;
        z.onclick = (ev) => { const b = ev.target.closest('.v4-mode'); if (!b) return; rep.mode = b.dataset.m; z.querySelectorAll('.v4-mode').forEach(x => x.classList.toggle('actif', x === b)); };
      }
      dire((i === 0 && !pers.profil.configure ? 'Faisons connaissance, pour que je te parle exactement comme tu aimes. ' : '') + Q.q);
    };
    const suivant = async () => {
      const Q = QUESTIONS[i];
      if (Q.type === 'texte' && !Q.facultatif && !String(rep[Q.k] ?? pers.profil[Q.k] ?? '').trim()) { toast('Écris (ou dis) une réponse, ou clique « Plus tard ».', 'err'); return; }
      if (i < QUESTIONS.length - 1) { i++; montrer(); return; }
      stopEcoute(); await enregistrer(true);
      const p = window.__profil;
      c.querySelector('.v4-quest').innerHTML = `<div style="text-align:center;padding:24px"><div style="font-size:48px">✅</div><h2>C'est noté${p.prenom ? ', ' + esc(p.prenom) : ''}.</h2><p class="v4-p">Dis simplement « Clipia » et je te répondrai comme tu me l'as demandé.</p><button class="btn or" id="v4-ok">Commencer</button></div>`;
      dire(`C'est noté${p.prenom ? ', ' + p.prenom : ''}. Dis simplement Clipia, et je te répondrai comme tu me l'as demandé.`);
      c.querySelector('#v4-ok').onclick = () => { fermer(); location.hash = '#/clipia?n=' + Date.now(); };
    };
    c.querySelector('#v4-suiv').onclick = suivant;
    c.querySelector('#v4-prec').onclick = () => { if (i) { i--; montrer(); } };
    c.querySelector('#v4-ign').onclick = async () => { stopEcoute(); if (Object.keys(rep).length) await enregistrer(false); fermer(); };
    montrer();
  }
  window.addEventListener('clipia:questionnaire', questionnaire);

  /* Premier lancement : va à l'installation guidée, puis finale + questionnaire. */
  (async () => {
    try {
      const e = await api('/api/v4/etat');
      if (!e.termine && !sessionStorage.getItem('clipia:v4-vu') && !/^#\/(installation|moi|installateur)/.test(location.hash)) { sessionStorage.setItem('clipia:v4-vu', '1'); location.hash = '#/installateur'; }
      else if (e.termine && !e.configure && !sessionStorage.getItem('clipia:v4-q')) { sessionStorage.setItem('clipia:v4-q', '1'); questionnaire(); }
    } catch {}
  })();
}
