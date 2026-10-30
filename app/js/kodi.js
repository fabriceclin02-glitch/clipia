'use strict';
/* Clipia X8 — pilotage de Kodi (lecteur multimédia) par la voix, via son interface JSON-RPC. */
const Kodi=(()=>{
  const cfg=()=>Object.assign({on:false,url:'http://localhost:8080',user:'kodi',mdp:''},M.lire('kodi.cfg',{}));
  const k={
    cfg,set(o){M.ecrire('kodi.cfg',Object.assign(cfg(),o))},actif:()=>cfg().on,
    async rpc(method,params){
      const c=cfg(),h={'Content-Type':'application/json'};if(c.user||c.mdp)h.Authorization='Basic '+btoa(unescape(encodeURIComponent(c.user+':'+c.mdp)));
      let r;try{r=await net(c.url.replace(/\/+$/,'')+'/jsonrpc',{method:'POST',headers:h,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:params||{}}),delai:12000})}
      catch(e){throw new Error('Kodi injoignable à '+c.url+'. Vérifie que Kodi est ouvert, et que Réglages Kodi → Services → Contrôle → « Autoriser le contrôle à distance via HTTP » est activé.')}
      if(r.status===401)throw new Error('Kodi : nom d\'utilisateur ou mot de passe refusé.');
      if(!r.ok)throw new Error('Kodi : erreur '+r.status);
      const j=JSON.parse(r.texte);if(j.error)throw new Error('Kodi : '+(j.error.message||'erreur'));return j.result;
    },
    async joueur(){const l=await k.rpc('Player.GetActivePlayers');return l&&l[0]?l[0].playerid:null},
    async agir(act,corps,valeur){
      const a=norm(act),q=(corps||'').trim();
      const nav={haut:'Up',bas:'Down',gauche:'Left',droite:'Right',ok:'Select',retour:'Back',accueil:'Home',menu:'ContextMenu',infos:'Info'};
      if(nav[a]){await k.rpc('Input.'+nav[a]);return 'Fait : '+a+'.'}
      if(a==='pause'||a==='lecture'||a==='reprendre'){const p=await k.joueur();if(p===null)return 'Rien n\'est en cours de lecture.';await k.rpc('Player.PlayPause',{playerid:p});return 'Lecture basculée (pause/reprise).'}
      if(a==='stop'){const p=await k.joueur();if(p!==null)await k.rpc('Player.Stop',{playerid:p});return 'Lecture arrêtée.'}
      if(a==='suivant'||a==='precedent'){const p=await k.joueur();if(p===null)return 'Rien n\'est en cours de lecture.';await k.rpc('Player.GoTo',{playerid:p,to:a==='suivant'?'next':'previous'});return a==='suivant'?'Suivant.':'Précédent.'}
      if(a==='avancer'||a==='reculer'){const p=await k.joueur();if(p===null)return 'Rien n\'est en cours de lecture.';const s=(+valeur||30)*(a==='reculer'?-1:1);await k.rpc('Player.Seek',{playerid:p,value:{seconds:s}});return (s>0?'Avance':'Recul')+' de '+Math.abs(s)+' s.'}
      if(a==='volume'){const v=Math.max(0,Math.min(100,+valeur||+q));if(isNaN(v))return 'Indique un volume entre 0 et 100.';await k.rpc('Application.SetVolume',{volume:v});return 'Volume à '+v+'.'}
      if(a==='muet'){await k.rpc('Application.SetMute',{mute:'toggle'});return 'Son coupé ou rétabli.'}
      if(a==='message'){await k.rpc('GUI.ShowNotification',{title:'Clipia',message:q||'Bonjour'});return 'Message affiché sur Kodi.'}
      if(a==='en_cours'){const p=await k.joueur();if(p===null)return 'Rien n\'est en cours de lecture.';const r=await k.rpc('Player.GetItem',{playerid:p,properties:['title','artist','showtitle','year']});const i=r.item;return 'En cours : '+[i.showtitle,i.title,(i.artist||[]).join(', ')].filter(Boolean).join(' — ')}
      if(a==='film'||a==='musique'||a==='serie'){
        if(!q)return 'Précise le titre à chercher.';
        const f=(champ)=>({filter:{field:champ,operator:'contains',value:q},limits:{start:0,end:5}});
        if(a==='film'){const r=await k.rpc('VideoLibrary.GetMovies',f('title'));const m=(r.movies||[])[0];if(!m)return `Aucun film « ${q} » dans la bibliothèque Kodi.`;await k.rpc('Player.Open',{item:{movieid:m.movieid}});return `Lecture du film « ${m.label} ».`}
        if(a==='serie'){const r=await k.rpc('VideoLibrary.GetTVShows',f('title'));const s=(r.tvshows||[])[0];if(!s)return `Aucune série « ${q} » dans la bibliothèque Kodi.`;
          const e=await k.rpc('VideoLibrary.GetEpisodes',{tvshowid:s.tvshowid,filter:{field:'playcount',operator:'is',value:'0'},limits:{start:0,end:1}});const ep=(e.episodes||[])[0];if(!ep)return `Plus d'épisode non vu pour « ${s.label} ».`;await k.rpc('Player.Open',{item:{episodeid:ep.episodeid}});return `Lecture de « ${s.label} » : ${ep.label}.`}
        let r=await k.rpc('AudioLibrary.GetSongs',f('title'));let s=(r.songs||[])[0];
        if(!s){r=await k.rpc('AudioLibrary.GetArtists',f('artist'));const ar=(r.artists||[])[0];if(ar){await k.rpc('Player.Open',{item:{artistid:ar.artistid}});return `Lecture de ${ar.label}.`}return `Aucun titre ni artiste « ${q} » dans la bibliothèque Kodi.`}
        await k.rpc('Player.Open',{item:{songid:s.songid}});return `Lecture de « ${s.label} ».`}
      if(a==='addon'){if(!q)return 'Précise l\'identifiant du module (ex : plugin.video.youtube).';await k.rpc('Addons.ExecuteAddon',{addonid:q});return 'Module « '+q+' » lancé.'}
      return 'Action inconnue. Actions : film, serie, musique, pause, stop, suivant, precedent, avancer, reculer, volume, muet, haut, bas, gauche, droite, ok, retour, accueil, en_cours, message, addon.';
    }
  };
  return k;
})();
window.Kodi=Kodi;
OUTILS_SYS.kodi=async a=>{
  if(!Kodi.actif())return 'Kodi n\'est pas activé : demande à la personne de l\'activer dans Réglages → Kodi.';
  return await Kodi.agir(a.at.action||'',a.corps,a.at.valeur);
};
const _mrK=majReglages;majReglages=function(){_mrK();const p=$('#pReglages'),c=Kodi.cfg(),d=document.createElement('div');
  d.innerHTML=`<h3>Kodi (commande vocale)</h3><p class="aide">Clipia pilote Kodi : « mets le film Matrix », « pause », « volume 30 »… Dans Kodi : Réglages → Services → Contrôle → active « Autoriser le contrôle à distance via HTTP ». Kodi sur ce téléphone : adresse <b>http://localhost:8080</b> ; sur une TV ou un PC : son adresse IP (ex. http://192.168.1.20:8080).</p>
  <div class="carte-m ${c.on?'on':''}" id="kOn"><span class="r"></span><div><b>Activer le pilotage de Kodi</b><span>Ajoute l'outil « Kodi » à Clipia.</span></div></div>
  <input type="text" id="kU" placeholder="Adresse de Kodi" value="${esc(c.url)}"><input type="text" id="kN" placeholder="Utilisateur (kodi par défaut)" value="${esc(c.user)}" autocapitalize="off"><input type="password" id="kP" placeholder="Mot de passe (si défini dans Kodi)" value="${esc(c.mdp)}">
  <button class="btn p" id="kT">Enregistrer et tester</button>${NATIF?'<button class="btn" id="kO">Ouvrir Kodi</button>':''}<p class="aide" id="kR"></p>`;
  p.appendChild(d);
  $('#kOn',d).onclick=()=>{$('#kOn',d).classList.toggle('on')};
  $('#kT',d).onclick=async()=>{Kodi.set({on:$('#kOn',d).classList.contains('on'),url:($('#kU',d).value.trim()||'http://localhost:8080'),user:$('#kN',d).value.trim(),mdp:$('#kP',d).value});
    $('#kR',d).textContent='Test…';try{await Kodi.rpc('JSONRPC.Ping');$('#kR',d).textContent='🟢 Kodi répond.'}catch(e){$('#kR',d).textContent='🔴 '+e.message}};
  if($('#kO',d))$('#kO',d).onclick=()=>{const r=NATIF.lancerApp('org.xbmc.kodi');if(!r)toast('Kodi n\'est pas installé : il est dans le Clipia Store.')};
};
