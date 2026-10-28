/** CLIPIA X7 — « Skills & extensions » : un catalogue d'outils et de méthodes branchables.
 *  Les clés vont dans le coffre chiffré (jamais en clair) ; les méthodes sont des compétences que Clipia lit quand il le faut. */
import { store } from '../lib/store.js';
import { vault } from '../lib/vault.js';
import * as v6 from './v6.js';

const sk = (texte) => String(texte).trim();

export const EXTENSIONS = [
  /* ── Les cerveaux et outils gratuits de Google ── */
  { id: 'gemini-api', groupe: 'google', nom: 'Gemini (clé gratuite AI Studio)', icone: '💎', statut: 'api',
    quoi: 'Le vrai cerveau de Google, utilisable directement dans Clipia (Gemini 2.5 Flash, Flash-Lite, Gemma 3). Offre gratuite avec limites de débit fixées par Google.',
    cle: { vault: 'provider:gemini', fournisseur: 'gemini', label: 'Clé API Gemini', placeholder: 'AIza…' }, lien: 'https://aistudio.google.com/apikey',
    guide: ['Ouvre aistudio.google.com/apikey avec ton compte Google.', '« Create API key » (aucune carte bancaire pour l\'offre gratuite).', 'Colle la clé ici : Gemini apparaît dans le widget « cerveau » en haut.'] },
  { id: 'gemma-local', groupe: 'google', nom: 'Gemma 3 (sur ton ordinateur)', icone: '🏠', statut: 'local',
    quoi: 'Le modèle ouvert de Google : gratuit, hors ligne, sans clé. Il tourne sur ton PC via Ollama.',
    commande: 'ollama pull gemma3', lien: 'https://ollama.com/library/gemma3',
    guide: ['Installe Ollama (menu « Installation guidée »).', 'Dans un terminal : ollama pull gemma3', 'Clipia le voit tout seul dans « Cerveau » (modèles locaux).'] },
  { id: 'ai-studio', groupe: 'google', nom: 'Google AI Studio', icone: '🧪', statut: 'web', lien: 'https://aistudio.google.com',
    quoi: 'Le terrain de jeu gratuit de Google : tester les modèles Gemini, écrire des prompts, générer une appli. S\'ouvre dans ton navigateur.',
    texte: sk(`# Quand l'utiliser
La personne veut tester un prompt ou un modèle Gemini sans rien installer.
# Méthode
1. Rédige un prompt clair (rôle, contexte, tâche, format de sortie).
2. Donne-le à la personne avec le lien aistudio.google.com ; elle le colle dans « Create prompt ».
3. Si elle veut l'utiliser dans Clipia : l'aider à créer sa clé gratuite (carte Gemini).`) },
  { id: 'antigravity', groupe: 'google', nom: 'Google Antigravity', icone: '🪐', statut: 'web', lien: 'https://antigravity.google',
    quoi: 'L\'environnement de code « agentique » de Google (des agents qui écrivent et testent le code). À installer sur ton ordinateur ; les conditions d\'accès gratuit sont fixées par Google et peuvent changer.',
    texte: sk(`# Méthode
Antigravity est un outil externe : Clipia ne le pilote pas. Rédige pour la personne un cahier des charges collable (objectif, pages ou écrans, technologies, critères de réussite testables), puis explique comment l'ouvrir. Pour un résultat immédiat dans Clipia, proposer plutôt l'Atelier d'apps.`) },
  { id: 'jules', groupe: 'google', nom: 'Jules (agent de code Google)', icone: '🤖', statut: 'web', lien: 'https://jules.google',
    quoi: 'Un agent qui corrige des bugs et ajoute des fonctions dans un dépôt GitHub. Palier gratuit limité, décidé par Google.',
    texte: sk(`# Méthode
Outil externe lié à GitHub. Aide à écrire une tâche précise (fichier concerné, comportement attendu, test à faire passer) que la personne colle dans Jules.`) },
  { id: 'flow', groupe: 'google', nom: 'Google Flow (vidéo)', icone: '🎬', statut: 'web', lien: 'https://labs.google/flow',
    quoi: 'L\'outil vidéo IA de Google Labs. Les crédits et pays disponibles dépendent de Google : ouvre la page pour voir ce qui t\'est offert.',
    texte: sk(`# Méthode
Écrire un prompt vidéo pour Flow : sujet, action, décor, lumière, style, mouvement de caméra, durée (5 à 8 s). Donner 3 variantes. Rappeler que le montage final (musique, texte, assemblage) se fait ensuite dans le Studio montage de Clipia.`) },
  { id: 'whisk', groupe: 'google', nom: 'Google Whisk (images)', icone: '🎨', statut: 'web', lien: 'https://labs.google/whisk',
    quoi: 'Créer des images en mélangeant sujet, décor et style (Google Labs). Offre et pays selon Google.',
    texte: sk(`# Méthode
Préparer pour Whisk trois descriptions courtes : SUJET, DÉCOR, STYLE. Proposer 3 combinaisons. Pour générer dans Clipia même, utiliser l'outil image_creer.`) },
  { id: 'notebooklm', groupe: 'google', nom: 'NotebookLM', icone: '📓', statut: 'web', lien: 'https://notebooklm.google.com',
    quoi: 'Poser des questions sur tes propres documents et obtenir des résumés audio. Gratuit avec limites.',
    texte: sk(`# Méthode
Aider à choisir les sources à envoyer, puis à formuler 5 questions utiles à poser. Résumer ensuite le résultat que la personne colle dans la conversation.`) },
  { id: 'gemini-app', groupe: 'google', nom: 'Application Gemini', icone: '✨', statut: 'web', lien: 'https://gemini.google.com',
    quoi: 'Le chat grand public de Google, gratuit avec un compte Google (quotas quotidiens).' },

  /* ── Skills (méthodes) et extensions branchables ── */
  { id: 'montage', groupe: 'skill', nom: 'Montage vidéo & musique par prompt', icone: '🎞', statut: 'skill',
    quoi: 'Décrire une vidéo ou une musique : Clipia propose les plans, la timeline et les réglages, puis monte avec le Studio montage.',
    texte: sk(`# Méthode
1. Découper l'idée en 4 à 8 plans de 3 à 6 s (une phrase par plan).
2. Pour chaque plan : image_creer (prompt visuel) ; pour la musique : musique_creer (style, tempo, ambiance, durée).
3. Ouvrir le Studio montage (section_ouvrir « montage »), y poser les plans, ajouter textes et musique, exporter en MP4.
4. Toujours donner un conseil : durée idéale par réseau (TikTok 15–30 s, YouTube 2–5 min).`) },
  { id: 'coder-site', groupe: 'skill', nom: 'Créer un site web avec des agents', icone: '🌐', statut: 'skill',
    quoi: 'Architecte, codeur, testeur et relecteur : un vrai site à télécharger, testé.',
    texte: sk(`# Méthode
Utiliser l'Atelier d'apps (type « Site web ») : décrire le site (activité, pages, ton, couleurs). Les agents produisent index.html, styles et scripts, les testent et rendent un dossier téléchargeable. Vérifier l'affichage mobile et l'accessibilité avant de livrer. Proposer l'hébergement gratuit GitHub Pages.`) },
  { id: 'coder-app', groupe: 'skill', nom: 'Créer une application avec des agents', icone: '📱', statut: 'skill',
    quoi: 'Application Node ou Python avec plan, code, tests et relecture par des agents.',
    texte: sk(`# Méthode
Utiliser l'Atelier d'apps (type « Application Node » ou « Python »). Demander les fonctions essentielles (3 maximum), laisser les agents écrire le code et les tests, lancer les tests, ne livrer que s'ils passent.`) },
  { id: 'resoudre', groupe: 'skill', nom: 'Résoudre un problème (diagnostic)', icone: '🩺', statut: 'skill',
    quoi: 'Capture d\'écran ou message d\'erreur : Clipia diagnostique, dit quoi réinstaller et quoi faire, étape par étape.',
    texte: sk(`# Méthode
1. Lire le message d'erreur en entier. 2. Nommer la cause probable en une phrase. 3. Donner les étapes (1, 2, 3) avec la commande exacte ou le bouton à cliquer. 4. Dire quoi vérifier ensuite. 5. Si une réparation automatique existe (ffmpeg, Ollama, clé), la proposer. Section « Résoudre un problème » du menu.`) },
  { id: 'recherche-profonde', groupe: 'skill', nom: 'Recherche approfondie', icone: '🔎', statut: 'skill',
    quoi: 'Plusieurs recherches web croisées, sources citées, synthèse courte.',
    texte: sk(`# Méthode
Reformuler la question en 3 requêtes différentes → web_chercher ×3 → web_lire sur les 3 meilleures pages → recouper → synthèse en 5 lignes avec les liens. Dire clairement ce qui reste incertain.`) },
  { id: 'voix-pro', groupe: 'skill', nom: 'Voix réalistes ElevenLabs', icone: '🗣', statut: 'api',
    quoi: 'Des voix très naturelles pour tes vidéos (service payant : ta clé ElevenLabs).',
    cle: { vault: 'provider:elevenlabs', fournisseur: 'elevenlabs', label: 'Clé ElevenLabs', placeholder: 'sk_…' }, lien: 'https://elevenlabs.io/app/settings/api-keys' },
  { id: 'musique-suno', groupe: 'skill', nom: 'Musique avec Suno', icone: '🎵', statut: 'api',
    quoi: 'Chansons complètes avec voix (service payant : ta clé).',
    cle: { vault: 'provider:suno', fournisseur: 'suno', label: 'Clé Suno', placeholder: '' }, lien: 'https://suno.com' },
  { id: 'image-pro', groupe: 'skill', nom: 'Images haute qualité (fal, Replicate, Stability)', icone: '🖼', statut: 'api',
    quoi: 'Brancher un service d\'images pour de meilleurs rendus que l\'option gratuite.',
    cle: { vault: 'provider:fal', fournisseur: 'fal', label: 'Clé fal.ai', placeholder: '' }, lien: 'https://fal.ai/dashboard/keys' },
  { id: 'video-ia', groupe: 'skill', nom: 'Vidéo IA (Runway, Luma)', icone: '📽', statut: 'api',
    quoi: 'Générer des plans vidéo avec un service dédié (payant : ta clé).',
    cle: { vault: 'provider:runway', fournisseur: 'runway', label: 'Clé Runway', placeholder: '' }, lien: 'https://dev.runwayml.com' },
  { id: 'transcription', groupe: 'skill', nom: 'Transcription rapide (Groq Whisper)', icone: '📝', statut: 'api',
    quoi: 'Transcrire une voix ou une vidéo très vite, offre gratuite.',
    cle: { vault: 'provider:groq', fournisseur: 'groq', label: 'Clé Groq', placeholder: 'gsk_…' }, lien: 'https://console.groq.com/keys' }
];

const actifs = () => v6.competencesPerso().filter(c => String(c.id).startsWith('ext-')).map(c => c.id);

export function etat() {
  const on = new Set(actifs());
  return EXTENSIONS.map(e => ({
    id: e.id, groupe: e.groupe, nom: e.nom, icone: e.icone, statut: e.statut, quoi: e.quoi, lien: e.lien || '', guide: e.guide || [], commande: e.commande || '',
    cle: e.cle ? { vault: e.cle.vault, fournisseur: e.cle.fournisseur, label: e.cle.label, placeholder: e.cle.placeholder || '', rempli: vault.has(e.cle.vault) } : null,
    methode: Boolean(e.texte), actif: on.has('ext-' + e.id)
  }));
}

export function basculer(id, actif) {
  const e = EXTENSIONS.find(x => x.id === id); if (!e || !e.texte) throw new Error('Cette extension n\'a pas de méthode à activer.');
  const cid = 'ext-' + id; let cur = v6.competencesPerso().filter(c => c.id !== cid);
  if (actif) cur.push({ id: cid, nom: e.nom, description: e.quoi.slice(0, 300), texte: e.texte, source: 'extension' });
  store.setting('competences', cur); return { ok: true, actif: Boolean(actif) };
}
