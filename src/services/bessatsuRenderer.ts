/**
 * 別冊PDFをページごとに画像としてレンダリングするサービス
 */

import { SessionType } from '../types';
import { getBessatsuPdfPath } from '../config/pdfConfig';

// キャッシュ：レンダリング済み画像を保存
const imageCache = new Map<string, string>();

/**
 * 別冊PDFの特定ページを画像としてレンダリング
 * @param examNumber 回次
 * @param session セッション（午前/午後）
 * @param pageNumber ページ番号（1-indexed）
 * @param scale 画像のスケール（デフォルト: 2.0 = 高解像度）
 * @returns Base64エンコードされた画像データURL
 */
export async function renderBessatsuPage(
  examNumber: number,
  session: SessionType,
  pageNumber: number,
  scale: number = 2.0
): Promise<string | null> {
  const cacheKey = `${examNumber}-${session}-${pageNumber}-${scale}`;

  // キャッシュチェック
  if (imageCache.has(cacheKey)) {
    console.log(`[bessatsuRenderer] キャッシュヒット: ${cacheKey}`);
    return imageCache.get(cacheKey)!;
  }

  const pdfPath = getBessatsuPdfPath(examNumber, session);
  if (!pdfPath) {
    console.warn(`[bessatsuRenderer] 別冊PDFパスがありません: 第${examNumber}回 ${session}`);
    return null;
  }

  console.log(`[bessatsuRenderer] 別冊PDF読み込み開始: ${pdfPath}, ページ${pageNumber}`);

  try {
    const response = await fetch(pdfPath);
    if (!response.ok) {
      throw new Error(`別冊PDFの読み込みに失敗: ${pdfPath}`);
    }

    const blob = await response.blob();
    const imageDataUrl = await renderPdfPageToImage(blob, pageNumber, scale);

    // キャッシュに保存
    if (imageDataUrl) {
      imageCache.set(cacheKey, imageDataUrl);
    }

    return imageDataUrl;
  } catch (error) {
    console.error(`[bessatsuRenderer] レンダリングエラー:`, error);
    return null;
  }
}

/**
 * 別冊PDFの全ページを画像として取得
 * @param examNumber 回次
 * @param session セッション
 * @param scale 画像のスケール
 * @returns ページ番号→画像データURLのMap
 */
export async function renderAllBessatsuPages(
  examNumber: number,
  session: SessionType,
  scale: number = 2.0
): Promise<Map<number, string>> {
  const result = new Map<number, string>();

  const pdfPath = getBessatsuPdfPath(examNumber, session);
  if (!pdfPath) {
    console.warn(`[bessatsuRenderer] 別冊PDFパスがありません: 第${examNumber}回 ${session}`);
    return result;
  }

  try {
    const response = await fetch(pdfPath);
    if (!response.ok) {
      throw new Error(`別冊PDFの読み込みに失敗: ${pdfPath}`);
    }

    const blob = await response.blob();
    const totalPages = await getPdfPageCount(blob);

    console.log(`[bessatsuRenderer] 別冊PDF全ページレンダリング開始: ${totalPages}ページ`);

    for (let page = 1; page <= totalPages; page++) {
      const cacheKey = `${examNumber}-${session}-${page}-${scale}`;

      if (imageCache.has(cacheKey)) {
        result.set(page, imageCache.get(cacheKey)!);
      } else {
        const imageDataUrl = await renderPdfPageToImage(blob, page, scale);
        if (imageDataUrl) {
          imageCache.set(cacheKey, imageDataUrl);
          result.set(page, imageDataUrl);
        }
      }
    }

    console.log(`[bessatsuRenderer] 全ページレンダリング完了: ${result.size}ページ`);
    return result;
  } catch (error) {
    console.error(`[bessatsuRenderer] 全ページレンダリングエラー:`, error);
    return result;
  }
}

/**
 * PDFの総ページ数を取得
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
 * 別冊PDFの総ページ数を取得
 */
export async function getBessatsuPageCount(
  examNumber: number,
  session: SessionType
): Promise<number> {
  const pdfPath = getBessatsuPdfPath(examNumber, session);
  if (!pdfPath) {
    return 0;
  }

  try {
    const response = await fetch(pdfPath);
    if (!response.ok) {
      return 0;
    }

    const blob = await response.blob();
    return await getPdfPageCount(blob);
  } catch {
    return 0;
  }
}

/**
 * PDFの特定ページをCanvas経由で画像にレンダリング
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

  keysToDelete.forEach(key => imageCache.delete(key));
  console.log(`[bessatsuRenderer] 第${examNumber}回${session ? ` ${session}` : ''}のキャッシュをクリア: ${keysToDelete.length}件`);
}
