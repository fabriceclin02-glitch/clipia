/**
 * CLIPIA — Audit complet, à lancer SUR TON ORDINATEUR (Clipia doit tourner).
 *   Windows : double-clic sur AUDIT-CLIPIA.bat     Mac/Linux : node scripts/audit-complet.mjs
 * Il teste réellement : le réseau, les moteurs, l'image, le clip local, la prise en main du PC,
 * les agents et les messageries. Il écrit le résultat dans Audit-Clipia.txt : envoie-le-moi, je corrige.
 */
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const PORT = process.env.PORT || 8787, B = `http://127.0.0.1:${PORT}`;
const H = { 'x-clipia-accord': '1', 'content-type': 'application/json' };
const out = []; let ko = 0;
const log = (ok, titre, detail = '') => { if (!ok) ko++; const l = `${ok ? '✓' : '✗'} ${titre}${detail ? ' — ' + detail : ''}`; out.push(l); console.log(l); };
const get = async (p, o = {}) => { const r = await fetch(B + p, { headers: H, signal: AbortSignal.timeout(o.t || 20000), ...o }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch { return { s: r.status, t }; } };
const post = (p, b, t = 60000) => get(p, { method: 'POST', body: JSON.stringify(b || {}), t });
const joignable = async (url, t = 8000) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(t) }); return `HTTP ${r.status}`; } catch (e) { return null; } };
const sh = (c, a) => { try { const r = spawnSync(c, a, { timeout: 8000, shell: process.platform === 'win32' }); return r.status === 0; } catch { return false; } };

out.push(`CLIPIA — audit du ${new Date().toISOString()} · ${os.platform()} ${os.release()} · Node ${process.version}`);
console.log(out[0]);

/* 1. Le serveur */
let v; try { v = await get('/api/etat'); log(v.s === 200, 'Serveur Clipia', `port ${PORT}`); } catch (e) { log(false, 'Serveur Clipia injoignable', `lance Clipia d'abord (${e.message})`); fs.writeFileSync('Audit-Clipia.txt', out.join('\n')); process.exit(1); }

/* 2. Le réseau (la cause n°1 des « rien ne marche ») */
for (const [n, u] of [['Internet', 'https://www.google.com'], ['Pollinations (images gratuites)', 'https://image.pollinations.ai/prompt/test?width=64&height=64'], ['Pollinations (texte)', 'https://text.pollinations.ai/models'],
  ['Groq', 'https://api.groq.com/openai/v1/models'], ['Telegram', 'https://api.telegram.org'], ['Slack', 'https://slack.com/api/api.test'], ['WhatsApp (Meta)', 'https://graph.facebook.com']]) {
  const r = await joignable(u); log(Boolean(r), 'Réseau : ' + n, r || 'INJOIGNABLE (pare-feu, antivirus, proxy, VPN ?)');
}

/* 3. Les moteurs */
const b = (await post('/api/noyau/evaluer', {}, 120000)).j || {};
for (const [k, x] of Object.entries(b.besoins || {})) log(x.pret || !x.vital, `Moteur « ${x.nom} »`, x.pret ? `${x.choisi?.label} (${x.candidats?.length} candidat(s))` : 'AUCUN — ajoute une clé (Réglages → Clés) ou installe Ollama');
log(Boolean(b.montage?.pret), 'FFmpeg (montage vidéo)', b.montage?.quoi || '');

/* 4. Image réelle */
const im = (await post('/api/studio/image', { description: 'a small red apple on a table, photo', format: '1:1' }, 200000)).j || {};
log(im.secours === false, 'Génération d’image réelle', im.secours === false ? im.fichier : `repli utilisé — raison : ${im.raison}`);

/* 5. Clip local (ffmpeg + son) */
try {
  const wav = os.tmpdir() + '/audit-clipia.wav';
  const g = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', wav], { timeout: 20000, shell: process.platform === 'win32' });
  if (g.status !== 0) log(false, 'Clip local', 'ffmpeg introuvable dans le PATH (installe FFmpeg ou réinstalle Clipia)');
  else { const t = (await post('/api/taches', { type: 'clip', payload: { mode: 'local', audio: wav, ambiance: 'nuit' } })).j; let j = t, n = 0; while (j && !/terminé|échec|annulé/.test(j.status || '') && n++ < 60) { await new Promise(r => setTimeout(r, 2000)); j = (await get('/api/taches/' + t.id)).j; } log(j?.status === 'terminé', 'Clip local (visualiseur sur le son)', j?.status === 'terminé' ? j.result?.url : j?.error || j?.status); }
} catch (e) { log(false, 'Clip local', e.message); }

/* 6. Prise en main de l’ordinateur */
const pf = process.platform;
if (pf === 'win32') { log(sh('powershell', ['-NoProfile', '-Command', 'echo ok']), 'PowerShell (souris, clavier, captures)'); }
else if (pf === 'darwin') { log(sh('osascript', ['-e', '1']), 'osascript (autorisations : Réglages → Confidentialité → Accessibilité / Enregistrement d’écran pour Clipia/Node)'); }
else { for (const c of ['xdotool', 'wmctrl', 'scrot']) log(sh('which', [c]), 'Linux : ' + c, 'sudo apt install xdotool wmctrl scrot'); }
const ma = (await get('/api/noyau/machine')).j; log(Boolean(ma), 'Zone machine (lecture/écriture/commandes)', JSON.stringify(ma?.zones || ma?.etat || '').slice(0, 120));

/* 7. Agents */
const ag = (await get('/api/atelier')).j || (await get('/api/atelier/agents')).j; const liste = ag?.agents || ag || [];
log(Array.isArray(liste) && liste.length > 0, 'Agents', (Array.isArray(liste) ? liste.map(a => a.nom).join(', ') : '?').slice(0, 160));
log(Array.isArray(liste) && liste.some(a => a.nom === 'Assistant PC'), 'Agent « Assistant PC » (agit sur l’ordinateur)');

/* 8. Messageries */
const m = (await get('/api/messagerie')).j || {};
log(Boolean(m.canaux?.telegram?.configure), 'Telegram : jeton enregistré', m.canaux?.telegram?.enMarche ? 'à l’écoute' : 'pas à l’écoute');
log(Boolean(m.canaux?.slack?.configure && m.canaux?.slack?.socket), 'Slack : jeton bot + jeton d’application (xapp-)', m.canaux?.slack?.enMarche ? 'à l’écoute' : 'pas à l’écoute');
log(Boolean(m.canaux?.whatsapp?.configure && m.canaux?.whatsapp?.signature && m.canaux?.whatsapp?.verification), 'WhatsApp : jeton + secret + jeton de vérification', 'exige AUSSI une adresse publique (tunnel) pour que Meta appelle ton PC');
log((m.autorises || []).length > 0, 'Personnes autorisées à piloter Clipia', `${(m.autorises || []).length}`);

out.push('', ko ? `${ko} point(s) à corriger.` : 'Tout est bon.');
fs.writeFileSync('Audit-Clipia.txt', out.join('\n'), 'utf8');
console.log('\n' + out.at(-1) + '\nRésultat enregistré dans Audit-Clipia.txt');
