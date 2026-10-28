/** Extrait les blocs ```guide … ``` d'une réponse. Retourne le texte sans les blocs et les guides valides. */
export function extraireGuides(texte) {
  const guides = [];
  const propre = String(texte || '').replace(/```guide\s*([\s\S]*?)```/gi, (_, corps) => {
    try {
      const g = JSON.parse(corps.trim());
      const etapes = (Array.isArray(g.etapes) ? g.etapes : [])
        .map(e => ({ titre: String(e?.titre || '').trim(), detail: String(e?.detail || '').trim(), fait: false }))
        .filter(e => e.titre);
      if (etapes.length) guides.push({ titre: String(g.titre || 'Guide').trim(), etapes });
    } catch { /* bloc illisible : on ne l'affiche pas non plus */ }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { propre, guides };
}
/** Applique l'état coché (conservé côté serveur) à un guide fraîchement extrait. */
export function fusionnerEtat(guide, sauves = []) {
  const s = sauves.find(x => x.titre === guide.titre);
  if (!s) return guide;
  return { ...guide, etapes: guide.etapes.map((e, i) => ({ ...e, fait: Boolean(s.etapes[i] && s.etapes[i].titre === e.titre && s.etapes[i].fait) })) };
}
