/** Boîte à outils de création : outils réels, gratuits ou ouverts en priorité. `lic` : os = open source, gr = gratuit, fm = freemium, pa = payant. */
export const CATEGORIES = [
  { id: 'musique', nom: 'Musique', ic: '♫' }, { id: 'video', nom: 'Films & vidéos', ic: '🎬' },
  { id: 'image', nom: 'Images & design', ic: '▣' }, { id: 'app', nom: 'Applications & sites', ic: '⌨' },
  { id: 'agents', nom: 'Agents & workflows', ic: '⬡' }, { id: 'voix', nom: 'Voix & son', ic: '🎙' },
  { id: 'jeux', nom: '3D & jeux', ic: '◈' }, { id: 'livres', nom: 'Livres & documents', ic: '▤' }
];
export const OUTILS = [
  // Musique
  { c: 'musique', n: 'Suno', lic: 'fm', u: 'https://suno.com', d: 'Chansons complètes (voix + musique) à partir d\'un texte. Clipia sait aussi le piloter via une clé de passerelle API.' },
  { c: 'musique', n: 'Udio', lic: 'fm', u: 'https://www.udio.com', d: 'Génération de morceaux, forte sur les styles variés.' },
  { c: 'musique', n: 'Stable Audio Open', lic: 'os', u: 'https://huggingface.co/stabilityai/stable-audio-open-1.0', d: 'Modèle ouvert pour sons, boucles et ambiances.' },
  { c: 'musique', n: 'MusicGen (AudioCraft)', lic: 'os', u: 'https://github.com/facebookresearch/audiocraft', d: 'Musique générée en local, sans abonnement.' },
  { c: 'musique', n: 'ACE-Step', lic: 'os', u: 'https://github.com/ace-step/ACE-Step', d: 'Modèle musical ouvert avec paroles, tourne sur ta machine.' },
  { c: 'musique', n: 'LMMS', lic: 'os', u: 'https://lmms.io', d: 'Studio de production complet (beats, synthés).' },
  { c: 'musique', n: 'Audacity', lic: 'os', u: 'https://www.audacityteam.org', d: 'Enregistrer, nettoyer, monter l\'audio.' },
  { c: 'musique', n: 'BandLab', lic: 'gr', u: 'https://www.bandlab.com', d: 'Studio musical gratuit dans le navigateur.' },
  // Vidéo
  { c: 'video', n: 'DaVinci Resolve', lic: 'gr', u: 'https://www.blackmagicdesign.com/products/davinciresolve', d: 'Montage et étalonnage professionnels, version gratuite complète.' },
  { c: 'video', n: 'Kdenlive', lic: 'os', u: 'https://kdenlive.org', d: 'Montage vidéo ouvert (Windows, Mac, Linux).' },
  { c: 'video', n: 'Shotcut', lic: 'os', u: 'https://shotcut.org', d: 'Montage simple et rapide.' },
  { c: 'video', n: 'OBS Studio', lic: 'os', u: 'https://obsproject.com', d: 'Enregistrer l\'écran, filmer, streamer.' },
  { c: 'video', n: 'Blender', lic: 'os', u: 'https://www.blender.org', d: 'Animation 3D, effets, et un monteur vidéo intégré.' },
  { c: 'video', n: 'Wan 2.1 / HunyuanVideo (via ComfyUI)', lic: 'os', u: 'https://github.com/comfyanonymous/ComfyUI', d: 'Vidéo générée par IA, en local si la carte graphique suit.' },
  { c: 'video', n: 'Runway', lic: 'fm', u: 'https://runwayml.com', d: 'Vidéo générative en ligne.' },
  { c: 'video', n: 'Luma Dream Machine', lic: 'fm', u: 'https://lumalabs.ai', d: 'Vidéo à partir d\'un texte ou d\'une image.' },
  { c: 'video', n: 'Kling', lic: 'fm', u: 'https://klingai.com', d: 'Vidéo générative réaliste.' },
  // Images
  { c: 'image', n: 'ComfyUI', lic: 'os', u: 'https://www.comfy.org', d: 'Le plus complet pour Stable Diffusion et Flux, en local. Clipia le connecte.' },
  { c: 'image', n: 'InvokeAI', lic: 'os', u: 'https://invoke.com', d: 'Interface claire pour créer des images en local.' },
  { c: 'image', n: 'Krita', lic: 'os', u: 'https://krita.org', d: 'Peinture numérique, avec extension IA.' },
  { c: 'image', n: 'GIMP', lic: 'os', u: 'https://www.gimp.org', d: 'Retouche photo.' },
  { c: 'image', n: 'Inkscape', lic: 'os', u: 'https://inkscape.org', d: 'Logos et illustrations vectorielles.' },
  { c: 'image', n: 'Canva', lic: 'fm', u: 'https://www.canva.com', d: 'Affiches, visuels réseaux, présentations.' },
  // Apps & sites
  { c: 'app', n: 'VS Code', lic: 'os', u: 'https://code.visualstudio.com', d: 'L\'éditeur de code de référence.' },
  { c: 'app', n: 'Bolt.diy', lic: 'os', u: 'https://github.com/stackblitz-labs/bolt.diy', d: 'Générer des applications web avec une IA, dans le navigateur.' },
  { c: 'app', n: 'Aider', lic: 'os', u: 'https://aider.chat', d: 'Un assistant de code dans le terminal, qui modifie ton projet.' },
  { c: 'app', n: 'Cline / Continue', lic: 'os', u: 'https://continue.dev', d: 'Assistants de code ouverts pour VS Code.' },
  { c: 'app', n: 'Vite + React', lic: 'os', u: 'https://vite.dev', d: 'Base moderne pour un site ou une application web.' },
  { c: 'app', n: 'Flutter', lic: 'os', u: 'https://flutter.dev', d: 'Une seule base de code pour Android, iPhone et ordinateur.' },
  { c: 'app', n: 'Tauri', lic: 'os', u: 'https://tauri.app', d: 'Transformer un site en application de bureau légère.' },
  { c: 'app', n: 'Supabase', lic: 'fm', u: 'https://supabase.com', d: 'Base de données, comptes utilisateurs, stockage.' },
  { c: 'app', n: 'GitHub Pages', lic: 'gr', u: 'https://pages.github.com', d: 'Publier un site gratuitement.' },
  { c: 'app', n: 'Netlify / Cloudflare Pages', lic: 'fm', u: 'https://www.netlify.com', d: 'Hébergement de sites avec adresse publique.' },
  // Agents
  { c: 'agents', n: 'n8n', lic: 'os', u: 'https://n8n.io', d: 'Automatisations visuelles reliant des centaines de services.' },
  { c: 'agents', n: 'Flowise', lic: 'os', u: 'https://flowiseai.com', d: 'Construire des agents et des chaînes IA en glisser-déposer.' },
  { c: 'agents', n: 'Langflow', lic: 'os', u: 'https://www.langflow.org', d: 'Flux d\'agents visuels.' },
  { c: 'agents', n: 'Dify', lic: 'os', u: 'https://dify.ai', d: 'Plateforme d\'applications IA et de workflows.' },
  { c: 'agents', n: 'CrewAI', lic: 'os', u: 'https://www.crewai.com', d: 'Équipes d\'agents qui se répartissent le travail.' },
  { c: 'agents', n: 'LangGraph', lic: 'os', u: 'https://www.langchain.com/langgraph', d: 'Agents avec mémoire et étapes contrôlées.' },
  { c: 'agents', n: 'OpenClaw', lic: 'os', u: '/openclaw.html', d: 'Agent autonome local. Exige Node.js 24.22 ou plus récent.' },
  // Voix
  { c: 'voix', n: 'Piper', lic: 'os', u: 'https://github.com/rhasspy/piper', d: 'Voix de synthèse hors ligne, rapide.' },
  { c: 'voix', n: 'Coqui XTTS', lic: 'os', u: 'https://github.com/coqui-ai/TTS', d: 'Synthèse vocale multilingue avec clonage.' },
  { c: 'voix', n: 'whisper.cpp', lic: 'os', u: 'https://github.com/ggml-org/whisper.cpp', d: 'Transcription hors ligne.' },
  { c: 'voix', n: 'ElevenLabs', lic: 'fm', u: 'https://elevenlabs.io', d: 'Voix très naturelles. Clipia le connecte.' },
  // 3D et jeux
  { c: 'jeux', n: 'Godot', lic: 'os', u: 'https://godotengine.org', d: 'Créer des jeux 2D et 3D, léger et gratuit.' },
  { c: 'jeux', n: 'Unity', lic: 'fm', u: 'https://unity.com', d: 'Moteur de jeu très répandu.' },
  { c: 'jeux', n: 'Blender', lic: 'os', u: 'https://www.blender.org', d: 'Modélisation et animation 3D.' },
  // Livres
  { c: 'livres', n: 'LibreOffice', lic: 'os', u: 'https://www.libreoffice.org', d: 'Textes, tableurs, présentations.' },
  { c: 'livres', n: 'Calibre', lic: 'os', u: 'https://calibre-ebook.com', d: 'Fabriquer et convertir des e-books.' },
  { c: 'livres', n: 'Scribus', lic: 'os', u: 'https://www.scribus.net', d: 'Mise en page pour l\'impression.' }
];
export const LIC = { os: 'Open source', gr: 'Gratuit', fm: 'Gratuit + options payantes', pa: 'Payant' };
