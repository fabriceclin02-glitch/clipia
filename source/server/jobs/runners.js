/** CLIPIA — Enregistrement des exécuteurs de tâches. */
import { registerRunner } from './queue.js';
import { musicToClip, analyzeAudio, extractLyrics, storyboard } from '../pipelines/music-to-clip.js';
import { generateImage, generateVideo, pollVideo, saveBinary, synthesizeSpeech, transcribe, generateMusic } from '../providers/media.js';
import { chat } from '../providers/gateway.js';
import { PUBLISHERS } from '../connectors/publish.js';
import { recordUsage } from '../billing/stripe.js';

registerRunner('clip', async (p, ctx) => {
  /* Correctif 8.5.1 — « mode: local » (outil clip_monter de l'agent) n'était pas honoré : la tâche partait dans le pipeline à modèles
     et échouait avec « Fichier illisible : undefined ». Le montage local (ffmpeg seul, sans clé) est maintenant appelé pour de bon. */
  if (p.mode === 'local') {
    const { clipLocal } = await import('../pipelines/clip-local.js');
    ctx.progress({ step: 'montage local', pct: 20 });
    const a = await clipLocal({ audio: p.audio || p.audioPath, format: p.format || 'paysage', ambiance: ({ nuit: 'double', aurore: 'spectre', braise: 'onde', abysse: 'lissajous', or: 'bandes' })[p.ambiance] || p.ambiance || 'double', titre: p.titre || '', artiste: p.artiste || 'CLENDAX' });
    return { assetId: a.id, url: a.url, file: a.file, detail: a.detail };
  }
  const r = await musicToClip({ ...p, onProgress: ctx.progress });
  recordUsage('clips', 1, { ratio: p.ratio });
  return { assetId: r.asset.id, url: r.asset.url, scenes: r.shots.length,
    duration: r.analysis.duration, bpm: r.analysis.bpm, titre: r.storyboard.title };
});

registerRunner('analyse-audio', async (p, ctx) => { ctx.progress({ step: 'analyse', pct: 50 }); return analyzeAudio(p.audioPath); });
registerRunner('paroles', async (p) => { const l = await extractLyrics(p.audioPath, p); return { text: l.text, mots: l.words?.length || 0, words: l.words }; });
registerRunner('scenario', async (p) => storyboard(p));

registerRunner('image', async (p, ctx) => {
  ctx.progress({ step: 'génération', pct: 30 });
  const size = p.size || (p.width && p.height ? `${Math.round(p.width)}x${Math.round(p.height)}` : undefined);
  const r = await generateImage({ ...p, size });
  recordUsage('images', r.length);
  return r;
});
/* Correctif 8.5.1 — avant : le job se terminait dès l'envoi, sans jamais attendre ni récupérer la vidéo (résultat = un simple lien de suivi). */
registerRunner('video', async (p, ctx) => {
  ctx.progress({ step: 'envoi au moteur', pct: 10 });
  const r = await generateVideo(p);
  let url = r.url || null;
  for (let i = 0; !url && r.poll && i < 100; i++) {
    await new Promise(x => setTimeout(x, 5000));
    const s = await pollVideo({ provider: r.provider, poll: r.poll });
    ctx.progress({ step: `rendu (${s.state})`, pct: Math.min(90, 15 + i) });
    if (/fail|error|reject/i.test(String(s.state))) throw new Error(`Le moteur vidéo a refusé ou échoué (${s.state}).`);
    if (s.url) url = s.url;
  }
  if (!url) throw new Error('La vidéo n\'est pas prête après 8 minutes : réessaie, ou vérifie ton crédit chez le fournisseur.');
  const rep = await fetch(url);
  if (!rep.ok) throw new Error(`Téléchargement de la vidéo impossible (HTTP ${rep.status}).`);
  const buf = Buffer.from(await rep.arrayBuffer());
  const a = saveBinary(buf, 'mp4', { provider: r.provider, prompt: p.prompt, kind: 'video' });
  return { ...a, url: a.url, file: a.file };
});
registerRunner('voix', async (p) => synthesizeSpeech(p));
registerRunner('musique', async (p, ctx) => { ctx.progress({ step: 'composition', pct: 25 }); return generateMusic(p); });
registerRunner('transcription', async (p) => transcribe(p));

registerRunner('texte', async (p, ctx) => {
  ctx.progress({ step: 'réflexion', pct: 40 });
  const r = await chat(p.provider, p);
  recordUsage('tokens', r.usage?.total_tokens || 0);
  return { text: r.text, ms: r.ms };
});

registerRunner('publication', async (p, ctx) => {
  const fn = PUBLISHERS[p.platform];
  if (!fn) throw new Error(`Publication non prise en charge : ${p.platform}`);
  ctx.progress({ step: 'téléversement', pct: 40 });
  return fn(p);
});

/** Workflow : enchaînement d'étapes définies dans l'interface. */
registerRunner('workflow', async (p, ctx) => {
  const out = [];
  const { enqueue, subscribe } = await import('./queue.js');
  for (let i = 0; i < p.steps.length; i++) {
    const s = p.steps[i];
    ctx.progress({ step: s.type, pct: Math.round((i / p.steps.length) * 100) });
    const job = enqueue(s.type, { ...s.payload, ...(out.length ? { precedent: out[out.length - 1] } : {}) });
    const res = await new Promise((resolve, reject) => {
      const un = subscribe(job.id, j => {
        if (j.status === 'terminé') { un(); resolve(j.result); }
        if (j.status === 'échec') { un(); reject(new Error(j.error)); }
      });
    });
    out.push(res);
  }
  return out;
});
