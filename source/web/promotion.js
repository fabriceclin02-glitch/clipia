/* CLIPIA X7 — « Promotion en 1 clic » : un agent Promoteur prépare et remplit la promotion de Clipia dans TON Chrome ; il demande ton accord avant chaque publication. */
export function installerPromotion({ $, el, esc, api, API, VUES, toast }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>.pr h2{margin:20px 0 8px}.pr .carte{background:#ffffff0d;border:1px solid #ffffff22;border-radius:14px;padding:16px;margin:12px 0}
  .pr .gros{font-size:18px;padding:16px 26px;border-radius:14px}.pr ol li{margin:8px 0}.pr .petit{font-size:13px;opacity:.8}</style>`));
  const MISSION = "Mission : fais la promotion de Clipia X7 à ma place. Suis la compétence « Promotion de Clipia » (competence_lire promotion-clipia). Commence par me dire en une phrase simple le premier canal du calendrier (la vidéo verticale sur TikTok / YouTube Shorts), prépare le texte, ouvre le site dans mon Chrome et remplis tout. Ne publie RIEN sans que je dise « oui » pour ce post précis. Si un site demande un mot de passe, arrête-toi et dis-moi de le taper moi-même.";
  VUES.promotion = async v => {
    v.className = 'pr';
    v.innerHTML = `<h1>📣 Promotion en 1 clic</h1>
      <p>Tu n'as rien à comprendre : un <b>agent « Promoteur »</b> fait le travail à ta place, dans <b>ton</b> navigateur Chrome (déjà connecté à tes comptes). Il prépare les textes, ouvre les sites, remplit les formulaires, puis te demande « Je publie ? » avant chaque envoi.</p>
      <div class="carte"><button class="btn or gros" id="pr-go">🚀 Lancer la promotion</button><p class="petit" style="margin-top:10px">Un clic : l'agent est créé, et la mission démarre dans la conversation.</p></div>
      <div class="carte"><h2 style="margin-top:0">Ce qui va se passer</h2><ol>
        <li>Une carte <b>« Autoriser »</b> apparaît : elle donne à Clipia le contrôle de l'ordinateur pendant 10 minutes. Tu cliques <b>Autoriser</b> (tu peux arrêter à tout moment avec « stop »).</li>
        <li>L'agent ouvre le premier site (TikTok, YouTube…), colle le texte, ajoute le lien.</li>
        <li>Il t'affiche le résumé et demande : <b>« Je publie ? »</b>. Tu réponds oui ou non.</li>
        <li>Il passe au canal suivant. Les 14 jours de calendrier sont dans sa compétence.</li></ol></div>
      <div class="carte"><h2 style="margin-top:0">Ses limites (volontaires)</h2><ul>
        <li>Il ne tape <b>jamais</b> tes mots de passe ni de carte bancaire : si un site les demande, il s'arrête et c'est toi qui les saisis.</li>
        <li>Il ne crée pas de compte à ta place, ne fait pas de faux avis, ne spamme pas.</li>
        <li>Il ne publie pas sans ton « oui » : c'est ta réputation, donc ta décision.</li></ul>
        <p class="petit">Prérequis : l'extension Chrome de Clipia installée (menu « Accès de Clipia »), et tes comptes ouverts dans ce Chrome.</p></div>`;
    v.querySelector('#pr-go').onclick = async () => {
      try {
        await fetch(API + '/api/v6/agents-depart', { method: 'POST', headers: H, body: JSON.stringify({ ids: ['promoteur'] }) });
        sessionStorage.setItem('clipia:amorce', MISSION);
        location.hash = '#/clipia?n=' + Date.now();
      } catch (e) { toast('Impossible de lancer : ' + e.message, 'err'); }
    };
  };
}
