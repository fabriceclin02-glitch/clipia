/* CLIPIA X10 — Clipia est gratuite. Ce panneau ne sert qu'à l'OPTION DÉVELOPPEUR (9,90 € / mois, paiement PayPal). */
export function installerLicence({ el, esc, API }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>#dev-ov{position:fixed;inset:0;z-index:100000;background:#000b;display:grid;place-items:center;overflow:auto;padding:16px}
  #dev-ov .b{width:min(500px,100%);background:#0e0a28;border:1px solid #6d4fd6;border-radius:22px;padding:24px;color:#fff;box-shadow:0 30px 90px #000c;position:relative}
  #dev-ov h1{margin:0 0 4px;font-size:24px}#dev-ov .p{font-size:34px;font-weight:800;margin:8px 0 0}#dev-ov .p small{font-size:14px;font-weight:500;opacity:.75}
  #dev-ov ul{margin:10px 0 12px;padding-left:20px;opacity:.9;font-size:14px;line-height:1.55}#dev-ov label{display:block;font-size:12.5px;opacity:.8;margin:10px 0 4px}
  #dev-ov input,#dev-ov textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #6d4fd6;background:#0d0a28;color:#fff;font:inherit}#dev-ov textarea{height:70px;font-family:ui-monospace,monospace;font-size:12.5px}
  #dev-ov .r{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}#dev-ov button{padding:10px 15px;border-radius:12px;border:1px solid #6d4fd6;background:#ffffff10;color:#fff;font:inherit;font-weight:600;cursor:pointer}#dev-ov button.or{background:linear-gradient(135deg,#7c5cff,#38bdf8);border:0}
  #dev-ov .x{position:absolute;right:12px;top:10px;padding:2px 9px}#dev-ov .m{margin-top:10px;font-size:13px;min-height:18px}#dev-ov .ko{color:#ff8c8c}#dev-ov .ok{color:#38d9a9}
  #btnDev{position:fixed;right:70px;bottom:16px;z-index:9999;height:46px;padding:0 14px;border-radius:23px;border:1px solid #38bdf8;background:#0b1a3aee;color:#9be3ff;font:600 13px ui-monospace,monospace;cursor:pointer;box-shadow:0 6px 20px #0008}#btnDev:hover{background:#12356b}</style>`));
  const monter = async () => {
    if (document.getElementById('dev-ov')) return;
    let e = {}; try { e = await fetch(API + '/api/licence/etat').then(x => x.json()); } catch {}
    const f = el(`<div id="dev-ov" role="dialog" aria-modal="true" aria-label="Option développeur"><div class="b"><button class="x" id="dev-x" aria-label="Fermer">✕</button>
      <img src="/assets/mascotte.svg" alt="Clipia" width="90" style="display:block;margin:-4px auto 2px"><h1 style="text-align:center">Option développeur</h1>
      <div style="text-align:center;opacity:.8">Clipia reste gratuite. Cette option ajoute les outils pour coder.</div>
      <div class="p" style="text-align:center">9,90 € <small>par mois · résiliable à tout moment</small></div>
      <ul><li>Clipia lit et améliore son propre code (avec ton accord, sauvegarde et annulation)</li><li>Serveur MCP : brancher Clipia à tes outils de code</li><li>Aide prioritaire pour tes projets</li></ul>
      ${e.dev ? `<div class="m ok">Option développeur active jusqu'au ${esc(e.devJusqu || '—')}.</div>` : ''}
      <div class="r"><button class="or" id="dev-a">S'abonner avec PayPal</button></div>
      <label>E-mail utilisé pour le paiement PayPal</label><input id="dev-e" type="email" autocomplete="email" placeholder="toi@exemple.fr">
      <label>Code reçu par e-mail après ton paiement</label><textarea id="dev-c" placeholder="CLIPX-XXXXX-XXXXX-…" spellcheck="false"></textarea>
      <div class="r"><button id="dev-v">Activer</button></div><div class="m" id="dev-m"></div></div></div>`);
    document.body.append(f); const q = s => f.querySelector(s);
    q('#dev-x').onclick = () => f.remove(); f.addEventListener('click', ev => { if (ev.target === f) f.remove(); });
    q('#dev-a').onclick = () => window.open(e.urlAchat || 'https://fabriceclin02-glitch.github.io/clipia/developpeur.html', '_blank', 'noopener');
    q('#dev-v').onclick = async () => {
      const m = q('#dev-m'); m.className = 'm'; m.textContent = 'Vérification…';
      try { const r = await fetch(API + '/api/licence/activer', { method: 'POST', headers: H, body: JSON.stringify({ email: q('#dev-e').value, code: q('#dev-c').value }) }).then(x => x.json());
        if (r.ok) { m.className = 'm ok'; m.textContent = "Option développeur activée jusqu'au " + (r.devJusqu || '—') + '. Merci !'; setTimeout(() => f.remove(), 1600); } else { m.className = 'm ko'; m.textContent = r.raison || 'Code refusé.'; }
      } catch (er) { m.className = 'm ko'; m.textContent = 'Erreur : ' + er.message; }
    };
  };
  window.ouvrirOptionDev = monter;
  if (!document.getElementById('btnDev')) { const b = el('<button id="btnDev" type="button" title="Option développeur (9,90 €/mois)">&lt;/&gt; Dév</button>'); b.onclick = monter; document.body.append(b); }
}
