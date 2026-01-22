import { useState, useEffect, useRef } from 'react';
import { Question, Answer, SessionSettings } from '../types';
import QuestionView from './QuestionView';
import AnswerFeedback from './AnswerFeedback';

interface QuestionSessionProps {
  questions: Question[];
  settings: SessionSettings;
  onComplete: (answers: Answer[], quitAtQuestion?: number) => void;
}

const QuestionSession: React.FC<QuestionSessionProps> = ({
  questions,
  settings,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [_answers, setAnswers] = useState<Answer[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const answersRef = useRef<Answer[]>([]); // 最新の回答を保持するためのref
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{
    isCorrect: boolean;
    selectedAnswer: string;
    correctAnswer: string;
    correctAnswers?: string[]; // 複数正答対応
  } | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [remainingTime, setRemainingTime] = useState<number | undefined>(
    settings.timeLimit
  );
  const [elapsedTime, setElapsedTime] = useState<number>(0); // 学習モード用のリアルタイムタイマー
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const learningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentHintUsedRef = useRef<boolean>(false); // 現在の問題でヒントを使用したかどうか
  const [showQuitConfirm, setShowQuitConfirm] = useState(false); // やめる確認ダイアログ

  const currentQuestion = questions[currentIndex];
  const mode = settings.mode;
  const isExamMode = settings.isExamMode || mode === 'exam';

  // 時間フォーマット（時:分:秒）
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 学習モードのリアルタイムタイマー
  useEffect(() => {
    if (mode === 'learning') {
      learningTimerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => {
        if (learningTimerRef.current) {
          clearInterval(learningTimerRef.current);
        }
      };
    }
  }, [mode, startTime]);

  // テストモード・本番モードのタイマー
  useEffect(() => {
    if ((mode === 'test' || mode === 'exam') && remainingTime !== undefined) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev === undefined) return undefined;
          if (prev <= 0) {
            // 時間切れ
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [mode, remainingTime]);

  // 時間切れ処理
  const handleTimeUp = () => {
    // 未回答の問題を「時間切れ」として記録
    const unansweredAnswers: Answer[] = [];
    for (let i = currentIndex; i < questions.length; i++) {
      unansweredAnswers.push({
        questionId: questions[i].id,
        selectedAnswer: null,
        isCorrect: false,
        status: 'timeout',
        timeSpent: 0,
        answeredAt: null,
      });
    }

    const allAnswers = [...answersRef.current, ...unansweredAnswers];
    onComplete(allAnswers);
  };

  // やめる処理（練習・小テストモードのみ）
  const handleQuit = () => {
    // 未回答の問題を「quit」として記録
    const unansweredAnswers: Answer[] = [];
    for (let i = currentIndex; i < questions.length; i++) {
      unansweredAnswers.push({
        questionId: questions[i].id,
        selectedAnswer: null,
        isCorrect: false,
        status: 'quit',
        timeSpent: 0,
        answeredAt: null,
      });
    }

    const allAnswers = [...answersRef.current, ...unansweredAnswers];
    // 途中終了した問題番号を渡す（1-indexed）
    onComplete(allAnswers, currentIndex + 1);
  };

  // ヒント使用のコールバック
  const handleHintUsed = () => {
    currentHintUsedRef.current = true;
  };

  // 回答処理
  const handleAnswer = (selectedAnswer: string) => {
    const question = questions[currentIndex];

    // 正解判定（複数正答対応）
    // correctAnswersがある場合はそれを使用、なければcorrectAnswerを使用
    const correctAnswerList = question.correctAnswers && question.correctAnswers.length > 0
      ? question.correctAnswers
      : [question.correctAnswer];
    const isCorrect = correctAnswerList.some(
      ca => ca.toLowerCase() === selectedAnswer.toLowerCase()
    );

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    const answer: Answer = {
      questionId: question.id,
      selectedAnswer,
      isCorrect,
      status: 'answered',
      timeSpent,
      answeredAt: new Date(),
      usedHint: currentHintUsedRef.current, // ヒント使用状況を記録
    };

    // 回答を追加（関数型更新で最新の状態を保証）
    setAnswers((prevAnswers) => {
      const newAnswers = [...prevAnswers, answer];
      answersRef.current = newAnswers; // refも更新
      return newAnswers;
    });
    setFeedbackData({
      isCorrect,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      correctAnswers: question.correctAnswers, // 複数正答を渡す
    });
    setShowFeedback(true);
  };

  // スキップ処理
  const handleSkip = () => {
    const question = questions[currentIndex];
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    const answer: Answer = {
      questionId: question.id,
      selectedAnswer: null,
      isCorrect: false,
      status: 'skipped',
      timeSpent, // スキップまでにかかった時間を記録
      answeredAt: null,
      usedHint: currentHintUsedRef.current, // ヒント使用状況を記録
    };

    // 回答を追加（関数型更新で最新の状態を保証）
    setAnswers((prevAnswers) => {
      const newAnswers = [...prevAnswers, answer];
      answersRef.current = newAnswers; // refも更新
      return newAnswers;
    });
    moveToNext();
  };

  // 次の問題へ
  const moveToNext = () => {
    setShowFeedback(false);
    setFeedbackData(null);
    setQuestionStartTime(Date.now());
    currentHintUsedRef.current = false; // ヒント使用状況をリセット

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // 全問終了（refから最新のanswersを取得）
      onComplete(answersRef.current);
    }
  };

  if (!currentQuestion) {
    return <div>問題を読み込み中...</div>;
  }

  return (
    <>
      {/* ヘッダー（タイマー・やめるボタン） */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-40 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* 左側: モード表示 */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              mode === 'exam'
                ? 'bg-red-100 text-red-700'
                : mode === 'test'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {mode === 'exam' ? '📋 本番' : mode === 'test' ? '📝 小テスト' : '📚 練習'}
            </span>
          </div>

          {/* 中央: タイマー */}
          <div className="flex items-center gap-2">
            {(mode === 'test' || mode === 'exam') && remainingTime !== undefined && (
              <div className={`flex items-center gap-1 px-3 py-1 rounded-lg font-mono text-lg ${
                remainingTime < 300 ? 'bg-red-100 text-red-700 animate-pulse' :
                remainingTime < 600 ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                <span>⏱</span>
                <span className="font-bold">{formatTime(remainingTime)}</span>
              </div>
            )}
            {mode === 'learning' && (
              <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-100 text-gray-600 font-mono">
                <span>⏱</span>
                <span>{formatTime(elapsedTime)}</span>
              </div>
            )}
          </div>

          {/* 右側: やめるボタン（本番モード以外） */}
          <div>
            {!isExamMode && (
              <button
                onClick={() => setShowQuitConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                やめる
              </button>
            )}
            {isExamMode && (
              <div className="text-xs text-gray-400">
                途中終了不可
              </div>
            )}
          </div>
        </div>
      </div>

      {/* やめる確認ダイアログ */}
      {showQuitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              本当にやめますか？
            </h3>
            <p className="text-gray-600 mb-6">
              問題{currentIndex + 1}で終了します。
              <br />
              ここまでの結果がレポートに表示されます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowQuitConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                続ける
              </button>
              <button
                onClick={handleQuit}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
              >
                やめる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 問題表示（ヘッダー分のマージン追加） */}
      <div className="pt-14">
        <QuestionView
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          onAnswer={handleAnswer}
          onSkip={handleSkip}
          onHintUsed={handleHintUsed}
          mode={mode}
          elapsedTime={mode === 'learning' ? elapsedTime : undefined}
          remainingTime={(mode === 'test' || mode === 'exam') ? remainingTime : undefined}
        />
      </div>

      {showFeedback && feedbackData && (
        <AnswerFeedback
          isCorrect={feedbackData.isCorrect}
          selectedAnswer={feedbackData.selectedAnswer}
          correctAnswer={feedbackData.correctAnswer}
          correctAnswers={feedbackData.correctAnswers}
          onNext={moveToNext}
          mode={mode}
        />
      )}
    </>
  );
};

export default QuestionSession;
