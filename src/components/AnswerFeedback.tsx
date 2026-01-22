import { useEffect, useRef } from 'react';

interface AnswerFeedbackProps {
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  correctAnswers?: string[]; // 複数正答（AでもBでも正解の場合）
  onNext: () => void;
  mode: 'learning' | 'test' | 'exam';
}

const AnswerFeedback: React.FC<AnswerFeedbackProps> = ({
  isCorrect,
  selectedAnswer,
  correctAnswer,
  correctAnswers,
  onNext,
  mode,
}) => {
  // onNextをrefで保持して、タイマー発火時に最新の関数を呼び出す
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  // 学習モード: 1秒後に自動遷移
  // 小テスト・本番モード: 0.5秒後に自動遷移
  useEffect(() => {
    const timer = setTimeout(() => {
      onNextRef.current();
    }, mode === 'learning' ? 1000 : 500); // test, exam は 0.5秒

    return () => clearTimeout(timer);
    // modeのみを依存配列に含める（onNextはrefで管理するため不要）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
        isCorrect ? 'bg-green-500 bg-opacity-30' : 'bg-red-500 bg-opacity-30'
      }`}
    >
      <div
        className={`bg-white rounded-lg p-6 sm:p-8 shadow-lg w-full max-w-md ${
          isCorrect ? 'border-4 border-green-500' : 'border-4 border-red-500'
        }`}
      >
        <div className="text-center">
          {isCorrect ? (
            <>
              <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">✓</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600 mb-2">
                正解！
              </div>
              {/* 学習モードで複数正答がある場合、別の正解も表示 */}
              {mode === 'learning' && correctAnswers && correctAnswers.length > 1 && (
                <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-2">
                  📝 この問題は「{correctAnswers.filter(a => a.toUpperCase() !== selectedAnswer.toUpperCase()).map(a => a.toUpperCase()).join('」でも「')}」でも正解でした
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">✗</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600 mb-2">
                不正解
              </div>
              <div className="text-base sm:text-lg text-gray-700 mb-2">
                正解は <span className="font-bold">{correctAnswers && correctAnswers.length > 1 ? correctAnswers.map(a => a.toUpperCase()).join(' または ') : correctAnswer.toUpperCase()}</span> です
              </div>
            </>
          )}
          <div className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
            {mode === 'learning' ? '1秒後に次の問題へ...' : '0.5秒後に次の問題へ...'}</div>
        </div>
      </div>
    </div>
  );
};

export default AnswerFeedback;
