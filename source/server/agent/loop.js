/**
 * CLIPIA — Boucle de l'agent développeur.
 *
 * Choix technique : l'agent n'utilise PAS le « tool calling » natif des API,
 * mais un bloc JSON que le modèle émet dans sa réponse. Conséquence directe :
 * la même boucle fonctionne avec les 37 moteurs, y compris les modèles locaux
 * (Ollama, LM Studio) qui n'ont pas tous d'appel d'outils.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chat } from '../providers/gateway.js';
import { OUTILS, catalogueOutils, creerProjet, AgentError } from './tools.js';
import { DATA_DIR, ROOT } from '../lib/env.js';
import { store } from '../lib/store.js';

export const SKILLS_DIR = path.join(DATA_DIR, 'skills');
fs.mkdirSync(SKILLS_DIR, { recursive: true });

// Premier lancement : on installe les skills fournies avec Clipia.
try {
  if (!fs.readdirSync(SKILLS_DIR).some(f => f.endsWith('.md'))) {
    const source = path.join(ROOT, 'skills-defaut');
    if (fs.existsSync(source))
      for (const f of fs.readdirSync(source).filter(x => x.endsWith('.md')))
        fs.copyFileSync(path.join(source, f), path.join(SKILLS_DIR, f));
  }
} catch {}

export function listerSkills() {
  return fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md')).map(f => {
    const t = fs.readFileSync(path.join(SKILLS_DIR, f), 'utf8');
    const titre = (t.match(/^#\s*(.+)$/m) || [, f.replace('.md', '')])[1];
    const desc = (t.match(/^>\s*(.+)$/m) || [, ''])[1];
    return { id: f.replace('.md', ''), titre, description: desc, octets: t.length };
  });
}
export const lireSkill = id => {
  const f = path.join(SKILLS_DIR, `${id.replace(/[^\w.\-]/g, '')}.md`);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
};
export function ecrireSkill(id, contenu) {
  const safe = id.replace(/[^\w.\-]/g, '-').slice(0, 60);
  fs.writeFileSync(path.join(SKILLS_DIR, `${safe}.md`), contenu);
  return safe;
}
export const supprimerSkill = id => {
  const f = path.join(SKILLS_DIR, `${id.replace(/[^\w.\-]/g, '')}.md`);
  if (fs.existsSync(f)) { fs.unlinkSync(f); return true; }
  return false;
};

const SYSTEME = (projet, skills) => `Tu es l'agent développeur de Clipia. Tu construis des sites web, des applications et des scripts, fichier par fichier, dans le projet « ${projet} ».

Tu disposes de ces outils :
${catalogueOutils()}

À CHAQUE réponse, tu écris d'abord une phrase courte en français expliquant ce que tu fais, puis UN SEUL bloc d'action au format exact suivant :

\`\`\`action
{"outil":"nom_de_l_outil","parametres":{...}}
\`\`\`

Règles :
- Un seul bloc action par réponse. Tu verras son résultat avant de continuer.
- Écris du code complet et fonctionnel, jamais de "TODO" ni de passage à compléter.
- Pour un site web : un index.html autonome, responsive, avec un vrai contenu, pas de texte bouche-trou.
- N'installe des dépendances que si c'est indispensable.
- Quand tout est fait et vérifié, appelle l'outil "terminer" avec un résumé.
- Tu travailles en français avec l'utilisateur ; le code et les noms de fichiers restent en anglais si c'est l'usage.
${skills ? `\n--- Consignes supplémentaires activées ---\n${skills}` : ''}`;

function extraireAction(texte) {
  const bloc = texte.match(/```action\s*([\s\S]*?)```/);
  const brut = bloc ? bloc[1] : (texte.match(/\{[\s\S]*"outil"[\s\S]*\}/) || [])[0];
  if (!brut) return null;
  try { return JSON.parse(brut.trim()); } catch { return null; }
}

/**
 * Lance l'agent. `onEvent` reçoit la progression en direct.
 * Retourne { etapes, resume, projet }.
 */
export async function lancerAgent({ projet, demande, provider, model, skills = [], maxEtapes = 24 }, onEvent = () => {}) {
  const nomProjet = creerProjet(projet || 'site');
  const consignes = skills.map(lireSkill).filter(Boolean).join('\n\n');
  const historique = [{ role: 'user', content: demande }];
  const etapes = [];
  let resume = '';

  for (let i = 0; i < maxEtapes; i++) {
    onEvent({ type: 'reflexion', etape: i + 1, total: maxEtapes });

    let r;
    try {
      r = await chat(provider, {
        model, system: SYSTEME(nomProjet, consignes), messages: historique,
        temperature: 0.3, maxTokens: 6000
      });
    } catch (e) {
      onEvent({ type: 'erreur', message: e.message });
      throw e;
    }

    const action = extraireAction(r.text);
    const commentaire = r.text.replace(/```action[\s\S]*?```/, '').trim();
    if (commentaire) onEvent({ type: 'message', texte: commentaire.slice(0, 600) });

    if (!action?.outil) {
      historique.push({ role: 'assistant', content: r.text });
      historique.push({ role: 'user', content: 'Réponds avec un bloc ```action contenant {"outil":…,"parametres":…}. Si la tâche est finie, utilise l\'outil "terminer".' });
      continue;
    }

    if (action.outil === 'terminer') {
      resume = action.parametres?.resume || commentaire || 'Terminé.';
      etapes.push({ outil: 'terminer', resultat: resume });
      onEvent({ type: 'fin', resume });
      break;
    }

    const outil = OUTILS[action.outil];
    let resultat;
    if (!outil) resultat = `Outil inconnu : ${action.outil}. Outils disponibles : ${Object.keys(OUTILS).join(', ')}`;
    else {
      onEvent({ type: 'outil', outil: action.outil, parametres: resume_params(action.parametres) });
      try { resultat = await outil.run(action.parametres || {}, { projet: nomProjet }); }
      catch (e) { resultat = `ERREUR : ${e.message}`; }
    }

    etapes.push({ outil: action.outil, parametres: action.parametres, resultat: String(resultat).slice(0, 600) });
    onEvent({ type: 'resultat', outil: action.outil, resultat: String(resultat).slice(0, 400) });

    historique.push({ role: 'assistant', content: r.text });
    historique.push({ role: 'user', content: `Résultat de ${action.outil} :\n${String(resultat).slice(0, 6000)}` });
  }

  if (!resume) resume = `Arrêt après ${etapes.length} étapes sans appel à « terminer ».`;
  store.insert('events', { type: 'agent.run', projet: nomProjet, etapes: etapes.length });
  return { projet: nomProjet, etapes, resume };
}

const resume_params = p => {
  if (!p) return '';
  if (p.chemin) return p.chemin;
  if (p.commande) return p.commande;
  return Object.keys(p).join(', ');
};
