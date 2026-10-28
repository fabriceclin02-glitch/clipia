# Clipia — premier démarrage

## 1. Lancer

```bash
node server/index.js
```
→ http://127.0.0.1:8787

## 2. Choisir votre voie

### Voie gratuite (recommandée pour commencer)

Aucun abonnement, aucune clé, tout reste chez vous.

```bash
# Le cerveau : écrit les scénarios
curl -fsSL https://ollama.com/install.sh | sh   # ou https://ollama.com/download sur Windows
ollama pull llama3.2
ollama serve
```

```bash
# Les yeux : génère les visuels
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI && pip install -r requirements.txt && python main.py
```

Dans Clipia → **IA locales**, les deux apparaissent en vert. Vous pouvez produire des clips illimités.

### Voie cloud

Dans Clipia → **Coffre de clés**, collez au minimum :

| Pour | Clé | Où l'obtenir | Coût indicatif |
|---|---|---|---|
| Scénarios | Google Gemini | aistudio.google.com/apikey | palier gratuit généreux |
| Scénarios rapides | Groq | console.groq.com/keys | palier gratuit |
| Visuels | fal.ai | fal.ai/dashboard/keys | ~0,02 €/image |
| Paroles | OpenAI | platform.openai.com/api-keys | ~0,006 €/minute |

## 3. Premier clip

1. **Musique → Clip**
2. Déposez un MP3
3. Style visuel : décrivez l'ambiance en une phrase
4. Format : TikTok si vous visez le vertical
5. Moteurs : scénariste, images, et transcription si vous voulez le karaoké
6. **Lancer la production**

La barre de progression suit les sept étapes en direct. Le clip apparaît dans la page et dans la Médiathèque.

## 4. Publier automatiquement

**Connecteurs** → YouTube → *Connecter*.

Avant cela, créez l'application OAuth dans la console du service (le bouton *Console* vous y emmène) et déclarez l'URL de redirection affichée en haut de la page. Collez `client_id` et `client_secret` dans le **Coffre**.

## 5. Encaisser des abonnements

1. Compte Stripe → Produits → créez trois tarifs récurrents (12 €, 29 €, 79 €)
2. **Coffre** → collez la clé secrète et les trois identifiants `price_…`
3. Stripe → Webhooks → ajoutez `https://votre-domaine/api/webhooks/stripe`, événements `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`
4. Collez le secret `whsec_…` dans le Coffre

En local, pour tester : `stripe listen --forward-to 127.0.0.1:8787/api/webhooks/stripe`

## Problèmes fréquents

| Symptôme | Cause | Solution |
|---|---|---|
| « Clé manquante pour … » | Fournisseur non configuré | Coffre de clés, ou choisissez un moteur local |
| Montage qui échoue | FFmpeg absent | `ffmpeg -version` ; installez-le |
| Ollama non détecté | Serveur arrêté | `ollama serve` dans un terminal |
| OAuth : `redirect_uri_mismatch` | URL non déclarée | Recopiez exactement l'URL affichée dans Connecteurs |
| Clip sans paroles | Aucun moteur de transcription | Choisissez-en un dans « Transcription des paroles » |
