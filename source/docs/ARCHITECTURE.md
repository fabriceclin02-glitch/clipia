# Clipia — architecture

## Principe directeur

**Le serveur détient les secrets, le navigateur ne détient rien.** Chaque appel à un fournisseur IA, chaque échange OAuth, chaque opération de paiement part du serveur Node. Le front ne reçoit que des indices masqués et des résultats.

**Zéro dépendance npm côté serveur.** Node 20+ apporte `fetch`, `crypto`, `http`, `FormData` : tout le reste est écrit dans le projet. Conséquence pratique : pas de `npm install`, pas de chaîne de dépendances à auditer, pas de rupture après une mise à jour tierce, et un `git clone && node server/index.js` qui marche en 2026 comme en 2030.

## Flux d'une requête

```
Navigateur ──► /api/taches ──► File de tâches ──► Exécuteur
                                     │                 │
                                     │                 ├─► Passerelle IA ──► 37 fournisseurs
                                     │                 ├─► Pipeline clip ──► FFmpeg
                                     │                 └─► Publication ───► 29 connecteurs
                                     │
Navigateur ◄── SSE /flux ◄───────────┘  (progression en direct)
```

## Couches

### `server/lib/`
| Fichier | Rôle |
|---|---|
| `env.js` | Charge `.env`, génère et persiste la clé maîtresse et le secret de session au premier lancement |
| `vault.js` | Coffre AES-256-GCM. `resolve(id, envKey)` lit le coffre d'abord, puis l'environnement : une clé peut venir des deux sources sans changer le code appelant |
| `store.js` | Base JSON atomique (écriture dans un `.tmp` puis `rename`), écritures regroupées sur 25 ms |

### `server/providers/`
`registry.js` décrit **comment parler** à chaque moteur, pas seulement son nom. Le champ `kind` détermine la traduction :

| `kind` | Protocole | Couvre |
|---|---|---|
| `openai` | `/chat/completions` | OpenAI, Mistral, DeepSeek, Groq, OpenRouter, Together, Fireworks, xAI, Perplexity, Cohere, Qwen, HF, **LM Studio, llama.cpp, vLLM, Jan, LocalAI, Text-Gen** |
| `anthropic` | `/messages`, `x-api-key` | Claude |
| `gemini` | `:generateContent`, clé en query | Gemini |
| `ollama` | `/api/chat`, JSON-lines | Ollama |

`gateway.js` normalise tout : une seule fonction `chat()`, un seul format de streaming. Les quatre dialectes de streaming (SSE OpenAI, SSE Anthropic typé, SSE Gemini, JSON-lines Ollama) sont réduits à un flux de `{delta}` puis `{done}`.

`chatWithFallback(chaîne)` essaie les moteurs dans l'ordre — utile pour basculer sur Ollama quand un quota cloud est épuisé.

### `server/pipelines/music-to-clip.js`
Le cœur métier. Sept étapes, chacune utilisable seule :

1. `analyzeAudio` — `ffprobe` pour les métadonnées, puis `astats` échantillonné à 100 ms. Les pics d'énergie au-dessus de la moyenne + 4 dB donnent les onsets ; l'intervalle **médian** entre onsets (plus robuste que la moyenne face aux silences) donne le BPM, borné à 50–220 avec repli à 120.
2. `extractLyrics` — Whisper avec `timestamp_granularities[]=word`, ou whisper.cpp local avec `-ml 1`.
3. `storyboard` — le LLM reçoit durée, BPM et paroles, renvoie du JSON. Les bornes temporelles renvoyées sont **recalées de force** sur la durée réelle : un modèle local qui hallucine des timings ne casse pas le montage.
4. `renderScenes` — un visuel par plan, puis animation optionnelle.
5. Animation — soit un moteur image→vidéo distant avec attente du rendu, soit **Ken Burns local** : `zoompan` avec zoom progressif sur une source doublée en résolution pour éviter l'escalier de pixels. Gratuit et sans IA.
6. `buildKaraoke` — sous-titres ASS avec balises `\k` en centisecondes, regroupés par 6 mots ou 3,5 s, fondus de 120 ms.
7. `assemble` — segments encodés individuellement, concaténation par `concat demuxer` (copie sans réencodage), puis passe finale : sous-titres incrustés, `eq` léger, `vignette`, audio AAC, `+faststart` pour la lecture en flux.

### `server/jobs/`
File en mémoire avec persistance. Concurrence réglable (`CLIPIA_CONCURRENCY`, 2 par défaut : au-delà, FFmpeg sature le CPU). Chaque tâche expose `progress()` et `log()` ; les abonnés SSE reçoivent l'objet complet à chaque changement.

### `server/connectors/`
Un moteur OAuth générique pour 29 services. Les écarts entre plateformes sont absorbés par des champs de manifeste plutôt que par des conditions : `clientParam` (TikTok utilise `client_key`), `pkce`, `extraAuth` (`access_type=offline` chez Google, `duration=permanent` chez Reddit), `needsShop` (Shopify), séparateur de scopes (virgule chez TikTok, espace ailleurs).

### `server/billing/stripe.js`
API REST directe, pas de SDK. La vérification de webhook suit la spécification Stripe : HMAC-SHA256 sur `timestamp.payload`, comparaison à temps constant, rejet au-delà de 5 minutes.

## Choix techniques assumés

| Choix | Raison | Compromis |
|---|---|---|
| Stockage JSON | Zéro binaire natif, portable partout | À réécrire en SQLite ou Postgres au-delà de ~50 000 enregistrements |
| File en mémoire | Simplicité, pas de Redis | Les tâches en vol sont perdues au redémarrage |
| Pas de framework front | Pas de build, pas de node_modules, démarrage instantané | Pas de rendu réactif automatique |
| SSE plutôt que WebSocket | Unidirectionnel suffit, traverse mieux les proxys | Pas de canal montant |
| Secrets en fichier chiffré | Pas d'infrastructure à monter | En production multi-serveurs, préférer un gestionnaire de secrets dédié |

## Pour passer à l'échelle

1. `store.js` → Postgres (la surface d'API est volontairement minuscule : 7 méthodes)
2. `jobs/queue.js` → BullMQ + Redis, exécuteurs sur des machines séparées
3. Médias → S3 ou R2 avec URLs signées
4. Rendu vidéo → machines dédiées avec GPU, FFmpeg compilé avec NVENC
5. Authentification → multi-utilisateurs, aujourd'hui l'instance est mono-compte
