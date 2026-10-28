/** CLIPIA — Enregistrement des exécuteurs de tâches. */
import { registerRunner } from './queue.js';
import { musicToClip, analyzeAudio, extractLyrics, storyboard } from '../pipelines/music-to-clip.js';
import { generateImage, generateVideo, synthesizeSpeech, transcribe, generateMusic } from '../providers/media.js';
import { chat } from '../providers/gateway.js';
import { PUBLISHERS } from '../connectors/publish.js';
import { recordUsage } from '../billing/stripe.js';

registerRunner('clip', async (p, ctx) => {
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
  const r = await generateImage(p);
  recordUsage('images', r.length);
  return r;
});
registerRunner('video', async (p, ctx) => { ctx.progress({ step: 'file distante', pct: 20 }); return generateVideo(p); });
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
