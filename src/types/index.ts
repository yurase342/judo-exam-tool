// セッションタイプ
export type SessionType = 'gozen' | 'gogo';
export type QuestionType = 'question' | 'supplement';
export type Mode = 'learning' | 'test' | 'exam'; // exam = 本番モード
export type AnswerStatus = 'answered' | 'skipped' | 'timeout' | 'quit'; // quit = 途中終了

// 科目（カテゴリ）タイプ
export type CategoryId =
  | 'anatomy'           // 解剖学
  | 'physiology'        // 生理学
  | 'kinesiology'       // 運動学
  | 'pathology'         // 病理学概論
  | 'hygiene'           // 衛生学・公衆衛生学
  | 'clinical_general'  // 一般臨床医学
  | 'surgery'           // 外科学概論
  | 'orthopedics'       // 整形外科学
  | 'rehabilitation'    // リハビリテーション医学
  | 'judo_therapy'      // 柔道整復理論
  | 'law';              // 関係法規

// ファイル名解析結果
export interface FileMetadata {
  year: number;
  examNumber: number;
  session: SessionType;
  type: QuestionType;
  filename: string;
  fullPath: string;
}

// 選択肢
export interface Choice {
  label: string; // a, b, c, d, e
  text: string;
}

// 別冊参照情報
export interface SupplementReference {
  referenceText: string; // "別冊No.12A"
  supplementId: string; // "29-gogo-12A"
  imageNumber: string; // "12A"
}

// 問題データ
export interface Question {
  id: string; // "29-gozen-15"
  year: number;
  examNumber: number;
  session: SessionType;
  questionNumber: number;
  questionText: string;
  choices: Choice[];
  correctAnswer: string; // "a", "b", "c", "d", "e"
  correctAnswers?: string[]; // 複数正答対応（例：["a", "b"]）
  explanation: string;
  sourceFile: string;
  hasSupplementImage: boolean;
  supplementReferences: SupplementReference[];
  category?: CategoryId; // 科目（カテゴリ）
  // PDF画像表示用（スキャン画像PDF対応）
  pdfPath?: string; // PDFファイルへのパス
  pdfPage?: number; // 問題が含まれるページ番号
  isImageBased?: boolean; // スキャン画像ベースの問題かどうか
  questionPageImage?: string; // Base64エンコードされた問題ページ画像
  questionPageNumber?: number; // 問題があるページ番号（1-indexed）
}

// 別冊データ
export interface Supplement {
  id: string; // "29-gogo-12A"
  year: number;
  examNumber: number;
  session: SessionType;
  imageNumber: string; // "12A", "図B", "No.1"
  imageData: string; // Base64エンコード画像 or ファイルパス
  imageType: 'ct' | 'xray' | 'photo' | 'ecg' | 'graph' | 'table' | 'other';
  caption: string;
  relatedImages: string[]; // 関連画像ID（A, B, Cなど）
  sourceFile: string;
  sourcePage: number;
  questionNumbers?: number[]; // この別冊画像が対応する問題番号（画像の右上に記載されている場合）
}

// 回答データ
export interface Answer {
  questionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
  status: AnswerStatus;
  timeSpent: number; // 秒
  answeredAt: Date | null;
  usedHint?: boolean; // ヒントを確認したかどうか
}

// セッション設定
export interface SessionSettings {
  mode: Mode;
  examNumbers: number[];
  sessions: SessionType[];
  categories?: CategoryId[]; // 科目フィルター（空の場合は全科目）
  questionCount: number;
  shuffle: boolean; // 問題の出題順をシャッフル
  shuffleChoices?: boolean; // 選択肢の順番をシャッフル（デフォルト: true）
  timeLimit?: number; // テストモード・本番モード専用（秒）
  prioritizeBessatsu?: boolean; // 別冊参照がある問題を優先的に出題
  isExamMode?: boolean; // 本番モードかどうか
  quitAtQuestion?: number; // 途中終了した問題番号（1-indexed）
}

// セッションサマリー
export interface SessionSummary {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  timeoutCount: number;
  answeredCount: number;
  accuracy: number; // 正答率（%）
  totalTime: number; // 総回答時間（秒）
  averageTime: number; // 平均回答時間（秒）
  remainingTime?: number; // テストモード専用（秒）
  isTimeUp?: boolean; // テストモード専用
}

// セッションデータ
export interface Session {
  id: string;
  mode: Mode;
  startedAt: Date;
  finishedAt: Date | null;
  settings: SessionSettings;
  answers: Answer[];
  summary: SessionSummary;
  timeLimit?: number;
  remainingTime?: number;
  isTimeUp?: boolean;
}

// ヒントデータ
export interface QuestionHint {
  questionId: string;
  keywords: string[];
  hints: string[];
}
