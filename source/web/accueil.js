/* CLIPIA X8 — Accueil « vitrine », « Sauvegarder mon IA », « Créer mon chanteur / ma chanteuse », « Publier partout ». */
export function installerAccueil({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  const go = h => { location.hash = h; };
  const taille = o => o > 1e9 ? (o / 1e9).toFixed(2) + ' Go' : o > 1e6 ? (o / 1e6).toFixed(1) + ' Mo' : Math.max(1, Math.round(o / 1e3)) + ' Ko';
  const amorcer = texte => { try { sessionStorage.setItem('clipia:amorce', texte); } catch {} go('#/clipia?n=' + Date.now()); };
  document.head.append(el(`<style>
  .vt{max-width:1040px;margin:26px auto 0;width:100%}.vt h2{text-align:center;margin:0 0 4px;font-size:20px}.vt .sous{text-align:center;opacity:.7;font-size:13px;margin:0 0 16px}
  .vt .gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
  .vt .tuile{background:#ffffff0d;border:1px solid #ffffff22;border-radius:16px;padding:15px;display:flex;flex-direction:column;gap:7px;text-align:left}
  .vt .tuile.vedette{border-color:#f5c542aa;background:linear-gradient(140deg,#f5c54218,#ffffff08)}
  .vt .tuile b{font-size:15px}.vt .tuile p{margin:0;font-size:12.8px;opacity:.8}.vt details{font-size:12.5px;opacity:.9}.vt summary{cursor:pointer;color:var(--or-clair,#f5d98a)}
  .vt details ol{margin:6px 0 0;padding-left:18px}.vt .tuile .btn{margin-top:auto;align-self:flex-start}
  .pillsauv{display:block;width:calc(100% - 20px);margin:8px 10px;border:1px solid #f5c542aa;background:linear-gradient(135deg,#2a1f55,#14102a);color:#fff;padding:10px 14px;border-radius:12px;font-size:13.5px;font-weight:600;cursor:pointer;text-align:left}
  .pillsauv:hover{background:#241b4a}
  .sv .carte,.ch .carte,.pu .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:16px;margin:12px 0}
  .sv input,.sv select,.ch input,.ch select,.ch textarea,.pu input,.pu textarea{border-radius:10px;padding:9px;border:1px solid #ffffff33;background:#0b0818;color:#fff;margin:3px 4px 3px 0}
  .ch ol{padding-left:22px}.sv .petit,.ch .petit,.pu .petit{opacity:.7;font-size:12.5px}.sv .rang,.ch .rang,.pu .rang{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .pu .pf{display:inline-flex;gap:6px;align-items:center;background:#ffffff10;border:1px solid #ffffff22;border-radius:999px;padding:6px 12px;margin:4px 6px 4px 0;cursor:pointer}
  </style>`));

  // ── bouton « Sauvegarder mon IA » visible partout ───────────────────────
  const pill = el('<button class="pillsauv" id="pillSauv" title="Sauvegarder mon IA (clé USB, Dropbox, MEGA)">💾 Sauvegarder mon IA</button>');
  pill.onclick = () => go('#/sauvegarde');
  const pill3 = el('<button class="pillsauv" id="pillMobile" style="border-color:#7fb0ffaa">📱 Clipia sur mon téléphone (QR)</button>'); pill3.onclick = () => go('#/mobile');
  const pill2 = el('<button class="pillsauv" id="pillChrome" style="border-color:#ffb27aaa">🧩 Installer l\'extension Chrome</button>'); pill2.onclick = () => go('#/chrome');
  let essais = 0; const poser = () => { const z = document.getElementById('convs'); if (z) { z.before(pill3); z.before(pill2); z.before(pill); } else if (++essais < 40) setTimeout(poser, 250); }; poser();

  // ── vitrine de l'écran d'accueil ────────────────────────────────────────
  const TUILES = [
    ['🎬', 'MP3 → clip vidéo', 'Dépose un morceau : le clip se fabrique tout seul, gratuitement, sur ton ordinateur.', ['Dépose ton MP3 / WAV (Suno compris).', 'Choisis l’ambiance et le format (vertical TikTok, horizontal YouTube).', 'Clique « Créer » : le visuel suit le rythme réel du son.', 'Récupère le fichier, puis « Publier partout ».'], '#/clip', 'Faire un clip', true],
    ['🎨', 'Clips avec Canva & autres moteurs', 'Canva, Remotion, Editly, Shotstack… choisis le moteur de ton clip, gratuit ou payant.', ['Décris le clip voulu.', 'Choisis le moteur (gratuit intégré, Canva, open source).', 'Clipia travaille, tu valides.', 'Les options payantes restent à ton accord.'], '#/moteurs', 'Choisir un moteur'],
    ['🎤', 'Créer mon chanteur / ma chanteuse', 'Un artiste virtuel à toi : nom, style, voix, paroles, visuel, puis clip. Structure gratuite.', ['Donne-lui un nom, un style et une histoire.', 'Clipia écrit sa fiche, ses paroles et les prompts du visuel.', 'Tu ajoutes le morceau (un générateur gratuit ou le tien).', 'Clip + publication, tout au même endroit.'], '#/chanteur', 'Créer mon artiste', true],
    ['📣', 'Publier partout', 'YouTube, TikTok, Instagram, Facebook, X, SoundCloud… titres, descriptions, hashtags prêts, publiés avec ton accord.', ['Choisis ta vidéo ou ton morceau et les plateformes.', 'Clipia prépare un texte adapté à chacune.', 'Elle ouvre ton navigateur déjà connecté.', 'Elle te demande « Je publie ? » avant chaque envoi.'], '#/publier', 'Publier', true],
    ['👥', 'Mon équipe d’agents', '10 agents prêts (promoteur, développeur, rédacteur…), qui travaillent en parallèle.', ['Ouvre « Projets & agents ».', 'Ajoute les agents de départ en un clic.', 'Donne une mission à l’équipe.', 'Suis le travail dans les travaux en arrière-plan.'], '#/atelier', 'Voir l’équipe'],
    ['🛒', 'Lancer mon business en ligne', 'Idée, offre, site de vente, premiers clients, contenus : une mission par étape.', ['Décris ton idée en deux phrases.', 'Lance « Plan complet » puis « Site vitrine ».', 'Valide l’offre et les prix.', 'Clipia prépare les 30 premiers contacts (rien n’est envoyé sans toi).'], '#/entreprise', 'Démarrer'],
    ['🏢', 'Créer ma société', 'Choix du statut, démarches officielles, modèle de facture. Vérifié sur les sources officielles.', ['Décris ton activité.', 'Lance « Démarches et documents (France) ».', 'Suis la checklist officielle.', 'Les formulaires et paiements restent à ta main.'], '#/entreprise', 'Préparer'],
    ['⏰', 'Mes routines', '« Chaque matin à 8 h, fais ma veille » : Clipia travaille en arrière-plan.', ['Écris ce qu’elle doit faire.', 'Choisis l’heure.', 'Elle te prévient si elle a besoin de ton accord.'], '#/planning', 'Programmer'],
    ['✉️', 'Piloter depuis mon téléphone', 'Parle à Clipia par Telegram, Slack ou WhatsApp, même loin de ton ordinateur.', ['Ouvre « Pilotage à distance ».', 'Crée ton bot (étapes guidées).', 'Colle ta clé ici toi-même.', 'Autorise ton compte : lui seul pourra commander.'], '#/messagerie', 'Brancher'],
    ['🧑‍💻', 'Coder dans Visual Studio', 'Clipia code, tu relis et modifies dans Visual Studio Code : tes projets s’ouvrent en un clic.', ['Installe Visual Studio Code (Logithèque, un clic).', 'Demande un site ou une app à Clipia.', 'Clique « Ouvrir dans VS Code » : le dossier du projet s’ouvre.', 'Visual Studio Community (Windows) est aussi dans la Logithèque.'], '#/vscode', 'Ouvrir dans VS Code'],
    ['💾', 'Sauvegarder mon IA', 'Tout Clipia dans un fichier : clé USB, Dropbox, MEGA. Réimport complet, sans jamais la perdre.', ['Choisis la destination.', 'Mets un mot de passe (pour inclure tes clés).', 'Clique « Sauvegarder maintenant ».', 'Sur un autre ordinateur : « Restaurer ».'], '#/sauvegarde', 'Sauvegarder', true]
  ];
  window.__vitrineAccueil = () => {
    const n = el(`<section class="vt"><div id="vt-init"></div><div class="tuile vedette" style="margin:0 0 18px;flex-direction:row;align-items:center;gap:16px;flex-wrap:wrap;border-color:#ff9ad5"><div style="flex:1;min-width:240px"><b style="font-size:18px">🎵 TikTok Project</b><p>Clipia t'aide à bâtir ta stratégie TikTok : niche, plan de 30 jours, scripts, et la marche à suivre pour passer de tes premières vues à des revenus. Elle propose, tu décides.</p></div><button class="btn or" data-v="#/tiktok">Lancer TikTok Project</button></div><div class="tuile vedette" style="margin:0 0 18px;flex-direction:row;align-items:center;gap:16px;flex-wrap:wrap;border-color:#ff6b6b"><div style="flex:1;min-width:240px"><b style="font-size:18px">▶️ YouTube Project</b><p>Du contenu à la publication sur ta chaîne : stratégie, titres, miniatures, description, clip, montage, puis publication avec ton accord.</p></div><button class="btn or" data-v="#/youtube">Lancer YouTube Project</button></div><div class="tuile vedette" id="vt-chrome" style="margin:0 0 18px;flex-direction:row;align-items:center;gap:16px;flex-wrap:wrap;border-color:#ffb27a"><div style="flex:1;min-width:240px"><b style="font-size:17px">🧩 Important : donne-lui les mains — extension Chrome</b><p id="vt-chrome-st">Pour que Clipia prenne la main sur ton navigateur (publier, remplir des formulaires, ouvrir des sites) comme Claude le fait pour toi. Installation en 5 étapes, avec ton accord à chaque session.</p></div><button class="btn or" data-v="#/chrome">Installer l'extension</button></div><div class="tuile vedette" style="margin:0 0 18px;flex-direction:row;align-items:center;gap:16px;flex-wrap:wrap;border-color:#7fb0ff"><div style="flex:1;min-width:240px"><b style="font-size:17px">📱 Clipia sur ton téléphone (iPhone & Android)</b><p>Scanne un QR code : la même Clipia, avec la sphère 3D animée, sur ton téléphone, et le pilotage de ton ordinateur à distance.</p></div><button class="btn or" data-v="#/mobile">Afficher le QR code</button></div><h2>Tout ce que Clipia peut faire pour toi</h2><p class="sous">Touche une carte : chacune est expliquée de A à Z, et rien ne part sans ton accord.</p>
      <div class="gr">${TUILES.map((t, i) => `<div class="tuile${t[6] ? ' vedette' : ''}"><b>${t[0]} ${esc(t[1])}</b><p>${esc(t[2])}</p>
        <details><summary>Comment ça marche</summary><ol>${t[3].map(x => `<li>${esc(x)}</li>`).join('')}</ol></details>
        <button class="btn ${t[6] ? 'or' : ''}" data-v="${t[4]}">${esc(t[5])}</button></div>`).join('')}</div></section>`);
    n.querySelectorAll('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
    api('/api/initiatives').then(r => { const z = n.querySelector('#vt-init'); if (!z || !r.initiatives?.length) return;
      z.innerHTML = `<div class="tuile" style="margin:0 0 18px;border-color:#43e6a8aa"><b style="font-size:16px">✨ Ce que je te propose</b>` + r.initiatives.map((i, k) => `<div class="rang" style="justify-content:space-between;border-top:1px solid #ffffff14;padding:8px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div style="flex:1;min-width:220px"><b style="font-size:14px">${esc(i.titre)}</b><p>${esc(i.pourquoi)}</p></div><button class="btn mini" data-k="${k}">${i.action.type === 'chat' ? 'Je m\'en occupe' : 'Ouvrir'}</button></div>`).join('') + `</div>`;
      z.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const a = r.initiatives[+b.dataset.k].action; if (a.type === 'chat') amorcer(a.texte); else go(a.cible); });
    }).catch(() => {});
    api('/api/ext/etat').then(e => { const z = n.querySelector('#vt-chrome-st'); if (z && e.connectee) { z.textContent = '✅ Extension connectée : Clipia peut piloter ton Chrome (avec ton accord à chaque session).'; n.querySelector('#vt-chrome').style.borderColor = '#4fe0b0'; } }).catch(() => {});
    return n;
  };

  // ── Sauvegarder mon IA ──────────────────────────────────────────────────
  VUES.sauvegarde = async v => {
    v.className = 'sv';
    const e = await api('/api/sauvegarde');
    if (!v.isConnected) return;
    v.innerHTML = `<h1>💾 Sauvegarder mon IA</h1>
      <p>Un seul fichier <code>.clipiabak</code> contient <b>ta Clipia entière</b> : conversations, mémoire, projets, médias, réglages, compétences. Tu peux le ranger sur une <b>clé USB</b>, dans <b>Dropbox</b> ou <b>MEGA</b>, et la <b>réimporter</b> sur n'importe quel ordinateur pour retrouver Clipia comme tu l'as laissée.</p>
      ${e.enAttente ? '<div class="carte" style="border-color:#f5c542"><b>Une restauration est prête.</b> Elle sera appliquée au prochain démarrage. <button class="btn or" id="sv-redem">Redémarrer maintenant</button> <button class="btn mini" id="sv-annul">Annuler</button></div>' : ''}
      <div class="carte"><h2 style="margin-top:0">1 · Sauvegarder maintenant</h2>
        <div class="rang"><select id="sv-d"><option value="local">Sur cet ordinateur (puis téléchargeable)</option>
          ${e.destinations.map((d, i) => `<option value="d${i}">${d.type === 'usb' ? '🔌' : '☁️'} ${esc(d.nom)} — ${esc(d.chemin)}</option>`).join('')}
          ${e.dropbox ? '<option value="dropbox">☁️ Dropbox (envoi direct)</option>' : ''}<option value="autre">📁 Autre dossier (chemin à saisir)…</option></select>
          <input id="sv-autre" placeholder="Ex. E:\\ ou /media/moi/CLE" style="display:none;min-width:260px"></div>
        <div class="rang"><input id="sv-mdp" type="password" placeholder="Mot de passe de sauvegarde (recommandé)" autocomplete="new-password" style="min-width:300px"></div>
        <p class="petit">Avec un mot de passe, le fichier est <b>chiffré</b> et contient aussi tes clés et ton coffre — indispensable pour retrouver tout à l'identique sur un autre ordinateur. Sans mot de passe, les clés ne sont pas incluses. <b>Ce mot de passe ne peut pas être retrouvé</b> : note-le.</p>
        <button class="btn or" id="sv-go">💾 Sauvegarder maintenant</button> <span id="sv-res" class="petit"></span>
        <p class="petit">${e.derniere ? 'Dernière sauvegarde : ' + new Date(e.derniere.quand).toLocaleString('fr-FR') + ' (' + taille(e.derniere.octets) + (e.derniere.chiffre ? ', chiffrée' : '') + ')' : 'Aucune sauvegarde pour l\'instant.'}</p></div>
      <div class="carte"><h2 style="margin-top:0">2 · Restaurer / réimporter</h2>
        <div class="rang"><select id="sv-src"><option value="local">Sauvegardes sur cet ordinateur</option>${e.destinations.map((d, i) => `<option value="d${i}">${esc(d.nom)}</option>`).join('')}${e.dropbox ? '<option value="dropbox">Dropbox</option>' : ''}</select>
          <button class="btn mini" id="sv-lister">Voir les sauvegardes</button></div>
        <div id="sv-liste" class="petit"></div>
        <div class="rang" style="margin-top:8px"><label class="btn mini" style="cursor:pointer">📂 Choisir un fichier .clipiabak sur cet ordinateur<input type="file" id="sv-fic" accept=".clipiabak" hidden></label>
          <input id="sv-mdp2" type="password" placeholder="Mot de passe de la sauvegarde" autocomplete="off"></div>
        <p class="petit">Rien n'est effacé : le contenu actuel est mis de côté dans un dossier « avant-restauration », puis la sauvegarde est appliquée au redémarrage.</p></div>
      <div class="carte"><h2 style="margin-top:0">3 · Automatique</h2>
        <label><input type="checkbox" id="sv-auto" ${e.auto?.actif ? 'checked' : ''}> Une sauvegarde par jour (les 7 dernières sont gardées) dans le dossier choisi en 1.</label>
        <p class="petit">Clipia doit être ouverte. Pour une sauvegarde automatique chiffrée, enregistre d'abord ton mot de passe : <input id="sv-mdpauto" type="password" placeholder="Mot de passe automatique" autocomplete="new-password"> <button class="btn mini" id="sv-mdpok">Enregistrer</button></p></div>
      <div class="carte"><h2 style="margin-top:0">Comment brancher chaque destination</h2>
        <details><summary>🔌 Clé USB</summary><p class="petit">Branche la clé, recharge cette page : elle apparaît dans la liste (🔌). Choisis-la et sauvegarde. Garde la clé hors de l'ordinateur ensuite.</p></details>
        <details><summary>☁️ MEGA</summary><p class="petit">MEGA n'a pas d'accès direct simple pour les applications tierces. Installe l'application MEGA (mega.io), connecte ton compte, puis choisis le dossier « MEGA » dans la liste : l'application envoie le fichier dans ton compte toute seule.</p></details>
        <details><summary>☁️ Dropbox — dossier synchronisé</summary><p class="petit">Installe Dropbox, connecte ton compte : le dossier « Dropbox » apparaît dans la liste. C'est la méthode la plus simple et sans limite de taille.</p></details>
        <details><summary>☁️ Dropbox — envoi direct (jusqu'à 140 Mo)</summary><p class="petit">1. Sur dropbox.com/developers/apps, crée une app (« Scoped access », « App folder ») avec les droits files.content.write et files.content.read. 2. Génère un jeton d'accès. 3. Colle-le ici toi-même (il reste chiffré sur ton ordinateur, je ne le vois jamais) :</p>
          <div class="rang"><input id="sv-tok" type="password" placeholder="Jeton Dropbox" autocomplete="off" style="min-width:300px"><button class="btn mini" id="sv-tokok">Enregistrer</button></div></details></div>`;
    const dest = id => id === 'local' ? { destination: 'local' } : id === 'dropbox' ? { destination: 'dropbox' } : id === 'autre' ? { destination: 'dossier', dossier: $('#sv-autre').value.trim() } : { destination: e.destinations[+id.slice(1)].type === 'usb' ? 'usb' : 'dossier', dossier: e.destinations[+id.slice(1)].chemin };
    $('#sv-d').onchange = () => { $('#sv-autre').style.display = $('#sv-d').value === 'autre' ? '' : 'none'; };
    $('#sv-go').onclick = async () => {
      $('#sv-res').textContent = 'Sauvegarde en cours… (peut prendre quelques minutes)';
      try {
        const r = await api('/api/sauvegarde/creer', { method: 'POST', headers: H, body: JSON.stringify({ ...dest($('#sv-d').value), motdepasse: $('#sv-mdp').value }) });
        $('#sv-res').innerHTML = `✅ ${esc(r.nom)} · ${taille(r.octets)} · ${r.fichiers} fichiers${r.dropbox ? ' · envoyée à Dropbox' : ' · dans ' + esc(r.dossier)}${r.destination === 'local' ? ` · <a href="${API}/api/sauvegarde/telecharger/${encodeURIComponent(r.nom)}" style="color:#f5d98a">Télécharger</a>` : ''}`;
        toast('Sauvegarde terminée', 'ok');
      } catch (x) { $('#sv-res').textContent = '⚠ ' + x.message; toast(x.message, 'err'); }
    };
    const restaurer = async (corps, fic) => {
      const mdp = $('#sv-mdp2').value;
      if (!confirm('Restaurer cette sauvegarde ? Ton contenu actuel est mis de côté (rien n\'est supprimé) et remplacé au redémarrage.')) return;
      try {
        const r = fic
          ? await fetch(API + '/api/sauvegarde/importer', { method: 'POST', headers: { 'x-clipia-accord': '1', 'x-mot-de-passe': encodeURIComponent(mdp) }, body: fic }).then(async x => { const j = await x.json(); if (!x.ok) throw Object.assign(new Error(j.erreur), j); return j; })
          : await api('/api/sauvegarde/restaurer', { method: 'POST', headers: H, body: JSON.stringify({ ...corps, motdepasse: mdp }) });
        toast('Sauvegarde vérifiée : prête à être appliquée', 'ok'); VUES.sauvegarde(Object.assign(v, { innerHTML: '' }));
      } catch (x) { toast(x.message, 'err'); if (x.motdepasse) $('#sv-mdp2').focus(); }
    };
    $('#sv-lister').onclick = async () => {
      const id = $('#sv-src').value, d = id === 'local' ? { destination: 'local' } : id === 'dropbox' ? { destination: 'dropbox' } : { destination: 'dossier', dossier: e.destinations[+id.slice(1)].chemin };
      try {
        const r = await api('/api/sauvegarde/liste', { method: 'POST', headers: H, body: JSON.stringify(d) });
        $('#sv-liste').innerHTML = r.sauvegardes.length ? r.sauvegardes.map((s, i) => `<div class="rang" style="justify-content:space-between;border-top:1px solid #ffffff14;padding:6px 0"><span>${esc(s.nom)} · ${taille(s.octets)} · ${new Date(s.quand).toLocaleString('fr-FR')}</span><button class="btn mini or" data-r="${i}">Restaurer</button></div>`).join('') : 'Aucune sauvegarde trouvée ici.';
        $('#sv-liste').querySelectorAll('[data-r]').forEach(b => b.onclick = () => restaurer({ ...d, nom: r.sauvegardes[+b.dataset.r].nom }));
      } catch (x) { toast(x.message, 'err'); }
    };
    $('#sv-fic').onchange = ev => { const f = ev.target.files[0]; if (f) restaurer(null, f); };
    $('#sv-auto').onchange = async () => { try { await api('/api/sauvegarde/auto', { method: 'POST', headers: H, body: JSON.stringify({ actif: $('#sv-auto').checked, dossier: dest($('#sv-d').value).dossier || null, motdepasse: Boolean($('#sv-mdpauto').value) }) }); toast('Réglage enregistré', 'ok'); } catch (x) { toast(x.message, 'err'); } };
    const coffre = (id, champ, label) => async () => { const val = $(champ).value; if (!val) return; try { await api('/api/coffre', { method: 'POST', headers: H, body: JSON.stringify({ id, valeur: val, label }) }); $(champ).value = ''; toast('Enregistré dans le coffre', 'ok'); } catch (x) { toast(x.message, 'err'); } };
    $('#sv-tokok').onclick = coffre('sauvegarde:dropbox', '#sv-tok', 'Jeton Dropbox (sauvegardes)');
    $('#sv-mdpok').onclick = coffre('sauvegarde:motdepasse', '#sv-mdpauto', 'Mot de passe des sauvegardes automatiques');
    $('#sv-redem')?.addEventListener('click', async () => { await api('/api/sauvegarde/redemarrer', { method: 'POST', headers: H, body: '{}' }); v.innerHTML = '<h1>Clipia se ferme…</h1><p>Rouvre Clipia : ta sauvegarde est appliquée au démarrage.</p>'; });
    $('#sv-annul')?.addEventListener('click', async () => { await api('/api/sauvegarde/annuler', { method: 'POST', headers: H, body: '{}' }); VUES.sauvegarde(Object.assign(v, { innerHTML: '' })); });
  };


  // ── Moteurs de clip : Canva et alternatives ─────────────────────────────
  const MOTEURS = [
    ['🎬', 'Clipia (intégré)', 'Gratuit · local', 'Clip calculé à partir du son : spectre, forme d’onde, rythme. Aucun compte, aucune clé, hors ligne.', null, '#/clip', 'Ouvrir Audio → Vidéo'],
    ['🎨', 'Canva', 'Gratuit ou Pro · ton compte', 'Modèles de vidéos, animations, sous-titres, bibliothèque. Clipia travaille dans TON Canva ouvert dans Chrome : elle choisit un modèle, colle le texte et tes médias, exporte en MP4. Tu restes connecté toi-même, elle ne tape jamais ton mot de passe. (Canva propose aussi une API « Connect » — remplissage de modèles de marque, réservé aux offres Pro/Teams/Entreprise — et un serveur MCP officiel : à brancher dans « Outils MCP » si ton offre le permet.)',
      t => `Mission : crée un clip dans Canva avec mon morceau/mon texte : « ${t} ». Étapes : 1) demande-moi l'autorisation de contrôler le navigateur ; 2) ouvre canva.com (je suis déjà connecté, sinon dis-le-moi et attends) ; 3) choisis un modèle de vidéo adapté au format voulu ; 4) importe mes fichiers (demande-moi leur chemin), place le texte ; 5) montre-moi le résultat et demande mon accord ; 6) exporte en MP4 puis dis-moi où est le fichier. Aucun achat, aucun abonnement, aucun mot de passe tapé par toi.`, null, 'Créer avec Canva'],
    ['⚛️', 'Remotion', 'Open source · licence spéciale', 'Des vidéos « programmées » en React : titres animés, paroles synchronisées, visualiseurs musicaux sur mesure. Gratuit pour les particuliers et petites équipes (licence à lire pour un usage en entreprise). Clipia écrit le projet et fait le rendu.',
      t => `Mission : installe Remotion (npm create video, demande-moi d'abord l'accord pour toute installation) et crée un clip vidéo pour : « ${t} ». Rends-le en MP4 avec ffmpeg et dis-moi où est le fichier. Rappelle-moi la licence de Remotion.`, null, 'Créer avec Remotion'],
    ['🧩', 'Revideo / Motion Canvas', 'Open source (MIT)', 'Animations vectorielles en TypeScript, très précises, idéales pour explications et lyric videos.',
      t => `Mission : avec Revideo ou Motion Canvas (choisis le plus simple, demande-moi l'accord avant d'installer), crée un clip animé pour : « ${t} », rends-le en MP4 et dis-moi où il est.`, null, 'Créer'],
    ['🎞', 'Editly', 'Open source (MIT)', 'Assemble photos, vidéos, titres et transitions depuis un simple fichier de description, avec ffmpeg. Léger et rapide.',
      t => `Mission : avec Editly (demande-moi l'accord avant d'installer), assemble un montage pour : « ${t} » à partir des médias que je te donnerai, rends-le en MP4.`, null, 'Assembler'],
    ['✂️', 'Kdenlive · Shotcut · OpenShot', 'Open source (GPL)', 'Vrais logiciels de montage pour finir à la main. Clipia peut les installer (Logithèque) et préparer ton projet.', null, '#/logitheque', 'Ouvrir la Logithèque'],
    ['☁️', 'Shotstack · Creatomate', 'Payant (API) · ta clé', 'Montage vidéo dans le cloud, très automatisable (modèles, voix, sous-titres). Tu ouvres le compte et tu colles ta clé toi-même dans le coffre : Clipia ne crée aucun compte et ne dépense rien sans ton accord.', null, '#/coffre', 'Ajouter ma clé']
  ];
  VUES.moteurs = async v => {
    v.className = 'ch';
    v.innerHTML = `<h1>🎞 Moteurs de clip : Canva et autres</h1>
      <p>Plusieurs façons de fabriquer un clip. Commence par le gratuit intégré ; passe à Canva ou à un moteur open source quand tu veux plus de style. Les options payantes ne sont jamais activées sans ton accord.</p>
      <div class="carte"><b>Ce que tu veux créer</b><textarea id="mo-t" rows="2" style="width:100%" placeholder="Ex. : clip vertical de 30 s pour ma chanson « La Roue Tourne », ambiance rétro-néon"></textarea></div>
      ${MOTEURS.map((m, i) => `<div class="carte"><div class="rang" style="justify-content:space-between"><b>${m[0]} ${esc(m[1])}</b><span class="petit">${esc(m[2])}</span></div><p class="petit" style="opacity:.85">${esc(m[3])}</p>
        <button class="btn ${i < 2 ? 'or' : ''}" data-i="${i}">${esc(m[6] || m[5])}</button></div>`).join('')}
      <p class="petit">Licences et offres changent : vérifie les conditions de chaque outil avant un usage commercial.</p>`;
    v.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const m = MOTEURS[+b.dataset.i];
      if (m[5]) return go(m[5]);
      const t = $('#mo-t').value.trim(); if (t.length < 6) return toast('Décris d’abord le clip voulu.', 'err');
      amorcer(m[4](t));
    });
  };

  window.__vsc = true;
  VUES.vscode = async v => {
    v.className = 'ch';
    v.innerHTML = `<h1>🧑‍💻 Visual Studio Code</h1><p>Clipia crée le code dans ses projets ; tu peux les ouvrir dans <b>Visual Studio Code</b> pour les relire, les modifier ou les lancer. Rien n'est ouvert sans ton clic.</p>
      <div class="carte"><button class="btn or" id="vs-go">Ouvrir mes projets Clipia dans VS Code</button> <button class="btn" id="vs-inst">Installer Visual Studio Code / Visual Studio</button><p class="petit" id="vs-r"></p></div>`;
    $('#vs-inst').onclick = () => go('#/logitheque');
    $('#vs-go').onclick = async () => { try { const r = await api('/api/vscode/ouvrir', { method: 'POST', headers: H, body: '{}' }); $('#vs-r').textContent = '✅ Ouvert : ' + r.dossier; } catch (x) { $('#vs-r').textContent = '⚠ ' + x.message; } };
  };

  // ── YouTube Project ─────────────────────────────────────────────────────
  VUES.youtube = async v => {
    v.className = 'ch';
    const MIS = [
      ['🔎', 'Chaîne : niche, angle, promesse', 'Étude de 5 chaînes comparables, 3 positionnements, UN recommandé.', p => `Suis la compétence integree-youtube-strategie (étapes 2 et 3) : étudie 5 chaînes comparables et propose 3 positionnements, recommande-en un. Profil : ${p}`, true],
      ['📅', 'Plan de 30 jours', 'Vidéos longues + Shorts, piliers, série, titres, miniatures, descriptions.', p => `Suis la compétence integree-youtube-strategie (étape 4) : plan de 30 jours complet enregistré dans le projet « YouTube ». Profil : ${p}`, false],
      ['🖼', 'Titres, miniatures et description (visibilité)', '3 titres, idée de miniature, description à mots-clés, chapitres, hashtags — pour une vidéo précise.', p => `Suis la compétence integree-youtube-strategie : pour ma prochaine vidéo, écris 3 titres, l'idée de miniature, la description avec mots-clés et chapitres, et les hashtags. Profil : ${p}`, false],
      ['💶', 'Mon plan de revenus par paliers', 'Programme Partenaire, affiliation, produits à toi : plan de 14 jours.', p => `Suis la compétence integree-youtube-monetisation : situe ma chaîne, dis le prochain palier et propose un plan de 14 jours. Vérifie les conditions actuelles sur les pages officielles de YouTube (web_chercher). Profil : ${p}`, false]
    ];
    const OUT = [['💡', 'Idée & script', 'Missions ci-dessus', null], ['🎬', 'Clip depuis ton morceau', 'Audio → Vidéo (gratuit)', '#/clip'], ['🎨', 'Autres moteurs (Canva…)', 'Moteurs de clip', '#/moteurs'], ['✂️', 'Montage', 'Studio montage', '#/studio'], ['🖼', 'Miniature', 'Créer une image', '#/image'], ['📣', 'Publication sur ta chaîne', 'Publier partout (YouTube Studio, avec ton accord)', '#/publier']];
    v.innerHTML = `<h1>▶️ YouTube Project</h1>
      <p>De l'idée à la <b>publication sur ta chaîne</b> : stratégie, contenu, visibilité (titres, miniatures, description), puis publication dans ton compte YouTube — Clipia prépare, tu valides chaque envoi.</p>
      <div class="carte"><h2 style="margin-top:0">1 · Ton point de départ</h2>
        <div class="rang"><input id="yt-n" placeholder="Ton sujet / ta niche" style="min-width:300px"><input id="yt-c" placeholder="Ta chaîne (ex. @FABRICEclin)"></div>
        <div class="rang"><select id="yt-o"><option>Plus de visibilité</option><option>Promouvoir ma musique</option><option>Trouver des clients</option><option>Gagner un revenu complémentaire</option></select>
          <select id="yt-t"><option>2 h par semaine</option><option selected>5 h par semaine</option><option>10 h par semaine</option><option>Plus de 15 h par semaine</option></select>
          <input id="yt-a" type="number" placeholder="Abonnés actuels" style="width:150px"></div></div>
      <div class="carte"><h2 style="margin-top:0">2 · Ce que Clipia prépare pour toi</h2>${MIS.map((m, i) => `<div class="rang" style="justify-content:space-between;border-top:1px solid #ffffff14;padding:9px 0"><div style="flex:1;min-width:240px"><b>${m[0]} ${esc(m[1])}</b><div class="petit">${esc(m[2])}</div></div><button class="btn ${m[4] ? 'or' : ''}" data-m="${i}">Lancer</button></div>`).join('')}
        <div class="rang" style="margin-top:10px"><button class="btn" id="yt-rout">⏰ Programmer mon bilan chaque dimanche à 18 h</button></div></div>
      <div class="carte"><h2 style="margin-top:0">3 · Tous les outils, jusqu'à la publication</h2><div class="rang">${OUT.map((o, i) => `<button class="btn ${i === 5 ? 'or' : ''}" ${o[3] ? `data-go="${o[3]}"` : 'disabled'} title="${esc(o[2])}">${o[0]} ${esc(o[1])}</button>`).join('')}</div>
        <p class="petit">Pour publier : l'extension Chrome doit être installée (<a href="#/chrome" style="color:#f5d98a">l'installer</a>) et ta chaîne ouverte dans ce Chrome. Clipia remplit YouTube Studio et demande « Je publie ? » avant l'envoi final.</p></div>
      <div class="carte"><h2 style="margin-top:0">4 · Les paliers de revenus <span class="petit">(à vérifier dans YouTube Studio : ils changent)</span></h2>
        <ul style="line-height:1.8"><li><b>≈ 1 000 abonnés + 4 000 h de visionnage (12 mois)</b> ou <b>10 M de vues Shorts (90 jours)</b> : Programme Partenaire (publicités). Un palier d'entrée existe plus bas (≈ 500 abonnés).</li>
        <li><b>Sans seuil</b> : partenariats de marques, affiliation, produits à toi (musique, e-books, modèles), prestations.</li></ul>
        <p class="petit">Honnêteté : personne ne peut garantir des vues ni des revenus. Pas d'achat de vues ou d'abonnés ; musique protégée interdite sans droits ; indique le contenu généré par IA quand YouTube le demande.</p></div>`;
    const profil = () => `sujet « ${$('#yt-n').value.trim() || 'à définir avec moi'} », chaîne ${$('#yt-c').value.trim() || 'à créer'}, objectif : ${$('#yt-o').value}, temps disponible : ${$('#yt-t').value}, abonnés actuels : ${$('#yt-a').value || 'non précisé'}.`;
    v.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
      if ($('#yt-n').value.trim().length < 3) return toast('Dis-moi d\'abord ton sujet ou ta niche.', 'err');
      const m = MIS[+b.dataset.m];
      try { await api('/api/travaux/lancer', { method: 'POST', headers: H, body: JSON.stringify({ mission: m[3](profil()) + '\nRéponds en français, concret et honnête : aucune promesse de gains.', titre: 'YouTube · ' + m[1] }) }); toast('C\'est lancé en arrière-plan (suivi dans « Travaux »)', 'ok'); } catch (x) { toast(x.message, 'err'); }
    });
    v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    $('#yt-rout').onclick = async () => { try { await api('/api/planning', { method: 'POST', headers: H, body: JSON.stringify({ titre: 'Bilan YouTube de la semaine', mission: 'Suis la compétence integree-youtube-strategie : fais le bilan de ma semaine YouTube (durée de visionnage, miniatures, vidéos à refaire) et propose le plan de la semaine suivante. ' + profil(), frequence: { type: 'quotidien', heure: '18:00', jours: [7] } }) }); toast('Routine programmée : dimanche 18 h', 'ok'); } catch (x) { toast(x.message, 'err'); } };
  };

  // ── TikTok Project ──────────────────────────────────────────────────────
  VUES.tiktok = async v => {
    v.className = 'ch';
    const MIS = [
      ['🔎', 'Trouver ma niche et mon angle', 'Étude de comptes comparables, 3 positionnements, UN recommandé.', p => `Suis la compétence integree-tiktok-strategie. Étape 2 et 3 seulement : étudie sur le web 5 comptes TikTok comparables et propose 3 positionnements, recommande-en un. Profil : ${p}`, true],
      ['📅', 'Plan d\'action de 30 jours', 'Calendrier de vidéos, piliers de contenu, série récurrente, accroches.', p => `Suis la compétence integree-tiktok-strategie (étapes 3 à 5) : plan de 30 jours complet enregistré dans le projet « TikTok ». Profil : ${p}`, false],
      ['🎬', '20 accroches et scripts prêts', 'Accroche, corps en 3 temps, légende et hashtags pour chaque vidéo.', p => `Suis la compétence integree-tiktok-scripts : écris 20 idées de vidéos avec 3 accroches chacune, scripts de 15 à 45 s, légendes et hashtags. Enregistre dans le projet « TikTok ». Profil : ${p}`, false],
      ['💶', 'Mon plan de revenus par paliers', 'Prochain palier réaliste, revenus accessibles tout de suite, plan de 14 jours.', p => `Suis la compétence integree-tiktok-monetisation : situe ma situation, dis-moi le prochain palier et propose un plan de 14 jours. Vérifie les conditions actuelles sur les pages officielles de TikTok (web_chercher). Profil : ${p}`, false]
    ];
    v.innerHTML = `<h1>🎵 TikTok Project</h1>
      <p>Clipia t'aide à construire une <b>vraie stratégie</b> pour gagner des vues, puis des revenus : niche, plan d'action, scripts, et la marche à suivre pour chaque palier. Elle propose, tu décides ; rien n'est publié ni payé sans ton accord.</p>
      <div class="carte"><h2 style="margin-top:0">1 · Ton point de départ</h2>
        <div class="rang"><input id="tk-n" placeholder="Ton sujet / ta niche (ex. musique, tatouage, e-commerce…)" style="min-width:300px"><input id="tk-c" placeholder="Ton compte (ex. @moncompte)"></div>
        <div class="rang"><select id="tk-o"><option>Plus de vues</option><option>Vendre mes produits / services</option><option>Promouvoir ma musique</option><option>Gagner un revenu complémentaire</option></select>
          <select id="tk-t"><option>2 h par semaine</option><option selected>5 h par semaine</option><option>10 h par semaine</option><option>Plus de 15 h par semaine</option></select>
          <input id="tk-a" type="number" placeholder="Abonnés actuels" style="width:150px"></div></div>
      <div class="carte"><h2 style="margin-top:0">2 · Ce que Clipia prépare pour toi</h2>${MIS.map((m, i) => `<div class="rang" style="justify-content:space-between;border-top:1px solid #ffffff14;padding:9px 0"><div style="flex:1;min-width:240px"><b>${m[0]} ${esc(m[1])}</b><div class="petit">${esc(m[2])}</div></div><button class="btn ${m[4] ? 'or' : ''}" data-m="${i}">Lancer</button></div>`).join('')}
        <div class="rang" style="margin-top:10px"><button class="btn" id="tk-rout">⏰ Programmer mon bilan chaque dimanche à 18 h</button> <button class="btn" id="tk-clip">🎬 Faire un clip vertical</button> <button class="btn" id="tk-pub">📣 Publier</button></div></div>
      <div class="carte"><h2 style="margin-top:0">3 · Les paliers de revenus <span class="petit">(à vérifier dans l'application TikTok : ils changent)</span></h2>
        <ul style="line-height:1.8"><li><b>≈ 1 000 abonnés</b> : LIVE avec cadeaux, TikTok Shop (commissions sur les ventes), 18 ans et plus.</li>
        <li><b>10 000 abonnés + 100 000 vues valides sur 30 jours</b> : Creator Rewards Program (vidéos originales de plus d'une minute ; la France est éligible).</li>
        <li><b>Sans seuil officiel</b> : partenariats de marques, contenus UGC, liens d'affiliation, tes propres produits (musique, e-books, modèles Etsy).</li></ul>
        <p class="petit">Honnêteté : personne ne peut garantir des vues ni des revenus. Ce qui fonctionne : régularité, accroches fortes, contenu original, analyse hebdomadaire. N'achète jamais de vues ni d'abonnés (contre les règles, et inutile). Sources : conditions publiées par TikTok et synthèses de 2026.</p></div>`;
    const profil = () => `sujet « ${$('#tk-n').value.trim() || 'à définir avec moi'} », compte ${$('#tk-c').value.trim() || 'à créer'}, objectif : ${$('#tk-o').value}, temps disponible : ${$('#tk-t').value}, abonnés actuels : ${$('#tk-a').value || 'non précisé'}.`;
    v.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
      if ($('#tk-n').value.trim().length < 3) return toast('Dis-moi d\'abord ton sujet ou ta niche.', 'err');
      const m = MIS[+b.dataset.m];
      try { await api('/api/travaux/lancer', { method: 'POST', headers: H, body: JSON.stringify({ mission: m[3](profil()) + '\nRéponds en français, concret et honnête : aucune promesse de gains.', titre: 'TikTok · ' + m[1] }) }); toast('C\'est lancé en arrière-plan (suivi dans « Travaux »)', 'ok'); } catch (x) { toast(x.message, 'err'); }
    });
    $('#tk-rout').onclick = async () => { try { await api('/api/planning', { method: 'POST', headers: H, body: JSON.stringify({ titre: 'Bilan TikTok de la semaine', mission: 'Suis la compétence integree-tiktok-strategie : fais le bilan de ma semaine TikTok (ce qui a retenu, ce qu\'il faut refaire) et propose le plan de la semaine suivante. ' + profil(), frequence: { type: 'quotidien', heure: '18:00', jours: [7] } }) }); toast('Routine programmée : dimanche 18 h', 'ok'); } catch (x) { toast(x.message, 'err'); } };
    $('#tk-clip').onclick = () => go('#/clip'); $('#tk-pub').onclick = () => go('#/publier');
  };

  // ── Clipia sur le téléphone (QR code) ───────────────────────────────────
  const SITE_APP = 'https://fabriceclin02-glitch.github.io/clipia/app/';
  VUES.mobile = async v => {
    v.className = 'ch';
    v.innerHTML = `<h1>📱 Clipia sur ton iPhone et ton Android</h1>
      <p>Scanne un QR code avec l'appareil photo du téléphone : Clipia s'installe comme une vraie application, avec la <b>sphère 3D animée</b> qui t'écoute, réfléchit et parle, comme sur l'ordinateur. Touche la sphère pour parler ; touche-la pendant qu'elle parle pour l'interrompre.</p>
      <div class="carte" id="mo-pc"><h2 style="margin-top:0">A · Piloter mon ordinateur depuis le téléphone <span class="petit">(recommandé)</span></h2><div id="mo-pc-c"></div></div>
      <div class="carte"><h2 style="margin-top:0">B · Clipia seule sur le téléphone <span class="petit">(partout, sans l'ordinateur)</span></h2>
        <div class="rang"><img alt="QR" style="width:190px;background:#fff;border-radius:12px;padding:6px" src="${API}/api/acces-distant/qr?u=${encodeURIComponent(SITE_APP)}">
        <div><p>Scanne, puis installe-la :</p><p>• <b>Android</b> (Chrome) : menu ⋮ → « Installer l'application ».<br>• <b>iPhone</b> (Safari obligatoire) : Partager → « Sur l'écran d'accueil ».</p><p class="petit">${esc(SITE_APP)}<br>Cette version discute avec les moteurs que tu y configures ; elle ne touche pas à ton ordinateur.</p></div></div></div>
      <div class="carte"><b>À savoir</b><p class="petit">Les téléphones n'autorisent pas les programmes « .exe » : l'installation passe par ce QR code (application web installable), c'est le même principe que les applis des grands services. Le contrôle de l'ordinateur demande toujours ton accord sur le PC. Pour piloter ton PC hors de chez toi, voir « Téléphone & MCP » (Tailscale).</p></div>`;
    const zone = $('#mo-pc-c');
    const rendre = async () => {
      let e; try { e = await api('/api/acces-distant', { headers: H }); } catch (x) { if (zone.isConnected) zone.textContent = '⚠ ' + x.message; return; }
      if (!zone.isConnected) return;
      if (!e.actif) { zone.innerHTML = `<p>Active l'accès : un jeton secret est créé, rien n'est ouvert hors de ton réseau Wi-Fi.</p><button class="btn or" id="mo-on">Activer et afficher le QR code</button>`; $('#mo-on').onclick = async () => { await api('/api/acces-distant', { method: 'POST', headers: H, body: JSON.stringify({ actif: true }) }); rendre(); }; return; }
      const base = e.adresses[0]?.url || `http://${location.hostname}:${e.port}`, lien = `${base}/telephone#t=${e.jeton}`;
      zone.innerHTML = `<div class="rang"><img alt="QR" style="width:210px;background:#fff;border-radius:12px;padding:6px" src="${API}/api/acces-distant/qr?u=${encodeURIComponent(lien)}"><div><p>Téléphone et PC sur le <b>même Wi-Fi</b> : scanne ce QR code, puis :</p><p>• <b>Android</b> (Chrome) : menu ⋮ → « Installer l'application ».<br>• <b>iPhone</b> (Safari) : Partager → « Sur l'écran d'accueil ».</p><p class="petit">Ne partage jamais ce QR code : il contient ton jeton. <button class="btn mini" id="mo-off">Désactiver</button></p></div></div>`;
      $('#mo-off').onclick = async () => { await api('/api/acces-distant', { method: 'POST', headers: H, body: JSON.stringify({ actif: false }) }); rendre(); };
    };
    rendre();
  };

  // ── Extension Chrome : donner les mains à Clipia ────────────────────────
  VUES.chrome = async v => {
    v.className = 'ch';
    v.innerHTML = `<h1>🧩 Extension Chrome — les mains de Clipia</h1>
      <p>Avec cette extension, Clipia peut <b>prendre la main sur ton navigateur Chrome</b> (tes onglets, tes comptes déjà connectés) : ouvrir des pages, remplir des formulaires, publier, comme je le fais pour toi. Pour le reste de l'ordinateur (fenêtres, clavier, souris), c'est le menu « Accès machine & navigateur ». <b>Rien ne se fait sans ton accord</b> : une carte « Autoriser » ouvre une session de 10 minutes que tu peux stopper à tout moment.</p>
      <div class="carte" id="ch-st" style="border-color:#f5c542"><b id="ch-statut">Vérification…</b></div>
      <div class="carte"><h2 style="margin-top:0">Installer en 5 étapes</h2><ol style="line-height:1.9">
        <li><button class="btn mini or" id="ch-prep">1 · Préparer l'extension</button> <button class="btn mini" id="ch-dos">Ouvrir son dossier</button> <span class="petit" id="ch-chemin"></span></li>
        <li>Dans Chrome, tape <code>chrome://extensions</code> dans la barre d'adresse (Edge : <code>edge://extensions</code>). <button class="btn mini" id="ch-copie">Copier l'adresse</button></li>
        <li>Active <b>« Mode développeur »</b> (interrupteur en haut à droite).</li>
        <li>Clique <b>« Charger l'extension non empaquetée »</b> et choisis le dossier de l'étape 1.</li>
        <li>Épingle l'icône Clipia (puzzle 🧩 → épingle). Le statut ci-dessus passe à « connectée » en quelques secondes.</li></ol>
        <p class="petit">Pourquoi « mode développeur » ? Clipia n'est pas (encore) publiée sur le Chrome Web Store ; ce mode permet d'installer une extension locale, dont tu peux lire tout le code. Le jeton qui relie l'extension à Clipia est secret et reste sur ton ordinateur.</p></div>
      <div class="carte"><h2 style="margin-top:0">Ensuite</h2><p>Demande par exemple : « Ouvre YouTube et prépare la publication de mon clip ». Clipia affichera la carte <b>« Autoriser »</b> ; clique, elle travaille ; dis « stop » pour l'arrêter. Elle ne tape jamais tes mots de passe ni ta carte bancaire.</p>
        <button class="btn" id="ch-acces">Accès machine & navigateur</button></div>`;
    const maj = async () => {
      try { const e = await api('/api/ext/etat'); $('#ch-statut').innerHTML = e.connectee ? '✅ Extension connectée' + (e.session ? ' — session de contrôle active' : ' — prête (en attente de ton accord)') : '⚠ Extension non connectée : suis les 5 étapes ci-dessous.'; $('#ch-st').style.borderColor = e.connectee ? '#4fe0b0' : '#f5c542'; $('#ch-chemin').textContent = e.dossier; } catch {}
    };
    maj(); const iv = setInterval(() => { if (!$('#ch-st')?.isConnected) return clearInterval(iv); maj(); }, 3000);
    $('#ch-prep').onclick = async () => { try { const r = await api('/api/ext/preparer', { method: 'POST', headers: H, body: '{}' }); $('#ch-chemin').textContent = r.dossier; toast('Extension prête dans : ' + r.dossier, 'ok'); } catch (x) { toast(x.message, 'err'); } };
    $('#ch-dos').onclick = async () => { try { const r = await api('/api/ext/ouvrir-dossier', { method: 'POST', headers: H, body: '{}' }); $('#ch-chemin').textContent = r.dossier; } catch (x) { toast(x.message, 'err'); } };
    $('#ch-copie').onclick = async () => { try { await navigator.clipboard.writeText('chrome://extensions'); toast('Copié : colle-le dans la barre d\'adresse de Chrome', 'ok'); } catch { toast('Tape chrome://extensions dans Chrome', 'ok'); } };
    $('#ch-acces').onclick = () => go('#/acces');
  };

  // ── Créer mon chanteur / ma chanteuse ───────────────────────────────────
  VUES.chanteur = async v => {
    v.className = 'ch';
    v.innerHTML = `<h1>🎤 Créer mon chanteur / ma chanteuse</h1>
      <p>Un artiste virtuel qui t'appartient. La structure est <b>gratuite</b> : Clipia écrit sa fiche, ses paroles et ses visuels à décrire ; le morceau vient d'un générateur de musique gratuit (ou le tien) ; le clip est fabriqué sur ton ordinateur ; la publication se fait avec ton accord.</p>
      <div class="carte"><h2 style="margin-top:0">1 · Son identité</h2>
        <div class="rang"><input id="ch-n" placeholder="Nom d'artiste (ex. Luna Vega)"><select id="ch-g"><option>Chanteuse</option><option>Chanteur</option><option>Duo / groupe</option></select><input id="ch-l" placeholder="Langue (français…)" value="français"></div>
        <textarea id="ch-s" rows="3" style="width:100%" placeholder="Style, univers, histoire, ambiance visuelle : ex. pop électro mélancolique, héroïne cyberpunk des Ardennes…"></textarea></div>
      <div class="carte"><h2 style="margin-top:0">2 · Ce que Clipia prépare pour toi (en arrière-plan)</h2>
        <button class="btn or" data-m="fiche">🧬 Fiche artiste + biographie + identité visuelle</button>
        <button class="btn" data-m="paroles">✍️ 3 chansons (paroles + structure + prompt pour le générateur de musique)</button>
        <button class="btn" data-m="visuels">🖼 Prompts du visuel (portrait, pochette, plans du clip)</button>
        <button class="btn" data-m="lancement">🚀 Plan de lancement 14 jours (réseaux, rythme de sortie)</button></div>
      <div class="carte"><h2 style="margin-top:0">3 · Du morceau au clip, puis à tout le monde</h2><ol>
        <li>Génère le morceau avec un outil de musique (gratuit : voir « Gratuit » ; ou ton compte Suno, ou ta propre voix).</li>
        <li><button class="btn mini or" id="ch-clip">Ouvrir « Audio → Vidéo »</button> dépose le MP3 : le clip est créé sur ton ordinateur.</li>
        <li><button class="btn mini or" id="ch-pub">Ouvrir « Publier partout »</button> YouTube, TikTok, Instagram… avec ton accord.</li></ol>
        <p class="petit">Honnêteté : Clipia ne fabrique pas elle-même une voix chantée de qualité sans modèle musical ; elle organise tout le reste et relie chaque étape. Si tu utilises la musique d'un service, respecte ses conditions (usage commercial, crédits).</p></div>`;
    const M = {
      fiche: p => `Crée la fiche complète de mon artiste : ${p}. Biographie, personnalité, voix, univers, couleurs, logo (description), noms de comptes disponibles à vérifier, positionnement. Enregistre le tout dans un dossier de projet « Artiste ».`,
      paroles: p => `Pour mon artiste : ${p}. Écris 3 chansons originales (paroles complètes, structure couplet/refrain/pont, tempo et ambiance) + pour chacune un prompt précis pour un générateur de musique IA. Paroles 100 % originales, sans copier d'artiste existant. Enregistre dans le projet « Artiste ».`,
      visuels: p => `Pour mon artiste : ${p}. Rédige les prompts d'images (portrait, pochette d'album, 6 plans de clip) cohérents entre eux. Enregistre dans le projet « Artiste ».`,
      lancement: p => `Pour mon artiste : ${p}. Fais un plan de lancement de 14 jours (plateformes, formats, textes, hashtags, horaires). Aucune publication automatique. Enregistre dans le projet « Artiste ».`
    };
    v.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
      const nom = $('#ch-n').value.trim(), sty = $('#ch-s').value.trim();
      if (!nom || sty.length < 6) return toast('Donne un nom et quelques mots sur le style.', 'err');
      const p = `${nom} (${$('#ch-g').value}, ${$('#ch-l').value}) — ${sty}`;
      try { await api('/api/travaux/lancer', { method: 'POST', headers: H, body: JSON.stringify({ mission: M[b.dataset.m](p), titre: 'Artiste · ' + b.textContent.slice(2, 40) }) }); toast('C\'est lancé en arrière-plan', 'ok'); } catch (x) { toast(x.message, 'err'); }
    });
    $('#ch-clip').onclick = () => go('#/clip'); $('#ch-pub').onclick = () => go('#/publier');
  };

  // ── Publier partout ─────────────────────────────────────────────────────
  const PF = ['YouTube', 'TikTok', 'Instagram', 'Facebook', 'X (Twitter)', 'LinkedIn', 'Pinterest', 'Snapchat', 'SoundCloud', 'Bandcamp', 'Threads', 'Twitch'];
  VUES.publier = async v => {
    v.className = 'pu';
    v.innerHTML = `<h1>📣 Publier partout</h1>
      <p>Ta musique ou ta vidéo, sur toutes les plateformes. Clipia prépare un texte adapté à chacune puis, dans <b>ton</b> navigateur déjà connecté, remplit les formulaires. <b>Elle te demande « Je publie ? » avant chaque envoi.</b></p>
      <div class="carte"><h2 style="margin-top:0">1 · Quoi ?</h2>
        <div class="rang"><input id="pu-t" placeholder="Titre" style="min-width:260px"><input id="pu-f" placeholder="Fichier (chemin sur ton ordinateur, ex. C:\\Clips\\mon-clip.mp4)" style="min-width:320px"></div>
        <textarea id="pu-d" rows="3" style="width:100%" placeholder="De quoi ça parle ? (Clipia en tire description, hashtags, accroches)"></textarea></div>
      <div class="carte"><h2 style="margin-top:0">2 · Où ?</h2>${PF.map((p, i) => `<label class="pf"><input type="checkbox" data-p="${esc(p)}" ${i < 3 ? 'checked' : ''}> ${esc(p)}</label>`).join('')}</div>
      <div class="carte"><button class="btn or" id="pu-go" style="font-size:17px;padding:14px 24px">🚀 Préparer et publier avec mon accord</button>
        <p class="petit">Prérequis : l'extension Chrome de Clipia (menu « Accès de Clipia ») et tes comptes ouverts dans ce Chrome. Clipia ne tape jamais tes mots de passe, ne crée pas de compte à ta place, et ne publie rien sans ton « oui ». Les règles des plateformes (musique protégée, mentions « contenu généré par IA ») restent à respecter.</p></div>`;
    $('#pu-go').onclick = () => {
      const t = $('#pu-t').value.trim(), p = [...v.querySelectorAll('[data-p]:checked')].map(c => c.dataset.p);
      if (!t || !p.length) return toast('Un titre et au moins une plateforme.', 'err');
      amorcer(`Mission : publie « ${t} » sur : ${p.join(', ')}.\nFichier : ${$('#pu-f').value.trim() || '(à me demander)'}\nSujet : ${$('#pu-d').value.trim() || '(à me demander)'}\nÉtapes : 1) prépare pour chaque plateforme un titre, une description et des hashtags adaptés et montre-les-moi ; 2) demande-moi l'autorisation de contrôler le navigateur ; 3) ouvre chaque plateforme, remplis le formulaire, téléverse le fichier ; 4) AVANT chaque publication, montre le résumé et demande « Je publie ? » et attends mon oui. Ne tape jamais de mot de passe, ne crée aucun compte.`);
    };
  };
}
