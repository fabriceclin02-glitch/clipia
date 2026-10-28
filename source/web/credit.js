/* CLIPIA — compteur de temps du CABINET DE PSYCHOLOGUES uniquement (2 h offertes, puis 5 €/h). Le reste de Clipia reste libre. Pastille en haut, fenêtre « Mon temps », battements d'activité. */
export function installerCredit({ $, el, esc, api, toast }) {
  if (document.getElementById('cr-pastille')) return;
  const H = { 'x-clipia-accord': '1' };
  document.head.append(el(`<style>
  #cr-pastille{display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-right:8px;border:1px solid #6d4fd6;border-radius:99px;padding:4px 11px;font-size:12.5px;font-weight:600;background:#16295f;color:#fff}
  #cr-pastille.bas{background:#7a3d12;border-color:#ffb36b}#cr-pastille.vide{background:#7f1d1d;border-color:#ff8c8c}
  #cr-fen{position:fixed;inset:0;z-index:98;background:#000b;display:none;place-items:center}#cr-fen.o{display:grid}
  #cr-boite{width:min(520px,94vw);max-height:90vh;overflow:auto;background:#0e0a28;border:1px solid #6d4fd6;border-radius:20px;padding:22px;color:#fff;box-shadow:0 30px 80px #000c}
  #cr-boite h2{margin:0 0 6px}.cr-barre{height:10px;border-radius:99px;background:#ffffff1f;overflow:hidden;margin:10px 0}.cr-barre i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#38bdf8)}
  .cr-packs{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin:10px 0}
  .cr-packs button{padding:10px 6px;border-radius:12px;border:1px solid #6d4fd6;background:#ffffff0d;color:#fff;cursor:pointer;font:inherit}.cr-packs button.on{background:#4b3bb0;border-color:#a99bff}
  .cr-packs b{display:block;font-size:16px}.cr-packs small{opacity:.75}
  #cr-boite input[type=number]{width:84px;padding:7px 9px;border-radius:9px;border:1px solid #6d4fd6;background:#0d0a28;color:#fff;font:inherit}
  </style>`));
  const pastille = el('<span id="cr-pastille" role="button" tabindex="0" title="Mon temps d\'utilisation">⏱ …</span>');
  const pousse = document.querySelector('.entete .pousse'); (pousse || document.querySelector('.entete')).prepend(pastille);
  const fen = el('<div id="cr-fen"><div id="cr-boite"></div></div>'); document.body.append(fen);
  let E = null, heuresChoisies = 1;
  // Le compteur ne concerne que le cabinet : la vue #/cabinet et les séances (?psy=…).
  const enCabinet = () => /^#\/cabinet|[?&]psy=/.test(location.hash);
  const montrer = () => { pastille.style.display = enCabinet() ? '' : 'none'; };
  montrer();
  const hm = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`; };
  const majPastille = () => {
    if (!E) return; pastille.textContent = E.epuise ? '⏱ Temps épuisé' : `⏱ ${hm(E.restantSec)} ${E.enEssai ? 'offertes' : 'restantes'}`;
    pastille.classList.toggle('vide', E.epuise); pastille.classList.toggle('bas', !E.epuise && E.restantSec < 900);
  };
  async function charger() { try { E = await api('/api/credit'); majPastille(); if (fen.classList.contains('o')) dessiner(); } catch {} }
  function dessiner() {
    if (!E) return; const pct = Math.round(Math.min(100, E.restantSec / (E.offertSec + E.achatRestantSec) * 100));
    const h = heuresChoisies;
    $('#cr-boite', fen).innerHTML = `<h2>⏱ Mon temps au cabinet de psychologues</h2>
      <div>${E.epuise ? '<b style="color:#ff8c8c">Ton temps est épuisé.</b>' : `Il te reste <b>${hm(E.restantSec)}</b>${E.enEssai ? ' sur tes <b>2 heures offertes</b>' : ''}.`}</div>
      <div class="cr-barre"><i style="width:${E.epuise ? 0 : pct}%"></i></div>
      <p class="petit" style="font-size:12.5px;opacity:.8">Cette offre ne concerne que le <b>cabinet de psychologues</b> : tout le reste de Clipia reste libre et gratuit. Le compteur ne tourne que pendant tes séances (fenêtre ouverte et active). Après les 2 heures offertes : <b>${E.prixHeure} € l'heure</b>, en un seul paiement pour une ou plusieurs heures.</p>
      <h3 style="margin:14px 0 4px">Ajouter des heures</h3>
      <div class="cr-packs">${E.packs.map(p => `<button data-h="${p.heures}" class="${p.heures === h ? 'on' : ''}"><b>${p.heures} h</b><small>${p.prix} €</small></button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Ou un autre nombre : <input type="number" id="cr-n" min="1" max="500" value="${h}"> h = <b id="cr-tot">${h * E.prixHeure} €</b></div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn or" id="cr-payer">Payer ${h * E.prixHeure} € (${h} h)</button><button class="btn" id="cr-x">Fermer</button></div>
      <div id="cr-msg" class="petit" style="margin-top:10px;font-size:12.5px"></div>
      ${E.paiementActif ? '' : '<div class="petit" style="margin-top:8px;font-size:12px;opacity:.75">Paiement bientôt activé : en attendant, rien n\'est bloqué et rien n\'est débité.</div>'}`;
    const maj = n => { heuresChoisies = Math.max(1, Math.min(500, Math.round(+n) || 1)); dessiner(); };
    $('#cr-boite', fen).querySelectorAll('[data-h]').forEach(b => b.onclick = () => maj(b.dataset.h));
    $('#cr-n', fen).onchange = ev => maj(ev.target.value);
    $('#cr-x', fen).onclick = () => fen.classList.remove('o');
    $('#cr-payer', fen).onclick = async () => {
      const m = $('#cr-msg', fen); m.textContent = '…';
      try { const r = await api('/api/credit/acheter', { method: 'POST', headers: H, body: JSON.stringify({ heures: heuresChoisies }) });
        if (r.ok && r.url) { m.textContent = 'Ouverture du paiement sécurisé…'; window.open(r.url, '_blank', 'noopener'); } else m.textContent = r.message || 'Paiement indisponible.';
      } catch (e) { m.textContent = e.message; }
    };
  }
  const ouvrir = () => { dessiner(); fen.classList.add('o'); };
  pastille.onclick = ouvrir; pastille.onkeydown = ev => { if (ev.key === 'Enter') ouvrir(); };
  fen.addEventListener('click', ev => { if (ev.target === fen) fen.classList.remove('o'); });
  window.clipiaCredit = { ouvrir, recharger: charger };

  // battements : 30 s d'activité réelle (page visible + un geste dans les 2 dernières minutes)
  let dernierGeste = Date.now();
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, () => { dernierGeste = Date.now(); }, { passive: true });
  let dejaAvertiBas = false, dejaAvertiVide = false;
  setInterval(async () => {
    if (!enCabinet() || document.hidden || Date.now() - dernierGeste > 120000) return;
    try {
      E = await api('/api/credit/battement', { method: 'POST', headers: H, body: JSON.stringify({ sec: 30 }) }); majPastille();
      if (E.restantSec < 600 && E.restantSec > 0 && !dejaAvertiBas) { dejaAvertiBas = true; toast('Il te reste moins de 10 minutes. Clique sur ⏱ pour ajouter des heures.'); }
      if (E.epuise && !dejaAvertiVide) { dejaAvertiVide = true; ouvrir(); }
    } catch {}
  }, 30000);
  charger();
  addEventListener('hashchange', () => { montrer(); setTimeout(charger, 300); });
}
