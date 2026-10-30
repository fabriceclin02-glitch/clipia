'use strict';
/* Clipia X8 mobile — interface : sphère 3D, voix, onglets, assistant de démarrage */

/* ═══ SPHÈRE 3D ═════════════════════════════════════════════════════════════ */
const cv=$('#scene'),cx=cv.getContext('2d');let W=0,H=0,DPR=1;
const NP=900,PTS=[];{const g=Math.PI*(3-Math.sqrt(5));for(let i=0;i<NP;i++){const y=1-2*(i+.5)/NP,r=Math.sqrt(1-y*y),t=g*i;PTS.push([Math.cos(t)*r,y,Math.sin(t)*r,Math.random()])}}
let _lw=0;function dim(){if(innerWidth===_lw&&W)return;_lw=innerWidth;DPR=Math.min(devicePixelRatio||1,2.5);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;cx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',dim);dim();
const S3={rot:0,tx:.25,ty:0,vx:0,vy:0,amp:0,vit:1};
const COUL={calme:[150,130,255],ecoute:[255,140,120],travail:[80,210,255],parle:[190,120,255]};let coul=[150,130,255];
const modeSphere=()=>E.ecoute?'ecoute':(E.occupe||E.creation)?'travail':E.parle?'parle':'calme';
function dessiner(t){
  const m=modeSphere(),c=COUL[m];for(let i=0;i<3;i++)coul[i]+=(c[i]-coul[i])*.06;
  const vit=m==='travail'?2.8:m==='ecoute'?1.5:m==='parle'?1.2:.55;S3.vit+=(vit-S3.vit)*.05;
  let amp=m==='ecoute'?.05+E.niveau*.12:m==='parle'?.06+.05*Math.abs(Math.sin(t/140))*Math.abs(Math.sin(t/330+1)):m==='travail'?.04*Math.sin(t/180):.015*Math.sin(t/1200);
  S3.amp+=(amp-S3.amp)*.18;S3.rot+=.004*S3.vit;S3.tx+=S3.vy;S3.ty+=S3.vx;S3.vx*=.94;S3.vy*=.94;S3.tx+=(.25-S3.tx)*.01;
  const base=Math.min(W,H*.6)*.29*(1+S3.amp),X=W/2,Y=H*.34;cx.clearRect(0,0,W,H);
  const [r,g,b]=coul.map(Math.round);const gr=cx.createRadialGradient(X,Y,base*.2,X,Y,base*2.3);gr.addColorStop(0,`rgba(${r},${g},${b},.30)`);gr.addColorStop(.5,`rgba(${r},${g},${b},.08)`);gr.addColorStop(1,'rgba(8,10,28,0)');cx.fillStyle=gr;cx.fillRect(0,0,W,H);
  const ca=Math.cos(S3.rot+S3.ty),sa=Math.sin(S3.rot+S3.ty),cb=Math.cos(S3.tx),sb=Math.sin(S3.tx),out=[];
  for(let i=0;i<NP;i++){const p=PTS[i],w=1+S3.amp*1.4*Math.sin(t/260+p[0]*5+p[1]*4+(m==='parle'?p[2]*6:0)),x0=p[0]*w,y0=p[1]*w,z0=p[2]*w,x=x0*ca+z0*sa,z=-x0*sa+z0*ca;out.push([x,y0*cb-z*sb,y0*sb+z*cb,p[3]])}
  out.sort((a,b)=>a[2]-b[2]);
  for(const p of out){const f=1/(1.9-p[2]*.62),l=(p[2]+1)/2,s=(1.2+p[3]*1.8)*f*(base/110)*(.6+l*.8);cx.fillStyle=`rgba(${Math.min(255,r+Math.round(l*60))},${Math.min(255,g+Math.round(l*50))},${Math.min(255,b+20)},${.18+l*.8})`;cx.beginPath();cx.arc(X+p[0]*base*f*1.08,Y+p[1]*base*f*1.08,Math.max(.5,s),0,6.283);cx.fill()}
  [[.34,.5,1],[.22,-.9,-1],[.42,1.7,1]].forEach((q,k)=>{cx.save();cx.translate(X,Y);cx.rotate(S3.rot*q[2]*.8+q[1]);cx.scale(1,q[0]);cx.strokeStyle=`rgba(${r},${g},${b},${.28-k*.05})`;cx.lineWidth=1.3;cx.setLineDash([2,7]);cx.beginPath();cx.arc(0,0,base*(1.32+k*.08),0,6.283);cx.stroke();cx.restore()});
  if(m==='ecoute'||m==='parle'||m==='travail'){cx.strokeStyle=`rgba(${r},${g},${b},.35)`;cx.lineWidth=2;for(let k=0;k<3;k++){const ph=((t/900)+k/3)%1;cx.globalAlpha=1-ph;cx.beginPath();cx.arc(X,Y,base*(1.1+ph*.9),0,6.283);cx.stroke()}cx.globalAlpha=1}
  cx.setLineDash([]);requestAnimationFrame(dessiner);
}
requestAnimationFrame(dessiner);
let _dp=null;
cv.addEventListener('pointerdown',e=>{_dp={x:e.clientX,y:e.clientY,t:Date.now(),m:false}});
cv.addEventListener('pointermove',e=>{if(!_dp)return;const dx=e.clientX-_dp.x,dy=e.clientY-_dp.y;if(Math.abs(dx)+Math.abs(dy)>8)_dp.m=true;S3.vx+=dx*.00018;S3.vy+=dy*.00018;_dp.x=e.clientX;_dp.y=e.clientY});
cv.addEventListener('pointerup',()=>{if(_dp&&!_dp.m&&Date.now()-_dp.t<500&&$('#v-parler').classList.contains('on'))basculeConv();_dp=null});

/* ═══ PETITS OUTILS D'INTERFACE ═════════════════════════════════════════════ */
const majEtat=(t,type)=>{$('#etatTexte').textContent=t;$('#point').className='point'+(type?' '+type:'')};
let _toast;function toast(h,ms=4500){const t=$('#toast');t.innerHTML=h;t.classList.add('on');clearTimeout(_toast);_toast=setTimeout(()=>t.classList.remove('on'),ms)}
const ouvrirLien=u=>{if(NATIF&&NATIF.ouvrirLien)NATIF.ouvrirLien(u);else window.open(u,'_blank','noopener')};
function ouvrir(s){$('#voile').classList.add('on');$(s).classList.add('on')}
function fermerTout(){$('#voile').classList.remove('on');$$('.feuille').forEach(f=>f.classList.remove('on'))}
$('#voile').addEventListener('click',fermerTout);
function libre(html,binder){$('#libreContenu').innerHTML=html;if(binder)binder($('#libreContenu'));ouvrir('#feuilleLibre')}
const ICO={image:'🖼',musique:'🎵',video:'🎬',code:'💻'};

/* ═══ CARTES DE CRÉATION ════════════════════════════════════════════════════ */
async function carte(id){
  const c=typeof id==='string'?await BD.lire(id):id;if(!c)return document.createElement('span');
  const d=document.createElement('div');d.className='cc';const u=urlDe(c.blob);let tete='';
  if(c.type==='image')tete=`<img src="${u}" alt="${esc(c.titre)}">`;
  else if(c.type==='musique')tete=`<audio controls src="${u}"></audio>`;
  else if(c.type==='video')tete=`<video controls playsinline src="${u}"></video>`;
  else tete=`<div style="padding:14px;font-size:30px;text-align:center">💻</div>`;
  d.innerHTML=tete+`<div class="pied"><b>${esc(c.titre)}</b>${c.type==='code'?'<button data-a="ouvrir">▶ Ouvrir</button>':c.type==='image'?'<button data-a="ouvrir">⛶</button>':''}<button data-a="sauver">⬇ Enregistrer</button><button data-a="partager">↗</button></div>`;
  d.addEventListener('click',async e=>{const a=e.target.dataset&&e.target.dataset.a;if(!a)return;
    if(a==='ouvrir')visualiser(c);
    if(a==='sauver')sauverCreation(c);
    if(a==='partager'){const r=await enregistrerSiBesoin(c);partager(c,r&&r.id)}});
  return d;
}
const _enreg={};
async function enregistrerSiBesoin(c){if(_enreg[c.id])return _enreg[c.id];const r=await enregistrer(c);if(r.ok)_enreg[c.id]=r;return r}
async function sauverCreation(c){
  const r=await enregistrerSiBesoin(c);
  if(!r.ok){toast('<span class="ko">'+esc(r.erreur)+'</span>');return}
  toast('✓ Enregistré : <b>'+esc(r.chemin)+'</b>'+(r.natif?' <button class="btn mini" id="tOuvrir" style="display:inline-flex;margin-left:8px">Ouvrir</button>':''),7000);
  const o=$('#tOuvrir');if(o)o.onclick=()=>NATIF.ouvrirFichier(r.id);
}
let _visu=null;
async function visualiser(c){
  _visu=c;$('#visuTitre').textContent=c.titre;const corps=$('#visuCorps');corps.innerHTML='';
  if(c.type==='code'){
    const t=await c.blob.text();
    if(/html?$/.test((c.meta&&c.meta.ext)||'')||/^\s*<(!doctype|html)/i.test(t)){const f=document.createElement('iframe');f.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-pointer-lock');f.srcdoc=t;corps.appendChild(f)}
    else{const p=document.createElement('pre');p.textContent=t;corps.appendChild(p)}
  }else if(c.type==='image'){corps.innerHTML=`<img src="${urlDe(c.blob)}" style="flex:1;min-height:0;object-fit:contain;background:#000">`}
  else if(c.type==='video'){corps.innerHTML=`<video controls autoplay playsinline src="${urlDe(c.blob)}" style="flex:1;min-height:0;background:#000"></video>`}
  else corps.innerHTML=`<div style="padding:24px"><audio controls autoplay src="${urlDe(c.blob)}" style="width:100%"></audio></div>`;
  $('#visu').classList.add('on');
}
$('#visuFermer').onclick=()=>{$('#visu').classList.remove('on');$('#visuCorps').innerHTML=''};
$('#visuSauver').onclick=()=>_visu&&sauverCreation(_visu);

/* ═══ CONVERSATION ══════════════════════════════════════════════════════════ */
const zone=$('#zone'),sous=$('#sous');
const IDEES=['Crée une image d\'un dragon en néon','Compose une musique lofi','Code-moi un jeu de serpent','Fais un clip sur l\'espace','Crée une équipe d\'agents pour mon projet'];
$('#idees').innerHTML=IDEES.map(t=>`<span class="idee">${esc(t)}</span>`).join('');
$('#idees').addEventListener('click',e=>{if(e.target.classList.contains('idee'))demander(e.target.textContent)});
async function afficher({moi='',elle='',sys='',etape='',creations=[]}={}){
  sous.innerHTML='';
  const add=(cl,t)=>{const d=document.createElement('div');d.className=cl;d.textContent=t;sous.appendChild(d)};
  if(moi)add('moi',moi);if(elle)add('elle',elle);
  for(const id of creations){sous.appendChild(await carte(id))}
  if(etape)add('etape','⏳ '+etape);if(sys)add('sys',sys);
  sous.scrollTop=sous.scrollHeight;$('#idees').style.display=(E.messages.length||moi||elle||sys||etape)?'none':'flex';
}
const majMoteur=()=>{const p=moteursPrets()[0];const m=MOTEURS[p];$('#moteurAff').textContent=(E.agentActif?'🧩 '+((E.agents.find(a=>a.id===E.agentActif)||{}).nom||'')+' · ':'')+m.court+(p==='libre'?' (limité)':'')};
const nettoyerParole=t=>t.replace(/```[\s\S]*?```/g,' ').replace(/https?:\/\/\S+/g,' ').replace(/[*_#`>]/g,'').replace(/\s+/g,' ').trim();

async function demander(texte){
  texte=(texte||'').trim();if(!texte||E.occupe)return;
  stopParole();arreterEcoute();E.occupe=true;zone.value='';ajuste();
  afficher({moi:texte,etape:'Clipia réfléchit…'});majEtat('Clipia réfléchit…','att');
  definirInfo(m=>afficher({moi:texte,etape:m||'Clipia réfléchit…'}));
  try{
    const r=await traiter(texte,m=>{E.creation=true;afficher({moi:texte,etape:m});majEtat(m.slice(0,40),'att')});
    E.creation=false;
    const rep=r.texte||(r.creations.length?'C\'est fait.':'Je n\'ai rien à répondre.');
    E.messages.push({role:'user',contenu:texte},{role:'assistant',contenu:rep,cr:r.creations});sauver();
    await afficher({moi:texte,elle:rep,creations:r.creations,sys:r.moteur==='libre'&&moteursPrets()[0]!=='libre'?'':''});
    majEtat('Prête');E.occupe=false;majMoteur();
    if(r.creations.length&&M.lire('autoSave',!!NATIF)){for(const id of r.creations){const c=await BD.lire(id);if(c)await enregistrerSiBesoin(c)}toast('✓ Enregistré dans <b>Téléchargements/Clipia</b>')}
    if(E.voixActive&&rep)parler(rep);else if(E.conversation)relancerEcoute();
  }catch(e){
    E.occupe=false;E.creation=false;afficher({moi:texte,sys:e.message||'Erreur inconnue.'});majEtat('Erreur','off');
    if(moteursPrets()[0]==='libre'&&!M.lire('conseilCle',false)){M.ecrire('conseilCle',true);setTimeout(()=>changerVue('reglages'),900)}
  }finally{definirInfo(null);E.occupe=false;E.creation=false}
}

/* ═══ VOIX ══════════════════════════════════════════════════════════════════ */
const synth=window.speechSynthesis;let voixDispo=[];
function remplirVoix(l,auto){const sel=$('#voix');if(!sel)return;sel.innerHTML=l.map(v=>`<option value="${esc(v.nom)}">${esc(v.nom)} (${esc(v.langue)})</option>`).join('');if(E.voixNom&&l.some(v=>v.nom===E.voixNom))sel.value=E.voixNom;else if(l[0]){E.voixNom=l[0].nom;sel.value=E.voixNom}const a=$('#aideVoix');if(a)a.textContent=l.length?l.length+' voix française(s) disponible(s).':'Aucune voix française : Réglages Android → Langues → Synthèse vocale.'}
let chargerVoix=()=>{if(!synth)return;let l=synth.getVoices().filter(v=>/^fr/i.test(v.lang));if(!l.length)l=synth.getVoices();voixDispo=l;remplirVoix(l.map(v=>({nom:v.name,langue:v.lang})))};
if(synth){synth.onvoiceschanged=()=>chargerVoix()}
const finParole=()=>{E.parle=false;majEtat('Prête');if(E.conversation)relancerEcoute()};
let parler=t=>{if(!synth){finParole();return}synth.cancel();arreterEcoute();const u=new SpeechSynthesisUtterance(nettoyerParole(t));const v=voixDispo.find(x=>x.name===E.voixNom);if(v){u.voice=v;u.lang=v.lang}else u.lang='fr-FR';u.rate=E.vitesse;u.onstart=()=>{E.parle=true;majEtat('Clipia parle…','att')};u.onend=finParole;u.onerror=finParole;synth.speak(u)};
let stopParole=()=>{if(synth)synth.cancel();E.parle=false};
const Reco=window.SpeechRecognition||window.webkitSpeechRecognition;let reco=null,recoOn=false,arretVoulu=false;
function creerReco(){if(!Reco)return null;const r=new Reco();r.lang='fr-FR';r.continuous=false;r.interimResults=true;
  r.onstart=()=>{recoOn=true;E.ecoute=true;majMode();majEtat('Je t\'écoute…','att')};
  r.onresult=ev=>{let f='',i2='';for(let i=0;i<ev.results.length;i++){const t=ev.results[i][0].transcript;if(ev.results[i].isFinal)f+=t;else i2+=t}zone.value=(f||i2).trim();afficher({moi:zone.value});E.niveau=.5};
  r.onerror=ev=>{recoOn=false;E.ecoute=false;majMode();if(ev.error==='not-allowed'||ev.error==='service-not-allowed'){E.conversation=false;majMode();afficher({sys:'Le micro est bloqué : autorise-le puis réessaie.'});majEtat('Micro refusé','off')}else if(ev.error==='no-speech'){majEtat('Prête');if(E.conversation)relancerEcoute()}else majEtat('Prête')};
  r.onend=()=>{recoOn=false;E.ecoute=false;majMode();const t=zone.value.trim();if(!arretVoulu&&t)demander(t);else if(!arretVoulu&&E.conversation)relancerEcoute();else majEtat('Prête');arretVoulu=false};return r}
let demarrerEcoute=()=>{if(!Reco){afficher({sys:'La dictée n\'est pas disponible ici : utilise Chrome ou l\'application Android.'});return}if(recoOn)return;stopParole();if(!reco)reco=creerReco();zone.value='';try{reco.start()}catch(e){}};
let arreterEcoute=()=>{if(reco&&recoOn){arretVoulu=true;try{reco.stop()}catch(e){}}};
const relancerEcoute=()=>{if(!E.conversation||E.occupe)return;setTimeout(()=>{if(E.conversation&&!E.occupe&&!E.ecoute&&!E.parle)demarrerEcoute()},350)};
function majMode(){$('#bMicro').classList.toggle('on',E.conversation||E.ecoute);$('#modeTexte').textContent=E.conversation?'Conversation vocale active — touche pour arrêter':'Touche la sphère ou le micro : conversation vocale continue'}
function basculeConv(){if(E.parle){stopParole();E.conversation=true;majMode();relancerEcoute();return}E.conversation=!E.conversation;majMode();if(E.conversation)demarrerEcoute();else{arreterEcoute();stopParole();majEtat('Prête')}}
$('#bMicro').onclick=basculeConv;
$('#bClavier').onclick=()=>{$('#saisie').classList.toggle('on');if($('#saisie').classList.contains('on'))zone.focus()};
$('#bEnvoi').onclick=()=>demander(zone.value);
zone.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();demander(zone.value)}});
function ajuste(){zone.style.height='auto';zone.style.height=Math.min(zone.scrollHeight,120)+'px'}zone.addEventListener('input',ajuste);
const majMuet=()=>{$('#bMuet').textContent=E.voixActive?'🔊':'🔇'};
$('#bMuet').onclick=()=>{E.voixActive=!E.voixActive;sauver();majMuet();if(!E.voixActive)stopParole()};
$('#moteurAff').onclick=()=>changerVue('reglages');
$('#bHist').onclick=async()=>{const h=$('#hist');h.innerHTML='';if(!E.messages.length)h.innerHTML='<p class="aide">Rien pour l\'instant.</p>';for(const m of E.messages){const d=document.createElement('div');d.className='m '+(m.role==='user'?'moi':'elle');d.textContent=m.contenu;h.appendChild(d);for(const id of(m.cr||[]))h.appendChild(await carte(id))}ouvrir('#feuilleHist')};

/* application Android : voix du téléphone */
if(NATIF){
  window.__clipiaVoix={
    debut(){E.ecoute=true;majMode();majEtat('Je t\'écoute…','att')},
    niveau(v){E.niveau=Math.max(0,Math.min(1,(v+2)/12))},
    partiel(t){zone.value=t;afficher({moi:t})},
    final(t){E.ecoute=false;E.niveau=0;majMode();const x=(t||'').trim();zone.value=x;if(x)demander(x);else if(E.conversation)relancerEcoute();else majEtat('Prête')},
    erreur(code){E.ecoute=false;E.niveau=0;majMode();
      if(code==='not-allowed'){E.conversation=false;majMode();afficher({sys:'Le micro est refusé : autorise le microphone pour Clipia dans les réglages Android de l\'application.'});majEtat('Micro refusé','off')}
      else if(code==='indisponible'){E.conversation=false;majMode();afficher({sys:'La reconnaissance vocale n\'est pas installée : installe « Services vocaux Google » depuis le Play Store.'});majEtat('Prête')}
      else if(code==='reseau'){afficher({sys:'La dictée a besoin d\'Internet.'});majEtat('Prête')}
      else{majEtat('Prête');if(E.conversation)relancerEcoute()}},
    paroleDebut(){E.parle=true;majEtat('Clipia parle…','att')},paroleFin(){finParole()}
  };
  demarrerEcoute=()=>{if(E.ecoute)return;zone.value='';try{NATIF.stopParole();NATIF.ecouter()}catch(e){}};
  arreterEcoute=()=>{try{NATIF.stopEcoute()}catch(e){}E.ecoute=false;E.niveau=0;majMode()};
  parler=t=>{if(!E.voixActive){finParole();return}try{NATIF.reglerVitesse(E.vitesse);NATIF.choisirVoix(E.voixNom||'');NATIF.parler(nettoyerParole(t))}catch(e){finParole()}};
  stopParole=()=>{try{NATIF.stopParole()}catch(e){}E.parle=false};
  chargerVoix=()=>{let l=[];try{l=JSON.parse(NATIF.listeVoix()||'[]')}catch(e){}remplirVoix(l)};
  if(synth){synth.onvoiceschanged=null;try{synth.cancel()}catch(e){}}
  addEventListener('clipia-voix-prete',()=>chargerVoix());
}
chargerVoix();

/* ═══ ONGLETS ═══════════════════════════════════════════════════════════════ */
function changerVue(v){
  $$('.vue').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));$$('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));fermerTout();
  if(v==='creer')majCreer();if(v==='agents')majAgents();if(v==='reglages')majReglages();
}
$$('nav.tabs button').forEach(b=>b.onclick=()=>changerVue(b.dataset.v));

/* ── Créer ── */
const POUVOIRS=[
  {i:'🖼',t:'Image',d:'Affiche, personnage, décor…',ph:'Un dragon en néon au-dessus d\'une ville la nuit',pre:'Crée une image : '},
  {i:'🎵',t:'Musique',d:'Compose un morceau original',ph:'Une musique lofi pour réviser, calme et douce',pre:'Compose une musique : '},
  {i:'🎬',t:'Clip vidéo',d:'Images + texte + musique',ph:'Un clip de 5 scènes sur la conquête de l\'espace',pre:'Fais un clip vidéo : '},
  {i:'💻',t:'Code',d:'Appli, jeu, site, script',ph:'Un jeu de serpent avec score, adapté au téléphone',pre:'Écris le code de : '},
  {i:'🧩',t:'Agents',d:'Crée une équipe',ph:'Une équipe pour lancer ma boutique en ligne',pre:'Crée une équipe d\'agents et de sous-agents pour : '},
  {i:'🖥',t:'Mon PC',d:'Agir sur ton ordinateur',ph:'Range mon dossier Téléchargements',pre:'Sur mon PC : ',pc:true}
];
$('#pouvoirs').innerHTML=POUVOIRS.map((p,i)=>`<div class="pv" data-i="${i}"><i>${p.i}</i><b>${p.t}</b><span>${p.d}</span></div>`).join('');
$('#pouvoirs').onclick=e=>{const el=e.target.closest('.pv');if(!el)return;const p=POUVOIRS[+el.dataset.i];
  libre(`<h2>${p.i} ${p.t}</h2><p class="doux">Décris ce que tu veux.</p><textarea id="lt" rows="4" placeholder="${esc(p.ph)}" style="min-height:100px;max-height:200px"></textarea><div style="height:12px"></div><button class="btn p" id="lgo">Lancer</button>${p.pc&&!E.pc.url?'<p class="aide">Relie d\'abord ton PC dans Réglages → Mon PC.</p>':''}`,r=>{$('#lgo',r).onclick=()=>{const t=$('#lt',r).value.trim();if(!t)return;fermerTout();changerVue('parler');demander(p.pre+t)}})};
async function majCreer(){const l=await BD.tous(),g=$('#galerie');g.innerHTML='';$('#galVide').style.display=l.length?'none':'block';
  for(const c of l.slice(0,60)){const d=document.createElement('div');d.className='cr';const ap=c.type==='image'?`<img src="${urlDe(c.blob)}" alt="">`:c.type==='video'?`<video src="${urlDe(c.blob)}#t=0.5" muted preload="metadata"></video>`:ICO[c.type]||'📄';d.innerHTML=`<div class="ap">${ap}</div><div class="tt">${esc(c.titre)}</div>`;d.onclick=()=>visualiser(c);
    d.oncontextmenu=e=>e.preventDefault();let lp;d.ontouchstart=()=>{lp=setTimeout(()=>{if(confirm('Supprimer « '+c.titre+' » ?'))BD.suppr(c.id).then(majCreer)},700)};d.ontouchend=d.ontouchmove=()=>clearTimeout(lp);g.appendChild(d)}}

/* ── Agents ── */
function majAgents(){
  const p=$('#pAgents');
  p.innerHTML=`<h1>Agents</h1><p class="doux">Des spécialistes que Clipia dirige. Un agent peut confier des tâches à ses sous-agents.</p>
  <div class="ag ${E.agentActif?'':'actif'}"><b>Clipia (générale)</b><div class="tags"><i>tous les outils</i></div><p class="aide" style="margin:0 0 8px">Elle choisit seule les agents à mobiliser.</p><button class="btn mini" data-a="actif" data-id="">${E.agentActif?'Parler à Clipia':'✓ Active'}</button></div>`+
  E.agents.map(a=>`<div class="ag ${E.agentActif===a.id?'actif':''}"><b>${esc(a.nom)}</b><p class="aide" style="margin:2px 0 0">${esc(a.role)}</p><div class="tags">${a.outils.map(o=>`<i>${esc(LIBELLE_OUTIL[o]||o)}</i>`).join('')}${a.sousAgents.length?`<i>↳ ${esc(a.sousAgents.join(', '))}</i>`:''}</div><div class="rang"><button class="btn mini" data-a="actif" data-id="${a.id}">${E.agentActif===a.id?'✓ Actif':'Parler à lui'}</button><button class="btn mini" data-a="edit" data-id="${a.id}">Modifier</button></div></div>`).join('')+
  `<button class="btn p" data-a="nouveau" style="margin-top:6px">+ Nouvel agent</button><button class="btn" data-a="equipe">✨ Demander à Clipia de créer une équipe</button>`;
  p.onclick=e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;
    if(a==='actif'){E.agentActif=b.dataset.id;sauver();majMoteur();majAgents();if(b.dataset.id)toast('Agent actif : <b>'+esc(E.agents.find(x=>x.id===b.dataset.id).nom)+'</b>. Retourne dans Parler.')}
    if(a==='edit')formAgent(E.agents.find(x=>x.id===b.dataset.id));
    if(a==='nouveau')formAgent(null);
    if(a==='equipe')libre(`<h2>✨ Créer une équipe</h2><p class="doux">Décris ton projet : Clipia crée les agents et sous-agents adaptés.</p><textarea id="lt" rows="4" placeholder="Lancer ma boutique de t-shirts en ligne" style="min-height:100px"></textarea><div style="height:12px"></div><button class="btn p" id="lgo">Créer l'équipe</button>`,r=>{$('#lgo',r).onclick=()=>{const t=$('#lt',r).value.trim();if(!t)return;fermerTout();changerVue('parler');demander('Crée une équipe d\'agents et de sous-agents pour : '+t)}})}
}
window.UI={majAgents};
function formAgent(a){
  const n=a||{id:'',nom:'',role:'',instructions:'',outils:['code'],sousAgents:[]};
  libre(`<h2>${a?'Modifier':'Nouvel'} agent</h2>
  <div class="champ"><label>Nom</label><input type="text" id="an" value="${esc(n.nom)}" placeholder="Ex : Community manager"></div>
  <div class="champ"><label>Rôle (une phrase)</label><input type="text" id="ar" value="${esc(n.role)}"></div>
  <div class="champ"><label>Instructions</label><textarea id="ai" rows="5" style="min-height:110px;max-height:240px">${esc(n.instructions)}</textarea></div>
  <label>Pouvoirs de cet agent</label><div class="rang champ" id="ao">${TOUS_OUTILS.filter(o=>o!=='pc').map(o=>`<span class="choix ${n.outils.includes(o)?'on':''}" data-o="${o}">${esc(LIBELLE_OUTIL[o])}</span>`).join('')}</div>
  <label>Sous-agents qu'il peut mobiliser</label><div class="rang champ" id="as">${E.agents.filter(x=>x.id!==n.id).map(x=>`<span class="choix ${n.sousAgents.some(s=>norm(s)===norm(x.nom))?'on':''}" data-s="${esc(x.nom)}">${esc(x.nom)}</span>`).join('')||'<span class="aide">Aucun autre agent.</span>'}</div>
  <button class="btn p" id="asv">Enregistrer</button>${a?'<button class="btn danger" id="asu">Supprimer</button>':''}`,r=>{
    $$('.choix',r).forEach(c=>c.onclick=()=>c.classList.toggle('on'));
    $('#asv',r).onclick=()=>{const nom=$('#an',r).value.trim();if(!nom)return;const outils=$$('#ao .choix.on',r).map(c=>c.dataset.o),sa=$$('#as .choix.on',r).map(c=>c.dataset.s);if(sa.length&&!outils.includes('deleguer'))outils.push('deleguer');
      const ag={id:a?a.id:norm(nom).replace(/[^a-z0-9]+/g,'-')||('a'+Date.now()),nom,role:$('#ar',r).value.trim()||'Agent personnalisé',instructions:$('#ai',r).value.trim(),outils:outils.length?outils:['memoire'],sousAgents:sa};
      const k=E.agents.findIndex(x=>x.id===ag.id);if(k>=0)E.agents[k]=ag;else E.agents.push(ag);sauver();fermerTout();majAgents()};
    const su=$('#asu',r);if(su)su.onclick=()=>{E.agents=E.agents.filter(x=>x.id!==a.id);if(E.agentActif===a.id)E.agentActif='';sauver();fermerTout();majAgents();majMoteur()}});
}

/* ── Réglages ── */
function statutMoteur(id){if(id==='pc')return E.pc.url?'configuré':'à configurer';if(id==='libre')return 'toujours disponible';return aCle(id)?'clé enregistrée ✓':'clé gratuite à créer'}
function majReglages(){
  const p=$('#pReglages'),P=E.profil;
  p.innerHTML=`<h1>Réglages</h1>
  <h3>Comment Clipia te parle</h3>
  <p class="aide" style="margin-top:0">${esc(P.prenom?P.prenom+' · ':'')}${P.tu?'tutoiement':'vouvoiement'} · ton ${esc(P.ton)} · réponses ${P.longueur==='detaillee'?'détaillées':'courtes'}</p>
  <button class="btn" id="rAssist">🪄 Refaire l'assistant de démarrage</button>
  <h3>Cerveau (texte, code, agents)</h3>
  ${['groq','gemini','pollinations','openrouter','pc','libre'].map(id=>`<div class="carte-m ${E.moteur===id?'on':''}" data-m="${id}"><span class="r"></span><div><b>${esc(MOTEURS[id].nom)}</b><span>${esc(MOTEURS[id].desc)}<br><i style="color:${aCle(id)||id==='libre'||(id==='pc'&&E.pc.url)?'var(--ok)':'var(--doux)'}">${statutMoteur(id)}</i></span></div></div>`).join('')}
  <h3>Images</h3>
  <p class="aide" style="margin-top:0">Ordre : clé Pollinations ➜ Hugging Face ➜ service gratuit sans clé (lent, limité). ${aCle('pollinations')?'<span class="ok">Pollinations actif ✓</span>':''} ${aCle('hf')?'<span class="ok">Hugging Face actif ✓</span>':''}</p>
  <button class="btn" id="rHf">🤗 Jeton Hugging Face (images gratuites)</button>
  <h3>Voix</h3>
  <div class="carte-m ${E.voixActive?'on':''}" id="rVoixOn"><span class="r"></span><div><b>Clipia répond à voix haute</b><span>Désactive pour lire seulement.</span></div></div>
  <div class="champ"><label>Voix</label><select id="voix"></select></div>
  <div class="champ"><label>Vitesse <span id="vv">${Number(E.vitesse).toFixed(1)}</span>×</label><input type="range" id="vit" min="0.6" max="1.6" step="0.05" value="${E.vitesse}" style="width:100%;accent-color:#7c5cff"></div><div class="aide" id="aideVoix"></div>
  <h3>Mon PC</h3><button class="btn" id="rPc">🖥 Relier Clipia sur mon ordinateur</button>
  <h3>Enregistrement</h3>
  <div class="carte-m ${M.lire('autoSave',!!NATIF)?'on':''}" id="rAuto"><span class="r"></span><div><b>Enregistrer automatiquement mes créations</b><span>Dans Téléchargements/Clipia du téléphone.</span></div></div>
  <h3>Données</h3><button class="btn danger" id="rEff">🗑 Effacer la conversation</button>
  <p class="aide" style="text-align:center">Clipia X8 ${VERSION} — CLENDAX · Clin Fabrice<br>Tes clés restent sur ce téléphone et ne sont envoyées qu'au service choisi.</p>`;
  chargerVoix();
  $('#rAssist').onclick=()=>assistant(0);
  $$('.carte-m[data-m]',p).forEach(c=>c.onclick=()=>configMoteur(c.dataset.m));
  $('#rHf').onclick=configHF;$('#rPc').onclick=configPC;
  $('#rVoixOn').onclick=()=>{E.voixActive=!E.voixActive;sauver();majMuet();majReglages()};
  $('#voix').onchange=e=>{E.voixNom=e.target.value;sauver();parler('Voici ma voix.')};
  $('#vit').oninput=e=>{E.vitesse=parseFloat(e.target.value);$('#vv').textContent=E.vitesse.toFixed(1);sauver()};
  $('#rAuto').onclick=()=>{M.ecrire('autoSave',!M.lire('autoSave',!!NATIF));majReglages()};
  $('#rEff').onclick=()=>{if(!confirm('Effacer toute la conversation ?'))return;E.messages=[];sauver();afficher();toast('Conversation effacée.')};
}

/* configuration d'un moteur (réglages et assistant) */
async function testerMoteur(id,cle){
  const avant=E.cles[id],avantMod=E.modeles[id];E.cles[id]=cle;
  try{const t=await appelChat(id,[{role:'user',content:'Réponds uniquement : ok'}]);return{ok:true,texte:t}}
  catch(e){E.cles[id]=avant;if(avantMod===undefined)delete E.modeles[id];else E.modeles[id]=avantMod;return{ok:false,erreur:e.message}}
}
function formMoteur(id,r,apres){
  const m=MOTEURS[id];
  r.innerHTML=`<p class="doux">${esc(m.desc)}</p><ol class="aide" style="padding-left:18px;margin-top:0">${m.etapes.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
  <button class="btn" id="mLien">🌐 Ouvrir la page pour créer la clé</button>
  <div class="champ"><label>Colle ta clé ici</label><input type="password" id="mCle" placeholder="${esc(m.ph||'')}" value="${esc(E.cles[id]||'')}" autocomplete="off" spellcheck="false"></div>
  <button class="btn p" id="mOk">Tester et activer</button><div class="aide" id="mMsg">Ta clé reste sur ce téléphone.</div>`;
  $('#mLien',r).onclick=()=>ouvrirLien(m.lien);
  $('#mOk',r).onclick=async()=>{const v=$('#mCle',r).value.trim(),msg=$('#mMsg',r);if(v.length<12||/\s/.test(v)){msg.innerHTML='<span class="ko">Ça ne ressemble pas à une clé.</span>';return}msg.textContent='Je teste…';
    const t=await testerMoteur(id,v);if(!t.ok){msg.innerHTML='<span class="ko">'+esc(t.erreur)+'</span>';return}
    E.moteur=id;sauver();majMoteur();msg.innerHTML='<span class="ok">✓ '+esc(m.nom)+' est activé.</span>';if(apres)apres()}
}
function configMoteur(id){
  if(id==='pc')return configPC();
  if(id==='libre'){E.moteur='libre';sauver();majMoteur();majReglages();toast('Moteur « Libre » activé : lent et limité. Une clé gratuite est bien plus fiable.');return}
  libre(`<h2>${esc(MOTEURS[id].nom)}</h2><div id="fm"></div>`,r=>formMoteur(id,$('#fm',r),()=>setTimeout(()=>{fermerTout();majReglages()},900)));
}
function configHF(){
  libre(`<h2>🤗 Hugging Face</h2><p class="doux">Un jeton gratuit pour générer des images (FLUX).</p><ol class="aide" style="padding-left:18px;margin-top:0"><li>Ouvre la page et connecte-toi.</li><li>Crée un jeton de type « Read » (ou « Fine-grained » avec accès aux Inference Providers).</li><li>Colle-le ici.</li></ol><button class="btn" id="hl">🌐 Ouvrir la page</button><div class="champ"><input type="password" id="hk" placeholder="hf_…" value="${esc(E.cles.hf||'')}" autocomplete="off"></div><button class="btn p" id="hok">Tester et activer</button><div class="aide" id="hm"></div>`,r=>{
    $('#hl',r).onclick=()=>ouvrirLien('https://huggingface.co/settings/tokens');
    $('#hok',r).onclick=async()=>{const v=$('#hk',r).value.trim(),m=$('#hm',r);if(v.length<10){m.innerHTML='<span class="ko">Jeton trop court.</span>';return}m.textContent='Je teste…';
      try{const x=await net('https://huggingface.co/api/whoami-v2',{headers:{Authorization:'Bearer '+v},delai:20000});if(!x.ok)throw new Error(messageHttp(x,'Hugging Face'));E.cles.hf=v;sauver();m.innerHTML='<span class="ok">✓ Jeton valide : les images passeront par Hugging Face.</span>'}catch(e){m.innerHTML='<span class="ko">'+esc(e.message)+'</span>'}}})
}
function formPC(r,apres){
  r.innerHTML=`<p class="doux">Sur ton ordinateur, ouvre Clipia X8 → « Téléphone & MCP », active le serveur, puis recopie l'adresse et le jeton.</p>
  <div class="champ"><label>Adresse de Clipia sur ton PC</label><input type="url" id="pu" placeholder="http://192.168.1.20:8787" value="${esc(E.pc.url||'')}" autocomplete="off"></div>
  <div class="champ"><label>Jeton</label><input type="password" id="pj" value="${esc(E.pc.jeton||'')}" autocomplete="off"></div>
  <button class="btn p" id="pt">Tester la connexion</button><div class="aide" id="pm">Même Wi-Fi que le PC, ou Tailscale / Cloudflare Tunnel pour sortir de chez toi. Les actions sensibles demandent ton accord <b>sur le PC</b>.</div>`;
  $('#pt',r).onclick=async()=>{E.pc={url:$('#pu',r).value.trim(),jeton:$('#pj',r).value.trim()};sauver();$('#pm',r).textContent='Je teste…';
    try{const t=await appelPC('Réponds simplement : connexion établie.');$('#pm',r).innerHTML='<span class="ok">✓ '+esc(t.slice(0,120))+'</span>';majMoteur();if(apres)apres()}catch(e){$('#pm',r).innerHTML='<span class="ko">'+esc(e.message)+'</span>'}}
}
function configPC(){libre('<h2>🖥 Mon PC</h2><div id="fp"></div>',r=>formPC($('#fp',r),()=>{}))}

/* ═══ ASSISTANT DE DÉMARRAGE ════════════════════════════════════════════════ */
const A=$('#assist');let etapeA=0;const NB=7;
function exemple(){const P=E.profil,n=P.prenom||'ami';const l={chaleureux:P.tu?`Salut ${n} ! Ravie de t'aider, dis-moi tout.`:`Bonjour ${n} ! Ravie de vous aider, dites-moi tout.`,pro:P.tu?`Bonjour ${n}. Je suis prête, quelle est ta demande ?`:`Bonjour ${n}. Je suis prête, quelle est votre demande ?`,direct:P.tu?`${n}, je t'écoute. Vas-y.`:`${n}, je vous écoute. Allez-y.`,decontracte:P.tu?`Hey ${n} ! On fait quoi aujourd'hui ?`:`Bonjour ${n} ! On fait quoi aujourd'hui ?`};return l[P.ton]||l.chaleureux}
function assistant(n){
  etapeA=n;A.classList.add('on');const P=E.profil;let corps='',titre='',peutPasser=false;
  if(n===0){titre='Bienvenue 👋';corps=`<p class="doux">Je suis <b>Clipia X8</b>. Je code, je crée des images, des musiques et des vidéos, et je dirige des agents — tout depuis ton téléphone. Quelques réglages et on commence.</p><div class="champ"><label>Comment dois-je t'appeler ?</label><input type="text" id="aPrenom" value="${esc(P.prenom)}" placeholder="Ton prénom ou surnom" autocomplete="off"></div>`}
  if(n===1){titre='Comment dois-je te parler ?';corps=`<label>Tutoiement ou vouvoiement</label><div class="rang champ" id="aTu"><span class="choix ${P.tu?'on':''}" data-v="1">Tu</span><span class="choix ${P.tu?'':'on'}" data-v="0">Vous</span></div>
  <label>Mon ton</label><div class="rang champ" id="aTon">${[['chaleureux','Chaleureux'],['pro','Professionnel'],['direct','Direct'],['decontracte','Décontracté']].map(([k,l])=>`<span class="choix ${P.ton===k?'on':''}" data-v="${k}">${l}</span>`).join('')}</div>
  <label>Longueur de mes réponses</label><div class="rang champ" id="aLg"><span class="choix ${P.longueur==='courte'?'on':''}" data-v="courte">Courtes (1 à 3 phrases)</span><span class="choix ${P.longueur==='detaillee'?'on':''}" data-v="detaillee">Détaillées</span></div>
  <div class="carte-m on" style="cursor:default"><span class="r"></span><div><b>Aperçu</b><span id="aEx">${esc(exemple())}</span></div></div>`}
  if(n===2){titre='Ma voix';corps=`<div class="carte-m ${E.voixActive?'on':''}" id="aVoixOn"><span class="r"></span><div><b>Je te réponds à voix haute</b><span>Tu peux le changer à tout moment avec le bouton 🔊.</span></div></div>
  <div class="champ"><label>Voix</label><select id="voix"></select></div><div class="champ"><label>Vitesse <span id="vv">${Number(E.vitesse).toFixed(1)}</span>×</label><input type="range" id="vit" min="0.6" max="1.6" step="0.05" value="${E.vitesse}" style="width:100%;accent-color:#7c5cff"></div><div class="aide" id="aideVoix"></div>
  <button class="btn" id="aEcoute">🔊 Écouter la voix</button><button class="btn" id="aMicro">🎙 Autoriser et tester le micro</button><div class="aide" id="aMic"></div>`}
  if(n===3){titre='Mon cerveau';peutPasser=true;corps=`<p class="doux">C'est lui qui réfléchit, écrit le code et dirige les agents. Choisis-en un : une clé gratuite se crée en 1 minute.</p><div id="aMot">${['groq','gemini','pollinations','openrouter','pc'].map(id=>`<div class="carte-m ${E.moteur===id&&(aCle(id)||id==='pc')?'on':''}" data-m="${id}"><span class="r"></span><div><b>${esc(MOTEURS[id].nom)}${id==='groq'?' · recommandé':''}</b><span>${esc(MOTEURS[id].desc)}${aCle(id)?' — <i style="color:var(--ok)">clé enregistrée ✓</i>':''}</span></div></div>`).join('')}</div><div id="aForm"></div><p class="aide">Sans clé, Clipia utilise le moteur « Libre » : il marche, mais très lentement et sans garantie.</p>`}
  if(n===4){titre='Mes pouvoirs';peutPasser=true;const img=aCle('pollinations')||aCle('hf');corps=`<p class="doux">Voici ce que je saurai faire une fois ton cerveau relié :</p>
  <div class="carte-m on" style="cursor:default"><span class="r"></span><div><b>💻 Code</b><span>Applis, jeux, sites — avec aperçu et enregistrement.</span></div></div>
  <div class="carte-m on" style="cursor:default"><span class="r"></span><div><b>🎵 Musique</b><span>Je compose sur le téléphone, sans service externe.</span></div></div>
  <div class="carte-m on" style="cursor:default"><span class="r"></span><div><b>🧩 Agents et sous-agents</b><span>5 agents prêts à l'emploi, et je peux en créer d'autres.</span></div></div>
  <div class="carte-m ${img?'on':''}" style="cursor:default"><span class="r"></span><div><b>🖼 Images et 🎬 clips vidéo</b><span>${img?'Images fiables ✓ ('+(aCle('pollinations')?'Pollinations':'Hugging Face')+')':'Possible sans clé, mais lent et limité. Pour des images fiables, ajoute un jeton gratuit :'}</span></div></div>
  ${img?'':'<button class="btn" id="aHf">🤗 Ajouter un jeton Hugging Face (gratuit)</button>'}`}
  if(n===5){titre='Ton ordinateur (facultatif)';peutPasser=true;corps=`<p class="doux">Relie Clipia sur ton PC pour agir sur tes fichiers et tes programmes depuis ici.</p><div id="aPc"></div>`}
  if(n===6){titre='Tout est prêt ✨';corps=`<p class="doux">${esc(exemple())}</p><div class="carte-m on" style="cursor:default"><span class="r"></span><div><b>Cerveau</b><span>${esc(MOTEURS[moteursPrets()[0]].nom)}${moteursPrets()[0]==='libre'?' — limité : ajoute une clé gratuite dans Réglages quand tu veux':''}</span></div></div><p class="aide">Touche la sphère pour parler, ou ouvre l'onglet <b>Créer</b> pour lancer une image, une musique, un clip ou du code.</p>`}
  A.innerHTML=`<div class="prog">${Array.from({length:NB},(_,i)=>`<i class="${i<=n?'f':''}"></i>`).join('')}</div><h1>${titre}</h1><div class="corps">${corps}</div><div class="pied">${n>0?'<button class="btn" id="aRet">Retour</button>':''}${peutPasser?'<button class="btn" id="aPasse">Passer</button>':''}<button class="btn p" id="aSuiv">${n===NB-1?'Commencer':'Suivant'}</button></div>`;
  const suivant=()=>{if(n===0)E.profil.prenom=($('#aPrenom',A).value||'').trim();sauver();if(n===NB-1){E.profil.fait=true;sauver();A.classList.remove('on');majMoteur();changerVue('parler');if(!E.messages.length&&E.voixActive)setTimeout(()=>parler(exemple()),500);return}assistant(n+1)};
  $('#aSuiv',A).onclick=suivant;const ret=$('#aRet',A);if(ret)ret.onclick=()=>{if(n===0)E.profil.prenom=($('#aPrenom',A).value||'').trim();assistant(n-1)};const ps=$('#aPasse',A);if(ps)ps.onclick=suivant;
  if(n===1){const maj=()=>$('#aEx',A).textContent=exemple();
    $$('#aTu .choix',A).forEach(c=>c.onclick=()=>{E.profil.tu=c.dataset.v==='1';$$('#aTu .choix',A).forEach(x=>x.classList.toggle('on',x===c));maj()});
    $$('#aTon .choix',A).forEach(c=>c.onclick=()=>{E.profil.ton=c.dataset.v;$$('#aTon .choix',A).forEach(x=>x.classList.toggle('on',x===c));maj()});
    $$('#aLg .choix',A).forEach(c=>c.onclick=()=>{E.profil.longueur=c.dataset.v;$$('#aLg .choix',A).forEach(x=>x.classList.toggle('on',x===c))})}
  if(n===2){chargerVoix();$('#aVoixOn',A).onclick=e=>{E.voixActive=!E.voixActive;sauver();majMuet();e.currentTarget.classList.toggle('on',E.voixActive)};
    $('#voix',A).onchange=e=>{E.voixNom=e.target.value;sauver()};$('#vit',A).oninput=e=>{E.vitesse=parseFloat(e.target.value);$('#vv',A).textContent=E.vitesse.toFixed(1);sauver()};
    $('#aEcoute',A).onclick=()=>{const v=E.voixActive;E.voixActive=true;parler(exemple());E.voixActive=v};
    $('#aMicro',A).onclick=()=>{$('#aMic',A).textContent='Dis quelque chose…';const f=window.__clipiaVoix;
      if(NATIF){const o=f.final,oe=f.erreur;f.final=t=>{f.final=o;f.erreur=oe;E.ecoute=false;$('#aMic',A).innerHTML=t?'<span class="ok">✓ J\'ai entendu : « '+esc(t)+' »</span>':'<span class="ko">Je n\'ai rien entendu.</span>'};f.erreur=c=>{f.final=o;f.erreur=oe;E.ecoute=false;$('#aMic',A).innerHTML='<span class="ko">'+(c==='not-allowed'?'Micro refusé : autorise-le dans les réglages Android.':'Micro indisponible ('+esc(c)+').')+'</span>'};try{NATIF.ecouter()}catch(e){}}
      else if(Reco){const r=new Reco();r.lang='fr-FR';r.onresult=ev=>{$('#aMic',A).innerHTML='<span class="ok">✓ J\'ai entendu : « '+esc(ev.results[0][0].transcript)+' »</span>'};r.onerror=ev=>{$('#aMic',A).innerHTML='<span class="ko">Micro indisponible ('+esc(ev.error)+').</span>'};try{r.start()}catch(e){}}
      else $('#aMic',A).innerHTML='<span class="ko">Dictée non disponible ici.</span>'}}
  if(n===3){$$('#aMot .carte-m',A).forEach(c=>c.onclick=()=>{const id=c.dataset.m;$$('#aMot .carte-m',A).forEach(x=>x.classList.toggle('on',x===c));if(id==='pc')formPC($('#aForm',A),()=>{E.moteur='pc';sauver()});else formMoteur(id,$('#aForm',A),()=>{$('#aForm',A).scrollIntoView({behavior:'smooth'})});$('#aForm',A).scrollIntoView({behavior:'smooth'})})}
  if(n===4){const h=$('#aHf',A);if(h)h.onclick=()=>{configHF()}}
  if(n===5)formPC($('#aPc',A));
}
/* l'assistant masque les feuilles standard : on les remonte au-dessus */
$('#feuilleLibre').style.zIndex=60;$('#voile').style.zIndex=59;

/* ═══ INSTALLATION (navigateur) & DÉMARRAGE ═════════════════════════════════ */
let invite=null;const dejaInst=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,estIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();invite=e;if(!dejaInst&&!NATIF&&!M.lire('banniereFermee',false))$('#banniere').classList.add('on')});
$('#bInstaller').onclick=async()=>{if(invite){invite.prompt();await invite.userChoice;invite=null;$('#banniere').classList.remove('on')}else if(estIOS){$('#banniere').classList.remove('on');libre('<h2>Sur iPhone</h2><p class="doux">Safari → Partager → <b>« Sur l\'écran d\'accueil »</b>.</p>')}};
$('#bFermerBanniere').onclick=()=>{$('#banniere').classList.remove('on');M.ecrire('banniereFermee',true)};
if(estIOS&&!dejaInst&&!NATIF&&!M.lire('banniereFermee',false))setTimeout(()=>$('#banniere').classList.add('on'),3000);

majMoteur();majMuet();majMode();ajuste();
(async()=>{
  const dern=E.messages.slice().reverse();const a=dern.find(m=>m.role==='assistant'),u=dern.find(m=>m.role==='user');
  if(a)await afficher({moi:u?u.contenu:'',elle:a.contenu,creations:a.cr||[]});else afficher();
  if(!E.profil.fait)assistant(0);
  const p=new URLSearchParams(location.search);
  if(p.get('action')==='nouveau'){E.messages=[];sauver();afficher()}
  if(p.get('action')==='voix')setTimeout(basculeConv,800);
})();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
