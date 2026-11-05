/**
 * CLIPIA — passerelle de paiement Revolut (Cloudflare Worker, gratuit jusqu'à 100 000 requêtes/jour).
 * ⚠ Modèle fourni prêt à brancher, NON testé avec un vrai compte Revolut : fais un essai en sandbox d'abord (voir PAIEMENT-REVOLUT.md).
 *
 * Rôle : 1) POST /commander  {produit:'x10'|'cabinet', heures, email} → crée une commande Revolut et renvoie l'adresse de paiement (checkout_url)
 *        2) POST /webhook    (appelé par Revolut quand le paiement est fini) → fabrique le code signé et l'envoie par e-mail à l'acheteur.
 *
 * Secrets à créer dans Cloudflare (Settings → Variables → Secrets) — JAMAIS dans le code ni sur GitHub :
 *   REVOLUT_SECRET_KEY     clé API « secret » du Merchant API Revolut (sk_…)
 *   REVOLUT_WEBHOOK_SECRET secret de signature du webhook (affiché à la création du webhook)
 *   CLIPIA_CLE_PRIVEE      contenu base64 du champ « cle » de Clipia-CLE-PRIVEE.json
 *   RESEND_KEY             clé API Resend (envoi d'e-mails) — ou adapte envoyerMail() à ton service
 * Variables simples : REVOLUT_API (https://merchant.revolut.com ou https://sandbox-merchant.revolut.com), SITE (https://fabriceclin02-glitch.github.io/clipia), MAIL_DE ("Clipia <licence@ton-domaine.fr>"), MAIL_COPIE (ton e-mail).
 */
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const b32 = (buf) => { let bits = 0, v = 0, o = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { o += ALPHA[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += ALPHA[(v << (5 - bits)) & 31]; return o; };
const CORS = (env) => ({ 'access-control-allow-origin': new URL(env.SITE).origin, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,OPTIONS' });
const json = (env, o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS(env) } });

const PRODUITS = { x10: { montant: (h) => 1000, nom: 'Clipia X10 — licence à vie' }, cabinet: { montant: (h) => h * 500, nom: (h) => `Clipia — cabinet ${h} h` } };

async function empreinte(email) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase())); return new Uint8Array(d).slice(0, 4); }

async function fabriquerCode(env, type, email, heures = 0) {
  const msg = new Uint8Array(13); msg[0] = type; crypto.getRandomValues(msg.subarray(1, 6)); msg.set(await empreinte(email), 6); msg[10] = heures;
  const jours = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000); msg[11] = jours >> 8; msg[12] = jours & 255;
  const cle = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(env.CLIPIA_CLE_PRIVEE), c => c.charCodeAt(0)), { name: 'Ed25519' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', cle, msg));
  const tout = new Uint8Array(77); tout.set(msg); tout.set(sig, 13);
  return 'CLIPX-' + b32(tout).match(/.{1,5}/g).join('-');
}

async function verifierSignature(env, req, brut) {
  const ts = req.headers.get('revolut-request-timestamp'), sig = req.headers.get('revolut-signature') || '';
  if (!ts || !sig) return false;
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.REVOLUT_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const attendu = 'v1=' + [...new Uint8Array(await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(`v1.${ts}.${brut}`)))].map(b => b.toString(16).padStart(2, '0')).join('');
  return sig.split(',').some(s => s.trim() === attendu) && Math.abs(Date.now() - Number(ts)) < 5 * 60 * 1000;
}

async function envoyerMail(env, a, sujet, texte) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_DE, to: [a], bcc: env.MAIL_COPIE ? [env.MAIL_COPIE] : undefined, subject: sujet, text: texte }) });
  if (!r.ok) throw new Error('Envoi e-mail refusé : ' + r.status);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS(env) });

    if (url.pathname === '/commander' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const email = String(b.email || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(env, { erreur: 'E-mail invalide.' }, 400);
      const produit = b.produit === 'cabinet' ? 'cabinet' : 'x10'; const h = produit === 'cabinet' ? Math.max(1, Math.min(50, Math.round(+b.heures || 0))) : 0;
      const P = PRODUITS[produit];
      const r = await fetch(env.REVOLUT_API + '/api/orders', { method: 'POST', headers: { authorization: 'Bearer ' + env.REVOLUT_SECRET_KEY, 'content-type': 'application/json', 'revolut-api-version': '2024-09-01' },
        body: JSON.stringify({ amount: P.montant(h), currency: 'EUR', description: typeof P.nom === 'function' ? P.nom(h) : P.nom, customer: { email }, redirect_url: env.SITE + '/merci.html', merchant_order_data: { reference: `${produit}:${h}` } }) });
      const o = await r.json().catch(() => ({})); if (!r.ok || !o.checkout_url) return json(env, { erreur: 'Paiement indisponible pour le moment.' }, 502);
      return json(env, { url: o.checkout_url });
    }

    if (url.pathname === '/webhook' && req.method === 'POST') {
      const brut = await req.text();
      if (!(await verifierSignature(env, req, brut))) return new Response('signature', { status: 401 });
      const ev = JSON.parse(brut); if (ev.event !== 'ORDER_COMPLETED') return new Response('ignoré');
      // on ne fait pas confiance au message : on relit la commande chez Revolut
      const r = await fetch(`${env.REVOLUT_API}/api/orders/${ev.order_id}`, { headers: { authorization: 'Bearer ' + env.REVOLUT_SECRET_KEY, 'revolut-api-version': '2024-09-01' } });
      const o = await r.json(); if (!r.ok || o.state !== 'completed') return new Response('non payé', { status: 202 });
      const [produit, hh] = String(o.merchant_order_data?.reference || '').split(':'); const email = o.customer?.email; if (!email) return new Response('sans e-mail', { status: 202 });
      const heures = Number(hh) || 0;
      const code = await fabriquerCode(env, produit === 'cabinet' ? 2 : 1, email, heures);
      const corps = produit === 'cabinet'
        ? `Merci ! Voici ton code de recharge (${heures} h de cabinet) :\n\n${code}\n\nDans Clipia : clique sur ⏱ « Mon temps » → « J'ai un code de recharge », entre cet e-mail (${email}) et le code.\n`
        : `Merci pour ton achat de Clipia X10 !\n\nTon code de licence à vie :\n\n${code}\n\n1. Télécharge Clipia : ${env.SITE}/#telecharger\n2. Ouvre-le, entre cet e-mail (${email}) et le code.\n\nBesoin d'aide ? Réponds à ce message.\n`;
      await envoyerMail(env, email, produit === 'cabinet' ? `Ton code Clipia — ${heures} h de cabinet` : 'Ta licence Clipia X10', corps);
      return new Response('ok');
    }
    return new Response('Clipia passerelle', { status: 200 });
  }
};
