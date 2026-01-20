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
