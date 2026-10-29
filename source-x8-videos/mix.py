import numpy as np, soundfile as sf, json, sys
v,pre=sys.argv[1],sys.argv[2]
T=json.load(open(f'TL_{v}.json')); sr=24000
N=int((T['end']+0.5)*sr); out=np.zeros(N)
m,msr=sf.read('/home/claude/lab/tts/music.wav'); 
if m.ndim>1: m=m.mean(1)
assert msr==sr, msr
mm=np.tile(m,int(N/len(m))+2)[:N]*0.16
fade=int(2*sr); mm[-fade:]*=np.linspace(1,0,fade); mm[:sr]*=np.linspace(0,1,sr)
out+=mm
for x in T['tl']:
    a,_=sf.read(f'/home/claude/lab/tts/{pre}_{x["id"]}.wav')
    i=int((x['t0']+0.15)*sr); e=min(N,i+len(a)); out[i:e]+=a[:e-i]*0.95
out/=max(1,np.abs(out).max()/0.95)
sf.write(f'audio_{v}.wav',out,sr)
