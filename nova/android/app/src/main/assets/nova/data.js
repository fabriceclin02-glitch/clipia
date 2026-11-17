// Données de Clipia Nova : moteurs IA, modes Clipia, messageries, Store.
window.NOVA_DATA = {
  providers: {
    anthropic:  { name: 'Claude', by: 'Anthropic', model: 'claude-sonnet-5-5', keyUrl: 'https://console.anthropic.com/settings/keys', free: false },
    openai:     { name: 'ChatGPT', by: 'OpenAI', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', free: false },
    gemini:     { name: 'Gemini', by: 'Google', model: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey', free: true },
    mistral:    { name: 'Mistral', by: 'Mistral AI 🇫🇷', model: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys', free: true },
    deepseek:   { name: 'DeepSeek', by: 'DeepSeek', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', free: false },
    groq:       { name: 'Groq', by: 'Llama, Qwen…', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', free: true },
    xai:        { name: 'Grok', by: 'xAI', model: 'grok-3-mini', keyUrl: 'https://console.x.ai', free: false },
    zai:        { name: 'GLM', by: 'Z.ai', model: 'glm-5.2', keyUrl: 'https://z.ai/manage-apikey/apikey-list', free: false },
    openrouter: { name: 'OpenRouter', by: '300+ modèles', model: 'openrouter/auto', keyUrl: 'https://openrouter.ai/keys', free: true },
    ollama:     { name: 'Ollama', by: 'Local, sur ce PC', model: 'qwen2.5:3b', keyUrl: 'https://ollama.com/download', free: true, noKey: true }
  },

  modes: {
    ami:         { label: '😊 Ami', prompt: "Tu es Clipia, une IA chaleureuse et complice. Tu tutoies, tu réponds simplement et naturellement, en français." },
    entrepreneur:{ label: '💼 Entrepreneur', prompt: "Tu es Clipia en mode entrepreneur : concret, orienté résultats, chiffres et plans d'action. Réponds en français, de façon structurée." },
    createur:    { label: '🚀 Créateur de projet', prompt: "Tu es Clipia en mode créateur de projet : tu aides à transformer une idée en projet réel, étape par étape. Réponds en français." },
    studio:      { label: '🎬 Studio Clipia', prompt: "Tu es Clipia Studio, directeur artistique IA de CLENDAX : idées de clips musicaux, scénarios, plans, prompts d'images et de vidéos, accroches TikTok et YouTube. Réponds en français." },
    ecoute:      { label: '🫶 Écoute', prompt: "Tu es Clipia en mode écoute bienveillante. Tu écoutes, reformules et soutiens avec douceur. Tu n'es pas un professionnel de santé : en cas de détresse, tu orientes vers un médecin ou le 3114 (France)." },
    perso:       { label: '✏️ Mon style', prompt: '' }
  },

  mails: [
    { id: 'gmail', name: 'Gmail', ic: '📧', url: 'https://mail.google.com' },
    { id: 'outlook', name: 'Outlook / Hotmail', ic: '📨', url: 'https://outlook.live.com/mail/' },
    { id: 'yahoo', name: 'Yahoo Mail', ic: '💌', url: 'https://mail.yahoo.com' },
    { id: 'icloud', name: 'iCloud Mail', ic: '☁️', url: 'https://www.icloud.com/mail' },
    { id: 'proton', name: 'Proton Mail', ic: '🔐', url: 'https://mail.proton.me' },
    { id: 'orange', name: 'Orange', ic: '🟠', url: 'https://messagerie.orange.fr' },
    { id: 'sfr', name: 'SFR', ic: '🔴', url: 'https://webmail.sfr.fr' },
    { id: 'free', name: 'Free', ic: '⚪', url: 'https://webmail.free.fr' },
    { id: 'laposte', name: 'La Poste', ic: '🟡', url: 'https://www.laposte.net' }
  ],

  engines: {
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    duck: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    qwant: { name: 'Qwant 🇫🇷', url: 'https://www.qwant.com/?q=' },
    ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' }
  },

  store: [
    { id: 'communaute', cat: 'CLENDAX', ic: '💬', name: 'Clipia Communauté', by: 'CLENDAX', desc: 'Le chat en temps réel de la communauté : salons, messages privés chiffrés, un seul compte sur tous vos appareils.', url: 'https://fabriceclin02-glitch.github.io/clipia/communaute/', star: true },
    { id: 'clipia', cat: 'CLENDAX', ic: '🔮', name: 'Clipia', by: 'CLENDAX', desc: "L'IA personnelle façon Jarvis : conversation vocale, studio créatif, sphère 3D.", url: 'https://fabriceclin02-glitch.github.io/clipia/', star: true },
    { id: 'yt-fab', cat: 'CLENDAX', ic: '🎵', name: 'FABRICEclin Musique', by: 'CLENDAX', desc: 'Les morceaux CLENDAX sur YouTube.', url: 'https://www.youtube.com/@FABRICEclin', star: true },
    { id: 'tt-clx', cat: 'CLENDAX', ic: '🎬', name: 'CLENDAX TikTok', by: 'CLENDAX', desc: 'Les extraits et coulisses sur TikTok.', url: 'https://www.tiktok.com/@clendax08160', star: true },

    { id: 'claude', cat: 'IA', ic: '✳️', name: 'Claude', by: 'Anthropic', desc: "L'assistant IA d'Anthropic, version web.", url: 'https://claude.ai' },
    { id: 'chatgpt', cat: 'IA', ic: '🤖', name: 'ChatGPT', by: 'OpenAI', desc: "L'assistant d'OpenAI, version web.", url: 'https://chatgpt.com' },
    { id: 'gemini', cat: 'IA', ic: '♊', name: 'Gemini', by: 'Google', desc: "L'assistant IA de Google.", url: 'https://gemini.google.com' },
    { id: 'lechat', cat: 'IA', ic: '🐈', name: 'Le Chat', by: 'Mistral AI', desc: "L'assistant français de Mistral.", url: 'https://chat.mistral.ai' },
    { id: 'perplexity', cat: 'IA', ic: '🔎', name: 'Perplexity', by: 'Perplexity', desc: 'Moteur de réponses avec sources.', url: 'https://www.perplexity.ai' },

    { id: 'gmail', cat: 'Productivité', ic: '📧', name: 'Gmail', by: 'Google', desc: 'Votre messagerie Google.', url: 'https://mail.google.com' },
    { id: 'drive', cat: 'Productivité', ic: '📁', name: 'Google Drive', by: 'Google', desc: 'Vos fichiers en ligne.', url: 'https://drive.google.com' },
    { id: 'protonvpn', cat: 'VPN & sécurité', ic: '🛡', name: 'Proton VPN (gratuit)', by: 'Proton 🇨🇭', desc: 'VPN gratuit, sans publicité ni limite de données. Lancez-le : Nova passe par lui.', url: 'https://protonvpn.com/free-vpn', tool: true },
    { id: 'warp', cat: 'VPN & sécurité', ic: '☁️', name: 'Cloudflare WARP', by: 'Cloudflare', desc: 'Connexion chiffrée gratuite, simple et rapide.', url: 'https://one.one.one.one', tool: true },
    { id: 'bitwarden', cat: 'VPN & sécurité', ic: '🔑', name: 'Bitwarden', by: 'Bitwarden', desc: 'Gestionnaire de mots de passe gratuit.', url: 'https://vault.bitwarden.com', tool: true },
    { id: 'haveibeen', cat: 'VPN & sécurité', ic: '🕵️', name: 'Have I Been Pwned', by: 'Troy Hunt', desc: 'Vérifiez si votre e-mail a fuité.', url: 'https://haveibeenpwned.com', tool: true },
    { id: 'canva', tool: true, cat: 'Création', ic: '🎨', name: 'Canva', by: 'Canva', desc: 'Design, visuels et vidéos.', url: 'https://www.canva.com' },
    { id: 'notion', cat: 'Productivité', ic: '🗒', name: 'Notion', by: 'Notion', desc: 'Notes, projets et wikis.', url: 'https://www.notion.so' },
    { id: 'office', cat: 'Productivité', ic: '🪟', name: 'Microsoft 365', by: 'Microsoft', desc: 'Word, Excel, PowerPoint en ligne.', url: 'https://www.office.com' },

    { id: 'whatsapp', cat: 'Réseaux', ic: '💬', name: 'WhatsApp Web', by: 'Meta', desc: 'Vos discussions sur grand écran.', url: 'https://web.whatsapp.com' },
    { id: 'facebook', cat: 'Réseaux', ic: '📘', name: 'Facebook', by: 'Meta', desc: 'Le réseau social.', url: 'https://www.facebook.com', tool: true },
    { id: 'instagram', cat: 'Réseaux', ic: '📸', name: 'Instagram', by: 'Meta', desc: 'Photos et reels.', url: 'https://www.instagram.com', tool: true },
    { id: 'tiktok', cat: 'Réseaux', ic: '🎵', name: 'TikTok', by: 'TikTok', desc: 'Vidéos courtes.', url: 'https://www.tiktok.com', tool: true },
    { id: 'snapchat', cat: 'Réseaux', ic: '👻', name: 'Snapchat', by: 'Snap', desc: 'Snaps, stories et Spotlight.', url: 'https://web.snapchat.com', tool: true },
    { id: 'youtube-studio', cat: 'Réseaux', ic: '🎛', name: 'YouTube Studio', by: 'Google', desc: 'Publiez vos vidéos, suivez vos vues et abonnés.', url: 'https://studio.youtube.com', tool: true },
    { id: 'tiktok-studio', cat: 'Réseaux', ic: '🎙', name: 'TikTok Studio', by: 'TikTok', desc: 'Programmez vos vidéos et analysez vos stats.', url: 'https://www.tiktok.com/tiktokstudio', tool: true },
    { id: 'meta-suite', cat: 'Réseaux', ic: '📅', name: 'Meta Business Suite', by: 'Meta', desc: 'Programmez vos posts Facebook et Instagram.', url: 'https://business.facebook.com', tool: true },
    { id: 'linkedin', cat: 'Réseaux', ic: '💼', name: 'LinkedIn', by: 'Microsoft', desc: 'Le réseau professionnel.', url: 'https://www.linkedin.com' },

    { id: 'youtube', cat: 'Divertissement', ic: '▶️', name: 'YouTube', by: 'Google', desc: 'Vidéos et musique.', url: 'https://www.youtube.com', tool: true },
    { id: 'spotify', cat: 'Divertissement', ic: '🎧', name: 'Spotify', by: 'Spotify', desc: 'Musique et podcasts.', url: 'https://open.spotify.com' },
    { id: 'deezer', cat: 'Divertissement', ic: '🎶', name: 'Deezer', by: 'Deezer 🇫🇷', desc: 'Le streaming musical français.', url: 'https://www.deezer.com' },
    { id: 'arte', cat: 'Divertissement', ic: '📺', name: 'ARTE', by: 'ARTE', desc: 'Films, documentaires, replay gratuits.', url: 'https://www.arte.tv' },

    { id: 'maps', cat: 'Outils', ic: '🗺', name: 'Google Maps', by: 'Google', desc: 'Cartes et itinéraires.', url: 'https://maps.google.com' },
    { id: 'traduction', cat: 'Outils', ic: '🌍', name: 'DeepL', by: 'DeepL', desc: 'Traduction de qualité.', url: 'https://www.deepl.com/translator' },
    { id: 'meteo', cat: 'Outils', ic: '⛅', name: 'Météo-France', by: 'Météo-France', desc: 'Prévisions officielles.', url: 'https://meteofrance.com' },
    { id: 'wiki', cat: 'Outils', ic: '📚', name: 'Wikipédia', by: 'Wikimedia', desc: "L'encyclopédie libre.", url: 'https://fr.wikipedia.org' },

    { id: 'adobe-express', cat: 'Création', ic: '🅰️', name: 'Adobe Express', by: 'Adobe', desc: 'Affiches, posts et montages rapides avec modèles pros.', url: 'https://new.express.adobe.com', tool: true },
    { id: 'figma', cat: 'Création', ic: '🧩', name: 'Figma', by: 'Figma', desc: 'Maquettes d\'interfaces et de sites, en équipe.', url: 'https://www.figma.com', tool: true },
    { id: 'photopea', cat: 'Création', ic: '🖼', name: 'Photopea', by: 'Photopea', desc: 'Retouche façon Photoshop, directement dans le navigateur.', url: 'https://www.photopea.com', tool: true },
    { id: 'removebg', cat: 'Création', ic: '✂️', name: 'Remove.bg', by: 'Kaleido', desc: 'Détourez une photo en 5 secondes.', url: 'https://www.remove.bg', tool: true },
    { id: 'midjourney', cat: 'Création', ic: '🌌', name: 'Midjourney', by: 'Midjourney', desc: 'Images artistiques générées par IA.', url: 'https://www.midjourney.com', tool: true },
    { id: 'leonardo', cat: 'Création', ic: '🦁', name: 'Leonardo AI', by: 'Leonardo', desc: 'Images, visuels de produits et illustrations par IA.', url: 'https://leonardo.ai', tool: true },
    { id: 'ideogram', cat: 'Création', ic: '🔤', name: 'Ideogram', by: 'Ideogram', desc: 'Images IA avec du texte lisible : logos, affiches.', url: 'https://ideogram.ai', tool: true },
    { id: 'gamma', cat: 'Création', ic: '📊', name: 'Gamma', by: 'Gamma', desc: 'Présentations et sites générés par IA.', url: 'https://gamma.app', tool: true },

    { id: 'capcut', cat: 'Vidéo', ic: '🎞', name: 'CapCut', by: 'ByteDance', desc: 'Le montage vidéo des réseaux : sous-titres auto, effets, modèles.', url: 'https://www.capcut.com', tool: true },
    { id: 'clipchamp', cat: 'Vidéo', ic: '🎬', name: 'Clipchamp', by: 'Microsoft', desc: 'Montage vidéo gratuit en ligne.', url: 'https://app.clipchamp.com', tool: true },
    { id: 'runway', cat: 'Vidéo', ic: '🚀', name: 'Runway', by: 'Runway', desc: 'Génération et édition de vidéos par IA.', url: 'https://runwayml.com', tool: true },
    { id: 'kling', cat: 'Vidéo', ic: '🎥', name: 'Kling AI', by: 'Kuaishou', desc: 'Vidéos IA à partir d\'un texte ou d\'une image.', url: 'https://klingai.com', tool: true },
    { id: 'heygen', cat: 'Vidéo', ic: '🧑‍💼', name: 'HeyGen', by: 'HeyGen', desc: 'Présentateur virtuel qui parle à votre place.', url: 'https://www.heygen.com', tool: true },
    { id: 'descript', cat: 'Vidéo', ic: '📝', name: 'Descript', by: 'Descript', desc: 'Montez une vidéo comme on édite un texte.', url: 'https://www.descript.com', tool: true },
    { id: 'vimeo', cat: 'Vidéo', ic: '▶', name: 'Vimeo', by: 'Vimeo', desc: 'Hébergement vidéo sans pub, propre et pro.', url: 'https://vimeo.com', tool: true },

    { id: 'suno', cat: 'Musique', ic: '🎼', name: 'Suno', by: 'Suno', desc: 'Créez une chanson complète (voix + musique) à partir d\'une idée.', url: 'https://suno.com', tool: true },
    { id: 'udio', cat: 'Musique', ic: '🎹', name: 'Udio', by: 'Udio', desc: 'Musique générée par IA, tous les styles.', url: 'https://www.udio.com', tool: true },
    { id: 'elevenlabs', cat: 'Musique', ic: '🗣', name: 'ElevenLabs', by: 'ElevenLabs', desc: 'Voix off et voix IA ultra réalistes, en français.', url: 'https://elevenlabs.io', tool: true },
    { id: 'bandlab', cat: 'Musique', ic: '🎧', name: 'BandLab', by: 'BandLab', desc: 'Studio d\'enregistrement en ligne, gratuit.', url: 'https://www.bandlab.com', tool: true },
    { id: 'distrokid', cat: 'Musique', ic: '📀', name: 'DistroKid', by: 'DistroKid', desc: 'Diffusez vos titres sur Spotify, Deezer, Apple Music…', url: 'https://distrokid.com', tool: true },
    { id: 'tunecore', cat: 'Musique', ic: '💿', name: 'TuneCore', by: 'TuneCore', desc: 'Distribution musicale et suivi de vos revenus.', url: 'https://www.tunecore.fr', tool: true },
    { id: 'soundraw', cat: 'Musique', ic: '🎚', name: 'Soundraw', by: 'Soundraw', desc: 'Musiques libres de droits pour vos vidéos.', url: 'https://soundraw.io', tool: true },

    { id: 'hostinger', cat: 'Hébergement', ic: '🌐', name: 'Hostinger', by: 'Hostinger', desc: 'Hébergement web et nom de domaine à petit prix.', url: 'https://www.hostinger.fr', tool: true },
    { id: 'ovh', cat: 'Hébergement', ic: '🇫🇷', name: 'OVHcloud', by: 'OVHcloud 🇫🇷', desc: 'Domaines, hébergement et serveurs français.', url: 'https://www.ovhcloud.com/fr/', tool: true },
    { id: 'o2switch', cat: 'Hébergement', ic: '🇫🇷', name: 'o2switch', by: 'o2switch 🇫🇷', desc: 'Hébergement WordPress français, support réactif.', url: 'https://www.o2switch.fr', tool: true },
    { id: 'ionos', cat: 'Hébergement', ic: '🖥', name: 'IONOS', by: 'IONOS', desc: 'Hébergement, domaines et boutiques en ligne.', url: 'https://www.ionos.fr', tool: true },
    { id: 'namecheap', cat: 'Hébergement', ic: '🏷', name: 'Namecheap', by: 'Namecheap', desc: 'Réservez votre nom de domaine.', url: 'https://www.namecheap.com', tool: true },
    { id: 'cloudflare', cat: 'Hébergement', ic: '☁️', name: 'Cloudflare', by: 'Cloudflare', desc: 'Protection, DNS et accélération de votre site.', url: 'https://dash.cloudflare.com', tool: true },
    { id: 'netlify', cat: 'Hébergement', ic: '🔺', name: 'Netlify', by: 'Netlify', desc: 'Mettez un site en ligne en glissant un dossier.', url: 'https://app.netlify.com', tool: true },
    { id: 'vercel', cat: 'Hébergement', ic: '▲', name: 'Vercel', by: 'Vercel', desc: 'Déploiement de sites et d\'applications modernes.', url: 'https://vercel.com', tool: true },
    { id: 'github', cat: 'Hébergement', ic: '🐙', name: 'GitHub', by: 'GitHub', desc: 'Votre code et votre site gratuit avec GitHub Pages.', url: 'https://github.com', tool: true },

    { id: 'etsy', cat: 'Business', ic: '🛍', name: 'Etsy', by: 'Etsy', desc: 'Vendez des produits numériques et créatifs.', url: 'https://www.etsy.com', tool: true },
    { id: 'shopify', cat: 'Business', ic: '🏪', name: 'Shopify', by: 'Shopify', desc: 'Votre boutique en ligne complète.', url: 'https://www.shopify.com/fr', tool: true },
    { id: 'stripe', cat: 'Business', ic: '💳', name: 'Stripe', by: 'Stripe', desc: 'Encaissez des paiements en ligne.', url: 'https://dashboard.stripe.com', tool: true },
    { id: 'fiverr', cat: 'Business', ic: '🧑‍🎨', name: 'Fiverr', by: 'Fiverr', desc: 'Vendez vos services à des clients du monde entier.', url: 'https://fr.fiverr.com', tool: true },
    { id: 'malt', cat: 'Business', ic: '🤝', name: 'Malt', by: 'Malt 🇫🇷', desc: 'Missions freelance en France.', url: 'https://www.malt.fr', tool: true },
    { id: 'gbusiness', cat: 'Business', ic: '📍', name: 'Google Business', by: 'Google', desc: 'Soyez visible sur Google Maps : fiche, horaires, téléphone.', url: 'https://business.google.com', tool: true },
    { id: 'linktree', cat: 'Business', ic: '🔗', name: 'Linktree', by: 'Linktree', desc: 'Un seul lien pour tous vos réseaux.', url: 'https://linktr.ee', tool: true },
    { id: 'wordpress', cat: 'Business', ic: '📰', name: 'WordPress', by: 'WordPress', desc: 'Le CMS n°1 pour créer un site ou un blog.', url: 'https://wordpress.com/fr/', tool: true },
    { id: 'mailchimp', cat: 'Business', ic: '📣', name: 'Mailchimp', by: 'Intuit', desc: 'Newsletters et e-mailing.', url: 'https://mailchimp.com/fr/', tool: true }
  ]
  ,

  toolbox: [
    ['🔐 VPN & sécurité', ['protonvpn', 'warp', 'bitwarden', 'haveibeen']],
    ['📱 Réseaux & créateurs', ['youtube', 'tiktok', 'instagram', 'snapchat', 'facebook', 'youtube-studio', 'tiktok-studio', 'meta-suite']],
    ['🎨 Création', ['canva', 'adobe-express', 'figma', 'photopea', 'midjourney', 'removebg']],
    ['🎬 Vidéo', ['capcut', 'clipchamp', 'runway', 'kling', 'heygen', 'vimeo']],
    ['🎵 Musique & voix', ['suno', 'udio', 'elevenlabs', 'distrokid', 'bandlab', 'soundraw']],
    ['🌐 Hébergement & site', ['hostinger', 'ovh', 'o2switch', 'cloudflare', 'github', 'wordpress']],
    ['💼 Business', ['etsy', 'shopify', 'stripe', 'fiverr', 'gbusiness', 'linktree']]
  ],

  socials: [
    { id: 'communaute', name: 'Clipia Communauté', ic: '💬', color: 'linear-gradient(135deg,#3b82f6,#8b5cf6 55%,#d946ef)', url: 'https://fabriceclin02-glitch.github.io/clipia/communaute/', star: true, desktop: true },
    { id: 'facebook',  name: 'Facebook',  ic: 'f',  color: '#1877F2', url: 'https://m.facebook.com/', star: true },
    { id: 'instagram', name: 'Instagram', ic: '◎', color: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', url: 'https://www.instagram.com/', star: true },
    { id: 'tiktok',    name: 'TikTok',    ic: '♪', color: 'linear-gradient(135deg,#25F4EE,#000 45%,#FE2C55)', url: 'https://www.tiktok.com/', star: true },
    { id: 'whatsapp',  name: 'WhatsApp',  ic: '✆', color: '#25D366', url: 'https://web.whatsapp.com/', wide: true },
    { id: 'messenger', name: 'Messenger', ic: '✉', color: 'linear-gradient(45deg,#0099ff,#a033ff,#ff5280)', url: 'https://www.messenger.com/', star: true },
    { id: 'youtube',   name: 'YouTube',   ic: '▶', color: '#FF0000', url: 'https://m.youtube.com/' },
    { id: 'x',         name: 'X',         ic: '𝕏', color: '#111', url: 'https://x.com/' },
    { id: 'snapchat',  name: 'Snapchat',  ic: '👻', color: '#FFFC00', url: 'https://web.snapchat.com/', wide: true },
    { id: 'linkedin',  name: 'LinkedIn',  ic: 'in', color: '#0A66C2', url: 'https://www.linkedin.com/' },
    { id: 'pinterest', name: 'Pinterest', ic: 'P',  color: '#E60023', url: 'https://www.pinterest.fr/' }
  ],
  share: [
    { name: 'Facebook', ic: 'f', url: 'https://www.facebook.com/sharer/sharer.php?u={u}' },
    { name: 'WhatsApp', ic: '✆', url: 'https://api.whatsapp.com/send?text={t}%20{u}' },
    { name: 'Messenger', ic: '✉', url: 'https://www.facebook.com/dialog/send?link={u}&app_id=291494419107518&redirect_uri={u}' },
    { name: 'X', ic: '𝕏', url: 'https://x.com/intent/post?text={t}&url={u}' },
    { name: 'LinkedIn', ic: 'in', url: 'https://www.linkedin.com/sharing/share-offsite/?url={u}' },
    { name: 'Pinterest', ic: 'P', url: 'https://www.pinterest.fr/pin/create/button/?url={u}&description={t}' },
    { name: 'Telegram', ic: '➤', url: 'https://t.me/share/url?url={u}&text={t}' },
    { name: 'E-mail', ic: '@', url: 'mailto:?subject={t}&body={u}' }
  ],
  stt: {
    groq:   { name: 'Groq Whisper (gratuit)', keyUrl: 'https://console.groq.com/keys' },
    openai: { name: 'OpenAI Whisper', keyUrl: 'https://platform.openai.com/api-keys' }
  },

  shortcuts: [
    ['Clipia', [['Ctrl + Espace', 'Ouvrir / fermer le compagnon Clipia'], ['Ctrl + M', 'Parler à Clipia (micro)'], ['Ctrl + Maj + H', 'Mains libres : dites « Clipia… »'], ['Ctrl + J', 'Panneau Clipia'], ['Ctrl + Maj + V', 'Clipia parle / se tait'], ['Échap', 'Couper la voix, fermer']]],
    ['Onglets', [['Ctrl + T', 'Nouvel onglet'], ['Ctrl + Maj + N', 'Nouvel onglet Tor (.onion)'], ['Ctrl + W', 'Fermer l\'onglet'], ['Ctrl + Maj + T', 'Rouvrir l\'onglet fermé'], ['Ctrl + Tab', 'Onglet suivant'], ['Ctrl + Maj + Tab', 'Onglet précédent'], ['Ctrl + 1 … 9', 'Aller à l\'onglet n°']]],
    ['Navigation', [['Ctrl + L', 'Barre d\'adresse'], ['Alt + ← / →', 'Précédent / suivant'], ['F5 ou Ctrl + R', 'Recharger'], ['Alt + Origine', 'Accueil'], ['Ctrl + D', 'Ajouter aux favoris'], ['Ctrl + H', 'Historique et favoris']]],
    ['Page', [['Ctrl + F', 'Rechercher dans la page'], ['Ctrl + + / − / 0', 'Zoom avant / arrière / normal'], ['Ctrl + P', 'Imprimer'], ['F11', 'Plein écran']]],
    ['Clipia Nova', [['Ctrl + Maj + S', 'Store'], ['Ctrl + Maj + M', 'Mes mails'], ['Ctrl + ,', 'Réglages'], ['Ctrl + K', 'Demander à Clipia (palette)'], ['F1', 'Cette aide']]],
    ['Réseaux et outils', [['Ctrl + B', 'Réseaux sociaux (Facebook, Instagram, TikTok…)'], ['Ctrl + Maj + E', 'Partager la page'], ['Alt + R', 'Mode lecture'], ['Ctrl + Maj + X', 'Capture de la page'], ['Ctrl + Maj + P', 'Vidéo en image dans l\'image'], ['Ctrl + Maj + D', 'Dépannage de l\'ordinateur par Clipia']]]
  ]
};
