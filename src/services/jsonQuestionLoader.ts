/**
 * JSONベースの問題データローダー
 * スキャン画像PDFの代わりにJSONファイルから問題を読み込む
 */

import { Question, Choice, SessionType, CategoryId } from '../types';
import { QuestionDataFile, QuestionDataItem, getQuestionDataPath } from '../types/questionData';
import { getAnswerPdfPath } from '../config/pdfConfig';
import { parseAnswerText } from './answerParser';
import { getCategoryByQuestionNumber } from '../config/categoryConfig';

/**
 * JSONファイルから問題データを読み込む
 */
export async function loadQuestionsFromJson(
  examNumber: number,
  session: SessionType
): Promise<Question[]> {
  const jsonPath = getQuestionDataPath(examNumber, session);

  console.log(`[jsonQuestionLoader] JSONから問題を読み込み: ${jsonPath}`);

  try {
    const response = await fetch(jsonPath);
    if (!response.ok) {
      console.warn(`[jsonQuestionLoader] JSONファイルが見つかりません: ${jsonPath}`);
      return [];
    }

    const data: QuestionDataFile = await response.json();

    // 正答データを読み込む
    const correctAnswers = await loadCorrectAnswers(examNumber, session);

    // 問題データを変換
    const questions = data.questions.map(item =>
      convertToQuestion(item, data.examNumber, data.year, data.session, correctAnswers)
    );

    console.log(`[jsonQuestionLoader] ${questions.length}問を読み込み完了`);
    return questions;
  } catch (error) {
    console.error(`[jsonQuestionLoader] 読み込みエラー:`, error);
    return [];
  }
}

/**
 * 正答PDFから正答を読み込む
 */
async function loadCorrectAnswers(
  examNumber: number,
  session: SessionType
): Promise<Map<number, string[]>> {
  const answerMap = new Map<number, string[]>();

  const answerPdfPath = getAnswerPdfPath(examNumber);
  if (!answerPdfPath) {
    console.warn(`[jsonQuestionLoader] 正答PDFがありません: 第${examNumber}回`);
    return answerMap;
  }

  try {
    // PDFからテキスト抽出
    const response = await fetch(answerPdfPath);
    if (!response.ok) {
      console.warn(`[jsonQuestionLoader] 正答PDFが見つかりません（404）: ${answerPdfPath}`);
      return answerMap; // 正答PDFがなくても問題は返す
    }

    const blob = await response.blob();
    const text = await extractTextFromPDF(blob);

    // 正答を解析
    const answers = parseAnswerText(text, examNumber);

    // セッションの正答のみをマップに追加
    for (const answer of answers) {
      if (answer.session === session) {
        answerMap.set(answer.questionNumber, answer.correctAnswers);
      }
    }

    console.log(`[jsonQuestionLoader] ${answerMap.size}問の正答を読み込み`);
  } catch (error) {
    console.error(`[jsonQuestionLoader] 正答読み込みエラー:`, error);
  }

  return answerMap;
}

/**
 * PDFからテキストを抽出
 */
async function extractTextFromPDF(blob: Blob): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

  const arrayBuffer = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    interface TextItem {
      str: string;
      transform: number[];
    }

    const items = textContent.items as TextItem[];
    const sortedItems = items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    fullText += sortedItems.map(item => item.str).join(' ') + '\n';
  }

  return fullText;
}

/**
 * QuestionDataItemをQuestion型に変換
 */
function convertToQuestion(
  item: QuestionDataItem,
  examNumber: number,
  year: number,
  session: SessionType,
  correctAnswers: Map<number, string[]>
): Question {
  const id = `${examNumber}-${session}-${item.questionNumber}`;

  // 選択肢を構築（存在する選択肢のみ追加）
  const choices: Choice[] = [
    { label: 'a', text: item.choices.a?.trim() || '' },
    { label: 'b', text: item.choices.b?.trim() || '' },
    { label: 'c', text: item.choices.c?.trim() || '' },
    { label: 'd', text: item.choices.d?.trim() || '' },
  ];

  // 選択肢eがある場合のみ追加
  if (item.choices.e && item.choices.e.trim()) {
    choices.push({ label: 'e', text: item.choices.e.trim() });
  }

  // 空の選択肢を除外
  const filteredChoices = choices.filter(c => c.text !== '');

  const correctAnswerList = correctAnswers.get(item.questionNumber) || [];

  // カテゴリを取得（JSONに含まれている場合はそれを使用、なければ問題番号から判定）
  const category: CategoryId = (item as any).category || getCategoryByQuestionNumber(item.questionNumber, session);

  return {
    id,
    year,
    examNumber,
    session,
    questionNumber: item.questionNumber,
    questionText: item.questionText.trim(),
    choices: filteredChoices,
    correctAnswer: correctAnswerList[0] || '',
    correctAnswers: correctAnswerList.length > 1 ? correctAnswerList : undefined,
    explanation: '',
    sourceFile: `${examNumber}_${session}.json`,
    hasSupplementImage: !!item.bessatsuPage,
    supplementReferences: item.bessatsuPage ? [{
      referenceText: item.bessatsuLabel || `別冊 ページ${item.bessatsuPage}`,
      supplementId: `${examNumber}-${session}-bessatsu-${item.bessatsuPage}`,
      imageNumber: String(item.bessatsuPage)
    }] : [],
    isImageBased: false,
    category,
  };
}

/**
 * カテゴリでフィルタリングした問題を取得
 */
export async function loadQuestionsWithFilters(
  examNumbers: number[],
  sessions: SessionType[],
  categories?: CategoryId[]
): Promise<Question[]> {
  const allQuestions: Question[] = [];

  // 指定された回次・セッションの問題を読み込む
  for (const examNumber of examNumbers) {
    for (const session of sessions) {
      const questions = await loadQuestionsFromJson(examNumber, session);
      allQuestions.push(...questions);
    }
  }

  // カテゴリフィルタが指定されていない場合は全問題を返す
  if (!categories || categories.length === 0) {
    return allQuestions;
  }

  // カテゴリでフィルタリング
  const filtered = allQuestions.filter(q => q.category && categories.includes(q.category));

  console.log(`[jsonQuestionLoader] フィルタリング: ${allQuestions.length}問 → ${filtered.length}問 (カテゴリ: ${categories.join(', ')})`);

  return filtered;
}

/**
 * 利用可能なJSONデータファイルをチェック
 */
export async function checkAvailableJsonData(): Promise<{
  examNumber: number;
  session: SessionType;
  available: boolean;
}[]> {
  const checks: { examNumber: number; session: SessionType; available: boolean }[] = [];

  const examNumbers = [29, 30, 31, 32, 33];
  const sessions: SessionType[] = ['gozen', 'gogo'];

  for (const examNumber of examNumbers) {
    for (const session of sessions) {
      const path = getQuestionDataPath(examNumber, session);
      try {
        const response = await fetch(path, { method: 'HEAD' });
        checks.push({ examNumber, session, available: response.ok });
      } catch {
        checks.push({ examNumber, session, available: false });
      }
    }
  }

  return checks;
}
