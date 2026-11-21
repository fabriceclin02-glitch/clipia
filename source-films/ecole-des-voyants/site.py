import re
p='/home/claude/clipia/index.html'; s=open(p,encoding='utf-8').read()
s=s.replace('10.2.2','10.3.0').replace('GLM-5.2','GLM-5.3').replace('glm-5.2','glm-5.3')
s=s.replace("Sa sphère 3D, la voix « Kodi »","Sa sphère 3D, la voix « Clipia »")
# doublon d'identifiant
i=s.find('<section id="telephone"'); j=s.find('<section id="telephone"',i+10)
s=s[:j]+'<section id="appli-telephone"'+s[j+len('<section id="telephone"'):]
# styles
CSS='''.nova-ban{display:block;position:relative;z-index:5;text-align:center;padding:10px 16px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#d946ef,#8b5cf6,#3b82f6);background-size:300% 100%;animation:novaban 8s linear infinite;color:#fff;text-decoration:none;font-size:15px}
.nova-ban span{margin-left:8px;text-decoration:underline}
@keyframes novaban{to{background-position:300% 0}}
html.mob .nova-ban{animation:none}
.mods{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:22px}
.mod{border:1px solid #ffffff1f;border-radius:16px;padding:16px;background:linear-gradient(160deg,#1a1440cc,#0d1230cc)}
.mod h3{margin:0 0 4px;font-size:17px}.mod .par{font-size:12.5px;color:#9bb4ff;margin-bottom:8px}.mod ul{margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#dfe3ff}
.mod code{font-size:12px;color:#c9a0ff}.mod .gr{display:inline-block;font-size:11.5px;font-weight:700;color:#0b1a12;background:#7ee2d0;border-radius:99px;padding:1px 8px;margin-left:6px}
</style>'''
assert s.count('</style>')>=1; s=s.replace('</style>',CSS,1)
# onglets
a='<a class="l" href="#video">Vidéos</a>'
assert s.count(a)==1
s=s.replace(a,a+'<a class="l" href="nova.html" style="color:#f5d0fe;font-weight:800;white-space:nowrap;border:1px solid #d946ef88;border-radius:99px;padding:4px 10px">🌐 Clipia Nova</a><a class="l" href="#modeles" style="color:#9ff0c8;font-weight:700;white-space:nowrap">🧠 Nouveaux modèles</a>')
# bandeau
a='<main id="top">'; assert s.count(a)==1
s=s.replace(a,'<a href="nova.html" class="nova-ban">🚀 <b>Nouveau :</b> Clipia Nova 2.6, le navigateur de Clipia — VPN gratuit, mode Tor, fonctionne même sans internet, et les tout derniers modèles d’IA <span>Ouvrir l’onglet Clipia Nova →</span></a>\n'+a)
# section modèles après la vidéo
i=s.find('<section id="video"'); k=s.find('</div></section>',i)+len('</div></section>')
SEC='''

<section id="modeles"><div class="c">
  <div class="rv" style="text-align:center;margin-bottom:10px"><span class="etiq" style="border-color:#7ee2d0;color:#c9fff3"><b style="background:#7ee2d0;box-shadow:0 0 10px #7ee2d0"></b>NOUVEAU · Clipia X10 10.3 et Clipia Nova 2.6</span></div>
  <h2 class="rv" style="text-align:center">🧠 Les derniers modèles d’IA, déjà dans Clipia</h2>
  <p class="sous rv" style="margin-left:auto;margin-right:auto;text-align:center">Clipia X10 (ordinateur), l’appli téléphone et le navigateur Clipia Nova ont été mis à jour avec les modèles sortis cette année. Tu colles ta clé une fois, Clipia choisit le bon modèle. Les anciens noms retirés par les fournisseurs (Llama 3.3 sur Groq, <code>deepseek-chat</code>…) ont été remplacés pour que rien ne tombe en panne.</p>
  <div class="mods">
    <div class="mod rv"><h3>Claude</h3><div class="par">Anthropic</div><ul><li>Claude Fable 5.2</li><li>Claude Opus 5.5</li><li>Claude Sonnet 5.5</li><li>Claude Haiku 5.5</li></ul></div>
    <div class="mod rv"><h3>GPT-6</h3><div class="par">OpenAI</div><ul><li>GPT-6.2 Astra et GPT-6.2 Sol</li><li>GPT-6 Sol, GPT-6 Luna (économique)</li><li>Images : GPT Image 2.6</li></ul></div>
    <div class="mod rv"><h3>Gemini <span class="gr">clé gratuite</span></h3><div class="par">Google</div><ul><li>Gemini 4 Argon</li><li>Gemini 3.8 Flash</li><li>Gemini 3.5 Flash-Lite</li></ul></div>
    <div class="mod rv"><h3>GLM-5.3</h3><div class="par">Z.ai — en avant dans le menu</div><ul><li>GLM-5.3 : le meilleur de Z.ai en code et en agents</li><li>GLM-5.2 toujours disponible</li></ul></div>
    <div class="mod rv"><h3>Kimi K3</h3><div class="par">Moonshot AI — nouveau moteur</div><ul><li>Kimi K3 : modèle ouvert géant, contexte d’un million de jetons</li></ul></div>
    <div class="mod rv"><h3>DeepSeek V4</h3><div class="par">DeepSeek</div><ul><li>DeepSeek V4 Pro</li><li>DeepSeek V4 Flash</li></ul></div>
    <div class="mod rv"><h3>Groq <span class="gr">gratuit</span></h3><div class="par">ultra-rapide, clé gratuite</div><ul><li>GPT-OSS 120B (par défaut)</li><li>Qwen 3.6 27B</li><li>GPT-OSS 20B</li></ul></div>
    <div class="mod rv"><h3>Qwen 3.6 · Grok 4.6 · Mistral</h3><div class="par">Alibaba · xAI · Mistral AI 🇫🇷</div><ul><li>Qwen 3.6 Plus et Max</li><li>Grok 4.6</li><li>Mistral Medium 3.5, Small 4</li></ul></div>
    <div class="mod rv"><h3>Sur ton PC <span class="gr">gratuit</span></h3><div class="par">Ollama, hors ligne</div><ul><li>Qwen 3.6 (27B, 35B)</li><li>Gemma 4 (E2B, E4B…)</li><li>Qwen 2.5 3B pour les PC à 8 Go</li></ul></div>
  </div>
  <p class="sous rv" style="margin:18px auto 0;text-align:center;font-size:13px">Les modèles payants se règlent chez leur fournisseur, avec ta propre clé. Les noms appartiennent à leurs propriétaires.</p>
</div></section>'''
s=s[:k]+SEC+s[k:]
open(p,'w',encoding='utf-8').write(s)
print('ok')
