/** CLIPIA X7 — « Résoudre un problème » : une erreur (texte ou capture d'écran) → cause, étapes, ce qu'il faut réinstaller.
 *  D'abord des règles sûres (instantanées, hors ligne), puis un cerveau (avec vision pour les captures) pour les cas inconnus. */
import { chat } from '../providers/gateway.js';
import { chaine } from './demarrage.js';

const A = {
  ffmpeg: { type: 'ffmpeg', label: '⚡ Installer ffmpeg pour moi' },
  guidee: { type: 'lien', label: '🛠 Ouvrir « Installation guidée »', lien: '#/installation' },
  cerveau: { type: 'lien', label: '🧠 Ouvrir « Cerveau pas à pas »', lien: '#/cerveau-etapes' },
  cles: { type: 'lien', label: '🔑 Ouvrir « Skills & extensions » (clés)', lien: '#/extensions' },
  connexions: { type: 'lien', label: '🔌 Ouvrir « Connexions »', lien: '#/connexions' }
};
export const REGLES = [
  { id: 'ffmpeg', re: /ffmpeg|ffprobe|spawn .*ENOENT/i, titre: 'ffmpeg est introuvable', cause: 'ffmpeg est le moteur qui monte les vidéos et fabrique les sons. Il n\'est pas installé (ou pas trouvé) sur cet ordinateur.',
    etapes: ['Clique sur « Installer ffmpeg pour moi » ci-dessous (téléchargement automatique).', 'Si ça échoue : installe-le à la main (Windows : winget install ffmpeg ; Mac : brew install ffmpeg ; Linux : sudo apt install ffmpeg).', 'Ferme puis rouvre Clipia, et relance ta demande.'], reinstaller: 'ffmpeg', actions: [A.ffmpeg, A.guidee] },
  { id: 'ollama', re: /11434|ollama/i, titre: 'Ollama ne répond pas', cause: 'Le moteur local Ollama n\'est pas lancé ou n\'est pas installé.',
    etapes: ['Ouvre l\'application Ollama (ou dans un terminal : ollama serve).', 'Vérifie qu\'un modèle est téléchargé : ollama pull gemma3', 'Reviens dans Clipia et choisis « Auto — meilleur cerveau ».'], reinstaller: 'Ollama (ollama.com)', actions: [A.guidee, A.cerveau] },
  { id: 'lmstudio', re: /:1234|lm ?studio/i, titre: 'LM Studio ne répond pas', cause: 'Le serveur local de LM Studio est éteint.',
    etapes: ['Ouvre LM Studio → onglet « Developer » → « Start Server ».', 'Charge un modèle dans LM Studio.', 'Relance ta demande dans Clipia.'], reinstaller: 'rien à réinstaller', actions: [A.cerveau] },
  { id: 'cle', re: /401|403|invalid.*(api|key)|incorrect api key|unauthorized|clé.*(refus|invalide)|permission_denied|api key not valid/i, titre: 'Clé refusée', cause: 'La clé du service est fausse, expirée, ou n\'a plus de crédit.',
    etapes: ['Ouvre « Skills & extensions » et recolle la clé (sans espace avant ou après).', 'Clique « Tester » : il dit tout de suite si elle fonctionne.', 'Si le test échoue encore : crée une nouvelle clé sur le site du service (le bouton « Ouvrir » y mène).'], reinstaller: 'rien à réinstaller', actions: [A.cles] },
  { id: 'quota', re: /429|rate.?limit|quota|too many requests|resource_exhausted/i, titre: 'Limite d\'utilisation atteinte', cause: 'Le service gratuit limite le nombre de demandes par minute ou par jour.',
    etapes: ['Attends une minute puis réessaie.', 'Choisis « Auto — meilleur cerveau » : Clipia passe tout seul à un autre cerveau.', 'Ajoute une seconde clé gratuite (Gemini, Groq…) pour avoir un cerveau de secours.'], reinstaller: 'rien à réinstaller', actions: [A.cles, A.cerveau] },
  { id: 'port', re: /EADDRINUSE|address already in use/i, titre: 'Clipia est déjà ouvert', cause: 'Une autre fenêtre de Clipia utilise déjà la même porte (le port).',
    etapes: ['Ferme les autres fenêtres de Clipia (regarde aussi dans la barre des tâches).', 'Si rien n\'est visible : redémarre l\'ordinateur.', 'Relance Clipia.'], reinstaller: 'rien à réinstaller', actions: [] },
  { id: 'reseau', re: /ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed|network|getaddrinfo|EAI_AGAIN|timeout/i, titre: 'Problème de connexion Internet', cause: 'Clipia n\'arrive pas à joindre le service (Internet coupé, VPN, pare-feu ou service en panne).',
    etapes: ['Vérifie que tu as Internet (ouvre un site dans ton navigateur).', 'Coupe un éventuel VPN ou autorise Clipia dans le pare-feu.', 'Réessaie ; sinon choisis un cerveau local (Ollama) qui marche sans Internet.'], reinstaller: 'rien à réinstaller', actions: [A.cerveau] },
  { id: 'disque', re: /ENOSPC|no space left|espace disque/i, titre: 'Disque plein', cause: 'Il n\'y a plus de place pour écrire les fichiers.',
    etapes: ['Libère de la place (corbeille, téléchargements, anciens projets).', 'Il faut au moins 2 Go libres pour monter des vidéos.', 'Relance ta demande.'], reinstaller: 'rien à réinstaller', actions: [] },
  { id: 'droits', re: /EACCES|EPERM|permission denied|accès refusé|operation not permitted/i, titre: 'Accès refusé par l\'ordinateur', cause: 'Windows, le Mac ou l\'antivirus empêche Clipia d\'écrire ou de lancer un fichier.',
    etapes: ['Place le dossier de Clipia dans « Documents » (pas dans Program Files).', 'Ajoute Clipia aux exceptions de ton antivirus.', 'Clic droit sur Clipia → « Exécuter en tant qu\'administrateur » une fois.'], reinstaller: 'Clipia (dans un dossier de ton profil)', actions: [A.guidee] },
  { id: 'module', re: /Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/i, titre: 'Un fichier de Clipia manque', cause: 'L\'installation est incomplète ou a été abîmée.',
    etapes: ['Télécharge à nouveau Clipia depuis le site officiel.', 'Réinstalle par-dessus : tes réglages et tes clés sont conservés.', 'Relance Clipia.'], reinstaller: 'Clipia', actions: [] },
  { id: 'micro', re: /not-allowed|service-not-allowed|micro.*(refus|bloqu)|microphone/i, titre: 'Le micro est bloqué', cause: 'Le navigateur n\'a pas l\'autorisation d\'écouter ton micro.',
    etapes: ['Clique sur le cadenas à gauche de l\'adresse → Micro → Autoriser.', 'Dans Windows : Paramètres → Confidentialité → Microphone → autorise ton navigateur.', 'Utilise Chrome ou Edge (Firefox n\'a pas la reconnaissance vocale intégrée).'], reinstaller: 'rien à réinstaller', actions: [] },
  { id: 'aucun-cerveau', re: /aucun (cerveau|moteur)|no (model|engine)|aucun moteur/i, titre: 'Aucun cerveau disponible', cause: 'Tous les cerveaux testés ont échoué : pas d\'Internet, clés absentes, ou aucun modèle local lancé.',
    etapes: ['Choisis « Pollinations (sans clé) » dans le widget du haut : il marche sans compte.', 'Ou crée une clé gratuite Gemini (Skills & extensions) : 2 minutes.', 'Ou installe Ollama et un modèle local (Installation guidée).'], reinstaller: 'rien à réinstaller', actions: [A.cles, A.cerveau, A.guidee] },
  { id: 'heures', re: /heures offertes|cabinet.*terminées/i, titre: 'Temps du cabinet épuisé', cause: 'Tes 2 heures offertes au cabinet de psychologues sont terminées. Le reste de Clipia reste libre.',
    etapes: ['Clique sur la pastille ⏱ en haut du cabinet pour ajouter des heures (5 € l\'heure).', 'Tu peux continuer à utiliser tout le reste de Clipia gratuitement.'], reinstaller: 'rien à réinstaller', actions: [] }
];

export function reglePour(texte) {
  const t = String(texte || ''); const r = REGLES.find(x => x.re.test(t)); if (!r) return null;
  const { re, ...pub } = r; return pub;
}

const sansPensee = (t) => String(t || '').replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

export async function diagnostiquer({ texte = '', image = null } = {}) {
  const t = String(texte || '').slice(0, 6000).trim();
  if (!t && !image) throw new Error('Colle le message d\'erreur ou ajoute une capture d\'écran.');
  const regle = reglePour(t); let ia = null, par = null;
  const besoin = image ? 'vision' : 'conversation';
  const consigne = `Tu es le dépanneur de Clipia (logiciel Windows/Mac/Linux, Node.js, ffmpeg, Ollama, clés API). Réponds en français simple, pour un non-technicien, avec ce plan EXACT :
CAUSE : une phrase.
ÉTAPES : 3 à 5 étapes numérotées, avec la commande ou le bouton exact.
À RÉINSTALLER : le programme à réinstaller, ou « rien ».
VÉRIFIER : comment savoir que c'est réglé.
Si tu n'es pas sûr, dis-le et propose la vérification la plus utile. N'invente aucune commande.${regle ? `\nPiste déjà identifiée par Clipia : ${regle.titre}.` : ''}`;
  for (const m of chaine(besoin).slice(0, 3)) {
    try {
      const r = await chat(m.provider, { model: m.model, system: consigne, temperature: 0.2, maxTokens: 900, timeout: 40000,
        messages: [{ role: 'user', content: (t ? `Problème :\n${t}` : 'Voici une capture d\'écran du problème. Lis le message affiché.'), ...(image ? { images: [image] } : {}) }] });
      const x = sansPensee(r.text); if (x) { ia = x; par = m.provider; break; }
    } catch {}
  }
  return { regle, ia, par, note: ia ? null : image ? 'Aucun cerveau capable de lire les images n\'a répondu : colle plutôt le texte de l\'erreur.' : (regle ? null : 'Aucun cerveau n\'a répondu et je ne connais pas cette erreur : copie le texte exact et réessaie dans un instant.') };
}
