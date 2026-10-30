#!/usr/bin/env node
/**
 * CLIPIA — Serveur. Zéro dépendance npm : Node 20+ suffit.
 *   node server/index.js   →   http://127.0.0.1:8787
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import './lib/restauration.js';
import { loadEnv, ROOT, DATA_DIR, env, ffmpegBin, etatOutils } from './lib/env.js';
loadEnv();

import os from 'node:os';
import * as archiveMem from './noyau/archive.js';
import * as systemeIA from './noyau/systeme.js';
import { store, flush, uid } from './lib/store.js';
import { vault, mask } from './lib/vault.js';
import { PROVIDERS, byId as providerById, baseUrl, byTier } from './providers/registry.js';
import { chat, chatStream, ping, chatWithFallback, GatewayError, credential } from './providers/gateway.js';
import { MEDIA_DIR } from './providers/media.js';
import { CONNECTORS, byId as connectorById, groups } from './connectors/manifests.js';
import { buildAuthUrl, handleCallback, disconnect, isConfigured, redirectUri } from './connectors/oauth.js';
import { enqueue, listJobs, getJob, subscribe, cancel, stats as jobStats } from './jobs/queue.js';
import './jobs/runners.js';
import { PLANS, createCheckout, customerPortal, verifyWebhook, applyEvent, currentPlan, checkQuota } from './billing/stripe.js';
import { RATIOS } from './pipelines/music-to-clip.js';
import { lancerAgent, listerSkills, lireSkill, ecrireSkill, supprimerSkill } from './agent/loop.js';
import { listerProjets, arborescence, PROJETS_DIR } from './agent/tools.js';
import { memoire } from './memoire/index.js';
import { centre as centreIA, NOMS_INSTALLABLES } from './providers/centre-ia.js';
import { MODELES_LOCAUX, ollamaPresent, installerModele, supprimerModele } from './providers/installeur.js';
import * as ollamaLocal from './providers/ollama-local.js';
import { catalogue as orCatalogue } from './providers/openrouter-catalogue.js';
import { preparer, etatAuto, refuser, auDemarrage, recommandation } from './providers/auto-config.js';
import { creer as creerRaccourci, etatRaccourci } from './lib/raccourci.js';
import { piloter, CAPACITES } from './agent/autonome.js';
import { planifier, ameliorer, diagnostiquer, critiquer, lecons, oublierLecon } from './agent/raisonnement.js';
import { calculer, convertir, CONSTANTES, UNITES, aideCalcul, formater } from './sciences/calcul.js';
import * as audio from './sciences/audio.js';
import * as quantique from './sciences/quantique.js';
import * as neuro from './sciences/neuro.js';
import * as liaison from './sciences/liaison.js';
import * as pont from './sciences/pont.js';
import * as pensee from './sciences/pensee.js';
import * as decodeur from './sciences/decodeur.js';
import * as essaiGratuit from './providers/essai-gratuit.js';
import * as util from './utilitaires/index.js';
import * as langue from './utilitaires/langue.js';
import * as charte from './cerveau/charte.js';
import * as cgraphe from './cerveau/graphe.js';
import { journal as cjournal, preuveFichier, preuveMesure, preuveCommande, confianceReelle, TYPES_PREUVE } from './cerveau/journal.js';
import * as croles from './cerveau/roles.js';
import * as ccycle from './cerveau/cycle.js';
import * as capprendre from './cerveau/apprendre.js';
import * as clipLocal from './pipelines/clip-local.js';
import * as voix from './voix/index.js';
import * as noyauPerso from './noyau/personnalite.js';
import * as noyauDemarrage from './noyau/demarrage.js';
import * as v6 from './noyau/v6.js';
import * as credit from './noyau/credit.js';
import * as pontOC from './noyau/pont-openclaw.js';
import * as distant from './noyau/acces-distant.js';
import * as extensions from './noyau/extensions.js';
import * as studio from './noyau/studio.js';
import * as depannage from './noyau/depannage.js';
import * as logitheque from './noyau/logitheque.js';
import * as v61 from './noyau/v61.js';
import * as cnx from './noyau/connexions.js';
import * as forgeApp from './noyau/forge-app.js';
import * as noyauOutils from './noyau/outils.js';
import * as noyauMachine from './noyau/machine.js';
import * as noyauNavigateur from './noyau/navigateur.js';
import * as noyauBoucle from './noyau/boucle.js';
import * as conversations from './noyau/conversations.js';
import * as atelier from './noyau/atelier.js';
import * as autonome from './noyau/autonome.js';
import './noyau/agent-perso.js';
import * as travaux from './noyau/travaux.js';
import * as communaute from './noyau/communaute.js';
import * as ordinateur from './noyau/ordinateur.js';
import * as mcp from './noyau/mcp-client.js';
import * as planning from './noyau/planificateur.js';
import * as sauvegarde from './noyau/sauvegarde.js';
import * as initiative from './noyau/initiative.js';
import * as osClipia from './noyau/os.js';
import * as extChrome from './noyau/extension.js';
import * as installation from './noyau/installation.js';
import { demarrer as demarrerMessagerie, arreter as arreterMessagerie,
         etatMessagerie, autoriser, retirerAutorisation, autorises,
         webhookWhatsApp, webhookSlack, verifierAbonnementMeta } from './connectors/messagerie.js';

const PORT = Number(env('PORT', '8787'));
const HOST = env('HOST', '127.0.0.1');
const WEB = path.join(ROOT, 'web');
// Mode téléphone : si Clipia écoute sur le réseau (HOST=0.0.0.0), un code d'accès est OBLIGATOIRE
const RESEAU = !['127.0.0.1', 'localhost', '::1'].includes(HOST);
const CODE_ACCES = RESEAU ? (env('CLIPIA_CODE', '') || String(Math.floor(100000 + Math.random() * 900000))) : '';

const UPLOADS = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

/** Sonde les moteurs locaux : « configuré » doit vouloir dire « joignable ». */
const _sondes = new Map();   // id -> { ok, t }
async function localJoignable(p) {
  const c = _sondes.get(p.id);
  if (c && Date.now() - c.t < 15000) return c.ok;
  let ok = false;
  if (p.base === 'local') ok = p.id === 'ffmpeg' ? ffmpegPresent() : Boolean(env(p.urlKey || '', ''));
  else { const r = await ping(p.id); ok = Boolean(r.ok) && (r.models === undefined || r.models.length > 0); }
  _sondes.set(p.id, { ok, t: Date.now() });
  return ok;
}

/** Vérifie réellement la présence de FFmpeg (et la met en cache). */
let _ffmpeg = null;
function ffmpegPresent() {
  if (_ffmpeg !== null) return _ffmpeg;
  try {
    const r = spawnSync(ffmpegBin(), ['-version'], { timeout: 5000, windowsHide: true });
    _ffmpeg = r.status === 0;
  } catch { _ffmpeg = false; }
  return _ffmpeg;
}

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.mp4':'video/mp4',
  '.mp3':'audio/mpeg', '.wav':'audio/wav', '.webm':'video/webm', '.ico':'image/x-icon', '.woff2':'font/woff2' , '.pdf':'application/pdf', '.jpeg':'image/jpeg', '.webp':'image/webp', '.md':'text/markdown; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.csv':'text/csv; charset=utf-8', '.zip':'application/zip' };

const json = (res, data, code = 200) => {
  const b = JSON.stringify(data);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(b) });
  res.end(b);
};
const fail = (res, e) => {
  const code = e instanceof GatewayError ? e.status : (e.status || 400);
  json(res, { erreur: e.message || String(e), fournisseur: e.provider }, code >= 400 && code < 600 ? code : 400);
};

async function body(req, limit = 200 * 1024 * 1024) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new Error('Corps de requête trop volumineux.'); chunks.push(c); }
  return Buffer.concat(chunks);
}
const jbody = async req => { const b = await body(req); return b.length ? JSON.parse(b.toString('utf8')) : {}; };

function serveStatic(res, file, req) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('introuvable'); }
  const stat = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {           // lecture vidéo avec saut
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = parseInt(s, 10) || 0;
    const end = e ? parseInt(e, 10) : stat.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${stat.size}`,
      'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes',
    'cache-control': file.includes('/media/') ? 'public, max-age=31536000' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

/** Téléversement multipart minimal (un fichier par requête). */
function parseMultipart(buf, boundary) {
  const bb = Buffer.from('--' + boundary);
  const parts = []; let i = buf.indexOf(bb);
  while (i >= 0) {
    const next = buf.indexOf(bb, i + bb.length);
    if (next < 0) break;
    const chunk = buf.subarray(i + bb.length + 2, next - 2);
    const sep = chunk.indexOf('\r\n\r\n');
    if (sep > 0) {
      const head = chunk.subarray(0, sep).toString('utf8');
      const name = /name="([^"]+)"/.exec(head)?.[1];
      const filename = /filename="([^"]*)"/.exec(head)?.[1];
      parts.push({ name, filename, data: chunk.subarray(sep + 4) });
    }
    i = next;
  }
  return parts;
}

/** Résumé des moyens disponibles, donné au pilote autonome. */
async function resumeStudio() {
  const dispo = [];
  for (const x of PROVIDERS) {
    const ok = x.tier === 'local-gratuit' ? await localJoignable(x) : Boolean(credential(x));
    if (ok) dispo.push(`${x.id} (${x.kind}${x.models?.length ? ', ex. ' + x.models[0] : ''})`);
  }
  const conn = store.all('connections').map(c => c.connectorId);
  const med = store.all('assets').slice(-8).map(a => `${a.nom || a.kind}: ${a.file}`);
  return [
    `Moteurs utilisables : ${dispo.join(', ') || 'aucun'}`,
    `Plateformes connectées : ${conn.join(', ') || 'aucune'}`,
    `FFmpeg : ${ffmpegPresent() ? 'disponible' : 'absent — pas de montage vidéo'}`,
    med.length ? `Derniers fichiers :\n${med.join('\n')}` : 'Aucun fichier dans la médiathèque.'
  ].join('\n');
}

/** Exécute une tâche du studio et attend son résultat. */
function executerTache(type, payload) {
  // Les calculs sont immédiats : inutile de passer par la file de tâches.
  if (type === 'calculer')        return Promise.resolve(calculer(payload.expression, payload.variables || {}));
  if (type === 'convertir')       return Promise.resolve(convertir(Number(payload.valeur), payload.de, payload.vers));
  if (type === 'quantique')       return Promise.resolve(quantique.circuit(payload));
  if (type === 'radio')           return Promise.resolve(quantique.radio(payload));
  if (type === 'pilotage-qubit')  return Promise.resolve(quantique.pilotageMicroonde(payload));
  if (type === 'analyser-audio')  return audio.analyser(payload.chemin);
  if (type === 'son-cognitif')    return payload.type === 'isochrone' ? audio.isochrone(payload)
                                        : payload.type === 'bruit' ? audio.bruit(payload)
                                        : audio.binaural(payload);

  const vrai = type === 'agent-code' ? 'agent' : type;
  return new Promise((resolve, reject) => {
    if (vrai === 'agent') {
      import('./agent/loop.js').then(({ lancerAgent }) =>
        lancerAgent({ projet: payload.projet || 'projet', demande: payload.demande,
          provider: payload.provider || payload.llm?.provider, skills: payload.skills || [] })
          .then(r => resolve(r.resume)).catch(reject));
      return;
    }
    const job = enqueue(vrai, payload);
    const un = subscribe(job.id, j => {
      if (j.status === 'terminé') { un(); resolve(j.result); }
      if (j.status === 'échec') { un(); reject(new Error(j.error)); }
    });
  });
}

/** Réponse à un message reçu : le pilote autonome s'en charge. */
async function repondreMessage(texte, opts) {
  const prov = opts.provider || PROVIDERS.find(x => credential(x) && ['openai','anthropic','gemini','ollama'].includes(x.kind))?.id;
  if (!prov) return "Aucun moteur IA n'est configuré sur le studio.";
  const r = await piloter({ objectif: texte, provider: prov, model: opts.model,
    maxEtapes: 10, etatStudio: await resumeStudio() }, executerTache);
  return r.question ? `❓ ${r.question}` : r.resume;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  // CORS : utile pour le mode desktop/Android qui sert l'interface depuis un autre origine
  res.setHeader('access-control-allow-origin', env('CORS_ORIGIN', '*'));
  res.setHeader('access-control-allow-headers', 'content-type, authorization, stripe-signature, x-clipia-ext');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // X7 — accès distant : tout ce qui ne vient pas de l'ordinateur lui-même n'atteint que le téléphone/MCP, avec jeton.
  const distantReq = distant.estDistant(req);
  const webhookSigne = req.method !== 'OPTIONS' && (p === '/api/webhooks/whatsapp' || p === '/api/webhooks/slack');   // authentifiés par signature (Meta, Slack)
  if (distantReq && !RESEAU && !distant.cheminTelephone(p) && !webhookSigne) { res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Accès refusé : cette adresse ne donne accès qu\'à l\'appli téléphone de Clipia.'); }
  if (distantReq && distant.cheminTelephone(p)) {
    if (!distant.actif()) { res.writeHead(404); return res.end('Accès téléphone désactivé.'); }
    if (p === '/telephone' || p === '/telephone/') return serveStatic(res, path.join(WEB, 'telephone.html'), req);
    if (p === '/telephone.webmanifest') { res.writeHead(200, { 'content-type': 'application/manifest+json' }); return res.end(JSON.stringify({ name: 'Clipia', short_name: 'Clipia', start_url: '/telephone', scope: '/', display: 'standalone', background_color: '#070b16', theme_color: '#070b16', icons: [{ src: '/telephone-icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] })); }
    if (p === '/telephone-icone.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#070b16"/><defs><radialGradient id="g" cx=".35" cy=".3"><stop offset="0" stop-color="#e3dcff"/><stop offset=".5" stop-color="#7c5cff"/><stop offset="1" stop-color="#2a1a7a"/></radialGradient></defs><circle cx="256" cy="256" r="150" fill="url(#g)"/></svg>'); }
    if (p === '/telephone-sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end("self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('fetch',()=>{});"); }
    if (!distant.jetonValide(req.headers.authorization)) { res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' }); return res.end(JSON.stringify({ erreur: 'Jeton manquant ou invalide.' })); }
  }
  if (distant.cheminTelephone(p) && !distantReq) {
    if (p === '/telephone' || p === '/telephone/') return serveStatic(res, path.join(WEB, 'telephone.html'), req);
    if ((p === '/mcp' || p.startsWith('/api/telephone/')) && !distant.jetonValide(req.headers.authorization)) { res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' }); return res.end(JSON.stringify({ erreur: 'Jeton manquant ou invalide.' })); }
  }
  if (RESEAU) {
    const ck = /(?:^|; )clipia_code=(\d+)/.exec(req.headers.cookie || '');
    const ok = (ck && ck[1] === CODE_ACCES) || req.headers.authorization === 'Bearer ' + CODE_ACCES
      || distant.cheminTelephone(p)
      || ((p === '/api/ext/attendre' || p === '/api/ext/resultat') && extChrome.jetonValide(req.headers['x-clipia-ext']));
    if (!ok) {
      if (p === '/acces' && req.method === 'POST') {
        let b = ''; for await (const c of req) { b += c; if (b.length > 200) break; }
        const c = new URLSearchParams(b).get('code') || '';
        if (c.trim() === CODE_ACCES) {
          res.writeHead(303, { 'set-cookie': `clipia_code=${CODE_ACCES}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`, location: '/' });
          return res.end();
        }
      }
      if (p === '/manifest.json' || p.startsWith('/assets/icone')) { /* icônes publiques */ }
      else {
        res.writeHead(p.startsWith('/api/') ? 401 : 200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Clipia</title><body style="background:#070b16;color:#eef;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0"><form method=post action=/acces style="text-align:center;padding:24px"><h2>Clipia</h2><p>Entre le code affiché sur ton ordinateur</p><input name=code inputmode=numeric autofocus style="font-size:28px;text-align:center;width:9em;padding:10px;border-radius:12px;border:0"><br><br><button style="font-size:18px;padding:12px 28px;border:0;border-radius:12px;background:#7c5cff;color:#fff">Entrer</button></form>`);
      }
    }
  }

  try {
    // ─── ÉTAT GLOBAL ──────────────────────────────────────────────────────
    if (p === '/api/etat') {
      const locaux = byTier('local-gratuit');
      const sondes = await Promise.all(locaux.map(async l => ({ id: l.id, ...(await ping(l.id)) })));
      return json(res, {
        version: '8.4.0', mode: 'opérationnel',
        fournisseurs: {
          total: PROVIDERS.length,
          configures: PROVIDERS.filter(x => x.tier !== 'local-gratuit' && credential(x)).length,
          locauxActifs: sondes.filter(s => s.ok).length
        },
        connecteurs: {
          total: CONNECTORS.length,
          connectes: store.all('connections').length,
          configures: CONNECTORS.filter(isConfigured).length
        },
        taches: jobStats(),
        plan: currentPlan(),
        medias: store.all('assets').length,
        ffmpeg: ffmpegPresent()
      });
    }

    // ─── FOURNISSEURS IA ──────────────────────────────────────────────────
    if (p === '/api/fournisseurs' && req.method === 'GET') {
      const sondes = await Promise.all(PROVIDERS.map(async x =>
        x.tier === 'local-gratuit' ? await localJoignable(x) : Boolean(credential(x))));
      return json(res, PROVIDERS.map((x, i) => ({
        id: x.id, label: x.label, kind: x.kind, tier: x.tier, modalities: x.modalities,
        models: x.models, docs: x.docs, install: x.install, freeTier: Boolean(x.freeTier),
        base: baseUrl(x), configure: sondes[i], envKey: x.envKey || x.urlKey || null
      })));
    }
    if (p.startsWith('/api/fournisseurs/') && p.endsWith('/ping')) {
      return json(res, await ping(p.split('/')[3]));
    }

    // ─── CHAT (streamé) ───────────────────────────────────────────────────
    if (p === '/api/chat' && req.method === 'POST') {
      const b = await jbody(req);
      if (b.stream === false) return json(res, await chat(b.provider, b));
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      try {
        const r = await chatStream(b.provider, b, d => res.write(`data: ${JSON.stringify({ delta: d })}\n\n`));
        res.write(`data: ${JSON.stringify({ done: true, text: r.text })}\n\n`);
      } catch (e) { res.write(`data: ${JSON.stringify({ erreur: e.message })}\n\n`); }
      return res.end();
    }
    if (p === '/api/chat/cascade' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await chatWithFallback(b.chaine, b));
    }

    // ─── COFFRE DE SECRETS ────────────────────────────────────────────────
    if (p === '/api/coffre' && req.method === 'GET') return json(res, vault.inventory());
    if (p === '/api/coffre' && req.method === 'POST') {
      const { id, valeur, label } = await jbody(req);
      if (!id) throw new Error('Identifiant de secret manquant.');
      vault.set(id, valeur, { label });
      return json(res, { ok: true, indice: mask(valeur) });
    }
    if (p.startsWith('/api/coffre/') && req.method === 'DELETE') {
      vault.remove(decodeURIComponent(p.slice('/api/coffre/'.length)));
      return json(res, { ok: true });
    }


    // ─── TEST D'UNE CLÉ AVANT ENREGISTREMENT ──────────────────────────────
    if (p === '/api/coffre/tester' && req.method === 'POST') {
      const { fournisseur, valeur } = await jbody(req);
      const prov = providerById(fournisseur);
      if (!prov) return json(res, { ok: false, message: 'Fournisseur inconnu.' }, 200);

      const v = String(valeur || '').trim();
      if (!v) return json(res, { ok: false, message: 'Collez votre clé avant de tester.' }, 200);

      // Garde-fous : on refuse ce qui n'est manifestement pas une clé.
      if (/\s/.test(v))
        return json(res, { ok: false, message: "Cette valeur contient des espaces : ce n'est pas une clé. Vous avez peut-être collé une commande ou une phrase." }, 200);
      if (/^(irm|iwr|curl|wget|powershell|npm|pip|ollama|https?:)/i.test(v))
        return json(res, { ok: false, message: "Vous avez collé une commande ou une adresse, pas une clé. Une clé est une longue suite de lettres et de chiffres, sans espace." }, 200);
      if (v.length < 15)
        return json(res, { ok: false, message: 'Trop court pour être une clé.' }, 200);

      const attendu = { openai: 'sk-', anthropic: 'sk-ant-', groq: 'gsk_', mistral: '', deepseek: 'sk-',
        openrouter: 'sk-or-', together: '', xai: 'xai-', perplexity: 'pplx-', stability: 'sk-',
        replicate: 'r8_', elevenlabs: '', fal: '', gemini: 'AIza' }[fournisseur];
      if (attendu && !v.startsWith(attendu))
        return json(res, { ok: false,
          message: `Une clé ${prov.label} commence par « ${attendu} ». La vôtre commence par « ${v.slice(0, 6)} » — elle vient peut-être d'un autre service.` }, 200);

      // Essai réel : on interroge le fournisseur avec cette clé.
      try {
        const url = baseUrl(prov);
        let r;
        if (prov.kind === 'gemini') r = await fetch(`${url}/models?key=${encodeURIComponent(v)}`, { signal: AbortSignal.timeout(12000) });
        else if (prov.kind === 'anthropic') r = await fetch(`${url}/models`, { headers: { 'x-api-key': v, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(12000) });
        else r = await fetch(`${url}/models`, { headers: { authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(12000) });

        if (r.status === 401 || r.status === 403)
          return json(res, { ok: false, message: `${prov.label} refuse cette clé. Vérifiez que vous l'avez copiée en entier, et qu'elle vient bien de ${prov.label}.` }, 200);
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          return json(res, { ok: false, message: `${prov.label} a répondu ${r.status}. ${t.slice(0, 160)}` }, 200);
        }
        const j = await r.json().catch(() => ({}));
        const modeles = (j.data || j.models || []).map(m => (m.id || m.name || '').replace('models/', '')).filter(Boolean);
        return json(res, { ok: true, message: `Clé valide — ${modeles.length} modèle(s) accessible(s).`, modeles: modeles.slice(0, 60) });
      } catch (e) {
        return json(res, { ok: false, message: e.name === 'TimeoutError'
          ? `${prov.label} n'a pas répondu. Vérifiez votre connexion.`
          : `Échec du test : ${e.message}` }, 200);
      }
    }

    // ─── CONNECTEURS ──────────────────────────────────────────────────────
    if (p === '/api/connecteurs' && req.method === 'GET') {
      const conn = store.all('connections');
      return json(res, {
        groupes: groups(),
        redirection: redirectUri(),
        items: CONNECTORS.map(c => ({
          id: c.id, label: c.label, group: c.group, color: c.color, auth: c.auth,
          actions: c.actions, console: c.console, note: c.note, needsShop: Boolean(c.needsShop),
          configure: isConfigured(c),
          connecte: conn.some(x => x.connectorId === c.id),
          idKey: c.idKey, secretKey: c.secretKey
        }))
      });
    }
    if (p === '/api/connecteurs/connexion' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, buildAuthUrl(b.id, b));
    }
    if (p === '/api/connectors/callback') {
      const code = url.searchParams.get('code'), state = url.searchParams.get('state');
      const err = url.searchParams.get('error');
      let html;
      if (err) html = `<h2>Connexion refusée</h2><p>${err}</p>`;
      else {
        try { const r = await handleCallback({ code, state }); html = `<h2>${r.label} connecté ✅</h2><p>Vous pouvez fermer cet onglet.</p>`; }
        catch (e) { html = `<h2>Échec</h2><pre>${e.message}</pre>`; }
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0b1020;color:#e8ecf8;display:grid;place-items:center;height:100vh;text-align:center">${html}<script>setTimeout(()=>window.close(),2500)</script></body>`);
    }
    if (p.startsWith('/api/connecteurs/') && req.method === 'DELETE') {
      return json(res, { ok: disconnect(p.split('/')[3]) });
    }

    // ─── TÉLÉVERSEMENT ────────────────────────────────────────────────────
    if (p === '/api/televerser' && req.method === 'POST') {
      const ct = req.headers['content-type'] || '';
      const boundary = /boundary=(.+)$/.exec(ct)?.[1];
      if (!boundary) throw new Error('Requête multipart attendue.');
      const parts = parseMultipart(await body(req), boundary.replace(/^"|"$/g, ''));
      const f = parts.find(x => x.filename);
      if (!f) throw new Error('Aucun fichier reçu.');
      const safe = f.filename.replace(/[^\w.\-]/g, '_');
      const file = path.join(UPLOADS, `${uid('up')}_${safe}`);
      fs.writeFileSync(file, f.data);
      const row = store.insert('assets', { file, kind: 'source', url: `/uploads/${path.basename(file)}`,
        nom: f.filename, bytes: f.data.length, ext: path.extname(safe).slice(1) });
      return json(res, row);
    }

    // ─── TÂCHES ───────────────────────────────────────────────────────────
    if (p === '/api/taches' && req.method === 'GET') return json(res, listJobs());
    if (p === '/api/taches' && req.method === 'POST') {
      const b = await jbody(req);
      if (b.type === 'clip') {
        const q = checkQuota('clips');
        if (!q.ok) throw new Error(`Quota de clips atteint (${q.used}/${q.limit}) pour le plan ${q.plan}. Passez à l'offre supérieure dans Abonnement.`);
      }
      return json(res, enqueue(b.type, b.payload || b, { titre: b.titre }));
    }
    if (p.startsWith('/api/taches/') && p.endsWith('/flux')) {
      const id = p.split('/')[3];
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const j0 = getJob(id);
      if (j0) res.write(`data: ${JSON.stringify(j0)}\n\n`);
      const un = subscribe(id, j => {
        res.write(`data: ${JSON.stringify(j)}\n\n`);
        if (['terminé', 'échec', 'annulé'].includes(j.status)) { un(); res.end(); }
      });
      req.on('close', un);
      return;
    }
    if (p.startsWith('/api/taches/') && req.method === 'DELETE') return json(res, { ok: cancel(p.split('/')[3]) });
    if (p.startsWith('/api/taches/') && req.method === 'GET') return json(res, getJob(p.split('/')[3]) || {});


    // ─── SANTÉ (V5) : ce qui marche, ce qui manque, et réparations ─────────
    if (p === '/api/v5/sante' && req.method === 'GET') return json(res, await santeV5());
    // ─── V6.1 : remonter le temps, répétition à blanc, conseil, forge, connexions, atelier d'apps ───
    if (p.startsWith('/api/v61/') || p.startsWith('/apercu/')) {
      const garde = () => { if (req.headers['x-clipia-accord'] !== '1') { json(res, { erreur: "Réservé à l'interface." }, 403); return false; } return true; };
      if (p === '/api/v61/etat' && req.method === 'GET') {
        const off = new Set(v6.integreesOff());
        return json(res, { blanc: v61.repetitionBlanc(), journal: v61.listeJournal(60), propositions: v61.propositions().map(x => ({ id: x.id, nom: x.nom, description: x.description, texte: x.texte, tache: x.tache })),
          connexions: cnx.etatConnexions(), apps: forgeApp.apps().slice().reverse(),
          competences: v6.competences().map(c => ({ id: c.id, nom: c.nom, description: c.description, source: c.source, actif: !(c.source === 'integree' && off.has(c.id)) })).concat([...off].map(id => { const c = v6.INTEGREES_LISTE?.find(i => i.id === id); return c ? { id, nom: c.nom, description: c.description, source: 'integree', actif: false } : null; }).filter(Boolean)) });
      }
      if (p === '/api/v61/blanc' && req.method === 'POST') { if (!garde()) return; return json(res, { blanc: v61.definirBlanc((await jbody(req)).actif) }); }
      if (p === '/api/v61/annuler' && req.method === 'POST') { if (!garde()) return; try { return json(res, v61.annuler(String((await jbody(req)).id || ''))); } catch (e) { return json(res, { erreur: e.message }, 400); } }
      if (p === '/api/v61/conseil' && req.method === 'POST') {
        const b = await jbody(req);
        try { return json(res, await v61.conseil({ message: String(b.message || ''), historique: Array.isArray(b.historique) ? b.historique : [] })); } catch (e) { return json(res, { erreur: e.message }, 200); }
      }
      if (p === '/api/v61/forge' && req.method === 'POST') { const b = await jbody(req); try { return json(res, await v61.proposerCompetence({ tache: String(b.tache || ''), etapes: Array.isArray(b.etapes) ? b.etapes : [], nom: b.nom })); } catch (e) { return json(res, { erreur: e.message }, 200); } }
      if (p === '/api/v61/forge/accepter' && req.method === 'POST') { if (!garde()) return; const b = await jbody(req); try { return json(res, { ok: v61.accepterCompetence(String(b.id), b.texte) }); } catch (e) { return json(res, { erreur: e.message }, 400); } }
      if (p === '/api/v61/forge/refuser' && req.method === 'POST') { if (!garde()) return; return json(res, { ok: v61.refuserCompetence(String((await jbody(req)).id)) }); }
      if (p === '/api/v61/integree' && req.method === 'POST') { if (!garde()) return; const b = await jbody(req); return json(res, { off: v6.basculerIntegree(String(b.id), Boolean(b.actif)) }); }
      if (p === '/api/v61/competence/url' && req.method === 'POST') {
        if (!garde()) return;
        const u = String((await jbody(req)).url || '').trim();
        let url; try { url = new URL(u); } catch { return json(res, { erreur: 'Adresse invalide.' }, 400); }
        if (url.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(url.hostname) || !url.hostname.includes('.')) return json(res, { erreur: 'Seules les adresses https publiques sont acceptées.' }, 400);
        // github.com/…/blob/… → raw.githubusercontent.com
        const brut = url.hostname === 'github.com' ? u.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') : u;
        try { const r = await fetch(brut, { signal: AbortSignal.timeout(15000) }); const t = (await r.text()).slice(0, 60000); if (!r.ok) return json(res, { erreur: `Téléchargement refusé (${r.status}).` }, 400);
          const nom = (/^name:\s*(.+)$/mi.exec(t) || [, url.pathname.split('/').filter(Boolean).slice(-2, -1)[0] || 'competence'])[1].trim(); const description = (/^description:\s*(.+)$/mi.exec(t) || [, ''])[1].trim();
          return json(res, { nom, description, texte: t.replace(/^---[\s\S]*?\n---\s*/, '').slice(0, 12000) }); } catch (e) { return json(res, { erreur: 'Impossible de lire cette adresse : ' + e.message }, 400); }
      }
      if (p === '/api/v61/competence/ajouter' && req.method === 'POST') {
        if (!garde()) return; const b = await jbody(req); const nom = String(b.nom || '').trim().slice(0, 80); if (!nom || !String(b.texte || '').trim()) return json(res, { erreur: 'Nom et texte requis.' }, 400);
        const cur = v6.competencesPerso(); cur.push({ id: 'ajout-' + crypto.randomBytes(4).toString('hex'), nom, description: String(b.description || '').slice(0, 300), texte: String(b.texte).slice(0, 12000), source: 'ajoutee', importe: new Date().toISOString() });
        store.setting('competences', cur); return json(res, { ok: true, total: cur.length });
      }
      if (p === '/api/v61/connexions' && req.method === 'GET') return json(res, cnx.etatConnexions());
      if (p === '/api/v61/connexions/enregistrer' && req.method === 'POST') {
        if (!garde()) return; const b = await jbody(req); const c = cnx.CONNEXIONS.find(x => x.id === b.id); if (!c) return json(res, { erreur: 'Connexion inconnue.' }, 400);
        for (const f of c.champs) { const v = String(b.valeurs?.[f.cle] ?? '').trim(); if (v) vault.set(f.cle, v, { label: c.nom }); }
        return json(res, cnx.etatConnexions().find(x => x.id === c.id));
      }
      if (p === '/api/v61/connexions/oublier' && req.method === 'POST') {
        if (!garde()) return; const b = await jbody(req); const c = cnx.CONNEXIONS.find(x => x.id === b.id); if (!c) return json(res, { erreur: 'Connexion inconnue.' }, 400);
        for (const f of c.champs) { try { vault.remove(f.cle); } catch {} } if (c.oauth) cnx.deconnecter(c.oauth); return json(res, { ok: true });
      }
      if (p === '/api/v61/connexions/tester' && req.method === 'POST') {
        const b = await jbody(req); const c = cnx.CONNEXIONS.find(x => x.id === b.id); if (!c) return json(res, { ok: false, message: 'Connexion inconnue.' });
        if (c.testFournisseur) { const r = await ping(c.testFournisseur); return json(res, { ok: Boolean(r.ok), message: r.ok ? 'Claude répond : clé valide.' : (r.error || 'Clé refusée.') }); }
        return json(res, await cnx.testerConnexion(c.id));
      }
      if (p === '/api/v61/oauth/demarrer' && req.method === 'POST') { if (!garde()) return; try { return json(res, cnx.demarrerOAuth(String((await jbody(req)).service), req.headers.host || '127.0.0.1:8787')); } catch (e) { return json(res, { erreur: e.message }, 400); } }
      if (p === '/api/v61/oauth/retour' && req.method === 'GET') {
        const q = new URL(req.url, 'http://x').searchParams; let msg, ok = true;
        try { const s = await cnx.finirOAuth({ code: q.get('code'), state: q.get('state'), erreur: q.get('error') }); msg = `${s === 'google' ? 'Google' : 'Microsoft'} est connecté à Clipia.`; } catch (e) { ok = false; msg = e.message; }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Clipia</title><body style="background:#070b16;color:#eef;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center"><div><div style="font-size:60px">${ok ? '✅' : '⚠️'}</div><h2>${msg.replace(/[<>&]/g, '')}</h2><p>${ok ? 'Tu peux fermer cet onglet et retourner dans Clipia.' : 'Retourne dans Clipia, onglet Connexions, et réessaie.'}</p></div>`);
      }
      if (p === '/api/v61/apps' && req.method === 'GET') return json(res, forgeApp.apps().slice().reverse());
      if (p === '/api/v61/apps/creer' && req.method === 'POST') {
        if (!garde()) return; const b = await jbody(req);
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
        const envoyer = d => { try { res.write(`data: ${JSON.stringify(d)}\n\n`); } catch {} };
        const ctl = new AbortController(); req.on('close', () => ctl.abort());
        try { const a = await forgeApp.creerApp({ description: String(b.description || ''), type: String(b.type || 'web'), nom: String(b.nom || ''), onEvent: envoyer, signal: ctl.signal }); envoyer({ type: 'termine', app: a }); }
        catch (e) { envoyer({ type: 'erreur', message: e.message }); }
        return res.end();
      }
      let m = /^\/api\/v61\/apps\/([\w-]+)\/zip$/.exec(p);
      if (m && req.method === 'GET') { const z = forgeApp.zipDossier(m[1]); res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${m[1]}.zip"` }); return res.end(z); }
      m = /^\/api\/v61\/apps\/([\w-]+)\/fichiers$/.exec(p);
      if (m && req.method === 'GET') return json(res, forgeApp.listerFichiers(m[1]));
      m = /^\/apercu\/([\w-]+)\/?(.*)$/.exec(p);
      if (m && req.method === 'GET') {
        const racine = forgeApp.dossierApp(m[1]); const rel = decodeURIComponent(m[2] || '') || 'index.html'; const f = path.resolve(racine, rel);
        if (!f.startsWith(racine + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Fichier introuvable.'); }
        // Bac à sable : le code de l'application créée n'a AUCUN accès à Clipia (origine opaque, pas de cookies).
        res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'text/plain; charset=utf-8', 'content-security-policy': "sandbox allow-scripts allow-forms allow-modals allow-popups; default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; form-action 'none'", 'x-content-type-options': 'nosniff' });
        return res.end(fs.readFileSync(f));
      }
    }
    // ─── V6 : modes, capacités, OpenClaw, compétences, agents de départ ───
    if (p === '/api/v6/etat' && req.method === 'GET') {
      const ram = Math.round(os.totalmem() / 1024 ** 3);
      return json(res, {
        ram, plateforme: process.platform, termine: v6.termine(),
        capacites: v6.CAPACITES.map(c => ({ id: c.id, nom: c.nom, quoi: c.quoi })), choisies: v6.capacitesChoisies(),
        openclaw: await v6.detecterOpenClaw(), competences: v6.competences().map(c => ({ id: c.id, nom: c.nom, description: c.description, source: c.source })),
        agentsDepart: v6.AGENTS_DEPART.map(a => ({ id: a.id, nom: a.nom, role: a.role, modeleConseille: a.modeleConseille || null })),
        agents: atelier.agents().map(a => a.nom),
        psy: { seances: noyauPerso.carnetPsy().length }
      });
    }
    if (p === '/api/v6/capacites' && req.method === 'POST') return json(res, { choisies: v6.definirCapacites((await jbody(req)).capacites || {}) });
    if (p === '/api/openclaw' && req.method === 'GET') return json(res, await pontOC.etat());
    if (p === '/api/openclaw/importer' && req.method === 'POST') { if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403); const b = await jbody(req); return json(res, b.retirer ? pontOC.retirerTout() : pontOC.importerTout({ ids: Array.isArray(b.ids) ? b.ids.map(String) : null })); }
    if (p === '/api/openclaw/cli' && req.method === 'POST') { if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403); const b = await jbody(req); try { return json(res, { sortie: await pontOC.cli(b.args, { timeout: 60000 }) }); } catch (e) { return json(res, { erreur: e.message }, 400); } }
    if (p === '/api/v6/openclaw/importer' && req.method === 'POST') return json(res, v6.importerSkills((await jbody(req)).ids || []));
    if (p.startsWith('/api/v6/competences/') && req.method === 'DELETE') return json(res, { ok: v6.retirerCompetence(decodeURIComponent(p.split('/')[4])) });
    if (p === '/api/v6/agents-depart' && req.method === 'POST') return json(res, await v6.creerAgentsDepart((await jbody(req)).ids || []));
    if (p === '/api/v6/modes' && req.method === 'POST') {
      try { return json(res, { mode: noyauPerso.creerMode(await jbody(req)), ...noyauPerso.etatPersonnalite() }); }
      catch (e) { return json(res, { erreur: e.message }, 400); }
    }
    if (p.startsWith('/api/v6/modes/') && req.method === 'DELETE') return json(res, { ok: noyauPerso.supprimerMode(decodeURIComponent(p.split('/')[4])) });
    if (p === '/api/depannage' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const b = await jbody(req);
      try { return json(res, await depannage.diagnostiquer({ texte: b.texte, image: typeof b.image === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(b.image) && b.image.length < 12e6 ? b.image : null })); }
      catch (e) { return json(res, { erreur: e.message }, 400); }
    }
    if (p === '/api/depannage/regle' && req.method === 'POST') { const b = await jbody(req); return json(res, { regle: depannage.reglePour(b.texte) }); }
    if (p.startsWith('/api/studio')) {
      if (req.method === 'GET' && p === '/api/studio/etat') return json(res, studio.etat());
      if (req.method === 'POST') {
        if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
        const b = await jbody(req);
        try {
          if (p === '/api/studio/plan') return json(res, await studio.planifier(b));
          if (p === '/api/studio/importer') return json(res, studio.importer(b));
          if (p === '/api/studio/image') return json(res, await studio.imageScene(b, (x) => noyauOutils.OUTILS.image_creer.run(x)));
          if (p === '/api/studio/musique') {
            try { const r = await noyauOutils.OUTILS.musique_creer.run({ description: String(b.description || 'ambient'), duree: +b.duree || 30 }); const f = r?.donnees?.fichier;
              if (f && fs.existsSync(f)) { const n = path.basename(f); if (path.dirname(path.resolve(f)) !== path.resolve(MEDIA_DIR)) fs.copyFileSync(f, path.join(MEDIA_DIR, n)); return json(res, { fichier: n, url: '/media/' + n, secours: false }); } throw new Error('aucun fichier'); }
            catch (e) { return json(res, { ...(await studio.musiqueSecours(+b.duree || 30)), raison: String(e.message || e).slice(0, 160) }); }
          }
          if (p === '/api/studio/exporter') return json(res, await studio.exporter(b));
          if (p === '/api/studio/audio') return json(res, await studio.editerAudio(b));
        } catch (e) { return json(res, { erreur: e.message }, 400); }
      }
    }
    if (p === '/api/ext' && req.method === 'GET') return json(res, extensions.etat());
    if (p === '/api/ext/activer' && req.method === 'POST') { if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403); const b = await jbody(req); try { return json(res, extensions.basculer(String(b.id || ''), Boolean(b.actif))); } catch (e) { return json(res, { erreur: e.message }, 400); } }
    if (p === '/api/credit' && req.method === 'GET') return json(res, credit.etat());
    if (p === '/api/credit/battement' && req.method === 'POST') { if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403); return json(res, credit.battement((await jbody(req)).sec)); }
    if (p === '/api/credit/acheter' && req.method === 'POST') { if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403); return json(res, credit.acheter((await jbody(req)).heures)); }
    if (p === '/api/credit/paiement' && req.method === 'POST') { if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403); try { return json(res, credit.configurerPaiement(await jbody(req))); } catch (e) { return json(res, { erreur: e.message }, 400); } }
    if (p === '/api/psy' && req.method === 'GET') return json(res, noyauPerso.PSYS.map(x => { const c = noyauPerso.carnetPsy(x.id); return { id: x.id, nom: x.nom, genre: x.genre, specialite: x.specialite, quoi: x.quoi, avatar: x.avatar, accueil: x.accueil, voixServeur: x.voixServeur, echanges: c.length, derniere: c.length ? c[c.length - 1].quand : null }; }));
    if (p === '/api/psy/carnet' && req.method === 'GET') { const id = new URL(req.url, 'http://x').searchParams.get('id') || ''; return json(res, { echanges: noyauPerso.carnetPsy(id).slice(-60) }); }
    if (p === '/api/psy/effacer' && req.method === 'POST') { if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403); return json(res, { ok: noyauPerso.effacerCarnetPsy(String((await jbody(req)).id || '')) }); }
    if (p === '/api/v6/psy' && req.method === 'GET') return json(res, { seances: noyauPerso.carnetPsy().slice(-40) });
    if (p === '/api/v6/psy/effacer' && req.method === 'POST') return json(res, { ok: noyauPerso.effacerCarnetPsy() });
    if (p === '/api/v6/termine' && req.method === 'POST') { v6.marquerTermine(); installation.terminer(); return json(res, { ok: true }); }

    // ─── CERVEAU PAS À PAS (V5) ───────────────────────────────────────────
    if (p === '/api/v5/cerveau' && req.method === 'GET') {
      const rec = await recommandation().catch(() => null);
      const oll = await ollamaLocal.etat().catch(() => ({ installe: false, actif: false, modeles: [] }));
      const groq = (() => { try { const c = credential(providerById('groq')); return Boolean(c) && c !== 'libre'; } catch { return false; } })();
      const ram = Math.round(os.totalmem() / 1024 ** 3);
      const qwens = MODELES_LOCAUX.filter(m => /^qwen/.test(m.nom) && !m.amorce && (parseFloat(String(m.ram).replace(',', '.')) || 99) <= ram + 0.5);
      const bilan = noyauDemarrage.dernierBilan();
      return json(res, {
        ram, plateforme: process.platform,
        ollama: { installe: oll.installe, actif: oll.actif, installeur: ollamaLocal.lienInstallateur() },
        modeles: (oll.modeles || []).map(m => m.nom),
        recommande: rec?.principal?.nom || 'qwen2.5:1.5b',
        qwens: qwens.map(m => ({ nom: m.nom, label: m.label, taille: m.taille, usage: m.usage })),
        groq, choisi: bilan?.besoins?.conversation?.choisi || null
      });
    }
    if (p === '/api/v5/cerveau/reevaluer' && req.method === 'POST') {
      const b = await noyauDemarrage.evaluer({ mesurer: true });
      return json(res, { pret: b.pret, choisi: b.besoins?.conversation?.choisi || null, resume: b.resume });
    }
    if (p === '/api/v5/cerveau/essai' && req.method === 'POST') {
      // Une vraie phrase, une vraie réponse : la seule preuve qui compte.
      const t0 = Date.now();
      try {
        const ch = noyauDemarrage.chaine('conversation');
        if (!ch.length) return json(res, { ok: false, message: 'Aucun moteur disponible pour l’instant.' });
        const r = await chatWithFallback(ch, { messages: [{ role: 'user', content: 'Réponds par une courte phrase en français : dis bonjour et dis que tu fonctionnes.' }], maxTokens: 80, temperature: 0.3 });
        const txt = String(r.text || r.content || r.message || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        return json(res, { ok: Boolean(txt), texte: txt.slice(0, 300), ms: Date.now() - t0, moteur: r.provider || ch[0].provider });
      } catch (e) { return json(res, { ok: false, message: String(e.message || e).slice(0, 400) }); }
    }
    if (p === '/api/v5/reparer' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const faits = [];
      try { extChrome.preparer(PORT); faits.push('Extension Chrome remise en place.'); } catch (e) { faits.push('Extension Chrome : ' + e.message); }
      try { flush(); faits.push('Données enregistrées.'); } catch (e) { faits.push('Données : ' + e.message); }
      try { fs.mkdirSync(path.join(DATA_DIR, 'projets'), { recursive: true }); faits.push('Dossier des projets vérifié.'); } catch (e) { faits.push('Projets : ' + e.message); }
      return json(res, { faits, sante: await santeV5() });
    }
    if (p === '/api/v5/journal' && req.method === 'GET') {
      let t = ''; try { t = fs.readFileSync(path.join(DATA_DIR, 'clipia.log'), 'utf8').split('\n').slice(-120).join('\n'); } catch {}
      return json(res, { journal: t });
    }

    // ─── INSTALLATION GUIDÉE (V4) ─────────────────────────────────────────
    if (p === '/api/v4/etat' && req.method === 'GET') return json(res, await installation.etat());
    if (p === '/api/v4/ignorer' && req.method === 'POST') { const b = await jbody(req); return json(res, { ignores: installation.ignorer(String(b.id), b.oui !== false) }); }
    if (p === '/api/v4/terminer' && req.method === 'POST') return json(res, { ok: installation.terminer() });
    if (p === '/api/v4/claude-code' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const env_ = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n');
      try { await installation.installerClaudeCode(m => env_({ message: m })); env_({ fini: true }); } catch (e) { env_({ erreur: e.message }); }
      return res.end();
    }
    if (p === '/api/logitheque' && req.method === 'GET') return json(res, { categories: logitheque.CATEGORIES, plateforme: process.platform, liste: logitheque.liste() });
    if (p === '/api/logitheque/installer' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const b = await jbody(req);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const env_ = (o) => { try { res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch {} };
      try { await logitheque.installer(String(b.id || ''), (l) => env_({ ligne: l })); env_({ fini: true }); } catch (e) { env_({ erreur: e.message, aide: depannage.reglePour(e.message) }); }
      return res.end();
    }
    if (p === '/api/v4/ffmpeg' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const env_ = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n');
      try { await installation.installerFfmpeg(env_); _ffmpeg = null; env_({ fini: true }); } catch (e) { env_({ erreur: e.message }); }
      return res.end();
    }
    if (p === '/api/v4/ouvrir-dossier' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const d = extChrome.preparer(PORT);
      try {
        const [c, a] = process.platform === 'win32' ? ['explorer', [d]] : process.platform === 'darwin' ? ['open', [d]] : ['xdg-open', [d]];
        spawn(c, a, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
      } catch {}
      return json(res, { dossier: d });
    }

    // ─── EXTENSION CHROME : pont (jeton secret) ───────────────────────────
    if (p === '/api/ext/attendre' && req.method === 'GET') {
      if (!extChrome.jetonValide(req.headers['x-clipia-ext'])) return json(res, { erreur: 'Jeton refusé.' }, 401);
      return extChrome.attendre(c => json(res, c));
    }
    if (p === '/api/ext/resultat' && req.method === 'POST') {
      if (!extChrome.jetonValide(req.headers['x-clipia-ext'])) return json(res, { erreur: 'Jeton refusé.' }, 401);
      return json(res, { ok: extChrome.resultat(await jbody(req)) });
    }
    if (p === '/api/ext/etat' && req.method === 'GET') return json(res, { connectee: extChrome.connectee(), session: extChrome.sessionActive(), dossier: extChrome.DOSSIER });
    if (p === '/api/ext/ouvrir-dossier' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const d = extChrome.preparer(PORT);
      try { spawn(process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open', [d], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref(); } catch {}
      return json(res, { ok: true, dossier: d });
    }
    if (p === '/api/ext/preparer' && req.method === 'POST') return json(res, { dossier: extChrome.preparer(PORT) });
    if (p === '/api/ext/stop' && req.method === 'POST') return json(res, { ok: true, etait: extChrome.arreter() });

    // ─── CONTRÔLE DE L'ORDINATEUR : arrêt d'urgence et état ───────────────
    if (p === '/api/ordi' && req.method === 'GET') return json(res, { actif: ordinateur.sessionActive(), secondes: ordinateur.sessionRestante() });
    if (p === '/api/ordi/stop' && req.method === 'POST') return json(res, { ok: true, etait: ordinateur.arreter() });

    // ─── CERVEAU AUTONOME : comprendre, planifier, agir, vérifier ─────────
    if (p === '/api/autonome' && req.method === 'GET') return json(res, { workflows: autonome.workflows(), runs: autonome.runs(20) });
    if (p === '/api/autonome' && req.method === 'POST') {
      const b = await jbody(req);
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
      const ctl = new AbortController(); res.on('close', () => ctl.abort());
      try {
        const r = await autonome.lancer({ objectif: b.objectif, workflowId: b.workflowId, projet: b.projet || 'studio', accords: b.accords || null, signal: ctl.signal, onEvent: envoyer });
        envoyer({ type: 'termine', ...r });
      } catch (e) { envoyer({ type: 'erreur', message: e.message }); }
      return res.end();
    }
    if (p === '/api/autonome/workflows' && req.method === 'POST') { try { return json(res, autonome.enregistrerWorkflow(await jbody(req))); } catch (e) { return json(res, { erreur: e.message }, 400); } }
    if (p.startsWith('/api/autonome/workflows/') && req.method === 'DELETE') return json(res, { ok: autonome.supprimerWorkflow(p.split('/')[4]) });
    if (p.startsWith('/api/autonome/annuler/') && req.method === 'POST') return json(res, { ok: autonome.annuler(p.split('/')[4]) });

    // ─── AGENT DÉVELOPPEUR ────────────────────────────────────────────────
    if (p === '/api/agent' && req.method === 'POST') {
      const b = await jbody(req);
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
      try {
        const r = await lancerAgent(b, envoyer);
        envoyer({ type: 'termine', ...r });
      } catch (e) { envoyer({ type: 'erreur', message: e.message }); }
      return res.end();
    }
    if (p === '/api/projets' && req.method === 'GET') return json(res, listerProjets());
    if (p.startsWith('/api/projets/') && p.endsWith('/arbre')) {
      return json(res, arborescence(decodeURIComponent(p.split('/')[3])));
    }
    if (p.startsWith('/api/projets/') && req.method === 'GET') {
      const [, , , nom, ...reste] = p.split('/');
      const rel = reste.join('/');
      const f = path.join(PROJETS_DIR, decodeURIComponent(nom), decodeURIComponent(rel));
      if (!path.resolve(f).startsWith(path.resolve(PROJETS_DIR) + path.sep)) { res.writeHead(403); return res.end('interdit'); }
      if (new URL(req.url, 'http://x').searchParams.get('dl') === '1') res.setHeader('content-disposition', `attachment; filename="${path.basename(f).replace(/[^\w.\- ]/g, '_')}"`);
      return serveStatic(res, f, req);
    }
    if (p === '/api/skills' && req.method === 'GET') return json(res, listerSkills());
    if (p === '/api/skills' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, { id: ecrireSkill(b.id || b.titre, b.contenu) });
    }
    if (p.startsWith('/api/skills/') && req.method === 'GET') {
      return json(res, { contenu: lireSkill(decodeURIComponent(p.split('/')[3])) });
    }
    if (p.startsWith('/api/skills/') && req.method === 'DELETE') {
      return json(res, { ok: supprimerSkill(decodeURIComponent(p.split('/')[3])) });
    }






    // ─── RACCOURCI DE BUREAU ──────────────────────────────────────────────
    if (p === '/api/raccourci' && req.method === 'GET') return json(res, etatRaccourci());
    if (p === '/api/raccourci' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, creerRaccourci(b));
    }

    // ─── CONFIGURATION AUTOMATIQUE ────────────────────────────────────────
    if (p === '/api/auto' && req.method === 'GET') return json(res, etatAuto());
    if (p === '/api/auto/recommandation' && req.method === 'GET') return json(res, await recommandation());
    if (p === '/api/auto/refuser' && req.method === 'POST') return json(res, refuser());
    if (p === '/api/auto/preparer' && req.method === 'POST') {
      const b = await jbody(req);
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
      try { await preparer(b, envoyer); }
      catch (e) { envoyer({ erreur: e.message }); }
      return res.end();
    }

    if (p === '/api/openrouter/catalogue' && req.method === 'GET') {
      try { return json(res, await orCatalogue()); }
      catch (e) { return json(res, { erreur: 'Catalogue OpenRouter injoignable : ' + e.message, modeles: [] }, 502); }
    }

    // ─── OLLAMA : démarrage et installation sans terminal ─────────────────
    if (p === '/api/ollama' && req.method === 'GET') return json(res, await ollamaLocal.etat());
    if (p === '/api/ollama/demarrer' && req.method === 'POST') return json(res, await ollamaLocal.demarrer());
    if (p === '/api/ollama/arreter' && req.method === 'POST') return json(res, ollamaLocal.arreter());
    if (p === '/api/ollama/installer' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
      try { const r = await ollamaLocal.installer(envoyer); envoyer({ fini: true, ...r }); }
      catch (e) { envoyer({ erreur: e.message }); }
      return res.end();
    }

    // ─── MODÈLES LOCAUX, INSTALLATION EN UN CLIC ──────────────────────────
    if (p === '/api/modeles-locaux' && req.method === 'GET') {
      return json(res, { catalogue: MODELES_LOCAUX, ollama: await ollamaPresent() });
    }
    if (p === '/api/centre-ia' && req.method === 'GET') return json(res, await centreIA(Math.round(os.totalmem() / 1024 ** 3)));
    if (p === '/api/modeles-locaux/installer' && req.method === 'POST') {
      const b = await jbody(req);
      if (!NOMS_INSTALLABLES.has(b.modele)) return json(res, { erreur: 'Modèle hors catalogue.' }, 400);
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
      try {
        await installerModele(b.modele, envoyer);
        envoyer({ fini: true, modele: b.modele });
      } catch (e) { envoyer({ erreur: e.message }); }
      return res.end();
    }
    if (p.startsWith('/api/modeles-locaux/') && req.method === 'DELETE') {
      return json(res, await supprimerModele(decodeURIComponent(p.split('/')[3])));
    }

    // ─── CERVEAU DU SYSTÈME (Clipia OS) ────────────────────────────────────
    if (p === '/api/systeme' && req.method === 'GET') {
      const etat = store.setting('systeme:dernier') || await systemeIA.observer();
      return json(res, { etat, recommandations: systemeIA.analyser(etat), decisions: store.setting('systeme:decisions') || {} });
    }
    if (p === '/api/systeme/observer' && req.method === 'POST') {
      const etat = await systemeIA.observer(); return json(res, { etat, recommandations: systemeIA.analyser(etat) });
    }
    if (p === '/api/systeme/decider' && req.method === 'POST') {
      const b = await jbody(req);
      try { return json(res, systemeIA.decider(String(b.id), String(b.choix))); } catch (e) { return json(res, { erreur: e.message }, 400); }
    }
    if (p === '/api/systeme/conseil' && req.method === 'POST') {
      const ch = noyauDemarrage.chaine('conversation');
      return json(res, await systemeIA.conseiller({ appeler: ch.length ? (_, o) => chatWithFallback(ch, o) : null }));
    }
    if (p === '/api/systeme/appliquer' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Refusé : l'accord doit venir d'un clic dans l'interface." }, 403);
      const b = await jbody(req);
      const reco = systemeIA.analyser().find(x => x.id === String(b.id));
      if (!reco?.commande) return json(res, { erreur: 'Aucune commande automatique pour cette recommandation : suis les instructions.' }, 400);
      const jeton = noyauMachine.accorder(reco.commande);
      const r = await noyauMachine.OUTILS_MACHINE.machine_executer.run({ commande: reco.commande, accord: jeton }, {});
      if (r.preuve?.code === 0) systemeIA.decider(reco.id, 'fait');
      archiveMem.archiver({ genre: 'machine', titre: 'Amélioration appliquée : ' + reco.titre, texte: String(r.resume || ''), ok: r.preuve?.code === 0, meta: { outil: 'systeme.appliquer' } });
      return json(res, { commande: reco.commande, resume: r.resume, code: r.preuve?.code ?? null });
    }

    // ─── MÉMOIRE TOTALE (journal permanent) ────────────────────────────────
    if (p === '/api/archive' && req.method === 'GET') {
      const q = url.searchParams;
      return json(res, { stats: archiveMem.stats(), entrees: archiveMem.rechercher(q.get('q') || '', { genre: q.get('genre') || null, limite: Math.min(200, Number(q.get('limite')) || 40) }) });
    }
    if (p === '/api/archive/bilan' && req.method === 'GET') return json(res, archiveMem.bilan({ jours: Number(url.searchParams.get('jours')) || 1 }));
    if (p === '/api/archive/reprise' && req.method === 'GET') return json(res, archiveMem.reprise());
    if (p === '/api/archive/exporter' && req.method === 'GET') return json(res, archiveMem.exporter());
    if (p === '/api/archive/reflechir' && req.method === 'POST') return json(res, archiveMem.reflechir());
    if (p === '/api/archive/pause' && req.method === 'POST') { const b = await jbody(req); return json(res, archiveMem.pause(b.pause)); }
    if (p === '/api/archive/note' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, archiveMem.archiver({ genre: 'note', titre: String(b.titre || 'Note'), texte: String(b.texte || ''), source: 'personne' }) || { erreur: 'Vide ou archivage en pause.' });
    }
    if (p.startsWith('/api/archive/') && req.method === 'DELETE') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Suppression refusée : elle doit venir de l'interface." }, 403);
      const id = decodeURIComponent(p.split('/')[3]);
      return json(res, { supprimes: id === 'tout' ? archiveMem.toutEffacer() : archiveMem.supprimer(id) });
    }

    // ─── MÉMOIRE ──────────────────────────────────────────────────────────
    if (p === '/api/memoire' && req.method === 'GET') return json(res, memoire.tout());
    if (p === '/api/memoire' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, memoire.ajouter(b.categorie, b.texte, b.source || 'manuel'));
    }
    if (p === '/api/memoire/apprendre' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await memoire.apprendre(b));
    }
    if (p.startsWith('/api/memoire/') && req.method === 'DELETE') {
      const cible = decodeURIComponent(p.split('/')[3]);
      return json(res, ['faits','projets','preferences'].includes(cible)
        ? memoire.vider(cible) : memoire.retirer(cible));
    }

    // ─── AGENT AUTONOME ───────────────────────────────────────────────────
    if (p === '/api/autonome' && req.method === 'POST') {
      const b = await jbody(req);
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
      try {
        const r = await piloter({ ...b, etatStudio: await resumeStudio() }, executerTache, envoyer);
        envoyer({ type: 'termine', ...r });
      } catch (e) { envoyer({ type: 'erreur', message: e.message }); }
      return res.end();
    }
    if (p === '/api/capacites') return json(res, CAPACITES);



    // ─── SCIENCES : calcul réel ───────────────────────────────────────────
    if (p === '/api/sciences/calculer' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, calculer(b.expression, b.variables || {}));
    }
    if (p === '/api/sciences/convertir' && req.method === 'POST') {
      const b = await jbody(req);
      const r = convertir(Number(b.valeur), b.de, b.vers);
      return json(res, { ...r, lisible: formater(r.valeur) });
    }
    if (p === '/api/sciences/constantes') return json(res, { constantes: CONSTANTES, unites: UNITES, aide: aideCalcul() });

    // ─── SCIENCES : son ───────────────────────────────────────────────────
    if (p === '/api/sciences/audio/analyser' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await audio.analyser(b.chemin));
    }
    if (p === '/api/sciences/audio/generer' && req.method === 'POST') {
      const b = await jbody(req);
      if (b.type === 'binaural')  return json(res, await audio.binaural(b));
      if (b.type === 'isochrone') return json(res, await audio.isochrone(b));
      if (b.type === 'bruit')     return json(res, await audio.bruit(b));
      throw new Error('Type inconnu : binaural, isochrone ou bruit.');
    }
    if (p === '/api/sciences/audio/bandes') return json(res, { bandes: audio.BANDES, preuves: audio.PREUVES });

    // ─── SCIENCES : quantique et radio ────────────────────────────────────
    if (p === '/api/sciences/quantique' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, quantique.circuit(b));
    }
    if (p === '/api/sciences/radio' && req.method === 'POST') {
      return json(res, quantique.radio(await jbody(req)));
    }
    if (p === '/api/sciences/pilotage' && req.method === 'POST') {
      return json(res, quantique.pilotageMicroonde(await jbody(req)));
    }
    if (p === '/api/sciences/exemples') return json(res, { quantique: quantique.EXEMPLES, aide: quantique.aideQuantique() });

    // ─── CERVEAU : charte, mémoire associative, rôles, cycle proactif ─────
    if (p === '/api/cerveau') return json(res, {
      charte: charte.charteComplete(),
      graphe: cgraphe.etat(),
      journal: cjournal.resume(),
      typesPreuve: TYPES_PREUVE,
      typesNoeud: cgraphe.TYPES_NOEUD, typesLien: cgraphe.TYPES_LIEN,
      sequence: croles.SEQUENCE,
      propositions: ccycle.listerPropositions()
    });

    if (p === '/api/cerveau/detecter') return json(res, ccycle.detecter());

    if (p === '/api/cerveau/apprentissage') return json(res, capprendre.etatApprentissage());
    if (p === '/api/cerveau/entretenir' && req.method === 'POST') return json(res, capprendre.entretenir());
    if (p === '/api/cerveau/amorcer' && req.method === 'POST') {
      const b = await jbody(req);
      // Les leçons déjà enregistrées par l’agent entrent dans le graphe :
      // l’expérience existe, autant qu’elle serve.
      let anciennes = [];
      try { anciennes = lecons().map(l => ({ lecon: l.lecon, contexte: l.contexte })); } catch { /* aucune */ }
      return json(res, capprendre.amorcer({ lecons: anciennes, faits: b.faits || [] }));
    }

    if (p === '/api/cerveau/cycle' && req.method === 'POST') {
      const b = await jbody(req);
      if (b.flux) {
        res.writeHead(200, { 'content-type':'text/event-stream', 'cache-control':'no-cache', connection:'keep-alive' });
        const envoie = (t, d) => res.write(`event: ${t}\ndata: ${JSON.stringify(d)}\n\n`);
        try {
          const r = await ccycle.cycle({ ...b, capacites: CAPACITES,
            surAvancement: (e) => envoie('avancement', e) });
          envoie('fini', r);
        } catch (e) { envoie('erreur', { erreur: e.message }); }
        return res.end();
      }
      return json(res, await ccycle.cycle({ ...b, capacites: CAPACITES }));
    }

    if (p === '/api/cerveau/conseil' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await croles.conseil({ ...b, capacites: CAPACITES }));
    }
    if (p === '/api/cerveau/role' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await croles.consulter({ ...b, capacites: CAPACITES }));
    }
    if (p === '/api/cerveau/modele') return json(res, (await croles.modeleDisponible()) || { aucun: true,
      quoi: 'Aucun modèle ne répond. Les rôles et le cycle ne peuvent pas travailler, et rien ne sera inventé à la place.' });

    // Mémoire associative
    if (p === '/api/cerveau/graphe') return json(res, cgraphe.etat());
    if (p === '/api/cerveau/graphe/brut') return json(res, cgraphe.brut());
    if (p === '/api/cerveau/graphe/noeud' && req.method === 'POST') {
      return json(res, cgraphe.ajouter(await jbody(req)));
    }
    if (p === '/api/cerveau/graphe/lien' && req.method === 'POST') {
      return json(res, cgraphe.relier(await jbody(req)));
    }
    if (p === '/api/cerveau/graphe/propager' && req.method === 'POST') {
      return json(res, cgraphe.propager(await jbody(req)));
    }
    if (p === '/api/cerveau/graphe/decouvrir') return json(res, cgraphe.decouvrir({
      minimum: Number(url.searchParams.get('minimum')) || 0.04,
      limite: Number(url.searchParams.get('limite')) || 12 }));
    if (p === '/api/cerveau/graphe/voisinage') return json(res, cgraphe.voisinage(
      url.searchParams.get('id'), Number(url.searchParams.get('profondeur')) || 1));
    if (p === '/api/cerveau/graphe/tisser' && req.method === 'POST') {
      return json(res, cgraphe.tisserLexical(await jbody(req)));
    }
    if (p === '/api/cerveau/graphe/consolider' && req.method === 'POST') {
      return json(res, cgraphe.consolider(await jbody(req)));
    }
    if (p === '/api/cerveau/graphe/oublier' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, cgraphe.oublier(b.id));
    }

    // Journal structuré
    if (p === '/api/cerveau/journal') return json(res, cjournal.tout());
    if (p === '/api/cerveau/journal/verifier' && req.method === 'POST') return json(res, cjournal.verifier());
    if (p === '/api/cerveau/journal/objectif' && req.method === 'POST') {
      return json(res, cjournal.objectif(await jbody(req)));
    }
    if (p === '/api/cerveau/journal/test' && req.method === 'POST') {
      const b = await jbody(req);
      // Une preuve de fichier est construite ici, en lisant le disque :
      // le client ne peut pas la fabriquer.
      const preuves = [];
      for (const f of b.fichiers || []) { try { preuves.push(preuveFichier(f)); } catch { /* absent */ } }
      if (b.mesure) preuves.push(preuveMesure(b.mesure));
      if (b.commande) preuves.push(preuveCommande(b.commande));
      return json(res, cjournal.test({ ...b, preuves }));
    }
    if (p === '/api/cerveau/journal/erreur' && req.method === 'POST') {
      return json(res, cjournal.erreur(await jbody(req)));
    }
    if (p === '/api/cerveau/journal/projet' && req.method === 'POST') {
      return json(res, cjournal.projet(await jbody(req)));
    }
    if (p === '/api/cerveau/journal/etat-projet' && req.method === 'POST') {
      return json(res, cjournal.changerEtatProjet(await jbody(req)));
    }
    if (p === '/api/cerveau/journal/retirer' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, cjournal.retirer(b.id));
    }

    // Auto-modification : proposée, versionnée, réversible, jamais automatique
    if (p === '/api/cerveau/propositions') return json(res, ccycle.listerPropositions());
    if (p === '/api/cerveau/proposition' && req.method === 'GET') {
      return json(res, ccycle.voirProposition(url.searchParams.get('id')));
    }
    if (p === '/api/cerveau/proposition' && req.method === 'POST') {
      return json(res, ccycle.proposerModification(await jbody(req)));
    }
    if (p === '/api/cerveau/proposition/appliquer' && req.method === 'POST') {
      return json(res, ccycle.appliquerProposition(await jbody(req)));
    }
    if (p === '/api/cerveau/proposition/annuler' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, ccycle.annulerProposition(b.id));
    }

    // ─── VOIX : du plus naturel au plus disponible ────────────────────────
    if (p === '/api/voix') return json(res, voix.etatVoix());
    if (p === '/api/voix/parler' && req.method === 'POST') {
      return json(res, await voix.parler(await jbody(req)));
    }

    // ─── CONVERSATIONS DURABLES (arborescence de gauche) ──────────────────
    if (p === '/api/recherche' && req.method === 'GET') {
      const q = String(new URL(req.url, 'http://x').searchParams.get('q') || '').trim().toLowerCase().slice(0, 80);
      if (q.length < 2) return json(res, { conversations: [], competences: [], apps: [] });
      const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const nq = norm(q);
      const extrait = (t) => { const i = norm(t).indexOf(nq); if (i < 0) return ''; const d = Math.max(0, i - 40); return (d ? '…' : '') + String(t).slice(d, i + nq.length + 80).replace(/\s+/g, ' ') + '…'; };
      const conv = [];
      for (const c of conversations.liste()) {
        const full = conversations.lire(c.id); let hit = norm(c.titre).includes(nq) ? { m: c.titre } : null;
        if (!hit) for (const m of (full?.messages || [])) if (norm(m.content).includes(nq)) { hit = { m: extrait(m.content) }; break; }
        if (hit) conv.push({ id: c.id, titre: c.titre, extrait: hit.m, quand: c.updatedAt });
        if (conv.length >= 12) break;
      }
      const comp = v6.competences().filter(c => norm(c.nom + ' ' + (c.description || '') + ' ' + (c.texte || '')).includes(nq)).slice(0, 8).map(c => ({ id: c.id, nom: c.nom, description: c.description || '' }));
      const apps = forgeApp.apps().filter(a => norm(a.nom + ' ' + a.description).includes(nq)).slice(0, 6).map(a => ({ slug: a.slug, nom: a.nom, statut: a.statut }));
      return json(res, { conversations: conv, competences: comp, apps });
    }
    if (p === '/api/conversations' && req.method === 'GET') return json(res, conversations.liste());
    if (p === '/api/conversations' && req.method === 'POST') { const c = conversations.enregistrer(await jbody(req)); return json(res, { id: c.id, titre: c.titre }); }
    if (p.startsWith('/api/conversations/')) {
      const [, , , id, sous] = p.split('/');
      if (!sous && req.method === 'GET') { const c = conversations.lire(id); return c ? json(res, c) : json(res, { erreur: 'Conversation introuvable.' }, 404); }
      if (!sous && req.method === 'DELETE') return json(res, { ok: conversations.supprimer(id) });
      if (sous === 'renommer' && req.method === 'POST') return json(res, conversations.renommer(id, (await jbody(req)).titre));
      if (sous === 'epingler' && req.method === 'POST') return json(res, conversations.epingler(id, (await jbody(req)).epingle));
      if (sous === 'guide' && req.method === 'POST') return json(res, conversations.enregistrerGuide(id, await jbody(req)));
    }

    // ─── NOYAU : une seule Clipia pour le chat, la voix et l'agent ────────
    if (p === '/api/noyau/personnalite' && req.method === 'GET') return json(res, noyauPerso.etatPersonnalite());
    if (p === '/api/noyau/personnalite' && req.method === 'POST') {
      noyauPerso.definirProfil(await jbody(req));
      return json(res, noyauPerso.etatPersonnalite());
    }
    if (p === '/api/noyau/personnalite/reset' && req.method === 'POST') {
      noyauPerso.reinitialiserProfil();
      return json(res, noyauPerso.etatPersonnalite());
    }
    if (p === '/api/noyau/etat') {
      return json(res, {
        bilan: noyauDemarrage.dernierBilan(),
        machine: noyauMachine.etatMachine(),
        navigateur: await noyauNavigateur.etatNavigateur().catch(e => ({ erreur: e.message })),
        outils: noyauOutils.disponibles({ bilan: noyauDemarrage.dernierBilan() }).map(o => ({ nom: o.nom, groupe: o.groupe })),
        indisponibles: noyauOutils.indisponibles({ bilan: noyauDemarrage.dernierBilan() })
      });
    }
    if (p === '/api/noyau/evaluer' && req.method === 'POST') {
      return json(res, await noyauDemarrage.bilanFrais({ force: true }));
    }
    // ─── X7 : téléphone + MCP ───
    if (p === '/mcp' && req.method === 'POST') {
      const m = await jbody(req);
      const outils = {
        converser: async (t) => { let fin = ''; const r = await noyauBoucle.converser({ message: t, historique: [], vocal: false }, () => {}); fin = r.texte || ''; if (r.attente) fin += '\n\n[Action en attente : autorise-la sur l\'ordinateur.]'; return fin; },
        etat: async () => ({ version: '8.4.0', ordinateur: noyauMachine.etatMachine(), openclaw: (await pontOC.etat()).resume }),
        competences: () => v6.listeCompetencesCourte()
      };
      const lot = Array.isArray(m) ? m : [m]; const sorties = [];
      for (const x of lot) { const rr = await distant.mcp(x, outils); if (rr) sorties.push(rr); }
      if (!sorties.length) { res.writeHead(202); return res.end(); }
      return json(res, Array.isArray(m) ? sorties : sorties[0]);
    }
    if (p === '/mcp') { res.writeHead(405, { allow: 'POST' }); return res.end(); }
    if (p === '/api/telephone/demander' && req.method === 'POST') {
      const b = await jbody(req);
      try {
        const r = await noyauBoucle.converser({ message: String(b.message || '').slice(0, 4000), historique: Array.isArray(b.historique) ? b.historique.slice(-8) : [], vocal: false }, () => {});
        return json(res, { texte: r.texte || '', attente: r.attente || null });
      } catch (e) { return json(res, { erreur: e.message }, 500); }
    }
    if (p === '/api/acces-distant' && req.method === 'GET') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      return json(res, { actif: distant.actif(), port: PORT, adresses: distant.adresses(PORT), reseauLocal: RESEAU, jeton: distant.actif() ? distant.jeton() : null });
    }
    if (p === '/api/acces-distant' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const b = await jbody(req);
      if (b.regenerer) distant.regenerer();
      if (b.actif !== undefined) { distant.activer(b.actif); if (b.actif) ecouteTelephone(); }
      return json(res, { actif: distant.actif(), port: PORT, adresses: distant.adresses(PORT), jeton: distant.actif() ? distant.jeton() : null });
    }
    if (p === '/api/acces-distant/qr' && req.method === 'GET') {
      const u = url.searchParams.get('u') || ''; if (!/^https?:\/\//.test(u) || u.length > 400) return json(res, { erreur: 'Adresse invalide.' }, 400);
      res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end(distant.qrSvg(u));
    }
    // ─── X8 : communauté & mises à jour ───────────────────────────────────────
    if (p === '/api/communaute' && req.method === 'GET') return json(res, { version: communaute.versionInstallee(), liens: communaute.liens() });
    if (p === '/api/maj' && req.method === 'GET') return json(res, await communaute.verifierMaj({ force: url.searchParams.get('force') === '1' }));
    if (p === '/api/communaute/idee' && req.method === 'POST') { const b = await jbody(req); return json(res, { url: communaute.adresseIdee({ titre: String(b.titre || ''), texte: String(b.texte || ''), type: b.type === 'bug' ? 'bug' : 'idee' }) }); }
    // ─── X8 : LES DEUX CERVEAUX — travaux en arrière-plan, toujours joignables ───
    if (p.startsWith('/api/travaux')) {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface de Clipia." }, 403);
      if (p === '/api/travaux' && req.method === 'GET') return json(res, { travaux: travaux.liste(), max: travaux.MAX_PARALLELE });
      if (p === '/api/travaux/point' && req.method === 'GET') return json(res, { texte: travaux.pointVocal(), actifs: travaux.actifsListe().length });
      if (p === '/api/travaux/flux' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
        const ecrire = d => { try { res.write(`data: ${JSON.stringify(d)}\n\n`); } catch {} };
        ecrire({ type: 'etat', travaux: travaux.liste() });
        const off = travaux.abonner(ecrire); const bat = setInterval(() => { try { res.write(': ♥\n\n'); } catch {} }, 15000);
        req.on('close', () => { off(); clearInterval(bat); }); return;
      }
      if (p === '/api/travaux/lancer' && req.method === 'POST') {
        const b = await jbody(req);
        try { return json(res, { travail: travaux.lancer({ mission: String(b.mission || ''), titre: String(b.titre || ''), mode: b.rigoureux ? 'rigoureux' : 'simple' }) }); }
        catch (e) { return json(res, { erreur: e.message }, 400); }
      }
      if (p === '/api/travaux/arreter-tout' && req.method === 'POST') return json(res, { arretes: travaux.arreterTout() });
      const m = p.match(/^\/api\/travaux\/([\w-]+)\/(arreter|reprendre|relancer|detail)$/);
      if (m) {
        const id = m[1];
        try {
          if (m[2] === 'arreter' && req.method === 'POST') return json(res, { ok: travaux.arreter(id) });
          if (m[2] === 'detail' && req.method === 'GET') return json(res, { travail: travaux.trouver(id), texte: travaux.detailVocal(id) });
          if (m[2] === 'relancer' && req.method === 'POST') return json(res, { travail: travaux.relancer(id) });
          if (m[2] === 'reprendre' && req.method === 'POST') { const b = await jbody(req); return json(res, { travail: await travaux.reprendre(id, b.accord) }); }
        } catch (e) { return json(res, { erreur: e.message }, 400); }
      }
      return json(res, { erreur: 'Route inconnue.' }, 404);
    }
    if (p === '/api/noyau/converser' && req.method === 'POST') {
      const b = await jbody(req);
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => { try { res.write(`data: ${JSON.stringify(d)}\n\n`); } catch {} };
      if (String(b.mode || '').startsWith('psy-') && credit.etat().bloque) { envoyer({ type: 'erreur', code: 'credit', message: 'Tes 2 heures offertes au cabinet sont terminées. Recharge des heures (5 € l\'heure) pour continuer avec ton psychologue — le reste de Clipia reste libre.' }); return res.end(); }
      try {
        const r = await noyauBoucle.converser({
          message: String(b.message || ''), historique: Array.isArray(b.historique) ? b.historique : [],
          vocal: Boolean(b.vocal), mode: b.mode || undefined, projet: b.projet, reprise: b.reprise || null, blanc: b.blanc === undefined ? undefined : Boolean(b.blanc),
          chaineModeles: b.provider ? [{ provider: b.provider, model: b.model || undefined }] : undefined
        }, envoyer);
        envoyer({ type: 'termine', texte: r.texte, attente: r.attente || null, preuves: r.preuves, modele: r.modele || null });
      } catch (e) { envoyer({ type: 'erreur', message: e.message, aide: depannage.reglePour(e.message) }); }
      return res.end();
    }
    // Un accord ne se donne que par un clic dans l'interface : l'en-tête
    // personnalisé interdit à une page tierce de le déclencher à distance.
    if (p === '/api/noyau/accord' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Accord refusé : il doit venir de l'interface." }, 403);
      const b = await jbody(req);
      const jeton = b.categorie === 'navigateur'
        ? noyauNavigateur.accorderNavigateur(String(b.commande || ''))
        : noyauMachine.accorder(String(b.commande || ''));
      return json(res, { accord: jeton });
    }
    // Arrêt propre depuis le raccourci « Quitter Clipia » (même garde que les accords : en-tête personnalisé)
    if (p === '/api/systeme/quitter' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: 'Refusé.' }, 403);
      json(res, { ok: true }); setTimeout(() => { flush(); process.exit(0); }, 200); return;
    }
    if (p === '/api/noyau/machine' && req.method === 'GET') {
      return json(res, { ...noyauMachine.etatMachine(), journal: noyauMachine.journal({ limite: 60 }) });
    }
    if (p === '/api/noyau/machine/zone' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const b = await jbody(req);
      if (b.retirer) noyauMachine.retirerZone(String(b.chemin)); else noyauMachine.ajouterZone(String(b.chemin));
      return json(res, noyauMachine.etatMachine());
    }
    if (p === '/api/noyau/machine/lecture-seule' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      noyauMachine.definirLectureSeule((await jbody(req)).actif);
      return json(res, noyauMachine.etatMachine());
    }

    // ─── ATELIER : projets durables, agents et sous-agents ────────────────
    if (p === '/api/atelier' && req.method === 'GET') {
      return json(res, { projets: atelier.projets(), agents: atelier.agents(), groupes: atelier.GROUPES,
        limites: { profondeur: atelier.MAX_PROFONDEUR, delegations: atelier.MAX_DELEGATIONS, simultanes: atelier.MAX_ACTIFS },
        ...atelier.etatActifs(), executions: atelier.executions({ limite: 25 }) });
    }
    if (p === '/api/atelier/projets' && req.method === 'POST') return json(res, atelier.creerProjetDurable(await jbody(req)));
    {
      const m = p.match(/^\/api\/atelier\/projets\/([\w-]+)(?:\/(taches|notes)(?:\/([\w-]+))?)?$/);
      if (m) {
        const [, id, sous, sid] = m;
        if (!sous && req.method === 'GET') {
          const pr = atelier.projet(id); if (!pr) return json(res, { erreur: 'Projet introuvable.' }, 404);
          return json(res, { projet: pr, executions: atelier.executions({ projetId: id, limite: 40 }) });
        }
        if (!sous && req.method === 'POST') return json(res, atelier.modifierProjet(id, await jbody(req)));
        if (!sous && req.method === 'DELETE') return json(res, { ok: atelier.retirerProjet(id), note: 'Les fichiers du projet sont conservés.' });
        if (sous === 'taches' && !sid && req.method === 'POST') return json(res, atelier.ajouterTache(id, await jbody(req)));
        if (sous === 'taches' && sid && req.method === 'POST') return json(res, atelier.majTache(id, sid, await jbody(req)));
        if (sous === 'notes' && req.method === 'POST') return json(res, atelier.ajouterNote(id, (await jbody(req)).texte));
      }
    }
    if (p === '/api/atelier/agents' && req.method === 'POST') return json(res, atelier.creerAgent(await jbody(req)));
    if (p.startsWith('/api/atelier/agents/') && req.method === 'POST') return json(res, atelier.modifierAgent(p.split('/')[4], await jbody(req)));
    if (p.startsWith('/api/atelier/agents/') && req.method === 'DELETE') return json(res, { ok: atelier.supprimerAgent(p.split('/')[4]) });
    if (p === '/api/atelier/annuler' && req.method === 'POST') return json(res, { ok: atelier.annuler((await jbody(req)).execId) });
    if ((p === '/api/atelier/lancer' || p === '/api/atelier/reprendre') && req.method === 'POST') {
      const b = await jbody(req);
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const envoyer = d => { try { res.write(`data: ${JSON.stringify(d)}\n\n`); } catch {} };
      const ctl = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
      try {
        const r = p.endsWith('/lancer')
          ? await atelier.lancer({ agentId: b.agentId, projetId: b.projetId || null, tache: b.tache, onEvent: envoyer, signal: ctl.signal,
              chaineModeles: b.provider ? [{ provider: b.provider, model: b.model || undefined }] : undefined })
          : await atelier.reprendre({ execId: b.execId, accord: b.accord || null, onEvent: envoyer, signal: ctl.signal });
        envoyer({ type: 'termine', execId: r.execId, statut: r.statut, texte: r.texte, attente: r.attente, preuves: r.preuves });
      } catch (e) { envoyer({ type: 'erreur', message: e.message }); }
      return res.end();
    }

    // ─── CLIP SANS MODÈLE : la fonction d’origine, sans rien installer ────
    if (p === '/api/clip-local') return json(res, {
      ...clipLocal.exigences(), formats: clipLocal.FORMATS,
      ambiances: Object.fromEntries(Object.entries(clipLocal.AMBIANCES)
        .map(([k, a]) => [k, { nom: a.nom, quoi: a.quoi }]))
    });
    if (p === '/api/clip-local/creer' && req.method === 'POST') {
      return json(res, await clipLocal.clipLocal(await jbody(req)));
    }

    // ─── UTILITAIRES : tout en local, tout gratuit ────────────────────────
    if (p === '/api/utilitaires') return json(res, {
      catalogue: util.CATALOGUE, formatsAudio: util.FORMATS_AUDIO, formatsVideo: util.FORMATS_VIDEO,
      cibles: util.CIBLES_SONORES, outils: util.outilsSysteme(),
      langues: langue.LANGUES, registres: langue.REGISTRES, youtube: util.SUR_YOUTUBE
    });
    if (p === '/api/utilitaires/sonder' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, util.sonder(b.chemin));
    }
    if (p === '/api/utilitaires/executer' && req.method === 'POST') {
      const b = await jbody(req);
      const o = String(b.outil || '');
      const T = {
        'convertir-audio': () => util.convertirAudio(b),
        'extraire-audio':  () => util.extraireAudio(b),
        'convertir-video': () => util.convertirVideo(b),
        'normaliser':      () => util.normaliser(b),
        'couper-silences': () => util.couperSilences(b),
        'vitesse':         () => util.vitesse(b),
        'decouper':        () => util.decouper(b),
        'assembler':       () => util.assembler(b),
        'etiqueter':       () => util.etiqueter(b),
        'forme-onde':      () => util.formeOnde(b),
        'spectrogramme':   () => util.spectrogramme(b),
        'vignette':        () => util.vignette(b),
        'texte-pdf':       () => util.texteDuPdf(b),
        'pdf-images':      () => util.pdfVersImages(b),
        'ocr':             () => util.ocr(b),
        'traduire':        () => langue.traduire(b),
        'transcrire':      () => langue.transcrire(b)
      };
      if (!T[o]) throw new Error(`Outil inconnu : ${o}. Disponibles : ${Object.keys(T).join(', ')}.`);
      return json(res, await T[o]());
    }

    // ─── GRATUIT : tester réellement chaque voie sans frais ───────────────
    if (p === '/api/gratuit/tester-tout' && req.method === 'POST') {
      return json(res, await essaiGratuit.testerTout(await jbody(req)));
    }
    if (p === '/api/gratuit/tester' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await essaiGratuit.tester(b.id));
    }

    // ─── NEURO : programmes sonores anti-stress et attention ──────────────
    if (p === '/api/neuro/programmes') return json(res, {
      programmes: neuro.PROGRAMMES, savoir: neuro.SAVOIR,
      acces: { ouvert: true, prix: 0,
        pourquoi: 'Tout est gratuit et sans limite. Aucun programme n’est réservé, aucune fonction n’attend un paiement.' }
    });
    if (p === '/api/neuro/generer' && req.method === 'POST') {
      return json(res, await neuro.programme(await jbody(req)));
    }

    // ─── LIAISON : parler sans internet (son, radio, satellite, 4G) ───────
    if (p === '/api/liaison/voies') return json(res, {
      voies: liaison.VOIES, legalite: liaison.LEGALITE, materiel: liaison.materiel()
    });
    if (p === '/api/liaison/moduler' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, b.mode === 'dtmf' ? liaison.modulerDTMF(b.texte) : liaison.moduler(b.texte));
    }
    if (p === '/api/liaison/demoduler' && req.method === 'POST') {
      const b = await jbody(req);
      if (b.mode === 'dtmf') return json(res, liaison.demodulerDTMF(b.chemin));
      try { return json(res, { mode: 'fsk', ...liaison.demoduler(b.chemin) }); }
      catch (e1) {
        // Un son inconnu peut être du DTMF : on tente l’autre modulation avant d’abandonner.
        try { return json(res, { mode: 'dtmf', ...liaison.demodulerDTMF(b.chemin) }); }
        catch (e2) { throw new Error(`Ni FSK ni DTMF. FSK : ${e1.message} DTMF : ${e2.message}`); }
      }
    }

    // ─── PONT : son à trois couches, machine + humain + corps ─────────────
    if (p === '/api/pont/composer' && req.method === 'POST') {
      return json(res, await pont.composer(await jbody(req)));
    }
    if (p === '/api/pont/lire' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, pont.lire(b.chemin));
    }
    if (p === '/api/pont/langage') return json(res, {
      natures: pont.NATURES, urgences: pont.URGENCES, chaine: pont.CHAINE, honnete: pont.HONNETE
    });
    if (p === '/api/pont/entrainement') return json(res, pont.entrainement({ niveau: Number(url.searchParams.get('niveau')) || 1 }));

    // ─── PENSÉE : interface cerveau-machine ───────────────────────────────
    if (p === '/api/pensee/etat') return json(res, {
      flux: pensee.fluxEtat(), casques: pensee.CASQUES, cibles: pensee.CIBLES_SSVEP,
      boucle: pensee.BOUCLE, verite: pensee.VERITE, securite: pensee.SECURITE
    });
    if (p === '/api/pensee/ecouter' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, pensee.ecouter({ port: Number(b.port) || 5005 }));
    }
    if (p === '/api/pensee/arreter' && req.method === 'POST') return json(res, pensee.arreter());
    if (p === '/api/pensee/simuler' && req.method === 'POST') {
      const b = await jbody(req);
      const ech = pensee.simuler(b);
      const base = { profil: b.profil || 'detente', secondes: b.secondes || 4, simule: true };
      if (b.ssvepHz != null) return json(res, { ...base, ssvep: pensee.ssvep(ech) });
      return json(res, { ...base, ...pensee.etat(ech) });
    }

    // ─── DÉCODEUR : un modèle entraîné sur son propre cerveau ─────────────
    if (p === '/api/decodeur/session' && req.method === 'POST') {
      return json(res, decodeur.nouvelleSession(await jbody(req)));
    }
    if (p === '/api/decodeur/session') {
      const nom = url.searchParams.get('nom') || 'fabrice';
      try {
        const s = decodeur.lireSession(nom);
        const parIntention = {};
        for (const i of s.intentions) parIntention[i] = s.essais.filter(e => e.intention === i).length;
        return json(res, { nom: s.nom, intentions: s.intentions, essais: s.essais.length,
                           parIntention, evaluation: s.evaluation, entraine: s.entraine || null });
      } catch { return json(res, { aucune: true, nom }); }
    }
    if (p === '/api/decodeur/essai' && req.method === 'POST') {
      return json(res, decodeur.ajouterEssai(await jbody(req)));
    }
    if (p === '/api/decodeur/entrainer' && req.method === 'POST') {
      return json(res, decodeur.entrainer(await jbody(req)));
    }
    if (p === '/api/decodeur/decoder' && req.method === 'POST') {
      return json(res, decodeur.decoder(await jbody(req)));
    }
    if (p === '/api/decodeur/demonstration' && req.method === 'POST') {
      return json(res, decodeur.demonstration(await jbody(req)));
    }
    if (p === '/api/decodeur/arbre') return json(res, {
      ...decodeur.arbre({ signaux: Number(url.searchParams.get('signaux')) || 2 }),
      limites: decodeur.CE_QUE_JE_PEUX
    });

    // ─── RAISONNEMENT ─────────────────────────────────────────────────────
    if (p === '/api/raisonner/plan' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await planifier({ ...b, capacites: CAPACITES, etatStudio: await resumeStudio() }));
    }
    if (p === '/api/raisonner/ameliorer' && req.method === 'POST') {
      return json(res, await ameliorer(await jbody(req)));
    }
    if (p === '/api/raisonner/critiquer' && req.method === 'POST') {
      return json(res, await critiquer(await jbody(req)));
    }
    if (p === '/api/raisonner/diagnostiquer' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, await diagnostiquer({ ...b, etatStudio: await resumeStudio() }));
    }
    if (p === '/api/lecons' && req.method === 'GET') return json(res, lecons());
    if (p.startsWith('/api/lecons/') && req.method === 'DELETE') {
      return json(res, oublierLecon(decodeURIComponent(p.split('/')[3])));
    }

    // ─── X8 : TÂCHES PLANIFIÉES ───
    if (p === '/api/initiatives' && req.method === 'GET') return json(res, { initiatives: initiative.proposer() });
    if (p.startsWith('/api/os/') && await osClipia.gerer(req, res, p, { json, jbody })) return;
    if (p === '/api/vscode/ouvrir' && req.method === 'POST') {
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      const b = await jbody(req); const dossier = b.dossier ? path.resolve(String(b.dossier)) : PROJETS_DIR;
      if (!fs.existsSync(dossier) || !fs.statSync(dossier).isDirectory()) return json(res, { erreur: "Ce dossier n'existe pas." }, 400);
      const cmd = process.platform === 'win32' ? 'code.cmd' : 'code';
      const t = spawnSync(process.platform === 'win32' ? 'where' : 'which', [process.platform === 'win32' ? 'code' : 'code'], { encoding: 'utf8' });
      if (t.status !== 0) return json(res, { erreur: "Visual Studio Code n'est pas installé. Installe-le depuis la Logithèque (« Visual Studio Code »).", manquant: true }, 404);
      try { spawn(cmd, [dossier], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' }).unref(); return json(res, { ok: true, dossier }); }
      catch (e) { return json(res, { erreur: e.message }, 500); }
    }
    if (p.startsWith('/api/sauvegarde')) {
      const garde = () => { if (req.headers['x-clipia-accord'] !== '1') { json(res, { erreur: "Réservé à l'interface." }, 403); return false; } return true; };
      if (p === '/api/sauvegarde' && req.method === 'GET') return json(res, sauvegarde.etat());
      if (/^\/api\/sauvegarde\/telecharger\/[\w.-]+$/.test(p) && req.method === 'GET') {
        let f; try { f = sauvegarde.cheminLocal(p.split('/').pop()); } catch { return json(res, { erreur: 'Nom invalide.' }, 400); }
        if (!fs.existsSync(f)) return json(res, { erreur: 'Introuvable.' }, 404);
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': fs.statSync(f).size, 'content-disposition': 'attachment; filename="' + path.basename(f) + '"' });
        return fs.createReadStream(f).pipe(res);
      }
      if (!garde()) return;
      try {
        if (p === '/api/sauvegarde/creer' && req.method === 'POST') {
          const b = await jbody(req); const mdp = String(b.motdepasse || '');
          if (mdp && mdp.length < 6) return json(res, { erreur: 'Mot de passe : 6 caractères au minimum.' }, 400);
          const dest = b.destination || 'local';
          const dossier = dest === 'dossier' || dest === 'usb' ? String(b.dossier || '') : sauvegarde.DOSSIER_LOCAL;
          if (dest !== 'local' && dest !== 'dropbox' && (!dossier || !path.isAbsolute(dossier) || !fs.existsSync(dossier))) return json(res, { erreur: "Ce dossier n'existe pas ou n'est pas branché." }, 400);
          const r = await sauvegarde.creer({ dossier: dest === 'dropbox' ? sauvegarde.DOSSIER_LOCAL : dossier, motdepasse: mdp });
          let dropbox = null; if (dest === 'dropbox') dropbox = await sauvegarde.dropboxEnvoyer(r.fichier);
          return json(res, { ...r, fichier: undefined, destination: dest, dossier: path.dirname(r.fichier), dropbox });
        }
        if (p === '/api/sauvegarde/liste' && req.method === 'POST') {
          const b = await jbody(req);
          if (b.destination === 'dropbox') return json(res, { sauvegardes: await sauvegarde.dropboxListe() });
          const dossier = b.destination === 'local' || !b.dossier ? sauvegarde.DOSSIER_LOCAL : String(b.dossier);
          return json(res, { sauvegardes: sauvegarde.liste(dossier) });
        }
        if (p === '/api/sauvegarde/restaurer' && req.method === 'POST') {
          const b = await jbody(req); let f;
          if (b.destination === 'dropbox') f = await sauvegarde.dropboxRecuperer(String(b.nom || ''));
          else { const nom = String(b.nom || ''); if (!/^[\w.-]+$/.test(nom) || !nom.endsWith(sauvegarde.EXT)) return json(res, { erreur: 'Nom invalide.' }, 400); const dossier = b.destination === 'local' || !b.dossier ? sauvegarde.DOSSIER_LOCAL : String(b.dossier); f = path.join(dossier, nom); if (!fs.existsSync(f)) return json(res, { erreur: 'Fichier introuvable.' }, 404); }
          try { return json(res, { ...(await sauvegarde.preparerRestauration(f, String(b.motdepasse || ''))), enAttente: true }); }
          catch (e) { return json(res, { erreur: e.message, motdepasse: Boolean(e.mdp) }, e.mdp ? 401 : 400); }
        }
        if (p === '/api/sauvegarde/importer' && req.method === 'POST') {          // fichier envoyé depuis le navigateur
          fs.mkdirSync(sauvegarde.DOSSIER_LOCAL, { recursive: true });
          const nom = 'importee-' + Date.now() + sauvegarde.EXT, f = path.join(sauvegarde.DOSSIER_LOCAL, nom);
          const sortie = fs.createWriteStream(f); let n = 0, trop = false;
          for await (const c of req) { n += c.length; if (n > 4 * 1024 ** 3) { trop = true; break; } if (!sortie.write(c)) await new Promise(r => sortie.once('drain', r)); }
          sortie.end(); await new Promise(r => sortie.once('close', r));
          if (trop) { fs.rmSync(f, { force: true }); return json(res, { erreur: 'Fichier trop gros (4 Go max).' }, 413); }
          try { return json(res, { ...(await sauvegarde.preparerRestauration(f, decodeURIComponent(String(req.headers['x-mot-de-passe'] || '')))), enAttente: true, nom }); }
          catch (e) { return json(res, { erreur: e.message, motdepasse: Boolean(e.mdp), nom }, e.mdp ? 401 : 400); }
        }
        if (p === '/api/sauvegarde/annuler' && req.method === 'POST') { sauvegarde.annulerRestauration(); return json(res, { ok: true }); }
        if (p === '/api/sauvegarde/auto' && req.method === 'POST') { const b = await jbody(req); store.setting('sauvegarde:auto', b.actif ? { actif: true, dossier: b.dossier || null, motdepasse: Boolean(b.motdepasse) } : null); return json(res, { ok: true }); }
        if (p === '/api/sauvegarde/redemarrer' && req.method === 'POST') { json(res, { ok: true }); setTimeout(() => { flush(); process.exit(0); }, 600); return; }
      } catch (e) { return json(res, { erreur: e.message }, 400); }
    }
    if (p.startsWith('/api/planning')) {
      if (p === '/api/planning' && req.method === 'GET') return json(res, { taches: planning.liste(), max: planning.MAX_ACTIVES, minMinutes: planning.MIN_MINUTES });
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      try {
        if (p === '/api/planning' && req.method === 'POST') return json(res, planning.ajouter(await jbody(req)));
        const m = /^\/api\/planning\/([\w-]+)(?:\/(activer))?$/.exec(p);
        if (m && req.method === 'DELETE' && !m[2]) return json(res, { ok: planning.retirer(m[1]) });
        if (m && m[2] === 'activer' && req.method === 'POST') return json(res, planning.activer(m[1], (await jbody(req)).actif));
      } catch (e) { return json(res, { erreur: String(e.message).slice(0, 300) }, 400); }
    }

    // ─── X8 : OUTILS MCP (ajout / retrait réservés à l'interface) ───
    if (p.startsWith('/api/mcp')) {
      if (p === '/api/mcp' && req.method === 'GET') return json(res, { serveurs: mcp.liste(), presets: mcp.PRESETS });
      if (req.headers['x-clipia-accord'] !== '1') return json(res, { erreur: "Réservé à l'interface." }, 403);
      try {
        if (p === '/api/mcp' && req.method === 'POST') return json(res, mcp.ajouter(await jbody(req)));
        const m = /^\/api\/mcp\/([\w-]+)(?:\/(outils|confiance|arreter))?$/.exec(p);
        if (m && req.method === 'DELETE' && !m[2]) return json(res, { ok: mcp.retirer(m[1]) });
        if (m && m[2] === 'outils' && req.method === 'POST') return json(res, { outils: await mcp.outilsDe(m[1]) });
        if (m && m[2] === 'confiance' && req.method === 'POST') return json(res, mcp.reglerConfiance(m[1], (await jbody(req)).confiance));
        if (m && m[2] === 'arreter' && req.method === 'POST') { mcp.arreterSession(m[1]); return json(res, { ok: true }); }
      } catch (e) { return json(res, { erreur: String(e.message).slice(0, 300) }, 400); }
    }

    // ─── MESSAGERIE ENTRANTE ──────────────────────────────────────────────
    if (p === '/api/messagerie' && req.method === 'GET') return json(res, etatMessagerie());
    if (p === '/api/messagerie/demarrer' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, demarrerMessagerie(texte => repondreMessage(texte, b)));
    }
    if (p === '/api/messagerie/arreter' && req.method === 'POST') return json(res, arreterMessagerie());
    if (p === '/api/messagerie/autoriser' && req.method === 'POST') {
      const b = await jbody(req);
      return json(res, { autorises: autoriser(b.id) });
    }
    if (p.startsWith('/api/messagerie/autorises/') && req.method === 'DELETE') {
      return json(res, { autorises: retirerAutorisation(decodeURIComponent(p.split('/')[4])) });
    }
    if (p === '/api/webhooks/whatsapp') {
      if (req.method === 'GET') {        // vérification initiale de Meta
        if (verifierAbonnementMeta(url.searchParams)) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(url.searchParams.get('hub.challenge') || ''); }
        res.writeHead(403); return res.end('jeton invalide');
      }
      const r = webhookWhatsApp(await body(req, 1_000_000), req.headers, texte => repondreMessage(texte, {}));
      return json(res, r.corps, r.code);
    }
    if (p === '/api/webhooks/slack' && req.method === 'POST') {
      const r = webhookSlack(await body(req, 1_000_000), req.headers, texte => repondreMessage(texte, {}));
      return json(res, r.corps, r.code);
    }

    // ─── MÉDIATHÈQUE ──────────────────────────────────────────────────────
    if (p === '/api/medias') return json(res, store.all('assets').slice(-200).reverse());
    if (p === '/api/formats') return json(res, RATIOS);

    // ─── ABONNEMENT ───────────────────────────────────────────────────────
    if (p === '/api/abonnement') return json(res, { plans: PLANS, actuel: currentPlan(),
      quotas: ['clips','images','minutesVideo','tokens'].map(r => ({ ressource: r, ...checkQuota(r, 0) })) });
    if (p === '/api/abonnement/checkout' && req.method === 'POST') {
      return json(res, await createCheckout(await jbody(req)));
    }
    if (p === '/api/abonnement/portail' && req.method === 'POST') {
      const sub = store.setting('subscription');
      if (!sub?.customerId) throw new Error('Aucun abonnement actif.');
      return json(res, await customerPortal({ customerId: sub.customerId }));
    }
    if (p === '/api/webhooks/stripe' && req.method === 'POST') {
      const raw = (await body(req)).toString('utf8');
      const evt = verifyWebhook(raw, req.headers['stripe-signature'] || '');
      applyEvent(evt);
      return json(res, { recu: true });
    }

    // ─── WORKFLOWS ────────────────────────────────────────────────────────
    if (p === '/api/workflows' && req.method === 'GET') return json(res, store.all('workflows'));
    if (p === '/api/workflows' && req.method === 'POST') return json(res, store.insert('workflows', await jbody(req)));
    if (p.startsWith('/api/workflows/') && req.method === 'DELETE') return json(res, { ok: store.remove('workflows', p.split('/')[3]) });

    // ─── JOURNAL ──────────────────────────────────────────────────────────
    if (p === '/api/evenements') return json(res, store.all('events').slice(-120).reverse());

    // ─── FICHIERS ─────────────────────────────────────────────────────────
    if (p.startsWith('/media/'))   return serveStatic(res, path.join(MEDIA_DIR, path.basename(p)), req);
    if (p.startsWith('/uploads/')) return serveStatic(res, path.join(UPLOADS, path.basename(p)), req);

    // ─── INTERFACE ────────────────────────────────────────────────────────
    const file = p === '/' ? path.join(WEB, 'index.html') : path.join(WEB, p.replace(/^\/+/, ''));
    if (!file.startsWith(WEB)) { res.writeHead(403); return res.end('interdit'); }
    if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) return serveStatic(res, file, req);
    return serveStatic(res, path.join(WEB, 'index.html'), req);

  } catch (e) {
    if (!res.headersSent) fail(res, e); else res.end();
  }
});

// Au démarrage : on réveille Ollama s'il dort. Rien n'est téléchargé sans accord.
auDemarrage();

/**
 * Le cerveau se branche sur la file : chaque tâche qui passe l’alimente.
 * C’est ce qui fait la différence entre un système qui PEUT apprendre et un
 * système qui apprend — personne n’a à y penser.
 */
try {
  const b = capprendre.brancher();
  if (b.branche) console.log('   Cerveau       apprentissage branché sur la file de travaux');
} catch (e) { console.log('   Cerveau       branchement impossible :', e.message); }

async function santeV5() {
  const t = [];
  const ajout = (id, nom, ok, detail) => t.push({ id, nom, ok: Boolean(ok), detail: detail || '' });
  ajout('serveur', 'Serveur Clipia', true, `port ${PORT}, Node ${process.version}`);
  let donneesOk = false; try { fs.mkdirSync(DATA_DIR, { recursive: true }); const f = path.join(DATA_DIR, '.test-ecriture'); fs.writeFileSync(f, 'ok'); fs.unlinkSync(f); donneesOk = true; } catch {}
  ajout('donnees', 'Dossier de données (écriture)', donneesOk, DATA_DIR);
  ajout('base', 'Base de données (conversations, agents, workflows)', (() => { try { store.all('conversations'); store.all('atelier_agents'); store.all('workflows'); return true; } catch { return false; } })());
  const o = etatOutils();
  ajout('ffmpeg', 'Vidéo (ffmpeg)', o.present, o.present ? o.ffmpeg : 'ffmpeg introuvable (la vidéo et le son en ont besoin)');
  const ol = await ollamaPresent().catch(() => ({ ok: false }));
  ajout('ollama', 'Modèles locaux (Ollama)', ol.ok, ol.ok ? (ol.modeles || []).length + ' modèle(s)' : 'Ollama absent ou arrêté (facultatif)');
  const gratuits = PROVIDERS.filter(x => x.sansCle).length;
  ajout('gratuits', 'Moteurs gratuits sans clé', gratuits > 0, gratuits + ' disponible(s)');
  ajout('extension', 'Extension Chrome', extChrome.connectee(), extChrome.connectee() ? 'connectée' : 'non installée (facultatif)');
  return { ok: t.filter(x => !['ffmpeg', 'ollama', 'extension'].includes(x.id)).every(x => x.ok), controles: t, version: '8.4.0' };
}

// X7 — si l'accès téléphone est activé, on écoute aussi sur le réseau local (le garde ci-dessus limite ce qui est atteignable)
const serveursTel = new Map();
function ecouteTelephone() {
  if (RESEAU) return;
  for (const { url: u } of distant.adresses(PORT)) {
    const ip = new URL(u).hostname; if (serveursTel.has(ip)) continue;
    const sv = http.createServer((rq, rs) => server.emit('request', rq, rs));
    sv.on('error', e => { console.error('accès téléphone ' + ip + ' :', e.message); serveursTel.delete(ip); });
    sv.listen(PORT, ip); serveursTel.set(ip, sv);
  }
}
if (distant.actif()) setTimeout(ecouteTelephone, 400);
server.listen(PORT, HOST, () => {
  try { travaux.reprisePostDemarrage(); planning.demarrer();
sauvegarde.demarrer(); } catch {}
  try { extChrome.preparer(PORT); } catch (e) { console.error('extension Chrome :', e.message); }
  const url = `http://${HOST}:${PORT}`;
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   CLIPIA · Studio créatif IA                     ║
  ╚══════════════════════════════════════════════════╝

   Interface    ${url}
${RESEAU ? `   MODE TÉLÉPHONE  code d'accès : ${CODE_ACCES}  (ouvre http://<IP-de-ce-PC>:${PORT} sur le téléphone)\n` : ''}   Redirection OAuth à déclarer : ${redirectUri()}
   Données      ${DATA_DIR}
   Fournisseurs ${PROVIDERS.length}  ·  Connecteurs ${CONNECTORS.length}

   Ctrl+C pour arrêter.
`);
  setTimeout(() => { try { archiveMem.reflechir(); } catch {} }, 20000); setInterval(() => { try { archiveMem.reflechir(); } catch {} }, 6 * 3600e3).unref?.();
  systemeIA.demarrerVeille();
  noyauDemarrage.amorcer();
  try { const n = atelier.marquerInterrompus(); if (n) console.log(`   Atelier       ${n} exécution(s) interrompue(s) par l'arrêt précédent — reprenables`); } catch {}
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });
process.on('unhandledRejection', e => console.error('[clipia] rejet non géré :', e?.message || e));
// Une erreur imprévue ne doit jamais éteindre le serveur : on la note et on continue.
process.on('uncaughtException', e => console.error('[clipia] erreur imprévue (le serveur continue) :', e?.stack || e));
server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error(`[clipia] Le port ${PORT} est déjà utilisé (Clipia est peut-être déjà ouvert).`); process.exit(3); }
  console.error('[clipia] erreur du serveur :', e.message);
});
