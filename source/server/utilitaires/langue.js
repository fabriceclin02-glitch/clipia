/**
 * CLIPIA — Traduction et transcription, par les voies gratuites.
 *
 * Traduire : n’importe quel modèle de langue le fait bien, y compris un
 * petit modèle local de 400 Mo. Donc aucune raison de payer, et aucune
 * raison d’envoyer ton texte à un service qui le garde : si un modèle
 * local est installé, Clipia le préfère et rien ne sort de la machine.
 *
 * Transcrire : la parole vers le texte demande un modèle spécialisé.
 * Trois voies, de la plus privée à la plus simple — whisper.cpp en local,
 * Groq Whisper qui est gratuit et très rapide, ou un modèle local via
 * Ollama. Clipia prend la première disponible et dit laquelle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROVIDERS, byId, baseUrl } from '../providers/registry.js';
import { credential, chat } from '../providers/gateway.js';
import { binaire, ffmpegBin } from '../lib/env.js';
import { MEDIA_DIR } from '../providers/media.js';
import { store, uid } from '../lib/store.js';

export const LANGUES = {
  fr:'français', en:'anglais', es:'espagnol', de:'allemand', it:'italien',
  pt:'portugais', nl:'néerlandais', pl:'polonais', ru:'russe', uk:'ukrainien',
  ar:'arabe', he:'hébreu', tr:'turc', zh:'chinois (simplifié)', ja:'japonais',
  ko:'coréen', hi:'hindi', bn:'bengali', id:'indonésien', vi:'vietnamien',
  th:'thaï', sv:'suédois', da:'danois', no:'norvégien', fi:'finnois',
  cs:'tchèque', el:'grec', ro:'roumain', hu:'hongrois', ca:'catalan',
  eu:'basque', wo:'wolof', sw:'swahili', ber:'berbère (tamazight)'
};

export const REGISTRES = {
  neutre:    'Ton neutre et clair.',
  soutenu:   'Registre soutenu, pour un courrier officiel ou un contrat.',
  familier:  'Registre familier, comme on parle entre proches.',
  commercial:'Ton commercial : direct, concret, orienté bénéfice client.',
  technique: 'Vocabulaire technique exact, sans vulgarisation.',
  artistique:'Liberté de formulation pour garder le rythme et l’image, quitte à s’écarter du mot à mot.'
};

/** Quel fournisseur utiliser, en préférant ce qui ne sort pas de la machine. */
async function choisir() {
  const local = PROVIDERS.filter(p => p.tier === 'local-gratuit' && p.kind === 'openai' && p.base !== 'local');
  for (const p of local) {
    try {
      const r = await fetch(`${baseUrl(p)}/models`, { signal: AbortSignal.timeout(2500) });
      if (r.ok) {
        const j = await r.json();
        const m = j.data?.[0]?.id;
        if (m) return { id: p.id, modele: m, prive: true,
          pourquoi: `${p.label} tourne sur cette machine : ton texte ne sort pas d’ici.` };
      }
    } catch { /* suivant */ }
  }
  // Ollama a sa propre API.
  try {
    const o = byId('ollama');
    const r = await fetch(`${baseUrl(o)}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const j = await r.json();
      const m = (j.models || [])[0]?.name;
      if (m) return { id: 'ollama', modele: m, prive: true,
        pourquoi: `Ollama tourne ici avec ${m} : ton texte ne sort pas de la machine.` };
    }
  } catch { /* suivant */ }

  // Sinon, le premier service gratuit configuré.
  const gratuits = PROVIDERS.filter(p =>
    (p.tier === 'sans-cle' || p.tier === 'cloud-gratuit') && p.kind === 'openai');
  for (const p of gratuits) {
    if (credential(p)) return { id: p.id, modele: p.models[0], prive: false,
      pourquoi: `${p.label} est configuré. Le texte transite par ce service — à éviter pour un document confidentiel.` };
  }
  throw new Error('Aucun modèle disponible pour traduire. Le plus simple : télécharger un petit modèle local depuis « Modèles locaux » — 400 Mo suffisent, et plus rien ne quitte ta machine.');
}

export async function traduire({ texte, vers = 'en', depuis = 'auto', registre = 'neutre', fournisseur }) {
  if (!texte?.trim()) throw new Error('Rien à traduire.');
  if (!LANGUES[vers]) throw new Error(`Langue inconnue : ${vers}.`);

  const voie = fournisseur
    ? { id: fournisseur, modele: byId(fournisseur)?.models?.[0], prive: byId(fournisseur)?.tier === 'local-gratuit' }
    : await choisir();

  const consigne =
    `Traduis le texte suivant en ${LANGUES[vers]}` +
    (depuis !== 'auto' && LANGUES[depuis] ? ` depuis le ${LANGUES[depuis]}` : '') + '.\n' +
    `${REGISTRES[registre] || REGISTRES.neutre}\n` +
    'Rends uniquement la traduction, sans guillemets, sans commentaire, sans préambule. ' +
    'Conserve la mise en forme : sauts de ligne, listes, ponctuation. ' +
    'Ne traduis pas les noms propres, les marques, les adresses ni les extraits de code.';

  let r;
  try {
    r = await chat(voie.id, {
      model: voie.modele, temperature: 0.2,
      messages: [{ role: 'system', content: consigne }, { role: 'user', content: texte }]
    });
  } catch (e) {
    // « fetch failed » n’apprend rien : on dit ce qui s’est passé et quoi faire.
    const cause = e.cause ? `${e.cause.code || ''}`.trim() : '';
    const reseau = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|timeout/i.test(e.message + cause);
    throw new Error(reseau
      ? `${voie.id} n’a pas répondu${cause ? ` (${cause})` : ''}. Soit le service est injoignable, soit la connexion est coupée. Un modèle local installé depuis « Modèles locaux » traduit sans aucun réseau — c’est la solution durable.`
      : `${voie.id} a refusé la demande : ${e.message.slice(0, 200)}`);
  }

  // Certains modèles encadrent malgré la consigne : on retire les guillemets
  // d’enrobage, sans toucher à ceux qui font partie du texte.
  const sortie = String(r.text || '').trim().replace(/^["«»]\s*|\s*["«»]$/g, '').trim();

  return {
    traduction: sortie, vers, depuis, registre,
    langueCible: LANGUES[vers],
    par: voie.id, modele: voie.modele, prive: Boolean(voie.prive),
    confidentialite: voie.pourquoi || (voie.prive
      ? 'Traduit sur cette machine : rien n’est sorti.'
      : 'Traduit par un service distant.'),
    caracteres: { avant: texte.length, apres: sortie.length }
  };
}

/** ── TRANSCRIPTION ───────────────────────────────────────────────────── */

function enWav16k(chemin) {
  const out = path.join(MEDIA_DIR, `${uid('tr')}.wav`);
  const r = spawnSync(ffmpegBin(), ['-y','-v','error','-i', chemin,
    '-ac','1','-ar','16000','-c:a','pcm_s16le', out], { encoding:'utf8', timeout: 300000, windowsHide: true });
  if (r.status !== 0) throw new Error('Conversion de l’audio impossible : ' + String(r.stderr).slice(0, 200));
  return out;
}

const hms = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), q = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${q.toFixed(3).padStart(6,'0')}`.replace('.', ',');
};

function srt(segments) {
  return segments.map((s, i) =>
    `${i + 1}\n${hms(s.start)} --> ${hms(s.end)}\n${s.text.trim()}\n`).join('\n');
}

export async function transcrire({ chemin, langue = 'fr', sousTitres = true }) {
  const wav = enWav16k(chemin);
  let segments = null, texte = '', par = '';

  // 1. whisper.cpp en local : rien ne sort de la machine.
  const wcpp = binaire('whisper-cli') || binaire('main') || binaire('whisper');
  if (wcpp) {
    const r = spawnSync(wcpp, ['-m', process.env.WHISPER_MODELE || 'models/ggml-base.bin',
      '-f', wav, '-l', langue, '-oj', '-of', wav.replace(/\.wav$/, '')],
      { encoding:'utf8', timeout: 900000, windowsHide: true });
    const js = wav.replace(/\.wav$/, '.json');
    if (r.status === 0 && fs.existsSync(js)) {
      const j = JSON.parse(fs.readFileSync(js, 'utf8'));
      segments = (j.transcription || []).map(t => ({
        start: t.offsets.from / 1000, end: t.offsets.to / 1000, text: t.text }));
      texte = segments.map(s => s.text).join(' ').trim();
      par = 'whisper.cpp, en local';
    }
  }

  // 2. Groq Whisper : gratuit, très rapide, mais l’audio transite.
  if (!texte) {
    const p = byId('groq-whisper') || byId('groq');
    const cle = p ? credential(p) : '';
    if (!cle) {
      try { fs.unlinkSync(wav); } catch {}
      throw new Error('Aucun moteur de transcription disponible. Deux voies gratuites : installer whisper.cpp pour que tout reste sur la machine, ou créer une clé Groq — gratuite — dans Coffre, ce qui prend deux minutes.');
    }
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), 'audio.wav');
    fd.append('model', 'whisper-large-v3');
    fd.append('language', langue);
    fd.append('response_format', 'verbose_json');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { authorization: `Bearer ${cle}` }, body: fd,
      signal: AbortSignal.timeout(300000)
    });
    const t = await r.text();
    if (!r.ok) { try { fs.unlinkSync(wav); } catch {}; throw new Error(`Transcription refusée : ${t.slice(0, 220)}`); }
    const j = JSON.parse(t);
    texte = (j.text || '').trim();
    segments = (j.segments || []).map(s => ({ start: s.start, end: s.end, text: s.text }));
    par = 'Groq Whisper large v3 (gratuit)';
  }

  try { fs.unlinkSync(wav); } catch {}
  if (!texte) throw new Error('Aucune parole reconnue dans ce fichier.');

  let fichierSrt = null;
  if (sousTitres && segments?.length) {
    fichierSrt = path.join(MEDIA_DIR, `${uid('st')}.srt`);
    fs.writeFileSync(fichierSrt, srt(segments), 'utf8');
    store.insert('assets', {
      file: fichierSrt, ext: 'srt', bytes: fs.statSync(fichierSrt).size, kind: 'sous-titres',
      url: `/media/${path.basename(fichierSrt)}`, nom: 'Sous-titres', detail: { segments: segments.length }
    });
  }

  return {
    texte, par, langue,
    mots: texte.split(/\s+/).filter(Boolean).length,
    segments: segments?.length || 0,
    sousTitres: fichierSrt ? `/media/${path.basename(fichierSrt)}` : null,
    prive: par.includes('local'),
    confidentialite: par.includes('local')
      ? 'Transcrit sur cette machine : l’audio n’est pas sorti.'
      : 'L’audio a été envoyé au service pour être transcrit. À éviter pour un enregistrement confidentiel — whisper.cpp en local règle ce point.'
  };
}
