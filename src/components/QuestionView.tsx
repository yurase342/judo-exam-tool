import { useState, useEffect, useRef, useMemo } from 'react';
import { Question } from '../types';
import ImageModal from './ImageModal';
import BessatsuViewer from './BessatsuViewer';
import { generateHint } from '../services/hintGenerator';
import { hasQuestionImage, getQuestionImagePath } from '../config/pdfConfig';

interface QuestionViewProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: string) => void;
  onSkip?: () => void;
  onHintUsed?: () => void; // ヒントを確認した時のコールバック
  mode: 'learning' | 'test' | 'exam';
  elapsedTime?: number; // 経過時間（秒）
  remainingTime?: number; // 残り時間（秒、小テスト・本番モード用）
}

const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onSkip,
  onHintUsed,
  mode,
  elapsedTime,
  remainingTime,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false); // この問題でヒントを使用したか
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showBessatsuViewer, setShowBessatsuViewer] = useState(false);
  const [bessatsuPage, setBessatsuPage] = useState<number | undefined>(undefined);
  const [bessatsuImages, setBessatsuImages] = useState<Map<number, string>>(new Map());
  const [loadingBessatsu, setLoadingBessatsu] = useState(false);
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(null); // 問題内図画像
  const [loadingQuestionImage, setLoadingQuestionImage] = useState(false);
  const [showQuestionImageModal, setShowQuestionImageModal] = useState(false); // 問題画像モーダル表示
  const choicesRef = useRef<HTMLDivElement>(null);

  // 問題が変わった時に選択状態をリセット
  useEffect(() => {
    setSelectedAnswer(null);
    setShowHint(false);
    setHintUsed(false); // ヒント使用状態もリセット
    setShowBessatsuViewer(false);
    setQuestionImageUrl(null); // 問題画像もリセット
    setShowQuestionImageModal(false);
  }, [question.id]);

  // 別冊画像を読み込む（public/data/bessatsu/から直接読み込む）
  useEffect(() => {
    const loadBessatsuImages = async () => {
      if (question.supplementReferences.length === 0) {
        setBessatsuImages(new Map());
        return;
      }

      setLoadingBessatsu(true);
      const newImages = new Map<number, string>();

      try {
        const { getBessatsuImagePath } = await import('../config/pdfConfig');
        
        // 各別冊参照の画像をpublicフォルダから読み込む
        for (const ref of question.supplementReferences) {
          // imageNumberからページ番号を抽出（例: "12A" -> 12, "1" -> 1）
          const pageNumber = parseInt(ref.imageNumber.replace(/[^0-9]/g, ''), 10);
          
          if (!isNaN(pageNumber) && pageNumber > 0) {
            // WebP画像のパスを取得
            const imagePath = getBessatsuImagePath(
              question.examNumber,
              question.session,
              pageNumber
            );
            
            // 画像ファイルの存在確認
            try {
              const response = await fetch(imagePath, { method: 'HEAD' });
              if (response.ok) {
                // 画像ファイルが存在する場合は、パスをそのまま使用
                newImages.set(pageNumber, imagePath);
                console.log(`[QuestionView] 別冊画像を読み込み: ${imagePath}`);
              } else {
                console.warn(`[QuestionView] 別冊画像が見つかりません: ${imagePath}`);
              }
            } catch (fetchError) {
              console.warn(`[QuestionView] 別冊画像の読み込みに失敗: ${imagePath}`, fetchError);
            }
          } else {
            console.warn(`[QuestionView] 無効な画像番号: ${ref.imageNumber}`);
          }
        }
      } catch (error) {
        console.error('[QuestionView] 別冊画像読み込みエラー:', error);
      } finally {
        setBessatsuImages(newImages);
        setLoadingBessatsu(false);
      }
    };

    loadBessatsuImages();
  }, [question.id, question.supplementReferences, question.examNumber, question.session]);

  // 問題内図画像を読み込む
  useEffect(() => {
    const loadQuestionImage = async () => {
      // 問題に図が含まれているかチェック
      if (!hasQuestionImage(question.examNumber, question.session, question.questionNumber)) {
        setQuestionImageUrl(null);
        return;
      }

      setLoadingQuestionImage(true);
      try {
        const imagePath = getQuestionImagePath(
          question.examNumber,
          question.session,
          question.questionNumber
        );

        // 画像ファイルの存在確認
        const response = await fetch(imagePath, { method: 'HEAD' });
        if (response.ok) {
          setQuestionImageUrl(imagePath);
          console.log(`[QuestionView] 問題画像を読み込み: ${imagePath}`);
        } else {
          console.warn(`[QuestionView] 問題画像が見つかりません: ${imagePath}`);
          setQuestionImageUrl(null);
        }
      } catch (error) {
        console.error('[QuestionView] 問題画像読み込みエラー:', error);
        setQuestionImageUrl(null);
      } finally {
        setLoadingQuestionImage(false);
      }
    };

    loadQuestionImage();
  }, [question.id, question.examNumber, question.session, question.questionNumber]);

  // キーボードショートカット（1-4キーで選択肢を選択）
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (selectedAnswer) return; // 既に回答済み
      
      const key = e.key;
      const choiceIndex = parseInt(key) - 1; // '1' -> 0, '2' -> 1, etc.
      
      if (choiceIndex >= 0 && choiceIndex < question.choices.length) {
        handleAnswerSelect(question.choices[choiceIndex].label);
        // 選択肢エリアにスクロール（視覚的フィードバック）
        choicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedAnswer, question.choices]);

  // 回答処理
  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer) return; // 既に回答済み
    setSelectedAnswer(answer);
    onAnswer(answer);
  };

  // 残り時間の色を決定（テストモード用）
  const getTimeColor = () => {
    if (!remainingTime || !question) return 'text-gray-700';
    const totalTime = totalQuestions * 75;
    const percentage = (remainingTime / totalTime) * 100;

    if (percentage > 50) return 'text-green-600';
    if (percentage > 25) return 'text-yellow-600';
    if (percentage > 10) return 'text-orange-600';
    return 'text-red-600 animate-pulse';
  };

  // 時間表示フォーマット
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 別冊画像がある場合の処理（public/data/bessatsu/から読み込んだ画像パスを使用）
  const supplementImages = question.supplementReferences.map((ref) => {
    // imageNumberからページ番号を抽出（例: "12A" -> 12, "1" -> 1）
    const pageNum = parseInt(ref.imageNumber.replace(/[^0-9]/g, ''), 10);
    return {
      id: ref.supplementId || `${question.examNumber}-${question.session}-${ref.imageNumber}`,
      imageNumber: ref.imageNumber,
      imageData: bessatsuImages.get(pageNum) || '', // 画像パス（/data/bessatsu/...）または空文字列
      pageNumber: pageNum,
    };
  });

  // ヒントを生成（問題が変わるたびに再計算）
  const hint = useMemo(() => generateHint(question), [question]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-auto">
      {/* ヘッダー（固定） */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-3 sm:p-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">
              第 {questionNumber} 問 / {totalQuestions} 問
            </h2>
            <p className="text-xs text-gray-600">
              【第{question.examNumber}回 {question.session === 'gozen' ? '午前' : '午後'} 問{question.questionNumber}】
            </p>
          </div>
          <div className="text-left sm:text-right w-full sm:w-auto">
            {mode === 'learning' && elapsedTime !== undefined && (
              <div className="text-sm text-gray-600">
                経過時間: {formatTime(elapsedTime)}
              </div>
            )}
            {mode === 'test' && remainingTime !== undefined && (
              <div className={`text-base sm:text-lg font-semibold ${getTimeColor()}`}>
                残り時間: {formatTime(remainingTime)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* 別冊画像表示（大きく表示） */}
          {(supplementImages.length > 0 || question.hasSupplementImage) && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-800">📎 別冊画像</h3>
                <button
                  onClick={() => {
                    setBessatsuPage(undefined);
                    setShowBessatsuViewer(true);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  フルスクリーン表示
                </button>
              </div>
              {loadingBessatsu ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                    <span>別冊画像を読み込み中...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {supplementImages.map((img) => (
                    <div
                      key={img.id}
                      className="border-2 border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                      onClick={() => {
                        if (img.imageData) {
                          setBessatsuPage(img.pageNumber);
                          setShowBessatsuViewer(true);
                        }
                      }}
                    >
                      {img.imageData ? (
                        <div className="relative">
                          <img
                            src={img.imageData}
                            alt={`別冊 ${img.imageNumber}`}
                            className="w-full max-h-[60vh] object-contain bg-gray-50"
                          />
                          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            クリックで拡大
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-500">
                          画像を読み込めませんでした
                        </div>
                      )}
                      <div className="bg-gray-50 px-3 py-2 border-t">
                        <p className="text-sm font-medium text-gray-700">別冊 No.{img.imageNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 問題文 */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <div className="mb-3 sm:mb-4">
              {/* 問題文をテキストとして表示 */}
              {question.questionText ? (
                <div>
                  <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                    {question.questionText}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">問題文を読み込み中...</div>
                </div>
              )}
            </div>

            {/* 問題内図画像の表示 */}
            {(questionImageUrl || loadingQuestionImage) && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 問題の図</h4>
                {loadingQuestionImage ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
                      <span className="text-sm">図を読み込み中...</span>
                    </div>
                  </div>
                ) : questionImageUrl && (
                  <div
                    className="border-2 border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => setShowQuestionImageModal(true)}
                  >
                    <div className="relative">
                      <img
                        src={questionImageUrl}
                        alt="問題の図"
                        className="w-full max-h-[50vh] object-contain bg-gray-50"
                      />
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        クリックで拡大
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ヒントボタン（学習モードのみ） */}
            {mode === 'learning' && (
              <div className="mt-3 sm:mt-4">
                <button
                  onClick={() => {
                    const newShowHint = !showHint;
                    setShowHint(newShowHint);
                    // ヒントを初めて開いた時にコールバックを呼び出す
                    if (newShowHint && !hintUsed) {
                      setHintUsed(true);
                      onHintUsed?.();
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg active:bg-yellow-200 flex items-center justify-center gap-2 touch-manipulation text-sm"
                >
                  <span>💡</span>
                  <span>{showHint ? 'ヒントを隠す' : 'ヒントを見る'}{hintUsed ? ' (確認済)' : ''}</span>
                </button>
                {showHint && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    {/* キーワード */}
                    {hint.keywords.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold mb-2 text-yellow-800">🔑 キーワード</h4>
                        <div className="flex flex-wrap gap-2">
                          {hint.keywords.map((keyword, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-white rounded-full text-sm border border-yellow-300 text-yellow-900"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 考え方のヒント */}
                    {hint.thinkingHints.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-yellow-800">💭 考え方のヒント</h4>
                        <ul className="space-y-1">
                          {hint.thinkingHints.map((thinkingHint, index) => (
                            <li
                              key={index}
                              className="text-sm text-gray-700 flex items-start gap-2"
                            >
                              <span className="text-yellow-600 mt-0.5">•</span>
                              <span>{thinkingHint}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* ヒントがない場合 */}
                    {hint.keywords.length === 0 && hint.thinkingHints.length === 0 && (
                      <p className="text-sm text-gray-600">
                        選択肢を一つずつ検討し、消去法も活用しましょう
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 選択肢エリア（問題文の直下に配置） */}
          <div ref={choicesRef} className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-semibold">選択肢</h3>
            <p className="text-xs text-gray-500">キーボード: 1-{question.choices.length}キーで選択</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {question.choices.map((choice, index) => (
              <button
                key={choice.label}
                onClick={() => handleAnswerSelect(choice.label)}
                disabled={!!selectedAnswer}
                className={`text-left p-3 sm:p-4 rounded-lg border-2 transition-all touch-manipulation ${
                  selectedAnswer === choice.label
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 active:bg-gray-50 hover:bg-gray-50'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 font-semibold text-base sm:text-lg text-blue-600">
                    {choice.label.toUpperCase()}.
                  </span>
                  <span className="flex-1 text-sm sm:text-base">{choice.text}</span>
                  <span className="flex-shrink-0 text-xs text-gray-400 font-mono">
                    [{index + 1}]
                  </span>
                </div>
              </button>
            ))}
          </div>
          
          {/* スキップボタン */}
          {onSkip && (
            <div className="mt-3 text-center">
              <button
                onClick={onSkip}
                disabled={!!selectedAnswer}
                className="px-6 py-2 border-2 border-gray-300 rounded-lg active:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation text-sm"
              >
                ⏭ スキップ
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* 画像モーダル */}
      {showImageModal && supplementImages.length > 0 && (
        <ImageModal
          images={supplementImages}
          currentIndex={selectedImageIndex}
          onClose={() => setShowImageModal(false)}
          onNext={() =>
            setSelectedImageIndex(
              (selectedImageIndex + 1) % supplementImages.length
            )
          }
          onPrev={() =>
            setSelectedImageIndex(
              (selectedImageIndex - 1 + supplementImages.length) %
                supplementImages.length
            )
          }
        />
      )}

      {/* 別冊ビューアー（フルスクリーン） */}
      {showBessatsuViewer && (
        <BessatsuViewer
          examNumber={question.examNumber}
          session={question.session}
          pageNumber={bessatsuPage}
          label={bessatsuPage ? `別冊 ページ${bessatsuPage}` : undefined}
          onClose={() => setShowBessatsuViewer(false)}
          fullScreen={true}
        />
      )}

      {/* 問題画像モーダル（フルスクリーン） */}
      {showQuestionImageModal && questionImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setShowQuestionImageModal(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={questionImageUrl}
              alt="問題の図（拡大）"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowQuestionImageModal(false)}
              className="absolute top-4 right-4 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded">
              第{question.examNumber}回 {question.session === 'gozen' ? '午前' : '午後'} 問{question.questionNumber}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionView;
