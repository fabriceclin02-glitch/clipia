const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nova', {
  aiChat: (p) => ipcRenderer.invoke('ai:chat', p),
  aiModels: (p) => ipcRenderer.invoke('ai:models', p),
  getKeys: () => ipcRenderer.invoke('keys:get'),
  setKeys: (k) => ipcRenderer.invoke('keys:set', k),
  wipeKeys: () => ipcRenderer.invoke('keys:wipe'),
  setShield: (s) => ipcRenderer.invoke('shield:set', s),
  getShield: () => ipcRenderer.invoke('shield:get'),
  clearPrivacy: () => ipcRenderer.invoke('privacy:clear'),
  openExternal: (url) => ipcRenderer.invoke('nova:open-external', url),
  onOpenTab: (cb) => ipcRenderer.on('nova:open-tab', (_e, url) => cb(url)),
  onBlocked: (cb) => ipcRenderer.on('nova:blocked', (_e, n) => cb(n)),
  platform: process.platform
});
