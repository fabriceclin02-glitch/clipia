/**
 * CLIPIA — La voix. Du plus naturel au plus disponible.
 *
 * La voix du navigateur (Web Speech) fonctionne partout et ne coûte rien,
 * mais sous Windows elle sonne comme un GPS de 2010 : débit plat, liaisons
 * ratées, intonation absente. C'est elle qui donnait à Clipia son air de
 * machine, bien plus que le texte qu'elle prononçait.
 *
 * On essaie donc, dans l'ordre, ce qui existe de mieux :
 *
 *   1. OpenAI TTS — les voix les plus naturelles aujourd'hui, mais payantes
 *      et il faut une clé. Prises en premier si la clé est là.
 *   2. Pollinations — les mêmes voix, servies gratuitement et sans clé.
 *      C'est la bonne surprise : du naturel sans rien payer ni configurer.
 *   3. La voix du navigateur — le filet de sécurité. Moins belle, mais
 *      toujours disponible, et elle ne dépend d'aucun réseau.
 *
 * Chaque réponse dit quelle voie a servi : savoir qu'on entend le filet de
 * sécurité explique pourquoi ça sonne mécanique, et indique quoi faire.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';
import { byId } from '../providers/registry.js';
import { credential } from '../providers/gateway.js';

/**
 * Les voix. Ce sont celles d'OpenAI, servies aussi par Pollinations.
 * Les descriptions viennent de l'écoute, pas de la documentation.
 */
export const VOIX = {
  nova:    { nom: 'Nova',    genre: 'féminine', quoi: 'Claire et vive. Le meilleur compromis pour une conversation en français.', defaut: true },
  shimmer: { nom: 'Shimmer', genre: 'féminine', quoi: 'Plus douce et posée. Agréable pour les textes longs.' },
  coral:   { nom: 'Coral',   genre: 'féminine', quoi: 'Chaleureuse, un peu plus ronde.' },
  alloy:   { nom: 'Alloy',   genre: 'neutre',   quoi: 'Neutre et sobre. Convient quand la voix doit s’effacer.' },
  echo:    { nom: 'Echo',    genre: 'masculine',quoi: 'Posée, un peu grave.' },
  onyx:    { nom: 'Onyx',    genre: 'masculine',quoi: 'Grave et ample. La plus présente.' },
  fable:   { nom: 'Fable',   genre: 'neutre',   quoi: 'Conteuse, avec du relief dans l’intonation.' },
  verse:   { nom: 'Verse',   genre: 'neutre',   quoi: 'Expressive, bonne pour une lecture animée.' }
};

const nettoyer = (t) => String(t || '')
  .replace(/\[\[action:[^\]]*\]\]/gi, '')      // les marqueurs techniques ne se prononcent pas
  .replace(/[*_#`]+/g, '')                      // ni les astérisques du markdown
  .replace(/\s+/g, ' ')
  .trim();

/** OpenAI : les voix les plus naturelles, si la clé est là. */
async function parOpenAI(texte, voix) {
  const p = byId('openai-tts') || byId('openai');
  const cle = p ? credential(p) : '';
  if (!cle) throw new Error('pas de clé OpenAI');
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${cle}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: voix, input: texte, response_format: 'mp3' }),
    signal: AbortSignal.timeout(60000)
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status} : ${(await r.text()).slice(0, 160)}`);
  return { buffer: Buffer.from(await r.arrayBuffer()), ext: 'mp3', par: 'OpenAI', gratuit: false };
}

/** Pollinations : les mêmes voix, gratuitement et sans clé. */
async function parPollinations(texte, voix) {
  const url = `https://text.pollinations.ai/${encodeURIComponent(texte)}` +
              `?model=openai-audio&voice=${encodeURIComponent(voix)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`Pollinations ${r.status}`);
  const type = r.headers.get('content-type') || '';
  const buf = Buffer.from(await r.arrayBuffer());
  // Un service qui renvoie du texte au lieu d'un son signale une erreur :
  // sans ce contrôle on écrirait un message d'erreur dans un fichier .mp3.
  if (!/audio|mpeg|mp3|wav|ogg/i.test(type) || buf.length < 2000)
    throw new Error(`réponse non audio (${type || 'type inconnu'}, ${buf.length} octets)`);
  return { buffer: buf, ext: /wav/i.test(type) ? 'wav' : 'mp3', par: 'Pollinations', gratuit: true };
}

/**
 * Synthétise. Essaie les voies dans l'ordre et dit laquelle a servi.
 * Si aucune ne répond, on ne lève pas d'erreur : on indique au navigateur
 * d'utiliser sa propre voix, pour que Clipia parle quand même.
 */
export async function parler({ texte, voix = 'nova', forcer = null }) {
  const propre = nettoyer(texte);
  if (!propre) throw new Error('Rien à prononcer.');
  if (propre.length > 4000) throw new Error('Texte trop long pour une seule synthèse (4000 caractères maximum).');
  if (!VOIX[voix]) voix = 'nova';

  const voies = forcer ? [forcer] : ['openai', 'pollinations'];
  const echecs = [];

  for (const voie of voies) {
    try {
      const r = voie === 'openai' ? await parOpenAI(propre, voix) : await parPollinations(propre, voix);
      const sortie = path.join(MEDIA_DIR, `${uid('voix')}.${r.ext}`);
      fs.writeFileSync(sortie, r.buffer);
      const asset = store.insert('assets', {
        file: sortie, ext: r.ext, bytes: r.buffer.length, kind: 'voix',
        url: `/media/${path.basename(sortie)}`,
        nom: `Voix ${VOIX[voix].nom}`,
        detail: { voix, par: r.par, gratuit: r.gratuit, caracteres: propre.length }
      });
      return { ...asset, voix, par: r.par, gratuit: r.gratuit, navigateur: false, echecs };
    } catch (e) { echecs.push({ voie, pourquoi: String(e.message).slice(0, 160) }); }
  }

  return {
    navigateur: true, voix, echecs,
    quoi: 'Aucune voix de synthèse distante n’a répondu. Le navigateur va lire avec sa propre voix : ' +
          'ça fonctionne hors ligne, mais le rendu est nettement plus mécanique.',
    pourAmeliorer: 'Pour une voix naturelle : soit Pollinations répond depuis ce réseau, soit une clé OpenAI dans le Coffre.'
  };
}

/** Ce que chaque voie exige, affiché dans l'application. */
export function etatVoix() {
  const o = byId('openai-tts') || byId('openai');
  const cleOpenAI = Boolean(o && credential(o));
  return {
    voix: VOIX,
    voies: [
      { id: 'openai', nom: 'OpenAI', naturel: 'excellent', cout: 'payant, environ 1 centime par minute',
        pret: cleOpenAI, quoi: cleOpenAI ? 'Clé présente : utilisée en premier.' : 'Ajoutez une clé OpenAI dans le Coffre pour l’activer.' },
      { id: 'pollinations', nom: 'Pollinations', naturel: 'excellent', cout: 'gratuit, aucune clé',
        pret: true, quoi: 'Mêmes voix qu’OpenAI, servies gratuitement. À vérifier depuis votre réseau : le bouton d’essai le fait.' },
      { id: 'navigateur', nom: 'Voix du navigateur', naturel: 'mécanique', cout: 'gratuit, hors ligne',
        pret: true, quoi: 'Toujours disponible, mais c’est elle qui donne l’impression d’une machine.' }
    ],
    ordre: cleOpenAI ? 'OpenAI, puis Pollinations, puis le navigateur.' : 'Pollinations, puis le navigateur.'
  };
}
