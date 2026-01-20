/**
 * 正答PDFから問題データを生成するサービス
 * スキャン画像PDFに対応：
 * 1. まずJSONファイルからの読み込みを試みる
 * 2. JSONがない場合、PDFからテキスト抽出を試みる
 * 3. PDFがスキャン画像の場合、JSONファイル作成を促すエラーを表示
 */

import { Question, Choice, SessionType } from '../types';
import { parseAnswerText } from './answerParser';
import {
  getAnswerPdfPath as getAnswerPdfPathFromConfig,
  getQuestionPdfPath as getQuestionPdfPathFromConfig,
  getBessatsuPdfPath,
  getAvailableExamNumbers,
  getExamConfig,
} from '../config/pdfConfig';
import { loadQuestionsFromJson } from './jsonQuestionLoader';
import { getQuestionDataPath } from '../types/questionData';
import * as pdfjsLib from 'pdfjs-dist';

// PDFテキストアイテムの型定義
interface PdfTextItem {
  str: string;
  transform?: number[];
}

// PDF.jsのワーカー設定
if (typeof window !== 'undefined') {
  // publicフォルダからワーカーを読み込む（Vite用）
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

/**
 * PDFファイルの存在確認
 */
async function checkPdfExists(pdfPath: string): Promise<boolean> {
  try {
    const response = await fetch(pdfPath, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * PDFからテキストを抽出
 */
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  try {
    console.log(`[extractTextFromPDF] PDFを読み込み中: ${pdfPath}`);
    
    // PDFファイルの存在確認
    const exists = await checkPdfExists(pdfPath);
    if (!exists) {
      const errorMsg = `PDFファイルが見つかりません: ${pdfPath}（ファイルが存在しないか、パスが間違っています）`;
      console.error(`[extractTextFromPDF] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    const response = await fetch(pdfPath);
    if (!response.ok) {
      const errorMsg = `PDF読み込み失敗: ${pdfPath} (HTTP ${response.status} ${response.statusText})`;
      console.error(`[extractTextFromPDF] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[extractTextFromPDF] PDFサイズ: ${arrayBuffer.byteLength} bytes`);

    if (arrayBuffer.byteLength === 0) {
      throw new Error(`PDFファイルが空です: ${pdfPath}`);
    }

    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0, // エラーレベルのログのみ
    });
    
    const pdf = await loadingTask.promise;
    console.log(`[extractTextFromPDF] ページ数: ${pdf.numPages}`);

    if (pdf.numPages === 0) {
      throw new Error(`PDFにページがありません: ${pdfPath}`);
    }

    let fullText = '';
    let extractedPages = 0;
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // テキストアイテムを位置情報でソートして結合
        const items = textContent.items as PdfTextItem[];
        
        if (items.length === 0) {
          console.warn(`[extractTextFromPDF] 警告: ページ${pageNum}にテキストが見つかりません（スキャン画像の可能性）`);
          continue;
        }
        
        const sortedItems = [...items].sort((a, b) => {
          // Y座標（上から下）で比較、同じ行ならX座標（左から右）で比較
          const aTransform = a.transform || [1, 0, 0, 1, 0, 0];
          const bTransform = b.transform || [1, 0, 0, 1, 0, 0];
          const yDiff = bTransform[5] - aTransform[5];
          if (Math.abs(yDiff) > 5) return yDiff;
          return aTransform[4] - bTransform[4];
        });

        const pageText = sortedItems.map(item => item.str).join(' ');
        fullText += pageText + '\n';
        extractedPages++;
      } catch (pageError: any) {
        console.error(`[extractTextFromPDF] ページ${pageNum}の処理エラー:`, pageError);
        // ページエラーは続行
      }
    }

    console.log(`[extractTextFromPDF] 抽出テキスト長: ${fullText.length}文字 (${extractedPages}/${pdf.numPages}ページから抽出)`);
    
    if (fullText.trim().length === 0) {
      throw new Error(`PDFからテキストを抽出できませんでした（スキャン画像PDFの可能性）: ${pdfPath}`);
    }
    
    return fullText;
  } catch (error: any) {
    console.error(`[extractTextFromPDF] PDF読み込みエラー: ${pdfPath}`, error);
    const errorMessage = error?.message || String(error);
    throw new Error(`PDFテキスト抽出エラー: ${pdfPath} - ${errorMessage}`);
  }
}

/**
 * PDFページを画像として抽出（軽量化版）
 */
async function extractPageAsImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number = 1.5 // スケールを下げて処理を軽量化
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

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

  return canvas.toDataURL('image/jpeg', 0.85); // JPEG形式で圧縮率を下げてファイルサイズを削減
}

/**
 * PDFページを画像として取得（遅延読み込み用）
 */
export async function getQuestionPageImageLazy(
  questionPdfPath: string,
  pageNumber: number
): Promise<string | null> {
  try {
    const response = await fetch(questionPdfPath);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0,
    });
    const pdf = await loadingTask.promise;

    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      return null;
    }

    const imageData = await extractPageAsImage(pdf, pageNumber);
    return imageData;
  } catch (error) {
    console.error(`問題ページ画像抽出エラー:`, error);
    return null;
  }
}

/**
 * JSONファイルの存在確認
 */
async function checkJsonExists(examNumber: number, session: SessionType): Promise<boolean> {
  const jsonPath = getQuestionDataPath(examNumber, session);
  try {
    const response = await fetch(jsonPath, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 問題データを生成（JSONまたはPDFから）
 */
export async function generateQuestionsFromAnswerPdf(
  examNumber: number,
  session: SessionType
): Promise<Question[]> {
  console.log(`[generateQuestionsFromAnswerPdf] 開始: 第${examNumber}回 ${session}`);

  // まずJSONファイルからの読み込みを試みる
  const jsonExists = await checkJsonExists(examNumber, session);
  if (jsonExists) {
    console.log(`[generateQuestionsFromAnswerPdf] JSONファイルから読み込み: 第${examNumber}回 ${session}`);
    const jsonQuestions = await loadQuestionsFromJson(examNumber, session);
    if (jsonQuestions.length > 0) {
      console.log(`[generateQuestionsFromAnswerPdf] JSONから${jsonQuestions.length}問を読み込み`);
      return jsonQuestions;
    }
    console.warn(`[generateQuestionsFromAnswerPdf] JSONファイルが空です。PDFからの読み込みを試みます。`);
  }

  // JSONがない場合、PDFから読み込み
  console.log(`[generateQuestionsFromAnswerPdf] PDFから読み込み: 第${examNumber}回 ${session}`);

  const questions: Question[] = [];

  // 試験設定を取得
  const examConfig = getExamConfig(examNumber);
  if (!examConfig) {
    console.warn(`試験設定が見つかりません: 第${examNumber}回`);
    return questions;
  }

  // 正答PDFのパスを取得
  const answerPdfPath = getAnswerPdfPathFromConfig(examNumber);
  if (!answerPdfPath) {
    const errorMsg = `正答PDFが見つかりません: 第${examNumber}回（設定ファイルを確認してください）`;
    console.error(`[generateQuestionsFromAnswerPdf] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  console.log(`[generateQuestionsFromAnswerPdf] 正答PDFパス: ${answerPdfPath}`);

  // 問題PDFのパスを取得
  const questionPdfPath = getQuestionPdfPathFromConfig(examNumber, session);
  if (!questionPdfPath) {
    const errorMsg = `問題PDFが見つかりません: 第${examNumber}回 ${session}（設定ファイルを確認してください）`;
    console.error(`[generateQuestionsFromAnswerPdf] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  console.log(`[generateQuestionsFromAnswerPdf] 問題PDFパス: ${questionPdfPath}`);

  // 別冊PDFのパスを取得（問題表示用）
  const bessatsuPdfPath = getBessatsuPdfPath(examNumber, session);
  
  // 別冊PDFを読み込んで、画像から問題番号を検出
  let supplements: Array<{ id: string; imageNumber: string; examNumber: number; session: 'gozen' | 'gogo'; questionNumbers?: number[] }> = [];
  if (bessatsuPdfPath) {
    try {
      console.log(`[generateQuestionsFromAnswerPdf] 別冊PDFを読み込み中: ${bessatsuPdfPath}`);
      const { extractSupplementsFromPDF } = await import('./supplementExtractor');
      const response = await fetch(bessatsuPdfPath);
      if (response.ok) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const extractedSupplements = await extractSupplementsFromPDF(
          arrayBuffer,
          examConfig.year,
          examNumber,
          session,
          bessatsuPdfPath
        );
        supplements = extractedSupplements.map(supp => ({
          id: supp.id,
          imageNumber: supp.imageNumber,
          examNumber: supp.examNumber,
          session: supp.session,
          questionNumbers: supp.questionNumbers,
        }));
        console.log(`[generateQuestionsFromAnswerPdf] 別冊画像を${supplements.length}件読み込み`);
        supplements.forEach(supp => {
          if (supp.questionNumbers && supp.questionNumbers.length > 0) {
            console.log(`[generateQuestionsFromAnswerPdf]   画像${supp.imageNumber}: 問題${supp.questionNumbers.join(', ')}に対応`);
          }
        });
      }
    } catch (error: any) {
      console.warn(`[generateQuestionsFromAnswerPdf] 別冊PDFの読み込みに失敗: ${error?.message || String(error)}`);
    }
  }

  try {
    // 正答PDFからテキストを抽出
    console.log(`[generateQuestionsFromAnswerPdf] 正答PDFを読み込み中: ${answerPdfPath}`);
    let answerText: string;
    try {
      answerText = await extractTextFromPDF(answerPdfPath);
    } catch (error: any) {
      const errorMsg = `正答PDFの読み込みに失敗: ${answerPdfPath} - ${error?.message || String(error)}`;
      console.error(`[generateQuestionsFromAnswerPdf] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    if (!answerText || answerText.trim().length === 0) {
      const errorMsg = `正答PDFのテキスト抽出に失敗（空のテキスト）: ${answerPdfPath}`;
      console.error(`[generateQuestionsFromAnswerPdf] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`[generateQuestionsFromAnswerPdf] 正答PDFテキスト抽出成功: ${answerText.length}文字`);
    console.log(`[generateQuestionsFromAnswerPdf] 正答PDFテキスト（最初の500文字）:`, answerText.substring(0, 500));

    // 正答データを解析
    const allAnswers = parseAnswerText(answerText, examNumber);
    console.log(`[generateQuestionsFromAnswerPdf] 全正答数: ${allAnswers.length}`);
    
    const sessionAnswers = allAnswers.filter(a => a.session === session);

    console.log(`[generateQuestionsFromAnswerPdf] 第${examNumber}回 ${session}: ${sessionAnswers.length}問の正答を取得`);

    if (sessionAnswers.length === 0) {
      const errorMsg = `正答データが見つかりません: 第${examNumber}回 ${session}。抽出されたテキストを確認してください。`;
      console.error(`[generateQuestionsFromAnswerPdf] ${errorMsg}`);
      console.error(`[generateQuestionsFromAnswerPdf] 抽出されたテキスト全体:`, answerText);
      throw new Error(errorMsg);
    }

    // 問題PDFからテキストを抽出（必須）
    console.log(`[generateQuestionsFromAnswerPdf] 問題PDFを読み込み中: ${questionPdfPath}`);
    let questionPdfText: string = '';
    
    try {
      questionPdfText = await extractTextFromPDF(questionPdfPath);
      console.log(`[generateQuestionsFromAnswerPdf] 問題PDFテキスト抽出成功: ${questionPdfText.length}文字`);
      if (questionPdfText.length > 0) {
        console.log(`[generateQuestionsFromAnswerPdf] 問題PDFテキスト（最初の2000文字）:`, questionPdfText.substring(0, 2000));
      }
    } catch (error: any) {
      console.warn(`[generateQuestionsFromAnswerPdf] 問題PDFのテキスト抽出に失敗: ${questionPdfPath} - ${error?.message || String(error)}`);
      console.warn(`[generateQuestionsFromAnswerPdf] JSONファイルを確認します。`);
      
      // JSONファイルが存在するか確認
      const jsonExists = await checkJsonExists(examNumber, session);
      if (jsonExists) {
        console.log(`[generateQuestionsFromAnswerPdf] JSONファイルから読み込みを試みます: 第${examNumber}回 ${session}`);
        const jsonQuestions = await loadQuestionsFromJson(examNumber, session);
        if (jsonQuestions.length > 0) {
          console.log(`[generateQuestionsFromAnswerPdf] JSONから${jsonQuestions.length}問を読み込み`);
          return jsonQuestions;
        }
      }
      
      const errorMsg = `問題PDFのテキスト抽出に失敗: ${questionPdfPath} - ${error?.message || String(error)}`;
      console.error(`[generateQuestionsFromAnswerPdf] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (!questionPdfText || questionPdfText.trim().length < 100) {
      console.warn(`[generateQuestionsFromAnswerPdf] 問題PDFはスキャン画像のためテキスト抽出ができません。JSONファイルを確認します。`);
      
      // JSONファイルが存在するか確認
      const jsonExists = await checkJsonExists(examNumber, session);
      if (jsonExists) {
        console.log(`[generateQuestionsFromAnswerPdf] JSONファイルから読み込みを試みます: 第${examNumber}回 ${session}`);
        const jsonQuestions = await loadQuestionsFromJson(examNumber, session);
        if (jsonQuestions.length > 0) {
          console.log(`[generateQuestionsFromAnswerPdf] JSONから${jsonQuestions.length}問を読み込み`);
          return jsonQuestions;
        }
      }
      
      const jsonPath = getQuestionDataPath(examNumber, session);
      const errorMsg = `問題PDFはスキャン画像のためテキスト抽出ができません。
JSONファイル（${jsonPath}）を作成して問題データを入力してください。

JSONファイルの形式:
{
  "examNumber": ${examNumber},
  "year": ${examConfig.year},
  "session": "${session}",
  "totalQuestions": 115,
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "問題文をここに入力",
      "choices": {
        "a": "選択肢1",
        "b": "選択肢2",
        "c": "選択肢3",
        "d": "選択肢4",
        "e": "選択肢5"
      },
      "bessatsuPage": 1  // 別冊が必要な場合のページ番号（省略可）
    }
  ]
}`;
      console.error(`[generateQuestionsFromAnswerPdf] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // pdfParserの関数をインポート
    const { extractChoices, parseQuestionText } = await import('./pdfParser');
    // 別冊参照検出の関数をインポート
    const { detectSupplementReferences, linkSupplementReferences } = await import('./supplementLinker');

    // 各正答データから問題を生成
    for (const answer of sessionAnswers) {
      const questionId = `${examNumber}-${session}-${answer.questionNumber}`;

      // 問題番号で問題を検索
      let questionText = `第${examNumber}回 ${session === 'gozen' ? '午前' : '午後'} 問${answer.questionNumber}`;
      let choices: Choice[] = [];

      // 問題番号のパターンを複数試す
      const questionNumberStr = answer.questionNumber.toString();
      const questionNumberPatterns = [
        // パターン1: 問1, 問 1, 問１など（より広範囲に検索）
        new RegExp(`問\\s*[${questionNumberStr}０-９]+[\\s\\S]*?(?=問\\s*[０-９\\d]+|$)`, 's'),
        // パターン2: 第1問, 第 1 問など
        new RegExp(`第\\s*[${questionNumberStr}０-９]+\\s*問[\\s\\S]*?(?=第\\s*[０-９\\d]+\\s*問|$)`, 's'),
        // パターン3: 問題1, 問題 1など
        new RegExp(`問題\\s*[${questionNumberStr}０-９]+[\\s\\S]*?(?=問題\\s*[０-９\\d]+|$)`, 's'),
      ];

      let questionSection = '';
      console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}を検索中...`);
      console.log(`[generateQuestionsFromAnswerPdf] 問題PDFテキストの最初の500文字:`, questionPdfText.substring(0, 500));
      
      for (let i = 0; i < questionNumberPatterns.length; i++) {
        const pattern = questionNumberPatterns[i];
        const match = questionPdfText.match(pattern);
        if (match && match[0].length > 50) { // 最低50文字以上あることを確認
          questionSection = match[0];
          console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}のセクションを検出（パターン${i+1}、${questionSection.length}文字）`);
          break;
        } else if (match) {
          console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}のセクションが見つかりましたが短すぎます（${match[0].length}文字）`);
        }
      }
      
      if (!questionSection) {
        console.warn(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}のセクションが見つかりませんでした`);
        // 問題番号を含む部分を検索（より柔軟な検索）
        const flexiblePattern = new RegExp(`[^問]*問[^問]*[${questionNumberStr}０-９]+[\\s\\S]{100,}?(?=問[^問]*[０-９\\d]+|$)`, 's');
        const flexibleMatch = questionPdfText.match(flexiblePattern);
        if (flexibleMatch && flexibleMatch[0].length > 100) {
          questionSection = flexibleMatch[0];
          console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}のセクションを柔軟なパターンで検出（${questionSection.length}文字）`);
        }
      }

      if (questionSection) {
        console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}のセクション（最初の1000文字）:`, questionSection.substring(0, 1000));

        // 問題文と選択肢を抽出
        console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}のセクション全体（最初の2000文字）:`, questionSection.substring(0, 2000));
        
        const parsed = parseQuestionText(questionSection);
        questionText = parsed.questionText || questionSection.substring(0, 500);
        console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}の問題文（最初の500文字）:`, questionText.substring(0, 500));
        
        // 選択肢を抽出（複数のパターンを試す）
        let extractedChoices = extractChoices(questionSection);
        console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}の選択肢数（基本パターン）: ${extractedChoices.length}`);
        if (extractedChoices.length > 0) {
          console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}の選択肢（基本パターン）:`, extractedChoices.map(c => `${c.label}. ${c.text.substring(0, 100)}`));
        }
        
        // 選択肢が見つからない場合、より柔軟なパターンで抽出
        if (extractedChoices.length === 0) {
          // パターン1: 1. 選択肢, 2. 選択肢など
          const pattern1 = /([1-5]|①|②|③|④|⑤|１|２|３|４|５)[\.\s、．]+(.+?)(?=\s*([1-5]|①|②|③|④|⑤|１|２|３|４|５)[\.\s、．]|問|第|$)/gs;
          let match1;
          while ((match1 = pattern1.exec(questionSection)) !== null) {
            const numStr = match1[1];
            let num = 0;
            if (/[1-5]/.test(numStr)) {
              num = parseInt(numStr, 10);
            } else if (/[１-５]/.test(numStr)) {
              const zenkakuMap: Record<string, number> = { '１': 1, '２': 2, '３': 3, '４': 4, '５': 5 };
              num = zenkakuMap[numStr] || 0;
            } else {
              const maruMap: Record<string, number> = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };
              num = maruMap[numStr] || 0;
            }
            if (num >= 1 && num <= 5) {
              extractedChoices.push({
                label: String.fromCharCode(96 + num), // 'a', 'b', 'c', 'd', 'e'
                text: match1[2].trim().replace(/\s+/g, ' '),
              });
            }
          }
          console.log(`[generateQuestionsFromAnswerPdf] 柔軟なパターン1で抽出した選択肢数: ${extractedChoices.length}`);
        }

        // まだ見つからない場合、a. b. c. d. パターンを試す
        if (extractedChoices.length === 0) {
          const pattern2 = /([a-e])[\.\s、．]+(.+?)(?=\s*([a-e])[\.\s、．]|問|第|$)/gis;
          let match2;
          while ((match2 = pattern2.exec(questionSection)) !== null) {
            extractedChoices.push({
              label: match2[1].toLowerCase(),
              text: match2[2].trim().replace(/\s+/g, ' '),
            });
          }
          console.log(`[generateQuestionsFromAnswerPdf] 柔軟なパターン2で抽出した選択肢数: ${extractedChoices.length}`);
        }

        if (extractedChoices.length > 0) {
          choices = extractedChoices;
          console.log(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}の選択肢:`, choices.map(c => `${c.label}. ${c.text.substring(0, 50)}`).join(', '));
        } else {
          console.warn(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}の選択肢が見つかりませんでした`);
          // デフォルトの選択肢を設定
          choices = [
            { label: 'a', text: '選択肢が見つかりませんでした' },
            { label: 'b', text: '選択肢が見つかりませんでした' },
            { label: 'c', text: '選択肢が見つかりませんでした' },
            { label: 'd', text: '選択肢が見つかりませんでした' },
          ];
        }
      } else {
        console.warn(`[generateQuestionsFromAnswerPdf] 問題${answer.questionNumber}が見つかりませんでした`);
        // デフォルトの選択肢を設定
        choices = [
          { label: 'a', text: '問題が見つかりませんでした' },
          { label: 'b', text: '問題が見つかりませんでした' },
          { label: 'c', text: '問題が見つかりませんでした' },
          { label: 'd', text: '問題が見つかりませんでした' },
        ];
      }

      // 複数正答の場合、最初の正答を使用（表示用）
      const correctAnswer = answer.correctAnswers[0] || 'a';

      // 別冊参照を検出（問題文から）
      const supplementReferences = detectSupplementReferences(questionText);
      let linkedSupplementReferences = supplementReferences;
      
      // 別冊PDFがある場合、別冊参照を自動紐付け
      if (supplements.length > 0) {
        // パターン1: 問題文から検出された別冊参照を紐付け
        if (supplementReferences.length > 0) {
          linkedSupplementReferences = linkSupplementReferences(
            supplementReferences,
            examNumber,
            session,
            supplements
          );
        }
        
        // パターン2: 別冊画像の右上に記載されている問題番号から紐付け
        const supplementsForThisQuestion = supplements.filter(supp => 
          supp.questionNumbers && supp.questionNumbers.includes(answer.questionNumber)
        );
        
        if (supplementsForThisQuestion.length > 0) {
          // 既存の参照に追加（重複を避ける）
          const existingImageNumbers = new Set(linkedSupplementReferences.map(r => r.imageNumber));
          
          for (const supp of supplementsForThisQuestion) {
            if (!existingImageNumbers.has(supp.imageNumber)) {
              linkedSupplementReferences.push({
                referenceText: `別冊 ${supp.imageNumber}`,
                supplementId: supp.id,
                imageNumber: supp.imageNumber,
              });
            }
          }
          
          console.log(`[generateQuestionsFromAnswerPdf] 問${answer.questionNumber}: 別冊画像から${supplementsForThisQuestion.length}件を紐付け`);
        }
      }

      const question: Question = {
        id: questionId,
        year: examConfig.year,
        examNumber,
        session,
        questionNumber: answer.questionNumber,
        questionText: questionText,
        choices: choices,
        correctAnswer,
        correctAnswers: answer.correctAnswers,
        explanation: answer.correctAnswers.length > 1
          ? `複数正答: ${answer.correctAnswers.join(', ')}`
          : '',
        sourceFile: questionPdfPath,
        hasSupplementImage: linkedSupplementReferences.length > 0,
        supplementReferences: linkedSupplementReferences,
        pdfPath: questionPdfPath,
        pdfPage: undefined, // 問題ページ画像は使用しない
        isImageBased: false, // テキスト抽出に成功したのでfalse
        // 問題ページ画像は使用しない（別冊のみ画像表示）
        questionPageImage: undefined,
        questionPageNumber: undefined,
      };

      questions.push(question);
    }

    console.log(`[generateQuestionsFromAnswerPdf] 生成された問題数: ${questions.length}`);
    return questions;

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error(`[generateQuestionsFromAnswerPdf] 問題生成エラー: 第${examNumber}回 ${session}`, error);
    console.error(`[generateQuestionsFromAnswerPdf] エラー詳細:`, errorMsg);
    // エラーを再スローして、上位で適切に処理できるようにする
    throw new Error(`第${examNumber}回 ${session}の問題生成に失敗: ${errorMsg}`);
  }
}

/**
 * 利用可能な正答PDFから全問題を生成
 */
export async function generateAllQuestions(): Promise<Question[]> {
  const allQuestions: Question[] = [];

  // 設定ファイルから利用可能な回次を取得
  const availableExams = getAvailableExamNumbers();
  console.log(`[generateAllQuestions] 利用可能な回次: ${availableExams.join(', ')}`);

  for (const examNumber of availableExams) {
    for (const session of ['gozen', 'gogo'] as SessionType[]) {
      try {
        const questions = await generateQuestionsFromAnswerPdf(examNumber, session);
        allQuestions.push(...questions);
        console.log(`[generateAllQuestions] 第${examNumber}回 ${session}: ${questions.length}問`);
      } catch (error) {
        console.error(`[generateAllQuestions] エラー: 第${examNumber}回 ${session}`, error);
      }
    }
  }

  console.log(`[generateAllQuestions] 合計: ${allQuestions.length}問`);
  return allQuestions;
}

/**
 * 利用可能な回次のリストをエクスポート
 */
export { getAvailableExamNumbers };
