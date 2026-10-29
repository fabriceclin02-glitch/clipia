/** CLIPIA X7 — Logithèque : les logiciels libres (et outils Google) les plus utiles pour créer, installés en un clic ou pas à pas.
 *  Windows : winget · macOS : Homebrew · Linux : apt (via pkexec). Rien n'est installé sans clic, rien n'est caché : la commande exacte est affichée. */
import { spawn, spawnSync } from 'node:child_process';

export const CATALOGUE = [
  /* Musique */
  { id: 'lmms', cat: 'musique', nom: 'LMMS', licence: 'GPL', quoi: 'Séquenceur musical complet (instruments, pistes, boucles). Gratuit, open source.', winget: 'LMMS.LMMS', brew: 'lmms', cask: true, apt: 'lmms', bin: ['lmms'], lien: 'https://lmms.io' },
  { id: 'audacity', cat: 'musique', nom: 'Audacity', licence: 'GPL', quoi: 'Enregistrer, couper, nettoyer et mixer des sons.', winget: 'Audacity.Audacity', brew: 'audacity', cask: true, apt: 'audacity', bin: ['audacity'], lien: 'https://www.audacityteam.org' },
  { id: 'musescore', cat: 'musique', nom: 'MuseScore', licence: 'GPL', quoi: 'Écrire des partitions et les faire jouer.', winget: 'Musescore.Musescore', brew: 'musescore', cask: true, apt: 'musescore3', bin: ['musescore', 'mscore'], lien: 'https://musescore.org' },
  /* Vidéo */
  { id: 'kdenlive', cat: 'video', nom: 'Kdenlive', licence: 'GPL', quoi: 'Montage vidéo complet à plusieurs pistes.', winget: 'KDE.Kdenlive', brew: 'kdenlive', cask: true, apt: 'kdenlive', bin: ['kdenlive'], lien: 'https://kdenlive.org' },
  { id: 'shotcut', cat: 'video', nom: 'Shotcut', licence: 'GPL', quoi: 'Montage vidéo simple et rapide.', winget: 'Meltytech.Shotcut', brew: 'shotcut', cask: true, apt: null, bin: ['shotcut'], lien: 'https://shotcut.org' },
  { id: 'openshot', cat: 'video', nom: 'OpenShot', licence: 'GPL', quoi: 'Montage vidéo pour débutants.', winget: 'OpenShot.OpenShot', brew: 'openshot-video-editor', cask: true, apt: 'openshot-qt', bin: ['openshot-qt'], lien: 'https://www.openshot.org' },
  { id: 'obs', cat: 'video', nom: 'OBS Studio', licence: 'GPL', quoi: 'Enregistrer l\'écran, la webcam, faire du direct.', winget: 'OBSProject.OBSStudio', brew: 'obs', cask: true, apt: 'obs-studio', bin: ['obs'], lien: 'https://obsproject.com' },
  { id: 'handbrake', cat: 'video', nom: 'HandBrake', licence: 'GPL', quoi: 'Convertir et alléger des vidéos.', winget: 'HandBrake.HandBrake', brew: 'handbrake', cask: true, apt: 'handbrake', bin: ['HandBrakeCLI', 'ghb'], lien: 'https://handbrake.fr' },
  { id: 'vlc', cat: 'video', nom: 'VLC', licence: 'GPL', quoi: 'Lire toutes les vidéos et musiques.', winget: 'VideoLAN.VLC', brew: 'vlc', cask: true, apt: 'vlc', bin: ['vlc'], lien: 'https://www.videolan.org' },
  { id: 'kodi', cat: 'video', nom: 'Kodi (centre multimédia)', licence: 'GPL', quoi: 'Ton centre multimédia libre : films, séries, musique et photos de ta bibliothèque, sur grand écran. Clipia le pilote à la voix (« ouvre Kodi », « pause », « mets plus fort »). Clipia ne fournit aucun contenu.', winget: 'XBMCFoundation.Kodi', brew: 'kodi', cask: true, apt: 'kodi', bin: ['kodi'], lien: 'https://kodi.tv' },
  { id: 'stream-primevideo', cat: 'streaming', nom: 'Amazon Prime Video', licence: 'abonnement Amazon', quoi: 'Films et séries d\'Amazon : tu te connectes toi-même avec ton compte Amazon. Clipia l\'ouvre à ta demande ; elle ne tape jamais ton mot de passe.', lienSeul: true, lien: 'https://www.primevideo.com' },
  { id: 'stream-netflix', cat: 'streaming', nom: 'Netflix', licence: 'abonnement Netflix', quoi: 'Films et séries : tu te connectes toi-même avec ton compte Netflix. Clipia l\'ouvre à ta demande ; elle ne tape jamais ton mot de passe.', lienSeul: true, lien: 'https://www.netflix.com/fr/' },
  { id: 'stream-tf1plus', cat: 'streaming', nom: 'TF1+ (ex-MyTF1)', licence: 'gratuit avec publicité', quoi: 'Replay et direct de TF1 et des chaînes du groupe. Gratuit (avec publicité), compte facultatif. Clipia l\'ouvre à ta demande ; elle ne tape jamais ton mot de passe.', lienSeul: true, lien: 'https://www.tf1.fr' },
  { id: 'stream-m6plus', cat: 'streaming', nom: 'M6+ (ex-6play)', licence: 'gratuit avec publicité', quoi: 'Replay et direct de M6 et W9. Gratuit (avec publicité), compte facultatif. Clipia l\'ouvre à ta demande ; elle ne tape jamais ton mot de passe.', lienSeul: true, lien: 'https://www.m6.fr' },
  { id: 'stream-francetv', cat: 'streaming', nom: 'France.tv', licence: 'gratuit', quoi: 'Replay et direct des chaînes publiques, gratuit. Clipia l\'ouvre à ta demande ; elle ne tape jamais ton mot de passe.', lienSeul: true, lien: 'https://www.france.tv' },
  { id: 'stream-arte', cat: 'streaming', nom: 'Arte.tv', licence: 'gratuit', quoi: 'Films, séries et documentaires, gratuit. Clipia l\'ouvre à ta demande ; elle ne tape jamais ton mot de passe.', lienSeul: true, lien: 'https://www.arte.tv/fr/' },
  { id: 'stream-plutotv', cat: 'streaming', nom: 'Pluto TV', licence: 'gratuit avec publicité', quoi: 'Des dizaines de chaînes de films et séries, gratuites et légales. Clipia l\'ouvre à ta demande ; elle ne tape jamais ton mot de passe.', lienSeul: true, lien: 'https://pluto.tv/fr' },
  { id: 'ffmpeg', cat: 'video', nom: 'FFmpeg', licence: 'LGPL/GPL', quoi: 'Le moteur de montage de Clipia (déjà fourni avec l\'installateur Windows).', winget: 'Gyan.FFmpeg', brew: 'ffmpeg', cask: false, apt: 'ffmpeg', bin: ['ffmpeg'], lien: 'https://ffmpeg.org' },
  /* Images & 3D */
  { id: 'blender', cat: 'image', nom: 'Blender', licence: 'GPL', quoi: '3D, animation, effets visuels et même montage vidéo.', winget: 'BlenderFoundation.Blender', brew: 'blender', cask: true, apt: 'blender', bin: ['blender'], lien: 'https://www.blender.org' },
  { id: 'gimp', cat: 'image', nom: 'GIMP', licence: 'GPL', quoi: 'Retouche photo avancée.', winget: 'GIMP.GIMP', brew: 'gimp', cask: true, apt: 'gimp', bin: ['gimp'], lien: 'https://www.gimp.org' },
  { id: 'krita', cat: 'image', nom: 'Krita', licence: 'GPL', quoi: 'Dessin et peinture numérique.', winget: 'KDE.Krita', brew: 'krita', cask: true, apt: 'krita', bin: ['krita'], lien: 'https://krita.org' },
  { id: 'inkscape', cat: 'image', nom: 'Inkscape', licence: 'GPL', quoi: 'Dessin vectoriel (logos, affiches).', winget: 'Inkscape.Inkscape', brew: 'inkscape', cask: true, apt: 'inkscape', bin: ['inkscape'], lien: 'https://inkscape.org' },
  /* Code */
  { id: 'vscodium', cat: 'code', nom: 'VSCodium', licence: 'MIT', quoi: 'Éditeur de code libre (version sans télémétrie de VS Code).', winget: 'VSCodium.VSCodium', brew: 'vscodium', cask: true, apt: null, bin: ['codium'], lien: 'https://vscodium.com' },
  { id: 'vscode', cat: 'code', nom: 'Visual Studio Code', licence: 'MIT (binaire Microsoft)', quoi: 'Éditeur de code très répandu.', winget: 'Microsoft.VisualStudioCode', brew: 'visual-studio-code', cask: true, apt: null, bin: ['code'], lien: 'https://code.visualstudio.com' },
  { id: 'visualstudio', cat: 'code', nom: 'Visual Studio Community (Windows)', licence: 'Gratuit (Microsoft, usage individuel/open source)', quoi: 'Environnement de développement complet (C#, C++, .NET). Lourd : plusieurs Go. Windows seulement.', winget: 'Microsoft.VisualStudio.2022.Community', brew: null, cask: false, apt: null, bin: [], lien: 'https://visualstudio.microsoft.com/fr/vs/community/' },
  { id: 'git', cat: 'code', nom: 'Git', licence: 'GPL', quoi: 'Garder l\'historique de tes projets et les publier sur GitHub.', winget: 'Git.Git', brew: 'git', cask: false, apt: 'git', bin: ['git'], lien: 'https://git-scm.com' },
  { id: 'python', cat: 'code', nom: 'Python 3', licence: 'PSF', quoi: 'Langage utile à beaucoup d\'outils IA.', winget: 'Python.Python.3.12', brew: 'python', cask: false, apt: 'python3', bin: ['python3', 'python'], lien: 'https://www.python.org' },
  { id: 'node', cat: 'code', nom: 'Node.js (LTS)', licence: 'MIT', quoi: 'Pour tes propres sites et applications JavaScript.', winget: 'OpenJS.NodeJS.LTS', brew: 'node', cask: false, apt: 'nodejs', bin: ['node'], lien: 'https://nodejs.org' },
  /* IA locale */
  { id: 'tailscale', cat: 'agents', nom: 'Tailscale', licence: 'BSD', quoi: 'Réseau privé gratuit : relie ton téléphone à ton PC de n\'importe où, sans rien ouvrir sur Internet.', winget: 'Tailscale.Tailscale', brew: 'tailscale', cask: true, apt: null, bin: ['tailscale'], lien: 'https://tailscale.com/download' },
  { id: 'cloudflared', cat: 'agents', nom: 'Cloudflare Tunnel (cloudflared)', licence: 'Apache-2.0', quoi: 'Adresse https temporaire vers ton PC pour l\'appli téléphone et le MCP (protégée par le jeton).', winget: 'Cloudflare.cloudflared', brew: 'cloudflared', cask: false, apt: null, bin: ['cloudflared'], lien: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/' },
  { id: 'openclaw', cat: 'agents', nom: 'OpenClaw', licence: 'MIT', quoi: 'L\'agent open source dont Clipia reprend les compétences (messageries, mail, notes…). Demande Node.js 24+.', apres: ['npm', 'install', '-g', 'openclaw@latest'], bin: ['openclaw'], lien: 'https://openclaw.ai' },
  { id: 'ollama', cat: 'ia', nom: 'Ollama', licence: 'MIT', quoi: 'Faire tourner des cerveaux IA gratuits sur ton ordinateur (Gemma, Qwen, Llama…).', winget: 'Ollama.Ollama', brew: 'ollama', cask: true, apt: null, bin: ['ollama'], lien: 'https://ollama.com' },
  { id: 'lmstudio', cat: 'ia', nom: 'LM Studio', licence: 'gratuit (propriétaire)', quoi: 'Interface simple pour télécharger et lancer des modèles locaux.', winget: 'ElementLabs.LMStudio', brew: 'lm-studio', cask: true, apt: null, bin: ['lms'], lien: 'https://lmstudio.ai' },
  /* X8 — Bureautique, données & documents */
  { id: 'libreoffice', cat: 'bureau', nom: 'LibreOffice', licence: 'MPL', quoi: 'Traitement de texte, tableur et présentations : devis, factures, business plans, sans abonnement.', winget: 'TheDocumentFoundation.LibreOffice', brew: 'libreoffice', cask: true, apt: 'libreoffice', bin: ['libreoffice', 'soffice'], lien: 'https://www.libreoffice.org' },
  { id: 'pandoc', cat: 'bureau', nom: 'Pandoc', licence: 'GPL', quoi: 'Convertit n\'importe quel document (Markdown, Word, PDF, HTML…) : parfait pour les dossiers et livres générés par Clipia.', winget: 'JohnMacFarlane.Pandoc', brew: 'pandoc', cask: false, apt: 'pandoc', bin: ['pandoc'], lien: 'https://pandoc.org' },
  { id: 'tesseract', cat: 'bureau', nom: 'Tesseract OCR', licence: 'Apache-2.0', quoi: 'Lit le texte dans les photos et les scans (factures, courriers).', winget: 'UB-Mannheim.TesseractOCR', brew: 'tesseract', cask: false, apt: 'tesseract-ocr', bin: ['tesseract'], lien: 'https://github.com/tesseract-ocr/tesseract' },
  { id: 'imagemagick', cat: 'bureau', nom: 'ImageMagick', licence: 'Apache-2.0', quoi: 'Redimensionne, convertit et assemble des images en masse.', winget: 'ImageMagick.ImageMagick', brew: 'imagemagick', cask: false, apt: 'imagemagick', bin: ['magick', 'convert'], lien: 'https://imagemagick.org' },
  { id: 'joplin', cat: 'bureau', nom: 'Joplin', licence: 'MIT', quoi: 'Prise de notes libre et chiffrée, synchronisable.', winget: 'Joplin.Joplin', brew: 'joplin', cask: true, apt: null, bin: ['joplin'], lien: 'https://joplinapp.org' },
  { id: 'keepassxc', cat: 'bureau', nom: 'KeePassXC', licence: 'GPL', quoi: 'Coffre-fort de mots de passe local : garde tes clés API et accès en sécurité.', winget: 'KeePassXCTeam.KeePassXC', brew: 'keepassxc', cask: true, apt: 'keepassxc', bin: ['keepassxc'], lien: 'https://keepassxc.org' },
  { id: 'thunderbird', cat: 'bureau', nom: 'Thunderbird', licence: 'MPL', quoi: 'Messagerie libre pour tes e-mails professionnels.', winget: 'Mozilla.Thunderbird', brew: 'thunderbird', cask: true, apt: 'thunderbird', bin: ['thunderbird'], lien: 'https://www.thunderbird.net' },
  { id: 'scribus', cat: 'bureau', nom: 'Scribus', licence: 'GPL', quoi: 'Mise en page pro : plaquettes, flyers, livres, magazines.', winget: 'ScribusTeam.Scribus', brew: 'scribus', cask: true, apt: 'scribus', bin: ['scribus'], lien: 'https://www.scribus.net' },
  /* X8 — Vidéo & audio en ligne de commande */
  { id: 'ytdlp', cat: 'video', nom: 'yt-dlp', licence: 'Unlicense', quoi: 'Récupère tes propres vidéos/audios publiés en ligne (à utiliser uniquement sur des contenus dont tu as les droits).', winget: 'yt-dlp.yt-dlp', brew: 'yt-dlp', cask: false, apt: 'yt-dlp', bin: ['yt-dlp'], lien: 'https://github.com/yt-dlp/yt-dlp' },
  { id: 'fasterwhisper', cat: 'ia', nom: 'faster-whisper (transcription locale)', licence: 'MIT', quoi: 'Transcrit la voix en texte sur ton ordinateur (sous-titres, comptes rendus). Demande Python 3.', apres: ['pip', 'install', '--user', 'faster-whisper'], necessite: 'python', bin: [], lien: 'https://github.com/SYSTRAN/faster-whisper' },
  /* X8 — Cerveaux locaux supplémentaires (via Ollama) */
  { id: 'qwen25', cat: 'ia', nom: 'Qwen 2.5 (cerveau polyvalent léger)', licence: 'Apache-2.0', quoi: 'Modèle ouvert rapide et très bon en français (environ 2 Go). Idéal comme cerveau de fond pour les travaux parallèles.', apres: ['ollama', 'pull', 'qwen2.5:3b'], necessite: 'ollama', bin: [], lien: 'https://ollama.com/library/qwen2.5' },
  { id: 'llama32', cat: 'ia', nom: 'Llama 3.2 (3 milliards)', licence: 'Llama Community', quoi: 'Petit modèle de Meta, rapide, pour discuter et résumer hors ligne (environ 2 Go).', apres: ['ollama', 'pull', 'llama3.2:3b'], necessite: 'ollama', bin: [], lien: 'https://ollama.com/library/llama3.2' },
  { id: 'qwencoder', cat: 'ia', nom: 'Qwen 2.5 Coder (programmation)', licence: 'Apache-2.0', quoi: 'Modèle spécialisé code pour les agents développeurs (environ 1 Go).', apres: ['ollama', 'pull', 'qwen2.5-coder:1.5b'], necessite: 'ollama', bin: [], lien: 'https://ollama.com/library/qwen2.5-coder' },
  { id: 'nomic', cat: 'ia', nom: 'Nomic Embed (mémoire sémantique)', licence: 'Apache-2.0', quoi: 'Modèle d\'indexation pour retrouver tes documents par le sens (environ 300 Mo).', apres: ['ollama', 'pull', 'nomic-embed-text'], necessite: 'ollama', bin: [], lien: 'https://ollama.com/library/nomic-embed-text' },
  /* X8 — Automatisation & entreprise */
  { id: 'n8n', cat: 'entreprise', nom: 'n8n (automatisations)', licence: 'Sustainable Use (code ouvert, usage interne libre)', quoi: 'Relie tes outils entre eux sans code : facture envoyée, mail reçu, tâche créée. Demande Node.js.', apres: ['npm', 'install', '-g', 'n8n'], necessite: 'node', bin: ['n8n'], lien: 'https://n8n.io' },
  { id: 'e-odoo', cat: 'entreprise', nom: 'Odoo Community (gestion d\'entreprise)', licence: 'LGPL', quoi: 'Facturation, stock, CRM, compta : le logiciel de gestion libre le plus complet. Se télécharge sur son site.', lienSeul: true, lien: 'https://www.odoo.com/fr_FR/page/download' },
  { id: 'e-invoiceshelf', cat: 'entreprise', nom: 'InvoiceShelf (factures simples)', licence: 'AAL', quoi: 'Facturation libre et auto-hébergeable pour un indépendant.', lienSeul: true, lien: 'https://invoiceshelf.com' },
  { id: 'e-calcom', cat: 'entreprise', nom: 'Cal.com (prise de rendez-vous)', licence: 'AGPL', quoi: 'Tes clients réservent un créneau eux-mêmes. Version libre auto-hébergeable.', lienSeul: true, lien: 'https://cal.com' },
  { id: 'e-penpot', cat: 'entreprise', nom: 'Penpot (design & maquettes)', licence: 'MPL', quoi: 'L\'alternative libre à Figma, dans le navigateur.', lienSeul: true, lien: 'https://penpot.app' },
  { id: 'e-nextcloud', cat: 'entreprise', nom: 'Nextcloud (cloud privé)', licence: 'AGPL', quoi: 'Ton propre espace de fichiers, agenda et contacts.', lienSeul: true, lien: 'https://nextcloud.com/install' },
  { id: 'e-gouv', cat: 'entreprise', nom: 'Créer son entreprise (guichet officiel)', quoi: 'Le guichet unique de l\'État (France) pour déclarer une micro-entreprise ou une société.', lienSeul: true, lien: 'https://formalites.entreprises.gouv.fr' },
  /* Google */
  { id: 'chrome', cat: 'google', nom: 'Google Chrome', licence: 'gratuit', quoi: 'Le navigateur recommandé pour la voix de Clipia.', winget: 'Google.Chrome', brew: 'google-chrome', cask: true, apt: null, bin: ['google-chrome', 'chrome'], lien: 'https://www.google.com/chrome' },
  { id: 'gemma3', cat: 'google', nom: 'Gemma 3 (cerveau local de Google)', licence: 'Gemma Terms', quoi: 'Télécharge le modèle ouvert de Google dans Ollama (environ 3 Go). Gratuit, hors ligne.', apres: ['ollama', 'pull', 'gemma3'], necessite: 'ollama', bin: [], lien: 'https://ollama.com/library/gemma3' },
  { id: 'google-lien-studio', cat: 'google', nom: 'Google AI Studio (clé Gemini gratuite)', quoi: 'Gemini gratuit dans Clipia : crée ta clé dans « Skills & extensions ».', lienSeul: true, lien: 'https://aistudio.google.com/apikey' },
  { id: 'google-lien-antigravity', cat: 'google', nom: 'Google Antigravity', quoi: 'Éditeur de code à agents de Google (à télécharger sur le site de Google).', lienSeul: true, lien: 'https://antigravity.google' },
  { id: 'google-lien-flow', cat: 'google', nom: 'Google Flow & Whisk', quoi: 'Vidéo et images IA de Google Labs (dans le navigateur).', lienSeul: true, lien: 'https://labs.google/flow' },
  { id: 'google-lien-notebooklm', cat: 'google', nom: 'NotebookLM', quoi: 'Poser des questions à tes documents (dans le navigateur).', lienSeul: true, lien: 'https://notebooklm.google.com' },
  /* Musique payante : guide, pas d'installation */
  { id: 'udio', cat: 'musique', nom: 'Udio (service payant)', quoi: 'Compose des chansons avec voix. Abonnement chez Udio : tu génères le morceau là-bas, puis tu l\'importes dans le Studio montage de Clipia.', lienSeul: true, lien: 'https://www.udio.com' }
];

const pf = () => process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
export const CATEGORIES = { musique: '🎵 Musique', video: '🎬 Vidéo', image: '🖼 Image & 3D', code: '💻 Code', ia: '🧠 IA locale', google: '🔵 Google', agents: '🔌 Téléphone, MCP & agents', bureau: '📄 Bureautique & documents', entreprise: '🚀 Entreprise & automatisation', streaming: '📺 Films, séries & TV' };

export function commande(id) {
  const e = CATALOGUE.find(x => x.id === id); if (!e || e.lienSeul) return null;
  if (e.apres) return { cmd: e.apres[0], args: e.apres.slice(1), texte: e.apres.join(' ') };
  const p = pf();
  if (p === 'win' && e.winget) return { cmd: 'winget', args: ['install', '-e', '--id', e.winget, '--silent', '--accept-package-agreements', '--accept-source-agreements'], texte: `winget install -e --id ${e.winget}` };
  if (p === 'mac' && e.brew) return { cmd: 'brew', args: ['install', ...(e.cask ? ['--cask'] : []), e.brew], texte: `brew install ${e.cask ? '--cask ' : ''}${e.brew}` };
  if (p === 'linux' && e.apt) return { cmd: 'pkexec', args: ['apt-get', 'install', '-y', e.apt], texte: `sudo apt-get install -y ${e.apt}` };
  return null;
}

const present = (b) => { const r = spawnSync(pf() === 'win' ? 'where' : 'which', [b], { encoding: 'utf8', timeout: 4000, windowsHide: true }); return r.status === 0; };
let cacheWinget = null;
function wingetListe() { if (cacheWinget && Date.now() - cacheWinget.t < 60000) return cacheWinget.s; let s = ''; try { s = spawnSync('winget', ['list', '--accept-source-agreements'], { encoding: 'utf8', timeout: 25000, windowsHide: true }).stdout || ''; } catch {} cacheWinget = { t: Date.now(), s }; return s; }

export function liste() {
  const w = pf() === 'win' ? wingetListe() : '';
  return CATALOGUE.map(e => {
    const cmd = commande(e.id);
    const installe = e.lienSeul ? null : ((e.bin || []).some(present) || (pf() === 'win' && e.winget && w.includes(e.winget)));
    return { id: e.id, cat: e.cat, nom: e.nom, licence: e.licence || '', quoi: e.quoi, lien: e.lien || '', lienSeul: Boolean(e.lienSeul), installe, commande: cmd?.texte || '', possible: Boolean(cmd), necessite: e.necessite || '' };
  });
}

export function installer(id, onLigne = () => {}) {
  const c = commande(id); const e = CATALOGUE.find(x => x.id === id);
  if (!c) return Promise.reject(new Error(e?.lienSeul ? 'Ce service se ouvre sur son site : utilise le bouton « Ouvrir ».' : 'Pas de méthode d\'installation automatique sur ce système : utilise le bouton « Site officiel ».'));
  return new Promise((ok, ko) => {
    onLigne('▶ ' + c.texte); let p;
    try { p = spawn(c.cmd, c.args, { windowsHide: true, shell: pf() === 'win' && c.cmd === 'npm' }); } catch (err) { return ko(err); }
    const flux = (d) => String(d).split(/\r?\n/).map(l => l.replace(/[\u0000-\u001f]/g, '').trim()).filter(l => l && !/^[-\\|/ ]+$/.test(l)).forEach(l => onLigne(l.slice(0, 200)));
    p.stdout.on('data', flux); p.stderr.on('data', flux);
    const t = setTimeout(() => { try { p.kill(); } catch {} ko(new Error('L\'installation prend trop de temps (20 min).')); }, 20 * 60000);
    p.on('error', err => { clearTimeout(t); ko(new Error(err.code === 'ENOENT' ? `« ${c.cmd} » est introuvable sur cet ordinateur${c.cmd === 'winget' ? ' (Windows 10/11 récent requis : mets à jour « Programmes d\'installation d\'application » dans le Microsoft Store)' : c.cmd === 'brew' ? ' (installe Homebrew : brew.sh)' : ''}.` : err.message)); });
    p.on('close', code => { clearTimeout(t); cacheWinget = null; code === 0 ? ok() : ko(new Error(`L'installation s'est arrêtée (code ${code}). Si une fenêtre d'autorisation est apparue, accepte-la puis recommence.`)); });
  });
}
