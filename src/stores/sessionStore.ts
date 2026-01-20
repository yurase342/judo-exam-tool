import { create } from 'zustand';
import { Session, SessionSettings, Mode, FileMetadata } from '../types';

interface SessionState {
  // フォルダ関連
  selectedFolder: string | null;
  fileMetadata: FileMetadata[];
  isLoading: boolean;
  loadError: string | null;

  // セッション設定
  mode: Mode | null;
  settings: SessionSettings | null;
  currentSession: Session | null;

  // アクション
  setSelectedFolder: (folder: string | null) => void;
  setFileMetadata: (metadata: FileMetadata[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadError: (error: string | null) => void;
  setMode: (mode: Mode) => void;
  updateSettings: (settings: Partial<SessionSettings>) => void;
  startSession: () => void;
  endSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  selectedFolder: null,
  fileMetadata: [],
  isLoading: false,
  loadError: null,
  mode: null,
  settings: null,
  currentSession: null,

  setSelectedFolder: (folder) => set({ selectedFolder: folder }),
  setFileMetadata: (metadata) => set({ fileMetadata: metadata }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadError: (error) => set({ loadError: error }),
  setMode: (mode) => set({ mode }),
  updateSettings: (settings) =>
    set((state) => ({
      settings: state.settings
        ? { 
            ...state.settings, 
            ...settings,
            // sessionsが空の場合は、午前・午後両方を設定
            sessions: settings.sessions && settings.sessions.length > 0 
              ? settings.sessions 
              : state.settings.sessions && state.settings.sessions.length > 0
              ? state.settings.sessions
              : ['gozen', 'gogo'],
          }
        : ({
            mode: 'learning',
            examNumbers: [],
            questionCount: 50,
            shuffle: true, // デフォルトでシャッフル有効
            ...settings,
            // sessionsが空の場合は、午前・午後両方を設定
            sessions: settings.sessions && settings.sessions.length > 0 
              ? settings.sessions 
              : ['gozen', 'gogo'], // デフォルトで午前・午後両方
          } as SessionSettings),
    })),
  startSession: () => {
    // セッション開始処理（後で実装）
  },
  endSession: () => set({ currentSession: null }),
}));
