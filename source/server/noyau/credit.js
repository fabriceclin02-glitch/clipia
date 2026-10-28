/**
 * CLIPIA — Temps d'utilisation : 2 heures offertes pour tester, puis 5 € l'heure (paiement unique possible pour plusieurs heures).
 * On compte le TEMPS ACTIF (page ouverte, visible et utilisée), pas le temps où l'application dort en arrière-plan.
 * Tant que le paiement n'est pas configuré (version 6.0.5), rien n'est bloqué : on affiche seulement le compteur.
 */
import { store } from '../lib/store.js';

export const OFFERT_SEC = 2 * 3600;
export const PRIX_HEURE = 5;
export const PACKS = [1, 2, 5, 10, 20].map(h => ({ heures: h, prix: h * PRIX_HEURE }));
const K = 'credit';
const lire = () => ({ utiliseSec: 0, achatSec: 0, depuis: new Date().toISOString(), achats: [], ...(store.setting(K) || {}) });
const ecrire = (c) => store.setting(K, c);

export const paiement = () => ({ actif: false, fournisseur: 'stripe', lien: '', ...(store.setting('paiement') || {}) });
export const configurerPaiement = ({ actif, fournisseur, lien } = {}) => {
  const p = paiement();
  if (actif !== undefined) p.actif = Boolean(actif);
  if (fournisseur) p.fournisseur = String(fournisseur).slice(0, 20);
  if (lien !== undefined) { const l = String(lien).trim(); if (l && !/^https:\/\//i.test(l)) throw new Error('Le lien de paiement doit commencer par https://'); p.lien = l; }
  store.setting('paiement', p); return paiement();
};

export function etat() {
  const c = lire(); const p = paiement();
  const offertRestant = Math.max(0, OFFERT_SEC - c.utiliseSec);
  const depasse = Math.max(0, c.utiliseSec - OFFERT_SEC);
  const achatRestant = Math.max(0, c.achatSec - depasse);
  const restant = offertRestant + achatRestant;
  return {
    offertSec: OFFERT_SEC, utiliseSec: c.utiliseSec, offertRestantSec: offertRestant, achatRestantSec: achatRestant, restantSec: restant,
    epuise: restant <= 0, enEssai: offertRestant > 0 && c.achatSec === 0,
    prixHeure: PRIX_HEURE, packs: PACKS, achats: c.achats.slice(-20),
    paiementActif: p.actif && Boolean(p.lien), paiementConfigure: Boolean(p.lien), bloque: p.actif && Boolean(p.lien) && restant <= 0
  };
}
/** Un battement d'activité (≤ 60 s à la fois : impossible de gonfler ou vider le compteur d'un coup). */
export function battement(sec) {
  const s = Math.max(0, Math.min(60, Math.round(Number(sec) || 0)));
  const c = lire(); c.utiliseSec += s; ecrire(c); return etat();
}
/** À appeler après un paiement confirmé (webhook en 6.0.5). */
export function crediter(heures, reference = '') {
  const h = Math.max(0, Math.min(500, Number(heures) || 0)); if (!h) throw new Error('Nombre d\'heures invalide.');
  const c = lire(); c.achatSec += Math.round(h * 3600); c.achats.push({ quand: new Date().toISOString(), heures: h, montant: h * PRIX_HEURE, reference: String(reference).slice(0, 80) });
  ecrire(c); return etat();
}
/** Prépare un achat : le lien de paiement est celui configuré par le vendeur (Stripe Payment Link, etc.). */
export function acheter(heures) {
  const h = Math.max(1, Math.min(500, Math.round(Number(heures) || 0))); const p = paiement();
  const total = h * PRIX_HEURE;
  if (!p.actif || !p.lien) return { ok: false, enPreparation: true, heures: h, total, message: `Le paiement n'est pas encore activé (il arrive dans la prochaine version). Rien n'est débité. ${h} h = ${total} €.` };
  const u = new URL(p.lien); u.searchParams.set('client_reference_id', 'clipia-' + h + 'h'); u.searchParams.set('quantity', String(h));
  return { ok: true, heures: h, total, url: u.toString() };
}
