/**
 * CLIPIA — Passerelle IA unifiée.
 * Une seule fonction `chat()` qui parle à OpenAI, Anthropic, Gemini, Ollama
 * et tout serveur compatible OpenAI (dont LM Studio, llama.cpp, vLLM, Jan…).
 * Streaming SSE normalisé : on émet toujours { delta } puis { done }.
 */
import { byId, baseUrl } from './registry.js';
import { vault } from '../lib/vault.js';

export class GatewayError extends Error {
  constructor(msg, status = 502, provider = '') {
    // Une page d'erreur HTML (404, 502…) n'a rien à faire dans la conversation : on garde l'essentiel.
    super(String(msg).replace(/<!DOCTYPE[\s\S]*?<\/html>|<html[\s\S]*?<\/html>/gi, m => { const p = (m.match(/<pre>([\s\S]*?)<\/pre>/i) || m.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]; return p ? '« ' + p.trim().slice(0, 120) + ' »' : '(page d\'erreur)'; }));
    this.status = status; this.provider = provider;
  }
}

/** Certains fournisseurs partagent la clé d'un autre (même compte). */
const PARTAGE = { 'gemini-gratuit': 'gemini', 'groq-whisper': 'groq', 'openai-image': 'openai', 'openai-tts': 'openai', 'openai-whisper': 'openai' };

export function credential(p) {
  // Un moteur local à jeton (OpenClaw) : le jeton vient du coffre ou de l'environnement, jamais du code.
  if (p.jeton) return vault.resolve(`provider:${p.id}`, p.envKey) || 'local';
  if (p.tier === 'local-gratuit') return 'local';
  if (p.sansCle) return 'libre';          // ni compte ni clé : utilisable tout de suite
  const direct = vault.resolve(`provider:${p.id}`, p.envKey);
  if (direct) return direct;
  const frere = PARTAGE[p.id];
  return frere ? vault.resolve(`provider:${frere}`, p.envKey) : '';
}

function headers(p, key) {
  const h = { 'content-type': 'application/json' };
  switch (p.kind) {
    case 'anthropic':
      h['x-api-key'] = key; h['anthropic-version'] = '2023-06-01'; break;
    case 'gemini': break; // clé en query string
    case 'ollama': break;
    default:
      if (key && key !== 'local' && key !== 'libre') h['authorization'] = `Bearer ${key}`;
      if (p.id === 'openrouter') { h['http-referer'] = 'https://clipia.app'; h['x-title'] = 'Clipia'; }
  }
  return h;
}

/**
 * Normalise un message Clipia vers le format du fournisseur.
 * Un message peut porter des pièces jointes : { role, content, images: [dataURL] }
 */
function contenu(p, m) {
  if (!m.images?.length) return m.content;
  const parts = [];
  for (const img of m.images) {
    const [, type, b64] = /^data:([^;]+);base64,(.+)$/.exec(img) || [];
    if (!b64) continue;
    if (p.kind === 'anthropic')
      parts.push({ type: 'image', source: { type: 'base64', media_type: type, data: b64 } });
    else if (p.kind === 'gemini')
      parts.push({ inline_data: { mime_type: type, data: b64 } });
    else if (p.kind === 'ollama') continue; // traité à part : tableau "images"
    else parts.push({ type: 'image_url', image_url: { url: img } });
  }
  if (p.kind === 'ollama') return m.content;
  const texte = p.kind === 'gemini' ? { text: m.content } : { type: 'text', text: m.content };
  return [...parts, texte];
}

const imagesBrutes = m => (m.images || []).map(i => (i.split(',')[1] || '')).filter(Boolean);

/** Normalise les messages Clipia vers le format du fournisseur. */
/** Modèles qui refusent le paramètre `temperature` (appris à l'usage : erreur 400 « temperature is deprecated »). */
const SANS_TEMPERATURE = new Set();
const refuseTemperature = (p, model) => SANS_TEMPERATURE.has(p.id + '|' + model)
  || (p.kind === 'anthropic' && /opus-4-[1-9]|opus-[5-9]|sonnet-[5-9]|sonnet-4-[5-9]|fable|mythos|haiku-[5-9]/i.test(String(model)))
  || (p.kind === 'openai' && /^(o\d|gpt-5)/i.test(String(model)));
const erreurTemperature = (status, txt) => status === 400 && /temperature/i.test(txt) && /(deprecated|not supported|unsupported|does not support)/i.test(txt);

function buildBody(p, { model, messages, system, temperature = 0.8, maxTokens = 2048, stream = false }) {
  const url = baseUrl(p);
  if (refuseTemperature(p, model)) temperature = undefined;
  if (p.kind === 'anthropic') {
    return { url: `${url}/messages`, body: {
      model, max_tokens: maxTokens, ...(temperature !== undefined ? { temperature } : {}), stream,
      ...(system ? { system } : {}),
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: contenu(p, m) }))
    }};
  }
  if (p.kind === 'gemini') {
    const key = credential(p);
    const method = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
    return { url: `${url}/models/${model}:${method}key=${encodeURIComponent(key)}`, body: {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user',
        parts: m.images?.length ? contenu(p, m) : [{ text: m.content }] })),
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    }};
  }
  if (p.kind === 'ollama') {
    return { url: `${url}/api/chat`, body: {
      model, stream, options: { temperature, num_predict: maxTokens, num_ctx: Number(process.env.CLIPIA_NUM_CTX) || 8192, repeat_penalty: 1.1 },
      messages: [...(system ? [{ role: 'system', content: system }] : []),
        ...messages.map(m => m.images?.length
          ? { role: m.role, content: m.content, images: imagesBrutes(m) }
          : { role: m.role, content: m.content })]
    }};
  }
  // OpenAI-compatible (OpenAI, Mistral, DeepSeek, Groq, OpenRouter, LM Studio, vLLM…)
  return { url: `${url}/chat/completions`, body: {
    model, temperature, stream, max_tokens: maxTokens,
    messages: [...(system ? [{ role: 'system', content: system }] : []),
      ...messages.map(m => ({ role: m.role, content: contenu(p, m) }))]
  }};
}

function extractText(p, json) {
  try {
    if (p.kind === 'anthropic') return (json.content || []).map(c => c.text || '').join('');
    if (p.kind === 'gemini') return (json.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
    if (p.kind === 'ollama') return json.message?.content || '';
    return json.choices?.[0]?.message?.content || '';
  } catch { return ''; }
}

function extractDelta(p, json) {
  try {
    if (p.kind === 'anthropic') return json.delta?.text || '';
    if (p.kind === 'gemini') return (json.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
    if (p.kind === 'ollama') return json.message?.content || '';
    return json.choices?.[0]?.delta?.content || '';
  } catch { return ''; }
}

/** Appel non-streamé. Retourne { text, usage, provider, model, ms }. */
export async function chat(providerId, opts) {
  const p = byId(providerId);
  if (!p) throw new GatewayError(`Fournisseur inconnu : ${providerId}`, 404);
  const key = credential(p);
  if (!key) throw new GatewayError(`Clé manquante pour ${p.label}. Ajoutez-la dans Paramètres → Coffre.`, 428, p.id);
  let { url, body } = buildBody(p, { ...opts, stream: false });
  const t0 = Date.now();
  const appeler = () => fetch(url, { method: 'POST', headers: headers(p, key), body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout || 180000) });
  let res = await appeler();
  let txt = await res.text();
  if (!res.ok && erreurTemperature(res.status, txt)) {            // ce modèle refuse la température : on la retire et on réessaie
    SANS_TEMPERATURE.add(p.id + '|' + opts.model);
    ({ url, body } = buildBody(p, { ...opts, stream: false }));
    res = await appeler(); txt = await res.text();
  }
  if (!res.ok) throw new GatewayError(`${p.label} ${res.status} : ${txt.slice(0, 400)}`, res.status, p.id);
  let json; try { json = JSON.parse(txt); } catch { throw new GatewayError(`Réponse illisible de ${p.label}`, 502, p.id); }
  return {
    text: extractText(p, json), raw: json, provider: p.id, model: opts.model,
    ms: Date.now() - t0,
    usage: json.usage || json.usageMetadata || null
  };
}

/** Appel streamé. `onDelta(txt)` est appelé au fil de l'eau. */
export async function chatStream(providerId, opts, onDelta) {
  const p = byId(providerId);
  if (!p) throw new GatewayError(`Fournisseur inconnu : ${providerId}`, 404);
  const key = credential(p);
  if (!key) throw new GatewayError(`Clé manquante pour ${p.label}.`, 428, p.id);
  let { url, body } = buildBody(p, { ...opts, stream: true });
  const appeler = () => fetch(url, { method: 'POST', headers: headers(p, key), body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout || 300000) });
  let res = await appeler();
  if (!res.ok) {
    const t0 = await res.clone().text().catch(() => '');
    if (erreurTemperature(res.status, t0)) {
      SANS_TEMPERATURE.add(p.id + '|' + opts.model);
      ({ url, body } = buildBody(p, { ...opts, stream: true }));
      res = await appeler();
    }
  }
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    throw new GatewayError(`${p.label} ${res.status} : ${t.slice(0, 400)}`, res.status, p.id);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // Ollama émet du JSON-lines, les autres du SSE
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const s = line.trim();
      if (!s) continue;
      let payload = s;
      if (s.startsWith('data:')) payload = s.slice(5).trim();
      if (payload === '[DONE]') continue;
      if (!payload.startsWith('{')) continue;
      let j; try { j = JSON.parse(payload); } catch { continue; }
      const d = extractDelta(p, j);
      if (d) { full += d; onDelta(d); }
    }
  }
  return { text: full, provider: p.id, model: opts.model };
}

/** Teste la joignabilité d'un fournisseur sans consommer de tokens. */
/**
 * TOUS LES MODÈLES D'UN FOURNISSEUR NE SAVENT PAS CONVERSER.
 *
 * Groq, par exemple, sert aussi Whisper (transcription), des modèles de
 * synthèse vocale et des filtres de modération. Les proposer dans le menu
 * de conversation produit une erreur 400 incompréhensible pour l'utilisateur :
 * « The model whisper-large-v3-turbo does not support chat completions ».
 *
 * On ne les montre donc pas. Et on remonte en tête ceux qui tiennent vraiment
 * une conversation en français : un menu de quarante entrées où les trois
 * bonnes sont noyées ne vaut pas mieux qu'un mauvais menu.
 */
const PAS_CONVERSATION = /whisper|tts|audio|speech|embed|guard|moderation|rerank|vision-only|sdxl|flux|stable-|dall|playai|distil-whisper/i;

/** Ce qui parle bien français et répond vite, dans l'ordre où on veut le voir. */
const PREFERES = [
  /llama-3\.3-70b/i, /qwen3?.*(32|72)b/i, /gpt-oss-120b/i, /llama-3\.1-70b/i, /mixtral/i,
  /gpt-4o(?!-mini)/i, /gpt-4o-mini/i, /llama-3\.1-8b/i, /gemma2?-9b/i, /llama-3\.2/i
];

export function modelesConversation(liste = []) {
  const propres = liste.filter(m => m && !PAS_CONVERSATION.test(m));
  const rang = (m) => {
    const i = PREFERES.findIndex(re => re.test(m));
    return i < 0 ? PREFERES.length : i;
  };
  // À rang égal, le plus gros modèle d'abord : l'ordre alphabétique plaçait « qwen2.5:0.5b »
  // avant « qwen2.5:7b », et Clipia répondait avec un modèle minuscule alors qu'un bon était installé.
  return propres.sort((a, b) => rang(a) - rang(b) || poids(b) - poids(a) || a.localeCompare(b));
}

/** Taille pour le classement : les modèles « raisonneurs » (r1, qwq) mettent longtemps à répondre, ils passent après. */
const poids = (m) => taillePrevue(m) - (/deepseek-r1|qwq|reason/i.test(m) ? 100 : 0);

/** Taille annoncée par le nom du modèle, en milliards de paramètres (« 7b », « 0.5b », « 270m »). Inconnue : 3. */
export function taillePrevue(nom = '') {
  const m = /(?:^|[^a-z0-9.])(\d+(?:\.\d+)?)\s*([bm])(?![a-z])/i.exec(String(nom).replace(/[:_-]/g, ' '));
  if (!m) return 3;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === 'm' ? n / 1000 : n;
}

export async function ping(providerId) {
  const p = byId(providerId);
  if (!p) return { ok: false, error: 'inconnu' };
  const url = baseUrl(p);
  if (p.base === 'local') return { ok: null, note: 'binaire local — vérifié par le docteur' };
  try {
    if (p.kind === 'ollama') {
      const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(4000) });
      const j = await r.json();
      return { ok: r.ok, models: modelesConversation((j.models || []).map(m => m.name)) };
    }
    const key = credential(p);
    if (p.tier !== 'local-gratuit' && !key) return { ok: false, error: 'clé absente' };
    if (p.kind === 'gemini') {
      const r = await fetch(`${url}/models?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(6000) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, models: modelesConversation((j.models || []).map(m => m.name?.replace('models/', ''))).slice(0, 40) };
    }
    if (p.kind === 'anthropic') {
      const r = await fetch(`${url}/models`, { headers: headers(p, key), signal: AbortSignal.timeout(6000) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, models: modelesConversation((j.data || []).map(m => m.id)) };
    }
    const r = await fetch(`${url}/models`, { headers: headers(p, key), signal: AbortSignal.timeout(6000) });
    const j = await r.json().catch(() => ({}));
    if (p.jeton && !r.ok) {
      const raison = r.status === 401 || r.status === 403
        ? 'jeton refusé : renseigne OPENCLAW_GATEWAY_TOKEN (ou la clé « provider:openclaw » du coffre)'
        : r.status === 404
          ? 'API compatible OpenAI désactivée : gateway.http.endpoints.chatCompletions.enabled = true'
          : `HTTP ${r.status}`;
      return { ok: false, error: raison };
    }
    return { ok: r.ok, models: p.jeton ? (j.data || []).map(m => m.id) : modelesConversation((j.data || []).map(m => m.id)).slice(0, 40) };
  } catch (e) {
    return { ok: false, error: e.name === 'TimeoutError' ? 'injoignable' : String(e.message || e) };
  }
}

/** Bascule automatique : essaie les fournisseurs dans l'ordre jusqu'au premier qui répond. */
export async function chatWithFallback(chain, opts) {
  const errs = [];
  for (const step of chain) {
    try { return await chat(step.provider, { ...opts, model: step.model }); }
    catch (e) { errs.push(`${step.provider}: ${e.message}`); }
  }
  throw new GatewayError(`Tous les fournisseurs ont échoué.\n${errs.join('\n')}`, 502);
}
