const e = document.getElementById('e'), b = document.getElementById('b'); let actif = true;
const maj = () => chrome.runtime.sendMessage('etat', s => { actif = s.actif; e.textContent = s.erreur ? '⚠ ' + s.erreur : s.actif ? '● Connectée à ' + s.serveur : '⏸ En pause'; b.textContent = s.actif ? 'Mettre en pause' : 'Reprendre'; });
b.onclick = () => chrome.runtime.sendMessage(actif ? 'pause' : 'reprise', () => setTimeout(maj, 300)); maj(); setInterval(maj, 2000);
