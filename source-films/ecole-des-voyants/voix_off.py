import re, json, wave, subprocess, os, sys
import numpy as np
from piper import PiperVoice
D='/home/claude/voyants'; os.makedirs(D+'/seg',exist_ok=True)
txt=open(D+'/texte.txt',encoding='utf-8').read().strip().split('\n')
caps=[]
for pi,par in enumerate(txt):
    phr=re.split(r'(?<=[.?!])\s+',par.strip())
    for ph in phr:
        if len(ph)<=115: caps.append((pi,ph)); continue
        # découpe aux virgules
        bouts=re.split(r'(?<=,)\s+',ph); cur=''
        for b in bouts:
            if cur and len(cur)+len(b)>105: caps.append((pi,cur)); cur=b
            else: cur=(cur+' '+b).strip()
        if cur: caps.append((pi,cur))
DIT={'IA':'I.A.','HK':'H.K.','TikToker':'Tik-Tokeur','Facebooker':'Facebookeur','YouTuber':'YouTubeur','1 mois':'un mois','2 mois':'deux mois','2 ans':'deux ans','10 ans':'dix ans','3 équations':'trois équations','3 jours':'trois jours','2026':'deux mille vingt-six','Clipia':'Clipia','eh ben':'eh bien','Et ben':'Eh bien','Ben,':'Bon,','soi-disant':'soi-disant'}
def oral(t):
    for a,b in DIT.items(): t=re.sub(r'\b'+re.escape(a)+r'\b',b,t)
    return t
v=PiperVoice.load('/home/claude/voix/fr-siwis-medium.onnx')
from piper import SynthesisConfig
cfg=SynthesisConfig(length_scale=1.02)
sr=v.config.sample_rate; out=[]; t=0.8; res=[]
out.append(np.zeros(int(0.8*sr),dtype=np.int16))
prev=0
for i,(pi,c) in enumerate(caps):
    if pi!=prev: out.append(np.zeros(int(1.0*sr),dtype=np.int16)); t+=1.0; prev=pi
    f=f'{D}/seg/{i:03d}.wav'
    with wave.open(f,'wb') as w: v.synthesize_wav(oral(c),w,syn_config=cfg)
    with wave.open(f) as w: a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16)
    d=len(a)/sr; res.append({'i':i,'p':pi,'t0':round(t,3),'t1':round(t+d,3),'txt':c})
    out.append(a); pause=0.45 if c.endswith(('.','?','!')) else 0.2
    out.append(np.zeros(int(pause*sr),dtype=np.int16)); t+=d+pause
out.append(np.zeros(int(2.5*sr),dtype=np.int16))
a=np.concatenate(out)
with wave.open(D+'/voix.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(a.tobytes())
json.dump({'sr':sr,'duree':len(a)/sr,'caps':res},open(D+'/timing.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(res),'légendes',round(len(a)/sr,1),'s')
