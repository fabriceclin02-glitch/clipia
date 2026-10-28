/* CLIPIA V6 — « Comment te parler » (modes, psychologue, accès), assistant d'installation écran par écran avec animation 3D. */
import { parlerNaturel } from './voix-naturelle.js';

export function installerV6({ $, el, esc, api, API, VUES, toast }) {
  const octets = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' Go' : n > 1e6 ? Math.round(n / 1e6) + ' Mo' : Math.round((n || 0) / 1e3) + ' ko';
  let coupe = null;
  const dire = (t, apres) => {
    try { coupe?.(); } catch {}
    if (localStorage.getItem('clipia:muet') === '1') { apres?.(); return; }
    try { coupe = parlerNaturel(t, { preferee: localStorage.getItem('clipia:voixNav') || '', onend: apres }); } catch { apres?.(); }
  };
  async function flux(url, corps, onEv) {
    const r = await fetch(API + url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-clipia-accord': '1' }, body: JSON.stringify(corps || {}) });
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', dernier = null;
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const l = buf.split('\n'); buf = l.pop();
      for (const L of l) if (L.startsWith('data:')) { try { dernier = JSON.parse(L.slice(5)); onEv(dernier); } catch {} }
    }
    return dernier;
  }
  const attendre = ms => new Promise(r => setTimeout(r, ms));

  /* ═════════ ANIMATION 3D (canvas, zéro dépendance) ═════════ */
  function anim3D(canvas) {
    const ctx = canvas.getContext('2d'); let W = 0, H = 0, raf = 0, t = 0, mx = 0, my = 0;
    const N = 520, pts = [];
    for (let i = 0; i < N; i++) {                       // sphère de Fibonacci
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963;
      pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, h: 250 + (i % 7) * 8 });
    }
    const anneaux = [0, 1].map(k => Array.from({ length: 90 }, (_, i) => ({ a: i / 90 * Math.PI * 2, k })));
    const taille = () => { const d = devicePixelRatio || 1; W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    taille(); addEventListener('resize', taille);
    const move = e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; };
    addEventListener('pointermove', move);
    const proj = (x, y, z, ay, ax, R) => {
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y * cx - Z * sx; Z = y * sx + Z * cx;
      const p = 2.6 / (2.6 - Z * .9); return { x: W / 2 + X * R * p, y: H / 2 + Y * R * p, z: Z, p };
    };
    const boucle = () => {
      t += .006; ctx.clearRect(0, 0, W, H);
      const R = Math.min(W, H) * .30, ay = t * 1.1 + mx * .5, ax = .35 + Math.sin(t * .7) * .25 + my * .3;
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 1.7);
      g.addColorStop(0, 'rgba(124,58,237,.38)'); g.addColorStop(.5, 'rgba(37,99,235,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const pulse = 1 + Math.sin(t * 3) * .03;
      const liste = pts.map(q => { const p = proj(q.x * pulse, q.y * pulse, q.z * pulse, ay, ax, R); p.h = q.h; return p; }).sort((a, b) => a.z - b.z);
      for (const p of liste) {
        const a = .25 + (p.z + 1) * .38; ctx.fillStyle = `hsla(${p.h},90%,${62 + p.z * 14}%,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, (1 + (p.z + 1) * 1.15) * p.p, 0, 7); ctx.fill();
      }
      anneaux.forEach((an, k) => an.forEach(q => {
        const a = q.a + t * (k ? -1.6 : 1.3), rr = 1.38 + k * .22;
        const p = proj(Math.cos(a) * rr, Math.sin(a) * rr * (k ? .25 : .12), Math.sin(a) * rr, ay * .6 + k, ax + (k ? .9 : -.4), R);
        ctx.fillStyle = k ? 'rgba(79,224,176,.85)' : 'rgba(201,160,255,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + (p.z + 1) * .8, 0, 7); ctx.fill();
      }));
      ctx.font = '800 ' + Math.round(R * .26) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24; ctx.fillText('CLIPIA', W / 2, H / 2); ctx.shadowBlur = 0;
      raf = requestAnimationFrame(boucle);
    };
    boucle();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', taille); removeEventListener('pointermove', move); };
  }

  /* ═════════ « COMMENT TE PARLER » : modes, psychologue, accès ═════════ */
  async function rendreParole(v, { dansAssistant = false } = {}) {
    const [pers, e6] = await Promise.all([api('/api/noyau/personnalite'), api('/api/v6/etat')]);
    const carte = el(`<div class="v6-parole"></div>`); v.append(carte);
    const dessiner = async () => {
      const P = await api('/api/noyau/personnalite');
      carte.innerHTML = `
      <div class="carte"><h2 style="margin:0 0 4px">Comment veux-tu que Clipia te parle ?</h2>
        <p class="v4-p">Choisis un style. Tu peux en changer à tout moment, ou créer le tien.</p>
        <div class="v6-modes">${P.modes.map(m => `<button class="v6-mode ${m.actif ? 'actif' : ''}" data-m="${esc(m.id)}"><span class="v6-em">${esc(m.emoji)}</span><b>${esc(m.nom)}</b><small>${esc(m.quoi)}</small>${m.perso ? '<i class="v6-sup" data-sup="' + esc(m.id) + '" title="Supprimer ce mode">✕</i>' : ''}</button>`).join('')}
          <button class="v6-mode v6-nouveau" id="v6-nv"><span class="v6-em">＋</span><b>Créer mon style</b><small>Décris comment tu veux qu'elle te parle.</small></button></div>
        <div id="v6-form" style="display:none;margin-top:12px" class="carte creux">
          <label class="champ"><span>Nom du style</span><input id="v6-fn" maxlength="40" placeholder="ex. Grand frère, Coach sportif, Prof de maths…"></label>
          <label class="champ"><span>Comment doit-elle te parler ?</span><textarea id="v6-fi" rows="4" placeholder="ex. Tu me tutoies, tu es direct et drôle, tu me challenges quand je procrastine, tu poses une question à la fois…"></textarea></label>
          <div class="rang"><button class="btn or" id="v6-fok">Créer et l'utiliser</button><button class="btn mini" id="v6-fno">Annuler</button></div></div>
        ${P.modes.some(m => m.id === 'psychologue' && m.actif) ? `<div class="carte creux" style="margin-top:12px"><b>🧠 Psychologue personnel</b>
          <p class="v4-p">Clipia t'écoute et se souvient de vos séances (${e6.psy.seances} échange(s) gardé(s)). Ce carnet reste <b>uniquement sur ton ordinateur</b>. C'est un soutien : ce n'est pas une psychologue diplômée, elle ne pose pas de diagnostic. En cas de détresse : <b>3114</b> (24 h/24, gratuit) ou 15 / 112 en urgence.</p>
          <div class="rang"><button class="btn mini" id="v6-psy-voir">Voir le carnet</button><button class="btn mini" id="v6-psy-eff">Effacer le carnet</button></div><div id="v6-psy-liste" class="v4-p"></div></div>` : ''}
      </div>`;
      carte.querySelectorAll('[data-m]').forEach(b => b.onclick = async ev => {
        if (ev.target.dataset.sup) return;
        await api('/api/noyau/personnalite', { method: 'POST', body: JSON.stringify({ mode: b.dataset.m }) }); window.dispatchEvent(new Event('clipia:profil')); await dessiner();
        toast('Style : ' + P.modes.find(m => m.id === b.dataset.m)?.nom, 'ok');
      });
      carte.querySelectorAll('[data-sup]').forEach(b => b.onclick = async () => { await api('/api/v6/modes/' + encodeURIComponent(b.dataset.sup), { method: 'DELETE' }); await dessiner(); });
      $('#v6-nv', carte).onclick = () => { $('#v6-form', carte).style.display = ''; $('#v6-fn', carte).focus(); };
      $('#v6-fno', carte).onclick = () => { $('#v6-form', carte).style.display = 'none'; };
      $('#v6-fok', carte).onclick = async () => {
        try {
          const r = await api('/api/v6/modes', { method: 'POST', body: JSON.stringify({ nom: $('#v6-fn', carte).value, instructions: $('#v6-fi', carte).value, quoi: $('#v6-fi', carte).value.slice(0, 90) }) });
          await api('/api/noyau/personnalite', { method: 'POST', body: JSON.stringify({ mode: r.mode.id }) }); toast('Style créé et activé', 'ok'); await dessiner();
        } catch (err) { toast(err.message, 'err'); }
      };
      $('#v6-psy-voir', carte)?.addEventListener('click', async () => {
        const r = await api('/api/v6/psy'); $('#v6-psy-liste', carte).innerHTML = r.seances.length ? r.seances.slice(-12).map(s => `<div>• ${esc(s.quand.slice(0, 10))} — « ${esc(s.moi.slice(0, 160))} »</div>`).join('') : 'Le carnet est vide.';
      });
      $('#v6-psy-eff', carte)?.addEventListener('click', async () => { if (!confirm('Effacer tout le carnet de séances ?')) return; await api('/api/v6/psy/effacer', { method: 'POST' }); toast('Carnet effacé', 'ok'); await dessiner(); });
    };
    await dessiner();
    if (dansAssistant) return;

    /* Accès de Clipia + OpenClaw */
    const ch = e6.choisies || Object.fromEntries(e6.capacites.map(c => [c.id, true]));
    const oc = e6.openclaw;
    const acces = el(`<div class="carte" style="margin-top:14px"><h2 style="margin:0 0 4px">Accès de Clipia à ton ordinateur</h2>
      <p class="v4-p">Ce que Clipia a le droit d'utiliser. Même coché, chaque action sensible demande ton autorisation sur le moment (10 minutes), et elle ne tape jamais de mot de passe.</p>
      <div class="v6-caps">${e6.capacites.map(c => `<label class="v6-cap"><input type="checkbox" data-c="${c.id}" ${ch[c.id] ? 'checked' : ''}><span><b>${esc(c.nom)}</b><small>${esc(c.quoi)}</small></span></label>`).join('')}</div>
      <div class="rang"><button class="btn mini" id="v6-all">Tout cocher</button><button class="btn or" id="v6-capok">Enregistrer</button></div>
      <hr style="border:0;border-top:1px solid var(--bordure,#333);margin:14px 0"><b>OpenClaw</b>
      <p class="v4-p">${oc.present ? `Détecté sur ton ordinateur${oc.passerelle ? ' (passerelle en marche)' : ''}. ${oc.skills.length} compétence(s) trouvée(s), ${oc.importees} déjà importée(s).` : 'Non détecté sur cet ordinateur.'}</p>
      ${oc.skills.length ? `<div class="v6-caps">${oc.skills.map(s => `<label class="v6-cap"><input type="checkbox" data-sk="${esc(s.id)}"><span><b>${esc(s.nom)}</b><small>${esc(s.description)}</small></span></label>`).join('')}</div><button class="btn mini or" id="v6-imp">Importer les compétences cochées</button> <small>Ce sont des textes écrits par d'autres : lis-les avant d'importer.</small>` : ''}
      </div>`);
    v.append(acces);
    $('#v6-all', acces).onclick = () => acces.querySelectorAll('[data-c]').forEach(i => i.checked = true);
    $('#v6-capok', acces).onclick = async () => { await api('/api/v6/capacites', { method: 'POST', body: JSON.stringify({ capacites: Object.fromEntries([...acces.querySelectorAll('[data-c]')].map(i => [i.dataset.c, i.checked])) }) }); toast('Accès enregistrés', 'ok'); };
    $('#v6-imp', acces)?.addEventListener('click', async () => { const ids = [...acces.querySelectorAll('[data-sk]:checked')].map(i => i.dataset.sk); const r = await api('/api/v6/openclaw/importer', { method: 'POST', body: JSON.stringify({ ids }) }); toast(r.importees + ' compétence(s) importée(s)', 'ok'); });
  }
  VUES.parole = async (v) => { v.append(el('<h1>Comment te parler</h1><p class="sous">Le ton de Clipia, ses accès, ses compétences.</p>')); await rendreParole(v); };
  const confOrig = VUES.configuration;
  VUES.configuration = async (v) => { try { await rendreParole(v); } catch (e) { v.append(el(`<div class="carte"><b>Style de Clipia indisponible :</b> ${esc(e.message)}</div>`)); } await confOrig(v); };

  /* ═════════ ASSISTANT D'INSTALLATION — écran par écran ═════════ */
  VUES.installateur = async (v) => {
    v.append(el('<div class="carte"><b>L\'assistant d\'installation est ouvert en plein écran.</b><p class="v4-p">Tu peux le fermer avec « Quitter ».</p><button class="btn or" id="v6-rouvrir">Rouvrir l\'assistant</button></div>'));
    $('#v6-rouvrir', v).onclick = () => ouvrirAssistant();
    ouvrirAssistant();
  };

  async function ouvrirAssistant() {
    if (document.getElementById('v6-assistant')) return;
    let E, rec, cat, e6;
    try { [E, rec, cat, e6] = await Promise.all([api('/api/v5/cerveau'), api('/api/auto/recommandation'), api('/api/modeles-locaux'), api('/api/v6/etat')]); }
    catch (err) { toast('Le serveur de Clipia ne répond pas : ' + err.message, 'err'); return; }
    const ram = E.ram;
    const info = Object.fromEntries((cat.catalogue || []).map(m => [m.nom, m]));
    const tient = n => (parseFloat(String(info[n]?.ram || '99').replace(',', '.')) || 99) <= ram + 0.5;
    const PRESETS = [
      { nom: 'qwen2.5:1.5b', titre: 'Rapide et léger', quoi: 'Répond vite, même sur un petit ordinateur.' },
      { nom: rec.principal?.nom || 'qwen3:4b', titre: 'Équilibré — recommandé pour ta machine', quoi: 'Le meilleur compromis qualité / vitesse pour ' + ram + ' Go de mémoire.' },
      { nom: ['qwen3:32b', 'qwen3:14b', 'qwen3:8b'].find(tient) || 'qwen3:8b', titre: 'Puissant', quoi: 'Le plus fin que ta machine supporte. Plus lent.' },
      { nom: 'qwen2.5-coder:7b', titre: 'Codeur', quoi: 'Pour que Clipia écrive du code et se corrige.' },
      { nom: 'deepseek-r1:7b', titre: 'Raisonnement', quoi: 'Réfléchit étape par étape : logique, maths, plans.' },
      { nom: 'nomic-embed-text', titre: 'Mémoire', quoi: 'Pour retrouver ce qui a été dit (petit : 275 Mo).' }
    ].filter((p, i, t) => t.findIndex(x => x.nom === p.nom) === i);

    const plan = {
      groq: E.groq, claude: false, cnx: new Set(),
      modeles: new Set([PRESETS[1].nom, 'nomic-embed-text', ...(ram <= 4 ? [PRESETS[0].nom] : [])]),
      agents: new Set(e6.agentsDepart.map(a => a.id)),
      caps: Object.fromEntries(e6.capacites.map(c => [c.id, ['micro', 'son', 'fichiers', 'code', 'systeme'].includes(c.id)])),
      skills: new Set(), prenom: '', mode: 'modere'
    };
    plan.etatCnx = await api('/api/v61/connexions').catch(() => []);

    const ov = el(`<div id="v6-assistant"><canvas id="v6-cv"></canvas><div id="v6-cadre"></div>
      <div id="v6-haut"><span id="v6-etape"></span><button class="btn mini" id="v6-quit">Quitter l'assistant</button></div></div>`);
    document.body.append(ov);
    const arreter3D = anim3D($('#v6-cv', ov));
    const cadre = $('#v6-cadre', ov);
    const surHash = () => { if (!/^#\/installateur/.test(location.hash)) fermer(); };   // naviguer ailleurs ferme l'assistant
    const fermer = () => { removeEventListener('hashchange', surHash); arreter3D(); try { coupe?.(); } catch {} ov.remove(); sessionStorage.setItem('clipia:v4-vu', '1'); };
    addEventListener('hashchange', surHash);
    $('#v6-quit', ov).onclick = () => { fermer(); location.hash = '#/clipia'; };

    const TOTAL = 10; let n = 0;
    const entete = (i) => { $('#v6-etape', ov).textContent = i === 0 ? '' : `Étape ${i} sur ${TOTAL - 1}`; ov.classList.toggle('accueil', i === 0); };
    const ecran = (i, titre, sous, corps, { suivant = 'Suivant', precedent = true, onSuivant, desactiver = false, voix } = {}) => {
      n = i; entete(i);
      cadre.innerHTML = `<div class="v6-ecran"><div class="v6-points">${Array.from({ length: TOTAL - 1 }, (_, k) => `<i class="${k + 1 <= i ? 'on' : ''}"></i>`).join('')}</div>
        <h1>${titre}</h1><p class="v6-sous">${sous}</p><div class="v6-corps">${corps}</div>
        <div class="v6-nav">${precedent ? '<button class="btn" id="v6-prec">← Précédent</button>' : '<span></span>'}<button class="btn or v6-gros" id="v6-suiv" ${desactiver ? 'disabled' : ''}>${suivant} →</button></div></div>`;
      $('#v6-prec', cadre)?.addEventListener('click', () => aller(i - 1));
      $('#v6-suiv', cadre).onclick = async () => { if (onSuivant) await onSuivant(); aller(i + 1); };
      if (voix) dire(voix);
    };
    const aller = (i) => ecrans[Math.max(0, Math.min(ecrans.length - 1, i))]();

    const ecrans = [
      /* 0 — accueil */
      () => {
        n = 0; entete(0);
        const L1 = 'Bonjour, je suis Clipia.', L2 = 'Maintenant, je vais t\'aider à m\'installer sur ta machine et te guider pas à pas. Et on va faire du bon boulot ensemble.';
        cadre.innerHTML = `<div class="v6-accueil"><h1 id="v6-l1"></h1><p id="v6-l2"></p><button class="btn or v6-gros" id="v6-go" style="opacity:0">Commencer l'installation →</button></div>`;
        const tape = async (id, txt, vit) => { const e = $(id, cadre); if (!e) return; e.textContent = ''; for (const c of txt) { if (!e.isConnected) return; e.textContent += c; await attendre(vit); } };
        let demarre = false;
        const lancer = async () => { if (demarre) return; demarre = true; dire(L1 + ' ' + L2); await tape('#v6-l1', L1, 55); await tape('#v6-l2', L2, 22); const g0 = $('#v6-go', cadre); if (g0) g0.style.opacity = 1; };
        lancer(); $('#v6-go', cadre).onclick = () => { try { coupe?.(); } catch {} aller(1); };
        cadre.querySelector('.v6-accueil').addEventListener('click', () => { if (!demarre) lancer(); });
      },
      /* 1 — cerveau rapide (Groq) */
      () => ecran(1, 'Mon cerveau rapide', 'Groq est gratuit et ultra-rapide : c\'est lui qui me fera répondre en un clin d\'œil. Il me faut une clé, qui est gratuite.', `
        <ol class="v4-ol"><li>Ouvre <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> et connecte-toi (e-mail ou Google).</li><li>Clique sur <b>Create API Key</b> et copie la clé (elle commence par <code>gsk_</code>).</li><li>Colle-la ici :</li></ol>
        <div class="rang"><input type="password" id="v6-gk" placeholder="gsk_…" autocomplete="off" style="flex:1;min-width:220px"><button class="btn or" id="v6-gb">Tester et activer</button></div>
        <div class="v4-msg" id="v6-gm">${plan.groq ? '✓ Une clé Groq est déjà enregistrée.' : 'Tu peux aussi passer cette étape : je me rabattrai sur le cerveau local.'}</div>`, { voix: 'Étape un : mon cerveau rapide. Crée une clé Groq gratuite, colle-la ici, et je la teste pour toi.' }),
      /* 2 — Claude (clé API) : secours quand Groq est saturé */
      () => ecran(2, 'Claude en secours', 'Si Groq est saturé ou injoignable, je me rabats sur Claude (Anthropic) : plus fin, mais payant à l\'usage. Étape facultative.', `
        <ol class="v4-ol"><li>Ouvre <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com/settings/keys</a>.</li><li>Crée une clé (elle commence par <code>sk-ant-</code>) et ajoute quelques euros de crédit.</li><li>Colle-la ici :</li></ol>
        <div class="rang"><input type="password" id="v6-ck" placeholder="sk-ant-…" autocomplete="off" style="flex:1;min-width:220px"><button class="btn or" id="v6-cb">Tester et activer</button></div>
        <div class="v4-msg" id="v6-cm">Ordre appliqué : Groq d'abord (gratuit), Claude seulement en renfort, puis le cerveau local.</div>`, { voix: 'Étape deux : Claude en secours. C\'est facultatif. Si Groq est saturé, je passerai sur Claude.' }),
      /* 3 — cerveau local */
      () => ecran(3, 'Mon cerveau local', `Des modèles gratuits qui tournent sur ton ordinateur, sans internet. Ta machine a <b>${ram} Go</b> de mémoire : coche ce que tu veux que je télécharge.`,
        `<div class="v6-caps">${PRESETS.map(p => { const ok = tient(p.nom); const m = info[p.nom]; return `<label class="v6-cap ${ok ? '' : 'non'}"><input type="checkbox" data-mod="${esc(p.nom)}" ${plan.modeles.has(p.nom) ? 'checked' : ''} ${ok ? '' : 'disabled'}><span><b>${esc(p.titre)}</b> <code>${esc(p.nom)}</code><small>${esc(p.quoi)} · ${esc(m?.taille || '')}${ok ? '' : ' · demande ' + esc(m?.ram || '?') + ' de mémoire'}</small></span></label>`; }).join('')}</div>
         <p class="v4-p">Je m'occupe aussi d'installer Ollama (le moteur) si besoin. ${E.ollama.installe ? '<b>Ollama est déjà là.</b>' : 'Il sera téléchargé (~' + esc(E.ollama.installeur?.taille || '700 Mo') + ').'}</p>`,
        { onSuivant: () => { plan.modeles = new Set([...cadre.querySelectorAll('[data-mod]:checked')].map(i => i.dataset.mod)); }, voix: 'Étape deux : mon cerveau local. Coche les modèles que tu veux que je télécharge. Je te conseille celui recommandé pour ta machine.' }),
      /* 3 — agent personnel */
      () => ecran(4, 'Mon agent personnel', 'Je suis ton agent personnel. Je peux créer d\'autres agents, des sous-agents spécialisés, qui travaillent pour toi. Voici ceux que je prépare tout de suite :',
        `<div class="v6-caps">${e6.agentsDepart.map(a => `<label class="v6-cap"><input type="checkbox" data-ag="${esc(a.id)}" ${plan.agents.has(a.id) ? 'checked' : ''}><span><b>${esc(a.nom)}</b><small>${esc(a.role)}</small></span></label>`).join('')}</div>
         <p class="v4-p">Ensuite, je pourrai en créer d'autres moi-même, avec des workflows et des projets, et je retiendrai nos conversations pour les reprendre.</p>`,
        { onSuivant: () => { plan.agents = new Set([...cadre.querySelectorAll('[data-ag]:checked')].map(i => i.dataset.ag)); }, voix: 'Étape trois : ton agent personnel. Je peux créer des sous-agents : un codeur, un chercheur, un rédacteur. Coche ceux que tu veux.' }),
      /* 4 — accès */
      () => ecran(5, 'Mon accès à ton ordinateur', 'Pour t\'être vraiment utile, je peux avoir accès à ton système. À toi de cocher. Tu pourras tout changer plus tard dans Configuration.',
        `<div class="rang" style="margin-bottom:8px"><button class="btn mini or" id="v6-tout">✔ Tout cocher (accès complet)</button><button class="btn mini" id="v6-rien">Tout décocher</button></div>
         <div class="v6-caps">${e6.capacites.map(c => `<label class="v6-cap"><input type="checkbox" data-c="${c.id}" ${plan.caps[c.id] ? 'checked' : ''}><span><b>${esc(c.nom)}</b><small>${esc(c.quoi)}</small></span></label>`).join('')}</div>
         <p class="v4-p">🔒 Même coché, chaque action sensible (taper, cliquer, lancer une commande) affiche une carte « Autoriser » valable 10 minutes, avec un bouton d'arrêt d'urgence. Je ne tape jamais de mot de passe ni de numéro de carte.</p>`,
        { onSuivant: () => { plan.caps = Object.fromEntries([...cadre.querySelectorAll('[data-c]')].map(i => [i.dataset.c, i.checked])); }, voix: 'Étape quatre : ton ordinateur. Coche ce que je peux utiliser : le navigateur, les fichiers, le code, le micro, le son. Tu gardes toujours la main.' }),
      /* 6 — connexions */
      () => ecran(6, 'Mes connexions', 'Telegram, Slack, WhatsApp, Gmail, Outlook… Branche ce que tu veux : je n\'envoie jamais rien sans ton accord. Tout est facultatif et modifiable plus tard dans « Connexions & compétences ».',
        `<div class="v6-caps">${(plan.etatCnx || []).filter(c => c.id !== 'claude').map(c => `<div class="v6-cap" style="display:block"><b>${c.icone || ''} ${esc(c.nom)}</b> <small>${esc(c.quoi || '')}</small>
          ${c.oauth ? '<small>Google et Microsoft demandent de créer ta propre application (guide dans « Connexions & compétences »).</small>' : `<details><summary>Comment faire ?</summary><ol class="v4-ol">${(c.guide || []).map(g => `<li>${esc(g)}</li>`).join('')}</ol></details>
          <div class="rang">${c.champs.map(f => `<input type="${f.secret ? 'password' : 'text'}" data-cn="${esc(c.id)}" data-k="${esc(f.cle)}" placeholder="${esc(f.label)}" autocomplete="off" style="flex:1;min-width:160px">`).join('')}<button class="btn mini or" data-cnb="${esc(c.id)}">Enregistrer</button></div>`}
          <div class="v4-msg" data-cm="${esc(c.id)}">${c.connecte ? '✓ Déjà connecté' : ''}</div></div>`).join('')}</div>`,
        { voix: 'Étape six : tes connexions. Telegram, Slack, WhatsApp. Tout est facultatif, tu peux passer.' }),
      /* 7 — compétences OpenClaw */
      () => ecran(7, 'Mes compétences (OpenClaw)', e6.openclaw.present ? 'J\'ai trouvé OpenClaw sur ton ordinateur. Je peux reprendre ses compétences pour devenir plus puissante.' : 'Je n\'ai pas trouvé OpenClaw sur cet ordinateur. Tu peux passer cette étape : je saurai m\'y connecter plus tard si tu l\'installes.',
        `<div class="v6-caps"><label class="v6-cap"><input type="checkbox" id="v6-ocall" checked><span><b>🦞 Reprendre toutes les compétences OpenClaw compatibles</b><small>50 compétences officielles fournies (mail, Google, GitHub, notes, voix…), lues comme des méthodes.</small></span></label><label class="v6-cap"><input type="checkbox" id="v6-tel"><span><b>📱 Activer le téléphone + serveur MCP</b><small>Appli installable (QR code) pour parler à Clipia de n'importe où. Protégé par un jeton ; le contrôle du PC demande toujours ton accord sur le PC.</small></span></label></div>` + (e6.openclaw.skills.length ? `<div class="v6-caps">${e6.openclaw.skills.map(s => `<label class="v6-cap"><input type="checkbox" data-sk="${esc(s.id)}"><span><b>${esc(s.nom)}</b><small>${esc(s.description || 'Sans description')}</small></span></label>`).join('')}</div><p class="v4-p">⚠ Ces compétences sont des textes écrits par d'autres. Ne coche que celles dont tu as lu le contenu et que tu connais.</p>` : `<p class="v4-p">${e6.openclaw.present ? 'OpenClaw est présent mais aucune compétence (SKILL.md) n\'a été trouvée.' : 'Rien à importer.'}</p>`),
        { onSuivant: () => { plan.ocAll = Boolean(cadre.querySelector('#v6-ocall')?.checked); plan.tel = Boolean(cadre.querySelector('#v6-tel')?.checked); plan.skills = new Set([...cadre.querySelectorAll('[data-sk]:checked')].map(i => i.dataset.sk)); }, voix: e6.openclaw.present ? 'Étape cinq : j\'ai trouvé OpenClaw. Coche les compétences que je peux reprendre.' : 'Étape cinq : je n\'ai pas trouvé OpenClaw. Tu peux passer.' }),
      /* 6 — récapitulatif + installation */
      () => {
        const nbCaps = Object.values(plan.caps).filter(Boolean).length;
        ecran(8, 'On installe ?', 'Voici ce que je vais faire. Ça peut prendre plusieurs minutes selon ta connexion : ne ferme pas Clipia.',
          `<ul class="v6-recap"><li>🧠 Cerveau rapide Groq : <b>${plan.groq ? 'prêt' : 'non configuré'}</b>${plan.claude ? ' · Claude (secours) : <b>prêt</b>' : ''}</li>
           <li>🔌 Connexions : <b>${plan.cnx.size ? [...plan.cnx].join(', ') : 'aucune pour l\'instant'}</b></li>
           <li>⬇ Modèles locaux : <b>${plan.modeles.size ? [...plan.modeles].join(', ') : 'aucun'}</b>${E.ollama.installe ? '' : ' (et Ollama)'}</li>
           <li>🤖 Sous-agents : <b>${plan.agents.size ? e6.agentsDepart.filter(a => plan.agents.has(a.id)).map(a => a.nom).join(', ') : 'aucun'}</b></li>
           <li>🔓 Accès : <b>${nbCaps} sur ${e6.capacites.length}</b></li><li>🧩 Compétences OpenClaw : <b>${plan.ocAll ? "toutes (compatibles)" : plan.skills.size}</b></li>${plan.tel ? "<li>📱 Téléphone + MCP : <b>activé</b></li>" : ""}</ul>`,
          { suivant: 'Installer maintenant', onSuivant: null, voix: 'On y va ? Voici le récapitulatif. Clique sur Installer maintenant.' });
        $('#v6-suiv', cadre).onclick = () => { installer(); };
      },
      /* 7 — fin */
      () => {
        n = 9; entete(9);
        cadre.innerHTML = `<div class="v6-accueil"><h1 id="v6-l1"></h1><p id="v6-l2"></p><button class="btn or v6-gros" id="v6-go" style="opacity:0">Choisir mon style →</button></div>`;
        const L1 = 'Je suis prête pour toi.', L2 = 'Comment veux-tu que je te parle ?';
        dire(L1 + ' ' + L2);
        (async () => { for (const [id, t, vit] of [['#v6-l1', L1, 50], ['#v6-l2', L2, 40]]) { const e = $(id, cadre); if (!e) return; for (const c of t) { if (!e?.isConnected) return; e.textContent += c; await attendre(vit); } } const g = $('#v6-go', cadre); if (g) g.style.opacity = 1; })();
        $('#v6-go', cadre).onclick = () => { try { coupe?.(); } catch {} choixStyle(); };
      }
    ];

    /* — délégués des écrans à champ actif — */
    cadre.addEventListener('click', async ev => {
      const t = ev.target;
      if (t.id === 'v6-tout' || t.id === 'v6-rien') cadre.querySelectorAll('[data-c]').forEach(i => i.checked = t.id === 'v6-tout');
      if (t.id === 'v6-cb') {
        const valeur = $('#v6-ck', cadre).value.trim(), m = $('#v6-cm', cadre); m.textContent = 'Test de la clé…';
        try {
          const r = await api('/api/coffre/tester', { method: 'POST', body: JSON.stringify({ fournisseur: 'anthropic', valeur }) });
          if (!r.ok) { m.textContent = '⚠ ' + r.message; return; }
          await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: 'provider:anthropic', valeur }) });
          plan.claude = true; $('#v6-ck', cadre).value = ''; m.textContent = '✓ ' + r.message;
        } catch (err) { m.textContent = '⚠ ' + err.message; }
      }
      if (t.dataset?.cnb) {
        const id = t.dataset.cnb, m = cadre.querySelector(`[data-cm="${id}"]`);
        const valeurs = Object.fromEntries([...cadre.querySelectorAll(`input[data-cn="${id}"]`)].map(i => [i.dataset.k, i.value]));
        if (!Object.values(valeurs).some(v => v.trim())) { m.textContent = 'Remplis le champ avant d\'enregistrer.'; return; }
        try {
          await api('/api/v61/connexions/enregistrer', { method: 'POST', headers: { 'x-clipia-accord': '1' }, body: JSON.stringify({ id, valeurs }) });
          const r = await api('/api/v61/connexions/tester', { method: 'POST', body: JSON.stringify({ id }) });
          m.textContent = (r.ok ? '✓ ' : '⚠ ') + r.message; if (r.ok) plan.cnx.add(id);
          cadre.querySelectorAll(`input[data-cn="${id}"]`).forEach(i => i.value = '');
        } catch (err) { m.textContent = '⚠ ' + err.message; }
      }
      if (t.id === 'v6-gb') {
        const valeur = $('#v6-gk', cadre).value.trim(), m = $('#v6-gm', cadre); m.textContent = 'Test de la clé…';
        try {
          const r = await api('/api/coffre/tester', { method: 'POST', body: JSON.stringify({ fournisseur: 'groq', valeur }) });
          if (!r.ok) { m.textContent = '⚠ ' + r.message; return; }
          await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: 'provider:groq', valeur }) });
          plan.groq = true; $('#v6-gk', cadre).value = ''; m.textContent = '✓ ' + r.message;
        } catch (err) { m.textContent = '⚠ ' + err.message; }
      }
    });

    /* — l'installation proprement dite — */
    async function installer() {
      n = 8.5; entete(8);
      const taches = [];
      if (plan.modeles.size && !E.ollama.installe) taches.push({ id: 'ollama', t: 'Installer Ollama (le moteur local)' });
      for (const m of plan.modeles) taches.push({ id: 'm:' + m, t: `Télécharger ${m}`, modele: m });
      taches.push({ id: 'acces', t: 'Enregistrer mes accès' });
      if (plan.agents.size) taches.push({ id: 'agents', t: 'Créer mes sous-agents' });
      if (plan.skills.size || plan.ocAll) taches.push({ id: 'skills', t: 'Importer les compétences OpenClaw' });
      if (plan.tel) taches.push({ id: 'tel', t: 'Activer le téléphone + MCP' });
      taches.push({ id: 'cerveau', t: 'Choisir le meilleur cerveau et l\'essayer' });
      cadre.innerHTML = `<div class="v6-ecran"><h1>Installation en cours…</h1><p class="v6-sous">Je m'occupe de tout, une chose après l'autre.</p>
        <div class="v6-taches">${taches.map(k => `<div class="v6-tache" data-t="${esc(k.id)}"><span class="v6-ic">○</span><div><b>${esc(k.t)}</b><div class="v5-piste" style="display:none"><i></i></div><small></small></div></div>`).join('')}</div>
        <div class="v6-nav"><span></span><button class="btn or v6-gros" id="v6-fin" disabled>Terminer →</button></div></div>`;
      const ligne = id => cadre.querySelector(`[data-t="${CSS.escape(id)}"]`);
      const etat = (id, ic, txt, pct) => { const l = ligne(id); l.querySelector('.v6-ic').textContent = ic; l.querySelector('small').textContent = txt || '';
        const p = l.querySelector('.v5-piste'); if (pct != null) { p.style.display = ''; p.firstChild.style.width = pct + '%'; } else if (ic !== '⏳') p.style.display = 'none'; };
      const faire = async (id, fn) => { etat(id, '⏳', 'En cours…'); try { const r = await fn(); etat(id, '✓', typeof r === 'string' ? r : 'Terminé', null); return true; } catch (err) { etat(id, '⚠', err.message || String(err), null); return false; } };

      for (const k of taches) {
        if (k.id === 'ollama') await faire(k.id, async () => {
          const fin = await flux('/api/ollama/installer', {}, ev => { if (ev.erreur) throw new Error(ev.erreur); if (ev.etape === 'telechargement') etat(k.id, '⏳', ev.total ? `${octets(ev.recu)} / ${octets(ev.total)}` : 'Téléchargement…', ev.pct); else if (ev.etape === 'installation') etat(k.id, '⏳', 'Installation… accepte la fenêtre Windows si elle apparaît.', 100); });
          if (fin?.erreur) throw new Error(fin.erreur);
          for (let i = 0; i < 40; i++) { const o = await api('/api/ollama'); if (o.actif) return 'Ollama est prêt'; if (o.installe) { try { await api('/api/ollama/demarrer', { method: 'POST' }); } catch {} } await attendre(3000); }
          throw new Error('Ollama ne répond pas encore. Termine son installation, puis relance l\'assistant (menu « Cerveau pas à pas »).');
        });
        else if (k.modele) await faire(k.id, async () => {
          const o = await api('/api/ollama'); if (!o.actif) { try { await api('/api/ollama/demarrer', { method: 'POST' }); await attendre(2500); } catch {} }
          const fin = await flux('/api/modeles-locaux/installer', { modele: k.modele }, ev => { if (ev.erreur) throw new Error(ev.erreur); if (!ev.fini) etat(k.id, '⏳', ev.total ? `${octets(ev.recu)} / ${octets(ev.total)}` : (ev.etat || ''), ev.pct); });
          if (fin?.erreur) throw new Error(fin.erreur); return 'Installé';
        });
        else if (k.id === 'acces') await faire(k.id, async () => { await api('/api/v6/capacites', { method: 'POST', body: JSON.stringify({ capacites: plan.caps }) }); if (plan.caps.chrome) { try { await api('/api/ext/preparer', { method: 'POST' }); } catch {} } return plan.caps.chrome ? 'Enregistré. Extension Chrome préparée : voir « Installation guidée ».' : 'Enregistré'; });
        else if (k.id === 'agents') await faire(k.id, async () => { const r = await api('/api/v6/agents-depart', { method: 'POST', body: JSON.stringify({ ids: [...plan.agents] }) }); return `${r.faits.length} créé(s)${r.deja.length ? ', ' + r.deja.length + ' déjà présent(s)' : ''}`; });
        else if (k.id === 'skills') await faire(k.id, async () => { const r = plan.ocAll ? await fetch(API + '/api/openclaw/importer', { method: 'POST', headers: { 'content-type': 'application/json', 'x-clipia-accord': '1' }, body: '{}' }).then(x => x.json()) : await api('/api/v6/openclaw/importer', { method: 'POST', body: JSON.stringify({ ids: [...plan.skills] }) }); return r.importees + ' importée(s)'; });
        else if (k.id === 'tel') await faire(k.id, async () => { await fetch(API + '/api/acces-distant', { method: 'POST', headers: { 'content-type': 'application/json', 'x-clipia-accord': '1' }, body: JSON.stringify({ actif: true }) }); return 'Activé — menu « Téléphone & MCP » pour le QR code'; });
        else if (k.id === 'cerveau') await faire(k.id, async () => {
          await api('/api/v5/cerveau/reevaluer', { method: 'POST' });
          const r = await api('/api/v5/cerveau/essai', { method: 'POST' });
          if (!r.ok) throw new Error('Aucun cerveau ne répond encore. Reprends « Cerveau pas à pas » (menu à gauche). ' + (r.message || '').slice(0, 120));
          return `${r.moteur} répond en ${r.ms} ms`;
        });
      }
      const f = $('#v6-fin', cadre); f.disabled = false; f.onclick = () => aller(9);
    }

    /* — fenêtre « Comment veux-tu que nous discutions ? » — */
    async function choixStyle() {
      const P = await api('/api/noyau/personnalite');
      const fen = el(`<div id="v6-modal"><div class="v6-fen">
        <h2>Comment veux-tu que nous discutions ?</h2>
        <p class="v4-p">Choisis le style de notre conversation. Tu pourras le changer quand tu veux dans Configuration, ou créer le tien.</p>
        <label class="champ"><span>Comment dois-je t'appeler ?</span><input id="v6-pn" maxlength="40" placeholder="Ton prénom"></label>
        <div class="v6-modes">${P.modes.map(m => `<button class="v6-mode ${m.id === plan.mode ? 'actif' : ''}" data-m="${esc(m.id)}"><span class="v6-em">${esc(m.emoji)}</span><b>${esc(m.nom)}</b><small>${esc(m.quoi)}</small></button>`).join('')}</div>
        <div class="v6-nav"><span></span><button class="btn or v6-gros" id="v6-ok">C'est parti →</button></div></div></div>`);
      ov.append(fen);
      fen.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { plan.mode = b.dataset.m; fen.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('actif', x === b)); });
      $('#v6-ok', fen).onclick = async () => {
        try {
          await api('/api/noyau/personnalite', { method: 'POST', body: JSON.stringify({ mode: plan.mode, prenom: $('#v6-pn', fen).value.trim(), configure: true }) });
          await api('/api/v6/termine', { method: 'POST' });
        } catch (err) { toast(err.message, 'err'); return; }
        sessionStorage.setItem('clipia:v4-q', '1'); fermer();
        window.dispatchEvent(new Event('clipia:profil'));
        location.hash = '#/clipia';
        const nom = $('#v6-pn', fen)?.value?.trim();
        setTimeout(() => dire(nom ? `Enchantée ${nom}. Je suis là. Dis-moi ce que tu veux faire.` : 'Je suis là. Dis-moi ce que tu veux faire.'), 400);
      };
    }

    aller(0);
  }
  window.addEventListener('clipia:assistant', ouvrirAssistant);
}
