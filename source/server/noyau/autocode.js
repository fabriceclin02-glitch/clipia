/**
 * CLIPIA — Se coder elle-même.
 *
 * Clipia peut lire et modifier SON PROPRE code (dossiers server/ et web/), avec
 * des garde-fous écrits dans le code, pas dans un prompt :
 *   • chaque modification demande l'accord de la personne (carte « Autoriser ») ;
 *   • avant d'écrire, l'ancien fichier est copié dans data/auto-code/<date>/ ;
 *   • un fichier .js est vérifié par `node --check` : s'il ne compile pas, l'ancien
 *     fichier est remis tout de suite et l'erreur est rendue ;
 *   • jamais touchés : .env, data/, node_modules, runtime, les sauvegardes elles-mêmes ;
 *   • `code_clipia_annuler` remet la dernière version sauvegardée.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, DATA_DIR } from '../lib/env.js';
import { consommer } from './machine.js';

const DOSSIERS = ['server', 'web'];
const SAUVE = path.join(DATA_DIR, 'auto-code');
const MAX_LECTURE = 14000;

class CodeError extends Error {}

function resoudre(rel) {
  const r = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!r || r.includes('\0')) throw new CodeError('Il faut un chemin (ex. web/app.js).');
  const abs = path.resolve(ROOT, r);
  const relatif = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (relatif.startsWith('..') || path.isAbsolute(relatif)) throw new CodeError('Chemin hors de Clipia.');
  const premier = relatif.split('/')[0];
  if (!DOSSIERS.includes(premier)) throw new CodeError('Je ne peux toucher qu\'à server/ et web/.');
  if (/(^|\/)(node_modules|runtime|data)(\/|$)/.test(relatif) || /(^|\/)\.env/.test(relatif)) throw new CodeError('Ce fichier est protégé.');
  return { abs, relatif };
}

function verifier(abs) {
  if (!/\.(m?js)$/.test(abs)) return { ok: true };
  const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8', timeout: 20000 });
  return r.status === 0 ? { ok: true } : { ok: false, erreur: String(r.stderr || r.stdout || 'erreur de syntaxe').slice(0, 800) };
}

function sauvegarder(relatif, abs) {
  const dossier = path.join(SAUVE, new Date().toISOString().replace(/[:.]/g, '-'));
  const dest = path.join(dossier, relatif);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(abs)) fs.copyFileSync(abs, dest);
  else fs.writeFileSync(dest + '.absent', '');
  return { dossier, dest };
}

export const OUTILS_AUTOCODE = {
  code_clipia_lire: {
    groupe: 'autocode',
    description: 'Lit le code de Clipia elle-même (server/ ou web/). Paramètre : chemin (un fichier, ou un dossier pour le lister). Lis toujours avant de modifier.',
    async run({ chemin }) {
      const { abs, relatif } = resoudre(chemin);
      if (!fs.existsSync(abs)) throw new CodeError('Introuvable : ' + relatif);
      if (fs.statSync(abs).isDirectory()) {
        const l = fs.readdirSync(abs, { withFileTypes: true }).filter(d => !/^(node_modules|\.)/.test(d.name)).map(d => (d.isDirectory() ? d.name + '/' : d.name)).sort();
        return { resume: `${relatif}/ :\n${l.join('\n')}`, preuve: { genre: 'liste', lignes: l.length } };
      }
      const t = fs.readFileSync(abs, 'utf8');
      return { resume: t.length > MAX_LECTURE ? t.slice(0, MAX_LECTURE) + `\n… (${t.length - MAX_LECTURE} caractères de plus : lis par morceaux en citant des passages précis)` : t,
               preuve: { genre: 'lecture', chemin: relatif, octets: t.length } };
    }
  },

  code_clipia_modifier: {
    groupe: 'autocode',
    description: 'Modifie ton propre code. Paramètres : chemin, ancien (passage exact à remplacer) et nouveau ; OU contenu (pour créer un fichier neuf) ; raison (une phrase) ; accord. Une copie de sauvegarde est faite et le fichier est vérifié ; la personne doit donner son accord.',
    async run({ chemin, ancien, nouveau, contenu, raison = '', accord }) {
      const { abs, relatif } = resoudre(chemin);
      const existe = fs.existsSync(abs);
      let apres;
      if (typeof contenu === 'string' && !ancien) {
        if (existe) throw new CodeError('Le fichier existe : utilise ancien/nouveau pour le modifier.');
        apres = contenu;
      } else {
        if (!existe) throw new CodeError('Introuvable : ' + relatif);
        const avant = fs.readFileSync(abs, 'utf8');
        if (!ancien) throw new CodeError('Il faut le passage exact à remplacer (ancien).');
        const n = avant.split(String(ancien)).length - 1;
        if (n === 0) throw new CodeError('Le passage « ancien » est introuvable dans le fichier : relis-le et cite-le exactement.');
        if (n > 1) throw new CodeError(`Le passage « ancien » apparaît ${n} fois : cite un passage plus long et unique.`);
        apres = avant.replace(String(ancien), () => String(nouveau ?? ''));
      }
      const cle = 'code:' + relatif;
      if (!accord || !consommer(accord, cle)) {
        return {
          resume: `Je voudrais modifier mon propre code (${relatif})${raison ? ' : ' + raison : ''}. J'attends ton accord.`,
          arret: 'accord',
          effet: { genre: 'accord', commande: cle, categorie: 'code', pourquoi: 'modifie le code de Clipia elle-même' + (raison ? ' — ' + raison : '') },
          preuve: { genre: 'accord-demande', commande: cle }
        };
      }
      const copie = sauvegarder(relatif, abs);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const ancienTexte = existe ? fs.readFileSync(abs, 'utf8') : null;
      fs.writeFileSync(abs, apres);
      const v = verifier(abs);
      if (!v.ok) {
        if (ancienTexte === null) fs.rmSync(abs, { force: true }); else fs.writeFileSync(abs, ancienTexte);
        fs.rmSync(copie.dossier, { recursive: true, force: true });   // rien n'a changé : pas de sauvegarde à garder
        throw new CodeError('La modification ne compile pas, j\'ai tout remis comme avant. Erreur : ' + v.erreur);
      }
      const serveur = relatif.startsWith('server/');
      return {
        resume: `${relatif} modifié et vérifié. Sauvegarde : ${path.relative(DATA_DIR, copie.dest)}. ` + (serveur ? 'Il faut redémarrer Clipia pour que ce soit pris en compte.' : 'Recharge la page pour voir le changement.'),
        preuve: { genre: 'fichier', chemin: relatif, octets: apres.length, verifie: true, sauvegarde: copie.dest }
      };
    }
  },

  code_clipia_annuler: {
    groupe: 'autocode',
    description: 'Annule ta dernière modification de ton propre code en remettant la sauvegarde. Aucun paramètre.',
    async run() {
      if (!fs.existsSync(SAUVE)) throw new CodeError('Aucune sauvegarde.');
      const dates = fs.readdirSync(SAUVE).filter(d => !d.startsWith('.')).sort();
      for (let i = dates.length - 1; i >= 0; i--) {
        const base = path.join(SAUVE, dates[i]);
        const fichiers = [];
        (function marcher(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? marcher(p) : fichiers.push(p); } })(base);
        if (!fichiers.length) continue;
        const f = fichiers[0], rel = path.relative(base, f);
        const cible = path.join(ROOT, rel.replace(/\.absent$/, ''));
        if (f.endsWith('.absent')) fs.rmSync(cible, { force: true }); else fs.copyFileSync(f, cible);
        fs.rmSync(base, { recursive: true, force: true });
        return { resume: `${rel.replace(/\.absent$/, '')} remis comme avant (sauvegarde du ${dates[i]}).`, preuve: { genre: 'fichier', chemin: rel } };
      }
      throw new CodeError('Aucune sauvegarde à restaurer.');
    }
  }
};
