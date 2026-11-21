"""Monte le film « L'École des Voyants » : scènes + mouvements de caméra + fondus + sous-titres + voix + musique."""
import json, subprocess, os, sys
D = '/home/claude/voyants'; SC = D + '/scenes'
T = json.load(open(D + '/timing.json', encoding='utf-8'))
caps = T['caps']; FIN = T['duree'] + 6.0   # carte finale tenue 6 s de plus
# scène → première légende
PLAN = [('01-terre', 0), ('02-voyant', 3), ('03-neurones', 9), ('04-bunkers', 14), ('05-film', 17), ('06-robots', 26),
        ('07-combat', 32), ('08-echecs', 36), ('09-appel', 44), ('10-grands-parents', 51), ('11-message', 57),
        ('12-clipia', 64), ('13-fous', 66), ('14-onde', 71), ('15-puce', 78), ('16-savants', 81), ('17-voiture', 86),
        ('18-question', 88), ('19-fin', None)]
debuts = []
for nom, c in PLAN:
    if c is None: debuts.append(caps[-1]['t1'] + 1.2)
    elif c == 0: debuts.append(0.0)
    else: debuts.append(caps[c]['t0'] - 0.5)
X = 1.2   # durée des fondus
FPS = 25
# mouvements de caméra (zoom avant, arrière, travellings)
MOUV = ['in', 'pg', 'out', 'pd', 'in', 'out', 'in', 'pd', 'out', 'in', 'pg', 'in', 'out', 'in', 'in', 'pd', 'pg', 'in', 'out']
entrees, filtres = [], []
for k, (nom, _) in enumerate(PLAN):
    d = (debuts[k + 1] if k + 1 < len(PLAN) else FIN) - debuts[k] + (X if k + 1 < len(PLAN) else 0)
    n = int(d * FPS) + 2
    m = MOUV[k]
    if m == 'in':   z, x, y = f"1.0+0.12*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif m == 'out': z, x, y = f"1.12-0.12*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif m == 'pg':  z, x, y = "1.12", f"(iw-iw/zoom)*(1-on/{n})", "ih/2-(ih/zoom/2)"
    else:            z, x, y = "1.12", f"(iw-iw/zoom)*on/{n}", "ih/2-(ih/zoom/2)"
    entrees += ['-loop', '1', '-framerate', str(FPS), '-t', f'{d:.3f}', '-i', f'{SC}/{nom}.png']
    filtres.append(f"[{k}:v]scale=3840:2160,zoompan=z='{z}':x='{x}':y='{y}':d=1:s=1280x720:fps={FPS},setsar=1,format=yuv420p[s{k}]")
# chaîne de fondus
prec = 's0'; cumul = 0.0
types = ['fade', 'fadeblack', 'fade', 'dissolve', 'fade', 'fadeblack', 'fade', 'fade', 'dissolve', 'fadeblack', 'fade', 'fade', 'dissolve', 'fade', 'fadeblack', 'fade', 'fade', 'fadeblack']
for k in range(1, len(PLAN)):
    dprec = debuts[k] - debuts[k - 1]
    cumul += dprec
    filtres.append(f"[{prec}][s{k}]xfade=transition={types[k-1]}:duration={X}:offset={cumul:.3f}[x{k}]")
    prec = f'x{k}'
# sous-titres ASS
def ts(s):
    h = int(s // 3600); m = int(s % 3600 // 60); sec = s % 60
    return f'{h}:{m:02d}:{sec:05.2f}'
ass = ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1280', 'PlayResY: 720', '',
       '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
       'Style: Def,Inter,25,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0.5,0,1,1.8,0,2,90,90,10,1',
       '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
for c in caps:
    txt = c['txt'].replace('\n', ' ')
    ass.append(f"Dialogue: 0,{ts(c['t0'])},{ts(c['t1']+0.25)},Def,,0,0,0,,{{\\fad(150,150)}}{txt}")
open(D + '/sous-titres.ass', 'w', encoding='utf-8').write('\n'.join(ass) + '\n')
# vtt pour le site
vtt = ['WEBVTT', '']
def tv(s): return f'{int(s//3600):02d}:{int(s%3600//60):02d}:{s%60:06.3f}'
for c in caps: vtt += [f"{tv(c['t0'])} --> {tv(c['t1']+0.25)}", c['txt'], '']
open(D + '/sous-titres.vtt', 'w', encoding='utf-8').write('\n'.join(vtt))
# étalonnage cinéma : format 2.39, grain, vignette, couleurs
filtres.append(f"[{prec}]eq=contrast=1.08:saturation=1.05:gamma=0.97,curves=r='0/0 0.5/0.52 1/1':b='0/0.04 0.5/0.5 1/0.95',"
               f"vignette=PI/4.5,noise=alls=6:allf=t,crop=1280:640:0:40,pad=1280:720:0:40:black,"
               f"subtitles={D}/sous-titres.ass,fade=t=in:st=0:d=1.5,fade=t=out:st={FIN-2:.2f}:d=2[v]")
nv = len(PLAN)
filtres.append(f"[{nv}:a]aformat=sample_rates=44100:channel_layouts=stereo,highpass=f=70,equalizer=f=3000:t=q:w=1:g=3,"
               f"aecho=0.8:0.6:40|70:0.18|0.12,adelay=0|0,volume=1.6[voix]")
filtres.append(f"[{nv+1}:a]volume=0.22[mus]")
filtres.append(f"[voix][mus]amix=inputs=2:duration=longest:normalize=0,atrim=0:{FIN:.2f},afade=t=out:st={FIN-3:.2f}:d=3,loudnorm=I=-16:TP=-1.5[a]")
sortie = sys.argv[1] if len(sys.argv) > 1 else D + '/Ecole-des-Voyants-film.mp4'
cmd = ['ffmpeg', '-v', 'error', '-y'] + entrees + ['-i', D + '/voix.wav', '-i', D + '/musique.wav',
       '-filter_complex', ';'.join(filtres), '-map', '[v]', '-map', '[a]', '-t', f'{FIN:.2f}',
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
       '-movflags', '+faststart', sortie]
print('durée', round(FIN, 1), 's ; scènes', len(PLAN))
r = subprocess.run(cmd)
print('code', r.returncode)
