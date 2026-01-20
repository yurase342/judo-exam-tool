/**
 * 別冊画像を読み込むサービス
 * PDFからの動的レンダリングではなく、事前に変換されたWebP画像を読み込む
 */

import { SessionType } from '../types';
import { getBessatsuImagePath, getBessatsuPdfPath } from '../config/pdfConfig';

// キャッシュ：読み込み済み画像を保存
const imageCache = new Map<string, string>();

// 画像の存在確認キャッシュ（404を繰り返さないため）
const existenceCache = new Map<string, boolean>();

/**
 * 別冊画像を取得（WebP画像を直接読み込み）
 * @param examNumber 回次
 * @param session セッション（午前/午後）
 * @param pageNumber ページ番号（1-indexed）
 * @returns Base64エンコードされた画像データURL、または画像URL
 */
export async function renderBessatsuPage(
  examNumber: number,
  session: SessionType,
  pageNumber: number,
  _scale: number = 2.0 // 互換性のため残すが、WebP画像では使用しない
): Promise<string | null> {
  const cacheKey = `${examNumber}-${session}-${pageNumber}`;

  // キャッシュチェック
  if (imageCache.has(cacheKey)) {
    console.log(`[bessatsuRenderer] キャッシュヒット: ${cacheKey}`);
    return imageCache.get(cacheKey)!;
  }

  // 存在しないことが確認済みの場合はスキップ
  if (existenceCache.get(cacheKey) === false) {
    console.log(`[bessatsuRenderer] 存在しないことが確認済み: ${cacheKey}`);
    return null;
  }

  // WebP画像のパスを取得
  const imagePath = getBessatsuImagePath(examNumber, session, pageNumber);
  console.log(`[bessatsuRenderer] 別冊画像読み込み開始: ${imagePath}`);

  try {
    const response = await fetch(imagePath);
    if (!response.ok) {
      console.warn(`[bessatsuRenderer] 別冊画像が見つかりません: ${imagePath}`);
      existenceCache.set(cacheKey, false);

      // フォールバック: PDFからの読み込みを試みる（Vercel以外の環境用）
      return await fallbackToPdfRendering(examNumber, session, pageNumber);
    }

    // 画像が存在する
    existenceCache.set(cacheKey, true);

    // Blobとして読み込み、Base64に変換
    const blob = await response.blob();
    const imageDataUrl = await blobToDataUrl(blob);

    // キャッシュに保存
    if (imageDataUrl) {
      imageCache.set(cacheKey, imageDataUrl);
    }

    console.log(`[bessatsuRenderer] 別冊画像読み込み完了: ${imagePath}`);
    return imageDataUrl;
  } catch (error) {
    console.error(`[bessatsuRenderer] 画像読み込みエラー:`, error);
    existenceCache.set(cacheKey, false);

    // フォールバック: PDFからの読み込みを試みる
    return await fallbackToPdfRendering(examNumber, session, pageNumber);
  }
}

/**
 * フォールバック: PDFから動的にレンダリング（ローカル開発用）
 */
async function fallbackToPdfRendering(
  examNumber: number,
  session: SessionType,
  pageNumber: number
): Promise<string | null> {
  const pdfPath = getBessatsuPdfPath(examNumber, session);
  if (!pdfPath) {
    console.warn(`[bessatsuRenderer] 別冊PDFパスもありません: 第${examNumber}回 ${session}`);
    return null;
  }

  console.log(`[bessatsuRenderer] PDFフォールバック試行: ${pdfPath}, ページ${pageNumber}`);

  try {
    const response = await fetch(pdfPath);
    if (!response.ok) {
      console.warn(`[bessatsuRenderer] PDFも見つかりません: ${pdfPath}`);
      return null;
    }

    const blob = await response.blob();
    const imageDataUrl = await renderPdfPageToImage(blob, pageNumber, 2.0);

    // キャッシュに保存
    if (imageDataUrl) {
      const cacheKey = `${examNumber}-${session}-${pageNumber}`;
      imageCache.set(cacheKey, imageDataUrl);
    }

    return imageDataUrl;
  } catch (error) {
    console.error(`[bessatsuRenderer] PDFフォールバックエラー:`, error);
    return null;
  }
}

/**
 * BlobをBase64データURLに変換
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 別冊画像の全ページを取得
 * @param examNumber 回次
 * @param session セッション
 * @returns ページ番号→画像データURLのMap
 */
export async function renderAllBessatsuPages(
  examNumber: number,
  session: SessionType,
  _scale: number = 2.0
): Promise<Map<number, string>> {
  const result = new Map<number, string>();

  // 最大ページ数を試行（通常は10ページ程度）
  const MAX_PAGES = 30;

  console.log(`[bessatsuRenderer] 別冊画像全ページ読み込み開始: 第${examNumber}回 ${session}`);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const imageDataUrl = await renderBessatsuPage(examNumber, session, page);

    if (imageDataUrl) {
      result.set(page, imageDataUrl);
    } else {
      // 連続して3ページ見つからなければ終了
      const notFoundCount = page - result.size;
      if (notFoundCount >= 3 && result.size > 0) {
        break;
      }
    }
  }

  console.log(`[bessatsuRenderer] 全ページ読み込み完了: ${result.size}ページ`);
  return result;
}

/**
 * PDFの総ページ数を取得（フォールバック用）
 */
export async function getPdfPageCount(blob: Blob): Promise<number> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

  const arrayBuffer = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 });
  const pdf = await loadingTask.promise;

  return pdf.numPages;
}

/**
 * 別冊の総ページ数を取得
 */
export async function getBessatsuPageCount(
  examNumber: number,
  session: SessionType
): Promise<number> {
  // WebP画像の場合、実際に存在するページ数をカウント
  let count = 0;
  const MAX_PAGES = 30;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const imagePath = getBessatsuImagePath(examNumber, session, page);
    try {
      const response = await fetch(imagePath, { method: 'HEAD' });
      if (response.ok) {
        count = page;
      } else {
        // 連続して3ページ見つからなければ終了
        if (page - count >= 3 && count > 0) {
          break;
        }
      }
    } catch {
      if (page - count >= 3 && count > 0) {
        break;
      }
    }
  }

  return count;
}

/**
 * PDFの特定ページをCanvas経由で画像にレンダリング（フォールバック用）
 */
async function renderPdfPageToImage(
  blob: Blob,
  pageNumber: number,
  scale: number
): Promise<string | null> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 });
    const pdf = await loadingTask.promise;

    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      console.warn(`[bessatsuRenderer] 無効なページ番号: ${pageNumber} (総ページ数: ${pdf.numPages})`);
      return null;
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // Canvasを作成
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context を取得できません');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // ページをレンダリング
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({
      canvasContext: context,
      viewport: viewport,
    } as any).promise;

    // 画像データURLに変換
    const imageDataUrl = canvas.toDataURL('image/png');

    console.log(`[bessatsuRenderer] ページ${pageNumber}レンダリング完了 (${canvas.width}x${canvas.height})`);

    return imageDataUrl;
  } catch (error) {
    console.error(`[bessatsuRenderer] ページレンダリングエラー:`, error);
    return null;
  }
}

/**
 * キャッシュをクリア
 */
export function clearBessatsuCache(): void {
  imageCache.clear();
  existenceCache.clear();
  console.log('[bessatsuRenderer] キャッシュをクリアしました');
}

/**
 * 特定の試験回次のキャッシュをクリア
 */
export function clearBessatsuCacheForExam(examNumber: number, session?: SessionType): void {
  const keysToDelete: string[] = [];

  for (const key of imageCache.keys()) {
    if (key.startsWith(`${examNumber}-`)) {
      if (!session || key.startsWith(`${examNumber}-${session}-`)) {
        keysToDelete.push(key);
      }
    }
  }

  keysToDelete.forEach(key => {
    imageCache.delete(key);
    existenceCache.delete(key);
  });
  console.log(`[bessatsuRenderer] 第${examNumber}回${session ? ` ${session}` : ''}のキャッシュをクリア: ${keysToDelete.length}件`);
}
