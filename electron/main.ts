import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initializeDatabase, getDatabase } from './database/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 開発環境かどうか
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '国家試験対策ツール',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // データベース初期化
  initializeDatabase();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPCハンドラー: フォルダ選択
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// IPCハンドラー: ファイル一覧取得
ipcMain.handle('read-folder', async (_event, folderPath: string) => {
  const fs = await import('fs/promises');
  try {
    const files = await fs.readdir(folderPath);
    return files.filter((file) => file.endsWith('.pdf'));
  } catch (error) {
    throw new Error(`フォルダの読み込みに失敗しました: ${error}`);
  }
});
