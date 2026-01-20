import { FileMetadata } from '../types';
import { parseFilename } from './filenameParser';
import { getAllPdfFilenames, PDF_BASE_PATHS } from '../config/pdfConfig';

/**
 * public/pdfsフォルダからPDFファイルのメタデータを取得
 */
export async function loadPDFMetadata(): Promise<FileMetadata[]> {
  // 設定ファイルからPDFファイル名リストを取得
  const knownFiles = getAllPdfFilenames();

  const metadata: FileMetadata[] = [];

  for (const filename of knownFiles) {
    const parsed = parseFilename(filename, `${PDF_BASE_PATHS.questions}${filename}`);
    if (parsed) {
      metadata.push(parsed);
    }
  }

  return metadata;
}

/**
 * PDFファイルを読み込む
 */
export async function loadPDFFile(filename: string): Promise<File> {
  try {
    const pdfPath = `${PDF_BASE_PATHS.questions}${filename}`;
    console.log(`PDFファイルをフェッチ中: ${pdfPath}`);
    const response = await fetch(pdfPath);

    if (!response.ok) {
      console.error(`PDFファイルのフェッチに失敗: ${filename}, ステータス: ${response.status}`);
      throw new Error(`PDFファイルの読み込みに失敗しました: ${filename} (HTTP ${response.status})`);
    }

    const blob = await response.blob();
    console.log(`PDFファイル読み込み成功: ${filename}, サイズ: ${blob.size} bytes`);

    if (blob.size === 0) {
      throw new Error(`PDFファイルが空です: ${filename}`);
    }

    return new File([blob], filename, { type: 'application/pdf' });
  } catch (error: any) {
    console.error(`PDFファイル読み込みエラー: ${filename}`, error);
    throw error;
  }
}

/**
 * 正答PDFファイルを読み込む
 */
export async function loadAnswerPDFFile(filename: string): Promise<File> {
  try {
    const pdfPath = `${PDF_BASE_PATHS.answers}${filename}`;
    console.log(`正答PDFファイルをフェッチ中: ${pdfPath}`);
    const response = await fetch(pdfPath);

    if (!response.ok) {
      console.error(`正答PDFファイルのフェッチに失敗: ${filename}, ステータス: ${response.status}`);
      throw new Error(`正答PDFファイルの読み込みに失敗しました: ${filename} (HTTP ${response.status})`);
    }

    const blob = await response.blob();
    console.log(`正答PDFファイル読み込み成功: ${filename}, サイズ: ${blob.size} bytes`);

    if (blob.size === 0) {
      throw new Error(`正答PDFファイルが空です: ${filename}`);
    }

    return new File([blob], filename, { type: 'application/pdf' });
  } catch (error: any) {
    console.error(`正答PDFファイル読み込みエラー: ${filename}`, error);
    throw error;
  }
}
