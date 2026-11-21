import sys,json
# usage: remplacer.py fichier paires.json
p=sys.argv[1]; paires=json.load(open(sys.argv[2]))
s=open(p,encoding='utf-8').read(); n=0
for a,b in paires:
    if a in s: n+=s.count(a); s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s); print(p,n)
