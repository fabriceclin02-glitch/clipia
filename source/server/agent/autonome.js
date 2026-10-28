/**
 * CLIPIA — Agent autonome.
 * On lui donne un objectif, il le découpe en étapes, les exécute
 * avec les outils du studio, observe le résultat et décide de la suite.
 * Il s'arrête de lui-même quand l'objectif est atteint, ou quand il bloque.
 */
import { chat } from '../providers/gateway.js';
import { memoire } from '../memoire/index.js';
import { store } from '../lib/store.js';
import { planifier, diagnostiquer, critiquer, contexteLecons, enregistrerLecon } from './raisonnement.js';

/** Les capacités réelles du studio, décrites pour le planificateur. */
export const CAPACITES = {
  'clip':          'Produire une vidéo depuis une piste sonore. Paramètres : audioPath, style, ratio (youtube|tiktok|instagram|cinema), genre (clip|lyric|explicative|audiogramme|pub|narratif|formation|diaporama), llm, imageProvider.',
  'image':         'Générer une ou plusieurs images. Paramètres : provider, prompt, size.',
  'video':         'Générer un plan vidéo animé. Paramètres : provider, prompt, duration.',
  'musique':       'Composer un morceau. Paramètres : provider, prompt, style, lyrics.',
  'voix':          'Synthétiser une voix off. Paramètres : provider, text.',
  'transcription': 'Transcrire un audio mot à mot. Paramètres : provider, filePath, language.',
  'texte':         'Faire rédiger ou réfléchir un modèle. Paramètres : provider, messages, system.',
  'publication':   'Publier sur une plateforme connectée. Paramètres : platform (youtube|tiktok|soundcloud|whatsapp|telegram), filePath, title, description.',
  'agent-code':    'Faire écrire du code ou un site par l\'agent développeur. Paramètres : projet, demande.',
  'calculer':      'Calculer RÉELLEMENT une expression, avec les constantes physiques (c, G, h, M_soleil…) et des fonctions de relativité, gravitation et quantique. Paramètre : expression. À utiliser systématiquement plutôt que d\'estimer un nombre de tête.',
  'convertir':     'Convertir une unité. Paramètres : valeur, de, vers.',
  'quantique':     'Simuler un circuit quantique : superposition, intrication, mesure. Paramètres : qubits, portes.',
  'radio':         'Physique des ondes radio : longueur d\'onde, propagation, antenne, bilan de liaison, Doppler. Paramètres : frequence, puissance_W, distance_m.',
  'pilotage-qubit':'Calculer le pilotage micro-onde d\'un qubit supraconducteur. Paramètres : frequence_qubit, amplitude_rabi, angle.',
  'analyser-audio':'Mesurer un son : spectre, dynamique, tempo, niveau. Paramètre : chemin.',
  'son-cognitif':  'Produire un son calibré. Paramètres : type (binaural|isochrone|bruit), bande, minutes.'
};

const SYSTEME = (capacites, contexteMemoire, etat, plan) => `Tu es le pilote autonome du studio Clipia.\nTu ne cites aucun nom de marque ni de société dans ce que tu écris.

On te donne un OBJECTIF. Tu le mènes à bien seul, étape par étape, en utilisant les capacités du studio.
${contexteMemoire}
CAPACITÉS DISPONIBLES :
${Object.entries(capacites).map(([k, v]) => `- ${k} : ${v}`).join('\n')}

RESSOURCES ACTUELLES :
${etat}
${plan ? `\nVOTRE PLAN — suivez-le, mais adaptez-vous à ce que vous observez :\n${plan.etapes.map(e => `${e.n}. ${e.quoi} → ${e.produit}`).join('\n')}\n` : ''}${contexteLecons()}

À chaque tour, tu réponds par UNE SEULE action, dans un bloc exactement comme ceci :

\`\`\`action
{"pensee":"ce que je fais et pourquoi, en une phrase","type":"clip","payload":{...}}
\`\`\`

Pour demander une précision indispensable que tu ne peux pas deviner :
\`\`\`action
{"pensee":"...","type":"demander","question":"votre question"}
\`\`\`

Quand l'objectif est atteint :
\`\`\`action
{"pensee":"...","type":"termine","resume":"ce qui a été produit"}
\`\`\`

RÈGLES :
- Pour tout nombre qui compte, appelle « calculer » : ne l'estime jamais de tête. Un modèle de langage approxime, le moteur calcule.
- Une seule action par tour. Tu verras son résultat avant de continuer.
- Choisis toujours un moteur réellement disponible dans les ressources ci-dessus.
- Si une étape échoue deux fois, essaie autrement ou arrête-toi en l'expliquant.
- Ne demande une précision que si c'est vraiment bloquant : sinon, prends la décision la plus raisonnable et dis-le.
- Tu parles français, brièvement.`;

function extraire(texte) {
  const bloc = texte.match(/```action\s*([\s\S]*?)```/);
  const brut = bloc ? bloc[1] : (texte.match(/\{[\s\S]*"type"[\s\S]*\}/) || [])[0];
  if (!brut) return null;
  try { return JSON.parse(brut.trim()); } catch { return null; }
}

/**
 * Exécute un objectif de bout en bout.
 * `executerTache(type, payload)` doit renvoyer le résultat de la tâche.
 */
export async function piloter({ objectif, provider, model, maxEtapes = 14, etatStudio = '',
                               avecPlan = true, avecCritique = true },
                               executerTache, onEvent = () => {}) {
  const journal = [];
  let resume = '', question = null, echecs = 0, plan = null;

  // ── 1. Réfléchir avant d'agir ─────────────────────────────────────────
  if (avecPlan) {
    onEvent({ type: 'etape', nom: 'réflexion' });
    try {
      plan = await planifier({ objectif, provider, model, capacites: CAPACITES, etatStudio });
      onEvent({ type: 'plan', plan });
      if (plan.manques?.length) onEvent({ type: 'alerte', manques: plan.manques });
    } catch (e) { onEvent({ type: 'alerte', message: 'Plan non établi : ' + e.message }); }
  }

  const historique = [{ role: 'user', content: `OBJECTIF : ${objectif}` }];

  for (let i = 0; i < maxEtapes; i++) {
    onEvent({ type: 'reflexion', etape: i + 1, total: maxEtapes });

    const r = await chat(provider, {
      model, system: SYSTEME(CAPACITES, memoire.contexte(), etatStudio, plan),
      messages: historique, temperature: 0.4, maxTokens: 1800
    });

    const action = extraire(r.text);
    if (!action?.type) {
      historique.push({ role: 'assistant', content: r.text });
      historique.push({ role: 'user', content: 'Réponds avec un bloc ```action valide.' });
      continue;
    }

    if (action.pensee) onEvent({ type: 'pensee', texte: action.pensee });

    if (action.type === 'termine') {
      resume = action.resume || action.pensee || 'Objectif atteint.';
      journal.push({ type: 'termine', resume });
      onEvent({ type: 'fin', resume });
      break;
    }
    if (action.type === 'demander') {
      question = action.question;
      onEvent({ type: 'question', question });
      break;
    }
    if (!CAPACITES[action.type]) {
      historique.push({ role: 'assistant', content: r.text });
      historique.push({ role: 'user', content: `Capacité inconnue « ${action.type} ». Choisis parmi : ${Object.keys(CAPACITES).join(', ')}.` });
      continue;
    }

    onEvent({ type: 'action', tache: action.type, pensee: action.pensee });
    let resultat, ok = true;
    try { resultat = await executerTache(action.type, action.payload || {}); }
    catch (e) {
      ok = false; resultat = `ERREUR : ${e.message}`; echecs++;

      // Plutôt que de réessayer à l'aveugle : comprendre, puis corriger.
      onEvent({ type: 'etape', nom: 'diagnostic' });
      try {
        const d = await diagnostiquer({ tache: action.type, payload: action.payload,
          erreur: e.message, objectif, provider, model, etatStudio });
        onEvent({ type: 'diagnostic', cause: d.cause, explication: d.explication, reparable: d.reparable });

        if (d.reparable && d.correction?.capacite && CAPACITES[d.correction.capacite]) {
          onEvent({ type: 'action', tache: d.correction.capacite, pensee: 'Correction : ' + d.explication });
          try {
            resultat = await executerTache(d.correction.capacite, d.correction.payload || {});
            ok = true; echecs--;
            onEvent({ type: 'resultat', tache: d.correction.capacite, ok: true, resultat: 'corrigé' });
          } catch (e2) { resultat = `ERREUR après correction : ${e2.message}`; }
        }
      } catch { /* le diagnostic lui-même peut échouer : on continue */ }
    }

    journal.push({ type: action.type, pensee: action.pensee, payload: action.payload,
      resultat: typeof resultat === 'string' ? resultat.slice(0, 400) : resultat, ok });
    onEvent({ type: 'resultat', tache: action.type, ok,
      resultat: typeof resultat === 'string' ? resultat.slice(0, 300) : resultat });

    if (echecs >= 4) { resume = 'Arrêt : trop d\'échecs consécutifs.'; onEvent({ type: 'fin', resume }); break; }

    historique.push({ role: 'assistant', content: r.text });
    historique.push({ role: 'user', content: `Résultat de ${action.type} :\n${JSON.stringify(resultat).slice(0, 2500)}` });
  }

  // ── 3. Juger son propre travail ───────────────────────────────────────
  let critique = null;
  if (avecCritique && resume && journal.length > 1) {
    onEvent({ type: 'etape', nom: 'relecture' });
    try {
      critique = await critiquer({ objectif, provider, model,
        resultat: journal.map(j => `${j.type} → ${typeof j.resultat === 'string' ? j.resultat : JSON.stringify(j.resultat)}`).join('\n') });
      onEvent({ type: 'critique', critique });
      if (!critique.atteint && critique.aRefaire?.length)
        enregistrerLecon(objectif.slice(0, 60), `Objectif non atteint du premier coup : ${critique.aRefaire[0].quoi}`);
    } catch { /* sans critique on livre quand même */ }
  }

  if (!resume && !question) resume = `Arrêt après ${journal.length} étapes sans conclusion.`;
  store.insert('events', { type: 'agent.autonome', objectif: objectif.slice(0, 120), etapes: journal.length });
  return { resume, question, journal, plan, critique };
}
