import * as pdfjsLib from 'pdfjs-dist';
import { Question, Choice } from '../types';

// PDF.jsのワーカー設定（Web環境用）
if (typeof window !== 'undefined') {
  // publicフォルダからワーカーを読み込む（Vite用）
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

/**
 * PDFファイルからテキストを抽出（Web環境用）
 */
export async function extractTextFromPDF(file: File | ArrayBuffer): Promise<string[]> {
  try {
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('PDFファイルが空です');
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0,
    });
    const pdf = await loadingTask.promise;
    
    if (pdf.numPages === 0) {
      throw new Error('PDFにページがありません');
    }

    const pages: string[] = [];
    let extractedPages = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        if (textContent.items.length === 0) {
          console.warn(`[extractTextFromPDF] 警告: ページ${pageNum}にテキストが見つかりません（スキャン画像の可能性）`);
          pages.push(''); // 空文字列を追加
          continue;
        }
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        pages.push(pageText);
        extractedPages++;
      } catch (pageError: any) {
        console.error(`[extractTextFromPDF] ページ${pageNum}の処理エラー:`, pageError);
        pages.push(''); // エラー時も空文字列を追加して続行
      }
    }

    if (extractedPages === 0) {
      throw new Error('PDFからテキストを抽出できませんでした（スキャン画像PDFの可能性）');
    }

    console.log(`[extractTextFromPDF] ${extractedPages}/${pdf.numPages}ページからテキストを抽出`);
    return pages;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error(`[extractTextFromPDF] PDF読み込みエラー:`, error);
    throw new Error(`PDFの読み込みに失敗しました: ${errorMsg}`);
  }
}

/**
 * 問題番号を検出（問1, 問2, または 1, 2 など）
 */
export function detectQuestionNumber(text: string): number | null {
  // パターン1: "問1", "問2" など
  const pattern1 = /問\s*(\d+)/;
  const match1 = text.match(pattern1);
  if (match1) {
    return parseInt(match1[1], 10);
  }

  // パターン2: 行頭の数字（問題番号の可能性）
  const pattern2 = /^(\d+)[\.\s]/;
  const match2 = text.match(pattern2);
  if (match2) {
    return parseInt(match2[1], 10);
  }

  return null;
}

/**
 * 選択肢を抽出（a, b, c, d, e または 1, 2, 3, 4, 5）
 */
export function extractChoices(text: string): Choice[] {
  const choices: Choice[] = [];
  
  // パターン1: a. 選択肢1, b. 選択肢2 など
  const pattern1 = /([a-e])[\.\s]+(.+?)(?=\s*[a-e][\.\s]|$)/gi;
  let match1;
  while ((match1 = pattern1.exec(text)) !== null) {
    choices.push({
      label: match1[1].toLowerCase(),
      text: match1[2].trim(),
    });
  }

  // パターン2: 1. 選択肢1, 2. 選択肢2 など（a-eが見つからない場合）
  if (choices.length === 0) {
    const pattern2 = /(\d+)[\.\s]+(.+?)(?=\s*\d+[\.\s]|$)/g;
    let match2;
    while ((match2 = pattern2.exec(text)) !== null) {
      const num = parseInt(match2[1], 10);
      if (num >= 1 && num <= 5) {
        // 1-5をa-eに変換
        const label = String.fromCharCode(96 + num); // 97 = 'a'
        choices.push({
          label,
          text: match2[2].trim(),
        });
      }
    }
  }

  return choices;
}

/**
 * 正解を抽出（正解: a または 正解 a など）
 */
export function extractCorrectAnswer(text: string): string | null {
  // パターン1: "正解: a" または "正解 a"
  const pattern1 = /正解\s*[:：]\s*([a-e])/i;
  const match1 = text.match(pattern1);
  if (match1) {
    return match1[1].toLowerCase();
  }

  // パターン2: "答え: a"
  const pattern2 = /答え\s*[:：]\s*([a-e])/i;
  const match2 = text.match(pattern2);
  if (match2) {
    return match2[1].toLowerCase();
  }

  return null;
}

/**
 * 問題文から問題と解説を分離
 * 注意: 実際のPDF構造に応じて調整が必要
 */
export function parseQuestionText(fullText: string): {
  questionText: string;
  explanation: string;
} {
  // 解説の開始位置を検出（「解説」「解答」「正解」などのキーワード）
  const explanationKeywords = ['解説', '解答', '説明', '正解', '答え', '正答'];
  let explanationStart = -1;

  for (const keyword of explanationKeywords) {
    // より柔軟なパターンマッチング
    const patterns = [
      new RegExp(`\\s*${keyword}\\s*[:：]`, 'i'),
      new RegExp(`\\s*${keyword}\\s*[はが]`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match && match.index !== undefined) {
        explanationStart = match.index;
        break;
      }
    }
    
    if (explanationStart !== -1) break;
  }

  if (explanationStart !== -1 && explanationStart > 0) {
    return {
      questionText: fullText.substring(0, explanationStart).trim(),
      explanation: fullText.substring(explanationStart).trim(),
    };
  }

  // 解説が見つからない場合は、問題文のみ
  // 選択肢のパターンで区切る
  const choicePattern = /([a-e])[\.\s]+/i;
  const choiceMatch = fullText.match(choicePattern);
  if (choiceMatch && choiceMatch.index !== undefined) {
    return {
      questionText: fullText.substring(0, choiceMatch.index).trim(),
      explanation: fullText.substring(choiceMatch.index).trim(),
    };
  }

  return {
    questionText: fullText.trim(),
    explanation: '',
  };
}

/**
 * 正答から4択の選択肢を生成（正答1個 + それっぽいダミー選択肢3個）
 */
function generateChoicesFromAnswer(correctAnswer: string): {
  choices: Choice[];
  correctLabel: string;
} {
  const choices: Choice[] = [];
  
  // 正答を選択肢として追加
  choices.push({
    label: 'a',
    text: correctAnswer,
  });

  // それっぽいダミー選択肢を3つ生成
  const dummyAnswers = [
    '上記のいずれでもない',
    '該当なし',
    '情報不足のため判断できない',
  ];

  // 正答の内容に応じて、よりそれっぽいダミー選択肢を生成
  // 正答が短い場合は、類似した形式の選択肢を生成
  if (correctAnswer.length < 50) {
    // 正答の形式に合わせたダミー選択肢を生成
    dummyAnswers[0] = correctAnswer.replace(/[^\s]+/, '類似した選択肢1');
    dummyAnswers[1] = correctAnswer.replace(/[^\s]+/, '類似した選択肢2');
    dummyAnswers[2] = '上記のいずれでもない';
  }

  // ダミー選択肢を追加
  for (let i = 0; i < 3; i++) {
    choices.push({
      label: String.fromCharCode(97 + i + 1), // 'b', 'c', 'd'
      text: dummyAnswers[i],
    });
  }

  // 選択肢をシャッフル（正答の位置をランダムにする）
  const shuffled = [...choices];
  const correctIndex = 0; // 正答は最初
  const randomIndex = Math.floor(Math.random() * shuffled.length);
  
  // 正答とランダムな位置の選択肢を入れ替え
  const temp = shuffled[correctIndex];
  shuffled[correctIndex] = shuffled[randomIndex];
  shuffled[randomIndex] = temp;

  // ラベルを再割り当て
  const finalChoices: Choice[] = shuffled.map((choice, index) => ({
    label: String.fromCharCode(97 + index), // 'a', 'b', 'c', 'd'
    text: choice.text,
  }));

  // 正答のラベルを更新（シャッフル後の正答テキストの位置を探す）
  const finalCorrectLabel = finalChoices.find(c => c.text === correctAnswer)?.label || 'a';

  return {
    choices: finalChoices,
    correctLabel: finalCorrectLabel,
  };
}


/**
 * PDFから問題を抽出（正答から4択を生成）
 */
export async function extractQuestionsFromPDF(
  file: File | ArrayBuffer,
  year: number,
  examNumber: number,
  session: 'gozen' | 'gogo',
  sourceFile: string
): Promise<Question[]> {
  try {
    console.log(`[extractQuestionsFromPDF] 開始: ${sourceFile}`);
    const pages = await extractTextFromPDF(file);
    const fullText = pages.join('\n');
    const questions: Question[] = [];

    // デバッグ: PDFテキストの最初の1000文字をログ出力
    console.log(`[extractQuestionsFromPDF] PDFテキストの総文字数: ${fullText.length}`);
    console.log(`[extractQuestionsFromPDF] PDFテキスト（最初の1000文字）:`, fullText.substring(0, 1000));
    
    if (fullText.length === 0) {
      console.warn(`[extractQuestionsFromPDF] 警告: PDFテキストが空です（スキャン画像PDFの可能性があります）`);
      // スキャン画像PDFの場合はテキスト抽出ができないため、空配列を返す
      return [];
    }

    // 問題を分割（「問」で分割、より柔軟なパターンに対応）
    const questionPattern = /問\s*(\d+)/g;
    const questionMatches = Array.from(fullText.matchAll(questionPattern));
    
    console.log(`[extractQuestionsFromPDF] 「問」パターンで見つかった問題数: ${questionMatches.length}`);
    
    // 「問」パターンが見つからない場合、別のパターンを試す
    if (questionMatches.length === 0) {
      // パターン2: 数字だけで始まる問題（1. 2. など）
      const altPattern = /(?:^|\n)\s*(\d+)[\.\s]+/g;
      const altMatches = Array.from(fullText.matchAll(altPattern));
      console.log(`[extractQuestionsFromPDF] 数字パターンで見つかった問題数: ${altMatches.length}`);

      if (altMatches.length > 0) {
        // 数字パターンで処理
        for (let i = 0; i < altMatches.length; i++) {
          const match = altMatches[i];
          const questionNumber = parseInt(match[1], 10);
          const startIndex = match.index || 0;
          const endIndex = i < altMatches.length - 1
            ? altMatches[i + 1].index || fullText.length
            : fullText.length;

          const section = fullText.substring(startIndex, endIndex);

          // 問題文を抽出（選択肢や正解の前まで）
          let questionText = section.trim();

          // 選択肢のパターンで区切る
          const choicePattern = /([a-e])[\.\s]+/i;
          const choiceMatch = questionText.match(choicePattern);
          if (choiceMatch && choiceMatch.index !== undefined) {
            questionText = questionText.substring(0, choiceMatch.index).trim();
          }

          // 問題文が短すぎる場合はスキップ
          if (questionText.length < 10) {
            continue;
          }

          // 正答を抽出
          let correctAnswer = extractCorrectAnswer(section);
          let correctAnswerText = '';

          if (correctAnswer) {
            const choices = extractChoices(section);
            const correctChoice = choices.find(c => c.label === correctAnswer);
            if (correctChoice) {
              correctAnswerText = correctChoice.text;
            } else {
              correctAnswerText = correctAnswer;
            }
          }

          // 正答がない場合は、選択肢ラベルを使用
          if (!correctAnswerText) {
            correctAnswerText = `選択肢 ${correctAnswer || 'a'}`;
          }

          // 4択を生成
          const { choices: generatedChoices, correctLabel: finalCorrectAnswer } = generateChoicesFromAnswer(
            correctAnswerText
          );

          const questionId = `${examNumber}-${session}-${questionNumber}`;

          questions.push({
            id: questionId,
            year,
            examNumber,
            session,
            questionNumber,
            questionText: questionText,
            choices: generatedChoices,
            correctAnswer: finalCorrectAnswer,
            explanation: '',
            sourceFile,
            hasSupplementImage: false,
            supplementReferences: [],
          });
        }

        console.log(`[extractQuestionsFromPDF] 抽出された問題数: ${questions.length}`);
        return questions;
      }
    }

    // 「問」パターンで問題を抽出
    for (let i = 0; i < questionMatches.length; i++) {
      const match = questionMatches[i];
      const questionNumber = parseInt(match[1], 10);
      const startIndex = match.index || 0;
      const endIndex = i < questionMatches.length - 1
        ? questionMatches[i + 1].index || fullText.length
        : fullText.length;
    
      const section = fullText.substring(startIndex, endIndex);
      
      console.log(`[extractQuestionsFromPDF] 問題${questionNumber}のセクション（最初の200文字）:`, section.substring(0, 200));

      const { questionText, explanation } = parseQuestionText(section);
    
      // 問題文が空または短すぎる場合は、セクション全体を問題文として使用
      let finalQuestionText = questionText;
      if (!finalQuestionText || finalQuestionText.length < 10) {
        // 選択肢や正解の部分を除いて問題文を抽出
        const choicePattern = /([a-e])[\.\s]+/i;
        const choiceMatch = section.match(choicePattern);
        if (choiceMatch && choiceMatch.index !== undefined) {
          finalQuestionText = section.substring(0, choiceMatch.index).trim();
        } else {
          // 選択肢が見つからない場合は、セクション全体を使用
          finalQuestionText = section.trim();
        }
        
        // まだ空の場合は、問題番号以降のテキストを使用
        if (!finalQuestionText || finalQuestionText.length < 10) {
          const questionHeaderPattern = /問\s*\d+/;
          const headerMatch = section.match(questionHeaderPattern);
          if (headerMatch && headerMatch.index !== undefined) {
            finalQuestionText = section.substring(headerMatch.index + headerMatch[0].length).trim();
            // 最初の200文字を問題文として使用
            if (finalQuestionText.length > 200) {
              finalQuestionText = finalQuestionText.substring(0, 200) + '...';
            }
          } else {
            finalQuestionText = section.trim().substring(0, 200);
          }
        }
      }
      
      // 正答を抽出
      let correctAnswer = extractCorrectAnswer(section);
      
      // 正答が見つからない場合の処理
      // 注意: 誤った正答を設定しないようにする
      if (!correctAnswer) {
        const choices = extractChoices(section);
        if (choices.length === 0) {
          // 選択肢も正答も見つからない場合はスキップ
          console.warn(`[extractQuestionsFromPDF] 警告: 問題${questionNumber}の選択肢と正答が見つかりません。スキップします。`);
          continue;
        }
        // 選択肢はあるが正答が見つからない場合は、暫定的に'a'を設定（後でユーザーに確認が必要）
        console.warn(`[extractQuestionsFromPDF] 警告: 問題${questionNumber}の正答が見つかりません。暫定的に選択肢aを正答とします。`);
        correctAnswer = 'a';
      }

      // 正答のテキストを取得
      const choicesFromSection = extractChoices(section);
      let correctAnswerText = '';
      if (correctAnswer && choicesFromSection.length > 0) {
        const correctChoice = choicesFromSection.find(c => c.label === correctAnswer);
        if (correctChoice) {
          correctAnswerText = correctChoice.text;
        } else {
          // 正答のテキストが見つからない場合は、正答ラベルをテキストとして使用
          correctAnswerText = correctAnswer;
        }
      } else if (correctAnswer) {
        correctAnswerText = correctAnswer;
      }

      // 問題文がない場合はスキップ
      if (!finalQuestionText || finalQuestionText.length < 5) {
        continue;
      }

      // 正答テキストがない場合の処理
      if (!correctAnswerText) {
        // 選択肢から正答テキストを取得できない場合は、正答ラベルをそのまま使用
        console.warn(`[extractQuestionsFromPDF] 警告: 問題${questionNumber}の正答テキストが見つかりません。`);
        correctAnswerText = `選択肢 ${correctAnswer}`;
      }

      // 正答から4択の選択肢を生成
      const { choices: generatedChoices, correctLabel: finalCorrectAnswer } = generateChoicesFromAnswer(
        correctAnswerText
      );

      const questionId = `${examNumber}-${session}-${questionNumber}`;

      questions.push({
        id: questionId,
        year,
        examNumber,
        session,
        questionNumber,
        questionText: finalQuestionText,
        choices: generatedChoices,
        correctAnswer: finalCorrectAnswer,
        explanation: explanation || '解説はありません',
        sourceFile,
        hasSupplementImage: false,
        supplementReferences: [],
      });
    }

    console.log(`[extractQuestionsFromPDF] 最終的に抽出された問題数: ${questions.length}`);
    
    // 問題が1つも見つからない場合、テキスト全体を1つの問題として扱う（フォールバック）
    if (questions.length === 0 && fullText.length > 50) {
      console.log(`[extractQuestionsFromPDF] 問題が見つからないため、テキスト全体を問題として扱います`);
      
      // テキスト全体から問題文を抽出
      let questionText = fullText.trim();
    
      // 選択肢や正解の部分を除く
      const choicePattern = /([a-e])[\.\s]+/i;
      const choiceMatch = questionText.match(choicePattern);
      if (choiceMatch && choiceMatch.index !== undefined) {
        questionText = questionText.substring(0, choiceMatch.index).trim();
      }
      
      // 正解の部分を除く
      const answerPattern = /(?:正解|答え|正答)\s*[:：]\s*[a-e]/i;
      const answerMatch = questionText.match(answerPattern);
      if (answerMatch && answerMatch.index !== undefined) {
        questionText = questionText.substring(0, answerMatch.index).trim();
      }
      
      if (questionText.length >= 10) {
        // 正答を抽出
        let correctAnswer = extractCorrectAnswer(fullText);
        let correctAnswerText = '';
        
        if (correctAnswer) {
          const choices = extractChoices(fullText);
          const correctChoice = choices.find(c => c.label === correctAnswer);
          if (correctChoice) {
            correctAnswerText = correctChoice.text;
          } else {
            correctAnswerText = correctAnswer;
          }
        }
        
        // 正答がない場合は、問題文の一部を使用
        if (!correctAnswerText) {
          correctAnswerText = questionText.substring(0, Math.min(50, questionText.length));
        }
        
        // 4択を生成
        const { choices: generatedChoices, correctLabel: finalCorrectAnswer } = generateChoicesFromAnswer(
          correctAnswerText
        );
        
        questions.push({
          id: `${examNumber}-${session}-1`,
          year,
          examNumber,
          session,
          questionNumber: 1,
          questionText: questionText.substring(0, 500), // 最初の500文字
          choices: generatedChoices,
          correctAnswer: finalCorrectAnswer,
          explanation: '',
          sourceFile,
          hasSupplementImage: false,
          supplementReferences: [],
        });
      }
    }
    
    console.log(`[extractQuestionsFromPDF] 完了: ${questions.length}問抽出 (${sourceFile})`);
    return questions;
  } catch (error: any) {
    console.error(`[extractQuestionsFromPDF] エラー: ${sourceFile}`, error);
    throw error;
  }
}
