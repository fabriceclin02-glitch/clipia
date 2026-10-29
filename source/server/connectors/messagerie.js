/**
 * CLIPIA X8 — Pilotage entrant par messagerie : Telegram, Slack, WhatsApp.
 *
 *  • Telegram : interrogation longue (getUpdates) → marche depuis un PC, sans adresse publique.
 *  • Slack    : Socket Mode (jeton d'application xapp-…, sans adresse publique, demande Node 22+)
 *               ou Events API (adresse publique + « signing secret »).
 *  • WhatsApp : Meta appelle /api/webhooks/whatsapp (adresse publique) ; signature X-Hub-Signature-256 obligatoire.
 *
 * Règles communes : personne n'obéit tant qu'il n'est pas dans la liste « autorisés » ; chaque webhook est
 * authentifié par signature (sinon refusé) ; un message n'est traité qu'une fois (déduplication) ;
 * débit limité par expéditeur ; le contenu reçu est une demande de l'utilisateur autorisé, jamais une
 * porte ouverte : les actions sensibles gardent leurs accords dans l'interface.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { vault } from '../lib/vault.js';
import { store } from '../lib/store.js';
import { envoyerTelegram, envoyerWhatsApp } from './publish.js';
import * as travaux from '../noyau/travaux.js';

const base = (nom, defaut) => process.env['CLIPIA_API_' + nom] || defaut;
const pause = ms => new Promise(r => setTimeout(r, ms));
const echapper = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── Secrets ─────────────────────────────────────────────────────────── */
const jetonTelegram = () => vault.resolve('connector:telegram:id', 'TELEGRAM_BOT_TOKEN');
const jetonSlack = () => vault.resolve('connexion:slack:token', 'SLACK_BOT_TOKEN');
const jetonSlackApp = () => vault.resolve('connector:slack:app', 'SLACK_APP_TOKEN');
const secretSlack = () => vault.resolve('connector:slack:signing', 'SLACK_SIGNING_SECRET');
const secretMeta = () => vault.resolve('connector:whatsapp:appsecret', 'WHATSAPP_APP_SECRET');
const jetonVerifMeta = () => vault.resolve('whatsapp:verify', 'WHATSAPP_VERIFY_TOKEN');

/* ── Qui a le droit de piloter Clipia ────────────────────────────────── */
export const autorises = () => store.setting('messagerie:autorises') || [];
export function autoriser(id) {
  const l = new Set(autorises()); l.add(String(id).trim());
  store.setting('messagerie:autorises', [...l]); return [...l];
}
export function retirerAutorisation(id) {
  store.setting('messagerie:autorises', autorises().filter(x => x !== String(id)));
  return autorises();
}

/* ── Garde-fous communs ──────────────────────────────────────────────── */
const vus = new Map();                       // identifiant de message → date (déduplication, 15 min)
export function dejaVu(id) {
  if (!id) return false;
  const maintenant = Date.now();
  for (const [k, t] of vus) if (maintenant - t > 15 * 60000) vus.delete(k);
  if (vus.has(id)) return true;
  vus.set(id, maintenant); return false;
}
const debit = new Map();                     // expéditeur → horodatages (20 messages / minute)
export function tropRapide(de) {
  const m = Date.now(), l = (debit.get(de) || []).filter(t => m - t < 60000);
  l.push(m); debit.set(de, l); return l.length > 20;
}
const refuses = new Map();                   // on ne répond à un inconnu qu'une fois / 10 min
const peutRefuser = de => { const m = Date.now(); if (m - (refuses.get(de) || 0) < 600000) return false; refuses.set(de, m); return true; };
export const _tests = { reinit: () => { vus.clear(); debit.clear(); refuses.clear(); } };

export function decouper(texte, max = 3800) {
  const s = String(texte ?? '').trim() || 'Fait.';
  const morceaux = [];
  let reste = s;
  while (reste.length > max) {
    let coupe = reste.lastIndexOf('\n', max); if (coupe < max * 0.5) coupe = reste.lastIndexOf(' ', max); if (coupe < max * 0.5) coupe = max;
    morceaux.push(reste.slice(0, coupe).trim()); reste = reste.slice(coupe).trim();
  }
  morceaux.push(reste);
  return morceaux;
}

const AIDE = `Clipia à vos ordres. Écrivez simplement ce que vous voulez :
• « génère une pochette sombre avec un corbeau »
• « fais-moi un site vitrine pour mon activité »
• « où en sont mes productions ? »

/etat — ce qui tourne en ce moment
/travail <mission> — lancer un projet en arrière-plan
/stop — arrêter tous les travaux en cours`;

/**
 * Cœur commun. `envoyer(texte)` répond sur le bon canal ; `traiter(texte, ctx)` fait réfléchir Clipia.
 * Renvoie un mot-clé (pour les tests) : 'doublon' | 'refuse' | 'limite' | 'commande' | 'reponse' | 'erreur'.
 */
export async function traiterEntrant({ canal, de, texte, id, envoyer, traiter, invite }) {
  texte = String(texte || '').trim();
  if (!texte) return 'vide';
  if (dejaVu(id ? canal + ':' + id : '')) return 'doublon';
  store.insert('events', { type: 'messagerie.recu', canal, de: String(de), apercu: texte.slice(0, 80) });

  if (!autorises().includes(String(de))) {
    if (peutRefuser(canal + de)) await envoyer(invite ? invite(de) : `Je ne vous connais pas encore. Votre identifiant est ${de} — ajoutez-le dans Clipia, section « Pilotage à distance ».`).catch(() => {});
    return 'refuse';
  }
  if (tropRapide(canal + de)) { await envoyer('Doucement : trop de messages à la suite. Réessayez dans une minute.').catch(() => {}); return 'limite'; }

  const cmd = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(texte);
  if (cmd) {
    const [, nom, arg] = cmd; const n = nom.toLowerCase();
    if (n === 'aide' || n === 'help' || n === 'start') { await envoyer(AIDE); return 'commande'; }
    if (n === 'etat') { await envoyer(travaux.pointVocal()); return 'commande'; }
    if (n === 'stop') { const k = travaux.arreterTout(); await envoyer(k ? `J'ai arrêté ${k} travail(aux).` : 'Rien ne tournait.'); return 'commande'; }
    if (n === 'travail') {
      if (!arg.trim()) { await envoyer('Dites-moi la mission : /travail fais une étude de marché pour mon activité'); return 'commande'; }
      try { const t = travaux.lancer({ mission: arg.trim().slice(0, 4000), titre: arg.trim().slice(0, 60) });
        await envoyer(`C'est parti en arrière-plan : « ${t.titre || arg.trim().slice(0, 60)} ». /etat pour suivre.`); }
      catch (e) { await envoyer('⚠ ' + e.message); }
      return 'commande';
    }
    if (n === 'silence') { arreterTelegram(); await envoyer('Je cesse d\'écouter Telegram. Relancez-moi depuis Clipia.'); return 'commande'; }
  }
  try {
    const r = await traiter(texte, { canal, de });
    const t = typeof r === 'object' && r ? (r.texte || r.resume || '') : r;
    for (const m of decouper(t)) await envoyer(m);
    if (r && typeof r === 'object' && r.fichier && fs.existsSync(r.fichier)) await envoyer({ fichier: r.fichier });
    return 'reponse';
  } catch (e) {
    await envoyer('⚠ ' + String(e.message).slice(0, 500)).catch(() => {});
    return 'erreur';
  }
}

/* ══ TELEGRAM ═════════════════════════════════════════════════════════ */
let offset = 0, tgMarche = false, tgMinuterie = null;
const envoyerTg = async (de, m) => {
  if (m && typeof m === 'object' && m.fichier) return envoyerTelegram({ canal: de, cheminVideo: m.fichier, texte: 'Voici le rendu.' });
  return envoyerTelegram({ canal: de, texte: echapper(m) });
};

export async function traiterMiseAJourTelegram(u, traiter) {
  const msg = u.message;                               // les messages MODIFIÉS sont ignorés : on n'exécute pas deux fois
  if (!msg?.text) return 'ignore';
  const de = String(msg.chat.id);
  if (!autorises().length && /^\/start/i.test(msg.text)) {
    store.insert('events', { type: 'messagerie.recu', canal: 'telegram', de, apercu: '/start' });
    await envoyerTelegram({ canal: de, texte: `<b>Clipia</b>\n\nVotre identifiant de conversation est <code>${echapper(de)}</code>.\n\nPour m'autoriser à vous obéir, ouvrez Clipia sur votre ordinateur, allez dans <b>Pilotage à distance</b> et ajoutez cet identifiant.` });
    return 'invite';
  }
  return traiterEntrant({ canal: 'telegram', de, texte: msg.text, id: u.update_id, traiter,
    envoyer: m => envoyerTg(de, m),
    invite: d => `Je ne vous connais pas encore. Votre identifiant est ${d} — ajoutez-le dans Clipia, « Pilotage à distance ».` });
}

function demarrerTelegram(traiter) {
  const t = jetonTelegram();
  if (!t) throw new Error('Jeton Telegram absent.');
  if (tgMarche) return false;
  tgMarche = true;
  (async function tourner() {
    while (tgMarche) {
      try {
        const r = await fetch(`${base('TELEGRAM', 'https://api.telegram.org')}/bot${t}/getUpdates?offset=${offset}&timeout=30`, { signal: AbortSignal.timeout(40000) });
        const j = await r.json();
        if (!j.ok) { await attendre(5000); continue; }
        for (const u of j.result || []) { offset = u.update_id + 1; traiterMiseAJourTelegram(u, traiter).catch(() => {}); }
      } catch { await attendre(4000); }
    }
  })();
  return true;
}
const attendre = ms => new Promise(r => { tgMinuterie = setTimeout(r, ms); });
function arreterTelegram() { tgMarche = false; if (tgMinuterie) clearTimeout(tgMinuterie); }

/* ══ SLACK ════════════════════════════════════════════════════════════ */
async function slackAppel(methode, corps) {
  const t = jetonSlack(); if (!t) throw new Error('Slack : jeton du bot manquant.');
  const r = await fetch(`${base('SLACK', 'https://slack.com/api')}/${methode}`, { method: 'POST',
    headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(corps), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(`Slack : ${j.error || r.status}`);
  return j;
}

export function verifierSignatureSlack(brut, entetes, maintenant = Date.now()) {
  const secret = secretSlack(); if (!secret) return { ok: false, raison: 'signing secret absent' };
  const ts = String(entetes['x-slack-request-timestamp'] || ''), sig = String(entetes['x-slack-signature'] || '');
  if (!/^\d+$/.test(ts) || Math.abs(maintenant / 1000 - Number(ts)) > 300) return { ok: false, raison: 'horodatage invalide' };
  const attendu = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:`).update(brut).digest('hex');
  const a = Buffer.from(attendu), b = Buffer.from(sig);
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b), raison: 'signature invalide' };
}

/** Évènement Slack (Socket Mode ou Events API) : messages privés et mentions du bot seulement, jamais les bots. */
export async function evenementSlack(ev, eventId, traiter) {
  if (!ev || ev.bot_id || ev.subtype) return 'ignore';
  const prive = ev.type === 'message' && ev.channel_type === 'im';
  if (!prive && ev.type !== 'app_mention') return 'ignore';
  const texte = String(ev.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
  const fil = ev.type === 'app_mention' ? (ev.thread_ts || ev.ts) : undefined;
  return traiterEntrant({ canal: 'slack', de: ev.user, texte, id: eventId || ev.client_msg_id || ev.ts, traiter,
    envoyer: m => slackAppel('chat.postMessage', { channel: ev.channel, text: typeof m === 'object' ? 'Le rendu est prêt sur votre ordinateur.' : m, ...(fil ? { thread_ts: fil } : {}) }),
    invite: d => `Je ne vous connais pas encore. Votre identifiant Slack est ${d} — ajoutez-le dans Clipia, « Pilotage à distance ».` });
}

/** Events API : renvoie {code, corps} tout de suite ; le traitement continue en arrière-plan (Slack exige une réponse en 3 s). */
export function webhookSlack(brut, entetes, traiter) {
  const v = verifierSignatureSlack(brut, entetes);
  if (!v.ok) return { code: 401, corps: { erreur: v.raison } };
  let j; try { j = JSON.parse(brut.toString('utf8')); } catch { return { code: 400, corps: { erreur: 'JSON illisible' } }; }
  if (j.type === 'url_verification') return { code: 200, corps: { challenge: String(j.challenge || '') } };
  if (j.type === 'event_callback') evenementSlack(j.event, j.event_id, traiter).catch(() => {});
  return { code: 200, corps: { ok: true } };
}

let slackMarche = false, slackWs = null;
async function demarrerSlackSocket(traiter) {
  const app = jetonSlackApp();
  if (!app) throw new Error('Jeton d\'application Slack (xapp-…) absent.');
  if (typeof WebSocket === 'undefined') throw new Error('Le mode Socket de Slack demande Node 22 ou plus (installateur Clipia : inclus).');
  if (slackMarche) return false;
  slackMarche = true;
  (async function boucle() {
    let attente = 2000;
    while (slackMarche) {
      try {
        const r = await fetch(`${base('SLACK', 'https://slack.com/api')}/apps.connections.open`, { method: 'POST', headers: { authorization: 'Bearer ' + app }, signal: AbortSignal.timeout(20000) });
        const j = await r.json(); if (!j.ok) throw new Error(j.error || 'refusé');
        await new Promise(fin => {
          const ws = slackWs = new WebSocket(j.url);
          ws.onmessage = e => {
            let env; try { env = JSON.parse(String(e.data)); } catch { return; }
            if (env.envelope_id) { try { ws.send(JSON.stringify({ envelope_id: env.envelope_id })); } catch {} }
            if (env.type === 'events_api') evenementSlack(env.payload?.event, env.payload?.event_id, traiter).catch(() => {});
            if (env.type === 'disconnect') { try { ws.close(); } catch {} }
            attente = 2000;
          };
          ws.onclose = () => fin(); ws.onerror = () => { try { ws.close(); } catch {} };
        });
      } catch { /* on retente */ }
      if (slackMarche) { await pause(attente); attente = Math.min(attente * 2, 60000); }
    }
  })();
  return true;
}
function arreterSlack() { slackMarche = false; try { slackWs?.close(); } catch {} }

/* ══ WHATSAPP ═════════════════════════════════════════════════════════ */
export function verifierSignatureMeta(brut, entetes) {
  const secret = secretMeta(); if (!secret) return { ok: false, raison: 'secret d\'application absent' };
  const sig = String(entetes['x-hub-signature-256'] || '');
  const attendu = 'sha256=' + crypto.createHmac('sha256', secret).update(brut).digest('hex');
  const a = Buffer.from(attendu), b = Buffer.from(sig);
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b), raison: 'signature invalide' };
}

/** Vérification initiale demandée par Meta (GET). */
export function verifierAbonnementMeta(params) {
  const v = jetonVerifMeta();
  return Boolean(v) && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === v;
}

export function webhookWhatsApp(brut, entetes, traiter) {
  const v = verifierSignatureMeta(brut, entetes);
  if (!v.ok) return { code: 401, corps: { erreur: v.raison } };
  let j; try { j = JSON.parse(brut.toString('utf8')); } catch { return { code: 400, corps: { erreur: 'JSON illisible' } }; }
  for (const entree of j.entry || []) for (const ch of entree.changes || []) for (const msg of ch.value?.messages || []) {
    if (msg.type !== 'text' || !msg.text?.body) continue;
    const de = String(msg.from);
    traiterEntrant({ canal: 'whatsapp', de, texte: msg.text.body, id: msg.id, traiter,
      envoyer: m => envoyerWhatsApp({ destinataire: de, texte: typeof m === 'object' ? 'Le rendu est prêt sur votre ordinateur.' : m }),
      invite: d => `Je ne vous connais pas encore. Votre numéro est ${d} — ajoutez-le dans Clipia, « Pilotage à distance ».` }).catch(() => {});
  }
  return { code: 200, corps: { ok: true } };
}

/* ══ ÉTAT & PILOTAGE ══════════════════════════════════════════════════ */
export const etatMessagerie = () => ({
  enMarche: tgMarche || slackMarche,
  configure: Boolean(jetonTelegram() || jetonSlackApp()),
  autorises: autorises(),
  recus: store.filter('events', e => e.type === 'messagerie.recu').length,
  canaux: {
    telegram: { configure: Boolean(jetonTelegram()), enMarche: tgMarche },
    slack: { configure: Boolean(jetonSlack()), socket: Boolean(jetonSlackApp()), enMarche: slackMarche, webhook: Boolean(secretSlack()) },
    whatsapp: { configure: Boolean(vault.resolve('connector:whatsapp:id', 'WHATSAPP_TOKEN')), signature: Boolean(secretMeta()), verification: Boolean(jetonVerifMeta()) }
  }
});

export function demarrer(traiter) {
  const lances = [];
  if (jetonTelegram() && demarrerTelegram(traiter)) lances.push('telegram');
  if (jetonSlackApp() && jetonSlack()) {
    demarrerSlackSocket(traiter).then(ok => ok && store.insert('events', { type: 'messagerie.slack' })).catch(e => store.insert('events', { type: 'messagerie.erreur', canal: 'slack', message: e.message }));
    lances.push('slack');
  }
  if (!lances.length && !tgMarche && !slackMarche) throw new Error('Rien à écouter : enregistrez un jeton Telegram, ou les jetons Slack (bot + application), dans Connexions.');
  store.insert('events', { type: 'messagerie.demarree', canaux: lances });
  return { enMarche: true, canaux: lances };
}

export function arreter() {
  arreterTelegram(); arreterSlack();
  store.insert('events', { type: 'messagerie.arretee' });
  return { enMarche: false };
}
