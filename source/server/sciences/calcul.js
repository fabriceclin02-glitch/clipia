/**
 * CLIPIA — Moteur de calcul réel.
 *
 * Un modèle de langage approxime les nombres ; il ne calcule pas. Ici, les
 * expressions sont évaluées pour de bon, dans un contexte isolé, avec les
 * constantes physiques du CODATA 2018 et une vérification dimensionnelle.
 */
import vm from 'node:vm';

/** Constantes fondamentales — CODATA 2018, valeurs exactes du SI quand elles le sont. */
export const CONSTANTES = {
  c:        { v: 299792458,             u: 'm/s',        nom: 'vitesse de la lumière (exacte)' },
  G:        { v: 6.67430e-11,           u: 'm³/(kg·s²)', nom: 'constante gravitationnelle' },
  h:        { v: 6.62607015e-34,        u: 'J·s',        nom: 'constante de Planck (exacte)' },
  hbar:     { v: 1.054571817e-34,       u: 'J·s',        nom: 'Planck réduite' },
  k_B:      { v: 1.380649e-23,          u: 'J/K',        nom: 'constante de Boltzmann (exacte)' },
  N_A:      { v: 6.02214076e23,         u: '1/mol',      nom: "nombre d'Avogadro (exacte)" },
  R:        { v: 8.314462618,           u: 'J/(mol·K)',  nom: 'constante des gaz parfaits' },
  e:        { v: 1.602176634e-19,       u: 'C',          nom: 'charge élémentaire (exacte)' },
  m_e:      { v: 9.1093837015e-31,      u: 'kg',         nom: "masse de l'électron" },
  m_p:      { v: 1.67262192369e-27,     u: 'kg',         nom: 'masse du proton' },
  m_n:      { v: 1.67492749804e-27,     u: 'kg',         nom: 'masse du neutron' },
  u_ma:     { v: 1.66053906660e-27,     u: 'kg',         nom: 'unité de masse atomique' },
  eps0:     { v: 8.8541878128e-12,      u: 'F/m',        nom: 'permittivité du vide' },
  mu0:      { v: 1.25663706212e-6,      u: 'H/m',        nom: 'perméabilité du vide' },
  sigma_SB: { v: 5.670374419e-8,        u: 'W/(m²·K⁴)',  nom: 'constante de Stefan-Boltzmann' },
  g0:       { v: 9.80665,               u: 'm/s²',       nom: 'pesanteur normale (exacte)' },
  // Repères astronomiques
  M_soleil: { v: 1.98847e30,            u: 'kg',         nom: 'masse solaire' },
  R_soleil: { v: 6.957e8,               u: 'm',          nom: 'rayon solaire' },
  M_terre:  { v: 5.9722e24,             u: 'kg',         nom: 'masse de la Terre' },
  R_terre:  { v: 6.371e6,               u: 'm',          nom: 'rayon terrestre moyen' },
  UA:       { v: 1.495978707e11,        u: 'm',          nom: 'unité astronomique (exacte)' },
  pc:       { v: 3.0856775814913673e16, u: 'm',          nom: 'parsec' },
  al:       { v: 9.4607304725808e15,    u: 'm',          nom: 'année-lumière' },
  H0:       { v: 2.1927e-18,            u: '1/s',        nom: 'constante de Hubble (~67,7 km/s/Mpc)' }
};

/** Conversions vers l'unité SI de base. */
export const UNITES = {
  longueur: { m:1, km:1e3, cm:1e-2, mm:1e-3, um:1e-6, nm:1e-9, pm:1e-12, fm:1e-15,
              mi:1609.344, ft:0.3048, in:0.0254, al:9.4607304725808e15, UA:1.495978707e11, pc:3.0856775814913673e16 },
  masse:    { kg:1, g:1e-3, mg:1e-6, t:1e3, u:1.66053906660e-27, Msol:1.98847e30, lb:0.45359237 },
  temps:    { s:1, ms:1e-3, us:1e-6, ns:1e-9, min:60, h:3600, j:86400, an:31557600, Ma:3.15576e13, Ga:3.15576e16 },
  energie:  { J:1, kJ:1e3, MJ:1e6, GJ:1e9, eV:1.602176634e-19, keV:1.602176634e-16,
              MeV:1.602176634e-13, GeV:1.602176634e-10, cal:4.184, kcal:4184, kWh:3.6e6, TNT:4.184e9 },
  puissance:{ W:1, kW:1e3, MW:1e6, GW:1e9, TW:1e12, ch:735.49875 },
  vitesse:  { 'm/s':1, 'km/h':1/3.6, 'km/s':1e3, c:299792458, mach:343 },
  pression: { Pa:1, kPa:1e3, MPa:1e6, GPa:1e9, bar:1e5, atm:101325, mmHg:133.322387415, psi:6894.757293168 },
  temperature:{ K:1 }   // traitée à part : décalage et non facteur
};

export function convertir(valeur, de, vers) {
  for (const [dim, table] of Object.entries(UNITES)) {
    if (table[de] !== undefined && table[vers] !== undefined)
      return { valeur: valeur * table[de] / table[vers], dimension: dim, de, vers };
  }
  // Températures : conversions affines
  const T = { K: x => x, C: x => x + 273.15, F: x => (x + 459.67) * 5 / 9 };
  const T_inv = { K: x => x, C: x => x - 273.15, F: x => x * 9 / 5 - 459.67 };
  if (T[de] && T_inv[vers]) return { valeur: T_inv[vers](T[de](valeur)), dimension: 'température', de, vers };
  throw new Error(`Conversion impossible : ${de} → ${vers}. Ces unités ne mesurent pas la même grandeur.`);
}

/** Fonctions mises à disposition du calcul. */
function portee() {
  const M = Math;
  const p = {
    // trigonométrie et fonctions usuelles
    sin:M.sin, cos:M.cos, tan:M.tan, asin:M.asin, acos:M.acos, atan:M.atan, atan2:M.atan2,
    sinh:M.sinh, cosh:M.cosh, tanh:M.tanh, exp:M.exp, log:M.log, ln:M.log,
    log10:M.log10, log2:M.log2, sqrt:M.sqrt, cbrt:M.cbrt, abs:M.abs,
    pow:M.pow, min:M.min, max:M.max, round:M.round, floor:M.floor, ceil:M.ceil,
    sign:M.sign, hypot:M.hypot, PI:M.PI, pi:M.PI, E:M.E,
    // facultés utiles
    fact: n => { if (n < 0 || n > 170) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
    combin: (n, k) => p.fact(n) / (p.fact(k) * p.fact(n - k)),
    // relativité restreinte : ce que l'intuition rate le plus souvent
    gamma: v => 1 / M.sqrt(1 - (v * v) / (299792458 ** 2)),
    dilatation: (dt, v) => dt * p.gamma(v),
    contraction: (L, v) => L / p.gamma(v),
    E_mc2: m => m * 299792458 ** 2,
    // gravitation
    v_liberation: (M_, R_) => M.sqrt(2 * 6.67430e-11 * M_ / R_),
    v_orbitale:  (M_, R_) => M.sqrt(6.67430e-11 * M_ / R_),
    rayon_schwarzschild: M_ => 2 * 6.67430e-11 * M_ / (299792458 ** 2),
    periode_orbitale: (M_, a) => 2 * M.PI * M.sqrt(a ** 3 / (6.67430e-11 * M_)),
    // quantique et thermique
    E_photon: f => 6.62607015e-34 * f,
    lambda_de_broglie: (m, v) => 6.62607015e-34 / (m * v),
    wien: T => 2.897771955e-3 / T,
    stefan: T => 5.670374419e-8 * T ** 4
  };
  for (const [k, c] of Object.entries(CONSTANTES)) p[k] = c.v;
  return p;
}

/** Évalue une expression dans un contexte isolé, sans accès au système. */
export function calculer(expression, variables = {}) {
  const expr = String(expression).trim();
  if (!expr) throw new Error('Expression vide.');
  if (expr.length > 2000) throw new Error('Expression trop longue.');
  if (/\b(require|import|process|global|eval|Function|constructor|__proto__|while|for|=>)\b/.test(expr))
    throw new Error('Expression refusée : seules les mathématiques sont permises ici.');

  const contexte = vm.createContext(Object.freeze({ ...portee(), ...variables }));
  let r;
  try { r = vm.runInContext(expr, contexte, { timeout: 1500, displayErrors: false }); }
  catch (e) { throw new Error(`Calcul impossible : ${e.message}`); }
  if (typeof r !== 'number' && typeof r !== 'boolean')
    throw new Error('Le résultat n\'est pas un nombre.');
  return { expression: expr, resultat: r, lisible: formater(r) };
}

/** Mise en forme : notation scientifique quand c'est nécessaire. */
export function formater(x) {
  if (!Number.isFinite(x)) return String(x);
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-4 || a >= 1e7)) {
    const [m, e] = x.toExponential(6).split('e');
    return `${parseFloat(m)} × 10^${parseInt(e, 10)}`;
  }
  return parseFloat(x.toPrecision(10)).toLocaleString('fr-FR', { maximumFractionDigits: 10 });
}

/** Catalogue destiné au modèle, pour qu'il sache quoi appeler. */
export const aideCalcul = () => `
CONSTANTES : ${Object.keys(CONSTANTES).join(', ')}
FONCTIONS  : sin cos tan exp ln log10 sqrt cbrt abs pow hypot fact combin
RELATIVITÉ : gamma(v), dilatation(dt,v), contraction(L,v), E_mc2(m)
GRAVITATION: v_liberation(M,R), v_orbitale(M,R), rayon_schwarzschild(M), periode_orbitale(M,a)
QUANTIQUE  : E_photon(f), lambda_de_broglie(m,v), wien(T), stefan(T)
UNITÉS     : ${Object.keys(UNITES).join(', ')}`;
