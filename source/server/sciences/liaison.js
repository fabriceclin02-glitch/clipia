/**
 * CLIPIA — Parler avec un humain par les ondes, sans internet.
 *
 * Trois niveaux, du plus immédiat au plus lointain :
 *
 *   1. MODEM AUDIO (ici, tout de suite, sans rien acheter)
 *      Le texte devient un son. Le haut-parleur l’émet, le micro d’en face
 *      l’entend, et le texte revient. Ça traverse une pièce, un téléphone,
 *      une radio PMR, un talkie-walkie. Aucun réseau, aucune carte SIM.
 *      Modulation FSK Bell 202 : 1200 Hz = 0, 2200 Hz = 1.
 *
 *   2. RADIO (quelques dizaines d’euros de matériel)
 *      LoRa 868 MHz en bande libre : plusieurs kilomètres, pas de licence,
 *      pas d’abonnement. Le module se branche en USB, Clipia lui parle en série.
 *
 *   3. SATELLITE (abonnement, mais couverture mondiale)
 *      Iridium Short Burst Data : 340 octets par message, partout sur Terre,
 *      y compris en mer et en montagne. Modem série, même protocole de trame.
 *
 * La trame est commune aux trois : ce que Clipia dit passe indifféremment
 * par le son, par la radio ou par le satellite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';
import { env, ffmpegBin } from '../lib/env.js';

const SR    = 8000;     // suffisant pour 2200 Hz, et léger
const ESPACE = 1200;    // bit 0
const MARQUE = 2200;    // bit 1
const BAUD  = 50;       // 50 bits/s : lent, mais ça passe dans un haut-parleur de portable
const SPB   = Math.round(SR / BAUD);
const SYNC  = 0x7e;

/** ── TRAME COMMUNE ──────────────────────────────────────────────────── */
function crc8(buf) {
  let c = 0;
  for (const o of buf) {
    c ^= o;
    for (let i = 0; i < 8; i++) c = (c & 0x80) ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

export function encadrer(texte) {
  const charge = Buffer.from(String(texte), 'utf8');
  if (charge.length > 255) throw new Error(`Message trop long : ${charge.length} octets, maximum 255 par trame.`);
  const corps = Buffer.concat([Buffer.from([charge.length]), charge]);
  return Buffer.concat([Buffer.from([SYNC]), corps, Buffer.from([crc8(corps)])]);
}

export function decadrer(buf) {
  const i = buf.indexOf(SYNC);
  if (i < 0) throw new Error('Aucune synchronisation trouvée dans le signal.');
  const len = buf[i + 1];
  if (len == null) throw new Error('Trame tronquée.');
  const corps = buf.subarray(i + 1, i + 2 + len);
  const recu = buf[i + 2 + len];
  const calcule = crc8(corps);
  if (recu !== calcule) throw new Error(`Contrôle d’intégrité en échec (reçu ${recu}, calculé ${calcule}). Le signal a été abîmé en route.`);
  return corps.subarray(1).toString('utf8');
}

/** ── 1. MODEM AUDIO — ÉMISSION ──────────────────────────────────────── */
function wav(ech) {
  const d = Buffer.alloc(ech.length * 2);
  for (let i = 0; i < ech.length; i++)
    d.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(ech[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}

export function moduler(texte, { fichier } = {}) {
  const trame = encadrer(texte);
  const bits = [];
  for (let i = 0; i < 16; i++) bits.push(i % 2);          // préambule : 8 alternances
  for (const o of trame) for (let b = 7; b >= 0; b--) bits.push((o >> b) & 1);

  const ech = new Float32Array(bits.length * SPB + SPB);
  let phase = 0, k = 0;
  for (const bit of bits) {
    const f = bit ? MARQUE : ESPACE;
    const dp = 2 * Math.PI * f / SR;
    for (let i = 0; i < SPB; i++) { ech[k++] = 0.7 * Math.sin(phase); phase += dp; }
  }
  for (let i = 0; i < SPB; i++) ech[k++] = 0;             // silence de fin

  const sortie = fichier || path.join(MEDIA_DIR, `${uid('onde')}.wav`);
  fs.writeFileSync(sortie, wav(ech));
  const st = fs.statSync(sortie);
  return store.insert('assets', {
    file: sortie, ext: 'wav', bytes: st.size, kind: 'liaison',
    url: `/media/${path.basename(sortie)}`,
    nom: `Message modulé — ${trame.length} octets`,
    detail: {
      type: 'fsk', texte, octets: trame.length, bits: bits.length,
      secondes: +(bits.length / BAUD).toFixed(2), baud: BAUD,
      espace: ESPACE, marque: MARQUE, echantillonnage: SR,
      comment: 'Jouez ce fichier sur un haut-parleur. Un autre appareil qui écoute au micro peut le redécoder en texte. Aucun réseau n’intervient.'
    }
  });
}

/** ── 1. MODEM AUDIO — RÉCEPTION ─────────────────────────────────────── */
function goertzel(ech, debut, n, f) {
  const w = 2 * Math.cos(2 * Math.PI * f / SR);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const s = ech[debut + i] + w * s1 - s2;
    s2 = s1; s1 = s;
  }
  return s1 * s1 + s2 * s2 - w * s1 * s2;
}

function pcm(chemin) {
  const r = spawnSync(ffmpegBin(),
    ['-v','error','-i', chemin, '-ac','1','-ar', String(SR), '-f','s16le','-'],
    { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('Impossible de décoder cet audio : ' + String(r.stderr).slice(0, 200));
  const b = r.stdout, n = b.length / 2, ech = new Float32Array(n);
  for (let i = 0; i < n; i++) ech[i] = b.readInt16LE(i * 2) / 32768;
  return ech;
}

export function demoduler(chemin) {
  const ech = pcm(chemin);
  if (ech.length < SPB * 24) throw new Error('Signal trop court pour contenir une trame.');

  const lire = (off) => {
    const bits = [];
    for (let p = off; p + SPB <= ech.length; p += SPB) {
      const e0 = goertzel(ech, p, SPB, ESPACE), e1 = goertzel(ech, p, SPB, MARQUE);
      bits.push({ bit: e1 > e0 ? 1 : 0, force: Math.abs(e1 - e0) / (e1 + e0 + 1e-12) });
    }
    return bits;
  };

  // Le début de trame se repère sur l’octet de synchronisation 0x7E, pas sur
  // le préambule : c’est exactement pourquoi ce motif est utilisé en HDLC.
  const MOTIF = [0,1,1,1,1,1,1,0];
  const chercher = (bits) => {
    for (let i = 0; i + 8 <= bits.length; i++) {
      let ok = true;
      for (let b = 0; b < 8; b++) if (bits[i + b].bit !== MOTIF[b]) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  };

  // On essaie plusieurs calages d’échantillon : le premier qui passe le
  // contrôle d’intégrité est le bon. Pas d’approximation, une trame est
  // valide ou elle ne l’est pas.
  const essais = [];
  for (let off = 0; off < SPB; off += Math.max(1, Math.round(SPB / 16))) {
    const bits = lire(off);
    const d = chercher(bits);
    if (d < 0) continue;
    const octets = [];
    for (let i = d; i + 8 <= bits.length; i += 8) {
      let o = 0;
      for (let b = 0; b < 8; b++) o = (o << 1) | bits[i + b].bit;
      octets.push(o);
    }
    const qualite = bits.slice(d, d + 88).reduce((s, x) => s + x.force, 0) / Math.min(88, bits.length - d);
    try {
      const texte = decadrer(Buffer.from(octets));
      return {
        texte, qualite: +qualite.toFixed(3), calage: off,
        secondes: +(ech.length / SR).toFixed(2), octets: octets.length,
        lecture: qualite > 0.8 ? 'Signal net.'
               : qualite > 0.5 ? 'Signal correct, un peu de bruit.'
               : 'Signal faible mais lu sans erreur : le contrôle d’intégrité est passé.'
      };
    } catch (err) { essais.push({ off, raison: err.message, qualite: +qualite.toFixed(3) }); }
  }

  if (!essais.length) throw new Error('Aucune trame Clipia dans ce son. Vérifiez que c’est bien un message modulé, et que le volume était suffisant.');
  const pire = essais.sort((a, b) => b.qualite - a.qualite)[0];
  throw new Error(`Trame détectée mais illisible après ${essais.length} tentatives de calage. ${pire.raison} Rapprochez les appareils, montez le volume, et coupez les bruits de fond.`);
}


/** ── MODEM DTMF — POUR LES APPELS 3G / 4G / 5G ──────────────────────────
 *  Un appel téléphonique ne transporte pas n’importe quel son : les codecs
 *  (AMR, EVS, Opus) compriment la voix et abîment une porteuse FSK. Le DTMF,
 *  lui, est le seul signal que tout le réseau téléphonique mondial est tenu
 *  de faire passer intact — c’est le son des touches. On s’en sert donc comme
 *  canal de données : 16 symboles, soit 4 bits chacun, deux symboles par octet.
 *  Résultat : Clipia parle à travers un appel vocal, sur n’importe quel réseau
 *  cellulaire, sans consommer un seul octet de données mobiles.
 */
const DTMF_SYMBOLES = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','*','#'];
const DTMF_LIGNES   = [697, 770, 852, 941];
const DTMF_COLONNES = [1209, 1336, 1477, 1633];
const DTMF_GRILLE   = [['1','2','3','A'],['4','5','6','B'],['7','8','9','C'],['*','0','#','D']];
// 75 ms de ton, 60 ms de silence. Le silence doit être plus large que la
// fenêtre d’analyse, sinon deux tons identiques qui se suivent fusionnent
// en un seul — et un octet comme 0x00 devient illisible.
const DTMF_TON = 0.075, DTMF_PAUSE = 0.060;
const DTMF_FENETRE = 0.038;   // plus courte que le silence : elle tient entre deux tons

function dtmfTons(sym) {
  for (let l = 0; l < 4; l++) for (let c = 0; c < 4; c++)
    if (DTMF_GRILLE[l][c] === sym) return [DTMF_LIGNES[l], DTMF_COLONNES[c]];
  throw new Error(`Symbole DTMF invalide : ${sym}`);
}

export function modulerDTMF(texte, { fichier } = {}) {
  const trame = encadrer(texte);
  const symboles = [];
  for (const o of trame) { symboles.push(DTMF_SYMBOLES[o >> 4], DTMF_SYMBOLES[o & 0x0f]); }

  const nTon = Math.round(DTMF_TON * SR), nPause = Math.round(DTMF_PAUSE * SR);
  const ech = new Float32Array(symboles.length * (nTon + nPause) + SR);
  let k = Math.round(SR * 0.1);
  for (const sym of symboles) {
    const [f1, f2] = dtmfTons(sym);
    for (let i = 0; i < nTon; i++) {
      // Fenêtre douce : évite les clics, que les codecs vocaux amplifient.
      const w = Math.min(1, Math.min(i, nTon - i) / (SR * 0.004));
      ech[k++] = 0.4 * w * (Math.sin(2 * Math.PI * f1 * i / SR) + Math.sin(2 * Math.PI * f2 * i / SR));
    }
    k += nPause;
  }

  const sortie = fichier || path.join(MEDIA_DIR, `${uid('dtmf')}.wav`);
  fs.writeFileSync(sortie, wav(ech));
  const st = fs.statSync(sortie);
  return store.insert('assets', {
    file: sortie, ext: 'wav', bytes: st.size, kind: 'liaison',
    url: `/media/${path.basename(sortie)}`,
    nom: `Message DTMF — ${trame.length} octets`,
    detail: {
      type: 'dtmf', texte, octets: trame.length, symboles: symboles.length,
      secondes: +(ech.length / SR).toFixed(2),
      debit: `${(trame.length * 8 / (ech.length / SR)).toFixed(0)} bits/s`,
      comment: 'À jouer dans un appel téléphonique, sur n’importe quel réseau 2G, 3G, 4G ou 5G. Le DTMF traverse les codecs vocaux là où une porteuse FSK se dégrade. Aucune donnée mobile consommée : seul le canal voix sert.'
    }
  });
}

export function demodulerDTMF(chemin) {
  const ech = pcm(chemin);
  const n = Math.round(DTMF_FENETRE * SR);
  const pas = Math.round(SR * 0.010);
  const lu = [];

  for (let p = 0; p + n <= ech.length; p += pas) {
    let e2 = 0;
    for (let i = 0; i < n; i++) e2 += ech[p + i] * ech[p + i];
    if (e2 / n < 0.0012) { lu.push(null); continue; }            // silence
    const el = DTMF_LIGNES.map(f => goertzel(ech, p, n, f));
    const ec = DTMF_COLONNES.map(f => goertzel(ech, p, n, f));
    const il = el.indexOf(Math.max(...el)), ic = ec.indexOf(Math.max(...ec));
    // Un DTMF valide a exactement un ton par groupe, nettement au-dessus du reste.
    const net = (t, i) => t[i] > 3 * (t.reduce((s, v, j) => j === i ? s : s + v, 0) / (t.length - 1));
    if (!net(el, il) || !net(ec, ic)) { lu.push(null); continue; }
    lu.push(DTMF_GRILLE[il][ic]);
  }

  // Un symbole tenu sur plusieurs fenêtres ne compte qu’une fois.
  const symboles = [];
  let precedent = null, compte = 0;
  for (const s of lu) {
    if (s && s === precedent) { compte++; continue; }
    if (precedent && compte >= 2) symboles.push(precedent);
    precedent = s; compte = s ? 1 : 0;
  }
  if (precedent && compte >= 2) symboles.push(precedent);

  if (symboles.length < 6) throw new Error(`Seulement ${symboles.length} symboles DTMF détectés. Signal trop faible ou trop bruité.`);

  // Deux symboles par octet : on essaie les deux alignements possibles.
  for (const depart of [0, 1]) {
    const octets = [];
    for (let i = depart; i + 1 < symboles.length; i += 2) {
      const h = DTMF_SYMBOLES.indexOf(symboles[i]), b = DTMF_SYMBOLES.indexOf(symboles[i + 1]);
      if (h < 0 || b < 0) break;
      octets.push((h << 4) | b);
    }
    try {
      return {
        texte: decadrer(Buffer.from(octets)), symboles: symboles.length,
        secondes: +(ech.length / SR).toFixed(2), alignement: depart,
        lecture: 'Trame DTMF lue, contrôle d’intégrité passé.'
      };
    } catch { /* on tente l’autre alignement */ }
  }
  throw new Error(`${symboles.length} symboles DTMF lus mais aucune trame valide. Des symboles ont été perdus en route.`);
}

/** ── 2 et 3. MATÉRIEL PRÉSENT SUR LA MACHINE ────────────────────────── */
const SIGNATURES = [
  { motif:/CP210|SLAB_USBtoUART|ttyUSB|wchusbserial|usbserial-\d/i, quoi:'module série USB', usages:['LoRa','Meshtastic','Iridium','APRS'] },
  { motif:/ttyACM|usbmodem/i,  quoi:'carte USB (CDC)', usages:['Meshtastic','LoRa','Arduino'] },
  { motif:/RTL2838|rtl_sdr|RTL-SDR/i, quoi:'clé SDR RTL', usages:['réception seule : satellites météo, ISS, ADS-B'] },
  { motif:/HackRF|hackrf/i, quoi:'HackRF', usages:['émission et réception large bande'] }
];

export function materiel() {
  const trouves = [];
  // Linux et macOS : les ports série apparaissent comme des fichiers.
  for (const d of ['/dev']) {
    let noms = [];
    try { noms = fs.readdirSync(d); } catch { continue; }
    for (const nom of noms) {
      for (const s of SIGNATURES) {
        if (s.motif.test(nom)) trouves.push({ port: path.join(d, nom), quoi: s.quoi, usages: s.usages });
      }
    }
  }
  // Windows : les ports COM via PowerShell.
  if (process.platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile','-Command',
      '[System.IO.Ports.SerialPort]::getportnames() -join ","'], { encoding: 'utf8' });
    for (const p of String(r.stdout || '').trim().split(',').filter(Boolean))
      trouves.push({ port: p.trim(), quoi: 'port série', usages: ['LoRa','Meshtastic','Iridium'] });
  }
  // Une clé SDR se voit en USB.
  const lsusb = spawnSync('lsusb', [], { encoding: 'utf8' });
  if (lsusb.status === 0) {
    for (const l of String(lsusb.stdout).split('\n')) {
      for (const s of SIGNATURES) if (s.motif.test(l)) trouves.push({ port: 'USB', quoi: s.quoi, usages: s.usages, ligne: l.trim() });
    }
  }
  return {
    trouves,
    verdict: trouves.length
      ? `${trouves.length} périphérique(s) utilisable(s) pour une liaison radio.`
      : 'Aucun matériel radio branché. Le modem audio fonctionne quand même : il n’a besoin que d’un haut-parleur et d’un micro.'
  };
}

/** ── LE CATALOGUE HONNÊTE ───────────────────────────────────────────── */
export const VOIES = [
  { id:'audio', nom:'Modem audio (FSK)', materiel:'Rien — haut-parleur et micro', cout:'0 €',
    portee:'La pièce, ou toute la portée du support : téléphone, talkie-walkie, radio PMR',
    debit:'50 bits/s — environ 6 caractères par seconde', licence:'Aucune',
    pret:true,
    quoi:'Le texte devient un son audible. Ça marche à travers n’importe quoi qui transporte du son, y compris un appel téléphonique ou une radio analogique. C’est la seule voie disponible immédiatement, sans rien acheter.',
    limites:'Lent, et audible — ce n’est ni discret ni chiffré. Le bruit ambiant dégrade la réception.' },

  { id:'meshtastic', nom:'LoRa / Meshtastic 868 MHz', materiel:'2 cartes LoRa (Heltec, T-Beam, RAK) en USB ou Bluetooth', cout:'25 à 40 € la carte, aucun abonnement',
    portee:'2 à 10 km en vue directe, davantage en relief dégagé ; le maillage étend la portée de nœud en nœud',
    debit:'Quelques centaines de bits/s — messages texte', licence:'Aucune : bande ISM 868 MHz libre en Europe',
    pret:false,
    quoi:'La réponse la plus sérieuse pour parler sans aucun réseau. Deux cartes à 30 €, et vous avez une messagerie autonome qui fonctionne en montagne, en mer côtière, en coupure totale. Clipia parle à la carte en série et utilise la même trame qu’ici.',
    limites:'Il faut deux appareils, un de chaque côté. Débit très faible : du texte, pas des images.',
    achat:'Chercher « Heltec LoRa 32 V3 868 MHz » ou « LILYGO T-Beam » — vérifier la fréquence 868 pour l’Europe, pas 915.' },

  { id:'iridium', nom:'Satellite Iridium (Short Burst Data)', materiel:'Modem RockBLOCK 9603 ou Iridium Edge', cout:'250 à 300 € le modem, puis environ 15 €/mois et au message',
    portee:'Toute la planète, pôles compris — il faut seulement voir le ciel',
    debit:'340 octets par message', licence:'Aucune — l’abonnement opérateur suffit',
    pret:false,
    quoi:'La vraie couverture mondiale. Le modem se branche en USB, Clipia envoie ses trames de 340 octets. C’est ce qu’utilisent les balises de détresse et les expéditions. Fonctionne là où aucun réseau terrestre n’existe.',
    limites:'Cher, très lent, et il faut une vue du ciel dégagée. Pour du texte court uniquement.',
    achat:'RockBLOCK 9603 chez Ground Control ou Sparkfun. Compter l’abonnement mensuel même sans trafic.' },

  { id:'sdr', nom:'Écoute satellite (SDR)', materiel:'Clé RTL-SDR + antenne', cout:'30 à 50 €',
    portee:'Réception seule : satellites météo NOAA et Meteor, ISS, avions ADS-B, bateaux AIS',
    debit:'Images et télémétrie reçues', licence:'Aucune — la réception est libre',
    pret:false,
    quoi:'Ne permet pas d’émettre, mais permet de recevoir pour de vrai des images météo depuis l’espace avec une antenne faite maison. Excellente première marche pour comprendre les ondes.',
    limites:'Réception uniquement. Aucune conversation possible.',
    achat:'« RTL-SDR Blog V4 » avec l’antenne télescopique fournie.' },

  { id:'sms', nom:'SMS par modem 4G / 5G', materiel:'Clé 4G USB, ou un téléphone Android en mode modem', cout:'20 à 40 € la clé, plus une carte SIM',
    portee:'Toute la couverture de l’opérateur — donc presque partout où vivent des gens',
    debit:'160 caractères par SMS', licence:'Aucune',
    pret:false,
    quoi:'Clipia pilote le modem en commandes AT et envoie ou reçoit de vrais SMS. Le SMS passe par le canal de signalisation, pas par les données mobiles : il arrive même quand la 4G est saturée ou que le forfait data est épuisé. C’est la voie la plus fiable en zone peuplée.',
    limites:'Il faut une carte SIM et du réseau. 160 caractères par message.',
    achat:'N’importe quelle clé 4G Huawei E3372 ou équivalent, ou un vieux téléphone Android relié en USB.' },

  { id:'appel', nom:'Appel vocal 2G / 3G / 4G / 5G (DTMF)', materiel:'Un téléphone, de chaque côté', cout:'0 € de matériel',
    portee:'Mondiale, partout où un appel passe',
    debit:'Environ 65 bits/s en DTMF', licence:'Aucune',
    pret:true,
    quoi:'Clipia encode le message en DTMF — le son des touches — et il suffit de le jouer dans un appel. C’est le seul signal que tout le réseau téléphonique mondial garantit de transmettre intact, codecs vocaux compris. Aucune donnée mobile consommée : seul le canal voix sert. Ça fonctionne depuis un fixe, une cabine, un téléphone satellite.',
    limites:'Lent, et il faut que quelqu’un décroche. Audible par qui écoute la ligne.' },

  { id:'radioamateur', nom:'Radioamateur (APRS, packet, HF)', materiel:'Émetteur-récepteur + licence', cout:'150 € et plus, examen à passer',
    portee:'Régionale en VHF/UHF, mondiale en HF par rebond ionosphérique',
    debit:'1200 bits/s en APRS, davantage en numérique moderne', licence:'Obligatoire : examen ANFR et indicatif personnel',
    pret:false,
    quoi:'La voie la plus puissante et la plus libre techniquement : en HF, on parle à l’autre bout du monde sans aucune infrastructure. Des réseaux entiers de relais existent déjà.',
    limites:'Il faut passer l’examen. Émettre sur ces bandes sans indicatif est illégal, et l’usage commercial y est interdit.',
    achat:'Se renseigner auprès du REF pour l’examen ; ensuite un Baofeng suffit pour commencer.' }
];

export const LEGALITE = 'Recevoir des ondes est libre. Émettre ne l’est pas partout : les bandes ISM 433 et 868 MHz sont ouvertes à tous en Europe dans les limites de puissance prévues, le satellite passe par un abonnement opérateur, mais les bandes radioamateurs exigent un indicatif délivré après examen, et les bandes réservées aux services publics ou aéronautiques sont interdites. Le modem audio ne pose aucune question : c’est du son, pas une émission radio.';
