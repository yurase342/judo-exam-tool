import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

// データベースファイルのパス
const getDbPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'exam-tool.db');
};

// データベース初期化
export function initializeDatabase(): Database.Database {
  const dbPath = getDbPath();
  const db = new Database(dbPath);

  // 問題テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      exam_number INTEGER NOT NULL,
      session TEXT NOT NULL CHECK(session IN ('gozen', 'gogo')),
      question_number INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      choices TEXT NOT NULL, -- JSON配列
      correct_answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      source_file TEXT NOT NULL,
      has_supplement_image INTEGER NOT NULL DEFAULT 0,
      supplement_references TEXT, -- JSON配列
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, exam_number, session, question_number)
    )
  `);

  // 別冊テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplements (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      exam_number INTEGER NOT NULL,
      session TEXT NOT NULL CHECK(session IN ('gozen', 'gogo')),
      image_number TEXT NOT NULL,
      image_data TEXT NOT NULL, -- Base64 or ファイルパス
      image_type TEXT NOT NULL,
      caption TEXT,
      related_images TEXT, -- JSON配列
      source_file TEXT NOT NULL,
      source_page INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, exam_number, session, image_number)
    )
  `);

  // セッションテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK(mode IN ('learning', 'test')),
      started_at DATETIME NOT NULL,
      finished_at DATETIME,
      settings TEXT NOT NULL, -- JSON
      summary TEXT NOT NULL, -- JSON
      time_limit INTEGER,
      remaining_time INTEGER,
      is_time_up INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 回答テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      selected_answer TEXT,
      is_correct INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('answered', 'skipped', 'timeout')),
      time_spent INTEGER NOT NULL DEFAULT 0,
      answered_at DATETIME,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )
  `);

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(year, exam_number, session);
    CREATE INDEX IF NOT EXISTS idx_supplements_exam ON supplements(year, exam_number, session);
    CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
    CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
  `);

  return db;
}

// データベースインスタンス（シングルトン）
let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = initializeDatabase();
  }
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
