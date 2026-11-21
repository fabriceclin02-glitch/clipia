import numpy as np, soundfile as sf, sys
sr=44100; dur=float(sys.argv[1]); N=int(dur*sr); t=np.arange(N)/sr
def note(f): return 440*2**((f-69)/12)
# accords (midi) : Rém, Sib, Fa, Do — 10 s chacun
acc=[[50,57,62,65],[46,53,58,62],[41,53,57,60],[48,55,60,64]]
out=np.zeros(N); L=10.0
for k in range(int(dur/L)+1):
    a0=k*L; ch=acc[k%4]
    s=int(a0*sr); e=min(N,int((a0+L+3)*sr))
    if s>=N: break
    tt=t[s:e]-a0
    env=np.minimum(1,tt/3.5)*np.exp(-np.maximum(0,tt-L+1)/1.5)
    for m in ch:
        f=note(m)
        out[s:e]+=env*(np.sin(2*np.pi*f*tt)*.5+np.sin(2*np.pi*f*2.003*tt)*.12+np.sin(2*np.pi*f*.5*tt)*.25)*.08
# pulsation de cœur grave toutes les 1,6 s
for b in np.arange(4,dur-4,1.6):
    for dd in (0,.28):
        s=int((b+dd)*sr); n=int(.35*sr)
        if s+n<N:
            tt=np.arange(n)/sr; out[s:s+n]+=np.sin(2*np.pi*48*tt)*np.exp(-tt*14)*(.35 if dd==0 else .22)
# réverbération simple
ir=np.random.default_rng(1).normal(size=int(2.8*sr))*np.exp(-np.arange(int(2.8*sr))/sr*2.2)*.02
rev=np.convolve(out,ir)[:N]
mix=out*.8+rev
fade=int(4*sr); mix[:fade]*=np.linspace(0,1,fade); mix[-fade:]*=np.linspace(1,0,fade)
mix/=np.abs(mix).max()/.8
sf.write('/home/claude/voyants/musique.wav',np.stack([mix,np.roll(mix,300)],1),sr)
print('ok',dur)
