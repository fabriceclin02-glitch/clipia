'use strict';
/* Clipia X8 — Clipbook (réseau social) et ClipTok (vidéos courtes). Mode solo hors-ligne, ou serveur Supabase. */
const Soc=(()=>{
  let cfg=M.lire('soc.cfg',{url:'',cle:''}),ses=M.lire('soc.ses',null);
  const loc=()=>M.lire('soc.local',{posts:[],coms:[],likes:{},suivis:[],msgs:[],moi:{nom:'Moi',bio:''}});
  const saveLoc=o=>M.ecrire('soc.local',o);
  const cloud=()=>!!(cfg.url&&cfg.cle);
  const base=()=>cfg.url.replace(/\/+$/,'');
  const H=(extra={})=>Object.assign({apikey:cfg.cle,Authorization:'Bearer '+((ses&&ses.token)||cfg.cle),'Content-Type':'application/json'},extra);
  async function rq(chemin,{method='GET',body,headers={},blob}={}){
    const r=await net(base()+chemin,{method,headers:H(headers),body:body?JSON.stringify(body):null,blob,delai:60000});
    if(!r.ok){let m='';try{const j=JSON.parse(r.texte);m=j.msg||j.message||j.error_description||j.error||''}catch(e){}
      if(r.status===401&&ses&&ses.refresh&&!rq._r){rq._r=1;try{await rafraichir();return await rq(chemin,{method,body,headers,blob})}finally{rq._r=0}}
      throw new Error('Serveur : '+(m||'erreur '+r.status))}
    try{return r.texte?JSON.parse(r.texte):null}catch(e){return null}
  }
  async function rafraichir(){const r=await net(base()+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.cle,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:ses.refresh})});
    if(!r.ok){ses=null;M.vider('soc.ses');throw new Error('Session expirée : reconnecte-toi.')}const j=JSON.parse(r.texte);ses={token:j.access_token,refresh:j.refresh_token,id:j.user.id,email:j.user.email,nom:ses.nom};M.ecrire('soc.ses',ses)}
  const api={
    cloud,connecte:()=>cloud()&&!!ses,get ses(){return ses},get cfg(){return cfg},
    config(url,cle){cfg={url:(url||'').trim(),cle:nettoyerCle?nettoyerCle(cle||''):(cle||'').trim()};M.ecrire('soc.cfg',cfg);if(!cfg.url){ses=null;M.vider('soc.ses')}},
    async inscrire(email,mdp,nom){
      const r=await net(base()+'/auth/v1/signup',{method:'POST',headers:{apikey:cfg.cle,'Content-Type':'application/json'},body:JSON.stringify({email,password:mdp,data:{nom}})});
      const j=JSON.parse(r.texte||'{}');if(!r.ok)throw new Error(j.msg||j.error_description||'Inscription refusée ('+r.status+')');
      if(!j.access_token)throw new Error('Compte créé, mais le serveur demande de confirmer l\'e-mail : désactive « Confirm email » (voir social/LISEZMOI.md) ou confirme par e-mail puis connecte-toi.');
      ses={token:j.access_token,refresh:j.refresh_token,id:j.user.id,email,nom};M.ecrire('soc.ses',ses);
      await rq('/rest/v1/profiles',{method:'POST',body:{id:ses.id,nom},headers:{Prefer:'resolution=merge-duplicates'}});
    },
    async connecter(email,mdp){
      const r=await net(base()+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.cle,'Content-Type':'application/json'},body:JSON.stringify({email,password:mdp})});
      const j=JSON.parse(r.texte||'{}');if(!r.ok)throw new Error(j.msg||j.error_description||'Connexion refusée ('+r.status+')');
      ses={token:j.access_token,refresh:j.refresh_token,id:j.user.id,email,nom:''};M.ecrire('soc.ses',ses);
      const p=await rq('/rest/v1/profiles?id=eq.'+ses.id+'&select=nom');
      if(p&&p[0])ses.nom=p[0].nom;else{ses.nom=(j.user.user_metadata&&j.user.user_metadata.nom)||email.split('@')[0];await rq('/rest/v1/profiles',{method:'POST',body:{id:ses.id,nom:ses.nom}})}
      M.ecrire('soc.ses',ses);
    },
    deconnecter(){ses=null;M.vider('soc.ses')},
    moi(){return cloud()&&ses?{id:ses.id,nom:ses.nom||'Moi'}:{id:'moi',nom:loc().moi.nom}},
    async renommer(nom,bio){if(cloud()&&ses){await rq('/rest/v1/profiles?id=eq.'+ses.id,{method:'PATCH',body:{nom,bio}});ses.nom=nom;M.ecrire('soc.ses',ses)}else{const l=loc();l.moi={nom,bio};saveLoc(l)}},
    /* ── fil ── */
    async fil(appli,{suivis=false}={}){
      if(!(cloud()&&ses)){
        const l=loc();return l.posts.filter(p=>p.appli===appli).sort((a,b)=>b.cree-a.cree).map(p=>({id:p.id,auteur:{id:'moi',nom:l.moi.nom},appli,type:p.type,texte:p.texte,creation:p.creation,media:p.media||'',cree:p.cree,nbLikes:(l.likes[p.id]?1:0),aime:!!l.likes[p.id],nbCom:l.coms.filter(c=>c.post===p.id).length}))}
      let q='/rest/v1/posts?appli=eq.'+appli+'&order=cree.desc&limit=40&select=id,type,texte,media,cree,auteur,profiles(nom),likes(user_id),comments(id)';
      if(suivis){const f=await rq('/rest/v1/follows?suiveur=eq.'+ses.id+'&select=suivi');const ids=(f||[]).map(x=>x.suivi).concat([ses.id]);q+='&auteur=in.('+ids.join(',')+')'}
      const r=await rq(q)||[];
      return r.map(p=>({id:p.id,auteur:{id:p.auteur,nom:(p.profiles&&p.profiles.nom)||'?'},appli,type:p.type,texte:p.texte,media:p.media,cree:Date.parse(p.cree),nbLikes:(p.likes||[]).length,aime:(p.likes||[]).some(x=>x.user_id===ses.id),nbCom:(p.comments||[]).length}));
    },
    async publier(appli,{type,texte,blob,creation}){
      if(!(cloud()&&ses)){const l=loc();const p={id:'l'+Date.now(),appli,type,texte:texte||'',creation:creation||null,cree:Date.now()};
        if(blob&&!creation){const c=await nouvelleCreation(type==='video'?'video':'image',(texte||'Publication').slice(0,40),blob,{social:1});p.creation=c.id}
        l.posts.push(p);saveLoc(l);return}
      let url='';
      if(blob){const ext=(blob.type.split('/')[1]||'bin').split(';')[0],nom=ses.id+'/'+Date.now()+'.'+ext;
        await rq('/storage/v1/object/media/'+nom,{method:'POST',blob,headers:{'Content-Type':blob.type||'application/octet-stream','x-upsert':'true'}});
        url=base()+'/storage/v1/object/public/media/'+nom}
      await rq('/rest/v1/posts',{method:'POST',body:{appli,type,texte:texte||'',media:url}});
    },
    async supprimer(p){if(!(cloud()&&ses)){const l=loc();l.posts=l.posts.filter(x=>x.id!==p.id);saveLoc(l);return}await rq('/rest/v1/posts?id=eq.'+p.id,{method:'DELETE'})},
    async aimer(p){
      if(!(cloud()&&ses)){const l=loc();if(l.likes[p.id])delete l.likes[p.id];else l.likes[p.id]=1;saveLoc(l);return}
      if(p.aime)await rq('/rest/v1/likes?post_id=eq.'+p.id+'&user_id=eq.'+ses.id,{method:'DELETE'});else await rq('/rest/v1/likes',{method:'POST',body:{post_id:p.id}});
    },
    async commentaires(p){
      if(!(cloud()&&ses))return loc().coms.filter(c=>c.post===p.id).map(c=>({id:c.id,nom:loc().moi.nom,texte:c.texte,cree:c.cree}));
      return(await rq('/rest/v1/comments?post_id=eq.'+p.id+'&order=cree.asc&select=id,texte,cree,profiles(nom)')||[]).map(c=>({id:c.id,nom:(c.profiles&&c.profiles.nom)||'?',texte:c.texte,cree:Date.parse(c.cree)}));
    },
    async commenter(p,texte){if(!(cloud()&&ses)){const l=loc();l.coms.push({id:'k'+Date.now(),post:p.id,texte,cree:Date.now()});saveLoc(l);return}await rq('/rest/v1/comments',{method:'POST',body:{post_id:p.id,texte}})},
    async signaler(p,motif){if(cloud()&&ses)await rq('/rest/v1/signalements',{method:'POST',body:{post_id:p.id,motif:motif||'contenu inapproprié'}})},
    /* ── personnes ── */
    async chercher(q){if(!(cloud()&&ses))return[];const r=await rq('/rest/v1/profiles?nom=ilike.*'+encodeURIComponent(q)+'*&limit=20&select=id,nom,bio')||[];const f=await rq('/rest/v1/follows?suiveur=eq.'+ses.id+'&select=suivi')||[];const s=new Set(f.map(x=>x.suivi));return r.filter(x=>x.id!==ses.id).map(x=>({...x,suivi:s.has(x.id)}))},
    async suivre(u){if(u.suivi)await rq('/rest/v1/follows?suiveur=eq.'+ses.id+'&suivi=eq.'+u.id,{method:'DELETE'});else await rq('/rest/v1/follows',{method:'POST',body:{suivi:u.id}})},
    async amis(){if(!(cloud()&&ses))return[];const f=await rq('/rest/v1/follows?suiveur=eq.'+ses.id+'&select=profiles!follows_suivi_fkey(id,nom)')||[];return f.map(x=>x.profiles).filter(Boolean)},
    async conversation(id){return(await rq('/rest/v1/messages?or=(and(de.eq.'+ses.id+',a.eq.'+id+'),and(de.eq.'+id+',a.eq.'+ses.id+'))&order=cree.asc&limit=100&select=de,texte,cree')||[]).map(m=>({moi:m.de===ses.id,texte:m.texte,cree:Date.parse(m.cree)}))},
    async envoyer(id,texte){await rq('/rest/v1/messages',{method:'POST',body:{a:id,texte}})}
  };
  return api;
})();

/* ═══ interface commune ═════════════════════════════════════════════════════ */
const quand=t=>{const s=(Date.now()-t)/1000;return s<60?'à l\'instant':s<3600?Math.floor(s/60)+' min':s<86400?Math.floor(s/3600)+' h':new Date(t).toLocaleDateString('fr-FR')};
async function mediaUrl(p){if(p.media)return p.media;if(p.creation){const c=await BD.lire(p.creation);if(c&&c.blob)return urlDe(c.blob)}return''}
function formServeur(retour){
  libre(`<h2>🔌 Serveur Clipbook / ClipTok</h2><p class="doux">Sans serveur, tout reste sur ce téléphone (mode solo). Avec ton serveur Supabase gratuit, plusieurs personnes communiquent. Étapes dans <b>social/LISEZMOI.md</b> du dépôt.</p>
  <label>Adresse du projet (Project URL)</label><input type="url" id="sUrl" placeholder="https://xxxx.supabase.co" value="${esc(Soc.cfg.url)}">
  <label>Clé « anon public » (jamais la clé service_role)</label><input type="password" id="sCle" placeholder="eyJ…" value="${esc(Soc.cfg.cle)}">
  <div class="pied" style="display:flex;gap:10px;margin-top:12px"><button class="btn p" id="sOk">Enregistrer</button><button class="btn" id="sSolo">Mode solo</button></div>`,r=>{
    $('#sOk',r).onclick=()=>{const u=$('#sUrl',r).value.trim(),c=$('#sCle',r).value;if(!/^https:\/\/.+/.test(u)||c.length<30)return toast('Adresse https et clé anon complètes requises.');if(/service_role/.test(atob((c.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/')||'e30=')))return toast('⚠ C\'est la clé service_role : ne la mets jamais ici. Utilise « anon public ».');Soc.config(u,c);fermerTout();retour()};
    $('#sSolo',r).onclick=()=>{Soc.config('','');fermerTout();retour()}});
}
function formCompte(retour){
  libre(`<h2>👤 Compte</h2><div class="rang champ" id="cOng"><span class="choix on" data-m="in">Créer un compte</span><span class="choix" data-m="co">Me connecter</span></div>
  <div id="cNom"><label>Nom affiché</label><input type="text" id="cn" maxlength="30"></div>
  <label>E-mail</label><input type="text" id="ce" autocapitalize="off"><label>Mot de passe (6 caractères min.)</label><input type="password" id="cm">
  <p class="aide">En créant un compte tu acceptes de respecter les autres : pas de harcèlement, contenu illégal ou haineux. Les contenus peuvent être signalés.</p>
  <button class="btn p" id="cOk">Valider</button><p class="doux" id="cEr" style="color:var(--alerte)"></p>`,r=>{
    let m='in';$$('#cOng .choix',r).forEach(b=>b.onclick=()=>{m=b.dataset.m;$$('#cOng .choix',r).forEach(x=>x.classList.toggle('on',x===b));$('#cNom',r).style.display=m==='in'?'':'none'});
    $('#cOk',r).onclick=async()=>{const e=$('#ce',r).value.trim(),p=$('#cm',r).value,n=$('#cn',r).value.trim();$('#cEr',r).textContent='';
      if(!e||p.length<6||(m==='in'&&!n))return $('#cEr',r).textContent='Remplis tous les champs.';
      try{m==='in'?await Soc.inscrire(e,p,n):await Soc.connecter(e,p);fermerTout();retour()}catch(x){$('#cEr',r).textContent=x.message}}});
}
async function ouvrirCommentaires(p,maj){
  const l=await Soc.commentaires(p).catch(()=>[]);
  libre(`<h2>💬 Commentaires</h2><div id="kl">${l.map(c=>`<p><b>${esc(c.nom)}</b> <span class="doux">${quand(c.cree)}</span><br>${esc(c.texte)}</p>`).join('')||'<p class="doux">Aucun commentaire.</p>'}</div>
  <div style="display:flex;gap:8px"><input type="text" id="kt" placeholder="Ton commentaire…"><button class="btn p mini" id="kok">Envoyer</button><button class="btn mini" id="kia" title="Suggestion IA">✨</button></div>`,r=>{
    $('#kok',r).onclick=async()=>{const t=$('#kt',r).value.trim();if(!t)return;try{await Soc.commenter(p,t);fermerTout();maj()}catch(e){toast(esc(e.message))}};
    $('#kia',r).onclick=async()=>{$('#kia',r).textContent='…';try{const x=await llm([{role:'user',content:'Écris UN commentaire court, bienveillant et naturel en français (max 15 mots) pour cette publication : « '+(p.texte||'(média)').slice(0,300)+' ». Réponds uniquement par le commentaire.'}]);$('#kt',r).value=x.texte.trim().replace(/^["«]|["»]$/g,'')}catch(e){toast(esc(e.message))}$('#kia',r).textContent='✨'}});
}
async function menuPost(p,maj){
  libre(`<h2>Options</h2><button class="btn" id="mS">🚩 Signaler</button>${p.auteur.id===Soc.moi().id?'<button class="btn danger" id="mD">🗑 Supprimer ma publication</button>':''}`,r=>{
    $('#mS',r).onclick=async()=>{try{await Soc.signaler(p);fermerTout();toast('Merci, signalement envoyé.')}catch(e){toast(esc(e.message))}};
    if($('#mD',r))$('#mD',r).onclick=async()=>{if(!confirm('Supprimer ?'))return;await Soc.supprimer(p);fermerTout();maj()}});
}
const barreServeur=retour=>`<div class="carte" style="display:flex;gap:8px;align-items:center;padding:10px 12px"><span style="flex:1;font-size:13px">${Soc.cloud()?(Soc.connecte()?'🟢 En ligne · '+esc(Soc.ses.nom||Soc.ses.email):'🟡 Serveur configuré — connecte-toi'):'📴 Mode solo (ce téléphone)'}</span>
  ${Soc.cloud()&&!Soc.connecte()?'<button class="btn mini p" data-s="compte">Compte</button>':''}${Soc.connecte()?'<button class="btn mini" data-s="sortir">Quitter</button>':''}<button class="btn mini" data-s="serveur">🔌</button></div>`;
function lierBarre(p,retour){$$('[data-s]',p).forEach(b=>b.onclick=()=>{const s=b.dataset.s;if(s==='serveur')formServeur(retour);else if(s==='compte')formCompte(retour);else{Soc.deconnecter();retour()}})}
async function choisirMedia(accept){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>res(i.files[0]||null);i.click()})}

/* ═══ CLIPBOOK ══════════════════════════════════════════════════════════════ */
let _cbOng='fil';
VUES.clipbook=async function(){
  const p=$('#pClipbook'),retour=()=>VUES.clipbook();
  p.innerHTML=`<h1 style="margin:0 0 10px">💬 Clipbook</h1>${barreServeur()}
  <div class="rang champ" id="cbO">${[['fil','Fil'],['amis','Amis'],['msg','Messages'],['moi','Profil']].map(([k,l])=>`<span class="choix ${_cbOng===k?'on':''}" data-k="${k}">${l}</span>`).join('')}</div><div id="cbC"></div>`;
  lierBarre(p,retour);$$('#cbO .choix',p).forEach(b=>b.onclick=()=>{_cbOng=b.dataset.k;retour()});
  const C=$('#cbC',p);
  if(_cbOng==='fil')await cbFil(C,retour);else if(_cbOng==='amis')await cbAmis(C,retour);else if(_cbOng==='msg')await cbMsg(C,retour);else cbMoi(C,retour);
};
let _cbPieces=[];
async function cbFil(C,retour){
  C.innerHTML=`<div class="carte"><textarea id="cbT" rows="2" placeholder="Quoi de neuf ?"></textarea><div id="cbPJ" class="doux" style="margin:6px 0"></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn mini" id="cbPh">📷 Photo</button><button class="btn mini" id="cbVi">🎬 Vidéo</button><button class="btn mini" id="cbCr">🎨 Mes créations</button><button class="btn mini" id="cbIA">✨ IA</button><button class="btn mini p" id="cbPub" style="margin-left:auto">Publier</button></div></div><div id="cbL"><p class="doux">Chargement…</p></div>`;
  let pj=null,pjCr=null;const aff=()=>$('#cbPJ',C).textContent=pj?'📎 '+(pj.name||'fichier')+' (touche pour retirer)':pjCr?'📎 création Clipia':'';
  $('#cbPJ',C).onclick=()=>{pj=null;pjCr=null;aff()};
  $('#cbPh',C).onclick=async()=>{const f=await choisirMedia('image/*');if(f){pj=f;pjCr=null;aff()}};
  $('#cbVi',C).onclick=async()=>{const f=await choisirMedia('video/*');if(f){pj=f;pjCr=null;aff()}};
  $('#cbCr',C).onclick=async()=>{const l=(await BD.tous()).filter(c=>c.type==='image'||c.type==='video');if(!l.length)return toast('Aucune création image ou vidéo : va dans Créer.');
    libre(`<h2>Mes créations</h2><div class="gi">${l.slice(0,30).map(c=>`<div class="ic" data-id="${c.id}"><div class="pic">${c.type==='video'?'🎬':'🖼'}</div><span>${esc(c.titre)}</span></div>`).join('')}</div>`,r=>$$('.ic',r).forEach(e=>e.onclick=async()=>{const c=l.find(x=>x.id===e.dataset.id);pjCr=c;pj=null;fermerTout();aff()}))};
  $('#cbIA',C).onclick=()=>libre(`<h2>✨ Aide IA</h2>${[['reformuler','Reformuler mon texte'],['idee','Me donner une idée de publication'],['image','Illustrer avec une image IA'],['resume','Résumer mon fil'],['trad','Traduire en anglais']].map(([k,l])=>`<button class="btn" data-ia="${k}">${l}</button>`).join('')}`,r=>$$('[data-ia]',r).forEach(b=>b.onclick=async()=>{
    const k=b.dataset.ia,t=$('#cbT',C).value.trim();fermerTout();toast('✨ Clipia réfléchit…',20000);
    try{
      if(k==='image'){if(!t)return toast('Écris d\'abord un texte.');const bl=await genererImage(t);pj=bl;pjCr=null;aff();toast('Image ajoutée.');return}
      let q;if(k==='reformuler'){if(!t)return toast('Écris d\'abord un texte.');q='Reformule ce texte pour un réseau social, ton chaleureux, même langue, sans explication : '+t}
      else if(k==='trad'){if(!t)return toast('Écris d\'abord un texte.');q='Traduis en anglais, réponds uniquement par la traduction : '+t}
      else if(k==='idee')q='Propose une idée de publication originale et courte pour un réseau social (2 phrases max, en français), sans guillemets.';
      else{const f=await Soc.fil('clipbook');if(!f.length)return toast('Ton fil est vide.');q='Résume en 3 puces courtes ce fil de publications :\n'+f.slice(0,15).map(x=>'- '+x.auteur.nom+' : '+x.texte).join('\n')}
      const x=await llm([{role:'user',content:q}]);
      if(k==='resume')libre('<h2>Résumé du fil</h2><p>'+esc(x.texte).replace(/\n/g,'<br>')+'</p>');else{$('#cbT',C).value=x.texte.trim();toast('Texte ajouté.')}
    }catch(e){toast(esc(e.message))}}));
  $('#cbPub',C).onclick=async()=>{const t=$('#cbT',C).value.trim();if(!t&&!pj&&!pjCr)return toast('Écris quelque chose ou ajoute un média.');
    try{const src=pj||(pjCr&&pjCr.blob),isV=src&&src.type&&src.type.startsWith('video');const type=!src?'texte':isV?'video':'photo';
      await Soc.publier('clipbook',{type,texte:t,blob:pj||(Soc.connecte()&&pjCr?pjCr.blob:null),creation:!Soc.connecte()&&pjCr?pjCr.id:null});retour()}catch(e){toast(esc(e.message))}};
  let fil=[];try{fil=await Soc.fil('clipbook')}catch(e){$('#cbL',C).innerHTML='<p class="doux" style="color:var(--alerte)">'+esc(e.message)+'</p>';return}
  const L=$('#cbL',C);if(!fil.length){L.innerHTML='<p class="doux">Aucune publication. Écris la première !</p>';return}
  L.innerHTML=fil.map(x=>`<div class="carte" data-p="${x.id}"><div style="display:flex;gap:8px;align-items:center"><b style="flex:1">${esc(x.auteur.nom)} <span class="doux" style="font-weight:400">· ${quand(x.cree)}</span></b><button class="btn mini" data-a="menu">⋯</button></div>
  ${x.texte?`<p style="white-space:pre-wrap;margin:8px 0">${esc(x.texte)}</p>`:''}<div data-m="${x.id}"></div>
  <div style="display:flex;gap:8px;margin-top:8px"><button class="btn mini ${x.aime?'p':''}" data-a="like">${x.aime?'❤️':'🤍'} ${x.nbLikes}</button><button class="btn mini" data-a="com">💬 ${x.nbCom}</button></div></div>`).join('');
  for(const x of fil){if(x.type==='texte')continue;const u=await mediaUrl(x);const el=$(`[data-m="${x.id}"]`,L);if(el&&u)el.innerHTML=x.type==='video'?`<video src="${u}" controls playsinline preload="metadata" style="width:100%;border-radius:12px"></video>`:`<img src="${u}" style="width:100%;border-radius:12px" loading="lazy">`}
  L.onclick=async e=>{const b=e.target.closest('[data-a]');if(!b)return;const x=fil.find(f=>String(f.id)===b.closest('[data-p]').dataset.p);
    try{if(b.dataset.a==='like'){await Soc.aimer(x);retour()}else if(b.dataset.a==='com')ouvrirCommentaires(x,retour);else menuPost(x,retour)}catch(er){toast(esc(er.message))}};
}
async function cbAmis(C,retour){
  if(!Soc.connecte()){C.innerHTML='<div class="carte"><p>Les amis et abonnements demandent un serveur et un compte. Branche ton serveur (🔌) puis crée ton compte.</p></div>';return}
  C.innerHTML=`<div style="display:flex;gap:8px"><input type="text" id="aq" placeholder="Chercher une personne…"><button class="btn p mini" id="ag">Chercher</button></div><div id="ar"></div><h3>Mes abonnements</h3><div id="am"></div>`;
  const am=await Soc.amis().catch(()=>[]);$('#am',C).innerHTML=am.map(u=>`<div class="carte">${esc(u.nom)}</div>`).join('')||'<p class="doux">Personne encore.</p>';
  $('#ag',C).onclick=async()=>{try{const r=await Soc.chercher($('#aq',C).value.trim());$('#ar',C).innerHTML=r.map(u=>`<div class="carte" style="display:flex;align-items:center;gap:8px"><b style="flex:1">${esc(u.nom)}</b><button class="btn mini ${u.suivi?'':'p'}" data-u="${u.id}">${u.suivi?'Ne plus suivre':'Suivre'}</button></div>`).join('')||'<p class="doux">Aucun résultat.</p>';
    $$('[data-u]',C).forEach(b=>b.onclick=async()=>{await Soc.suivre(r.find(u=>u.id===b.dataset.u));retour()})}catch(e){toast(esc(e.message))}};
}
async function cbMsg(C,retour){
  if(!Soc.connecte()){C.innerHTML='<div class="carte"><p>La messagerie demande un serveur et un compte (🔌).</p></div>';return}
  const am=await Soc.amis().catch(()=>[]);C.innerHTML=am.length?am.map(u=>`<div class="carte" data-u="${u.id}" data-n="${esc(u.nom)}" style="cursor:pointer">💬 ${esc(u.nom)}</div>`).join(''):'<p class="doux">Abonne-toi à quelqu\'un (onglet Amis) pour lui écrire.</p>';
  $$('[data-u]',C).forEach(c=>c.onclick=async()=>{const id=c.dataset.u,nom=c.dataset.n;
    const ouvrirC=async()=>{const m=await Soc.conversation(id).catch(()=>[]);libre(`<h2>${esc(nom)}</h2><div style="max-height:45vh;overflow:auto">${m.map(x=>`<p style="text-align:${x.moi?'right':'left'}"><span style="display:inline-block;padding:7px 11px;border-radius:14px;background:${x.moi?'#7c5cff55':'var(--carte2)'}">${esc(x.texte)}</span></p>`).join('')||'<p class="doux">Dis bonjour 👋</p>'}</div>
      <div style="display:flex;gap:8px"><input type="text" id="mt2" placeholder="Message…"><button class="btn p mini" id="mo">Envoyer</button><button class="btn mini" id="mr" title="Réponse IA">✨</button></div>`,r=>{
        $('#mo',r).onclick=async()=>{const t=$('#mt2',r).value.trim();if(!t)return;try{await Soc.envoyer(id,t);ouvrirC()}catch(e){toast(esc(e.message))}};
        $('#mr',r).onclick=async()=>{const d=m.filter(x=>!x.moi).pop();try{const x=await llm([{role:'user',content:'Propose une réponse courte et naturelle en français à ce message : « '+(d?d.texte:'Salut !')+' ». Réponds uniquement par la réponse.'}]);$('#mt2',r).value=x.texte.trim()}catch(e){toast(esc(e.message))}}})};ouvrirC()});
}
function cbMoi(C,retour){
  const m=Soc.moi();C.innerHTML=`<div class="carte"><label>Nom affiché</label><input type="text" id="pn" value="${esc(m.nom)}" maxlength="30"><label>Bio</label><textarea id="pb" rows="2" placeholder="Quelques mots sur toi"></textarea><button class="btn p" id="ps">Enregistrer</button><button class="btn" id="pia">✨ Écrire ma bio avec l'IA</button></div>`;
  $('#ps',C).onclick=async()=>{try{await Soc.renommer($('#pn',C).value.trim()||'Moi',$('#pb',C).value.trim());toast('Profil enregistré.')}catch(e){toast(esc(e.message))}};
  $('#pia',C).onclick=async()=>{try{const x=await llm([{role:'user',content:'Écris une bio de réseau social courte (max 20 mots, français, sympathique) pour une personne qui s\'appelle '+$('#pn',C).value+'. Réponds uniquement par la bio.'}]);$('#pb',C).value=x.texte.trim()}catch(e){toast(esc(e.message))}};
}

/* ═══ CLIPTOK ═══════════════════════════════════════════════════════════════ */
let _ctOng='pour';
VUES.cliptok=async function(){
  const p=$('#pClipTok'),retour=()=>VUES.cliptok();
  p.innerHTML=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><h1 style="margin:0;flex:1">🎵 ClipTok</h1><button class="btn mini p" id="ctNew">＋ Publier</button></div>${barreServeur()}
  <div class="rang champ" id="ctO"><span class="choix ${_ctOng==='pour'?'on':''}" data-k="pour">Pour toi</span><span class="choix ${_ctOng==='abo'?'on':''}" data-k="abo">Abonnements</span></div><div id="ctF" class="ctflux"><p class="doux">Chargement…</p></div>`;
  lierBarre(p,retour);$$('#ctO .choix',p).forEach(b=>b.onclick=()=>{_ctOng=b.dataset.k;retour()});
  $('#ctNew',p).onclick=()=>ctPublier(retour);
  let fil=[];try{fil=await Soc.fil('cliptok',{suivis:_ctOng==='abo'&&Soc.connecte()})}catch(e){$('#ctF',p).innerHTML='<p class="doux" style="color:var(--alerte)">'+esc(e.message)+'</p>';return}
  const F=$('#ctF',p);if(!fil.length){F.innerHTML='<p class="doux">Aucune vidéo pour l\'instant. Touche « ＋ Publier » pour poster la première.</p>';return}
  F.innerHTML=fil.map(x=>`<div class="ctv" data-p="${x.id}"><div class="ctm" data-m="${x.id}"></div>
  <div class="ctl"><b>@${esc(x.auteur.nom)}</b><p>${esc(x.texte)}</p></div>
  <div class="ctr"><button data-a="like">${x.aime?'❤️':'🤍'}<small>${x.nbLikes}</small></button><button data-a="com">💬<small>${x.nbCom}</small></button><button data-a="part">↗<small>Partager</small></button><button data-a="menu">⋯</button></div></div>`).join('');
  const io=new IntersectionObserver(es=>es.forEach(en=>{const v=en.target.querySelector('video');if(!v)return;if(en.isIntersecting)v.play().catch(()=>{});else v.pause()}),{threshold:.7});
  for(const x of fil){const u=await mediaUrl(x);const el=$(`[data-m="${x.id}"]`,F);if(!el)continue;el.innerHTML=u?(x.type==='video'?`<video src="${u}" loop playsinline muted preload="metadata"></video>`:`<img src="${u}">`):'<div class="doux" style="padding:40px">Média indisponible</div>';
    const v=el.querySelector('video');if(v)v.onclick=()=>{v.muted=!v.muted;if(v.paused)v.play()};io.observe(el.parentElement)}
  F.onclick=async e=>{const b=e.target.closest('[data-a]');if(!b)return;const x=fil.find(f=>String(f.id)===b.closest('[data-p]').dataset.p);
    try{if(b.dataset.a==='like'){await Soc.aimer(x);retour()}else if(b.dataset.a==='com')ouvrirCommentaires(x,retour);else if(b.dataset.a==='menu')menuPost(x,retour);
      else{const u=await mediaUrl(x);if(navigator.share&&u&&u.startsWith('http'))navigator.share({title:'ClipTok',text:x.texte,url:u}).catch(()=>{});else toast('Partage disponible pour les vidéos en ligne.')}}catch(er){toast(esc(er.message))}};
};
async function ctPublier(retour){
  libre(`<h2>＋ Publier une vidéo</h2><label>Légende</label><textarea id="cl" rows="2" maxlength="200" placeholder="Décris ta vidéo…"></textarea>
  <button class="btn" id="cg">📱 Choisir dans la galerie</button><button class="btn" id="cc">🎬 Une vidéo Clipia (Créer)</button><button class="btn" id="ci">✨ Légende et hashtags IA</button><p class="aide">Pas encore dans cette version : duo, direct, effets, sons de la communauté. Pour créer une vidéo avec l'IA, va dans <b>Créer → Clip vidéo</b>.</p>`,r=>{
    const pub=async(blob,cr)=>{try{fermerTout();toast('Publication…',20000);await Soc.publier('cliptok',{type:'video',texte:$('#cl',r).value.trim(),blob,creation:cr});toast('Publié ✔');retour()}catch(e){toast(esc(e.message))}};
    $('#cg',r).onclick=async()=>{const f=await choisirMedia('video/*');if(!f)return;if(f.size>50*1024*1024)return toast('Vidéo trop lourde (50 Mo max).');pub(f,null)};
    $('#cc',r).onclick=async()=>{const l=(await BD.tous()).filter(c=>c.type==='video');if(!l.length)return toast('Aucune vidéo Clipia : crée-en une dans Créer.');
      libre('<h2>Mes vidéos</h2><div class="gi">'+l.slice(0,30).map(c=>`<div class="ic" data-id="${c.id}"><div class="pic">🎬</div><span>${esc(c.titre)}</span></div>`).join('')+'</div>',r2=>$$('.ic',r2).forEach(e=>e.onclick=()=>{const c=l.find(x=>x.id===e.dataset.id);Soc.connecte()?pub(c.blob,null):pub(null,c.id)}))};
    $('#ci',r).onclick=async()=>{const t=$('#cl',r).value.trim();try{const x=await llm([{role:'user',content:'Écris une légende courte et accrocheuse (max 120 caractères) avec 3 hashtags pour une vidéo courte'+(t?' sur : '+t:'')+'. Français. Réponds uniquement par la légende.'}]);$('#cl',r).value=x.texte.trim()}catch(e){toast(esc(e.message))}}});
}
