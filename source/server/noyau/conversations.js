/**
 * CLIPIA — Conversations durables : chaque échange est enregistré tout seul,
 * rangé comme un projet dans l'arborescence de gauche, et reprenable plus tard.
 * Les guides pas à pas (étapes cochables) sont conservés avec la conversation.
 */
import { store, uid } from '../lib/store.js';
import { masquer } from './archive.js';

const COLL = 'conversations';
const MAX_MSG = 400, MAX_TXT = 20000;

function titreDepuis(messages) {
  const m = messages.find(x => x.role === 'user' && String(x.content || '').trim());
  const t = String(m?.content || 'Nouvelle conversation').replace(/\s+/g, ' ').replace(/---[\s\S]*$/, '').trim();
  return t.length > 60 ? t.slice(0, 57) + '…' : (t || 'Nouvelle conversation');
}

function nettoyer(messages) {
  return (Array.isArray(messages) ? messages : []).slice(-MAX_MSG).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: masquer(String(m.content || '').slice(0, MAX_TXT))   // les clés collées dans un message sont masquées
  })).filter(m => m.content);
}

export const liste = () => store.all(COLL).slice()
  .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
  .map(c => ({ id: c.id, titre: c.titre, epingle: Boolean(c.epingle), updatedAt: c.updatedAt || c.createdAt, nb: c.messages.length,
    guides: (c.guides || []).reduce((n, g) => n + g.etapes.length, 0), faites: (c.guides || []).reduce((n, g) => n + g.etapes.filter(e => e.fait).length, 0) }));

export const lire = (id) => store.find(COLL, c => c.id === id) || null;

export function enregistrer({ id, messages, titre }) {
  const msgs = nettoyer(messages);
  if (!msgs.length) throw new Error('Rien à enregistrer.');
  const ex = id && lire(id);
  if (ex) return store.update(COLL, id, { messages: msgs, titre: ex.titreFixe ? ex.titre : titreDepuis(msgs) });
  return store.insert(COLL, { id: id || uid('cnv'), titre: titre || titreDepuis(msgs), messages: msgs, guides: [] });
}

export function renommer(id, titre) {
  const t = String(titre || '').trim().slice(0, 80);
  if (!t) throw new Error('Un titre ne peut pas être vide.');
  if (!lire(id)) throw new Error('Conversation introuvable.');
  return store.update(COLL, id, { titre: t, titreFixe: true });
}
export function epingler(id, v) { if (!lire(id)) throw new Error('Conversation introuvable.'); return store.update(COLL, id, { epingle: Boolean(v) }); }
export const supprimer = (id) => store.remove(COLL, id);

/** Un guide : { titre, etapes:[{titre, detail, fait}] }. Mis à jour par titre pour ne pas dupliquer. */
export function enregistrerGuide(id, guide) {
  const c = lire(id); if (!c) throw new Error('Conversation introuvable.');
  const etapes = (Array.isArray(guide?.etapes) ? guide.etapes : []).slice(0, 40).map(e => ({
    titre: String(e.titre || '').slice(0, 160), detail: String(e.detail || '').slice(0, 1200), fait: Boolean(e.fait) })).filter(e => e.titre);
  if (!etapes.length) throw new Error('Un guide a besoin d\'au moins une étape.');
  const g = { titre: String(guide.titre || 'Guide').slice(0, 120), etapes };
  const autres = (c.guides || []).filter(x => x.titre !== g.titre);
  return store.update(COLL, id, { guides: [...autres, g] });
}
