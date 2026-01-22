import { FC, useMemo } from 'react';
import { Answer, Question, SessionSummary, Mode, CategoryId } from '../types';
import { CATEGORIES } from '../config/categoryConfig';

interface ResultViewProps {
  answers: Answer[];
  questions: Question[];
  summary: SessionSummary;
  mode: Mode;
  onBack: () => void;
  onExportPDF?: () => void;
  quitAtQuestion?: number; // 途中終了した問題番号（1-indexed）
}

const ResultView: FC<ResultViewProps> = ({
  answers,
  questions,
  summary,
  mode,
  onBack,
  quitAtQuestion,
}) => {
  const handleExportPDF = () => {
    // ブラウザの印刷機能を使用してPDFとして保存
    window.print();
  };

  // 時間フォーマット
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  // 現在の日時をフォーマット
  const currentDateTime = useMemo(() => {
    return new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // 試験情報を取得（最初の問題から）
  const examInfo = useMemo(() => {
    if (questions.length === 0) return null;
    const examNumbers = [...new Set(questions.map(q => q.examNumber))].sort();
    const sessions = [...new Set(questions.map(q => q.session))];

    if (examNumbers.length === 1 && sessions.length === 1) {
      return `第${examNumbers[0]}回 ${sessions[0] === 'gozen' ? '午前' : '午後'}`;
    } else if (examNumbers.length === 1) {
      return `第${examNumbers[0]}回`;
    } else {
      return `第${examNumbers[0]}回〜第${examNumbers[examNumbers.length - 1]}回`;
    }
  }, [questions]);

  // 問題と回答をマージ
  const questionAnswers = useMemo(() => {
    return questions.map((q, index) => {
      const answer = answers[index];
      return {
        question: q,
        answer: answer || {
          questionId: q.id,
          selectedAnswer: null,
          isCorrect: false,
          status: 'timeout' as const,
          timeSpent: 0,
          answeredAt: null,
        },
      };
    });
  }, [questions, answers]);

  // ヒント使用統計を計算
  const hintStats = useMemo(() => {
    const hintUsedCount = answers.filter(a => a.usedHint === true).length;
    const hintNotUsedCount = answers.filter(a => a.usedHint === false).length;
    // usedHintが記録されている回答のみカウント（学習モードのみ）
    const totalTracked = hintUsedCount + hintNotUsedCount;
    return {
      used: hintUsedCount,
      notUsed: hintNotUsedCount,
      total: totalTracked,
      isTracked: totalTracked > 0,
    };
  }, [answers]);

  // 科目別成績を計算
  const categoryStats = useMemo(() => {
    const stats: Record<CategoryId, { total: number; correct: number; categoryName: string }> = {} as any;

    questionAnswers.forEach(({ question, answer }) => {
      const category = question.category;
      if (!category) return;

      if (!stats[category]) {
        stats[category] = {
          total: 0,
          correct: 0,
          categoryName: CATEGORIES[category]?.name || category,
        };
      }

      stats[category].total++;
      if (answer.isCorrect) {
        stats[category].correct++;
      }
    });

    // 出題数が多い順にソートして配列に変換
    return Object.entries(stats)
      .map(([categoryId, data]) => ({
        categoryId: categoryId as CategoryId,
        ...data,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [questionAnswers]);

  // 選択肢のテキストを取得するヘルパー関数
  const getChoiceText = (question: Question, choiceLabel: string | null): string => {
    if (!choiceLabel) return '未回答';
    const choice = question.choices.find(c => c.label.toLowerCase() === choiceLabel.toLowerCase());
    return choice ? choice.text : choiceLabel;
  };

  // 正解の選択肢ラベルを取得（複数正答対応）
  const getCorrectAnswerLabels = (question: Question): string => {
    if (question.correctAnswers && question.correctAnswers.length > 1) {
      return question.correctAnswers.map(a => a.toUpperCase()).join(', ');
    }
    return question.correctAnswer?.toUpperCase() || '不明';
  };

  // 正解の選択肢テキストを取得（複数正答対応）
  const getCorrectAnswerTexts = (question: Question): string[] => {
    const correctLabels = question.correctAnswers || [question.correctAnswer];
    return correctLabels
      .filter(label => label)
      .map(label => {
        const choice = question.choices.find(c => c.label.toLowerCase() === label.toLowerCase());
        return choice ? `${label.toUpperCase()}. ${choice.text}` : label.toUpperCase();
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8 print:bg-white print:p-4">
      <div className="max-w-4xl mx-auto print:max-w-full">

        {/* ヘッダー */}
        <div className="text-center mb-6 print:mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 print:text-xl">
            {mode === 'exam' ? '本番モード結果レポート' : mode === 'learning' ? '学習結果レポート' : '小テスト結果レポート'}
          </h1>
          {examInfo && (
            <p className="text-lg text-gray-700 font-medium print:text-base">
              {examInfo}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {currentDateTime}
          </p>
        </div>

        {/* 途中終了メッセージ */}
        {quitAtQuestion && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-6 print:bg-white print:border-yellow-400">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-yellow-800">途中で終了しました</p>
                <p className="text-sm text-yellow-700">
                  問題{quitAtQuestion}で終了しました。{quitAtQuestion - 1}問回答済み、{summary.totalQuestions - quitAtQuestion + 1}問未回答
                </p>
              </div>
            </div>
          </div>
        )}

        {/* スコアサマリー */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 print:shadow-none print:border-2 print:border-gray-400 print:mb-4 print:p-4">
          <h2 className="text-xl font-bold mb-4 text-center print:text-lg print:mb-3 border-b-2 border-gray-200 pb-2">
            成績サマリー
          </h2>

          <div className={`grid grid-cols-2 ${summary.skippedCount > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-4 text-center`}>
            <div className="bg-gray-50 rounded-lg p-3 print:bg-white print:border print:border-gray-300">
              <p className="text-sm text-gray-600 mb-1">総問題数</p>
              <p className="text-2xl font-bold print:text-xl">{summary.totalQuestions}問</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 print:bg-white print:border print:border-green-400">
              <p className="text-sm text-green-700 mb-1">正答数</p>
              <p className="text-2xl font-bold text-green-600 print:text-xl">{summary.correctCount}問</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 print:bg-white print:border print:border-red-400">
              <p className="text-sm text-red-700 mb-1">誤答数</p>
              <p className="text-2xl font-bold text-red-600 print:text-xl">{summary.incorrectCount}問</p>
            </div>
            {summary.skippedCount > 0 && (
              <div className="bg-gray-100 rounded-lg p-3 print:bg-white print:border print:border-gray-400">
                <p className="text-sm text-gray-600 mb-1">スキップ</p>
                <p className="text-2xl font-bold text-gray-600 print:text-xl">{summary.skippedCount}問</p>
              </div>
            )}
            <div className="bg-blue-50 rounded-lg p-3 print:bg-white print:border print:border-blue-400">
              <p className="text-sm text-blue-700 mb-1">正答率</p>
              <p className="text-2xl font-bold text-blue-600 print:text-xl">{summary.accuracy.toFixed(1)}%</p>
            </div>
          </div>

          {/* 追加情報 */}
          <div className="mt-4 pt-3 border-t border-gray-200 text-sm text-gray-600">
            <div className="flex flex-wrap justify-center gap-4">
              {mode === 'learning' && (
                <>
                  <span>総回答時間: {formatTime(summary.totalTime)}</span>
                  <span>平均: {(summary.averageTime).toFixed(1)}秒/問</span>
                  {hintStats.isTracked && (
                    <span className="text-yellow-600">💡 ヒント使用: {hintStats.used}問</span>
                  )}
                </>
              )}
              {(mode === 'test' || mode === 'exam') && (
                <>
                  {summary.timeoutCount > 0 && (
                    <span>時間切れ: {summary.timeoutCount}問</span>
                  )}
                  {summary.remainingTime !== undefined && !summary.isTimeUp && (
                    <span>残り時間: {formatTime(summary.remainingTime)}</span>
                  )}
                  {summary.isTimeUp && (
                    <span className="text-red-600">⏱ 時間切れ</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 科目別成績 */}
          {categoryStats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-base font-semibold mb-3 text-center print:text-sm">
                📊 科目別成績
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 print:grid-cols-3">
                {categoryStats.map((stat) => {
                  // 正答率に応じた背景色
                  let bgColorClass = 'bg-gray-50';
                  let textColorClass = 'text-gray-700';
                  if (stat.accuracy >= 80) {
                    bgColorClass = 'bg-green-50';
                    textColorClass = 'text-green-700';
                  } else if (stat.accuracy >= 60) {
                    bgColorClass = 'bg-yellow-50';
                    textColorClass = 'text-yellow-700';
                  } else if (stat.accuracy < 60 && stat.total > 0) {
                    bgColorClass = 'bg-red-50';
                    textColorClass = 'text-red-700';
                  }

                  return (
                    <div
                      key={stat.categoryId}
                      className={`${bgColorClass} rounded-lg p-2 border print:bg-white print:border-gray-300`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">
                          {stat.categoryName}
                        </span>
                        <span className={`text-sm font-bold ${textColorClass}`}>
                          {stat.accuracy.toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stat.correct}/{stat.total}問正解
                      </div>
                      {/* 進捗バー */}
                      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            stat.accuracy >= 80
                              ? 'bg-green-500'
                              : stat.accuracy >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${stat.accuracy}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 全問題の詳細結果 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 print:shadow-none print:p-0 print:bg-transparent">
          <h2 className="text-xl font-bold mb-4 print:text-lg print:mb-3 border-b-2 border-gray-200 pb-2">
            問題別詳細
          </h2>

          <div className="space-y-6 print:space-y-4">
            {questionAnswers.map((qa, index) => {
              const { question, answer } = qa;
              const isCorrect = answer.isCorrect;
              const isSkipped = answer.status === 'skipped';
              const isTimeout = answer.status === 'timeout';
              const isQuit = answer.status === 'quit';
              const selectedLabel = answer.selectedAnswer?.toUpperCase() || null;
              const selectedText = getChoiceText(question, answer.selectedAnswer);
              const correctLabels = getCorrectAnswerLabels(question);
              const correctTexts = getCorrectAnswerTexts(question);

              return (
                <div
                  key={question.id}
                  className={`border-2 rounded-lg p-4 print:p-3 print:break-inside-avoid ${
                    isCorrect
                      ? 'border-green-300 bg-green-50 print:bg-white'
                      : isQuit
                      ? 'border-gray-300 bg-gray-50 print:bg-white'
                      : 'border-red-300 bg-red-50 print:bg-white'
                  }`}
                >
                  {/* 問題ヘッダー */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-300">
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {isCorrect ? '○' : '×'}
                      </span>
                      <div>
                        <h3 className="font-bold text-lg print:text-base">
                          問題 {index + 1}
                        </h3>
                        <p className="text-sm text-gray-600">
                          第{question.examNumber}回 {question.session === 'gozen' ? '午前' : '午後'} 問{question.questionNumber}
                          {(answer.timeSpent > 0 || isSkipped) && (
                            <span className="ml-2 text-blue-600">
                              ⏱ {answer.timeSpent}秒{isSkipped && 'でスキップ'}
                            </span>
                          )}
                          {answer.usedHint !== undefined && (
                            <span className={`ml-2 ${answer.usedHint ? 'text-yellow-600' : 'text-gray-400'}`}>
                              💡 {answer.usedHint ? 'ヒント確認済' : 'ヒント未確認'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      isCorrect
                        ? 'bg-green-200 text-green-800'
                        : isSkipped
                        ? 'bg-gray-200 text-gray-700'
                        : isQuit
                        ? 'bg-gray-200 text-gray-600'
                        : (isTimeout && (mode === 'test' || mode === 'exam'))
                        ? 'bg-yellow-200 text-yellow-800'
                        : 'bg-red-200 text-red-800'
                    }`}>
                      {isCorrect ? '正解' : isSkipped ? 'スキップ' : isQuit ? '途中終了' : ((isTimeout && (mode === 'test' || mode === 'exam'))) ? '時間切れ' : '不正解'}
                    </div>
                  </div>

                  {/* 問題文 */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">【問題文】</h4>
                    <p className="text-base leading-relaxed whitespace-pre-wrap print:text-sm">
                      {question.questionText}
                    </p>
                  </div>

                  {/* 回答詳細 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-2">
                    {/* あなたの回答 */}
                    <div className={`p-3 rounded-lg ${
                      isCorrect
                        ? 'bg-green-100 print:bg-white print:border print:border-green-400'
                        : 'bg-white print:border print:border-gray-300'
                    }`}>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">
                        【あなたの回答】
                      </h4>
                      {selectedLabel ? (
                        <div>
                          <span className={`inline-block px-2 py-1 rounded font-bold text-lg mr-2 ${
                            isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                            {selectedLabel}
                          </span>
                          <p className="mt-2 text-sm text-gray-700 print:text-xs">
                            {selectedText}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">
                          {isSkipped ? 'スキップ（未回答）' : isQuit ? '途中終了（未回答）' : isTimeout ? '時間切れ（未回答）' : '未回答'}
                        </p>
                      )}
                    </div>

                    {/* 正解 */}
                    <div className="p-3 rounded-lg bg-blue-50 print:bg-white print:border print:border-blue-400">
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">
                        【正解】
                      </h4>
                      <div>
                        <span className="inline-block px-2 py-1 rounded font-bold text-lg bg-blue-500 text-white mr-2">
                          {correctLabels}
                        </span>
                        <div className="mt-2 space-y-1">
                          {correctTexts.map((text, i) => (
                            <p key={i} className="text-sm text-gray-700 print:text-xs">
                              {text}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 複数正答のメッセージ（学習・テスト両モードで表示） */}
                  {question.correctAnswers && question.correctAnswers.length > 1 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg print:bg-white print:border-yellow-400">
                      <p className="text-sm text-yellow-800">
                        📝 この問題は「{question.correctAnswers.map(a => a.toUpperCase()).join('」または「')}」のどちらでも正解です。
                      </p>
                    </div>
                  )}

                  {/* 全選択肢（不正解の場合に表示） */}
                  {!isCorrect && (
                    <div className="mt-4 pt-3 border-t border-gray-300">
                      <h4 className="text-sm font-semibold text-gray-500 mb-2">【全選択肢】</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:gap-1">
                        {question.choices.map((choice) => {
                          const isSelected = choice.label.toLowerCase() === answer.selectedAnswer?.toLowerCase();
                          const isCorrectChoice = (question.correctAnswers || [question.correctAnswer])
                            .some(ca => ca?.toLowerCase() === choice.label.toLowerCase());

                          return (
                            <div
                              key={choice.label}
                              className={`p-2 rounded text-sm print:text-xs ${
                                isCorrectChoice
                                  ? 'bg-green-100 border border-green-400 print:bg-white'
                                  : isSelected
                                  ? 'bg-red-100 border border-red-400 print:bg-white'
                                  : 'bg-gray-50 border border-gray-200 print:bg-white'
                              }`}
                            >
                              <span className={`font-bold mr-2 ${
                                isCorrectChoice ? 'text-green-600' : isSelected ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {choice.label.toUpperCase()}.
                              </span>
                              <span className={isCorrectChoice ? 'text-green-700' : isSelected ? 'text-red-700' : 'text-gray-700'}>
                                {choice.text}
                              </span>
                              {isCorrectChoice && (
                                <span className="ml-2 text-green-600 font-semibold">← 正解</span>
                              )}
                              {isSelected && !isCorrectChoice && (
                                <span className="ml-2 text-red-600 font-semibold">← あなたの回答</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center print:hidden">
          <button
            onClick={handleExportPDF}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 touch-manipulation font-semibold"
          >
            PDFで保存（印刷）
          </button>
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 active:bg-gray-800 touch-manipulation font-semibold"
          >
            ホームに戻る
          </button>
        </div>

        {/* 印刷用フッター */}
        <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-500">
          <p>柔道整復学 理論編試験対策ツール - 結果レポート</p>
          <p>{currentDateTime} 出力</p>
        </div>
      </div>

      {/* 印刷用のスタイル */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 15mm;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print\\:break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default ResultView;
