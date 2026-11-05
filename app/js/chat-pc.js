'use strict';
/* Clipia — « Mon PC » : la discussion façon WhatsApp avec l'IA de ton ordinateur, reliée par QR code.
   Le téléphone parle directement au PC (réseau local ou tunnel) ; rien ne passe par un serveur tiers. */
const MonPC=(()=>{
  const CLE='pc.liaison';
  const lire=()=>M.lire(CLE,null),ecrire=l=>M.ecrire(CLE,l),oublier=()=>M.vider(CLE);
  const url=(l,a,p)=>(/^https?:/.test(a)?a:'http://'+a)+p;
  /* première adresse du PC qui répond (réseau local d'abord, tunnel ensuite) */
  async function joignable(adresses,jeton){
    for(const a of adresses){
      try{const r=await net(url(null,a,'/api/chat/etat'),{headers:{Authorization:'Bearer '+(jeton||'x')},delai:4500});
        if(r.ok||r.status===401||r.status===403)return{a,etat:r.ok?JSON.parse(r.texte):null,refuse:!r.ok}}catch(e){}
    }return null;
  }
  function lireLien(frag){
    const q=new URLSearchParams(String(frag||'').replace(/^[#?]/,''));
    return{adresses:(q.get('h')||'').split(',').map(x=>x.trim()).filter(Boolean),code:q.get('c')||'',nom:q.get('n')||'Mon ordinateur'};
  }
  async function appairer({adresses,code,nom}){
    if(!adresses.length||!code)throw new Error('Lien d\'appairage incomplet : affiche un nouveau QR code sur l\'ordinateur.');
    const j=await joignable(adresses,'x');
    if(!j)throw new Error('Impossible de joindre ton ordinateur. Vérifie que Clipia est ouvert sur le PC et que le téléphone est sur le même Wi-Fi.');
    const r=await net(url(null,j.a,'/api/appairage/valider'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,appareil:'Android · Clipia'}),delai:15000});
    let d={};try{d=JSON.parse(r.texte)}catch(e){}
    if(!r.ok)throw new Error(d.erreur||('Appairage refusé ('+r.status+')'));
    const l={adresses:[j.a,...adresses.filter(x=>x!==j.a)],jeton:d.jeton,nom:(d.serveur&&d.serveur.nom)||nom};
    ecrire(l);return l;
  }
  return{lire,ecrire,oublier,lireLien,appairer,joignable,url};
})();

/* Reçoit le lien clipia://pair?… (QR code scanné avec l'appareil photo) */
window.__clipiaPair=async frag=>{
  try{const l=MonPC.lireLien(frag);toast('Connexion à ton ordinateur…');await MonPC.appairer(l);toast('✓ Connecté à '+MonPC.lire().nom)}catch(e){toast(esc(e.message))}
  changerVue('monpc');
};

VUES.monpc=async function(){
  const p=$('#pMonPC');p.innerHTML='';
  if(NATIF&&NATIF.pairEnAttente){const f=NATIF.pairEnAttente();if(f){try{await MonPC.appairer(MonPC.lireLien(f))}catch(e){toast(esc(e.message))}}}
  let l=MonPC.lire();
  if(!l||!l.jeton)return connexion(p);
  const hote=await MonPC.joignable(l.adresses,l.jeton);
  let base=hote?hote.a:l.adresses[0];
  const jeton=l.jeton;
  const req=async(m,chem,corps,ms)=>{
    const r=await net(MonPC.url(null,base,chem),{method:m,headers:{Authorization:'Bearer '+jeton,'Content-Type':'application/json'},body:corps?JSON.stringify(corps):null,delai:ms||30000});
    let d={};try{d=JSON.parse(r.texte)}catch(e){}
    if(!r.ok){const e=new Error(d.erreur||('Erreur '+r.status));e.status=r.status;throw e}return d;
  };
  const media=u=>(/^https?:/.test(u)?u:'http://'+base+u)+(u.includes('?')?'&':'?')+'k='+encodeURIComponent(jeton);
  const blobDe=async u=>{const r=await net(media(u),{binaire:true,delai:300000});if(!r.ok||!r.blob)throw new Error('fichier indisponible');return r.blob};
  p.style.height='100%';
  ClipiaChatPC.monter(p,{
    req,media,nom:l.nom,
    surRevoque:()=>{MonPC.oublier();toast('Ton ordinateur a déconnecté ce téléphone.');VUES.monpc()},
    telecharger:async(u,nom,type)=>{const b=await blobDe(u);const r=await enregistrer({blob:b,titre:nom,type:type==='video'?'video':'image',meta:{fichier:nom}});if(!r.ok)throw new Error(r.erreur||'échec')},
    partager:async(u,nom,type)=>{const b=await blobDe(u);const r=await enregistrer({blob:b,titre:nom,type:'image',meta:{fichier:nom}});if(r.ok&&r.id&&NATIF&&NATIF.partagerFichier)NATIF.partagerFichier(r.id);else if(r.ok)toast('Enregistré : '+r.chemin);else throw new Error(r.erreur||'échec')},
    dicter:NATIF&&NATIF.ecouter?fin=>{const f=window.__clipiaVoix;if(!f)return fin('');const o=f.final,oe=f.erreur;f.final=t=>{f.final=o;f.erreur=oe;fin(t||'')};f.erreur=()=>{f.final=o;f.erreur=oe;fin('')};try{NATIF.stopParole();NATIF.ecouter()}catch(e){fin('')}}:null,
    menu:[{t:'🔌 Changer d\'ordinateur',f:()=>{MonPC.oublier();VUES.monpc()}}]
  });
};

function connexion(p){
  p.innerHTML=`<div style="padding:22px 18px;max-width:460px;margin:auto"><h2 style="margin:0 0 6px">💬 Mon PC</h2>
    <p class="doux">Discute avec l'IA de ton ordinateur, comme sur WhatsApp : elle réfléchit, choisit le meilleur moteur et t'affiche les images et vidéos ici.</p>
    <ol class="doux" style="line-height:1.55;padding-left:20px"><li>Sur ton ordinateur, ouvre Clipia → <b>Téléphone</b> → <b>« Connecter mon téléphone »</b>.</li><li>Scanne le QR code avec l'<b>appareil photo</b> du téléphone, puis touche « Ouvrir dans Clipia ».</li><li>C'est tout : la discussion s'ouvre.</li></ol>
    <div class="carte" style="margin-top:14px"><b>Ou connexion manuelle</b>
      <input id="mpA" placeholder="Adresse du PC (ex. 192.168.1.20:8787)" style="margin-top:8px"><input id="mpC" placeholder="Code d'appairage" style="margin-top:8px">
      <button class="btn or" id="mpGo" style="margin-top:10px;width:100%">Connecter</button><p class="doux" id="mpMsg" style="margin:8px 0 0"></p></div></div>`;
  $('#mpGo',p).onclick=async()=>{const a=$('#mpA',p).value.trim(),c=$('#mpC',p).value.trim(),m=$('#mpMsg',p);m.textContent='Connexion…';
    try{await MonPC.appairer({adresses:[a.replace(/^https?:\/\//,'')],code:c,nom:'Mon ordinateur'});VUES.monpc()}catch(e){m.textContent='⚠ '+e.message}};
}
