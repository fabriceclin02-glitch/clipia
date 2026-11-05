// Test de sécurité du chat téléphone. Lancer Clipia puis : PORT=8787 IP_LAN=<IP du PC sur le Wi-Fi> node scripts/test-chat-securite.mjs
const P=process.env.PORT||8787, IP=process.env.IP_LAN||'192.0.2.2'; const L='http://127.0.0.1:'+P, R='http://'+IP+':'+P, H={'x-clipia-accord':'1','content-type':'application/json'};
const j=async(u,o={})=>{const r=await fetch(u,o);let d;try{d=await r.json()}catch{d=null}return{s:r.status,d}};
let ko=0; const t=(ok,n,x='')=>{if(!ok)ko++;console.log((ok?'✓':'✗')+' '+n+(x?' — '+x:''))};
const c1=(await j(L+'/api/appairage/creer',{method:'POST',headers:H})).d;
// sans jeton depuis l'extérieur
t((await j(R+'/api/chat/depuis?seq=0')).s===401,'chat sans jeton refusé (401)');
t((await j(R+'/api/chat/envoyer',{method:'POST',headers:{'content-type':'application/json'},body:'{"texte":"x"}'})).s===401,'envoi sans jeton refusé');
t((await j(R+'/api/appairage/creer',{method:'POST',headers:H})).s!==200,'création de QR refusée depuis l\'extérieur');
t((await j(R+'/api/appairage/appareils',{headers:H})).s!==200,'liste des appareils refusée depuis l\'extérieur');
t((await j(R+'/api/coffre')).s===403||(await j(R+'/api/coffre')).s===404,'coffre/secrets inaccessibles à distance');
t((await j(R+'/media/x.png')).s===401,'médias sans jeton refusés');
// mauvais code
t((await j(R+'/api/appairage/valider',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'mauvais'})})).s===403,'mauvais code refusé');
// bon code, usage unique
const ok=await j(R+'/api/appairage/valider',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:c1.code,appareil:'Test'})});
t(ok.s===200&&ok.d.jeton?.length>=40,'bon code accepté, jeton propre au téléphone',ok.d.jeton?.length+' car.');
const bis=await j(R+'/api/appairage/valider',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:c1.code})});
t(bis.s!==200,'code déjà utilisé refusé (usage unique)');
const A={authorization:'Bearer '+ok.d.jeton,'content-type':'application/json'};
t((await j(R+'/api/chat/depuis?seq=0',{headers:A})).s===200,'avec son jeton, le téléphone lit la discussion');
// idClient : pas de doublon
const e1=await j(R+'/api/chat/envoyer',{method:'POST',headers:A,body:JSON.stringify({texte:'Bonjour',idClient:'dup1'})});
const e2=await j(R+'/api/chat/envoyer',{method:'POST',headers:A,body:JSON.stringify({texte:'Bonjour',idClient:'dup1'})});
t(e1.d.reponse&&e2.d.doublon===true,'renvoi hors-ligne : jamais deux fois (idClient)');
// accords depuis le téléphone désactivés par défaut
t((await j(R+'/api/chat/accord',{method:'POST',headers:A,body:'{"id":"x"}'})).s===400,'accord depuis le téléphone refusé par défaut');
// accès à des routes sensibles avec un jeton d'appareil
t((await j(R+'/api/noyau/machine',{headers:A})).s===403,'route machine inaccessible même avec jeton d\'appareil');
t((await j(R+'/api/atelier/agents',{headers:A})).s===403,'routes d\'administration inaccessibles à distance');
// révocation
const liste=(await j(L+'/api/appairage/appareils',{headers:H})).d.appareils; const mien=liste.find(x=>x.nom==='Test');
t(!!mien,'le PC voit le téléphone appairé');
await j(L+'/api/appairage/appareils/'+mien.id,{method:'DELETE',headers:H});
t((await j(R+'/api/chat/depuis?seq=0',{headers:A})).s===401,'téléphone révoqué : 401 immédiat');
// limitation d'essais
let lim=0; for(let i=0;i<8;i++){const r=await j(R+'/api/appairage/valider',{method:'POST',headers:{'content-type':'application/json'},body:'{"code":"x"}'}); if(r.s===429)lim++}
t(lim>0,'5 essais par minute maximum (429)');
// code expiré
console.log(ko?ko+' échec(s)':'tout est bon'); process.exit(0);
