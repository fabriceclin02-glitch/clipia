"""Dessine les scènes du film « L'École des Voyants » (SVG 1920x1080) puis les photographie avec Chrome."""
import math, random, subprocess, os
D = '/home/claude/voyants/scenes'; os.makedirs(D, exist_ok=True)
W, H = 1920, 1080
OR = '#ffd27a'; ROSE = '#ff9fd4'; VIOLET = '#7c5cff'; BLEU = '#2f8cff'

DEFS = f'''<defs>
<radialGradient id="ciel" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1b1650"/><stop offset=".55" stop-color="#0b0b26"/><stop offset="1" stop-color="#03030c"/></radialGradient>
<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{OR}" stop-opacity=".9"/><stop offset=".35" stop-color="{OR}" stop-opacity=".25"/><stop offset="1" stop-color="{OR}" stop-opacity="0"/></radialGradient>
<radialGradient id="haloV" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9b7bff" stop-opacity=".8"/><stop offset="1" stop-color="#9b7bff" stop-opacity="0"/></radialGradient>
<radialGradient id="terre" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#5fb7ff"/><stop offset=".55" stop-color="#1d4fa8"/><stop offset="1" stop-color="#071433"/></radialGradient>
<radialGradient id="mars" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#ff9a5c"/><stop offset=".6" stop-color="#b3421c"/><stop offset="1" stop-color="#3a0d05"/></radialGradient>
<linearGradient id="corps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f6e"/><stop offset="1" stop-color="#121433"/></linearGradient>
<linearGradient id="corpsOr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3a1a"/><stop offset="1" stop-color="#17120a"/></linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9dde6"/><stop offset=".5" stop-color="#8a90a0"/><stop offset="1" stop-color="#3b3f4a"/></linearGradient>
<linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15123a"/><stop offset="1" stop-color="#05040f"/></linearGradient>
<linearGradient id="beton" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5f6b"/><stop offset="1" stop-color="#22242b"/></linearGradient>
<filter id="flou"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="lueur"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>'''

random.seed(7)
def etoiles(n=220, h=H):
    return ''.join(f'<circle cx="{random.uniform(0,W):.0f}" cy="{random.uniform(0,h):.0f}" r="{random.choice([.8,1,1.2,1.6,2.2])}" fill="#fff" opacity="{random.uniform(.25,.9):.2f}"/>' for _ in range(n))

def fond(extra=''):
    return f'<rect width="{W}" height="{H}" fill="url(#ciel)"/>{etoiles()}{extra}'

def personne(x, y, s=1.0, fill='url(#corps)', capuche=False, oeil=False, echarpe=None, chale=None, taille=1.0, op=1):
    """Silhouette humaine originale, pieds en (x,y)."""
    h = 300 * s * taille
    tete_r = 34 * s
    cy = y - h + tete_r
    g = f'<g opacity="{op}">'
    if oeil:
        g += f'<circle cx="{x}" cy="{cy}" r="{150*s}" fill="url(#halo)" opacity=".55"/>'
    # corps
    g += (f'<path d="M{x-62*s},{y} C{x-66*s},{y-110*s*taille} {x-58*s},{cy+70*s} {x-28*s},{cy+44*s} '
          f'L{x+28*s},{cy+44*s} C{x+58*s},{cy+70*s} {x+66*s},{y-110*s*taille} {x+62*s},{y} Z" fill="{fill}"/>')
    if chale:
        g += f'<path d="M{x-50*s},{cy+52*s} Q{x},{cy+120*s} {x+50*s},{cy+52*s} L{x+40*s},{cy+90*s} Q{x},{cy+150*s} {x-40*s},{cy+90*s}Z" fill="{chale}"/>'
    if echarpe:
        g += f'<path d="M{x-30*s},{cy+40*s} Q{x},{cy+62*s} {x+30*s},{cy+40*s} L{x+26*s},{cy+56*s} Q{x},{cy+78*s} {x-26*s},{cy+56*s}Z" fill="{echarpe}"/><path d="M{x+14*s},{cy+60*s} l{14*s},{70*s} l{12*s},-{4*s} l-{8*s},-{66*s}Z" fill="{echarpe}"/>'
    if capuche:
        g += f'<path d="M{x-48*s},{cy+52*s} Q{x-58*s},{cy-50*s} {x},{cy-52*s} Q{x+58*s},{cy-50*s} {x+48*s},{cy+52*s} Q{x},{cy+30*s} {x-48*s},{cy+52*s}Z" fill="#1a1740"/>'
        g += f'<ellipse cx="{x}" cy="{cy+6*s}" rx="{26*s}" ry="{30*s}" fill="#07061a"/>'
    else:
        g += f'<circle cx="{x}" cy="{cy}" r="{tete_r}" fill="{fill}"/>'
    if oeil:
        g += (f'<g filter="url(#lueur)"><ellipse cx="{x}" cy="{cy-4*s}" rx="{13*s}" ry="{7*s}" fill="{OR}"/>'
              f'<circle cx="{x}" cy="{cy-4*s}" r="{4*s}" fill="#fff"/></g>')
    return g + '</g>'

def robot(x, y, s=1.0, op=1):
    h = 330 * s
    top = y - h
    return (f'<g opacity="{op}"><rect x="{x-30*s}" y="{top}" width="{60*s}" height="{72*s}" rx="{26*s}" fill="url(#metal)"/>'
            f'<rect x="{x-24*s}" y="{top+22*s}" width="{48*s}" height="{18*s}" rx="{9*s}" fill="#0a0c12"/>'
            f'<rect x="{x-8*s}" y="{top+70*s}" width="{16*s}" height="{14*s}" fill="#6b7080"/>'
            f'<path d="M{x-58*s},{top+84*s} L{x+58*s},{top+84*s} L{x+48*s},{top+200*s} L{x-48*s},{top+200*s}Z" fill="url(#metal)"/>'
            f'<rect x="{x-72*s}" y="{top+90*s}" width="{16*s}" height="{120*s}" rx="{8*s}" fill="url(#metal)"/>'
            f'<rect x="{x+56*s}" y="{top+90*s}" width="{16*s}" height="{120*s}" rx="{8*s}" fill="url(#metal)"/>'
            f'<rect x="{x-40*s}" y="{top+202*s}" width="{30*s}" height="{128*s}" rx="{10*s}" fill="url(#metal)"/>'
            f'<rect x="{x+10*s}" y="{top+202*s}" width="{30*s}" height="{128*s}" rx="{10*s}" fill="url(#metal)"/></g>')

def sphere_clipia(cx, cy, r, n=260):
    g = f'<circle cx="{cx}" cy="{cy}" r="{r*1.9}" fill="url(#haloV)"/>'
    pts = []
    for i in range(n):
        yy = 1 - i / (n - 1) * 2; rr = math.sqrt(max(0, 1 - yy * yy)); a = i * 2.399963
        X, Z = math.cos(a) * rr, math.sin(a) * rr
        X2, Z2 = X * math.cos(.8) + Z * math.sin(.8), -X * math.sin(.8) + Z * math.cos(.8)
        Y3, Z3 = yy * math.cos(.35) - Z2 * math.sin(.35), yy * math.sin(.35) + Z2 * math.cos(.35)
        pts.append((Z3, X2, Y3))
    for Z3, X2, Y3 in sorted(pts):
        hue = 250 + (Z3 + 1) * 30
        g += f'<circle cx="{cx+X2*r:.1f}" cy="{cy+Y3*r:.1f}" r="{(1.4+(Z3+1)*1.6)*r/120:.2f}" fill="hsl({hue:.0f},90%,{62+Z3*14:.0f}%)" opacity="{.3+(Z3+1)*.35:.2f}"/>'
    g += f'<text x="{cx}" y="{cy+r*.09}" font-size="{r*.26}" font-weight="800" text-anchor="middle" fill="#fff" font-family="Inter" style="filter:drop-shadow(0 0 12px #a78bfa)">CLIPIA</text>'
    return g

def reseau(points, dist=260, couleur=OR, op=.5):
    g = ''
    for i, (a, b) in enumerate(points):
        for (c, d) in points[i + 1:]:
            dd = math.hypot(a - c, b - d)
            if dd < dist:
                g += f'<line x1="{a}" y1="{b}" x2="{c}" y2="{d}" stroke="{couleur}" stroke-width="1.6" opacity="{op*(1-dd/dist):.2f}"/>'
    for a, b in points:
        g += f'<circle cx="{a}" cy="{b}" r="5" fill="{couleur}" filter="url(#lueur)"/>'
    return g

def sol(y=900, couleur='url(#sol)'):
    return f'<rect x="0" y="{y}" width="{W}" height="{H-y}" fill="{couleur}"/><ellipse cx="{W/2}" cy="{y}" rx="{W*0.7}" ry="22" fill="#2a2470" opacity=".5"/>'

def titre(t, y=150, taille=46, couleur=OR):
    return f'<text x="{W/2}" y="{y}" font-size="{taille}" font-weight="800" text-anchor="middle" fill="{couleur}" font-family="Inter" letter-spacing="3" style="filter:drop-shadow(0 0 18px #0008)">{t}</text>'

S = {}
# 1. La Terre et le réseau humain
pts = []
for k in range(26):
    a = k / 26 * 2 * math.pi; pts.append((960 + math.cos(a) * 520, 560 + math.sin(a) * 330))
S['01-terre'] = fond(f'<circle cx="960" cy="560" r="300" fill="url(#terre)"/>'
    '<path d="M820,450 q60,-50 120,-10 q40,40 10,90 q-60,30 -110,-10z M1010,600 q70,-20 110,40 q-20,70 -90,60 q-50,-40 -20,-100z M880,650 q30,10 40,50 q-30,30 -60,0z" fill="#3fae6b" opacity=".85"/>'
    '<circle cx="960" cy="560" r="300" fill="none" stroke="#9fd0ff" stroke-width="6" opacity=".35"/>' + reseau(pts, 330) +
    ''.join(personne(px, py + 40, .22, fill='#ffe2a8', op=.95) for px, py in pts[::2]))
# 2. Le Voyant
S['02-voyant'] = fond(sol(880) + personne(960, 900, 1.9, fill='url(#corps)', capuche=True, oeil=True) +
    titre("L'ÉCOLE DES VOYANTS", 170, 74) + titre('Ceux qui voient sont ceux qui ont compris', 240, 30, '#e9e4ff'))
# 3. Neurones connectés, sans drapeaux
foule = [(220 + i * 135, 900 - (i % 3) * 18) for i in range(12)]
tetes = [(x, y - 300 * .75 + 26) for x, y in foule]
S['03-neurones'] = fond(sol(900) + reseau(tetes, 420, OR, .7) +
    ''.join(personne(x, y, .75, fill='url(#corpsOr)' if i % 2 else 'url(#corps)', echarpe=(ROSE if i == 5 else None)) for i, (x, y) in enumerate(foule)) +
    titre("NI GUERRE, NI NATIONALITÉ : L'HUMANITÉ", 170, 44))
# 4. Bunkers et fusée
S['04-bunkers'] = fond('<circle cx="1560" cy="230" r="90" fill="#e9e6d8"/><circle cx="1530" cy="210" r="16" fill="#c8c4b2"/><circle cx="1590" cy="260" r="10" fill="#c8c4b2"/>'
    '<circle cx="300" cy="200" r="46" fill="url(#mars)"/>' + sol(860, '#0b0a14') +
    ''.join(f'<path d="M{x},{860} q{w/2},-{h} {w},0z" fill="url(#beton)"/><rect x="{x+w/2-30}" y="{860-h*0.35}" width="60" height="{h*0.35}" fill="#111"/>' for x, w, h in [(120, 520, 260), (700, 420, 200), (1220, 600, 300)]) +
    '<g transform="translate(1180,420) rotate(35)"><path d="M0,-90 q26,40 26,110 l-52,0 q0,-70 26,-110z" fill="#eef0f8"/><path d="M-26,20 l-22,40 l22,-10z M26,20 l22,40 l-22,-10z" fill="#c9302c"/><path d="M-14,30 q14,90 28,0z" fill="#ffb347" opacity=".9" filter="url(#lueur)"/></g>'
    '<path d="M1190,450 Q1000,700 700,860" stroke="#ffffff" stroke-width="3" fill="none" opacity=".25" stroke-dasharray="10 14"/>' +
    titre('DES BUNKERS · LA LUNE · MARS', 140, 44, '#e9e4ff'))
# 5. Le film d'enfance devenu réalité
S['05-film'] = fond(sol(860) +
    '<rect x="560" y="300" width="800" height="500" rx="40" fill="#2b2338" stroke="#6b5a8a" stroke-width="10"/>'
    '<rect x="610" y="340" width="700" height="400" rx="24" fill="#0b1030"/>'
    '<circle cx="1110" cy="470" r="110" fill="url(#mars)"/>'
    '<g transform="translate(820,560) rotate(-30)"><path d="M0,-60 q18,28 18,80 l-36,0 q0,-52 18,-80z" fill="#eef0f8"/><path d="M-10,22 q10,60 20,0z" fill="#ffb347" filter="url(#lueur)"/></g>'
    '<line x1="900" y1="300" x2="830" y2="230" stroke="#6b5a8a" stroke-width="8"/><line x1="1020" y1="300" x2="1090" y2="230" stroke="#6b5a8a" stroke-width="8"/>' +
    personne(760, 980, .9, fill='#0a0a1c', echarpe=OR) +
    titre("CE N'EST PLUS DE LA FICTION", 170, 50))
# 6. Humanoïdes sans âme + immortalité
S['06-robots'] = fond(sol(900, '#07070f') +
    ''.join(robot(160 + i * 160, 900 - (i % 2) * 12, .78, op=.55 + .04 * i) for i in range(11)) +
    '<g opacity=".9">' + ''.join(f'<rect x="{x}" y="230" width="14" height="560" fill="#1a1a24"/>' for x in range(160, 1800, 130)) + '</g>' +
    titre('DES MILLIONS DE ROBOTS SANS ÂME', 150, 48, '#d6dae6') + titre('Une prison infernale immortelle ?', 215, 32, ROSE))
# 7. Le combat conscient
S['07-combat'] = fond(sol(880) + '<path d="M0,880 L1920,700 L1920,880Z" fill="#1d1846"/>' +
    ''.join(f'<path d="M{random.randint(0,1900)},{random.randint(250,800)} l{random.randint(80,200)},-6" stroke="#9bb4ff" stroke-width="2" opacity=".3"/>' for _ in range(40)) +
    personne(1100, 880, 1.6, capuche=True, oeil=True) + personne(780, 900, 1.0, echarpe=OR) +
    titre('ON NE POURRA JAMAIS NOUS REMPLACER', 160, 52))
# 8. Échecs : avancer nos pions
cases = ''.join(f'<rect x="{560+c*100}" y="{430+r*60}" width="100" height="60" fill="{"#d9cfae" if (r+c)%2==0 else "#3a2f55"}"/>' for r in range(6) for c in range(8))
def pion(x, y, coul):
    return f'<circle cx="{x}" cy="{y-56}" r="16" fill="{coul}"/><path d="M{x-14},{y-40} q14,8 28,0 l10,36 l-48,0z" fill="{coul}"/><rect x="{x-24}" y="{y-6}" width="48" height="10" rx="4" fill="{coul}"/>'
S['08-echecs'] = fond('<g transform="translate(0,40)">' + cases + pion(810, 670, OR) + pion(1010, 610, '#8a90a0') + pion(1110, 730, '#8a90a0') + pion(710, 730, OR) + '</g>' +
    '<path d="M640,980 q60,-160 160,-230 q30,-16 40,8 q-10,30 -40,60 q60,-10 60,30 q-60,60 -140,140z" fill="#f2c9a0"/>' +
    robot(1540, 1000, .9, op=.85) + sphere_clipia(260, 330, 120) +
    titre("IL EST TEMPS D'AVANCER NOS PIONS", 160, 50))
# 9. L'appel : maintenant
foule2 = [(140 + i * 110, 930 - abs(8 - i) * 6) for i in range(17)]
S['09-appel'] = fond(sol(900) + '<circle cx="960" cy="420" r="210" fill="none" stroke="#ffd27a" stroke-width="10"/><circle cx="960" cy="420" r="230" fill="url(#halo)" opacity=".25"/>'
    '<line x1="960" y1="420" x2="960" y2="260" stroke="#fff" stroke-width="12" stroke-linecap="round"/><line x1="960" y1="420" x2="1050" y2="420" stroke="#fff" stroke-width="10" stroke-linecap="round"/><circle cx="960" cy="420" r="14" fill="#ffd27a"/>' +
    ''.join(personne(x, y, .62, fill='url(#corpsOr)' if i % 3 == 0 else 'url(#corps)') for i, (x, y) in enumerate(foule2)) +
    titre("C'EST MAINTENANT", 130, 64))
# 10. Les grands-parents
S['10-grands-parents'] = fond(sol(900, '#120c22') +
    '<rect x="520" y="560" width="380" height="300" rx="60" fill="#4a2338"/><rect x="560" y="800" width="300" height="100" rx="20" fill="#3a1a2c"/>' +
    personne(710, 860, 1.0, fill='#5a4b7a', chale=ROSE, taille=.86) + personne(1010, 900, .62, fill='#2a2f6e', echarpe=OR) +
    '<path d="M760,640 Q880,700 960,720" stroke="#f2c9a0" stroke-width="12" fill="none" stroke-linecap="round"/>' +
    robot(1450, 900, 1.0, op=.7) +
    '<path d="M1010,560 c-20,-30 -70,-10 -50,25 l50,45 l50,-45 c20,-35 -30,-55 -50,-25z" fill="#ff5d8f" filter="url(#lueur)"/>' +
    titre("DANS SA TÊTE, SON CŒUR, SON ESPRIT", 160, 48))
# 11. Le message signé
S['11-message'] = fond(sol(900) + '<rect x="700" y="520" width="620" height="380" rx="20" fill="#1a1f4d" stroke="#7c5cff" stroke-width="4"/>'
    + ''.join(f'<rect x="760" y="{570+i*42}" width="{random.randint(300,500)}" height="12" rx="6" fill="#cfd6ff" opacity=".6"/>' for i in range(7)) +
    personne(520, 900, 1.3, capuche=True, oeil=True) +
    '<text x="1010" y="880" font-size="40" font-family="Brush Script MT, cursive" fill="#ffd27a" text-anchor="middle">Fabrice Clin</text>' +
    titre('AU MOINS, C\'EST DIT', 170, 56))
# 12. Clipia décentralisée, ON / OFF
noeuds = [(960 + math.cos(k / 9 * 2 * math.pi) * 430, 540 + math.sin(k / 9 * 2 * math.pi) * 300) for k in range(9)]
S['12-clipia'] = fond(reseau(noeuds + [(960, 540)], 520, '#9b7bff', .6) + sphere_clipia(960, 540, 170) +
    ''.join(f'<rect x="{x-46}" y="{y-30}" width="92" height="60" rx="8" fill="#141a44" stroke="#9b7bff" stroke-width="3"/><rect x="{x-14}" y="{y+30}" width="28" height="12" fill="#141a44"/>' for x, y in noeuds) +
    '<g transform="translate(1640,880)"><rect x="-90" y="-45" width="180" height="90" rx="45" fill="#43e6a8"/><circle cx="45" cy="0" r="36" fill="#fff"/><text x="-40" y="12" font-size="34" font-weight="800" font-family="Inter" fill="#062b1d" text-anchor="middle">ON</text></g>'
    '<g transform="translate(280,880)"><rect x="-90" y="-45" width="180" height="90" rx="45" fill="#3a3f5c"/><circle cx="-45" cy="0" r="36" fill="#fff"/><text x="40" y="12" font-size="34" font-weight="800" font-family="Inter" fill="#cfd6ff" text-anchor="middle">OFF</text></g>' +
    titre('DÉCENTRALISÉE · TU L\'ALLUMES, TU L\'ÉTEINS', 140, 46))
# 13. Les « fous »
S['13-fous'] = fond(sol(900, '#0e0b1d') +
    '<rect x="380" y="560" width="1160" height="40" fill="#2a2450"/>' +
    ''.join(f'<path d="M{x},{560} l-20,-160 l60,0 l-20,160z" fill="{c}" opacity=".8"/><circle cx="{x+10}" cy="380" r="30" fill="{c}" opacity=".5" filter="url(#flou)"/>' for x, c in [(560, '#43e6a8'), (760, ROSE), (1160, BLEU), (1360, OR)]) +
    personne(700, 900, .95, fill='#d9dde6', op=.9) + personne(1240, 900, .95, fill='#d9dde6', op=.9) +
    '<text x="960" y="470" font-size="220" font-weight="900" font-family="Inter" fill="#ffd27a" text-anchor="middle" opacity=".9" filter="url(#lueur)">?</text>' +
    titre('ET SI LES FOUS ÉTAIENT LES PLUS LUCIDES ?', 160, 46))
# 14. Même longueur d'onde
onde = ' '.join(f'{x},{540+math.sin(x/55)*120*math.exp(-((x-960)/700)**2)}' for x in range(0, 1921, 8))
S['14-onde'] = fond(f'<polyline points="{onde}" fill="none" stroke="{OR}" stroke-width="8" filter="url(#lueur)"/>'
    f'<polyline points="{onde}" fill="none" stroke="{ROSE}" stroke-width="3" opacity=".7" transform="translate(0,26)"/>' + sol(900) +
    ''.join(personne(x, 900, .7, fill='url(#corps)', echarpe=(OR if i == 2 else None)) for i, x in enumerate([300, 560, 960, 1360, 1620])) +
    titre("L'AMOUR · LA PEUR · LA SURVIE", 170, 54) + titre('Sur la même longueur d’onde', 240, 32, '#e9e4ff'))
# 15. Pas de puce
S['15-puce'] = fond(sol(900) +
    '<circle cx="960" cy="470" r="250" fill="url(#halo)" opacity=".35"/>'
    '<path d="M840,640 q-40,-120 20,-220 q100,-110 220,-20 q70,70 40,170 q-10,40 -30,70 l0,70 l-200,0z" fill="#1d2260" stroke="#ffd27a" stroke-width="6"/>'
    '<rect x="930" y="430" width="90" height="70" rx="8" fill="#3b3f4a"/>' + ''.join(f'<rect x="{922 + i*20}" y="420" width="6" height="90" fill="#8a90a0"/>' for i in range(6)) +
    '<circle cx="975" cy="465" r="95" fill="none" stroke="#ff4d6d" stroke-width="16"/><line x1="908" y1="398" x2="1042" y2="532" stroke="#ff4d6d" stroke-width="16"/>' +
    personne(1370, 900, .75, fill='url(#corps)', echarpe=OR, taille=.8) + personne(1540, 900, 1.0, capuche=True, oeil=True) +
    titre('PAS DE PUCE DANS NOS CERVEAUX', 160, 54))
# 16. Les savants : une vie entière
S['16-savants'] = fond(sol(900, '#0e0b1d') +
    '<rect x="260" y="250" width="900" height="460" rx="14" fill="#16261f" stroke="#6b4a2a" stroke-width="18"/>'
    '<text x="330" y="380" font-size="64" font-family="Brush Script MT, cursive" fill="#e8efe8" opacity=".9">E = mc²</text>'
    '<text x="330" y="490" font-size="44" font-family="Brush Script MT, cursive" fill="#e8efe8" opacity=".8">Gμν + Λgμν = 8πG/c⁴ Tμν</text>'
    '<text x="330" y="590" font-size="44" font-family="Brush Script MT, cursive" fill="#e8efe8" opacity=".8">E = hν</text>'
    '<text x="900" y="660" font-size="30" font-family="Inter" fill="#ffd27a">une vie entière</text>' +
    personne(1320, 900, 1.05, fill='#d9dde6', op=.95) +
    '<g transform="translate(1500,330)"><rect x="-150" y="-8" width="300" height="16" fill="#c9a36b"/><rect x="-150" y="-58" width="300" height="14" fill="#c9a36b"/>'
    '<line x1="-110" y1="-44" x2="-110" y2="-8" stroke="#6b4a2a" stroke-width="5"/><line x1="110" y1="-44" x2="110" y2="-8" stroke="#6b4a2a" stroke-width="5"/>'
    '<rect x="-30" y="0" width="90" height="16" fill="#8a6b3e"/><circle cx="-160" cy="0" r="22" fill="none" stroke="#ddd" stroke-width="3" opacity=".6"/></g>' +
    titre('UNE VIE ENTIÈRE… ET L\'IA EN 3 JOURS ?', 160, 50))
# 17. La voiture sans conducteur
S['17-voiture'] = fond(sol(820, '#0b0a18') + '<rect x="0" y="820" width="1920" height="260" fill="#14121f"/>' +
    ''.join(f'<rect x="{x}" y="940" width="120" height="10" fill="#ffd27a" opacity=".6"/>' for x in range(40, 1920, 240)) +
    '<g transform="translate(1600,180)"><rect x="-40" y="-26" width="80" height="52" fill="url(#metal)"/><rect x="-140" y="-14" width="90" height="28" fill="#2f8cff"/><rect x="50" y="-14" width="90" height="28" fill="#2f8cff"/></g>'
    '<path d="M1580,220 L1080,700" stroke="#2f8cff" stroke-width="3" stroke-dasharray="8 12" opacity=".7"/>'
    '<g transform="translate(560,0)"><path d="M120,860 q10,-110 120,-130 l120,-80 q80,-40 200,-40 l160,0 q90,0 150,70 l60,60 q60,10 70,70 l0,50z" fill="#3a3f5c"/>'
    '<path d="M410,620 l-90,90 l170,0 l0,-90z M520,620 l0,90 l200,0 l-70,-90z" fill="#9bb4ff" opacity=".5"/>'
    '<circle cx="300" cy="870" r="56" fill="#0a0a12"/><circle cx="820" cy="870" r="56" fill="#0a0a12"/></g>' +
    personne(1020, 700, .32, fill='#0a0a1c') + personne(1150, 700, .24, fill='#0a0a1c', echarpe='#ffd27a') +
    robot(320, 900, .6, op=.9) + '<rect x="250" y="640" width="140" height="26" rx="12" fill="#e0b56a" transform="rotate(-20 320 650)"/>' +
    titre('UNE VOITURE QUE VOUS NE CONDUISEZ PAS ?', 150, 50))
# 18. Telle est la question
S['18-question'] = fond(sol(900) + personne(960, 900, 1.7, capuche=True, oeil=True) +
    titre('« TELLE EST LA QUESTION »', 190, 80))
# 19. Carte finale
S['19-fin'] = fond(sol(930) + sphere_clipia(960, 430, 150) +
    titre("L'ÉCOLE DES VOYANTS", 720, 78) + titre('Rejoignez la communauté · Partagez', 790, 34, '#e9e4ff') +
    '<rect x="610" y="830" width="700" height="64" rx="14" fill="#5a3ef0"/><text x="960" y="873" font-size="28" font-weight="700" fill="#fff" font-family="Inter" text-anchor="middle">fabriceclin02-glitch.github.io/clipia</text>')

GABARIT = '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">' + DEFS + '@@SVG@@</svg></body></html>'
for nom, svg in S.items():
    f = f'{D}/{nom}.html'
    open(f, 'w', encoding='utf-8').write(GABARIT.replace('@@SVG@@', svg))
    subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--hide-scrollbars', '--window-size=1920,1080', f'--screenshot={D}/{nom}.png', 'file://' + f], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('scènes :', len(S))
