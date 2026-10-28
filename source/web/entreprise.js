/* CLIPIA X8 — « Lancer mon entreprise » : des missions toutes prêtes, confiées à des travailleurs en arrière-plan. */
export function installerEntreprise({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>.en .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:16px;margin:12px 0}.en .grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.en .m{border:1px solid #ffffff2a;border-radius:12px;padding:12px;background:#ffffff0a}.en .m b{display:block;margin-bottom:4px}.en .m p{font-size:13px;opacity:.85;margin:4px 0 8px}.en input,.en textarea,.en select{width:100%;border-radius:10px;padding:10px;background:#0003;border:1px solid #ffffff2a;color:inherit;font:inherit;margin:6px 0}.en .petit{font-size:13px;opacity:.8}</style>`));
  const MISSIONS = [
    ['🧭', 'Plan complet : de l\'idée au 1er client', 'Profil, marché, offre, prix, présence, clients, démarches, suivi — 8 livrables.', 'Suis la compétence integree-entreprise-lancer de bout en bout pour ce projet : {p}', true],
    ['🔎', 'Étude de marché locale', 'Concurrents, prix, demande, trous dans le marché, dans ma zone.', 'Fais une étude de marché locale pour : {p}. Cherche sur le web 5 concurrents et leurs prix, la demande, 3 opportunités. Livre 02-marche.md avec sources.', false],
    ['💶', 'Offre, prix et rentabilité', 'Trois formules, prix, seuil de rentabilité réaliste.', 'Suis la compétence integree-entreprise-offre-prix pour : {p}', false],
    ['🌐', 'Site vitrine + page de vente', 'Un site simple, rapide, prêt à publier (je te dirai comment).', 'Crée avec app_creer (type site) un site vitrine pour : {p}. Page d\'accueil, offre et tarifs, contact, mentions légales. Mobile d\'abord.', false],
    ['📞', 'Mes 30 premiers contacts', 'Liste ciblée + messages prêts (aucun envoi sans accord).', 'Suis la compétence integree-entreprise-prospection pour : {p}. Prépare la liste et les messages, ne rien envoyer.', false],
    ['🗓', 'Contenus sur 30 jours', 'Calendrier de posts/vidéos avec textes prêts.', 'Suis la compétence integree-entreprise-contenu-30j pour : {p}', false],
    ['📑', 'Démarches et documents (France)', 'Checklist officielle, modèle de facture, mentions légales.', 'Suis la compétence integree-entreprise-legal-fr pour : {p}. Vérifie les sources officielles et cite-les.', false],
    ['🎯', 'Aides & opportunités', 'Aides, concours, appels à projets que je peux saisir.', 'Suis la compétence integree-veille-opportunites pour : {p}', false],
    ['🤝', 'Projet solidaire / association', 'Une action utile pour les autres, avec partenaires et financements.', 'Suis la compétence integree-aider-les-autres pour : {p}', false],
    ['☀️', 'Mon briefing du jour', '3 priorités, 1 petit pas, un point d\'énergie.', 'Suis la compétence integree-coach-quotidien pour moi aujourd\'hui. Contexte : {p}', false]
  ];
  VUES.entreprise = async v => {
    v.className = 'en';
    v.innerHTML = `<h1>🏢 Lancer mon entreprise</h1>
      <p>Clipia t'aide à <b>avancer sur de vrais projets</b> : créer ton activité, gagner ta vie, aider les autres. Chaque mission part en <b>arrière-plan</b> : tu peux continuer de lui parler pendant qu'elle travaille.</p>
      <div class="carte"><b>Ton projet en quelques mots</b><textarea id="en-p" rows="3" placeholder="Ex. : Je veux vendre des gâteaux personnalisés dans les Ardennes / Je cherche à créer une association d'aide aux seniors à Flize…"></textarea>
      <p class="petit">Plus tu es précis (qui, où, combien de temps tu as, budget), meilleur sera le résultat. Clipia ne promet aucun revenu et te renvoie vers les sources officielles pour le légal et le fiscal.</p></div>
      <div class="grille">${MISSIONS.map((m, i) => `<div class="m"><b>${m[0]} ${esc(m[1])}</b><p>${esc(m[2])}</p><button class="btn ${i === 0 ? 'or' : ''}" data-i="${i}">Lancer en arrière-plan</button></div>`).join('')}</div>
      <div class="carte"><b>Important</b><p class="petit">Rien n'est envoyé, publié ni payé sans ton accord. Le suivi est dans « Travaux en arrière-plan » et dans la bulle en bas à gauche.</p></div>`;
    v.querySelectorAll('button[data-i]').forEach(b => b.onclick = async () => {
      const p = $('#en-p').value.trim(); if (p.length < 6) return toast('Décris ton projet en une ou deux phrases.', 'err');
      const m = MISSIONS[+b.dataset.i];
      try { await api('/api/travaux/lancer', { method: 'POST', headers: H, body: JSON.stringify({ mission: m[3].replace('{p}', p) + '\nEnregistre les livrables dans un dossier de projet clair.', titre: m[1], rigoureux: m[4] }) }); toast('C’est lancé en arrière-plan. Tu peux continuer de me parler.', 'ok'); }
      catch (e) { toast(e.message, 'err'); }
    });
  };
}
