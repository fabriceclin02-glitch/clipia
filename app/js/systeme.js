'use strict';
/* Clipia X8 — couche « système » : écran d'accueil, Studio, Store, Dépôt IA, contacts, messages, appels */
const SITE=new URL('../',location.href).href;
const attendrePerm=nom=>new Promise(res=>{if(!NATIF||!NATIF.aPermission)return res(false);if(NATIF.aPermission(nom))return res(true);const t=setTimeout(()=>{window.__clipiaPerm=null;res(false)},60000);window.__clipiaPerm=ok=>{clearTimeout(t);window.__clipiaPerm=null;res(ok)};NATIF.demanderPermission(nom)});
let _pend=null;$('#voile').addEventListener('click',()=>{if(_pend){const f=_pend;_pend=null;f(null)}});
function confirmerMessage({nom,numero,canal,texte}){
  return new Promise(res=>{
    _pend=res;
    libre(`<h2>${canal==='whatsapp'?'💬 WhatsApp':'✉️ SMS'} à ${esc(nom)}</h2><p class="doux">${esc(numero)} — relis, modifie si besoin, puis confirme.</p><textarea id="mt" rows="4" style="min-height:110px">${esc(texte)}</textarea><div style="height:12px"></div><button class="btn p" id="mok">✓ Envoyer</button><button class="btn" id="mko">Annuler</button>`,r=>{
      $('#mok',r).onclick=()=>{const t=$('#mt',r).value.trim();_pend=null;fermerTout();res(t||null)};
      $('#mko',r).onclick=()=>{_pend=null;fermerTout();res(null)}});
    if(E.voixActive)parler(`Je vais envoyer à ${nom} : ${texte}. Tu confirmes à l'écran ?`);
  });
}
async function chercherContact(q){
  if(!NATIF)throw new Error('Disponible uniquement dans l\'application Android.');
  if(!NATIF.aPermission('contacts')&&!await attendrePerm('contacts'))throw new Error('Permission « Contacts » refusée : autorise-la dans les réglages Android de Clipia.');
  const r=JSON.parse(NATIF.contacts(q)||'[]');if(r.permission===false)throw new Error('Permission « Contacts » refusée.');return r;
}
const OUTILS_SYS={
  async contact(a){const l=await chercherContact(a.corps||a.at.contact||'');return l.length?'Contacts trouvés : '+l.map(c=>c.nom+' ('+c.numero+')').join(' ; '):'Aucun contact nommé « '+(a.corps||'')+' ».'},
  async message(a,ctx){
    if(!NATIF)return 'Disponible uniquement dans l\'application Android.';
    const q=a.at.contact||'';const l=await chercherContact(q);
    if(!l.length)return `Aucun contact « ${q} ».`;
    const noms=[...new Set(l.map(c=>c.nom))];if(noms.length>1)return `Plusieurs contacts correspondent : ${noms.join(', ')}. Demande lequel.`;
    const texte=(a.corps||'').trim();if(!texte)return 'Le texte du message est vide : demande à la personne ce qu\'elle veut écrire.';
    const canal=norm(a.at.canal)==='whatsapp'?'whatsapp':'sms';
    ctx.etape('J\'attends ta confirmation…');
    const final=await confirmerMessage({nom:l[0].nom,numero:l[0].numero,canal,texte});
    if(!final)return 'La personne a annulé : rien n\'a été envoyé.';
    if(canal==='whatsapp'){NATIF.ouvrirWhatsApp(l[0].numero,final);return `WhatsApp ouvert avec le message pour ${l[0].nom} : la personne appuie sur Envoyer.`}
    if(!NATIF.aPermission('sms')&&!await attendrePerm('sms'))return 'Permission SMS refusée : message non envoyé.';
    const r=NATIF.envoyerSMS(l[0].numero,final);return r==='ok'?`SMS envoyé à ${l[0].nom}.`:'Échec de l\'envoi : '+r;
  },
  async app_ouvrir(a){
    if(!NATIF)return 'Disponible uniquement dans l\'application Android.';
    const q=norm(a.corps),l=JSON.parse(NATIF.listeApps()||'[]');
    const m=l.find(x=>norm(x.nom)===q)||l.find(x=>norm(x.nom).includes(q)||q.includes(norm(x.nom)));
    if(!m)return `Application « ${a.corps} » introuvable.`;return NATIF.lancerApp(m.pkg)?`« ${m.nom} » ouverte.`:'Impossible de l\'ouvrir.';
  },
  async telephone(a){
    if(!NATIF)return 'Disponible uniquement dans l\'application Android.';
    const ac=norm(a.at.action),v=(a.at.valeur||'').trim();
    if(ac==='appeler'){let num=v;if(!/\d{4,}/.test(num)){const l=await chercherContact(a.corps||v);if(!l.length)return 'Contact introuvable.';num=l[0].numero}NATIF.appeler(num);return 'Composeur ouvert : la personne appuie sur Appeler.'}
    if(ac==='lampe')return 'Lampe : '+NATIF.lampe(norm(v)!=='off');
    const r=NATIF.action(ac,v);return r==='ok'?'Fait.':'Action impossible : '+r;
  }
};
window.OUTILS_SYS=OUTILS_SYS;
window.__clipiaAssist=()=>{changerVue('parler');setTimeout(()=>{if(!E.conversation)basculeConv()},400)};

/* ═══ ACCUEIL ═══════════════════════════════════════════════════════════════ */
const VUES={};window.VUES=VUES;
const TUILES=[['🎙','Parler','parler'],['✨','Créer','creer'],['🛠','Studio','studio'],['🧩','Agents','agents'],['🏬','Store','store'],['💬','Clipbook','clipbook'],['🎵','ClipTok','cliptok'],['⚙','Réglages','reglages']];
const _ico={};
VUES.accueil=async function(){
  const d=new Date();$('#accDate').textContent=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' · '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const p=$('#accPanneau');const apps=(await BD.tous()).filter(c=>c.type==='app');
  let h=`<div class="gi">${TUILES.map(([i,n,v])=>`<div class="ic ${v?'':'bientot'}" data-v="${v||''}" data-n="${n}"><div class="pic">${i}</div><span>${n}</span></div>`).join('')}</div>`;
  if(apps.length)h+=`<div class="titre-s">Mes applications</div><div class="gi">${apps.map(a=>`<div class="ic" data-app="${a.id}"><div class="pic">${esc((a.meta&&a.meta.icone)||'🧩')}</div><span>${esc(a.titre)}</span></div>`).join('')}</div>`;
  if(NATIF){
    h+=`<div class="titre-s">Téléphone</div><div class="gi">${[['📞','Téléphone','telephone'],['💬','Messages','messages'],['📷','Appareil photo','camera'],['🖼','Galerie','galerie'],['👤','Contacts','contacts'],['🗓','Agenda','agenda'],['🧮','Calculatrice','calculatrice'],['🌐','Navigateur','navigateur']].map(([i,n,a])=>`<div class="ic" data-act="${a}"><div class="pic">${i}</div><span>${n}</span></div>`).join('')}</div>`;
    let l=[];try{l=JSON.parse(NATIF.listeApps()||'[]')}catch(e){}
    l=l.filter(x=>x.pkg!=='com.clendax.clipia');
    h+=`<div class="titre-s">Toutes les applications (${l.length})</div><div class="gi">${l.map(x=>`<div class="ic" data-pkg="${esc(x.pkg)}"><div class="pic" data-ico="${esc(x.pkg)}">📱</div><span>${esc(x.nom)}</span></div>`).join('')}</div>`;
    h+=`<div class="titre-s">Interface</div><button class="btn" id="accOrig">↩ Revenir à l'interface d'origine</button><p class="aide">Clipia ne remplace pas ton système : change simplement l'écran d'accueil par défaut. Tu peux aussi le faire dans Réglages Android → Applications → Applications par défaut.</p>`;
  }else h+=`<p class="aide" style="margin-top:18px">Dans l'application Android, cet écran affiche aussi tes applications, ton téléphone, tes messages et tes contacts.</p>`;
  p.innerHTML=h;
  p.onclick=e=>{const t=e.target.closest('.ic');if(t){
    if(t.dataset.n&&!t.dataset.v)return toast('<b>'+esc(t.dataset.n)+'</b> arrive à l\'étape suivante.');
    if(t.dataset.v)return changerVue(t.dataset.v);
    if(t.dataset.app){BD.lire(t.dataset.app).then(c=>c&&visualiser(c));return}
    if(t.dataset.act){const r=NATIF.action(t.dataset.act,'');if(r!=='ok')toast('Impossible : '+esc(r));return}
    if(t.dataset.pkg){NATIF.lancerApp(t.dataset.pkg);return}}
    if(e.target.id==='accOrig'){const r=NATIF.action('accueil_defaut','');if(r!=='ok')toast('Va dans Réglages Android → Applications → Applications par défaut → Application d\'accueil.')}};
  if(NATIF){const io=new IntersectionObserver(es=>es.forEach(en=>{if(!en.isIntersecting)return;io.unobserve(en.target);const k=en.target.dataset.ico;if(_ico[k]===undefined){try{_ico[k]=NATIF.iconeApp(k)}catch(e){_ico[k]=''}}if(_ico[k])en.target.innerHTML=`<img alt="" src="data:image/png;base64,${_ico[k]}">`}),{root:p,rootMargin:'200px'});$$('[data-ico]',p).forEach(x=>io.observe(x))}
};

/* ═══ STUDIO : crée ta propre application ═══════════════════════════════════ */
const MODELES=[['🎮','Jeu','un jeu simple et addictif, jouable au doigt, avec score'],['🧰','Outil','un outil pratique (convertisseur, minuteur, générateur…)'],['📓','Journal','un carnet de notes avec sauvegarde locale'],['❓','Quiz','un quiz avec questions, score et rejouer'],['🛒','Boutique','une mini-boutique avec panier'],['📈','Suivi','un suivi (habitudes, budget, sport) avec graphique'],['🌐','Site','un site vitrine de présentation soigné']];
VUES.studio=async function(){
  const p=$('#pStudio');const apps=(await BD.tous()).filter(c=>c.type==='app');
  p.innerHTML=`<h1>🛠 Clipia Studio</h1><p class="doux">Décris ton application : Clipia l'écrit, elle apparaît sur ton écran d'accueil et tu peux la modifier à la voix ou au texte.</p>
  <button class="btn p" id="sNew">+ Créer une application</button>
  <h3>Mes applications</h3>${apps.length?apps.map(a=>`<div class="st"><div class="e">${esc((a.meta&&a.meta.icone)||'🧩')}</div><div class="t"><b>${esc(a.titre)}</b><span>${new Date(a.date).toLocaleDateString('fr-FR')}</span></div><button class="btn mini" data-o="${a.id}">Ouvrir</button><button class="btn mini" data-m="${a.id}">Modifier</button></div>`).join(''):'<p class="aide">Aucune application pour l\'instant.</p>'}
  <h3>Partager</h3><p class="aide">Chaque application est un fichier HTML unique : « Enregistrer » dans la carte, puis envoie-le ou propose-le au Clipia Store (onglet Store → Publier). Un vrai APK installable se prépare via le dépôt GitHub (voir Store → Publier).</p>`;
  $('#sNew',p).onclick=()=>formApp();
  p.onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.o){const c=await BD.lire(b.dataset.o);if(c)visualiser(c)}if(b.dataset.m){const c=await BD.lire(b.dataset.m);if(c)formModif(c)}};
};
function formApp(){
  libre(`<h2>🛠 Nouvelle application</h2><div class="champ"><label>Nom</label><input type="text" id="an2" placeholder="Ex : Mon Snake"></div>
  <label>Modèle de départ</label><div class="rang champ" id="amo">${MODELES.map((m,i)=>`<span class="choix ${i===0?'on':''}" data-i="${i}">${m[0]} ${m[1]}</span>`).join('')}</div>
  <div class="champ"><label>Icône (un emoji)</label><input type="text" id="ai2" value="🎮" maxlength="4"></div>
  <div class="champ"><label>Décris-la comme tu veux</label><textarea id="ad2" rows="4" style="min-height:100px" placeholder="Un serpent qui grandit, 3 niveaux de vitesse, meilleur score sauvegardé"></textarea></div>
  <button class="btn p" id="ago">Créer avec Clipia</button><p class="aide">Astuce : tu peux aussi le dicter en parlant à Clipia.</p>`,r=>{
    $$('#amo .choix',r).forEach(c=>c.onclick=()=>{$$('#amo .choix',r).forEach(x=>x.classList.toggle('on',x===c));$('#ai2',r).value=MODELES[+c.dataset.i][0]});
    $('#ago',r).onclick=()=>{const nom=$('#an2',r).value.trim()||'Mon application',m=MODELES[+$('#amo .on',r).dataset.i],ic=$('#ai2',r).value.trim()||m[0],d=$('#ad2',r).value.trim();fermerTout();changerVue('parler');
      demander(`Crée une application complète nommée « ${nom} » : ${m[2]}. ${d} Utilise l'outil code avec app="oui" titre="${nom}" icone="${ic}" et un seul fichier HTML, mobile, entièrement fonctionnel, sauvegarde locale si utile.`)}})}
async function formModif(c){
  const code=await c.blob.text();
  libre(`<h2>✏️ Modifier « ${esc(c.titre)} »</h2><div class="champ"><label>Que veux-tu changer ?</label><textarea id="mm" rows="4" style="min-height:100px" placeholder="Ajoute un mode sombre et un bouton rejouer"></textarea></div><button class="btn p" id="mgo">Modifier avec Clipia</button><button class="btn danger" id="msu">Supprimer l'application</button>`,r=>{
    $('#mgo',r).onclick=()=>{const t=$('#mm',r).value.trim();if(!t)return;fermerTout();changerVue('parler');demander(`Modifie l'application « ${c.titre} ». Changement demandé : ${t}. Renvoie le fichier COMPLET avec l'outil code app="oui" titre="${c.titre}" icone="${(c.meta&&c.meta.icone)||'🧩'}". Code actuel :\n${code.slice(0,14000)}`)};
    $('#msu',r).onclick=async()=>{if(!confirm('Supprimer « '+c.titre+' » ?'))return;await BD.suppr(c.id);fermerTout();VUES.studio();VUES.accueil()}})}

/* ═══ STORE & DÉPÔT IA ══════════════════════════════════════════════════════ */
let CAT=M.lire('catalogueStore',null),DEPOT=M.lire('depotIA',null),ongletS='apps',filtreS='Tout',rechS='';
async function jsonSite(chemin){const r=await net(SITE+chemin+'?t='+Date.now(),{delai:25000});if(!r.ok)throw new Error('Catalogue indisponible ('+r.status+')');return JSON.parse(r.texte)}
window.__clipiaInstall=(id,etat,msg)=>{const b=document.querySelector(`[data-i="${id}"]`);if(b)b.textContent=etat==='ok'?'Installateur ouvert':etat==='erreur'?'Réessayer':'…';if(etat==='erreur'||etat==='autorisation')toast('<span class="ko">'+esc(msg)+'</span>',7000);else if(etat==='ok')toast('✓ '+esc(msg))};
VUES.store=async function(){
  const p=$('#pStore');
  p.innerHTML=`<h1>🏬 Clipia Store</h1><p class="doux">Applications libres et ouvertes, agents IA partageables, et publication gratuite pour les développeurs.</p>
  <div class="rang champ"><span class="choix ${ongletS==='apps'?'on':''}" data-o="apps">Applications</span><span class="choix ${ongletS==='ia'?'on':''}" data-o="ia">Dépôt IA</span><span class="choix ${ongletS==='pub'?'on':''}" data-o="pub">Publier</span></div><div id="sc"></div>`;
  $$('[data-o]',p).forEach(c=>c.onclick=()=>{ongletS=c.dataset.o;VUES.store()});
  const sc=$('#sc',p);
  try{if(ongletS==='apps'){sc.innerHTML='<p class="aide">Chargement…</p>';try{CAT=await jsonSite('store/catalogue.json');M.ecrire('catalogueStore',CAT)}catch(e){if(!CAT)throw e}await rendreApps(sc)}
    else if(ongletS==='ia'){sc.innerHTML='<p class="aide">Chargement…</p>';try{DEPOT=await jsonSite('depot-ia/catalogue.json');M.ecrire('depotIA',DEPOT)}catch(e){if(!DEPOT)throw e}rendreDepot(sc)}
    else rendrePublier(sc)}
  catch(e){sc.innerHTML='<p class="aide"><span class="ko">'+esc(e.message)+'</span> — vérifie ta connexion.</p>'}
};
async function rendreApps(sc){
  const cats=['Tout',...CAT.categories.filter(c=>CAT.apps.some(a=>a.cat===c))];
  sc.innerHTML=`<div class="champ"><input type="text" id="sr" placeholder="Rechercher une application" value="${esc(rechS)}"></div><div class="rang champ" id="sk">${cats.map(c=>`<span class="choix ${filtreS===c?'on':''}" data-c="${esc(c)}">${esc(c)}</span>`).join('')}</div><div id="sl"></div>`;
  const liste=()=>{const q=norm(rechS);$('#sl',sc).innerHTML=CAT.apps.filter(a=>(filtreS==='Tout'||a.cat===filtreS)&&(!q||norm(a.nom+' '+a.desc).includes(q))).map(a=>{const inst=NATIF&&a.pkg&&NATIF.appInstallee(a.pkg);
    const bt=a.type==='apk'||a.type==='clipia'?(inst&&a.type!=='clipia'?`<button class="btn mini" data-ouvrir="${esc(a.pkg)}">Ouvrir</button>`:`<button class="btn p mini" data-i="${esc(a.id)}" data-inst="${esc(a.id)}">${a.type==='clipia'?'Mettre à jour':'Installer'}</button>`):`<button class="btn mini" data-lien="${esc(a.url)}">${a.type==='fdroid'?'Fiche':'Ouvrir'}</button>`;
    return `<div class="st"><div class="e">${esc(a.icone||'📦')}</div><div class="t"><b>${esc(a.nom)}</b><span>${esc(a.desc)}</span><i>${esc(a.cat)} · ${esc(a.dev||'')}${inst?' · installée':''}</i></div>${bt}</div>`}).join('')||'<p class="aide">Aucun résultat.</p>'};
  liste();$('#sr',sc).oninput=e=>{rechS=e.target.value;liste()};
  $$('#sk .choix',sc).forEach(c=>c.onclick=()=>{filtreS=c.dataset.c;rendreApps(sc)});
  sc.onclick=async e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.lien)return ouvrirLien(b.dataset.lien);if(b.dataset.ouvrir)return NATIF.lancerApp(b.dataset.ouvrir);
    if(b.dataset.inst){const a=CAT.apps.find(x=>x.id===b.dataset.inst);if(!NATIF)return toast('L\'installation directe est disponible dans l\'application Android.');
      let url=a.url,sha=a.sha256;if(a.type==='clipia'){const L=await jsonSite('liens.json');const an=L.fichiers.android;url=new URL(an.url,SITE).href;sha=an.sha256}
      if(!sha)return toast('<span class="ko">Cette application n\'a pas d\'empreinte SHA-256 : installation refusée.</span>');
      b.textContent='…';NATIF.installerApk(a.id,url,sha)}}
}
function rendreDepot(sc){
  sc.innerHTML=`<p class="doux">Des agents prêts à l'emploi (rôle, instructions, voix), publiés par la communauté. Ajoute-les à tes agents en un geste.</p>`+DEPOT.agents.map(a=>`<div class="st"><div class="e">🧩</div><div class="t"><b>${esc(a.nom)}</b><span>${esc(a.role)}</span><i>${esc(a.outils.map(o=>LIBELLE_OUTIL[o]||o).join(', '))}</i></div><button class="btn mini ${E.agents.some(x=>x.id===a.id)?'':'p'}" data-a="${esc(a.id)}">${E.agents.some(x=>x.id===a.id)?'Ajouté ✓':'Ajouter'}</button></div>`).join('')+`<h3>Importer un agent</h3><textarea id="ij" rows="4" placeholder='Colle ici le JSON d&#39;un agent' style="min-height:90px"></textarea><div style="height:10px"></div><button class="btn" id="ibtn">Importer</button><div class="aide" id="im"></div>`;
  sc.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.a){const a=DEPOT.agents.find(x=>x.id===b.dataset.a);if(a&&!E.agents.some(x=>x.id===a.id)){E.agents.push(JSON.parse(JSON.stringify(a)));sauver();rendreDepot(sc);toast('Agent « '+esc(a.nom)+' » ajouté : onglet Agents.')}}
    if(b.id==='ibtn'){try{const g=JSON.parse($('#ij',sc).value);const l=Array.isArray(g)?g:[g];let n=0;l.forEach(a=>{if(!a.nom||!a.instructions)return;a.id=a.id||norm(a.nom).replace(/[^a-z0-9]+/g,'-');a.outils=(a.outils||['memoire']).filter(o=>TOUS_OUTILS.includes(o)&&o!=='pc');a.sousAgents=a.sousAgents||[];a.role=a.role||'Agent importé';const k=E.agents.findIndex(x=>x.id===a.id);if(k>=0)E.agents[k]=a;else E.agents.push(a);n++});sauver();$('#im',sc).innerHTML=n?'<span class="ok">✓ '+n+' agent(s) importé(s).</span>':'<span class="ko">Aucun agent valide (nom et instructions requis).</span>'}catch(err){$('#im',sc).innerHTML='<span class="ko">JSON invalide.</span>'}}}
}
function rendrePublier(sc){
  sc.innerHTML=`<p class="doux">Publier est <b>gratuit</b>, sans compte payant ni commission. Les APK sont vérifiés par empreinte SHA-256 avant installation.</p>
  <button class="btn p" data-l="https://github.com/fabriceclin02-glitch/clipia/issues/new?template=store-app.yml">📦 Proposer mon application</button>
  <button class="btn" data-l="https://github.com/fabriceclin02-glitch/clipia/blob/main/store/CONTRIBUER.md">📖 Guide du développeur</button>
  <button class="btn" data-l="https://github.com/fabriceclin02-glitch/clipia/tree/main/depot-ia">🤖 Publier un agent (Dépôt IA)</button>
  <button class="btn" data-l="https://github.com/fabriceclin02-glitch/clipia">🐙 Dépôt GitHub de Clipia</button>
  <p class="aide">Pas encore développeur ? Crée ta première application avec <b>Clipia Studio</b> (écran d'accueil).</p>`;
  sc.onclick=e=>{const b=e.target.closest('button');if(b&&b.dataset.l)ouvrirLien(b.dataset.l)};
}
/* quitter Clipia Home depuis les réglages */
const _mr=majReglages;majReglages=function(){_mr();if(!NATIF)return;const p=$('#pReglages');const d=document.createElement('div');d.innerHTML=`<h3>Interface</h3><button class="btn" id="rOrig">↩ Revenir à l'interface d'origine</button><button class="btn" id="rAss">🎙 Choisir Clipia comme assistante par défaut</button><p class="aide">Rien n'est verrouillé : tu peux changer ou retirer Clipia à tout moment, et la désinstaller comme n'importe quelle application.</p>`;p.insertBefore(d,p.querySelector('h3:last-of-type')||null);$('#rOrig',d).onclick=()=>{if(NATIF.action('accueil_defaut','')!=='ok')toast('Réglages Android → Applications → Applications par défaut → Application d\'accueil.')};$('#rAss',d).onclick=()=>{if(NATIF.action('assistant_defaut','')!=='ok')toast('Réglages Android → Applications → Applications par défaut → Assistant numérique.')}};
VUES.accueil();
