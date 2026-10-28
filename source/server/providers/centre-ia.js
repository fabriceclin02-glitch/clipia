/**
 * CLIPIA — Centre des IA : catalogue extensible des modèles installables via Ollama.
 * Les licences sont celles annoncées par les éditeurs ; elles sont à confirmer sur la fiche officielle
 * avant tout usage commercial. Les « capacités » sont DÉCLARÉES : elles ne deviennent « vérifiées »
 * qu'après un test réel sur la machine (état « opérationnel »).
 */
import { MODELES_LOCAUX, ollamaPresent } from './installeur.js';

const E = (famille, nom, o) => ({ famille, nom, source: 'https://ollama.com/library/' + nom.split(':')[0], cout: 'gratuit (local)', moteur: 'Ollama', ...o });
export const CATALOGUE_IA = [
  E('DeepSeek', 'deepseek-r1:7b', { licence: 'MIT', caps: ['raisonnement'], go: 4.7, ram: 16 }),
  E('DeepSeek', 'deepseek-r1:14b', { licence: 'MIT', caps: ['raisonnement'], go: 9, ram: 24 }),
  E('DeepSeek', 'deepseek-coder-v2:16b', { licence: 'DeepSeek (usage permis, voir fiche)', caps: ['code'], go: 8.9, ram: 24 }),
  E('Qwen', 'qwen3:8b', { licence: 'Apache-2.0', caps: ['conversation', 'raisonnement', 'outils'], go: 5.2, ram: 16 }),
  E('Qwen', 'qwen2.5:7b', { licence: 'Apache-2.0', caps: ['conversation', 'français'], go: 4.7, ram: 16 }),
  E('Qwen', 'qwen2.5-coder:7b', { licence: 'Apache-2.0', caps: ['code'], go: 4.7, ram: 16 }),
  E('Qwen', 'qwen2.5vl:7b', { licence: 'Apache-2.0', caps: ['vision', 'documents'], go: 6, ram: 16 }),
  E('Llama', 'llama3.2:3b', { licence: 'Llama Community', caps: ['conversation'], go: 2, ram: 8 }),
  E('Llama', 'llama3.1:8b', { licence: 'Llama Community', caps: ['conversation', 'outils', 'contexte long'], go: 4.7, ram: 16 }),
  E('Llama', 'llama3.2-vision:11b', { licence: 'Llama Community', caps: ['vision'], go: 7.9, ram: 24 }),
  E('Mistral', 'mistral:7b', { licence: 'Apache-2.0', caps: ['conversation', 'français'], go: 4.1, ram: 16 }),
  E('Mistral', 'mistral-nemo:12b', { licence: 'Apache-2.0', caps: ['conversation', 'contexte long'], go: 7.1, ram: 24 }),
  E('Gemma', 'gemma2:9b', { licence: 'Gemma Terms', caps: ['conversation', 'écriture'], go: 5.4, ram: 16 }),
  E('Gemma', 'gemma3:4b', { licence: 'Gemma Terms', caps: ['conversation', 'vision'], go: 3.3, ram: 8 }),
  E('Phi', 'phi3.5:3.8b', { licence: 'MIT', caps: ['raisonnement'], go: 2.2, ram: 8 }),
  E('Phi', 'phi4:14b', { licence: 'MIT', caps: ['raisonnement', 'code'], go: 9.1, ram: 24 }),
  E('GLM', 'glm4:9b', { licence: 'GLM-4 (voir fiche)', caps: ['conversation', 'outils'], go: 5.5, ram: 16 }),
  E('InternLM', 'internlm2:7b', { licence: 'Apache-2.0 (code) — poids : voir fiche', caps: ['conversation', 'raisonnement'], go: 4.5, ram: 16 }),
  E('Code', 'starcoder2:7b', { licence: 'BigCode OpenRAIL-M', caps: ['code'], go: 4, ram: 16 }),
  E('Code', 'codellama:7b', { licence: 'Llama Community', caps: ['code'], go: 3.8, ram: 16 }),
  E('Vision', 'llava:7b', { licence: 'Apache-2.0 / Llama (voir fiche)', caps: ['vision'], go: 4.7, ram: 16 }),
  E('Vision', 'moondream', { licence: 'Apache-2.0', caps: ['vision'], go: 1.7, ram: 4 }),
  E('Mémoire', 'nomic-embed-text', { licence: 'Apache-2.0', caps: ['embeddings'], go: 0.3, ram: 2 })
];
export const NOMS_INSTALLABLES = new Set([...CATALOGUE_IA.map(m => m.nom), ...MODELES_LOCAUX.map(m => m.nom)]);

export async function centre(ramGo) {
  const o = await ollamaPresent();
  const installes = new Set((o.modeles || []).map(m => m.nom));
  const liste = CATALOGUE_IA.map(m => ({
    ...m,
    etat: !o.ok ? 'ollama-requis' : installes.has(m.nom) ? 'installé' : m.ram > ramGo + 0.5 ? 'incompatible (RAM)' : 'disponible',
    capacitesVerifiees: false
  }));
  return { ollama: o.ok, ramGo, familles: [...new Set(liste.map(m => m.famille))], modeles: liste,
    note: 'Licences annoncées par les éditeurs, à confirmer sur la fiche officielle. Capacités déclarées, non vérifiées tant que le modèle n\'a pas été testé.' };
}
