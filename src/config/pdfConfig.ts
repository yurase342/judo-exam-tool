/**
 * PDFファイル管理設定
 * 問題PDF、正答PDF、別冊PDFの対応関係を一元管理
 */

import { SessionType } from '../types';

/**
 * 試験回次の設定
 */
export interface ExamConfig {
  examNumber: number;        // 回次（29, 30, 31, ...）
  year: number;              // 年度（2021, 2022, ...）
  hasAnswerPdf: boolean;     // 正答PDFがあるか
  sessions: {
    gozen: SessionPdfConfig;
    gogo: SessionPdfConfig;
  };
}

/**
 * セッション（午前/午後）ごとのPDF設定
 */
export interface SessionPdfConfig {
  questionPdf: string;       // 問題PDFファイル名
  bessatsuPdf: string | null; // 別冊PDFファイル名（なければnull）
  questionCount: number;     // 問題数（午前/午後それぞれ）
}

/**
 * 全試験回次の設定
 */
export const EXAM_CONFIGS: ExamConfig[] = [
  {
    examNumber: 29,
    year: 2021,
    hasAnswerPdf: true,
    sessions: {
      gozen: {
        questionPdf: '2021_29_gozen.pdf',
        bessatsuPdf: '2021_29_gozen_bessatsu.pdf',
        questionCount: 115,  // 柔道整復学理論の午前問題数
      },
      gogo: {
        questionPdf: '2021_29_gogo.pdf',
        bessatsuPdf: '2021_29_gogo_bessatsu.pdf',
        questionCount: 115,
      },
    },
  },
  {
    examNumber: 30,
    year: 2022,
    hasAnswerPdf: true,
    sessions: {
      gozen: {
        questionPdf: '2022_30_gozen.pdf',
        bessatsuPdf: '2022_30_gozen_bessatsu.pdf',
        questionCount: 115,
      },
      gogo: {
        questionPdf: '2022_30_gogo.pdf',
        bessatsuPdf: '2022_30_gogo_bessatsu.pdf',
        questionCount: 115,
      },
    },
  },
  {
    examNumber: 31,
    year: 2023,
    hasAnswerPdf: true,
    sessions: {
      gozen: {
        questionPdf: '2023_31_gozen.pdf',
        bessatsuPdf: '2023_31_gozen_bessatsu.pdf',
        questionCount: 115,
      },
      gogo: {
        questionPdf: '2023_31_gogo.pdf',
        bessatsuPdf: '2023_31_gogo_bessatsu.pdf',
        questionCount: 115,
      },
    },
  },
  {
    examNumber: 32,
    year: 2024,
    hasAnswerPdf: true,
    sessions: {
      gozen: {
        questionPdf: '2024_32_gozen.pdf',
        bessatsuPdf: '2024_32_gozen_bessatsu.pdf',
        questionCount: 115,
      },
      gogo: {
        questionPdf: '2024_32_gogo.pdf',
        bessatsuPdf: '2024_32_gogo_bessatsu.pdf',
        questionCount: 115,
      },
    },
  },
  {
    examNumber: 33,
    year: 2025,
    hasAnswerPdf: true,
    sessions: {
      gozen: {
        questionPdf: '2025_33_gozen.pdf',
        bessatsuPdf: '2025_33_gozen_bessatsu.pdf',
        questionCount: 115,
      },
      gogo: {
        questionPdf: '2025_33_gogo.pdf',
        bessatsuPdf: '2025_33_gozen_bessatsu.pdf', // 午前と同じ別冊PDFを使用
        questionCount: 115,
      },
    },
  },
];

/**
 * 正答PDFのファイル名マッピング
 */
export const ANSWER_PDF_MAP: Record<number, string> = {
  29: '29_seitou.pdf',
  30: '30_seitou.pdf',
  31: '31_seitou.pdf',
  32: '32_seitou.pdf',
  33: '33_seitou.pdf',
};

/**
 * PDFファイルのベースパス
 */
export const PDF_BASE_PATHS = {
  questions: '/pdfs/',      // 問題PDF
  answers: '/answers/',     // 正答PDF
  bessatsuImages: '/data/bessatsu/',  // 別冊画像（WebP）
  questionImages: '/data/question-images/',  // 問題内図画像（WebP）
};

/**
 * 利用可能な回次を取得（全ての回次を返す）
 * 注意: 正答PDFがない回次もJSONファイルがあれば使用可能
 */
export function getAvailableExamNumbers(): number[] {
  return EXAM_CONFIGS.map(config => config.examNumber);
}

/**
 * 全回次番号を取得
 */
export function getAllExamNumbers(): number[] {
  return EXAM_CONFIGS.map(config => config.examNumber);
}

/**
 * 特定の回次の設定を取得
 */
export function getExamConfig(examNumber: number): ExamConfig | undefined {
  return EXAM_CONFIGS.find(config => config.examNumber === examNumber);
}

/**
 * 問題PDFのパスを取得
 */
export function getQuestionPdfPath(examNumber: number, session: SessionType): string | null {
  const config = getExamConfig(examNumber);
  if (!config) return null;

  const sessionConfig = config.sessions[session];
  return `${PDF_BASE_PATHS.questions}${sessionConfig.questionPdf}`;
}

/**
 * 別冊PDFのパスを取得
 */
export function getBessatsuPdfPath(examNumber: number, session: SessionType): string | null {
  const config = getExamConfig(examNumber);
  if (!config) return null;

  const sessionConfig = config.sessions[session];
  if (!sessionConfig.bessatsuPdf) return null;

  return `${PDF_BASE_PATHS.questions}${sessionConfig.bessatsuPdf}`;
}

/**
 * 別冊画像（WebP）のパスを取得
 * @param examNumber 回次
 * @param session セッション（午前/午後）
 * @param pageNumber ページ番号（1-indexed）
 * @returns WebP画像のパス
 */
export function getBessatsuImagePath(examNumber: number, session: SessionType, pageNumber: number): string {
  // フォーマット: /data/bessatsu/{examNumber}/{session}/{pageNumber}.webp
  return `${PDF_BASE_PATHS.bessatsuImages}${examNumber}/${session}/${pageNumber}.webp`;
}

/**
 * 別冊画像のディレクトリパスを取得
 * @param examNumber 回次
 * @param session セッション（午前/午後）
 * @returns ディレクトリパス
 */
export function getBessatsuImageDir(examNumber: number, session: SessionType): string {
  return `${PDF_BASE_PATHS.bessatsuImages}${examNumber}/${session}/`;
}

/**
 * 問題内図画像（WebP）のパスを取得
 * @param examNumber 回次
 * @param session セッション（午前/午後）
 * @param questionNumber 問題番号
 * @returns WebP画像のパス
 */
export function getQuestionImagePath(examNumber: number, session: SessionType, questionNumber: number): string {
  // フォーマット: /data/question-images/{examNumber}/{session}/q{questionNumber}.webp
  return `${PDF_BASE_PATHS.questionImages}${examNumber}/${session}/q${questionNumber}.webp`;
}

/**
 * 問題内図画像が存在するかどうかを確認するためのマッピング
 * 図を含む問題の一覧
 */
export const QUESTIONS_WITH_FIGURES: Record<string, number[]> = {
  '29_gozen': [85],
  '29_gogo': [82, 108, 109],
  '30_gozen': [102],
  '30_gogo': [86],
  '31_gozen': [55, 57, 75],
  '31_gogo': [106, 117],
  '32_gozen': [64],
  '32_gogo': [27, 119],
  '33_gozen': [114],
  '33_gogo': [87],
};

/**
 * 問題に図が含まれているかどうかを確認
 * @param examNumber 回次
 * @param session セッション（午前/午後）
 * @param questionNumber 問題番号
 * @returns 図が含まれていればtrue
 */
export function hasQuestionImage(examNumber: number, session: SessionType, questionNumber: number): boolean {
  const key = `${examNumber}_${session}`;
  const questionsWithFigures = QUESTIONS_WITH_FIGURES[key];
  return questionsWithFigures?.includes(questionNumber) ?? false;
}

/**
 * 正答PDFのパスを取得
 */
export function getAnswerPdfPath(examNumber: number): string | null {
  const filename = ANSWER_PDF_MAP[examNumber];
  if (!filename) return null;

  return `${PDF_BASE_PATHS.answers}${filename}`;
}

/**
 * 回次が利用可能かどうか（正答PDFがあるか）
 */
export function isExamAvailable(examNumber: number): boolean {
  const config = getExamConfig(examNumber);
  return config?.hasAnswerPdf ?? false;
}

/**
 * 全PDFファイル名のリストを取得（pdfLoader用）
 */
export function getAllPdfFilenames(): string[] {
  const filenames: string[] = [];

  for (const config of EXAM_CONFIGS) {
    // 午前
    filenames.push(config.sessions.gozen.questionPdf);
    if (config.sessions.gozen.bessatsuPdf) {
      filenames.push(config.sessions.gozen.bessatsuPdf);
    }
    // 午後
    filenames.push(config.sessions.gogo.questionPdf);
    if (config.sessions.gogo.bessatsuPdf) {
      filenames.push(config.sessions.gogo.bessatsuPdf);
    }
  }

  return filenames;
}
