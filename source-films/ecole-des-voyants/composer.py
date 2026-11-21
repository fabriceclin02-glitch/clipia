import re
old=open('/home/claude/old-index.html',encoding='utf-8').read()
s=open('/home/claude/base-index.html',encoding='utf-8').read()
REN={'Clipia-X9-telephone.mp4':'Clipia-Telephone-demo.mp4','Clipia-X9-kodi.mp4':'Clipia-Kodi-demo.mp4','Clipia-X8-code.mp4':'Clipia-Code-demo.mp4',
     'img/poster-x9-telephone.jpg':'img/poster-telephone-demo.jpg','img/poster-x9-kodi.jpg':'img/poster-kodi-demo.jpg','img/poster-x8-code.jpg':'img/poster-code-demo.jpg'}
def bloc(v):
    i=old.find('<source src="'+v+'"'); j=old.rfind('<div class="vid2',0,i)
    k=old.find('</p>',old.find('download',i))+4
    b=old[j:k]
    for a,c in REN.items(): b=b.replace(a,c)
    return b+'\n  '
ANCRES=[('Clipia-X9-telephone.mp4',"tu peux revenir à l'interface d'origine à tout moment.</p>\n  "),
        ('Clipia-X9-kodi.mp4',"ça marche sur le téléphone ou sur ta télé.</p>\n"),
        ('Clipia-X8-code.mp4',"et ton accord pour tout ce qui est sensible.</p>\n  "),
        ('Clipia-Espace-demo.mp4',"(option désactivable). Scénario mis en scène.</p>\n"),
        ('Clipia-Tout-installer.mp4',"Ta propre clé Z.ai, payant à l'usage.</span></span></a>\n  ")]
for v,a in ANCRES:
    n=s.count(a); assert n==1,(v,n)
    s=s.replace(a,a+bloc(v))
open('/home/claude/clipia/index.html','w',encoding='utf-8').write(s)
print('ok', s.count('<video'))
