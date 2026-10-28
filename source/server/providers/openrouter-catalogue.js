/**
 * CLIPIA — Catalogue OpenRouter dynamique (public, sans clé).
 * Marque les modèles gratuits (tarif 0 ou suffixe :free). `chercher` est injectable pour les tests.
 */
let cache = null;
export async function catalogue({ chercher = fetch, force = false } = {}) {
  if (cache && !force && Date.now() - cache.t < 6 * 3600e3) return cache.v;
  const r = await chercher('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('OpenRouter a répondu HTTP ' + r.status);
  const j = await r.json();
  const modeles = (j.data || []).map(m => {
    const p = m.pricing || {};
    const gratuit = m.id.endsWith(':free') || (Number(p.prompt) === 0 && Number(p.completion) === 0);
    return { id: m.id, nom: m.name || m.id, contexte: m.context_length || null, gratuit,
      vision: (m.architecture?.input_modalities || []).includes('image') };
  }).sort((a, b) => Number(b.gratuit) - Number(a.gratuit) || a.id.localeCompare(b.id));
  const v = { total: modeles.length, gratuits: modeles.filter(m => m.gratuit).length, modeles, cle_requise: true };
  cache = { t: Date.now(), v };
  return v;
}
