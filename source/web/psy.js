/* CLIPIA — Cabinet de psychologues : trois personnages d'IA (avatar, voix, approche, carnet propre). */
export function avatarSvg(a = {}, t = 120, parle = false) {
  const { peau = '#e8c4a0', cheveux = '#4a3020', coupe = 'court', fond = '#7c5cff', col = '#fff', lunettes = false, barbe = false } = a;
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  const cheveuxArriere = coupe === 'long' ? `<path d="M30 62 Q26 22 60 20 Q94 22 90 62 L94 108 Q60 116 26 108 Z" fill="${cheveux}"/>`
    : coupe === 'boucles' ? `<g fill="${cheveux}"><circle cx="34" cy="44" r="15"/><circle cx="44" cy="30" r="16"/><circle cx="60" cy="25" r="17"/><circle cx="76" cy="30" r="16"/><circle cx="86" cy="44" r="15"/><circle cx="30" cy="62" r="11"/><circle cx="90" cy="62" r="11"/></g>` : '';
  const cheveuxAvant = coupe === 'long' ? `<path d="M34 50 Q36 26 60 26 Q84 26 86 50 Q74 38 60 38 Q46 38 34 50Z" fill="${cheveux}"/>`
    : coupe === 'boucles' ? `<path d="M36 48 Q40 30 60 30 Q80 30 84 48 Q72 40 60 40 Q48 40 36 48Z" fill="${cheveux}"/>`
    : `<path d="M35 52 Q34 24 60 24 Q86 24 85 52 Q82 36 60 36 Q38 36 35 52Z" fill="${cheveux}"/>`;
  return `<svg viewBox="0 0 120 120" width="${t}" height="${t}" role="img" aria-label="Avatar" class="${parle ? 'psy-parle' : ''}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fond}"/><stop offset="1" stop-color="#0e0a28"/></linearGradient><clipPath id="${id}c"><circle cx="60" cy="60" r="58"/></clipPath></defs>
    <circle cx="60" cy="60" r="58" fill="url(#${id})"/>
    <g clip-path="url(#${id}c)">${cheveuxArriere}
      <path d="M12 124 Q16 92 46 88 L74 88 Q104 92 108 124Z" fill="${col}"/><path d="M50 88 L60 104 L70 88Z" fill="${peau}"/>
      <rect x="52" y="74" width="16" height="18" rx="6" fill="${peau}"/>
      <ellipse cx="60" cy="56" rx="23" ry="27" fill="${peau}"/>${cheveuxAvant}
      <ellipse cx="51" cy="56" rx="2.6" ry="3" fill="#2a1d1d"/><ellipse cx="69" cy="56" rx="2.6" ry="3" fill="#2a1d1d"/>
      <path d="M45 49 Q51 46 56 49 M64 49 Q69 46 75 49" stroke="${cheveux}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M60 58 Q58 66 61 67" stroke="#00000033" stroke-width="1.6" fill="none"/>
      <path class="psy-bouche" d="M52 70 Q60 77 68 70" stroke="#8a3b3b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      ${barbe ? `<path d="M38 62 Q40 88 60 90 Q80 88 82 62 Q76 78 60 78 Q44 78 38 62Z" fill="${cheveux}" opacity=".92"/><path d="M52 70 Q60 76 68 70" stroke="#d98a8a" stroke-width="2.2" fill="none" stroke-linecap="round"/>` : ''}
      ${lunettes ? `<g stroke="#2a1d3d" stroke-width="2" fill="#ffffff22"><circle cx="51" cy="56" r="8.5"/><circle cx="69" cy="56" r="8.5"/><path d="M59.5 56 H60.5"/></g>` : ''}
    </g><circle cx="60" cy="60" r="58" fill="none" stroke="#ffffff55" stroke-width="2"/></svg>`;
}

export function installerPsy({ $, el, esc, api, VUES, toast }) {
  document.head.append(el(`<style>
  .cab{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:14px}
  .cab-c{background:#ffffff0d;border:1px solid #ffffff22;border-radius:20px;padding:18px;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center}
  .cab-c:hover{border-color:#a99bff;box-shadow:0 0 0 3px #7c5cff33}
  .cab-c h3{margin:6px 0 0}.cab-c .sp{font-size:12.5px;color:#a99bff;font-weight:600}.cab-c p{margin:4px 0;font-size:13.5px;opacity:.9}
  .cab-c .btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px}
  #psy-bandeau{display:flex;align-items:center;gap:12px;padding:8px 14px;margin:0 0 10px;border-radius:16px;background:linear-gradient(135deg,#2a1d6e,#16295f);border:1px solid #6d4fd6}
  #psy-bandeau b{display:block}#psy-bandeau small{opacity:.8}#psy-bandeau .pousse{margin-left:auto}
  .psy-parle .psy-bouche{animation:psyb .45s ease-in-out infinite alternate}@keyframes psyb{from{d:path("M52 70 Q60 74 68 70")}to{d:path("M52 69 Q60 80 68 69")}}
  </style>`));

  VUES.cabinet = async v => {
    const liste = await api('/api/psy');
    v.innerHTML = `<h1>🛋 Cabinet de psychologues</h1>
      <p class="v4-p">Trois psychologues, chacun avec son approche et sa voix. Ils vous posent des questions, vous écoutent et se souviennent de vos séances : chaque conversation est enregistrée au fil de l'eau, <b>uniquement sur ton ordinateur</b>.</p>
      <div class="carte creux" style="font-size:13px">⚠ Ce sont des personnages d'<b>intelligence artificielle</b>, pas des psychologues diplômés : un soutien pour parler et y voir plus clair, <b>pas un diagnostic ni un traitement</b>. En cas de détresse : 3114 (24 h/24, gratuit), 15 ou 112 en urgence.</div>
      <div class="cab">${liste.map(p => `<div class="cab-c" data-id="${esc(p.id)}">${avatarSvg(p.avatar, 128)}<h3>${esc(p.nom)}</h3><div class="sp">${esc(p.specialite)}</div><p>${esc(p.quoi)}</p>
        <div class="petit" style="font-size:12px;opacity:.7">${p.echanges ? p.echanges + ' échange(s) gardé(s)' : 'Première séance'}</div>
        <div class="btns"><button class="btn or" data-a="go">${p.echanges ? 'Reprendre la séance' : 'Commencer la séance'}</button>${p.echanges ? '<button class="btn mini" data-a="carnet">Carnet</button><button class="btn mini" data-a="effacer">Effacer</button>' : ''}</div></div>`).join('')}</div>
      <div id="cab-carnet" class="carte creux" style="display:none;margin-top:14px;white-space:pre-wrap;font-size:13px"></div>`;
    v.onclick = async ev => {
      const b = ev.target.closest('button[data-a]'); if (!b) return;
      const id = b.closest('[data-id]').dataset.id;
      if (b.dataset.a === 'go') { location.hash = '#/clipia?n=' + Date.now() + '&psy=' + encodeURIComponent(id); }
      else if (b.dataset.a === 'carnet') { const r = await api('/api/psy/carnet?id=' + encodeURIComponent(id)); const z = $('#cab-carnet', v); z.style.display = 'block'; z.textContent = r.echanges.map(e => `${e.quand.slice(0, 10)}\nVous : ${e.moi}\nPsychologue : ${e.clipia}\n`).join('\n') || 'Carnet vide.'; }
      else if (b.dataset.a === 'effacer') { if (!confirm('Effacer le carnet de ce psychologue ? Il oubliera vos séances.')) return; await api('/api/psy/effacer', { method: 'POST', headers: { 'x-clipia-accord': '1' }, body: '{}'.replace('{}', JSON.stringify({ id })) }); toast('Carnet effacé.', 'ok'); VUES.cabinet(v); }
    };
  };
  window.clipiaPsy = { avatarSvg };
}
