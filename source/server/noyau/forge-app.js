/**
 * CLIPIA V6.1 — Atelier d'apps : une équipe d'agents construit une application, et ne dit « terminé » que si elle est VÉRIFIÉE.
 *
 *   architecte → plan (PLAN.md, critères de réussite)
 *   codeur     → code + tests, lance les tests
 *   testeur    → (programme, pas un modèle) node --check, tests, fichiers référencés ; renvoie les erreurs au codeur (3 tours max)
 *   relecteur  → relit, corrige les vrais défauts, relance les tests
 *
 * Tout se passe dans un dossier isolé du projet « app-<nom> ». L'aperçu web est servi dans un « bac à sable » sans accès à Clipia.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { store } from '../lib/store.js';
import { PROJETS_DIR } from '../agent/tools.js';

const slugDe = (s) => String(s || 'app').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'app';
export const apps = () => store.setting('apps') || [];
const majApp = (a) => { const l = apps().filter(x => x.slug !== a.slug); l.push(a); store.setting('apps', l.slice(-60)); };
export const dossierApp = (slug) => path.join(PROJETS_DIR, 'app-' + slugDe(slug));

function fichiersDe(dir, base = dir, out = []) {
  let l = []; try { l = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const d of l) {
    if (d.name === 'node_modules' || d.name.startsWith('.git')) continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) fichiersDe(p, base, out); else out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}
export const listerFichiers = (slug) => fichiersDe(dossierApp(slug));

/* ══ LE TESTEUR (un programme, pas un modèle : il ne se laisse pas convaincre) ═══ */
export function verifier(dir, type = 'web') {
  const fichiers = fichiersDe(dir); const rapport = []; let ok = true; let testsLances = 0;
  const lancer = (cmd, args, ms = 60000) => spawnSync(cmd, args, { cwd: dir, timeout: ms, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  for (const f of fichiers.filter(f => /\.(m?js|cjs)$/.test(f))) {
    const r = lancer(process.execPath, ['--check', f], 15000);
    if (r.status !== 0) { ok = false; rapport.push(`✗ Syntaxe invalide : ${f}\n${String(r.stderr).slice(0, 500)}`); }
  }
  for (const f of fichiers.filter(f => /\.py$/.test(f))) {
    const r = lancer('python3', ['-m', 'py_compile', f], 15000);
    if (r.status !== 0 && !r.error) { ok = false; rapport.push(`✗ Syntaxe invalide : ${f}\n${String(r.stderr).slice(0, 500)}`); }
  }
  if (fichiers.includes('index.html')) {
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    for (const m of html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)) {
      const u = m[1]; if (/^(https?:|\/\/|data:|mailto:|javascript:)/i.test(u)) continue;
      if (!fs.existsSync(path.join(dir, u.replace(/^\.?\//, '')))) { ok = false; rapport.push(`✗ index.html référence un fichier absent : ${u}`); }
    }
  } else if (estWeb(type)) { ok = false; rapport.push('✗ index.html est absent.'); }
  const test = ['tests.js', 'test.js', 'tests.mjs', 'test.mjs'].find(f => fichiers.includes(f));
  const testPy = ['tests.py', 'test.py'].find(f => fichiers.includes(f));
  if (test) { const r = lancer(process.execPath, [test]); testsLances++; if (r.status !== 0) { ok = false; rapport.push(`✗ Les tests échouent (${test}) :\n${(String(r.stdout) + String(r.stderr)).slice(-900)}`); } else rapport.push(`✓ Tests passés (${test})`); }
  else if (testPy) { const r = lancer('python3', [testPy]); testsLances++; if (r.status !== 0) { ok = false; rapport.push(`✗ Les tests échouent (${testPy}) :\n${(String(r.stdout) + String(r.stderr)).slice(-900)}`); } else rapport.push(`✓ Tests passés (${testPy})`); }
  if (!testsLances) { ok = false; rapport.push('✗ Aucun test : écris tests.js (ou tests.py) qui vérifie les fonctions principales, puis lance-le.'); }
  if (!fichiers.length) { ok = false; rapport.push('✗ Aucun fichier produit.'); }
  return { ok, testsLances, rapport: rapport.join('\n'), fichiers };
}

/* ══ ZIP sans dépendance ══════════════════════════════════════════════════ */
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zipDossier(slug) {
  const dir = dossierApp(slug); const parts = [], central = []; let off = 0;
  for (const f of fichiersDe(dir)) {
    const data = fs.readFileSync(path.join(dir, f)); const nom = Buffer.from(slug + '/' + f); const comp = zlib.deflateRawSync(data); const crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt32LE(0x58210000 >>> 0, 10);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nom.length, 26);
    parts.push(h, nom, comp);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt32LE(0x58210000 >>> 0, 12);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nom.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nom); off += 30 + nom.length + comp.length;
  }
  const cd = Buffer.concat(central); const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(central.length / 2, 8); fin.writeUInt16LE(central.length / 2, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, fin]);
}

/* ══ LES RÔLES ════════════════════════════════════════════════════════════ */
const REGLES = `Règles : tu travailles UNIQUEMENT dans le dossier du projet avec fichier_ecrire, fichier_lire, fichier_remplacer, fichier_lister, executer. Aucune dépendance externe : JavaScript natif (Node), HTML/CSS/JS ou Python standard. Pas de clé, pas de mot de passe, pas de requête réseau vers des services inconnus dans le code que tu écris. Code lisible, commenté en français.`;
const ROLES = {
  architecte: { permis: ['fichier_ecrire', 'fichier_lister', 'competence_lire'], max: 4,
    role: `Tu es l'ARCHITECTE logiciel. ${REGLES} Ta seule mission : écrire PLAN.md (fonctionnalités minimales, liste des fichiers avec le rôle de chacun, critères de réussite TESTABLES). Reste simple : un MVP qui marche vaut mieux qu'un projet ambitieux cassé. N'écris pas le code.` },
  codeur: { permis: ['fichier_ecrire', 'fichier_lire', 'fichier_remplacer', 'fichier_lister', 'executer', 'competence_lire'], max: 14,
    role: `Tu es un DÉVELOPPEUR SENIOR. ${REGLES} Tu lis PLAN.md, tu codes fichier par fichier, tu écris des tests (tests.js pour Node/Web, tests.py pour Python) qui vérifient les fonctions principales, puis tu les LANCES avec executer ("node tests.js"). Tu ne conclus qu'après avoir vu les tests passer. Si un test échoue, tu lis l'erreur en entier, tu corriges la cause, tu relances.` },
  relecteur: { permis: ['fichier_lire', 'fichier_remplacer', 'fichier_lister', 'executer'], max: 8,
    role: `Tu es le RELECTEUR. ${REGLES} Tu relis tout le code : bugs réels, cas limites, erreurs non gérées, secrets en dur, accessibilité de base. Tu corriges seulement ce qui est réellement défectueux (pas de réécriture de style), puis tu relances les tests.` }
};
export const estWeb = (t) => ['web', 'site', 'jeu'].includes(t);
const TYPES = { site: 'un site web complet et soigné (plusieurs sections ou pages HTML, CSS responsive mobile, animations légères, accessibilité, aucune dépendance, index.html à la racine)', jeu: 'un jeu navigateur jouable (index.html + JS, clavier et tactile, score, bouton rejouer, sans dépendance)', web: 'une application web (index.html + CSS + JS, sans serveur)', node: 'un programme Node.js en ligne de commande (sans dépendance)', python: 'un programme Python en ligne de commande (bibliothèque standard)', api: 'un petit serveur Node.js (module http natif) avec ses tests' };

/**
 * Construit l'application. `onEvent` reçoit la progression. Rend le descriptif de l'app.
 */
export async function creerApp({ description, type = 'web', nom = '', onEvent = () => {}, signal, appeler } = {}) {
  if (!String(description || '').trim()) throw new Error('Décris l\'application voulue.');
  const { converser } = await import('./boucle.js');
  const slug = slugDe(nom || description.split(/[.\n]/)[0].slice(0, 40)) + '-' + Date.now().toString(36).slice(-3);
  const projet = 'app-' + slug; const dir = path.join(PROJETS_DIR, projet); fs.mkdirSync(dir, { recursive: true });
  const app = { slug, nom: nom || description.slice(0, 50), description: String(description).slice(0, 600), type: TYPES[type] ? type : 'web', cree: new Date().toISOString(), statut: 'en cours', tours: 0 };
  majApp(app);
  const etape = (e, detail = '') => onEvent({ type: 'etape-app', etape: e, detail });
  const sousEv = (role) => (ev) => { if (['outil', 'resultat', 'simule'].includes(ev.type)) onEvent({ ...ev, role }); };
  const agent = (role, message) => converser({ message, projet, roleSysteme: ROLES[role].role, outilsPermis: ROLES[role].permis, maxEtapes: ROLES[role].max, sansAccord: true, blanc: false, signal, historique: [], ...(appeler ? { appeler } : {}) }, sousEv(role));
  const brief = `Application à créer : ${description}\nForme : ${TYPES[app.type]}.`;
  try {
    etape('architecte', 'Je conçois le plan…'); await agent('architecte', brief + '\nÉcris PLAN.md.');
    etape('codeur', 'Je code et j\'écris les tests…'); await agent('codeur', brief + '\nLis PLAN.md, code l\'application, écris et lance les tests.');
    let v = verifier(dir, app.type);
    for (let t = 1; t <= 3 && !v.ok; t++) {
      if (signal?.aborted) break;
      app.tours = t; etape('testeur', `Vérification ${t} : des problèmes subsistent, je corrige…`); onEvent({ type: 'rapport', ok: false, texte: v.rapport });
      await agent('codeur', `${brief}\nLe testeur automatique a trouvé ces problèmes, corrige-les (et relance les tests) :\n${v.rapport}`);
      v = verifier(dir, app.type);
    }
    if (v.ok && !signal?.aborted) {
      etape('relecteur', 'Relecture du code…'); await agent('relecteur', brief + '\nRelis le code et corrige les vrais défauts, puis relance les tests.');
      const v2 = verifier(dir, app.type);
      if (v2.ok) v = v2; else { etape('testeur', 'La relecture a cassé quelque chose, je répare…'); await agent('codeur', `Les tests échouent après relecture :\n${v2.rapport}\nRépare sans rien casser d'autre.`); v = verifier(dir, app.type); }
    }
    // Fichiers d'accompagnement
    const fs2 = fichiersDe(dir);
    if (!fs2.includes('LISEZ-MOI.md')) fs.writeFileSync(path.join(dir, 'LISEZ-MOI.md'), `# ${app.nom}\n\n${app.description}\n\n## Lancer\n${estWeb(app.type) ? 'Ouvre index.html dans ton navigateur.' : app.type === 'python' ? 'python3 main.py (voir PLAN.md)' : 'node main.js (voir PLAN.md)'}\n\n## Tests\n${app.type === 'python' ? 'python3 tests.py' : 'node tests.js'}\n\nCréé avec l'Atelier d'apps de Clipia.\n`);
    app.statut = v.ok ? 'vérifiée' : 'à revoir'; app.rapport = v.rapport.slice(0, 1500); app.fichiers = fichiersDe(dir); app.web = app.fichiers.includes('index.html'); app.termine = new Date().toISOString();
  } catch (e) { app.statut = 'échec'; app.rapport = String(e.message).slice(0, 400); }
  majApp(app); etape('fin', app.statut);
  return app;
}
