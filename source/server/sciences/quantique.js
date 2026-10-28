/**
 * CLIPIA — Simulateur quantique et physique des ondes radio.
 *
 * Trois volets, et un lien réel entre eux :
 *   simulateur — vecteur d'état complet : superposition, intrication, mesure
 *   radio      — propagation, antennes, bilan de liaison, Doppler
 *   pilotage   — le pont physique : un qubit supraconducteur se commande par
 *                impulsion micro-onde. Durée d'impulsion π, fréquence de Rabi,
 *                décohérence : tout cela se calcule.
 *
 * Ce qui est simulé l'est exactement. Ce qui exigerait du matériel est dit.
 */
const C = 299792458, H = 6.62607015e-34, HBAR = 1.054571817e-34, KB = 1.380649e-23;

/* ═══ SIMULATEUR : vecteur d'état sur n qubits ════════════════════════ */

export class Etat {
  constructor(n) {
    if (n < 1 || n > 14) throw new Error('Entre 1 et 14 qubits (2^14 amplitudes, au-delà la mémoire explose).');
    this.n = n;
    this.re = new Float64Array(1 << n);
    this.im = new Float64Array(1 << n);
    this.re[0] = 1;                       // |00…0⟩
    this.journal = [];
  }

  /** Applique une matrice 2×2 au qubit q. */
  porte1(q, [[ar,ai],[br,bi],[cr,ci],[dr,di]]) {
    const pas = 1 << q;
    for (let i = 0; i < this.re.length; i++) {
      if (i & pas) continue;
      const j = i | pas;
      const x0r = this.re[i], x0i = this.im[i], x1r = this.re[j], x1i = this.im[j];
      this.re[i] = ar*x0r - ai*x0i + br*x1r - bi*x1i;
      this.im[i] = ar*x0i + ai*x0r + br*x1i + bi*x1r;
      this.re[j] = cr*x0r - ci*x0i + dr*x1r - di*x1i;
      this.im[j] = cr*x0i + ci*x0r + dr*x1i + di*x1r;
    }
    return this;
  }

  /** Porte contrôlée : agit sur `cible` si `ctrl` vaut 1. */
  controlee(ctrl, cible, m) {
    const pc = 1 << ctrl, pt = 1 << cible;
    for (let i = 0; i < this.re.length; i++) {
      if (!(i & pc) || (i & pt)) continue;
      const j = i | pt;
      const [[ar,ai],[br,bi],[cr,ci],[dr,di]] = m;
      const x0r = this.re[i], x0i = this.im[i], x1r = this.re[j], x1i = this.im[j];
      this.re[i] = ar*x0r - ai*x0i + br*x1r - bi*x1i;
      this.im[i] = ar*x0i + ai*x0r + br*x1i + bi*x1r;
      this.re[j] = cr*x0r - ci*x0i + dr*x1r - di*x1i;
      this.im[j] = cr*x0i + ci*x0r + dr*x1i + di*x1r;
    }
    return this;
  }

  probabilites() {
    const p = new Float64Array(this.re.length);
    for (let i = 0; i < p.length; i++) p[i] = this.re[i]**2 + this.im[i]**2;
    return p;
  }

  /** Mesure projective : l'état s'effondre, comme en vrai. */
  mesurer() {
    const p = this.probabilites();
    let r = Math.random(), k = 0;
    for (; k < p.length; k++) { r -= p[k]; if (r <= 0) break; }
    if (k >= p.length) k = p.length - 1;
    this.re.fill(0); this.im.fill(0); this.re[k] = 1;
    return k.toString(2).padStart(this.n, '0');
  }

  /** Entropie d'intrication d'un qubit : 0 = séparable, 1 = maximalement intriqué. */
  intrication(q) {
    const p = this.probabilites();
    const pas = 1 << q;
    let p0 = 0;
    for (let i = 0; i < p.length; i++) if (!(i & pas)) p0 += p[i];
    const p1 = 1 - p0;
    const lg = x => (x <= 1e-12 ? 0 : x * Math.log2(x));
    return +(-(lg(p0) + lg(p1))).toFixed(6);
  }

  /** Les amplitudes non négligeables, lisibles. */
  amplitudes(seuil = 1e-6) {
    const out = [];
    for (let i = 0; i < this.re.length; i++) {
      const pr = this.re[i]**2 + this.im[i]**2;
      if (pr > seuil) out.push({
        base: '|' + i.toString(2).padStart(this.n, '0') + '⟩',
        re: +this.re[i].toFixed(6), im: +this.im[i].toFixed(6),
        probabilite: +pr.toFixed(6), pourcent: +(pr * 100).toFixed(2)
      });
    }
    return out.sort((a, b) => b.probabilite - a.probabilite);
  }
}

const R2 = 1 / Math.SQRT2;
export const PORTES = {
  H: [[R2,0],[R2,0],[R2,0],[-R2,0]],
  X: [[0,0],[1,0],[1,0],[0,0]],
  Y: [[0,0],[0,-1],[0,1],[0,0]],
  Z: [[1,0],[0,0],[0,0],[-1,0]],
  S: [[1,0],[0,0],[0,0],[0,1]],
  T: [[1,0],[0,0],[0,0],[R2,R2]],
  I: [[1,0],[0,0],[0,0],[1,0]]
};
const RX = t => [[Math.cos(t/2),0],[0,-Math.sin(t/2)],[0,-Math.sin(t/2)],[Math.cos(t/2),0]];
const RY = t => [[Math.cos(t/2),0],[-Math.sin(t/2),0],[Math.sin(t/2),0],[Math.cos(t/2),0]];
const RZ = t => [[Math.cos(t/2),-Math.sin(t/2)],[0,0],[0,0],[Math.cos(t/2),Math.sin(t/2)]];

/**
 * Exécute un circuit décrit simplement.
 * Ex. : [{p:'H',q:0},{p:'CNOT',ctrl:0,q:1}]  → paire de Bell
 */
export function circuit({ qubits, portes = [], tirages = 1024 }) {
  const e = new Etat(qubits);
  for (const g of portes) {
    const nom = String(g.p || g.porte).toUpperCase();
    if (PORTES[nom]) e.porte1(g.q, PORTES[nom]);
    else if (nom === 'RX') e.porte1(g.q, RX(g.angle ?? Math.PI/2));
    else if (nom === 'RY') e.porte1(g.q, RY(g.angle ?? Math.PI/2));
    else if (nom === 'RZ') e.porte1(g.q, RZ(g.angle ?? Math.PI/2));
    else if (nom === 'CNOT' || nom === 'CX') e.controlee(g.ctrl, g.q, PORTES.X);
    else if (nom === 'CZ') e.controlee(g.ctrl, g.q, PORTES.Z);
    else throw new Error(`Porte inconnue : ${nom}`);
    e.journal.push(nom + (g.ctrl !== undefined ? `(${g.ctrl}→${g.q})` : `(${g.q})`));
  }

  const amplitudes = e.amplitudes();
  const intrications = Array.from({ length: qubits }, (_, q) => ({ qubit: q, entropie: e.intrication(q) }));

  // Statistiques de mesure, sur une copie : l'état théorique reste intact.
  const comptes = {};
  const p = e.probabilites();
  for (let t = 0; t < tirages; t++) {
    let r = Math.random(), k = 0;
    for (; k < p.length; k++) { r -= p[k]; if (r <= 0) break; }
    const b = Math.min(k, p.length - 1).toString(2).padStart(qubits, '0');
    comptes[b] = (comptes[b] || 0) + 1;
  }

  return {
    qubits, portes: e.journal, amplitudes, intrications,
    mesures: Object.entries(comptes).sort((a, b) => b[1] - a[1])
      .map(([b, n]) => ({ resultat: '|' + b + '⟩', tirages: n, frequence: +(n / tirages * 100).toFixed(1) })),
    intrique: intrications.some(x => x.entropie > 0.01)
  };
}

/** Circuits de référence, pour comprendre sans tout écrire. */
export const EXEMPLES = {
  bell:   { nom:'Paire de Bell', qubits:2, portes:[{p:'H',q:0},{p:'CNOT',ctrl:0,q:1}],
            quoi:"Intrication parfaite : 50 % de |00⟩, 50 % de |11⟩, jamais |01⟩ ni |10⟩." },
  ghz:    { nom:'État GHZ', qubits:3, portes:[{p:'H',q:0},{p:'CNOT',ctrl:0,q:1},{p:'CNOT',ctrl:1,q:2}],
            quoi:"Intrication à trois : les trois qubits s'accordent toujours." },
  super:  { nom:'Superposition totale', qubits:3, portes:[{p:'H',q:0},{p:'H',q:1},{p:'H',q:2}],
            quoi:"Les huit états à égalité — le point de départ de Grover et de Shor." },
  phase:  { nom:'Recul de phase', qubits:2, portes:[{p:'H',q:0},{p:'H',q:1},{p:'CZ',ctrl:0,q:1},{p:'H',q:1}],
            quoi:"L'interférence rend visible une information de phase : le ressort des algorithmes quantiques." }
};

/* ═══ ONDES RADIO ═════════════════════════════════════════════════════ */

export function radio({ frequence, puissance_W, distance_m, gain_tx_dBi = 0, gain_rx_dBi = 0, vitesse_ms = 0 }) {
  const f = Number(frequence);
  if (!f || f <= 0) throw new Error('Fréquence requise, en hertz.');
  const lambda = C / f;

  const r = {
    frequence_Hz: f, frequence_lisible: lisibleHz(f),
    longueur_onde_m: +lambda.toFixed(6),
    bande: bandeRadio(f),
    energie_photon_J: H * f,
    energie_photon_eV: +(H * f / 1.602176634e-19).toExponential(4),
    antenne: {
      demi_onde_m: +(lambda / 2).toFixed(4),
      quart_onde_m: +(lambda / 4).toFixed(4),
      note: 'Longueurs physiques ; un facteur de vélocité de 0,95 s\'applique en pratique.'
    }
  };

  if (distance_m) {
    // Affaiblissement en espace libre
    const pl = 20 * Math.log10(distance_m) + 20 * Math.log10(f) - 147.55;
    r.propagation = {
      distance_m, perte_espace_libre_dB: +pl.toFixed(2),
      fresnel_1_m: +(0.5 * Math.sqrt(lambda * distance_m)).toFixed(3)
    };
    if (puissance_W) {
      const pt = 10 * Math.log10(puissance_W * 1000);
      const pr = pt + gain_tx_dBi + gain_rx_dBi - pl;
      r.bilan = {
        emission_dBm: +pt.toFixed(2), reception_dBm: +pr.toFixed(2),
        reception_W: +(10 ** (pr / 10) / 1000).toExponential(3),
        marge_vs_sensibilite_minus100dBm: +(pr + 100).toFixed(2)
      };
    }
  }
  if (vitesse_ms) {
    const d = f * vitesse_ms / C;
    r.doppler = { vitesse_ms, decalage_Hz: +d.toFixed(3), frequence_percue_Hz: +(f + d).toFixed(3) };
  }
  return r;
}

function lisibleHz(f) {
  if (f >= 1e9) return (f / 1e9).toFixed(3) + ' GHz';
  if (f >= 1e6) return (f / 1e6).toFixed(3) + ' MHz';
  if (f >= 1e3) return (f / 1e3).toFixed(3) + ' kHz';
  return f + ' Hz';
}
function bandeRadio(f) {
  const t = [[3e3,'VLF'],[3e4,'LF'],[3e5,'MF'],[3e6,'HF — ionosphérique'],[3e7,'VHF'],
    [3e8,'UHF — Wi-Fi, 4G'],[3e9,'SHF — micro-ondes, satellites'],[3e10,'EHF — millimétrique, 5G'],
    [3e11,'THF — térahertz'],[Infinity,'au-delà du domaine radio']];
  return t.find(([lim]) => f < lim)[1];
}

/* ═══ LE PONT : piloter un qubit par micro-ondes ══════════════════════ */

/**
 * Un qubit supraconducteur n'est pas « contrôlé par la pensée » : on lui
 * envoie une impulsion micro-onde accordée sur sa transition |0⟩→|1⟩.
 * Tout cela se calcule — et c'est exactement ce que font IBM et Google.
 */
export function pilotageMicroonde({ frequence_qubit = 5e9, amplitude_rabi = 20e6,
                                    angle = Math.PI, T1_us = 100, T2_us = 80, temperature_mK = 15 }) {
  const fq = Number(frequence_qubit), rabi = Number(amplitude_rabi);
  const duree = angle / (2 * Math.PI * rabi);          // secondes
  const T1 = T1_us * 1e-6, T2 = T2_us * 1e-6;

  // Perte de fidélité due à la décohérence pendant l'impulsion
  const fid = Math.exp(-duree / T2) * Math.exp(-duree / (2 * T1));
  // Population thermique résiduelle : pourquoi on descend à 15 mK
  const T = temperature_mK * 1e-3;
  const pth = 1 / (Math.exp(H * fq / (KB * T)) + 1);

  return {
    qubit: {
      frequence_Hz: fq, frequence_lisible: lisibleHz(fq),
      energie_transition_J: H * fq,
      energie_transition_ueV: +(H * fq / 1.602176634e-19 * 1e6).toFixed(3)
    },
    impulsion: {
      type: angle === Math.PI ? 'π (bascule complète, équivaut à la porte X)'
          : Math.abs(angle - Math.PI/2) < 1e-9 ? 'π/2 (superposition, équivaut à H à une phase près)'
          : `rotation de ${(angle * 180 / Math.PI).toFixed(1)}°`,
      frequence_rabi_Hz: rabi, duree_s: duree,
      duree_lisible: duree < 1e-9 ? (duree * 1e12).toFixed(2) + ' ps' : (duree * 1e9).toFixed(2) + ' ns',
      longueur_onde_m: +(C / fq).toFixed(4)
    },
    coherence: {
      T1_us, T2_us,
      fidelite_estimee: +fid.toFixed(6),
      portes_avant_decoherence: Math.floor(T2 / duree),
      note: "Le nombre d'opérations possibles avant que l'information quantique se perde."
    },
    thermique: {
      temperature_mK, population_excitee_parasite: +pth.toExponential(3),
      pourquoi: `À ${temperature_mK} mK, l'agitation thermique peuple l'état |1⟩ avec une probabilité de ${(pth*100).toExponential(2)} %. C'est pour cela qu'on descend sous 20 mK : au-dessus, le bruit thermique noie le signal.`
    },
    realite: "Ces chiffres décrivent un vrai dispositif. Les produire ne les réalise pas : il faut un cryostat à dilution, de l'électronique micro-onde et un qubit physique. Ce module calcule et simule, il ne pilote aucun matériel."
  };
}

export const aideQuantique = () => `
SIMULATEUR  : circuit({qubits, portes:[{p:'H',q:0},{p:'CNOT',ctrl:0,q:1}]})
  portes     : H X Y Z S T I, RX RY RZ (angle), CNOT CZ
  exemples   : ${Object.keys(EXEMPLES).join(', ')}
RADIO       : radio({frequence, puissance_W, distance_m, gain_tx_dBi, vitesse_ms})
PILOTAGE    : pilotageMicroonde({frequence_qubit, amplitude_rabi, angle, T1_us, T2_us})`;
