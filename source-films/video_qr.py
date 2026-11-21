"""Courte vidéo explicative : discuter avec Clipia depuis son téléphone (QR code)."""
import math, wave, subprocess, numpy as np, qrcode
from PIL import Image, ImageDraw, ImageFont
from piper import PiperVoice, SynthesisConfig
D = '/home/claude/qr'; W, H, FPS = 1280, 720, 25
PH = [("Discute avec Clipia depuis ton téléphone.", 0),
      ("Sur ton ordinateur, Windows, Mac ou Linux, ouvre Clipia, puis le menu Téléphone et MCP.", 1),
      ("Un QR code s'affiche à l'écran.", 1),
      ("Avec ton téléphone, Android ou iPhone, scanne-le.", 2),
      ("L'application Clipia s'ouvre, et se connecte toute seule à ton ordinateur.", 2),
      ("Tu écris, ou tu parles : c'est la Clipia de ton ordinateur qui te répond, avec toute sa puissance.", 3),
      ("À la maison, le même Wi-Fi suffit. En déplacement, active Tailscale, gratuit, depuis la Logithèque.", 4),
      ("La connexion est protégée par un jeton secret, et chaque action sur l'ordinateur demande ton accord.", 4),
      ("Clipia, partout avec toi.", 5)]
v = PiperVoice.load('/home/claude/voix/fr-siwis-medium.onnx'); cfg = SynthesisConfig(length_scale=1.05); sr = v.config.sample_rate
morceaux, t, segs = [np.zeros(int(.6 * sr), np.int16)], .6, []
for i, (txt, sc) in enumerate(PH):
    f = f'{D}/p{i}.wav'
    with wave.open(f, 'wb') as w: v.synthesize_wav(txt.replace('MCP', 'M.C.P.'), w, syn_config=cfg)
    with wave.open(f) as w: a = np.frombuffer(w.readframes(w.getnframes()), np.int16)
    segs.append((t, t + len(a) / sr, txt, sc)); morceaux += [a, np.zeros(int(.5 * sr), np.int16)]; t += len(a) / sr + .5
morceaux.append(np.zeros(int(1.5 * sr), np.int16)); voix = np.concatenate(morceaux); DUREE = len(voix) / sr
with wave.open(f'{D}/voix.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(voix.tobytes())
EMO = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109); B = '/usr/share/fonts/opentype/inter/'
F1, F2, F3 = (ImageFont.truetype(B + n, s) for n, s in (('Inter-ExtraBold.otf', 52), ('Inter-SemiBold.otf', 26), ('Inter-Medium.otf', 22)))
cache = {}
def emo(e, s):
    if (e, s) not in cache:
        im = Image.new('RGBA', (160, 160)); ImageDraw.Draw(im).text((8, 8), e, font=EMO, embedded_color=True)
        cache[(e, s)] = im.crop(im.getbbox()).resize((s, s), Image.LANCZOS)
    return cache[(e, s)]
qr = qrcode.make('https://fabriceclin02-glitch.github.io/clipia/app/').convert('RGB').resize((210, 210), Image.NEAREST)
def sphere(d, cx, cy, r, t):
    for i in range(140):
        y = 1 - i / 139 * 2; rr = math.sqrt(max(0, 1 - y * y)); a = i * 2.39996 + t
        x, z = math.cos(a) * rr, math.sin(a) * rr; s = 1.5 + (z + 1) * 1.6
        d.ellipse((cx + x * r - s, cy + y * r - s, cx + x * r + s, cy + y * r + s), fill=(int(150 + 60 * z), 120, 255))
def ecran(d, x, y, w, h, coul=(20, 24, 60)):
    d.rounded_rectangle((x, y, x + w, y + h), 18, fill=coul, outline=(124, 92, 255), width=4)
def bulle(d, x, y, txt, moi, a):
    l = d.textlength(txt, font=F3) + 30; x0 = x - l if moi else x
    d.rounded_rectangle((x0, y, x0 + l, y + 42), 14, fill=(90, 62, 240, a) if moi else (40, 46, 90, a)); d.text((x0 + 15, y + 9), txt, font=F3, fill=(255, 255, 255, a))
def image(t):
    sc = next((s[3] for s in reversed(segs) if t >= s[0] - .3), 0)
    im = Image.new('RGB', (W, H)); arr = np.linspace(0, 1, H)[:, None]
    im = Image.fromarray(np.repeat(((np.array([12, 10, 34]) * (1 - arr) + np.array([30, 20, 80]) * arr)).astype(np.uint8)[:, None, :], W, 1)); d = ImageDraw.Draw(im, 'RGBA')
    # ordinateur
    ecran(d, 140, 170, 560, 340); d.rectangle((380, 510, 460, 560), fill=(60, 64, 90)); d.rectangle((300, 560, 540, 575), fill=(60, 64, 90))
    if sc <= 0 or sc >= 3: sphere(d, 420, 340, 110, t)
    if sc in (1, 2):
        d.text((170, 190), 'Clipia · Téléphone & MCP', font=F2, fill=(255, 210, 122)); im.paste(qr, (315, 240))
    # téléphone
    px = 880 + (0 if sc >= 2 else 60 * math.sin(t))
    ecran(d, px, 140, 250, 460, (14, 16, 40)); d.rounded_rectangle((px + 95, 155, px + 155, 165), 5, fill=(60, 64, 90))
    if sc == 2:
        d.rectangle((px + 30, 230, px + 220, 420), outline=(67, 230, 168), width=4); y = 230 + (math.sin(t * 3) + 1) * 95
        d.line((px + 30, y, px + 220, y), fill=(67, 230, 168), width=3)
    if sc >= 3:
        d.text((px + 20, 180), 'Clipia · Mon PC', font=F3, fill=(255, 210, 122))
        bulle(d, px + 235, 240, 'Bonjour Clipia !', True, 255); bulle(d, px + 15, 300, 'Je t’écoute !', False, 255)
        if sc >= 4: bulle(d, px + 235, 360, 'Fais-moi un clip', True, 255); bulle(d, px + 15, 420, 'C’est parti !', False, 255)
        for k in range(5):
            x = 700 + (t * 160 + k * 36) % 180; d.ellipse((x - 5, 355 - 5, x + 5, 355 + 5), fill=(124, 92, 255))
    if sc >= 4:
        lock = emo('🔒', 64); im.paste(lock, (608, 250), lock)
        d.text((560, 610), 'Wi-Fi à la maison · Tailscale en déplacement', font=F2, fill=(200, 210, 255))
    if sc == 5:
        d.rectangle((0, 0, W, H), fill=(0, 0, 0, 170)); sphere(d, 640, 250, 120, t)
        for txt, f, y, c in (('Clipia, partout avec toi', F1, 420, (255, 210, 122)), ('fabriceclin02-glitch.github.io/clipia', F2, 500, (255, 255, 255))):
            d.text(((W - d.textlength(txt, font=f)) / 2, y), txt, font=f, fill=c)
    # sous-titre
    s = next((x for x in segs if x[0] - .1 <= t <= x[1] + .4), None)
    if s and sc < 5:
        l = d.textlength(s[2], font=F3); d.rounded_rectangle(((W - l) / 2 - 14, 650, (W + l) / 2 + 14, 694), 10, fill=(0, 0, 0, 170)); d.text(((W - l) / 2, 660), s[2], font=F3, fill=(255, 255, 255))
    if t < 1: im = Image.blend(Image.new('RGB', (W, H)), im, t)
    if t > DUREE - 1: im = Image.blend(im, Image.new('RGB', (W, H)), t - (DUREE - 1))
    return im
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', f'{D}/voix.wav',
    '-filter_complex', f'[1:a]aformat=sample_rates=44100:channel_layouts=stereo,loudnorm=I=-16[a]', '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', f'{D}/Clipia-Telephone-QR.mp4'], stdin=subprocess.PIPE)
for i in range(int(DUREE * FPS)): p.stdin.write(image(i / FPS).tobytes())
p.stdin.close(); p.wait(); print('ok', round(DUREE, 1), 's', p.returncode)
