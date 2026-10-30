'use strict';
/* Clipia X8 — connexion Google (Gmail, Agenda). Flux « implicite » : aucun secret dans l'appli, jeton valable ~1 h. */
const Google=(()=>{
  const SCOPES=['openid','email','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/calendar.readonly'];
  let st=null;
  const cid=()=>M.lire('goog.client','');
  const tok=()=>{const t=M.lire('goog.tok',null);return t&&t.exp>Date.now()+30000?t:null};
  const g={
    clientId:cid,setClient(v){M.ecrire('goog.client',(v||'').trim())},
    connecte:()=>!!tok(),email:()=>(tok()||{}).email||'',
    deconnecter(){M.vider('goog.tok')},
    connecter(){
      if(!cid())throw new Error('Renseigne d\'abord l\'identifiant client Google (Réglages → Google).');
      st=Math.random().toString(36).slice(2)+Date.now().toString(36);M.ecrire('goog.state',st);
      const u='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:cid(),redirect_uri:SITE+'app/oauth.html',response_type:'token',scope:SCOPES.join(' '),state:st,prompt:'consent'});
      if(NATIF&&NATIF.ouvrirLien)NATIF.ouvrirLien(u);else window.open(u,'_blank');
    },
    async recevoir(frag){
      const p=new URLSearchParams(frag);if(p.get('error')){toast('Google : '+esc(p.get('error')));return false}
      if(!p.get('access_token')||p.get('state')!==M.lire('goog.state',''))return toast('Connexion Google invalide, réessaie.'),false;
      const t={t:p.get('access_token'),exp:Date.now()+(+p.get('expires_in')||3600)*1000,email:''};M.ecrire('goog.tok',t);
      try{const r=await net('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+t.t}});if(r.ok){t.email=JSON.parse(r.texte).email||'';M.ecrire('goog.tok',t)}}catch(e){}
      M.vider('goog.state');toast('✔ Google connecté '+esc(t.email));if(document.querySelector('#v-reglages.on'))majReglages();return true;
    },
    async api(url,opt={}){
      const t=tok();if(!t)throw new Error('Google non connecté ou session expirée (1 h) : reconnecte-toi dans Réglages → Google.');
      const r=await net(url,{method:opt.method||'GET',headers:{Authorization:'Bearer '+t.t,'Content-Type':'application/json'},body:opt.body?JSON.stringify(opt.body):null});
      if(!r.ok){let m='';try{m=JSON.parse(r.texte).error.message}catch(e){}throw new Error('Google '+r.status+(m?' : '+m:''))}
      return r.texte?JSON.parse(r.texte):null;
    },
    async courriels(q='',n=5){
      const l=await g.api('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults='+n+(q?'&q='+encodeURIComponent(q):'&labelIds=INBOX'));
      const out=[];for(const m of (l&&l.messages)||[]){const d=await g.api('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+m.id+'?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date');
        const h=k=>((d.payload.headers||[]).find(x=>x.name===k)||{}).value||'';out.push({de:h('From'),sujet:h('Subject'),date:h('Date'),extrait:d.snippet||''})}
      return out;
    },
    async envoyer(a,sujet,texte){
      const enc=s=>btoa(unescape(encodeURIComponent(s)));
      const mime=`To: ${a}\r\nSubject: =?UTF-8?B?${enc(sujet||'(sans objet)')}?=\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${enc(texte)}`;
      await g.api('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',body:{raw:btoa(mime).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}});
    },
    async agenda(n=8){
      const r=await g.api('https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults='+n+'&timeMin='+encodeURIComponent(new Date().toISOString()));
      return((r&&r.items)||[]).map(e=>({titre:e.summary||'(sans titre)',debut:(e.start&&(e.start.dateTime||e.start.date))||'',lieu:e.location||''}));
    }
  };
  return g;
})();
window.Google=Google;window.__clipiaOAuth=f=>Google.recevoir(f);
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&typeof e.data.clipiaOAuth==='string')Google.recevoir(e.data.clipiaOAuth)});

OUTILS_SYS.google=async function(a,ctx){
  if(!Google.connecte())return 'Google n\'est pas connecté : demande à la personne de se connecter dans Réglages → Google.';
  const act=norm(a.at.action||'');
  if(act==='agenda'){const l=await Google.agenda();return l.length?'Prochains événements : '+l.map(e=>`${e.titre} (${e.debut}${e.lieu?', '+e.lieu:''})`).join(' ; '):'Aucun événement à venir.'}
  if(act==='lire_mail'){const l=await Google.courriels(a.corps||'',5);return l.length?l.map(m=>`De ${m.de} — « ${m.sujet} » (${m.date}) : ${m.extrait}`).join('\n'):'Aucun courriel trouvé.'}
  if(act==='envoyer_mail'){
    const to=(a.at.a||'').trim(),sujet=a.at.sujet||'',texte=(a.corps||'').trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))return 'Adresse du destinataire manquante ou invalide : demande-la à la personne.';
    if(!texte)return 'Texte vide : demande ce qu\'il faut écrire.';
    ctx.etape('J\'attends ta confirmation…');
    const ok=await new Promise(res=>{_pend=res;libre(`<h2>✉️ E-mail à ${esc(to)}</h2><p class="doux">Objet : ${esc(sujet)}</p><p style="white-space:pre-wrap">${esc(texte)}</p><div style="display:flex;gap:10px"><button class="btn p" id="gok">Envoyer</button><button class="btn" id="gko">Annuler</button></div>`,r=>{$('#gok',r).onclick=()=>{_pend=null;fermerTout();res(true)};$('#gko',r).onclick=()=>{_pend=null;fermerTout();res(false)}})});
    if(!ok)return 'La personne a annulé : rien n\'a été envoyé.';
    await Google.envoyer(to,sujet,texte);return 'E-mail envoyé à '+to+'.';
  }
  return 'Action inconnue : utilise lire_mail, envoyer_mail ou agenda.';
};
const _mrG=majReglages;majReglages=function(){_mrG();const p=$('#pReglages');const d=document.createElement('div');
  d.innerHTML=`<h3>Google (Gmail, Agenda)</h3><p class="aide">${Google.connecte()?'🟢 Connecté : '+esc(Google.email()):'Non connecté.'} La connexion dure environ 1 h. Il te faut un « ID client OAuth » de type Application Web (voir google/LISEZMOI.md). Les photos Google ne sont plus accessibles aux applications tierces.</p>
  <input type="text" id="gCid" placeholder="ID client Google (….apps.googleusercontent.com)" value="${esc(Google.clientId())}"><button class="btn p" id="gCo">${Google.connecte()?'Reconnecter':'Se connecter à Google'}</button>${Google.connecte()?'<button class="btn" id="gDe">Se déconnecter</button>':''}`;
  p.appendChild(d);
  $('#gCo',d).onclick=()=>{try{Google.setClient($('#gCid',d).value);Google.connecter()}catch(e){toast(esc(e.message))}};
  if($('#gDe',d))$('#gDe',d).onclick=()=>{Google.deconnecter();majReglages()};
};
