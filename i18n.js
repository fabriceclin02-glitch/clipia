/**
 * CLIPIA — sélecteur de langue.
 *
 * Il parcourt les nœuds de texte et remplace ceux qu'il reconnaît. Le HTML du
 * site n'est pas touché : aucune balise à poser, aucune section à réécrire,
 * donc rien à casser. Ce qui n'est pas traduit reste en français, et on le dit.
 */
(function () {
  const L = window.CLIPIA_LANGUES;
  if (!L) return;
  const META = L._meta, DEFAUT = 'fr';
  const cle = 'clipia:langue';

  /* Le texte d'origine de chaque nœud, mémorisé une fois : sans ça, passer de
     l'anglais à l'espagnol traduirait de l'anglais, et plus rien ne marcherait. */
  let noeuds = null;
  function recenser() {
    if (noeuds) return noeuds;
    noeuds = [];
    const p = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const t = n.nodeValue;
        if (!t || !t.trim() || t.trim().length < 2) return NodeFilter.FILTER_REJECT;
        const par = n.parentElement;
        if (!par || /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA)$/.test(par.tagName)) return NodeFilter.FILTER_REJECT;
        if (par.closest('#langue, #intro')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n; while ((n = p.nextNode())) noeuds.push({ n, fr: n.nodeValue });
    return noeuds;
  }

  function appliquer(code) {
    const dico = code === DEFAUT ? null : L[code];
    let faits = 0;
    for (const { n, fr } of recenser()) {
      if (!dico) { n.nodeValue = fr; continue; }
      const brut = fr.trim();
      const t = dico[brut];
      if (t === undefined) { n.nodeValue = fr; continue; }
      /* on rend les espaces d'origine : sans eux les mots se collent */
      n.nodeValue = fr.replace(brut, t);
      faits++;
    }
    const m = META[code] || META[DEFAUT];
    document.documentElement.lang = code;
    document.documentElement.dir = m.dr;
    try { localStorage.setItem(cle, code); } catch {}
    const b = document.getElementById('langueNom');
    if (b) b.textContent = m.nom;
    const note = document.getElementById('langueNote');
    if (note) note.hidden = code === DEFAUT;
    return faits;
  }

  function construire() {
    const barre = document.querySelector('nav');
    if (!barre || document.getElementById('langue')) return;
    const d = document.createElement('div');
    d.id = 'langue';
    d.style.cssText = 'position:relative;display:inline-block;margin:0 10px 0 2px;flex:none';
    d.innerHTML =
      `<button id="langueBtn" type="button" aria-haspopup="listbox" aria-expanded="false"
        style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:99px;
               border:1px solid #ffffff33;background:#ffffff0f;color:inherit;cursor:pointer;
               font:700 13.5px system-ui,sans-serif;white-space:nowrap">
        🌍 <span id="langueNom">Français</span> ▾</button>
      <div id="langueListe" role="listbox" hidden
        style="position:absolute;top:calc(100% + 7px);right:0;z-index:300;min-width:176px;
               background:#11121f;border:1px solid #ffffff26;border-radius:13px;padding:6px;
               box-shadow:0 18px 50px #000a;max-height:62vh;overflow:auto">
        ${Object.entries(META).map(([c, m]) =>
          `<button type="button" role="option" data-c="${c}"
             style="display:block;width:100%;text-align:${m.dr === 'rtl' ? 'right' : 'left'};
                    padding:8px 11px;border:0;border-radius:9px;background:none;color:#e8eaff;
                    cursor:pointer;font:600 14px system-ui,sans-serif">${m.nom}</button>`).join('')}
        <div id="langueNote" hidden
          style="padding:9px 11px 4px;color:#8b90b5;font:500 11.6px/1.45 system-ui,sans-serif;
                 border-top:1px solid #ffffff1a;margin-top:5px">
          Menus, titres et boutons sont traduits. Les textes détaillés restent en français :
          douze traductions automatiques approximatives vaudraient moins qu'un français juste.
        </div>
      </div>`;
    /* Le menu compte une vingtaine de liens : ajouté à la fin, le sélecteur
       sortait de l'écran. On le pose juste après le logo, où il reste visible. */
    const logo = barre.querySelector('.logo');
    if (logo && logo.nextSibling) barre.insertBefore(d, logo.nextSibling);
    else if (logo) logo.after(d);
    else barre.prepend(d);

    const btn = d.querySelector('#langueBtn'), liste = d.querySelector('#langueListe');
    const ouvrir = (o) => { liste.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
    btn.onclick = (e) => { e.stopPropagation(); ouvrir(liste.hidden); };
    document.addEventListener('click', (e) => { if (!d.contains(e.target)) ouvrir(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') ouvrir(false); });
    liste.querySelectorAll('button[data-c]').forEach(b => {
      b.onmouseenter = () => b.style.background = '#ffffff14';
      b.onmouseleave = () => b.style.background = 'none';
      b.onclick = () => { appliquer(b.dataset.c); ouvrir(false); };
    });
  }

  function demarrer() {
    construire();
    let choix = null;
    try { choix = localStorage.getItem(cle); } catch {}
    if (!choix) {
      /* première visite : on propose la langue du navigateur, sans l'imposer */
      const n = (navigator.language || 'fr').slice(0, 2).toLowerCase();
      choix = META[n] ? n : DEFAUT;
    }
    if (choix !== DEFAUT) appliquer(choix);
    else { const b = document.getElementById('langueNom'); if (b) b.textContent = META.fr.nom; }
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
