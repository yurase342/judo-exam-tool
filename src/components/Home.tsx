import { useState, useEffect, useMemo, FC } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Mode, Question, SessionSettings, SessionType, CategoryId } from '../types';
import { saveQuestions, getQuestions } from '../services/database';
import { generateQuestionsFromAnswerPdf, getAvailableExamNumbers } from '../services/questionGenerator';
import { CATEGORIES, CATEGORY_LIST } from '../config/categoryConfig';
import { shuffleAllChoices } from '../utils/choiceShuffle';

interface HomeProps {
  onStartSession: (questions: Question[], settings: SessionSettings) => void;
}

// 本番モードの制限時間（秒）
const EXAM_TIME_LIMIT = 150 * 60; // 2時間30分 = 150分 = 9000秒

const Home: FC<HomeProps> = ({ onStartSession }) => {
  const {
    isLoading,
    loadError,
    setLoading,
    setLoadError,
    updateSettings,
  } = useSessionStore();

  const [availableExamNumbers, setAvailableExamNumbers] = useState<number[]>([]);
  const [allLoadedQuestions, setAllLoadedQuestions] = useState<Question[]>([]);

  // 画面の状態
  type ScreenState = 'main' | 'settings' | 'exam-select' | 'exam-session-select';
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('main');

  // 設定値
  const [selectedMode, setSelectedMode] = useState<Mode>('learning');
  const [selectedExamNumbers, setSelectedExamNumbers] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([...CATEGORY_LIST]);
  const [questionCount, setQuestionCount] = useState(10);

  // 本番モード用の状態
  const [examModeExamNumber, setExamModeExamNumber] = useState<number | null>(null);
  const [examModeShuffle, setExamModeShuffle] = useState(false);
  const [examModeShuffleChoices, setExamModeShuffleChoices] = useState(false);

  // 利用可能な正答PDFの回次
  const availableAnswerExams = useMemo(() => getAvailableExamNumbers(), []);

  // コンポーネントマウント時に問題を読み込む
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        setAvailableExamNumbers(availableAnswerExams);

        let allQuestions: Question[] = [];

        for (const examNumber of availableAnswerExams) {
          for (const session of ['gozen', 'gogo'] as SessionType[]) {
            try {
              const questions = await generateQuestionsFromAnswerPdf(examNumber, session);
              if (questions.length > 0) {
                allQuestions = allQuestions.concat(questions);
              }
            } catch (error) {
              console.error(`[Home] エラー: 第${examNumber}回 ${session}`, error);
            }
          }
        }

        if (allQuestions.length > 0) {
          await saveQuestions(allQuestions);
          const loadedExamNumbers = [...new Set(allQuestions.map(q => q.examNumber))];
          setSelectedExamNumbers(loadedExamNumbers);
        }

        setAllLoadedQuestions(allQuestions);
      } catch (error: any) {
        console.error('[Home] エラー:', error);
        setLoadError(`問題の読み込みに失敗しました: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  // 選択した条件での問題数を計算
  const filteredQuestionCount = useMemo(() => {
    if (selectedExamNumbers.length === 0) return 0;

    let filtered = allLoadedQuestions.filter(q =>
      selectedExamNumbers.includes(q.examNumber)
    );

    if (selectedCategories.length > 0) {
      filtered = filtered.filter(q => q.category && selectedCategories.includes(q.category));
    } else {
      return 0;
    }

    return filtered.length;
  }, [allLoadedQuestions, selectedExamNumbers, selectedCategories]);

  // すぐに始める（デフォルト設定）
  const handleQuickStart = () => {
    startSession('learning', 10, [...CATEGORY_LIST], selectedExamNumbers.length > 0 ? selectedExamNumbers : availableExamNumbers);
  };

  // 設定を使って開始
  const handleStartWithSettings = () => {
    startSession(selectedMode, questionCount, selectedCategories, selectedExamNumbers);
  };

  // セッション開始の共通処理（練習・小テストモード）
  const startSession = async (
    mode: Mode,
    count: number,
    categories: CategoryId[],
    examNumbers: number[]
  ) => {
    if (examNumbers.length === 0) {
      alert('回次を選択してください');
      return;
    }
    if (categories.length === 0) {
      alert('科目を選択してください');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      let filteredQuestions = allLoadedQuestions.filter(q =>
        examNumbers.includes(q.examNumber)
      );

      filteredQuestions = filteredQuestions.filter(q =>
        q.category && categories.includes(q.category)
      );

      if (filteredQuestions.length === 0) {
        const dbQuestions = await getQuestions(examNumbers, ['gozen', 'gogo']);
        filteredQuestions = dbQuestions.filter(q =>
          q.category && categories.includes(q.category)
        );
      }

      if (filteredQuestions.length === 0) {
        setLoadError('問題が見つかりませんでした。');
        setLoading(false);
        return;
      }

      // シャッフルして出題数分を選択
      const shuffled = [...filteredQuestions].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(count, shuffled.length));

      // 選択肢もシャッフル
      const finalQuestions = shuffleAllChoices(selected);

      const settings: SessionSettings = {
        mode,
        questionCount: finalQuestions.length,
        examNumbers,
        sessions: ['gozen', 'gogo'],
        categories,
        shuffle: true,
        shuffleChoices: true,
        timeLimit: mode === 'test' ? finalQuestions.length * 75 : undefined,
        isExamMode: false,
      };

      updateSettings(settings);
      onStartSession(finalQuestions, settings);
    } catch (error: any) {
      console.error('[startSession] エラー:', error);
      setLoadError(`問題の読み込みに失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 本番モード開始処理
  const startExamMode = async (session: SessionType) => {
    if (examModeExamNumber === null) {
      alert('回次を選択してください');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      // 指定された回次・セッションの問題を取得
      let examQuestions = allLoadedQuestions.filter(q =>
        q.examNumber === examModeExamNumber && q.session === session
      );

      if (examQuestions.length === 0) {
        const dbQuestions = await getQuestions([examModeExamNumber], [session]);
        examQuestions = dbQuestions;
      }

      if (examQuestions.length === 0) {
        setLoadError(`第${examModeExamNumber}回 ${session === 'gozen' ? '午前' : '午後'}の問題が見つかりませんでした。`);
        setLoading(false);
        return;
      }

      // 問題番号順にソート（デフォルト）
      let finalQuestions = [...examQuestions].sort((a, b) => a.questionNumber - b.questionNumber);

      // シャッフル設定に応じて処理
      if (examModeShuffle) {
        finalQuestions = [...finalQuestions].sort(() => Math.random() - 0.5);
      }

      if (examModeShuffleChoices) {
        finalQuestions = shuffleAllChoices(finalQuestions);
      }

      const settings: SessionSettings = {
        mode: 'exam',
        questionCount: finalQuestions.length,
        examNumbers: [examModeExamNumber],
        sessions: [session],
        categories: [...CATEGORY_LIST], // 全科目
        shuffle: examModeShuffle,
        shuffleChoices: examModeShuffleChoices,
        timeLimit: EXAM_TIME_LIMIT, // 2時間30分
        isExamMode: true,
      };

      updateSettings(settings);
      onStartSession(finalQuestions, settings);
    } catch (error: any) {
      console.error('[startExamMode] エラー:', error);
      setLoadError(`問題の読み込みに失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 科目の選択/解除
  const toggleCategory = (categoryId: CategoryId) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(c => c !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  // 回次の選択/解除
  const toggleExamNumber = (examNumber: number) => {
    if (selectedExamNumbers.includes(examNumber)) {
      setSelectedExamNumbers(selectedExamNumbers.filter(n => n !== examNumber));
    } else {
      setSelectedExamNumbers([...selectedExamNumbers, examNumber]);
    }
  };

  // 特定の回次の問題数を取得
  const getExamQuestionCount = (examNumber: number, session: SessionType): number => {
    return allLoadedQuestions.filter(q =>
      q.examNumber === examNumber && q.session === session
    ).length;
  };

  // ローディング中
  if (isLoading && allLoadedQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📚</div>
          <p className="text-lg text-gray-600">問題を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 sm:p-6">
      <div className="max-w-lg mx-auto">
        {/* タイトル */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-8 mt-4">
          柔道整復学
          <br />
          <span className="text-blue-600">対策ツール</span>
        </h1>

        {/* エラー表示 */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-600 text-sm">{loadError}</p>
          </div>
        )}

        {/* ========== メイン画面 ========== */}
        {currentScreen === 'main' && (
          <div className="space-y-4">
            {/* すぐに始めるボタン */}
            <button
              onClick={handleQuickStart}
              disabled={isLoading || allLoadedQuestions.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl p-6 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-2">🎯</div>
              <div className="text-xl font-bold mb-1">すぐに始める</div>
              <div className="text-blue-100 text-sm">
                10問・全科目・ランダム出題
              </div>
            </button>

            {/* 設定を変えて始めるボタン */}
            <button
              onClick={() => setCurrentScreen('settings')}
              disabled={isLoading || allLoadedQuestions.length === 0}
              className="w-full bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 rounded-2xl p-6 shadow-lg border-2 border-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-2">⚙️</div>
              <div className="text-xl font-bold mb-1">設定を変えて始める</div>
              <div className="text-gray-500 text-sm">
                問題数・科目・小テストモードなど
              </div>
            </button>

            {/* 本番モードボタン */}
            <button
              onClick={() => setCurrentScreen('exam-select')}
              disabled={isLoading || allLoadedQuestions.length === 0}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 active:from-red-700 active:to-orange-700 text-white rounded-2xl p-6 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-2">📋</div>
              <div className="text-xl font-bold mb-1">本番モード</div>
              <div className="text-red-100 text-sm">
                実際の試験と同じ環境で挑戦
              </div>
            </button>

            {/* 問題数表示 */}
            <div className="text-center text-gray-500 text-sm mt-6">
              📊 {allLoadedQuestions.length}問 読み込み済み
            </div>
          </div>
        )}

        {/* ========== 設定画面（練習・小テスト） ========== */}
        {currentScreen === 'settings' && (
          <div className="space-y-6">
            {/* 戻るボタン */}
            <button
              onClick={() => setCurrentScreen('main')}
              className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
            >
              <span className="text-xl mr-2">←</span>
              <span>戻る</span>
            </button>

            {/* モード選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-3">モード</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMode('learning')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedMode === 'learning'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-1">📚</div>
                  <div className="font-semibold text-sm">練習</div>
                  <div className="text-xs text-gray-500">ヒントあり</div>
                </button>
                <button
                  onClick={() => setSelectedMode('test')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedMode === 'test'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-1">📝</div>
                  <div className="font-semibold text-sm">小テスト</div>
                  <div className="text-xs text-gray-500">時間制限あり</div>
                </button>
              </div>
            </div>

            {/* 出題数 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-3">何問やる？</h2>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`py-3 rounded-xl border-2 font-semibold transition-all ${
                      questionCount === count
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    {count}問
                  </button>
                ))}
              </div>
              {filteredQuestionCount > 0 && filteredQuestionCount < questionCount && (
                <p className="text-orange-600 text-xs mt-2">
                  ※ 選択した条件では最大{filteredQuestionCount}問です
                </p>
              )}
            </div>

            {/* 回次選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-800">どの回から出す？</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedExamNumbers([...availableExamNumbers.filter(n => allLoadedQuestions.some(q => q.examNumber === n))])}
                    className="text-xs text-blue-600 underline"
                  >
                    全て
                  </button>
                  <button
                    onClick={() => setSelectedExamNumbers([])}
                    className="text-xs text-blue-600 underline"
                  >
                    解除
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableExamNumbers.map((examNumber) => {
                  const hasQuestions = allLoadedQuestions.some(q => q.examNumber === examNumber);
                  const isSelected = selectedExamNumbers.includes(examNumber);

                  return (
                    <button
                      key={examNumber}
                      onClick={() => hasQuestions && toggleExamNumber(examNumber)}
                      disabled={!hasQuestions}
                      className={`px-4 py-2 rounded-xl border-2 font-medium transition-all ${
                        !hasQuestions
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      第{examNumber}回
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 科目選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-800">どの科目から出す？</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCategories([...CATEGORY_LIST])}
                    className="text-xs text-blue-600 underline"
                  >
                    全て
                  </button>
                  <button
                    onClick={() => setSelectedCategories([])}
                    className="text-xs text-blue-600 underline"
                  >
                    解除
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_LIST.map((categoryId) => {
                  const category = CATEGORIES[categoryId];
                  const isSelected = selectedCategories.includes(categoryId);

                  return (
                    <button
                      key={categoryId}
                      onClick={() => toggleCategory(categoryId)}
                      className={`px-3 py-2 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-500'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{category.name}
                    </button>
                  );
                })}
              </div>
              {selectedCategories.length === 0 && (
                <p className="text-orange-600 text-xs mt-2">
                  ※ 科目を選んでください
                </p>
              )}
            </div>

            {/* 出題可能数の表示 */}
            {filteredQuestionCount > 0 && (
              <div className="text-center text-gray-600 text-sm">
                選んだ条件で <span className="font-bold text-blue-600">{filteredQuestionCount}問</span> 出題できます
              </div>
            )}

            {/* 開始ボタン */}
            <button
              onClick={handleStartWithSettings}
              disabled={isLoading || selectedExamNumbers.length === 0 || selectedCategories.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl p-5 shadow-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedMode === 'learning' ? '🎯 練習を始める' : '📝 小テストを始める'}
            </button>

            {/* 小テストモードの場合の時間表示 */}
            {selectedMode === 'test' && (
              <p className="text-center text-gray-500 text-sm">
                ⏱ 制限時間: 約{Math.ceil(Math.min(questionCount, filteredQuestionCount || questionCount) * 75 / 60)}分
              </p>
            )}
          </div>
        )}

        {/* ========== 本番モード - 回次選択画面 ========== */}
        {currentScreen === 'exam-select' && (
          <div className="space-y-6">
            {/* 戻るボタン */}
            <button
              onClick={() => setCurrentScreen('main')}
              className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
            >
              <span className="text-xl mr-2">←</span>
              <span>戻る</span>
            </button>

            {/* タイトル */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 text-white text-center">
              <div className="text-3xl mb-2">📋</div>
              <h2 className="text-xl font-bold">本番モード</h2>
              <p className="text-sm text-red-100 mt-1">制限時間: 2時間30分</p>
            </div>

            {/* 回次選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-4">どの回を受験する？</h2>
              <div className="space-y-3">
                {availableExamNumbers.map((examNumber) => {
                  const gozenCount = getExamQuestionCount(examNumber, 'gozen');
                  const gogoCount = getExamQuestionCount(examNumber, 'gogo');
                  const hasQuestions = gozenCount > 0 || gogoCount > 0;

                  return (
                    <button
                      key={examNumber}
                      onClick={() => {
                        if (hasQuestions) {
                          setExamModeExamNumber(examNumber);
                          setCurrentScreen('exam-session-select');
                        }
                      }}
                      disabled={!hasQuestions}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        !hasQuestions
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-bold">第{examNumber}回</span>
                          {hasQuestions && (
                            <span className="text-sm text-gray-500 ml-2">
                              (午前{gozenCount}問 / 午後{gogoCount}問)
                            </span>
                          )}
                        </div>
                        <span className="text-2xl">→</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========== 本番モード - 午前/午後選択画面 ========== */}
        {currentScreen === 'exam-session-select' && examModeExamNumber !== null && (
          <div className="space-y-6">
            {/* 戻るボタン */}
            <button
              onClick={() => setCurrentScreen('exam-select')}
              className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
            >
              <span className="text-xl mr-2">←</span>
              <span>回次選択に戻る</span>
            </button>

            {/* タイトル */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 text-white text-center">
              <div className="text-3xl mb-2">📋</div>
              <h2 className="text-xl font-bold">第{examModeExamNumber}回</h2>
              <p className="text-sm text-red-100 mt-1">本番モード・制限時間 2時間30分</p>
            </div>

            {/* 午前/午後選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-4">どちらを受験する？</h2>
              <div className="space-y-3">
                {/* 午前の部 */}
                <button
                  onClick={() => startExamMode('gozen')}
                  disabled={getExamQuestionCount(examModeExamNumber, 'gozen') === 0}
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                    getExamQuestionCount(examModeExamNumber, 'gozen') === 0
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl mb-1">🌅</div>
                      <span className="text-xl font-bold">午前の部</span>
                      <p className="text-sm text-gray-600 mt-1">
                        {getExamQuestionCount(examModeExamNumber, 'gozen')}問
                      </p>
                    </div>
                    <span className="text-3xl">▶</span>
                  </div>
                </button>

                {/* 午後の部 */}
                <button
                  onClick={() => startExamMode('gogo')}
                  disabled={getExamQuestionCount(examModeExamNumber, 'gogo') === 0}
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                    getExamQuestionCount(examModeExamNumber, 'gogo') === 0
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-orange-300 bg-orange-50 hover:border-orange-500 hover:bg-orange-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl mb-1">🌇</div>
                      <span className="text-xl font-bold">午後の部</span>
                      <p className="text-sm text-gray-600 mt-1">
                        {getExamQuestionCount(examModeExamNumber, 'gogo')}問
                      </p>
                    </div>
                    <span className="text-3xl">▶</span>
                  </div>
                </button>
              </div>
            </div>

            {/* シャッフル設定 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-3">オプション</h2>
              <div className="space-y-3">
                {/* 問題順シャッフル */}
                <label className="flex items-center justify-between p-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50">
                  <div>
                    <span className="font-medium">問題の順番をシャッフル</span>
                    <p className="text-xs text-gray-500">OFFなら本番と同じ順番</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={examModeShuffle}
                    onChange={(e) => setExamModeShuffle(e.target.checked)}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>

                {/* 選択肢シャッフル */}
                <label className="flex items-center justify-between p-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-50">
                  <div>
                    <span className="font-medium">選択肢の順番をシャッフル</span>
                    <p className="text-xs text-gray-500">OFFなら本番と同じ順番</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={examModeShuffleChoices}
                    onChange={(e) => setExamModeShuffleChoices(e.target.checked)}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                </label>
              </div>
            </div>

            {/* 注意事項 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-bold text-yellow-800 mb-2">⚠️ 本番モードの注意</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• 制限時間は2時間30分です</li>
                <li>• 途中でやめることはできません</li>
                <li>• 時間切れで強制終了します</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
