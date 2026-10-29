/** CLIPIA — Publication effective vers les plateformes connectées. */
import fs from 'node:fs';
import { accessToken } from './oauth.js';
import { store } from '../lib/store.js';

/** YouTube : téléversement resumable. */
export async function publishYouTube({ filePath, title, description, tags = [], privacy = 'private' }) {
  const token = await accessToken('youtube');
  const meta = { snippet: { title, description, tags, categoryId: '10' }, status: { privacyStatus: privacy } };
  const size = fs.statSync(filePath).size;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json',
      'x-upload-content-length': String(size), 'x-upload-content-type': 'video/*' },
    body: JSON.stringify(meta)
  });
  if (!init.ok) throw new Error(`YouTube init : ${await init.text()}`);
  const url = init.headers.get('location');
  const up = await fetch(url, { method: 'PUT',
    headers: { 'content-length': String(size), 'content-type': 'video/*' },
    body: fs.createReadStream(filePath), duplex: 'half' });
  const j = await up.json();
  if (!up.ok) throw new Error(`YouTube upload : ${JSON.stringify(j).slice(0, 300)}`);
  store.insert('events', { type: 'publish.youtube', videoId: j.id });
  return { platform: 'youtube', id: j.id, url: `https://youtu.be/${j.id}` };
}

/** TikTok : initialisation + envoi du fichier. */
export async function publishTikTok({ filePath, title, privacy = 'SELF_ONLY' }) {
  const token = await accessToken('tiktok');
  const size = fs.statSync(filePath).size;
  const init = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      post_info: { title, privacy_level: privacy, disable_comment: false },
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 }
    })
  });
  const j = await init.json();
  if (!init.ok || j.error?.code !== 'ok') throw new Error(`TikTok : ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const put = await fetch(j.data.upload_url, { method: 'PUT',
    headers: { 'content-type': 'video/mp4', 'content-range': `bytes 0-${size - 1}/${size}` },
    body: fs.readFileSync(filePath) });
  if (!put.ok) throw new Error(`TikTok envoi : ${put.status}`);
  store.insert('events', { type: 'publish.tiktok', publishId: j.data.publish_id });
  return { platform: 'tiktok', id: j.data.publish_id, status: 'en traitement' };
}

/** SoundCloud : téléversement d'un morceau. */
export async function publishSoundCloud({ filePath, title, description = '', sharing = 'private' }) {
  const token = await accessToken('soundcloud');
  const fd = new FormData();
  fd.append('track[title]', title);
  fd.append('track[description]', description);
  fd.append('track[sharing]', sharing);
  fd.append('track[asset_data]', new Blob([fs.readFileSync(filePath)]), 'audio.mp3');
  const r = await fetch('https://api.soundcloud.com/tracks', {
    method: 'POST', headers: { authorization: `OAuth ${token}` }, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(`SoundCloud : ${JSON.stringify(j).slice(0, 300)}`);
  return { platform: 'soundcloud', id: j.id, url: j.permalink_url };
}

/** Webhook générique signé — compatible n8n, Make, Zapier. */
export async function callWebhook({ url, secret, event, payload }) {
  const body = JSON.stringify({ event, at: new Date().toISOString(), payload });
  const { signPayload } = await import('./oauth.js');
  const r = await fetch(url, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-clipia-event': event,
      ...(secret ? { 'x-clipia-signature': signPayload(secret, body) } : {}) },
    body });
  return { ok: r.ok, status: r.status };
}

export const PUBLISHERS = { youtube: publishYouTube, tiktok: publishTikTok, soundcloud: publishSoundCloud,
  whatsapp: envoyerWhatsApp, telegram: envoyerTelegram };

/** WhatsApp Business Cloud API — message texte ou média. */
export async function envoyerWhatsApp({ destinataire, texte, lienMedia, type = 'text' }) {
  const { vault } = await import('../lib/vault.js');
  const token = vault.resolve('connector:whatsapp:id', 'WHATSAPP_TOKEN');
  const phoneId = vault.resolve('connector:whatsapp:secret', 'WHATSAPP_PHONE_ID');
  if (!token || !phoneId) throw new Error('WhatsApp : jeton ou identifiant de numéro manquant. Paramètres → Coffre.');
  const corps = type === 'video' && lienMedia
    ? { messaging_product: 'whatsapp', to: destinataire, type: 'video', video: { link: lienMedia, caption: texte || '' } }
    : { messaging_product: 'whatsapp', to: destinataire, type: 'text', text: { body: texte } };
  const r = await fetch(`${process.env.CLIPIA_API_WHATSAPP || 'https://graph.facebook.com/v21.0'}/${phoneId}/messages`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(corps)
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`WhatsApp : ${JSON.stringify(j.error || j).slice(0, 250)}`);
  store.insert('events', { type: 'message.whatsapp', id: j.messages?.[0]?.id });
  return { plateforme: 'whatsapp', id: j.messages?.[0]?.id };
}

/** Telegram — message ou vidéo sur un canal. */
export async function envoyerTelegram({ canal, texte, cheminVideo }) {
  const { vault } = await import('../lib/vault.js');
  const token = vault.resolve('connector:telegram:id', 'TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('Telegram : jeton de bot manquant.');
  if (cheminVideo) {
    const fd = new FormData();
    fd.append('chat_id', canal);
    fd.append('caption', texte || '');
    fd.append('video', new Blob([fs.readFileSync(cheminVideo)]), 'video.mp4');
    const r = await fetch(`${process.env.CLIPIA_API_TELEGRAM || 'https://api.telegram.org'}/bot${token}/sendVideo`, { method: 'POST', body: fd });
    const j = await r.json();
    if (!j.ok) throw new Error(`Telegram : ${j.description}`);
    return { plateforme: 'telegram', id: j.result.message_id };
  }
  const r = await fetch(`${process.env.CLIPIA_API_TELEGRAM || 'https://api.telegram.org'}/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: canal, text: texte, parse_mode: 'HTML' })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram : ${j.description}`);
  return { plateforme: 'telegram', id: j.result.message_id };
}
