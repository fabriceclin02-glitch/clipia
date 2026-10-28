/**
 * CLIPIA — Génération média : image, vidéo, voix, transcription, musique.
 * Même principe que la passerelle texte : une API, N fournisseurs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { byId, baseUrl } from './registry.js';
import { credential, GatewayError } from './gateway.js';
import { DATA_DIR } from '../lib/env.js';
import { store, uid } from '../lib/store.js';

export const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

function saveBinary(buf, ext, meta = {}) {
  const id = uid('ast');
  const file = path.join(MEDIA_DIR, `${id}.${ext}`);
  fs.writeFileSync(file, buf);
  return store.insert('assets', { id, file, ext, bytes: buf.length, url: `/media/${id}.${ext}`, ...meta });
}

// ── IMAGE ────────────────────────────────────────────────────────────────
export async function generateImage({ provider = 'openai-image', model, prompt, size = '1024x1024', n = 1, negative = '' }) {
  const p = byId(provider);
  if (!p) throw new GatewayError(`Fournisseur image inconnu : ${provider}`, 404);
  const key = credential(p);
  const url = baseUrl(p);

  if (provider === 'openai-image') {
    const r = await fetch(`${url}/images/generations`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || 'gpt-image-1', prompt, size, n })
    });
    const j = await r.json();
    if (!r.ok) throw new GatewayError(j.error?.message || 'échec image', r.status, provider);
    return j.data.map(d => d.b64_json
      ? saveBinary(Buffer.from(d.b64_json, 'base64'), 'png', { provider, prompt, kind: 'image' })
      : { url: d.url, provider, prompt, kind: 'image' });
  }

  if (provider === 'pollinations-image') {
    const [w, h] = String(size).split('x').map(Number);
    const u = `${url}/prompt/${encodeURIComponent(prompt)}` +
      `?width=${w || 1024}&height=${h || 1024}&model=${model || 'flux'}&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
    const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
    if (!r.ok) throw new GatewayError(`Pollinations a répondu ${r.status}. Le service est communautaire : réessayez dans un instant.`, r.status, provider);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1000) throw new GatewayError('Image vide renvoyée par Pollinations.', 502, provider);
    return [saveBinary(buf, 'jpg', { provider, prompt, kind: 'image' })];
  }

  if (provider === 'stability') {
    const fd = new FormData();
    fd.append('prompt', prompt); fd.append('output_format', 'png');
    if (negative) fd.append('negative_prompt', negative);
    const r = await fetch(`${url}/v2beta/stable-image/generate/${model || 'core'}`, {
      method: 'POST', headers: { authorization: `Bearer ${key}`, accept: 'image/*' }, body: fd
    });
    if (!r.ok) throw new GatewayError(await r.text(), r.status, provider);
    return [saveBinary(Buffer.from(await r.arrayBuffer()), 'png', { provider, prompt, kind: 'image' })];
  }

  if (provider === 'fal') {
    const r = await fetch(`${url}/${model || 'fal-ai/flux/dev'}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
      body: JSON.stringify({ prompt, image_size: 'landscape_16_9', num_images: n })
    });
    const j = await r.json();
    if (!r.ok) throw new GatewayError(JSON.stringify(j).slice(0, 300), r.status, provider);
    return (j.images || []).map(i => ({ url: i.url, provider, prompt, kind: 'image' }));
  }

  if (provider === 'replicate') {
    const r = await fetch(`${url}/models/${model || 'black-forest-labs/flux-schnell'}/predictions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, prefer: 'wait' },
      body: JSON.stringify({ input: { prompt } })
    });
    const j = await r.json();
    if (!r.ok) throw new GatewayError(j.detail || 'échec replicate', r.status, provider);
    const out = Array.isArray(j.output) ? j.output : [j.output];
    return out.filter(Boolean).map(u => ({ url: u, provider, prompt, kind: 'image' }));
  }

  if (provider === 'comfyui' || provider === 'a1111') {
    // Stable Diffusion local — txt2img
    const endpoint = provider === 'a1111' ? `${url}/sdapi/v1/txt2img` : `${url}/prompt`;
    const body = provider === 'a1111'
      ? { prompt, negative_prompt: negative, steps: 28, width: 1024, height: 576 }
      : { prompt: { text: prompt } };
    const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new GatewayError('échec SD local', r.status, provider);
    if (j.images) return j.images.map(b64 => saveBinary(Buffer.from(b64, 'base64'), 'png', { provider, prompt, kind: 'image' }));
    return [{ queued: true, raw: j, provider, kind: 'image' }];
  }
  throw new GatewayError(`Génération image non implémentée pour ${provider}`, 501);
}

// ── VIDÉO ────────────────────────────────────────────────────────────────
export async function generateVideo({ provider = 'luma', model, prompt, imageUrl, duration = 5, ratio = '16:9' }) {
  const p = byId(provider);
  if (!p) throw new GatewayError(`Fournisseur vidéo inconnu : ${provider}`, 404);
  const key = credential(p); const url = baseUrl(p);

  if (provider === 'luma') {
    const r = await fetch(`${url}/generations`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ prompt, model: model || 'ray-flash-2', resolution: '720p',
        duration: `${duration}s`, aspect_ratio: ratio,
        ...(imageUrl ? { keyframes: { frame0: { type: 'image', url: imageUrl } } } : {}) })
    });
    const j = await r.json();
    if (!r.ok) throw new GatewayError(JSON.stringify(j).slice(0, 300), r.status, provider);
    return { jobId: j.id, provider, state: j.state, poll: `${url}/generations/${j.id}` };
  }
  if (provider === 'runway') {
    const r = await fetch(`${url}/image_to_video`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'x-runway-version': '2024-11-06' },
      body: JSON.stringify({ model: model || 'gen4_turbo', promptImage: imageUrl, promptText: prompt, ratio: '1280:720', duration })
    });
    const j = await r.json();
    if (!r.ok) throw new GatewayError(JSON.stringify(j).slice(0, 300), r.status, provider);
    return { jobId: j.id, provider, poll: `${url}/tasks/${j.id}` };
  }
  if (provider === 'fal') {
    const r = await fetch(`${url}/${model || 'fal-ai/kling-video/v1/standard/text-to-video'}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
      body: JSON.stringify({ prompt, duration: String(duration), aspect_ratio: ratio })
    });
    const j = await r.json();
    if (!r.ok) throw new GatewayError(JSON.stringify(j).slice(0, 300), r.status, provider);
    return { url: j.video?.url, provider, kind: 'video' };
  }
  throw new GatewayError(`Génération vidéo non implémentée pour ${provider}`, 501);
}

export async function pollVideo({ provider, poll }) {
  const p = byId(provider); const key = credential(p);
  const h = provider === 'runway'
    ? { authorization: `Bearer ${key}`, 'x-runway-version': '2024-11-06' }
    : { authorization: `Bearer ${key}` };
  const r = await fetch(poll, { headers: h });
  const j = await r.json();
  const url = j.assets?.video || j.output?.[0] || j.video?.url || null;
  const state = j.state || j.status || 'inconnu';
  return { state, url, raw: j };
}

// ── VOIX (TTS) ───────────────────────────────────────────────────────────
export async function synthesizeSpeech({ provider = 'elevenlabs', text, voice, model }) {
  const p = byId(provider); const key = credential(p); const url = baseUrl(p);
  if (provider === 'elevenlabs') {
    const v = voice || '21m00Tcm4TlvDq8ikWAM';
    const r = await fetch(`${url}/text-to-speech/${v}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': key },
      body: JSON.stringify({ text, model_id: model || 'eleven_multilingual_v2' })
    });
    if (!r.ok) throw new GatewayError(await r.text(), r.status, provider);
    return saveBinary(Buffer.from(await r.arrayBuffer()), 'mp3', { provider, kind: 'audio', text: text.slice(0, 120) });
  }
  if (provider === 'openai-tts') {
    const r = await fetch(`${url}/audio/speech`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || 'gpt-4o-mini-tts', voice: voice || 'alloy', input: text })
    });
    if (!r.ok) throw new GatewayError(await r.text(), r.status, provider);
    return saveBinary(Buffer.from(await r.arrayBuffer()), 'mp3', { provider, kind: 'audio', text: text.slice(0, 120) });
  }
  throw new GatewayError(`TTS non implémenté pour ${provider}`, 501);
}

// ── TRANSCRIPTION / PAROLES (mots horodatés) ─────────────────────────────
export async function transcribe({ provider = 'openai-whisper', filePath, language = 'fr', wordTimestamps = true }) {
  const p = byId(provider); const key = credential(p); const url = baseUrl(p);
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);

  if (provider === 'openai-whisper' || provider === 'groq' || provider === 'groq-whisper') {
    const fd = new FormData();
    fd.append('file', new Blob([buf]), name);
    fd.append('model', provider.startsWith('groq') ? 'whisper-large-v3' : 'whisper-1');
    fd.append('language', language);
    fd.append('response_format', 'verbose_json');
    if (wordTimestamps) fd.append('timestamp_granularities[]', 'word');
    const r = await fetch(`${url}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: fd });
    const j = await r.json();
    if (!r.ok) throw new GatewayError(j.error?.message || 'échec transcription', r.status, provider);
    return { text: j.text, words: j.words || [], segments: j.segments || [], provider };
  }
  if (provider === 'assemblyai') {
    const up = await fetch(`${url}/upload`, { method: 'POST', headers: { authorization: key }, body: buf });
    const { upload_url } = await up.json();
    const tr = await fetch(`${url}/transcript`, {
      method: 'POST', headers: { authorization: key, 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url: upload_url, language_code: language })
    });
    const t = await tr.json();
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const s = await (await fetch(`${url}/transcript/${t.id}`, { headers: { authorization: key } })).json();
      if (s.status === 'completed') return { text: s.text, words: s.words || [], provider };
      if (s.status === 'error') throw new GatewayError(s.error, 502, provider);
    }
    throw new GatewayError('transcription trop longue', 504, provider);
  }
  throw new GatewayError(`Transcription non implémentée pour ${provider}`, 501);
}

// ── MUSIQUE ──────────────────────────────────────────────────────────────
export async function generateMusic({ provider = 'suno', prompt, style = 'instrumental', lyrics = '', model }) {
  const p = byId(provider);
  if (!p) throw new GatewayError(`Fournisseur musical inconnu : ${provider}`, 404);
  const key = credential(p); const url = baseUrl(p);
  if (!key) throw new GatewayError(`Clé manquante pour ${p.label}.`, 428, provider);

  if (provider === 'suno') {
    const r = await fetch(`${url}/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        prompt: prompt,
        style, model: model || 'V4_5',
        customMode: Boolean(lyrics),
        instrumental: style === 'instrumental' && !lyrics,
        ...(lyrics ? { lyrics } : {})
      })
    });
    const j = await r.json();
    if (!r.ok || j.code && j.code !== 200) throw new GatewayError(JSON.stringify(j).slice(0, 300), r.status, provider);
    const taskId = j.data?.taskId || j.data?.task_id || j.id;
    // Attente du rendu (Suno rend en 30 à 120 s)
    for (let i = 0; i < 80; i++) {
      await new Promise(x => setTimeout(x, 4000));
      const s2 = await fetch(`${url}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { authorization: `Bearer ${key}` } });
      const sj = await s2.json().catch(() => ({}));
      const statut = sj.data?.status || '';
      const pistes = sj.data?.response?.sunoData || sj.data?.data || [];
      if (/SUCCESS|complete/i.test(statut) && pistes.length) {
        return pistes.map(t => ({ url: t.audioUrl || t.audio_url, titre: t.title,
          duree: t.duration, image: t.imageUrl, provider, kind: 'musique' }));
      }
      if (/FAIL|ERROR/i.test(statut)) throw new GatewayError(`Génération échouée : ${statut}`, 502, provider);
    }
    throw new GatewayError('La génération dépasse le délai d\'attente.', 504, provider);
  }
  throw new GatewayError(`Génération musicale non implémentée pour ${provider}`, 501);
}
