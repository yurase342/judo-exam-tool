/**
 * JSONベースの問題データ型定義
 * スキャン画像PDFからテキスト抽出ができない場合に使用
 */

import { SessionType } from './index';

/**
 * JSON問題ファイルの形式
 */
export interface QuestionDataFile {
  examNumber: number;
  year: number;
  session: SessionType;
  totalQuestions: number;
  questions: QuestionDataItem[];
}

/**
 * 個別の問題データ
 */
export interface QuestionDataItem {
  questionNumber: number;
  questionText: string;
  choices: {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string; // 選択肢eはオプショナル（4択の場合は不要）
  };
  // 別冊参照（該当する場合）
  bessatsuPage?: number; // 別冊PDFのページ番号（1-indexed）
  bessatsuLabel?: string; // 「別冊No.1」など
}

/**
 * 別冊マッピング情報
 */
export interface BessatsuMapping {
  examNumber: number;
  session: SessionType;
  // 問題番号 -> 別冊ページ番号のマッピング
  questionToPage: Record<number, number[]>;
}

/**
 * 問題データJSONファイルのパス取得
 */
export function getQuestionDataPath(examNumber: number, session: SessionType): string {
  return `/data/questions/${examNumber}_${session}.json`;
}

/**
 * 別冊マッピングJSONファイルのパス取得
 */
export function getBessatsuMappingPath(examNumber: number, session: SessionType): string {
  return `/data/bessatsu/${examNumber}_${session}_bessatsu.json`;
}
