/** CLIPIA — File de tâches en mémoire + persistance, avec progression SSE. */
import { store, uid } from '../lib/store.js';

const runners = new Map();   // type -> async (payload, ctx) => result
const listeners = new Map(); // jobId -> Set<fn>
let running = 0;
const MAX = Number(process.env.CLIPIA_CONCURRENCY || 2);
const waiting = [];

export const registerRunner = (type, fn) => runners.set(type, fn);

/**
 * Observateurs globaux : appelés à chaque changement d'état de n'importe
 * quelle tâche. Sert au cerveau, qui apprend de tout ce qui passe sans que
 * personne ait à l'abonner tâche par tâche.
 * Un observateur qui lève une erreur ne doit jamais faire tomber la tâche.
 */
const observateurs = new Set();
export function observer(fn) { observateurs.add(fn); return () => observateurs.delete(fn); }

export function subscribe(jobId, fn) {
  if (!listeners.has(jobId)) listeners.set(jobId, new Set());
  listeners.get(jobId).add(fn);
  return () => listeners.get(jobId)?.delete(fn);
}

function emit(jobId, data) {
  const job = store.update('jobs', jobId, data);
  for (const fn of listeners.get(jobId) || []) { try { fn(job); } catch {} }
  for (const fn of observateurs) { try { fn(job); } catch {} }
}

export function enqueue(type, payload, meta = {}) {
  const job = store.insert('jobs', {
    id: uid('job'), type, payload, status: 'en attente', pct: 0,
    steps: [], result: null, error: null, ...meta
  });
  waiting.push(job.id);
  setImmediate(pump);
  return job;
}

async function pump() {
  if (running >= MAX || !waiting.length) return;
  const id = waiting.shift();
  const job = store.find('jobs', j => j.id === id);
  if (!job) return pump();
  const fn = runners.get(job.type);
  if (!fn) { emit(id, { status: 'échec', error: `Type de tâche inconnu : ${job.type}` }); return pump(); }
  running++;
  emit(id, { status: 'en cours', startedAt: new Date().toISOString() });
  const ctx = {
    progress: (p) => {
      const cur = store.find('jobs', j => j.id === id);
      emit(id, { pct: p.pct ?? cur.pct, steps: [...(cur.steps || []), { ...p, at: Date.now() }].slice(-60) });
    },
    log: (msg) => ctx.progress({ log: String(msg).slice(0, 300) })
  };
  try {
    const result = await fn(job.payload, ctx);
    emit(id, { status: 'terminé', pct: 100, result, finishedAt: new Date().toISOString() });
  } catch (e) {
    emit(id, { status: 'échec', error: e.message || String(e), finishedAt: new Date().toISOString() });
  } finally { running--; setImmediate(pump); }
}

export const listJobs = () => store.all('jobs').slice(-100).reverse();
export const getJob = id => store.find('jobs', j => j.id === id);
export function cancel(id) {
  const i = waiting.indexOf(id);
  if (i >= 0) { waiting.splice(i, 1); emit(id, { status: 'annulé' }); return true; }
  return false;
}
export const stats = () => ({ running, waiting: waiting.length, max: MAX });
