/**
 * CLIPIA — Tester pour de vrai chaque voie gratuite.
 *
 * Je ne peux pas vérifier ces fournisseurs depuis mon propre environnement :
 * le réseau y est restreint aux dépôts de paquets. Donc plutôt que de te
 * promettre que tout marche, Clipia le vérifie sur TA machine, en envoyant
 * une vraie requête à chacun et en te montrant le résultat brut.
 *
 * Un fournisseur n’est déclaré utilisable que s’il a renvoyé du texte.
 */
import { PROVIDERS, byId, baseUrl } from './registry.js';
import { credential } from './gateway.js';

const DELAI = 12000;

/** Une question dont la réponse est vérifiable : on sait si le modèle a compris. */
const SONDE = 'Réponds uniquement par le mot : opérationnel';

async function essaiOpenAI(p, cle, modele) {
  const r = await fetch(`${baseUrl(p)}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cle && cle !== 'libre' && cle !== 'local' ? { authorization: `Bearer ${cle}` } : {})
    },
    body: JSON.stringify({
      model: modele, max_tokens: 24, temperature: 0,
      messages: [{ role: 'user', content: SONDE }]
    }),
    signal: AbortSignal.timeout(DELAI)
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${t.slice(0, 160)}`);
  let j; try { j = JSON.parse(t); } catch { throw new Error(`Réponse illisible : ${t.slice(0, 120)}`); }
  const sortie = j.choices?.[0]?.message?.content ?? '';
  if (!sortie.trim()) throw new Error('Réponse vide.');
  return sortie.trim();
}

async function essaiPollinationsTexte(p, modele) {
  // Pollinations accepte aussi une simple requête GET, plus tolérante.
  const r = await fetch(`${baseUrl(p)}/${encodeURIComponent(SONDE)}?model=${modele}`,
    { signal: AbortSignal.timeout(DELAI) });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${t.slice(0, 160)}`);
  if (!t.trim()) throw new Error('Réponse vide.');
  return t.trim();
}

async function essaiOllama(p, modele) {
  const r = await fetch(`${baseUrl(p)}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Serveur joignable mais HTTP ${r.status}.`);
  const j = await r.json();
  const dispo = (j.models || []).map(m => m.name);
  if (!dispo.length) throw new Error('Serveur en marche, mais aucun modèle téléchargé. C’est la cause habituelle du « rien ne fonctionne ».');
  const m = dispo.find(x => x.startsWith(modele)) || dispo[0];
  const g = await fetch(`${baseUrl(p)}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model: m, prompt: SONDE, stream: false, options: { num_predict: 24 } }),
    signal: AbortSignal.timeout(45000)
  });
  const jj = await g.json();
  if (!jj.response?.trim()) throw new Error('Modèle chargé mais réponse vide.');
  return `${jj.response.trim()}  [modèle : ${m}]`;
}

/** Teste un seul fournisseur. Ne lève jamais : renvoie toujours un verdict. */
export async function tester(id) {
  const p = byId(id);
  if (!p) return { id, etat: 'inconnu', detail: 'Fournisseur absent du registre.' };

  const debut = Date.now();
  const base = { id, label: p.label, tier: p.tier, docs: p.docs || null };

  try {
    const cle = credential(p);

    if (p.tier === 'cloud-gratuit' && !cle)
      return { ...base, etat: 'cle-manquante',
        detail: `Gratuit, mais il faut une clé. À créer ici : ${p.docs}`,
        action: 'coffre' };

    if (p.besoinCompte && !String(baseUrl(p)).match(/^https?:\/\/[^{]*$/))
      return { ...base, etat: 'config-incomplete',
        detail: 'Il manque l’identifiant de compte dans l’adresse du service.', action: 'coffre' };

    let sortie;
    if (p.id === 'pollinations')        sortie = await essaiPollinationsTexte(p, p.models[0]);
    else if (p.kind === 'ollama' || p.id === 'ollama') sortie = await essaiOllama(p, 'qwen2.5:0.5b');
    else if (p.tier === 'local-gratuit') sortie = await essaiOpenAI(p, 'local', p.models[0] === 'auto' ? 'local-model' : p.models[0]);
    else                                 sortie = await essaiOpenAI(p, cle, p.models[0]);

    const ms = Date.now() - debut;
    const comprend = /op[eé]rationnel/i.test(sortie);
    return { ...base, etat: 'ok', ms, sortie: sortie.slice(0, 220), comprend,
      detail: comprend
        ? `Répond en ${ms} ms et a compris la consigne.`
        : `Répond en ${ms} ms, mais à côté de la consigne — le service marche, le modèle est faible.` };

  } catch (e) {
    // fetch() de Node masque la cause réelle derrière « fetch failed ».
    // Sans la déplier, l’utilisateur ne sait pas s’il manque le réseau,
    // si le port est fermé, ou si le certificat est refusé.
    const cause = e.cause ? `${e.cause.code || ''} ${e.cause.message || ''}`.trim() : '';
    const m = [String(e.message || e), cause].filter(Boolean).join(' — ');
    const ms = Date.now() - debut;
    let etat = 'echec', detail = m, action = null;

    if (/abort|timeout|timed out/i.test(m))        { etat = 'injoignable'; detail = `Aucune réponse en ${Math.round(ms / 1000)} s. Service indisponible, ou réseau bloqué.`; }
    else if (/ENOTFOUND|EAI_AGAIN|dns/i.test(m))   { etat = 'injoignable'; detail = 'Nom de domaine introuvable : pas d’accès Internet, ou service fermé.'; }
    else if (/ECONNREFUSED/i.test(m))              { etat = 'eteint';      detail = p.tier === 'local-gratuit'
      ? `Rien n’écoute sur ${baseUrl(p)}. Lance ${p.label} d’abord — ou laisse Clipia l’installer depuis l’onglet Modèles locaux.`
      : 'Rien n’écoute sur ce port.'; }
    else if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(m)) { etat = 'reseau'; detail = 'Certificat refusé : un pare-feu ou un antivirus inspecte la connexion.'; }
    else if (/ENETUNREACH|EHOSTUNREACH|ECONNRESET|EPROTO|fetch failed/i.test(m)) { etat = 'reseau';
      detail = 'Connexion impossible. Soit pas d’accès Internet, soit un pare-feu bloque la sortie vers ce service.'; }
    else if (/HTTP 401|HTTP 403/i.test(m))         { etat = 'cle-refusee'; detail = `Clé refusée. À vérifier ou recréer : ${p.docs}`; }
    else if (/HTTP 429/i.test(m))                  { etat = 'quota';       detail = 'Quota gratuit atteint. Il se renouvelle, en général chaque jour.'; }
    else if (/HTTP 404/i.test(m))                  { etat = 'modele';      detail = `Le modèle « ${p.models[0]} » n’existe plus sous ce nom chez ce fournisseur.`; }
    else if (/aucun modèle téléchargé/i.test(m))   { etat = 'sans-modele'; detail = m; action = 'installer'; }

    return { ...base, etat, detail, ms, ...(action ? { action } : {}) };
  }
}

/** Teste toutes les voies gratuites, en parallèle mais par vagues. */
export async function testerTout({ inclureLocal = true } = {}) {
  const cibles = PROVIDERS.filter(p =>
    (p.tier === 'sans-cle' || p.tier === 'cloud-gratuit' ||
     (inclureLocal && p.tier === 'local-gratuit' && p.base !== 'local')) &&
    p.kind !== 'stt' && p.kind !== 'image' && p.kind !== 'audio');

  const resultats = [];
  for (let i = 0; i < cibles.length; i += 4) {
    resultats.push(...await Promise.all(cibles.slice(i, i + 4).map(p => tester(p.id))));
  }

  const ok = resultats.filter(r => r.etat === 'ok');
  const sansCle = ok.filter(r => r.tier === 'sans-cle');
  const aConfigurer = resultats.filter(r => r.etat === 'cle-manquante');

  return {
    resultats: resultats.sort((a, b) =>
      (a.etat === 'ok' ? 0 : 1) - (b.etat === 'ok' ? 0 : 1) || (a.ms || 9e9) - (b.ms || 9e9)),
    bilan: {
      testes: resultats.length, operationnels: ok.length,
      sansAucuneCle: sansCle.length, aConfigurer: aConfigurer.length,
      leMoinsLent: ok.length ? ok.sort((a, b) => a.ms - b.ms)[0].label : null
    },
    verdict: ok.length
      ? `${ok.length} fournisseur(s) répondent vraiment${sansCle.length ? `, dont ${sansCle.length} sans aucune clé` : ''}. ${aConfigurer.length ? `${aConfigurer.length} autre(s) sont gratuits mais attendent une clé.` : ''}`
      : aConfigurer.length
      ? `Aucun ne répond pour l’instant, mais ${aConfigurer.length} sont gratuits et n’attendent qu’une clé. Le plus généreux est GitHub Models : un jeton GitHub suffit.`
      : 'Aucun fournisseur ne répond. Vérifie la connexion Internet — et dans tous les cas, un modèle local téléchargé fonctionne sans réseau.',
    conseil: ok.some(r => r.tier === 'sans-cle')
      ? 'Tu peux utiliser Clipia immédiatement, sans créer le moindre compte.'
      : 'Pour un usage sans compte du tout, télécharge un modèle local : 400 Mo suffisent pour commencer, et plus rien ne dépend d’Internet.'
  };
}
