import { Answer, SessionSummary, SessionSettings } from '../types';

/**
 * 回答結果からサマリーを計算
 */
export function calculateSummary(
  answers: Answer[],
  totalQuestions: number,
  settings: SessionSettings
): SessionSummary {
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const incorrectCount = answers.filter(
    (a) => a.status === 'answered' && !a.isCorrect
  ).length;
  const skippedCount = answers.filter((a) => a.status === 'skipped').length;
  const timeoutCount = answers.filter((a) => a.status === 'timeout').length;
  const answeredCount = totalQuestions - skippedCount - timeoutCount;

  const accuracy =
    answeredCount > 0 ? (correctCount / answeredCount) * 100 : 0;

  const totalTime = answers.reduce((sum, a) => sum + a.timeSpent, 0);
  const averageTime =
    answeredCount > 0 ? totalTime / answeredCount : 0;

  const summary: SessionSummary = {
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount,
    timeoutCount,
    answeredCount,
    accuracy,
    totalTime,
    averageTime,
  };

  // テストモード専用
  if (settings.mode === 'test') {
    summary.remainingTime = settings.timeLimit
      ? settings.timeLimit - totalTime
      : undefined;
    summary.isTimeUp = timeoutCount > 0;
  }

  return summary;
}
