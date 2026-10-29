import json
TPL=open('tpl.html').read()
TPL=TPL.replace("sp.style.opacity=(t<CFG.S[1].t0-.3||t>CFG.S[CFG.S.length-1].t0-.2)?1:0;","sp.style.opacity=(t<CFG.S[1].t0-.3)?1:0;")
open('tpl.html','w').write(TPL)
D=lambda p:json.load(open(f'/home/claude/lab/tts/{p}_durees.json'))
dp,di=D('x8p'),D('x8i')
I=lambda n:f'file:///home/claude/lab/x8/x8-{n}.jpg'
P=[
{'id':'intro','k':'title','h':'CLIPIA X8','sub':'Crée des agents · Lance une entreprise autonome','top':330},
{'id':'voix','k':'shot','t':'Parle-lui, elle agit','n':'Écoute permanente, sphère 3D, dictée partout','imgs':[I('scene3d')],'chips':['<b>Écoute</b> en permanence','<b>Sphère 3D</b> plein écran qui te répond','<b>Dictée</b> dans tous les champs','Actions sur l’ordinateur <b>avec ton accord</b>']},
{'id':'agents','k':'shot','t':'Création d’agents','n':'Créer mon IA · Projets & agents','imgs':[I('moi'),I('agents')],'chips':['Décris l’agent : <b>voix ou clavier</b>','<b>Rôle</b> + compétences cochées','<b>Sous-agents</b> (2 niveaux)','<b>Workflows</b> et <b>projets</b>','Agents prêts : chef de projet, développeur, directeur artistique…']},
{'id':'atelier','k':'shot','t':'Une équipe d’agents pour ton application','n':'Atelier d’apps : site, appli ou jeu','imgs':[I('atelier')],'chips':['<b>Architecte</b> : planifie','<b>Codeur</b> : écrit les fichiers','<b>Testeur</b> : lance et vérifie','<b>Relecteur</b> : corrige']},
{'id':'entre','k':'shot','t':'Entreprise autonome avec des agents','n':'Lancer mon entreprise · chaque mission part en arrière-plan','imgs':[I('entreprise')],'chips':['Ton projet <b>en quelques mots</b>','<b>Étude de marché</b> locale','<b>Offre, prix</b>, rentabilité','<b>Site vitrine</b> et page de vente','<b>Contacts</b>, contenus, démarches']},
{'id':'accord','k':'cards','t':'Tu gardes la main','n':'Les agents préparent — c’est toi qui décides','cards':[{'h':'✓ Préparent','c':'ok','b':'Études, textes, sites, listes de contacts, plannings.'},{'h':'✗ N’envoient pas','c':'no','b':'Aucun message, e-mail ou DM sans ton accord.'},{'h':'✗ Ne publient pas','c':'no','b':'Aucune publication sans ton accord.'},{'h':'✗ Ne paient pas','c':'no','b':'Aucun paiement, aucun mot de passe saisi.'}],'foot':'Aucun revenu promis : les résultats dépendent de ton projet.'},
{'id':'travaux','k':'shot','t':'Travaux en arrière-plan et planification','n':'Suis l’avancement, répète les tâches','imgs':[I('travaux'),I('planning')],'chips':['<b>Missions</b> qui tournent seules','<b>Tâches planifiées</b> récurrentes','Briefing du matin, veille, contenus']},
{'id':'studio','k':'shot','t':'Studio, logithèque, OpenClaw','n':'Créer, installer, étendre','imgs':[I('studio'),I('musique'),I('logitheque'),I('openclaw')],'chips':['<b>Montage vidéo</b> par prompts','<b>Musique</b> par prompts','<b>Logiciels libres</b> en 1 clic','<b>Pont OpenClaw</b> : ses compétences']},
{'id':'tel','k':'shot','t':'Téléphone, MCP, sauvegarde','n':'Windows · Mac · Linux · Clipia OS','imgs':[I('telephone'),I('sauvegarde')],'chips':['<b>QR code</b> : Clipia sur ton téléphone','Serveur <b>MCP</b>','<b>Sauvegarde</b> complète de ton IA']},
{'id':'fin','k':'title','h':'Clipia X8','sub':'Gratuit · Windows, Mac, Linux, Clipia OS','url':'fabriceclin02-glitch.github.io/clipia','top':250,'fs':80},
]
for s in P: s['d']=dp[s['id']]
Ins=[
{'id':'intro','k':'title','h':'INSTALLER CLIPIA X8','sub':'Windows · Mac · Linux','top':330,'fs':72},
{'id':'dl','k':'cards','t':'1 · Télécharger','n':'Sur le site, section Télécharger — version 8.2.0','cards':[{'h':'Windows','b':'Installeur<code>Clipia-Setup-8.2.0-windows-x64.exe</code>'},{'h':'Portable','b':'Clé USB, sans installation<code>Clipia-Portable-8.2.0-windows-x64.zip</code>'},{'h':'macOS','b':'Zip à dézipper<code>Clipia-8.2.0-macos.zip</code>'},{'h':'Linux','b':'Debian, Ubuntu, Mint<code>clipia_8.2.0_amd64.deb</code>'}]},
{'id':'win','k':'lines','t':'2 · Windows','n':'Installeur : l’assistant s’ouvre tout seul','lines':['① Double-clique sur l’installeur','② Si Windows dit « protégé votre PC » : <b style="color:#ffd7a0">Informations complémentaires → Exécuter quand même</b>','③ <b style="color:#9ff0c8">Suivant → Installer → Terminer</b>','④ L’assistant plein écran s’ouvre']},
{'id':'mac','k':'lines','t':'3 · Mac et Linux','n':'Un geste par système','lines':['<b style="color:#ffd7a0">macOS</b> : dézippe → glisse <b>Clipia.app</b> dans Applications → <b>clic droit → Ouvrir</b> (premier lancement)','<b style="color:#ffd7a0">Linux</b> :<br><span class="code">sudo apt install ./clipia_8.2.0_amd64.deb</span>','puis lance <span class="code">clipia</span>']},
{'id':'cerveau','k':'shot','t':'4 · Donne un cerveau à Clipia','n':'Réglages de Clipia — jamais dans une conversation','imgs':[I('extensions')],'chips':['Clé <b>gratuite</b> (Groq…) collée dans <b>les réglages</b>','Ou un <b>modèle local</b> (Ollama)','Tes clés restent <b>chez toi</b>']},
{'id':'agents','k':'shot','t':'5 · Crée ton premier agent','n':'Créer mon IA · Lancer mon entreprise','imgs':[I('moi'),I('entreprise')],'chips':['<b>Créer mon IA</b> : un agent en une phrase','<b>Lancer mon entreprise</b> : missions en arrière-plan','<b>Accord</b> avant tout envoi, publication, paiement']},
{'id':'tel','k':'shot','t':'6 · Sur ton téléphone','n':'Pas d’appli sur les stores pour l’instant','imgs':[I('telephone')],'chips':['Scanne le <b>QR code</b>','Android (Chrome) : <b>Installer l’application</b>','iPhone (Safari) : Partager → <b>Sur l’écran d’accueil</b>']},
{'id':'fin','k':'title','h':'Clipia X8','sub':'Gratuit','url':'fabriceclin02-glitch.github.io/clipia','top':250,'fs':80},
]
for s in Ins: s['d']=di[s['id']]
M='Écrans réels de Clipia X8 ; déroulé mis en scène pour la démonstration'
for name,S in (('p',P),('i',Ins)):
    open(f'demo_{name}.html','w').write(TPL.replace('__CFG__',json.dumps({'S':S,'ment':M},ensure_ascii=False)))
    t=0.3;tl=[]
    for x in S:
        tl.append({'id':x['id'],'t0':t,'d':x['d']});t=t+x['d']+0.9
    json.dump({'tl':tl,'end':t-0.3-0.1+0.5-0.0},open(f'TL_{name}.json','w'))
    print(name,t+0.5)
