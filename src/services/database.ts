import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Question, Supplement, Session, Answer } from '../types';

interface ExamToolDB extends DBSchema {
  questions: {
    key: string;
    value: Question;
    indexes: { 'by-exam': [number, number, string] };
  };
  supplements: {
    key: string;
    value: Supplement;
    indexes: { 'by-exam': [number, number, string] };
  };
  sessions: {
    key: string;
    value: Session;
  };
  answers: {
    key: number;
    value: Answer & { sessionId: string };
    indexes: { 'by-session': string; 'by-question': string };
  };
}

let dbInstance: IDBPDatabase<ExamToolDB> | null = null;

/**
 * データベースを初期化
 */
export async function initializeDatabase(): Promise<IDBPDatabase<ExamToolDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ExamToolDB>('exam-tool-db', 1, {
    upgrade(db) {
      // questions テーブル
      if (!db.objectStoreNames.contains('questions')) {
        const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
        questionStore.createIndex('by-exam', ['year', 'examNumber', 'session']);
      }

      // supplements テーブル
      if (!db.objectStoreNames.contains('supplements')) {
        const supplementStore = db.createObjectStore('supplements', { keyPath: 'id' });
        supplementStore.createIndex('by-exam', ['year', 'examNumber', 'session']);
      }

      // sessions テーブル
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }

      // answers テーブル
      if (!db.objectStoreNames.contains('answers')) {
        const answerStore = db.createObjectStore('answers', {
          keyPath: 'id',
          autoIncrement: true,
        });
        answerStore.createIndex('by-session', 'sessionId');
        answerStore.createIndex('by-question', 'questionId');
      }
    },
  });

  return dbInstance;
}

/**
 * データベースインスタンスを取得
 */
export async function getDatabase(): Promise<IDBPDatabase<ExamToolDB>> {
  if (!dbInstance) {
    return await initializeDatabase();
  }
  return dbInstance;
}

/**
 * 問題を保存
 */
export async function saveQuestion(question: Question): Promise<void> {
  const db = await getDatabase();
  await db.put('questions', question);
}

/**
 * 問題を一括保存
 */
export async function saveQuestions(questions: Question[]): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('questions', 'readwrite');
  await Promise.all(questions.map((q) => tx.store.put(q)));
  await tx.done;
}

/**
 * 別冊を保存
 */
export async function saveSupplement(supplement: Supplement): Promise<void> {
  const db = await getDatabase();
  await db.put('supplements', supplement);
}

/**
 * 別冊を一括保存
 */
export async function saveSupplements(supplements: Supplement[]): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('supplements', 'readwrite');
  await Promise.all(supplements.map((s) => tx.store.put(s)));
  await tx.done;
}

/**
 * セッションを保存
 */
export async function saveSession(session: Session): Promise<void> {
  const db = await getDatabase();
  await db.put('sessions', session);
}

/**
 * 回答を保存
 */
export async function saveAnswer(answer: Answer, sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.add('answers', { ...answer, sessionId });
}

/**
 * 回答を一括保存
 */
export async function saveAnswers(answers: Answer[], sessionId: string): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('answers', 'readwrite');
  await Promise.all(
    answers.map((a) => tx.store.add({ ...a, sessionId }))
  );
  await tx.done;
}

/**
 * 問題を取得
 */
export async function getQuestion(id: string): Promise<Question | undefined> {
  const db = await getDatabase();
  return await db.get('questions', id);
}

/**
 * 条件に一致する問題を取得
 */
export async function getQuestions(
  examNumbers: number[],
  sessions: ('gozen' | 'gogo')[]
): Promise<Question[]> {
  const db = await getDatabase();
  const allQuestions: Question[] = [];

  for (const examNumber of examNumbers) {
    for (const session of sessions) {
      const range = IDBKeyRange.bound([0, examNumber, session], [9999, examNumber, session]);
      const questions = await db.getAllFromIndex('questions', 'by-exam', range);
      allQuestions.push(...questions);
    }
  }

  return allQuestions;
}

/**
 * 別冊を取得
 */
export async function getSupplement(id: string): Promise<Supplement | undefined> {
  const db = await getDatabase();
  return await db.get('supplements', id);
}

/**
 * 条件に一致する別冊を取得
 */
export async function getSupplements(
  examNumbers: number[],
  sessions: ('gozen' | 'gogo')[]
): Promise<Supplement[]> {
  const db = await getDatabase();
  const allSupplements: Supplement[] = [];

  for (const examNumber of examNumbers) {
    for (const session of sessions) {
      const range = IDBKeyRange.bound([0, examNumber, session], [9999, examNumber, session]);
      const supplements = await db.getAllFromIndex('supplements', 'by-exam', range);
      allSupplements.push(...supplements);
    }
  }

  return allSupplements;
}

/**
 * 画像番号で別冊を取得
 */
export async function getSupplementByImageNumber(
  examNumber: number,
  session: 'gozen' | 'gogo',
  imageNumber: string
): Promise<Supplement | undefined> {
  const supplements = await getSupplements([examNumber], [session]);
  return supplements.find(s => s.imageNumber === imageNumber);
}
