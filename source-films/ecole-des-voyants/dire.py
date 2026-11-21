import sys, wave
from piper import PiperVoice
# usage : dire.py modele.onnx texte.txt sortie.wav [vitesse]
modele, texte, sortie = sys.argv[1], open(sys.argv[2], encoding='utf-8').read(), sys.argv[3]
v = PiperVoice.load(modele)
try:
    from piper import SynthesisConfig
    cfg = SynthesisConfig(length_scale=float(sys.argv[4]) if len(sys.argv) > 4 else 1.0)
except Exception:
    cfg = None
with wave.open(sortie, 'wb') as w:
    if cfg is not None:
        v.synthesize_wav(texte, w, syn_config=cfg)
    else:
        v.synthesize_wav(texte, w)
