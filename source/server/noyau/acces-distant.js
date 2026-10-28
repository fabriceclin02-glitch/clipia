/** CLIPIA X7 — Accès depuis le téléphone (appli installable) + serveur MCP.
 *  Sécurité : désactivé par défaut ; jeton long aléatoire (coffre) ; toute requête qui ne vient pas de l'ordinateur lui-même
 *  (autre IP, en-têtes de tunnel, nom d'hôte étranger) n'atteint QUE /telephone, /mcp et /api/telephone/*, et seulement avec le jeton.
 *  Le contrôle de l'ordinateur (souris, clavier, installation…) demande toujours l'accord sur le PC : à distance, Clipia dit « autorise sur ton PC ». */
import crypto from 'node:crypto';
import os from 'node:os';
import { createRequire } from 'node:module';
import { vault } from '../lib/vault.js';
import { store } from '../lib/store.js';

const require = createRequire(import.meta.url);
export const actif = () => store.setting('acces-distant') === true;
export function jeton() {
  let t = vault.resolve('acces-distant:jeton', 'CLIPIA_JETON_DISTANT');
  if (!t) { t = crypto.randomBytes(24).toString('hex'); vault.set('acces-distant:jeton', t); }
  return t;
}
export const regenerer = () => { const t = crypto.randomBytes(24).toString('hex'); vault.set('acces-distant:jeton', t); return t; };
export const activer = (v) => { store.setting('acces-distant', Boolean(v)); return actif(); };
export function jetonValide(h) {
  if (!actif()) return false;
  const m = /^Bearer\s+(\S+)$/i.exec(String(h || '')); const a = Buffer.from(m ? m[1] : ''), b = Buffer.from(jeton());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const LOCAUX = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export function estDistant(req) {
  const h = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const tunnel = req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || req.headers.forwarded || req.headers['x-forwarded-host'];
  return !LOCAUX.has(req.socket.remoteAddress) || Boolean(tunnel) || !(h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost'));
}
export const cheminTelephone = (p) => p === '/telephone' || p === '/telephone/' || p === '/telephone.webmanifest' || p === '/telephone-sw.js' || p === '/telephone-icone.svg' || p === '/mcp' || p.startsWith('/api/telephone/');
export function adresses(port) {
  const sortie = [];
  for (const [nom, l] of Object.entries(os.networkInterfaces())) for (const a of l || []) if (a.family === 'IPv4' && !a.internal) sortie.push({ interface: nom, url: `http://${a.address}:${port}` });
  return sortie;
}
export function qrSvg(texte) {
  const qr = require('../vendor/qrcode.cjs')(0, 'M'); qr.addData(texte); qr.make();
  const n = qr.getModuleCount(), c = 6, m = 4; let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${(x + m) * c} ${(y + m) * c}h${c}v${c}h-${c}z`;
  const t = (n + 2 * m) * c; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ── MCP (JSON-RPC 2.0 sur HTTP, version 2025-03-26 « Streamable HTTP » simplifiée : réponses JSON) ── */
export const OUTILS_MCP = [
  { name: 'clipia_demander', description: 'Demande quelque chose à Clipia (agent personnel de Fabrice sur son ordinateur) et renvoie sa réponse.',
    inputSchema: { type: 'object', properties: { message: { type: 'string', description: 'La demande, en français ou dans la langue de la personne.' } }, required: ['message'] } },
  { name: 'clipia_etat', description: 'État de Clipia : version, cerveau actif, compétences, contrôle de l\'ordinateur.', inputSchema: { type: 'object', properties: {} } },
  { name: 'clipia_competences', description: 'Liste les compétences connues de Clipia (dont celles d\'OpenClaw).', inputSchema: { type: 'object', properties: {} } }
];
export async function mcp(msg, { converser, etat, competences }) {
  const rep = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== '2.0') return err(-32600, 'Requête JSON-RPC invalide');
  switch (msg.method) {
    case 'initialize': return rep({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'clipia', version: '7.0.1' },
      instructions: 'Clipia est un agent personnel local. Le contrôle de l\'ordinateur exige l\'accord de la personne sur le PC.' });
    case 'notifications/initialized': case 'notifications/cancelled': return null;
    case 'ping': return rep({});
    case 'tools/list': return rep({ tools: OUTILS_MCP });
    case 'tools/call': {
      const n = msg.params?.name, a = msg.params?.arguments || {};
      try {
        if (n === 'clipia_demander') { const t = String(a.message || '').trim(); if (!t) return err(-32602, 'message manquant'); return rep({ content: [{ type: 'text', text: await converser(t.slice(0, 4000)) }] }); }
        if (n === 'clipia_etat') return rep({ content: [{ type: 'text', text: JSON.stringify(await etat()) }] });
        if (n === 'clipia_competences') return rep({ content: [{ type: 'text', text: JSON.stringify(competences()) }] });
        return err(-32602, 'Outil inconnu : ' + n);
      } catch (e) { return rep({ isError: true, content: [{ type: 'text', text: String(e.message || e).slice(0, 500) }] }); }
    }
    default: return err(-32601, 'Méthode inconnue : ' + msg.method);
  }
}
