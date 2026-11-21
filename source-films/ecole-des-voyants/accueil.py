import json
p='/home/claude/clipia/liens.json'; d=json.load(open(p,encoding='utf-8'))
d['communaute']={'whatsapp_groupe':'','whatsapp_numero':'33751880650','note':"Colle dans whatsapp_groupe le lien d'invitation du groupe WhatsApp (https://chat.whatsapp.com/...) : le bouton du site l'utilisera automatiquement."}
json.dump(d,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2); open(p,'a').write('\n')
p='/home/claude/clipia/index.html'; s=open(p,encoding='utf-8').read()
N='https://github.com/fabriceclin02-glitch/clipia/releases/download/nova-v2.7.0/'
SEC=open('/home/claude/outils/accueil-sections.html',encoding='utf-8').read().replace('@N@',N)
a='<section id="video"'; assert s.count(a)==1
s=s.replace(a,SEC+a)
s=s.replace('Clipia Nova 2.7, le navigateur de Clipia','Clipia Nova 2.7, notre navigateur à nous')
open(p,'w',encoding='utf-8').write(s); print('ok')
