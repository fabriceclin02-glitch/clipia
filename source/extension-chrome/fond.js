// Clipia — extension Chrome (V4). Elle ne parle QU'À ton Clipia local (config.js), avec un jeton secret.
importScripts('config.js');
let actif = true, enBoucle = false, derniere = 0, erreur = '';
const H = { 'x-clipia-ext': CLIPIA_JETON, 'content-type': 'application/json' };

async function onglet(id) {
  if (id) return chrome.tabs.get(+id);
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!t) throw new Error('Aucun onglet actif.');
  return t;
}
const exec = async (tabId, func, args = []) => {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return r && r.result;
};

const ACTIONS = {
  async onglets() {
    const l = await chrome.tabs.query({});
    return l.map(t => ({ id: t.id, titre: t.title, url: t.url, actif: t.active, fenetre: t.windowId }));
  },
  async ouvrir({ url, onglet: id }) {
    if (!/^https?:\/\//i.test(url || '')) throw new Error('Adresse http(s) nécessaire.');
    const t = id ? await chrome.tabs.update(+id, { url, active: true }) : await chrome.tabs.create({ url });
    return { id: t.id, url };
  },
  async lire({ onglet: id, max }) {
    const t = await onglet(id);
    const r = await exec(t.id, (m) => {
      const liens = [...document.querySelectorAll('a[href]')].slice(0, 40).map(a => (a.innerText || '').trim().slice(0, 60) + ' → ' + a.href);
      const champs = [...document.querySelectorAll('input,textarea,select,button')].slice(0, 40).map((e, i) =>
        `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''} ${e.name || e.id || ''} « ${(e.innerText || e.placeholder || e.value || '').trim().slice(0, 40)} »`);
      return { titre: document.title, url: location.href, texte: (document.body.innerText || '').slice(0, m || 8000), liens, champs };
    }, [max || 8000]);
    return r;
  },
  async cliquer({ onglet: id, selecteur, texte }) {
    const t = await onglet(id);
    return exec(t.id, (sel, txt) => {
      let el = null;
      if (sel) el = document.querySelector(sel);
      if (!el && txt) {
        const q = txt.toLowerCase();
        el = [...document.querySelectorAll('a,button,[role=button],input[type=submit],label,summary')].find(e => (e.innerText || e.value || '').toLowerCase().includes(q));
      }
      if (!el) return { ok: false, pourquoi: 'élément introuvable' };
      el.scrollIntoView({ block: 'center' }); el.click();
      return { ok: true, element: el.tagName.toLowerCase(), texte: (el.innerText || '').slice(0, 60) };
    }, [selecteur || '', texte || '']);
  },
  async taper({ onglet: id, selecteur, texte, valider }) {
    const t = await onglet(id);
    return exec(t.id, (sel, txt, val) => {
      const el = sel ? document.querySelector(sel) : document.activeElement;
      if (!el) return { ok: false, pourquoi: 'champ introuvable' };
      if ((el.type || '').toLowerCase() === 'password') return { ok: false, pourquoi: 'champ mot de passe : refusé' };
      if (/card|cc-|cvv|iban/i.test((el.autocomplete || '') + (el.name || '') + (el.id || ''))) return { ok: false, pourquoi: 'champ de paiement : refusé' };
      el.focus();
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (set && 'value' in el) set.call(el, txt); else el.textContent = txt;
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      if (val) { el.form ? el.form.requestSubmit() : el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
      return { ok: true };
    }, [selecteur || '', texte || '', !!valider]);
  },
  async defiler({ onglet: id, pixels }) {
    const t = await onglet(id);
    return exec(t.id, (p) => { window.scrollBy(0, p); return { ok: true, y: Math.round(scrollY) }; }, [+pixels || 600]);
  },
  async fermer({ onglet: id }) { await chrome.tabs.remove(+id); return { ok: true }; },
  async activer({ onglet: id }) { const t = await chrome.tabs.update(+id, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); return { ok: true }; }
};

async function boucle() {
  if (enBoucle) return; enBoucle = true;
  while (actif) {
    try {
      const r = await fetch(`${CLIPIA_SERVEUR}/api/ext/attendre`, { headers: H, signal: AbortSignal.timeout(30000) });
      derniere = Date.now(); erreur = '';
      if (r.status === 401) { erreur = 'Jeton refusé : réinstalle l\'extension depuis Clipia.'; await new Promise(o => setTimeout(o, 5000)); continue; }
      const c = await r.json();
      if (!c || !c.id) continue;
      let rep;
      try {
        if (!ACTIONS[c.action]) throw new Error('action inconnue : ' + c.action);
        rep = { id: c.id, ok: true, resultat: await ACTIONS[c.action](c.params || {}) };
      } catch (e) { rep = { id: c.id, ok: false, erreur: String(e.message || e).slice(0, 300) }; }
      await fetch(`${CLIPIA_SERVEUR}/api/ext/resultat`, { method: 'POST', headers: H, body: JSON.stringify(rep) });
    } catch (e) {
      erreur = 'Clipia ne répond pas (est-il lancé ?)';
      await new Promise(o => setTimeout(o, 4000));
    }
  }
  enBoucle = false;
}
chrome.alarms.create('clipia', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => boucle());
chrome.runtime.onStartup.addListener(boucle);
chrome.runtime.onInstalled.addListener(boucle);
chrome.runtime.onMessage.addListener((m, s, rep) => {
  if (m === 'etat') rep({ actif, derniere, erreur, serveur: CLIPIA_SERVEUR });
  if (m === 'pause') { actif = false; rep(true); }
  if (m === 'reprise') { actif = true; boucle(); rep(true); }
  return true;
});
boucle();
