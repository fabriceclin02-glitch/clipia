/**
 * CLIPIA — Téléphones appairés par QR code.
 *  • Un code d'appairage = usage unique, 2 minutes, aléatoire (128 bits), gardé en mémoire seulement.
 *  • Chaque téléphone reçoit SON jeton (256 bits). Le serveur ne garde que son empreinte SHA-256 : révocable à tout moment.
 *  • 5 essais de code par minute et par adresse.
 */
import crypto from 'node:crypto';
import { store, uid } from '../lib/store.js';

const CODES = new Map();                       // code → { expire, nom }
const ESSAIS = new Map();                      // ip → horodatages
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const egal = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const liste = () => store.setting('appareils') || [];

export function creerCode(nomPc = 'Mon ordinateur') {
  for (const [c, v] of CODES) if (v.expire < Date.now()) CODES.delete(c);
  const code = crypto.randomBytes(16).toString('base64url');
  CODES.set(code, { expire: Date.now() + 120000, nom: nomPc });
  return { code, expire: Date.now() + 120000 };
}

/** Échange un code contre un jeton d'appareil. Le code est consommé, qu'il soit bon ou non pour cette tentative. */
export function valider(code, nomAppareil, ip = '?') {
  const m = Date.now(), l = (ESSAIS.get(ip) || []).filter(t => m - t < 60000);
  l.push(m); ESSAIS.set(ip, l);
  if (l.length > 5) return { ok: false, code: 429, erreur: 'Trop d\'essais : attends une minute.' };
  let trouve = null;
  for (const [c, v] of CODES) if (egal(c, code || '') && v.expire > m) trouve = c;     // comparaison en temps constant
  if (!trouve) return { ok: false, code: 403, erreur: 'Code invalide ou expiré : affiche un nouveau QR code sur l\'ordinateur.' };
  CODES.delete(trouve);
  const jeton = crypto.randomBytes(32).toString('base64url');
  const a = { id: uid('app'), nom: String(nomAppareil || 'Téléphone').slice(0, 60), hash: sha(jeton), creeLe: new Date().toISOString(), dernierVu: new Date().toISOString() };
  store.setting('appareils', [...liste(), a]);
  return { ok: true, jeton, id: a.id };
}

/** Rend l'appareil correspondant à ce jeton, ou null. */
export function parJeton(jeton) {
  if (!jeton) return null;
  const h = sha(jeton);
  const a = liste().find(x => egal(x.hash, h));
  if (a && Date.now() - new Date(a.dernierVu).getTime() > 30000) store.setting('appareils', liste().map(x => x.id === a.id ? { ...x, dernierVu: new Date().toISOString() } : x));
  return a || null;
}
export const appareils = () => liste().map(({ hash, ...r }) => r);
export function revoquer(id) { const av = liste().length; store.setting('appareils', liste().filter(x => x.id !== id)); return liste().length < av; }
