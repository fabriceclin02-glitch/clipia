/** Détection du mot d'appel « Clipia » dans une transcription (tolérante aux erreurs de reconnaissance). */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

const VARIANTES = 'clipia|clippia|clipya|clipea|klipia|clipiya|clipiat|clipias|clip ia|cli pia|clip pia|cleepia|clipi a';
const APPEL = new RegExp('(?:^|\\s)(?:(?:hey|he|ok|okay|dis|salut|ohe|bonjour)\\s+)?(' + VARIANTES + ')(?=\\s|$)');
const BRUT = new RegExp('(?:' + VARIANTES.replace(/ /g, '[\\s\\-]?') + ')(?![a-zà-ÿ])', 'i');

/** @returns {{trouve:boolean, reste:string}} reste = ce qui a été dit après l'appel (texte d'origine, accents conservés) */
export function detecterAppel(texte) {
  const trouve = APPEL.test(norm(texte));
  if (!trouve) return { trouve: false, reste: '' };
  const brut = String(texte || '');
  const m = BRUT.exec(brut);
  let reste = m ? brut.slice(m.index + m[0].length) : '';
  reste = reste.replace(/^[\s,.!?:;'’\-–—…]+/, '').replace(/^(s'il te pla[iî]t|s'il vous pla[iî]t|tu es là|es-tu là|vous êtes là)[\s,.!?]*/i, '').trim();
  return { trouve: true, reste };
}
