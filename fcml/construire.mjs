/**
 * CLIPIA FCML 1.1 — construction du modèle sur votre machine.
 *
 * Le script télécharge la base Qwen3-4B par Ollama, crée le modèle
 * clipia-fcml:1.1 à partir du Modelfile, puis MESURE : la taille réelle sur le
 * disque, le nombre de paramètres que le modèle déclare, et sa vitesse en
 * jetons par seconde. Il affiche ce qu'il a mesuré, pas ce qu'on espérait.
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ICI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const NOM = 'clipia-fcml:1.1';
const BASE = 'qwen3:4b-q5_K_M';
const PLAFOND_GO = 4;

const ok = (t) => console.log('  \x1b[32m✓\x1b[0m ' + t);
const ko = (t) => console.log('  \x1b[31m✗\x1b[0m ' + t);
const dit = (t) => console.log('  ' + t);

function ollama(args, { silencieux = false } = {}) {
  const r = spawnSync('ollama', args, { encoding: 'utf8', shell: process.platform === 'win32',
                                        stdio: silencieux ? 'pipe' : ['ignore', 'pipe', 'pipe'] });
  return { code: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

function ollamaSuivi(args) {
  return new Promise((res) => {
    const p = spawn('ollama', args, { shell: process.platform === 'win32' });
    p.stdout.on('data', d => process.stdout.write(d));
    p.stderr.on('data', d => process.stdout.write(d));
    p.on('close', c => res(c));
  });
}

console.log('\n  ═══ CLIPIA FCML 1.1 ═══\n');

// 1. Ollama est-il là ?
const v = ollama(['--version'], { silencieux: true });
if (v.code !== 0) {
  ko('Ollama est introuvable.');
  dit('Installez-le depuis https://ollama.com/download, puis relancez ce script.');
  dit('C\'est lui qui fait tourner le modèle en local, hors ligne, sans clé.');
  process.exit(1);
}
ok('Ollama présent : ' + v.out.trim());

// 2. La base
dit('\n  Téléchargement de la base ' + BASE + ' (environ 2,9 Go)…\n');
if (await ollamaSuivi(['pull', BASE]) !== 0) {
  ko('\nLe téléchargement a échoué. Vérifiez l\'accès internet, puis relancez.');
  process.exit(2);
}
ok('\nBase téléchargée.');

// 3. Création
const mf = path.join(ICI, 'Modelfile');
if (!fs.existsSync(mf)) { ko('Modelfile introuvable à côté du script.'); process.exit(3); }
dit('\n  Création de ' + NOM + '…\n');
if (await ollamaSuivi(['create', NOM, '-f', mf]) !== 0) {
  ko('\nLa création a échoué (voir le message ci-dessus).');
  process.exit(4);
}
ok('\n' + NOM + ' créé.');

// 4. Mesures
console.log('\n  ─── MESURES ───\n');

const liste = ollama(['list'], { silencieux: true }).out.split('\n').find(l => l.startsWith('clipia-fcml'));
const taille = liste ? liste.trim().split(/\s{2,}/)[2] : '?';
const go = parseFloat(String(taille).replace(',', '.')) || 0;
dit(`Taille sur le disque   : ${taille}`);
dit(`Plafond demandé        : ${PLAFOND_GO} Go  →  ${go && go <= PLAFOND_GO ? '\x1b[32mdans le budget\x1b[0m' : '\x1b[31mDÉPASSÉ\x1b[0m'}`);

const show = ollama(['show', NOM], { silencieux: true }).out;
const champ = (re) => (show.match(re) || [, '?'])[1].trim();
dit(`Paramètres             : ${champ(/parameters\s+(\S+)/i)}`);
dit(`Architecture           : ${champ(/architecture\s+(\S+)/i)}`);
dit(`Quantification         : ${champ(/quantization\s+(\S+)/i)}`);
dit(`Contexte               : ${champ(/context length\s+(\S+)/i)} jetons`);

// 5. Vitesse réelle, et non annoncée
dit('\n  Essai de vitesse (une question courte)…');
const t0 = Date.now();
const essai = spawnSync('ollama', ['run', NOM, '--verbose', 'Réponds en une seule phrase : qui es-tu ?'],
  { encoding: 'utf8', shell: process.platform === 'win32', timeout: 180000 });
const ms = Date.now() - t0;
const sortie = String(essai.stdout || '') + String(essai.stderr || '');
const vitesse = (sortie.match(/eval rate:\s*([\d.]+)\s*tokens\/s/i) || [])[1];
dit(`Temps total            : ${(ms / 1000).toFixed(1)} s`);
dit(`Vitesse               : ${vitesse ? vitesse + ' jetons/s' : 'non mesurée par Ollama'}`);
const reponse = String(essai.stdout || '').trim().split('\n').filter(Boolean).pop();
if (reponse) dit(`Elle a répondu         : « ${reponse.slice(0, 120)} »`);

console.log('\n  ─── POUR L\'UTILISER ───\n');
dit('Dans un terminal   : ollama run ' + NOM);
dit('Dans Clipia        : Cerveau → Ollama → ' + NOM);
dit('\n  Pour la publier sur ollama.com, lisez PUBLIER.md.\n');
