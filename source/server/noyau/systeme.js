/**
 * CLIPIA — Cerveau du système : l'OS qui s'observe, se souvient, réfléchit et propose de s'améliorer.
 *
 *  observer()   photographie l'état de la machine (mémoire, disque, services en échec, erreurs du journal, réseau,
 *               persistance, moteurs IA) et l'inscrit dans la mémoire totale (genre « systeme »).
 *  analyser()   en tire des RECOMMANDATIONS avec la raison et les instructions pas à pas. Règles explicites, vérifiables.
 *  conseiller() demande à un modèle de reformuler le plan en français simple (facultatif ; sans modèle, le plan brut sert).
 *  décider()    la personne accepte, refuse ou reporte. Un refus est mémorisé : Clipia ne le reproposera pas.
 *  appliquer()  JAMAIS sans accord : renvoie la commande et passe par le mécanisme d'accord à usage unique.
 */
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { store } from '../lib/store.js';
import * as archive from './archive.js';

const sh = (cmd, args = [], ms = 6000) => new Promise(res => {
  try { execFile(cmd, args, { timeout: ms, maxBuffer: 1 << 20 }, (e, out) => res(e && !out ? '' : String(out || ''))); } catch { res(''); }
});
const lire = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

/** Sondes réelles (Linux). Remplaçables dans les tests. */
export const sondeReelle = {
  async disque() {
    const o = await sh('df', ['-Pk', '/']); const l = o.trim().split('\n')[1]?.split(/\s+/);
    return l ? { totalGo: +(l[1] / 1048576).toFixed(1), libreGo: +(l[3] / 1048576).toFixed(1), pct: parseInt(l[4]) } : null;
  },
  async servicesEnEchec() { return (await sh('systemctl', ['--failed', '--no-legend', '--plain'])).split('\n').map(x => x.trim().split(/\s+/)[0]).filter(Boolean); },
  async erreursJournal() {
    const o = await sh('journalctl', ['-p', 'err', '-b', '-n', '40', '--no-pager', '-o', 'cat']);
    const c = {}; for (const l of o.split('\n').filter(Boolean)) { const k = l.replace(/[0-9a-f]{6,}|\d+/g, '#').slice(0, 90); c[k] = (c[k] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([message, fois]) => ({ message, fois }));
  },
  async tempsDemarrage() { const m = (await sh('systemd-analyze', ['time'])).match(/=\s*([\d.]+)s/); return m ? +m[1] : null; },
  async reseau() { return Boolean(Object.values(os.networkInterfaces()).flat().find(i => i && !i.internal && i.family === 'IPv4')); },
  persistance() {
    const live = fs.existsSync('/run/live') || /boot=casper|clipia-live/.test(lire('/proc/cmdline'));
    const part = /\/var\/lib\/clipia\s/.test(lire('/proc/mounts'));
    return { live, donneesPersistantes: live ? part : true };
  },
  async ollama() { try { const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1500) }); const j = await r.json(); return { present: true, modeles: (j.models || []).length }; } catch { return { present: false, modeles: 0 }; } },
  async miseAJour() { return (await sh('sh', ['-c', 'apt list --upgradable 2>/dev/null | tail -n +2 | wc -l'], 15000)).trim() * 1 || 0; },
  async batterie() { const l = lire('/sys/class/power_supply/BAT0/capacity'); return l ? +l : null; },
  async temperature() { const t = +lire('/sys/class/thermal/thermal_zone0/temp'); return t ? t / 1000 : null; }
};

export async function observer({ sonde = sondeReelle } = {}) {
  const [disque, echecs, erreurs, boot, reseau, ollama] = await Promise.all([sonde.disque(), sonde.servicesEnEchec(), sonde.erreursJournal(), sonde.tempsDemarrage(), sonde.reseau(), sonde.ollama()]);
  const e = {
    quand: new Date().toISOString(), systeme: `${os.type()} ${os.release()}`, cpus: os.cpus().length,
    ramGo: +(os.totalmem() / 1073741824).toFixed(1), ramLibreGo: +(os.freemem() / 1073741824).toFixed(1),
    charge: +os.loadavg()[0].toFixed(2), uptimeMin: Math.round(os.uptime() / 60), disque, servicesEnEchec: echecs, erreursJournal: erreurs,
    demarrageSec: boot, reseau, persistance: sonde.persistance(), ollama,
    batterie: await sonde.batterie(), temperatureC: await sonde.temperature(),
    souvenirs: archive.stats().total
  };
  store.setting('systeme:dernier', e);
  archive.archiver({ genre: 'systeme', titre: 'État du système', texte: JSON.stringify(e).slice(0, 1100), source: 'systeme', ok: echecs.length === 0 && !(disque && disque.pct > 90), meta: { outil: 'observer' } });
  return e;
}

const R = (id, gravite, titre, pourquoi, instructions, commande = null) => ({ id, gravite, titre, pourquoi, instructions, commande });

/** Les règles. Chaque recommandation dit pourquoi, et comment la mettre en œuvre à la main. */
export function analyser(e = store.setting('systeme:dernier'), { connaissances = true } = {}) {
  if (!e) return [];
  const r = [];
  if (e.persistance?.live && !e.persistance.donneesPersistantes)
    r.push(R('persistance', 'haute', 'Tes données ne survivent pas à l\'extinction',
      'Clipia tourne depuis la clé sans partition de données : conversations, projets et leçons seraient perdus.',
      ['Relance « Préparer ma clé » depuis le menu Clipia OS (crée la partition CLIPIA-DATA dans l\'espace libre de la clé).', 'Redémarre ensuite. Rien d\'autre n\'est modifié sur la clé.'], 'sudo clipia-persistance'));
  if (e.disque?.pct >= 85)
    r.push(R('disque', e.disque.pct >= 95 ? 'haute' : 'moyenne', `Disque plein à ${e.disque.pct} %`,
      'Un disque presque plein ralentit tout et peut empêcher d\'enregistrer tes projets.',
      ['Exporte puis efface les anciens médias générés depuis Clipia → Médias.', 'Libère le cache : sudo apt clean ; journalctl --vacuum-size=100M'], 'sudo apt-get clean && sudo journalctl --vacuum-size=100M'));
  if (e.servicesEnEchec?.length)
    r.push(R('services', 'haute', `${e.servicesEnEchec.length} service(s) en échec`, e.servicesEnEchec.slice(0, 5).join(', '),
      ['Lis la cause : systemctl status <service> et journalctl -u <service> -b', 'Relance : sudo systemctl restart <service>'], null));
  for (const x of (e.erreursJournal || []).filter(x => x.fois >= 3).slice(0, 2))
    r.push(R('erreur-' + x.message.slice(0, 24).replace(/\W+/g, '-'), 'moyenne', `Erreur répétée ${x.fois} fois`, x.message,
      ['Cherche le message exact dans le journal : journalctl -p err -b | grep -i "<mot clé>"', 'Demande à Clipia de t\'expliquer l\'erreur : il garde ce message en mémoire.'], null));
  if (e.ramGo < 6)
    r.push(R('ram', 'info', `Peu de mémoire vive (${e.ramGo} Go)`, 'Seuls les petits modèles (≤ 3 milliards de paramètres) restent fluides.',
      ['Choisis qwen2.5:1.5b, llama3.2:1b ou phi3.5 dans le Centre des IA.', 'Ferme le navigateur et les autres applications pendant les gros calculs.'], null));
  if (!e.ollama?.present)
    r.push(R('ollama', e.reseau ? 'moyenne' : 'info', 'Aucun moteur IA local détecté',
      'Sans Ollama, Clipia ne peut pas répondre hors ligne.',
      e.reseau ? ['Lance « Installer Ollama » (menu Clipia OS), ou : curl -fsSL https://ollama.com/install.sh | sh', 'Puis ouvre le Centre des IA et installe un modèle adapté à ta RAM.'] : ['Branche-toi à Internet (menu réseau), puis relance cette analyse.'],
      e.reseau ? 'curl -fsSL https://ollama.com/install.sh | sh' : null));
  else if (!e.ollama.modeles)
    r.push(R('modele', 'moyenne', 'Ollama est là, mais aucun modèle n\'est installé', 'Il n\'a rien à faire tourner.', ['Ouvre le Centre des IA et clique « Installer » sur un modèle adapté à ta RAM.'], null));
  if (!e.reseau) r.push(R('reseau', 'info', 'Pas de réseau', 'Les moteurs en ligne, la recherche web et les mises à jour sont indisponibles. Les modèles locaux marchent.', ['Connecte le Wi-Fi ou un câble : nmtui (terminal) ou le menu réseau.'], null));
  if (e.batterie != null && e.batterie < 15) r.push(R('batterie', 'moyenne', `Batterie à ${e.batterie} %`, 'Une coupure en pleine écriture peut abîmer les données.', ['Branche le chargeur avant les longs travaux.'], null));
  if (e.temperatureC > 85) r.push(R('chaleur', 'haute', `Température élevée (${Math.round(e.temperatureC)} °C)`, 'Les gros modèles font chauffer le processeur.', ['Laisse respirer la machine, réduis la taille du modèle.'], null));
  if (e.demarrageSec > 90) r.push(R('boot', 'info', `Démarrage lent (${Math.round(e.demarrageSec)} s)`, 'Une clé USB lente allonge le démarrage.', ['Utilise une clé USB 3 de qualité, ou installe sur le disque interne.'], null));
  if (e.souvenirs > 12000) r.push(R('memoire', 'info', 'Le journal devient volumineux', 'Il est plafonné, mais les plus anciens souvenirs seront oubliés.', ['Exporte-le (écran Mémoire totale → Exporter) pour le garder.'], null));
  // Leçons déjà apprises : elles pèsent dans les conseils.
  if (connaissances) for (const l of archive.rechercher('', { genre: 'lecon', limite: 3 }))
    r.push(R('lecon-' + l.id, 'info', 'Leçon apprise : ' + l.titre, l.texte, ['Garde ça en tête avant de relancer la même action.'], null));
  // Décisions passées : le refusé ne revient pas, le reporté revient plus tard.
  const decisions = store.setting('systeme:decisions') || {};
  return r.filter(x => { const d = decisions[x.id]; return !d || (d.etat === 'reporte' && Date.parse(d.jusqua) < Date.now()); })
          .map(x => ({ ...x, etat: 'proposee' }))
          .sort((a, b) => ({ haute: 0, moyenne: 1, info: 2 }[a.gravite] - ({ haute: 0, moyenne: 1, info: 2 }[b.gravite])));
}

export function decider(id, choix, { jours = 7 } = {}) {
  if (!['accepte', 'refuse', 'reporte', 'fait'].includes(choix)) throw new Error('Choix inconnu.');
  const d = store.setting('systeme:decisions') || {};
  d[id] = { etat: choix, quand: new Date().toISOString(), ...(choix === 'reporte' ? { jusqua: new Date(Date.now() + jours * 864e5).toISOString() } : {}) };
  store.setting('systeme:decisions', d);
  archive.archiver({ genre: 'decision', titre: `Recommandation « ${id} » : ${choix}`, texte: '', source: 'personne', meta: { outil: 'recommandation', id, choix } });
  return d[id];
}

/** Reformulation par un modèle, si un moteur répond. Sinon : le plan brut, honnêtement signalé. */
export async function conseiller({ appeler, etat = store.setting('systeme:dernier'), recos = analyser(etat) } = {}) {
  const brut = recos.filter(r => !r.id.startsWith('lecon-')).map((r, i) => `${i + 1}. [${r.gravite}] ${r.titre} — ${r.pourquoi}\n   ${r.instructions.join('\n   ')}`).join('\n') || 'Rien à signaler.';
  if (!appeler) return { texte: brut, modele: false };
  try {
    const rep = await appeler(null, { system: "Tu es le cerveau du système Clipia OS. Explique à la personne, en français simple et sans jargon inutile, dans quel ordre appliquer ces recommandations et pourquoi. N'invente aucune commande : utilise uniquement celles qui sont données.",
      messages: [{ role: 'user', content: 'État : ' + JSON.stringify(etat).slice(0, 1500) + '\nRecommandations :\n' + brut }] });
    return { texte: String(rep.text || brut), modele: Boolean(rep.text) };
  } catch (e) { return { texte: brut, modele: false, note: 'Aucun moteur n\'a répondu ; voici le plan brut.' }; }
}

let minuteur = null;
export function demarrerVeille({ toutesLesMin = 30 } = {}) {
  if (minuteur) return;
  const tour = () => observer().then(() => archive.reflechir()).catch(() => {});
  setTimeout(tour, 15000);
  minuteur = setInterval(tour, toutesLesMin * 60000); minuteur.unref?.();
}
