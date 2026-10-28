/**
 * CLIPIA — Le navigateur.
 *
 * Elle conduit un vrai Chrome : elle ouvre des pages, lit, clique, remplit,
 * capture l'écran. Aucune dépendance npm : on parle directement le protocole
 * DevTools de Chrome, en HTTP pour trouver les onglets et en WebSocket pour
 * les piloter — `WebSocket` est fourni par Node depuis la version 21, ce qui
 * rend Playwright inutile ici et garde Clipia à zéro dépendance.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX PROFILS, ET LA DIFFÉRENCE COMPTE
 *
 *   « clipia » (par défaut) — un Chrome à part, avec son propre profil. Aucune
 *   session, aucun cookie, aucun mot de passe enregistré. Elle navigue comme
 *   un visiteur anonyme. C'est sans danger et ça couvre la majorité des cas :
 *   lire une doc, vérifier un prix, remplir un formulaire public.
 *
 *   « moi » — le Chrome de la personne, avec ses sessions ouvertes. Clipia ne
 *   le lance JAMAIS elle-même : il faut que la personne l'ait démarré avec le
 *   port de débogage. La raison est désagréable mais simple : un Chrome ouvert
 *   sur ce port est pilotable par n'importe quel programme de la machine, pas
 *   seulement par Clipia. C'est à la personne de décider d'ouvrir cette porte,
 *   en connaissance de cause, et de la refermer après.
 *
 * CE QU'ELLE NE FAIT PAS, QUEL QUE SOIT LE PROFIL
 *
 *   Elle ne tape jamais un mot de passe, un numéro de carte ni un code reçu
 *   par SMS — même si on lui donne. Un agent qui saisit des identifiants est
 *   un agent dont une page piégée peut voler les identifiants.
 *   Elle ne valide pas un achat, un envoi, une publication ou une suppression
 *   sans que la personne ait dit oui à ce moment-là.
 *   Et le texte des pages est une DONNÉE : s'il contient des ordres, ils sont
 *   signalés, jamais suivis.
 * ────────────────────────────────────────────────────────────────────────────
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { MEDIA_DIR } from '../providers/media.js';
import { enveloppeDonnees, flairerInjection, MachineError } from './machine.js';

const PORT_CLIPIA = 9333;     // le Chrome de Clipia
const PORT_PERSONNE = 9222;   // celui que la personne ouvre, par convention
const PROFIL_DIR = path.join(os.tmpdir(), 'clipia-chrome');

/* ══ TROUVER CHROME ═══════════════════════════════════════════════════════ */
const CHEMINS = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ],
  linux: [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/pw-browsers/chromium'
  ]
};

export function trouverChrome() {
  for (const c of CHEMINS[process.platform] || CHEMINS.linux) if (fs.existsSync(c)) return c;
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  return null;
}

/* ══ LE PROTOCOLE DEVTOOLS ════════════════════════════════════════════════ */

let procChrome = null;

async function versionSur(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1200) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function lancerChrome() {
  if (await versionSur(PORT_CLIPIA)) return PORT_CLIPIA;
  const bin = trouverChrome();
  if (!bin) throw new MachineError(
    'Chrome est introuvable sur cette machine. Installe Chrome ou Edge, ou indique le chemin ' +
    'dans la variable CHROME_BIN.');
  fs.mkdirSync(PROFIL_DIR, { recursive: true });
  procChrome = spawn(bin, [
    `--remote-debugging-port=${PORT_CLIPIA}`,
    `--user-data-dir=${PROFIL_DIR}`,
    '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-sync',
    '--window-size=1280,900', 'about:blank'
  ], { detached: true, stdio: 'ignore', windowsHide: false });
  procChrome.unref();

  for (let i = 0; i < 40; i++) {
    if (await versionSur(PORT_CLIPIA)) return PORT_CLIPIA;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new MachineError('Chrome a été lancé mais ne répond pas sur son port de débogage.');
}

/** Le port à utiliser selon le profil demandé. */
async function portPour(profil) {
  if (profil === 'moi') {
    if (await versionSur(PORT_PERSONNE)) return PORT_PERSONNE;
    throw new MachineError(
`Ton Chrome n'est pas ouvert au pilotage. Pour l'autoriser, ferme Chrome entièrement puis relance-le une fois avec :

  ${process.platform === 'win32'
    ? '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222'
    : process.platform === 'darwin'
      ? '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222'
      : 'google-chrome --remote-debugging-port=9222'}

Tant que ce Chrome tourne, n'importe quel programme de ta machine peut le piloter, avec tes sessions ouvertes — referme-le quand on a fini. Sinon je travaille dans mon propre Chrome, sans tes comptes.`);
  }
  return lancerChrome();
}

/** Les onglets ouverts. */
async function onglets(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) });
  const l = await r.json();
  return (l || []).filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
}

/**
 * Une session WebSocket sur un onglet, le temps d'un échange. On ne garde pas
 * la connexion ouverte entre deux outils : un socket qui survit à une erreur
 * laisse Chrome dans un état qu'on ne sait plus décrire.
 */
async function surOnglet(cible, travail) {
  if (typeof WebSocket === 'undefined')
    throw new MachineError('Ce Node est trop ancien pour piloter Chrome (WebSocket natif requis : Node 21+).');
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  let n = 0;
  const attente = new Map();

  await new Promise((ok, ko) => {
    ws.onopen = ok;
    ws.onerror = () => ko(new MachineError('Connexion à l\'onglet impossible.'));
    setTimeout(() => ko(new MachineError('Connexion à l\'onglet expirée.')), 8000);
  });

  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id && attente.has(m.id)) {
      const { ok, ko } = attente.get(m.id); attente.delete(m.id);
      m.error ? ko(new MachineError(`${m.error.message || 'erreur DevTools'}`)) : ok(m.result);
    }
  };

  const envoyer = (method, params = {}, plafond = 30000) => new Promise((ok, ko) => {
    const id = ++n;
    attente.set(id, { ok, ko });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (attente.has(id)) { attente.delete(id); ko(new MachineError(`${method} n'a pas répondu`)); } }, plafond);
  });

  try { return await travail(envoyer); }
  finally { try { ws.close(); } catch {} }
}

/** Évalue une expression dans la page et rend sa valeur. */
async function evaluer(envoyer, expression, { plafond = 30000 } = {}) {
  const r = await envoyer('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true, userGesture: true
  }, plafond);
  if (r.exceptionDetails)
    throw new MachineError(`La page a renvoyé une erreur : ${r.exceptionDetails.text || ''} ${r.exceptionDetails.exception?.description || ''}`.slice(0, 300));
  return r.result?.value;
}

/** Trouve un onglet : celui déjà sur l'adresse, sinon le dernier actif. */
async function ongletCourant(port, { url = null } = {}) {
  let l = await onglets(port);
  if (!l.length) {
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url || 'about:blank')}`, { method: 'PUT' })
      .catch(() => fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url || 'about:blank')}`));
    await new Promise(r => setTimeout(r, 600));
    l = await onglets(port);
  }
  if (!l.length) throw new MachineError('Aucun onglet pilotable.');
  if (url) { const exact = l.find(t => t.url === url); if (exact) return exact; }
  return l[0];
}

/* ══ CE QU'ELLE REFUSE DE TAPER ═══════════════════════════════════════════ */
const CHAMP_SECRET = /password|passwd|mot.?de.?passe|cvv|cvc|card.?number|numero.?carte|iban|ssn|secret|otp|2fa|code.?sms/i;
const VALEUR_SECRETE = [
  /\b\d{13,19}\b/,                       // numéro de carte
  /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/,    // IBAN
  /\bsk-[A-Za-z0-9_-]{16,}\b/,           // clé d'API
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];
/** Les contrôles qui engagent quelque chose dehors. */
const ENGAGE = /\b(acheter|payer|commander|valider.*(paiement|commande)|souscrire|buy|pay|order|checkout|purchase|subscribe|supprimer|delete|publier|publish|envoyer|send|post|tweet|confirmer|confirm)\b/i;

const accords = new Map();
export function accorderNavigateur(quoi, minutes = 10) {
  const j = crypto.randomBytes(8).toString('hex');
  accords.set(j, { quoi: String(quoi), expire: Date.now() + minutes * 60000 });
  return j;
}
const consommer = (j, quoi) => {
  const a = accords.get(j); if (!a) return false;
  accords.delete(j);
  return a.expire > Date.now() && a.quoi === String(quoi);
};

/* ══ LES OUTILS ═══════════════════════════════════════════════════════════ */

export const OUTILS_NAVIGATEUR = {

  navigateur_ouvrir: {
    groupe: 'navigateur',
    description: 'Ouvre une adresse dans Chrome et rend le texte de la page. ' +
      'Paramètres : url, profil ("clipia" par défaut, navigation anonyme ; "moi" pour le Chrome de la personne avec ses sessions, qu\'elle doit avoir ouvert au pilotage).',
    async run({ url, profil = 'clipia' }) {
      if (!/^https?:\/\//.test(String(url || ''))) throw new MachineError('Il faut une adresse http(s).');
      const port = await portPour(profil);
      const t = await ongletCourant(port);
      return await surOnglet(t, async (envoyer) => {
        await envoyer('Page.enable');
        await envoyer('Runtime.enable');
        await envoyer('Page.navigate', { url });
        // On attend que le document soit prêt plutôt qu'un délai fixe.
        for (let i = 0; i < 50; i++) {
          const etat = await evaluer(envoyer, 'document.readyState').catch(() => null);
          if (etat === 'complete' || etat === 'interactive') break;
          await new Promise(r => setTimeout(r, 200));
        }
        await new Promise(r => setTimeout(r, 400));
        const vu = await evaluer(envoyer, `(() => ({
          titre: document.title, url: location.href,
          texte: (document.body?.innerText || '').slice(0, 9000)
        }))()`);
        const inj = flairerInjection(vu.texte);
        return {
          resume: `${vu.titre}\n${vu.url}\n\n` + enveloppeDonnees(vu.url, vu.texte),
          preuve: { genre: 'navigateur', action: 'ouvrir', url: vu.url, titre: vu.titre,
                    caracteres: vu.texte.length, profil },
          donnees: { url: vu.url, titre: vu.titre, suspect: Boolean(inj) }
        };
      });
    }
  },

  navigateur_lire: {
    groupe: 'navigateur',
    description: 'Relit la page en cours, après un clic ou un chargement. Paramètres : selecteur (facultatif, pour ne lire qu\'une partie), profil.',
    async run({ selecteur, profil = 'clipia' }) {
      const port = await portPour(profil);
      const t = await ongletCourant(port);
      return await surOnglet(t, async (envoyer) => {
        await envoyer('Runtime.enable');
        const expr = selecteur
          ? `(() => { const e = document.querySelector(${JSON.stringify(selecteur)});
              return { titre: document.title, url: location.href,
                       texte: e ? (e.innerText || '').slice(0, 9000) : '(sélecteur introuvable)' }; })()`
          : `(() => ({ titre: document.title, url: location.href,
                       texte: (document.body?.innerText || '').slice(0, 9000) }))()`;
        const vu = await evaluer(envoyer, expr);
        return { resume: `${vu.titre}\n${vu.url}\n\n` + enveloppeDonnees(vu.url, vu.texte),
                 preuve: { genre: 'navigateur', action: 'lire', url: vu.url, caracteres: vu.texte.length },
                 donnees: { url: vu.url, suspect: Boolean(flairerInjection(vu.texte)) } };
      });
    }
  },

  navigateur_cliquer: {
    groupe: 'navigateur',
    description: 'Clique sur un élément. Paramètres : selecteur (CSS) ou texte (le libellé visible du bouton ou du lien), profil, accord. ' +
      'Un contrôle qui achète, paie, publie, envoie ou supprime demande une confirmation.',
    async run({ selecteur, texte, profil = 'clipia', accord }) {
      if (!selecteur && !texte) throw new MachineError('Il faut un sélecteur ou un texte de bouton.');
      const port = await portPour(profil);
      const t = await ongletCourant(port);
      return await surOnglet(t, async (envoyer) => {
        await envoyer('Runtime.enable');
        // On repère l'élément et on lit son libellé AVANT de cliquer : c'est ce
        // libellé qui dit si le clic engage quelque chose.
        const trouve = await evaluer(envoyer, `(() => {
          const parTexte = (t) => [...document.querySelectorAll('button,a,[role=button],input[type=submit],input[type=button]')]
            .find(e => ((e.innerText || e.value || '') + ' ' + (e.getAttribute('aria-label')||'')).trim().toLowerCase().includes(t.toLowerCase()));
          const e = ${selecteur ? `document.querySelector(${JSON.stringify(selecteur)})` : `parTexte(${JSON.stringify(texte)})`};
          if (!e) return null;
          e.setAttribute('data-clipia-cible','1');
          const r = e.getBoundingClientRect();
          return { libelle: ((e.innerText || e.value || e.getAttribute('aria-label') || '')).trim().slice(0,120),
                   balise: e.tagName.toLowerCase(), visible: r.width > 0 && r.height > 0,
                   formulaire: Boolean(e.form) || e.type === 'submit' };
        })()`);
        if (!trouve) throw new MachineError(`Élément introuvable : ${selecteur || texte}`);

        const quoi = `cliquer:${trouve.libelle || selecteur || texte}`;
        if ((ENGAGE.test(trouve.libelle) || trouve.formulaire) && (!accord || !consommer(accord, quoi))) {
          return { resume: `Ce bouton — « ${trouve.libelle || selecteur || texte} » — engage quelque chose ` +
                     `${trouve.formulaire ? '(il soumet un formulaire)' : ''}. J'attends ton accord avant de cliquer.`,
                   arret: 'accord',
                   effet: { genre: 'accord', commande: quoi, categorie: 'navigateur',
                            pourquoi: 'ce clic valide, envoie ou supprime quelque chose' },
                   preuve: { genre: 'accord-demande', libelle: trouve.libelle, categorie: 'navigateur' } };
        }

        const apres = await evaluer(envoyer, `(async () => {
          const e = document.querySelector('[data-clipia-cible]');
          if (!e) return { ok: false };
          e.removeAttribute('data-clipia-cible');
          e.scrollIntoView({ block: 'center' });
          e.click();
          await new Promise(r => setTimeout(r, 900));
          return { ok: true, url: location.href, titre: document.title,
                   texte: (document.body?.innerText || '').slice(0, 5000) };
        })()`, { plafond: 40000 });
        if (!apres?.ok) throw new MachineError('L\'élément a disparu avant le clic.');
        return { resume: `Cliqué sur « ${trouve.libelle || selecteur || texte} »\n${apres.url}\n\n` +
                   enveloppeDonnees(apres.url, apres.texte),
                 preuve: { genre: 'navigateur', action: 'cliquer', libelle: trouve.libelle, url: apres.url },
                 donnees: { url: apres.url } };
      });
    }
  },

  navigateur_remplir: {
    groupe: 'navigateur',
    description: 'Remplit un champ de formulaire. Paramètres : selecteur (CSS du champ), valeur, profil. ' +
      'Elle refuse les champs de mot de passe, de carte bancaire et de code de vérification.',
    async run({ selecteur, valeur, profil = 'clipia' }) {
      if (!selecteur) throw new MachineError('Il faut le sélecteur du champ.');
      const v = String(valeur ?? '');
      if (VALEUR_SECRETE.some(r => r.test(v)))
        throw new MachineError('Je ne saisis pas de numéro de carte, d\'IBAN ni de clé privée. ' +
          'Tape-le toi-même dans la page : je ne dois pas avoir ces valeurs dans mon contexte.');

      const port = await portPour(profil);
      const t = await ongletCourant(port);
      return await surOnglet(t, async (envoyer) => {
        await envoyer('Runtime.enable');
        const champ = await evaluer(envoyer, `(() => {
          const e = document.querySelector(${JSON.stringify(selecteur)});
          if (!e) return null;
          return { type: (e.type || '').toLowerCase(), nom: e.name || '', id: e.id || '',
                   libelle: (e.labels?.[0]?.innerText || e.placeholder || e.getAttribute('aria-label') || '').slice(0,100),
                   auto: e.autocomplete || '' };
        })()`);
        if (!champ) throw new MachineError(`Champ introuvable : ${selecteur}`);

        const signature = `${champ.type} ${champ.nom} ${champ.id} ${champ.libelle} ${champ.auto}`;
        if (champ.type === 'password' || CHAMP_SECRET.test(signature))
          throw new MachineError(
            `C'est un champ de secret (« ${champ.libelle || champ.nom || champ.type} »). Je n'y touche pas : ` +
            `un agent qui saisit des identifiants est un agent dont une page piégée peut les voler. ` +
            `Remplis-le toi-même, je reprends après.`);

        await evaluer(envoyer, `(() => {
          const e = document.querySelector(${JSON.stringify(selecteur)});
          e.focus();
          e.value = ${JSON.stringify(v)};
          e.dispatchEvent(new Event('input', { bubbles: true }));
          e.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`);
        return { resume: `Champ « ${champ.libelle || selecteur} » rempli (${v.length} caractères)`,
                 preuve: { genre: 'navigateur', action: 'remplir', champ: champ.libelle || selecteur, longueur: v.length } };
      });
    }
  },

  navigateur_capturer: {
    groupe: 'navigateur',
    description: 'Prend une capture de la page en cours, utile pour montrer à la personne ce qu\'elle voit. Paramètre : profil.',
    async run({ profil = 'clipia' }) {
      const port = await portPour(profil);
      const t = await ongletCourant(port);
      return await surOnglet(t, async (envoyer) => {
        await envoyer('Page.enable');
        const r = await envoyer('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        if (!r?.data) throw new MachineError('Capture vide.');
        const buf = Buffer.from(r.data, 'base64');
        const nom = `capture_${Date.now()}.png`;
        const sortie = path.join(MEDIA_DIR, nom);
        fs.writeFileSync(sortie, buf);
        return { resume: `Capture enregistrée (${Math.round(buf.length / 1024)} Ko)`,
                 preuve: { genre: 'fichier', chemin: sortie, octets: buf.length },
                 donnees: { url: `/media/${nom}`, fichier: sortie } };
      });
    }
  },

  navigateur_etat: {
    groupe: 'navigateur',
    description: 'Dit si Chrome est joignable, lequel, et quels onglets sont ouverts. Aucun paramètre.',
    async run() {
      const bin = trouverChrome();
      const lignes = [`Chrome trouvé : ${bin || 'non — installe Chrome ou Edge'}`];
      for (const [nom, port] of [['Chrome de Clipia', PORT_CLIPIA], ['ton Chrome', PORT_PERSONNE]]) {
        const v = await versionSur(port);
        if (!v) { lignes.push(`${nom} (port ${port}) : fermé`); continue; }
        const l = await onglets(port).catch(() => []);
        lignes.push(`${nom} (port ${port}) : ${v.Browser || 'ouvert'} — ${l.length} onglet(s)`);
        for (const t of l.slice(0, 6)) lignes.push(`   · ${(t.title || '').slice(0, 70)} — ${t.url.slice(0, 80)}`);
      }
      return { resume: lignes.join('\n'),
               preuve: { genre: 'etat-navigateur', chrome: Boolean(bin) },
               donnees: { chrome: bin } };
    }
  }
};

export async function etatNavigateur() {
  const bin = trouverChrome();
  const prof = {};
  for (const [k, port] of [['clipia', PORT_CLIPIA], ['moi', PORT_PERSONNE]]) {
    const v = await versionSur(port);
    prof[k] = { port, ouvert: Boolean(v), navigateur: v?.Browser || null,
                onglets: v ? (await onglets(port).catch(() => [])).length : 0 };
  }
  return {
    chrome: bin, pret: Boolean(bin) && typeof WebSocket !== 'undefined',
    wsNatif: typeof WebSocket !== 'undefined', node: process.versions.node,
    profils: prof, outils: Object.keys(OUTILS_NAVIGATEUR)
  };
}
