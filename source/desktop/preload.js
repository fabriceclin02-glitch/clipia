const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('clipia', {
  bureau: true,
  plateforme: process.platform,
  version: '1.0.0',
  ouvrirDossier: () => ipcRenderer.invoke('ouvrir-dossier')
});
