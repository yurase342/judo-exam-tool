/**
 * 別冊画像ビューアーコンポーネント
 * 別冊PDFのページを画像として表示する
 */

import React, { useState, useEffect } from 'react';
import { SessionType } from '../types';
import { getBessatsuPageCount } from '../services/bessatsuRenderer';

interface BessatsuViewerProps {
  examNumber: number;
  session: SessionType;
  pageNumber?: number; // 特定ページのみ表示する場合
  label?: string; // 「別冊No.1」などのラベル
  onClose?: () => void;
  fullScreen?: boolean;
}

export const BessatsuViewer: React.FC<BessatsuViewerProps> = ({
  examNumber,
  session,
  pageNumber,
  label,
  onClose,
  fullScreen = false,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);

  // 総ページ数を取得
  useEffect(() => {
    const fetchPageCount = async () => {
      const count = await getBessatsuPageCount(examNumber, session);
      setTotalPages(count);
    };
    fetchPageCount();
  }, [examNumber, session]);

  // ページ画像を読み込む（public/data/bessatsu/から直接読み込む）
  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      setError(null);

      try {
        const { getBessatsuImagePath } = await import('../config/pdfConfig');
        const imagePath = getBessatsuImagePath(examNumber, session, currentPage);
        
        // 画像ファイルの存在確認
        const response = await fetch(imagePath, { method: 'HEAD' });
        if (response.ok) {
          // 画像ファイルが存在する場合は、パスをそのまま使用
          setImageUrl(imagePath);
        } else {
          // 画像ファイルが見つからない場合は、PDFから動的に読み込む（フォールバック）
          console.warn(`[BessatsuViewer] 画像ファイルが見つかりません: ${imagePath}、PDFから読み込みます`);
          const { renderBessatsuPage } = await import('../services/bessatsuRenderer');
          const url = await renderBessatsuPage(examNumber, session, currentPage);
          if (url) {
            setImageUrl(url);
          } else {
            setError('画像の読み込みに失敗しました');
          }
        }
      } catch (err) {
        setError('画像の読み込み中にエラーが発生しました');
        console.error('[BessatsuViewer] エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [examNumber, session, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div style={containerStyle}>
      {/* ヘッダー */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: fullScreen ? '#333' : '#fff',
          borderBottom: '1px solid #ddd',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, color: fullScreen ? '#fff' : '#333' }}>
            {label || `第${examNumber}回 ${session === 'gozen' ? '午前' : '午後'} 別冊`}
          </h3>
          {!pageNumber && totalPages > 0 && (
            <span style={{ color: fullScreen ? '#ccc' : '#666' }}>
              ページ {currentPage} / {totalPages}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* ズームコントロール */}
          <button
            onClick={handleZoomOut}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: fullScreen ? '#555' : '#e0e0e0',
              color: fullScreen ? '#fff' : '#333',
              cursor: 'pointer',
            }}
            disabled={zoom <= 0.5}
          >
            −
          </button>
          <span
            style={{
              minWidth: '60px',
              textAlign: 'center',
              color: fullScreen ? '#fff' : '#333',
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: fullScreen ? '#555' : '#e0e0e0',
              color: fullScreen ? '#fff' : '#333',
              cursor: 'pointer',
            }}
            disabled={zoom >= 3}
          >
            +
          </button>
          <button
            onClick={handleZoomReset}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: fullScreen ? '#555' : '#e0e0e0',
              color: fullScreen ? '#fff' : '#333',
              cursor: 'pointer',
              marginLeft: '8px',
            }}
          >
            リセット
          </button>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#dc3545',
                color: '#fff',
                cursor: 'pointer',
                marginLeft: '16px',
              }}
            >
              閉じる
            </button>
          )}
        </div>
      </div>

      {/* 画像表示エリア */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '16px',
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
              color: fullScreen ? '#fff' : '#666',
            }}
          >
            <span>読み込み中...</span>
          </div>
        ) : error ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
              color: '#dc3545',
            }}
          >
            <span>{error}</span>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`別冊ページ ${currentPage}`}
            style={{
              maxWidth: '100%',
              height: 'auto',
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
              color: fullScreen ? '#fff' : '#666',
            }}
          >
            <span>別冊画像がありません</span>
          </div>
        )}
      </div>

      {/* ページナビゲーション（複数ページの場合のみ） */}
      {!pageNumber && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            padding: '12px',
            backgroundColor: fullScreen ? '#333' : '#fff',
            borderTop: '1px solid #ddd',
          }}
        >
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            style={{
              padding: '8px 24px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: currentPage <= 1 ? '#ccc' : '#007bff',
              color: '#fff',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            ← 前のページ
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (page >= 1 && page <= totalPages) {
                  setCurrentPage(page);
                }
              }}
              style={{
                width: '60px',
                padding: '6px',
                textAlign: 'center',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <span style={{ color: fullScreen ? '#fff' : '#333' }}>
              / {totalPages}
            </span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            style={{
              padding: '8px 24px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: currentPage >= totalPages ? '#ccc' : '#007bff',
              color: '#fff',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            次のページ →
          </button>
        </div>
      )}
    </div>
  );
};

export default BessatsuViewer;
