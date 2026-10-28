/**
 * CLIPIA — Les sept rôles, et le refus de faire semblant.
 *
 * La charte demande de répartir le travail entre un Stratège, un Chercheur,
 * un Développeur, un Auditeur, un Innovateur, un Analyste et un Coordinateur.
 * Elle ajoute une phrase qui décide de toute l’architecture de ce fichier :
 *
 *   « Si les outils ne sont pas disponibles, indique-le au lieu de simuler
 *     leur fonctionnement. »
 *
 * Donc avant d’appeler un rôle, on vérifie qu’un modèle répond vraiment. S’il
 * n’y en a pas, la fonction s’arrête et le dit. Elle ne fabrique pas un avis
 * de Stratège plausible : un conseil inventé serait pire qu’une absence de
 * conseil, parce qu’il serait suivi.
 *
 * Un rôle n’est pas un modèle différent — ce serait du théâtre. C’est une
 * consigne différente, un angle d’attaque différent, et surtout une sortie
 * attendue différente. L’Auditeur cherche ce qui va casser ; l’Innovateur
 * propose ce que personne n’a demandé. Les faire travailler en série sur le
 * même sujet produit des désaccords, et les désaccords sont le signal utile.
 */
import { PROVIDERS, byId, baseUrl } from '../providers/registry.js';
import { credential, chat } from '../providers/gateway.js';
import { amorce, ROLES, GARDE_FOUS } from './charte.js';
import { journal } from './journal.js';
import * as graphe from './graphe.js';

/** Consignes propres à chaque rôle : ce qu’il cherche, et comment il répond. */
const CONSIGNES = {
  strategie: `Tu tranches. Pour le sujet donné, produis :
— l’ordre dans lequel attaquer, et pourquoi cet ordre ;
— ce qu’il faut ABANDONNER, explicitement, et ce que ça coûte de l’abandonner ;
— la seule chose à faire en premier si on n’avait du temps que pour une.
Sois bref et décidé. Un stratège qui refuse de hiérarchiser ne sert à rien.`,

  recherche: `Tu vérifies. Pour le sujet donné :
— sépare ce qui est établi de ce qui est supposé, affirmation par affirmation ;
— nomme ce qu’il faudrait mesurer ou lire pour lever chaque doute ;
— signale toute affirmation du sujet qui te paraît fausse ou non étayée.
Si tu n’as pas de source, dis « pas de source » au lieu d’en inventer une.
Ne fabrique jamais d’adresse web : une URL inventée est le pire des mensonges, parce qu’elle a l’air vérifiable.`,

  developpeur: `Tu construis. Pour le sujet donné :
— le chemin technique le plus court qui marche vraiment ;
— les fichiers ou modules à écrire ou modifier, nommés ;
— ce qui va coincer en pratique, pas en théorie ;
— le test qui prouvera que ça marche, et la preuve qu’il produira.
Pas de pseudo-code décoratif. Ce qui compte est ce qui tourne.`,

  auditeur: `Tu cherches ce qui va casser. Pour le sujet donné :
— les hypothèses implicites que personne n’a vérifiées ;
— les cas limites et les pannes silencieuses — celles qui ne lèvent pas d’erreur ;
— les risques de sécurité, de perte de données, de dépendance à un service ;
— ce qui se passe quand le réseau tombe, quand le fichier manque, quand le quota est atteint.
Ton rôle n’est pas de rassurer. Si tu ne trouves rien, c’est que tu n’as pas assez cherché.`,

  innovateur: `Tu proposes ce que personne n’a demandé. Pour le sujet donné :
— deux ou trois angles que l’énoncé n’envisage pas ;
— ce qui deviendrait possible si on retirait une contrainte, et laquelle ;
— un rapprochement avec un autre domaine qui éclairerait le problème.
Sois concret : une idée qu’on ne peut pas commencer demain n’est pas une idée.`,

  analyste: `Tu mets des chiffres là où il y a des adjectifs. Pour le sujet donné :
— les ordres de grandeur : temps, coût, volume, nombre d’utilisateurs ;
— ce qui est mesurable tout de suite et avec quel instrument ;
— les indicateurs qui diraient si ça marche, avec leur seuil.
Marque chaque chiffre : [vérifié] s’il est mesuré, [probable] s’il vient d’une source, [hypothèse] si tu l’estimes.
N’annonce jamais une rentabilité sans élément solide : dis « je ne sais pas encore, voilà comment le savoir ».`,

  coordinateur: `Tu rassembles et tu tranches. On te donne les avis des autres rôles.
— dis où ils s’accordent, et où ils se CONTREDISENT — les contradictions sont l’information utile ;
— tranche les désaccords, en disant sur quel critère tu tranches ;
— produis la décision et la prochaine action concrète, une seule.
Ne lisse pas les désaccords : un consensus fabriqué cache le vrai problème.`
};

/** Ordre de travail par défaut : comprendre, puis construire, puis douter. */
export const SEQUENCE = ['recherche', 'strategie', 'developpeur', 'auditeur', 'analyste'];

/**
 * Trouve un modèle qui répond VRAIMENT. On ne se contente pas d’une clé
 * présente : une clé n’est pas une réponse.
 */
export async function modeleDisponible({ prefereLocal = true } = {}) {
  const essayer = async (p, modele) => {
    try {
      const r = await chat(p.id, { model: modele, max_tokens: 8, temperature: 0,
        messages: [{ role: 'user', content: 'Réponds : ok' }], timeout: 20000 });
      return r.text?.trim() ? { id: p.id, label: p.label, modele, local: p.tier === 'local-gratuit' } : null;
    } catch { return null; }
  };

  const groupes = prefereLocal
    ? [PROVIDERS.filter(p => p.tier === 'local-gratuit' && p.kind === 'openai' && p.base !== 'local'),
       PROVIDERS.filter(p => p.tier === 'sans-cle' && p.kind === 'openai'),
       PROVIDERS.filter(p => p.tier === 'cloud-gratuit' && p.kind === 'openai' && credential(p)),
       PROVIDERS.filter(p => p.tier === 'cloud-payant' && p.kind === 'openai' && credential(p))]
    : [PROVIDERS.filter(p => p.kind === 'openai' && credential(p))];

  for (const groupe of groupes) {
    for (const p of groupe) {
      // Pour un serveur local, on demande d’abord quel modèle il sert.
      let modele = p.models?.[0];
      if (p.tier === 'local-gratuit') {
        try {
          const r = await fetch(`${baseUrl(p)}/models`, { signal: AbortSignal.timeout(2500) });
          if (!r.ok) continue;
          const j = await r.json();
          modele = j.data?.[0]?.id;
          if (!modele) continue;
        } catch { continue; }
      }
      const ok = await essayer(p, modele);
      if (ok) return ok;
    }
  }

  // Ollama parle une autre langue : on l’essaie séparément.
  try {
    const o = byId('ollama');
    const r = await fetch(`${baseUrl(o)}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const j = await r.json();
      const m = (j.models || [])[0]?.name;
      if (m) {
        const ok = await essayer(o, m);
        if (ok) return ok;
      }
    }
  } catch { /* rien */ }

  return null;
}

/**
 * Fait travailler un rôle. Si aucun modèle ne répond, lève une erreur
 * explicite — on ne rend pas d’avis fabriqué.
 */
export async function consulter({ role, sujet, contexte = '', capacites = {}, voie = null, etat = '' }) {
  if (!CONSIGNES[role]) throw new Error(`Rôle inconnu : ${role}. Disponibles : ${Object.keys(CONSIGNES).join(', ')}.`);

  const v = voie || await modeleDisponible();
  if (!v) throw new Error(
    'Aucun modèle ne répond, donc aucun rôle ne peut travailler. La charte interdit de simuler : ' +
    'je ne vais pas fabriquer un avis de ' + ROLES[role].nom + '. ' +
    'Pour débloquer : télécharger un modèle local depuis « Modèles locaux » (400 Mo suffisent, et rien ne sortira de la machine), ' +
    'ou créer une clé gratuite — GitHub Models est le plus généreux.');

  const liens = graphe.contexteAssociatif(sujet + ' ' + contexte, { limite: 6 });
  const sys = amorce({ role, capacites, contexteMemoire: journal.contexte(), graphe: liens, etat });

  const r = await chat(v.id, {
    model: v.modele, temperature: role === 'innovateur' ? 0.85 : role === 'auditeur' ? 0.3 : 0.5,
    max_tokens: 1400,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: `${CONSIGNES[role]}\n\nSUJET\n${sujet}${contexte ? `\n\nCONTEXTE\n${contexte}` : ''}` }
    ]
  });

  const texte = String(r.text || '').trim();
  if (!texte) throw new Error(`${ROLES[role].nom} n’a rien renvoyé. Modèle trop petit, ou requête tronquée.`);

  return {
    role, nom: ROLES[role].nom, texte,
    par: `${v.label} · ${v.modele}`, local: v.local, ms: r.ms,
    marques: compterMarques(texte)
  };
}

/** Compte les marques de confiance : un avis sans aucune marque est suspect. */
function compterMarques(t) {
  const n = (re) => (t.match(re) || []).length;
  return {
    verifie: n(/\[vérifié\]/gi), probable: n(/\[probable\]/gi), hypothese: n(/\[hypothèse\]/gi),
    sansSource: /pas de source|aucune source|je ne sais pas/i.test(t)
  };
}

/**
 * Le conseil : plusieurs rôles sur le même sujet, puis le Coordinateur qui
 * tranche les désaccords. C’est la partie qui vaut le détour — un seul avis
 * se contente de lui-même, trois avis se contredisent, et la contradiction
 * est ce qui apprend quelque chose.
 */
export async function conseil({ sujet, roles = SEQUENCE, capacites = {}, etat = '', surAvancement = null }) {
  const v = await modeleDisponible();
  if (!v) throw new Error(
    'Aucun modèle ne répond : le conseil ne peut pas se tenir. Je ne vais pas inventer les avis de sept rôles. ' +
    'Télécharger un modèle local depuis « Modèles locaux », ou créer une clé gratuite, débloque tout.');

  const avis = [];
  const echecs = [];
  for (const role of roles) {
    surAvancement?.({ etape: role, sur: roles.length + 1, fait: avis.length });
    try {
      const a = await consulter({ role, sujet, capacites, voie: v, etat,
        contexte: avis.length ? `Avis déjà rendus :\n\n${avis.map(x => `### ${x.nom}\n${x.texte.slice(0, 900)}`).join('\n\n')}` : '' });
      avis.push(a);
    } catch (e) { echecs.push({ role, nom: ROLES[role]?.nom || role, pourquoi: e.message.slice(0, 220) }); }
  }

  if (!avis.length) throw new Error(`Aucun rôle n’a pu travailler. ${echecs[0]?.pourquoi || ''}`);

  let synthese = null;
  surAvancement?.({ etape: 'coordinateur', sur: roles.length + 1, fait: avis.length });
  try {
    synthese = await consulter({
      role: 'coordinateur', sujet, capacites, voie: v, etat,
      contexte: avis.map(a => `### ${a.nom}\n${a.texte}`).join('\n\n')
    });
  } catch (e) { echecs.push({ role: 'coordinateur', nom: 'Coordinateur', pourquoi: e.message.slice(0, 220) }); }

  // On alimente le graphe : le sujet et les rôles qui l’ont traité se lient.
  try {
    graphe.ajouter({ type: 'concept', titre: sujet.slice(0, 140), texte: synthese?.texte?.slice(0, 600) || '',
      confiance: 'hypothese', source: 'conseil' });
    graphe.coActiver([sujet.slice(0, 140), ...avis.map(a => a.nom)], 'conseil sur ' + sujet.slice(0, 60));
  } catch { /* bonus */ }

  return {
    sujet, avis, synthese, echecs,
    par: `${v.label} · ${v.modele}`, local: v.local,
    honnetete: echecs.length
      ? `${echecs.length} rôle(s) n’ont pas pu travailler, et c’est dit plutôt que comblé : ${echecs.map(e => e.nom).join(', ')}.`
      : `Les ${avis.length} rôles ont travaillé${synthese ? ', et le Coordinateur a tranché' : ''}.`,
    rappel: v.local
      ? 'Tout s’est passé sur cette machine : aucun texte n’est sorti.'
      : 'Ces avis viennent d’un service distant. Pour que rien ne sorte de la machine, il suffit d’un modèle local.'
  };
}

export const GARDE_FOUS_ACTIFS = GARDE_FOUS;
export { CONSIGNES };
