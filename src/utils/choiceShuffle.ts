/**
 * 選択肢シャッフルユーティリティ
 * 問題の選択肢の順番をランダムに並び替え、正解も更新する
 */

import { Question, Choice } from '../types';

/**
 * 配列をシャッフルする（Fisher-Yates アルゴリズム）
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 選択肢をシャッフルして、正解も更新する
 * @param question 元の問題
 * @returns 選択肢がシャッフルされた新しい問題オブジェクト
 */
export function shuffleChoices(question: Question): Question {
  // 元の選択肢をコピー
  const originalChoices = [...question.choices];

  // 選択肢をシャッフル
  const shuffledChoices = shuffleArray(originalChoices);

  // 新しいラベル（a, b, c, d, e...）を割り当て
  const newLabels = ['a', 'b', 'c', 'd', 'e'];

  // 元のラベル → 新しいラベルのマッピングを作成
  const labelMapping: Record<string, string> = {};

  const newChoices: Choice[] = shuffledChoices.map((choice, index) => {
    const newLabel = newLabels[index];
    labelMapping[choice.label.toLowerCase()] = newLabel;
    return {
      label: newLabel,
      text: choice.text,
    };
  });

  // 正解を新しいラベルに変換
  const newCorrectAnswer = labelMapping[question.correctAnswer?.toLowerCase()] || question.correctAnswer;

  // 複数正答の場合も変換
  let newCorrectAnswers: string[] | undefined;
  if (question.correctAnswers && question.correctAnswers.length > 0) {
    newCorrectAnswers = question.correctAnswers.map(
      answer => labelMapping[answer.toLowerCase()] || answer
    );
  }

  // 新しい問題オブジェクトを返す（元の問題は変更しない）
  return {
    ...question,
    choices: newChoices,
    correctAnswer: newCorrectAnswer,
    correctAnswers: newCorrectAnswers,
  };
}

/**
 * 問題配列の全ての選択肢をシャッフルする
 * @param questions 問題の配列
 * @returns 選択肢がシャッフルされた問題の配列
 */
export function shuffleAllChoices(questions: Question[]): Question[] {
  return questions.map(q => shuffleChoices(q));
}
