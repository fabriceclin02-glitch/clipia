/**
 * CLIPIA X8 — Tâches planifiées : « tous les matins à 8 h, fais-moi la veille de mon secteur ».
 * À l'heure dite, la mission est confiée à un travail d'arrière-plan (travaux.js) : Clipia reste disponible.
 *
 * Garde-fous : intervalle minimum 15 min, 10 tâches actives au plus, jamais deux exécutions de la même tâche en
 * même temps, rattrapage d'une seule exécution après une extinction (moins de 12 h), et les actions sensibles
 * d'un travail planifié attendent TOUJOURS ton accord dans l'interface (le travail se met en pause).
 * Un agent ne peut en créer qu'avec ton accord ; rien n'est créé par un message reçu.
 */
import crypto from 'node:crypto';
import { store } from '../lib/store.js';
import { OUTILS } from './outils.js';
import { consommer } from './machine.js';
import * as travaux from './travaux.js';

const CLE = 'planning.taches';
export const MAX_ACTIVES = 10, MIN_MINUTES = 15;
const brut = () => store.setting(CLE) || [];
const sauver = l => store.setting(CLE, l);

/** Prochaine échéance (ms) après `depuis`. */
export function prochaine(freq, depuis = Date.now()) {
  if (freq.type === 'intervalle') return depuis + freq.minutes * 60000;
  const [h, m] = freq.heure.split(':').map(Number);
  const jours = freq.jours?.length ? freq.jours : [1, 2, 3, 4, 5, 6, 7];      // 1 = lundi … 7 = dimanche
  for (let i = 0; i < 8; i++) {
    const d = new Date(depuis); d.setDate(d.getDate() + i); d.setHours(h, m, 0, 0);
    const j = d.getDay() === 0 ? 7 : d.getDay();
    if (d.getTime() > depuis && jours.includes(j)) return d.getTime();
  }
  return depuis + 86400000;
}

function normaliser(f) {
  if (!f || typeof f !== 'object') throw new Error('Il faut une fréquence.');
  if (f.type === 'intervalle') {
    const minutes = Math.round(Number(f.minutes));
    if (!(minutes >= MIN_MINUTES) || minutes > 60 * 24 * 7) throw new Error(`Intervalle : de ${MIN_MINUTES} minutes à 7 jours.`);
    return { type: 'intervalle', minutes };
  }
  if (f.type === 'quotidien') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(f.heure))) throw new Error('Heure au format HH:MM.');
    const jours = Array.isArray(f.jours) ? [...new Set(f.jours.map(Number).filter(j => j >= 1 && j <= 7))] : [];
    return { type: 'quotidien', heure: f.heure, jours };
  }
  throw new Error('Fréquence inconnue (intervalle ou quotidien).');
}

export const liste = () => brut().map(t => ({ ...t }));
export function ajouter({ titre, mission, frequence }) {
  titre = String(titre || '').trim().slice(0, 80); mission = String(mission || '').trim().slice(0, 4000);
  if (!titre || mission.length < 4) throw new Error('Titre et mission (au moins 4 caractères) sont nécessaires.');
  const l = brut();
  if (l.filter(t => t.actif).length >= MAX_ACTIVES) throw new Error(`${MAX_ACTIVES} tâches actives au maximum.`);
  const freq = normaliser(frequence);
  const t = { id: 'plan_' + crypto.randomBytes(4).toString('hex'), titre, mission, frequence: freq, actif: true, prochaine: prochaine(freq), derniere: null, creee: new Date().toISOString() };
  sauver([...l, t]); return { ...t };
}
export function retirer(id) { const l = brut(); sauver(l.filter(t => t.id !== id)); return l.length !== brut().length; }
export function activer(id, actif) {
  const l = brut(); const t = l.find(x => x.id === id); if (!t) throw new Error('Tâche inconnue.');
  if (actif && l.filter(x => x.actif && x.id !== id).length >= MAX_ACTIVES) throw new Error(`${MAX_ACTIVES} tâches actives au maximum.`);
  t.actif = Boolean(actif); if (t.actif) t.prochaine = prochaine(t.frequence); sauver(l); return t;
}

/** À appeler régulièrement : lance ce qui est dû. Renvoie les ids lancés (utile aux tests). */
export function verifier(maintenant = Date.now()) {
  const l = brut(); const lances = []; let change = false;
  for (const t of l) {
    if (!t.actif || t.prochaine > maintenant) continue;
    const enRetard = maintenant - t.prochaine;
    t.prochaine = prochaine(t.frequence, maintenant); change = true;
    if (enRetard > 12 * 3600000) continue;                                          // trop ancien : on saute, sans rattraper
    if (travaux.actifsListe().some(w => w.titre === 'Planifié · ' + t.titre)) continue; // la précédente tourne encore
    try { travaux.lancer({ mission: t.mission, titre: 'Planifié · ' + t.titre }); t.derniere = new Date(maintenant).toISOString(); lances.push(t.id); }
    catch (e) { if (process.env.CLIPIA_DEBUG_PLAN) console.error(e.message); }
  }
  if (change) sauver(l);
  return lances;
}
let minuterie = null;
export function demarrer() { if (minuterie) return; verifier(); minuterie = setInterval(() => { try { verifier(); } catch {} }, 30000); minuterie.unref?.(); }

Object.assign(OUTILS, {
  planning_lister: { groupe: 'travaux', description: 'Liste les tâches planifiées (récurrentes). Aucun paramètre.',
    async run() { const l = liste(); return { resume: l.length ? l.map(t => `${t.titre} — ${t.frequence.type === 'intervalle' ? 'toutes les ' + t.frequence.minutes + ' min' : 'à ' + t.frequence.heure}${t.actif ? '' : ' (en pause)'}`).join('\n') : 'Aucune tâche planifiée.', preuve: { genre: 'liste', n: l.length } }; } },
  planning_ajouter: { groupe: 'travaux', description: 'Programme une mission récurrente. Paramètres : titre, mission, frequence ({type:"quotidien",heure:"08:00",jours:[1..7]} ou {type:"intervalle",minutes:60}), accord. Demande l\'accord de la personne.',
    async run(p) {
      const cle = 'planning:' + crypto.createHash('sha1').update(JSON.stringify([p.titre, p.mission, p.frequence])).digest('hex').slice(0, 12);
      if (!(p.accord && consommer(p.accord, cle))) {
        normaliser(p.frequence);
        return { resume: `Je voudrais programmer « ${String(p.titre).slice(0, 60)} » (${p.frequence.type === 'quotidien' ? 'chaque jour à ' + p.frequence.heure : 'toutes les ' + p.frequence.minutes + ' min'}). J'attends ton accord.`, arret: 'accord',
          effet: { genre: 'accord', commande: cle, categorie: 'planning', pourquoi: 'créer une tâche récurrente' }, preuve: { genre: 'accord-demande', outil: 'planning_ajouter' } };
      }
      const t = ajouter(p); return { resume: `Tâche planifiée : « ${t.titre} ».`, preuve: { genre: 'tache', id: t.id } };
    } },
  planning_retirer: { groupe: 'travaux', description: 'Supprime une tâche planifiée. Paramètre : id.',
    async run({ id }) { return { resume: retirer(String(id)) ? 'Tâche supprimée.' : 'Tâche introuvable.', preuve: { genre: 'arret' } }; } }
});
