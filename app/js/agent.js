'use strict';
/* Clipia X8 mobile — cerveau : consignes, outils, agents et sous-agents */

const TOUS_OUTILS=['image','musique','video','code','deleguer','agent_creer','memoire','pc','contact','message','app_ouvrir','telephone','google','kodi'];
const OUTILS_ANDROID=['contact','message','app_ouvrir','telephone'];
const LIBELLE_OUTIL={image:'Images',musique:'Musique',video:'Vidéo',code:'Code et fichiers',deleguer:'Déléguer à des sous-agents',agent_creer:'Créer des agents',memoire:'Mémoire',pc:'Piloter mon PC',contact:'Contacts',message:'Envoyer des messages',app_ouvrir:'Ouvrir des applis',telephone:'Appels, alarme, réglages',google:'Gmail et Agenda Google',kodi:'Piloter Kodi'};
const AGENTS_DEFAUT=[
  {id:'codeur',nom:'Codeur',role:'Développeur : crée des sites, jeux, outils et scripts complets.',instructions:'Tu es un développeur senior. Tu écris du code complet, propre et directement utilisable, jamais de squelette. Pour une application ou un site, tu produis un seul fichier HTML (CSS et JS intégrés) adapté au téléphone.',outils:['code','memoire'],sousAgents:[]},
  {id:'illustrateur',nom:'Illustrateur',role:'Crée des images : affiches, personnages, décors, logos.',instructions:'Tu es directeur artistique. Tu transformes chaque demande en une description d\'image très précise en anglais (sujet, style, lumière, cadrage) puis tu génères l\'image.',outils:['image'],sousAgents:[]},
  {id:'compositeur',nom:'Compositeur',role:'Compose des musiques originales.',instructions:'Tu es compositeur. Tu choisis le style, le tempo, la tonalité et la durée qui correspondent à l\'ambiance demandée puis tu composes.',outils:['musique'],sousAgents:[]},
  {id:'realisateur',nom:'Réalisateur',role:'Fait des clips vidéo complets avec images, texte et musique.',instructions:'Tu es réalisateur de clips courts. Tu écris un scénario de 4 à 6 scènes (texte court affiché + description d\'image en anglais) et tu lances le montage vidéo avec une musique adaptée.',outils:['video','image','musique','deleguer'],sousAgents:['Illustrateur','Compositeur']},
  {id:'chef',nom:'Chef de projet',role:'Coordonne une équipe d\'agents pour mener un projet complet.',instructions:'Tu es chef de projet. Tu découpes le projet en tâches, tu les confies aux bons sous-agents avec des consignes précises, puis tu fais la synthèse pour la personne.',outils:['deleguer','agent_creer','memoire'],sousAgents:['Codeur','Illustrateur','Compositeur','Réalisateur']}
  ,{id:'psychologue',nom:'Psychologue',role:'Écoute bienveillante, aide à y voir clair (ne remplace pas un professionnel).',instructions:'Tu es une présence d\'écoute bienveillante inspirée de l\'approche psychologique : tu accueilles ce que la personne ressent, tu reformules, tu poses UNE question ouverte à la fois, tu proposes de petits exercices simples (respiration, journal, recadrage). Tu ne poses jamais de diagnostic, tu ne remplaces pas un professionnel de santé et tu le rappelles avec délicatesse si la situation est sérieuse. Si la personne parle de se faire du mal ou d\'idées suicidaires, tu restes calme, tu l\'encourages à contacter tout de suite quelqu\'un de confiance et, en France, le 3114 (numéro national de prévention du suicide, gratuit, 24 h/24) ou le 15 / 112 en urgence.',outils:['memoire'],sousAgents:[],voix:{nom:'',vitesse:.92,hauteur:.95,style:'douce, lente, apaisante, avec des silences'}},
  {id:'coach',nom:'Coach',role:'Motivation, organisation et objectifs.',instructions:'Tu es un coach bienveillant et exigeant : tu clarifies l\'objectif, découpes en petites étapes concrètes, fixes des échéances et relances la personne.',outils:['memoire'],sousAgents:[],voix:{nom:'',vitesse:1.05,hauteur:1,style:'énergique et encourageante'}},
  {id:'conteur',nom:'Conteur',role:'Raconte des histoires, avec images et musique.',instructions:'Tu es un conteur : tu inventes des histoires captivantes et, si on te le demande, tu en fais un clip narré avec images et musique.',outils:['video','image','musique','deleguer'],sousAgents:['Illustrateur','Compositeur'],voix:{nom:'',vitesse:.95,hauteur:.9,style:'posée, expressive, façon conteur'}},
  {id:'professeur',nom:'Professeur',role:'Explique n\'importe quel sujet pas à pas.',instructions:'Tu es un professeur patient : tu expliques simplement, avec des exemples et des analogies, puis tu vérifies la compréhension avec une petite question.',outils:['memoire','code'],sousAgents:[],voix:{nom:'',vitesse:1,hauteur:1,style:'claire, pédagogue et patiente'}}
];
if(!E.agents)E.agents=[];
{let m=false;AGENTS_DEFAUT.forEach(d=>{const x=E.agents.find(a=>a.id===d.id);if(!x){E.agents.push(JSON.parse(JSON.stringify(d)));m=true}else if(!x.voix&&d.voix){x.voix=d.voix;m=true}});if(m)sauver()}
const VOIX_DEF={nom:'',vitesse:1,hauteur:1,style:''};
const voixAgent=a=>Object.assign({},VOIX_DEF,(a&&a.voix)||{});
const STYLES_VOIX=['douce et apaisante','énergique et motivante','posée et rassurante','dramatique et expressive','joyeuse et souriante','sérieuse et professionnelle','chuchotée et intime'];
const norm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const trouverAgent=n=>E.agents.find(a=>norm(a.nom)===norm(n)||a.id===norm(n));

const DOC_OUTILS={
  image:'<outil nom="image" format="carre|portrait|paysage">description détaillée de l\'image, en anglais</outil> — crée une image.',
  musique:'<outil nom="musique" titre="…" style="calme|lofi|pop|epique|dance|triste|jazz" tempo="60-160" tonalite="C|D|E|F|G|A|B" mode="majeur|mineur" mesures="8-32"></outil> — compose une musique originale.',
  video:'<outil nom="video" titre="…" format="vertical|horizontal" narration="oui|non" style="calme|lofi|pop|epique|dance|triste|jazz|aucune">une scène par ligne, 3 à 6 lignes, sous la forme : texte court affiché | description de l\'image en anglais</outil> — monte un clip vidéo avec images, textes, musique et narration parlée (le texte de chaque scène est lu à voix haute si narration="oui").',
  code:'<outil nom="code" fichier="nom.ext" app="oui|non" titre="Nom" icone="emoji">contenu COMPLET du fichier</outil> — crée un fichier (une application, un jeu ou un site = un seul fichier .html (mets app="oui" avec titre et icone pour qu\'elle apparaisse comme application sur l\'écran d\'accueil), avec CSS et JS intégrés, adapté au téléphone, entièrement fonctionnel).',
  deleguer:'<outil nom="deleguer" agent="Nom">tâche précise à confier</outil> — confie une tâche à un sous-agent et récupère son résultat.',
  agent_creer:'<outil nom="agent_creer" agent="Nom" role="description courte" outils="image,musique,video,code,deleguer,memoire" sous_agents="Nom1,Nom2" voix="façon de parler, ex : douce et lente">instructions détaillées du nouvel agent</outil> — crée un agent durable (et ses sous-agents) dans l\'application.',
  memoire:'<outil nom="memoire">fait à retenir sur la personne ou le projet</outil> — mémorise pour les prochaines conversations.',
  contact:'<outil nom="contact">nom à chercher</outil> — cherche dans les contacts du téléphone (nom + numéro).',
  message:'<outil nom="message" contact="Nom exact du contact" canal="sms|whatsapp">texte du message</outil> — prépare un message ; la personne le relit et le confirme à l\'écran avant l\'envoi. Si elle n\'a pas encore dit quoi écrire, demande-le-lui d\'abord (« Que veux-tu lui dire ? »), sans appeler l\'outil.',
  app_ouvrir:'<outil nom="app_ouvrir">nom de l\'application (ex : YouTube, Photos)</outil> — ouvre une application installée.',
  telephone:'<outil nom="telephone" action="appeler|alarme|minuteur|camera|lampe|wifi|bluetooth|son|luminosite|reglages|contacts|messages|galerie|calculatrice|agenda|navigateur|musique|carte|accueil_defaut" valeur="numéro, HH:MM, secondes ou on/off selon l\'action">contact éventuel</outil> — fonctions du téléphone (appel via le composeur, alarme, minuteur, lampe, réglages…).',
  google:'<outil nom="google" action="lire_mail|envoyer_mail|agenda" a="adresse" sujet="objet">recherche Gmail (lire_mail) ou texte du courriel (envoyer_mail)</outil> — lit les derniers courriels, liste les prochains événements de l\'agenda, ou prépare un courriel que la personne relit et confirme avant l\'envoi.',
  kodi:'<outil nom="kodi" action="film|serie|musique|pause|stop|suivant|precedent|avancer|reculer|volume|muet|haut|bas|gauche|droite|ok|retour|accueil|en_cours|message|addon" valeur="nombre">titre ou texte</outil> — pilote le lecteur Kodi de la personne (ex : action="film" + titre pour lancer un film de sa bibliothèque ; action="volume" valeur="30"). Réponds brièvement et à voix haute ce qui a été fait.',
  pc:'<outil nom="pc">demande envoyée à Clipia sur l\'ordinateur de la personne</outil> — pour agir sur le PC (fichiers, programmes, installation…).'
};
const TONS={chaleureux:'chaleureux et bienveillant',pro:'professionnel et précis',direct:'direct, efficace, sans fioritures',decontracte:'décontracté et complice'};

function systeme(agent,prof,voix){
  const P=E.profil,pc=!!(E.pc.url&&E.pc.jeton);
  const permis=(agent?agent.outils:TOUS_OUTILS).filter(o=>o!=='pc'||pc).filter(o=>o!=='google'||(window.Google&&Google.connecte())).filter(o=>o!=='kodi'||(window.Kodi&&Kodi.actif())).filter(o=>!OUTILS_ANDROID.includes(o)||!!NATIF).filter(o=>o!=='deleguer'||prof<2).filter(o=>o!=='agent_creer'||prof<1);
  const l=[];
  l.push(agent&&prof>0?`Tu es « ${agent.nom} », un sous-agent de Clipia. ${agent.instructions}`:agent?`Tu es Clipia X8 (CLENDAX, créée par Clin Fabrice), en ce moment dans le rôle de l'agent « ${agent.nom} » : ${agent.role} ${agent.instructions}`:`Tu es Clipia X8, l'assistante personnelle de CLENDAX, créée par Clin Fabrice. Tu es une vraie assistante qui agit : tu codes, crées des images, des musiques et des vidéos, et diriges des agents et sous-agents.`);
  l.push(`Langue : français. ${P.tu?'Tu tutoies':'Tu vouvoies'} la personne${P.prenom?' et tu l\'appelles '+P.prenom:''}. Ton : ${TONS[P.ton]||TONS.chaleureux}.`);
  l.push(prof>0?'Réponds par le résultat utile, de façon concise.':(P.longueur==='detaillee'?'Tes réponses sont complètes mais claires.':'Tes réponses parlées sont courtes (1 à 3 phrases) car elles sont lues à voix haute ; pas de listes ni d\'emoji. Ne recopie jamais de code dans ta réponse : il est dans le fichier créé.'));
  if(permis.length){
    l.push('OUTILS : pour agir, écris une balise <outil …>…</outil> (plusieurs possibles dans un même message). L\'application l\'exécute et te renvoie le résultat. Ne dis jamais qu\'une chose est faite avant d\'avoir reçu le résultat. Si la personne demande de créer quelque chose, utilise l\'outil au lieu d\'expliquer comment faire.');
    permis.forEach(o=>l.push('• '+DOC_OUTILS[o]));
    if(permis.includes('deleguer')){const sa=(agent?agent.sousAgents:E.agents.map(a=>a.nom)).filter(Boolean);if(sa.length)l.push('Sous-agents disponibles : '+sa.join(', ')+'.')}
  }else l.push('Tu n\'as pas d\'outil : réponds par du texte.');
  {const st=(voix&&voix.style)||(agent&&agent.voix&&agent.voix.style);if(st&&!prof)l.push('Manière de parler (tes réponses seront lues à voix haute) : '+st+'. Adapte le rythme, les phrases et le vocabulaire à cette façon de parler.')}
  if(!prof&&E.memoire.length)l.push('À retenir sur la personne : '+E.memoire.slice(-15).join(' ; ')+'.');
  return l.join('\n');
}

/* lit les balises <outil …>…</outil> */
function extraire(texte){
  const appels=[];let propre='',i=0;
  while(i<texte.length){
    const d=texte.indexOf('<outil',i);
    if(d<0){propre+=texte.slice(i);break}
    propre+=texte.slice(i,d);
    const f=texte.indexOf('>',d);if(f<0){break}
    let enTete=texte.slice(d+6,f),auto=false;if(enTete.endsWith('/')){auto=true;enTete=enTete.slice(0,-1)}
    const at={};enTete.replace(/(\w+)\s*=\s*"([^"]*)"/g,(_,k,v)=>{at[k]=v});enTete.replace(/(\w+)\s*=\s*'([^']*)'/g,(_,k,v)=>{if(!(k in at))at[k]=v});
    let corps='',suite=f+1;
    if(!auto){const e=texte.indexOf('</outil>',f+1);if(e<0){corps=texte.slice(f+1);suite=texte.length}else{corps=texte.slice(f+1,e);suite=e+8}}
    if(at.nom)appels.push({nom:norm(at.nom).replace(/[^a-z_]/g,''),at,corps:corps.replace(/^\n+|\s+$/g,'')});
    i=suite;
  }
  propre=propre.replace(/```[\s\S]*?```/g,'').replace(/\n{3,}/g,'\n\n').trim();
  return{propre,appels};
}

/* exécution d'un outil ; renvoie le texte donné au modèle */
async function executer(a,ctx){
  const {nom,at,corps}=a;const etape=ctx.etape||(()=>{});
  const permis=(ctx.agent?ctx.agent.outils:TOUS_OUTILS);
  if(!TOUS_OUTILS.includes(nom))return `Outil inconnu « ${nom} ».`;
  if(!permis.includes(nom))return `Outil « ${nom} » non autorisé pour ce rôle.`;
  if(++ctx.compteur.n>14)return 'Limite d\'actions atteinte pour cette demande.';
  try{
    if(window.OUTILS_SYS&&OUTILS_SYS[nom])return await OUTILS_SYS[nom](a,ctx);
    if(nom==='image'){
      if(!corps)return 'Description manquante.';etape('Je crée l\'image…');
      const b=await genererImage(corps,{format:norm(at.format),info:etape});
      const c=await nouvelleCreation('image',at.titre||corps.slice(0,40),b,{prompt:corps});ctx.creations.push(c.id);return `Image créée : « ${c.titre} ».`;
    }
    if(nom==='musique'){
      etape('Je compose la musique…');
      const r=await composerMusique({titre:at.titre||'Clipia',style:norm(at.style),tempo:at.tempo,tonalite:at.tonalite,mode:norm(at.mode),mesures:at.mesures});
      const c=await nouvelleCreation('musique',at.titre||'Musique',r.blob,{plan:{style:r.plan.style,bpm:r.plan.bpm,mode:r.plan.mo}});ctx.creations.push(c.id);return `Musique composée : « ${c.titre} » (${r.plan.style}, ${r.plan.bpm} BPM, ${Math.round(r.duree)} s).`;
    }
    if(nom==='video'){
      const scenes=corps.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const p=l.split('|');return{texte:(p[0]||'').replace(/^[-*\d.\s]+/,'').trim(),img:(p[1]||'').trim()}}).filter(s=>s.texte||s.img).slice(0,8);
      if(!scenes.length)return 'Aucune scène fournie (format : texte | description de l\'image).';
      const vert=norm(at.format)!=='horizontal';let musique=null;const st=norm(at.style||'calme');
      if(st!=='aucune'){etape('Je compose la musique du clip…');const mes=Math.min(32,Math.max(8,Math.ceil(scenes.length*4.2/(240/((STYLES[st]||STYLES.calme).tempo)))));musique=(await composerMusique({titre:at.titre||'clip',style:STYLES[st]?st:'calme',mesures:mes})).blob}
      let narr=null;
      if(norm(at.narration)==='oui'||(ctx.voix&&ctx.voix.narration)){const vv=Object.assign({},voixAgent(ctx.agent),ctx.voix||{});narr=[];for(let i=0;i<scenes.length;i++){etape('Narration '+(i+1)+' / '+scenes.length+'…');narr.push(scenes[i].texte?await synthese(scenes[i].texte,vv):null)}if(!narr.some(Boolean)){narr=null;etape('Narration indisponible ici : clip sans voix.')}}
      const b=await fabriquerVideo({titre:at.titre||'',scenes,format:vert?'vertical':'horizontal',musique,narrations:narr,info:etape});
      const c=await nouvelleCreation('video',at.titre||'Clip',b,{scenes:scenes.length});ctx.creations.push(c.id);return `Vidéo créée : « ${c.titre} » (${scenes.length} scènes).`;
    }
    if(nom==='code'){
      const f=(at.fichier||'projet.html').replace(/[^\w.\-]+/g,'_');if(!corps)return 'Fichier vide.';etape('J\'écris le code…');
      const ext=(f.split('.').pop()||'txt').toLowerCase();const mime={html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',json:'application/json',py:'text/x-python',md:'text/markdown',svg:'image/svg+xml'}[ext]||'text/plain';
      const b=new Blob([corps],{type:mime+';charset=utf-8'});
      const estApp=norm(at.app)==='oui'&&ext==='html';if(estApp){for(const o of await BD.tous())if(o.type==='app'&&norm(o.titre)===norm(at.titre||f))await BD.suppr(o.id)}
      const c=await nouvelleCreation(estApp?'app':'code',at.titre||f,b,{fichier:f,ext,icone:at.icone||'🧩'});ctx.creations.push(c.id);if(estApp)return `Application « ${c.titre} » créée et ajoutée à l'accueil (onglet Accueil / Studio).`;return `Fichier « ${f} » créé (${corps.length} caractères). L'aperçu est disponible dans la conversation.`;
    }
    if(nom==='agent_creer'){
      const n=(at.agent||'').trim();if(!n)return 'Nom d\'agent manquant.';
      const outils=(at.outils||'').split(',').map(x=>norm(x)).filter(o=>TOUS_OUTILS.includes(o)&&o!=='pc');
      const ag={id:norm(n).replace(/[^a-z0-9]+/g,'-'),nom:n,role:at.role||'Agent personnalisé',instructions:corps||at.role||'',outils:outils.length?outils:['memoire'],sousAgents:(at.sous_agents||'').split(',').map(x=>x.trim()).filter(Boolean),voix:Object.assign({},VOIX_DEF,{style:at.voix||''})};
      const k=E.agents.findIndex(x=>x.id===ag.id);if(k>=0)E.agents[k]=ag;else E.agents.push(ag);sauver();if(window.UI)UI.majAgents();
      return `Agent « ${n} » ${k>=0?'mis à jour':'créé'} (outils : ${ag.outils.join(', ')}${ag.sousAgents.length?' ; sous-agents : '+ag.sousAgents.join(', '):''}). Il apparaît dans l'onglet Agents.`;
    }
    if(nom==='deleguer'){
      const ag=trouverAgent(at.agent);if(!ag)return `Agent « ${at.agent} » introuvable. Disponibles : ${E.agents.map(x=>x.nom).join(', ')}.`;
      if(ctx.profondeur>=2)return 'Profondeur maximale de délégation atteinte.';
      etape('Sous-agent « '+ag.nom+' » au travail…');
      const r=await boucle({agent:ag,entree:corps,profondeur:ctx.profondeur+1,creations:ctx.creations,compteur:ctx.compteur,etape,voix:ctx.voix});
      return `Résultat de « ${ag.nom} » : ${r.texte||'(terminé)'}`;
    }
    if(nom==='memoire'){if(corps){E.memoire.push(corps.slice(0,200));sauver()}return 'Mémorisé.'}
    if(nom==='pc'){etape('Je transmets à ton PC…');return 'Réponse du PC : '+await appelPC(corps)}
  }catch(e){return 'ÉCHEC : '+(e.message||e)}
  return 'Rien à faire.';
}

/* boucle réflexion → outils → réponse */
async function boucle({agent,entree,historique=[],profondeur=0,creations=[],compteur={n:0},etape=()=>{},voix=null}){
  const msgs=[{role:'system',content:systeme(agent,profondeur,voix)},...historique,{role:'user',content:entree}];
  let dernier='',moteur=null;
  for(let tour=0;tour<5;tour++){
    const r=await llm(msgs);moteur=r.moteur;
    const {propre,appels}=extraire(r.texte);dernier=propre;
    if(!appels.length)break;
    msgs.push({role:'assistant',content:r.texte});
    const res=[];
    for(const a of appels){res.push(`[${a.nom}] ${await executer(a,{agent,profondeur,creations,compteur,etape,voix})}`)}
    msgs.push({role:'user',content:'RÉSULTATS DES OUTILS :\n'+res.join('\n')+'\n\nMaintenant, '+(profondeur>0?'donne ton résultat final, concis.':'réponds à la personne en 1 à 3 phrases, à voix haute, sans balise (sauf si une autre action est vraiment nécessaire). Si un outil a échoué, dis-le simplement et propose une solution.')});
    if(tour===4)dernier=dernier||'';
  }
  return{texte:dernier,creations,moteur};
}

/* point d'entrée depuis l'interface */
async function traiter(texte,etape,voix){
  const agent=E.agentActif?E.agents.find(a=>a.id===E.agentActif):null;
  const hist=E.messages.slice(-10).map(m=>({role:m.role,content:m.contenu}));
  const r=await boucle({agent,entree:texte,historique:hist,profondeur:0,etape,voix});
  return r;
}
