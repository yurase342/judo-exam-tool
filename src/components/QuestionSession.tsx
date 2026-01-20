import { useState, useEffect, useRef } from 'react';
import { Question, Answer, SessionSettings } from '../types';
import QuestionView from './QuestionView';
import AnswerFeedback from './AnswerFeedback';

interface QuestionSessionProps {
  questions: Question[];
  settings: SessionSettings;
  onComplete: (answers: Answer[]) => void;
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

  const currentQuestion = questions[currentIndex];
  const mode = settings.mode;

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

  // テストモードのタイマー
  useEffect(() => {
    if (mode === 'test' && remainingTime !== undefined) {
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
      <QuestionView
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        onSkip={handleSkip}
        onHintUsed={handleHintUsed}
        mode={mode}
        elapsedTime={mode === 'learning' ? elapsedTime : undefined}
        remainingTime={mode === 'test' ? remainingTime : undefined}
      />

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
