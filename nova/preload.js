const { contextBridge, ipcRenderer } = require('electron');
const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, v) => cb(v));

contextBridge.exposeInMainWorld('nova', {
  aiChat: (p) => ipcRenderer.invoke('ai:chat', p),
  aiModels: (p) => ipcRenderer.invoke('ai:models', p),
  transcribe: (p) => ipcRenderer.invoke('voice:transcribe', p),
  getKeys: () => ipcRenderer.invoke('keys:get'),
  setKeys: (k) => ipcRenderer.invoke('keys:set', k),
  wipeKeys: () => ipcRenderer.invoke('keys:wipe'),
  setNet: (n) => ipcRenderer.invoke('net:set', n),
  setShield: (s) => ipcRenderer.invoke('shield:set', s),
  clearPrivacy: () => ipcRenderer.invoke('privacy:clear'),
  openExternal: (url) => ipcRenderer.invoke('nova:open-external', url),
  toggleFullscreen: () => ipcRenderer.invoke('nova:fullscreen'),
  showFile: (p) => ipcRenderer.invoke('nova:show-file', p),
  savePng: (p) => ipcRenderer.invoke('nova:save-png', p),
  sysDiag: () => ipcRenderer.invoke('sys:diag'),
  sysQuick: () => ipcRenderer.invoke('sys:quick'),
  sysBlocked: (c) => ipcRenderer.invoke('sys:blocked', c),
  sysRun: (a) => ipcRenderer.invoke('sys:run', a),
  isDemo: () => ipcRenderer.invoke('nova:demo'),
  torStart: () => ipcRenderer.invoke('tor:start'),
  torStop: () => ipcRenderer.invoke('tor:stop'),
  torStatus: () => ipcRenderer.invoke('tor:status'),
  onOpenTab: on('nova:open-tab'),
  onBlocked: on('nova:blocked'),
  onKey: on('nova:key'),
  onDownload: on('nova:download'),
  onTor: on('tor:status'),
  platform: process.platform
});
