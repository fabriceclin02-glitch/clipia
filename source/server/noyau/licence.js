/**
 * CLIPIA X10 — licence à vie (10 €) et codes de recharge du cabinet.
 * Pas de serveur, pas de compte : un code signé (Ed25519) vérifié ICI avec la clé publique embarquée.
 * Seul le vendeur possède la clé privée (outils/licence.mjs) : un code ne se fabrique pas sans elle.
 * Le code est lié à l'e-mail de l'acheteur (empreinte) : un code partagé ne marche pas avec un autre e-mail.
 * Format du message signé (13 octets) : type(1) · id(5) · empreinte e-mail(4) · heures(1) · jour d'émission(2). Signature : 64 octets.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store } from '../lib/store.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const PRIX_X10 = 10;
export const URL_ACHAT = 'https://fabriceclin02-glitch.github.io/clipia/acheter.html';
export const URL_CABINET = 'https://fabriceclin02-glitch.github.io/clipia/cabinet.html';
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // base 32 de Crockford (sans I, L, O, U)

const clePublique = () => {
  const j = JSON.parse(fs.readFileSync(path.join(ICI, 'licence-publique.json'), 'utf8'));
  return crypto.createPublicKey({ key: Buffer.from(j.cle, 'base64'), format: 'der', type: 'spki' });
};
export const b32 = (buf) => { let bits = 0, v = 0, o = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { o += ALPHA[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += ALPHA[(v << (5 - bits)) & 31]; return o; };
export const deB32 = (s) => { let bits = 0, v = 0; const o = []; for (const ch of s) { const i = ALPHA.indexOf(ch); if (i < 0) continue; v = (v << 5) | i; bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
export const empreinteEmail = (e) => crypto.createHash('sha256').update(String(e || '').trim().toLowerCase()).digest().subarray(0, 4);
const normaliser = (code) => String(code || '').toUpperCase().trim().replace(/^CLIP[A-Z]?[-\s]/, '').replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

/** Vérifie un code pour un e-mail. Renvoie { ok, type:'x10'|'heures', id, heures } ou { ok:false, raison }. */
export function verifier(code, email) {
  try {
    const brut = deB32(normaliser(code)); if (brut.length < 77) return { ok: false, raison: 'Code incomplet : copie-le en entier.' };
    const msg = brut.subarray(0, 13), sig = brut.subarray(13, 77);
    if (!crypto.verify(null, msg, clePublique(), sig)) return { ok: false, raison: 'Code invalide.' };
    if (!crypto.timingSafeEqual(msg.subarray(6, 10), empreinteEmail(email))) return { ok: false, raison: 'Ce code n\'a pas été émis pour cet e-mail. Utilise l\'adresse avec laquelle tu as payé.' };
    const t = msg[0]; if (t !== 1 && t !== 2) return { ok: false, raison: 'Type de code inconnu.' };
    return { ok: true, type: t === 1 ? 'x10' : 'heures', id: msg.subarray(1, 6).toString('hex'), heures: msg[10] };
  } catch (e) { return { ok: false, raison: 'Code illisible.' }; }
}

const lire = () => store.setting('licence') || null;
export const sansLicenceAutorise = () => process.env.CLIPIA_TEST_SANS_LICENCE === '1';
export function active() { return sansLicenceAutorise() || Boolean(lire()?.id); }
export function etat() { const l = lire(); return { active: active(), depuis: l?.quand || null, email: l?.email ? l.email.replace(/^(.).*(@.*)$/, '$1•••$2') : null, prix: PRIX_X10, urlAchat: URL_ACHAT }; }

const essais = new Map();   // anti-force brute : 8 essais / 10 min
function limite() { const t = Date.now(); const a = (essais.get('g') || []).filter(x => t - x < 600000); if (a.length >= 8) return true; a.push(t); essais.set('g', a); return false; }

export function activer(email, code) {
  if (limite()) return { ok: false, raison: 'Trop d\'essais. Réessaie dans quelques minutes.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ''))) return { ok: false, raison: 'Entre l\'e-mail utilisé pour le paiement.' };
  const v = verifier(code, email); if (!v.ok) return v;
  if (v.type !== 'x10') return { ok: false, raison: 'Ce code est une recharge du cabinet : saisis-le dans « Mon temps » (⏱).' };
  store.setting('licence', { id: v.id, email: String(email).trim().toLowerCase(), quand: new Date().toISOString() });
  return { ok: true, ...etat() };
}

/** Recharge du cabinet : un code = N heures, utilisable une seule fois sur cet ordinateur. */
export function activerRecharge(email, code, crediter) {
  if (limite()) return { ok: false, raison: 'Trop d\'essais. Réessaie dans quelques minutes.' };
  const v = verifier(code, email); if (!v.ok) return v;
  if (v.type !== 'heures') return { ok: false, raison: 'Ce code est une licence : saisis-le à l\'activation.' };
  const deja = store.setting('recharges-utilisees') || [];
  if (deja.includes(v.id)) return { ok: false, raison: 'Ce code a déjà été utilisé.' };
  store.setting('recharges-utilisees', [...deja, v.id].slice(-500));
  return { ok: true, heures: v.heures, credit: crediter(v.heures, 'code-' + v.id) };
}
