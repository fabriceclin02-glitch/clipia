import sys,subprocess,os
from PIL import Image, ImageChops, ImageStat
f=sys.argv[1]; d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
tmp='/tmp/seg_'+os.path.basename(f); os.makedirs(tmp,exist_ok=True)
subprocess.run(['ffmpeg','-v','error','-y','-i',f,'-vf','fps=4,scale=160:90',f'{tmp}/%05d.png'])
fr=sorted(os.listdir(tmp)); ims=[Image.open(f'{tmp}/{x}').convert('L') for x in fr]
def diff(a,b): return ImageStat.Stat(ImageChops.difference(a,b)).mean[0]
ref1=ims[int(1.5*4)]; ref2=ims[int((d-2.5)*4)]
s1=[round(diff(i,ref1),1) for i in ims]; s2=[round(diff(i,ref2),1) for i in ims]
# intro: last index from start where diff<3 ; end: first index from end where diff<3
a=0
while a+1<len(ims) and s1[a+1]<4: a+=1
b=len(ims)-1
while b-1>0 and s2[b-1]<4: b-=1
print(f, 'durée',round(d,2),'intro jusqu’à',(a+1)/4,'fin depuis',b/4)
k=int((d-2.5)*4); b=k
while b-1>0 and s2[b-1]<4: b-=1
e=k
while e+1<len(ims) and s2[e+1]<4: e+=1
print('  carte de fin :',b/4,'→',(e+1)/4, ' | intro :',0,'→',(a+1)/4)
