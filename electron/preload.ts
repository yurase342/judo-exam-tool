import { contextBridge, ipcRenderer } from 'electron';

// Electron APIをレンダラープロセスに安全に公開
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFolder: (folderPath: string) => ipcRenderer.invoke('read-folder', folderPath),
});

// TypeScript型定義
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      readFolder: (folderPath: string) => Promise<string[]>;
    };
  }
}
