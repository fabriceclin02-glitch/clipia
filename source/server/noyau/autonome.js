/**
 * CLIPIA — Cerveau autonome : un agent qui RÉFLÉCHIT avant d'agir.
 *
 * Cycle pour chaque objectif :
 *   1. COMPRENDRE  — reformule l'objectif, liste ce qui manque, fixe des critères de réussite.
 *   2. PLANIFIER   — découpe en étapes courtes, chacune avec ce qu'on doit obtenir.
 *   3. EXÉCUTER    — chaque étape passe par la boucle d'action (outils, fichiers, web…).
 *   4. VÉRIFIER    — un relecteur critique juge l'étape sur preuves ; si non, on corrige (2 essais max).
 *   5. REPLANIFIER — si une étape échoue deux fois, le plan est revu avec ce qu'on a appris.
 *   6. CONCLURE    — synthèse honnête : ce qui est fait, prouvé, et ce qui reste.
 *   7. APPRENDRE   — le plan réussi peut devenir un WORKFLOW réutilisable.
 *
 * Garde-fous dans le code : 8 étapes max, 2 essais par étape, 1 replanification,
 * accord de la personne exigé pour les actions sensibles (jamais auto-accordé),
 * annulation possible, et tout est journalisé.
 */
import { store, uid } from '../lib/store.js';
import { converser, sansReflexion } from './boucle.js';
import { chatWithFallback } from '../providers/gateway.js';
import * as archive from './archive.js';
import { chaine } from './demarrage.js';

export const MAX_ETAPES = 8;
export const MAX_ESSAIS = 2;
export const MAX_REPLANS = 1;

const json = t => {
  const s = sansReflexion(t);
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const brut = (m ? m[1] : s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)).trim();
  try { return JSON.parse(brut); } catch { return null; }
};

async function penser(appel, modeles, system, user, maxTokens = 1500) {
  const r = await appel(modeles, { system, messages: [{ role: 'user', content: user }], temperature: 0.3, maxTokens });
  return sansReflexion(r.text);
}

const SYS_PLAN = `Tu es le planificateur de Clipia, un studio créatif IA. Tu réfléchis AVANT d'agir.
Réponds UNIQUEMENT par un objet JSON :
{"comprehension":"l'objectif reformulé en une phrase","questions":["ce qui manque vraiment (souvent aucune)"],"criteres":["comment on saura que c'est réussi"],"etapes":[{"titre":"court","consigne":"ce que l'agent doit faire, précis","attendu":"résultat vérifiable (fichier, texte, chiffre)"}]}
Règles : 2 à 6 étapes concrètes, dans l'ordre ; pas d'étape vague ; ne demande une précision que si on ne peut vraiment pas avancer sans.`;

const SYS_JUGE = `Tu es le relecteur critique de Clipia. On te donne une étape, ce qui était attendu, et ce que l'agent a produit avec ses preuves.
Sois exigeant mais juste : juge sur les PREUVES (fichiers écrits, résultats d'outils), pas sur les promesses.
Réponds UNIQUEMENT en JSON : {"ok":true|false,"raison":"une phrase","correction":"si ok=false : ce qu'il faut faire précisément en plus ou autrement"}`;

const SYS_FIN = `Tu es Clipia. Rédige la réponse finale à la personne en français, naturel et clair : ce qui a été fait (appuie-toi sur les résultats réels), où trouver les fichiers, ce qui reste ou n'a pas marché (dis-le franchement), et au plus une suite logique. Pas de jargon, pas de liste de coulisses.`;

export const workflows = () => store.all('workflows').slice().sort((a, b) => String(b.maj || '').localeCompare(String(a.maj || '')));
export const workflow = id => store.find('workflows', w => w.id === id) || null;
export function enregistrerWorkflow({ nom, objectif = '', etapes = [] }) {
  if (!String(nom || '').trim()) throw new Error('Un workflow a besoin d\'un nom.');
  if (!etapes.length) throw new Error('Un workflow a besoin d\'au moins une étape.');
  return store.insert('workflows', { id: uid('wfl'), nom: String(nom).slice(0, 80), objectif: String(objectif).slice(0, 500),
    etapes: etapes.slice(0, MAX_ETAPES).map(e => ({ titre: String(e.titre || '').slice(0, 80), consigne: String(e.consigne || '').slice(0, 1200), attendu: String(e.attendu || '').slice(0, 400) })),
    creeLe: new Date().toISOString(), maj: new Date().toISOString(), lancements: 0 });
}
export const supprimerWorkflow = id => store.remove('workflows', id);
export const runs = (n = 20) => store.all('autonome_runs').slice().reverse().slice(0, n);

const controleurs = new Map();
export const annuler = id => { const c = controleurs.get(id); if (c) { c.abort(); return true; } return false; };

/**
 * objectif       ce que la personne veut
 * workflowId     (option) rejoue un workflow enregistré au lieu de planifier
 * contexte       texte libre (historique résumé)
 */
export async function lancer({ objectif, workflowId = null, projet = 'studio', chaineModeles, appeler, onEvent = () => {}, signal = null, accords = null } = {}) {
  objectif = String(objectif || '').trim();
  const wf = workflowId ? workflow(workflowId) : null;
  if (workflowId && !wf) throw new Error('Workflow introuvable.');
  if (!objectif && !wf) throw new Error('Il faut un objectif.');
  const appel = appeler || chatWithFallback;
  const modeles = chaineModeles?.length ? chaineModeles : (appeler ? [] : chaine('conversation'));
  const run = store.insert('autonome_runs', { id: uid('aut'), objectif: objectif || wf.objectif, workflowId: wf?.id || null, statut: 'en_cours', debut: new Date().toISOString(), etapes: [], texte: '' });
  const ctl = new AbortController();
  if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
  controleurs.set(run.id, ctl);
  const ev = e => { try { onEvent({ ...e, runId: run.id }); } catch {} };
  const maj = patch => store.update('autonome_runs', run.id, patch);
  const bilan = [];   // {titre, ok, resume, preuves}

  try {
    /* 1-2. COMPRENDRE + PLANIFIER */
    let plan;
    if (wf) {
      plan = { comprehension: wf.objectif || wf.nom, questions: [], criteres: [], etapes: wf.etapes };
      store.update('workflows', wf.id, { lancements: (wf.lancements || 0) + 1, maj: new Date().toISOString() });
    } else {
      ev({ type: 'phase', phase: 'comprendre', texte: 'Je réfléchis à ce que tu veux vraiment…' });
      plan = json(await penser(appel, modeles, SYS_PLAN, 'Objectif de la personne :\n' + objectif));
      if (!plan?.etapes?.length) plan = { comprehension: objectif, questions: [], criteres: [], etapes: [{ titre: 'Réaliser', consigne: objectif, attendu: 'Une réponse ou un fichier concret' }] };
    }
    plan.etapes = plan.etapes.slice(0, MAX_ETAPES);
    if (plan.questions?.length && !accords?.ignorerQuestions && !wf) {
      maj({ statut: 'question', plan, texte: plan.questions.join('\n') });
      ev({ type: 'question', questions: plan.questions });
      return { runId: run.id, statut: 'question', questions: plan.questions, plan };
    }
    maj({ plan });
    ev({ type: 'plan', comprehension: plan.comprehension, criteres: plan.criteres || [], etapes: plan.etapes });

    /* 3-5. EXÉCUTER, VÉRIFIER, CORRIGER, REPLANIFIER */
    let replans = 0;
    for (let i = 0; i < plan.etapes.length; i++) {
      if (ctl.signal.aborted) { maj({ statut: 'interrompu' }); return { runId: run.id, statut: 'interrompu', bilan }; }
      const et = plan.etapes[i];
      let consigne = et.consigne, valide = null, dernier = null;
      for (let essai = 1; essai <= MAX_ESSAIS; essai++) {
        ev({ type: 'etape', index: i, total: plan.etapes.length, titre: et.titre, essai });
        const contexte = bilan.length ? 'Étapes déjà faites :\n' + bilan.map(b => `- ${b.titre} : ${b.ok ? 'OK' : 'non réussie'} — ${b.resume.slice(0, 200)}`).join('\n') + '\n\n' : '';
        const r = await converser({
          message: `${contexte}Objectif global : ${plan.comprehension}\nÉtape ${i + 1}/${plan.etapes.length} — ${et.titre}\n${consigne}\nRésultat attendu : ${et.attendu || 'concret et vérifiable'}\nTermine avec un résumé court de ce que tu as réellement obtenu.`,
          historique: [], projet, atelier: true, sansAccord: !accords?.accorder, maxEtapes: 10,
          chaineModeles: modeles.length ? modeles : undefined, appeler, signal: ctl.signal
        }, e => ev({ ...e, etape: i }));
        if (r.attente) { maj({ statut: 'en_attente', attente: r.attente }); ev({ type: 'attente', attente: r.attente }); return { runId: run.id, statut: 'en_attente', attente: r.attente, bilan }; }
        dernier = r;
        ev({ type: 'verifier', index: i });
        const preuves = (r.preuves || []).slice(0, 12).map(p => `${p.ok ? '✔' : '✘'} ${p.outil || ''} ${String(p.resume || p.preuve?.resume || '').slice(0, 160)}`).join('\n') || '(aucune preuve d\'outil)';
        const j = json(await penser(appel, modeles, SYS_JUGE, `Étape : ${et.titre}\nConsigne : ${consigne}\nAttendu : ${et.attendu}\n\nProduit par l'agent :\n${String(r.texte || '').slice(0, 1500)}\n\nPreuves :\n${preuves}`, 500)) || { ok: Boolean(r.texte), raison: 'Relecture indisponible' };
        ev({ type: 'verdict', index: i, ok: Boolean(j.ok), raison: j.raison || '' });
        if (j.ok) { valide = true; break; }
        consigne = et.consigne + '\n\nTa tentative précédente n\'a pas convaincu : ' + (j.raison || '') + '\nÀ faire : ' + (j.correction || 'recommence plus précisément.');
      }
      bilan.push({ titre: et.titre, ok: Boolean(valide), resume: String(dernier?.texte || '').slice(0, 600), preuves: (dernier?.preuves || []).length });
      maj({ etapes: bilan });
      /* 5. replanifier une fois si l'étape échoue */
      if (!valide && replans < MAX_REPLANS && !wf) {
        replans++;
        ev({ type: 'phase', phase: 'replanifier', texte: 'Cette étape résiste : je revois le plan.' });
        const p2 = json(await penser(appel, modeles, SYS_PLAN, `Objectif :\n${plan.comprehension}\n\nDéjà fait :\n${bilan.map(b => `- ${b.titre} : ${b.ok ? 'OK' : 'ÉCHEC'} — ${b.resume.slice(0, 200)}`).join('\n')}\n\nPropose les étapes RESTANTES autrement (l'étape « ${et.titre} » a échoué deux fois).`));
        if (p2?.etapes?.length) { plan.etapes = [...plan.etapes.slice(0, i + 1), ...p2.etapes.slice(0, MAX_ETAPES - i - 1)]; ev({ type: 'plan', comprehension: plan.comprehension, criteres: plan.criteres || [], etapes: plan.etapes }); }
      }
    }

    /* 6. CONCLURE */
    ev({ type: 'phase', phase: 'conclure', texte: 'Je rassemble le résultat…' });
    const reussies = bilan.filter(b => b.ok).length;
    let texte;
    try {
      texte = await penser(appel, modeles, SYS_FIN, `Objectif : ${plan.comprehension}\nCritères : ${(plan.criteres || []).join(' ; ')}\n\nÉtapes :\n${bilan.map(b => `- ${b.titre} : ${b.ok ? 'réussie' : 'NON réussie'} — ${b.resume}`).join('\n')}`, 900);
    } catch { texte = ''; }
    if (!texte) texte = bilan.map(b => `${b.ok ? '✔' : '✘'} ${b.titre} : ${b.resume}`).join('\n');
    const statut = reussies === bilan.length ? 'termine' : reussies ? 'partiel' : 'echec';
    maj({ statut, fin: new Date().toISOString(), texte, etapes: bilan });
    try { archive.archiver({ genre: 'agent', titre: 'Agent autonome : ' + (plan.comprehension || objectif).slice(0, 80), texte, ok: statut === 'termine', meta: { outil: 'autonome' } }); } catch {}
    ev({ type: 'fin', statut, texte });
    return { runId: run.id, statut, texte, bilan, plan, peutEtreWorkflow: statut === 'termine' && !wf };
  } catch (e) {
    maj({ statut: 'echec', fin: new Date().toISOString(), texte: String(e.message).slice(0, 800) });
    throw e;
  } finally { controleurs.delete(run.id); }
}
