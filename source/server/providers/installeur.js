/**
 * CLIPIA — Installation de modèles locaux depuis l'application.
 * Ollama expose /api/pull : on relaie sa progression au navigateur.
 * L'utilisateur n'a donc aucune ligne de commande à taper.
 */
import { baseUrl, byId } from './registry.js';
import { store } from '../lib/store.js';

/** Sélection resserrée : ce qui tourne vraiment sur une machine ordinaire. */
export const MODELES_LOCAUX = [
  { nom:'llama3.2:3b', label:'Llama 3.2 — 3 milliards', taille:'2,0 Go', ram:'8 Go',
    usage:'Conversation, scénarios, textes courts. Le bon départ.', defaut:true },
  { nom:'llama3.2:1b', label:'Llama 3.2 — 1 milliard', taille:'1,3 Go', ram:'4 Go',
    usage:'Très léger. Pour un ordinateur modeste ou ancien.' },
  { nom:'qwen2.5:7b', label:'Qwen 2.5 — 7 milliards', taille:'4,7 Go', ram:'16 Go',
    usage:'Plus fin que Llama 3.2 sur le français et le code.' },
  { nom:'mistral:7b', label:'Mistral 7B', taille:'4,1 Go', ram:'16 Go',
    usage:'Français soigné, modèle européen.' },
  { nom:'gemma2:9b', label:'Gemma 2 — 9 milliards', taille:'5,4 Go', ram:'16 Go',
    usage:'Écriture longue et raisonnement.' },
  { nom:'llava:7b', label:'LLaVA 7B — vision', taille:'4,7 Go', ram:'16 Go',
    usage:'Comprend les images. Pour analyser un visuel.' },
  { nom:'qwen2.5-coder:7b', label:'Qwen Coder 7B', taille:'4,7 Go', ram:'16 Go',
    usage:'Spécialisé code. Pour l\'agent développeur.' },

  // ── Très légers : pour démarrer en moins de deux minutes ────────────────
  // Celui-ci est tiré automatiquement au premier lancement : Clipia sait
  // répondre hors ligne tout de suite, sans que tu aies rien à choisir.
  { nom:'qwen2.5:0.5b', label:'Qwen 2.5 — 0,5 milliard', taille:'400 Mo', ram:'2 Go',
    usage:'Dernier recours pour une machine très modeste : il répond mal et se répète. Clipia ne le choisit que s\'il n\'y a rien d\'autre.' },
  { nom:'qwen2.5:1.5b', label:'Qwen 2.5 — 1,5 milliard', taille:'1,0 Go', ram:'4 Go',
    usage:'Bon compromis poids/qualité sur une machine sans carte graphique.' },
  { nom:'gemma2:2b', label:'Gemma 2 — 2 milliards', taille:'1,6 Go', ram:'4 Go',
    usage:'Écriture agréable pour sa taille.' },
  { nom:'phi3.5:3.8b', label:'Phi 3.5 — 3,8 milliards', taille:'2,2 Go', ram:'8 Go',
    usage:'Raisonnement étonnamment solide pour le poids. Signé Microsoft.' },
  { nom:'smollm2:1.7b', label:'SmolLM2 — 1,7 milliard', taille:'1,0 Go', ram:'4 Go',
    usage:'Conçu pour tourner sur peu de mémoire.' },
  { nom:'moondream', label:'Moondream — vision légère', taille:'1,7 Go', ram:'4 Go',
    usage:'Décrit une image sans carte graphique. Alternative légère à LLaVA.' },
  { nom:'nomic-embed-text', label:'Nomic Embed — mémoire', taille:'275 Mo', ram:'2 Go',
    usage:'Pas un modèle de discussion : il sert à la mémoire de Clipia, pour retrouver ce qui a déjà été dit.',
    amorce:true },

  // ── Raisonnement, si la machine suit ────────────────────────────────────
  { nom:'deepseek-r1:7b', label:'DeepSeek R1 — 7 milliards', taille:'4,7 Go', ram:'16 Go',
    usage:'Montre son raisonnement étape par étape. Lent mais rigoureux.' },
  { nom:'qwen3:8b', label:'Qwen 3 — 8 milliards', taille:'5,2 Go', ram:'16 Go',
    usage:'La génération la plus récente. Très bon en français.' },
  { nom:'llama3.1:8b', label:'Llama 3.1 — 8 milliards', taille:'4,7 Go', ram:'16 Go',
    usage:'Valeur sûre, bien documentée, contexte 128 000 jetons.' },

  // ── Les meilleurs modèles ouverts, selon la mémoire de la machine ───────
  { nom:'qwen3:4b', label:'Qwen 3 — 4 milliards', taille:'2,6 Go', ram:'8 Go',
    usage:'Le meilleur petit modèle récent : raisonne et écrit bien le français.' },
  { nom:'qwen3:14b', label:'Qwen 3 — 14 milliards', taille:'9,3 Go', ram:'24 Go',
    usage:'Très bon raisonnement et français soigné. Le choix idéal avec 24 Go.' },
  { nom:'qwen3:32b', label:'Qwen 3 — 32 milliards', taille:'20 Go', ram:'48 Go',
    usage:'Qualité proche des grands services en ligne. Demande une grosse machine.' },
  { nom:'deepseek-r1:14b', label:'DeepSeek R1 — 14 milliards', taille:'9,0 Go', ram:'24 Go',
    usage:'Raisonne étape par étape avant de répondre : maths, logique, code.' },
  { nom:'deepseek-r1:32b', label:'DeepSeek R1 — 32 milliards', taille:'20 Go', ram:'48 Go',
    usage:'Le raisonnement le plus poussé en local.' },
  { nom:'qwen2.5:14b', label:'Qwen 2.5 — 14 milliards', taille:'9,0 Go', ram:'24 Go',
    usage:'Solide généraliste, très bon sur le français et le code.' },
  { nom:'gemma3:12b', label:'Gemma 3 — 12 milliards', taille:'8,1 Go', ram:'24 Go',
    usage:'Écriture fluide, comprend aussi les images.' }
];

export async function ollamaPresent() {
  try {
    const r = await fetch(baseUrl(byId('ollama')) + '/api/tags', { signal: AbortSignal.timeout(3500) });
    if (!r.ok) return { ok: false };
    const j = await r.json();
    return { ok: true, modeles: (j.models || []).map(m => ({ nom: m.name, octets: m.size })) };
  } catch { return { ok: false }; }
}

/** Télécharge un modèle et relaie la progression. */
export async function installerModele(nom, onProgres) {
  const url = baseUrl(byId('ollama'));
  const r = await fetch(`${url}/api/pull`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: nom, stream: true })
  });
  if (!r.ok || !r.body) throw new Error(`Ollama a refusé le téléchargement (${r.status}). Est-il bien démarré ?`);

  const rd = r.body.getReader(), dec = new TextDecoder();
  let buf = '', dernier = 0;
  while (true) {
    const { done, value } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lignes = buf.split('\n'); buf = lignes.pop() || '';
    for (const L of lignes) {
      if (!L.trim()) continue;
      let j; try { j = JSON.parse(L); } catch { continue; }
      if (j.error) throw new Error(j.error);
      const pct = j.total ? Math.round((j.completed || 0) / j.total * 100) : null;
      // On n'inonde pas le flux : un point par pourcent.
      if (pct === null || pct !== dernier) {
        dernier = pct ?? dernier;
        onProgres({ etat: j.status, pct, recu: j.completed, total: j.total });
      }
    }
  }
  store.insert('events', { type: 'modele.installe', modele: nom });
  return { ok: true, modele: nom };
}

export async function supprimerModele(nom) {
  const url = baseUrl(byId('ollama'));
  const r = await fetch(`${url}/api/delete`, {
    method: 'DELETE', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: nom })
  });
  if (!r.ok) throw new Error(`Suppression refusée (${r.status}).`);
  return { ok: true };
}

/** Go de RAM exigés par un modèle ("8 Go" → 8). */
const ramGo = m => parseFloat(String(m.ram).replace(',', '.')) || 99;

/**
 * Sélection adaptée à la machine : règle « RAM requise annoncée ≤ RAM de la machine » (la marge est déjà dans l'annonce).
 * Retourne le modèle principal (le plus capable qui tient), un modèle de code et de vision
 * s'ils tiennent, plus les modèles d'amorce (mémoire + secours ultra-léger).
 */
export function recommanderModeles(ramTotaleGo, deja = []) {
  const tient = m => ramGo(m) <= Math.max(2, ramTotaleGo + 0.5);
  const manque = m => !deja.includes(m.nom);
  const classes = MODELES_LOCAUX.filter(m => !m.amorce && tient(m)).sort((a, b) => ramGo(b) - ramGo(a));
  // Le meilleur généraliste qui tient en mémoire (du plus capable au plus modeste).
  const prefere = ['qwen3:32b', 'qwen3:14b', 'qwen3:8b', 'qwen3:4b', 'llama3.1:8b', 'qwen2.5:7b', 'phi3.5:3.8b', 'llama3.2:3b', 'qwen2.5:1.5b', 'llama3.2:1b'];
  const principal = prefere.map(n => classes.find(m => m.nom === n)).find(Boolean) || classes.at(-1)
    || MODELES_LOCAUX.find(m => m.nom === 'qwen2.5:0.5b');
  // Un modèle qui raisonne (DeepSeek R1) en complément, si la machine a de quoi.
  const raisonnement = ['deepseek-r1:32b', 'deepseek-r1:14b', 'deepseek-r1:7b'].map(n => classes.find(m => m.nom === n)).find(Boolean);
  const code = classes.find(m => m.nom === 'qwen2.5-coder:7b');
  const vision = classes.find(m => m.nom === 'gemma3:12b') || classes.find(m => m.nom === 'llava:7b') || classes.find(m => m.nom === 'moondream');
  const amorces = MODELES_LOCAUX.filter(m => m.amorce);
  const liste = [principal, raisonnement, ...amorces, code, vision].filter(Boolean)
    .filter((m, i, t) => t.findIndex(x => x.nom === m.nom) === i);
  return { ramGo: ramTotaleGo, principal, modeles: liste.map(m => ({ ...m, installe: !manque(m) })), aTelecharger: liste.filter(manque) };
}
