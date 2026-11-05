#!/usr/bin/env node
/**
 * CLIPIA — outil du VENDEUR : fabrique les codes de licence (10 € à vie) et de recharge du cabinet.
 * Il utilise ta clé privée (fichier Clipia-CLE-PRIVEE.json, à garder chez toi, jamais sur GitHub).
 *
 *   node licence.mjs creer client@mail.fr              → code de licence X10 à vie
 *   node licence.mjs recharge client@mail.fr 5          → code de 5 heures de cabinet
 *   node licence.mjs verifier client@mail.fr CODE       → contrôle un code
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const b32 = (buf) => { let bits = 0, v = 0, o = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { o += ALPHA[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += ALPHA[(v << (5 - bits)) & 31]; return o; };
const deB32 = (s) => { let bits = 0, v = 0; const o = []; for (const ch of s) { const i = ALPHA.indexOf(ch); if (i < 0) continue; v = (v << 5) | i; bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
const empreinte = (e) => crypto.createHash('sha256').update(String(e).trim().toLowerCase()).digest().subarray(0, 4);

const fichierCle = process.env.CLIPIA_CLE || [path.join(ICI, 'Clipia-CLE-PRIVEE.json'), path.join(process.cwd(), 'Clipia-CLE-PRIVEE.json')].find(f => fs.existsSync(f));
if (!fichierCle) { console.error('Clé privée introuvable : mets Clipia-CLE-PRIVEE.json à côté de cet outil (ou variable CLIPIA_CLE).'); process.exit(1); }
const privee = crypto.createPrivateKey({ key: Buffer.from(JSON.parse(fs.readFileSync(fichierCle, 'utf8')).cle, 'base64'), format: 'der', type: 'pkcs8' });
const publique = crypto.createPublicKey(privee);

function fabriquer(type, email, heures = 0) {
  const msg = Buffer.alloc(13);
  msg[0] = type; crypto.randomBytes(5).copy(msg, 1); empreinte(email).copy(msg, 6); msg[10] = heures;
  msg.writeUInt16BE(Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000), 11);
  const code = b32(Buffer.concat([msg, crypto.sign(null, msg, privee)]));
  return 'CLIPX-' + code.match(/.{1,5}/g).join('-');
}
function verifier(email, code) {
  const brut = deB32(String(code).toUpperCase().replace(/^CLIP[A-Z]?-/, '').replace(/[^0-9A-Z]/g, ''));
  if (brut.length < 77) return 'incomplet';
  if (!crypto.verify(null, brut.subarray(0, 13), publique, brut.subarray(13, 77))) return 'signature invalide';
  if (!crypto.timingSafeEqual(brut.subarray(6, 10), empreinte(email))) return 'e-mail différent';
  return brut[0] === 1 ? 'OK — licence X10 à vie' : `OK — recharge de ${brut[10]} h`;
}

const [cmd, email, arg] = process.argv.slice(2);
if (cmd === 'creer' && email) console.log(`\nCode de licence X10 pour ${email} :\n\n${fabriquer(1, email)}\n`);
else if (cmd === 'recharge' && email && +arg >= 1 && +arg <= 200) console.log(`\nCode de recharge ${+arg} h (cabinet) pour ${email} :\n\n${fabriquer(2, email, +arg)}\n`);
else if (cmd === 'verifier' && email && arg) console.log(verifier(email, arg));
else console.log('Usage :\n  node licence.mjs creer client@mail.fr\n  node licence.mjs recharge client@mail.fr 5\n  node licence.mjs verifier client@mail.fr CODE');
