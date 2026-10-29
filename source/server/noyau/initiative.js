/**
 * CLIPIA X8 — Initiatives : ce que Clipia remarque et propose d'elle-même, sans rien exécuter.
 * Règles simples et vérifiables (pas de devinette) ; chaque proposition dit POURQUOI, et le clic de la personne
 * est toujours nécessaire pour agir. Rien n'est envoyé, publié, payé ni installé ici.
 */
import { store } from '../lib/store.js';
import * as travaux from './travaux.js';
import * as planning from './planificateur.js';
import * as extChrome from './extension.js';
import * as archive from './archive.js';

const J = 86400000;
export function proposer(maintenant = Date.now()) {
  const p = [];
  const ajout = (id, prio, titre, pourquoi, action) => p.push({ id, prio, titre, pourquoi, action });
  try {
    const l = travaux.liste();
    for (const t of l.filter(x => x.statut === 'attente').slice(0, 2))
      ajout('accord-' + t.id, 1, `« ${t.titre} » attend ton accord`, 'Le travail est en pause tant que tu n\'as pas répondu à la carte « Autoriser ».', { type: 'vue', cible: '#/travaux' });
    for (const t of l.filter(x => ['echec', 'échec', 'erreur'].includes(String(x.statut)) && maintenant - Date.parse(t_fin(x)) < 2 * J).slice(0, 2))
      ajout('echec-' + t.id, 2, `« ${t.titre} » a échoué`, 'Je peux relancer en changeant d\'approche, ou t\'expliquer ce qui a bloqué.', { type: 'chat', texte: `Le travail « ${t.titre} » a échoué. Regarde ce qui a bloqué (travail_statut ${t.id}) et propose-moi la meilleure autre voie.` });
    for (const t of l.filter(x => x.statut === 'termine' && !x.vu && maintenant - Date.parse(t_fin(x)) < 3 * J).slice(0, 2))
      ajout('fini-' + t.id, 3, `« ${t.titre} » est terminé`, 'Le résultat est prêt à être relu.', { type: 'vue', cible: '#/travaux' });
  } catch {}
  try {
    const d = store.setting('sauvegarde:derniere');
    const age = d ? maintenant - Date.parse(d.quand) : Infinity;
    const aDuContenu = store.all('conversations').length + store.all('archive').length > 20;
    if (aDuContenu && age > 7 * J) ajout('sauvegarde', 2, d ? 'Ta dernière sauvegarde date de plus d\'une semaine' : 'Tu n\'as encore aucune sauvegarde de ton IA', 'Une clé USB, Dropbox ou MEGA : ça prend une minute et rien n\'est perdu.', { type: 'vue', cible: '#/sauvegarde' });
  } catch {}
  try {
    const publie = archive.rechercher('publier', { limite: 3, depuis: new Date(maintenant - 7 * J).toISOString() }).length;
    if (publie && !extChrome.connectee()) ajout('chrome', 3, 'Installe l\'extension Chrome', 'Tu as parlé de publication : l\'extension me permet de remplir les formulaires à ta place (avec ton accord).', { type: 'vue', cible: '#/chrome' });
  } catch {}
  try {
    if (!planning.liste().length && store.all('conversations').length > 5)
      ajout('routine', 4, 'Programme une routine', 'Par exemple une veille chaque matin : je travaille en arrière-plan et je te prévins.', { type: 'vue', cible: '#/planning' });
  } catch {}
  return p.sort((a, b) => a.prio - b.prio).slice(0, 5);
}
const t_fin = t => t.fin || t.debut || 0;
