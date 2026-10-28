/**
 * CLIPIA — Moteur OAuth 2.0 générique (avec PKCE).
 * Un seul code pour les 29 connecteurs : tout vient du manifeste.
 */
import crypto from 'node:crypto';
import { byId } from './manifests.js';
import { vault } from '../lib/vault.js';
import { store } from '../lib/store.js';
import { env } from '../lib/env.js';

const pending = new Map(); // state -> { connectorId, verifier, userId, shop, ts }

const clientId = c => vault.resolve(`connector:${c.id}:id`, c.idKey);
const clientSecret = c => vault.resolve(`connector:${c.id}:secret`, c.secretKey);

export const redirectUri = () => `${env('PUBLIC_URL', 'http://127.0.0.1:8787')}/api/connectors/callback`;

export function isConfigured(c) {
  if (c.auth === 'manuel') return false;
  if (c.auth === 'url') return Boolean(store.find('connections', x => x.connectorId === c.id));
  if (c.auth === 'apikey') return Boolean(clientId(c));
  return Boolean(clientId(c) && (c.pkce || clientSecret(c)));
}

/** Construit l'URL de consentement. */
export function buildAuthUrl(connectorId, { userId = 'local', shop = '' } = {}) {
  const c = byId(connectorId);
  if (!c) throw new Error(`Connecteur inconnu : ${connectorId}`);
  if (!c.authUrl) throw new Error(`${c.label} n'utilise pas OAuth : fournissez une clé API.`);
  const id = clientId(c);
  if (!id) throw new Error(`Identifiant d'application manquant pour ${c.label}. Créez-le sur ${c.console || 'la console du service'} puis enregistrez-le dans le coffre.`);

  const state = crypto.randomBytes(16).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  pending.set(state, { connectorId, verifier, userId, shop, ts: Date.now() });

  let authUrl = c.authUrl;
  if (c.needsShop) {
    if (!shop) throw new Error('Nom de la boutique Shopify requis.');
    authUrl = authUrl.replace('{shop}', shop);
  }
  const u = new URL(authUrl);
  u.searchParams.set(c.clientParam || 'client_id', id);
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  if (c.scopes?.length) u.searchParams.set('scope', c.scopes.join(c.id === 'tiktok' ? ',' : ' '));
  for (const [k, v] of Object.entries(c.extraAuth || {})) u.searchParams.set(k, v);
  if (c.pkce) {
    u.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
    u.searchParams.set('code_challenge_method', 'S256');
  }
  return { url: u.toString(), state };
}

/** Échange le code contre des jetons, puis stocke chiffré. */
export async function handleCallback({ code, state }) {
  const p = pending.get(state);
  if (!p) throw new Error('État OAuth inconnu ou expiré. Relancez la connexion.');
  pending.delete(state);
  const c = byId(p.connectorId);

  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: redirectUri(),
    [c.clientParam || 'client_id']: clientId(c)
  });
  if (c.pkce) body.set('code_verifier', p.verifier);
  const secret = clientSecret(c);
  if (secret) body.set('client_secret', secret);

  const headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  if (c.id === 'reddit' || c.id === 'x') {
    headers.authorization = 'Basic ' + Buffer.from(`${clientId(c)}:${secret}`).toString('base64');
  }
  let tokenUrl = c.tokenUrl;
  if (c.needsShop) tokenUrl = tokenUrl.replace('{shop}', p.shop);

  const r = await fetch(tokenUrl, { method: 'POST', headers, body });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = Object.fromEntries(new URLSearchParams(txt)); }
  if (!r.ok || j.error) throw new Error(`${c.label} : ${j.error_description || j.error || txt.slice(0, 200)}`);

  const tok = j.data || j; // TikTok imbrique dans .data
  vault.set(`connector:${c.id}:tokens`, JSON.stringify({
    access_token: tok.access_token, refresh_token: tok.refresh_token || null,
    expires_at: tok.expires_in ? Date.now() + tok.expires_in * 1000 : null,
    scope: tok.scope, raw_keys: Object.keys(tok)
  }), { label: `${c.label} — jetons` });

  const existing = store.find('connections', x => x.connectorId === c.id);
  const row = { connectorId: c.id, label: c.label, status: 'connecté',
    connectedAt: new Date().toISOString(), scopes: c.scopes || [], shop: p.shop || null };
  if (existing) store.update('connections', existing.id, row); else store.insert('connections', row);
  store.insert('events', { type: 'connector.connected', connectorId: c.id });
  return { connector: c.id, label: c.label, ok: true };
}

/** Jeton d'accès valide, rafraîchi si nécessaire. */
export async function accessToken(connectorId) {
  const c = byId(connectorId);
  const raw = vault.get(`connector:${c.id}:tokens`);
  if (!raw) throw new Error(`${c.label} n'est pas connecté.`);
  const t = JSON.parse(raw);
  if (t.expires_at && Date.now() > t.expires_at - 60000 && t.refresh_token) {
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token,
      [c.clientParam || 'client_id']: clientId(c) });
    const sec = clientSecret(c); if (sec) body.set('client_secret', sec);
    const r = await fetch(c.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    const j = await r.json();
    const n = j.data || j;
    if (n.access_token) {
      const next = { ...t, access_token: n.access_token, refresh_token: n.refresh_token || t.refresh_token,
        expires_at: n.expires_in ? Date.now() + n.expires_in * 1000 : null };
      vault.set(`connector:${c.id}:tokens`, JSON.stringify(next));
      return next.access_token;
    }
  }
  return t.access_token;
}

export function disconnect(connectorId) {
  vault.remove(`connector:${connectorId}:tokens`);
  const row = store.find('connections', x => x.connectorId === connectorId);
  if (row) store.remove('connections', row.id);
  store.insert('events', { type: 'connector.disconnected', connectorId });
  return true;
}

/** Signature HMAC pour les webhooks sortants. */
export function signPayload(secret, payload) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
