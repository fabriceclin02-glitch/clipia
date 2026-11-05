/**
 * CLIPIA — Messagerie privée téléphone ⇄ Clipia (style WhatsApp, mais uniquement avec ton IA).
 *
 * Chaque demande du téléphone passe par LE MÊME cerveau que le chat de l'ordinateur (noyauBoucle.converser) :
 * réflexion → phrase d'intention → choix du moteur → exécution → résultat → image / vidéo affichée dans la discussion.
 * Tout est enregistré côté PC : l'historique est identique sur le téléphone et sur l'ordinateur.
 *
 * Transport : "long-poll" (GET /api/chat/depuis?seq=N attend jusqu'à 20 s qu'un message change) — passe partout,
 * y compris par le pont natif de l'APK, sans WebSocket ni dépendance.
 */
import path from 'node:path';
import { store, uid } from '../lib/store.js';
import * as boucle from './boucle.js';
import * as machine from './machine.js';
import * as navigateur from './navigateur.js';

const COLL = 'chat_msgs';
let SEQ = Math.max(0, ...store.all(COLL).map(m => m.seq || 0));
for (const m of store.filter(COLL, x => x.statut === 'en_cours')) store.update(COLL, m.id, { seq: ++SEQ, statut: 'erreur', etat: '', texte: (m.texte ? m.texte + '\n\n' : '') + '⚠ Interrompu : Clipia a redémarré pendant cette demande. Redemande-moi.' });   // jamais de « en cours » fantôme
const vivants = new Map();               // id → message en cours (objet mutable)
const veilleurs = new Set();             // résolveurs de long-poll
const reveiller = () => { for (const f of [...veilleurs]) f(); veilleurs.clear(); };
export const accordsDepuisTelephone = () => store.setting('chat:accords-telephone') === true;
export const reglerAccordsTelephone = (v) => store.setting('chat:accords-telephone', Boolean(v));

const maintenant = () => new Date().toISOString();
function publier(m) {
  m.seq = ++SEQ; m.maj = maintenant();
  if (store.find(COLL, x => x.id === m.id)) store.update(COLL, m.id, { ...m }); else store.insert(COLL, { ...m });
  reveiller();
}
const TYPE_MEDIA = (u) => /\.(mp4|webm|mov|mkv)(\?|$)/i.test(u) ? 'video' : /\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(u) ? 'audio' : /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u) ? 'image' : 'fichier';

export const messages = (conv = 'principal', limite = 80) =>
  store.filter(COLL, m => m.conv === conv).sort((a, b) => a.seq - b.seq).slice(-limite);

/** Messages modifiés depuis `seq`. Attend (jusqu'à `ms`) s'il n'y en a pas encore. */
export function depuis(seq = 0, ms = 0, conv = 'principal', init = false) {
  const lire = () => { const l = store.filter(COLL, m => m.conv === conv && (m.seq || 0) > seq).sort((a, b) => a.seq - b.seq); return { seq: SEQ, messages: init ? l.slice(-60) : l }; };
  const r = lire();
  if (r.messages.length || !ms) return Promise.resolve(r);
  return new Promise((res) => {
    const fin = () => { clearTimeout(t); veilleurs.delete(go); res(lire()); };
    const go = () => fin();
    const t = setTimeout(fin, Math.min(ms, 25000));
    veilleurs.add(go);
  });
}

function historiqueTexte(conv) {
  return messages(conv, 24).filter(m => m.texte && m.statut !== 'en_cours').slice(-8)
    .map(m => ({ role: m.role === 'moi' ? 'user' : 'assistant', content: String(m.texte).slice(0, 1500) }));
}

/** Transforme les évènements de la boucle en "parties" affichables : pensée, intention, moteur, outil, résultat, média, texte. */
function surEvenement(m, e) {
  const p = m.parties;
  switch (e.type) {
    case 'reflexion': m.etat = 'Clipia réfléchit…'; break;
    case 'pensee': p.push({ k: 'pensee', texte: String(e.texte || '').slice(0, 1800) }); break;
    case 'message': p.push({ k: 'dit', texte: String(e.texte || '') }); break;
    case 'moteur': p.push({ k: 'moteur', outil: e.outil, moteur: e.moteur, raison: e.raison }); break;
    case 'outil': p.push({ k: 'outil', outil: e.outil, parametres: e.parametres, statut: 'en_cours' }); m.etat = 'Clipia utilise « ' + e.outil + ' »…'; break;
    case 'resultat': {
      const o = [...p].reverse().find(x => x.k === 'outil' && x.statut === 'en_cours' && x.outil === e.outil);
      if (o) { o.statut = e.ok ? 'ok' : 'erreur'; o.resultat = String(e.resultat || '').slice(0, 400); }
      m.etat = 'Clipia réfléchit…'; break;
    }
    case 'effet': if (e.genre === 'media' && e.url) p.push({ k: 'media', url: e.url, nom: e.nom || path.basename(String(e.url).split('?')[0]), type: TYPE_MEDIA(e.url) }); break;
    case 'attente': { const o = [...p].reverse().find(x => x.k === 'outil' && x.statut === 'en_cours'); if (o) o.statut = 'attente'; }
      m.attente = { outil: e.outil, commande: e.commande, categorie: e.categorie, pourquoi: e.pourquoi, resume: e.resume, parametres: e.parametres || null }; break;
    case 'texte': m.texte = String(e.texte || ''); break;
    case 'simule': p.push({ k: 'dit', texte: '🧪 (simulation) ' + (e.detail || '') }); break;
    default: return;
  }
  publier(m);
}

async function executer(m, { message, reprise = null }) {
  vivants.set(m.id, m);
  try {
    const r = await boucle.converser({ message, historique: historiqueTexte(m.conv).filter(h => h.content !== message), vocal: false, projet: 'telephone', reprise }, (e) => surEvenement(m, e));
    if (r.texte && !m.texte) m.texte = r.texte;
    if (r.attente) m.attente = { ...(m.attente || {}), ...r.attente };
    m.statut = 'fini'; m.etat = '';
  } catch (e) {
    m.statut = 'erreur'; m.etat = ''; m.texte = (m.texte ? m.texte + '\n\n' : '') + '⚠ ' + String(e.message || e).slice(0, 400);
  } finally { vivants.delete(m.id); publier(m); }
}

/** Le téléphone envoie un message : on enregistre, on accuse réception, on lance la réflexion en arrière-plan. */
export function envoyer({ texte, conv = 'principal', idClient = '', appareil = '' }) {
  texte = String(texte || '').trim().slice(0, 4000);
  if (!texte) throw new Error('Message vide.');
  if (idClient) { const deja = store.find(COLL, x => x.idClient === idClient); if (deja) return { doublon: true, id: deja.id }; }   // renvoi hors-ligne : jamais deux fois
  const moi = { id: uid('msg'), conv, role: 'moi', texte, statut: 'recu', idClient, appareil, parties: [] };
  publier(moi);
  const cl = { id: uid('msg'), conv, role: 'clipia', texte: '', statut: 'en_cours', etat: 'Clipia réfléchit…', tache: texte, parties: [] };
  publier(cl);
  executer(cl, { message: texte });
  return { id: moi.id, reponse: cl.id };
}

/** Reprend une action qui attendait l'accord (depuis le PC, ou depuis le téléphone si le réglage est activé). */
export async function accorder(idMsg, { depuisTelephone = false } = {}) {
  if (depuisTelephone && !accordsDepuisTelephone()) throw new Error('Les accords depuis le téléphone sont désactivés : valide sur l\'ordinateur (ou active l\'option dans « Connecter mon téléphone »).');
  const m = store.find(COLL, x => x.id === idMsg);
  if (!m?.attente?.outil || !m.attente.commande) throw new Error('Rien n\'attend ton accord ici.');
  if (vivants.has(m.id)) throw new Error('Cette demande est déjà en cours.');
  const a = m.attente;
  const jeton = a.categorie === 'navigateur' ? navigateur.accorderNavigateur(String(a.commande)) : machine.accorder(String(a.commande));
  const vif = { ...m, attente: null, statut: 'en_cours', etat: 'Clipia reprend…', parties: [...(m.parties || []).filter(x => !(x.k === 'outil' && x.statut === 'attente')), { k: 'dit', texte: '✅ Autorisé — je continue.' }] };
  publier(vif);
  executer(vif, { message: m.tache || '', reprise: { outil: a.outil, parametres: a.parametres || {}, accord: jeton } });
  return { ok: true };
}
export const enAttente = () => store.filter(COLL, m => m.attente?.outil && m.statut !== 'en_cours').map(m => ({ id: m.id, ...m.attente, tache: m.tache }));
export const refuser = (idMsg) => { const m = store.find(COLL, x => x.id === idMsg); if (!m) return false; publish_(m); return true; };
function publish_(m) { publier({ ...m, attente: null, parties: [...(m.parties || []), { k: 'dit', texte: '🚫 Refusé.' }] }); }
export const effacer = (conv = 'principal') => { const n = store.garder(COLL, m => m.conv !== conv); reveiller(); return n; };
