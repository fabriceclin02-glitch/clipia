/**
 * CLIPIA — Mémoire persistante.
 * Ce que Clipia retient de vous d'une session à l'autre : vos projets,
 * vos préférences de travail, les faits que vous lui avez donnés.
 * Stockée en clair dans data/memoire.json — c'est votre machine.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../lib/env.js';
import { chat } from '../providers/gateway.js';

const FICHIER = path.join(DATA_DIR, 'memoire.json');

const VIDE = { faits: [], projets: [], preferences: [], majLe: null };

function lire() {
  if (!fs.existsSync(FICHIER)) return structuredClone(VIDE);
  try { return { ...VIDE, ...JSON.parse(fs.readFileSync(FICHIER, 'utf8')) }; }
  catch { return structuredClone(VIDE); }
}
function ecrire(m) {
  m.majLe = new Date().toISOString();
  const tmp = FICHIER + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  fs.renameSync(tmp, FICHIER);
  return m;
}

export const memoire = {
  tout: lire,

  ajouter(categorie, texte, source = 'manuel') {
    const m = lire();
    const cat = ['faits', 'projets', 'preferences'].includes(categorie) ? categorie : 'faits';
    const t = String(texte).trim().slice(0, 400);
    if (!t) return m;
    if (m[cat].some(x => x.texte.toLowerCase() === t.toLowerCase())) return m;
    m[cat].push({ id: 'm_' + Math.random().toString(36).slice(2, 10), texte: t, source, le: new Date().toISOString() });
    // On borne : la mémoire ne doit pas noyer le contexte.
    if (m[cat].length > 60) m[cat] = m[cat].slice(-60);
    return ecrire(m);
  },

  retirer(id) {
    const m = lire();
    for (const c of ['faits', 'projets', 'preferences']) m[c] = m[c].filter(x => x.id !== id);
    return ecrire(m);
  },

  vider(categorie) {
    const m = lire();
    if (categorie) m[categorie] = []; else Object.assign(m, structuredClone(VIDE));
    return ecrire(m);
  },

  /** Bloc à injecter dans l'amorce système. Vide si rien n'est connu. */
  contexte() {
    const m = lire();
    const bloc = [];
    if (m.preferences.length) bloc.push('Ses préférences de travail :\n' + m.preferences.map(x => '- ' + x.texte).join('\n'));
    if (m.projets.length) bloc.push('Ses projets en cours :\n' + m.projets.map(x => '- ' + x.texte).join('\n'));
    if (m.faits.length) bloc.push('Ce que vous savez de lui :\n' + m.faits.map(x => '- ' + x.texte).join('\n'));
    return bloc.length ? `\n\n--- MÉMOIRE ---\nVous connaissez déjà cette personne.\n${bloc.join('\n\n')}\n--- fin de la mémoire ---\n` : '';
  },

  /** Après un échange, un modèle extrait ce qui mérite d'être retenu. */
  async apprendre({ echange, provider, model }) {
    if (!provider || !echange?.length) return { ajoutes: 0 };
    const conv = echange.slice(-8)
      .map(m => `${m.role === 'user' ? 'Personne' : 'Clipia'} : ${String(m.content).slice(0, 700)}`)
      .join('\n');
    const connu = lire();
    const deja = [...connu.faits, ...connu.projets, ...connu.preferences].map(x => x.texte).join(' | ');

    const system = `Tu extrais ce qui mérite d'être retenu sur le long terme. Tu réponds UNIQUEMENT en JSON.`;
    const prompt = `Voici un échange avec un créateur (musique, vidéo, visuels, boutique).
Retiens seulement ce qui restera vrai dans un mois : ses projets, ses préférences de travail, des faits durables sur lui.
N'invente rien. Ignore le bavardage, les questions ponctuelles et ce qui est déjà connu.

Déjà connu : ${deja || '(rien)'}

Échange :
${conv}

Réponds exactement :
{"faits":["..."],"projets":["..."],"preferences":["..."]}
Mets des tableaux vides s'il n'y a rien de durable.`;

    try {
      const r = await chat(provider, { model, system, messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, maxTokens: 700 });
      const j = JSON.parse((r.text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      let n = 0;
      for (const cat of ['faits', 'projets', 'preferences'])
        for (const t of (j[cat] || []).slice(0, 5)) { this.ajouter(cat, t, 'appris'); n++; }
      return { ajoutes: n };
    } catch (e) { return { ajoutes: 0, erreur: e.message }; }
  }
};
