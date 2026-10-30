/**
 * CLIPIA — Registre unifié des fournisseurs IA.
 * Chaque entrée décrit COMMENT parler au fournisseur, pas seulement son nom.
 * kind: 'openai' (API compatible OpenAI) | 'anthropic' | 'gemini' | 'ollama'
 *       | 'image' | 'video' | 'audio' | 'stt' | 'music'
 * tier: 'cloud-payant' | 'cloud-gratuit' | 'local-gratuit'
 */
export const PROVIDERS = [
  // ── LLM texte / vision / code — cloud ───────────────────────────────────
  { id:'openai', label:'OpenAI', kind:'openai', tier:'cloud-payant', envKey:'OPENAI_API_KEY',
    base:'https://api.openai.com/v1', modalities:['texte','vision','code','image','audio'],
    models:['gpt-5','gpt-5-mini','gpt-4.1','gpt-4o','gpt-4o-mini','o3','o4-mini'],
    docs:'https://platform.openai.com/api-keys' },
  { id:'anthropic', label:'Anthropic Claude', kind:'anthropic', tier:'cloud-payant', envKey:'ANTHROPIC_API_KEY',
    base:'https://api.anthropic.com/v1', modalities:['texte','vision','code'],
    models:['claude-opus-4-5','claude-sonnet-4-5','claude-haiku-4-5'],
    docs:'https://console.anthropic.com/settings/keys' },
  { id:'gemini', label:'Google Gemini', kind:'gemini', tier:'cloud-payant', envKey:'GOOGLE_API_KEY',
    base:'https://generativelanguage.googleapis.com/v1beta', modalities:['texte','vision','audio','code','video'],
    models:['gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash','gemma-3-27b-it'],
    freeTier:true, docs:'https://aistudio.google.com/apikey' },
  { id:'gemini-gratuit', label:'Google Gemini gratuit (même clé AI Studio)', kind:'openai', tier:'cloud-gratuit', envKey:'GOOGLE_API_KEY',
    base:'https://generativelanguage.googleapis.com/v1beta/openai', modalities:['texte','code','vision'],
    models:['gemini-2.5-flash','gemini-2.5-flash-lite','gemma-3-27b-it','gemini-2.0-flash'],
    freeTier:true, docs:'https://aistudio.google.com/apikey' },
  { id:'mistral', label:'Mistral', kind:'openai', tier:'cloud-payant', envKey:'MISTRAL_API_KEY',
    base:'https://api.mistral.ai/v1', modalities:['texte','code','vision'],
    models:['mistral-large-latest','mistral-small-latest','codestral-latest','pixtral-large-latest'],
    freeTier:true, docs:'https://console.mistral.ai/api-keys' },
  { id:'deepseek', label:'DeepSeek', kind:'openai', tier:'cloud-payant', envKey:'DEEPSEEK_API_KEY',
    base:'https://api.deepseek.com/v1', modalities:['texte','code','raisonnement'],
    models:['deepseek-chat','deepseek-reasoner'], docs:'https://platform.deepseek.com/api_keys' },
  { id:'groq', label:'Groq (ultra-rapide)', kind:'openai', tier:'cloud-gratuit', envKey:'GROQ_API_KEY',
    base:'https://api.groq.com/openai/v1', modalities:['texte','code','audio'],
    models:['llama-3.3-70b-versatile','qwen/qwen3-32b','openai/gpt-oss-120b','llama-3.1-8b-instant'],
    freeTier:true, docs:'https://console.groq.com/keys' },
  { id:'openrouter', label:'OpenRouter (300+ modèles)', kind:'openai', tier:'cloud-payant', envKey:'OPENROUTER_API_KEY',
    base:'https://openrouter.ai/api/v1', modalities:['texte','vision','code'],
    models:['auto','meta-llama/llama-3.3-70b-instruct:free','deepseek/deepseek-r1:free','google/gemma-3-27b-it:free'],
    freeTier:true, docs:'https://openrouter.ai/keys' },
  { id:'together', label:'Together AI', kind:'openai', tier:'cloud-payant', envKey:'TOGETHER_API_KEY',
    base:'https://api.together.xyz/v1', modalities:['texte','image','code'],
    models:['meta-llama/Llama-3.3-70B-Instruct-Turbo','Qwen/Qwen2.5-72B-Instruct-Turbo'],
    freeTier:true, docs:'https://api.together.ai/settings/api-keys' },
  { id:'fireworks', label:'Fireworks AI', kind:'openai', tier:'cloud-payant', envKey:'FIREWORKS_API_KEY',
    base:'https://api.fireworks.ai/inference/v1', modalities:['texte','image','code'],
    models:['accounts/fireworks/models/llama-v3p3-70b-instruct'], docs:'https://fireworks.ai/account/api-keys' },
  { id:'xai', label:'xAI Grok', kind:'openai', tier:'cloud-payant', envKey:'XAI_API_KEY',
    base:'https://api.x.ai/v1', modalities:['texte','vision','code'],
    models:['grok-4','grok-3','grok-3-mini'], docs:'https://console.x.ai' },
  { id:'perplexity', label:'Perplexity (recherche web)', kind:'openai', tier:'cloud-payant', envKey:'PERPLEXITY_API_KEY',
    base:'https://api.perplexity.ai', modalities:['texte','recherche'],
    models:['sonar','sonar-pro','sonar-reasoning'], docs:'https://www.perplexity.ai/settings/api' },
  { id:'cohere', label:'Cohere', kind:'openai', tier:'cloud-payant', envKey:'COHERE_API_KEY',
    base:'https://api.cohere.ai/compatibility/v1', modalities:['texte','rag'],
    models:['command-a-03-2025','command-r-plus'], freeTier:true, docs:'https://dashboard.cohere.com/api-keys' },
  { id:'qwen', label:'Qwen / Alibaba', kind:'openai', tier:'cloud-payant', envKey:'QWEN_API_KEY',
    base:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', modalities:['texte','vision','code'],
    models:['qwen-max','qwen-plus','qwen-vl-max'], docs:'https://dashscope.console.aliyun.com' },
  { id:'huggingface', label:'Hugging Face', kind:'openai', tier:'cloud-gratuit', envKey:'HUGGINGFACE_API_KEY',
    base:'https://router.huggingface.co/v1', modalities:['texte','image','audio'],
    models:['meta-llama/Llama-3.3-70B-Instruct'], freeTier:true, docs:'https://huggingface.co/settings/tokens' },

  // ── Sans clé, sans compte — utilisable immédiatement ────────────────────

  // ── GRATUIT AVEC UN SIMPLE COMPTE — aucune carte bancaire demandée ──────
  // Ces fournisseurs offrent un niveau gratuit réel et durable, pas un essai
  // de sept jours. Une clé suffit, et elle s’obtient en deux minutes.
  { id:'github-models', label:'GitHub Models (gratuit avec un compte GitHub)', kind:'openai',
    tier:'cloud-gratuit', envKey:'GITHUB_TOKEN',
    base:'https://models.inference.ai.azure.com', modalities:['texte','vision','code'],
    models:['gpt-4o','gpt-4o-mini','Phi-3.5-MoE-instruct','Meta-Llama-3.1-70B-Instruct',
            'Mistral-large-2407','Cohere-command-r-plus'],
    freeTier:true, docs:'https://github.com/settings/tokens',
    note:'Le plus généreux du lot : un jeton GitHub classique suffit et donne accès à GPT-4o, Llama 70B et Phi. Cocher aucune permission particulière, un jeton vide convient.' },

  { id:'cerebras', label:'Cerebras (le plus rapide du marché)', kind:'openai',
    tier:'cloud-gratuit', envKey:'CEREBRAS_API_KEY',
    base:'https://api.cerebras.ai/v1', modalities:['texte','code'],
    models:['llama-3.3-70b','llama3.1-8b','qwen-3-32b'],
    freeTier:true, docs:'https://cloud.cerebras.ai',
    note:'Débit de plusieurs milliers de jetons par seconde — la réponse arrive d’un bloc. Niveau gratuit avec quota journalier.' },

  { id:'sambanova', label:'SambaNova (gratuit, rapide)', kind:'openai',
    tier:'cloud-gratuit', envKey:'SAMBANOVA_API_KEY',
    base:'https://api.sambanova.ai/v1', modalities:['texte','code','vision'],
    models:['Meta-Llama-3.3-70B-Instruct','Meta-Llama-3.1-8B-Instruct','Llama-3.2-11B-Vision-Instruct'],
    freeTier:true, docs:'https://cloud.sambanova.ai/apis',
    note:'Llama 70B gratuit avec un quota confortable, et un modèle de vision dans le lot.' },

  { id:'nvidia-nim', label:'NVIDIA NIM (crédits gratuits)', kind:'openai',
    tier:'cloud-gratuit', envKey:'NVIDIA_API_KEY',
    base:'https://integrate.api.nvidia.com/v1', modalities:['texte','code','vision'],
    models:['meta/llama-3.3-70b-instruct','nvidia/llama-3.1-nemotron-70b-instruct',
            'deepseek-ai/deepseek-r1','qwen/qwen2.5-coder-32b-instruct'],
    freeTier:true, docs:'https://build.nvidia.com',
    note:'Crédits offerts à l’inscription, largement suffisants pour un usage personnel. Donne accès à DeepSeek R1 pour le raisonnement.' },

  { id:'cloudflare-ai', label:'Cloudflare Workers AI (quota gratuit quotidien)', kind:'openai',
    tier:'cloud-gratuit', envKey:'CLOUDFLARE_API_TOKEN',
    base:'https://api.cloudflare.com/client/v4/accounts/{compte}/ai/v1', modalities:['texte','image','code'],
    models:['@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/meta/llama-3.1-8b-instruct',
            '@cf/black-forest-labs/flux-1-schnell'],
    freeTier:true, besoinCompte:true, docs:'https://dash.cloudflare.com/profile/api-tokens',
    note:'Quota gratuit renouvelé chaque jour, texte et images. Il faut aussi l’identifiant de compte Cloudflare, à coller dans le champ prévu.' },

  { id:'glhf', label:'Scaleway Generative APIs (gratuit en bêta)', kind:'openai',
    tier:'cloud-gratuit', envKey:'SCALEWAY_API_KEY',
    base:'https://api.scaleway.ai/v1', modalities:['texte','code'],
    models:['llama-3.3-70b-instruct','qwen2.5-coder-32b-instruct','pixtral-12b-2409'],
    freeTier:true, docs:'https://console.scaleway.com',
    note:'Hébergé en France, données en Europe. Utile si tu veux que rien ne sorte de l’Union.' },

  // ── SANS AUCUNE CLÉ — fonctionne dès l’installation ─────────────────────
  { id:'pollinations-audio', label:'Pollinations Voix (sans clé)', kind:'audio', tier:'sans-cle',
    base:'https://text.pollinations.ai', sansCle:true, modalities:['audio','voix'],
    models:['openai-audio'],
    voix:['alloy','echo','fable','onyx','nova','shimmer','coral','verse'],
    docs:'https://pollinations.ai',
    note:'Synthèse vocale sans clé et sans compte. Clipia peut parler dès la première seconde.' },

  // ── ENTIÈREMENT HORS LIGNE, GRATUIT POUR TOUJOURS ──────────────────────
  { id:'piper', label:'Piper (voix hors ligne)', kind:'audio', tier:'local-gratuit',
    base:'local', modalities:['audio','voix'],
    models:['fr_FR-siwis-medium','fr_FR-upmc-medium','fr_FR-gilles-low'],
    docs:'https://github.com/rhasspy/piper',
    note:'Voix de synthèse française qui tourne sur ton processeur, sans réseau. Quelques dizaines de mégaoctets par voix.' },
  { id:'gpt4all', label:'GPT4All', kind:'openai', tier:'local-gratuit',
    base:'http://localhost:4891/v1', modalities:['texte','code'],
    models:['auto'], docs:'https://gpt4all.io',
    note:'Application de bureau simple, avec son propre serveur compatible OpenAI sur le port 4891.' },
  { id:'koboldcpp', label:'KoboldCpp', kind:'openai', tier:'local-gratuit',
    base:'http://localhost:5001/v1', modalities:['texte'],
    models:['auto'], docs:'https://github.com/LostRuins/koboldcpp',
    note:'Un seul exécutable, aucune installation. Pratique pour les modèles longs contextes.' },
  { id:'llamafile', label:'llamafile (un seul fichier)', kind:'openai', tier:'local-gratuit',
    base:'http://localhost:8080/v1', modalities:['texte','vision'],
    models:['auto'], docs:'https://github.com/Mozilla-Ocho/llamafile',
    note:'Le modèle et le moteur dans un unique fichier exécutable, qui marche sur Windows, Mac et Linux sans rien installer.' },

  { id:'pollinations', label:'Pollinations (sans clé)', kind:'openai', tier:'sans-cle',
    base:'https://text.pollinations.ai/openai', sansCle:true,
    modalities:['texte','code','vision'],
    models:['openai','openai-fast','mistral','llama','deepseek','qwen-coder'],
    docs:'https://pollinations.ai',
    note:'Service communautaire gratuit : aucun compte, aucune clé. En contrepartie, pas de garantie de disponibilité ni de confidentialité.' },
  { id:'pollinations-image', label:'Pollinations Images (sans clé)', kind:'image', tier:'sans-cle',
    base:'https://image.pollinations.ai', sansCle:true,
    modalities:['image'], models:['flux','turbo','kontext'],
    docs:'https://pollinations.ai',
    note:'Génération d\'images gratuite et immédiate, sans compte.' },

  // ── LLM locaux — 100 % gratuits, hors ligne ─────────────────────────────
  { id:'ollama', label:'Ollama (local)', kind:'ollama', tier:'local-gratuit', urlKey:'OLLAMA_URL',
    base:'http://127.0.0.1:11434', modalities:['texte','vision','code','embeddings'],
    models:['llama3.3','qwen2.5','mistral','gemma3','phi4','deepseek-r1','llava'],
    install:'https://ollama.com/download', probe:'/api/tags' },
  // Passerelle OpenClaw : son API compatible OpenAI est désactivée par défaut
  // (gateway.http.endpoints.chatCompletions.enabled) et exige un jeton. Le
  // champ « model » désigne un AGENT (openclaw, openclaw/default, openclaw/<id>),
  // pas un modèle de fournisseur.
  { id:'openclaw', label:'OpenClaw (passerelle locale)', kind:'openai', tier:'local-gratuit', urlKey:'OPENCLAW_URL',
    base:'http://127.0.0.1:18789/v1', modalities:['agent'], models:['openclaw/default'],
    install:'/openclaw.html', probe:'/models', jeton:true, envKey:'OPENCLAW_GATEWAY_TOKEN' },
  { id:'lmstudio', label:'LM Studio (local)', kind:'openai', tier:'local-gratuit', urlKey:'LMSTUDIO_URL',
    base:'http://127.0.0.1:1234/v1', modalities:['texte','vision','code','embeddings'],
    models:[], install:'https://lmstudio.ai', probe:'/models' },
  { id:'llamacpp', label:'llama.cpp (local)', kind:'openai', tier:'local-gratuit', urlKey:'LLAMACPP_URL',
    base:'http://127.0.0.1:8080/v1', modalities:['texte','code'], models:[],
    install:'https://github.com/ggml-org/llama.cpp', probe:'/models' },
  { id:'vllm', label:'vLLM (local/serveur)', kind:'openai', tier:'local-gratuit', urlKey:'VLLM_URL',
    base:'http://127.0.0.1:8000/v1', modalities:['texte','code'], models:[],
    install:'https://docs.vllm.ai', probe:'/models' },
  { id:'jan', label:'Jan.ai (local)', kind:'openai', tier:'local-gratuit', urlKey:'JAN_URL',
    base:'http://127.0.0.1:1337/v1', modalities:['texte','code'], models:[],
    install:'https://jan.ai', probe:'/models' },
  { id:'localai', label:'LocalAI (local)', kind:'openai', tier:'local-gratuit', urlKey:'LOCALAI_URL',
    base:'http://127.0.0.1:8080/v1', modalities:['texte','image','audio'], models:[],
    install:'https://localai.io', probe:'/models' },
  { id:'textgen', label:'Text-Gen WebUI (local)', kind:'openai', tier:'local-gratuit', urlKey:'TEXTGEN_URL',
    base:'http://127.0.0.1:5000/v1', modalities:['texte'], models:[],
    install:'https://github.com/oobabooga/text-generation-webui', probe:'/models' },

  // ── Image ───────────────────────────────────────────────────────────────
  { id:'openai-image', label:'OpenAI Images', kind:'image', tier:'cloud-payant', envKey:'OPENAI_API_KEY',
    base:'https://api.openai.com/v1', modalities:['image'], models:['gpt-image-1','dall-e-3'],
    docs:'https://platform.openai.com/api-keys' },
  { id:'stability', label:'Stability AI', kind:'image', tier:'cloud-payant', envKey:'STABILITY_API_KEY',
    base:'https://api.stability.ai', modalities:['image','upscale','vidéo'],
    models:['sd3.5-large','stable-image-ultra','stable-image-core'], docs:'https://platform.stability.ai/account/keys' },
  { id:'fal', label:'fal.ai (Flux, vidéo)', kind:'image', tier:'cloud-payant', envKey:'FAL_API_KEY',
    base:'https://fal.run', modalities:['image','vidéo','audio'],
    models:['fal-ai/flux/dev','fal-ai/flux-pro','fal-ai/kling-video'], docs:'https://fal.ai/dashboard/keys' },
  { id:'replicate', label:'Replicate', kind:'image', tier:'cloud-payant', envKey:'REPLICATE_API_TOKEN',
    base:'https://api.replicate.com/v1', modalities:['image','vidéo','audio','texte'],
    models:['black-forest-labs/flux-schnell','stability-ai/sdxl'], docs:'https://replicate.com/account/api-tokens' },
  { id:'comfyui', label:'ComfyUI (local)', kind:'image', tier:'local-gratuit', urlKey:'COMFYUI_URL',
    base:'http://127.0.0.1:8188', modalities:['image','vidéo'], models:[],
    install:'https://github.com/comfyanonymous/ComfyUI', probe:'/system_stats' },
  { id:'a1111', label:'Automatic1111 (local)', kind:'image', tier:'local-gratuit', urlKey:'AUTOMATIC1111_URL',
    base:'http://127.0.0.1:7860', modalities:['image'], models:[],
    install:'https://github.com/AUTOMATIC1111/stable-diffusion-webui', probe:'/sdapi/v1/sd-models' },

  // ── Vidéo ───────────────────────────────────────────────────────────────
  { id:'runway', label:'Runway', kind:'video', tier:'cloud-payant', envKey:'RUNWAY_API_KEY',
    base:'https://api.dev.runwayml.com/v1', modalities:['vidéo'],
    models:['gen4_turbo','gen3a_turbo'], docs:'https://dev.runwayml.com' },
  { id:'luma', label:'Luma Dream Machine', kind:'video', tier:'cloud-payant', envKey:'LUMA_API_KEY',
    base:'https://api.lumalabs.ai/dream-machine/v1', modalities:['vidéo'],
    models:['ray-2','ray-flash-2'], docs:'https://lumalabs.ai/api/keys' },
  { id:'ffmpeg', label:'FFmpeg (local, moteur de montage)', kind:'video', tier:'local-gratuit',
    base:'local', modalities:['vidéo','audio','montage'], models:[],
    install:'https://ffmpeg.org/download.html', probe:'bin' },

  // ── Audio / voix / musique / transcription ──────────────────────────────
  { id:'elevenlabs', label:'ElevenLabs (voix)', kind:'audio', tier:'cloud-payant', envKey:'ELEVENLABS_API_KEY',
    base:'https://api.elevenlabs.io/v1', modalities:['voix','doublage'],
    models:['eleven_multilingual_v2','eleven_turbo_v2_5'], freeTier:true, docs:'https://elevenlabs.io/app/settings/api-keys' },
  { id:'openai-tts', label:'OpenAI TTS', kind:'audio', tier:'cloud-payant', envKey:'OPENAI_API_KEY',
    base:'https://api.openai.com/v1', modalities:['voix'], models:['gpt-4o-mini-tts','tts-1-hd'] },
  { id:'openai-whisper', label:'OpenAI Whisper (transcription)', kind:'stt', tier:'cloud-payant', envKey:'OPENAI_API_KEY',
    base:'https://api.openai.com/v1', modalities:['transcription','paroles'], models:['whisper-1','gpt-4o-transcribe'] },
  { id:'whispercpp', label:'whisper.cpp (local)', kind:'stt', tier:'local-gratuit', urlKey:'WHISPERCPP_BIN',
    base:'local', modalities:['transcription','paroles'], models:['base','small','medium','large-v3'],
    install:'https://github.com/ggml-org/whisper.cpp', probe:'bin' },
  { id:'groq-whisper', label:'Groq Whisper (transcription rapide)', kind:'stt', tier:'cloud-gratuit', envKey:'GROQ_API_KEY',
    base:'https://api.groq.com/openai/v1', modalities:['transcription','paroles'],
    models:['whisper-large-v3','whisper-large-v3-turbo'], freeTier:true,
    docs:'https://console.groq.com/keys' },
  { id:'assemblyai', label:'AssemblyAI', kind:'stt', tier:'cloud-payant', envKey:'ASSEMBLYAI_API_KEY',
    base:'https://api.assemblyai.com/v2', modalities:['transcription'], models:['best'], docs:'https://www.assemblyai.com/app/account' },
  { id:'deepgram', label:'Deepgram', kind:'stt', tier:'cloud-payant', envKey:'DEEPGRAM_API_KEY',
    base:'https://api.deepgram.com/v1', modalities:['transcription'], models:['nova-3'], docs:'https://console.deepgram.com' },
  { id:'suno', label:'Suno (musique)', kind:'music', tier:'cloud-payant', envKey:'SUNO_API_KEY',
    base:'https://api.sunoapi.org/api/v1', modalities:['musique'], models:['V4','V4_5'], docs:'https://suno.com' },

  // ── Autres moteurs de texte (API compatible OpenAI) ───────────────────────
  { id:'cerebras', label:'Cerebras (ultra-rapide, offre gratuite)', kind:'openai', tier:'cloud-gratuit', envKey:'CEREBRAS_API_KEY',
    base:'https://api.cerebras.ai/v1', modalities:['texte','code'], models:['llama-3.3-70b','qwen-3-32b'], freeTier:true, docs:'https://cloud.cerebras.ai' },
  { id:'sambanova', label:'SambaNova (offre gratuite)', kind:'openai', tier:'cloud-gratuit', envKey:'SAMBANOVA_API_KEY',
    base:'https://api.sambanova.ai/v1', modalities:['texte','code'], models:['Meta-Llama-3.3-70B-Instruct','DeepSeek-R1'], freeTier:true, docs:'https://cloud.sambanova.ai' },
  { id:'nvidia', label:'NVIDIA NIM (crédits gratuits)', kind:'openai', tier:'cloud-gratuit', envKey:'NVIDIA_API_KEY',
    base:'https://integrate.api.nvidia.com/v1', modalities:['texte','code'], models:['meta/llama-3.3-70b-instruct','deepseek-ai/deepseek-r1'], freeTier:true, docs:'https://build.nvidia.com' },
  { id:'hyperbolic', label:'Hyperbolic', kind:'openai', tier:'cloud-payant', envKey:'HYPERBOLIC_API_KEY',
    base:'https://api.hyperbolic.xyz/v1', modalities:['texte','code'], models:['meta-llama/Llama-3.3-70B-Instruct','Qwen/Qwen2.5-72B-Instruct'], docs:'https://app.hyperbolic.xyz' },
  { id:'deepinfra', label:'DeepInfra', kind:'openai', tier:'cloud-payant', envKey:'DEEPINFRA_API_KEY',
    base:'https://api.deepinfra.com/v1/openai', modalities:['texte','code'], models:['meta-llama/Llama-3.3-70B-Instruct','Qwen/Qwen2.5-72B-Instruct'], docs:'https://deepinfra.com' },
  { id:'novita', label:'Novita AI', kind:'openai', tier:'cloud-payant', envKey:'NOVITA_API_KEY',
    base:'https://api.novita.ai/v3/openai', modalities:['texte','code'], models:['meta-llama/llama-3.3-70b-instruct','deepseek/deepseek-r1'], docs:'https://novita.ai' },
  { id:'moonshot', label:'Moonshot Kimi', kind:'openai', tier:'cloud-payant', envKey:'MOONSHOT_API_KEY',
    base:'https://api.moonshot.ai/v1', modalities:['texte','code'], models:['kimi-k2-0905-preview'], docs:'https://platform.moonshot.ai' },
  { id:'zai', label:'Z.ai GLM-5.2 (code et agents)', kind:'openai', tier:'cloud-payant', envKey:'ZAI_API_KEY',
    base:'https://api.z.ai/api/paas/v4', modalities:['texte','code','raisonnement'], models:['glm-5.2'], docs:'https://z.ai/manage-apikey/apikey-list',
    note:'Modèle ouvert de Z.ai (753 milliards de paramètres : trop gros pour ton PC, il tourne chez Z.ai). Payant à l\'usage avec TA clé, saisie dans Clipia. Très bon en code et en tâches longues.' },
  { id:'zhipu', label:'Zhipu GLM', kind:'openai', tier:'cloud-payant', envKey:'ZHIPU_API_KEY',
    base:'https://open.bigmodel.cn/api/paas/v4', modalities:['texte','code'], models:['glm-4-plus','glm-4-flash'], docs:'https://open.bigmodel.cn' },
  { id:'siliconflow', label:'SiliconFlow', kind:'openai', tier:'cloud-payant', envKey:'SILICONFLOW_API_KEY',
    base:'https://api.siliconflow.cn/v1', modalities:['texte','code'], models:['Qwen/Qwen2.5-72B-Instruct','deepseek-ai/DeepSeek-V3'], docs:'https://siliconflow.cn' },
  { id:'custom-openai', label:'Autre moteur (adresse compatible OpenAI)', kind:'openai', tier:'local-gratuit', urlKey:'CUSTOM_OPENAI_URL', envKey:'CUSTOM_OPENAI_KEY',
    base:'http://127.0.0.1:8000/v1', modalities:['texte','code'], models:[], docs:'' }
];

export const byId = id => PROVIDERS.find(p => p.id === id);
export const byKind = k => PROVIDERS.filter(p => p.kind === k);
export const byTier = t => PROVIDERS.filter(p => p.tier === t);
export const chatProviders = () => PROVIDERS.filter(p => ['openai','anthropic','gemini','ollama'].includes(p.kind));

/** Base URL effective (override .env pour les locaux). */
export function baseUrl(p) {
  if (p.urlKey && process.env[p.urlKey]) {
    const u = process.env[p.urlKey].replace(/\/$/, '');
    if (p.kind === 'openai' && !u.endsWith('/v1')) return u + '/v1';
    return u;
  }
  return p.base;
}
