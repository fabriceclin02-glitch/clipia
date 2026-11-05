/* CLIPIA X10 — écran d'activation (licence à vie, 10 €). Bloque l'interface tant qu'aucun code valide n'est saisi. */
export function installerLicence({ el, esc, API }) {
  const H = { 'content-type': 'application/json', 'x-clipia-accord': '1' };
  document.head.append(el(`<style>#lic{position:fixed;inset:0;z-index:100000;background:radial-gradient(circle at 50% 0%,#2a1c7a,#070418 70%);display:grid;place-items:center;overflow:auto;padding:16px}
  #lic .b{width:min(520px,100%);background:#0e0a28ee;border:1px solid #6d4fd6;border-radius:22px;padding:26px;color:#fff;box-shadow:0 30px 90px #000c}
  #lic h1{margin:0 0 4px;font-size:26px}#lic .p{font-size:40px;font-weight:800;margin:10px 0 0}#lic .p small{font-size:14px;font-weight:500;opacity:.75}
  #lic ul{margin:10px 0 14px;padding-left:20px;opacity:.9;font-size:14px;line-height:1.55}#lic label{display:block;font-size:12.5px;opacity:.8;margin:10px 0 4px}
  #lic input,#lic textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #6d4fd6;background:#0d0a28;color:#fff;font:inherit}#lic textarea{height:72px;font-family:ui-monospace,monospace;font-size:12.5px}
  #lic .r{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}#lic button{padding:11px 16px;border-radius:12px;border:1px solid #6d4fd6;background:#ffffff10;color:#fff;font:inherit;font-weight:600;cursor:pointer}#lic button.or{background:linear-gradient(135deg,#7c5cff,#38bdf8);border:0}
  #lic .m{margin-top:10px;font-size:13px;min-height:18px}#lic .ko{color:#ff8c8c}#lic .ok{color:#38d9a9}</style>`));
  const monter = (e) => {
    if (document.getElementById('lic')) return;
    const f = el(`<div id="lic" role="dialog" aria-modal="true" aria-label="Activer Clipia X10"><div class="b">
      <img src="/assets/mascotte.svg" alt="Clipi, la mascotte de Clipia" width="120" style="display:block;margin:-6px auto 4px"><h1 style="text-align:center">Clipia X10</h1><div style="opacity:.8">Ton studio créatif IA qui écoute, réfléchit et crée.</div>
      <div class="p">10 € <small>une seule fois · à vie</small></div>
      <ul><li>Toutes les fonctions, toutes les mises à jour de la X10</li><li>Image, vidéo, voix, musique, montage, prise en main du PC</li><li>Discussion depuis ton téléphone (QR code)</li><li>Fonctionne sur Windows, Mac et Linux</li></ul>
      <div class="r"><button class="or" id="lic-a">Acheter ma licence — 10 €</button></div>
      <label>E-mail utilisé pour le paiement</label><input id="lic-e" type="email" autocomplete="email" placeholder="toi@exemple.fr">
      <label>Code de licence reçu après le paiement</label><textarea id="lic-c" placeholder="CLIPX-XXXXX-XXXXX-…" spellcheck="false"></textarea>
      <div class="r"><button id="lic-v">Activer</button></div><div class="m" id="lic-m"></div></div></div>`);
    document.body.append(f); const q = s => f.querySelector(s);
    q('#lic-a').onclick = () => window.open(e.urlAchat, '_blank', 'noopener');
    q('#lic-v').onclick = async () => {
      const m = q('#lic-m'); m.className = 'm'; m.textContent = 'Vérification…';
      try { const r = await fetch(API + '/api/licence/activer', { method: 'POST', headers: H, body: JSON.stringify({ email: q('#lic-e').value, code: q('#lic-c').value }) }).then(x => x.json());
        if (r.ok) { m.className = 'm ok'; m.textContent = 'Licence activée. Merci !'; setTimeout(() => location.reload(), 900); } else { m.className = 'm ko'; m.textContent = r.raison || 'Code refusé.'; }
      } catch (er) { m.className = 'm ko'; m.textContent = 'Erreur : ' + er.message; }
    };
  };
  const verifier = async () => { try { const e = await fetch(API + '/api/licence/etat').then(x => x.json()); if (!e.active) monter(e); } catch {} };
  verifier();
  const ofetch = window.fetch; window.fetch = async (...a) => { const r = await ofetch(...a); if (r.status === 402) verifier(); return r; };   // une réponse « licence requise » rouvre l'écran
}
