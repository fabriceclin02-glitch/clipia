/**
 * CLIPIA — Abonnements Stripe, sans SDK (API REST + vérification HMAC).
 */
import crypto from 'node:crypto';
import { vault } from '../lib/vault.js';
import { store } from '../lib/store.js';
import { env } from '../lib/env.js';

const API = 'https://api.stripe.com/v1';
const key = () => vault.resolve('connector:stripe:id', 'STRIPE_SECRET_KEY');

export const PLANS = [
  { id:'decouverte', label:'Gratuit', price:0, currency:'EUR', period:'toujours',
    quota:{ clips:-1, images:-1, minutesVideo:-1, tokens:-1 },
    features:['Toutes les fonctions de Clipia','Moteurs gratuits et locaux (Groq, Qwen, Ollama…)','Agents, mémoire, voix, connecteurs','Mises à jour de sécurité'] },
  { id:'pro', label:'Pro', price:9.9, currency:'EUR', period:'mois', priceEnv:'STRIPE_PRICE_PRO', popular:true,
    quota:{ clips:-1, images:-1, minutesVideo:-1, tokens:-1 },
    features:['Tout le plan Gratuit','Support prioritaire (réponse sous 48 h)','Versions en avance','Ton avis oriente la feuille de route'] }
];

async function sapi(path, method = 'GET', form = null) {
  const k = key();
  if (!k) throw new Error('Clé Stripe absente. Paramètres → Coffre → Stripe.');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${k}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form) : undefined
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Stripe : ${j.error?.message || 'erreur'}`);
  return j;
}

export async function createCheckout({ planId, userId = 'local', email }) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan || !plan.priceEnv) throw new Error('Plan payant inconnu.');
  const price = vault.resolve(`stripe:price:${plan.id}`, plan.priceEnv);
  if (!price) throw new Error(`Identifiant de tarif manquant pour « ${plan.label} ». Créez le prix dans Stripe puis renseignez ${plan.priceEnv}.`);
  const base = env('PUBLIC_URL', 'http://127.0.0.1:8787');
  const s = await sapi('/checkout/sessions', 'POST', {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: `${base}/#/abonnement?ok=1&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/#/abonnement?annule=1`,
    client_reference_id: userId,
    ...(email ? { customer_email: email } : {}),
    'subscription_data[metadata][clipia_plan]': plan.id,
    'subscription_data[metadata][clipia_user]': userId,
    allow_promotion_codes: 'true'
  });
  return { url: s.url, id: s.id };
}

export async function customerPortal({ customerId }) {
  const base = env('PUBLIC_URL', 'http://127.0.0.1:8787');
  const s = await sapi('/billing_portal/sessions', 'POST', { customer: customerId, return_url: `${base}/#/abonnement` });
  return { url: s.url };
}

/** Vérifie la signature Stripe-Signature (t=...,v1=...). */
export function verifyWebhook(rawBody, sigHeader) {
  const secret = vault.resolve('stripe:webhook', 'STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET absent.');
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const got = Buffer.from(parts.v1 || '');
  if (got.length !== 64 || !crypto.timingSafeEqual(Buffer.from(expected), got)) throw new Error('Signature invalide.');
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) throw new Error('Horodatage trop ancien.');
  return JSON.parse(rawBody);
}

export function applyEvent(evt) {
  const o = evt.data.object;
  switch (evt.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const userId = o.client_reference_id || o.metadata?.clipia_user || 'local';
      const planId = o.metadata?.clipia_plan || 'pro';
      store.setting('subscription', { userId, planId, status: o.status || 'active',
        customerId: o.customer, subscriptionId: o.subscription || o.id,
        renewsAt: o.current_period_end ? new Date(o.current_period_end * 1000).toISOString() : null });
      break;
    }
    case 'customer.subscription.deleted':
      store.setting('subscription', { planId: 'decouverte', status: 'résilié' });
      break;
    case 'invoice.payment_failed':
      store.setting('subscription', { ...(store.setting('subscription') || {}), status: 'paiement en échec' });
      break;
  }
  store.insert('events', { type: 'stripe.' + evt.type });
  return true;
}

export function currentPlan() {
  const sub = store.setting('subscription');
  const active = sub && ['active', 'complete', 'trialing'].includes(sub.status);
  const id = active ? sub.planId : 'decouverte';
  return { ...(PLANS.find(p => p.id === id) || PLANS[0]), subscription: sub || null };
}

/** Quotas : renvoie { ok, reste } pour une ressource. */
export function checkQuota(resource, amount = 1) {
  const plan = currentPlan();
  const limit = plan.quota?.[resource];
  if (limit === undefined) return { ok: true };
  if (limit === -1) return { ok: true, illimite: true };
  const month = new Date().toISOString().slice(0, 7);
  const used = store.filter('usage', u => u.month === month && u.resource === resource)
    .reduce((a, b) => a + (b.amount || 0), 0);
  return { ok: used + amount <= limit, used, limit, reste: Math.max(0, limit - used), plan: plan.id };
}

export function recordUsage(resource, amount = 1, meta = {}) {
  store.insert('usage', { month: new Date().toISOString().slice(0, 7), resource, amount, ...meta });
}
