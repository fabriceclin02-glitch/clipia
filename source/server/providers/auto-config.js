/**
 * CLIPIA — Configuration automatique au premier lancement.
 *
 * Objectif : qu'à la première ouverture, l'utilisateur n'ait rien à taper.
 * Clipia réveille Ollama s'il dort, et télécharge un modèle s'il n'en a aucun.
 * Tout est annonçable et annulable : on ne lance jamais 2 Go sans le dire.
 */
import { store } from '../lib/store.js';
import * as ollama from './ollama-local.js';
import os from 'node:os';
import { installerModele, recommanderModeles } from './installeur.js';

const MODELE_DEPART = 'llama3.2:3b';   // 2 Go, tourne sur une machine ordinaire

let encours = null;

export function etatAuto() {
  return {
    encours: Boolean(encours),
    etape: encours?.etape || null,
    pct: encours?.pct ?? null,
    fait: store.setting('autoconfig:fait') || false,
    refuse: store.setting('autoconfig:refuse') || false
  };
}

export async function recommandation() {
  const e = await ollama.etat().catch(() => ({ installe: false, actif: false, modeles: [] }));
  const ram = Math.round(os.totalmem() / 1024 ** 3);
  const noms = (e.modeles || []).map(m => m.nom || m.name || m);
  return { ollama: { installe: e.installe, actif: e.actif }, ...recommanderModeles(ram, noms) };
}

export const refuser = () => { store.setting('autoconfig:refuse', true); return etatAuto(); };

/**
 * Prépare tout ce qui peut l'être sans intervention.
 * `onEvent` reçoit la progression ; `avecModele` déclenche le téléchargement.
 */
export async function preparer({ avecModele = false, modele = null } = {}, onEvent = () => {}) {
  if (encours) return { deja: true };
  encours = { etape: 'démarrage', pct: null };
  const journal = [];

  try {
    // 1. Ollama : installé mais endormi ? On le réveille.
    let e = await ollama.etat();
    onEvent({ etape: 'ollama', message: e.installe ? 'Ollama trouvé' : 'Ollama absent' });

    if (!e.installe) {
      journal.push({ etape: 'ollama', ok: false, message: "Ollama n'est pas installé — utilisez le bouton d'installation." });
      onEvent({ etape: 'ollama', erreur: "Ollama n'est pas installé sur cette machine." });
    } else if (!e.actif) {
      encours.etape = 'réveil d\'Ollama';
      onEvent({ etape: 'ollama', message: 'Démarrage du serveur…' });
      try { await ollama.demarrer(); journal.push({ etape: 'ollama', ok: true, message: 'Serveur démarré' }); e = await ollama.etat(); }
      catch (err) { journal.push({ etape: 'ollama', ok: false, message: err.message }); onEvent({ etape: 'ollama', erreur: err.message }); }
    } else {
      journal.push({ etape: 'ollama', ok: true, message: 'Déjà en marche' });
    }

    // 2. Modèles adaptés à la machine : téléchargés seulement avec l'accord de la personne.
    if (e.actif) {
      const rec = await recommandation();
      // Avec l'accord : le meilleur modèle pour la machine d'abord, plus le petit modèle de mémoire. Le reste (code, vision) se choisit ensuite.
      const essentiels = rec.aTelecharger.filter(m => m.nom === rec.principal.nom || m.nom === 'nomic-embed-text');
      const choix = avecModele ? (modele ? [{ nom: modele }, ...essentiels.filter(m => m.nom !== modele)] : essentiels)
                               : rec.aTelecharger;
      if (!choix.length) journal.push({ etape: 'modele', ok: true, message: 'Tous les modèles recommandés sont présents' });
      else if (!avecModele) {
        onEvent({ etape: 'modele', proposition: rec.principal.nom, modeles: choix.map(m => m.nom),
          message: `Clipia peut télécharger ${choix.length} modèle(s) adaptés à ta machine (${rec.ramGo} Go de RAM) : ${choix.map(m => m.nom).join(', ')}.` });
        journal.push({ etape: 'modele', ok: null, message: 'Téléchargement proposé, en attente de votre accord.' });
      } else {
        for (const m of choix) {
          encours.etape = 'téléchargement de ' + m.nom;
          onEvent({ etape: 'modele', message: `Téléchargement de ${m.nom}…` });
          try {
            await installerModele(m.nom, p => { encours.pct = p.pct; onEvent({ etape: 'modele', modele: m.nom, pct: p.pct, recu: p.recu, total: p.total, message: p.etat }); });
            journal.push({ etape: 'modele', ok: true, message: `${m.nom} installé` });
          } catch (err) { journal.push({ etape: 'modele', ok: false, message: `${m.nom} : ${err.message}` }); onEvent({ etape: 'modele', erreur: `${m.nom} : ${err.message}` }); }
        }
      }
    }

    store.setting('autoconfig:fait', true);
    store.insert('events', { type: 'autoconfig', etapes: journal.length });
    onEvent({ fini: true, journal });
    return { journal };
  } finally { encours = null; }
}

/** Au démarrage du serveur : on réveille Ollama, discrètement, sans rien télécharger. */
export async function auDemarrage() {
  if (store.setting('autoconfig:refuse')) return;
  try {
    const e = await ollama.etat();
    if (e.installe && !e.actif) {
      await ollama.demarrer();
      console.log('   Ollama réveillé automatiquement.');
    }
  } catch { /* simple confort, jamais bloquant */ }
}
