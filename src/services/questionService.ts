import { Question, FileMetadata } from '../types';
import { extractQuestionsFromPDF } from './pdfParser';
import { detectSupplementReferences, linkSupplementReferences } from './supplementLinker';
import { loadPDFFile } from './pdfLoader';

/**
 * 問題PDFを処理してDBに保存
 */
export async function processQuestionPDF(
  metadata: FileMetadata,
  supplements: Array<{ id: string; imageNumber: string; examNumber: number; session: 'gozen' | 'gogo' }>
): Promise<Question[]> {
  try {
    console.log(`PDFファイルを読み込み中: ${metadata.filename}`);
    
    // PDFファイルを読み込む
    const file = await loadPDFFile(metadata.filename);
    
    console.log(`PDFファイル読み込み成功: ${metadata.filename}, サイズ: ${file.size} bytes`);

    // PDFから問題を抽出
    const questions = await extractQuestionsFromPDF(
      file,
      metadata.year,
      metadata.examNumber,
      metadata.session,
      metadata.filename
    );

    console.log(`抽出された問題数: ${questions.length} (${metadata.filename})`);

    // 各問題の別冊参照を検出・紐付け
    for (const question of questions) {
      // 別冊参照を検出
      const references = detectSupplementReferences(question.questionText);

      if (references.length > 0) {
        // 別冊参照を自動紐付け
        const linkedReferences = linkSupplementReferences(
          references,
          question.examNumber,
          question.session,
          supplements
        );

        question.hasSupplementImage = true;
        question.supplementReferences = linkedReferences;

        // 紐付けエラーの検出（ログ出力用）
        const errors = linkedReferences.filter((ref) => !ref.supplementId);
        if (errors.length > 0) {
          console.warn(
            `警告: 問題 ${question.id} で別冊参照の紐付けエラーが ${errors.length} 件あります`
          );
        }
      }
    }

    return questions;
  } catch (error: any) {
    console.error(`PDF処理エラー (${metadata.filename}):`, error);
    throw new Error(`PDFファイルの処理に失敗しました: ${metadata.filename} - ${error.message}`);
  }
}
