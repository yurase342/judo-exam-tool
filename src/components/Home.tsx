import { useState, useEffect, useMemo, FC } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Mode, Question, SessionSettings, SessionType, CategoryId } from '../types';
import { saveQuestions, getQuestions } from '../services/database';
import { generateQuestionsFromAnswerPdf, getAvailableExamNumbers } from '../services/questionGenerator';
import CategorySelector from './CategorySelector';
import { CATEGORIES, CATEGORY_LIST } from '../config/categoryConfig';
import { shuffleAllChoices } from '../utils/choiceShuffle';

interface HomeProps {
  onStartSession: (questions: Question[], settings: SessionSettings) => void;
}

const Home: FC<HomeProps> = ({ onStartSession }) => {
  const {
    isLoading,
    loadError,
    mode,
    settings,
    setLoading,
    setLoadError,
    setMode,
    updateSettings,
  } = useSessionStore();

  const [availableExamNumbers, setAvailableExamNumbers] = useState<number[]>([]);
  const [allLoadedQuestions, setAllLoadedQuestions] = useState<Question[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([...CATEGORY_LIST]); // デフォルトで全科目選択

  // 利用可能な正答PDFの回次（設定ファイルから取得、useMemoでキャッシュ）
  const availableAnswerExams = useMemo(() => getAvailableExamNumbers(), []);

  // コンポーネントマウント時に問題を読み込む
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // 利用可能な回次を設定
        setAvailableExamNumbers(availableAnswerExams);

        // 問題を生成
        console.log('[Home] 正答PDFから問題を読み込み中...');
        let allQuestions: Question[] = [];

        for (const examNumber of availableAnswerExams) {
          for (const session of ['gozen', 'gogo'] as SessionType[]) {
            try {
              console.log(`[Home] 第${examNumber}回 ${session} を処理中...`);
              const questions = await generateQuestionsFromAnswerPdf(examNumber, session);
              if (questions.length > 0) {
                allQuestions = allQuestions.concat(questions);
                console.log(`[Home] 第${examNumber}回 ${session}: ${questions.length}問`);
              } else {
                console.warn(`[Home] 警告: 第${examNumber}回 ${session}から問題が見つかりませんでした`);
              }
            } catch (error: any) {
              const errorMsg = error?.message || String(error);
              console.error(`[Home] エラー: 第${examNumber}回 ${session}`, error);
              console.error(`[Home] エラー詳細:`, errorMsg);
              // エラーを記録するが、他の回次の処理は継続
            }
          }
        }

        // DBに保存
        if (allQuestions.length > 0) {
          await saveQuestions(allQuestions);
          console.log(`[Home] 合計 ${allQuestions.length}問をDBに保存`);

          // 読み込まれた問題がある回次のみをデフォルト選択
          const loadedExamNumbers = [...new Set(allQuestions.map(q => q.examNumber))];
          console.log(`[Home] 読み込まれた回次: ${loadedExamNumbers.join(', ')}`);
          updateSettings({
            examNumbers: loadedExamNumbers,
            sessions: ['gozen', 'gogo'],
            questionCount: Math.min(50, allQuestions.length),
            mode: 'learning',
            shuffle: true, // デフォルトでシャッフル有効
          });
        } else {
          console.warn('[Home] 問題が1つも読み込めませんでした');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // モード選択
  const handleModeSelect = (selectedMode: Mode) => {
    setMode(selectedMode);
    updateSettings({ mode: selectedMode });

    // テストモードの場合、制限時間を計算
    if (selectedMode === 'test' && settings?.questionCount) {
      const timeLimit = settings.questionCount * 75; // 1問あたり75秒
      updateSettings({ timeLimit });
    }
  };

  // 開始回次選択（ドロップダウンで処理されるため削除）

  // 時間帯選択は削除（常に午前午後両方を使用）

  // 出題数変更
  const handleQuestionCountChange = (count: number) => {
    updateSettings({ questionCount: count });
    if (mode === 'test') {
      const timeLimit = count * 75;
      updateSettings({ timeLimit });
    }
  };

  // 科目選択変更
  const handleCategoryChange = (categories: CategoryId[]) => {
    setSelectedCategories(categories);
    updateSettings({ categories });
  };

  // 選択した条件での問題数を計算
  const filteredQuestionCount = useMemo(() => {
    if (!settings?.examNumbers || settings.examNumbers.length === 0) {
      return 0;
    }

    const targetSessions = settings.sessions && settings.sessions.length > 0
      ? settings.sessions
      : ['gozen', 'gogo'];

    let filtered = allLoadedQuestions.filter(q =>
      settings.examNumbers.includes(q.examNumber) &&
      targetSessions.includes(q.session)
    );

    // カテゴリフィルタが選択されている場合
    if (selectedCategories.length > 0 && selectedCategories.length < CATEGORY_LIST.length) {
      filtered = filtered.filter(q => q.category && selectedCategories.includes(q.category));
    }

    return filtered.length;
  }, [allLoadedQuestions, settings?.examNumbers, settings?.sessions, selectedCategories]);

  // 学習開始
  const handleStart = async () => {
    if (!mode) {
      alert('モードを選択してください');
      return;
    }
    if (!settings?.examNumbers.length) {
      alert('回次を選択してください');
      return;
    }
    if (selectedCategories.length === 0) {
      alert('科目を選択してください');
      return;
    }
    if (!settings) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      console.log('[handleStart] 開始');
      console.log('[handleStart] 選択された回次:', settings.examNumbers);
      console.log('[handleStart] 選択されたセッション:', settings.sessions);
      console.log('[handleStart] 既に読み込まれた問題数:', allLoadedQuestions.length);
      
      // sessionsが空の場合は、午前・午後両方を設定
      const targetSessions: SessionType[] = settings.sessions && settings.sessions.length > 0 
        ? settings.sessions 
        : ['gozen', 'gogo'];
      
      if (!settings.sessions || settings.sessions.length === 0) {
        console.log('[handleStart] sessionsが空のため、午前・午後両方を設定します');
        updateSettings({ sessions: targetSessions });
      }
      
      // 既に読み込まれた問題からフィルタリング
      let filteredQuestions = allLoadedQuestions.filter(q =>
        settings.examNumbers.includes(q.examNumber) &&
        targetSessions.includes(q.session)
      );

      // カテゴリフィルタを適用
      if (selectedCategories.length > 0 && selectedCategories.length < CATEGORY_LIST.length) {
        filteredQuestions = filteredQuestions.filter(q =>
          q.category && selectedCategories.includes(q.category)
        );
        console.log(`[handleStart] カテゴリフィルタ適用後: ${filteredQuestions.length}問 (選択: ${selectedCategories.map(c => CATEGORIES[c].name).join(', ')})`);
      }
      
      // デバッグ: フィルタリング前の問題数を確認
      const gozenCount = allLoadedQuestions.filter(q => 
        settings.examNumbers.includes(q.examNumber) && q.session === 'gozen'
      ).length;
      const gogoCount = allLoadedQuestions.filter(q => 
        settings.examNumbers.includes(q.examNumber) && q.session === 'gogo'
      ).length;
      console.log('[handleStart] フィルタリング前: 午前', gozenCount, '問、午後', gogoCount, '問');

      console.log('[handleStart] フィルタリング後の問題数:', filteredQuestions.length);
      
      // デバッグ: フィルタリング後の問題数をセッション別に確認
      const filteredGozenCount = filteredQuestions.filter(q => q.session === 'gozen').length;
      const filteredGogoCount = filteredQuestions.filter(q => q.session === 'gogo').length;
      console.log('[handleStart] フィルタリング後: 午前', filteredGozenCount, '問、午後', filteredGogoCount, '問');

      // 問題が見つからない場合、または期待されるセッションの問題が不足している場合は、DBから読み込む
      const hasGozen = filteredQuestions.some(q => q.session === 'gozen');
      const hasGogo = filteredQuestions.some(q => q.session === 'gogo');
      const needsGozen = targetSessions.includes('gozen');
      const needsGogo = targetSessions.includes('gogo');
      
      if (filteredQuestions.length === 0 || 
          (needsGozen && !hasGozen) || 
          (needsGogo && !hasGogo)) {
        console.log('[handleStart] DBから問題を読み込みます');
        const dbQuestions = await getQuestions(settings.examNumbers, targetSessions);
        console.log('[handleStart] DBから読み込んだ問題数:', dbQuestions.length);
        
        // DBから読み込んだ問題を既存の問題とマージ（重複排除）
        // また、選択された回次でフィルタリング
        const existingIds = new Set(filteredQuestions.map(q => q.id));
        const newQuestions = dbQuestions.filter(q => 
          !existingIds.has(q.id) && 
          settings.examNumbers.includes(q.examNumber) &&
          targetSessions.includes(q.session)
        );
        filteredQuestions = [...filteredQuestions, ...newQuestions];
        
        // デバッグ: DBから読み込んだ問題数をセッション別に確認
        const dbGozenCount = dbQuestions.filter(q => q.session === 'gozen').length;
        const dbGogoCount = dbQuestions.filter(q => q.session === 'gogo').length;
        console.log('[handleStart] DBから読み込み: 午前', dbGozenCount, '問、午後', dbGogoCount, '問');
      }

      // まだ問題が見つからない場合は、正答PDFから再読み込みを試みる
      if (filteredQuestions.length === 0) {
        console.log('[handleStart] 正答PDFから再読み込みを試みます');

        for (const examNumber of settings.examNumbers) {
          for (const session of targetSessions as SessionType[]) {
            try {
              console.log(`[handleStart] 第${examNumber}回 ${session} を処理中...`);
              const questions = await generateQuestionsFromAnswerPdf(examNumber, session);
              console.log(`[handleStart] 処理完了: ${questions.length}問`);
              if (questions.length > 0) {
                filteredQuestions.push(...questions);
              } else {
                console.warn(`[handleStart] 警告: 第${examNumber}回 ${session}から問題が見つかりませんでした`);
              }
            } catch (error: any) {
              const errorMsg = error?.message || String(error);
              console.error(`[handleStart] エラー: 第${examNumber}回 ${session === 'gozen' ? '午前' : '午後'}`, error);
              console.error(`[handleStart] エラー詳細:`, errorMsg);
              // エラーを記録するが、他の回次の処理は継続
            }
          }
        }
      }

      console.log('[handleStart] 最終的な問題数:', filteredQuestions.length);
      
      // 別冊参照がある問題をカウント（デバッグ用）
      const bessatsuQuestions = filteredQuestions.filter(q => 
        q.supplementReferences.length > 0 || q.hasSupplementImage
      );
      console.log('[handleStart] 別冊参照がある問題数:', bessatsuQuestions.length);
      bessatsuQuestions.forEach(q => {
        console.log(`[handleStart]   問${q.questionNumber} (第${q.examNumber}回 ${q.session === 'gozen' ? '午前' : '午後'}):`, 
          q.supplementReferences.map(r => r.referenceText).join(', ') || 'hasSupplementImage=true'
        );
      });
      
      if (filteredQuestions.length === 0) {
        // 詳細なエラー情報を収集
        const errorDetails: string[] = [];
        errorDetails.push('問題が見つかりませんでした。');
        errorDetails.push('');
        errorDetails.push('考えられる原因:');
        errorDetails.push('• PDFがスキャン画像形式（テキスト抽出不可）');
        errorDetails.push('• PDFファイルが正しく配置されていない');
        errorDetails.push('• PDFの問題形式が想定と異なる');
        errorDetails.push('• 正答PDFのテキスト抽出に失敗');
        errorDetails.push('• 正答データの解析に失敗');
        errorDetails.push('');
        errorDetails.push('確認事項:');
        errorDetails.push(`• 選択された回次: ${settings.examNumbers.join(', ')}`);
        errorDetails.push(`• 選択されたセッション: ${settings.sessions.join(', ')}`);
        errorDetails.push('');
        errorDetails.push('ブラウザの開発者ツール（F12）でコンソールを確認してください。');
        errorDetails.push('詳細なエラーログが表示されています。');
        
        setLoadError(errorDetails.join('\n'));
        setLoading(false);
        return;
      }

      // シャッフル設定（デフォルトでtrue）
      const shouldShuffle = settings.shuffle !== undefined ? settings.shuffle : true;
      
      // 別冊参照がある問題を優先的に選択
      let selectedQuestions: Question[] = [];
      if (settings.prioritizeBessatsu) {
        // 別冊参照がある問題とない問題を分ける
        const questionsWithBessatsu = filteredQuestions.filter(
          q => q.supplementReferences.length > 0 || q.hasSupplementImage
        );
        const questionsWithoutBessatsu = filteredQuestions.filter(
          q => q.supplementReferences.length === 0 && !q.hasSupplementImage
        );

        console.log('[handleStart] 別冊参照がある問題:', questionsWithBessatsu.length);
        console.log('[handleStart] 別冊参照がない問題:', questionsWithoutBessatsu.length);

        // 別冊参照がある問題を優先的に選択
        if (questionsWithBessatsu.length > 0) {
          // 別冊参照がある問題を先に追加
          const bessatsuCount = Math.min(
            settings.questionCount,
            questionsWithBessatsu.length
          );
          
          if (shouldShuffle) {
            // シャッフルする場合
            const shuffledBessatsu = [...questionsWithBessatsu].sort(() => Math.random() - 0.5);
            selectedQuestions = shuffledBessatsu.slice(0, bessatsuCount);
            
            // 残りの枠を別冊参照がない問題で埋める
            const remainingCount = settings.questionCount - selectedQuestions.length;
            if (remainingCount > 0 && questionsWithoutBessatsu.length > 0) {
              const shuffledWithoutBessatsu = [...questionsWithoutBessatsu].sort(() => Math.random() - 0.5);
              selectedQuestions = selectedQuestions.concat(
                shuffledWithoutBessatsu.slice(0, remainingCount)
              );
            }
          } else {
            // シャッフルしない場合
            selectedQuestions = questionsWithBessatsu.slice(0, bessatsuCount);
            
            // 残りの枠を別冊参照がない問題で埋める
            const remainingCount = settings.questionCount - selectedQuestions.length;
            if (remainingCount > 0 && questionsWithoutBessatsu.length > 0) {
              selectedQuestions = selectedQuestions.concat(
                questionsWithoutBessatsu.slice(0, remainingCount)
              );
            }
          }
        } else {
          // 別冊参照がある問題がない場合は通常通り
          selectedQuestions = shouldShuffle
            ? [...filteredQuestions].sort(() => Math.random() - 0.5)
            : filteredQuestions;
          selectedQuestions = selectedQuestions.slice(0, settings.questionCount);
        }
      } else {
        // 通常の選択（別冊参照優先なし）
        selectedQuestions = shouldShuffle
          ? [...filteredQuestions].sort(() => Math.random() - 0.5)
          : filteredQuestions;
        selectedQuestions = selectedQuestions.slice(0, settings.questionCount);
      }

      console.log('[handleStart] 出題する問題数:', selectedQuestions.length);

      // 選択肢の順番をシャッフル（設定がtrueまたは未設定の場合）
      const shouldShuffleChoices = settings.shuffleChoices !== undefined ? settings.shuffleChoices : true;
      let finalQuestions = selectedQuestions;

      if (shouldShuffleChoices) {
        finalQuestions = shuffleAllChoices(selectedQuestions);
        console.log('[handleStart] 選択肢をシャッフルしました');
      } else {
        console.log('[handleStart] 選択肢シャッフルはオフです');
      }

      onStartSession(finalQuestions, settings);
    } catch (error: any) {
      console.error('[handleStart] エラー:', error);
      setLoadError(`問題の読み込みに失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">
          柔道整復学対策ツール
        </h1>

        {/* エラー表示のみ（読み込み状況は非表示） */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <p className="text-red-600 whitespace-pre-line">{loadError}</p>
          </div>
        )}

        {/* モード選択 */}
        {!isLoading && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">モード選択</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <button
                onClick={() => handleModeSelect('learning')}
                className={`p-4 sm:p-6 rounded-lg border-2 transition-all touch-manipulation ${
                  mode === 'learning'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 active:bg-gray-100'
                }`}
              >
                <div className="text-2xl sm:text-3xl mb-2">📚</div>
                <div className="font-semibold mb-1 text-base sm:text-lg">学習モード</div>
                <div className="text-xs sm:text-sm text-gray-600">
                  ヒント機能あり
                  <br />
                  即時解説表示
                </div>
              </button>

              <button
                onClick={() => handleModeSelect('test')}
                className={`p-4 sm:p-6 rounded-lg border-2 transition-all touch-manipulation ${
                  mode === 'test'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 active:bg-gray-100'
                }`}
              >
                <div className="text-2xl sm:text-3xl mb-2">📝</div>
                <div className="font-semibold mb-1 text-base sm:text-lg">テストモード</div>
                <div className="text-xs sm:text-sm text-gray-600">
                  制限時間あり
                  <br />
                  本番形式
                </div>
              </button>
            </div>

            {/* モード選択後の追加設定 */}
            {mode && (
              <>
                {/* テストモードの場合、制限時間表示 */}
                {mode === 'test' && settings?.timeLimit && (
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm sm:text-base">
                      ⏱ 制限時間: {Math.floor(settings.timeLimit / 60)}分
                      {settings.timeLimit % 60}秒（{settings.questionCount}問 × 75秒）
                    </p>
                  </div>
                )}

                {/* シャッフル設定 */}
                <div className="mb-4 sm:mb-6 space-y-3">
                  <label className="flex items-center cursor-pointer touch-manipulation">
                    <input
                      type="checkbox"
                      checked={settings?.shuffle !== undefined ? settings.shuffle : true}
                      onChange={(e) => updateSettings({ shuffle: e.target.checked })}
                      className="mr-2 w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span className="text-sm sm:text-base">出題順をシャッフルする</span>
                  </label>
                  <label className="flex items-center cursor-pointer touch-manipulation">
                    <input
                      type="checkbox"
                      checked={settings?.shuffleChoices !== undefined ? settings.shuffleChoices : true}
                      onChange={(e) => updateSettings({ shuffleChoices: e.target.checked })}
                      className="mr-2 w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span className="text-sm sm:text-base">選択肢の順番をシャッフルする</span>
                  </label>
                  <p className="text-xs text-gray-500 ml-6">
                    同じ問題でも選択肢A〜Dの順番が毎回変わります（暗記防止）
                  </p>
                </div>

                {/* 別冊参照優先 */}
                <div className="mb-4 sm:mb-6">
                  <label className="flex items-center cursor-pointer touch-manipulation">
                    <input
                      type="checkbox"
                      checked={settings?.prioritizeBessatsu || false}
                      onChange={(e) => updateSettings({ prioritizeBessatsu: e.target.checked })}
                      className="mr-2 w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span className="text-sm sm:text-base">
                      📎 別冊参照がある問題を優先的に出題する
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    別冊画像が含まれる問題を優先的に出題します（別冊参照がない問題も含まれます）
                  </p>
                </div>

                {/* 開始ボタン */}
                <button
                  onClick={handleStart}
                  className="w-full py-4 sm:py-3 px-4 bg-green-600 text-white rounded-lg active:bg-green-700 font-semibold text-base sm:text-lg touch-manipulation"
                >
                  {mode === 'learning' ? '学習を開始する' : 'テストを開始する'}
                </button>
              </>
            )}
          </div>
        )}

        {/* 出題設定 */}
        {!isLoading && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">出題設定</h2>

            {/* 回次選択（チェックボックス形式） */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium mb-2">
                第何回の問題を出題するか
              </label>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {availableExamNumbers.map((examNumber) => {
                  // 読み込まれた問題数を計算
                  const loadedCount = allLoadedQuestions.filter(q => q.examNumber === examNumber).length;
                  const hasQuestions = loadedCount > 0;

                  // 有効な（問題がある）回次のリスト
                  const availableWithQuestions = availableExamNumbers.filter(
                    num => allLoadedQuestions.some(q => q.examNumber === num)
                  );

                  // 全選択状態かどうかを判定
                  const isAllSelected = availableWithQuestions.length > 0 &&
                    availableWithQuestions.every(num => settings?.examNumbers.includes(num));

                  return (
                    <label
                      key={examNumber}
                      className={`flex items-center px-4 sm:px-5 py-2 sm:py-2.5 border-2 rounded-lg cursor-pointer touch-manipulation transition-all ${
                        !hasQuestions ? 'opacity-50 bg-gray-100' : 'active:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={settings?.examNumbers.includes(examNumber) || false}
                        disabled={!hasQuestions}
                        onChange={(e) => {
                          const current = settings?.examNumbers || [];
                          const isCurrentlyChecked = current.includes(examNumber);

                          // 全選択状態でクリックした場合 → その回だけを選択
                          if (isAllSelected && isCurrentlyChecked) {
                            updateSettings({ examNumbers: [examNumber] });
                          } else {
                            // 通常のチェックボックス動作
                            const updated = e.target.checked
                              ? [...current, examNumber]
                              : current.filter((n) => n !== examNumber);
                            updateSettings({ examNumbers: updated });
                          }
                        }}
                        className="mr-2 w-4 h-4 sm:w-5 sm:h-5"
                      />
                      <span className="text-sm sm:text-base font-medium">
                        第{examNumber}回
                        {hasQuestions && <span className="text-xs text-gray-500 ml-1">({loadedCount}問)</span>}
                        {!hasQuestions && <span className="text-xs text-red-500 ml-1">(未登録)</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {/* 全選択ボタン */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    const availableWithQuestions = availableExamNumbers.filter(
                      num => allLoadedQuestions.some(q => q.examNumber === num)
                    );
                    updateSettings({ examNumbers: availableWithQuestions });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  全て選択
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => {
                    updateSettings({ examNumbers: [] });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  全て解除
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                全選択時にクリックすると、その回だけを選択できます
              </p>
            </div>

            {/* 科目（カテゴリ）選択 */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium mb-2">
                出題する科目を選択
              </label>
              <CategorySelector
                selectedCategories={selectedCategories}
                onChange={handleCategoryChange}
              />
              {filteredQuestionCount > 0 && (
                <p className="text-sm text-blue-600 mt-2">
                  選択した条件で出題可能な問題数: <strong>{filteredQuestionCount}問</strong>
                </p>
              )}
            </div>

            {/* 出題数（テンプレート + カスタム） */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium mb-2">
                何問出題するか
              </label>

              {/* テンプレートボタン */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-3">
                {[10, 20, 30, 40, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => handleQuestionCountChange(count)}
                    className={`px-4 sm:px-5 py-2 sm:py-2.5 border-2 rounded-lg font-medium text-sm sm:text-base touch-manipulation transition-all ${
                      settings?.questionCount === count
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 active:bg-gray-50'
                    }`}
                  >
                    {count}問
                  </button>
                ))}
              </div>

              {/* カスタム入力 */}
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-sm sm:text-base text-gray-600">カスタム:</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={settings?.questionCount || 50}
                  onChange={(e) => {
                    const count = parseInt(e.target.value, 10);
                    if (!isNaN(count) && count > 0 && count <= 500) {
                      handleQuestionCountChange(count);
                    }
                  }}
                  className="w-24 sm:w-28 px-3 sm:px-4 py-2 sm:py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                  placeholder="1-500"
                />
                <span className="text-sm sm:text-base text-gray-600">問</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                1問から500問まで自由に設定できます
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
