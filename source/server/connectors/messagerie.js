/**
 * CLIPIA — Pilotage entrant par messagerie.
 *
 * Telegram fonctionne par interrogation longue (getUpdates) : aucune adresse
 * publique n'est nécessaire, donc cela marche depuis un ordinateur personnel.
 * WhatsApp exige que Meta puisse appeler votre serveur : il faut une adresse
 * HTTPS publique (serveur ou tunnel), d'où le point d'entrée webhook plus bas.
 */
import fs from 'node:fs';
import { vault } from '../lib/vault.js';
import { store } from '../lib/store.js';
import { envoyerTelegram, envoyerWhatsApp } from './publish.js';

let boucle = null, offset = 0, enMarche = false;

const jeton = () => vault.resolve('connector:telegram:id', 'TELEGRAM_BOT_TOKEN');

/** Qui a le droit de piloter Clipia. Vide = personne tant que vous n'avez pas validé. */
export const autorises = () => store.setting('messagerie:autorises') || [];
export function autoriser(id) {
  const l = new Set(autorises()); l.add(String(id));
  store.setting('messagerie:autorises', [...l]); return [...l];
}
export function retirerAutorisation(id) {
  store.setting('messagerie:autorises', autorises().filter(x => x !== String(id)));
  return autorises();
}

export const etatMessagerie = () => ({
  enMarche,
  configure: Boolean(jeton()),
  autorises: autorises(),
  recus: store.filter('events', e => e.type === 'messagerie.recu').length
});

/**
 * Démarre l'écoute Telegram. `traiter(texte, contexte)` doit renvoyer la réponse.
 */
export function demarrer(traiter) {
  const t = jeton();
  if (!t) throw new Error('Jeton Telegram absent. Créez un bot avec @BotFather, puis enregistrez son jeton dans le coffre.');
  if (enMarche) return { deja: true };
  enMarche = true;
  store.insert('events', { type: 'messagerie.demarree' });

  (async function tourner() {
    while (enMarche) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${t}/getUpdates?offset=${offset}&timeout=30`,
          { signal: AbortSignal.timeout(40000) });
        const j = await r.json();
        if (!j.ok) { await pause(5000); continue; }

        for (const u of j.result || []) {
          offset = u.update_id + 1;
          const msg = u.message || u.edited_message;
          if (!msg?.text) continue;
          const de = String(msg.chat.id);
          const texte = msg.text.trim();

          store.insert('events', { type: 'messagerie.recu', de, apercu: texte.slice(0, 80) });

          // Première prise de contact : on ne laisse pas n'importe qui piloter.
          if (!autorises().length && /^\/start/i.test(texte)) {
            await envoyerTelegram({ canal: de, texte:
              `<b>Clipia</b>\n\nVotre identifiant de conversation est <code>${de}</code>.\n\n` +
              `Pour m'autoriser à vous obéir, ouvrez Clipia sur votre ordinateur, allez dans <b>Messagerie</b> et ajoutez cet identifiant.` });
            continue;
          }
          if (!autorises().includes(de)) {
            await envoyerTelegram({ canal: de, texte:
              `Je ne vous connais pas encore. Votre identifiant est <code>${de}</code> — ajoutez-le dans Clipia, section Messagerie.` });
            continue;
          }

          if (/^\/(aide|help|start)$/i.test(texte)) {
            await envoyerTelegram({ canal: de, texte:
              `<b>Clipia à vos ordres</b>\n\nÉcrivez simplement ce que vous voulez :\n` +
              `• « génère une pochette sombre avec un corbeau »\n` +
              `• « fais-moi un site vitrine pour mon activité »\n` +
              `• « où en sont mes productions ? »\n\n` +
              `<b>/etat</b> — ce qui tourne en ce moment\n<b>/stop</b> — je cesse d'écouter` });
            continue;
          }
          if (/^\/stop$/i.test(texte)) {
            await envoyerTelegram({ canal: de, texte: 'Je cesse d\'écouter. Relancez-moi depuis Clipia.' });
            arreter(); continue;
          }

          await envoyerTelegram({ canal: de, texte: '…' }).catch(() => {});
          try {
            const reponse = await traiter(texte, { canal: 'telegram', de });
            await envoyerTelegram({ canal: de, texte: String(reponse || 'Fait.').slice(0, 3800) });
            if (reponse?.fichier && fs.existsSync(reponse.fichier))
              await envoyerTelegram({ canal: de, cheminVideo: reponse.fichier, texte: 'Voici le rendu.' });
          } catch (e) {
            await envoyerTelegram({ canal: de, texte: '⚠ ' + String(e.message).slice(0, 500) });
          }
        }
      } catch { await pause(4000); }
    }
  })();

  return { enMarche: true };
}

export function arreter() {
  enMarche = false;
  if (boucle) clearTimeout(boucle);
  store.insert('events', { type: 'messagerie.arretee' });
  return { enMarche: false };
}

const pause = ms => new Promise(r => { boucle = setTimeout(r, ms); });

/** Point d'entrée WhatsApp (Meta appelle cette adresse — il faut une URL publique). */
export async function webhookWhatsApp(corps, traiter) {
  const msg = corps?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg?.text?.body) return { ignore: true };
  const de = msg.from;
  store.insert('events', { type: 'messagerie.recu', de, canal: 'whatsapp', apercu: msg.text.body.slice(0, 80) });
  if (!autorises().includes(String(de))) {
    await envoyerWhatsApp({ destinataire: de, texte: `Je ne vous connais pas. Votre numéro est ${de} — ajoutez-le dans Clipia, section Messagerie.` });
    return { refuse: true };
  }
  const reponse = await traiter(msg.text.body, { canal: 'whatsapp', de });
  await envoyerWhatsApp({ destinataire: de, texte: String(reponse || 'Fait.').slice(0, 3800) });
  return { ok: true };
}
