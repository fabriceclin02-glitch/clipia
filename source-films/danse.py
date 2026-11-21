"""« Dansons ensemble » : toute la vie danse en harmonie. Images générées image par image (Pillow), musique originale (numpy)."""
import math, random, subprocess, numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H, FPS, DUREE = 1280, 720, 25, 72.0
EMO = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109)
B = '/usr/share/fonts/opentype/inter/'
T1 = ImageFont.truetype(B + 'Inter-ExtraBold.otf', 64); T2 = ImageFont.truetype(B + 'Inter-SemiBold.otf', 30)
cache = {}
def sprite(e, taille):
    k = (e, taille)
    if k not in cache:
        im = Image.new('RGBA', (160, 160)); ImageDraw.Draw(im).text((8, 8), e, font=EMO, embedded_color=True)
        cache[k] = im.crop(im.getbbox() or (0, 0, 160, 160)).resize((taille, taille), Image.LANCZOS)
    return cache[k]
PEUPLES = ['💃🏻', '🕺🏿', '💃🏽', '🕺🏼', '💃🏿', '🕺🏽', '💃🏼', '🕺🏻', '👯', '🧕🏽', '👳🏾', '🧑🏻‍🦱', '👩🏿‍🦳', '👴🏼', '👵🏽', '🧒🏿']
FOI = ['✝️', '☪️', '✡️', '🕉️', '☸️', '☯️', '☦️', '🪯', '🛐', '☮️', '🪷', '⛩️']
ANIMAUX = ['🐘', '🦒', '🦁', '🐬', '🐳', '🦓', '🐒', '🐧', '🦜', '🐢', '🐻', '🦘', '🐎', '🦩', '🐙']
INSECTES = ['🦋', '🐝', '🐞', '🐜', '🦗', '🐛', '🪲', '🪰', '🕷️', '🪳']
MICRO = ['⚛️', '🧬', '🧠', '🦠', '🌱', '🌸', '🌳', '💧', '🔥', '⭐']
random.seed(3)
etoiles = [(random.uniform(0, W), random.uniform(0, H * .7), random.uniform(.5, 1.8)) for _ in range(160)]
def fond(t):
    k = min(1, t / DUREE)
    haut = np.array([10, 8, 30]) * (1 - k) + np.array([40, 20, 80]) * k
    bas = np.array([25, 15, 70]) * (1 - k) + np.array([255, 150, 90]) * k
    g = np.linspace(0, 1, H)[:, None]
    arr = (haut * (1 - g) + bas * g).astype(np.uint8)
    im = Image.fromarray(np.repeat(arr[:, None, :], W, axis=1).reshape(H, W, 3), 'RGB')
    d = ImageDraw.Draw(im)
    for x, y, r in etoiles:
        a = int(180 * (0.6 + 0.4 * math.sin(t * 2 + x)))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(a, a, a))
    return im
def cercle(im, liste, cx, cy, rx, ry, taille, t, vitesse=.25, saut=18, phase=0):
    n = len(liste)
    for i, e in enumerate(liste):
        a = 2 * math.pi * i / n + t * vitesse + phase
        x = cx + math.cos(a) * rx; y = cy + math.sin(a) * ry - abs(math.sin(t * 4.2 + i)) * saut
        s = int(taille * (0.75 + 0.25 * (math.sin(a) + 1) / 2))
        sp = sprite(e, s).rotate(math.sin(t * 4.2 + i) * 12, expand=True, resample=Image.BICUBIC)
        im.paste(sp, (int(x - sp.width / 2), int(y - sp.height / 2)), sp)
def reseau(im, t, alpha):
    d = ImageDraw.Draw(im, 'RGBA'); pts = []
    for i in range(26):
        a = i * 2.39996; r = 120 + 230 * ((i * 37) % 26) / 26
        pts.append((640 + math.cos(a + t * .2) * r * 1.4, 330 + math.sin(a + t * .2) * r * .7))
    for i, p in enumerate(pts):
        for q in pts[i + 1:]:
            dd = math.dist(p, q)
            if dd < 230: d.line((p, q), fill=(255, 210, 122, int(alpha * 120 * (1 - dd / 230))), width=2)
        pulse = 4 + 3 * math.sin(t * 5 + i)
        d.ellipse((p[0] - pulse, p[1] - pulse, p[0] + pulse, p[1] + pulse), fill=(255, 230, 160, int(alpha * 255)))
def atome(im, cx, cy, r, t):
    d = ImageDraw.Draw(im, 'RGBA')
    for k in range(3):
        ang = k * math.pi / 3
        pts = [(cx + math.cos(u) * r * math.cos(ang) - math.sin(u) * r * .35 * math.sin(ang), cy + math.cos(u) * r * math.sin(ang) + math.sin(u) * r * .35 * math.cos(ang)) for u in np.linspace(0, 2 * math.pi, 60)]
        d.line(pts + [pts[0]], fill=(120, 200, 255, 200), width=3)
        u = t * 3 + k * 2
        ex = cx + math.cos(u) * r * math.cos(ang) - math.sin(u) * r * .35 * math.sin(ang); ey = cy + math.cos(u) * r * math.sin(ang) + math.sin(u) * r * .35 * math.cos(ang)
        d.ellipse((ex - 7, ey - 7, ex + 7, ey + 7), fill=(255, 255, 255, 255))
    d.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=(255, 120, 160, 255))
def texte(im, t1, t2, alpha):
    d = ImageDraw.Draw(im, 'RGBA')
    for txt, f, y, c in ((t1, T1, 60, (255, 210, 122)), (t2, T2, 140, (240, 240, 255))):
        if not txt: continue
        w = d.textlength(txt, font=f); d.text(((W - w) / 2 + 2, y + 2), txt, font=f, fill=(0, 0, 0, int(alpha * 150)))
        d.text(((W - w) / 2, y), txt, font=f, fill=c + (int(alpha * 255),))
def fondu(t, a, b, f=1.2):
    return max(0, min(1, (t - a) / f, (b - t) / f))
def image(t):
    im = fond(t); terre = sprite('🌍', 260)
    im.paste(terre, (W // 2 - 130, H - 150), terre)
    if t < 9:
        texte(im, 'Dansons ensemble', 'Toute la vie, sur Terre, en harmonie', fondu(t, 0.3, 9))
        cercle(im, ['🌍'], 640, 400, 0, 0, 200, t, 0, 10)
    if 7 < t < 26:
        a = fondu(t, 7, 26); texte(im, 'Tous les peuples, toutes les croyances', 'Main dans la main', a)
        cercle(im, FOI, 640, 400, 430, 170, 64, t, -.15, 8, 0.3); cercle(im, PEUPLES, 640, 420, 330, 120, 92, t, .3, 24)
    if 24 < t < 38:
        texte(im, 'Les animaux dansent aussi', '', fondu(t, 24, 38)); cercle(im, ANIMAUX, 640, 410, 470, 150, 96, t, .22, 30)
    if 36 < t < 49:
        texte(im, "Jusqu'au plus petit insecte", '', fondu(t, 36, 49)); cercle(im, INSECTES, 640, 380, 360, 190, 70, t, -.4, 40)
    if 47 < t < 61:
        a = fondu(t, 47, 61); reseau(im, t, a); atome(im, 300, 380, 110, t); atome(im, 980, 380, 110, t + 1)
        texte(im, 'Les atomes, les neurones, la vie', 'Tout est connecté', a); cercle(im, MICRO, 640, 390, 250, 110, 62, t, .35, 14)
    if t > 59:
        a = fondu(t, 59, DUREE + 5)
        cercle(im, FOI + PEUPLES, 640, 380, 520, 200, 56, t, .2, 16); cercle(im, ANIMAUX + INSECTES, 640, 400, 380, 120, 54, t, -.25, 20); cercle(im, MICRO, 640, 400, 200, 60, 46, t, .5, 10)
        texte(im, 'En parfaite harmonie', "L'École des Voyants · fabriceclin02-glitch.github.io/clipia", a)
    if t > DUREE - 1.5:
        im = Image.blend(im, Image.new('RGB', (W, H)), (t - (DUREE - 1.5)) / 1.5)
    return im
# musique originale : 120 bpm, Do - Sol - La m - Fa
sr = 44100; N = int(DUREE * sr); tt = np.arange(N) / sr; mus = np.zeros(N); bpm = 120; beat = 60 / bpm
def note(m): return 440 * 2 ** ((m - 69) / 12)
ACC = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]]; MEL = [72, 74, 76, 79, 76, 74, 72, 74, 76, 76, 74, 72, 71, 72, 74, 72]
for b in range(int(DUREE / beat)):
    s = int(b * beat * sr); n = int(.3 * sr); x = np.arange(min(n, N - s)) / sr
    mus[s:s + len(x)] += np.sin(2 * np.pi * (55 + 90 * np.exp(-x * 30)) * x) * np.exp(-x * 9) * .7  # grosse caisse
    h = int((b + .5) * beat * sr); m = int(.06 * sr)
    if h + m < N: mus[h:h + m] += np.random.default_rng(b).normal(size=m) * np.exp(-np.arange(m) / sr * 60) * .12  # charleston
    ch = ACC[(b // 4) % 4]; mesure = b % 4
    for k, mm in enumerate(ch):
        if mesure in (1, 3): mus[s:s + len(x)] += np.sign(np.sin(2 * np.pi * note(mm + 12) * x)) * np.exp(-x * 6) * .05
    bas = note(ch[0] - 12); mus[s:s + len(x)] += np.sin(2 * np.pi * bas * x) * np.exp(-x * 4) * .35
    if b >= 16 and b % 2 == 0:
        mf = note(MEL[(b // 2) % len(MEL)]); y = np.arange(min(int(beat * 2 * sr), N - s)) / sr
        mus[s:s + len(y)] += (np.sin(2 * np.pi * mf * y) + .3 * np.sin(4 * np.pi * mf * y)) * np.exp(-y * 2.5) * .12
f = int(2 * sr); mus[:f] *= np.linspace(0, 1, f); mus[-f:] *= np.linspace(1, 0, f); mus /= np.abs(mus).max() / .85
sf.write('/home/claude/danse/musique.wav', np.stack([mus, mus], 1), sr)
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', '/home/claude/danse/musique.wav',
                      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', '/home/claude/danse/Dansons-ensemble.mp4'], stdin=subprocess.PIPE)
for i in range(int(DUREE * FPS)):
    p.stdin.write(image(i / FPS).tobytes())
p.stdin.close(); p.wait(); print('ok', p.returncode)
