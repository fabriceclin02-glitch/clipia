/* CLIPIA — application du studio (ES modules, sans framework) */
import { detecterAppel } from './appel-util.js';
import { extraireGuides, fusionnerEtat } from './guide-util.js';
import { CATEGORIES, OUTILS, LIC } from './outils-data.js';
import { parlerNaturel } from './voix-naturelle.js';
import { installerV4, phraseAppel } from './v4.js';
import { installerV5 } from './v5.js';
import { installerV6 } from './v6.js';
import { installerWidgets } from './widgets.js';
import { installerV61 } from './v61.js';
import { installerRecherche } from './recherche.js';
import { installerLivrables } from './livrable.js';
import { installerPsy, avatarSvg } from './psy.js';
import { installerCredit } from './credit.js';
import { installerExtensions } from './extensions.js';
import { installerStudio } from './studio.js';
import { installerDepannage } from './depannage.js';
import { installerLogitheque } from './logitheque.js';
import { installerOpenClaw } from './openclaw.js';
import { installerPromotion } from './promotion.js';
import { installerTravaux } from './travaux.js';
import { installerCommunaute } from './communaute.js';
import { installerPouvoirs } from './pouvoirs.js';
import { installerEntreprise } from './entreprise.js';
import { installerAccueil } from './accueil.js';
import { installerTelephone } from './telephone-vue.js';
import { installerDictee } from './dictee.js';
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => {
  const t = document.createElement('template');
  t.innerHTML = h.trim();
  // Plusieurs éléments à la racine : on les regroupe plutôt que d'en perdre.
  if (t.content.children.length > 1) { const d = document.createElement('div'); d.append(...t.content.childNodes); return d; }
  return t.content.firstElementChild;
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
/* Adresse du serveur Clipia.
   Sur ordinateur, c'est la page elle-même. Sur mobile ou en application
   empaquetée, l'interface est servie en local et doit viser votre machine
   ou votre serveur : réglable dans Paramètres → Serveur. */
const LOCAL = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/.test(location.origin)
  || location.protocol === 'file:' || location.protocol === 'capacitor:';
function serveurEnregistre() {
  try { return localStorage.getItem('clipia:serveur') || ''; } catch { return ''; }
}
export function definirServeur(url) {
  try { url ? localStorage.setItem('clipia:serveur', url.replace(/\/$/, '')) : localStorage.removeItem('clipia:serveur'); } catch {}
}
export const API = serveurEnregistre() || location.origin;
export const DISTANT = Boolean(serveurEnregistre());

/* Serveur injoignable : bandeau clair + reconnexion automatique (plus de « Failed to fetch » muet). */
let horsLigne = false;
function afficherHorsLigne() {
  if (horsLigne) return; horsLigne = true;
  const b = document.createElement('div'); b.id = 'hors-ligne';
  b.innerHTML = '<b>⚠ Clipia ne répond plus.</b> Le programme s\'est probablement arrêté. Double-clique sur <b>Clipia.exe</b> pour le relancer (ou sur « Diagnostic Clipia » si ça recommence). Je me reconnecte toute seule dès qu\'il revient… <button class="btn mini" id="hl-retry">Réessayer</button>';
  document.body.prepend(b);
  const test = async () => {
    try { const r = await fetch(API + '/api/etat', { cache: 'no-store' }); if (r.ok) { b.remove(); horsLigne = false; clearInterval(t); route(); } } catch {}
  };
  const t = setInterval(test, 2500);
  b.querySelector('#hl-retry').onclick = test;
}
async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      ...opts,
      headers: opts.body instanceof FormData ? {} : { 'content-type': 'application/json', ...(opts.headers || {}) }
    });
  } catch (e) {
    afficherHorsLigne();
    throw new Error('Clipia ne répond pas : le programme est arrêté. Relance Clipia.exe.');
  }
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { brut: txt }; }
  if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
  return j;
}
window.api = api;

/**
 * LA PERSONNALITÉ DE CLIPIA.
 *
 * Elle était jusqu'ici définie à deux endroits, et les deux la poussaient
 * à se répéter sans le vouloir :
 *
 *   — « TU PEUX AGIR. […] termine ta réponse par une ligne d'action »
 *     Une consigne qui contient « termine ta réponse par » produit
 *     exactement ça : la même fin, à chaque fois.
 *
 *   — L'amorce se terminait par la liste de tout ce que Clipia sait faire.
 *     Un modèle de langue récite volontiers ce qu'on lui a mis sous les yeux
 *     en dernier. D'où le catalogue de fonctions recraché en fin de réponse.
 *
 *   — « Tu proposes TOUJOURS une piste exploitable » — un « toujours » de
 *     plus, donc une formule de clôture de plus.
 *
 * Trois instructions qui, mises bout à bout, fabriquaient un assistant qui
 * finit chaque phrase de la même manière. On les enlève, et on décrit à la
 * place quelqu'un qui parle normalement.
 */
/**
 * MÉMOIRE DES FINS DE PHRASE.
 *
 * Une consigne qui dit « ne te répète pas » est un vœu : le modèle ne voit
 * pas ses réponses précédentes dans leur forme finale, donc il ne sait pas
 * qu'il vient de finir trois fois de suite par la même chose.
 *
 * On lui montre. Les dernières fins de réponse sont relues et réinjectées
 * avec une consigne précise. Ça transforme une recommandation en contrainte
 * vérifiable : il a le texte sous les yeux.
 */
const FINS = [];

function retenirFin(texte) {
  const propre = String(texte || '').replace(/\[\[action:[^\]]*\]\]/gi, '').trim();
  if (!propre) return;
  // Les deux dernières phrases suffisent à repérer une formule de clôture.
  const phrases = propre.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const fin = phrases.slice(-2).join(' ').trim();
  if (fin.length < 8) return;
  FINS.push(fin.slice(0, 220));
  if (FINS.length > 3) FINS.shift();
}

function consigneAntiRepetition() {
  if (!FINS.length) return '';
  return `\n\nTES DERNIÈRES FINS DE RÉPONSE\n` +
    FINS.map(f => `— « ${f} »`).join('\n') +
    `\nNe termine pas celle-ci de la même façon, ni sur le même genre de formule. ` +
    `Si tu n'as rien à ajouter, arrête-toi simplement après ta dernière idée.`;
}

/** Le ton que l'utilisateur a choisi, réglable dans l'application. */
const TON_DEFAUT = `Parle-moi comme à un ami. Tutoiement, ton détendu, un peu d'humour quand ça s'y prête.`;

function tonChoisi() {
  try { return localStorage.getItem('clipia:ton') || TON_DEFAUT; } catch { return TON_DEFAUT; }
}
function definirTon(t) {
  try { t && t.trim() ? localStorage.setItem('clipia:ton', t.trim()) : localStorage.removeItem('clipia:ton'); } catch {}
}

const CLIPIA_PERSO = ({ vocal = false } = {}) => `Tu es Clipia.

À QUI TU PARLES
À la personne en face de toi, et à elle seule. Tu t'adresses à elle DIRECTEMENT : « tu », « ton morceau », « ce que tu veux faire ». Jamais à la troisième personne, jamais en parlant d'elle comme d'un dossier. Tu ne cites aucun nom de marque et aucun nom de société dans tes réponses — ça sonne comme un service client, pas comme une conversation.

COMMENT ELLE VEUT QUE TU PARLES
${tonChoisi()}

CE QUI COMPTE DANS TA FAÇON DE RÉPONDRE
Tu réagis à ce qu'elle vient de dire avant d'embrayer. Tu as des avis : si une idée te paraît bancale, tu le dis et tu proposes autre chose. Tu peux être brève — si la réponse tient en une phrase, une phrase suffit.

CE QU'IL NE FAUT SURTOUT PAS FAIRE
Pas de « Comment puis-je t'aider aujourd'hui ? » ni aucune autre formule d'accueil de centre d'appels. Quand on te dit bonjour, tu dis bonjour comme quelqu'un de normal, et tu enchaînes sur quelque chose de vrai.

Tu ne termines jamais deux réponses de suite par la même formule. Pas de « n'hésite pas », pas de « je reste à ta disposition », pas de question de politesse ajoutée par réflexe. Quand tu as fini, tu t'arrêtes. Une vraie question, posée parce qu'elle t'intéresse, oui — une question automatique, jamais.

Tu n'énumères pas ce que tu sais faire. On ne récite pas son CV à un ami. Si une fonction sert là, maintenant, tu la glisses dans la phrase. Sinon tu n'en parles pas.

Tu ne t'excuses pas en boucle et tu n'empiles pas les précautions.

QUAND TU NE SAIS PAS
Tu le dis simplement. « Aucune idée », « là je devine », « faudrait vérifier » sont de vraies réponses. Inventer un détail crédible serait pire.
${vocal ? `
TU ES LUE À VOIX HAUTE
Pas de listes, pas d'astérisques, pas de titres — ça s'entend mal. Des phrases qu'on prononce. Trois ou quatre d'affilée au maximum, sauf si on te demande du détail.
` : `
MISE EN FORME
Du texte courant. Une liste seulement quand il y a vraiment des éléments à aligner.
`}
SI UNE ACTION EST UTILE
Tu peux ouvrir une partie du studio. Une seule ligne, tout à la fin, et seulement si la personne veut vraiment y aller :
[[action:ouvrir|section]]

Sections : clip, image, video, musique, paroles, sciences, neuro, liaison, pont, pensee, utilitaires, cerveau, agent, medias, partage, connecteurs, modeles, locales, coffre, taches, atelier, centre-ia, souvenirs, systeme.
Et [[action:agent|ce qu'il faut coder]] pour lancer l'agent développeur.

Pour une question, une discussion, un avis : aucune action. La plupart des échanges n'en appellent aucune.`;

function toast(msg, type = '') {
  const d = el(`<div class="${type}">${esc(msg)}</div>`);
  $('#toast').append(d);
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 300); }, type === 'err' ? 7000 : 3800);
}
window.toast = toast;

// ── Navigation ─────────────────────────────────────────────────────────────
const MENU = [
  { s: 'Mon agent personnel' },
  { id:'moi',        ic:'✨', t:'Créer mon IA' },
  { id:'installateur', ic:'🚀', t:'Assistant d\'installation' },
  { id:'cabinet', ic:'🛋', t:'Cabinet de psychologues' },
  { id:'atelierapps', ic:'🛠', t:'Atelier d\'apps' },
  { id:'connexions', ic:'🔌', t:'Connexions & compétences' },
  { id:'studio', ic:'🎬', t:'Studio montage' },
  { id:'logitheque', ic:'📦', t:'Logithèque' },
  { id:'openclaw', ic:'🦞', t:'Pont OpenClaw' },
  { id:'travaux', ic:'⚙️', t:'Travaux en arrière-plan' },
  { id:'youtube', ic:'▶️', t:'YouTube Project' },
  { id:'tiktok', ic:'🎵', t:'TikTok Project' },
  { id:'mobile', ic:'📱', t:'Sur mon téléphone (QR)' },
  { id:'chrome', ic:'🧩', t:'Extension Chrome (important)' },
  { id:'vscode', ic:'🧑‍💻', t:'Visual Studio Code' },
  { id:'sauvegarde', ic:'💾', t:'Sauvegarder mon IA' },
  { id:'moteurs', ic:'🎞', t:'Moteurs de clip (Canva…)' },
  { id:'chanteur', ic:'🎤', t:'Créer mon chanteur / chanteuse' },
  { id:'publier', ic:'📣', t:'Publier partout' },
  { id:'entreprise', ic:'🏢', t:'Lancer mon entreprise' },
  { id:'planning', ic:'⏰', t:'Tâches planifiées' },
  { id:'mcp', ic:'🔌', t:'Outils MCP' },
  { id:'communaute', ic:'🌍', t:'Communauté & évolution' },
  { id:'promotion', ic:'📣', t:'Promotion en 1 clic' },
  { id:'telephone', ic:'📱', t:'Téléphone & MCP' },
  { id:'depanner', ic:'🩺', t:'Résoudre un problème' },
  { id:'extensions', ic:'🧩', t:'Skills & extensions' },
  { id:'temps', ic:'⏪', t:'Remonter le temps' },
  { id:'parole',    ic:'💬', t:'Comment te parler' },
  { id:'installation', ic:'⚡', t:'Installation guidée' },
  { id:'cerveau-etapes', ic:'🧠', t:'Cerveau pas à pas' },
  { s: 'Espace de travail' },
  { id:'clipia',     ic:'✦', t:'Clipia' },
  { id:'cerveau',    ic:'❂', t:'Cerveau' },
  { id:'gratuit',    ic:'◇', t:'Gratuit' },
  { id:'configuration', ic:'◉', t:'Configuration' },
  { id:'atelier',    ic:'❖', t:'Projets & agents' },
  { id:'acces',      ic:'⛨', t:'Accès machine & navigateur' },
  { id:'tableau',    ic:'◎', t:'Tout le système' },
  { id:'assistant',  ic:'⌨', t:'Chat simple' },
  { id:'autonome',   ic:'⬡', t:'Pilote autonome' },
  { id:'raisonnement', ic:'◈', t:'Raisonnement' },
  { id:'sciences',   ic:'⚛', t:'Sciences' },
  { id:'neuro',      ic:'❋', t:'Son & cerveau' },
  { id:'liaison',    ic:'◉', t:'Sans internet' },
  { id:'pont',       ic:'⟋', t:'Le pont' },
  { id:'pensee',     ic:'◍', t:'Par la pensée' },
  { id:'utilitaires', ic:'⚒', t:'Utilitaires' },
  { id:'agent',      ic:'⟡', t:'Agent développeur' },
  { id:'memoire',    ic:'◉', t:'Mémoire' },
  { id:'messagerie', ic:'✉', t:'Pilotage à distance' },
  { s: 'Création' },
  { id:'clip',       ic:'🎬', t:'Audio → Vidéo' },
  { id:'video',      ic:'▶', t:'Vidéo' },
  { id:'image',      ic:'▣', t:'Image et 3D' },
  { id:'paroles',    ic:'♪', t:'Paroles et voix' },
  { id:'musique',    ic:'♫', t:'Musique' },
  { id:'autonome',   ic:'🧠', t:'Agent autonome' },
  { id:'boite',      ic:'🧰', t:'Boîte à outils' },
  { s: 'Pilotage' },
  { id:'modeles',    ic:'⬢', t:'Modèles IA' },
  { id:'locales',    ic:'⌂', t:'IA locales' },
  { id:'systeme',    ic:'⚙', t:'Cerveau du système' },
  { id:'souvenirs',  ic:'◎', t:'Mémoire totale' },
  { id:'centre-ia',  ic:'✦', t:'Centre des IA' },
  { id:'connecteurs',ic:'⚯', t:'Intégrations' },
  { id:'workflows',  ic:'⇄', t:'Workflows' },
  { id:'skills',     ic:'◆', t:'Skills' },
  { id:'taches',     ic:'⧗', t:'File de tâches' },
  { id:'medias',     ic:'▦', t:'Médiathèque' },
  { id:'partage',    ic:'⤤', t:'Partage' },
  { s: 'Compte' },
  { id:'abonnement', ic:'◈', t:'Abonnement' },
  { id:'coffre',     ic:'⚿', t:'Coffre de clés' },
  { id:'parametres', ic:'⚙', t:'Paramètres' },
  { id:'production', ic:'⚑', t:'Production' },
  { id:'installer',  ic:'⤓', t:'Installer / exporter' },
  { id:'support',    ic:'◌', t:'Support' }
];

/** Arborescence de gauche : les conversations, rangées comme des projets. */
async function majConversations() {
  const zone = document.getElementById('convs'); if (!zone) return;
  let liste = [];
  try { liste = await api('/api/conversations'); } catch { return; }
  const actuel = new URLSearchParams((location.hash.split('?')[1] || '')).get('c');
  let projets = [];
  try { projets = (await api('/api/atelier')).projets || []; } catch {}
  zone.innerHTML = '';
  const nouveau = el('<a href="#/clipia?n=' + Date.now() + '" class="conv-nouveau"><span class="ic">+</span>Nouvelle conversation</a>');
  zone.append(nouveau);
  for (const c of liste.slice(0, 40)) {
    const prog = c.guides ? ` <small style="opacity:.7">${c.faites}/${c.guides}</small>` : '';
    const a = el(`<a href="#/clipia?c=${encodeURIComponent(c.id)}" class="conv${c.id === actuel ? ' actif' : ''}" title="${esc(c.titre)}"><span class="ic">${c.epingle ? '★' : '▸'}</span><span class="conv-t">${esc(c.titre)}</span>${prog}<span class="conv-x" title="Supprimer cette conversation" data-id="${esc(c.id)}">×</span></a>`);
    a.querySelector('.conv-x').onclick = async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (!confirm('Supprimer cette conversation ? (Les fichiers créés ne sont jamais supprimés.)')) return;
      await api('/api/conversations/' + encodeURIComponent(c.id), { method: 'DELETE' });
      if (c.id === actuel) location.hash = '#/clipia?n=' + Date.now(); else majConversations();
    };
    zone.append(a);
  }
  zone.append(el('<div class="section" style="margin-top:10px">Mes projets</div>'));
  if (!projets.length) zone.append(el('<a href="#/atelier" class="proj"><span class="ic">▸</span><span class="conv-t" style="opacity:.7">Créer mon premier projet</span></a>'));
  for (const p of projets.slice(0, 30)) zone.append(el(`<a href="#/atelier?p=${encodeURIComponent(p.id)}" class="proj" title="${esc(p.nom)}"><span class="ic">❖</span><span class="conv-t">${esc(p.nom)}</span></a>`));
}
window.majConversations = majConversations;

function buildNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  nav.append(el('<div class="section">Mes conversations</div>'));
  nav.append(el('<div id="convs"></div>'));
  majConversations();
  for (const m of MENU) {
    if (m.s) { nav.append(el(`<div class="section">${m.s}</div>`)); continue; }
    const a = el(`<a href="#/${m.id}" data-id="${m.id}"><span class="ic">${m.ic}</span>${m.t}</a>`);
    nav.append(a);
  }
}

const VUES = {};
async function route() {
  const id = (location.hash.replace(/^#\//, '').split('?')[0]) || 'clipia';
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('actif', a.dataset.id === id));
  $('#fil').textContent = MENU.find(m => m.id === id)?.t || 'Clipia';
  $('#nav').classList.remove('ouvert');
  const racine = $('#vue');
  racine.innerHTML = '<div class="vide"><span class="tourne"></span></div>';
  majConversations();   // l'arborescence suit : nouveaux projets, conversations, avancement des guides
  // Chaque navigation a son propre conteneur : une vue lente d'une navigation précédente
  // écrit dans un conteneur détaché et ne pollue plus la page courante.
  const v = document.createElement('div'); v.className = 'vue-contenu'; v.style.display = 'contents';
  try { racine.innerHTML = ''; racine.append(v); await (VUES[id] || VUES.clipia)(v); }
  catch (e) { v.innerHTML = `<div class="carte" style="border-color:var(--erreur)"><b style="color:var(--erreur)">Erreur</b><p>${esc(e.message)}</p></div>`; }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCÈS MACHINE & NAVIGATEUR — ce que Clipia peut toucher, et ce qu'elle a fait.
// ═══════════════════════════════════════════════════════════════════════════
VUES.acces = async (v) => {
  const H = { 'x-clipia-accord': '1' };
  const [e, m] = await Promise.all([api('/api/noyau/etat'), api('/api/noyau/machine')]);
  const b = e.bilan;
  const lignesBilan = b ? Object.values(b.besoins).map(x =>
    `<tr><td>${esc(x.nom)}</td><td>${x.pret ? '<b style="color:var(--ok)">prêt</b>' : '<span style="color:var(--texte-faible)">non</span>'}</td>
     <td>${x.choisi ? esc(x.choisi.label) + (x.choisi.ms ? ` · ${x.choisi.ms} ms` : '') : '—'}</td></tr>`).join('') : '';

  v.append(el(`
  <h1>Accès machine & navigateur</h1>
  <p class="sous">Clipia peut lire, écrire et lancer des commandes sur cette machine, et piloter un navigateur. Tu gardes la main : tout est journalisé, certaines zones restent fermées quoi qu'il arrive, et chaque action qui engage quelque chose te demande un accord.</p>
  <div class="grille g2">
    <div class="carte">
      <h2 style="margin-top:0">Machine</h2>
      <label class="rang" style="gap:10px;margin:8px 0"><input type="checkbox" id="lectureSeule" ${m.lectureSeule ? 'checked' : ''}>
        <span><b>Lecture seule</b> — elle regarde, elle n'écrit ni ne lance rien.</span></label>
      <b style="font-size:13px">Dossiers autorisés</b>
      <div id="zones" style="margin:8px 0"></div>
      <div class="rang"><input id="nouvZone" placeholder="Ajouter un dossier (chemin complet)"><button class="btn mini" id="ajZone">Ajouter</button></div>
      <p style="font-size:12px;color:var(--texte-faible);margin:12px 0 0">Toujours fermés : clés SSH, trousseaux, coffre de Clipia, éléments système. Jamais de mot de passe saisi à ta place.</p>
    </div>
    <div class="carte">
      <h2 style="margin-top:0">Navigateur</h2>
      <p style="margin:6px 0;font-size:13px">${e.navigateur?.erreur ? esc(e.navigateur.erreur) : esc(e.navigateur?.resume || e.navigateur?.etat || 'Chrome/Edge sera lancé à la demande, dans un profil à part.')}</p>
      <p style="font-size:12px;color:var(--texte-faible)">Pour qu'elle pilote TON Chrome (avec tes connexions), lance-le avec <code>--remote-debugging-port=9222</code>. Sinon elle utilise son propre navigateur, vierge.</p>
    </div>
  </div>
  <div class="carte" style="margin-top:14px">
    <div class="rang" style="justify-content:space-between"><h2 style="margin:0">Moteurs au démarrage</h2><button class="btn mini" id="reeval">Réévaluer</button></div>
    <table class="tab" style="width:100%;margin-top:8px"><tbody>${lignesBilan || '<tr><td>Pas encore évalué</td></tr>'}</tbody></table>
    ${e.indisponibles?.length ? `<p style="font-size:12px;color:var(--texte-faible)">Hors d'atteinte : ${e.indisponibles.map(i => esc(i.nom) + ' (' + esc(i.pourquoi) + ')').join(', ')}</p>` : ''}
  </div>
  <div class="carte" style="margin-top:14px">
    <h2 style="margin-top:0">Journal des commandes</h2>
    <div id="journal" style="font-family:monospace;font-size:12px;max-height:280px;overflow:auto"></div>
  </div>`));

  const zones = () => {
    $('#zones').innerHTML = (m.zones || []).map(z => `<div class="rang" style="justify-content:space-between;font-size:12.5px"><code>${esc(z)}</code><button class="btn mini" data-z="${esc(z)}">Retirer</button></div>`).join('') || '<i style="font-size:12.5px;color:var(--texte-faible)">aucun</i>';
    $('#zones').querySelectorAll('[data-z]').forEach(bt => bt.onclick = async () => {
      Object.assign(m, await api('/api/noyau/machine/zone', { method: 'POST', headers: H, body: JSON.stringify({ chemin: bt.dataset.z, retirer: true }) })); zones();
    });
  };
  zones();
  $('#ajZone').onclick = async () => {
    const c = $('#nouvZone').value.trim(); if (!c) return;
    try { Object.assign(m, await api('/api/noyau/machine/zone', { method: 'POST', headers: H, body: JSON.stringify({ chemin: c }) })); $('#nouvZone').value = ''; zones(); }
    catch (er) { toast(er.message, 'err'); }
  };
  $('#lectureSeule').onchange = async ev => {
    await api('/api/noyau/machine/lecture-seule', { method: 'POST', headers: H, body: JSON.stringify({ actif: ev.target.checked }) });
    toast(ev.target.checked ? 'Lecture seule activée.' : 'Écriture autorisée dans les dossiers listés.', 'ok');
  };
  $('#reeval').onclick = async () => { toast('Mesure en cours…'); await api('/api/noyau/evaluer', { method: 'POST' }); route(); };
  $('#journal').innerHTML = (m.journal || []).slice().reverse().map(j =>
    `<div>${esc(String(j.quand || '').slice(11, 19))} · ${esc(j.genre || j.categorie || '')} · ${esc(String(j.commande || j.chemin || j.action || '').slice(0, 160))}${j.code !== undefined ? ' → ' + esc(j.code) : ''}</div>`).join('') || '<i style="color:var(--texte-faible)">Rien pour l\'instant.</i>';
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.tableau = async (v) => {
  const e = await api('/api/etat');
  v.append(el(`
  <h1>Bonjour 👋</h1>
  <p class="sous">Studio Clipia — ${e.fournisseurs.total} moteurs IA, ${e.connecteurs.total} connecteurs, pipeline clip complet.</p>
  <div class="grille g4" style="margin-bottom:22px">
    <div class="stat"><div class="v" style="color:var(--or)">${e.fournisseurs.configures}</div><div class="k">Modèles cloud prêts</div></div>
    <div class="stat"><div class="v" style="color:var(--ok)">${e.fournisseurs.locauxActifs}</div><div class="k">IA locales actives</div></div>
    <div class="stat"><div class="v">${e.connecteurs.connectes}</div><div class="k">Connecteurs liés</div></div>
    <div class="stat"><div class="v">${e.medias}</div><div class="k">Médias produits</div></div>
  </div>`));

  v.append(el(`
  <div class="carte" style="background:linear-gradient(135deg,rgba(224,178,92,.12),transparent);border-color:var(--or-sombre)">
    <div class="rang" style="justify-content:space-between">
      <div><h2 style="margin:0 0 4px">Une idée. Tout est possible.</h2>
      <p style="color:var(--texte-doux);margin:0">Déposez une musique, Clipia en fait un clip complet : analyse, paroles, scénario, visuels, montage.</p></div>
      <a href="#/clip" class="btn or">Créer un clip →</a>
    </div>
  </div>`));

  const plan = e.plan;
  $('#plan').textContent = plan.label;
  Object.assign($('#plan'), { title: 'Voir mon abonnement', onclick: () => { location.hash = '#/abonnement'; } }); $('#plan').style.cursor = 'pointer'; $('#plan').setAttribute('role', 'link');
  $('#plan').className = 'etiq ' + (plan.price ? 'or' : 'neutre');

  v.append(el(`<h2>État du système</h2>`));
  const rows = [
    ['Passerelle IA', e.fournisseurs.configures > 0 || e.fournisseurs.locauxActifs > 0, `${e.fournisseurs.configures} cloud · ${e.fournisseurs.locauxActifs} local`],
    ['Moteur de montage FFmpeg', e.ffmpeg, 'rendu vidéo local'],
    ['Connecteurs configurés', e.connecteurs.configures > 0, `${e.connecteurs.configures}/${e.connecteurs.total}`],
    ['File de tâches', true, `${e.taches.running} en cours · ${e.taches.waiting} en attente`],
    ['Abonnement', true, `${plan.label}${plan.subscription?.status ? ' · ' + plan.subscription.status : ''}`]
  ];
  v.append(el(`<div class="liste">${rows.map(([k, ok, d]) =>
    `<div><span class="puce ${ok ? 'ok' : 'att'}"></span><b style="flex:1">${k}</b>
     <span style="color:var(--texte-doux);font-size:12.5px">${esc(d)}</span></div>`).join('')}</div>`));

  const evs = await api('/api/evenements');
  v.append(el(`<h2>Activité récente</h2>`));
  v.append(evs.length
    ? el(`<div class="liste">${evs.slice(0, 10).map(x =>
        `<div><span class="etiq neutre">${esc(x.type)}</span>
         <span style="margin-left:auto;color:var(--texte-faible);font-size:12px">${new Date(x.createdAt).toLocaleString('fr-FR')}</span></div>`).join('')}</div>`)
    : el(`<div class="vide"><div class="em">◌</div>Aucune activité pour l'instant.</div>`));
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.assistant = async (v) => {
  const fours = await api('/api/fournisseurs');
  const dispo = fours.filter(f => f.configure && ['openai','anthropic','gemini','ollama'].includes(f.kind));
  v.append(el(`
  <h1>Clipia · assistant</h1>
  <p class="sous">Votre directeur artistique. Il parle au modèle de votre choix — cloud ou local.</p>
  <div class="rang" style="margin-bottom:14px">
    <select id="four" style="max-width:250px"></select>
    <select id="mod" style="max-width:260px"></select>
    <button class="btn mini" id="vider">Effacer</button>
  </div>
  <div class="chat">
    <div class="fil" id="fil2"></div>
    <div class="saisie">
      <textarea id="txt" placeholder="Décrivez votre idée… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)"></textarea>
      <button class="btn or" id="env">Envoyer</button>
    </div>
  </div>`));

  const sf = $('#four'), sm = $('#mod');
  if (!dispo.length) {
    sf.innerHTML = '<option>Aucun modèle configuré</option>';
    $('#fil2').append(el(`<div class="carte creux"><b>Aucun moteur disponible.</b><p style="color:var(--texte-doux);margin-top:6px">Ajoutez une clé dans <a href="#/coffre">Coffre de clés</a>, ou lancez <code>ollama serve</code> pour une IA locale gratuite.</p></div>`));
  } else {
    sf.innerHTML = dispo.map(f => `<option value="${f.id}">${esc(f.label)}${f.tier === 'local-gratuit' ? ' · gratuit' : ''}</option>`).join('');
    const maj = async () => {
      const f = dispo.find(x => x.id === sf.value);
      sm.innerHTML = (f.models || []).map(m => `<option>${esc(m)}</option>`).join('') || '<option>chargement…</option>';
      try { const p = await api(`/api/fournisseurs/${f.id}/ping`); if (p.models?.length) sm.innerHTML = p.models.map(m => `<option>${esc(m)}</option>`).join(''); } catch {}
    };
    sf.onchange = maj; await maj();
  }

  const hist = [];
  const push = (role, txt) => {
    const d = el(`<div class="msg ${role === 'user' ? 'moi' : 'ia'}"><div class="qui">${role === 'user' ? 'Vous' : 'Clipia'}</div><span class="c"></span></div>`);
    d.querySelector('.c').textContent = txt;
    $('#fil2').append(d); $('#fil2').scrollTop = 1e9; return d.querySelector('.c');
  };
  async function envoyer() {
    const t = $('#txt').value.trim(); if (!t || !sf.value) return;
    $('#txt').value = ''; push('user', t); hist.push({ role: 'user', content: t });
    const out = push('assistant', '…'); out.textContent = '';
    $('#env').disabled = true;
    try {
      const r = await fetch(API + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: sf.value, model: sm.value, messages: hist, temperature: .85,
          system: CLIPIA_PERSO({ vocal: false }) + consigneAntiRepetition() }) });
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', full = '';
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const L of lines) {
          if (!L.startsWith('data:')) continue;
          const j = JSON.parse(L.slice(5));
          if (j.erreur) { out.textContent = '⚠ ' + j.erreur; out.parentElement.style.borderColor = 'var(--erreur)'; return; }
          if (j.delta) { full += j.delta; out.textContent = full; $('#fil2').scrollTop = 1e9; }
        }
      }
      hist.push({ role: 'assistant', content: full });
      retenirFin(full);
    } catch (e) { out.textContent = '⚠ ' + e.message; }
    finally { $('#env').disabled = false; }
  }
  $('#env').onclick = envoyer;
  $('#txt').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } };
  $('#vider').onclick = () => { hist.length = 0; $('#fil2').innerHTML = ''; };
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.clip = async (v) => {
  // ── Le chemin qui marche sans rien : d'abord, parce que c'est celui qui
  //    fonctionne sur une machine fraîche.
  try {
    const cl = await api('/api/clip-local');
    v.append(el(`
    <div class="carte" style="border-color:${cl.ffmpeg ? 'var(--ok)' : 'var(--erreur)'};background:linear-gradient(140deg,rgba(79,224,176,.07),transparent)">
      <div class="rang" style="justify-content:space-between;flex-wrap:wrap">
        <b style="font-size:15px">Clip immédiat — sans modèle, sans clé, sans réseau</b>
        <span class="etiq ${cl.ffmpeg ? 'ok' : 'err'}">${cl.ffmpeg ? 'prêt' : 'ffmpeg manquant'}</span>
      </div>
      <p style="color:var(--texte-doux);margin:9px 0 12px">Le visuel est calculé à partir du son lui-même : spectre accordé sur les notes, forme d'onde, bandes de fréquences. Les plans pulsent sur le tempo réellement mesuré du morceau. Aucune intelligence artificielle n'intervient — seulement le signal et ffmpeg.</p>
      <div class="depot" id="depCL"><div style="font-size:26px;opacity:.5">♪</div>
        <b>Déposez votre morceau</b>
        <span style="font-size:12px;color:var(--texte-faible)">MP3, WAV, FLAC — y compris vos fichiers Suno</span>
        <input type="file" id="fCL" accept="audio/*" hidden></div>
      <div id="infoCL" style="margin-top:12px"></div>
      <div class="grille g2" style="margin-top:12px">
        <label class="champ"><span>Ambiance</span><select id="ambCL">
          ${Object.entries(cl.ambiances).map(([k, x]) => `<option value="${k}"${k === 'double' ? ' selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ"><span>Format</span><select id="fmtCL">
          ${Object.entries(cl.formats).map(([k, f]) => `<option value="${k}">${esc(f.nom)}</option>`).join('')}</select></label>
      </div>
      <div id="quoiCL" style="color:var(--texte-faible);font-size:12.5px;margin-bottom:11px"></div>
      <div class="grille g2">
        <label class="champ"><span>Titre</span><input id="titCL" placeholder="Nom du morceau"></label>
        <label class="champ"><span>Artiste</span><input id="artCL" value="CLENDAX"></label>
      </div>
      <button class="btn or" id="goCL" disabled>Créer le clip</button>
      <div id="resCL" style="margin-top:13px"></div>
    </div>`));

    const quoi = () => { $('#quoiCL').textContent = cl.ambiances[$('#ambCL').value]?.quoi || ''; };
    $('#ambCL').onchange = quoi; quoi();

    let fichierCL = null;
    $('#depCL').onclick = () => $('#fCL').click();
    $('#fCL').onchange = async () => {
      $('#infoCL').innerHTML = '<span class="tourne"></span> mesure du morceau…';
      try {
        const fd = new FormData(); fd.append('f', $('#fCL').files[0]);
        const up = await api('/api/televerser', { method: 'POST', body: fd });
        fichierCL = up.file;
        const m = await api('/api/sciences/audio/analyser', { method: 'POST', body: JSON.stringify({ chemin: up.file }) });
        $('#infoCL').innerHTML = `<div class="rang" style="flex-wrap:wrap">
          <span class="etiq ok">${esc($('#fCL').files[0].name.slice(0, 34))}</span>
          <span class="etiq neutre">${m.duree} s</span>
          ${m.bpm ? `<span class="etiq or">${m.bpm} battements/minute</span>` : '<span class="etiq att">tempo non détecté — pas de pulsation</span>'}
          ${m.loudness?.integre != null ? `<span class="etiq info">${m.loudness.integre} LUFS</span>` : ''}
        </div>`;
        if (!$('#titCL').value) $('#titCL').value = $('#fCL').files[0].name.replace(/\.[^.]+$/, '').slice(0, 40);
        $('#goCL').disabled = false;
      } catch (e) { $('#infoCL').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
    };

    $('#goCL').onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'rendu en cours…';
      $('#resCL').innerHTML = '<div class="carte"><span class="tourne"></span> Clipia dessine le son, image par image. Comptez environ une seconde de calcul par seconde de musique.</div>';
      try {
        const a = await api('/api/clip-local/creer', { method: 'POST', body: JSON.stringify({
          audio: fichierCL, ambiance: $('#ambCL').value, format: $('#fmtCL').value,
          titre: $('#titCL').value, artiste: $('#artCL').value }) });
        $('#resCL').innerHTML = `<div class="carte" style="border-color:var(--ok)">
          <b style="color:var(--ok)">${esc(a.nom)}</b>
          <video src="${a.url}" controls style="width:100%;margin-top:11px;border-radius:9px"></video>
          <div class="rang" style="margin-top:10px;flex-wrap:wrap">
            <a class="btn mini" href="${a.url}" download>Télécharger</a>
            <span class="etiq neutre">${(a.bytes / 1048576).toFixed(1)} Mo</span>
            <span class="etiq neutre">${a.detail.largeur}×${a.detail.hauteur}</span>
            ${a.detail.bpm ? `<span class="etiq or">${a.detail.bpm} bpm${a.detail.pulse ? ' — plans pulsés' : ''}</span>` : ''}
          </div>
          <p style="color:var(--texte-doux);font-size:12.5px;margin:11px 0 0">${esc(a.detail.quoi)}</p>
          <p style="color:var(--texte-faible);font-size:12px;margin:7px 0 0">${esc(a.detail.honnete)}</p>
        </div>`;
      } catch (err) {
        $('#resCL').innerHTML = `<div class="carte" style="border-color:var(--erreur)">
          <b style="color:var(--erreur)">Rendu impossible</b>
          <p style="color:var(--texte-doux);margin:8px 0 0">${esc(err.message)}</p></div>`;
      } finally { e.target.disabled = false; e.target.textContent = 'Créer le clip'; }
    };
  } catch { /* si la route manque, la vue classique reste entière */ }

  const [fours, formats] = await Promise.all([api('/api/fournisseurs'), api('/api/formats')]);
  const llms = fours.filter(f => f.configure && ['openai','anthropic','gemini','ollama'].includes(f.kind));
  const imgs = fours.filter(f => f.configure && f.kind === 'image');
  const vids = fours.filter(f => f.configure && f.kind === 'video' && f.id !== 'ffmpeg');
  const stts = fours.filter(f => f.configure && f.kind === 'stt');

  v.append(el(`
  <h1>Audio → Vidéo</h1>
  <p class="sous">Déposez n'importe quelle piste sonore — morceau, voix off, podcast, interview. Clipia l'analyse, la transcrit, écrit le scénario, génère les plans et monte la vidéo synchronisée.</p>
  <label class="champ" style="max-width:420px"><span>Type de vidéo à produire</span>
    <select id="genre">
      <option value="clip">Clip musical — plans rythmés sur le tempo</option>
      <option value="lyric">Lyric video — paroles au premier plan</option>
      <option value="explicative">Vidéo explicative — illustration d'une voix off</option>
      <option value="audiogramme">Audiogramme podcast — extrait sous-titré</option>
      <option value="pub">Spot publicitaire — produit et accroche</option>
      <option value="narratif">Court narratif — récit en plans successifs</option>
      <option value="formation">Capsule de formation — notions illustrées</option>
      <option value="diaporama">Diaporama — vos images sur une bande-son</option>
    </select></label>
  <div class="depot" id="depot">
    <div style="font-size:34px;opacity:.5">♪</div>
    <b>Déposez votre piste sonore ici</b>
    <p style="color:var(--texte-faible);font-size:12.5px;margin-top:5px">MP3, WAV, FLAC, M4A, OGG — morceau, voix off, podcast… ou cliquez pour choisir</p>
    <input type="file" id="fichier" accept="audio/*" hidden>
  </div>
  <div id="apres" style="display:none">
    <div class="carte" style="margin-top:16px">
      <div class="rang"><span class="etiq ok">✓</span><b id="nomf"></b><span id="poids" style="color:var(--texte-faible);font-size:12px"></span></div>
      <audio id="apercu" controls style="width:100%;margin-top:11px"></audio>
    </div>
    <div class="grille g2" style="margin-top:16px">
      <div class="carte">
        <h2 style="margin-top:0">Direction artistique</h2>
        <label class="champ"><span>Style visuel</span>
          <textarea id="style" placeholder="Ex : néon nocturne, pluie, reflets, grain argentique, plans serrés, palette or et bleu nuit">cinématographique nocturne, néons, contraste fort, grain argentique</textarea></label>
        <label class="champ"><span>Format de sortie</span>
          <select id="ratio">${Object.entries(formats).map(([k, r]) => `<option value="${k}">${esc(r.label)}</option>`).join('')}</select></label>
        <label class="champ"><span>Langue des paroles</span>
          <select id="langue"><option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option><option value="de">Allemand</option></select></label>
        <label class="rang" style="gap:8px"><input type="checkbox" id="karaoke" checked style="width:auto"> <span>Sous-titres karaoké mot à mot</span></label>
      </div>
      <div class="carte">
        <h2 style="margin-top:0">Moteurs</h2>
        <label class="champ"><span>Scénariste (LLM)</span>
          <select id="llm">${llms.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun — configurez une clé ou Ollama</option>'}</select></label>
        <label class="champ"><span>Générateur d'images</span>
          <select id="img">${imgs.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun</option>'}</select></label>
        <label class="champ"><span>Animation des plans</span>
          <select id="vid"><option value="">Ken Burns local (gratuit, sans IA)</option>${vids.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select></label>
        <label class="champ"><span>Transcription des paroles</span>
          <select id="stt"><option value="">aucune</option>${stts.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="rang" style="margin-top:18px">
      <button class="btn or" id="lancer" style="padding:11px 26px">🎬 Lancer la production</button>
      <span style="color:var(--texte-faible);font-size:12.5px">Durée typique : 2 à 10 minutes selon les moteurs.</span>
    </div>
  </div>
  <div id="prog" style="display:none;margin-top:20px"></div>`));

  let asset = null;
  const dep = $('#depot'), inp = $('#fichier');
  dep.onclick = () => inp.click();
  dep.ondragover = e => { e.preventDefault(); dep.classList.add('survol'); };
  dep.ondragleave = () => dep.classList.remove('survol');
  dep.ondrop = e => { e.preventDefault(); dep.classList.remove('survol'); charger(e.dataTransfer.files[0]); };
  inp.onchange = () => charger(inp.files[0]);

  async function charger(f) {
    if (!f) return;
    dep.innerHTML = '<span class="tourne"></span> Envoi…';
    const fd = new FormData(); fd.append('fichier', f);
    try {
      asset = await api('/api/televerser', { method: 'POST', body: fd });
      $('#apres').style.display = '';
      $('#nomf').textContent = asset.nom;
      $('#poids').textContent = (asset.bytes / 1048576).toFixed(1) + ' Mo';
      $('#apercu').src = asset.url;
      dep.innerHTML = '<b style="color:var(--ok)">✓ Morceau chargé</b><p style="color:var(--texte-faible);font-size:12.5px">Cliquez pour en choisir un autre</p>';
    } catch (e) { toast(e.message, 'err'); dep.innerHTML = '<b style="color:var(--erreur)">Échec</b>'; }
  }

  $('#lancer').onclick = async () => {
    if (!asset) return toast('Chargez d\'abord un morceau.', 'err');
    const GENRES = {
      clip:        { suffixe: 'clip musical, plans rythmés, montage nerveux', densite: 8 },
      lyric:       { suffixe: 'lyric video, typographie forte, fonds abstraits sobres', densite: 12 },
      explicative: { suffixe: 'vidéo explicative, visuels clairs et didactiques, schémas', densite: 14 },
      audiogramme: { suffixe: 'audiogramme, fond fixe élégant, forme d\'onde, sous-titres lisibles', densite: 20 },
      pub:         { suffixe: 'spot publicitaire, produit mis en valeur, lumière soignée', densite: 6 },
      narratif:    { suffixe: 'court narratif, continuité des personnages et des lieux', densite: 10 },
      formation:   { suffixe: 'capsule pédagogique, une notion par plan, visuels épurés', densite: 14 },
      diaporama:   { suffixe: 'diaporama, transitions douces, mise en valeur des images', densite: 6 }
    };
    const g = GENRES[$('#genre').value] || GENRES.clip;
    const payload = {
      audioPath: asset.file, ratio: $('#ratio').value,
      genre: $('#genre').value,
      style: `${$('#style').value}. ${g.suffixe}`,
      secondesParPlan: g.densite,
      language: $('#langue').value, withLyrics: $('#karaoke').checked && Boolean($('#stt').value),
      lyricsProvider: $('#stt').value || 'openai-whisper',
      llm: { provider: $('#llm').value, model: '' },
      imageProvider: $('#img').value, videoProvider: $('#vid').value || null
    };
    if (!payload.llm.provider) return toast('Choisissez un scénariste (LLM).', 'err');
    if (!payload.imageProvider) return toast('Choisissez un générateur d\'images.', 'err');
    $('#lancer').disabled = true;
    try {
      const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'clip', payload, titre: asset.nom }) });
      suivre(job.id, $('#prog'));
    } catch (e) { toast(e.message, 'err'); $('#lancer').disabled = false; }
  };
};

/** Suivi SSE d'une tâche avec barre de progression. */
export function suivre(jobId, cible) {
  cible.style.display = '';
  cible.innerHTML = `<div class="carte"><div class="rang"><span class="tourne"></span><b id="et">Démarrage…</b>
    <span class="etiq neutre" id="pc" style="margin-left:auto">0 %</span></div>
    <div class="barre"><i id="bb" style="width:0"></i></div>
    <div id="jr" style="margin-top:13px"></div>
    <pre id="jl" style="margin-top:11px;max-height:150px;overflow:auto;display:none"></pre></div>`;
  const es = new EventSource(`${API}/api/taches/${jobId}/flux`);
  es.onmessage = m => {
    const j = JSON.parse(m.data);
    const last = j.steps?.[j.steps.length - 1];
    $('#et', cible).textContent = last?.step ? `Étape : ${last.step}` : j.status;
    $('#pc', cible).textContent = (j.pct || 0) + ' %';
    $('#bb', cible).style.width = (j.pct || 0) + '%';
    const logs = (j.steps || []).filter(s => s.step).map(s => `• ${s.step}${s.scene ? ` (plan ${s.scene}/${s.total})` : ''}`).join('\n');
    if (logs) { const pre = $('#jl', cible); pre.style.display = ''; pre.textContent = logs; pre.scrollTop = 1e9; }
    if (j.status === 'terminé') {
      es.close();
      $('#et', cible).innerHTML = '<span style="color:var(--ok)">✓ Terminé</span>';
      cible.querySelector('.tourne')?.remove();
      const r = j.result || {};
      $('#jr', cible).innerHTML = r.url
        ? `<video src="${r.url}" controls style="width:100%;border-radius:10px;background:#000"></video>
           <div class="rang" style="margin-top:11px">
             <a class="btn or" href="${r.url}" download>⤓ Télécharger</a>
             <a class="btn" href="#/medias">Médiathèque</a>
             ${r.titre ? `<span class="etiq or">${esc(r.titre)}</span>` : ''}
             ${r.scenes ? `<span class="etiq neutre">${r.scenes} plans</span>` : ''}
             ${r.bpm ? `<span class="etiq neutre">${r.bpm} BPM</span>` : ''}
           </div>`
        : `<pre>${esc(JSON.stringify(r, null, 2)).slice(0, 2500)}</pre>`;
      toast('Production terminée ✓', 'ok');
    }
    if (j.status === 'échec') {
      es.close();
      cible.querySelector('.tourne')?.remove();
      $('#et', cible).innerHTML = '<span style="color:var(--erreur)">✕ Échec</span>';
      $('#jr', cible).innerHTML = `<div class="carte" style="border-color:var(--erreur)"><pre>${esc(j.error)}</pre></div>`;
    }
  };
  es.onerror = () => es.close();
}

// ═══════════════════════════════════════════════════════════════════════════
VUES.image = async (v) => {
  const fours = (await api('/api/fournisseurs')).filter(f => f.kind === 'image');
  const ok = fours.filter(f => f.configure);
  v.append(el(`
  <h1>Image et 3D</h1>
  <p class="sous">Visuels de scène, pochettes, affiches, visuels produit Etsy, maquettes de t-shirts.</p>
  <div class="carte">
    <label class="champ"><span>Description du visuel</span>
      <textarea id="pr" placeholder="Ex : tête de mort ornementale trash polka, encre rouge et noire, fond texturé béton, cadrage carré"></textarea></label>
    <div class="grille g2">
      <label class="champ"><span>Moteur</span><select id="mo">${ok.map(f => `<option value="${f.id}">${esc(f.label)}${f.tier === 'local-gratuit' ? ' · gratuit' : ''}</option>`).join('') || '<option value="">aucun configuré</option>'}</select></label>
      <label class="champ"><span>Format</span><select id="sz">
        <option value="1024x1024">Carré 1024</option><option value="1792x1024">Paysage 16:9</option>
        <option value="1024x1792">Portrait 9:16</option></select></label>
    </div>
    <label class="champ"><span>À éviter (si pris en charge)</span><input id="ng" placeholder="flou, texte déformé, filigrane"></label>
    <button class="btn or" id="go">Générer</button>
  </div>
  <div id="prog"></div>
  <div class="grille g3" id="res" style="margin-top:18px"></div>`));
  $('#go').onclick = async () => {
    if (!$('#mo').value) return toast('Configurez un moteur image dans le Coffre.', 'err');
    const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'image',
      payload: { provider: $('#mo').value, prompt: $('#pr').value, size: $('#sz').value, negative: $('#ng').value } }) });
    suivre(job.id, $('#prog'));
  };
};

VUES.video = async (v) => {
  const fours = (await api('/api/fournisseurs')).filter(f => f.kind === 'video' && f.configure && f.id !== 'ffmpeg');
  v.append(el(`
  <h1>Vidéo</h1>
  <p class="sous">Génération de plans animés à partir d'un texte ou d'une image clé.</p>
  <div class="carte">
    <label class="champ"><span>Description du plan</span><textarea id="pr" placeholder="Travelling avant sur une rue mouillée la nuit, reflets de néons"></textarea></label>
    <div class="grille g2">
      <label class="champ"><span>Moteur</span><select id="mo">${fours.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun configuré — utilisez Musique → Clip en mode local</option>'}</select></label>
      <label class="champ"><span>Durée</span><select id="du"><option>5</option><option>8</option><option>10</option></select></label>
    </div>
    <label class="champ"><span>Image de départ (URL, facultatif)</span><input id="im" type="url" placeholder="https://…"></label>
    <button class="btn or" id="go">Générer</button>
  </div>
  <div id="prog"></div>`));
  $('#go').onclick = async () => {
    if (!$('#mo').value) return toast('Aucun moteur vidéo configuré.', 'err');
    const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'video',
      payload: { provider: $('#mo').value, prompt: $('#pr').value, duration: +$('#du').value, imageUrl: $('#im').value || null } }) });
    suivre(job.id, $('#prog'));
  };
};

VUES.paroles = async (v) => {
  const fours = await api('/api/fournisseurs');
  const stt = fours.filter(f => f.kind === 'stt' && f.configure);
  const tts = fours.filter(f => f.kind === 'audio' && f.configure);
  v.append(el(`
  <h1>Paroles et voix</h1>
  <p class="sous">Transcription horodatée mot à mot pour le karaoké, et synthèse vocale pour les voix off.</p>
  <div class="onglets"><button class="actif" data-o="t">Transcrire</button><button data-o="v">Voix off</button></div>
  <div id="ot">
    <div class="depot" id="dep"><div style="font-size:30px;opacity:.5">♪</div><b>Déposez un audio</b><input type="file" id="f" accept="audio/*" hidden></div>
    <div class="carte" style="margin-top:14px">
      <div class="grille g2">
        <label class="champ"><span>Moteur</span><select id="mo">${stt.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun</option>'}</select></label>
        <label class="champ"><span>Langue</span><select id="lg"><option value="fr">Français</option><option value="en">Anglais</option></select></label>
      </div>
      <button class="btn or" id="go" disabled>Transcrire</button>
    </div>
  </div>
  <div id="ov" style="display:none">
    <div class="carte">
      <label class="champ"><span>Texte à dire</span><textarea id="tx" placeholder="Votre texte…"></textarea></label>
      <label class="champ"><span>Moteur</span><select id="tm">${tts.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun</option>'}</select></label>
      <button class="btn or" id="tgo">Synthétiser</button>
    </div>
  </div>
  <div id="prog"></div>`));
  v.querySelectorAll('.onglets button').forEach(b => b.onclick = () => {
    v.querySelectorAll('.onglets button').forEach(x => x.classList.remove('actif')); b.classList.add('actif');
    $('#ot').style.display = b.dataset.o === 't' ? '' : 'none';
    $('#ov').style.display = b.dataset.o === 'v' ? '' : 'none';
  });
  let a = null;
  $('#dep').onclick = () => $('#f').click();
  $('#f').onchange = async () => {
    const fd = new FormData(); fd.append('f', $('#f').files[0]);
    a = await api('/api/televerser', { method: 'POST', body: fd });
    $('#dep').innerHTML = `<b style="color:var(--ok)">✓ ${esc(a.nom)}</b>`; $('#go').disabled = false;
  };
  $('#go').onclick = async () => {
    const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'transcription',
      payload: { provider: $('#mo').value, filePath: a.file, language: $('#lg').value } }) });
    suivre(job.id, $('#prog'));
  };
  $('#tgo').onclick = async () => {
    const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'voix',
      payload: { provider: $('#tm').value, text: $('#tx').value } }) });
    suivre(job.id, $('#prog'));
  };
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.modeles = async (v) => {
  const f = await api('/api/fournisseurs');
  const tiers = { 'cloud-payant': 'Cloud — à l\'usage', 'cloud-gratuit': 'Cloud — offre gratuite disponible', 'local-gratuit': 'Local — 100 % gratuit' };
  v.append(el(`<h1>Modèles IA</h1><p class="sous">${f.length} moteurs. Les clés restent dans le coffre chiffré du serveur : le navigateur ne les voit jamais.</p>`));
  for (const [t, titre] of Object.entries(tiers)) {
    const list = f.filter(x => x.tier === t);
    v.append(el(`<h2>${titre} <span class="etiq neutre">${list.filter(x => x.configure).length}/${list.length}</span></h2>`));
    v.append(el(`<div class="grille g3">${list.map(p => `
      <div class="carte">
        <div class="rang" style="justify-content:space-between;margin-bottom:7px">
          <b>${esc(p.label)}</b>
          <span class="etiq ${p.configure ? 'ok' : 'att'}">${p.configure ? 'prêt' : 'à configurer'}</span>
        </div>
        <div style="font-size:11.5px;color:var(--texte-faible);margin-bottom:9px">${(p.modalities || []).join(' · ')}</div>
        ${p.models?.length ? `<div style="font-size:11px;color:var(--texte-doux);margin-bottom:10px">${p.models.slice(0, 3).map(m => `<code>${esc(m)}</code>`).join(' ')}</div>` : ''}
        <div class="rang">
          <button class="btn mini" data-ping="${p.id}">Tester</button>
          ${p.tier === 'local-gratuit'
            ? `<a class="btn mini" href="${p.install}" target="_blank">Installer</a>`
            : `<a class="btn mini" href="#/coffre">Clé</a>${p.docs ? `<a class="btn mini" href="${p.docs}" target="_blank">Obtenir</a>` : ''}`}
          ${p.freeTier ? '<span class="etiq info">palier gratuit</span>' : ''}
        </div>
        <div class="pr" style="margin-top:9px;font-size:11.5px"></div>
      </div>`).join('')}</div>`));
  }
  v.querySelectorAll('[data-ping]').forEach(b => b.onclick = async () => {
    const box = b.closest('.carte').querySelector('.pr');
    box.innerHTML = '<span class="tourne"></span>';
    try {
      const r = await api(`/api/fournisseurs/${b.dataset.ping}/ping`);
      box.innerHTML = r.ok
        ? `<span style="color:var(--ok)">✓ joignable${r.models?.length ? ` — ${r.models.length} modèle(s)` : ''}</span>`
        : `<span style="color:var(--alerte)">${esc(r.error || 'injoignable')}</span>`;
    } catch (e) { box.innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  });
};

VUES.systeme = async (v) => {
  let d = await api('/api/systeme');
  const G = { haute: ['var(--alerte)', 'à traiter'], moyenne: ['var(--or)', 'recommandé'], info: ['var(--texte-faible)', 'à savoir'] };
  function rendre() {
    const e = d.etat || {};
    v.innerHTML = '';
    v.append(el(`<h1>Cerveau du système</h1>
    <p class="sous">Clipia observe cette machine, garde la trace de ce qu'il voit, en tire des conclusions et te propose des améliorations. Il n'applique rien sans ton clic, et un refus de ta part est mémorisé : il ne le reproposera pas.</p>
    <div class="grille g2">
      <div class="carte"><b>État</b><div style="font-size:13px;color:var(--texte-doux);margin-top:8px;line-height:1.7">
        ${esc(e.systeme || '—')} · ${e.cpus || '?'} cœurs · RAM ${e.ramLibreGo ?? '?'} / ${e.ramGo ?? '?'} Go libres<br>
        Disque : ${e.disque ? `${e.disque.libreGo} Go libres sur ${e.disque.totalGo} (${e.disque.pct} % utilisé)` : '—'}<br>
        Réseau : ${e.reseau ? 'connecté' : 'hors ligne'} · Ollama : ${e.ollama?.present ? e.ollama.modeles + ' modèle(s)' : 'absent'}<br>
        Données : ${e.persistance?.live ? (e.persistance.donneesPersistantes ? 'conservées sur la clé' : '<span style="color:var(--alerte)">non conservées</span>') : 'sur le disque'} · Souvenirs : ${e.souvenirs ?? 0}<br>
        <span style="color:var(--texte-faible)">Observé : ${esc((e.quand || '').slice(0, 16).replace('T', ' '))}</span></div>
        <div class="rang" style="margin-top:12px"><button class="btn mini" id="sy-obs">Observer maintenant</button><button class="btn mini" id="sy-cons">Demander conseil</button></div></div>
      <div class="carte"><b>Recommandations (${d.recommandations.length})</b><div id="sy-recos" style="margin-top:8px"></div></div>
    </div><div id="sy-conseil" class="carte" style="margin-top:14px;white-space:pre-wrap;font-size:13.5px" hidden></div>`));
    $('#sy-recos').innerHTML = d.recommandations.map(r => `<div style="border-left:3px solid ${G[r.gravite][0]};padding:4px 10px;margin:8px 0">
      <div style="font-size:11px;color:${G[r.gravite][0]}">${G[r.gravite][1]}</div><b>${esc(r.titre)}</b>
      <div style="font-size:12.5px;color:var(--texte-doux);margin:3px 0">${esc(r.pourquoi)}</div>
      <ol style="margin:4px 0 6px 18px;padding:0;font-size:12.5px">${r.instructions.map(i => `<li>${esc(i)}</li>`).join('')}</ol>
      <div class="rang" style="gap:6px">${r.commande ? `<button class="btn or mini" data-ap="${esc(r.id)}" title="${esc(r.commande)}">Appliquer</button>` : ''}
        ${r.id.startsWith('lecon-') ? '' : `<button class="btn mini" data-dec="reporte" data-id="${esc(r.id)}">Plus tard</button><button class="btn mini" data-dec="refuse" data-id="${esc(r.id)}">Non merci</button>`}</div></div>`).join('') ||
      '<div style="color:var(--ok)">✓ Rien à signaler pour l\'instant.</div>';
    $('#sy-obs').onclick = async () => { d = await api('/api/systeme/observer', { method: 'POST', body: '{}' }); d.decisions = {}; rendre(); toast('État relevé', 'ok'); };
    $('#sy-cons').onclick = async () => { $('#sy-conseil').hidden = false; $('#sy-conseil').textContent = 'Réflexion…';
      const r = await api('/api/systeme/conseil', { method: 'POST', body: '{}' });
      $('#sy-conseil').textContent = (r.modele ? '' : (r.note ? r.note + '\n\n' : '')) + r.texte; };
    v.querySelectorAll('[data-dec]').forEach(b => b.onclick = async () => { await api('/api/systeme/decider', { method: 'POST', body: JSON.stringify({ id: b.dataset.id, choix: b.dataset.dec }) });
      d.recommandations = d.recommandations.filter(r => r.id !== b.dataset.id); rendre(); });
    v.querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => {
      if (!confirm('Lancer cette commande sur la machine ?\n\n' + b.title)) return;
      b.disabled = true;
      try { const r = await api('/api/systeme/appliquer', { method: 'POST', headers: { 'x-clipia-accord': '1' }, body: JSON.stringify({ id: b.dataset.ap }) });
        toast(r.code === 0 ? 'Appliqué' : 'La commande a échoué (code ' + r.code + ')', r.code === 0 ? 'ok' : 'err');
        d = await api('/api/systeme/observer', { method: 'POST', body: '{}' }); rendre(); } catch (e) { toast(e.message, 'err'); b.disabled = false; }
    });
  }
  rendre();
};

VUES.souvenirs = async (v) => {
  let genre = '', q = '';
  const ICONE = { conversation: '💬', web: '🌐', machine: '⌨', fichier: '📄', creation: '🎨', projet: '📁', agent: '🤖', erreur: '⚠', decision: '⚖', lecon: '💡', note: '📝' };
  v.append(el(`<h1>Mémoire totale</h1>
  <p class="sous">Clipia garde la trace de tout ce qu'il fait avec toi : conversations, recherches web, travail sur la machine, fichiers, créations, projets, agents, erreurs. Tout reste sur ta machine. Les clés, mots de passe et numéros de carte sont masqués avant d'être écrits.</p>
  <div class="carte" id="sv-reprise" style="margin-bottom:14px"></div>
  <div class="rang" style="flex-wrap:wrap;margin-bottom:12px">
    <input id="sv-q" placeholder="Chercher dans tout l'historique…" style="flex:1;min-width:220px">
    <select id="sv-g" style="width:auto"><option value="">Tout</option>${Object.keys(ICONE).map(g => `<option value="${g}">${g}</option>`).join('')}</select>
  </div>
  <div class="rang" style="flex-wrap:wrap;margin-bottom:14px">
    <button class="btn mini" id="sv-bilan">Bilan du jour</button><button class="btn mini" id="sv-refl">Réfléchir (tirer des leçons)</button>
    <a class="btn mini" id="sv-exp" href="${API}/api/archive/exporter" download="clipia-memoire.json">Exporter</a>
    <button class="btn mini" id="sv-pause"></button><button class="btn mini" id="sv-vider" style="color:var(--alerte)">Tout effacer</button>
  </div>
  <div id="sv-info" style="white-space:pre-wrap;font-size:13px;color:var(--texte-doux);margin-bottom:12px"></div>
  <div id="sv-l" style="display:grid;gap:6px"></div>`));
  const stats = (s) => {
    $('#sv-pause').textContent = s.enPause ? '▶ Reprendre l\'enregistrement' : '⏸ Mettre en pause';
    $('#sv-reprise').dataset.total = s.total;
  };
  async function charger() {
    const d = await api('/api/archive?' + new URLSearchParams({ q, genre }));
    stats(d.stats);
    $('#sv-l').innerHTML = d.entrees.map(e => `<div class="carte" style="padding:10px 14px">
      <div class="rang" style="justify-content:space-between;gap:8px"><span style="font-size:12px;color:var(--texte-faible)">${ICONE[e.genre] || '•'} ${esc(e.genre)} · ${esc(e.quand.slice(0, 16).replace('T', ' '))}${e.externe ? ' · externe' : ''}${e.ok === false ? ' · échec' : ''}</span>
      <span style="cursor:pointer;color:var(--texte-faible)" data-d="${e.id}" title="Supprimer ce souvenir">×</span></div>
      <div style="font-size:13.5px;margin-top:4px"><b>${esc(e.titre)}</b> ${esc(e.texte.slice(0, 300))}</div></div>`).join('') || '<div class="vide">Rien pour l\'instant — le journal se remplit au fil de ton travail avec Clipia.</div>';
    $('#sv-l').querySelectorAll('[data-d]').forEach(x => x.onclick = async () => {
      await api('/api/archive/' + x.dataset.d, { method: 'DELETE', headers: { 'x-clipia-accord': '1' } }); charger(); });
    const r = await api('/api/archive/reprise');
    $('#sv-reprise').innerHTML = `<b>Où on en était</b><div style="font-size:13px;color:var(--texte-doux);margin-top:6px">
      ${d.stats.total} souvenirs · ${Object.entries(d.stats.parGenre).map(([g, n]) => `${esc(g)} ${n}`).join(' · ') || 'vide'}<br>
      ${r.dernieresActions.map(a => '• ' + esc(a.titre)).join('<br>') || 'Aucune action récente.'}
      ${r.echecsRecents.length ? '<br><span style="color:var(--alerte)">À reprendre : ' + esc(r.echecsRecents[0].titre) + '</span>' : ''}</div>`;
  }
  let tempo; $('#sv-q').oninput = e => { q = e.target.value; clearTimeout(tempo); tempo = setTimeout(charger, 250); };
  $('#sv-g').onchange = e => { genre = e.target.value; charger(); };
  $('#sv-bilan').onclick = async () => { const b = await api('/api/archive/bilan?jours=1');
    $('#sv-info').textContent = `Bilan (${b.periode}) : ${b.entrees} événements, ${b.conversations} messages de toi, ${b.commandes} commandes.\nRecherches web : ${b.recherchesWeb.join(' ; ') || '—'}\nCréations : ${b.creations.join(' ; ') || '—'}\nFichiers : ${b.fichiers.join(' ; ') || '—'}\nÉchecs : ${b.echecs.join(' ; ') || 'aucun'}`; };
  $('#sv-refl').onclick = async () => { const r = await api('/api/archive/reflechir', { method: 'POST', body: '{}' });
    $('#sv-info').textContent = `Réflexion : ${r.examine} événements examinés.\n` + (r.nouvellesLecons.length ? 'Nouvelles leçons :\n• ' + r.nouvellesLecons.join('\n• ') : 'Aucune nouvelle leçon (pas d\'échec répété).'); charger(); };
  $('#sv-pause').onclick = async () => { const s = await api('/api/archive/pause', { method: 'POST', body: JSON.stringify({ pause: $('#sv-pause').textContent.includes('Mettre') }) }); stats(s); toast(s.enPause ? 'Enregistrement en pause' : 'Enregistrement repris', 'ok'); };
  $('#sv-vider').onclick = async () => { if (!confirm('Effacer TOUT le journal ? Impossible à annuler.')) return;
    const r = await api('/api/archive/tout', { method: 'DELETE', headers: { 'x-clipia-accord': '1' } }); toast(r.supprimes + ' souvenirs effacés', 'ok'); charger(); };
  await charger();
};

VUES['centre-ia'] = async (v) => {
  const d = await api('/api/centre-ia'); let fam = '', q = '';
  v.append(el(`<h1>Centre des IA</h1>
  <p class="sous">Modèles gratuits installables en un clic (via Ollama). Mode 100 % local : aucune donnée ne sort. ${d.ollama ? '' : '<b>Ollama n\'est pas détecté</b> — <a href="https://ollama.com/download" target="_blank">l\'installer</a>.'}</p>
  <p style="font-size:12px;color:var(--texte-faible)">${esc(d.note)} Ta machine : ${d.ramGo} Go de RAM.</p>
  <div class="rang" style="margin:12px 0;flex-wrap:wrap"><input id="ci-q" placeholder="Rechercher…" style="max-width:240px">
  <select id="ci-f" style="width:auto"><option value="">Toutes les familles</option>${d.familles.map(f => `<option>${esc(f)}</option>`).join('')}</select></div>
  <div class="grille g2" id="ci-l"></div>`));
  const dessiner = () => {
    $('#ci-l').innerHTML = d.modeles.filter(m => (!fam || m.famille === fam) && (!q || (m.nom + m.famille + m.caps.join(' ')).toLowerCase().includes(q))).map(m => `
      <div class="carte"><div class="rang" style="justify-content:space-between"><b>${esc(m.nom)}</b><span class="etiq neutre">${esc(m.etat)}</span></div>
      <div style="font-size:12px;color:var(--texte-doux);margin:6px 0">${esc(m.famille)} · ${esc(m.caps.join(', '))} (déclaré) · ${m.go} Go · RAM ${m.ram} Go · ${esc(m.cout)}<br>Licence : ${esc(m.licence)} · <a href="${esc(m.source)}" target="_blank">fiche officielle</a></div>
      <div class="barre" hidden><i style="width:0"></i></div>
      ${m.etat === 'disponible' ? `<button class="btn or mini" data-i="${esc(m.nom)}">Installer</button>` : ''}</div>`).join('') || '<div class="vide">Aucun résultat.</div>';
    $('#ci-l').querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const carte = b.closest('.carte'), bar = carte.querySelector('.barre'); b.disabled = true; bar.hidden = false;
      try {
        const r = await fetch(API + '/api/modeles-locaux/installer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modele: b.dataset.i }) });
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', fin = false;
        while (true) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); const l = buf.split('\n'); buf = l.pop();
          for (const L of l) if (L.startsWith('data:')) { const e = JSON.parse(L.slice(5)); if (e.erreur) throw new Error(e.erreur); if (e.pct != null) bar.firstChild.style.width = e.pct + '%'; if (e.fini) fin = true; } }
        if (!fin) throw new Error('Téléchargement interrompu.');
        d.modeles.find(m => m.nom === b.dataset.i).etat = 'installé'; toast('Installé : ' + b.dataset.i, 'ok'); dessiner();
      } catch (e) { toast(e.message, 'err'); b.disabled = false; }
    });
  };
  $('#ci-q').oninput = e => { q = e.target.value.toLowerCase(); dessiner(); };
  $('#ci-f').onchange = e => { fam = e.target.value; dessiner(); };
  dessiner();
};

VUES.locales = async (v) => {
  const f = (await api('/api/fournisseurs')).filter(x => x.tier === 'local-gratuit');
  v.append(el(`
  <h1>IA locales — gratuites et hors ligne</h1>
  <p class="sous">Clipia fonctionne entièrement sans abonnement IA : vos modèles tournent sur votre machine, vos données ne sortent jamais.</p>
  <div class="carte" style="background:linear-gradient(135deg,rgba(61,220,151,.1),transparent);border-color:var(--ok);margin-bottom:18px">
    <b>Chaîne 100 % gratuite recommandée</b>
    <p style="color:var(--texte-doux);margin-top:6px">Ollama (scénario) + ComfyUI ou Automatic1111 (visuels) + whisper.cpp (paroles) + FFmpeg (montage). Aucun coût, aucune limite.</p>
  </div>
  <div class="grille g2" id="L">${f.map(p => `
    <div class="carte" data-id="${p.id}">
      <div class="rang" style="justify-content:space-between">
        <b>${esc(p.label)}</b><span class="etiq neutre et">sonde…</span>
      </div>
      <div style="font-size:11.5px;color:var(--texte-faible);margin:6px 0 10px">${(p.modalities || []).join(' · ')} · <code>${esc(p.base)}</code></div>
      <div class="mo" style="font-size:11.5px;color:var(--texte-doux);margin-bottom:9px"></div>
      <div class="rang">
        <a class="btn mini" href="${p.install}" target="_blank">Installer ${esc(p.label.split(' ')[0])}</a>
        <button class="btn mini" data-r="${p.id}">Re-sonder</button>
      </div>
    </div>`).join('')}</div>`));
  const sonder = async id => {
    const c = v.querySelector(`[data-id="${id}"]`);
    c.querySelector('.et').textContent = 'sonde…'; c.querySelector('.et').className = 'etiq neutre et';
    try {
      const r = await api(`/api/fournisseurs/${id}/ping`);
      const e = c.querySelector('.et');
      e.textContent = r.ok ? 'actif' : 'non détecté';
      e.className = 'etiq et ' + (r.ok ? 'ok' : 'neutre');
      c.querySelector('.mo').innerHTML = r.models?.length ? r.models.slice(0, 8).map(m => `<code>${esc(m)}</code>`).join(' ') : '';
    } catch {}
  };
  f.forEach(p => sonder(p.id));
  v.querySelectorAll('[data-r]').forEach(b => b.onclick = () => sonder(b.dataset.r));
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.connecteurs = async (v) => {
  const d = await api('/api/connecteurs');
  v.append(el(`
  <h1>Connecteurs</h1>
  <p class="sous">${d.items.length} services. Déclarez cette URL de redirection dans chaque console développeur :</p>
  <div class="carte" style="margin-bottom:20px"><code style="font-size:12.5px">${esc(d.redirection)}</code>
    <button class="btn mini" id="cp" style="margin-left:10px">Copier</button></div>`));
  $('#cp').onclick = () => { navigator.clipboard.writeText(d.redirection); toast('URL copiée', 'ok'); };
  for (const g of d.groupes) {
    const list = d.items.filter(x => x.group === g);
    v.append(el(`<h2>${g} <span class="etiq neutre">${list.filter(x => x.connecte).length}/${list.length}</span></h2>`));
    v.append(el(`<div class="grille g3">${list.map(c => `
      <div class="carte" data-c="${c.id}">
        <div class="rang" style="justify-content:space-between;margin-bottom:6px">
          <b style="display:flex;align-items:center;gap:7px"><i style="width:9px;height:9px;border-radius:3px;background:${c.color};display:inline-block"></i>${esc(c.label)}</b>
          <span class="etiq ${c.connecte ? 'ok' : c.configure ? 'info' : 'att'}">${c.connecte ? 'connecté' : c.configure ? 'prêt' : 'à configurer'}</span>
        </div>
        <div style="font-size:11.5px;color:var(--texte-faible);margin-bottom:10px">${(c.actions || []).slice(0, 3).join(' · ')}</div>
        ${c.note ? `<div style="font-size:11px;color:var(--texte-doux);margin-bottom:9px;font-style:italic">${esc(c.note)}</div>` : ''}
        <div class="rang">
          ${c.auth === 'oauth2' || c.auth === 'oauth2-client'
            ? (c.connecte ? `<button class="btn mini danger" data-off="${c.id}">Déconnecter</button>`
                          : `<button class="btn mini or" data-on="${c.id}" ${c.needsShop ? 'data-shop=1' : ''}>Connecter</button>`)
            : `<a class="btn mini" href="#/coffre">Renseigner la clé</a>`}
          ${c.console ? `<a class="btn mini" href="${c.console}" target="_blank">Console</a>` : ''}
        </div>
      </div>`).join('')}</div>`));
  }
  v.querySelectorAll('[data-on]').forEach(b => b.onclick = async () => {
    try {
      const shop = b.dataset.shop ? prompt('Nom de votre boutique Shopify (sans .myshopify.com) :') : '';
      const r = await api('/api/connecteurs/connexion', { method: 'POST', body: JSON.stringify({ id: b.dataset.on, shop }) });
      window.open(r.url, '_blank', 'width=620,height=760');
      toast('Autorisez l\'accès dans la fenêtre ouverte, puis rafraîchissez.');
    } catch (e) { toast(e.message, 'err'); }
  });
  v.querySelectorAll('[data-off]').forEach(b => b.onclick = async () => {
    await api('/api/connecteurs/' + b.dataset.off, { method: 'DELETE' }); toast('Déconnecté', 'ok'); route();
  });
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.coffre = async (v) => {
  const [inv, fours, conns] = await Promise.all([api('/api/coffre'), api('/api/fournisseurs'), api('/api/connecteurs')]);
  const has = id => inv.find(x => x.id === id);
  v.append(el(`
  <h1>Coffre de clés</h1>
  <p class="sous">Chiffrement AES-256-GCM au repos. Les valeurs ne sont jamais renvoyées au navigateur — seulement un indice masqué.</p>`));

  v.append(el(`<h2>Clés des modèles IA</h2>`));
  const cloud = fours.filter(f => f.envKey && f.tier !== 'local-gratuit');
  v.append(el(`<div class="liste">${cloud.map(f => {
    const k = `provider:${f.id}`, e = has(k);
    return `<div data-k="${k}">
      <b style="min-width:180px">${esc(f.label)}</b>
      <input type="password" placeholder="${e ? esc(e.hint) : (f.configure ? 'défini via ' + f.envKey : 'coller la clé…')}" style="flex:1;max-width:340px">
      <button class="btn mini or">Enregistrer</button>
      ${e ? '<button class="btn mini danger" data-del>×</button>' : ''}
      ${f.docs ? `<a class="btn mini" href="${f.docs}" target="_blank">Obtenir</a>` : ''}
    </div>`; }).join('')}</div>`));

  v.append(el(`<h2>Applications des connecteurs (OAuth)</h2>`));
  const oc = conns.items.filter(c => c.idKey);
  v.append(el(`<div class="liste">${oc.map(c => `
    <div data-k="connector:${c.id}:id">
      <b style="min-width:150px">${esc(c.label)}</b>
      <input type="password" placeholder="${has('connector:' + c.id + ':id')?.hint || 'client_id'}" style="flex:1;max-width:200px">
      <input type="password" placeholder="${has('connector:' + c.id + ':secret')?.hint || 'client_secret'}" data-sec style="flex:1;max-width:200px">
      <button class="btn mini or">Enregistrer</button>
    </div>`).join('')}</div>`));

  v.append(el(`<h2>Paiements</h2>
  <div class="liste">
    ${[['connector:stripe:id','Stripe — clé secrète','sk_live_…'],
       ['stripe:webhook','Stripe — secret de webhook','whsec_…'],
       ['stripe:price:pro','Tarif Pro (9,90 €/mois)','price_…']].map(([k, l, ph]) => `
      <div data-k="${k}"><b style="min-width:200px">${l}</b>
        <input type="password" placeholder="${has(k)?.hint || ph}" style="flex:1;max-width:320px">
        <button class="btn mini or">Enregistrer</button></div>`).join('')}
  </div>`));

  v.querySelectorAll('[data-k]').forEach(row => {
    const inputs = row.querySelectorAll('input');
    row.querySelector('.or').onclick = async () => {
      const k = row.dataset.k;
      try {
        if (inputs[0].value) await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: k, valeur: inputs[0].value }) });
        const sec = row.querySelector('[data-sec]');
        if (sec?.value) await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: k.replace(':id', ':secret'), valeur: sec.value }) });
        inputs.forEach(i => i.value = '');
        toast('Enregistré dans le coffre ✓', 'ok'); route();
      } catch (e) { toast(e.message, 'err'); }
    };
    row.querySelector('[data-del]')?.addEventListener('click', async () => {
      await api('/api/coffre/' + encodeURIComponent(row.dataset.k), { method: 'DELETE' }); toast('Supprimé', 'ok'); route();
    });
  });
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.taches = async (v) => {
  const js = await api('/api/taches');
  v.append(el(`<h1>File de tâches</h1><p class="sous">Toutes les productions, en cours et passées.</p>`));
  if (!js.length) return v.append(el(`<div class="vide"><div class="em">⧗</div>Aucune tâche. Lancez une production depuis <a href="#/clip">Musique → Clip</a>.</div>`));
  v.append(el(`<div class="liste">${js.map(j => `
    <div>
      <span class="puce ${j.status === 'terminé' ? 'ok' : j.status === 'échec' ? 'err' : 'att'}"></span>
      <div style="flex:1;min-width:0">
        <b>${esc(j.titre || j.type)}</b>
        <div style="font-size:11.5px;color:var(--texte-faible)">${esc(j.type)} · ${new Date(j.createdAt).toLocaleString('fr-FR')}</div>
      </div>
      <span class="etiq ${j.status === 'terminé' ? 'ok' : j.status === 'échec' ? 'err' : 'att'}">${esc(j.status)} ${j.pct ? j.pct + ' %' : ''}</span>
      ${j.result?.url ? `<a class="btn mini" href="${j.result.url}" target="_blank">Ouvrir</a>` : ''}
      ${['en attente','en cours'].includes(j.status) ? `<button class="btn mini" data-s="${j.id}">Suivre</button>` : ''}
    </div>`).join('')}</div><div id="prog" style="margin-top:16px"></div>`));
  v.querySelectorAll('[data-s]').forEach(b => b.onclick = () => suivre(b.dataset.s, $('#prog')));
};

VUES.medias = async (v) => {
  const m = await api('/api/medias');
  v.append(el(`<h1>Médiathèque</h1><p class="sous">${m.length} fichier(s) produits ou importés.</p>`));
  if (!m.length) return v.append(el(`<div class="vide"><div class="em">▦</div>Rien encore.</div>`));
  v.append(el(`<div class="grille g3">${m.map(a => `
    <div class="media">
      ${a.ext === 'mp4' ? `<video src="${a.url}" controls preload="metadata"></video>`
        : /png|jpg|jpeg|webp/.test(a.ext || '') ? `<img src="${a.url}" loading="lazy">`
        : /mp3|wav|m4a|flac/.test(a.ext || '') ? `<div style="padding:26px;text-align:center;font-size:28px;opacity:.4">♪</div><audio src="${a.url}" controls style="width:100%"></audio>`
        : `<div style="padding:34px;text-align:center;opacity:.4">⬚</div>`}
      <div class="bas"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.nom || a.kind || a.ext)}</span>
        <a href="${a.url}" download>⤓</a></div>
    </div>`).join('')}</div>`));
};

VUES.workflows = async (v) => {
  const ws = await api('/api/workflows');
  v.append(el(`
  <h1>Workflows</h1>
  <p class="sous">Enchaînez les étapes : un morceau arrive, Clipia produit le clip, en tire un extrait vertical, puis publie partout.</p>
  <div class="carte" style="margin-bottom:18px">
    <b>Modèles prêts à l'emploi</b>
    <div class="grille g2" style="margin-top:12px">
      ${[['Sortie complète','Clip 16:9 → extrait 9:16 → publication YouTube + TikTok','clip,clip,publication,publication'],
         ['Teaser quotidien','Extrait 15 s vertical publié chaque jour','clip,publication'],
         ['Pack visuel','5 visuels de pochette + déclinaison carrée Instagram','image,image'],
         ['Transcription + sous-titres','Paroles mot à mot et export .ass karaoké','paroles']].map(([t, d, s]) => `
        <div class="carte carte-2" style="background:var(--carte-2)">
          <b>${t}</b><p style="color:var(--texte-doux);font-size:12.5px;margin:5px 0 10px">${d}</p>
          <button class="btn mini or" data-m="${s}" data-t="${t}">Créer</button>
        </div>`).join('')}
    </div>
  </div>
  <h2>Vos workflows</h2>
  ${ws.length ? `<div class="liste">${ws.map(w => `<div><b style="flex:1">${esc(w.nom)}</b>
    <span class="etiq neutre">${(w.steps || []).length} étapes</span>
    <button class="btn mini danger" data-d="${w.id}">Supprimer</button></div>`).join('')}</div>`
  : `<div class="vide"><div class="em">⇄</div>Aucun workflow enregistré.</div>`}`));
  v.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
    await api('/api/workflows', { method: 'POST', body: JSON.stringify({
      nom: b.dataset.t, steps: b.dataset.m.split(',').map(t => ({ type: t, payload: {} })) }) });
    toast('Workflow créé ✓', 'ok'); route();
  });
  v.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    await api('/api/workflows/' + b.dataset.d, { method: 'DELETE' }); route();
  });
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.abonnement = async (v) => {
  const d = await api('/api/abonnement');
  const act = d.actuel;
  v.append(el(`<h1>Abonnement</h1><p class="sous">Plan actuel : <b style="color:var(--or)">${esc(act.label)}</b>${act.subscription?.renewsAt ? ` · renouvellement le ${new Date(act.subscription.renewsAt).toLocaleDateString('fr-FR')}` : ''}</p>`));

  v.append(el(`<div class="grille g4" style="margin-bottom:22px">${d.quotas.filter(q => q.limit !== undefined).map(q => `
    <div class="stat">
      <div class="v" style="font-size:20px">${q.illimite ? '∞' : `${q.used || 0}<span style="font-size:13px;color:var(--texte-faible)">/${q.limit}</span>`}</div>
      <div class="k">${q.ressource}</div>
      ${q.illimite ? '' : `<div class="barre"><i style="width:${Math.min(100, ((q.used || 0) / q.limit) * 100)}%"></i></div>`}
    </div>`).join('')}</div>`));

  v.append(el(`<div class="grille g2">${d.plans.map(p => `
    <div class="carte" style="${p.id === act.id ? 'border-color:var(--or);box-shadow:0 0 0 1px var(--or)' : ''}${p.popular ? ';background:linear-gradient(160deg,rgba(224,178,92,.08),transparent)' : ''}">
      <div class="rang" style="justify-content:space-between">
        <b style="font-size:16px">${esc(p.label)}</b>
        ${p.popular ? '<span class="etiq or">populaire</span>' : ''}${p.id === act.id ? '<span class="etiq ok">actuel</span>' : ''}
      </div>
      <div style="margin:9px 0 13px"><span style="font-size:30px;font-weight:750">${p.price === 0 ? 'Gratuit' : p.price + ' €'}</span>
        ${p.price ? `<span style="color:var(--texte-faible)">/${p.period}</span>` : ''}</div>
      <ul style="list-style:none;font-size:13px;color:var(--texte-doux);display:flex;flex-direction:column;gap:6px;margin-bottom:15px">
        ${p.features.map(f => `<li style="display:flex;gap:8px"><span style="color:var(--or)">✓</span>${esc(f)}</li>`).join('')}
      </ul>
      ${p.id === act.id
        ? (act.subscription?.customerId ? '<button class="btn" id="portail">Gérer mon abonnement</button>' : '<button class="btn" disabled>Plan actuel</button>')
        : p.price ? `<button class="btn or" data-p="${p.id}" style="width:100%">Choisir ${esc(p.label)}</button>`
                  : '<button class="btn" disabled style="width:100%">Plan gratuit</button>'}
    </div>`).join('')}</div>
  <div class="carte creux" style="margin-top:18px">
    <b>Rappel important</b>
    <p style="color:var(--texte-doux);margin-top:6px">Le plan Découverte reste pleinement utilisable : avec Ollama, ComfyUI et FFmpeg en local, les clips sont illimités et gratuits. L'abonnement ne sert qu'aux moteurs cloud et à la publication automatique.</p>
  </div>`));

  v.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
    try { const r = await api('/api/abonnement/checkout', { method: 'POST', body: JSON.stringify({ planId: b.dataset.p }) });
      location.href = r.url;
    } catch (e) { toast(e.message, 'err'); }
  });
  $('#portail')?.addEventListener('click', async () => {
    const r = await api('/api/abonnement/portail', { method: 'POST' }); location.href = r.url;
  });
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.production = async (v) => {
  const e = await api('/api/etat');
  const c = await api('/api/connecteurs');
  const checks = [
    ['Moteur IA disponible', e.fournisseurs.configures + e.fournisseurs.locauxActifs > 0, 'Au moins une clé cloud ou une IA locale active.'],
    ['FFmpeg installé', e.ffmpeg, 'Nécessaire pour le montage et l\'export.'],
    ['Coffre chiffré initialisé', true, 'Clé maîtresse AES-256 générée dans data/secrets.json.'],
    ['Connecteur de diffusion', c.items.some(x => x.connecte && x.group === 'Diffusion'), 'YouTube ou TikTok connecté pour publier automatiquement.'],
    ['Paiement configuré', c.items.some(x => x.id === 'stripe' && x.configure), 'Clé Stripe + secret de webhook + identifiants de tarifs.'],
    ['URL publique HTTPS', location.protocol === 'https:', 'Obligatoire pour les redirections OAuth en production.'],
    ['Sauvegarde', false, 'Planifier une copie du dossier data/ (Dropbox, Drive ou S3).'],
    ['Mentions légales et RGPD', false, 'Politique de confidentialité et conditions à publier avant ouverture au public.']
  ];
  v.append(el(`
  <h1>Mise en production</h1>
  <p class="sous">Ce que Clipia vérifie réellement sur votre installation, maintenant.</p>
  <div class="liste">${checks.map(([k, ok, d]) => `
    <div><span class="puce ${ok ? 'ok' : 'att'}"></span>
      <div style="flex:1"><b>${k}</b><div style="font-size:11.5px;color:var(--texte-faible)">${d}</div></div>
      <span class="etiq ${ok ? 'ok' : 'att'}">${ok ? 'OK' : 'à faire'}</span></div>`).join('')}</div>
  <h2>Déploiement</h2>
  <div class="grille g2">
    <div class="carte"><b>Serveur / VPS</b>
      <pre>git clone &lt;votre-dépôt&gt; clipia
cd clipia &amp;&amp; cp .env.example .env
node server/index.js
# derrière Caddy ou Nginx en HTTPS</pre></div>
    <div class="carte"><b>Docker</b>
      <pre>docker compose up -d
# expose le port 8787
# volume : ./data</pre></div>
    <div class="carte"><b>Bureau (Windows / Mac / Linux)</b>
      <pre>cd desktop
npm install
npm run build:win   # ou :mac / :linux</pre></div>
    <div class="carte"><b>Android / Play Store</b>
      <pre>cd android
npm install
npx cap sync android
npx cap open android   # puis Build &gt; AAB signé</pre></div>
  </div>`));
};

VUES.installer = async (v) => {
  v.append(el(`
  <h1>Installer et exporter</h1>
  <p class="sous">Clipia tourne partout : navigateur, application de bureau, téléphone, ou serveur.</p>
  <div class="grille g2">
    <div class="carte"><b>📱 Installer depuis ce navigateur</b>
      <p style="color:var(--texte-doux);font-size:13px;margin:7px 0 12px">Clipia est une application web installable (PWA). Un clic et elle s'ajoute à votre bureau ou à votre écran d'accueil Android.</p>
      <button class="btn or" id="pwa">Installer l'application</button>
      <div id="pwamsg" style="font-size:12px;color:var(--texte-faible);margin-top:8px"></div></div>
    <div class="carte"><b>🪟 Windows</b>
      <p style="color:var(--texte-doux);font-size:13px;margin:7px 0 10px">Clic droit sur <code>installers/installer-windows.ps1</code> → Exécuter avec PowerShell. Installe Node si besoin, puis lance Clipia.</p>
      <pre>powershell -ExecutionPolicy Bypass -File installers\\installer-windows.ps1</pre></div>
    <div class="carte"><b>🍎 macOS / 🐧 Linux</b>
      <pre>bash installers/installer-unix.sh</pre>
      <p style="color:var(--texte-doux);font-size:12.5px;margin-top:8px">Installe Node et FFmpeg via Homebrew ou apt, puis démarre le studio.</p></div>
    <div class="carte"><b>🤖 IA locale gratuite</b>
      <p style="color:var(--texte-doux);font-size:13px;margin:7px 0 10px">Une commande pour avoir un modèle qui tourne chez vous, sans abonnement :</p>
      <pre>ollama pull llama3.3
ollama serve</pre>
      <a class="btn mini" href="#/locales">Voir tous les moteurs locaux</a></div>
  </div>
  <h2>API et automatisation</h2>
  <div class="carte"><p style="color:var(--texte-doux);margin-bottom:11px">Tout ce que fait l'interface passe par l'API HTTP : vous pouvez piloter Clipia depuis n8n, Make, un script, ou un agent IA via MCP.</p>
  <pre>curl -X POST http://127.0.0.1:8787/api/taches \\
  -H "content-type: application/json" \\
  -d '{"type":"clip","payload":{"audioPath":"/chemin/morceau.mp3",
       "style":"néon nocturne","ratio":"tiktok",
       "llm":{"provider":"ollama","model":"llama3.3"},
       "imageProvider":"comfyui"}}'</pre></div>`));

  let prompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; });
  $('#pwa').onclick = async () => {
    if (prompt) { prompt.prompt(); const r = await prompt.userChoice; $('#pwamsg').textContent = r.outcome === 'accepted' ? 'Installée ✓' : 'Installation annulée.'; }
    else $('#pwamsg').textContent = "Utilisez le menu du navigateur → « Installer l'application » (Chrome, Edge) ou « Ajouter à l'écran d'accueil » (Safari, Android).";
  };
};


VUES.parametres = async (v) => {
  const actuel = (() => { try { return localStorage.getItem('clipia:serveur') || ''; } catch { return ''; } })();
  v.append(el(`
  <h1>Paramètres</h1>
  <p class="sous">Adresse du serveur, dossier de travail et comportement par défaut du studio.</p>
  <h2>Serveur</h2>
  <p style="color:var(--texte-doux);margin-bottom:12px;max-width:68ch">Sur ordinateur, Clipia se parle à lui-même et vous n'avez rien à régler. Sur mobile, ou si vous hébergez Clipia ailleurs, indiquez ici l'adresse à viser.</p>
  <div class="carte">
    <div class="rang" style="margin-bottom:14px">
      <span class="puce ${actuel ? 'att' : 'ok'}"></span>
      <b>${actuel ? 'Serveur distant' : 'Serveur local (cette machine)'}</b>
      <code style="margin-left:auto">${esc(actuel || location.origin)}</code>
    </div>
    <label class="champ"><span>Adresse du serveur Clipia</span>
      <input id="url" type="url" placeholder="http://192.168.1.20:8787 ou https://studio.mon-domaine.fr" value="${esc(actuel)}"></label>
    <div class="rang">
      <button class="btn or" id="ok">Enregistrer et tester</button>
      <button class="btn" id="raz" ${actuel ? '' : 'disabled'}>Revenir au local</button>
    </div>
    <div id="res" style="margin-top:13px;font-size:13px"></div>
  </div>
  <div class="carte creux" style="margin-top:16px">
    <b>Trouver l'adresse de votre ordinateur</b>
    <p style="color:var(--texte-doux);margin-top:7px">Sur la machine où tourne Clipia, lancez <code>ipconfig</code> (Windows) ou <code>ifconfig</code> (Mac, Linux) et relevez l'adresse locale, du type <code>192.168.1.x</code>. L'adresse à saisir ici est alors <code>http://192.168.1.x:8787</code>.</p>
    <p style="color:var(--texte-doux);margin-top:9px">Pour que le téléphone puisse joindre l'ordinateur, démarrez Clipia avec <code>HOST=0.0.0.0 node server/index.js</code> — sinon le serveur n'écoute que sur lui-même. Les deux appareils doivent être sur le même Wi-Fi.</p>
  </div>`));

  $('#ok').onclick = async () => {
    const u = $('#url').value.trim().replace(/\/$/, '');
    const r = $('#res');
    if (!u) return r.innerHTML = '<span style="color:var(--erreur)">Saisissez une adresse.</span>';
    r.innerHTML = '<span class="tourne"></span> test en cours…';
    try {
      const rep = await fetch(u + '/api/etat', { signal: AbortSignal.timeout(8000) });
      if (!rep.ok) throw new Error('réponse ' + rep.status);
      const j = await rep.json();
      try { localStorage.setItem('clipia:serveur', u); } catch {}
      r.innerHTML = `<span style="color:var(--ok)">✓ Clipia ${esc(j.version)} joignable — ${j.fournisseurs.total} moteurs. Rechargement…</span>`;
      setTimeout(() => location.reload(), 1100);
    } catch (e) {
      r.innerHTML = `<span style="color:var(--erreur)">Injoignable : ${esc(e.message)}.</span>
        <div style="color:var(--texte-faible);margin-top:7px">Vérifiez que Clipia tourne avec <code>HOST=0.0.0.0</code>, que l'adresse et le port sont exacts, et que les deux appareils sont sur le même réseau.</div>`;
    }
  };
  $('#raz').onclick = () => {
    try { localStorage.removeItem('clipia:serveur'); } catch {}
    toast('Retour au serveur local', 'ok');
    setTimeout(() => location.reload(), 600);
  };
};


// ═══════════════════════════════════════════════════════════════════════════
VUES.musique = async (v) => {
  const fours = await api('/api/fournisseurs');
  const mus = fours.filter(f => f.kind === 'music' && f.configure);
  const tts = fours.filter(f => f.kind === 'audio' && f.configure);
  v.append(el(`
  <h1>Musique</h1>
  <p class="sous">Générer un morceau, une nappe d'ambiance ou un habillage sonore, puis l'envoyer directement dans le studio vidéo.</p>
  <div class="carte">
    <label class="champ"><span>Description du morceau</span>
      <textarea id="pr" placeholder="Ex : boom bap mélancolique à 88 BPM, piano feutré, basse ronde, batterie sèche, ambiance nocturne"></textarea></label>
    <div class="grille g2">
      <label class="champ"><span>Moteur</span>
        <select id="mo">${mus.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun — ajoutez une clé Suno dans le Coffre</option>'}</select></label>
      <label class="champ"><span>Style</span>
        <select id="st"><option>instrumental</option><option>avec voix</option><option>nappe d'ambiance</option><option>jingle court</option></select></label>
    </div>
    <label class="champ"><span>Paroles (facultatif)</span><textarea id="ly" placeholder="Laissez vide pour un instrumental"></textarea></label>
    <button class="btn or" id="go">Générer le morceau</button>
  </div>
  <div id="prog"></div>
  <div class="carte creux" style="margin-top:16px">
    <b>Habillage sonore sans génération</b>
    <p style="color:var(--texte-doux);margin-top:7px">Pour une voix off, un jingle parlé ou un narrateur, passez par <a href="#/paroles">Paroles et voix</a> : ${tts.length ? tts.length + ' moteur(s) de synthèse vocale configuré(s)' : 'aucun moteur vocal configuré pour l\'instant'}.</p>
  </div>`));
  $('#go').onclick = async () => {
    if (!$('#mo').value) return toast('Aucun moteur musical configuré.', 'err');
    const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'musique',
      payload: { provider: $('#mo').value, prompt: $('#pr').value, style: $('#st').value, lyrics: $('#ly').value } }) });
    suivre(job.id, $('#prog'));
  };
};

VUES.partage = async (v) => {
  const [medias, conns] = await Promise.all([api('/api/medias'), api('/api/connecteurs')]);
  const videos = medias.filter(m => m.ext === 'mp4');
  const diffusion = conns.items.filter(c => c.group === 'Diffusion' || c.group === 'Musique');
  const lies = diffusion.filter(c => c.connecte);
  v.append(el(`
  <h1>Partage</h1>
  <p class="sous">Envoyer un rendu vers vos plateformes, ou préparer un pack de livraison pour un client.</p>`));

  if (!videos.length) {
    v.append(el(`<div class="vide"><div class="em">⤤</div>Aucun rendu à partager pour l'instant.<br>
      <a href="#/clip" class="btn mini or" style="margin-top:12px;display:inline-block">Produire une vidéo</a></div>`));
    return;
  }
  v.append(el(`
  <div class="carte">
    <label class="champ"><span>Rendu à partager</span>
      <select id="as">${videos.map(m => `<option value="${m.id}">${esc(m.nom || m.url.split('/').pop())} — ${(m.bytes/1048576).toFixed(1)} Mo</option>`).join('')}</select></label>
    <label class="champ"><span>Titre</span><input id="ti" placeholder="Titre de la publication"></label>
    <label class="champ"><span>Description</span><textarea id="de" placeholder="Description, balises, mentions…"></textarea></label>
    <label class="champ"><span>Visibilité</span>
      <select id="vi"><option value="private">Privée — pour vérifier avant publication</option>
      <option value="unlisted">Non répertoriée</option><option value="public">Publique</option></select></label>
    <h2 style="margin-top:20px">Destinations</h2>
    ${lies.length
      ? `<div class="grille g3" style="margin-bottom:14px">${lies.map(c => `
          <label class="carte" style="background:var(--carte-2);cursor:pointer;display:flex;gap:10px;align-items:center">
            <input type="checkbox" data-plat="${c.id}" style="width:auto">
            <span style="display:flex;align-items:center;gap:7px"><i style="width:9px;height:9px;border-radius:3px;background:${c.color};display:inline-block"></i>${esc(c.label)}</span>
          </label>`).join('')}</div>
         <button class="btn or" id="pub">Publier</button>`
      : `<div class="carte creux"><b>Aucune plateforme connectée</b>
         <p style="color:var(--texte-doux);margin-top:7px">Reliez YouTube, TikTok ou SoundCloud dans <a href="#/connecteurs">Intégrations</a> pour publier directement depuis Clipia.</p></div>`}
  </div>
  <h2>Autres façons de livrer</h2>
  <div class="grille g3">
    <div class="carte"><b>Téléchargement direct</b>
      <p style="color:var(--texte-doux);font-size:13px;margin-top:6px">Le fichier est dans votre <a href="#/medias">médiathèque</a>, prêt à être récupéré.</p></div>
    <div class="carte"><b>Sauvegarde cloud</b>
      <p style="color:var(--texte-doux);font-size:13px;margin-top:6px">Drive, Dropbox ou S3 connecté : le rendu y est copié automatiquement.</p></div>
    <div class="carte"><b>Webhook</b>
      <p style="color:var(--texte-doux);font-size:13px;margin-top:6px">Chaque rendu terminé déclenche un appel signé vers n8n, Make ou votre serveur.</p></div>
  </div>
  <div id="prog" style="margin-top:16px"></div>`));

  $('#pub')?.addEventListener('click', async () => {
    const cibles = [...v.querySelectorAll('[data-plat]:checked')].map(x => x.dataset.plat);
    if (!cibles.length) return toast('Choisissez au moins une destination.', 'err');
    const m = medias.find(x => x.id === $('#as').value);
    for (const plat of cibles) {
      const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'publication',
        payload: { platform: plat, filePath: m.file, title: $('#ti').value, description: $('#de').value, privacy: $('#vi').value },
        titre: `Publication ${plat}` }) });
      suivre(job.id, $('#prog'));
    }
  });
};

VUES.support = async (v) => {
  const e = await api('/api/etat').catch(() => null);
  v.append(el(`
  <h1>Support</h1>
  <p class="sous">Diagnostic de votre installation, et les réponses aux blocages les plus fréquents.</p>
  <div class="carte" style="margin-bottom:18px">
    <div class="rang" style="justify-content:space-between;margin-bottom:12px">
      <b>État de l'installation</b>
      <button class="btn mini" id="copier">Copier le diagnostic</button>
    </div>
    <pre id="diag" style="font-size:12px">${esc(JSON.stringify({
      version: e?.version, moteursCloud: e?.fournisseurs?.configures,
      moteursLocaux: e?.fournisseurs?.locauxActifs, ffmpeg: e?.ffmpeg,
      connecteurs: e?.connecteurs?.connectes, plan: e?.plan?.label,
      navigateur: navigator.userAgent.slice(0, 90)
    }, null, 2))}</pre>
  </div>
  <h2>Blocages fréquents</h2>
  <div class="liste">
    ${[['« Clé manquante pour… »','Le moteur choisi n\'a pas de clé. Allez dans Coffre de clés, ou sélectionnez un moteur local dans IA locales.'],
       ['Le montage échoue','FFmpeg n\'est pas installé. Tapez ffmpeg -version dans un terminal pour vérifier.'],
       ['Ollama non détecté','Le serveur n\'est pas démarré : lancez ollama serve dans un terminal et laissez-le ouvert.'],
       ['OAuth : redirect_uri_mismatch','L\'adresse de redirection n\'est pas déclarée à l\'identique dans la console du service. Recopiez celle affichée dans Intégrations.'],
       ['Clip sans paroles','Aucun moteur de transcription choisi. Sélectionnez-en un dans le champ « Transcription » avant de lancer.'],
       ['Le téléphone ne voit pas le serveur','Démarrez Clipia avec HOST=0.0.0.0 et vérifiez que les deux appareils sont sur le même Wi-Fi.'],
       ['Rendu très lent','Baissez le nombre de plans, ou utilisez le mouvement local plutôt que l\'animation IA distante.']
      ].map(([q, a]) => `<div style="display:block">
        <b style="display:block;margin-bottom:3px">${q}</b>
        <span style="color:var(--texte-doux);font-size:13px">${a}</span></div>`).join('')}
  </div>
  <h2>Aller plus loin</h2>
  <div class="grille g3">
    <div class="carte"><b>Guide de démarrage</b><p style="color:var(--texte-doux);font-size:13px;margin-top:6px">docs/DEMARRAGE.md dans le dossier du projet.</p></div>
    <div class="carte"><b>Architecture</b><p style="color:var(--texte-doux);font-size:13px;margin-top:6px">docs/ARCHITECTURE.md — comment tout s'emboîte.</p></div>
    <div class="carte"><b>Contact</b><p style="color:var(--texte-doux);font-size:13px;margin-top:6px">fabriceclin02@gmail.com</p></div>
  </div>`));
  $('#copier').onclick = async () => {
    try { await navigator.clipboard.writeText($('#diag').textContent); toast('Diagnostic copié', 'ok'); }
    catch { const r = document.createRange(); r.selectNode($('#diag')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Sélectionné — copiez avec Ctrl+C'); }
  };
};


// ═══════════════════════════════════════════════════════════════════════════
VUES.agent = async (v) => {
  const [fours, projets, skills] = await Promise.all([
    api('/api/fournisseurs'), api('/api/projets'), api('/api/skills')]);
  const llms = fours.filter(f => f.configure && ['openai','anthropic','gemini','ollama'].includes(f.kind));

  v.append(el(`
  <h1>Agent développeur</h1>
  <p class="sous">Décrivez ce que vous voulez, l'agent l'écrit fichier par fichier : sites web, scripts, petites applications. Il lit, écrit, modifie et exécute — uniquement dans le dossier du projet.</p>

  <div class="grille g2" style="align-items:start">
    <div>
      <div class="carte">
        <label class="champ"><span>Projet</span>
          <input id="proj" list="projets" placeholder="mon-site" value="${esc(projets[0]?.nom || '')}">
          <datalist id="projets">${projets.map(p => `<option value="${esc(p.nom)}">`).join('')}</datalist></label>
        <label class="champ"><span>Ce que vous voulez</span>
          <textarea id="dem" style="min-height:110px" placeholder="Ex : un site vitrine d'une page pour mon activité de tatouage Trash Polka à Flize — galerie de modèles, tarifs, formulaire de rendez-vous, et un bouton WhatsApp"></textarea></label>
        <div class="grille g2">
          <label class="champ"><span>Modèle</span>
            <select id="llm">${llms.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun modèle configuré</option>'}</select></label>
          <label class="champ"><span>Étapes maximum</span>
            <select id="max"><option>12</option><option selected>24</option><option>40</option></select></label>
        </div>
        ${skills.length ? `<label class="champ"><span>Consignes à appliquer</span>
          <div class="rang">${skills.map(k => `<label class="etiq neutre" style="cursor:pointer;padding:5px 11px">
            <input type="checkbox" data-skill="${esc(k.id)}" style="width:auto;margin-right:5px">${esc(k.titre)}</label>`).join('')}</div></label>` : ''}
        <button class="btn or" id="go" style="width:100%;padding:11px">⟡ Lancer l'agent</button>
      </div>
      <div class="carte creux" style="margin-top:14px">
        <b>Ce que l'agent peut faire</b>
        <ul style="margin:9px 0 0;padding-left:19px;color:var(--texte-doux);font-size:13px">
          <li>Créer, lire, modifier et supprimer des fichiers</li>
          <li>Exécuter node, npm, npx, git, python3 et quelques autres</li>
          <li>Suivre vos consignes enregistrées dans <a href="#/skills">Skills</a></li>
        </ul>
        <p style="color:var(--texte-faible);font-size:12.5px;margin-top:10px">Tout reste confiné au dossier du projet : l'agent ne peut rien écrire ailleurs sur votre disque, et seuls quelques binaires lui sont autorisés.</p>
      </div>
    </div>

    <div>
      <div class="carte" style="min-height:260px">
        <div class="rang" style="justify-content:space-between;margin-bottom:11px">
          <b>Déroulé</b><span class="etiq neutre" id="et">en attente</span>
        </div>
        <div id="flux" style="font-size:13.5px;display:flex;flex-direction:column;gap:9px;max-height:430px;overflow-y:auto">
          <div style="color:var(--texte-faible)">L'agent affichera ici chaque fichier écrit et chaque commande lancée.</div>
        </div>
      </div>
      <div id="apres" style="margin-top:14px"></div>
    </div>
  </div>`));

  // Demande transmise par Clipia à la voix
  try {
    const d = sessionStorage.getItem('clipia:agent:demande');
    if (d) { $('#dem').value = d; sessionStorage.removeItem('clipia:agent:demande');
      $('#dem').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Demande reçue de Clipia — vérifiez puis lancez.', 'ok'); }
  } catch {}

  $('#go').onclick = async () => {
    const projet = $('#proj').value.trim();
    const demande = $('#dem').value.trim();
    if (!projet || !demande) return toast('Indiquez un projet et une demande.', 'err');
    if (!$('#llm').value) return toast('Configurez un modèle dans le Coffre, ou lancez Ollama.', 'err');
    const choisis = [...v.querySelectorAll('[data-skill]:checked')].map(x => x.dataset.skill);

    $('#go').disabled = true;
    $('#flux').innerHTML = '';
    $('#apres').innerHTML = '';
    $('#et').textContent = 'en cours'; $('#et').className = 'etiq att';
    const ajouter = (h) => { $('#flux').append(el(h)); $('#flux').scrollTop = 1e9; };

    try {
      const rep = await fetch(API + '/api/agent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projet, demande, provider: $('#llm').value, skills: choisis, maxEtapes: +$('#max').value })
      });
      const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lignes = buf.split('\n'); buf = lignes.pop();
        for (const L of lignes) {
          if (!L.startsWith('data:')) continue;
          const e = JSON.parse(L.slice(5));
          if (e.type === 'reflexion') $('#et').textContent = `étape ${e.etape}/${e.total}`;
          if (e.type === 'message') ajouter(`<div style="color:var(--texte-doux)">${esc(e.texte)}</div>`);
          if (e.type === 'outil') ajouter(`<div class="rang" style="gap:8px"><span class="etiq or">${esc(e.outil)}</span>
            <code style="font-size:12px;overflow:hidden;text-overflow:ellipsis">${esc(e.parametres || '')}</code></div>`);
          if (e.type === 'resultat' && /ERREUR/.test(e.resultat))
            ajouter(`<div style="color:var(--erreur);font-size:12.5px">${esc(e.resultat)}</div>`);
          if (e.type === 'erreur') { ajouter(`<div style="color:var(--erreur)">⚠ ${esc(e.message)}</div>`);
            $('#et').textContent = 'échec'; $('#et').className = 'etiq err'; }
          if (e.type === 'termine') {
            $('#et').textContent = 'terminé'; $('#et').className = 'etiq ok';
            ajouter(`<div style="color:var(--ok);margin-top:6px">✓ ${esc(e.resume)}</div>`);
            await montrerProjet(e.projet);
          }
        }
      }
    } catch (e) { toast(e.message, 'err'); $('#et').textContent = 'échec'; $('#et').className = 'etiq err'; }
    finally { $('#go').disabled = false; }
  };

  async function montrerProjet(nom) {
    const arbre = await api(`/api/projets/${encodeURIComponent(nom)}/arbre`);
    const plat = []; (function p2(n, d = 0) { for (const e of n) { plat.push({ ...e, d }); if (e.enfants) p2(e.enfants, d + 1); } })(arbre);
    const html = plat.find(f => /\.html?$/.test(f.chemin));
    $('#apres').innerHTML = `
      <div class="carte">
        <div class="rang" style="justify-content:space-between;margin-bottom:10px">
          <b>${esc(nom)}</b><span class="etiq neutre">${plat.filter(f => f.type === 'fichier').length} fichier(s)</span>
        </div>
        <div class="liste" style="margin-bottom:12px">${plat.slice(0, 24).map(f => `
          <div style="padding:8px 13px"><span style="padding-left:${f.d * 14}px">${f.type === 'dossier' ? '📁' : '📄'}</span>
            <a href="/api/projets/${encodeURIComponent(nom)}/${f.chemin}" target="_blank" style="flex:1">${esc(f.chemin.split('/').pop())}</a>
            ${f.octets ? `<span style="color:var(--texte-faible);font-size:11.5px">${f.octets} o</span>` : ''}</div>`).join('')}</div>
        ${html ? `<a class="btn or" href="/api/projets/${encodeURIComponent(nom)}/${html.chemin}" target="_blank">Ouvrir le site produit →</a>` : ''}
      </div>`;
  }

  if (projets.length) montrerProjet(projets[0].nom);
};

VUES.skills = async (v) => {
  const skills = await api('/api/skills');
  v.append(el(`
  <h1>Skills</h1>
  <p class="sous">Des consignes réutilisables que l'agent applique à la demande. Une skill décrit comment vous voulez que le travail soit fait — votre façon de structurer un site, vos règles de code, votre ton.</p>
  <div class="grille g2" style="align-items:start">
    <div>
      <h2 style="margin-top:0">Vos skills</h2>
      ${skills.length ? `<div class="liste">${skills.map(k => `
        <div><div style="flex:1;min-width:0">
          <b>${esc(k.titre)}</b>
          <div style="font-size:12.5px;color:var(--texte-faible)">${esc(k.description || '')}</div></div>
          <button class="btn mini" data-ed="${esc(k.id)}">Ouvrir</button>
          <button class="btn mini danger" data-sup="${esc(k.id)}">×</button></div>`).join('')}</div>`
        : `<div class="vide"><div class="em">◆</div>Aucune skill pour l'instant.</div>`}
    </div>
    <div class="carte">
      <label class="champ"><span>Nom de la skill</span><input id="sid" placeholder="ma-charte-html"></label>
      <label class="champ"><span>Contenu (Markdown)</span>
        <textarea id="sct" style="min-height:260px;font-family:var(--mono,monospace);font-size:13px" placeholder="# Titre de la skill

> Une ligne qui dit à quoi elle sert.

## Règles

- Première consigne
- Deuxième consigne"></textarea></label>
      <button class="btn or" id="senr">Enregistrer</button>
    </div>
  </div>`));

  v.querySelectorAll('[data-ed]').forEach(b => b.onclick = async () => {
    const r = await api('/api/skills/' + encodeURIComponent(b.dataset.ed));
    $('#sid').value = b.dataset.ed; $('#sct').value = r.contenu;
    $('#sct').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  v.querySelectorAll('[data-sup]').forEach(b => b.onclick = async () => {
    await api('/api/skills/' + encodeURIComponent(b.dataset.sup), { method: 'DELETE' });
    toast('Skill supprimée', 'ok'); route();
  });
  $('#senr').onclick = async () => {
    if (!$('#sid').value.trim() || !$('#sct').value.trim()) return toast('Nom et contenu requis.', 'err');
    await api('/api/skills', { method: 'POST', body: JSON.stringify({ id: $('#sid').value.trim(), contenu: $('#sct').value }) });
    toast('Skill enregistrée ✓', 'ok'); route();
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// KLIPIA — orbe vocale + conversation. Vue d'accueil du studio.
// ═══════════════════════════════════════════════════════════════════════════
VUES.clipia = async (v) => {
  const fours = await api('/api/fournisseurs');
  const llms = fours.filter(f => f.configure && ['openai','anthropic','gemini','ollama'].includes(f.kind));
  const stt  = fours.filter(f => f.configure && f.kind === 'stt');
  const tts  = fours.filter(f => f.configure && f.kind === 'audio');

  v.append(el(`
  <div>
  <div class="scene">
    <button class="orbe" id="orbe" aria-label="Parler à Clipia">
      <span class="anneau"></span><span class="anneau b"></span><span class="halo"></span>
      <span class="noyau"></span>
      <span class="txt"><b>CLIPIA</b><i>Studio créatif</i></span>
    </button>
    <div class="question">Que me veux-tu ?</div>
    <div class="etat-voix" id="etat">Touchez l'orbe — je vous accueille et je vous écoute.</div>
    <div class="etat-voix" style="font-size:12.5px;opacity:.85"><kbd style="border:1px solid #ffffff44;border-radius:6px;padding:1px 8px">Espace</kbd> = Clipia se tait et t'écoute (à tout moment) · ré-appuie pour envoyer · <label><input type="checkbox" id="espaceOn" checked> activé</label></div>
    <div style="display:flex;justify-content:center;margin:6px 0 14px">
      <button id="grosMicro" aria-pressed="false" style="display:flex;align-items:center;gap:12px;padding:16px 34px;font-size:17px;font-weight:700;color:#fff;border:0;border-radius:999px;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#2563eb);box-shadow:0 8px 30px rgba(124,58,237,.45)">
        <span id="grosMicroIc" style="font-size:24px">🎙</span><span id="grosMicroTxt">Parler à Clipia</span>
      </button>
    </div>
    <div class="experience">
      <button class="btn-exp" id="experience">
        <span class="etoile">✦</span>Démarrer l'expérience unique avec Clipia
      </button>
      <small>Clipia vous accueille à voix haute, vous écoute, et exécute ce que vous demandez.</small>
    </div>
    <div class="suggestions" id="suggestions">
      <button class="sugg">Fais-moi un clip à partir d'un morceau</button>
      <button class="sugg">Crée-moi un site vitrine</button>
      <button class="sugg">Génère une pochette d'album</button>
      <button class="sugg">Transcris les paroles d'un fichier</button>
      <button class="sugg">Qu'est-ce que tu sais faire ?</button>
    </div>
    <div id="vitrine"></div>
  </div>

  <div class="convo">
    <div class="bulles" id="bulles"></div>

    <div class="carte" id="panTon" hidden style="margin-bottom:12px;border-color:var(--or)">
      <div class="rang" style="justify-content:space-between">
        <b>Comment veux-tu qu'elle te parle ?</b>
        <button class="btn mini" id="fermerTon">Fermer</button>
      </div>
      <div id="modesPerso" class="rang" style="flex-wrap:wrap;margin:10px 0 4px"></div>
      <div id="modeQuoi" style="font-size:12.5px;color:var(--texte-faible);margin-bottom:10px"></div>
      <div class="rang" style="margin-bottom:10px;flex-wrap:wrap">
        <input id="persoPrenom" placeholder="Comment dois-je t'appeler ?" style="max-width:220px">
        <input id="persoFait" placeholder="Ce que tu fabriques (musique, tatouage, sites…)" style="flex:1;min-width:220px">
      </div>
      <p style="color:var(--texte-doux);font-size:12.5px;margin:9px 0 10px">Et si tu veux préciser, écris-le comme tu le dirais à quelqu'un. C'est repris mot pour mot, et ça passe avant le reste. C'est enregistré sur ta machine : le chat, la voix et les agents parlent tous pareil.</p>
      <textarea id="tonTexte" style="min-height:92px" placeholder="Parle-moi comme à un ami, avec de l'humour…"></textarea>
      <div class="rang" style="flex-wrap:wrap;margin:10px 0">
        <button class="btn mini" data-ton="Parle-moi comme à un ami. Tutoiement, ton détendu, un peu d'humour quand ça s'y prête.">Comme un ami</button>
        <button class="btn mini" data-ton="Sois drôle. Vanne-moi gentiment, prends des exemples absurdes, ne te prends pas au sérieux. Reste utile quand même.">Drôle</button>
        <button class="btn mini" data-ton="Va droit au but. Pas de politesse, pas de préambule, pas de reformulation. La réponse, point.">Direct</button>
        <button class="btn mini" data-ton="Explique-moi comme si je débutais, avec des exemples concrets et des comparaisons du quotidien. Prends ton temps.">Pédagogue</button>
        <button class="btn mini" data-ton="Ton professionnel et posé. Vouvoiement, phrases complètes, pas de familiarité.">Professionnel</button>
        <button class="btn mini" data-ton="Sois franche. Si une idée est mauvaise, dis-le sans enrober. Je préfère entendre ce qui cloche.">Cash</button>
      </div>
      <b style="font-size:13px">Sa voix</b>
      <div class="rang" style="margin:9px 0 10px">
        <select id="selVoix" style="max-width:260px"></select>
        <button class="btn mini" id="essaiVoix">Écouter un essai</button>
      </div>
      <div id="etatVoix" style="font-size:12.5px;color:var(--texte-faible);margin-bottom:11px"></div>
      <button class="btn or" id="validerTon">Enregistrer</button>
    </div>

    <div class="composeur" id="composeur">
      <div class="jointes" id="jointes" hidden></div>
      <textarea id="saisie" rows="1" placeholder="Écrivez, déposez un fichier, ou parlez…"></textarea>
      <div class="outils-bas">
        <button class="ic-btn" id="bFichier" title="Joindre un fichier">📎</button>
        <button class="ic-btn" id="bImage"   title="Joindre une image">🖼</button>
        <button class="ic-btn" id="bAudio"   title="Joindre un audio">♪</button>
        <button class="ic-btn" id="bMicro"   title="Dicter">🎙</button>
        <button class="ic-btn" id="bTestMicro" title="Tester le microphone">⚙</button>
        <button class="ic-btn" id="bConvVocale" title="Conversation vocale continue — elle écoute, répond à voix haute, et réécoute">💬🎙</button>
        <button class="btn or mini" id="bParler" title="Appuie, parle jusqu'au bout, rappuie (ou attends 3 secondes de silence)">🎤 Parler</button>
        <button class="ic-btn" id="bAppel" title="Mode appel — dis « Clipia » à tout moment et elle te répond, comme un assistant vocal">📣</button>
        <button class="ic-btn" id="bReglages" title="Comment Clipia doit te parler">🎚</button>
        <select id="modele" style="width:auto;max-width:168px;padding:6px 10px;font-size:12.5px;border-radius:9px"
          title="Moteur : Auto choisit le meilleur cerveau disponible">
          ${llms.length ? '<option value="">⚡ Auto — le meilleur</option>' : ''}${llms.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun moteur</option>'}
        </select>
        <select id="variante" style="width:auto;max-width:200px;padding:6px 10px;font-size:12.5px;border-radius:9px"
          title="Modèle"></select>
        <div class="pousse">
          <button class="ic-btn" id="bVoix" title="Réponse à voix haute">🔊</button>
          <button class="ic-btn envoi" id="bEnvoi" title="Envoyer">➤</button>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:9px;flex-wrap:wrap">
      <span style="font-size:11.5px;color:var(--texte-faible)">Entrée pour envoyer · Maj+Entrée pour aller à la ligne · collez une image directement</span>
      <button class="btn mini" id="bVider">Nouvelle conversation</button>
    </div>
    <div class="ecouteur" id="ecouteur">
      <button class="ec-agrandir" id="ecAgrandir" type="button" title="Agrandir / réduire la fenêtre vocale" aria-label="Agrandir la fenêtre vocale">⤢</button>
      <button class="bulle-ecoute" id="bulleEcoute" aria-label="Arrêter l'écoute"><span>🎙</span></button>
      <div class="barres idle" id="barres">${'<i></i>'.repeat(17)}</div>
      <div class="legende" id="legende">Je vous écoute…</div>
    </div>
    <input type="file" id="fIn" hidden multiple>
  </div>

  </div>`));

  // Les moteurs gratuits sans clé (Pollinations, GitHub Models) dépannent mais répondent moins bien :
  // tant qu'aucun vrai moteur (Groq, Qwen local, Claude, OpenAI…) n'est branché, on propose l'assistant.
  const faibles = llms.every(f => /^(pollinations|github-models)$/.test(f.id));
  if (!llms.length || faibles) {
    $('#etat').innerHTML = llms.length
      ? `<b style="color:var(--alerte)">Moteur de base seulement</b> — branche un vrai cerveau pour des réponses rapides et précises.`
      : `<b style="color:var(--alerte)">Aucun moteur IA disponible</b> — choisissez une solution ci-dessous.`;
    if (!llms.length) $('#suggestions').remove();
    $('#bulles').append(el(`
    <div class="carte" style="align-self:stretch;max-width:none;border-color:var(--or-sombre);
      background:linear-gradient(140deg,rgba(124,58,237,.14),rgba(37,99,235,.08))">
      <h2 style="margin:0 0 6px">Bienvenue — donnons un cerveau à Clipia</h2>
      <p style="color:var(--texte-doux);margin:0 0 14px">Deux minutes, gratuit, et je vérifie que ça marche avant de continuer. <a href="#/cerveau-etapes"><b>→ Ouvrir l'assistant « Cerveau pas à pas » (Ollama, Qwen, Groq)</b></a></p>

      <div style="margin-bottom:16px">
        <b>⚡ Option 1 — Groq (gratuit, ultra-rapide) · recommandée</b>
        <ol style="margin:8px 0 10px 18px;color:var(--texte-doux);font-size:14px;line-height:1.7">
          <li>Ouvre <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> et connecte-toi (e-mail ou Google).</li>
          <li>Clique « Create API Key », donne-lui un nom, copie la clé (elle commence par <code>gsk_</code>).</li>
          <li>Colle-la ici :</li>
        </ol>
        <div class="rang">
          <input id="bvGroq" type="password" placeholder="gsk_…" autocomplete="off" style="flex:1;min-width:220px">
          <button class="btn or" id="bvGroqOk">Tester et activer</button>
        </div>
        <div id="bvMsg" style="margin-top:8px;font-size:13.5px"></div>
      </div>

      <div style="margin-bottom:16px">
        <b>🧠 Option 2 — Qwen en local (hors ligne, sans clé)</b>
        <p style="color:var(--texte-doux);font-size:14px;margin:6px 0 10px">Clipia démarre Ollama et télécharge le meilleur modèle pour ta machine (Qwen 3, DeepSeek…). Compte quelques Go de téléchargement.</p>
        <div class="rang"><button class="btn" id="bvLocal">Installer Qwen en local</button>
          <a class="btn mini" href="https://ollama.com/download" target="_blank" rel="noopener">Installer Ollama d'abord</a></div>
        <div id="bvLocalMsg" style="margin-top:8px;font-size:13.5px"></div>
      </div>
      <div class="rang"><a class="btn mini" href="#/configuration">Autres moteurs (Claude, OpenAI…)</a><button class="btn mini" id="revérifier">Revérifier</button></div>
    </div>`));
    $('#bvGroqOk').onclick = async () => {
      const m = $('#bvMsg'), valeur = $('#bvGroq').value.trim();
      m.style.color = 'var(--texte-doux)'; m.textContent = 'Test de la clé…';
      try {
        const t = await api('/api/coffre/tester', { method: 'POST', body: JSON.stringify({ fournisseur: 'groq', valeur }) });
        if (!t.ok) { m.style.color = 'var(--erreur)'; m.textContent = t.message; return; }
        await api('/api/coffre', { method: 'POST', body: JSON.stringify({ id: 'provider:groq', valeur }) });
        m.style.color = 'var(--ok)'; m.textContent = '✓ ' + t.message + ' Clipia est prête.'; try { speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance('Clé validée. Je suis prête : dis-moi ce que tu veux créer.'), { lang: 'fr-FR' })); } catch {}
        setTimeout(() => route(), 1200);
      } catch (e) { m.style.color = 'var(--erreur)'; m.textContent = e.message; }
    };
    $('#bvLocal').onclick = async () => {
      const m = $('#bvLocalMsg'); m.style.color = 'var(--texte-doux)'; m.textContent = 'Préparation…';
      try {
        const oll = await api('/api/ollama');
        if (!oll.installe) { m.style.color = 'var(--alerte)'; m.innerHTML = 'Ollama n\'est pas installé. Installe-le (bouton ci-dessus), puis reviens cliquer ici.'; return; }
        const rep = await fetch(API + '/api/auto/preparer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ avecModele: true }) });
        const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '';
        while (true) {
          const { done, value } = await rd.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          const l = buf.split('\n'); buf = l.pop();
          for (const L of l) {
            if (!L.startsWith('data:')) continue;
            const e = JSON.parse(L.slice(5));
            if (e.erreur) { m.style.color = 'var(--erreur)'; m.textContent = e.erreur; }
            else if (e.fini) { m.style.color = 'var(--ok)'; m.textContent = '✓ Modèles installés.'; setTimeout(() => route(), 1200); }
            else m.textContent = (e.message || 'en cours…') + (e.pct != null ? ' — ' + e.pct + ' %' : '');
          }
        }
      } catch (e) { m.style.color = 'var(--erreur)'; m.textContent = e.message; }
    };
    $('#revérifier').onclick = () => route();
    if (!llms.length) $('#composeur').style.opacity = '.5';

    // ── Démarrage guidé : Clipia lance l'installation et te parle pas à pas ──
    (() => {
      const g = el('<div id="bvGuide" style="margin:0 0 14px;padding:10px 14px;border-radius:10px;background:rgba(124,58,237,.18);font-size:14.5px"></div>');
      $('#bvGroq').closest('.carte').insertBefore(g, $('#bvGroq').closest('.carte').children[2]);
      const file = []; let gestes = false;
      const dites = (t) => { g.textContent = '🗣 ' + t; if (!window.speechSynthesis) return; file.push(t); if (gestes) vider(); };
      const vider = () => { try { while (file.length) { const u = new SpeechSynthesisUtterance(file.shift()); u.lang = 'fr-FR'; u.rate = 1.03; speechSynthesis.speak(u); } } catch {} };
      const debloquer = () => { gestes = true; vider(); };
      addEventListener('pointerdown', debloquer, { once: true }); addEventListener('keydown', debloquer, { once: true });
      dites("Bonjour, je suis Clipia. Je vais me donner un cerveau, tout de suite, et je te guide pas à pas.");
      (async () => {
        let oll = { installe: false };
        try { oll = await api('/api/ollama'); } catch {}
        if (oll.installe) {
          dites("J'ai trouvé Ollama. Je télécharge Qwen, gratuit, pour fonctionner sans clé. Pendant ce temps, tu peux aussi brancher Groq, plus rapide.");
          $('#bvLocal').click();
        } else {
          dites("Étape un : le plus rapide, c'est Groq, gratuit. Ouvre le lien de l'option un, crée une clé, puis colle-la dans la case. Je la teste pour toi. Sinon, installe Ollama et je télécharge Qwen automatiquement.");
        }
        $('#bvGroq').addEventListener('focus', () => dites("Colle ta clé qui commence par g s k, puis clique sur Tester et activer."), { once: true });
      })();
    })();
  }

  // ── état ────────────────────────────────────────────────────────────────
  const hist = [];
  let convId = null;
  let psyActif = null;   // séance avec un psychologue : { id, nom, genre, avatar, voixServeur, accueil }
  /** Enregistre la conversation (elle apparaît à gauche et se reprend plus tard). */
  async function sauver() {
    const msgs = hist.map(m => ({ role: m.role, content: m.content }));
    if (!msgs.length) return;
    try {
      const r = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ id: convId || undefined, messages: msgs }) });
      convId = r.id;
      const q = new URLSearchParams((location.hash.split('?')[1] || ''));
      if (q.get('c') !== convId) history.replaceState(null, '', '#/clipia?c=' + encodeURIComponent(convId) + (psyActif ? '&psy=' + encodeURIComponent(psyActif.id) : ''));
      majConversations();
    } catch { /* l'enregistrement ne doit jamais bloquer la conversation */ }
  }
  async function sauverGuide(g) {
    if (!convId) await sauver();
    if (!convId) return;
    try { await api('/api/conversations/' + encodeURIComponent(convId) + '/guide', { method: 'POST', body: JSON.stringify(g) }); majConversations(); } catch {}
  }
  /** Un guide pas à pas : étapes cochables, progression enregistrée, bouton « étape faite ». */
  function rendreGuide(parent, g) {
    const carte = el(`<div class="carte" style="margin-top:10px;max-width:none;border-color:var(--or-sombre)">
      <div class="rang" style="justify-content:space-between;margin-bottom:6px"><b>🧭 ${esc(g.titre)}</b><span class="g-prog" style="font-size:12.5px;color:var(--texte-doux)"></span></div>
      <div class="g-etapes" style="display:grid;gap:8px"></div>
      <div class="rang" style="margin-top:10px"><button class="btn or mini g-suite">✓ Étape faite, la suite ?</button><button class="btn mini g-bloque">Je suis bloqué</button></div></div>`);
    const prog = carte.querySelector('.g-prog'), liste = carte.querySelector('.g-etapes');
    const maj = () => {
      const n = g.etapes.filter(e => e.fait).length;
      prog.textContent = n + ' / ' + g.etapes.length + (n === g.etapes.length ? ' · terminé ✓' : '');
      carte.querySelector('.g-suite').disabled = n === g.etapes.length;
    };
    g.etapes.forEach((e, i) => {
      const ligne = el(`<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" ${e.fait ? 'checked' : ''} style="margin-top:4px">
        <span><b>${i + 1}. ${esc(e.titre)}</b>${e.detail ? `<br><span style="color:var(--texte-doux);font-size:13.5px">${esc(e.detail)}</span>` : ''}</span></label>`);
      ligne.querySelector('input').onchange = (ev) => { e.fait = ev.target.checked; maj(); sauverGuide(g); };
      liste.append(ligne);
    });
    carte.querySelector('.g-suite').onclick = () => {
      const i = g.etapes.findIndex(e => !e.fait); if (i < 0) return;
      g.etapes[i].fait = true; liste.children[i].querySelector('input').checked = true; maj(); sauverGuide(g);
      $('#saisie').value = `J'ai terminé l'étape ${i + 1} (${g.etapes[i].titre}). Quelle est la suite ?`; envoyer();
    };
    carte.querySelector('.g-bloque').onclick = () => {
      const i = Math.max(0, g.etapes.findIndex(e => !e.fait));
      $('#saisie').value = `Je suis bloqué à l'étape ${i + 1} (${g.etapes[i].titre}). Explique-moi plus précisément, geste par geste.`; envoyer();
    };
    maj(); parent.append(carte);
    return carte;
  }
  let jointes = [];
  let vocalActif = true;
  let recognition = null, enEcoute = false;
  let occupe = false, ctrlTour = null, ignorerFin = false;   // V5 : écoute pendant que Clipia réfléchit
  // Mode « conversation vocale » : elle écoute, répond à voix haute, puis
  // réécoute sans qu'on touche à rien. Un silence ne met pas fin au tour :
  // sinon le mode s'arrêterait à la première hésitation.
  let conversationVocale = false, appelDeclenche = false;
  // Un micro muet relancerait l'écoute indéfiniment en gardant la main dessus.
  // Au bout de quatre blancs d'affilée on sort du mode et on dit pourquoi.
  let blancs = 0;
  const BLANCS_MAX = 4;
  // Écoute permanente (X7) : activée par défaut ; elle ne s'éteint que si tu l'éteins toi-même (bouton ⏹).
  const permanent = () => { try { return localStorage.getItem('clipia:permanent') !== '0'; } catch { return true; } };
  const memoPerm = (v) => { try { localStorage.setItem('clipia:permanent', v ? '1' : '0'); } catch {} };
  let recorder = null, morceaux = [], audioCtx = null, analyser = null, flux = null;

  const orbe = $('#orbe'), etat = $('#etat');
  const ecouteur = $('#ecouteur'), barres = $('#barres'), legende = $('#legende');
  $('#ecAgrandir').onclick = () => {
    const g = ecouteur.classList.toggle('grand');
    $('#ecAgrandir').textContent = g ? '⤡' : '⤢';
    try { localStorage.setItem('clipia:ecouteur-grand', g ? '1' : '0'); } catch {}
  };
  try { if (localStorage.getItem('clipia:ecouteur-grand') === '1') { ecouteur.classList.add('grand'); $('#ecAgrandir').textContent = '⤡'; } } catch {}
  // ── Fenêtre de dialogue (en haut à droite) : on voit ce qu'on se dit ────
  document.getElementById('dialogue')?.remove();
  const dlg = el(`<div id="dialogue" aria-live="polite" style="position:fixed;top:14px;right:14px;z-index:80;width:min(340px,calc(100vw - 28px));border-radius:16px;background:rgba(14,10,40,.92);backdrop-filter:blur(10px);border:1px solid var(--or-sombre,#6d4fd6);box-shadow:0 14px 40px #0009;color:var(--texte,#e8e6ff);opacity:0;transform:translateY(-10px);pointer-events:none;transition:opacity .35s,transform .35s;overflow:hidden">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;font-weight:600;font-size:13px;border-bottom:1px solid #ffffff1a"><span id="dlgPoint" style="width:9px;height:9px;border-radius:50%;background:#7c5cff"></span>Clipia<span style="flex:1"></span><button id="dlgX" aria-label="Fermer" style="background:none;border:0;color:inherit;cursor:pointer;font-size:16px;pointer-events:auto">×</button></div>
    <div id="dlgMsgs" style="display:grid;gap:6px;padding:10px 12px;max-height:38vh;overflow:auto;font-size:14px"></div>
    <div id="dlgStatut" style="padding:8px 12px;font-size:13px;color:#c9c2ff;border-top:1px solid #ffffff1a;min-height:20px"></div></div>`);
  v.append(dlg);
  const dlgM = dlg.querySelector('#dlgMsgs'), dlgS = dlg.querySelector('#dlgStatut'), dlgP = dlg.querySelector('#dlgPoint');
  let dlgMasque = null, dlgInterim = null, dlgFerme = false;
  const modeVoix = () => vocalActif || conversationVocale || appelDeclenche;
  const dlgMontrer = () => { if (dlgFerme) return; clearTimeout(dlgMasque); dlg.style.opacity = '1'; dlg.style.transform = 'none'; };
  const dlgCacher = (ms = 5000) => { clearTimeout(dlgMasque); dlgMasque = setTimeout(() => { if (conversationVocale) return; dlg.style.opacity = '0'; dlg.style.transform = 'translateY(-10px)'; }, ms); };
  dlg.querySelector('#dlgX').onclick = () => { dlgFerme = true; dlg.style.opacity = '0'; setTimeout(() => { dlgFerme = false; }, 60000); };
  function dlgMsg(role, texte) {
    if (!texte || !modeVoix()) return;
    dlgInterim?.remove(); dlgInterim = null;
    dlgM.append(el(`<div style="justify-self:${role === 'user' ? 'end' : 'start'};max-width:90%;padding:7px 10px;border-radius:12px;background:${role === 'user' ? '#4b3bb0' : '#2a2160'};white-space:pre-wrap">${esc(String(texte).slice(0, 500))}</div>`));
    while (dlgM.children.length > 6) dlgM.firstChild.remove();
    dlgM.scrollTop = dlgM.scrollHeight; dlgMontrer();
  }
  function dlgVoir(texte) {   // ce que je suis en train de dire, en direct
    if (!modeVoix()) return;
    if (!dlgInterim) { dlgInterim = el('<div style="justify-self:end;max-width:90%;padding:7px 10px;border-radius:12px;background:#4b3bb055;font-style:italic"></div>'); dlgM.append(dlgInterim); }
    dlgInterim.textContent = texte; dlgM.scrollTop = dlgM.scrollHeight; dlgMontrer();
  }
  // ── Animation du travail (en bas) et carte 3D « à toi de parler » ─────
  if (!document.getElementById('cssAnim')) document.head.append(el(`<style id="cssAnim">
    #activite{position:fixed;left:50%;top:14px;transform:translate(-50%,-20px);z-index:75;display:flex;gap:6px;padding:8px 12px;border-radius:99px;background:rgba(14,10,40,.92);border:1px solid #6d4fd6;box-shadow:0 10px 30px #0009;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s}
    #activite.on{opacity:1;transform:translate(-50%,0)}
    @media (max-width:900px){#activite{flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 380px);top:64px}}
    #activite .p{font-size:12.5px;padding:5px 11px;border-radius:99px;background:#ffffff12;color:#b9b0ff;white-space:nowrap}
    #activite .p.fait{background:#2f7d5733;color:#8ff0bb}
    #activite .p.actif{background:linear-gradient(90deg,#7c3aed,#2563eb);color:#fff;animation:pulseP .9s ease-in-out infinite}
    @keyframes pulseP{50%{transform:scale(1.08);box-shadow:0 0 16px #7c5cffaa}}
    #atoiScene{display:none!important}
    #atoiScene{position:fixed;inset:auto 0 70px 0;z-index:90;display:flex;justify-content:center;perspective:900px;pointer-events:none}
    #atoi{pointer-events:auto;width:min(360px,calc(100vw - 32px));padding:20px 22px;border-radius:22px;text-align:center;color:#fff;
      background:linear-gradient(145deg,#3b1d9a,#1b3fa8);border:1px solid #a99bff;box-shadow:0 30px 70px #000a,0 0 60px #7c5cff66;
      transform-style:preserve-3d;opacity:0;transform:rotateX(75deg) translateZ(-420px) scale(.4)}
    #atoi.on{animation:entre3d .8s cubic-bezier(.2,1.3,.4,1) forwards,flotte3d 5s ease-in-out .8s infinite}
    #atoi.off{animation:sort3d .4s ease-in forwards}
    @keyframes entre3d{to{opacity:1;transform:rotateX(0) translateZ(0) scale(1)}}
    @keyframes sort3d{from{opacity:1;transform:none}to{opacity:0;transform:rotateX(-60deg) translateZ(-300px) scale(.5)}}
    @keyframes flotte3d{0%,100%{transform:rotateY(-7deg) rotateX(2deg) translateZ(0)}50%{transform:rotateY(7deg) rotateX(-2deg) translateZ(30px)}}
    #atoi .sphere{width:84px;height:84px;margin:0 auto 10px;border-radius:50%;position:relative;transform-style:preserve-3d;background:radial-gradient(circle at 32% 28%,#fff 0,#c9bcff 18%,#7c5cff 55%,#2a1a7a 100%);box-shadow:0 14px 30px #0008,0 0 28px #9b86ff;animation:respire 1.6s ease-in-out infinite}
    #atoi .sphere::before,#atoi .sphere::after{content:"";position:absolute;inset:-12px;border-radius:50%;border:2px solid #cbbfff99;transform:rotateX(70deg);animation:tourne 3s linear infinite}
    #atoi .sphere::after{inset:-20px;border-color:#7fb0ff88;animation-duration:4.5s;animation-direction:reverse;transform:rotateY(70deg)}
    @keyframes respire{50%{transform:scale(1.1)}}
    @keyframes tourne{to{transform:rotateX(70deg) rotateZ(360deg)}}
    #atoi b{display:block;font-size:17px;margin-bottom:4px}#atoi span.s{font-size:13px;opacity:.85}
    #atoi button{margin-top:12px;border:0;border-radius:99px;padding:9px 20px;font-size:15px;font-weight:600;cursor:pointer;background:#fff;color:#2a1a7a}
    </style>`));
  const barre = el(`<div id="activite" aria-hidden="true"></div>`);
  const ETAPES = ['Réflexion', 'Interaction', 'Exécution', 'Vérification', 'Réponse'];
  const ICONES = { Réflexion: '💭', Interaction: '🔗', Exécution: '⚙️', Vérification: '🔎', Réponse: '✅' };
  document.getElementById('activite')?.remove(); document.body.append(barre);
  function actEtape(nom) {
    const i = ETAPES.indexOf(nom); if (i < 0) return;
    barre.innerHTML = ETAPES.map((e, k) => `<span class="p ${k < i ? 'fait' : k === i ? 'actif' : ''}">${ICONES[e]} ${e}</span>`).join('');
    barre.classList.add('on');
  }
  const actFin = () => barre.classList.remove('on');
  document.getElementById('atoiScene')?.remove();
  const scene = el(`<div id="atoiScene"><div id="atoi" role="dialog" aria-label="À toi de parler"><div class="sphere"></div><b>Je t'écoute — à toi !</b><span class="s">Parle jusqu'au bout, je ne te coupe pas.</span><br><button id="atoiMic">🎤 Parler</button></div></div>`);
  document.body.append(scene);
  const atoi = scene.querySelector('#atoi'); let atoiTimer = null;
  // V6.0.2 : plus de carte bleue à cliquer. Quand c'est à l'utilisateur de parler, le micro s'ouvre tout seul
  // (même chemin que le bouton vert, qui fonctionne) ; la fenêtre vocale en bas montre que ça écoute.
  function atoiMontrer() {
    if (!modeVoix() || enEcoute || occupe) return;
    atoiCacher(); setTimeout(() => { if (!enEcoute && !occupe) ecouter(); }, 350);
  }
  function atoiCacher() { clearTimeout(atoiTimer); if (!atoi.classList.contains('on')) return; atoi.classList.add('off'); setTimeout(() => atoi.classList.remove('on', 'off'), 420); }
  scene.querySelector('#atoiMic').onclick = () => { atoiCacher(); couperVoix(); ecouter(); };
  atoi.addEventListener('click', e => { if (e.target === atoi) atoiCacher(); });
  const STATUTS = { ecoute: ["Je t'écoute…", '#3ddc84'], reflechit: ['Je réfléchis…', '#ffb84d'], parle: ["Je parle… dis « Clipia » pour m'arrêter", '#7c5cff'] };
  const etatOrbe = (c) => {
    orbe.className = 'orbe' + (c ? ' ' + c : '');
    window.clipiaScene?.etat(modeVoix() || conversationVocale || c ? c : '');
    const ecoute = c === 'ecoute';
    if (ecoute) atoiCacher();
    for (const bt of [document.getElementById('bParler'), document.getElementById('atoiMic')]) if (bt) bt.textContent = ecoute ? '⏹ Terminer' : '🎤 Parler';
    if (!modeVoix() && !c) return dlgCacher(1500);
    if (!modeVoix()) return;
    const s = STATUTS[c] || (conversationVocale ? STATUTS.ecoute : null);
    if (s) { dlgS.textContent = s[0]; dlgP.style.background = s[1]; dlgMontrer(); } else dlgCacher(6000);
  };
  const dire = (t) => { etat.textContent = t; };
  const montrerEcouteur = (on, txt) => {
    if (!on && occupe && conversationVocale) { on = true; txt = txt || 'Je réfléchis… tu peux continuer à parler'; }
    ecouteur.classList.toggle('on', on);
    ecouteur.classList.toggle('reflechit', Boolean(occupe));
    if (txt) legende.textContent = txt;
    barres.classList.toggle('idle', on);
  };

  // ── le microphone ───────────────────────────────────────────────────────
  //
  // Trois fonctions que tout le reste appelle : ouvrir, fermer, et expliquer
  // pourquoi ça n'a pas marché. L'analyseur alimente les barres de niveau et
  // le test du micro ; sans lui on ne saurait pas distinguer « micro refusé »
  // de « micro ouvert mais muet », qui se règlent de façons opposées.
  async function ouvrirMicro() {
    if (!navigator.mediaDevices?.getUserMedia)
      throw Object.assign(new Error('getUserMedia absent'), { name: 'NotSupportedError' });
    if (flux?.active) return flux;
    fermerMicro();
    flux = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Un contexte créé sans geste utilisateur démarre parfois suspendu.
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      audioCtx.createMediaStreamSource(flux).connect(analyser);
      niveaux();
    } catch { analyser = null; }   // le son passe quand même, on perd juste les barres
    return flux;
  }

  function fermerMicro() {
    try { flux?.getTracks().forEach(t => t.stop()); } catch {}
    try { audioCtx?.close(); } catch {}
    flux = null; audioCtx = null; analyser = null;
    montrerEcouteur(false);
  }

  /** Les barres de niveau, tant que le micro est ouvert. */
  function niveaux() {
    if (!analyser || !barres) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const traits = [...barres.children];
    (function boucle() {
      if (!analyser) { traits.forEach(t => t.style.height = ''); return; }
      analyser.getByteFrequencyData(data);
      const pas = Math.max(1, Math.floor(data.length / Math.max(1, traits.length)));
      traits.forEach((t, i) => {
        let m = 0;
        for (let k = i * pas; k < (i + 1) * pas && k < data.length; k++) m = Math.max(m, data[k]);
        t.style.height = Math.max(8, Math.round((m / 255) * 100)) + '%';
      });
      requestAnimationFrame(boucle);
    })();
  }

  /**
   * Traduit l'échec en quelque chose d'actionnable. Un « NotAllowedError » brut
   * n'apprend rien ; savoir que c'est le cadenas de la barre d'adresse, si.
   */
  function expliquerMicro(e) {
    const n = e?.name || '';
    if (n === 'NotAllowedError' || n === 'SecurityError')
      return 'Micro refusé. Cliquez sur le cadenas à gauche de l\'adresse, mettez le micro sur « Autoriser », puis réessayez.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError')
      return 'Aucun micro détecté. Branchez-le, puis vérifiez dans Paramètres Windows › Son › Entrée qu\'il est bien listé.';
    if (n === 'NotReadableError' || n === 'AbortError')
      return 'Le micro est pris par une autre application (Teams, Discord, OBS…). Fermez-la et réessayez.';
    if (n === 'NotSupportedError')
      return 'Ce navigateur ne donne pas accès au micro. Il faut Chrome, Edge ou l\'application Clipia.';
    return 'Micro inaccessible : ' + (e?.message || 'raison inconnue') + '.';
  }

  /** Accueil parlé, puis écoute automatique. */
  const SALUTS = [
    'Bonjour, comment allez-vous ? Que voulez-vous faire aujourd\'hui ?',
    'Bonjour. Je suis Clipia. Dites-moi ce que vous voulez créer.',
    'Content de vous retrouver. Sur quoi travaille-t-on ?',
    'Je vous écoute. Un clip, un visuel, un site ?'
  ];
  let accueilFait = false;

  function accueillir() {
    if (enEcoute) return arreter();
    const phrase = SALUTS[Math.floor(Math.random() * SALUTS.length)];
    bulle('assistant', phrase);
    hist.push({ role: 'assistant', content: phrase });
    accueilFait = true;
    if (!('speechSynthesis' in window) || !vocalActif) { ecouter(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(phrase);
    u.lang = 'fr-FR'; u.rate = 1.02; u.pitch = 0.94;
    const vx = speechSynthesis.getVoices().filter(x => x.lang.startsWith('fr'));
    const pref = vx.find(x => /thomas|daniel|google|enhanced|premium/i.test(x.name)) || vx[0];
    if (pref) u.voice = pref;
    etatOrbe('parle'); dire(phrase);
    u.onend = () => ecouter();          // enchaîne sur l'écoute
    u.onerror = () => ecouter();
    speechSynthesis.speak(u);
    // filet de sécurité : certaines voix n'émettent jamais onend
    setTimeout(() => { if (!enEcoute && accueilFait && !speechSynthesis.speaking) ecouter(); }, 6500);
  }

  // ── bulles ──────────────────────────────────────────────────────────────
  // L'orbe suit la discussion : dès qu'il y a des messages, elle se range sur le côté de la fenêtre de discussion et y reste.
  const sceneRacine = $('#orbe')?.closest('.scene')?.parentElement || v;
  function placerOrbe() {
    if (!sceneRacine.classList.contains('dock') || !orbe?.isConnected) return;
    const b = $('#bulles'); if (!b) return; const r = b.getBoundingClientRect(), g = r.left - 128;
    const place = g > 262 + 4 || (document.querySelector('.app')?.classList.contains('plein') && g > 4);
    sceneRacine.classList.toggle('dock-bas', !place);
    orbe.style.left = place ? Math.max(8, g) + 'px' : ''; const e = $('#etat'); if (e) e.style.left = place ? Math.max(0, g - 12) + 'px' : '';
  }
  function majDock() { sceneRacine.classList.toggle('dock', Boolean($('#bulles')?.childElementCount)); placerOrbe(); }
  addEventListener('resize', placerOrbe); const ivDock = setInterval(() => { if (!orbe?.isConnected) return clearInterval(ivDock); placerOrbe(); }, 700);
  function bulle(role, texte, meta = '') {
    const d = el(`<div class="bulle ${role === 'user' ? 'moi' : 'ia'}">
      <div class="qui">${role === 'user' ? 'Vous' : (psyActif ? esc(psyActif.nom) : 'Clipia')}</div><span class="c"></span>
      ${meta ? `<div class="vocal">${esc(meta)}</div>` : ''}</div>`);
    d.querySelector('.c').textContent = texte;
    $('#bulles').append(d); majDock();
    d.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return d.querySelector('.c');
  }

  // ── séance avec un psychologue (?psy=…) ─────────────────────────────────
  const psyDemande = new URLSearchParams((location.hash.split('?')[1] || '')).get('psy');
  if (psyDemande) {
    try { psyActif = (await api('/api/psy')).find(x => x.id === psyDemande) || null; } catch {}
    if (psyActif) {
      const ban = el(`<div id="psy-bandeau">${avatarSvg(psyActif.avatar, 54)}<div><b>${esc(psyActif.nom)}</b><small>${esc(psyActif.specialite)} · personnage d'IA, pas un professionnel diplômé · séance enregistrée sur ton ordinateur</small></div><div class="pousse"><button class="btn mini" id="psy-fin">Terminer la séance</button></div></div>`);
      $('#bulles').before(ban);
      $('#psy-fin', ban).onclick = () => { stopperConversation(''); location.hash = '#/clipia?n=' + Date.now(); };
    }
  }

  // ── reprise d'une conversation enregistrée ──────────────────────────────
  {
    const idReprise = new URLSearchParams((location.hash.split('?')[1] || '')).get('c');
    if (idReprise) {
      try {
        const c = await api('/api/conversations/' + encodeURIComponent(idReprise));
        convId = c.id;
        $('#suggestions')?.remove();
        for (const m of c.messages) {
          hist.push({ role: m.role, content: m.content });
          if (m.role === 'user') { bulle('user', m.content.replace(/\n\n---[\s\S]*$/, '')); continue; }
          const { propre, guides } = extraireGuides(m.content);
          const sortie = bulle('assistant', propre);
          for (const g of guides) rendreGuide(sortie.parentElement, fusionnerEtat(g, c.guides));
        }
        dire('Conversation reprise : « ' + c.titre + ' ». On continue ?');
      } catch { toast('Conversation introuvable.', 'err'); }
    }
  }

  // Première question du psychologue, à voix haute, puis écoute directe : la conversation est fluide.
  if (psyActif && !new URLSearchParams((location.hash.split('?')[1] || '')).get('c')) setTimeout(async () => {
    $('#suggestions')?.remove();
    const t = psyActif.accueil || 'Bonjour. Comment vous appelez-vous ?';
    bulle('assistant', t); hist.push({ role: 'assistant', content: t }); await sauver();
    if (!SR && !stt.length) return;
    conversationVocale = true; blancs = 0; vocalActif = true;
    $('#bVoix')?.classList.add('actif'); const bc = $('#bConvVocale'); if (bc) { bc.classList.add('rec', 'actif'); bc.textContent = '⏹'; }
    parler(t, () => { if (conversationVocale) ecouter(); });
  }, 900);

  // ── demande lancée depuis la Boîte à outils ─────────────────────────────
  try {
    const amorce = sessionStorage.getItem('clipia:amorce');
    if (amorce) { sessionStorage.removeItem('clipia:amorce'); $('#saisie').value = amorce; if (llms.length) setTimeout(() => envoyer(), 400); }
  } catch {}

  // ── synthèse vocale ─────────────────────────────────────────────────────
  //
  // La voix du navigateur est le filet de sécurité, pas le premier choix :
  // c'est elle qui donnait à Clipia son air de machine. On demande d'abord
  // au serveur une voix naturelle ; si rien ne répond, on retombe dessus.
  let audioEnCours = null;

  function voixChoisie() {
    if (psyActif?.voixServeur) return psyActif.voixServeur;
    try { return localStorage.getItem('clipia:voix') || 'nova'; } catch { return 'nova'; }
  }

  let coupeVoix = null;
  function parlerNavigateur(texte, apres) {
    if (!('speechSynthesis' in window)) { apres?.(); return; }
    try { coupeVoix?.(); } catch {}
    let fini = false; const fin = () => { if (!fini) { fini = true; apres?.(); } };
    coupeVoix = parlerNaturel(texte.slice(0, 1400), { genre: psyActif?.genre || '',
      onstart: () => { etatOrbe('parle'); dire('Clipia répond…'); }, onend: fin });
    setTimeout(() => { if (!speechSynthesis.speaking && !speechSynthesis.pending) fin(); }, 1200 + texte.length * 70);
    setTimeout(fin, 8000 + texte.length * 120);
  }

  // ── Interruption : « Clipia », « stop », « attends »… et elle se tait aussitôt ──
  const MOTS_STOP = /\b(clipia|clippia|stop|stoppe|attends?|arr[eê]te|tais[- ]toi|silence|ok|okay|oké|d'accord)\b/i;
  let garde = null;
  function gardeStop() { const r = garde; garde = null; if (r) { try { r.onend = null; r.onresult = null; r.onerror = null; r.abort(); } catch {} } }
  function interrompre() {
    gardeStop(); couperVoix(); bip();
    // « stop » ou « OK » : elle se tait aussitôt et se met à t'écouter (sans rien dire d'autre).
    appelDeclenche = true; etatOrbe('ecoute'); dire('Je t\'écoute…');
    setTimeout(() => { if (!enEcoute) ecouter(); }, 250);
  }
  // Anti-écho : ce que le micro entend juste après qu'elle a parlé n'est pas toi.
  let dernierDit = '', finParole = 0;
  const mots = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g) || [];
  function estEcho(t) {
    if (!dernierDit) return false;
    const a = mots(t); if (!a.length) return true;
    const ref = new Set(mots(dernierDit)); const commun = a.filter(w => ref.has(w)).length;
    const recent = parleEnCours() || Date.now() - finParole < 3500;
    return recent && commun / a.length >= .6;
  }
  function gardeStart(dit) {
    if (!SR || garde || veille || enEcoute) return;
    const r = new SR(); r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true; garde = r;
    const ditMinuscule = String(dit).toLowerCase();
    r.onresult = e => {
      const t = Array.from(e.results).map(x => x[0].transcript).join(' ');
      const m = (t.match(MOTS_STOP) || [])[0];
      if (m && !new RegExp('(?:^|[^a-zà-ÿ])' + m.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-zà-ÿ])').test(ditMinuscule)) interrompre();   // pas son propre écho
    };
    r.onend = () => { if (garde === r) { garde = null; if (parleEnCours()) setTimeout(() => gardeStart(dit), 250); } };
    r.onerror = () => {};
    try { r.start(); } catch { garde = null; }
  }

  if (window.clipiaScene) {
    window.clipiaScene.touche = (e) => { if (e === 'parle') interrompre(); else if (enEcoute) { if (conversationVocale) stopperConversation('Écoute arrêtée.'); else arreter(); } else ecouter(); };
    window.clipiaScene.fermee = () => { if (parleEnCours()) { couperVoix(); gardeStop(); } };
  }
  async function parler(texte, apres) {
    if (!vocalActif) { apres?.(); return; }
    let propre = String(texte || '').replace(/\[\[action:[^\]]*\]\]/gi, '').replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    // Elle ne prononce jamais son propre nom à voix haute : « Clipia » reste le mot qui l'interrompt, il ne peut pas venir d'elle-même.
    propre = propre.replace(/\b(?:clipia|clippia)\b/gi, '').replace(/\s+([,.!?;:])/g, '$1').replace(/([,;:])\s*(?=[,.!?;:])/g, '').replace(/^[\s,;:.!?-]+/, '').replace(/\s{2,}/g, ' ').trim();
    if (!propre) { apres?.(); return; }
    dernierDit = propre; window.clipiaScene?.texte(propre.length > 160 ? propre.slice(0, 157) + '…' : propre);
    const suite0 = apres; apres = () => { finParole = Date.now(); gardeStop(); if (!conversationVocale && !enEcoute) etatOrbe(''); suite0?.(); };
    if (propre.length > 8) setTimeout(() => gardeStart(propre), 500);

    etatOrbe('parle'); dire('Clipia répond…');
    if (enEcoute && recognition) { ignorerFin = true; try { recognition.stop(); } catch {} }   // elle ne s'écoute pas parler
    try {
      const r = await api('/api/voix/parler', { method: 'POST',
        body: JSON.stringify({ texte: propre.slice(0, 3800), voix: voixChoisie() }) });
      if (r.navigateur) { parlerNavigateur(propre, apres); return; }
      audioEnCours?.pause();
      audioEnCours = new Audio(r.url);
      audioEnCours.onended = () => apres?.();
      audioEnCours.onerror = () => parlerNavigateur(propre, apres);
      await audioEnCours.play();
    } catch { parlerNavigateur(propre, apres); }
  }

  window.clipiaVoix = {
    parler: t => parler(t), bulle: t => { try { bulle('assistant', t); } catch {} },
    libre: () => !parleEnCours() && !occupe && Date.now() - (window.__paroleUser || 0) > 2500 && vocalActif
  };
  function couperVoix() {
    try { audioEnCours?.pause(); audioEnCours = null; } catch {}
    try { coupeVoix?.(); window.speechSynthesis?.cancel(); } catch {}
  }

  // ── reconnaissance vocale ───────────────────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /**
   * Relance l'écoute après un blanc. Le délai laisse le temps au micro de se
   * refermer : sans lui, Chrome refuse le démarrage suivant (« already started »).
   */
  function relancerEcoute() {
    if (!conversationVocale) return;
    if (!permanent() && ++blancs > BLANCS_MAX)
      return stopperConversation('Je n\'ai rien entendu depuis un moment, j\'ai rendu le micro. Reclique quand tu veux reprendre.');
    dire(`J'écoute… parle quand tu veux.${!permanent() && blancs > 1 ? ` (${blancs}/${BLANCS_MAX} sans rien entendre)` : ''}`);
    setTimeout(() => { if (conversationVocale && !enEcoute) ecouter(); }, 900);
  }

  function stopperConversation(mot = 'Conversation vocale arrêtée.', definitif = true) {
    if (definitif) memoPerm(false);
    conversationVocale = false;
    blancs = 0;
    const b = $('#bConvVocale');
    if (b) { b.classList.remove('rec', 'actif'); b.textContent = '💬🎙'; }
    couperVoix();
    if (enEcoute) arreter();
    else { etatOrbe(''); fermerMicro(); montrerEcouteur(false); }
    if (mot) dire(mot);
  }

  let demarrantEcoute = false;
  async function ecouter() {
    if (enEcoute && !conversationVocale) return arreter();
    if (enEcoute) return;
    if (demarrantEcoute) return;
    window.speechSynthesis?.cancel();
    demarrantEcoute = true;
    try { await ouvrirMicro(); }
    catch (e) { demarrantEcoute = false; etatOrbe(''); montrerEcouteur(false); return dire(expliquerMicro(e)); }
    demarrantEcoute = false;
    if (enEcoute) return;

    enEcoute = true; etatOrbe('ecoute'); dire('Je vous écoute…');
    montrerEcouteur(true, 'Je vous écoute…');

    if (SR) {
      recognition = new SR();
      recognition.lang = 'fr-FR'; recognition.interimResults = true; recognition.continuous = true;
      let final = '', minuteur = null;
      recognition.onresult = e => {
        let partiel = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t; else partiel += t;
        }
        const vu = (final + partiel).trim(); if (vu) window.__paroleUser = Date.now();
        dire(vu || 'Je vous écoute…');
        legende.textContent = vu || 'Je vous écoute…'; window.clipiaScene?.texte(vu);
        if (vu) { dlgVoir(vu); clearTimeout(minuteur); minuteur = setTimeout(() => { try { recognition.stop(); } catch {} }, 1800); }   // elle te laisse finir : 1,8 s de vrai silence
      };
      recognition.onerror = ev => {
        clearTimeout(minuteur);
        enEcoute = false; etatOrbe(''); fermerMicro();
        if (conversationVocale && ev.error === 'no-speech') { if (occupe) { setTimeout(() => { if (conversationVocale && occupe && !enEcoute) ecouter(); }, 300); return; } return relancerEcoute(); }
        if (conversationVocale && (ev.error === 'not-allowed' || ev.error === 'audio-capture')) stopperConversation(undefined, false);
        dire(ev.error === 'no-speech' ? 'Je n\'ai rien entendu. Réessayez.'
          : ev.error === 'not-allowed' ? 'Micro refusé.'
          : 'Reconnaissance indisponible — bascule sur l\'enregistrement.');
        if (ev.error === 'network' || ev.error === 'service-not-allowed') enregistrer();
      };
      recognition.onend = () => {
        clearTimeout(minuteur);
        enEcoute = false; etatOrbe(''); fermerMicro();
        let t = final.trim();
        if (ignorerFin) { ignorerFin = false; return; }
        if (t && estEcho(t)) { t = ''; dire('(écho ignoré)'); }
        if (t) {
          blancs = 0;
          if (occupe) { try { ctrlTour?.abort(); } catch {} couperVoix(); }   // tu me coupes : j'abandonne et je t'écoute
          dlgMsg('user', t); $('#saisie').value = t; envoyer(true);
        }
        else if (conversationVocale && occupe) setTimeout(() => { if (conversationVocale && occupe && !enEcoute) ecouter(); }, 300);
        else if (conversationVocale) relancerEcoute();
        else dire('Je n\'ai rien entendu. Réessayez.');
      };
      recognition.start();
    } else {
      enregistrer();
    }
  }

  /** Repli universel : on enregistre, puis on fait transcrire par le serveur. */
  async function enregistrer() {
    if (!stt.length) {
      enEcoute = false; etatOrbe(''); fermerMicro();
      return dire('Reconnaissance vocale indisponible ici. Configurez un moteur de transcription (Whisper, Groq ou whisper.cpp) dans le coffre.');
    }
    if (!flux) { try { await ouvrirMicro(); } catch (e) { etatOrbe(''); return dire(expliquerMicro(e)); } }
    enEcoute = true; etatOrbe('ecoute'); dire('Enregistrement… touchez l\'orbe pour arrêter.');
    morceaux = [];
    recorder = new MediaRecorder(flux);
    recorder.ondataavailable = e => morceaux.push(e.data);
    recorder.onstop = async () => {
      fermerMicro(); enEcoute = false; etatOrbe('reflechit'); dire('Transcription…');
      try {
        const blob = new Blob(morceaux, { type: 'audio/webm' });
        const fd = new FormData(); fd.append('f', blob, 'voix.webm');
        const a = await api('/api/televerser', { method: 'POST', body: fd });
        const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({
          type: 'transcription', payload: { provider: stt[0].id, filePath: a.file, language: 'fr' } }) });
        const r = await attendre(job.id);
        const t = (r?.text || '').trim();
        if (t) { $('#saisie').value = t; envoyer(true); }
        else { etatOrbe(''); dire('Rien compris. Réessayez.'); }
      } catch (e) { etatOrbe(''); dire('Transcription impossible : ' + e.message); }
    };
    recorder.start();
  }

  function arreter() {
    if (recognition) { try { recognition.stop(); } catch {} }
    else if (recorder?.state === 'recording') recorder.stop();
    else { enEcoute = false; etatOrbe(''); fermerMicro(); dire('Touchez l\'orbe et parlez, ou écrivez ci-dessous.'); }
  }

  const attendre = (jobId) => new Promise((resolve, reject) => {
    const es = new EventSource(`${API}/api/taches/${jobId}/flux`);
    es.onmessage = m => {
      const j = JSON.parse(m.data);
      if (j.status === 'terminé') { es.close(); resolve(j.result); }
      if (j.status === 'échec') { es.close(); reject(new Error(j.error)); }
    };
    es.onerror = () => { es.close(); reject(new Error('flux interrompu')); };
  });

  // ── pièces jointes ──────────────────────────────────────────────────────
  function dessinerJointes() {
    const z = $('#jointes');
    z.hidden = !jointes.length;
    z.innerHTML = jointes.map((j, i) => `
      <div class="jointe">
        ${j.apercu ? `<img src="${j.apercu}" alt="">` : `<span>${j.icone}</span>`}
        <span class="n">${esc(j.nom)}</span>
        ${j.etat ? `<span class="etat">${esc(j.etat)}</span>` : ''}
        <span class="x" data-x="${i}">×</span>
      </div>`).join('');
    z.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { jointes.splice(+b.dataset.x, 1); dessinerJointes(); });
  }

  const lireFichier = (f, mode) => new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    mode === 'url' ? r.readAsDataURL(f) : r.readAsText(f);
  });

  async function ajouterFichiers(liste) {
    for (const f of liste) {
      if (f.size > 25 * 1024 * 1024) { toast(`${f.name} dépasse 25 Mo.`, 'err'); continue; }
      const j = { nom: f.name, fichier: f, icone: '📄' };
      jointes.push(j); dessinerJointes();

      if (f.type.startsWith('image/')) {
        j.icone = '🖼'; j.type = 'image';
        j.apercu = await lireFichier(f, 'url');
        j.dataURL = j.apercu;
      } else if (f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac)$/i.test(f.name)) {
        j.icone = '♪'; j.type = 'audio'; j.etat = 'transcription…';
        dessinerJointes();
        try {
          if (!stt.length) throw new Error('aucun moteur de transcription');
          const fd = new FormData(); fd.append('f', f);
          const a = await api('/api/televerser', { method: 'POST', body: fd });
          const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({
            type: 'transcription', payload: { provider: stt[0].id, filePath: a.file, language: 'fr' } }) });
          const r = await attendre(job.id);
          j.texte = r?.text || ''; j.etat = 'transcrit';
          j.cheminServeur = a.file;
        } catch (e) { j.etat = 'non transcrit'; j.cheminServeur = null; }
      } else if (/\.(txt|md|json|csv|js|ts|py|html|css|xml|yml|yaml|log|sh)$/i.test(f.name) || f.type.startsWith('text/')) {
        j.icone = '📄'; j.type = 'texte';
        j.texte = (await lireFichier(f, 'texte')).slice(0, 60000);
      } else {
        j.type = 'binaire'; j.etat = 'joint';
        const fd = new FormData(); fd.append('f', f);
        try { const a = await api('/api/televerser', { method: 'POST', body: fd }); j.cheminServeur = a.file; } catch {}
      }
      dessinerJointes();
    }
  }

  // ── le noyau : une seule Clipia pour le chat, la voix et les outils ─────
  //
  // Le serveur choisit le moteur le plus rapide qui répond, applique la
  // personnalité enregistrée, et peut agir (image, musique, fichiers, machine,
  // navigateur) en rendant à chaque fois une preuve. Quand une action engage
  // quelque chose, il s'arrête et c'est ici, par un clic, que la personne dit oui.
  function carteAccord(sortie, attente, vocal) {
    const carte = el(`<div class="carte" style="margin-top:10px;border-color:var(--or-sombre);max-width:none">
      <b style="font-size:13px">${attente.genre === 'question' ? 'Une question' : 'J\'ai besoin de ton accord'}</b>
      <p style="margin:6px 0 10px;font-size:13px;color:var(--texte-doux)">${esc(attente.resume || attente.question || '')}</p>
      ${attente.commande ? `<code style="display:block;margin-bottom:10px;font-size:12px;word-break:break-all">${esc(attente.commande)}</code>` : ''}
      <div class="rang" style="flex-wrap:wrap"></div></div>`);
    const rang = carte.querySelector('.rang');
    const fin = () => carte.remove();
    if (attente.genre === 'question') {
      (attente.propositions || []).forEach(p => {
        const b = el(`<button class="btn mini">${esc(p)}</button>`);
        b.onclick = () => { fin(); $('#saisie').value = p; envoyer(vocal); };
        rang.append(b);
      });
    } else {
      const oui = el('<button class="btn or mini">Autoriser, une seule fois</button>');
      const non = el('<button class="btn mini">Refuser</button>');
      oui.onclick = async () => {
        oui.disabled = non.disabled = true;
        try {
          const a = await api('/api/noyau/accord', { method: 'POST', headers: { 'x-clipia-accord': '1' },
            body: JSON.stringify({ commande: attente.commande, categorie: attente.categorie }) });
          fin();
          const s2 = bulle('assistant', '');
          await tourNoyau({ message: '', reprise: { outil: attente.outil, parametres: attente.parametres, accord: a.accord }, sortie: s2, vocal });
        } catch (e) { toast('Accord impossible : ' + e.message, 'err'); oui.disabled = non.disabled = false; }
      };
      non.onclick = () => {
        fin();
        hist.push({ role: 'user', content: 'Non, ne le fais pas.' });
        sortie.textContent = (sortie.textContent ? sortie.textContent + '\n' : '') + 'D\'accord, je ne le fais pas.';
        etatOrbe('');
        if (conversationVocale) relancerEcoute();
      };
      rang.append(oui, non);
    }
    sortie.parentElement.append(carte);
    carte.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function tourNoyau({ message, reprise = null, sortie, vocal, signal }) {
    const panneau = el('<details class="reflexion" open style="margin-top:8px;font-size:12.5px;color:var(--texte-faible);border-left:2px solid var(--or-sombre,#6d4fd6);padding-left:10px"><summary style="cursor:pointer;user-select:none">💭 Clipia réfléchit…</summary></details>');
    const trace = el('<div style="display:grid;gap:3px;margin-top:4px"></div>'); panneau.append(trace);
    const medias = el('<div style="display:grid;gap:8px;margin-top:8px"></div>');
    sortie.parentElement.append(panneau, medias);
    let nEtapes = 0;
    actEtape('Réflexion');
    const lignes = {};
    const choisi = $('#modele').value;
    let rep;
    try {
      rep = await fetch(API + '/api/noyau/converser', {
        signal, method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message, reprise, mode: psyActif?.id || undefined,
          historique: hist.slice(0, message ? -1 : undefined).map(m => ({ role: m.role, content: m.content })),
          blanc: window.clipiaV61?.blanc?.() || undefined,
          vocal: Boolean(vocal || vocalActif || conversationVocale),
          provider: choisi || undefined, model: choisi ? ($('#variante')?.value || undefined) : undefined
        })
      });
    } catch (e) { throw new Error('Le serveur de Clipia ne répond pas : ' + e.message); }

    const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '', final = null;
    while (true) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const l = buf.split('\n'); buf = l.pop();
      for (const L of l) {
        if (!L.startsWith('data:')) continue;
        const e = JSON.parse(L.slice(5));
        if (e.type === 'erreur' && e.code === 'credit') { window.clipiaCredit?.ouvrir(); throw new Error(e.message); }
        if (e.type === 'erreur') throw new Error(/Tous les fournisseurs ont échoué/.test(e.message || '') ? 'Aucun cerveau ne répond pour l’instant.' : e.message);
        if (e.type === 'reflexion') { nEtapes = e.etape; actEtape('Réflexion'); trace.append(el(`<div style="opacity:.8">▸ Étape ${e.etape}${e.etape > 1 ? ' — je continue' : ' — je comprends ta demande'}</div>`)); }
        if (e.type === 'pensee') trace.append(el(`<div style="font-style:italic;white-space:pre-wrap;max-height:9em;overflow:auto;opacity:.85">💭 ${esc(e.texte)}</div>`));
        if (e.type === 'message') { sortie.textContent = e.texte; if (e.texte) trace.append(el(`<div style="opacity:.8">🗨 ${esc(e.texte.slice(0, 240))}</div>`)); }
        if (e.type === 'outil') {
          const d = el(`<div>⚙ ${esc(e.outil.replace(/_/g, ' '))}${e.parametres ? ' — ' + esc(e.parametres) : ''}</div>`);
          actEtape('Exécution'); lignes[e.outil] = d; trace.append(d); dire(`J'utilise « ${e.outil.replace(/_/g, ' ')} »…`); panneau.querySelector('summary').textContent = '💭 Clipia agit : ' + e.outil.replace(/_/g, ' ') + '…';
        }
        if (e.type === 'simule') window.clipiaV61?.carteSimule(trace, e);
        if (e.type === 'attente') actEtape('Interaction');
        if (e.type === 'resultat') {
          actEtape('Vérification');
          const d = lignes[e.outil]; if (d) {
            d.style.color = e.ok ? 'var(--ok)' : 'var(--alerte)';
            d.textContent = (e.ok ? '✓ ' : '✗ ') + d.textContent.slice(2) + (e.ok ? '' : ' — ' + (e.resultat || '').slice(0, 160));
          }
        }
        if (e.type === 'effet') {
          if (e.genre === 'ouvrir' && e.cible) setTimeout(() => { location.hash = '#/' + e.cible; }, 1200);
          if (e.genre === 'media' && e.url) { const lv = window.clipiaLivrables?.livrer({ url: e.url, nom: e.nom, outil: e.outil }); if (lv) medias.append(lv); else medias.append(mediaLien({ url: /^\//.test(e.url) ? API + e.url : e.url })); }
        }
        if (e.type === 'termine') final = e;
      }
    }
    if (!final) { actFin(); throw new Error('La réponse s\'est interrompue.'); }
    actEtape('Réponse'); setTimeout(actFin, 1200);
    const brutFinal = (final.texte || sortie.textContent || '').trim();
    const { propre: texte, guides } = extraireGuides(brutFinal);
    { const mc = /\n?\s*💡\s*Conseil\s*:\s*([\s\S]{3,500})$/i.exec(texte);
      sortie.textContent = mc ? texte.slice(0, mc.index).trim() : texte;
      if (mc) sortie.parentElement?.append(el(`<div class="conseil">💡 <b>Conseil</b> — ${esc(mc[1].trim())}</div>`)); }
    dlgMsg('assistant', texte);
    if (!trace.childElementCount) panneau.remove(); else { panneau.open = false; panneau.querySelector('summary').textContent = `💭 Voir comment j'ai réfléchi (${Math.max(nEtapes, 1)} étape${nEtapes > 1 ? 's' : ''})`; }
    if (!medias.childElementCount) medias.remove();
    if (brutFinal) { hist.push({ role: 'assistant', content: brutFinal }); retenirFin(texte); await sauver(); }
    for (const g of guides) { rendreGuide(sortie.parentElement, g); sauverGuide(g); }

    if (final.attente) {
      etatOrbe(''); carteAccord(sortie, final.attente, vocal);
      if (texte && (vocal || vocalActif)) parler(texte, () => {});
      return;
    }
    if (vocal || vocalActif) parler(texte, () => { if (conversationVocale) ecouter(); else atoiMontrer(); });
    else { etatOrbe(''); if (conversationVocale) relancerEcoute(); else { dire('Je t\'écoute.'); atoiMontrer(); } }
  }

  function mediaLien(e) {
    const type = String(e.type || e.mime || '');
    const url = e.url;
    if (/image|png|jpe?g|webp/i.test(type + url)) return el(`<img src="${esc(url)}" alt="" style="max-width:min(100%,520px);border-radius:12px;margin-top:6px;cursor:zoom-in" onclick="window.open(this.src)">`);
    if (/audio|mp3|wav|ogg/i.test(type + url)) return el(`<audio controls src="${esc(url)}" style="margin-top:6px;max-width:100%"></audio>`);
    if (/video|mp4|webm/i.test(type + url)) return el(`<video controls src="${esc(url)}" style="margin-top:6px;max-width:min(100%,560px);border-radius:12px"></video>`);
    return el(`<a href="${esc(url)}" target="_blank" rel="noopener">Ouvrir le résultat</a>`);
  }

  // ── envoi ───────────────────────────────────────────────────────────────
  async function envoyer(vocal = false) {
    const brut = $('#saisie').value.trim();
    if (!brut && !jointes.length) { if (conversationVocale) relancerEcoute(); return; }
    if (!llms.length) {
      toast('Aucun modèle configuré.', 'err');
      if (conversationVocale) stopperConversation('Choisis d\'abord un modèle au-dessus, puis relance la conversation vocale.', false);
      return;
    }

    let texte = brut;
    const images = [];
    for (const j of jointes) {
      if (j.type === 'image') images.push(j.dataURL);
      else if (j.texte) texte += `\n\n--- ${j.nom} ---\n${j.texte}`;
      else if (j.cheminServeur) texte += `\n\n[fichier joint : ${j.nom} → ${j.cheminServeur}]`;
    }

    bulle('user', brut || `(${jointes.length} pièce(s) jointe(s))`,
      jointes.length ? jointes.map(j => j.nom).join(' · ') : '');
    hist.push({ role: 'user', content: texte, images });
    $('#saisie').value = ''; $('#saisie').style.height = 'auto';
    jointes = []; dessinerJointes();

    // X8 : les réponses sur l'avancement des travaux sont instantanées (sans modèle) — elle répond toujours.
    if (!images.length) {
      let rapide = null; try { rapide = await window.clipiaTravaux?.rapide(brut); } catch {}
      if (rapide) {
        bulle('assistant', rapide.texte); hist.push({ role: 'assistant', content: rapide.texte }); try { sauver(); } catch {}
        if (vocal || vocalActif) parler(rapide.texte, () => { if (conversationVocale) ecouter(); });
        else { etatOrbe(''); if (conversationVocale) relancerEcoute(); }
        return;
      }
    }
    etatOrbe('reflechit'); dire('Clipia réfléchit…');
    const sortie = bulle('assistant', '');
    let complet = '';

    // Texte seul : le noyau (moteur le plus rapide, personnalité du serveur, outils avec preuves).
    // Avec une image jointe : l'ancien chemin, qui transmet les images au moteur de vision.
    if (!images.length) {
      ctrlTour = new AbortController(); const monCtrl = ctrlTour; occupe = true;
      // Elle continue d'écouter pendant qu'elle réfléchit (mode conversation vocale).
      if (conversationVocale) setTimeout(() => { if (occupe && conversationVocale && !enEcoute) ecouter(); }, 700);
      try { await tourNoyau({ message: texte, sortie, vocal, signal: monCtrl.signal }); }
      catch (e) {
        if (monCtrl.signal.aborted) { sortie.textContent = sortie.textContent || '(interrompu — je t\'écoute)'; sortie.parentElement?.classList.add('interrompu'); }
        else {
          sortie.textContent = '⚠ ' + e.message; etatOrbe(''); dire(e.message); window.clipiaAide?.sous(sortie, e.message);
          // Une réponse ne reste jamais sans réponse : une fenêtre propose un autre cerveau et relance la même question.
          if (!/heures offertes/.test(e.message)) window.clipiaV61?.proposerAutreModele({ erreur: e.message, essayer: async (provider, model) => {
            const m = $('#modele'); if (m) { m.value = provider || ''; await majVariantes(); const v = $('#variante'); if (v && model) v.value = model; }
            sortie.textContent = '…'; ctrlTour = new AbortController(); const c2 = ctrlTour; occupe = true;
            try { await tourNoyau({ message: texte, sortie, vocal, signal: c2.signal }); try { localStorage.setItem('clipia:cerveau', JSON.stringify({ provider: provider || '', model: model || '' })); window.dispatchEvent(new Event('clipia:cerveau')); } catch {} return true; }
            catch (e2) { sortie.textContent = '⚠ ' + e2.message; etatOrbe(''); return e2.message; }
            finally { if (ctrlTour === c2) { occupe = false; ctrlTour = null; } }
          } });
          if (conversationVocale) relancerEcoute();
        }
      }
      finally { if (ctrlTour === monCtrl) { occupe = false; ctrlTour = null; } }
      return;
    }

    try {
      const rep = await fetch(API + '/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: $('#modele').value, model: $('#variante')?.value || undefined,
          messages: hist, temperature: 0.8, maxTokens: 2200,
          system: CLIPIA_PERSO({ vocal: true }) + consigneAntiRepetition() })
      });
      const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lignes = buf.split('\n'); buf = lignes.pop();
        for (const L of lignes) {
          if (!L.startsWith('data:')) continue;
          const e = JSON.parse(L.slice(5));
          if (e.erreur) {
            sortie.textContent = '⚠ ' + e.erreur; etatOrbe(''); dire(e.erreur);
            if (conversationVocale) relancerEcoute();
            return;
          }
          if (e.delta) { complet += e.delta; sortie.textContent = complet; }
        }
      }
      hist.push({ role: 'assistant', content: complet });
      retenirFin(complet); sauver();

      // Action éventuelle : on la retire du texte lu, puis on l'exécute.
      const act = complet.match(/\[\[action:([a-z]+)\|([^\]]*)\]\]/i);
      const propre = complet.replace(/\[\[action:[^\]]*\]\]/gi, '').trim();
      if (act) sortie.textContent = propre;

      if (vocal || vocalActif) parler(propre || complet, () => { if (conversationVocale) ecouter(); });
      else {
        etatOrbe('');
        if (conversationVocale) relancerEcoute();
        else dire('Touchez l\'orbe — je vous accueille et je vous écoute.');
      }
      if (act) setTimeout(() => executer(act[1].toLowerCase(), act[2].trim()), 450);
    } catch (e) {
      sortie.textContent = '⚠ ' + e.message; etatOrbe(''); dire(e.message);
      if (conversationVocale) relancerEcoute();
    }
  }

  // ── exécution des actions ───────────────────────────────────────────────
  const NOMS_SECTIONS = {
    clip:'Audio → Vidéo', image:'Image et 3D', video:'Vidéo', musique:'Musique',
    paroles:'Paroles et voix', agent:'Agent développeur', medias:'Médiathèque',
    partage:'Partage', connecteurs:'Intégrations', modeles:'Modèles IA',
    locales:'IA locales', coffre:'Coffre de clés', taches:'File de tâches',
    workflows:'Workflows', skills:'Skills', abonnement:'Abonnement'
  };

  function executer(nom, param) {
    if (nom === 'ouvrir' && NOMS_SECTIONS[param]) {
      toast(`Ouverture : ${NOMS_SECTIONS[param]}`, 'ok');
      location.hash = '#/' + param;
      return;
    }
    if (nom === 'agent' && param) {
      toast('Lancement de l\'agent développeur', 'ok');
      try { sessionStorage.setItem('clipia:agent:demande', param); } catch {}
      location.hash = '#/agent';
      return;
    }
  }

  // ── branchements ────────────────────────────────────────────────────────
  // Liste des modèles du fournisseur choisi
  async function majVariantes() {
    const sel = $('#variante'); if (!sel) return;
    const f = llms.find(x => x.id === $('#modele').value);
    if (!f) { sel.innerHTML = '<option value="">—</option>'; return; }
    sel.innerHTML = (f.models || []).map(m => `<option>${esc(m)}</option>`).join('') || '<option value="">par défaut</option>';
    try {
      const p2 = await api(`/api/fournisseurs/${f.id}/ping`);
      if (p2.models?.length) sel.innerHTML = p2.models.map(m => `<option>${esc(m)}</option>`).join('');
    } catch {}
  }
  $('#modele')?.addEventListener('change', majVariantes);
  let appliqueC = false;
  try {   // le choix fait dans le widget « cerveau » (en haut) s'applique ici
    const c = JSON.parse(localStorage.getItem('clipia:cerveau') || 'null');
    if (c?.provider && $('#modele') && [...$('#modele').options].some(o => o.value === c.provider)) {
      appliqueC = true; $('#modele').value = c.provider;
      majVariantes().then(() => { if (c.model && $('#variante') && [...$('#variante').options].some(o => o.value === c.model)) $('#variante').value = c.model; });
    }
  } catch {}
  if (!appliqueC) majVariantes();

  orbe.onclick = () => {
    if (!sceneRacine.classList.contains('dock')) return accueillir();
    // orbe rangée à côté de la discussion : elle sert d'interrupteur d'écoute (et coupe la parole si elle parle)
    if (parleEnCours()) return interrompre();
    $('#bConvVocale').onclick();
  };
  // Barre d'espace : elle se tait aussitôt et m'écoute ; un second appui envoie ce que j'ai dit.
  const espaceOn = () => { try { return localStorage.getItem('clipia:espace') !== 'off'; } catch { return true; } };
  if (window.__espaceHandler) document.removeEventListener('keydown', window.__espaceHandler, true);
  window.__espaceHandler = ev => {
    if (ev.code !== 'Space' || ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat || !espaceOn()) return;
    if (!$('#orbe')?.isConnected) return;
    const c = ev.target; if (c && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(c.tagName) || c.isContentEditable)) return;
    ev.preventDefault();
    vocalActif = true;
    if (parleEnCours()) return interrompre();
    if (enEcoute) return arreter();
    atoiCacher(); couperVoix(); ecouter();
  };
  document.addEventListener('keydown', window.__espaceHandler, true);
  const casEspace = $('#espaceOn'); if (casEspace) { casEspace.checked = espaceOn(); casEspace.onchange = () => { try { localStorage.setItem('clipia:espace', casEspace.checked ? 'on' : 'off'); } catch {} }; }
  $('#experience').onclick = () => {
    vocalActif = true;
    $('#bVoix').classList.add('actif');
    $('#bVoix').textContent = '\u{1F50A}';
    document.querySelector('.scene').scrollIntoView({ behavior: 'smooth', block: 'start' });
    accueillir();
  };
  $('#bulleEcoute').onclick = arreter;
  v.querySelector('.question').onclick = accueillir;
  try { const vt = v.querySelector('#vitrine'); if (vt && window.__vitrineAccueil) vt.append(window.__vitrineAccueil()); } catch {}
  v.querySelectorAll('.sugg').forEach(b => b.onclick = () => {
    $('#saisie').value = b.textContent; envoyer(false);
  });
  $('#bParler').onclick = () => { if (enEcoute) return arreter(); atoiCacher(); couperVoix(); ecouter(); };
  $('#bMicro').onclick = () => { ecouter(); $('#bMicro').classList.toggle('rec', !enEcoute); };

  // Diagnostic du micro : on demande l'accès, on mesure le niveau, on le rend.
  $('#bTestMicro').onclick = async () => {
    dire('Test du microphone…');
    try {
      await ouvrirMicro();
      montrerEcouteur(true, 'Parlez — je mesure le niveau…');
      let max = 0;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const t0 = Date.now();
      await new Promise(r => {
        (function mesure() {
          if (!analyser) return r();
          analyser.getByteFrequencyData(data);
          max = Math.max(max, ...data);
          Date.now() - t0 > 3500 ? r() : requestAnimationFrame(mesure);
        })();
      });
      fermerMicro();
      const moteurs = stt.length ? stt.map(f => f.label).join(', ') : 'aucun';
      dire(max > 18
        ? `✓ Micro fonctionnel (niveau ${Math.round(max / 2.55)} %). Transcription : ${moteurs}.`
        : `Micro accessible mais je n'ai capté aucun son. Vérifiez qu'il n'est pas coupé et que c'est le bon périphérique dans les réglages Windows. Transcription : ${moteurs}.`);
    } catch (e) { fermerMicro(); dire(expliquerMicro(e)); }
  };
  $('#bEnvoi').onclick = () => envoyer(false);
  $('#bVider').onclick = () => { location.hash = '#/clipia?n=' + Date.now(); };
  $('#bVoix').onclick = () => {
    vocalActif = !vocalActif;
    $('#bVoix').classList.toggle('actif', vocalActif);
    $('#bVoix').textContent = vocalActif ? '🔊' : '🔇';
    if (!vocalActif) window.speechSynthesis?.cancel();
    dire(vocalActif ? 'Réponses à voix haute activées.' : 'Réponses silencieuses.');
  };
  $('#bVoix').classList.add('actif');

  // ── conversation vocale continue ────────────────────────────────────────
  //
  // Un seul bouton : on l'enclenche et on parle. Elle écoute, répond à voix
  // haute, puis se remet à écouter. On le reclique pour sortir. La voix haute
  // est forcée : sans elle le mode n'aurait aucun sens.
  $('#bConvVocale').onclick = async () => {
    if (conversationVocale) return stopperConversation('Écoute arrêtée. Touche l\'orbe ou le micro pour que je réécoute en permanence.');
    memoPerm(true);
    if (!SR && !stt.length) return dire(
      'Pour la conversation vocale il faut soit la reconnaissance de Chrome, soit un moteur de transcription dans le Coffre (Groq fait très bien l\'affaire).');
    conversationVocale = true;
    blancs = 0;
    vocalActif = true;
    $('#bVoix').classList.add('actif'); $('#bVoix').textContent = '🔊';
    const b = $('#bConvVocale');
    b.classList.add('rec', 'actif'); b.textContent = '⏹';
    dire('Conversation vocale : parle, je réponds à voix haute et je réécoute. Reclique pour arrêter.');
    ecouter();
  };

  // Le gros bouton : même mécanique que 💬🎙, en bien visible, avec son état.
  const majGrosMicro = () => {
    const b = $('#grosMicro');
    if (!b || !b.isConnected) return clearInterval(ivMicro);
    b.setAttribute('aria-pressed', String(conversationVocale));
    $('#grosMicroIc').textContent = conversationVocale ? '⏹' : '🎙';
    $('#grosMicroTxt').textContent = conversationVocale ? 'Je t\'écoute — touche pour arrêter' : 'Parler à Clipia';
    b.style.background = conversationVocale ? 'linear-gradient(135deg,#dc2626,#7c3aed)' : 'linear-gradient(135deg,#7c3aed,#2563eb)';
  };
  $('#grosMicro').onclick = async () => { await $('#bConvVocale').onclick(); majGrosMicro(); };
  const ivMicro = setInterval(majGrosMicro, 600);

  // ── Mode appel : « Clipia ! » ───────────────────────────────────────────
  //
  // Une écoute en arrière-plan ne cherche qu'un mot : Clipia. Dès qu'elle l'entend,
  // un bip, un « Oui ? » parlé, puis elle écoute la demande (ou prend celle qui
  // suivait déjà le mot : « Clipia, fais-moi un clip »). Ensuite elle retourne en veille.
  // Repose sur la reconnaissance vocale du navigateur (Chrome, Edge). La transcription
  // est faite par le service du navigateur : ce mode n'est donc pas « 100 % hors ligne ».
  let appelActif = false, veille = null;
  const parleEnCours = () => { try { return !!window.speechSynthesis?.speaking || (audioEnCours && !audioEnCours.paused && !audioEnCours.ended); } catch { return false; } };
  const memoAppel = (v) => { try { v === undefined ? 0 : localStorage.setItem('clipia:appel', v ? '1' : '0'); return localStorage.getItem('clipia:appel') === '1'; } catch { return false; } };
  function bip() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const c = new C(), o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(660, c.currentTime); o.frequency.exponentialRampToValueAtTime(990, c.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25); setTimeout(() => c.close?.(), 400);
    } catch {}
  }
  function majAppelUI() {
    const b = $('#bAppel'); if (!b) return;
    b.classList.toggle('actif', appelActif);
    b.title = appelActif ? 'Mode appel ACTIF — dis « Clipia ». Clique pour le couper.' : 'Mode appel — dis « Clipia » à tout moment et elle te répond';
  }
  function veilleStop() { const r = veille; veille = null; if (r) { try { r.onend = null; r.onresult = null; r.onerror = null; r.abort(); } catch {} } }
  function veilleDemarrer() {
    if (!SR || !appelActif || veille || enEcoute || conversationVocale) return;
    const r = new SR();
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true;
    veille = r;
    let declenche = false, cumul = '', attenteAppel = null;
    r.onresult = e => {
      if (!declenche && parleEnCours()) {
        const tt = Array.from(e.results).map(x => x[0].transcript).join(' ');
        if (MOTS_STOP.test(tt)) { declenche = true; try { r.abort(); } catch {} veille = null; interrompre(); }
        return;
      }
      cumul = Array.from(e.results).map(x => x[0].transcript).join(' ');   // après stop(), le résultat final arrive ici
      if (!declenche && detecterAppel(cumul).trouve) declenche = true;
      if (declenche) {
        // « Clipia » seul : elle répond vite. « Clipia, fais-moi… » : elle te laisse finir (3 s de silence).
        clearTimeout(attenteAppel);
        const dejaDit = detecterAppel(cumul).reste.trim().length > 0;
        attenteAppel = setTimeout(() => { try { r.stop(); } catch { r.onend?.(); } }, dejaDit ? 3000 : 1300);
        if (dejaDit) dlgVoir(detecterAppel(cumul).reste);
      }
    };
    r.onerror = ev => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        appelActif = false; memoAppel(false); majAppelUI(); veilleStop();
        dire('Mode appel coupé : le micro est refusé. Autorise-le puis reclique 📣.');
      }
    };
    r.onend = () => {
      clearTimeout(attenteAppel);
      if (veille === r) veille = null;
      if (!declenche) return;                       // sinon, le chien de garde relance la veille
      const d = detecterAppel(cumul);
      repondreAppel(d.reste);
    };
    try { r.start(); } catch { veille = null; }
  }
  function repondreAppel(reste) {
    bip(); appelDeclenche = true;
    const mots = (reste || '').split(/\s+/).filter(Boolean);
    if (mots.length >= 1) { dlgMsg('user', reste); $('#saisie').value = reste; dire('Appel : « ' + reste + ' »'); envoyer(true); return; }
    const phrase = phraseAppel(window.__profil);
    etatOrbe('ecoute'); dire(phrase); dlgMsg('assistant', phrase);
    const vo = vocalActif; vocalActif = true;
    parler(phrase, () => { vocalActif = vo; ecouter(); });
  }
  $('#bAppel').onclick = () => {
    if (!SR) return dire('Le mode appel demande la reconnaissance vocale intégrée de Chrome ou Edge. Ce navigateur n\'en a pas : utilise 💬🎙 ou ouvre Clipia dans Chrome.');
    appelActif = !appelActif; memoAppel(appelActif); majAppelUI();
    if (appelActif) { dire('Mode appel activé : dis « Clipia » à tout moment.'); veilleDemarrer(); }
    else { veilleStop(); dire('Mode appel coupé.'); }
  };
  // chien de garde : relance la veille quand plus rien d'autre n'utilise le micro
  const ivVeille = setInterval(() => {
    if (!$('#bAppel')?.isConnected) { veilleStop(); clearInterval(ivVeille); return; }
    if (appelActif && !veille && !enEcoute && !conversationVocale && !parleEnCours()) veilleDemarrer();
  }, 1500);
  if (SR && memoAppel()) { appelActif = true; majAppelUI(); veilleDemarrer(); }

  // ── écoute permanente ───────────────────────────────────────────────────
  // Elle se remet à l'écoute toute seule dès que le micro est libre (après une réponse, une erreur, un blanc, une coupure du navigateur),
  // et elle ne s'arrête que si tu la coupes toi-même.
  function demarrerPermanent() {
    if (conversationVocale || !SR) return;
    conversationVocale = true; blancs = 0; vocalActif = true;
    const bv = $('#bVoix'); if (bv) { bv.classList.add('actif'); bv.textContent = '🔊'; }
    const b = $('#bConvVocale'); if (b) { b.classList.add('rec', 'actif'); b.textContent = '⏹'; }
    ecouter();
  }
  const ivPerm = setInterval(() => {
    if (!$('#bConvVocale')?.isConnected) return clearInterval(ivPerm);
    if (!SR || !permanent() || document.hidden || !conversationVocale) return;
    if (!enEcoute && !demarrantEcoute && !occupe && !parleEnCours() && !garde) ecouter();
  }, 1500);
  if (SR && permanent() && !psyDemande) {
    try {
      navigator.permissions?.query({ name: 'microphone' }).then(st => {
        if (st.state === 'granted') setTimeout(() => { if (!conversationVocale && $('#bConvVocale')?.isConnected) demarrerPermanent(); }, 1200);
        else dire('Touche l\'orbe une fois pour autoriser le micro : ensuite je t\'écoute en permanence.');
      }).catch(() => {});
    } catch {}
  }

  // X7 — mission lancée depuis une autre section (ex. « Promotion en 1 clic »)
  try {
    const amorce = sessionStorage.getItem('clipia:amorce');
    if (amorce) { sessionStorage.removeItem('clipia:amorce'); setTimeout(() => { if ($('#saisie')?.isConnected) { $('#saisie').value = amorce; envoyer(); } }, 900); }
  } catch {}

  // ── réglages du ton et de la voix ───────────────────────────────────────
  const panTon = $('#panTon');

  let persoServeur = null, modeChoisi = null;
  function dessinerModes() {
    $('#modesPerso').innerHTML = persoServeur.modes.map(m =>
      `<button class="btn mini${m.id === modeChoisi ? ' or' : ''}" data-mode="${m.id}">${m.emoji} ${esc(m.nom)}</button>`).join('');
    $('#modesPerso').querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { modeChoisi = b.dataset.mode; dessinerModes(); });
    $('#modeQuoi').textContent = persoServeur.modes.find(m => m.id === modeChoisi)?.quoi || '';
  }

  async function ouvrirReglages() {
    $('#tonTexte').value = tonChoisi();
    panTon.hidden = false;
    try {
      persoServeur = await api('/api/noyau/personnalite');
      modeChoisi = persoServeur.actif;
      $('#persoPrenom').value = persoServeur.profil.prenom || '';
      $('#persoFait').value = persoServeur.profil.fait || '';
      if (persoServeur.profil.tonLibre) $('#tonTexte').value = persoServeur.profil.tonLibre;
      dessinerModes();
    } catch (e) { $('#modeQuoi').textContent = 'Modes indisponibles : ' + e.message; }
    panTon.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const sel = $('#selVoix');
    if (!sel.options.length) {
      sel.innerHTML = '<option>chargement…</option>';
      try {
        const e = await api('/api/voix');
        const act = voixChoisie();
        sel.innerHTML = Object.entries(e.voix || {}).map(([id, v]) =>
          `<option value="${esc(id)}"${id === act ? ' selected' : ''}>${esc(v.nom)} — ${esc(v.quoi)}</option>`).join('');
        const prete = (e.voies || []).filter(x => x.pret && x.naturel === 'excellent').map(x => x.nom);
        $('#etatVoix').textContent = prete.length
          ? `Voix naturelles disponibles : ${prete.join(', ')}. Ordre d'essai : ${e.ordre}`
          : 'Aucune voix naturelle joignable : elle parlera avec la voix du navigateur, plus mécanique.';
      } catch (err) {
        sel.innerHTML = '<option value="nova">Nova</option>';
        $('#etatVoix').textContent = 'État des voix indisponible : ' + err.message;
      }
    }
  }
  $('#bReglages').onclick = () => panTon.hidden ? ouvrirReglages() : (panTon.hidden = true);
  $('#fermerTon').onclick = () => { panTon.hidden = true; };

  panTon.querySelectorAll('[data-ton]').forEach(b => b.onclick = () => {
    $('#tonTexte').value = b.dataset.ton;
    $('#tonTexte').focus();
  });

  $('#selVoix').onchange = () => {
    try { localStorage.setItem('clipia:voix', $('#selVoix').value); } catch {}
  };

  $('#essaiVoix').onclick = async () => {
    try { localStorage.setItem('clipia:voix', $('#selVoix').value || 'nova'); } catch {}
    const garde = vocalActif; vocalActif = true;
    couperVoix();
    $('#etatVoix').textContent = 'Essai en cours…';
    try {
      const r = await api('/api/voix/parler', { method: 'POST', body: JSON.stringify({
        texte: 'Voilà ma voix. Dis-moi si elle te va, sinon on en essaie une autre.',
        voix: $('#selVoix').value || 'nova' }) });
      if (r.navigateur) {
        $('#etatVoix').textContent = 'Les voix naturelles n\'ont pas répondu — voici la voix du navigateur à la place.';
        parlerNavigateur('Voilà ma voix. Dis-moi si elle te va.', () => { vocalActif = garde; });
      } else {
        $('#etatVoix').textContent = `Voix servie par ${r.par}${r.gratuit ? ' (gratuit)' : ''}.`;
        const a = new Audio(r.url);
        a.onended = () => { vocalActif = garde; };
        await a.play();
      }
    } catch (e) {
      vocalActif = garde;
      $('#etatVoix').textContent = 'Essai impossible : ' + e.message;
    }
  };

  $('#validerTon').onclick = async () => {
    const t = $('#tonTexte').value.trim();
    definirTon(t);
    try { localStorage.setItem('clipia:voix', $('#selVoix').value || 'nova'); } catch {}
    try {
      await api('/api/noyau/personnalite', { method: 'POST', body: JSON.stringify({
        mode: modeChoisi || undefined, prenom: $('#persoPrenom').value.trim(), fait: $('#persoFait').value.trim(),
        tonLibre: t, voix: $('#selVoix').value || 'nova' }) });
    } catch (e) { toast('Enregistrement impossible : ' + e.message, 'err'); return; }
    panTon.hidden = true;
    dire(t ? 'C\'est noté — je parle comme ça à partir de maintenant.'
           : 'Réglage effacé : je reprends mon ton par défaut.');
  };

  const fIn = $('#fIn');
  const ouvrir = (accept) => { fIn.accept = accept; fIn.click(); };
  $('#bFichier').onclick = () => ouvrir('');
  $('#bImage').onclick   = () => ouvrir('image/*');
  $('#bAudio').onclick   = () => ouvrir('audio/*');
  fIn.onchange = () => { ajouterFichiers([...fIn.files]); fIn.value = ''; };

  const sa = $('#saisie');
  sa.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(false); } };
  sa.oninput = () => { sa.style.height = 'auto'; sa.style.height = Math.min(190, sa.scrollHeight) + 'px'; };
  sa.onpaste = e => {
    const f = [...(e.clipboardData?.files || [])];
    if (f.length) { e.preventDefault(); ajouterFichiers(f); }
  };

  const comp = $('#composeur');
  comp.ondragover = e => { e.preventDefault(); comp.classList.add('survol'); };
  comp.ondragleave = () => comp.classList.remove('survol');
  comp.ondrop = e => { e.preventDefault(); comp.classList.remove('survol'); ajouterFichiers([...e.dataTransfer.files]); };

  if (!SR && !stt.length) dire('Pour la voix, utilisez Chrome ou Edge, ou configurez un moteur de transcription.');
  window.speechSynthesis?.getVoices();
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION PAS À PAS — du choix du moteur jusqu'à la clé vérifiée.
// ═══════════════════════════════════════════════════════════════════════════
const MOTEURS_CONF = {
  groq: {
    label: 'Groq', prix: 'gratuit', duree: '2 minutes',
    resume: 'Le plus rapide à mettre en route. Compte gratuit, quota large, réponses très rapides.',
    lien: 'https://console.groq.com/keys', site: 'console.groq.com',
    prefixe: 'gsk_',
    pas: [
      ['Ouvrez la console Groq', 'Cliquez sur le bouton ci-dessous. Créez un compte gratuit avec votre e-mail ou votre compte Google.'],
      ['Créez la clé', 'Une fois connecté, cliquez sur <b>Create API Key</b>, donnez-lui un nom (par exemple « Clipia »), puis validez.'],
      ['Copiez-la immédiatement', 'Groq ne vous la remontrera jamais. Elle commence par <code>gsk_</code> et fait une cinquantaine de caractères, sans espace.'],
      ['Collez-la ci-dessous', 'Je la teste avant de l\'enregistrer : vous saurez tout de suite si elle fonctionne.']
    ]
  },
  gemini: {
    label: 'Google Gemini', prix: 'gratuit', duree: '2 minutes',
    resume: 'Gratuit et généreux. Comprend aussi les images, utile pour analyser un visuel.',
    lien: 'https://aistudio.google.com/apikey', site: 'aistudio.google.com',
    prefixe: 'AIza',
    pas: [
      ['Ouvrez Google AI Studio', 'Connectez-vous avec votre compte Google habituel.'],
      ['Créez la clé', 'Cliquez sur <b>Create API key</b>, puis sur <b>Create API key in new project</b>.'],
      ['Copiez-la', 'Elle commence par <code>AIza</code>.'],
      ['Collez-la ci-dessous', 'Je la vérifie auprès de Google avant d\'enregistrer.']
    ]
  },
  ollama: {
    label: 'Ollama', prix: 'gratuit', duree: '10 minutes', local: true,
    resume: 'Tourne sur votre machine. Aucune facture, aucune limite, et rien ne sort de chez vous.',
    lien: 'https://ollama.com/download', site: 'ollama.com',
    pas: [
      ['Ollama est déjà installé chez vous', 'Mais aucun modèle n\'est téléchargé — c\'est pour cela que Clipia ne trouve rien.'],
      ['Ouvrez PowerShell', 'Touche Windows, tapez « PowerShell », appuyez sur Entrée.'],
      ['Téléchargez un modèle', 'Tapez cette commande. Environ 2 Go, comptez quelques minutes selon votre connexion.', 'ollama pull llama3.2'],
      ['Laissez Ollama tourner', 'Dans la même fenêtre, lancez le serveur et laissez-la ouverte.', 'ollama serve'],
      ['Revenez ici', 'Cliquez sur « Vérifier » ci-dessous : Clipia va détecter le modèle.']
    ]
  },
  openai: {
    label: 'OpenAI', prix: 'payant', duree: '5 minutes',
    resume: 'Qualité de référence pour le texte et les images. Facturé à l\'usage, carte bancaire requise.',
    lien: 'https://platform.openai.com/api-keys', site: 'platform.openai.com',
    prefixe: 'sk-',
    pas: [
      ['Créez un compte', 'Sur platform.openai.com, avec votre e-mail.'],
      ['Ajoutez du crédit', 'Menu <b>Billing</b> → <b>Add payment method</b>. Cinq euros suffisent pour commencer : sans crédit, la clé existe mais ne répond pas.'],
      ['Créez la clé', '<b>API keys</b> → <b>Create new secret key</b>.'],
      ['Copiez-la', 'Elle commence par <code>sk-</code> et ne sera plus affichée ensuite.'],
      ['Collez-la ci-dessous', 'Je la teste avant d\'enregistrer.']
    ]
  },
  anthropic: {
    label: 'Anthropic Claude', prix: 'payant', duree: '5 minutes',
    resume: 'Excellent pour l\'écriture et le code. Facturé à l\'usage.',
    lien: 'https://console.anthropic.com/settings/keys', site: 'console.anthropic.com',
    prefixe: 'sk-ant-',
    pas: [
      ['Créez un compte', 'Sur console.anthropic.com.'],
      ['Ajoutez du crédit', 'Menu <b>Plans &amp; Billing</b>. Sans crédit, la clé ne répondra pas.'],
      ['Créez la clé', '<b>API keys</b> → <b>Create Key</b>.'],
      ['Copiez-la', 'Elle commence par <code>sk-ant-</code>.'],
      ['Collez-la ci-dessous', 'Je la vérifie avant d\'enregistrer.']
    ]
  }
};

VUES.configuration = async (v) => {
  let etape = 1, choisi = null;

  v.append(el(`
  <h1>Configuration pas à pas</h1>
  <p class="sous">Clipia a besoin d'un moteur pour réfléchir. Trois minutes, et c'est réglé — gratuitement si vous le souhaitez.</p>
  <div class="etapes-conf" id="fil">
    <div class="ec active">Choisir</div><div class="ec">Obtenir</div><div class="ec">Vérifier</div>
  </div>
  <div id="zone"></div>`));

  const majFil = () => v.querySelectorAll('.ec').forEach((e, i) => {
    e.classList.toggle('active', i + 1 === etape);
    e.classList.toggle('faite', i + 1 < etape);
  });

  // ── étape 1 : choix ─────────────────────────────────────────────────────
  function etape1() {
    etape = 1; majFil();
    $('#zone').innerHTML = `
      <h2>Quel moteur voulez-vous utiliser ?</h2>
      <p style="color:var(--texte-doux);margin-bottom:16px">Les trois premiers ne coûtent rien. Vous pourrez en ajouter d'autres plus tard.</p>
      <div class="choix">
        ${Object.entries(MOTEURS_CONF).map(([id, m]) => `
          <button class="opt" data-m="${id}">
            <span class="em">${m.local ? '⌂' : m.prix === 'gratuit' ? '◇' : '◆'}</span>
            <span class="prix ${m.prix === 'gratuit' ? 'libre' : 'payant'}">${m.prix} · ${m.duree}</span>
            <b>${esc(m.label)}</b>
            <p>${esc(m.resume)}</p>
          </button>`).join('')}
      </div>
      <div class="carte creux" style="margin-top:18px">
        <b>Lequel choisir ?</b>
        <p style="color:var(--texte-doux);margin-top:7px">Si vous voulez juste que ça marche maintenant : <b>Groq</b>. Si vous tenez à ce que rien ne sorte de votre ordinateur : <b>Ollama</b>, mais il faut télécharger 2 Go. Les moteurs payants n'apportent un vrai gain que sur les images et les textes longs.</p>
      </div>`;
    $('#zone').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { choisi = b.dataset.m; etape2(); });
  }

  // ── étape 2 : obtenir ───────────────────────────────────────────────────
  function etape2() {
    etape = 2; majFil();
    const m = MOTEURS_CONF[choisi];
    $('#zone').innerHTML = `
      <div class="rang" style="margin-bottom:14px">
        <button class="btn mini" id="retour">← Changer de moteur</button>
        <span class="etiq ${m.prix === 'gratuit' ? 'ok' : 'att'}">${m.prix} · ${m.duree}</span>
      </div>
      <h2 style="margin-top:0">${esc(m.label)}</h2>
      <div class="conf-panneau">
        ${m.pas.map((p, i) => `
          <div class="pas">
            <span class="n">${i + 1}</span>
            <div><b>${p[0]}</b><p>${p[1]}</p>
              ${p[2] ? `<pre>${esc(p[2])}</pre><button class="btn mini copier" data-copie="${esc(p[2])}">Copier la commande</button>` : ''}
            </div>
          </div>`).join('')}
        <div class="rang" style="margin-top:18px">
          <a class="btn or" href="${m.lien}" target="_blank">Ouvrir ${esc(m.site)} →</a>
          <button class="btn" id="suite">${m.local ? 'Vérifier l\'installation' : 'J\'ai ma clé, continuer'}</button>
        </div>
      </div>`;
    $('#retour').onclick = etape1;
    $('#suite').onclick = m.local ? verifierLocal : etape3;
    $('#zone').querySelectorAll('[data-copie]').forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copie); toast('Commande copiée', 'ok'); }
      catch { toast('Sélectionnez la commande et copiez-la avec Ctrl+C'); }
    });
  }

  // ── étape 3 : vérifier la clé ───────────────────────────────────────────
  function etape3() {
    etape = 3; majFil();
    const m = MOTEURS_CONF[choisi];
    $('#zone').innerHTML = `
      <div class="rang" style="margin-bottom:14px"><button class="btn mini" id="retour">← Revenir aux étapes</button></div>
      <h2 style="margin-top:0">Collez votre clé ${esc(m.label)}</h2>
      <div class="conf-panneau">
        <label class="champ"><span>Clé ${esc(m.label)}${m.prefixe ? ` — elle commence par ${m.prefixe}` : ''}</span>
          <input type="password" id="cle" placeholder="${m.prefixe || 'votre clé'}…" autocomplete="off"></label>
        <div class="rang">
          <button class="btn or" id="tester">Tester la clé</button>
          <label class="rang" style="gap:7px;font-size:13px;color:var(--texte-doux)">
            <input type="checkbox" id="voir" style="width:auto"> Afficher la clé</label>
        </div>
        <div class="verdict-cle" id="verdict"></div>
      </div>
      <div class="carte creux" style="margin-top:16px">
        <b>Erreurs fréquentes</b>
        <ul style="margin:9px 0 0;padding-left:19px;color:var(--texte-doux);font-size:13.5px">
          <li>Coller une <b>commande</b> au lieu d'une clé — une clé n'a jamais d'espace</li>
          <li>Mettre une clé Groq dans le champ OpenAI : chaque service a le sien</li>
          <li>Copier la clé à moitié : prenez-la en entier</li>
          ${m.prix === 'payant' ? '<li>Compte <b>sans crédit</b> : la clé existe mais refuse de répondre</li>' : ''}
        </ul>
      </div>`;
    $('#retour').onclick = etape2;
    $('#voir').onchange = e => { $('#cle').type = e.target.checked ? 'text' : 'password'; };
    $('#cle').onkeydown = e => { if (e.key === 'Enter') tester(); };
    $('#tester').onclick = tester;

    async function tester() {
      const val = $('#cle').value.trim();
      const vd = $('#verdict');
      vd.className = 'verdict-cle on essai';
      vd.innerHTML = '<span class="tourne"></span> Vérification auprès de ' + esc(m.label) + '…';
      $('#tester').disabled = true;
      try {
        const r = await api('/api/coffre/tester', { method: 'POST',
          body: JSON.stringify({ fournisseur: choisi, valeur: val }) });
        if (r.ok) {
          await api('/api/coffre', { method: 'POST',
            body: JSON.stringify({ id: `provider:${choisi}`, valeur: val, label: m.label }) });
          vd.className = 'verdict-cle on bon';
          vd.innerHTML = `<b>✓ ${esc(r.message)}</b><br>Clé enregistrée dans le coffre chiffré.`;
          setTimeout(fini, 900);
        } else {
          vd.className = 'verdict-cle on mauvais';
          vd.innerHTML = '<b>✕ ' + esc(r.message) + '</b>';
        }
      } catch (e) {
        vd.className = 'verdict-cle on mauvais';
        vd.textContent = '✕ ' + e.message;
      } finally { $('#tester').disabled = false; }
    }
  }

  async function verifierLocal() {
    const vd = el('<div class="verdict-cle on essai"><span class="tourne"></span> Recherche d\'Ollama…</div>');
    $('#zone').querySelector('.conf-panneau').append(vd);
    try {
      const r = await api('/api/fournisseurs/ollama/ping');
      if (r.ok && r.models?.length) {
        vd.className = 'verdict-cle on bon';
        vd.innerHTML = `<b>✓ Ollama répond — ${r.models.length} modèle(s) : ${r.models.slice(0, 4).map(esc).join(', ')}</b>`;
        setTimeout(fini, 1100);
      } else if (r.ok) {
        vd.className = 'verdict-cle on mauvais';
        vd.innerHTML = "<b>Ollama tourne, mais aucun modèle n'est téléchargé.</b><br>Lancez <code>ollama pull llama3.2</code> puis réessayez.";
      } else {
        vd.className = 'verdict-cle on mauvais';
        vd.innerHTML = "<b>Ollama ne répond pas.</b><br>Ouvrez PowerShell et lancez <code>ollama serve</code>, en laissant la fenêtre ouverte.";
      }
    } catch (e) { vd.className = 'verdict-cle on mauvais'; vd.textContent = e.message; }
  }

  function fini() {
    etape = 4; majFil();
    v.querySelectorAll('.ec').forEach(e => { e.classList.remove('active'); e.classList.add('faite'); });
    $('#zone').innerHTML = `
      <div class="carte" style="border-color:var(--ok);background:linear-gradient(140deg,rgba(79,224,176,.1),transparent)">
        <h2 style="margin-top:0;color:var(--ok)">C'est configuré</h2>
        <p style="color:var(--texte-doux)">${esc(MOTEURS_CONF[choisi].label)} est enregistré. Clipia peut maintenant réfléchir, écrire et créer.</p>
        <div class="rang" style="margin-top:15px">
          <a class="btn or" href="#/clipia">Parler à Clipia →</a>
          <a class="btn" href="#/clip">Créer une vidéo</a>
          <a class="btn" href="#/agent">Coder un site</a>
          <button class="btn mini" id="encore">Ajouter un autre moteur</button>
        </div>
      </div>`;
    $('#encore').onclick = () => { choisi = null; etape1(); };
  }

  etape1();
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.autonome = async (v) => {
  const [fours, caps] = await Promise.all([api('/api/fournisseurs'), api('/api/capacites')]);
  const llms = fours.filter(f => f.configure && ['openai','anthropic','gemini','ollama'].includes(f.kind));

  v.append(el(`
  <h1>Pilote autonome</h1>
  <p class="sous">Donnez un objectif, pas une suite d'instructions. Clipia le découpe, exécute chaque étape avec les outils du studio, observe le résultat et décide de la suite — jusqu'au bout.</p>

  <div class="grille g2" style="align-items:start">
    <div>
      <div class="carte">
        <label class="champ"><span>Votre objectif</span>
          <textarea id="obj" style="min-height:112px" placeholder="Ex : génère trois pochettes sombres pour mon prochain morceau, garde la meilleure, et prépare la description YouTube qui va avec"></textarea></label>
        <div class="grille g2">
          <label class="champ"><span>Moteur</span>
            <select id="llm">${llms.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun moteur</option>'}</select></label>
          <label class="champ"><span>Étapes maximum</span>
            <select id="max"><option>8</option><option selected>14</option><option>24</option></select></label>
        </div>
        <button class="btn or" id="go" style="width:100%;padding:11px">▶ Lancer</button>
      </div>

      <div class="carte creux" style="margin-top:14px">
        <b>Ce qu'il sait faire tout seul</b>
        <div class="rang" style="margin-top:10px">
          ${Object.keys(caps).map(k => `<span class="etiq neutre">${esc(k)}</span>`).join('')}
        </div>
        <p style="color:var(--texte-faible);font-size:12.5px;margin-top:11px">Il s'arrête et vous pose une question seulement si c'est vraiment bloquant. Sinon il tranche et vous dit ce qu'il a choisi.</p>
      </div>

      <div class="carte creux" style="margin-top:14px">
        <b>Exemples d'objectifs</b>
        <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px">
          ${['Génère une pochette sombre et violente pour un morceau de rap, format carré',
             'Écris-moi un site vitrine d\'une page pour mon activité de tatouage à Flize',
             'Compose un instrumental sombre de 2 minutes et fais-en un clip vertical',
             'Fais le point sur mes productions et dis-moi ce qu\'il reste à publier'
            ].map(x => `<button class="sugg" data-ex="${esc(x)}" style="text-align:left">${esc(x)}</button>`).join('')}
        </div>
      </div>
    </div>

    <div>
      <div class="carte" style="min-height:300px">
        <div class="rang" style="justify-content:space-between;margin-bottom:12px">
          <b>Déroulé</b><span class="etiq neutre" id="et">en attente</span>
        </div>
        <div id="flux" style="font-size:13.5px;display:flex;flex-direction:column;gap:10px;max-height:480px;overflow-y:auto">
          <div style="color:var(--texte-faible)">Chaque décision et chaque résultat s'affichent ici en direct.</div>
        </div>
      </div>
      <div id="apres" style="margin-top:14px"></div>
    </div>
  </div>`));

  v.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { $('#obj').value = b.dataset.ex; });
  try { const o = sessionStorage.getItem('clipia:objectif');
    if (o) { $('#obj').value = o; sessionStorage.removeItem('clipia:objectif'); } } catch {}

  $('#go').onclick = async () => {
    const objectif = $('#obj').value.trim();
    if (!objectif) return toast('Décrivez votre objectif.', 'err');
    if (!$('#llm').value) return toast('Aucun moteur configuré.', 'err');
    $('#go').disabled = true;
    $('#flux').innerHTML = ''; $('#apres').innerHTML = '';
    $('#et').textContent = 'en cours'; $('#et').className = 'etiq att';
    const ajouter = h => { $('#flux').append(el(h)); $('#flux').scrollTop = 1e9; };

    try {
      const rep = await fetch(API + '/api/autonome', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ objectif, provider: $('#llm').value, maxEtapes: +$('#max').value }) });
      const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lignes = buf.split('\n'); buf = lignes.pop();
        for (const L of lignes) {
          if (!L.startsWith('data:')) continue;
          const e = JSON.parse(L.slice(5));
          if (e.type === 'reflexion') $('#et').textContent = `étape ${e.etape}/${e.total}`;
          if (e.type === 'etape') ajouter(`<div class="rang"><span class="etiq info">${esc(e.nom)}</span></div>`);
          if (e.type === 'plan') ajouter(`<div class="carte creux" style="font-size:12.5px">
            <b>Plan établi</b><p style="color:var(--texte-doux);margin:5px 0 7px">${esc(e.plan.lecture || '')}</p>
            <ol style="margin:0;padding-left:18px;color:var(--texte-doux)">${(e.plan.etapes||[]).map(x=>`<li>${esc(x.quoi)}</li>`).join('')}</ol></div>`);
          if (e.type === 'alerte') ajouter(`<div style="color:var(--alerte);font-size:12.5px">⚠ ${esc(e.manques ? 'Manque : ' + e.manques.join(', ') : e.message)}</div>`);
          if (e.type === 'diagnostic') ajouter(`<div class="carte" style="border-color:var(--alerte);font-size:12.5px">
            <b style="color:var(--alerte)">Diagnostic</b><p style="margin:5px 0 0;color:var(--texte-doux)">${esc(e.cause)}</p>
            ${e.explication ? `<p style="margin:5px 0 0;color:var(--texte-doux)">Correction : ${esc(e.explication)}</p>` : ''}</div>`);
          if (e.type === 'critique') ajouter(`<div class="carte" style="border-color:${e.critique.atteint ? 'var(--ok)' : 'var(--alerte)'};font-size:12.5px">
            <b style="color:${e.critique.atteint ? 'var(--ok)' : 'var(--alerte)'}">Relecture — ${e.critique.note}/10</b>
            <p style="margin:5px 0 0;color:var(--texte-doux)">${esc(e.critique.verdict || '')}</p>
            ${(e.critique.aRefaire||[]).length ? `<ul style="margin:7px 0 0;padding-left:18px;color:var(--texte-doux)">${e.critique.aRefaire.map(x=>`<li>${esc(x.quoi)}</li>`).join('')}</ul>` : ''}</div>`);
          if (e.type === 'pensee') ajouter(`<div style="color:var(--texte-doux);font-style:italic">${esc(e.texte)}</div>`);
          if (e.type === 'action') ajouter(`<div class="rang" style="gap:8px"><span class="etiq or">${esc(e.tache)}</span></div>`);
          if (e.type === 'resultat') ajouter(`<div style="font-size:12.5px;color:${e.ok ? 'var(--ok)' : 'var(--erreur)'}">${e.ok ? '✓' : '✕'} ${esc(typeof e.resultat === 'string' ? e.resultat : JSON.stringify(e.resultat)).slice(0, 220)}</div>`);
          if (e.type === 'question') {
            $('#et').textContent = 'en attente de vous'; $('#et').className = 'etiq att';
            $('#apres').innerHTML = `<div class="carte" style="border-color:var(--alerte)">
              <b style="color:var(--alerte)">Il a besoin d'une précision</b>
              <p style="margin:8px 0 12px">${esc(e.question)}</p>
              <label class="champ"><span>Votre réponse</span><input id="rep"></label>
              <button class="btn or" id="renvoyer">Continuer</button></div>`;
            $('#renvoyer').onclick = () => {
              $('#obj').value = objectif + '\n\nPrécision : ' + $('#rep').value;
              $('#apres').innerHTML = ''; $('#go').click();
            };
          }
          if (e.type === 'erreur') { ajouter(`<div style="color:var(--erreur)">⚠ ${esc(e.message)}</div>`);
            $('#et').textContent = 'échec'; $('#et').className = 'etiq err'; }
          if (e.type === 'termine' && e.resume) {
            $('#et').textContent = 'terminé'; $('#et').className = 'etiq ok';
            $('#apres').innerHTML = `<div class="carte" style="border-color:var(--ok)">
              <b style="color:var(--ok)">✓ Terminé</b><p style="margin-top:7px">${esc(e.resume)}</p>
              <div class="rang" style="margin-top:12px">
                <a class="btn mini" href="#/medias">Voir les fichiers produits</a>
                <a class="btn mini" href="#/taches">Détail des tâches</a></div></div>`;
          }
        }
      }
    } catch (e) { toast(e.message, 'err'); $('#et').textContent = 'échec'; $('#et').className = 'etiq err'; }
    finally { $('#go').disabled = false; }
  };
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.memoire = async (v) => {
  const m = await api('/api/memoire');
  const CATS = { projets: ['Projets en cours', '◈'], preferences: ['Préférences de travail', '⚙'], faits: ['Ce que je sais de vous', '◉'] };

  v.append(el(`
  <h1>Mémoire</h1>
  <p class="sous">Ce que Clipia retient d'une session à l'autre. Tout est enregistré sur votre machine, en clair, et vous pouvez tout retirer.</p>
  ${m.majLe ? `<p style="color:var(--texte-faible);font-size:12.5px;margin-top:-12px">Dernière mise à jour : ${new Date(m.majLe).toLocaleString('fr-FR')}</p>` : ''}

  ${Object.entries(CATS).map(([cat, [titre, ic]]) => `
    <h2>${ic} ${titre} <span class="etiq neutre">${m[cat].length}</span></h2>
    ${m[cat].length ? `<div class="liste">${m[cat].map(x => `
      <div><span style="flex:1">${esc(x.texte)}</span>
        <span class="etiq ${x.source === 'appris' ? 'info' : 'neutre'}">${x.source}</span>
        <button class="btn mini danger" data-sup="${x.id}">×</button></div>`).join('')}</div>`
      : `<div class="carte creux" style="color:var(--texte-faible)">Rien pour l'instant.</div>`}
    <div class="rang" style="margin-top:10px">
      <input data-ajout="${cat}" placeholder="Ajouter…" style="max-width:420px">
      <button class="btn mini" data-btn="${cat}">Ajouter</button>
      ${m[cat].length ? `<button class="btn mini danger" data-vider="${cat}">Tout effacer</button>` : ''}
    </div>`).join('')}

  <h2>Apprentissage automatique</h2>
  <div class="carte creux">
    <p style="color:var(--texte-doux);margin:0">Après vos conversations avec Clipia, il relit l'échange et retient ce qui restera vrai dans un mois — vos projets, votre façon de travailler. Il ignore le bavardage et ce qu'il sait déjà.</p>
    <p style="color:var(--texte-faible);font-size:12.5px;margin-top:9px">Rien n'est envoyé ailleurs : le fichier reste dans le dossier de données de Clipia, sur votre disque.</p>
  </div>`));

  v.querySelectorAll('[data-sup]').forEach(b => b.onclick = async () => {
    await api('/api/memoire/' + b.dataset.sup, { method: 'DELETE' }); route();
  });
  v.querySelectorAll('[data-vider]').forEach(b => b.onclick = async () => {
    await api('/api/memoire/' + b.dataset.vider, { method: 'DELETE' }); toast('Effacé', 'ok'); route();
  });
  v.querySelectorAll('[data-btn]').forEach(b => b.onclick = async () => {
    const champ = v.querySelector(`[data-ajout="${b.dataset.btn}"]`);
    if (!champ.value.trim()) return;
    await api('/api/memoire', { method: 'POST', body: JSON.stringify({ categorie: b.dataset.btn, texte: champ.value }) });
    toast('Retenu', 'ok'); route();
  });
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.messagerie = async (v) => {
  const [et, conns] = await Promise.all([api('/api/messagerie'), api('/api/connecteurs')]);
  const tg = conns.items.find(c => c.id === 'telegram');
  const wa = conns.items.find(c => c.id === 'whatsapp');

  v.append(el(`
  <h1>Pilotage à distance</h1>
  <p class="sous">Envoyez un message à Clipia depuis votre téléphone, il exécute et vous répond. Le studio reste sur votre ordinateur : rien ne part ailleurs.</p>

  <div class="carte" style="margin-bottom:18px;border-color:${et.enMarche ? 'var(--ok)' : 'var(--bord)'}">
    <div class="rang" style="justify-content:space-between">
      <div class="rang" style="gap:10px">
        <span class="puce ${et.enMarche ? 'ok' : 'neutre'}"></span>
        <b>${et.enMarche ? 'À l\'écoute' : 'Arrêté'}</b>
        ${et.configure ? '' : '<span class="etiq att">aucun jeton Telegram ou Slack enregistré</span>'}
      </div>
      <button class="btn ${et.enMarche ? '' : 'or'}" id="bascule" ${et.configure ? '' : 'disabled'}>
        ${et.enMarche ? 'Arrêter' : 'Démarrer l\'écoute'}</button>
    </div>
    ${et.recus ? `<p style="color:var(--texte-faible);font-size:12.5px;margin-top:10px">${et.recus} message(s) reçu(s) jusqu'ici.</p>` : ''}
  </div>

  <h2>Telegram — fonctionne depuis chez vous</h2>
  <div class="carte">
    <p style="color:var(--texte-doux);margin:0 0 14px">Telegram n'a pas besoin que votre ordinateur soit joignable depuis l'extérieur : Clipia va chercher les messages lui-même. C'est la voie qui marche sans serveur ni configuration de box.</p>
    <div class="pas"><span class="n">1</span><div><b>Créez votre bot</b>
      <p>Dans Telegram, écrivez à <code>@BotFather</code>, envoyez <code>/newbot</code>, choisissez un nom. Il vous renvoie un jeton.</p></div></div>
    <div class="pas"><span class="n">2</span><div><b>Enregistrez le jeton</b>
      <p>Collez-le dans <a href="#/coffre">le coffre</a>, à la ligne Telegram. ${tg?.configure ? '<span style="color:var(--ok)">✓ déjà fait</span>' : ''}</p></div></div>
    <div class="pas"><span class="n">3</span><div><b>Démarrez l'écoute</b>
      <p>Avec le bouton ci-dessus. Puis écrivez <code>/start</code> à votre bot : il vous donnera votre identifiant.</p></div></div>
    <div class="pas"><span class="n">4</span><div><b>Autorisez-vous</b>
      <p>Ajoutez cet identifiant ci-dessous. Sans cela, Clipia n'obéit à personne — c'est volontaire.</p></div></div>
  </div>

  <h2>Qui peut piloter Clipia</h2>
  ${et.autorises.length
    ? `<div class="liste">${et.autorises.map(id => `<div><code style="flex:1">${esc(id)}</code>
        <button class="btn mini danger" data-ret="${esc(id)}">Retirer</button></div>`).join('')}</div>`
    : `<div class="carte creux" style="color:var(--texte-faible)">Personne pour l'instant. Tant que cette liste est vide, Clipia refuse tous les ordres venus de l'extérieur.</div>`}
  <div class="rang" style="margin-top:11px">
    <input id="nouvel" placeholder="Identifiant de conversation ou numéro WhatsApp" style="max-width:420px">
    <button class="btn or mini" id="ajouter">Autoriser</button>
  </div>

  <h2>Slack — fonctionne depuis chez vous (mode Socket)</h2>
  <div class="carte">
    <p style="color:var(--texte-doux);margin:0 0 14px">Comme Telegram, le mode Socket ne demande aucune adresse publique : Clipia se connecte à Slack elle-même. ${et.canaux?.slack?.socket ? '<span style="color:var(--ok)">✓ jeton d\'application enregistré</span>' : ''}</p>
    <div class="pas"><span class="n">1</span><div><b>Créez l'application</b>
      <p>api.slack.com/apps → Create New App. Menu « Socket Mode » : activez-le et créez un jeton d'application (<code>xapp-…</code>, droit <code>connections:write</code>).</p></div></div>
    <div class="pas"><span class="n">2</span><div><b>Abonnez-la aux messages</b>
      <p>« Event Subscriptions » : ajoutez <code>message.im</code> et <code>app_mention</code>. « OAuth &amp; Permissions » : <code>chat:write</code>, <code>im:history</code>, <code>app_mentions:read</code>. Installez l'application et copiez le jeton du bot (<code>xoxb-…</code>).</p></div></div>
    <div class="pas"><span class="n">3</span><div><b>Enregistrez les deux jetons</b>
      <p>Dans <a href="#/connexions">Connexions → Slack</a>. Puis démarrez l'écoute et écrivez un message privé à l'application. Elle vous donnera votre identifiant Slack (<code>U…</code>) : ajoutez-le ci-dessous.</p></div></div>
  </div>

  <h2>WhatsApp — demande une adresse publique et une signature</h2>
  <div class="carte creux">
    <p style="color:var(--texte-doux);margin:0">WhatsApp fonctionne à l'envers de Telegram : c'est Meta qui appelle votre serveur quand un message arrive. Il faut donc une adresse HTTPS joignable depuis Internet — un petit serveur, ou un tunnel comme <code>ngrok</code> ou <code>cloudflared</code>.</p>
    <p style="color:var(--texte-doux);margin-top:10px">Adresse à déclarer dans la console Meta, avec le « jeton de vérification » que vous avez choisi. Clipia refuse tout message dont la signature Meta ne correspond pas au <b>secret de l'application</b> (à enregistrer dans Connexions → WhatsApp) :</p>
    <pre style="margin-top:7px">https://votre-domaine/api/webhooks/whatsapp</pre>
    <p style="color:var(--texte-faible);font-size:12.5px;margin-top:9px">${wa?.configure ? '✓ Jeton WhatsApp enregistré — il ne manque que l\'adresse publique.' : 'Jeton WhatsApp non enregistré pour l\'instant.'} L\'envoi de messages, lui, fonctionne déjà sans rien de tout cela.</p>
  </div>

  <h2>Ce que vous pouvez lui demander</h2>
  <div class="grille g2">
    <div class="carte"><b>Par message</b>
      <ul style="margin:9px 0 0;padding-left:19px;color:var(--texte-doux);font-size:13.5px">
        <li>« génère une pochette sombre avec un corbeau »</li>
        <li>« fais-moi un site vitrine pour mon activité »</li>
        <li>« où en sont mes productions ? »</li>
      </ul></div>
    <div class="carte"><b>Commandes</b>
      <ul style="margin:9px 0 0;padding-left:19px;color:var(--texte-doux);font-size:13.5px">
        <li><code>/aide</code> — ce qu'il sait faire</li>
        <li><code>/start</code> — obtenir votre identifiant</li>
        <li><code>/etat</code> — ce qui tourne en arrière-plan</li>
        <li><code>/travail …</code> — lancer un projet en parallèle</li>
        <li><code>/stop</code> — arrête les travaux en cours</li>
      </ul></div>
  </div>`));

  $('#bascule').onclick = async () => {
    try {
      await api('/api/messagerie/' + (et.enMarche ? 'arreter' : 'demarrer'), { method: 'POST', body: JSON.stringify({}) });
      toast(et.enMarche ? 'Écoute arrêtée' : 'Clipia écoute vos messages', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#ajouter').onclick = async () => {
    if (!$('#nouvel').value.trim()) return;
    await api('/api/messagerie/autoriser', { method: 'POST', body: JSON.stringify({ id: $('#nouvel').value.trim() }) });
    toast('Autorisé', 'ok'); route();
  };
  v.querySelectorAll('[data-ret]').forEach(b => b.onclick = async () => {
    await api('/api/messagerie/autorises/' + encodeURIComponent(b.dataset.ret), { method: 'DELETE' }); route();
  });
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.gratuit = async (v) => {
  const [fours, loc, oll] = await Promise.all([
    api('/api/fournisseurs'), api('/api/modeles-locaux'), api('/api/ollama')]);
  const sansCle = fours.filter(f => f.tier === 'sans-cle');
  const gratuitCle = fours.filter(f => f.freeTier && f.tier !== 'sans-cle' && f.tier !== 'local-gratuit');
  const installes = new Set((loc.ollama.modeles || []).map(m => m.nom));

  v.append(el(`
  <h1>Tout ce qui est gratuit</h1>
  <p class="sous">Trois façons d'utiliser Clipia sans payer, de la plus immédiate à la plus privée.</p>

  <div class="carte" style="border-color:var(--or);background:linear-gradient(140deg,rgba(201,160,255,.09),transparent)">
    <b style="font-size:15px">Vérifier ce qui répond vraiment, depuis ton réseau</b>
    <p style="color:var(--texte-doux);margin:8px 0 12px">Clipia envoie une vraie question à chaque service gratuit et te montre la réponse brute. Pas de promesse : une mesure. Un service n'est déclaré utilisable que s'il a renvoyé du texte.</p>
    <div class="rang">
      <button class="btn or" id="goTest">Tester toutes les voies gratuites</button>
      <label class="rang" style="margin:0;cursor:pointer;font-size:12.5px;color:var(--texte-faible)">
        <input type="checkbox" id="incLoc" checked> inclure les logiciels locaux</label>
    </div>
    <div id="resTest" style="margin-top:13px"></div>
  </div>

  <h2>⚡ Immédiat — ni compte ni clé</h2>
  <div class="carte" style="border-color:var(--ok);background:linear-gradient(140deg,rgba(79,224,176,.08),transparent)">
    <p style="color:var(--texte-doux);margin:0 0 14px">Ces services ne demandent ni compte ni clé. Reste à savoir s’ils répondent depuis ton réseau, et ça se mesure : le bouton de test plus haut envoie une vraie question à chacun. Un badge « actif » qui n’a rien vérifié ne vaut rien.</p>
    <div class="grille g2">
      ${sansCle.map(f => `
        <div class="carte" style="background:var(--carte-2)">
          <div class="rang" style="justify-content:space-between">
            <b>${esc(f.label)}</b><span class="etiq neutre" title="Aucune clé requise. Reste à vérifier que le service répond depuis ton réseau.">sans clé</span>
          </div>
          <div style="font-size:12px;color:var(--texte-faible);margin:6px 0 9px">${(f.modalities || []).join(' · ')}</div>
          <button class="btn mini" data-essai="${f.id}">Essayer maintenant</button>
          <div class="res" style="margin-top:9px;font-size:12.5px"></div>
        </div>`).join('')}
    </div>
    <p style="color:var(--texte-faible);font-size:12.5px;margin-top:13px">Ce sont des services communautaires : rapides et gratuits, mais sans garantie de disponibilité ni de confidentialité. Pour un travail sensible, préférez un modèle local.</p>
  </div>

  <h2>⌂ Sur votre machine — illimité et privé</h2>
  <div class="carte">
    <div class="rang" style="justify-content:space-between;margin-bottom:13px">
      <div class="rang" style="gap:9px">
        <span class="puce ${oll.actif ? 'ok' : oll.installe ? 'att' : 'neutre'}"></span>
        <b>${oll.actif ? `Ollama tourne — ${installes.size} modèle(s)` : oll.installe ? 'Ollama installé, mais arrêté' : 'Ollama absent de cette machine'}</b>
        ${oll.demarreParClipia ? '<span class="etiq info">démarré par Clipia</span>' : ''}
      </div>
      <div class="rang">
        ${oll.installe && !oll.actif ? '<button class="btn mini or" id="ollDemarrer">Démarrer Ollama</button>' : ''}
        ${oll.installe ? '' : '<button class="btn mini or" id="ollInstaller">Installer Ollama</button>'}
        <button class="btn mini" id="resonder">Revérifier</button>
      </div>
    </div>
    <div id="ollProg" style="margin-bottom:13px"></div>
    ${oll.actif
      ? `<p style="color:var(--texte-doux);margin:0 0 14px">Choisissez un modèle, Clipia le télécharge pour vous. Aucune ligne de commande.</p>`
      : oll.installe
        ? `<div class="carte creux" style="margin-bottom:14px"><p style="margin:0;color:var(--texte-doux)">Ollama est sur votre machine mais ne tourne pas. Cliquez sur <b>Démarrer Ollama</b> — plus besoin de PowerShell. Clipia le lance aussi tout seul à chaque ouverture.</p></div>`
        : `<div class="carte creux" style="margin-bottom:14px"><p style="margin:0;color:var(--texte-doux)">Clipia peut télécharger et installer Ollama pour vous (environ 700 Mo, une seule fois). Ensuite, les modèles tournent chez vous, sans limite et sans facture.</p></div>`}

    <div class="grille g2">
      ${loc.catalogue.map(m => {
        const ok = installes.has(m.nom) || installes.has(m.nom.split(':')[0] + ':latest');
        return `<div class="carte" style="background:var(--carte-2);${m.defaut && !ok ? 'border-color:var(--or-sombre)' : ''}" data-mod="${esc(m.nom)}">
          <div class="rang" style="justify-content:space-between">
            <b>${esc(m.label)}</b>
            ${ok ? '<span class="etiq ok">installé</span>' : m.defaut ? '<span class="etiq or">recommandé</span>' : ''}
          </div>
          <p style="font-size:13px;color:var(--texte-doux);margin:7px 0 8px">${esc(m.usage)}</p>
          <div style="font-size:11.5px;color:var(--texte-faible);margin-bottom:10px">${m.taille} à télécharger · ${m.ram} de mémoire conseillés</div>
          ${ok
            ? `<button class="btn mini danger" data-sup="${esc(m.nom)}">Retirer</button>`
            : `<button class="btn mini or" data-inst="${esc(m.nom)}" ${loc.ollama.ok ? '' : 'disabled'}>Télécharger</button>`}
          <div class="prog" style="margin-top:9px"></div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <h2>◇ Gratuit avec un compte</h2>
  <div class="carte creux">
    <p style="color:var(--texte-doux);margin:0 0 13px">Ces services demandent une inscription, mais offrent un quota gratuit sérieux — plus rapides et plus fins que le sans-clé.</p>
    <div class="rang">
      ${gratuitCle.map(f => `<a class="jeton ${f.configure ? '' : ''}" href="#/configuration"
        style="font-size:12.5px;padding:6px 12px;border-radius:8px;background:var(--carte-2);border:1px solid ${f.configure ? 'var(--ok)' : 'var(--bord)'};color:${f.configure ? 'var(--ok)' : 'var(--texte-doux)'}">
        ${f.configure ? '✓ ' : ''}${esc(f.label)}</a>`).join('')}
    </div>
    <a class="btn mini or" href="#/configuration" style="margin-top:13px">Configuration pas à pas →</a>
  </div>`));

  // essai immédiat d'un service sans clé
  const ETATS = {
    ok:            { e:'ok',     t:'répond' },
    'cle-manquante':{ e:'att',   t:'clé à créer' },
    'cle-refusee': { e:'err',    t:'clé refusée' },
    quota:         { e:'att',    t:'quota atteint' },
    eteint:        { e:'neutre', t:'pas lancé' },
    'sans-modele': { e:'att',    t:'aucun modèle' },
    injoignable:   { e:'err',    t:'injoignable' },
    reseau:        { e:'err',    t:'réseau bloqué' },
    modele:        { e:'att',    t:'modèle renommé' },
    echec:         { e:'err',    t:'échec' }
  };

  $('#goTest').onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = 'test en cours…';
    $('#resTest').innerHTML = '<div class="carte"><span class="tourne"></span> Clipia interroge chaque service, un par un. Jusqu\'à deux minutes.</div>';
    try {
      const r = await api('/api/gratuit/tester-tout', { method: 'POST',
        body: JSON.stringify({ inclureLocal: $('#incLoc').checked }) });
      const b = r.bilan;
      $('#resTest').innerHTML = `
        <div class="rang" style="margin-bottom:12px;flex-wrap:wrap">
          <span class="etiq ${b.operationnels ? 'ok' : 'err'}">${b.operationnels} opérationnel(s)</span>
          <span class="etiq neutre">${b.testes} testés</span>
          ${b.sansAucuneCle ? `<span class="etiq ok">${b.sansAucuneCle} sans aucune clé</span>` : ''}
          ${b.aConfigurer ? `<span class="etiq att">${b.aConfigurer} attendent une clé</span>` : ''}
          ${b.leMoinsLent ? `<span class="etiq or">le plus rapide : ${esc(b.leMoinsLent)}</span>` : ''}
        </div>
        <p style="color:var(--texte-doux);margin:0 0 12px">${esc(r.verdict)} ${esc(r.conseil)}</p>
        <div class="liste" style="font-size:12.5px">
          ${r.resultats.map(x => {
            const st = ETATS[x.etat] || { e:'neutre', t:x.etat };
            return `<div style="align-items:start">
              <span class="etiq ${st.e}" style="min-width:104px">${esc(st.t)}</span>
              <div style="flex:1">
                <b>${esc(x.label)}</b>${x.ms && x.etat === 'ok' ? ` <span style="color:var(--texte-faible)">${x.ms} ms</span>` : ''}
                <p style="margin:4px 0 0;color:var(--texte-faible)">${esc(x.detail)}</p>
                ${x.sortie ? `<p style="margin:4px 0 0;font-family:var(--mono,monospace);color:var(--ok)">« ${esc(x.sortie)} »</p>` : ''}
              </div>
              ${x.etat === 'cle-manquante' && x.docs ? `<a class="btn mini" href="${esc(x.docs)}" target="_blank" rel="noopener">Créer la clé</a>` : ''}
              ${x.etat === 'sans-modele' ? '<a class="btn mini" href="#/locales">Télécharger un modèle</a>' : ''}
            </div>`;
          }).join('')}
        </div>`;
    } catch (err) {
      $('#resTest').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(err.message)}</div>`;
    } finally { e.target.disabled = false; e.target.textContent = 'Tester toutes les voies gratuites'; }
  };

  v.querySelectorAll('[data-essai]').forEach(b => b.onclick = async () => {
    const box = b.parentElement.querySelector('.res');
    box.innerHTML = '<span class="tourne"></span> essai…';
    b.disabled = true;
    try {
      const f = fours.find(x => x.id === b.dataset.essai);
      if (f.kind === 'image') {
        const job = await api('/api/taches', { method: 'POST', body: JSON.stringify({ type: 'image',
          payload: { provider: f.id, prompt: 'un renard roux dans la neige, photographie', size: '512x512' } }) });
        const r = await attendreTache(job.id);
        const u = r?.[0]?.url;
        box.innerHTML = u ? `<img src="${u}" style="width:100%;border-radius:8px;margin-top:4px">` : '<span style="color:var(--ok)">✓ réponse reçue</span>';
      } else {
        const r = await api('/api/chat', { method: 'POST', body: JSON.stringify({
          provider: f.id, model: f.models?.[0], stream: false,
          messages: [{ role: 'user', content: 'Dis bonjour en cinq mots.' }] }) });
        box.innerHTML = `<span style="color:var(--ok)">✓ « ${esc((r.text || '').trim().slice(0, 90))} »</span>`;
      }
    } catch (e) {
      box.innerHTML = `<span style="color:var(--erreur)">✕ ${esc(e.message.slice(0, 130))}</span>`;
    } finally { b.disabled = false; }
  });

  // téléchargement d'un modèle local
  v.querySelectorAll('[data-inst]').forEach(b => b.onclick = async () => {
    const carte = b.closest('[data-mod]'), prog = carte.querySelector('.prog');
    b.disabled = true;
    prog.innerHTML = `<div style="font-size:12px;color:var(--texte-doux)" class="lab">préparation…</div>
      <div class="barre"><i style="width:0"></i></div>`;
    try {
      const rep = await fetch(API + '/api/modeles-locaux/installer', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modele: b.dataset.inst }) });
      const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lignes = buf.split('\n'); buf = lignes.pop();
        for (const L of lignes) {
          if (!L.startsWith('data:')) continue;
          const e = JSON.parse(L.slice(5));
          if (e.erreur) { prog.innerHTML = `<span style="color:var(--erreur)">✕ ${esc(e.erreur)}</span>`; b.disabled = false; return; }
          if (e.fini) {
            prog.innerHTML = '<span style="color:var(--ok)">✓ installé et prêt</span>';
            toast(`${e.modele} est prêt — Clipia peut l'utiliser`, 'ok');
            setTimeout(route, 1200); return;
          }
          const lab = prog.querySelector('.lab'), barre = prog.querySelector('.barre > i');
          if (lab) lab.textContent = e.pct != null
            ? `${e.etat} — ${e.pct} %${e.total ? ` (${(e.recu / 1073741824).toFixed(1)} / ${(e.total / 1073741824).toFixed(1)} Go)` : ''}`
            : e.etat || 'en cours…';
          if (barre && e.pct != null) barre.style.width = e.pct + '%';
        }
      }
    } catch (e) { prog.innerHTML = `<span style="color:var(--erreur)">✕ ${esc(e.message)}</span>`; b.disabled = false; }
  });

  v.querySelectorAll('[data-sup]').forEach(b => b.onclick = async () => {
    await api('/api/modeles-locaux/' + encodeURIComponent(b.dataset.sup), { method: 'DELETE' });
    toast('Modèle retiré', 'ok'); route();
  });
  $('#resonder')?.addEventListener('click', route);

  $('#ollDemarrer')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('#ollProg').innerHTML = '<div class="carte" style="background:var(--carte-2)"><span class="tourne"></span> Démarrage d\'Ollama…</div>';
    try {
      await api('/api/ollama/demarrer', { method: 'POST', body: JSON.stringify({}) });
      toast('Ollama tourne', 'ok'); route();
    } catch (err) {
      $('#ollProg').innerHTML = `<div class="carte" style="border-color:var(--erreur)"><span style="color:var(--erreur)">${esc(err.message)}</span></div>`;
      e.target.disabled = false;
    }
  });

  $('#ollInstaller')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    $('#ollProg').innerHTML = `<div class="carte" style="background:var(--carte-2)">
      <div class="lab" style="font-size:13px;color:var(--texte-doux)">préparation…</div>
      <div class="barre"><i style="width:0"></i></div></div>`;
    try {
      const rep = await fetch(API + '/api/ollama/installer', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: '{}' });
      const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lignes = buf.split('\n'); buf = lignes.pop();
        for (const L of lignes) {
          if (!L.startsWith('data:')) continue;
          const ev = JSON.parse(L.slice(5));
          if (ev.erreur) { $('#ollProg').innerHTML = `<div class="carte" style="border-color:var(--erreur)"><span style="color:var(--erreur)">✕ ${esc(ev.erreur)}</span></div>`; e.target.disabled = false; return; }
          if (ev.fini) {
            $('#ollProg').innerHTML = `<div class="carte" style="border-color:var(--ok)"><span style="color:var(--ok)">✓ ${esc(ev.message || 'Installé')}</span></div>`;
            setTimeout(route, 4000); return;
          }
          const lab = $('#ollProg').querySelector('.lab'), b2 = $('#ollProg').querySelector('.barre > i');
          if (lab) lab.textContent = ev.etape === 'installation' ? 'installation en cours…'
            : `téléchargement — ${ev.pct ?? 0} %${ev.total ? ` (${(ev.recu / 1048576).toFixed(0)} / ${(ev.total / 1048576).toFixed(0)} Mo)` : ''}`;
          if (b2 && ev.pct != null) b2.style.width = ev.pct + '%';
        }
      }
    } catch (err) {
      $('#ollProg').innerHTML = `<div class="carte" style="border-color:var(--erreur)">${esc(err.message)}</div>`;
      e.target.disabled = false;
    }
  });
};

/** Attend la fin d'une tâche et renvoie son résultat. */
function attendreTache(jobId) {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`${API}/api/taches/${jobId}/flux`);
    es.onmessage = m => {
      const j = JSON.parse(m.data);
      if (j.status === 'terminé') { es.close(); resolve(j.result); }
      if (j.status === 'échec') { es.close(); reject(new Error(j.error)); }
    };
    es.onerror = () => { es.close(); reject(new Error('flux interrompu')); };
  });
}

/**
 * Au premier lancement : Clipia se prépare seul.
 * Il réveille Ollama et propose de télécharger un modèle — jamais sans accord,
 * parce que 2 Go lancés en douce sur une connexion limitée, ce serait grossier.
 */
async function preparationAutomatique() {
  let a;
  try { a = await api('/api/auto'); } catch { return; }
  if (a.fait || a.refuse) return;

  let oll;
  try { oll = await api('/api/ollama'); } catch { return; }
  if (!oll.installe) return;                       // rien à préparer
  let rec = null; try { rec = await api('/api/auto/recommandation'); } catch {}
  const manquants = rec ? rec.aTelecharger : [];
  if (oll.actif && !manquants.length) return;      // déjà opérationnel

  const panneau = el(`
  <div class="carte" style="position:fixed;right:20px;bottom:20px;z-index:80;max-width:420px;
    border-color:var(--or);box-shadow:var(--ombre);
    background:linear-gradient(150deg,var(--carte-2),var(--carte))">
    <div class="rang" style="justify-content:space-between;margin-bottom:8px">
      <b>Clipia peut se configurer seul</b>
      <span class="x" id="autoFermer" style="cursor:pointer;color:var(--texte-faible);font-size:17px">×</span>
    </div>
    <p id="autoTexte" style="color:var(--texte-doux);font-size:13.5px;margin:0 0 13px">
      ${oll.actif
        ? `Ollama tourne. Pour ta machine (${rec ? rec.ramGo : '?'} Go de RAM), je peux télécharger : ${manquants.map(m => esc(m.nom) + ' (' + esc(m.taille) + ')').join(', ') || 'rien de plus'}. Gratuit, hors ligne. Rien ne part sans ton accord.`
        : 'Ollama est installé mais endormi. je peux le démarrer, puis télécharger les meilleurs modèles gratuits (Qwen, DeepSeek…) pour que tout fonctionne sans clé ni abonnement.'}
    </p>
    <div id="autoProg"></div>
    <div class="rang" id="autoBoutons">
      <button class="btn or mini" id="autoOui">Oui, installe les meilleurs modèles</button>
      <button class="btn mini" id="autoReveil">Réveiller seulement</button>
      <button class="btn mini" id="autoNon">Non merci</button>
    </div>
  </div>`);
  document.body.append(panneau);

  const fermer = () => panneau.remove();
  $('#autoFermer', panneau).onclick = fermer;
  $('#autoNon', panneau).onclick = async () => { await api('/api/auto/refuser', { method: 'POST', body: '{}' }); fermer(); };

  async function lancer(avecModele) {
    $('#autoBoutons', panneau).remove();
    $('#autoProg', panneau).innerHTML = `<div class="lab" style="font-size:12.5px;color:var(--texte-doux);margin-bottom:6px">préparation…</div>
      <div class="barre"><i style="width:0"></i></div>`;
    try {
      const rep = await fetch(API + '/api/auto/preparer', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ avecModele }) });
      const rd = rep.body.getReader(), dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lignes = buf.split('\n'); buf = lignes.pop();
        for (const L of lignes) {
          if (!L.startsWith('data:')) continue;
          const e = JSON.parse(L.slice(5));
          const lab = panneau.querySelector('.lab'), barre = panneau.querySelector('.barre > i');
          if (e.erreur) { $('#autoTexte', panneau).innerHTML = `<span style="color:var(--erreur)">${esc(e.erreur)}</span>`; continue; }
          if (e.fini) {
            $('#autoProg', panneau).innerHTML = '<span style="color:var(--ok);font-size:13.5px">✓ Clipia est prêt.</span>';
            toast('Configuration terminée', 'ok');
            setTimeout(() => { fermer(); route(); }, 1800);
            return;
          }
          if (lab) lab.textContent = e.pct != null
            ? `${e.message || 'téléchargement'} — ${e.pct} %${e.total ? ` (${(e.recu / 1073741824).toFixed(1)} / ${(e.total / 1073741824).toFixed(1)} Go)` : ''}`
            : (e.message || 'en cours…');
          if (barre && e.pct != null) barre.style.width = e.pct + '%';
        }
      }
    } catch (e) { $('#autoTexte', panneau).innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  }
  $('#autoOui', panneau).onclick = () => lancer(true);
  $('#autoReveil', panneau).onclick = () => lancer(false);
}

// ═══════════════════════════════════════════════════════════════════════════
VUES.raisonnement = async (v) => {
  const [fours, lec] = await Promise.all([api('/api/fournisseurs'), api('/api/lecons')]);
  const llms = fours.filter(f => f.configure && ['openai','anthropic','gemini','ollama'].includes(f.kind));

  v.append(el(`
  <h1>Raisonnement</h1>
  <p class="sous">Avant d'agir, Clipia réfléchit. Quand il se trompe, il comprend pourquoi. Et il retient ses leçons.</p>

  <div class="onglets">
    <button class="actif" data-o="prompt">Atelier de prompts</button>
    <button data-o="plan">Plan avant action</button>
    <button data-o="lecons">Leçons retenues</button>
  </div>

  <div id="o-prompt">
    <p style="color:var(--texte-doux);max-width:66ch;margin-bottom:15px">Une demande vague donne un résultat vague. Clipia réécrit la vôtre en trois versions, de la plus fidèle à la plus audacieuse, et vous dit ce qui manquait.</p>
    <div class="carte">
      <label class="champ"><span>Votre demande, telle qu'elle vous vient</span>
        <textarea id="brut" placeholder="Ex : une pochette sombre"></textarea></label>
      <div class="grille g2">
        <label class="champ"><span>Pour quel usage</span>
          <select id="medium">
            <option value="image">Image, pochette, affiche</option>
            <option value="video">Vidéo, plan animé</option>
            <option value="musique">Musique</option>
            <option value="texte">Texte, description, post</option>
            <option value="code">Code, site</option>
          </select></label>
        <label class="champ"><span>Moteur</span>
          <select id="llm1">${llms.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun</option>'}</select></label>
      </div>
      <button class="btn or" id="goP">Réécrire ma demande</button>
    </div>
    <div id="resP" style="margin-top:16px"></div>
  </div>

  <div id="o-plan" hidden>
    <p style="color:var(--texte-doux);max-width:66ch;margin-bottom:15px">Clipia décompose votre objectif, annonce ce que chaque étape produira, signale les risques et ce qui lui manque — avant d'avoir rien lancé.</p>
    <div class="carte">
      <label class="champ"><span>Votre objectif</span>
        <textarea id="obj2" placeholder="Ex : sortir mon prochain titre avec un clip vertical et sa pochette"></textarea></label>
      <label class="champ" style="max-width:300px"><span>Moteur</span>
        <select id="llm2">${llms.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('') || '<option value="">aucun</option>'}</select></label>
      <button class="btn or" id="goPlan">Établir le plan</button>
    </div>
    <div id="resPlan" style="margin-top:16px"></div>
  </div>

  <div id="o-lecons" hidden>
    <p style="color:var(--texte-doux);max-width:66ch;margin-bottom:15px">Chaque échec compris devient une règle. Clipia les relit avant chaque nouvelle tâche, pour ne pas retomber dans le même piège.</p>
    ${lec.length
      ? `<div class="liste">${lec.slice().reverse().map(l => `
          <div><div style="flex:1">
            <span>${esc(l.lecon)}</span>
            <div style="font-size:11.5px;color:var(--texte-faible);margin-top:3px">${esc(l.contexte)} · ${new Date(l.le).toLocaleDateString('fr-FR')}</div>
          </div><button class="btn mini danger" data-oub="${l.id}">×</button></div>`).join('')}</div>`
      : `<div class="vide"><div class="em">◎</div>Aucune leçon pour l'instant.<br>
         <span style="font-size:13px">Elles apparaîtront après les premiers échecs compris.</span></div>`}
  </div>`));

  v.querySelectorAll('.onglets button').forEach(b => b.onclick = () => {
    v.querySelectorAll('.onglets button').forEach(x => x.classList.remove('actif'));
    b.classList.add('actif');
    for (const o of ['prompt','plan','lecons']) $('#o-' + o).hidden = o !== b.dataset.o;
  });

  v.querySelectorAll('[data-oub]').forEach(b => b.onclick = async () => {
    await api('/api/lecons/' + b.dataset.oub, { method: 'DELETE' }); route();
  });

  $('#goP').onclick = async () => {
    if (!$('#brut').value.trim()) return toast('Écrivez votre demande.', 'err');
    if (!$('#llm1').value) return toast('Aucun moteur configuré.', 'err');
    $('#resP').innerHTML = '<div class="carte"><span class="tourne"></span> réflexion…</div>';
    try {
      const r = await api('/api/raisonner/ameliorer', { method: 'POST', body: JSON.stringify({
        brut: $('#brut').value, medium: $('#medium').value, provider: $('#llm1').value }) });
      $('#resP').innerHTML = `
        <div class="carte creux" style="margin-bottom:14px">
          <b>Ce qui manquait</b>
          <p style="color:var(--texte-doux);margin-top:6px">${esc(r.manquait || '')}</p>
        </div>
        ${(r.versions || []).map(x => `
          <div class="carte" style="margin-bottom:12px">
            <div class="rang" style="justify-content:space-between;margin-bottom:9px">
              <b style="text-transform:capitalize">${esc(x.nom)}</b>
              <button class="btn mini" data-cop="${esc(x.prompt)}">Copier</button>
            </div>
            <pre style="white-space:pre-wrap;margin:0 0 9px">${esc(x.prompt)}</pre>
            <p style="color:var(--texte-faible);font-size:12.5px;margin:0">${esc(x.pourquoi || '')}</p>
          </div>`).join('')}
        ${r.aEviter ? `<div class="carte creux"><b>À exclure du rendu</b>
          <p style="color:var(--texte-doux);margin-top:6px">${esc(r.aEviter)}</p></div>` : ''}`;
      $('#resP').querySelectorAll('[data-cop]').forEach(b => b.onclick = async () => {
        try { await navigator.clipboard.writeText(b.dataset.cop); toast('Copié', 'ok'); }
        catch { toast('Sélectionnez le texte et copiez-le'); }
      });
    } catch (e) { $('#resP').innerHTML = `<div class="carte" style="border-color:var(--erreur)">${esc(e.message)}</div>`; }
  };

  $('#goPlan').onclick = async () => {
    if (!$('#obj2').value.trim()) return toast('Décrivez votre objectif.', 'err');
    if (!$('#llm2').value) return toast('Aucun moteur configuré.', 'err');
    $('#resPlan').innerHTML = '<div class="carte"><span class="tourne"></span> analyse…</div>';
    try {
      const r = await api('/api/raisonner/plan', { method: 'POST', body: JSON.stringify({
        objectif: $('#obj2').value, provider: $('#llm2').value }) });
      $('#resPlan').innerHTML = `
        <div class="carte creux" style="margin-bottom:14px">
          <b>Ce que je comprends</b>
          <p style="color:var(--texte-doux);margin-top:6px">${esc(r.lecture || '')}</p>
          ${r.duree ? `<span class="etiq neutre" style="margin-top:9px;display:inline-block">${esc(r.duree)}</span>` : ''}
        </div>
        <div class="etapes">${(r.etapes || []).map(e => `
          <div class="et"><div class="n">${e.n}</div><div>
            <h3 style="font-size:15.5px">${esc(e.quoi)}</h3>
            <p style="margin:0">Produit : ${esc(e.produit || '')}</p>
            ${e.risque ? `<span class="outils" style="color:var(--alerte)">risque : ${esc(e.risque)}</span>` : ''}
          </div></div>`).join('')}</div>
        ${r.manques?.length ? `<div class="carte" style="border-color:var(--alerte);margin-top:14px">
          <b style="color:var(--alerte)">Ce qui manque pour réussir</b>
          <ul style="margin:8px 0 0;padding-left:19px;color:var(--texte-doux)">${r.manques.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
        ${r.alternative ? `<div class="carte creux" style="margin-top:12px"><b>Si ça coince</b>
          <p style="color:var(--texte-doux);margin-top:6px">${esc(r.alternative)}</p></div>` : ''}
        <a class="btn or" href="#/autonome" style="margin-top:14px;display:inline-block">Lancer le pilote sur cet objectif →</a>`;
      try { sessionStorage.setItem('clipia:objectif', $('#obj2').value); } catch {}
    } catch (e) { $('#resPlan').innerHTML = `<div class="carte" style="border-color:var(--erreur)">${esc(e.message)}</div>`; }
  };
};

// ═══════════════════════════════════════════════════════════════════════════
VUES.sciences = async (v) => {
  const [cst, exq, bnd] = await Promise.all([
    api('/api/sciences/constantes'), api('/api/sciences/exemples'), api('/api/sciences/audio/bandes')]);

  v.append(el(`
  <h1>Sciences</h1>
  <p class="sous">Ici Clipia ne devine pas : il calcule. Constantes du CODATA, simulation quantique exacte, physique des ondes, mesure acoustique réelle.</p>

  <div class="onglets">
    <button class="actif" data-o="calc">Calcul</button>
    <button data-o="quant">Quantique</button>
    <button data-o="radio">Ondes radio</button>
    <button data-o="son">Sons cognitifs</button>
  </div>

  <!-- ── CALCUL ────────────────────────────────────────────── -->
  <div id="o-calc">
    <div class="carte">
      <label class="champ"><span>Expression</span>
        <input id="expr" placeholder="E_mc2(0.001)   ou   v_liberation(M_terre, R_terre)" style="font-family:var(--mono,monospace)"></label>
      <button class="btn or" id="goC">Calculer</button>
      <div id="resC" style="margin-top:13px"></div>
    </div>
    <div class="grille g2" style="margin-top:14px">
      <div class="carte creux"><b>Exemples à essayer</b>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
          ${[['E_mc2(0.001)','1 gramme converti en énergie'],
             ['rayon_schwarzschild(M_soleil)','Si le Soleil devenait un trou noir'],
             ['gamma(0.99*c)','Dilatation du temps à 99 % de c'],
             ['periode_orbitale(M_soleil, UA)/86400','Durée de l\'année terrestre'],
             ['E_photon(5e14)/1.602176634e-19','Énergie d\'un photon visible, en eV'],
             ['wien(5778)*1e9','Pic d\'émission du Soleil, en nm'],
             ['lambda_de_broglie(m_e, 1e6)*1e12','Longueur d\'onde d\'un électron, en pm']
            ].map(([e,d]) => `<button class="sugg" data-ex="${esc(e)}" style="text-align:left">
              <code style="color:var(--or-clair)">${esc(e)}</code><br>
              <span style="font-size:11.5px;color:var(--texte-faible)">${esc(d)}</span></button>`).join('')}
        </div>
      </div>
      <div class="carte creux"><b>Conversion</b>
        <div class="rang" style="margin-top:11px">
          <input id="cv" type="number" value="1" style="max-width:110px">
          <input id="cde" placeholder="pc" style="max-width:90px">
          <span style="color:var(--texte-faible)">→</span>
          <input id="cvers" placeholder="al" style="max-width:90px">
          <button class="btn mini or" id="goCv">Convertir</button>
        </div>
        <div id="resCv" style="margin-top:10px;font-size:14px"></div>
        <p style="font-size:11.5px;color:var(--texte-faible);margin-top:11px">
          longueurs : m km al UA pc · masses : kg g u Msol · énergies : J eV MeV kWh TNT · temps : s h j an Ma</p>
      </div>
    </div>
    <h2>Constantes disponibles</h2>
    <div class="defile"><table><thead><tr><th>Nom</th><th>Valeur</th><th>Unité</th><th>Désignation</th></tr></thead>
      <tbody>${Object.entries(cst.constantes).map(([k,c]) => `<tr>
        <td><code>${esc(k)}</code></td><td class="num">${c.v}</td><td>${esc(c.u)}</td>
        <td style="font-size:12.5px">${esc(c.nom)}</td></tr>`).join('')}</tbody></table></div>
  </div>

  <!-- ── QUANTIQUE ─────────────────────────────────────────── -->
  <div id="o-quant" hidden>
    <p style="color:var(--texte-doux);max-width:68ch;margin-bottom:15px">Simulation exacte par vecteur d'état, jusqu'à 14 qubits. La superposition, l'intrication et l'effondrement à la mesure sont calculés, pas imités.</p>
    <div class="carte">
      <div class="rang" style="margin-bottom:12px">
        ${Object.entries(exq.quantique).map(([k,e]) => `<button class="btn mini" data-qex="${k}">${esc(e.nom)}</button>`).join('')}
      </div>
      <label class="champ"><span>Circuit (JSON)</span>
        <textarea id="qc" style="min-height:100px;font-family:var(--mono,monospace);font-size:12.5px">{"qubits":2,"portes":[{"p":"H","q":0},{"p":"CNOT","ctrl":0,"q":1}]}</textarea></label>
      <div id="qInfo" style="font-size:12.5px;color:var(--texte-doux);margin-bottom:11px"></div>
      <button class="btn or" id="goQ">Exécuter le circuit</button>
    </div>
    <div id="resQ" style="margin-top:14px"></div>
    <div class="carte creux" style="margin-top:14px">
      <b>Portes disponibles</b>
      <p style="color:var(--texte-doux);font-size:13px;margin-top:7px">
        <code>H</code> superposition · <code>X Y Z</code> rotations d'un demi-tour · <code>S T</code> phases ·
        <code>RX RY RZ</code> rotations d'angle libre · <code>CNOT CZ</code> portes contrôlées, qui créent l'intrication</p>
    </div>
  </div>

  <!-- ── RADIO ─────────────────────────────────────────────── -->
  <div id="o-radio" hidden>
    <div class="grille g2" style="align-items:start">
      <div class="carte">
        <b>Propagation et bilan de liaison</b>
        <div class="grille g2" style="margin-top:12px">
          <label class="champ"><span>Fréquence (Hz)</span><input id="rf" value="2.4e9"></label>
          <label class="champ"><span>Puissance (W)</span><input id="rp" value="0.1"></label>
          <label class="champ"><span>Distance (m)</span><input id="rd" value="100"></label>
          <label class="champ"><span>Vitesse relative (m/s)</span><input id="rv" value="0"></label>
        </div>
        <div class="rang" style="margin-bottom:11px">
          ${[['88e6','FM'],['433e6','LoRa 433'],['868e6','LoRa 868'],['2.4e9','Wi-Fi'],['5.8e9','Wi-Fi 5G'],['28e9','5G mm']]
            .map(([f,n]) => `<button class="btn mini" data-rf="${f}">${n}</button>`).join('')}
        </div>
        <button class="btn or" id="goR">Calculer</button>
        <div id="resR" style="margin-top:13px"></div>
      </div>
      <div class="carte">
        <b>Pilotage d'un qubit par micro-ondes</b>
        <p style="color:var(--texte-doux);font-size:13px;margin:8px 0 12px">Le pont réel entre ondes radio et quantique : un qubit supraconducteur se commande par impulsion micro-onde accordée sur sa transition.</p>
        <div class="grille g2">
          <label class="champ"><span>Fréquence du qubit (Hz)</span><input id="pq" value="5e9"></label>
          <label class="champ"><span>Fréquence de Rabi (Hz)</span><input id="pr" value="20e6"></label>
          <label class="champ"><span>T1 (µs)</span><input id="p1" value="100"></label>
          <label class="champ"><span>T2 (µs)</span><input id="p2" value="80"></label>
        </div>
        <button class="btn or" id="goP2">Calculer l'impulsion</button>
        <div id="resP2" style="margin-top:13px"></div>
      </div>
    </div>
  </div>

  <!-- ── SONS ──────────────────────────────────────────────── -->
  <div id="o-son" hidden>
    <div class="carte" style="border-color:var(--alerte);background:linear-gradient(140deg,rgba(255,184,107,.08),transparent);margin-bottom:16px">
      <b style="color:var(--ambre)">Ce que ces sons font, et ce qu'ils ne font pas</b>
      <p style="color:var(--texte-doux);margin-top:8px">${esc(bnd.preuves.general)}</p>
      <div class="grille g3" style="margin-top:12px">
        ${['bruit','binaural','isochrone'].map(k => `
          <div style="font-size:12.5px">
            <span class="etiq ${bnd.preuves[k].niveau==='solide'?'ok':bnd.preuves[k].niveau==='partagé'?'att':'neutre'}">${esc(k)} — ${esc(bnd.preuves[k].niveau)}</span>
            <p style="color:var(--texte-faible);margin-top:6px">${esc(bnd.preuves[k].texte)}</p>
          </div>`).join('')}
      </div>
    </div>

    <div class="grille g2" style="align-items:start">
      <div class="carte">
        <b>Battements binauraux</b>
        <p style="color:var(--texte-faible);font-size:12.5px;margin:7px 0 11px">Deux fréquences décalées, une par oreille. <b>Casque indispensable</b> : sans séparation stéréo, l'effet n'existe pas.</p>
        <label class="champ"><span>Bande</span>
          <select id="bb">${Object.entries(bnd.bandes).map(([k,b]) => `<option value="${k}">${esc(b.nom)} ${b.hz} Hz — ${esc(b.usage)}</option>`).join('')}</select></label>
        <label class="champ"><span>Durée (minutes)</span><input id="bm" type="number" value="20" min="1" max="120"></label>
        <button class="btn or" id="goB">Générer</button>
      </div>
      <div class="carte">
        <b>Bruit coloré</b>
        <p style="color:var(--texte-faible);font-size:12.5px;margin:7px 0 11px">Masquage sonore. L'effet le mieux établi pour travailler dans le bruit.</p>
        <label class="champ"><span>Couleur</span>
          <select id="bc"><option value="brown">Brun — grave, enveloppant</option>
            <option value="pink">Rose — équilibré, proche de la pluie</option>
            <option value="white">Blanc — plat, plus agressif</option>
            <option value="blue">Bleu — aigu</option></select></label>
        <label class="champ"><span>Durée (minutes)</span><input id="bcm" type="number" value="30" min="1" max="120"></label>
        <button class="btn or" id="goBr">Générer</button>
      </div>
    </div>
    <div id="resS" style="margin-top:14px"></div>

    <h2>Analyser un son</h2>
    <div class="carte">
      <p style="color:var(--texte-doux);margin:0 0 12px">Mesure réelle : spectre par bandes, niveau intégré en LUFS, plage dynamique, tempo. Clipia raisonne ensuite sur ces chiffres.</p>
      <div class="depot" id="depA"><div style="font-size:28px;opacity:.5">♪</div><b>Déposez un fichier audio</b>
        <input type="file" id="fA" accept="audio/*" hidden></div>
      <div id="resA" style="margin-top:13px"></div>
    </div>
  </div>`));

  v.querySelectorAll('.onglets button').forEach(b => b.onclick = () => {
    v.querySelectorAll('.onglets button').forEach(x => x.classList.remove('actif'));
    b.classList.add('actif');
    for (const o of ['calc','quant','radio','son']) $('#o-' + o).hidden = o !== b.dataset.o;
  });

  // calcul
  const calc = async () => {
    try {
      const r = await api('/api/sciences/calculer', { method: 'POST', body: JSON.stringify({ expression: $('#expr').value }) });
      $('#resC').innerHTML = `<div class="carte" style="border-color:var(--ok);background:rgba(79,224,176,.07)">
        <code style="font-size:12.5px;color:var(--texte-faible)">${esc(r.expression)}</code>
        <div style="font-size:24px;font-weight:700;margin-top:7px;color:var(--ok)">${esc(r.lisible)}</div></div>`;
    } catch (e) { $('#resC').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(e.message)}</div>`; }
  };
  $('#goC').onclick = calc;
  $('#expr').onkeydown = e => { if (e.key === 'Enter') calc(); };
  v.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { $('#expr').value = b.dataset.ex; calc(); });

  $('#goCv').onclick = async () => {
    try {
      const r = await api('/api/sciences/convertir', { method: 'POST', body: JSON.stringify({
        valeur: $('#cv').value, de: $('#cde').value.trim(), vers: $('#cvers').value.trim() }) });
      $('#resCv').innerHTML = `<b style="color:var(--ok)">${esc(r.lisible)} ${esc(r.vers)}</b>
        <span style="color:var(--texte-faible);font-size:12px"> (${esc(r.dimension)})</span>`;
    } catch (e) { $('#resCv').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };

  // quantique
  v.querySelectorAll('[data-qex]').forEach(b => b.onclick = () => {
    const e = exq.quantique[b.dataset.qex];
    $('#qc').value = JSON.stringify({ qubits: e.qubits, portes: e.portes });
    $('#qInfo').textContent = e.quoi;
  });
  $('#goQ').onclick = async () => {
    $('#resQ').innerHTML = '<div class="carte"><span class="tourne"></span> simulation…</div>';
    try {
      const r = await api('/api/sciences/quantique', { method: 'POST', body: $('#qc').value });
      $('#resQ').innerHTML = `
        <div class="carte">
          <div class="rang" style="justify-content:space-between;margin-bottom:12px">
            <b>${r.qubits} qubits · ${r.portes.length} portes</b>
            <span class="etiq ${r.intrique ? 'or' : 'neutre'}">${r.intrique ? 'état intriqué' : 'état séparable'}</span>
          </div>
          <div style="font-family:var(--mono,monospace);font-size:12px;color:var(--texte-faible);margin-bottom:13px">${r.portes.map(esc).join(' → ')}</div>
          <b style="font-size:13px">Amplitudes de l'état</b>
          <div style="display:flex;flex-direction:column;gap:5px;margin:9px 0 15px">
            ${r.amplitudes.map(a => `<div class="rang" style="gap:10px">
              <code style="min-width:74px;color:var(--or-clair)">${esc(a.base)}</code>
              <div class="barre" style="flex:1;margin:0"><i style="width:${a.pourcent}%"></i></div>
              <span style="min-width:52px;text-align:right;font-size:12.5px">${a.pourcent} %</span></div>`).join('')}
          </div>
          <b style="font-size:13px">Mesures réelles (1024 tirages)</b>
          <div class="rang" style="margin:9px 0 15px">
            ${r.mesures.map(m => `<span class="etiq neutre">${esc(m.resultat)} ${m.frequence} %</span>`).join('')}
          </div>
          <b style="font-size:13px">Intrication par qubit</b>
          <div class="rang" style="margin-top:9px">
            ${r.intrications.map(i => `<span class="etiq ${i.entropie > .9 ? 'or' : i.entropie > .01 ? 'info' : 'neutre'}">q${i.qubit} : ${i.entropie}</span>`).join('')}
          </div>
          <p style="font-size:12px;color:var(--texte-faible);margin-top:9px">1 = intrication maximale, 0 = qubit indépendant.</p>
        </div>`;
    } catch (e) { $('#resQ').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(e.message)}</div>`; }
  };

  // radio
  v.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { $('#rf').value = b.dataset.rf; $('#goR').click(); });
  $('#goR').onclick = async () => {
    try {
      const r = await api('/api/sciences/radio', { method: 'POST', body: JSON.stringify({
        frequence: +$('#rf').value, puissance_W: +$('#rp').value,
        distance_m: +$('#rd').value, vitesse_ms: +$('#rv').value, gain_tx_dBi: 2, gain_rx_dBi: 2 }) });
      $('#resR').innerHTML = `<div class="liste">
        <div><b style="flex:1">Bande</b><span>${esc(r.bande)}</span></div>
        <div><b style="flex:1">Longueur d'onde</b><span>${r.longueur_onde_m} m</span></div>
        <div><b style="flex:1">Antenne quart d'onde</b><span>${r.antenne.quart_onde_m} m</span></div>
        ${r.propagation ? `<div><b style="flex:1">Perte en espace libre</b><span>${r.propagation.perte_espace_libre_dB} dB</span></div>
        <div><b style="flex:1">Rayon de Fresnel</b><span>${r.propagation.fresnel_1_m} m</span></div>` : ''}
        ${r.bilan ? `<div><b style="flex:1">Puissance reçue</b><span>${r.bilan.reception_dBm} dBm</span></div>
        <div><b style="flex:1">Marge sur −100 dBm</b><span style="color:${r.bilan.marge_vs_sensibilite_minus100dBm>0?'var(--ok)':'var(--erreur)'}">${r.bilan.marge_vs_sensibilite_minus100dBm} dB</span></div>` : ''}
        ${r.doppler ? `<div><b style="flex:1">Décalage Doppler</b><span>${r.doppler.decalage_Hz} Hz</span></div>` : ''}
      </div>`;
    } catch (e) { $('#resR').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };

  $('#goP2').onclick = async () => {
    try {
      const r = await api('/api/sciences/pilotage', { method: 'POST', body: JSON.stringify({
        frequence_qubit: +$('#pq').value, amplitude_rabi: +$('#pr').value,
        T1_us: +$('#p1').value, T2_us: +$('#p2').value }) });
      $('#resP2').innerHTML = `<div class="liste">
        <div><b style="flex:1">Impulsion</b><span style="font-size:12.5px">${esc(r.impulsion.type)}</span></div>
        <div><b style="flex:1">Durée</b><span style="color:var(--or-clair)">${esc(r.impulsion.duree_lisible)}</span></div>
        <div><b style="flex:1">Longueur d'onde</b><span>${r.impulsion.longueur_onde_m} m</span></div>
        <div><b style="flex:1">Fidélité estimée</b><span>${r.coherence.fidelite_estimee}</span></div>
        <div><b style="flex:1">Portes avant décohérence</b><span style="color:var(--ok)">${r.coherence.portes_avant_decoherence}</span></div>
      </div>
      <div class="carte creux" style="margin-top:11px"><p style="margin:0;font-size:12.5px;color:var(--texte-doux)">${esc(r.thermique.pourquoi)}</p></div>
      <div class="carte creux" style="margin-top:9px;border-color:var(--alerte)"><p style="margin:0;font-size:12.5px;color:var(--texte-doux)">${esc(r.realite)}</p></div>`;
    } catch (e) { $('#resP2').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };

  // sons
  const genererSon = async (corps, bouton) => {
    bouton.disabled = true;
    $('#resS').innerHTML = '<div class="carte"><span class="tourne"></span> génération…</div>';
    try {
      const a = await api('/api/sciences/audio/generer', { method: 'POST', body: JSON.stringify(corps) });
      $('#resS').innerHTML = `<div class="carte" style="border-color:var(--ok)">
        <b style="color:var(--ok)">${esc(a.nom)}</b>
        <audio src="${a.url}" controls style="width:100%;margin-top:11px"></audio>
        <div class="rang" style="margin-top:10px">
          <a class="btn mini" href="${a.url}" download>Télécharger</a>
          <a class="btn mini" href="#/medias">Médiathèque</a>
          <span class="etiq neutre">${(a.bytes/1048576).toFixed(1)} Mo</span>
        </div></div>`;
    } catch (e) { $('#resS').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(e.message)}</div>`; }
    finally { bouton.disabled = false; }
  };
  $('#goB').onclick = e => genererSon({ type: 'binaural', bande: $('#bb').value, minutes: +$('#bm').value }, e.target);
  $('#goBr').onclick = e => genererSon({ type: 'bruit', couleur: $('#bc').value, minutes: +$('#bcm').value }, e.target);

  $('#depA').onclick = () => $('#fA').click();
  $('#fA').onchange = async () => {
    $('#resA').innerHTML = '<span class="tourne"></span> mesure…';
    try {
      const fd = new FormData(); fd.append('f', $('#fA').files[0]);
      const up = await api('/api/televerser', { method: 'POST', body: fd });
      const r = await api('/api/sciences/audio/analyser', { method: 'POST', body: JSON.stringify({ chemin: up.file }) });
      $('#resA').innerHTML = `
        <div class="rang" style="margin-bottom:12px">
          <span class="etiq neutre">${r.duree} s</span>
          <span class="etiq neutre">${r.canaux} canaux</span>
          <span class="etiq neutre">${r.echantillonnage} Hz</span>
          ${r.bpm ? `<span class="etiq or">${r.bpm} BPM</span>` : ''}
          ${r.loudness.integre != null ? `<span class="etiq info">${r.loudness.integre} LUFS</span>` : ''}
        </div>
        <b style="font-size:13px">Spectre par bandes</b>
        <div style="display:flex;flex-direction:column;gap:5px;margin:9px 0 14px">
          ${r.spectre.map(s => `<div class="rang" style="gap:10px">
            <span style="min-width:96px;font-size:12.5px">${esc(s.bande)}</span>
            <div class="barre" style="flex:1;margin:0"><i style="width:${Math.max(0, Math.min(100, (s.dB + 90) * 1.1))}%"></i></div>
            <span style="min-width:62px;text-align:right;font-size:12px;color:var(--texte-faible)">${s.dB} dB</span></div>`).join('')}
        </div>
        <b style="font-size:13px">Ce que ça dit</b>
        <ul style="margin:8px 0 0;padding-left:19px;color:var(--texte-doux);font-size:13.5px">
          ${r.lecture.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
    } catch (e) { $('#resA').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };
};

// ═══ SON & CERVEAU ════════════════════════════════════════════════════════
VUES.neuro = async (v) => {
  const d = await api('/api/neuro/programmes');
  const niv = (n) => n === 'solide' ? 'ok' : n === 'partagé' ? 'att' : 'neutre';

  v.append(el(`
  <h1>Son &amp; cerveau</h1>
  <p class="sous">Des programmes sonores contre le stress et pour l’attention. Le mécanisme actif, c’est la respiration guidée — le son ne fait que tenir le rythme.</p>

  <div class="carte" style="border-color:var(--ok);background:linear-gradient(140deg,rgba(79,224,176,.07),transparent)">
    <span class="etiq ok">gratuit et sans limite</span>
    <p style="color:var(--texte-doux);margin:9px 0 0">${esc(d.acces.pourquoi)}</p>
  </div>

  <div class="grille g3" style="margin:16px 0">
    ${Object.entries(d.savoir).filter(([k]) => k !== 'limites').map(([k, s]) => `
      <div class="carte creux">
        <span class="etiq ${niv(s.niveau)}">${esc(k)} — ${esc(s.niveau)}</span>
        <p style="color:var(--texte-faible);font-size:12.5px;margin-top:8px">${esc(s.texte)}</p>
      </div>`).join('')}
  </div>

  <div class="carte" style="border-color:var(--alerte)">
    <b style="color:var(--alerte)">Ce que ça ne fait pas</b>
    <p style="color:var(--texte-doux);margin-top:8px">${esc(d.savoir.limites)}</p>
  </div>

  <h2>Les programmes</h2>
  <div class="grille g2">
    ${Object.entries(d.programmes).map(([id, p]) => `
      <div class="carte" data-prog="${id}">
        <div class="rang" style="justify-content:space-between;align-items:start">
          <b style="font-size:15px">${esc(p.nom)}</b>
          <span class="etiq ${niv(p.preuve)}">${esc(p.preuve)}</span>
        </div>
        <p style="color:var(--texte-doux);font-size:13.5px;margin:9px 0 11px">${esc(p.pourquoi)}</p>
        <div class="rang" style="margin-bottom:11px">
          <span class="etiq neutre">${p.minutes} min</span>
          ${p.phases.filter(x => x.inspire).map(x => `<span class="etiq or">${x.inspire}-${x.pause}-${x.expire}</span>`).join('')}
          <span class="etiq info">bruit ${esc(p.bruit)}</span>
          ${p.binaural ? `<span class="etiq neutre">binaural ${esc(p.binaural)}</span>` : ''}
        </div>
        <details style="margin-bottom:12px"><summary style="cursor:pointer;font-size:12.5px;color:var(--or-clair)">Comment s’en servir</summary>
          <p style="color:var(--texte-faible);font-size:12.5px;margin-top:7px">${esc(p.protocole)}</p></details>
        <div class="rang">
          <label class="champ" style="margin:0;flex:1"><span>Durée (min)</span>
            <input type="number" class="duree" value="${p.minutes}" min="1" max="120"></label>
          <button class="btn or" data-gen="${id}" style="align-self:end">Générer</button>
        </div>
      </div>`).join('')}
  </div>
  <div id="resN" style="margin-top:16px"></div>`));

  v.querySelectorAll('[data-gen]').forEach(b => b.onclick = async () => {
    const carte = b.closest('[data-prog]');
    const minutes = Number(carte.querySelector('.duree').value) || undefined;
    b.disabled = true; b.textContent = 'génération…';
    $('#resN').innerHTML = '<div class="carte"><span class="tourne"></span> Clipia fabrique le son, mesure par mesure…</div>';
    try {
      const a = await api('/api/neuro/generer', { method: 'POST', body: JSON.stringify({ id: b.dataset.gen, minutes }) });
      $('#resN').innerHTML = `<div class="carte" style="border-color:var(--ok)">
        <b style="color:var(--ok)">${esc(a.nom)}</b>
        <audio src="${a.url}" controls style="width:100%;margin-top:11px"></audio>
        <div class="rang" style="margin-top:10px">
          <a class="btn mini" href="${a.url}" download>Télécharger</a>
          <span class="etiq neutre">${(a.bytes / 1048576).toFixed(1)} Mo</span>
          ${a.detail.cycles ? `<span class="etiq or">${a.detail.cycles} cycles respiratoires</span>` : ''}
          ${a.detail.rythme?.length ? `<span class="etiq info">${a.detail.rythme.join(' puis ')}</span>` : ''}
        </div>
        <p style="color:var(--texte-faible);font-size:12.5px;margin:11px 0 0">${esc(a.detail.protocole)}</p>
      </div>`;
      $('#resN').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { $('#resN').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(e.message)}</div>`; }
    finally { b.disabled = false; b.textContent = 'Générer'; }
  });
};

// ═══ LIAISON SANS INTERNET ════════════════════════════════════════════════
VUES.liaison = async (v) => {
  const d = await api('/api/liaison/voies');

  v.append(el(`
  <h1>Parler sans internet</h1>
  <p class="sous">Du son qui traverse une pièce au satellite qui couvre la planète. Deux voies marchent sans rien acheter, dès maintenant.</p>

  <div class="carte ${d.materiel.trouves.length ? '' : 'creux'}" style="${d.materiel.trouves.length ? 'border-color:var(--ok)' : ''}">
    <b>Matériel détecté sur cette machine</b>
    <p style="color:var(--texte-doux);margin:8px 0 0">${esc(d.materiel.verdict)}</p>
    ${d.materiel.trouves.length ? `<div class="rang" style="margin-top:10px">${d.materiel.trouves.map(m =>
      `<span class="etiq ok">${esc(m.port)} — ${esc(m.quoi)}</span>`).join('')}</div>` : ''}
  </div>

  <h2>Envoyer un message par le son</h2>
  <div class="carte">
    <p style="color:var(--texte-doux);margin:0 0 12px">Le texte devient un son. Joue-le sur un haut-parleur : un autre appareil qui écoute au micro le redécode en texte. Aucun réseau n’intervient.</p>
    <label class="champ"><span>Message (255 caractères maximum)</span>
      <textarea id="msg" maxlength="255" style="min-height:70px">Ici Clipia. Message transmis par les ondes, sans internet.</textarea></label>
    <div class="onglets" style="margin-bottom:12px">
      <button class="actif" data-mode="fsk">FSK — haut-parleur, talkie, radio</button>
      <button data-mode="dtmf">DTMF — appel 3G / 4G / 5G</button>
    </div>
    <p id="explMode" style="color:var(--texte-faible);font-size:12.5px;margin:0 0 12px">
      Modulation Bell 202 : 1200 Hz pour un zéro, 2200 Hz pour un un. Robuste au bruit, passe dans un talkie-walkie.</p>
    <button class="btn or" id="goMod">Fabriquer le son</button>
    <div id="resMod" style="margin-top:13px"></div>
  </div>

  <h2>Relire un son reçu</h2>
  <div class="carte">
    <p style="color:var(--texte-doux);margin:0 0 12px">Enregistre ce que tu entends, dépose le fichier ici : Clipia retrouve le texte et vérifie son intégrité. Il essaie les deux modulations tout seul.</p>
    <div class="depot" id="depL"><div style="font-size:26px;opacity:.5">◟◞</div><b>Déposez l’enregistrement</b>
      <input type="file" id="fL" accept="audio/*" hidden></div>
    <div id="resDem" style="margin-top:13px"></div>
  </div>

  <h2>Toutes les voies</h2>
  <div class="grille g2">
    ${d.voies.map(x => `
      <div class="carte ${x.pret ? '' : 'creux'}" style="${x.pret ? 'border-color:var(--ok)' : ''}">
        <div class="rang" style="justify-content:space-between;align-items:start">
          <b style="font-size:14.5px">${esc(x.nom)}</b>
          <span class="etiq ${x.pret ? 'ok' : 'neutre'}">${x.pret ? 'prêt' : 'matériel requis'}</span>
        </div>
        <p style="color:var(--texte-doux);font-size:13px;margin:9px 0 11px">${esc(x.quoi)}</p>
        <div class="liste" style="font-size:12.5px">
          <div><b style="flex:1">Matériel</b><span>${esc(x.materiel)}</span></div>
          <div><b style="flex:1">Coût</b><span>${esc(x.cout)}</span></div>
          <div><b style="flex:1">Portée</b><span>${esc(x.portee)}</span></div>
          <div><b style="flex:1">Débit</b><span>${esc(x.debit)}</span></div>
          <div><b style="flex:1">Licence</b><span>${esc(x.licence)}</span></div>
        </div>
        <p style="color:var(--alerte);font-size:12px;margin:10px 0 0"><b>Limites :</b> ${esc(x.limites)}</p>
        ${x.achat ? `<p style="color:var(--texte-faible);font-size:12px;margin:7px 0 0"><b>Où acheter :</b> ${esc(x.achat)}</p>` : ''}
      </div>`).join('')}
  </div>

  <div class="carte creux" style="margin-top:14px;border-color:var(--alerte)">
    <b style="color:var(--alerte)">Ce que dit la loi</b>
    <p style="color:var(--texte-doux);margin-top:8px">${esc(d.legalite)}</p>
  </div>`));

  let mode = 'fsk';
  const EXPL = {
    fsk: 'Modulation Bell 202 : 1200 Hz pour un zéro, 2200 Hz pour un un. Robuste au bruit, passe dans un talkie-walkie.',
    dtmf: 'Le son des touches du téléphone. C’est le seul signal que tout le réseau téléphonique mondial garantit de transmettre intact, codecs vocaux compris. Aucune donnée mobile consommée : seul le canal voix sert.'
  };
  v.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    v.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('actif'));
    b.classList.add('actif'); mode = b.dataset.mode; $('#explMode').textContent = EXPL[mode];
  });

  $('#goMod').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const a = await api('/api/liaison/moduler', { method: 'POST', body: JSON.stringify({ texte: $('#msg').value, mode }) });
      $('#resMod').innerHTML = `<div class="carte" style="border-color:var(--ok)">
        <b style="color:var(--ok)">${esc(a.nom)}</b>
        <audio src="${a.url}" controls style="width:100%;margin-top:11px"></audio>
        <div class="rang" style="margin-top:10px">
          <a class="btn mini" href="${a.url}" download>Télécharger</a>
          <span class="etiq or">${a.detail.secondes} s</span>
          <span class="etiq neutre">${a.detail.octets} octets</span>
          ${a.detail.debit ? `<span class="etiq info">${esc(a.detail.debit)}</span>` : `<span class="etiq info">${a.detail.baud} baud</span>`}
        </div>
        <p style="color:var(--texte-faible);font-size:12.5px;margin:11px 0 0">${esc(a.detail.comment)}</p>
      </div>`;
    } catch (err) { $('#resMod').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(err.message)}</div>`; }
    finally { e.target.disabled = false; }
  };

  $('#depL').onclick = () => $('#fL').click();
  $('#fL').onchange = async () => {
    $('#resDem').innerHTML = '<span class="tourne"></span> démodulation…';
    try {
      const fd = new FormData(); fd.append('f', $('#fL').files[0]);
      const up = await api('/api/televerser', { method: 'POST', body: fd });
      const r = await api('/api/liaison/demoduler', { method: 'POST', body: JSON.stringify({ chemin: up.file }) });
      $('#resDem').innerHTML = `<div class="carte" style="border-color:var(--ok)">
        <span class="etiq ok">${esc(r.mode || 'fsk')} — intégrité vérifiée</span>
        <p style="font-size:17px;font-weight:650;margin:11px 0 0;color:var(--ok)">${esc(r.texte)}</p>
        <p style="color:var(--texte-faible);font-size:12.5px;margin:9px 0 0">${esc(r.lecture)}${r.qualite != null ? ` Qualité du signal : ${r.qualite}.` : ''}</p>
      </div>`;
    } catch (e) { $('#resDem').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(e.message)}</div>`; }
  };
};

// ═══ LE PONT : MACHINE → HUMAIN ═══════════════════════════════════════════
VUES.pont = async (v) => {
  const d = await api('/api/pont/langage');

  v.append(el(`
  <h1>Le pont</h1>
  <p class="sous">Un seul fichier son qui porte trois choses à la fois : les données que la machine relit au caractère près, le sens que tu perçois d’instinct, et un lit respiratoire qui agit sur ton corps.</p>

  <div class="carte" style="border-color:var(--alerte);background:linear-gradient(140deg,rgba(255,184,107,.07),transparent)">
    <b style="color:var(--alerte)">À lire avant d’essayer</b>
    <p style="color:var(--texte-doux);margin-top:8px">${esc(d.honnete)}</p>
  </div>

  <h2>Composer un message</h2>
  <div class="carte">
    <label class="champ"><span>Texte (lu exactement par la machine)</span>
      <textarea id="pt" maxlength="200" style="min-height:62px">Position Flize 08160. Batterie 34 pourcent. Tout va bien.</textarea></label>
    <div class="grille g2">
      <label class="champ"><span>Nature du message</span>
        <select id="pn">${Object.entries(d.natures).map(([k, n]) =>
          `<option value="${k}"${k === 'reponse' ? ' selected' : ''}>${esc(n.nom)} — ${esc(n.instinct)}</option>`).join('')}</select></label>
      <label class="champ"><span>Urgence</span>
        <select id="pu">${d.urgences.map(u =>
          `<option value="${u.n}"${u.n === 2 ? ' selected' : ''}>${u.n} · ${esc(u.nom)} — ${u.bpm} bpm, ${esc(u.instinct)}</option>`).join('')}</select></label>
    </div>
    <label class="champ"><span>Intensité</span><input type="range" id="pi" min="0" max="1" step="0.1" value="0.5"></label>
    <label class="rang" style="margin-bottom:12px;cursor:pointer">
      <input type="checkbox" id="pr" checked> <span style="font-size:13px">Ajouter le lit respiratoire à 6 cycles/minute</span></label>
    <button class="btn or" id="goP">Composer</button>
    <div id="resP" style="margin-top:13px"></div>
  </div>

  <h2>Le langage, nature par nature</h2>
  <div class="grille g3">
    ${Object.entries(d.natures).map(([k, n]) => `
      <div class="carte creux">
        <b>${esc(n.nom)}</b>
        <p style="color:var(--or-clair);font-size:12.5px;margin:7px 0 4px">${esc(n.signature)}</p>
        <p style="color:var(--texte-faible);font-size:12px;margin:0">Perçu comme : ${esc(n.instinct)}</p>
        <p style="color:var(--texte-faible);font-size:11.5px;margin:6px 0 0">${esc(n.mode)} · timbre ${esc(n.timbre)}</p>
      </div>`).join('')}
  </div>

  <h2>La chaîne, maillon par maillon</h2>
  <div class="liste">
    ${d.chaine.map(c => `<div style="align-items:start">
      <span class="etiq ${/^fait/.test(c.statut) ? 'ok' : /mesurable|réel/.test(c.statut) ? 'info' : 'att'}" style="min-width:132px">${esc(c.statut)}</span>
      <div style="flex:1"><b style="font-size:13.5px">${c.etape}. ${esc(c.nom)}</b>
        <p style="color:var(--texte-doux);font-size:12.5px;margin:5px 0 0">${esc(c.comment)}</p></div>
    </div>`).join('')}
  </div>

  <h2>Apprendre à lire le langage</h2>
  <div class="carte">
    <p style="color:var(--texte-doux);margin:0 0 12px">Comme un opérateur radio apprend le morse. Clipia joue un son, tu dis ce que tu as entendu.</p>
    <div class="rang"><button class="btn or" id="goEx">Nouvel exercice</button>
      <select id="niv" style="max-width:160px"><option value="1">Niveau 1 — deux natures</option>
        <option value="2">Niveau 2 — quatre natures</option><option value="3">Niveau 3 — tout</option></select></div>
    <div id="resEx" style="margin-top:13px"></div>
  </div>`));

  $('#goP').onclick = async (e) => {
    e.target.disabled = true;
    $('#resP').innerHTML = '<div class="carte"><span class="tourne"></span> composition des trois couches…</div>';
    try {
      const a = await api('/api/pont/composer', { method: 'POST', body: JSON.stringify({
        texte: $('#pt').value, nature: $('#pn').value, urgence: Number($('#pu').value),
        intensite: Number($('#pi').value), respiration: $('#pr').checked }) });
      const c = a.detail;
      $('#resP').innerHTML = `<div class="carte" style="border-color:var(--ok)">
        <b style="color:var(--ok)">${esc(a.nom)}</b>
        <audio src="${a.url}" controls style="width:100%;margin:11px 0"></audio>
        <div class="liste" style="font-size:12.5px">
          <div><span class="etiq or" style="min-width:92px">couche 1</span><div style="flex:1">
            <b>Données — ${esc(c.couche1.bande)}</b><p style="margin:3px 0 0;color:var(--texte-faible)">${c.couche1.octets} octets, relus au caractère près par une machine.</p></div></div>
          <div><span class="etiq info" style="min-width:92px">couche 2</span><div style="flex:1">
            <b>Sens — ${esc(c.couche2.bande)}</b><p style="margin:3px 0 0;color:var(--texte-faible)">${esc(c.couche2.signature)} · ${esc(c.couche2.urgence)} à ${c.couche2.bpm} bpm · perçu comme : ${esc(c.couche2.instinct)}</p></div></div>
          <div><span class="etiq ok" style="min-width:92px">couche 3</span><div style="flex:1">
            <b>État — ${esc(c.couche3.respiration)}</b><p style="margin:3px 0 0;color:var(--texte-faible)">Agit sur la variabilité cardiaque, effet mesuré.</p></div></div>
        </div>
        <div class="rang" style="margin-top:11px">
          <a class="btn mini" href="${a.url}" download>Télécharger</a>
          <button class="btn mini" id="relire">Vérifier que la machine le relit</button>
        </div>
        <div id="resRelu" style="margin-top:11px"></div>
      </div>`;
      $('#relire').onclick = async (ev) => {
        ev.target.disabled = true;
        $('#resRelu').innerHTML = '<span class="tourne"></span> démodulation de la couche données…';
        try {
          const r = await api('/api/pont/lire', { method: 'POST', body: JSON.stringify({ chemin: a.file }) });
          const identique = r.texte === $('#pt').value;
          $('#resRelu').innerHTML = `<div class="carte creux" style="border-color:${identique ? 'var(--ok)' : 'var(--alerte)'}">
            <span class="etiq ${identique ? 'ok' : 'att'}">${identique ? 'texte identique, intégrité vérifiée' : 'texte altéré'}</span>
            <p style="margin:8px 0 0;font-family:var(--mono,monospace);font-size:12.5px">${esc(r.texte)}</p></div>`;
        } catch (err) { $('#resRelu').innerHTML = `<span style="color:var(--erreur)">${esc(err.message)}</span>`; }
      };
    } catch (err) { $('#resP').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(err.message)}</div>`; }
    finally { e.target.disabled = false; }
  };

  $('#goEx').onclick = async () => {
    const ex = await api('/api/pont/entrainement?niveau=' + $('#niv').value);
    const a = await api('/api/pont/composer', { method: 'POST', body: JSON.stringify({
      texte: 'exercice', nature: ex.nature, urgence: ex.urgence, respiration: false, repetitions: 3 }) });
    $('#resEx').innerHTML = `<div class="carte creux">
      <p style="margin:0 0 9px;color:var(--texte-doux)">${esc(ex.consigne)}</p>
      <audio src="${a.url}" controls style="width:100%"></audio>
      <div class="rang" style="margin-top:11px;flex-wrap:wrap">
        ${ex.choix.map(c => `<button class="btn mini" data-rep="${c.id}">${esc(c.nom)}</button>`).join('')}
      </div>
      <div id="verdict" style="margin-top:11px"></div></div>`;
    $('#resEx').querySelectorAll('[data-rep]').forEach(b => b.onclick = () => {
      const bon = b.dataset.rep === ex.solution.nature;
      $('#verdict').innerHTML = `<span class="etiq ${bon ? 'ok' : 'err'}">${bon ? 'exact' : 'raté — c’était ' + esc(ex.solution.nom)}</span>
        <p style="color:var(--texte-faible);font-size:12.5px;margin:8px 0 0">${esc(ex.solution.pourquoi)}</p>`;
    });
  };
};

// ═══ PENSÉE : INTERFACE CERVEAU-MACHINE ═══════════════════════════════════
VUES.pensee = async (v) => {
  const [d, ar] = await Promise.all([api('/api/pensee/etat'), api('/api/decodeur/arbre?signaux=6')]);

  v.append(el(`
  <h1>Te contacter par la pensée</h1>
  <p class="sous">Ce qui marche vraiment, et ce qui n’existe pas. Sans vendre de rêve.</p>

  <div class="carte" style="border-color:var(--alerte);background:linear-gradient(140deg,rgba(255,184,107,.08),transparent)">
    <b style="color:var(--alerte)">La vérité d’abord</b>
    <p style="color:var(--texte-doux);margin-top:8px">${esc(d.verite)}</p>
  </div>

  <div class="grille g2" style="margin-top:16px">
    <div class="carte creux" style="border-color:var(--ok)">
      <span class="etiq ok">possible, et construit</span>
      <ul style="margin:10px 0 0;padding-left:19px;color:var(--texte-doux);font-size:13.5px">
        ${ar.limites.cree.map(x => `<li style="margin-bottom:6px">${esc(x)}</li>`).join('')}</ul>
    </div>
    <div class="carte creux" style="border-color:var(--erreur)">
      <span class="etiq err">impossible, et pourquoi</span>
      <ul style="margin:10px 0 9px;padding-left:19px;color:var(--texte-doux);font-size:13.5px">
        ${ar.limites.impossible.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p style="color:var(--texte-faible);font-size:12.5px;margin:0">${esc(ar.limites.pourquoi)}</p>
    </div>
  </div>

  <h2>Essayer tout de suite, sans casque</h2>
  <div class="carte">
    <p style="color:var(--texte-doux);margin:0 0 12px">Un simulateur produit un signal cérébral réaliste — bruit en 1/f, bouffées de rythmes, réponse visuelle. Toute la chaîne tourne, et tu vois exactement ce qu’un vrai casque donnerait.</p>
    <div class="onglets" style="margin-bottom:13px">
      <button class="actif" data-sim="etat">Lire un état mental</button>
      <button data-sim="ssvep">Choisir en regardant</button>
      <button data-sim="decodeur">Décodeur personnel</button>
    </div>

    <div id="s-etat">
      <div class="rang" style="flex-wrap:wrap">
        ${['detente','concentration','tension','somnolence'].map(p =>
          `<button class="btn mini" data-profil="${p}">${esc(p)}</button>`).join('')}
      </div>
      <div id="resEtat" style="margin-top:13px"></div>
    </div>

    <div id="s-ssvep" hidden>
      <p style="color:var(--texte-faible);font-size:12.5px;margin:0 0 11px">Six cibles clignotantes. Aucune entre 8 et 13 Hz : c’est la bande du rythme alpha, qui provoquerait de fausses détections. Trois en dessous, trois au-dessus — et aucune dans la zone 15-25 Hz, la plus risquée pour une personne photosensible.</p>
      <div class="rang" style="flex-wrap:wrap">
        ${d.cibles.map(c => `<button class="btn mini" data-hz="${c.hz}">${esc(c.libelle)} · ${c.hz} Hz</button>`).join('')}
        <button class="btn mini" data-hz="0">Ne rien regarder</button>
      </div>
      <div id="resSsvep" style="margin-top:13px"></div>
    </div>

    <div id="s-decodeur" hidden>
      <p style="color:var(--texte-faible);font-size:12.5px;margin:0 0 11px">Entraîne un modèle sur des essais étiquetés, puis mesure sa précision par validation croisée — sur des essais qu’il n’a jamais vus. C’est la seule mesure honnête.</p>
      <div class="rang">
        <button class="btn or" id="goDemo">Entraîner et mesurer</button>
        <select id="nbCl" style="max-width:190px">
          <option value="2">2 intentions</option><option value="4">4 intentions</option></select>
      </div>
      <div id="resDec" style="margin-top:13px"></div>
    </div>
  </div>

  <h2>Peu de signaux, tout dire</h2>
  <div class="carte">
    <p style="color:var(--texte-doux);margin:0 0 12px">${esc(ar.honnete)}</p>
    <div class="liste" style="font-size:13px">
      <div><b style="flex:1">Signaux fiables</b><span>${ar.signaux}</span></div>
      <div><b style="flex:1">Choix par lettre</b><span>${ar.choixParLettre}</span></div>
      <div><b style="flex:1">Vitesse d’écriture</b><span style="color:var(--or-clair)">${ar.lettresParMinute} lettres/minute</span></div>
    </div>
    <p style="color:var(--texte-faible);font-size:12.5px;margin:11px 0 0">${esc(ar.comment)} ${esc(ar.phrases)}</p>
    <p style="color:var(--or-clair);font-size:12.5px;margin:9px 0 0">${esc(ar.limites.voie)}</p>
  </div>

  <h2>Brancher un vrai casque</h2>
  <div class="carte ${d.flux.connecte ? '' : 'creux'}" style="${d.flux.connecte ? 'border-color:var(--ok)' : ''}">
    <div class="rang" style="justify-content:space-between">
      <b>${d.flux.connecte ? 'Casque connecté' : 'Aucun casque connecté'}</b>
      <span class="etiq ${d.flux.connecte ? 'ok' : 'neutre'}">${d.flux.paquets || 0} paquets reçus</span>
    </div>
    <p style="color:var(--texte-doux);margin:9px 0 11px">${esc(d.flux.quoi || '')}</p>
    <div class="rang">
      <button class="btn or" id="goEcoute">Écouter le port 5005</button>
      <button class="btn mini" id="goStop">Arrêter</button>
    </div>
    <div id="resEcoute" style="margin-top:11px"></div>
  </div>

  <div class="grille g2" style="margin-top:14px">
    ${d.casques.map(c => `
      <div class="carte creux" style="${c.recommande ? 'border-color:var(--or)' : ''}">
        <div class="rang" style="justify-content:space-between;align-items:start">
          <b>${esc(c.nom)}</b>
          ${c.recommande ? '<span class="etiq or">recommandé</span>' : ''}
        </div>
        <div class="rang" style="margin:8px 0">
          <span class="etiq neutre">${esc(c.prix)}</span>
          <span class="etiq neutre">${esc(String(c.electrodes))} électrodes</span>
        </div>
        <p style="color:var(--texte-doux);font-size:12.5px;margin:0 0 8px">${esc(c.comment)}</p>
        <p style="color:var(--ok);font-size:12px;margin:0">Bon pour : ${c.bon.map(esc).join(', ')}</p>
        <p style="color:var(--alerte);font-size:12px;margin:5px 0 0">Limites : ${c.faible.map(esc).join(', ')}</p>
      </div>`).join('')}
  </div>

  <h2>La boucle complète</h2>
  <div class="liste">
    ${d.boucle.map(b => `<div style="align-items:start">
      <span class="etiq ${/^fait/.test(b.statut) ? 'ok' : /mesurable/.test(b.statut) ? 'info' : 'att'}" style="min-width:150px">${esc(b.statut)}</span>
      <div style="flex:1"><b style="font-size:13.5px">${b.etape}. ${esc(b.nom)}</b>
        <p style="color:var(--texte-doux);font-size:12.5px;margin:5px 0 0">${esc(b.quoi)}</p></div>
    </div>`).join('')}
  </div>

  <div class="carte creux" style="margin-top:14px;border-color:var(--alerte)">
    <b style="color:var(--alerte)">Précautions réelles</b>
    <p style="color:var(--texte-doux);margin-top:8px">${esc(d.securite)}</p>
  </div>`));

  v.querySelectorAll('[data-sim]').forEach(b => b.onclick = () => {
    v.querySelectorAll('[data-sim]').forEach(x => x.classList.remove('actif'));
    b.classList.add('actif');
    for (const s of ['etat','ssvep','decodeur']) $('#s-' + s).hidden = s !== b.dataset.sim;
  });

  v.querySelectorAll('[data-profil]').forEach(b => b.onclick = async () => {
    $('#resEtat').innerHTML = '<span class="tourne"></span> lecture du signal…';
    try {
      const r = await api('/api/pensee/simuler', { method: 'POST', body: JSON.stringify({ profil: b.dataset.profil, secondes: 4 }) });
      $('#resEtat').innerHTML = `<div class="carte creux">
        <div class="rang" style="justify-content:space-between">
          <b style="font-size:15px;color:var(--or-clair)">${esc(r.dominante)}</b>
          <a class="btn mini" href="#/neuro">Programme : ${esc(r.programme)}</a>
        </div>
        <p style="color:var(--texte-doux);margin:9px 0 12px">${esc(r.conseil || 'État intermédiaire, sans dominante nette.')}</p>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${Object.entries(r.bandes).map(([k, val]) => `<div class="rang" style="gap:10px">
            <span style="min-width:62px;font-size:12.5px">${esc(k)}</span>
            <div class="barre" style="flex:1;margin:0"><i style="width:${Math.round(val * 100)}%"></i></div>
            <span style="min-width:48px;text-align:right;font-size:12px;color:var(--texte-faible)">${(val * 100).toFixed(1)} %</span></div>`).join('')}
        </div>
        <div class="rang" style="margin-top:11px">
          ${Object.entries(r.indices).map(([k, val]) => `<span class="etiq neutre">${esc(k)} ${val}</span>`).join('')}
        </div>
        <p style="color:var(--texte-faible);font-size:12px;margin:10px 0 0">${esc(r.calibration)}</p>
      </div>`;
    } catch (e) { $('#resEtat').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  });

  v.querySelectorAll('[data-hz]').forEach(b => b.onclick = async () => {
    const hz = Number(b.dataset.hz);
    $('#resSsvep').innerHTML = '<span class="tourne"></span> analyse spectrale…';
    try {
      const corps = { profil: 'concentration', secondes: 4, ...(hz ? { ssvepHz: hz } : { ssvepHz: null }) };
      const r = await api('/api/pensee/simuler', { method: 'POST', body: JSON.stringify(hz ? corps : { profil: 'detente', secondes: 4, ssvepHz: 0.0001 }) });
      const s = r.ssvep;
      $('#resSsvep').innerHTML = `<div class="carte creux" style="border-color:${s.choix ? 'var(--ok)' : 'var(--carte-2)'}">
        ${s.choix ? `<b style="font-size:17px;color:var(--ok)">${esc(s.libelle)}</b>
          <span class="etiq ok" style="margin-left:9px">confiance ${s.confiance}</span>`
          : '<span class="etiq neutre">aucune commande déclenchée</span>'}
        <p style="color:var(--texte-doux);margin:9px 0 12px">${esc(s.lecture)}</p>
        <div class="defile"><table><thead><tr><th>Cible</th><th>f</th><th>2f</th><th>Total</th></tr></thead><tbody>
          ${s.scores.map(x => `<tr><td>${esc(x.libelle)} (${x.hz} Hz)</td>
            <td class="num">${x.fondamentale}</td><td class="num">${x.harmonique}</td>
            <td class="num" style="color:${x === s.scores[0] ? 'var(--or-clair)' : 'inherit'}">${x.snr}</td></tr>`).join('')}
        </tbody></table></div>
        <p style="color:var(--texte-faible);font-size:12px;margin:9px 0 0">Multiples du bruit de voisinage. Clipia exige la fondamentale <b>et</b> son harmonique : c’est ce qui distingue une vraie réponse visuelle du rythme alpha spontané.</p>
      </div>`;
    } catch (e) { $('#resSsvep').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  });

  $('#goDemo').onclick = async (e) => {
    e.target.disabled = true;
    $('#resDec').innerHTML = '<div class="carte"><span class="tourne"></span> enregistrement des essais, entraînement, puis validation croisée…</div>';
    try {
      const n = Number($('#nbCl').value);
      const profils = n === 2 ? ['detente','concentration'] : ['detente','concentration','tension','somnolence'];
      const r = await api('/api/decodeur/demonstration', { method: 'POST', body: JSON.stringify({ nom: 'ui' + n, profils, parClasse: 20 }) });
      const ev = r.evaluation;
      $('#resDec').innerHTML = `<div class="carte creux" style="border-color:${ev.precision >= .8 ? 'var(--ok)' : ev.precision >= .65 ? 'var(--alerte)' : 'var(--erreur)'}">
        <div class="rang" style="justify-content:space-between">
          <b style="font-size:19px">${(ev.precision * 100).toFixed(0)} %</b>
          <span class="etiq ${ev.precision >= .8 ? 'ok' : ev.precision >= .65 ? 'att' : 'err'}">${esc(ev.verdict)}</span>
        </div>
        <p style="color:var(--texte-doux);margin:9px 0 12px">${esc(ev.lecture)}</p>
        <div class="rang" style="margin-bottom:12px">
          <span class="etiq neutre">${ev.essais} essais testés</span>
          <span class="etiq neutre">hasard ${(ev.hasard * 100).toFixed(0)} %</span>
          <span class="etiq or">kappa ${ev.kappa}</span>
        </div>
        <b style="font-size:13px">Matrice de confusion</b>
        <div class="defile" style="margin-top:7px"><table><thead><tr><th>attendu \\ prédit</th>
          ${profils.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
          ${profils.map(a => `<tr><td><b>${esc(a)}</b></td>${profils.map(b2 =>
            `<td class="num" style="${a === b2 ? 'color:var(--ok);font-weight:650' : 'color:var(--texte-faible)'}">${ev.confusion[a][b2]}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
        <p style="color:var(--or-clair);font-size:12.5px;margin:11px 0 0">${esc(r.suite)}</p>
        <p style="color:var(--alerte);font-size:12px;margin:8px 0 0">${esc(r.avertissement)}</p>
      </div>`;
    } catch (err) { $('#resDec').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(err.message)}</div>`; }
    finally { e.target.disabled = false; }
  };

  $('#goEcoute').onclick = async () => {
    try {
      const r = await api('/api/pensee/ecouter', { method: 'POST', body: JSON.stringify({ port: 5005 }) });
      $('#resEcoute').innerHTML = `<div class="carte creux" style="border-color:var(--info)">
        <span class="etiq info">écoute active sur le port ${r.port}</span>
        <p style="color:var(--texte-doux);font-size:12.5px;margin:8px 0 0">${esc(r.comment || 'Écoute déjà active.')}</p></div>`;
    } catch (e) { $('#resEcoute').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };
  $('#goStop').onclick = async () => {
    await api('/api/pensee/arreter', { method: 'POST', body: '{}' });
    $('#resEcoute').innerHTML = '<span class="etiq neutre">écoute arrêtée</span>';
  };
};


// ═══ UTILITAIRES ══════════════════════════════════════════════════════════
VUES.utilitaires = async (v) => {
  const d = await api('/api/utilitaires');
  const y = d.youtube;

  v.append(el(`
  <h1>Utilitaires</h1>
  <p class="sous">Tout en local, tout gratuit, aucune limite de taille. Tes fichiers ne quittent pas cette machine.</p>

  <div class="carte ${d.outils.outils.ffmpeg.bin ? '' : 'creux'}" style="border-color:${d.outils.outils.ffmpeg.bin ? 'var(--ok)' : 'var(--erreur)'}">
    <div class="rang" style="justify-content:space-between">
      <b>Moteur de conversion</b>
      <span class="etiq ${d.outils.outils.ffmpeg.bin ? 'ok' : 'err'}">${d.outils.outils.ffmpeg.bin ? 'opérationnel' : 'ffmpeg manquant'}</span>
    </div>
    <p style="color:var(--texte-doux);margin:8px 0 0">${esc(d.outils.verdict)}</p>
    ${d.outils.manquants.length ? `<div class="rang" style="margin-top:10px">${d.outils.manquants.map(m =>
      `<span class="etiq neutre">${esc(m)} absent</span>`).join('')}</div>` : ''}
  </div>

  <div class="carte" style="margin-top:14px;border-color:var(--alerte);background:linear-gradient(140deg,rgba(255,184,107,.07),transparent)">
    <b style="color:var(--alerte)">Suno, YouTube : ce que Clipia fait et ne fait pas</b>
    <p style="color:var(--texte-doux);margin:9px 0 0"><b>${esc(y.reponse)}</b> ${esc(y.pourquoi)}</p>
    <p style="color:var(--texte-doux);margin:10px 0 0">${esc(y.tesVideos)}</p>
    <p style="color:var(--texte-doux);margin:10px 0 0">${esc(y.tesMorceaux)}</p>
    <p style="color:var(--texte-faible);font-size:12.5px;margin:10px 0 0">${esc(y.musiqueLibre)}</p>
  </div>

  <h2>Choisir un fichier</h2>
  <div class="carte">
    <div class="depot" id="depU"><div style="font-size:26px;opacity:.5">⇪</div>
      <b>Déposez un fichier</b>
      <span style="font-size:12px;color:var(--texte-faible)">audio, vidéo, image ou PDF</span>
      <input type="file" id="fU" hidden></div>
    <div id="infoU" style="margin-top:13px"></div>
  </div>

  <h2>Les outils</h2>
  ${d.catalogue.map(g => `
    <h3 style="margin:16px 0 9px;font-size:14px;color:var(--or-clair)">${esc(g.groupe)}</h3>
    <div class="grille g2">
      ${g.outils.map(o => `
        <div class="carte creux" data-outil="${o.id}" style="cursor:pointer">
          <b style="font-size:14px">${esc(o.nom)}</b>
          <p style="color:var(--texte-doux);font-size:12.5px;margin:7px 0 0">${esc(o.quoi)}</p>
          <span class="etiq neutre" style="margin-top:9px">${esc(o.entree)}</span>
        </div>`).join('')}
    </div>`).join('')}

  <div id="panneau" style="margin-top:18px"></div>
  <div id="resU" style="margin-top:14px"></div>`));

  let fichier = null;

  const OPTIONS = {
    'convertir-audio': `<label class="champ"><span>Format de sortie</span><select name="format">
        ${Object.entries(d.formatsAudio).map(([k, f]) => `<option value="${k}">${k} — ${esc(f.quoi)}</option>`).join('')}</select></label>`,
    'extraire-audio': `<label class="champ"><span>Format de sortie</span><select name="format">
        ${Object.entries(d.formatsAudio).map(([k, f]) => `<option value="${k}">${k} — ${esc(f.quoi)}</option>`).join('')}</select></label>`,
    'convertir-video': `<label class="champ"><span>Format</span><select name="format">
        ${Object.entries(d.formatsVideo).map(([k, f]) => `<option value="${k}">${k} — ${esc(f.quoi)}</option>`).join('')}</select></label>
      <label class="champ"><span>Largeur en pixels (vide = inchangée)</span><input name="largeur" type="number" placeholder="1280"></label>`,
    'normaliser': `<label class="champ"><span>Plateforme visée</span><select name="cible">
        ${Object.entries(d.cibles).map(([k, c]) => `<option value="${k}">${k} — ${c.lufs} LUFS : ${esc(c.quoi)}</option>`).join('')}</select></label>`,
    'couper-silences': `<label class="champ"><span>Seuil en dB (plus bas = plus tolérant)</span><input name="seuil" type="number" value="-45"></label>
      <label class="champ"><span>Durée minimale du silence, en secondes</span><input name="duree" type="number" step="0.1" value="0.6"></label>`,
    'vitesse': `<label class="champ"><span>Facteur (1 = inchangé, 2 = deux fois plus vite)</span><input name="facteur" type="number" step="0.05" value="1.25"></label>
      <label class="rang" style="cursor:pointer;margin-bottom:12px"><input type="checkbox" name="garderHauteur" checked>
        <span style="font-size:13px">Garder la hauteur des notes</span></label>`,
    'decouper': `<div class="grille g2">
        <label class="champ"><span>Début (secondes)</span><input name="depart" type="number" step="0.1" value="0"></label>
        <label class="champ"><span>Fin (secondes, vide = jusqu’au bout)</span><input name="fin" type="number" step="0.1"></label></div>
      <label class="champ"><span>Fondu (secondes)</span><input name="fondu" type="number" step="0.1" value="0.3"></label>`,
    'etiqueter': `<div class="grille g2">
        <label class="champ"><span>Titre</span><input name="titre"></label>
        <label class="champ"><span>Artiste</span><input name="artiste" value="CLENDAX"></label>
        <label class="champ"><span>Album</span><input name="album"></label>
        <label class="champ"><span>Année</span><input name="annee" type="number" placeholder="2026"></label></div>
      <label class="champ"><span>Genre</span><input name="genre"></label>`,
    'vignette': `<label class="champ"><span>Seconde à capturer</span><input name="seconde" type="number" step="0.5" value="1"></label>
      <label class="champ"><span>Largeur</span><input name="largeur" type="number" value="1280"></label>`,
    'ocr': `<label class="champ"><span>Langue du document</span><select name="langue">
        <option value="fra">français</option><option value="eng">anglais</option>
        <option value="spa">espagnol</option><option value="deu">allemand</option></select></label>`,
    'traduire': `<label class="champ"><span>Texte à traduire</span><textarea name="texte" style="min-height:96px"></textarea></label>
      <div class="grille g2">
        <label class="champ"><span>Vers</span><select name="vers">
          ${Object.entries(d.langues).map(([k, n]) => `<option value="${k}"${k === 'en' ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="champ"><span>Registre</span><select name="registre">
          ${Object.entries(d.registres).map(([k, r]) => `<option value="${k}">${k} — ${esc(r)}</option>`).join('')}</select></label>
      </div>`,
    'transcrire': `<label class="champ"><span>Langue parlée</span><select name="langue">
        <option value="fr">français</option><option value="en">anglais</option>
        <option value="es">espagnol</option><option value="ar">arabe</option></select></label>
      <label class="rang" style="cursor:pointer;margin-bottom:12px"><input type="checkbox" name="sousTitres" checked>
        <span style="font-size:13px">Produire aussi les sous-titres horodatés</span></label>`
  };

  const SANS_FICHIER = new Set(['traduire']);

  $('#depU').onclick = () => $('#fU').click();
  $('#fU').onchange = async () => {
    $('#infoU').innerHTML = '<span class="tourne"></span> lecture du fichier…';
    try {
      const fd = new FormData(); fd.append('f', $('#fU').files[0]);
      const up = await api('/api/televerser', { method: 'POST', body: fd });
      fichier = up.file;
      let info = null;
      try { info = await api('/api/utilitaires/sonder', { method: 'POST', body: JSON.stringify({ chemin: up.file }) }); } catch {}
      $('#infoU').innerHTML = `<div class="carte creux" style="border-color:var(--ok)">
        <b style="color:var(--ok)">${esc($('#fU').files[0].name)}</b>
        ${info ? `<div class="rang" style="margin-top:9px;flex-wrap:wrap">
          <span class="etiq neutre">${info.duree} s</span>
          <span class="etiq neutre">${(info.octets / 1048576).toFixed(1)} Mo</span>
          ${info.debit ? `<span class="etiq neutre">${esc(info.debit)}</span>` : ''}
          ${info.audio ? `<span class="etiq info">${esc(info.audio.codec)} · ${info.audio.canaux} canaux · ${info.audio.echantillonnage} Hz</span>` : ''}
          ${info.video ? `<span class="etiq or">${esc(info.video.codec)} · ${info.video.largeur}×${info.video.hauteur} · ${info.video.images} i/s</span>` : ''}
        </div>` : '<p style="color:var(--texte-faible);font-size:12.5px;margin:7px 0 0">Fichier reçu. Ce n’est pas un média : les outils de document s’appliquent.</p>'}
      </div>`;
    } catch (e) { $('#infoU').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };

  v.querySelectorAll('[data-outil]').forEach(c => c.onclick = () => {
    const id = c.dataset.outil;
    v.querySelectorAll('[data-outil]').forEach(x => x.style.borderColor = '');
    c.style.borderColor = 'var(--or)';
    const nom = c.querySelector('b').textContent;
    const besoin = !SANS_FICHIER.has(id);

    $('#panneau').innerHTML = `<div class="carte" style="border-color:var(--or)">
      <b style="font-size:15px">${esc(nom)}</b>
      ${besoin && !fichier ? '<p style="color:var(--alerte);margin:9px 0 0">Choisissez d’abord un fichier plus haut.</p>' : ''}
      <form id="formU" style="margin-top:12px">${OPTIONS[id] || '<p style="color:var(--texte-faible);font-size:12.5px;margin:0 0 11px">Aucun réglage : Clipia applique les bons paramètres.</p>'}
        <button class="btn or" type="submit"${besoin && !fichier ? ' disabled' : ''}>Lancer</button>
      </form></div>`;
    $('#panneau').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    $('#formU').onsubmit = async (ev) => {
      ev.preventDefault();
      const b = ev.target.querySelector('button');
      b.disabled = true; b.textContent = 'en cours…';
      $('#resU').innerHTML = '<div class="carte"><span class="tourne"></span> traitement…</div>';
      try {
        const corps = { outil: id, ...(besoin ? { chemin: fichier } : {}) };
        for (const el2 of ev.target.elements) {
          if (!el2.name) continue;
          corps[el2.name] = el2.type === 'checkbox' ? el2.checked
            : el2.type === 'number' ? (el2.value === '' ? undefined : Number(el2.value))
            : el2.value || undefined;
        }
        const r = await api('/api/utilitaires/executer', { method: 'POST', body: JSON.stringify(corps) });
        $('#resU').innerHTML = rendu(r, id);
      } catch (err) {
        $('#resU').innerHTML = `<div class="carte" style="border-color:var(--erreur)">
          <b style="color:var(--erreur)">Échec</b>
          <p style="color:var(--texte-doux);margin:8px 0 0">${esc(err.message)}</p></div>`;
      } finally { b.disabled = false; b.textContent = 'Lancer'; }
    };
  });

  function rendu(r, id) {
    // Résultat textuel : traduction, transcription, OCR, texte de PDF.
    if (r.traduction !== undefined) return `<div class="carte" style="border-color:var(--ok)">
      <div class="rang" style="justify-content:space-between">
        <b style="color:var(--ok)">Traduit en ${esc(r.langueCible)}</b>
        <span class="etiq ${r.prive ? 'ok' : 'att'}">${r.prive ? 'resté sur la machine' : 'via un service distant'}</span>
      </div>
      <p style="margin:11px 0;white-space:pre-wrap;font-size:14.5px">${esc(r.traduction)}</p>
      <div class="rang"><button class="btn mini" onclick="navigator.clipboard.writeText(this.closest('.carte').querySelector('p').textContent)">Copier</button>
        <span class="etiq neutre">${esc(r.par)}</span></div>
      <p style="color:var(--texte-faible);font-size:12px;margin:9px 0 0">${esc(r.confidentialite)}</p></div>`;

    if (r.texte !== undefined) return `<div class="carte" style="border-color:var(--ok)">
      <div class="rang" style="justify-content:space-between">
        <b style="color:var(--ok)">${r.mots ? r.mots + ' mots' : r.caracteres + ' caractères'}</b>
        ${r.prive !== undefined ? `<span class="etiq ${r.prive ? 'ok' : 'att'}">${r.prive ? 'resté sur la machine' : 'via un service distant'}</span>` : ''}
      </div>
      <pre style="margin:11px 0;white-space:pre-wrap;font-size:13px;max-height:340px;overflow:auto">${esc(r.texte.slice(0, 6000))}</pre>
      <div class="rang">
        ${r.sousTitres ? `<a class="btn mini" href="${r.sousTitres}" download>Sous-titres .srt</a>` : ''}
        ${r.par ? `<span class="etiq neutre">${esc(r.par)}</span>` : ''}
      </div>
      ${r.lecture ? `<p style="color:var(--texte-faible);font-size:12.5px;margin:9px 0 0">${esc(r.lecture)}</p>` : ''}
      ${r.confidentialite ? `<p style="color:var(--texte-faible);font-size:12px;margin:7px 0 0">${esc(r.confidentialite)}</p>` : ''}</div>`;

    if (r.pages) return `<div class="carte" style="border-color:var(--ok)">
      <b style="color:var(--ok)">${r.nombre} page(s) à ${r.resolution} points par pouce</b>
      <div class="grille g3" style="margin-top:11px">${r.pages.map(p2 =>
        `<a href="${p2.url}" target="_blank"><img src="${p2.url}" style="width:100%;border-radius:8px"></a>`).join('')}</div></div>`;

    // Résultat fichier.
    const image = ['png','jpg','jpeg','gif','webp'].includes(r.ext);
    const video = ['mp4','webm'].includes(r.ext);
    return `<div class="carte" style="border-color:var(--ok)">
      <b style="color:var(--ok)">${esc(r.nom)}</b>
      ${image ? `<img src="${r.url}" style="width:100%;margin-top:11px;border-radius:8px">`
        : video ? `<video src="${r.url}" controls style="width:100%;margin-top:11px;border-radius:8px"></video>`
        : `<audio src="${r.url}" controls style="width:100%;margin-top:11px"></audio>`}
      <div class="rang" style="margin-top:10px;flex-wrap:wrap">
        <a class="btn mini" href="${r.url}" download>Télécharger</a>
        <span class="etiq neutre">${(r.bytes / 1048576).toFixed(2)} Mo</span>
        ${r.detail?.gain ? `<span class="etiq ok">${esc(r.detail.gain)}</span>` : ''}
        ${r.detail?.avant?.lufs !== undefined && r.detail.avant ? `<span class="etiq info">${r.detail.avant.lufs} → ${r.detail.apres?.lufs} LUFS</span>` : ''}
        ${r.detail?.gagne ? `<span class="etiq or">${r.detail.gagne} s retirées</span>` : ''}
      </div>
      ${r.detail?.lecture ? `<p style="color:var(--texte-doux);font-size:12.5px;margin:10px 0 0">${esc(r.detail.lecture)}</p>` : ''}
      ${r.detail?.quoi ? `<p style="color:var(--texte-faible);font-size:12px;margin:7px 0 0">${esc(r.detail.quoi)}</p>` : ''}</div>`;
  }
};


// ═══ CERVEAU ══════════════════════════════════════════════════════════════
VUES.cerveau = async (v) => {
  const [d, mod] = await Promise.all([api('/api/cerveau'), api('/api/cerveau/modele')]);
  const ch = d.charte;

  v.append(el(`
  <h1>Cerveau</h1>
  <p class="sous">${esc(ch.identite.principe)}</p>

  <div class="carte ${mod.aucun ? '' : 'creux'}" style="border-color:${mod.aucun ? 'var(--alerte)' : 'var(--ok)'}">
    <div class="rang" style="justify-content:space-between">
      <b>${mod.aucun ? 'Aucun modèle ne répond' : `Modèle actif : ${esc(mod.label)}`}</b>
      <span class="etiq ${mod.aucun ? 'att' : mod.local ? 'ok' : 'info'}">${mod.aucun ? 'bloqué' : mod.local ? 'local, rien ne sort' : 'service distant'}</span>
    </div>
    <p style="color:var(--texte-doux);margin:8px 0 0">${mod.aucun ? esc(mod.quoi) : `${esc(mod.modele)} — les sept rôles et le cycle peuvent travailler.`}</p>
    ${mod.aucun ? '<div class="rang" style="margin-top:10px"><a class="btn mini" href="#/locales">Télécharger un modèle local</a><a class="btn mini" href="#/gratuit">Créer une clé gratuite</a></div>' : ''}
  </div>

  <div class="grille g3" style="margin-top:14px">
    <div class="carte creux"><b style="font-size:13px">Mémoire associative</b>
      <div style="font-size:23px;font-weight:700;color:var(--or-clair);margin:6px 0">${d.graphe.noeuds}</div>
      <p style="color:var(--texte-faible);font-size:12px;margin:0">${d.graphe.liens} liens · densité ${d.graphe.densite} · ${d.graphe.isoles} isolé(s)</p></div>
    <div class="carte creux"><b style="font-size:13px">Journal</b>
      <div style="font-size:23px;font-weight:700;color:var(--or-clair);margin:6px 0">${d.journal.projets}</div>
      <p style="color:var(--texte-faible);font-size:12px;margin:0">${d.journal.tests.reussis}/${d.journal.tests.total} test(s) prouvé(s) · ${d.journal.erreurs.ouvertes} erreur(s) ouverte(s)</p></div>
    <div class="carte creux"><b style="font-size:13px">Preuves refusées</b>
      <div style="font-size:23px;font-weight:700;color:${d.journal.tests.refuses ? 'var(--alerte)' : 'var(--ok)'};margin:6px 0">${d.journal.tests.refuses}</div>
      <p style="color:var(--texte-faible);font-size:12px;margin:0">réussites déclarées sans preuve, donc rejetées</p></div>
  </div>

  <div class="onglets" style="margin-top:16px">
    <button class="actif" data-c="cycle">Cycle proactif</button>
    <button data-c="memoire">Mémoire associative</button>
    <button data-c="conseil">Les sept rôles</button>
    <button data-c="regles">Les règles</button>
  </div>

  <!-- ── CYCLE ─────────────────────────────────────────── -->
  <div id="c-cycle">
    <div class="carte">
      <p style="color:var(--texte-doux);margin:0 0 12px">Clipia mesure son propre état, repère ce qui mérite d’être fait, consulte ses rôles et rend un rapport en sept sections. Les actions sensibles sont <b>proposées, jamais exécutées</b>.</p>
      <div class="rang">
        <button class="btn or" id="goCycle">Lancer un cycle</button>
        <select id="prof" style="max-width:220px">
          <option value="rapide">Rapide — un rôle</option>
          <option value="normal" selected>Normal — trois rôles</option>
          <option value="complet">Complet — six rôles</option>
        </select>
        <button class="btn mini" id="goDetect">Mesurer seulement</button>
      </div>
      <label class="champ" style="margin-top:11px"><span>Objectif précis (vide = Clipia choisit)</span>
        <input id="objCycle" placeholder="Publier le site avec un nom de domaine"></label>
      <div id="avance" style="margin-top:11px"></div>
    </div>
    <div class="carte creux" style="margin-top:14px">
      <div class="rang" style="justify-content:space-between">
        <b>Ce qu’il a appris en travaillant</b>
        <button class="btn mini" id="goEntretien">Entretenir la mémoire</button>
      </div>
      <div id="appr" style="margin-top:10px"><span class="tourne"></span></div>
    </div>
    <div id="resCycle" style="margin-top:14px"></div>
  </div>

  <!-- ── MÉMOIRE ───────────────────────────────────────── -->
  <div id="c-memoire" hidden>
    <div class="carte">
      <p style="color:var(--texte-doux);margin:0 0 12px">Un graphe, pas des dossiers. L’activation se propage de proche en proche, les liens utilisés se renforcent, les liens oubliés s’affaiblissent. Ce qui remonte ne vient pas d’une recherche par mot-clé mais de la structure.</p>
      <div class="rang">
        <button class="btn or" id="goDecouvre">Découvrir des liens non saisis</button>
        <button class="btn mini" id="goTisse">Tisser par vocabulaire rare</button>
        <button class="btn mini" id="goConso">Consolider</button>
      </div>
      <div id="resMem" style="margin-top:13px"></div>
    </div>
    <div class="carte" style="margin-top:14px">
      <b>Ajouter un souvenir</b>
      <div class="grille g2" style="margin-top:11px">
        <label class="champ"><span>Nature</span><select id="nType">
          ${Object.entries(d.typesNoeud).map(([k, q]) => `<option value="${k}">${k} — ${esc(q)}</option>`).join('')}</select></label>
        <label class="champ"><span>Confiance</span><select id="nConf">
          <option value="hypothese">hypothèse — je raisonne</option>
          <option value="probable">probable — j’ai une source</option>
          <option value="verifie">vérifié — j’ai une preuve</option></select></label>
      </div>
      <label class="champ"><span>Titre</span><input id="nTitre"></label>
      <label class="champ"><span>Détail</span><textarea id="nTexte" style="min-height:62px"></textarea></label>
      <button class="btn or" id="goNoeud">Enregistrer</button>
      <div id="resNoeud" style="margin-top:11px"></div>
    </div>
    <h2>Carte du graphe</h2>
    <div class="carte"><div id="carte" style="min-height:420px"></div></div>
  </div>

  <!-- ── CONSEIL ───────────────────────────────────────── -->
  <div id="c-conseil" hidden>
    <div class="carte">
      <p style="color:var(--texte-doux);margin:0 0 12px">Chaque rôle a une consigne différente et une sortie attendue différente. Un seul avis se contente de lui-même ; plusieurs se contredisent — et la contradiction est le signal utile. Le Coordinateur tranche, sans lisser.</p>
      <label class="champ"><span>Sujet à soumettre au conseil</span>
        <textarea id="sujet" style="min-height:70px">Publier le site Clipia avec un nom de domaine gratuit</textarea></label>
      <div class="rang" style="flex-wrap:wrap;margin-bottom:12px">
        ${Object.entries(ch.roles).map(([k, r]) => `
          <label class="rang" style="margin:0;cursor:pointer;gap:5px">
            <input type="checkbox" class="rSel" value="${k}"${d.sequence.includes(k) ? ' checked' : ''}>
            <span style="font-size:12.5px" title="${esc(r.quoi)}">${esc(r.nom)}</span></label>`).join('')}
      </div>
      <button class="btn or" id="goConseil">Tenir le conseil</button>
      <div id="resConseil" style="margin-top:13px"></div>
    </div>
    <div class="grille g2" style="margin-top:14px">
      ${Object.entries(ch.roles).map(([k, r]) => `
        <div class="carte creux"><b>${esc(r.nom)}</b>
          <p style="color:var(--texte-doux);font-size:12.5px;margin:7px 0 0">${esc(r.quoi)}</p></div>`).join('')}
    </div>
  </div>

  <!-- ── RÈGLES ────────────────────────────────────────── -->
  <div id="c-regles" hidden>
    <div class="carte" style="border-color:var(--or)">
      <b>Les garde-fous, et où le code les applique</b>
      <p style="color:var(--texte-doux);margin:8px 0 0">Une règle qu’on se contente d’écrire dans une consigne n’est pas une règle. Chacune est vérifiée par du code — la troisième colonne dit où.</p>
    </div>
    <div class="liste" style="margin-top:12px">
      ${ch.gardeFous.map(g => `<div style="align-items:start">
        <span class="etiq or" style="min-width:104px">${esc(g.id)}</span>
        <div style="flex:1">
          <b style="font-size:13.5px">${esc(g.regle)}</b>
          <p style="color:var(--texte-faible);font-size:12.5px;margin:5px 0 0">Vérifié par : ${esc(g.verifiePar)}</p>
        </div></div>`).join('')}
    </div>
    <h2>Les trois niveaux de confiance</h2>
    <div class="grille g3">
      ${Object.entries(ch.confiances).map(([k, c]) => `
        <div class="carte creux"><span class="etiq ${k === 'verifie' ? 'ok' : k === 'probable' ? 'info' : 'neutre'}">${esc(k)}</span>
          <p style="color:var(--texte-doux);font-size:12.5px;margin:8px 0 0">${esc(c.quoi)}</p></div>`).join('')}
    </div>
    <h2>Ce qui exige votre accord</h2>
    <div class="carte creux">
      <div class="rang" style="flex-wrap:wrap">${ch.sensible.map(x => `<span class="etiq att">${esc(x)}</span>`).join('')}</div>
      <p style="color:var(--texte-faible);font-size:12.5px;margin:11px 0 0">Le cycle autonome les propose et s’arrête là. Il n’y touche pas, même si personne ne regarde.</p>
    </div>
    <h2>Types de preuve acceptés</h2>
    <div class="liste">
      ${Object.entries(d.typesPreuve).map(([k, q]) => `<div>
        <span class="etiq neutre" style="min-width:86px">${esc(k)}</span>
        <span style="flex:1;font-size:12.5px">${esc(q)}</span></div>`).join('')}
    </div>
    ${d.propositions.length ? `<h2>Modifications proposées</h2>
    <div class="liste">${d.propositions.map(p2 => `<div>
      <span class="etiq ${p2.etat === 'applique' ? 'ok' : p2.etat === 'annule' ? 'neutre' : 'att'}" style="min-width:96px">${esc(p2.etat)}</span>
      <div style="flex:1"><b style="font-size:13px">${esc(p2.fichier)}</b>
        <p style="color:var(--texte-faible);font-size:12px;margin:4px 0 0">${esc(p2.pourquoi)}</p></div></div>`).join('')}</div>` : ''}
  </div>`));

  v.querySelectorAll('.onglets button').forEach(b => b.onclick = () => {
    v.querySelectorAll('.onglets button').forEach(x => x.classList.remove('actif'));
    b.classList.add('actif');
    for (const c of ['cycle','memoire','conseil','regles']) $('#c-' + c).hidden = c !== b.dataset.c;
    if (b.dataset.c === 'memoire') dessiner();
  });

  // ── Ce que l’apprentissage automatique a retenu
  (async () => {
    try {
      const a = await api('/api/cerveau/apprentissage');
      $('#appr').innerHTML = `
        <p style="color:var(--texte-doux);font-size:13px;margin:0 0 10px">${esc(a.quoi)}</p>
        ${a.branche ? `<span class="etiq ok">branché sur la file de travaux</span>` : '<span class="etiq att">non branché</span>'}
        ${a.durees.length ? `<div class="liste" style="margin-top:10px;font-size:12.5px">${a.durees.map(d => `<div>
          <b style="min-width:132px">${esc(d.type)}</b>
          <span style="flex:1">${d.passages} passage(s) · normale ${d.moyenneSecondes} s · record ${d.maxSecondes} s</span></div>`).join('')}</div>
        <p style="color:var(--texte-faible);font-size:12px;margin:9px 0 0">Connaître la durée normale permet de repérer l’anormal : c’est ce qui déclenche une trace. Une réussite ordinaire n’apprend rien et n’est pas retenue.</p>` : ''}`;
    } catch { $('#appr').innerHTML = '<span style="color:var(--texte-faible)">état indisponible</span>'; }
  })();

  $('#goEntretien').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const r = await api('/api/cerveau/entretenir', { method: 'POST', body: '{}' });
      $('#appr').insertAdjacentHTML('afterbegin',
        `<div class="carte creux" style="border-color:var(--ok);margin-bottom:10px"><span class="etiq ok">entretien fait</span>
          <p style="color:var(--texte-doux);font-size:12.5px;margin:8px 0 0">${esc(r.lecture)}</p>
          <p style="color:var(--texte-faible);font-size:12px;margin:6px 0 0">Les preuves ont été rouvertes, les doublons fusionnés, les liens inutilisés affaiblis. C’est un travail de fond, comme le sommeil.</p></div>`);
    } catch (err) { toast(err.message, 'err'); }
    finally { e.target.disabled = false; }
  };

  // ── Cycle, en flux pour voir l’avancement
  $('#goCycle').onclick = async (e) => {
    e.target.disabled = true;
    $('#avance').innerHTML = '<span class="tourne"></span> <span id="avTexte">démarrage…</span>';
    $('#resCycle').innerHTML = '';
    try {
      const r = await fetch(API + '/api/cerveau/cycle', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flux: true, profondeur: $('#prof').value, objectif: $('#objCycle').value || null }) });
      const lecteur = r.body.getReader();
      const dec = new TextDecoder();
      let tampon = '';
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += dec.decode(value, { stream: true });
        const blocs = tampon.split('\n\n'); tampon = blocs.pop();
        for (const b of blocs) {
          const type = (b.match(/^event: (.+)$/m) || [])[1];
          const data = (b.match(/^data: (.+)$/m) || [])[1];
          if (!type || !data) continue;
          const j = JSON.parse(data);
          if (type === 'avancement') $('#avTexte').textContent = `${j.etape}${j.quoi ? ' — ' + j.quoi : ''}${j.fait != null ? ` (${j.fait}/${j.sur})` : ''}`;
          if (type === 'erreur') { $('#avance').innerHTML = ''; $('#resCycle').innerHTML = `<div class="carte" style="border-color:var(--erreur)"><b style="color:var(--erreur)">Cycle interrompu</b><p style="color:var(--texte-doux);margin:8px 0 0">${esc(j.erreur)}</p></div>`; }
          if (type === 'fini') { $('#avance').innerHTML = ''; $('#resCycle').innerHTML = rapport(j); }
        }
      }
    } catch (err) { $('#avance').innerHTML = ''; $('#resCycle').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(err.message)}</div>`; }
    finally { e.target.disabled = false; }
  };

  $('#goDetect').onclick = async () => {
    $('#resCycle').innerHTML = '<div class="carte"><span class="tourne"></span> mesure…</div>';
    try {
      const r = await api('/api/cerveau/detecter');
      $('#resCycle').innerHTML = `<div class="carte">
        <b>${esc(r.lecture)}</b>
        <p style="color:var(--texte-faible);font-size:12px;margin:7px 0 12px">Mesuré sans aucun modèle : chaque ligne porte sa méthode, donc chacune peut servir de preuve.</p>
        <div class="liste" style="font-size:12.5px">${r.faits.map(f => `<div style="align-items:start">
          <span class="etiq ${f.association ? 'or' : 'neutre'}" style="min-width:92px">${f.valeur} ${esc(f.unite)}</span>
          <div style="flex:1"><b>${esc(f.quoi)}</b>
            <p style="color:var(--texte-doux);margin:4px 0 0">${esc(f.lecture)}</p>
            <p style="color:var(--texte-faible);font-size:11.5px;margin:3px 0 0">méthode : ${esc(f.methode)}</p></div></div>`).join('')}</div></div>`;
    } catch (e) { $('#resCycle').innerHTML = `<div class="carte" style="border-color:var(--erreur);color:var(--erreur)">${esc(e.message)}</div>`; }
  };

  function rapport(j) {
    if (j.partiel) return `<div class="carte" style="border-color:var(--alerte)">
      <b style="color:var(--alerte)">Cycle partiel — arrêté après la mesure</b>
      <p style="color:var(--texte-doux);margin:9px 0 12px">${esc(j.pourquoiPartiel)}</p>
      <div class="liste" style="font-size:12.5px">${j.observations.faits.map(f => `<div>
        <span class="etiq neutre" style="min-width:88px">${f.valeur} ${esc(f.unite)}</span>
        <span style="flex:1">${esc(f.lecture)}</span></div>`).join('')}</div></div>`;

    const s = j.sections;
    const bloc = (titre, liste, rendu) => !liste?.length ? '' :
      `<h3 style="margin:16px 0 8px;font-size:14px;color:var(--or-clair)">${titre}</h3>
       <div class="liste" style="font-size:13px">${liste.map(rendu).join('')}</div>`;
    const marque = (c) => `<span class="etiq ${c === 'verifie' ? 'ok' : c === 'probable' ? 'info' : 'neutre'}" style="min-width:78px">${esc(c || 'hypothese')}</span>`;

    return `<div class="carte">
      <div class="rang" style="justify-content:space-between;flex-wrap:wrap">
        <b>Rapport du cycle</b>
        <div class="rang">
          <span class="etiq neutre">${j.secondes} s</span>
          <span class="etiq ${j.local ? 'ok' : 'info'}">${esc(j.par)}</span>
        </div>
      </div>
      <p style="color:var(--texte-faible);font-size:12px;margin:8px 0 0">${esc(j.verification.lecture)} · ${esc(j.memoire.consolidation.lecture)}</p>

      ${s.structure === false ? `<div class="carte creux" style="margin-top:12px;border-color:var(--alerte)">
        <b style="color:var(--alerte)">Structure non obtenue</b>
        <p style="color:var(--texte-doux);font-size:12.5px;margin:7px 0 9px">${esc(s.pourquoi)}</p>
        <pre style="white-space:pre-wrap;font-size:12px;max-height:300px;overflow:auto;margin:0">${esc(String(s.brut || '').slice(0, 4000))}</pre></div>` : `
      ${bloc('Opportunités découvertes', s.opportunites, o => `<div style="align-items:start">${marque(o.confiance)}
        <div style="flex:1"><b>${esc(o.quoi)}</b>${o.pourquoi ? `<p style="color:var(--texte-doux);margin:4px 0 0">${esc(o.pourquoi)}</p>` : ''}
        ${o.abaisse ? `<p style="color:var(--alerte);font-size:11.5px;margin:3px 0 0">${esc(o.abaisse)}</p>` : ''}</div></div>`)}

      ${!s.idees?.length ? '' : `<h3 style="margin:16px 0 8px;font-size:14px;color:var(--or-clair)">Les meilleures idées</h3>
      ${s.idees.map(i => `<div class="carte creux" style="margin-bottom:10px">
        <div class="rang" style="justify-content:space-between;flex-wrap:wrap">
          <b style="font-size:14px">${esc(i.titre)}</b>
          <div class="rang">${Object.entries(i.scores || {}).map(([k, val]) =>
            `<span class="etiq ${val >= 4 ? 'ok' : val >= 3 ? 'info' : 'neutre'}" title="${esc(k)}">${esc(k.slice(0, 4))} ${val}</span>`).join('')}</div>
        </div>
        <div class="liste" style="margin-top:9px;font-size:12.5px">
          ${Object.entries(i.champs || {}).filter(([, val]) => val).map(([k, val]) =>
            `<div><b style="min-width:112px;font-size:12px">${esc(k)}</b><span style="flex:1">${esc(String(val))}</span></div>`).join('')}
        </div></div>`).join('')}`}

      ${bloc('Faisable tout de suite', s.immediat, i => `<div style="align-items:start">
        <span class="etiq ${i.sensible ? 'att' : 'ok'}" style="min-width:104px">${i.sensible ? 'votre accord' : 'autonome'}</span>
        <div style="flex:1"><b>${esc(i.quoi)}</b>${i.pourquoi ? `<p style="color:var(--texte-doux);margin:4px 0 0">${esc(i.pourquoi)}</p>` : ''}</div></div>`)}

      ${bloc('Améliorations pour Clipia', s.ameliorations, a => `<div style="align-items:start">
        <span class="etiq ${a.reversible ? 'ok' : 'att'}" style="min-width:104px">${a.reversible ? 'réversible' : 'à vérifier'}</span>
        <div style="flex:1"><b>${esc(a.quoi)}</b>${a.attendu ? `<p style="color:var(--texte-doux);margin:4px 0 0">Effet attendu : ${esc(a.attendu)}</p>` : ''}</div></div>`)}

      ${bloc('En cours et blocages', s.encours, e2 => `<div style="align-items:start">
        <span class="etiq att" style="min-width:86px">bloqué</span>
        <div style="flex:1"><b>${esc(e2.quoi)}</b><p style="color:var(--texte-doux);margin:4px 0 0">${esc(e2.blocage)}</p></div></div>`)}

      ${bloc('Résultats et preuves', s.resultats, r => `<div style="align-items:start">${marque(r.confiance)}
        <div style="flex:1"><b>${esc(r.quoi)}</b><p style="color:var(--texte-faible);margin:4px 0 0">preuve : ${esc(r.preuve || 'aucune')}</p></div></div>`)}

      ${bloc('Prochaines actions', s.prochaines, p3 => `<div style="align-items:start">
        <span class="etiq or" style="min-width:76px">suivant</span>
        <div style="flex:1"><b>${esc(p3.quoi)}</b>${p3.pourquoi ? `<p style="color:var(--texte-doux);margin:4px 0 0">${esc(p3.pourquoi)}</p>` : ''}</div></div>`)}
      `}

      <div class="carte creux" style="margin-top:14px;border-color:var(--alerte)">
        <p style="margin:0;font-size:12.5px;color:var(--texte-doux)">${esc(j.regle)}</p></div>

      ${j.conseil?.echecs?.length ? `<p style="color:var(--alerte);font-size:12px;margin:10px 0 0">Rôles qui n’ont pas pu travailler : ${j.conseil.echecs.map(e3 => esc(e3.nom)).join(', ')} — dit plutôt que comblé.</p>` : ''}
    </div>`;
  }

  // ── Mémoire
  $('#goDecouvre').onclick = async () => {
    $('#resMem').innerHTML = '<span class="tourne"></span> propagation d’activation…';
    try {
      const r = await api('/api/cerveau/graphe/decouvrir?minimum=0.02&limite=10');
      $('#resMem').innerHTML = !r.liens.length
        ? `<p style="color:var(--texte-faible)">${esc(r.raison || 'Aucun lien indirect pour l’instant. Le graphe se remplit en travaillant.')}</p>`
        : `<p style="color:var(--texte-doux);font-size:12.5px;margin:0 0 10px">Paires fortement rapprochées par des chemins indirects, sans lien direct. Personne ne les a saisies : c’est la structure qui les révèle. Ce sont des pistes, pas des conclusions.</p>
           <div class="liste" style="font-size:12.5px">${r.liens.map(l => `<div style="align-items:start">
             <span class="etiq or" style="min-width:68px">${l.affinite.toFixed(3)}</span>
             <div style="flex:1"><b>${esc(l.deTitre)}</b> ⟷ <b>${esc(l.versTitre)}</b>
               <p style="color:var(--texte-faible);margin:4px 0 0">via ${l.parQuoi.map(esc).join(' → ') || 'un intermédiaire'} · ${l.sauts} sauts</p></div></div>`).join('')}</div>`;
    } catch (e) { $('#resMem').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };
  $('#goTisse').onclick = async () => {
    const r = await api('/api/cerveau/graphe/tisser', { method: 'POST', body: '{}' });
    $('#resMem').innerHTML = `<span class="etiq ${r.crees ? 'ok' : 'neutre'}">${r.crees} lien(s) créé(s) sur ${r.candidats} candidat(s)</span>
      <p style="color:var(--texte-faible);font-size:12px;margin:8px 0 0">Deux souvenirs qui partagent un vocabulaire rare sont probablement liés ; s’ils ne partagent que des mots courants, ils ne le sont pas. D’où la pondération par la rareté.</p>`;
    dessiner();
  };
  $('#goConso').onclick = async () => {
    const r = await api('/api/cerveau/graphe/consolider', { method: 'POST', body: '{}' });
    $('#resMem').innerHTML = `<span class="etiq ok">${esc(r.lecture)}</span>
      <p style="color:var(--texte-faible);font-size:12px;margin:8px 0 0">Sans consolidation le graphe relie tout à tout, ce qui ne vaut pas mieux que de ne rien relier.</p>`;
    dessiner();
  };
  $('#goNoeud').onclick = async () => {
    try {
      await api('/api/cerveau/graphe/noeud', { method: 'POST', body: JSON.stringify({
        type: $('#nType').value, titre: $('#nTitre').value,
        texte: $('#nTexte').value, confiance: $('#nConf').value, source: 'saisie' }) });
      $('#resNoeud').innerHTML = '<span class="etiq ok">enregistré</span>';
      $('#nTitre').value = ''; $('#nTexte').value = '';
      dessiner();
    } catch (e) { $('#resNoeud').innerHTML = `<span style="color:var(--erreur)">${esc(e.message)}</span>`; }
  };

  // ── Carte du graphe : disposition par forces, en SVG
  async function dessiner() {
    const c = $('#carte');
    if (!c) return;
    c.innerHTML = '<span class="tourne"></span> calcul de la disposition…';
    const g = await api('/api/cerveau/graphe/brut');
    const ids = Object.keys(g.noeuds);
    if (!ids.length) { c.innerHTML = '<p style="color:var(--texte-faible)">Le graphe est vide. Il se remplit en travaillant.</p>'; return; }

    const L = 900, H = 440;
    const P = {};
    ids.forEach((id, i) => {
      const a = (i / ids.length) * Math.PI * 2;
      P[id] = { x: L / 2 + Math.cos(a) * 170, y: H / 2 + Math.sin(a) * 150, vx: 0, vy: 0 };
    });
    // Modèle à ressorts : les liens attirent, les nœuds se repoussent.
    for (let pas = 0; pas < 260; pas++) {
      for (const a of ids) for (const b of ids) {
        if (a === b) continue;
        const dx = P[a].x - P[b].x, dy = P[a].y - P[b].y;
        const d2 = Math.max(90, dx * dx + dy * dy);
        const f = 2600 / d2;
        P[a].vx += dx / Math.sqrt(d2) * f; P[a].vy += dy / Math.sqrt(d2) * f;
      }
      for (const l of g.liens) {
        if (!P[l.de] || !P[l.vers]) continue;
        const dx = P[l.vers].x - P[l.de].x, dy = P[l.vers].y - P[l.de].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 130) * 0.012 * l.force;
        P[l.de].vx += dx / d * f; P[l.de].vy += dy / d * f;
        P[l.vers].vx -= dx / d * f; P[l.vers].vy -= dy / d * f;
      }
      for (const id of ids) {
        P[id].x += (P[id].vx *= 0.82); P[id].y += (P[id].vy *= 0.82);
        P[id].x = Math.max(60, Math.min(L - 60, P[id].x));
        P[id].y = Math.max(28, Math.min(H - 28, P[id].y));
      }
    }
    const COUL = { projet:'#c9a0ff', lecon:'#4fe0b0', erreur:'#ff6b6b', objectif:'#ff7ad9',
      outil:'#5ec8ff', concept:'#9aa4c0', fait:'#ffb86b', resultat:'#4fe0b0', opportunite:'#ff7ad9',
      methode:'#5ec8ff', fichier:'#9aa4c0' };
    const degre = {};
    for (const l of g.liens) { degre[l.de] = (degre[l.de] || 0) + 1; degre[l.vers] = (degre[l.vers] || 0) + 1; }

    c.innerHTML = `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto">
      ${g.liens.map(l => P[l.de] && P[l.vers] ? `<line x1="${P[l.de].x.toFixed(1)}" y1="${P[l.de].y.toFixed(1)}"
        x2="${P[l.vers].x.toFixed(1)}" y2="${P[l.vers].y.toFixed(1)}"
        stroke="${l.type === 'lexical' ? '#5ec8ff' : l.type === 'cooccurre' ? '#9aa4c0' : '#c9a0ff'}"
        stroke-width="${(0.5 + l.force * 2.4).toFixed(2)}" opacity="${(0.18 + l.force * 0.5).toFixed(2)}"
        stroke-dasharray="${l.type === 'lexical' || l.type === 'cooccurre' ? '4 3' : ''}"></line>` : '').join('')}
      ${ids.map(id => {
        const n = g.noeuds[id], r = 5 + Math.min(9, (degre[id] || 0) * 1.3);
        return `<g><circle cx="${P[id].x.toFixed(1)}" cy="${P[id].y.toFixed(1)}" r="${r.toFixed(1)}"
          fill="${COUL[n.type] || '#9aa4c0'}" opacity="${n.confiance === 'verifie' ? 1 : n.confiance === 'probable' ? 0.72 : 0.45}"
          stroke="#120a24" stroke-width="1.5"><title>${esc(n.type)} · ${esc(n.titre)} — ${esc(n.confiance)} · ${degre[id] || 0} lien(s)</title></circle>
          <text x="${P[id].x.toFixed(1)}" y="${(P[id].y - r - 5).toFixed(1)}" text-anchor="middle"
            font-size="9.5" fill="#cfd4e4" opacity="0.9">${esc(n.titre.slice(0, 26))}</text></g>`;
      }).join('')}
    </svg>
    <div class="rang" style="margin-top:11px;flex-wrap:wrap">
      ${[...new Set(ids.map(i => g.noeuds[i].type))].map(t =>
        `<span class="etiq neutre"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COUL[t] || '#9aa4c0'}"></span> ${esc(t)}</span>`).join('')}
      <span class="etiq neutre">trait plein = lien saisi · pointillé = lien déduit</span>
      <span class="etiq neutre">opacité = confiance · taille = nombre de liens</span>
    </div>`;
  }

  // ── Conseil
  $('#goConseil').onclick = async (e) => {
    const roles = [...v.querySelectorAll('.rSel:checked')].map(x => x.value);
    if (!roles.length) { $('#resConseil').innerHTML = '<span style="color:var(--alerte)">Choisissez au moins un rôle.</span>'; return; }
    e.target.disabled = true;
    $('#resConseil').innerHTML = `<div class="carte"><span class="tourne"></span> ${roles.length} rôle(s) travaillent, l’un après l’autre…</div>`;
    try {
      const r = await api('/api/cerveau/conseil', { method: 'POST',
        body: JSON.stringify({ sujet: $('#sujet').value, roles }) });
      $('#resConseil').innerHTML = `
        <div class="rang" style="margin-bottom:12px;flex-wrap:wrap">
          <span class="etiq ${r.local ? 'ok' : 'info'}">${esc(r.par)}</span>
          <span class="etiq neutre">${r.avis.length} avis</span>
          ${r.echecs.length ? `<span class="etiq att">${r.echecs.length} rôle(s) empêché(s)</span>` : ''}
        </div>
        <p style="color:var(--texte-doux);font-size:12.5px;margin:0 0 12px">${esc(r.honnetete)} ${esc(r.rappel)}</p>
        ${r.synthese ? `<div class="carte" style="border-color:var(--or);margin-bottom:12px">
          <b style="color:var(--or-clair)">Coordinateur — ce qui est tranché</b>
          <pre style="white-space:pre-wrap;font-size:13px;margin:9px 0 0">${esc(r.synthese.texte)}</pre></div>` : ''}
        ${r.avis.map(a => `<div class="carte creux" style="margin-bottom:10px">
          <div class="rang" style="justify-content:space-between">
            <b>${esc(a.nom)}</b>
            <div class="rang">
              ${a.marques.verifie ? `<span class="etiq ok">${a.marques.verifie} vérifié</span>` : ''}
              ${a.marques.probable ? `<span class="etiq info">${a.marques.probable} probable</span>` : ''}
              ${a.marques.hypothese ? `<span class="etiq neutre">${a.marques.hypothese} hypothèse</span>` : ''}
              ${a.marques.sansSource ? '<span class="etiq att">dit ne pas savoir</span>' : ''}
            </div>
          </div>
          <pre style="white-space:pre-wrap;font-size:12.5px;margin:9px 0 0">${esc(a.texte)}</pre></div>`).join('')}
        ${r.echecs.map(e2 => `<div class="carte creux" style="border-color:var(--alerte)">
          <b style="color:var(--alerte)">${esc(e2.nom)} n’a pas pu travailler</b>
          <p style="color:var(--texte-doux);font-size:12.5px;margin:7px 0 0">${esc(e2.pourquoi)}</p></div>`).join('')}`;
    } catch (err) {
      $('#resConseil').innerHTML = `<div class="carte" style="border-color:var(--erreur)">
        <b style="color:var(--erreur)">Le conseil ne peut pas se tenir</b>
        <p style="color:var(--texte-doux);margin:8px 0 0">${esc(err.message)}</p></div>`;
    } finally { e.target.disabled = false; }
  };
};


// ═══════════════════════════════════════════════════════════════════════════
// ATELIER — projets durables, agents et sous-agents.
// ═══════════════════════════════════════════════════════════════════════════
VUES.atelier = async (v) => {
  const [d, fours] = await Promise.all([api('/api/atelier'), api('/api/fournisseurs')]);
  const llms = fours.filter(f => f.configure && f.id !== 'openclaw' && ['openai', 'anthropic', 'gemini', 'ollama'].includes(f.kind));
  const optsModele = (sel) => '<option value="">⚡ Auto — le meilleur</option>' +
    llms.map(f => `<option value="${esc(f.id)}"${sel === f.id ? ' selected' : ''}>${esc(f.label)}</option>`).join('');
  const nomAgent = (id) => d.agents.find(a => a.id === id)?.nom || '—';
  let onglet = 'projets', courant = new URLSearchParams(location.hash.split('?')[1] || '').get('p') || null, enCours = null;

  const SC = { termine: 'var(--ok)', en_cours: 'var(--or)', en_attente: 'var(--or)', interrompu: 'var(--alerte)', echec: 'var(--alerte)' };
  const SL = { termine: 'terminé', en_cours: 'en cours', en_attente: 'attend ton accord', interrompu: 'interrompu', echec: 'échec' };

  async function flux(url, corps, surEvt, signal) {
    const r = await fetch(API + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps), signal });
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    while (true) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const l = buf.split('\n'); buf = l.pop();
      for (const L of l) if (L.startsWith('data:')) { try { surEvt(JSON.parse(L.slice(5))); } catch {} }
    }
  }

  function rendre() {
    v.innerHTML = '';
    v.append(el(`
    <h1>Projets & agents</h1>
    <p class="sous">Tes projets restent enregistrés. Chaque agent a un rôle ; il peut confier une sous-tâche à un autre agent (jusqu'à ${d.limites.profondeur} niveaux, ${d.limites.delegations} délégations par exécution). Aucun agent n'a accès à ta machine ni à ton navigateur tant que tu ne l'as pas coché.</p>
    <div class="rang" style="margin-bottom:16px">
      <button class="btn${onglet === 'projets' ? ' or' : ''}" data-o="projets">Projets (${d.projets.length})</button>
      <button class="btn${onglet === 'agents' ? ' or' : ''}" data-o="agents">Agents (${d.agents.length})</button>
      <button class="btn${onglet === 'histo' ? ' or' : ''}" data-o="histo">Historique</button>
    </div><div id="at-corps"></div>`));
    v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { onglet = b.dataset.o; courant = null; rendre(); });
    if (onglet === 'projets') courant ? vueProjet() : listeProjets();
    else if (onglet === 'agents') vueAgents();
    else vueHisto();
  }
  const corps = () => $('#at-corps');

  /* ── liste des projets ─────────────────────────────────────────────────── */
  function listeProjets() {
    corps().append(el(`
    <div class="carte" style="margin-bottom:14px">
      <h2 style="margin-top:0">Nouveau projet</h2>
      <div class="rang" style="flex-wrap:wrap"><input id="at-pn" placeholder="Nom du projet" style="max-width:260px">
      <input id="at-po" placeholder="Objectif en une phrase" style="flex:1;min-width:240px"><button class="btn or" id="at-pc">Créer</button></div>
    </div>
    <div id="at-liste" class="grille g2"></div>`));
    $('#at-pc').onclick = async () => {
      try { const p = await api('/api/atelier/projets', { method: 'POST', body: JSON.stringify({ nom: $('#at-pn').value, objectif: $('#at-po').value }) });
        d.projets.unshift(p); courant = p.id; rendre(); } catch (e) { toast(e.message, 'err'); }
    };
    $('#at-liste').innerHTML = d.projets.map(p => {
      const faits = p.taches.filter(t => t.statut === 'fait').length;
      return `<div class="carte" data-p="${p.id}" style="cursor:pointer"><div class="rang" style="justify-content:space-between"><b>${esc(p.nom)}</b><span class="etiq neutre">${esc(p.statut)}</span></div>
        <p style="color:var(--texte-doux);font-size:13px;margin:8px 0">${esc(p.objectif || 'Pas d\'objectif noté')}</p>
        <div style="font-size:12px;color:var(--texte-faible)">${faits}/${p.taches.length} tâches · ${p.journal.length} actions enregistrées</div></div>`;
    }).join('') || '<div class="vide">Aucun projet pour l\'instant : crée le premier ci-dessus.</div>';
    corps().querySelectorAll('[data-p]').forEach(c => c.onclick = () => { courant = c.dataset.p; rendre(); });
  }

  /* ── un projet ─────────────────────────────────────────────────────────── */
  async function vueProjet() {
    const { projet: p, executions } = await api('/api/atelier/projets/' + courant);
    corps().append(el(`
    <button class="btn mini" id="at-retour">← Tous les projets</button>
    <div class="carte" style="margin:12px 0">
      <div class="rang" style="justify-content:space-between;flex-wrap:wrap"><h2 style="margin:0">${esc(p.nom)}</h2>
        <select id="at-st" style="width:auto">${['actif', 'termine', 'archive'].map(s => `<option${s === p.statut ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
      <textarea id="at-ob" style="min-height:60px;margin-top:10px" placeholder="Objectif">${esc(p.objectif)}</textarea>
      <div style="font-size:12px;color:var(--texte-faible);margin-top:6px">Fichiers dans le dossier « ${esc(p.dossier)} » · <a href="#/agent">les ouvrir</a></div>
    </div>
    <div class="grille g2">
      <div class="carte"><h2 style="margin-top:0">Tâches</h2><div id="at-tch"></div>
        <div class="rang" style="margin-top:10px"><input id="at-nt" placeholder="Nouvelle tâche"><button class="btn mini" id="at-at">Ajouter</button></div></div>
      <div class="carte"><h2 style="margin-top:0">Notes</h2><div id="at-nts" style="font-size:13px;max-height:200px;overflow:auto"></div>
        <div class="rang" style="margin-top:10px"><input id="at-nn" placeholder="Une décision, une idée…"><button class="btn mini" id="at-an">Noter</button></div></div>
    </div>
    <div class="carte" style="margin-top:14px"><h2 style="margin-top:0">Lancer un agent</h2>
      <div class="rang" style="flex-wrap:wrap;margin-bottom:8px">
        <select id="at-ag" style="width:auto">${d.agents.map(a => `<option value="${a.id}"${a.id === 'agt_chef' ? ' selected' : ''}>${esc(a.nom)}</option>`).join('')}</select>
        <select id="at-mo" style="width:auto">${optsModele('')}</select></div>
      <textarea id="at-ta" style="min-height:70px" placeholder="Ce que tu lui demandes (il connaît l'objectif, les tâches et les notes du projet)"></textarea>
      <div class="rang" style="margin-top:8px"><button class="btn or" id="at-go">Lancer</button><button class="btn" id="at-stop" hidden>Arrêter</button></div>
      <div id="at-log" style="margin-top:12px;font-size:12.5px;display:grid;gap:3px;color:var(--texte-faible)"></div>
      <div id="at-res" style="margin-top:10px;white-space:pre-wrap"></div></div>
    <div class="carte" style="margin-top:14px"><h2 style="margin-top:0">Exécutions</h2><div id="at-ex"></div></div>`));

    $('#at-retour').onclick = () => { courant = null; rendre(); };
    $('#at-st').onchange = async () => { await api('/api/atelier/projets/' + p.id, { method: 'POST', body: JSON.stringify({ statut: $('#at-st').value }) }); toast('Statut mis à jour', 'ok'); };
    $('#at-ob').onchange = async () => { await api('/api/atelier/projets/' + p.id, { method: 'POST', body: JSON.stringify({ objectif: $('#at-ob').value }) }); toast('Objectif enregistré', 'ok'); };
    const dessiner = () => {
      $('#at-tch').innerHTML = p.taches.map(t => `<div class="rang" style="justify-content:space-between;gap:8px;margin:5px 0"><span style="${t.statut === 'fait' ? 'text-decoration:line-through;opacity:.7' : ''}">${esc(t.titre)}</span>
        <select data-t="${t.id}" style="width:auto;font-size:12px">${['a_faire', 'en_cours', 'fait', 'bloque'].map(s => `<option value="${s}"${s === t.statut ? ' selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}</select></div>`).join('') || '<i style="color:var(--texte-faible)">Aucune tâche.</i>';
      $('#at-tch').querySelectorAll('[data-t]').forEach(s => s.onchange = async () => {
        const t = await api(`/api/atelier/projets/${p.id}/taches/${s.dataset.t}`, { method: 'POST', body: JSON.stringify({ statut: s.value }) });
        Object.assign(p.taches.find(x => x.id === t.id), t); dessiner();
      });
      $('#at-nts').innerHTML = p.notes.slice().reverse().map(n => `<div style="margin:5px 0"><span style="color:var(--texte-faible)">${esc(n.quand.slice(0, 10))}</span> ${esc(n.texte)}</div>`).join('') || '<i style="color:var(--texte-faible)">Aucune note.</i>';
    };
    dessiner();
    $('#at-at').onclick = async () => { const t = $('#at-nt').value.trim(); if (!t) return;
      p.taches.push(await api(`/api/atelier/projets/${p.id}/taches`, { method: 'POST', body: JSON.stringify({ titre: t }) })); $('#at-nt').value = ''; dessiner(); };
    $('#at-an').onclick = async () => { const t = $('#at-nn').value.trim(); if (!t) return;
      p.notes.push(await api(`/api/atelier/projets/${p.id}/notes`, { method: 'POST', body: JSON.stringify({ texte: t }) })); $('#at-nn').value = ''; dessiner(); };

    const exList = () => {
      $('#at-ex').innerHTML = executions.map(e => `<div class="rang" style="justify-content:space-between;gap:10px;margin:6px 0;font-size:13px">
        <span><b>${esc(e.agentNom)}</b>${e.profondeur ? ' <i>(sous-agent)</i>' : ''} — ${esc(String(e.tache).slice(0, 90))}</span>
        <span><span style="color:${SC[e.statut] || 'inherit'}">${SL[e.statut] || e.statut}</span>
        ${['interrompu', 'echec'].includes(e.statut) ? `<button class="btn mini" data-r="${e.id}">Reprendre</button>` : ''}
        ${e.statut === 'en_attente' ? `<button class="btn or mini" data-a="${e.id}">Autoriser et reprendre</button>` : ''}</span></div>`).join('') || '<i style="color:var(--texte-faible)">Rien pour l\'instant.</i>';
      $('#at-ex').querySelectorAll('[data-r]').forEach(b => b.onclick = () => lancerFlux('/api/atelier/reprendre', { execId: b.dataset.r }));
      $('#at-ex').querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
        const e = executions.find(x => x.id === b.dataset.a);
        try { const a = await api('/api/noyau/accord', { method: 'POST', headers: { 'x-clipia-accord': '1' }, body: JSON.stringify({ commande: e.attente.commande, categorie: e.attente.categorie }) });
          lancerFlux('/api/atelier/reprendre', { execId: e.id, accord: a.accord }); } catch (er) { toast(er.message, 'err'); }
      });
    };
    exList();

    async function lancerFlux(url, b) {
      if (enCours) return toast('Une exécution est déjà en cours ici.', 'err');
      const ctl = new AbortController(); enCours = ctl;
      $('#at-go').disabled = true; $('#at-stop').hidden = false; $('#at-log').innerHTML = ''; $('#at-res').textContent = '';
      $('#at-stop').onclick = () => ctl.abort();
      const lignes = {};
      try {
        await flux(url, b, (e) => {
          const pre = e.agent && e.agent !== $('#at-ag').selectedOptions[0]?.textContent ? `↳ ${e.agent} · ` : '';
          if (e.type === 'outil') { const dv = el(`<div>${esc(pre)}⚙ ${esc(String(e.outil).replace(/_/g, ' '))}${e.parametres ? ' — ' + esc(e.parametres) : ''}</div>`); lignes[(e.execId || '') + e.outil] = dv; $('#at-log').append(dv); }
          if (e.type === 'resultat') { const dv = lignes[(e.execId || '') + e.outil]; if (dv) { dv.style.color = e.ok ? 'var(--ok)' : 'var(--alerte)'; dv.textContent = (e.ok ? '✓ ' : '✗ ') + dv.textContent.slice(2); } }
          if (e.type === 'effet' && e.genre === 'media' && e.url) $('#at-log').append(mediaAtelier(/^\//.test(e.url) ? API + e.url : e.url));
          if (e.type === 'erreur') $('#at-res').textContent = '⚠ ' + e.message;
          if (e.type === 'termine') {
            $('#at-res').textContent = (e.statut === 'en_attente' ? '⏸ Cette action attend ton accord — utilise « Autoriser et reprendre » dans la liste des exécutions.\n\n' : '') + (e.texte || '');
          }
        }, ctl.signal);
      } catch (e) { if (e.name !== 'AbortError') $('#at-res').textContent = '⚠ ' + e.message; else $('#at-res').textContent = 'Arrêté.'; }
      enCours = null; $('#at-go').disabled = false; $('#at-stop').hidden = true;
      const f = await api('/api/atelier/projets/' + p.id); Object.assign(p, f.projet); executions.splice(0, executions.length, ...f.executions); dessiner(); exList();
    }
    $('#at-go').onclick = () => {
      const t = $('#at-ta').value.trim(); if (!t) return toast('Écris ce que tu demandes.', 'err');
      lancerFlux('/api/atelier/lancer', { agentId: $('#at-ag').value, projetId: p.id, tache: t, provider: $('#at-mo').value || undefined });
    };
  }
  function mediaAtelier(url) {
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return el(`<img src="${esc(url)}" alt="" style="max-width:min(100%,320px);border-radius:10px">`);
    if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) return el(`<audio controls src="${esc(url)}" style="max-width:100%"></audio>`);
    if (/\.(mp4|webm)(\?|$)/i.test(url)) return el(`<video controls src="${esc(url)}" style="max-width:min(100%,380px);border-radius:10px"></video>`);
    return el(`<a href="${esc(url)}" target="_blank" rel="noopener">Ouvrir le résultat</a>`);
  }

  /* ── agents ────────────────────────────────────────────────────────────── */
  function vueAgents() {
    corps().append(el(`
    <div class="carte" style="margin-bottom:14px"><h2 style="margin-top:0">Créer un agent</h2>
      <div class="rang" style="flex-wrap:wrap;margin-bottom:8px"><input id="ag-n" placeholder="Nom (ex. Tatoueur)" style="max-width:220px">
        <select id="ag-m" style="width:auto">${optsModele('')}</select>
        <select id="ag-p" style="width:auto"><option value="">Agent principal</option>${d.agents.map(a => `<option value="${a.id}">Sous-agent de : ${esc(a.nom)}</option>`).join('')}</select></div>
      <textarea id="ag-r" style="min-height:80px" placeholder="Son rôle : ce qu'il fait, comment, avec quel style"></textarea>
      <div id="ag-g" class="rang" style="flex-wrap:wrap;margin:10px 0;gap:6px 16px"></div>
      <p id="ag-av" style="font-size:12px;color:var(--alerte);margin:0 0 10px" hidden>⚠ Machine et navigateur : l'agent pourra lire, écrire et lancer des commandes dans les zones autorisées. Les actions sensibles te demandent toujours ton accord, et un sous-agent ne peut jamais l'obtenir.</p>
      <button class="btn or" id="ag-c">Créer l'agent</button></div>
    <div id="ag-liste" class="grille g2"></div>`));
    $('#ag-g').innerHTML = Object.entries(d.groupes).map(([g, q]) =>
      `<label style="font-size:12.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" value="${esc(g)}"${['machine', 'navigateur', 'agent'].includes(g) ? '' : ' checked'}><span><b>${esc(g)}</b> — ${esc(q)}</span></label>`).join('');
    $('#ag-g').onchange = () => { $('#ag-av').hidden = ![...$('#ag-g').querySelectorAll('input:checked')].some(i => ['machine', 'navigateur'].includes(i.value)); };
    $('#ag-c').onclick = async () => {
      try {
        const a = await api('/api/atelier/agents', { method: 'POST', body: JSON.stringify({ nom: $('#ag-n').value, role: $('#ag-r').value,
          groupes: [...$('#ag-g').querySelectorAll('input:checked')].map(i => i.value),
          modele: $('#ag-m').value ? { provider: $('#ag-m').value } : null, parentId: $('#ag-p').value || null }) });
        d.agents.push(a); toast('Agent créé', 'ok'); rendre();
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#ag-liste').innerHTML = d.agents.map(a => `<div class="carte"><div class="rang" style="justify-content:space-between"><b>${esc(a.nom)}</b>
        ${a.integre ? '<span class="etiq neutre">intégré</span>' : `<button class="btn mini" data-x="${a.id}">Supprimer</button>`}</div>
      <p style="color:var(--texte-doux);font-size:12.5px;margin:8px 0">${esc((a.role || '').slice(0, 220))}</p>
      <div style="font-size:11.5px;color:var(--texte-faible)">Outils : ${a.groupes.map(esc).join(', ')}${a.modele ? ' · moteur : ' + esc(a.modele.provider) : ' · moteur : auto'}${a.parentId ? ' · sous-agent de ' + esc(nomAgent(a.parentId)) : ''}</div></div>`).join('');
    $('#ag-liste').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      await api('/api/atelier/agents/' + b.dataset.x, { method: 'DELETE' }); d.agents = d.agents.filter(a => a.id !== b.dataset.x); rendre();
    });
  }

  function vueHisto() {
    corps().append(el(`<div class="carte">${d.executions.map(e => `<div style="margin:8px 0;font-size:13px"><b>${esc(e.agentNom)}</b> — ${esc(String(e.tache).slice(0, 120))}
      <span style="color:${SC[e.statut] || 'inherit'}">· ${SL[e.statut] || e.statut}</span>
      <div style="color:var(--texte-faible);font-size:12px">${esc((e.debut || '').replace('T', ' ').slice(0, 16))} · ${(e.preuves || []).filter(x => x.ok).length} action(s) vérifiée(s)</div></div>`).join('') || '<div class="vide">Aucune exécution pour l\'instant.</div>'}</div>`));
  }
  rendre();
};

// ── Démarrage ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
VUES.autonome = async (v) => {
  v.append(el(`<h1>🧠 Agent autonome</h1>
    <p class="sous">Donne un objectif. Clipia réfléchit d'abord, fait un plan, exécute chaque étape, <b>vérifie</b> son travail sur preuves, se corrige, puis te rend un résultat honnête. Un plan réussi peut devenir un <b>workflow</b> à rejouer.</p>
    <div class="carte" style="display:grid;gap:10px"><textarea id="aob" rows="3" placeholder="Ex. : Crée un mini-site pour mon tatouage avec une page tarifs et un formulaire de contact" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--bordure,#3a2f80);background:var(--carte,#1b1445);color:var(--texte,#e8e6ff)"></textarea>
    <div class="rang"><button class="btn or" id="ago">Lancer l'agent</button><button class="btn" id="astop" style="display:none">Arrêter</button></div></div>
    <div id="alive" style="margin:16px 0;display:grid;gap:8px"></div>
    <h2>Mes workflows</h2><div id="awf" style="display:grid;gap:10px"></div>`));
  const live = $('#alive', v), wfz = $('#awf', v), ob = $('#aob', v);
  let ctl = null, dernierPlan = null, dernierObj = '';
  const ligne = (ic, html) => { const d = el(`<div class="carte" style="padding:10px 14px">${ic} ${html}</div>`); live.append(d); d.scrollIntoView({ block: 'nearest' }); return d; };
  const charger = async () => {
    const d = await api('/api/autonome').catch(() => ({ workflows: [] }));
    wfz.innerHTML = '';
    if (!d.workflows?.length) wfz.append(el('<div class="vide">Aucun workflow enregistré. Réussis un objectif, puis enregistre son plan.</div>'));
    for (const w of d.workflows || []) {
      const c = el(`<div class="carte" style="display:grid;gap:6px"><b>${esc(w.nom)}</b><span style="color:var(--texte-doux);font-size:13px">${w.etapes.map((e, i) => (i + 1) + '. ' + esc(e.titre)).join(' · ')} — lancé ${w.lancements || 0}×</span><div class="rang"><button class="btn or mini">▶ Rejouer</button><button class="btn mini">Supprimer</button></div></div>`);
      const [b1, b2] = c.querySelectorAll('button');
      b1.onclick = () => lancer({ workflowId: w.id });
      b2.onclick = async () => { await api('/api/autonome/workflows/' + w.id, { method: 'DELETE' }); charger(); };
      wfz.append(c);
    }
  };
  async function lancer(corps) {
    live.innerHTML = ''; ctl = new AbortController();
    $('#ago', v).disabled = true; $('#astop', v).style.display = '';
    dernierObj = corps.objectif || '';
    try {
      const r = await fetch(API + '/api/autonome', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps), signal: ctl.signal });
      const rd = r.body.getReader(), dec = new TextDecoder(); let tampon = '';
      while (true) {
        const { value, done } = await rd.read(); if (done) break;
        tampon += dec.decode(value, { stream: true });
        let k; while ((k = tampon.indexOf('\n\n')) >= 0) {
          const brut = tampon.slice(0, k); tampon = tampon.slice(k + 2);
          if (!brut.startsWith('data: ')) continue;
          let e; try { e = JSON.parse(brut.slice(6)); } catch { continue; }
          if (e.type === 'phase') ligne('💭', esc(e.texte));
          else if (e.type === 'plan') { dernierPlan = e; ligne('🗺️', `<b>${esc(e.comprehension || 'Plan')}</b><ol style="margin:6px 0 0 18px">${e.etapes.map(x => `<li>${esc(x.titre)} <span style="color:var(--texte-doux)">→ ${esc(x.attendu || '')}</span></li>`).join('')}</ol>`); }
          else if (e.type === 'etape') ligne('⚙️', `Étape ${e.index + 1}/${e.total} : <b>${esc(e.titre)}</b>${e.essai > 1 ? ' (nouvel essai)' : ''}`);
          else if (e.type === 'verifier') ligne('🔎', 'Je vérifie le résultat…');
          else if (e.type === 'verdict') ligne(e.ok ? '✅' : '↩️', esc(e.raison || (e.ok ? 'Validé' : 'À reprendre')));
          else if (e.type === 'question') ligne('❓', 'J\'ai besoin d\'une précision :<ul>' + e.questions.map(q => '<li>' + esc(q) + '</li>').join('') + '</ul>Réponds en complétant ton objectif, puis relance.');
          else if (e.type === 'attente') ligne('✋', 'Une action sensible attend ton accord : ' + esc(e.attente?.resume || e.attente?.outil || ''));
          else if (e.type === 'erreur') ligne('⚠️', esc(e.message));
          else if (e.type === 'termine' && e.texte) {
            const f = ligne(e.statut === 'termine' ? '🎉' : '⚠️', `<div style="white-space:pre-wrap">${esc(e.texte)}</div>`);
            if (e.peutEtreWorkflow && dernierPlan) {
              const b = el('<button class="btn or mini" style="margin-top:8px">💾 Enregistrer comme workflow</button>');
              b.onclick = async () => { const nom = prompt('Nom du workflow :', dernierObj.slice(0, 40)); if (!nom) return; await api('/api/autonome/workflows', { method: 'POST', body: JSON.stringify({ nom, objectif: dernierPlan.comprehension, etapes: dernierPlan.etapes }) }); b.remove(); charger(); };
              f.append(b);
            }
          }
        }
      }
    } catch (e) { if (e.name !== 'AbortError') ligne('⚠️', esc(e.message)); else ligne('⏹', 'Arrêté.'); }
    $('#ago', v).disabled = false; $('#astop', v).style.display = 'none'; charger();
  }
  $('#ago', v).onclick = () => { const o = ob.value.trim(); if (o) lancer({ objectif: o }); };
  $('#astop', v).onclick = () => ctl?.abort();
  charger();
};

VUES.boite = async (v) => {
  let cat = 'tous', q = '';
  v.append(el(`<h1>Boîte à outils de création</h1>
    <p class="sous">Les meilleurs outils, gratuits ou ouverts en priorité, pour créer de la musique, des films, des applications, des agents… Clique sur « Me guider » : Clipia te propose des solutions et t'accompagne pas à pas.</p>
    <div class="rang" style="margin-bottom:12px"><input id="bq" placeholder="Chercher un outil (musique, vidéo, site…)" style="flex:1;min-width:220px;padding:10px 14px;border-radius:10px;border:1px solid var(--bordure,#3a2f80);background:var(--carte,#1b1445);color:var(--texte,#e8e6ff)"></div>
    <div class="rang" id="bcats" style="margin-bottom:16px;flex-wrap:wrap"></div><div id="bgrille" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px"></div>`));
  const cats = $('#bcats', v), grille = $('#bgrille', v);
  const dessiner = () => {
    cats.innerHTML = '';
    for (const c of [{ id: 'tous', nom: 'Tout', ic: '✦' }, ...CATEGORIES]) {
      const b = el(`<button class="btn mini${cat === c.id ? ' or' : ''}">${c.ic} ${esc(c.nom)}</button>`);
      b.onclick = () => { cat = c.id; dessiner(); }; cats.append(b);
    }
    grille.innerHTML = '';
    const t = q.toLowerCase();
    const liste = OUTILS.filter(o => (cat === 'tous' || o.c === cat) && (!t || (o.n + ' ' + o.d).toLowerCase().includes(t)));
    if (!liste.length) grille.append(el('<div class="vide">Aucun outil ne correspond.</div>'));
    for (const o of liste) {
      const carte = el(`<div class="carte" style="display:grid;gap:8px;align-content:start">
        <div class="rang" style="justify-content:space-between"><b>${esc(o.n)}</b><span style="font-size:11.5px;padding:2px 8px;border-radius:99px;background:rgba(124,58,237,.25)">${esc(LIC[o.lic])}</span></div>
        <div style="color:var(--texte-doux);font-size:13.5px">${esc(o.d)}</div>
        <div class="rang"><a class="btn mini" href="${esc(o.u)}" target="_blank" rel="noopener">Ouvrir le site</a><button class="btn or mini">Me guider</button></div></div>`);
      carte.querySelector('button').onclick = () => {
        try { sessionStorage.setItem('clipia:amorce', `Je veux utiliser ${o.n} (${o.d}) pour créer quelque chose. Propose-moi d'abord 2 ou 3 solutions adaptées à mon cas, en commençant par les gratuites ou open source, puis guide-moi pas à pas pour télécharger, installer et démarrer.`); } catch {}
        location.hash = '#/clipia?n=' + Date.now();
      };
      grille.append(carte);
    }
  };
  $('#bq', v).oninput = (e) => { q = e.target.value; dessiner(); };
  dessiner();
};

installerV4({ $, el, esc, api, API, VUES, route, toast, MENU });
installerV5({ $, el, esc, api, API, VUES, toast });
installerV6({ $, el, esc, api, API, VUES, toast });
installerWidgets({ $, el, esc, api });
installerV61({ $, el, esc, api, API, VUES, toast });
installerRecherche({ $, el, esc, api });
installerLivrables({ $, el, esc, API, toast });
installerPsy({ $, el, esc, api, VUES, toast });
installerCredit({ $, el, esc, api, toast });
installerExtensions({ $, el, esc, api, VUES, toast });
installerStudio({ $, el, esc, api, API, VUES, toast });
installerDepannage({ $, el, esc, api, API, VUES, toast });
installerLogitheque({ $, el, esc, api, API, VUES, toast });
installerOpenClaw({ $, el, esc, api, API, VUES, toast });
installerTelephone({ $, el, esc, api, API, VUES, toast });
installerPromotion({ $, el, esc, api, API, VUES, toast });
installerTravaux({ $, el, esc, api, API, VUES, toast });
installerCommunaute({ $, el, esc, api, API, VUES, toast });
installerPouvoirs({ $, el, esc, api, VUES, toast });
installerEntreprise({ $, el, esc, api, API, VUES, toast });
installerAccueil({ $, el, esc, api, API, VUES, toast });
installerDictee({ $, el, toast });
buildNav();
window.addEventListener('hashchange', route);
$('#menu').onclick = () => $('#nav').classList.toggle('ouvert');
if (innerWidth < 860) $('#menu').style.display = '';
route();
api('/api/etat').then(e => {
  $('#plan').textContent = e.plan.label;
  $('#plan').className = 'etiq ' + (e.plan.price ? 'or' : 'neutre');
}).catch(() => { $('#sante').textContent = 'serveur injoignable'; $('#sante').className = 'etiq err'; });
// Service worker : on purge d'abord tout cache hérité d'une version précédente,
// puis on réenregistre. Sans cela, une ancienne interface resterait servie.
setTimeout(preparationAutomatique, 1400);

if ('serviceWorker' in navigator) {
  (async () => {
    try {
      const noms = await caches.keys();
      await Promise.all(noms.filter(n => n !== 'clipia-v3').map(n => caches.delete(n)));
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) if (!r.active?.scriptURL.endsWith('/sw.js')) await r.unregister();
      await navigator.serviceWorker.register('/sw.js?v=3');
    } catch {}
  })();
}


/* ── Correcteur d'orthographe : toutes les zones de saisie, en français ───── */
(function correcteur() {
  const regler = (n) => {
    if (!n || n.nodeType !== 1) return;
    const liste = n.matches?.('textarea, input[type=text], input:not([type])') ? [n] : [];
    n.querySelectorAll?.('textarea, input[type=text], input:not([type])').forEach(x => liste.push(x));
    for (const x of liste) { x.spellcheck = true; if (!x.lang) x.lang = 'fr'; x.setAttribute('autocorrect', 'on'); }
  };
  regler(document.body);
  new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(regler))).observe(document.body, { childList: true, subtree: true });
})();

