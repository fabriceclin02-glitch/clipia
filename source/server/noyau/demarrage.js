/**
 * CLIPIA — Opérationnelle au lancement.
 *
 * Le défaut à corriger : une application qui s'ouvre sur « aucun modèle
 * configuré » est morte, quel que soit le reste. Or Clipia a trois moteurs
 * utilisables sans compte ni clé, et quinze détectables sur la machine. Il n'y
 * avait aucune raison de demander quoi que ce soit avant de pouvoir parler.
 *
 * Ce module répond donc à une seule question, au démarrage : « avec quoi
 * peut-elle travailler, là, maintenant ? »
 *
 * Deux temps, parce qu'ils ne coûtent pas la même chose :
 *
 *   1. On sonde en parallèle qui répond. C'est presque gratuit (une requête
 *      sur /models) mais ça ne dit RIEN de la vitesse de génération : un
 *      fournisseur peut lister ses modèles en 80 ms et mettre huit secondes à
 *      écrire une phrase.
 *   2. On fait donc écrire une phrase minuscule aux survivants, et on mesure.
 *      C'est la seule façon honnête de dire « le plus rapide » — une liste de
 *      préférences écrite à la main vieillit en trois mois et mentait déjà.
 *
 * Le classement est ensuite rangé sur le disque : le deuxième démarrage est
 * instantané, et on ne re-mesure que sur demande ou quand la mesure est vieille.
 */
import { PROVIDERS, byId, byTier } from '../providers/registry.js';
import { credential, ping, chat, modelesConversation, taillePrevue } from '../providers/gateway.js';
import { store } from '../lib/store.js';
import { ffmpegBin, ffprobeBin, etatOutils } from '../lib/env.js';
import { spawnSync } from 'node:child_process';

const AGE_MAX_MS = 6 * 60 * 60 * 1000;   // au-delà, la mesure est refaite
const SONDE_MAX = 10;                     // fournisseurs mesurés au plus, pour ne pas inonder le réseau

/** Les modalités dont l'application a besoin, et ce qui compte comme « prêt ». */
export const BESOINS = {
  conversation: { nom: 'Parler et écrire',    modalites: ['texte'],                      vital: true },
  image:        { nom: 'Générer des images',  modalites: ['image'],                      vital: false },
  voix:         { nom: 'Parler à voix haute', modalites: ['voix', 'audio'],              vital: false },
  transcription:{ nom: 'Transcrire',          modalites: ['transcription'],              vital: false },
  musique:      { nom: 'Composer',            modalites: ['musique'],                    vital: false },
  vision:       { nom: 'Regarder des images', modalites: ['vision'],                     vital: false }
};

const aModalite = (p, mods) => (p.modalities || []).some(m => mods.includes(m));

/** Les candidats pour un besoin : gratuits d'abord, puis ceux dont la clé est là. */
function candidats(besoin) {
  const mods = BESOINS[besoin].modalites;
  return PROVIDERS
    .filter(p => aModalite(p, mods))
    .filter(p => p.base !== 'local' || p.tier !== 'local-gratuit')  // les binaires sont vus par etatOutils
    .filter(p => Boolean(credential(p)))
    .map(p => ({ p, rang: p.sansCle ? 0 : p.tier === 'local-gratuit' ? 1 : p.tier === 'cloud-gratuit' ? 2 : 3 }))
    .sort((a, b) => a.rang - b.rang)
    .map(x => x.p);
}

/**
 * Valeur estimée d'un cerveau pour discuter et raisonner en français. Ce n'est pas une mesure de vitesse :
 * c'est la taille/le niveau du modèle, avec une décote pour les moteurs « de dépannage » sans clé.
 */
export function scoreQualite(providerId, modele = '') {
  const m = String(modele);
  let sc = taillePrevue(m);
  if (/claude|gpt-5|gpt-4\.1|gpt-4o(?!-mini)|o3|o4|gemini-(2|3)|sonnet|opus|grok-[3-9]|mistral-large|deepseek-(v3|chat)|llama-?4|qwen3?-?max/i.test(m)) sc = Math.max(sc, 200);
  else if (/llama-3\.3-70b|gpt-oss-120b|qwen.*(32|72|235)b|llama-3\.1-(70|405)b|mixtral|gpt-4o-mini|gemini.*flash|deepseek-r1-distill-llama-70b/i.test(m)) sc = Math.max(sc, 70);
  if (/deepseek-r1|qwq|reason/i.test(m)) sc *= 0.5;
  if (/^(pollinations|github-models)$/.test(providerId)) sc *= 0.12;
  // Claude (payant) = renfort : Groq gratuit passe devant tant qu'il répond ; réglage « claude.prioritaire » pour l'inverser.
  if (providerId === 'anthropic' && !store.setting('claude.prioritaire')) sc = Math.min(sc, 60);
  if (sc < 2) sc *= 0.3;
  return sc;
}

/* ══ TEMPS 1 — qui répond ? ═══════════════════════════════════════════════ */
async function sonderVivants(liste) {
  const res = await Promise.all(liste.map(async p => {
    const t0 = Date.now();
    try {
      const r = await ping(p.id);
      return { id: p.id, label: p.label, tier: p.tier, vivant: r.ok !== false,
               modeles: r.models || [], pingMs: Date.now() - t0, pourquoi: r.error || '' };
    } catch (e) {
      return { id: p.id, label: p.label, tier: p.tier, vivant: false, modeles: [],
               pingMs: Date.now() - t0, pourquoi: String(e.message || e).slice(0, 120) };
    }
  }));
  return res;
}

/* ══ TEMPS 2 — lequel écrit le plus vite ? ════════════════════════════════ */

/**
 * Fait écrire trois caractères et mesure. On demande une réponse minuscule
 * pour que la mesure porte sur la latence et non sur la longueur générée.
 * Un fournisseur qui répond à côté n'est pas écarté : il est juste marqué,
 * car un modèle bavard reste utilisable, alors qu'un modèle muet ne l'est pas.
 */
async function mesurerVitesse(id, modele) {
  const t0 = Date.now();
  try {
    const r = await chat(id, {
      model: modele,
      messages: [{ role: 'user', content: 'Réponds exactement : OK' }],
      maxTokens: 8, temperature: 0, timeout: 20000
    });
    const txt = String(r.text || '').trim();
    if (!txt) return { ok: false, ms: Date.now() - t0, pourquoi: 'réponse vide' };
    return { ok: true, ms: Date.now() - t0, echo: txt.slice(0, 40),
             obeit: /^ok\b/i.test(txt) };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, pourquoi: String(e.message || e).slice(0, 160) };
  }
}

/** Le meilleur modèle de conversation d'une liste, ou undefined si aucune. */
const meilleurModele = (modeles = []) => modelesConversation(modeles)[0];

/* ══ LE BILAN ═════════════════════════════════════════════════════════════ */

/**
 * Évalue tout, et choisit. `mesurer: false` s'arrête au temps 1, ce qui est
 * utile au tout premier démarrage : on veut afficher l'application sans
 * attendre une douzaine de requêtes réseau.
 */
export async function evaluer({ mesurer = true } = {}) {
  const t0 = Date.now();
  const bilan = { quand: new Date().toISOString(), ms: 0, besoins: {}, outils: etatOutils?.() || null };

  /* Les moteurs locaux installés sur la machine, repérés par leur port. */
  const locaux = await Promise.all(byTier('local-gratuit')
    .filter(p => p.base !== 'local')
    .map(async p => {
      const r = await ping(p.id).catch(() => ({ ok: false }));
      return r.ok ? { id: p.id, label: p.label, modeles: r.models || [] } : null;
    }));
  bilan.locaux = locaux.filter(Boolean);

  /* Besoin par besoin. */
  for (const besoin of Object.keys(BESOINS)) {
    const liste = candidats(besoin);
    const vivants = (await sonderVivants(liste)).filter(v => v.vivant);

    let classement = vivants;

    // La vitesse ne se mesure que pour la conversation : c'est la seule
    // modalité où l'attente se voit à chaque phrase. Mesurer la génération
    // d'image coûterait une image à chaque démarrage.
    if (mesurer && besoin === 'conversation') {
      const aMesurer = vivants.slice(0, SONDE_MAX);
      const mesures = await Promise.all(aMesurer.map(async v => {
        // Les modèles annoncés par le sondage d'abord ; à défaut, ceux que le
        // registre déclare. modelesConversation écarte whisper, TTS et embeddings.
        const decl = byId(v.id)?.models || [];
        const modele = meilleurModele(v.modeles) || meilleurModele(decl) || decl[0];
        if (!modele) return { ...v, mesure: { ok: false, pourquoi: 'aucun modèle de conversation' } };
        return { ...v, modele, mesure: await mesurerVitesse(v.id, modele) };
      }));
      // Qui répond vraiment d'abord ; puis le plus INTELLIGENT (la vitesse ne départage que des modèles de niveau voisin) ;
      // puis le plus rapide. Avant : le plus rapide gagnait, donc un petit modèle ou un moteur de dépannage répondait
      // n'importe quoi alors qu'un bon cerveau (Groq 70B, Qwen 7B local, Claude…) était disponible.
      for (const v of mesures) v.score = scoreQualite(v.id, v.modele);
      const palier = (v) => Math.round(Math.log2(Math.max(0.5, v.score)) * 1.2) - (v.mesure.ok && v.mesure.ms > 15000 ? 1 : 0);
      classement = mesures.sort((a, b) => {
        if (a.mesure.ok !== b.mesure.ok) return a.mesure.ok ? -1 : 1;
        if (a.mesure.ok) return palier(b) - palier(a) || a.mesure.ms - b.mesure.ms;
        return a.pingMs - b.pingMs;
      });
    }

    const retenu = classement.find(v => !v.mesure || v.mesure.ok) || classement[0] || null;
    bilan.besoins[besoin] = {
      nom: BESOINS[besoin].nom,
      vital: BESOINS[besoin].vital,
      pret: Boolean(retenu),
      choisi: retenu ? { provider: retenu.id, label: retenu.label,
                         modele: retenu.modele || meilleurModele(retenu.modeles)
                                 || meilleurModele(byId(retenu.id)?.models || []) || null,
                         ms: retenu.mesure?.ms ?? retenu.pingMs,
                         mesure: Boolean(retenu.mesure?.ok) } : null,
      candidats: classement.slice(0, 10).map(v => ({
        provider: v.id, label: v.label, tier: v.tier, modele: v.modele || undefined, score: v.score,
        ms: v.mesure?.ms ?? v.pingMs,
        ok: v.mesure ? v.mesure.ok : true,
        pourquoi: v.mesure?.pourquoi || v.pourquoi || ''
      })),
      essayes: liste.length
    };
  }

  /* Le montage : ce n'est pas un fournisseur, c'est un binaire. */
  bilan.montage = (() => {
    const essai = (bin) => { try { return spawnSync(bin, ['-version'], { timeout: 5000 }).status === 0; } catch { return false; } };
    const ff = essai(ffmpegBin()), fp = essai(ffprobeBin());
    return { pret: ff, ffmpeg: ff, ffprobe: fp,
             quoi: ff ? 'Montage et analyse audio disponibles'
                            : 'FFmpeg manque : les clips et la détection de tempo ne marcheront pas' };
  })();

  bilan.ms = Date.now() - t0;
  bilan.pret = bilan.besoins.conversation.pret;
  bilan.resume = resumer(bilan);
  store.setting('demarrage', bilan);
  return bilan;
}

function resumer(b) {
  const prets = Object.values(b.besoins).filter(x => x.pret).map(x => x.nom);
  const manquants = Object.values(b.besoins).filter(x => !x.pret).map(x => x.nom);
  if (!b.pret) return 'Aucun moteur de conversation ne répond. Même les moteurs sans clé sont injoignables : vérifiez la connexion, ou installez Ollama.';
  const c = b.besoins.conversation.choisi;
  const vitesse = c.mesure ? `${c.ms} ms mesurés` : `${c.ms} ms au sondage`;
  return `Prête. ${c.label} répond en ${vitesse}` +
         (c.modele ? ` (${c.modele})` : '') + '. ' +
         `Disponible : ${prets.join(', ')}.` +
         (manquants.length ? ` Pas encore : ${manquants.join(', ')}.` : '') +
         (c.modele && taillePrevue(c.modele) < 2 ? ' ⚠ Ce modèle est minuscule : il répond de façon répétitive et raisonne peu. Installe-en un plus gros (Centre des IA : qwen2.5:7b, llama3.1:8b…) ou ajoute une clé gratuite (Groq, OpenRouter).' : '') +
         (b.montage.pret ? '' : ' ' + b.montage.quoi + '.');
}

/* ══ CE QUE LE RESTE DE L'APPLICATION APPELLE ═════════════════════════════ */

/** Le dernier bilan, sans rien re-sonder. */
export const dernierBilan = () => store.setting('demarrage') || null;

/** Le bilan, re-mesuré s'il est trop vieux ou absent. */
export async function bilanFrais({ force = false } = {}) {
  const b = dernierBilan();
  if (!force && b && Date.now() - new Date(b.quand).getTime() < AGE_MAX_MS) return b;
  return evaluer({ mesurer: true });
}

/**
 * Le fournisseur à utiliser pour un besoin. C'est l'unique point d'entrée du
 * reste du code : plus personne ne devine un nom de modèle en dur.
 */
export function pour(besoin) {
  const b = dernierBilan();
  const c = b?.besoins?.[besoin]?.choisi;
  return c ? { provider: c.provider, model: c.modele || undefined } : null;
}

/* Moteurs qui viennent d'échouer : on les met de côté un moment plutôt que de leur reposer la question à chaque phrase. */
const froids = new Map();
export function signalerEchec(provider, e) {
  const msg = String(e?.message || e);
  const long = /\b(401|403|428)\b|clé|key|invalid|unauthor/i.test(msg) ? 30 * 60e3 : /\b429\b|rate|quota/i.test(msg) ? 90e3 : 45e3;
  froids.set(provider, Date.now() + long);
}
export const signalerSucces = (provider) => froids.delete(provider);
/** Le cerveau qui a réellement répondu reste le cerveau par défaut tant qu'il répond (même après redémarrage). */
export const prefere = () => store.setting('cerveau.prefere') || null;
export const retenirPrefere = (provider, model) => { if (provider) store.setting('cerveau.prefere', { provider, model: model || undefined }); };
const actif = (provider) => (froids.get(provider) || 0) < Date.now();

/** La chaîne de secours : les meilleurs cerveaux d'abord, chacun avec SON modèle, ceux qui viennent d'échouer en dernier. */
export function chaine(besoin) {
  const b = dernierBilan();
  const l = b?.besoins?.[besoin];
  if (!l) return [];
  const out = [];
  const pref = prefere();
  const ajouter = (provider, model) => { if (provider && !out.some(x => x.provider === provider)) out.push({ provider, model: model || byId(provider)?.models?.[0] || undefined }); };
  if (pref && byId(pref.provider)) ajouter(pref.provider, pref.model);
  if (l.choisi) ajouter(l.choisi.provider, l.choisi.modele);
  for (const c of l.candidats || []) if (c.ok) ajouter(c.provider, c.modele);
  const bons = out.filter(x => actif(x.provider));
  return bons.length ? [...bons, ...out.filter(x => !actif(x.provider))] : out;
}

/**
 * LA décision « quel cerveau répond ? », à chaque message : on prend le meilleur disponible, on bascule sur le suivant
 * s'il échoue ou répond vide, et si plus rien ne répond on ré-évalue la situation avant d'abandonner.
 * Ne lève jamais d'erreur technique : le message final dit quoi faire, sans code.
 */
export async function appelerMeilleur(besoin, opts) {
  const essayes = [];
  for (let tour = 0; tour < 2; tour++) {
    const ch = chaine(besoin);
    for (const step of ch) {
      if (tour === 1 && essayes.includes(step.provider + '|' + step.model)) continue;
      essayes.push(step.provider + '|' + step.model);
      try {
        const r = await chat(step.provider, { ...opts, model: step.model });
        if (!String(r.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()) throw new Error('réponse vide');
        signalerSucces(step.provider);
        if (essayes.length > 1 || prefere()?.provider !== step.provider) retenirPrefere(step.provider, step.model);
        return r;
      } catch (e) { signalerEchec(step.provider, e); }
    }
    if (tour === 0) { froids.clear(); try { await evaluer({ mesurer: false }); } catch {} }
  }
  // Dernier recours : tout ce qui peut répondre, sans tenir compte des pauses, en finissant par les moteurs sans clé.
  const reste = [];
  for (const p of PROVIDERS) {
    if (!/texte/.test((p.modalities || []).join(',')) && p.kind === 'audio') continue;
    if (p.tier === 'local-gratuit' || p.sansCle || credential(p)) for (const m of (p.models || []).slice(0, 3)) reste.push({ provider: p.id, model: m });
  }
  reste.sort((a, b) => (/^pollinations$/.test(a.provider) ? 1 : 0) - (/^pollinations$/.test(b.provider) ? 1 : 0));
  for (const step of reste) {
    if (essayes.includes(step.provider + '|' + step.model)) continue;
    try {
      const r = await chat(step.provider, { ...opts, model: step.model });
      if (String(r.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()) { signalerSucces(step.provider); retenirPrefere(step.provider, step.model); return r; }
    } catch (e) { signalerEchec(step.provider, e); }
  }
  const err = new Error("Je n'arrive à joindre aucun cerveau pour l'instant. Ouvre « Cerveau pas à pas » dans le menu : en deux minutes je te branche Groq (gratuit) ou Qwen en local, et je réponds ensuite toute seule.");
  err.cerveauIndisponible = true; throw err;
}

/**
 * Au démarrage du serveur. On ne bloque pas : le premier temps suffit à
 * rendre l'application utilisable, le second affine en arrière-plan.
 */
export function amorcer() {
  evaluer({ mesurer: false })
    .then(b => {
      console.log(`  Moteurs : ${b.pret ? b.besoins.conversation.choisi.label + ' prêt' : 'aucun ne répond'}` +
                  (b.locaux.length ? ` · ${b.locaux.length} moteur(s) local(aux)` : ''));
      return evaluer({ mesurer: true });
    })
    .then(b => { if (b.pret) console.log(`  Le plus rapide : ${b.besoins.conversation.choisi.label} — ${b.besoins.conversation.choisi.ms} ms`); })
    .catch(e => console.log('  Évaluation des moteurs impossible : ' + e.message));
}
