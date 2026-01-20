import { useState } from 'react';

interface ImageModalProps {
  images: Array<{ id: string; imageNumber: string; imageData: string }>;
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}) => {
  const [zoom, setZoom] = useState(1);

  const currentImage = images[currentIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold">
            別冊 No.{currentImage.imageNumber}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 active:text-gray-700 text-2xl sm:text-3xl touch-manipulation"
          >
            ✕
          </button>
        </div>

        {/* 画像表示 */}
        <div className="mb-4 flex justify-center">
          {currentImage.imageData ? (
            <img
              src={currentImage.imageData}
              alt={`別冊 No.${currentImage.imageNumber}`}
              className="max-w-full max-h-[60vh]"
              style={{ transform: `scale(${zoom})` }}
            />
          ) : (
            <div className="w-96 h-96 bg-gray-200 rounded flex items-center justify-center">
              <p className="text-gray-500">画像データがありません</p>
            </div>
          )}
        </div>

        {/* コントロール */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
          <button
            onClick={onPrev}
            disabled={images.length <= 1}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gray-200 rounded-lg active:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation text-sm sm:text-base"
          >
            ← 前
          </button>

          <div className="flex gap-2 flex-wrap justify-center">
            {images.map((img, index) => (
              <button
                key={img.id}
                onClick={() => {
                  // インデックス変更処理（親コンポーネントで管理）
                }}
                className={`px-3 py-2 sm:py-1 rounded text-xs sm:text-sm touch-manipulation ${
                  index === currentIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 active:bg-gray-300'
                }`}
              >
                {img.imageNumber}
              </button>
            ))}
          </div>

          <button
            onClick={onNext}
            disabled={images.length <= 1}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gray-200 rounded-lg active:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation text-sm sm:text-base"
          >
            次 →
          </button>
        </div>

        {/* ズームコントロール */}
        <div className="mt-4 flex flex-wrap justify-center items-center gap-3 sm:gap-4">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="px-4 py-2 bg-gray-200 rounded active:bg-gray-300 touch-manipulation text-sm sm:text-base"
          >
            -
          </button>
          <span className="text-xs sm:text-sm">ズーム: {Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="px-4 py-2 bg-gray-200 rounded active:bg-gray-300 touch-manipulation text-sm sm:text-base"
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-4 py-2 bg-gray-200 rounded active:bg-gray-300 touch-manipulation text-sm sm:text-base"
          >
            リセット
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
