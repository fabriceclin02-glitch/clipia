'use strict';
/* Clipia X8 mobile — images, musique (compositeur intégré), vidéo (montage intégré) */

/* ═══ IMAGES ═══════════════════════════════════════════════════════════════ */
const FORMATS={carre:[1024,1024],portrait:[768,1344],paysage:[1344,768]};
async function genererImage(prompt,{format='carre',info}={}){
  const [w,h]=FORMATS[format]||FORMATS.carre,enc=encodeURIComponent(prompt.slice(0,900)),seed=Math.floor(Math.random()*1e6),fautes=[];
  const verif=(r,nom)=>{if(r.ok&&r.blob&&/^image\//.test(r.mime||r.blob.type||'image/'))return r.blob;throw new Error(r.ok?nom+' : réponse inattendue.':messageHttp(r,nom))};
  const essais=[];
  if(aCle('pollinations'))essais.push(async()=>{
    const m=E.modeles.pollinationsImage||'flux';let r=await net(`https://gen.pollinations.ai/image/${enc}?width=${w}&height=${h}&model=${encodeURIComponent(m)}&seed=${seed}`,{headers:{Authorization:'Bearer '+E.cles.pollinations},binaire:true});
    if(!r.ok&&r.status===400)r=await net(`https://gen.pollinations.ai/image/${enc}?width=${w}&height=${h}&seed=${seed}`,{headers:{Authorization:'Bearer '+E.cles.pollinations},binaire:true});
    return verif(r,'Pollinations')});
  if(aCle('hf'))essais.push(async()=>{
    const m=E.modeles.hfImage||'black-forest-labs/FLUX.1-schnell';
    const r=await net('https://router.huggingface.co/hf-inference/models/'+m,{method:'POST',headers:{Authorization:'Bearer '+E.cles.hf,'content-type':'application/json',Accept:'image/png'},body:JSON.stringify({inputs:prompt.slice(0,900)}),binaire:true,delai:180000});
    return verif(r,'Hugging Face')});
  essais.push(async()=>{
    for(let t=0;t<2;t++){
      const r=await net(`https://image.pollinations.ai/prompt/${enc}?width=${Math.min(w,1024)}&height=${Math.min(h,1024)}&model=flux&nologo=true&seed=${seed}`,{binaire:true,delai:150000});
      if(!r.ok&&(r.status===402||r.status===429)&&t===0){if(info)info('Service d\'images gratuit sans clé : attente de 16 s…');await attends(16000);continue}
      return verif(r,'Images gratuites (sans clé)')}
  });
  for(const f of essais){try{return await f()}catch(e){fautes.push(e.message)}}
  throw new Error('Impossible de créer l\'image. '+fautes[fautes.length-1]+(aCle('pollinations')||aCle('hf')?'':' → Ajoute une clé Pollinations ou Hugging Face (gratuites) dans Réglages pour des images fiables.'));
}

/* ═══ MUSIQUE : compositeur intégré ═════════════════════════════════════════
   Compose et joue de vraie musique sur le téléphone (synthèse), sans service externe. */
const GAMMES={majeur:[0,2,4,5,7,9,11],mineur:[0,2,3,5,7,8,10]};
const NOTES={C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
const STYLES={
  calme:{tempo:68,mode:'majeur',prog:[0,4,5,3],pad:'triangle',lead:'sine',batt:'aucune',arp:true,dens:.45},
  lofi:{tempo:78,mode:'mineur',prog:[0,5,2,6],pad:'triangle',lead:'triangle',batt:'lofi',arp:true,dens:.5,swing:.12},
  pop:{tempo:112,mode:'majeur',prog:[0,4,5,3],pad:'sawtooth',lead:'square',batt:'pop',arp:false,dens:.7},
  epique:{tempo:92,mode:'mineur',prog:[0,5,2,6],pad:'sawtooth',lead:'sawtooth',batt:'epique',arp:false,dens:.55},
  dance:{tempo:126,mode:'mineur',prog:[0,6,5,6],pad:'sawtooth',lead:'square',batt:'dance',arp:true,dens:.8},
  triste:{tempo:62,mode:'mineur',prog:[0,3,5,4],pad:'triangle',lead:'sine',batt:'aucune',arp:true,dens:.35},
  jazz:{tempo:100,mode:'majeur',prog:[1,4,0,5],pad:'triangle',lead:'sine',batt:'lofi',arp:false,dens:.6,swing:.2}
};
function rng(graine){let h=1779033703^String(graine).length;for(let i=0;i<String(graine).length;i++){h=Math.imul(h^String(graine).charCodeAt(i),3432918353);h=h<<13|h>>>19}let s=h>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const mtof=m=>440*Math.pow(2,(m-69)/12);
function planMusique({titre='Clipia',style='calme',tempo,tonalite='C',mode,mesures}={}){
  const S=STYLES[style]||STYLES.calme;
  const bpm=Math.max(50,Math.min(180,parseInt(tempo)||S.tempo));
  const mo=(mode==='majeur'||mode==='mineur')?mode:S.mode;
  const mes=Math.max(8,Math.min(32,(parseInt(mesures)||16)));
  const note=NOTES[String(tonalite).toUpperCase().replace('♯','#')]??0;
  return{titre,style:STYLES[style]?style:'calme',S,bpm,mo,mes,note};
}
async function composerMusique(opts){
  const P=planMusique(opts),S=P.S,R=rng(P.titre+P.style+P.bpm+P.note),sr=32000;
  const beat=60/P.bpm,bar=beat*4,dur=P.mes*bar+1.5;
  const Off=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Off)throw new Error('Cette version du navigateur ne sait pas composer de musique.');
  const ctx=new Off(2,Math.ceil(dur*sr),sr);
  const master=ctx.createGain();master.gain.value=.55;
  const comp=ctx.createDynamicsCompressor();master.connect(comp);
  const delai=ctx.createDelay(1);delai.delayTime.value=beat*.75;const fb=ctx.createGain();fb.gain.value=.28;const dw=ctx.createGain();dw.gain.value=.25;
  delai.connect(fb);fb.connect(delai);delai.connect(dw);dw.connect(comp);comp.connect(ctx.destination);
  const gamme=GAMMES[P.mo],base=48+P.note;
  const deg=(d,oct=0)=>base+gamme[((d%7)+7)%7]+12*(Math.floor(d/7)+oct);
  const env=(g,t,a,d,s,l,vol)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.linearRampToValueAtTime(vol*s,t+a+d);g.gain.setValueAtTime(vol*s,t+l);g.gain.linearRampToValueAtTime(0,t+l+.25)};
  const voix=(type,midi,t,len,vol,a=.02,d=.1,s=.7,envoi=0,detune=0)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=mtof(midi);o.detune.value=detune;
    const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=type==='sawtooth'||type==='square'?2200:6000;
    o.connect(f);f.connect(g);g.connect(master);if(envoi){const e=ctx.createGain();e.gain.value=envoi;g.connect(e);e.connect(delai)}
    env(g,t,a,d,s,len,vol);o.start(t);o.stop(t+len+.3)};
  const bruit=ctx.createBuffer(1,sr,sr);{const d=bruit.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const tapis=(t,len,freq,type,vol)=>{const s=ctx.createBufferSource();s.buffer=bruit;s.loop=true;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;const g=ctx.createGain();s.connect(f);f.connect(g);g.connect(master);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);s.start(t);s.stop(t+len+.05)};
  const kick=(t,v=.9)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.14);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);o.connect(g);g.connect(master);o.start(t);o.stop(t+.35)};
  const caisse=(t,v=.35)=>tapis(t,.16,1800,'bandpass',v);
  const charley=(t,v=.12)=>tapis(t,.05,7000,'highpass',v);
  const sw=S.swing||0;
  for(let m=0;m<P.mes;m++){
    const t0=m*bar,racine=S.prog[m%S.prog.length],intro=m<2,fin=m>=P.mes-1;
    const accord=[deg(racine),deg(racine+2),deg(racine+4)];
    // nappe
    accord.forEach((n,i)=>voix(S.pad,n,t0,bar*.98,.11,.35,.2,.7,.15,(i-1)*6));
    // basse
    if(!intro){const nb=S.batt==='dance'?8:S.batt==='aucune'?1:S.batt==='epique'?4:4;
      for(let i=0;i<nb;i++){const tt=t0+i*bar/nb;voix('sine',deg(racine,-1),tt,bar/nb*.85,S.batt==='aucune'?.2:.3,.01,.1,.7)}}
    // arpège
    if(S.arp&&!fin){for(let i=0;i<8;i++){const n=accord[i%3]+(i%3===2?12:0);const tt=t0+i*beat/2+(i%2?sw*beat/2:0);voix('triangle',n+12,tt,beat*.4,.07,.01,.1,.5,.3)}}
    // mélodie
    if(m>=1&&!fin){let cur=racine+2+Math.floor(R()*4);
      for(let i=0;i<8;i++){
        if(R()>S.dens)continue;
        const fort=i%2===0;const choix=fort?[racine,racine+2,racine+4,racine+7]:[cur-1,cur+1,cur+2,cur-2];
        cur=choix[Math.floor(R()*choix.length)];cur=Math.max(racine-1,Math.min(racine+9,cur));
        const tt=t0+i*beat/2+(i%2?sw*beat/2:0),len=beat*(R()<.3?1.2:.45);
        voix(S.lead,deg(cur,1),tt,len,.13,.015,.12,.6,.35)}}
    // batterie
    if(!intro&&S.batt!=='aucune'){
      for(let b=0;b<4;b++){const tt=t0+b*beat;
        if(S.batt==='dance'){kick(tt);if(b%2)caisse(tt+beat/2,.2)}
        else if(S.batt==='pop'||S.batt==='epique'){if(b%2===0)kick(tt,S.batt==='epique'?1:.85);else caisse(tt,.4)}
        else{if(b===0||b===2)kick(tt+(b===2?sw*beat:0),.7);if(b%2)caisse(tt,.25)}
        charley(tt,.1);charley(tt+beat/2+sw*beat/2,.07)}
    }
  }
  // fondu de fin
  master.gain.setValueAtTime(.55,dur-1.4);master.gain.linearRampToValueAtTime(0,dur-.05);
  const buf=await ctx.startRendering();
  return{blob:encoderWav(buf),duree:dur,plan:P};
}
function encoderWav(buf){
  const nc=buf.numberOfChannels,n=buf.length,sr=buf.sampleRate,oct=n*nc*2,a=new ArrayBuffer(44+oct),v=new DataView(a);
  const t=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  t(0,'RIFF');v.setUint32(4,36+oct,true);t(8,'WAVE');t(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,nc,true);v.setUint32(24,sr,true);v.setUint32(28,sr*nc*2,true);v.setUint16(32,nc*2,true);v.setUint16(34,16,true);t(36,'data');v.setUint32(40,oct,true);
  const ch=[];for(let c=0;c<nc;c++)ch.push(buf.getChannelData(c));let o=44;
  for(let i=0;i<n;i++)for(let c=0;c<nc;c++){const s=Math.max(-1,Math.min(1,ch[c][i]));v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true);o+=2}
  return new Blob([a],{type:'audio/wav'});
}

/* ═══ VIDÉO : montage image + texte + musique ═══════════════════════════════ */
function decouper(ctx,texte,largeur){const mots=String(texte).split(/\s+/),l=[];let c='';for(const m of mots){const t=c?c+' '+m:m;if(ctx.measureText(t).width>largeur&&c){l.push(c);c=m}else c=t}if(c)l.push(c);return l}
async function fabriquerVideo({titre,scenes,format='vertical',musique,narrations,info}){
  if(!window.MediaRecorder)throw new Error('Cette version du navigateur ne sait pas enregistrer de vidéo.');
  const vert=format!=='horizontal',W=vert?540:960,H=vert?960:540,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
  const imgs=[];
  for(let i=0;i<scenes.length;i++){
    if(info)info('Image '+(i+1)+' / '+scenes.length+'…');
    try{
      if(scenes[i].blob){let bm;try{bm=await createImageBitmap(scenes[i].blob,{resizeWidth:1280,resizeQuality:'medium'})}catch(e){bm=await createImageBitmap(scenes[i].blob)}imgs.push(bm)}
      else if(scenes[i].img){const b=await genererImage(scenes[i].img,{format:vert?'portrait':'paysage',info});imgs.push(await createImageBitmap(b))}
      else imgs.push(null);
    }catch(e){imgs.push(null)}
  }
  const AC=window.AudioContext||window.webkitAudioContext;let ac=null,dest=null,musSrc=null;const bufsN=[];
  const durs=scenes.map(()=>4.2);
  if(AC&&(musique||(narrations&&narrations.some(Boolean)))){
    try{ac=new AC();await ac.resume();dest=ac.createMediaStreamDestination();
      if(narrations)for(let i=0;i<scenes.length;i++){const nb=narrations[i];if(nb){try{const b=await ac.decodeAudioData(await nb.arrayBuffer());bufsN[i]=b;durs[i]=Math.max(3.2,b.duration+.9)}catch(e){}}}
      if(musique){const buf=await ac.decodeAudioData(await musique.arrayBuffer());musSrc=ac.createBufferSource();musSrc.buffer=buf;musSrc.loop=true;const gm=ac.createGain();gm.gain.value=bufsN.some(Boolean)?.28:.8;musSrc.connect(gm);gm.connect(dest)}
    }catch(e){ac=null;dest=null;musSrc=null}
  }
  const starts=[];let tot=0;for(const d of durs){starts.push(tot);tot+=d}
  const flux=cv.captureStream(30);if(dest)dest.stream.getAudioTracks().forEach(t=>flux.addTrack(t));
  const types=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];
  const type=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
  const rec=new MediaRecorder(flux,type?{mimeType:type,videoBitsPerSecond:2200000}:{});
  const morceaux=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)morceaux.push(e.data)};
  const fini=new Promise(ok=>rec.onstop=ok);
  const hues=[255,215,285,190,320,160];
  const dessin=t=>{
    let i=0;while(i<scenes.length-1&&t>=starts[i+1])i++;const p=Math.min(1,(t-starts[i])/durs[i]),sc=scenes[i],im=imgs[i];
    g.fillStyle='#080a1c';g.fillRect(0,0,W,H);
    if(im){const z=1.04+.09*p,r=Math.max(W/im.width,H/im.height)*z,dw=im.width*r,dh=im.height*r;g.drawImage(im,(W-dw)/2+(i%2?-1:1)*p*18,(H-dh)/2,dw,dh)}
    else{const gr=g.createLinearGradient(0,0,W,H);const h=hues[i%hues.length];gr.addColorStop(0,`hsl(${h},70%,28%)`);gr.addColorStop(1,`hsl(${h+50},70%,14%)`);g.fillStyle=gr;g.fillRect(0,0,W,H)}
    const vg=g.createLinearGradient(0,H*.55,0,H);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.78)');g.fillStyle=vg;g.fillRect(0,H*.5,W,H*.5);
    const fs=Math.round(W*.058);g.font=`800 ${fs}px system-ui,sans-serif`;g.textAlign='center';g.textBaseline='alphabetic';
    const lignes=decouper(g,sc.texte||'',W*.84).slice(0,6);let y=H-H*.09-(lignes.length-1)*fs*1.25;
    g.globalAlpha=Math.max(0,Math.min(1,Math.min(p*6,(1-p)*8)+.2));g.fillStyle='#fff';g.shadowColor='#000';g.shadowBlur=14;
    lignes.forEach((l,k)=>g.fillText(l,W/2,y+k*fs*1.25));g.shadowBlur=0;g.globalAlpha=1;
    if(i===0&&p<.6){g.globalAlpha=1-p/.6;g.font=`700 ${Math.round(W*.045)}px system-ui,sans-serif`;g.fillStyle='#cdbfff';g.fillText(titre||'',W/2,H*.09);g.globalAlpha=1}
    g.fillStyle='rgba(255,255,255,.22)';g.fillRect(0,H-5,W,5);g.fillStyle='#7c5cff';g.fillRect(0,H-5,W*(t/tot),5);
  };
  rec.start(250);
  if(ac){const t0=ac.currentTime+.15;if(musSrc)musSrc.start(t0);bufsN.forEach((b,i)=>{if(!b)return;const s=ac.createBufferSource();s.buffer=b;s.connect(dest);s.start(t0+starts[i]+.2)})}
  const t0=performance.now();
  await new Promise(ok=>{const tick=()=>{const t=(performance.now()-t0)/1000;if(t>=tot){ok();return}dessin(t);if(info)info('Montage de la vidéo : '+Math.round(t/tot*100)+' % — garde l\'application ouverte');setTimeout(tick,33)};tick()});
  dessin(tot-.01);await attends(250);rec.stop();await fini;try{if(musSrc)musSrc.stop();if(ac)ac.close()}catch(e){}
  const blob=new Blob(morceaux,{type:(type||'video/webm').split(';')[0]});
  if(!blob.size)throw new Error('La vidéo est vide : ce téléphone n\'a pas pu l\'enregistrer.');
  return blob;
}
