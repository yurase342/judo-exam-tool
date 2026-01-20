import * as pdfjsLib from 'pdfjs-dist';
import { Supplement } from '../types';

// PDF.jsのワーカー設定（Web環境用）
if (typeof window !== 'undefined') {
  // publicフォルダからワーカーを読み込む（Vite用）
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

/**
 * PDFページを画像として抽出（Web環境用）
 */
async function extractPageAsImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number = 2.0
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Canvasを使用して画像に変換
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context取得に失敗しました');
  }

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  } as any;
  await page.render(renderContext).promise;

  // CanvasをBase64データURLに変換
  return canvas.toDataURL('image/png');
}

/**
 * 別冊PDFから画像番号を認識
 * パターン: "No.1", "No.12A", "図A", "写真1" など
 */
export function detectImageNumber(text: string): string | null {
  // パターン1: "No.1", "No.12A" など
  const pattern1 = /No\.\s*(\d+[A-Za-z]?)/i;
  const match1 = text.match(pattern1);
  if (match1) {
    return match1[1];
  }

  // パターン2: "図A", "図B" など
  const pattern2 = /図\s*([A-Za-z])/;
  const match2 = text.match(pattern2);
  if (match2) {
    return `図${match2[1]}`;
  }

  // パターン3: "写真1", "写真2" など
  const pattern3 = /写真\s*(\d+)/;
  const match3 = text.match(pattern3);
  if (match3) {
    return `写真${match3[1]}`;
  }

  return null;
}

/**
 * 別冊画像から対応する問題番号を検出
 * パターン: "午後問題○問", "午前問題○問", "問題○" など
 */
export function detectQuestionNumbersFromImage(text: string): number[] {
  const questionNumbers: number[] = [];
  
  // パターン1: "午後問題○問" または "午前問題○問"
  const pattern1 = /(午後|午前)問題\s*(\d+)\s*問/g;
  let match1;
  while ((match1 = pattern1.exec(text)) !== null) {
    const questionNum = parseInt(match1[2], 10);
    if (!isNaN(questionNum) && questionNum > 0) {
      questionNumbers.push(questionNum);
    }
  }
  
  // パターン2: "問題○" (より一般的なパターン)
  const pattern2 = /問題\s*(\d+)/g;
  let match2;
  while ((match2 = pattern2.exec(text)) !== null) {
    const questionNum = parseInt(match2[1], 10);
    if (!isNaN(questionNum) && questionNum > 0 && !questionNumbers.includes(questionNum)) {
      questionNumbers.push(questionNum);
    }
  }
  
  // パターン3: "問○" (短縮形)
  const pattern3 = /問\s*(\d+)/g;
  let match3;
  while ((match3 = pattern3.exec(text)) !== null) {
    const questionNum = parseInt(match3[1], 10);
    if (!isNaN(questionNum) && questionNum > 0 && !questionNumbers.includes(questionNum)) {
      questionNumbers.push(questionNum);
    }
  }
  
  return questionNumbers;
}

/**
 * 画像タイプを判定
 */
export function detectImageType(text: string): Supplement['imageType'] {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('ct') || lowerText.includes('ct画像')) {
    return 'ct';
  }
  if (lowerText.includes('x線') || lowerText.includes('xray') || lowerText.includes('レントゲン')) {
    return 'xray';
  }
  if (lowerText.includes('心電図') || lowerText.includes('ecg') || lowerText.includes('ekg')) {
    return 'ecg';
  }
  if (lowerText.includes('写真') || lowerText.includes('photo')) {
    return 'photo';
  }
  if (lowerText.includes('グラフ') || lowerText.includes('graph') || lowerText.includes('chart')) {
    return 'graph';
  }
  if (lowerText.includes('表') || lowerText.includes('table')) {
    return 'table';
  }

  return 'other';
}

/**
 * 別冊PDFから画像を抽出（Web環境用）
 */
export async function extractSupplementsFromPDF(
  file: File | ArrayBuffer,
  year: number,
  examNumber: number,
  session: 'gozen' | 'gogo',
  sourceFile: string
): Promise<Supplement[]> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: file instanceof File ? await file.arrayBuffer() : file,
    });
    const pdf = await loadingTask.promise;
    const supplements: Supplement[] = [];

    // 各ページからテキストと画像を抽出
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');

      // 画像番号を検出
      const imageNumber = detectImageNumber(pageText);
      if (!imageNumber) {
        // 画像番号が見つからない場合でも、問題番号が検出できれば続行
        const questionNumbers = detectQuestionNumbersFromImage(pageText);
        if (questionNumbers.length === 0) {
          continue;
        }
        // 画像番号がない場合は、ページ番号を画像番号として使用
        const fallbackImageNumber = `page${pageNum}`;
        
        // 画像を抽出
        const imageData = await extractPageAsImage(pdf, pageNum);
        const imageType = detectImageType(pageText);
        const supplementId = `${examNumber}-${session}-${fallbackImageNumber}`;
        
        supplements.push({
          id: supplementId,
          year,
          examNumber,
          session,
          imageNumber: fallbackImageNumber,
          imageData,
          imageType,
          caption: pageText.substring(0, 100),
          relatedImages: [],
          sourceFile,
          sourcePage: pageNum,
          questionNumbers,
        });
        continue;
      }

      // 画像タイプを判定
      const imageType = detectImageType(pageText);

      // 対応する問題番号を検出（画像の右上などに記載されている場合）
      const questionNumbers = detectQuestionNumbersFromImage(pageText);

      // 画像を抽出
      const imageData = await extractPageAsImage(pdf, pageNum);

      const supplementId = `${examNumber}-${session}-${imageNumber}`;

      supplements.push({
        id: supplementId,
        year,
        examNumber,
        session,
        imageNumber,
        imageData,
        imageType,
        caption: pageText.substring(0, 100), // 簡易的に最初の100文字をキャプションに
        relatedImages: [], // 関連画像は後で処理
        sourceFile,
        sourcePage: pageNum,
        questionNumbers: questionNumbers.length > 0 ? questionNumbers : undefined,
      });
    }

    return supplements;
  } catch (error) {
    throw new Error(`別冊PDFの読み込みに失敗しました: ${error}`);
  }
}
