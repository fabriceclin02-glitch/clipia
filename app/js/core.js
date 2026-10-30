'use strict';
/* Clipia X8 mobile — noyau : stockage, réseau, moteurs de texte, enregistrement de fichiers */
const VERSION='8.5.0';
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const attends=ms=>new Promise(r=>setTimeout(r,ms));
const NATIF=window.ClipiaAndroid||null;

const M={lire(c,d){try{const v=localStorage.getItem('clipia.'+c);return v===null?d:JSON.parse(v)}catch(e){return d}},ecrire(c,v){try{localStorage.setItem('clipia.'+c,JSON.stringify(v))}catch(e){}},vider(c){try{localStorage.removeItem('clipia.'+c)}catch(e){}}};

/* ── état persistant ─────────────────────────────────────────────────────── */
const E={
  profil:M.lire('profil',{prenom:'',tu:true,ton:'chaleureux',longueur:'courte',fait:false}),
  moteur:M.lire('moteur','libre'),
  cles:M.lire('cles',{}),            // groq, gemini, openrouter, pollinations, hf
  modeles:M.lire('modeles',{}),
  pc:M.lire('pc',{url:'',jeton:''}),
  agents:M.lire('agents',null),
  agentActif:M.lire('agentActif',''),
  memoire:M.lire('memoire',[]),
  messages:M.lire('messages',[]),
  voixActive:M.lire('voixActive',true),voixNom:M.lire('voixNom',''),vitesse:M.lire('vitesse',1),
  // volatile
  conversation:false,occupe:false,ecoute:false,parle:false,niveau:0,creation:false
};
const sauver=()=>{M.ecrire('profil',E.profil);M.ecrire('moteur',E.moteur);M.ecrire('cles',E.cles);M.ecrire('modeles',E.modeles);M.ecrire('pc',E.pc);M.ecrire('agents',E.agents);M.ecrire('agentActif',E.agentActif);M.ecrire('memoire',E.memoire.slice(-40));M.ecrire('messages',E.messages.slice(-40).map(m=>({role:m.role,contenu:m.contenu,cr:m.cr||[]})));M.ecrire('voixActive',E.voixActive);M.ecrire('voixNom',E.voixNom);M.ecrire('vitesse',E.vitesse)};

/* ── réseau : natif Android (sans CORS) ou fetch ─────────────────────────── */
const b64Blob=(b64,mime)=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:(mime||'application/octet-stream').split(';')[0]})};
const blobB64=b=>new Promise((ok,ko)=>{const f=new FileReader();f.onload=()=>ok(String(f.result).split(',')[1]||'');f.onerror=()=>ko(f.error);f.readAsDataURL(b)});
const texteB64=t=>{const u=new TextEncoder().encode(t);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)};
let _hid=0;const _hw={};
window.__clipiaHttp=(id,ok,status,mime,data)=>{const f=_hw[id];delete _hw[id];if(f)f({ok,status,mime,data})};
async function net(url,{method='GET',headers={},body=null,binaire=false,delai=150000}={}){
  if(NATIF&&NATIF.http){
    return new Promise((res,rej)=>{
      const id='h'+(++_hid);const t=setTimeout(()=>{delete _hw[id];rej(new Error('Délai dépassé : le service ne répond pas.'))},delai);
      _hw[id]=r=>{clearTimeout(t);
        if(!r.ok&&r.status===0)return rej(new Error('Connexion impossible : '+r.data));
        let texte=null,blob=null;
        if(binaire){if(r.ok)blob=b64Blob(r.data,r.mime);else{try{texte=atob(r.data)}catch(e){texte=''}}}else texte=r.data;
        res({ok:r.ok,status:r.status,mime:r.mime,texte,blob})};
      try{NATIF.http(id,method,url,JSON.stringify(headers),body?texteB64(body):'',binaire?'binaire':'texte')}catch(e){clearTimeout(t);delete _hw[id];rej(e)}
    });
  }
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),delai);
  try{
    const r=await fetch(url,{method,headers,body,signal:ctl.signal});
    const mime=r.headers.get('content-type')||'';
    if(binaire&&r.ok)return{ok:true,status:r.status,mime,blob:await r.blob(),texte:null};
    return{ok:r.ok,status:r.status,mime,texte:await r.text(),blob:null};
  }catch(e){throw new Error(e.name==='AbortError'?'Délai dépassé : le service ne répond pas.':'Connexion impossible (réseau ou restriction du service).')}
  finally{clearTimeout(t)}
}
function messageHttp(r,nom){
  const c=r.status;let d='';try{const j=JSON.parse(r.texte);d=(j.error&&(j.error.message||j.error))||j.message||''}catch(e){d=String(r.texte||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,200)}
  if(typeof d!=='string')d=JSON.stringify(d);d=d.slice(0,220);
  const det=d?' — « '+d+' »':'';
  if(c===401)return nom+' : clé refusée (401)'+det+'. Vérifie qu\'elle est copiée en entier, sans espace.';
  if(c===403)return nom+' : accès refusé (403)'+det+'.';
  if(c===402)return nom+' : limite atteinte ou crédit épuisé (402)'+det+'.';
  if(c===429)return nom+' : trop de demandes (429)'+det+'. Patiente un peu.';
  if(c===404)return nom+' : modèle ou adresse introuvable (404)'+det+'. Change le modèle dans Réglages.';
  return nom+' : erreur '+c+det;
}

/* ── création = stockage local (IndexedDB) ───────────────────────────────── */
const BD=(()=>{
  let db=null,mem=new Map();
  const ouvrir=()=>new Promise(ok=>{try{const r=indexedDB.open('clipia-x8',1);r.onupgradeneeded=()=>r.result.createObjectStore('c',{keyPath:'id'});r.onsuccess=()=>{db=r.result;ok()};r.onerror=()=>ok()}catch(e){ok()}});
  const pret=ouvrir();
  const tx=(m,f)=>new Promise(ok=>{if(!db)return ok(f(null));const t=db.transaction('c',m);const s=t.objectStore('c');const r=f(s);if(r&&r.onsuccess!==undefined){r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)}else t.oncomplete=()=>ok(r)});
  return{
    async put(o){await pret;if(!db){mem.set(o.id,o);return}await tx('readwrite',s=>s.put(o))},
    async tous(){await pret;if(!db)return[...mem.values()].sort((a,b)=>b.date-a.date);return(await tx('readonly',s=>s.getAll())||[]).sort((a,b)=>b.date-a.date)},
    async lire(id){await pret;if(!db)return mem.get(id);return tx('readonly',s=>s.get(id))},
    async suppr(id){await pret;if(!db){mem.delete(id);return}await tx('readwrite',s=>s.delete(id))}
  };
})();
const EXT={image:'png',musique:'wav',video:'webm'};
async function nouvelleCreation(type,titre,blob,meta={}){
  const c={id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type,titre:titre||type,date:Date.now(),blob,mime:blob.type||'',meta};
  await BD.put(c);return c;
}
const nomFichier=c=>{const base=(c.meta&&c.meta.fichier)||((c.titre||c.type).replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,40)||c.type);return /\.[a-z0-9]{2,5}$/i.test(base)?base:base+'.'+(EXT[c.type]||'txt')};

/* ── enregistrement dans le téléphone ────────────────────────────────────── */
let _urlsVie=[];
function urlDe(blob){const u=URL.createObjectURL(blob);_urlsVie.push(u);if(_urlsVie.length>60)URL.revokeObjectURL(_urlsVie.shift());return u}
async function enregistrer(c){
  const nom=nomFichier(c);
  if(NATIF&&NATIF.ecrireDebut){
    try{
      if(!NATIF.ecrireDebut(nom,c.blob.type||'application/octet-stream'))throw new Error('ouverture');
      const T=600000;for(let i=0;i<c.blob.size;i+=T){const b64=await blobB64(c.blob.slice(i,i+T));if(!NATIF.ecrireMorceau(b64))throw new Error('écriture')}
      const r=JSON.parse(NATIF.ecrireFin());if(!r.ok)throw new Error('fin');
      return{ok:true,id:r.id,chemin:r.chemin,natif:true};
    }catch(e){return{ok:false,erreur:'Enregistrement impossible : '+e.message}}
  }
  try{const a=document.createElement('a');a.href=urlDe(c.blob);a.download=nom;document.body.appendChild(a);a.click();a.remove();return{ok:true,chemin:'Téléchargements / '+nom,natif:false}}catch(e){return{ok:false,erreur:'Enregistrement impossible.'}}
}
async function partager(c,idNatif){
  if(NATIF&&idNatif&&NATIF.partagerFichier){NATIF.partagerFichier(idNatif);return}
  try{const f=new File([c.blob],nomFichier(c),{type:c.blob.type});if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:c.titre});else await navigator.share({title:c.titre,text:c.titre})}catch(e){}
}

/* ── moteurs de texte ─────────────────────────────────────────────────────
   Aucune clé n'est embarquée : « Libre » est anonyme (service communautaire, très limité) ;
   les autres utilisent la clé gratuite que la personne crée elle-même et qui reste sur le téléphone. */
const MOTEURS={
  groq:{nom:'Groq',court:'🚀 Groq',base:'https://api.groq.com/openai/v1',lien:'https://console.groq.com/keys',ph:'gsk_…',defaut:'llama-3.3-70b-versatile',
    desc:'Gratuit, le plus rapide. Recommandé pour commencer.',etapes:['Ouvre le lien ci-dessous et connecte-toi (Google ou e-mail).','Touche « Create API Key », donne un nom, valide.','Copie la clé (gsk_…) et colle-la ici.']},
  gemini:{nom:'Google Gemini',court:'✨ Gemini',base:'https://generativelanguage.googleapis.com/v1beta/openai',lien:'https://aistudio.google.com/apikey',ph:'AIza…',defaut:'gemini-2.5-flash',
    desc:'Gratuit avec un compte Google, très capable pour le code.',etapes:['Ouvre le lien et connecte-toi avec ton compte Google.','Touche « Créer une clé API ».','Copie la clé (AIza…) et colle-la ici.']},
  pollinations:{nom:'Pollinations (clé)',court:'🌸 Pollinations',base:'https://gen.pollinations.ai/v1',lien:'https://enter.pollinations.ai/keys',ph:'pk_… ou sk_…',defaut:'',
    desc:'Une seule clé pour texte, images, voix et vidéo IA.',etapes:['Ouvre le lien et crée un compte.','Crée une clé d\'application (pk_…).','Colle-la ici : Clipia choisit le modèle toute seule.']},
  openrouter:{nom:'OpenRouter (modèles gratuits)',court:'🌐 OpenRouter',base:'https://openrouter.ai/api/v1',lien:'https://openrouter.ai/keys',ph:'sk-or-v1-…',defaut:'meta-llama/llama-3.3-70b-instruct:free',
    desc:'Plein de modèles gratuits avec une clé gratuite.',etapes:['Ouvre le lien et connecte-toi.','Crée une clé (Create Key).','Colle-la ici.']},
  pc:{nom:'Mon PC (Clipia X8 sur ordinateur)',court:'🖥 Mon PC',desc:'Toute la puissance de Clipia sur ton ordinateur, pilotée d\'ici.'},
  libre:{nom:'Libre (sans clé)',court:'⚡ Libre',base:'https://text.pollinations.ai/openai',defaut:'',desc:'Sans compte ni clé, mais très limité (1 demande toutes les 30 s environ, modèle modeste). Dépannage seulement.'}
};
const ORDRE_SECOURS=['groq','gemini','openrouter','pollinations'];
const aCle=id=>!!(E.cles[id]&&E.cles[id].trim());
const nettoyerCle=t=>String(t||'').replace(/[\s\u200b\u00a0"']+/g,'').replace(/^Bearer/i,'');
function moteursPrets(){const l=[];if(E.moteur==='pc'&&E.pc.url)l.push('pc');else if(E.moteur!=='libre'&&E.moteur!=='pc'&&aCle(E.moteur))l.push(E.moteur);
  ORDRE_SECOURS.forEach(i=>{if(aCle(i)&&!l.includes(i))l.push(i)});if(!l.includes('libre'))l.push('libre');return l}
const modeleDe=id=>E.modeles[id]||MOTEURS[id].defaut;

async function modelesDe(id){
  const m=MOTEURS[id];const r=await net(m.base+'/models',{headers:{Authorization:'Bearer '+E.cles[id]},delai:25000});
  if(!r.ok)throw new Error(messageHttp(r,m.nom));
  const j=JSON.parse(r.texte);const l=(j.data||j.models||[]).map(x=>(x.id||x.name||'').replace(/^models\//,'')).filter(Boolean);
  return l;
}
async function choisirModelePollinations(){
  if(E.modeles.pollinations)return E.modeles.pollinations;
  const l=await modelesDe('pollinations');
  const pref=[/gpt-5.*nano/,/gpt.*mini/,/gemini.*flash/,/nano/,/mini/,/flash/,/gpt/];
  let ch=null;for(const p of pref){ch=l.find(x=>p.test(x.toLowerCase()));if(ch)break}
  ch=ch||l[0];if(!ch)throw new Error('Pollinations : aucun modèle de texte disponible avec cette clé.');
  E.modeles.pollinations=ch;sauver();return ch;
}

let _pcSeq=0;const _pcW={};
window.__clipiaPC=(id,ok,texte)=>{const f=_pcW[id];if(!f)return;delete _pcW[id];f(ok,texte)};
async function appelPC(texte){
  const base=(E.pc.url||'').trim().replace(/\/+$/,'');if(!base)throw new Error('Indique l\'adresse de ton PC dans Réglages → Mon PC.');
  const corps=JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'clipia_demander',arguments:{message:texte}}});
  let brut;
  if(NATIF&&NATIF.requetePC){brut=await new Promise((res,rej)=>{const id='p'+(++_pcSeq);_pcW[id]=(ok,t)=>ok?res(t):rej(new Error('Mon PC ne répond pas : '+t));NATIF.requetePC(id,base+'/mcp',E.pc.jeton||'',corps)})}
  else{const r=await net(base+'/mcp',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+(E.pc.jeton||'')},body:corps});if(!r.ok)throw new Error('Mon PC a répondu '+r.status);brut=r.texte}
  let j;try{j=JSON.parse(brut)}catch(e){throw new Error('Réponse illisible de mon PC.')}
  if(j.error)throw new Error(j.error.message||'Erreur de mon PC');
  const t=((j.result&&j.result.content)||[]).map(c=>c.text||'').join('\n').trim();if(!t)throw new Error('Mon PC n\'a rien répondu.');return t;
}

let _info=null; // informations affichées à l'écran (ex : attente)
async function appelChat(id,msgs){
  if(id==='pc'){const dernier=[...msgs].reverse().find(m=>m.role==='user');return appelPC(dernier?dernier.content:'')}
  const m=MOTEURS[id];
  const modele=id==='pollinations'?await choisirModelePollinations():modeleDe(id);
  const h={'content-type':'application/json'};if(id!=='libre')h.authorization='Bearer '+E.cles[id];
  if(id==='openrouter'){h['HTTP-Referer']='https://fabriceclin02-glitch.github.io/clipia/';h['X-Title']='Clipia'}
  const corps={messages:msgs,temperature:.7};if(modele)corps.model=modele;
  const url=m.base+(id==='libre'?'':'/chat/completions');
  for(let essai=0;;essai++){
    const r=await net(url,{method:'POST',headers:h,body:JSON.stringify(corps)});
    if(!r.ok&&id==='libre'&&(r.status===402||r.status===429)&&essai<1){
      for(let s=32;s>0;s--){if(_info)_info('Le moteur gratuit sans clé est saturé… nouvelle tentative dans '+s+' s (ajoute une clé Groq pour éviter l\'attente)');await attends(1000)}
      if(_info)_info('');continue}
    if(!r.ok)throw new Error(messageHttp(r,m.nom));
    let t='';try{const j=JSON.parse(r.texte);t=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||''}catch(e){t=String(r.texte||'')}
    t=String(t).replace(/<think>[\s\S]*?<\/think>/g,'').trim();
    if(!t)throw new Error(m.nom+' : réponse vide.');
    return t;
  }
}
/* Appelle le premier moteur disponible ; renvoie {texte, moteur} */
async function llm(msgs){
  let derniere=null;const ordre=moteursPrets();
  for(const id of ordre){try{const t=await appelChat(id,msgs);return{texte:t,moteur:id}}catch(e){derniere=e}}
  throw derniere||new Error('Aucun moteur disponible.');
}
function definirInfo(f){_info=f}

/* ── narration : voix du téléphone enregistrée en fichier (Android) ───────── */
let _sid=0;const _sw={};
window.__clipiaSynth=(id,ok,b64)=>{const f=_sw[id];if(!f)return;delete _sw[id];f(ok?b64Blob(b64,'audio/wav'):null)};
function synthese(texte,v={}){
  if(!NATIF||!NATIF.synthetiser)return Promise.resolve(null);
  return new Promise(res=>{const id='s'+(++_sid);const t=setTimeout(()=>{delete _sw[id];res(null)},60000);_sw[id]=b=>{clearTimeout(t);res(b)};
    try{NATIF.synthetiser(id,String(texte).slice(0,3500),v.nom||E.voixNom||'',v.vitesse||E.vitesse||1,v.hauteur||1)}catch(e){clearTimeout(t);delete _sw[id];res(null)}});
}

/* ── diagnostic : teste chaque service et montre l'erreur exacte ─────────── */
async function diagnostic(info){
  const L=[];const add=(ok,t)=>{L.push({ok,t});if(info)info(L)};
  add(true,'Application : '+(NATIF?'Android natif '+(NATIF.version?NATIF.version():''):'navigateur')+' · version '+VERSION+' · réseau '+(navigator.onLine?'en ligne':'HORS LIGNE'));
  for(const id of ['groq','gemini','pollinations','openrouter']){
    if(!aCle(id))continue;
    try{const t0=Date.now();const l=await modelesDe(id);add(true,MOTEURS[id].nom+' : clé acceptée, '+l.length+' modèles ('+(Date.now()-t0)+' ms)')}
    catch(e){add(false,e.message)}
    try{const t=await appelChat(id,[{role:'user',content:'Réponds uniquement : ok'}]);add(true,MOTEURS[id].nom+' : réponse reçue « '+t.slice(0,40)+' »')}catch(e){add(false,e.message)}
  }
  if(aCle('hf')){try{const x=await net('https://huggingface.co/api/whoami-v2',{headers:{Authorization:'Bearer '+E.cles.hf},delai:20000});add(x.ok,x.ok?'Hugging Face : jeton accepté':messageHttp(x,'Hugging Face'))}catch(e){add(false,e.message)}}
  if(E.pc.url){try{const t=await appelPC('Réponds : ok');add(true,'Mon PC : '+t.slice(0,60))}catch(e){add(false,e.message)}}
  try{const x=await net('https://image.pollinations.ai/prompt/test?width=64&height=64&nologo=true',{binaire:true,delai:60000});add(x.ok,x.ok?'Images gratuites sans clé : disponibles':messageHttp(x,'Images gratuites sans clé'))}catch(e){add(false,'Images gratuites sans clé : '+e.message)}
  try{const x=await net('https://text.pollinations.ai/models',{delai:20000});add(x.ok,x.ok?'Texte gratuit sans clé : joignable':messageHttp(x,'Texte gratuit sans clé'))}catch(e){add(false,'Texte gratuit sans clé : '+e.message)}
  if(!['groq','gemini','pollinations','openrouter','hf'].some(aCle))add(false,'Aucune clé enregistrée : seul le mode limité « Libre » est possible.');
  return L;
}
