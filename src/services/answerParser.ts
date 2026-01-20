/**
 * 正答PDFからデータを抽出するパーサー
 * 様々な形式の正答PDFに対応
 */

export interface AnswerData {
  examNumber: number;
  session: 'gozen' | 'gogo';
  questionNumber: number;
  correctAnswers: string[]; // 複数正答対応（例：「１，２」「３又は４」）
}

/**
 * 正答PDFのテキストから正答データを抽出
 */
export function parseAnswerText(text: string, examNumber: number): AnswerData[] {
  const answers: AnswerData[] = [];

  console.log(`[parseAnswerText] 解析開始: 第${examNumber}回`);
  console.log(`[parseAnswerText] テキスト長: ${text.length}文字`);
  console.log(`[parseAnswerText] テキスト（最初の500文字）:`, text.substring(0, 500));
  console.log(`[parseAnswerText] テキスト（最後の500文字）:`, text.substring(Math.max(0, text.length - 500)));

  // 午前・午後を分割（様々なパターンに対応）
  // パターン: 「午後」「午 後」「【午後】」「■午後」など
  const amPmPattern = /(?:午\s*後|【午後】|■午後|━+\s*午後|午後の部)/;
  const amPmMatch = text.match(amPmPattern);
  
  console.log(`[parseAnswerText] 午後パターンマッチ:`, amPmMatch ? `見つかりました（位置: ${amPmMatch.index}）` : '見つかりませんでした');
  
  const amPmSplit = text.split(amPmPattern);

  const gozenText = amPmSplit[0] || '';
  const gogoText = amPmSplit.slice(1).join(' ') || '';

  console.log(`[parseAnswerText] 午前テキスト長: ${gozenText.length}文字`);
  console.log(`[parseAnswerText] 午後テキスト長: ${gogoText.length}文字`);
  console.log(`[parseAnswerText] 午前テキスト（最初の200文字）:`, gozenText.substring(0, 200));
  console.log(`[parseAnswerText] 午後テキスト（最初の200文字）:`, gogoText.substring(0, 200));

  // 午前の正答を抽出
  const gozenAnswers = extractAnswersFromSection(gozenText, examNumber, 'gozen');
  answers.push(...gozenAnswers);
  console.log(`[parseAnswerText] 午前正答数: ${gozenAnswers.length}`);

  // 午後の正答を抽出
  const gogoAnswers = extractAnswersFromSection(gogoText, examNumber, 'gogo');
  answers.push(...gogoAnswers);
  console.log(`[parseAnswerText] 午後正答数: ${gogoAnswers.length}`);

  // 午前午後で分割できなかった場合、全体から抽出を試みる
  if (answers.length === 0) {
    console.log(`[parseAnswerText] 午前午後分割に失敗。全体から抽出を試みます。`);
    const allAnswers = extractAnswersFromSection(text, examNumber, 'gozen');

    // 問題番号で午前・午後を推定（1-115が午前、116以降が午後）
    for (const answer of allAnswers) {
      if (answer.questionNumber <= 115) {
        answers.push({ ...answer, session: 'gozen' });
      } else {
        answers.push({
          ...answer,
          session: 'gogo',
          questionNumber: answer.questionNumber - 115 // 午後は1から始まるように調整
        });
      }
    }
  }

  console.log(`[parseAnswerText] 合計正答数: ${answers.length}`);
  return answers;
}

/**
 * セクション（午前または午後）から正答を抽出
 */
function extractAnswersFromSection(
  text: string,
  examNumber: number,
  session: 'gozen' | 'gogo'
): AnswerData[] {
  const answers: AnswerData[] = [];

  // 方法1: 「問X 正答」のペア形式を探す
  // パターン: 問1 2, 問2 4, 問3 1,2 など
  const directPattern = /問\s*(\d+)\s*[:\s]\s*([1-5１２３４５][，,\s又は]*[1-5１２３４５]?)/g;
  let directMatch;
  let directMatches = 0;
  while ((directMatch = directPattern.exec(text)) !== null) {
    directMatches++;
    const questionNumber = parseInt(directMatch[1], 10);
    const answerValue = directMatch[2];
    const correctAnswers = parseAnswerValue(answerValue);

    if (correctAnswers.length > 0 && questionNumber > 0) {
      answers.push({
        examNumber,
        session,
        questionNumber,
        correctAnswers,
      });
    } else {
      console.warn(`[extractAnswersFromSection] 方法1: 問題${questionNumber}の正答解析に失敗 (値: "${answerValue}")`);
    }
  }

  console.log(`[extractAnswersFromSection] 方法1: ${directMatches}個のマッチ、${answers.length}問を抽出`);

  // 方法1で見つかった場合は終了
  if (answers.length > 0) {
    console.log(`[extractAnswersFromSection] 方法1で${answers.length}問を抽出`);
    return answers;
  }

  // 方法2: 問題番号と正答が同じ行にある形式（例: 問１ 問２ 問３ ... ３ ３ ２ ...）
  const lines = text.split(/\n/);
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 問題番号と正答が同じ行にある場合を検出
    // パターン: 問１ 問２ 問３ ... ３ ３ ２ ... または 問1 問2 問3 ... 3 3 2 ...
    const questionMatches = trimmedLine.match(/問\s*[0-9０-９]+/g);
    if (questionMatches && questionMatches.length > 0) {
      // 問題番号を抽出
      const questionNums: number[] = [];
      for (const match of questionMatches) {
        const numMatch = match.match(/問\s*([0-9０-９]+)/);
        if (numMatch) {
          const numStr = normalizeNumber(numMatch[1]);
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > 0) {
            questionNums.push(num);
          }
        }
      }

      // 問題番号の後に続く正答を抽出
      // 問題番号部分を削除して、残りの部分から正答を抽出
      let afterQuestions = trimmedLine;
      // すべての「問X」を削除
      afterQuestions = afterQuestions.replace(/問\s*[0-9０-９]+/g, '').trim();
      
      // 正答の数字を抽出（1-5の範囲、カンマ区切りの複数正答も対応）
      // スペースで分割して、数字のみの部分を抽出
      const parts = afterQuestions.split(/\s+/).filter(p => p.trim());
      const answerValues: string[] = [];
      
      for (const part of parts) {
        const normalizedPart = normalizeNumber(part);
        // 1-5の数字、または「2,4」「２，４」などの複数正答
        if (/^[1-5][，,\s]*[1-5]?$/.test(normalizedPart) || /^[1-5]$/.test(normalizedPart)) {
          answerValues.push(normalizedPart);
        }
      }

      // 問題番号と正答をマッチング
      for (let i = 0; i < Math.min(questionNums.length, answerValues.length); i++) {
        const questionNumber = questionNums[i];
        const answerValue = answerValues[i];
        const correctAnswers = parseAnswerValue(answerValue);

        if (correctAnswers.length > 0) {
          answers.push({
            examNumber,
            session,
            questionNumber,
            correctAnswers,
          });
        }
      }
    }
  }

  console.log(`[extractAnswersFromSection] 方法2: ${answers.length}問を抽出`);

  // 方法2で見つかった場合は終了
  if (answers.length > 0) {
    console.log(`[extractAnswersFromSection] 方法2で${answers.length}問を抽出`);
    return answers;
  }

  // 方法2.5: 問題番号行と正答行がペアで出現する形式（10問ずつの表形式）
  // 例: 「問１ 問２ 問３ ...」の次の行に「４ １ ４ ...」
  console.log(`[extractAnswersFromSection] 方法2.5: 表形式を試行`);
  let lastQuestionNums: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 「問X」が複数含まれる行を検出（問題番号行）
    const questionMatches = line.match(/問\s*[0-9０-９]+/g);
    if (questionMatches && questionMatches.length >= 2) {
      // 問題番号を抽出
      lastQuestionNums = [];
      for (const match of questionMatches) {
        const numMatch = match.match(/問\s*([0-9０-９]+)/);
        if (numMatch) {
          const numStr = normalizeNumber(numMatch[1]);
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > 0) {
            lastQuestionNums.push(num);
          }
        }
      }
      continue;
    }

    // 前の行が問題番号行だった場合、この行は正答行の可能性
    if (lastQuestionNums.length > 0) {
      // 正答を抽出（数字、「全員正解」、「X又はY」「X，Y」形式）
      // スペースで分割
      const parts = line.split(/\s+/).filter(p => p.trim());
      const answerValues: string[] = [];

      for (const part of parts) {
        // 「全員正解」「全員」をチェック
        if (part.includes('全員正解') || part === '全員') {
          answerValues.push('全員正解');
          continue;
        }

        const normalizedPart = normalizeNumber(part);
        // 1-5の数字、または「2,4」「２，４」「2又は3」などの複数正答
        if (/^[1-5][，,又は]*[1-5]?$/.test(normalizedPart) || /^[1-5]$/.test(normalizedPart)) {
          answerValues.push(part); // オリジナルの値を保持（parseAnswerValueで処理）
        }
      }

      // 問題番号と正答をマッチング
      if (answerValues.length > 0) {
        for (let j = 0; j < Math.min(lastQuestionNums.length, answerValues.length); j++) {
          const questionNumber = lastQuestionNums[j];
          const answerValue = answerValues[j];
          const correctAnswers = parseAnswerValue(answerValue);

          if (correctAnswers.length > 0) {
            answers.push({
              examNumber,
              session,
              questionNumber,
              correctAnswers,
            });
          }
        }
      }

      // 問題番号リストをクリア
      lastQuestionNums = [];
    }
  }

  console.log(`[extractAnswersFromSection] 方法2.5: ${answers.length}問を抽出`);

  // 方法2.5で見つかった場合は終了
  if (answers.length > 0) {
    console.log(`[extractAnswersFromSection] 方法2.5で${answers.length}問を抽出`);
    return answers;
  }

  // 方法3: テーブル形式（問題番号と正答が同じ行にある）
  const tablePattern = /(\d+)\s+([1-5１２３４５])/g;
  let tableMatch;
  const tableAnswers: Map<number, string[]> = new Map();

  while ((tableMatch = tablePattern.exec(text)) !== null) {
    const questionNumber = parseInt(tableMatch[1], 10);
    const answerValue = tableMatch[2];
    const correctAnswers = parseAnswerValue(answerValue);

    if (correctAnswers.length > 0 && questionNumber > 0 && questionNumber <= 200) {
      tableAnswers.set(questionNumber, correctAnswers);
    }
  }

  for (const [questionNumber, correctAnswers] of tableAnswers) {
    answers.push({
      examNumber,
      session,
      questionNumber,
      correctAnswers,
    });
  }

  // 問題番号でソート
  answers.sort((a, b) => a.questionNumber - b.questionNumber);

  console.log(`[extractAnswersFromSection] 方法3で${answers.length}問を抽出`);
  return answers;
}

/**
 * 全角数字を半角に変換
 */
function normalizeNumber(str: string): string {
  return str
    .replace(/０/g, '0')
    .replace(/１/g, '1')
    .replace(/２/g, '2')
    .replace(/３/g, '3')
    .replace(/４/g, '4')
    .replace(/５/g, '5')
    .replace(/６/g, '6')
    .replace(/７/g, '7')
    .replace(/８/g, '8')
    .replace(/９/g, '9');
}

/**
 * 正答値を解析（複数正答対応）
 * 例: "１" -> ["a"], "２，４" -> ["b", "d"], "３又は４" -> ["c", "d"]
 * 特殊ケース: "全員正解" -> ["a", "b", "c", "d"] (すべて正解)
 */
function parseAnswerValue(value: string): string[] {
  if (!value) return [];

  // 「全員正解」の場合はすべての選択肢を正解とする
  if (value.includes('全員正解') || value.includes('全員')) {
    return ['a', 'b', 'c', 'd'];
  }

  // 全角数字を半角に変換
  const normalized = normalizeNumber(value)
    .replace(/，/g, ',')
    .replace(/又は/g, ',')
    .replace(/または/g, ',')
    .replace(/・/g, ',');

  // カンマで分割して配列に
  const answers = normalized
    .split(',')
    .map(a => a.trim())
    .filter(a => /^[1-5]$/.test(a));

  // 数字をa, b, c, d, eに変換
  return answers.map(a => {
    const num = parseInt(a, 10);
    return String.fromCharCode(96 + num); // 1 -> 'a', 2 -> 'b', etc.
  });
}

/**
 * 正答PDFファイルからデータを抽出
 */
export async function loadAnswersFromPDF(
  pdfPath: string,
  examNumber: number
): Promise<AnswerData[]> {
  try {
    const response = await fetch(pdfPath);
    if (!response.ok) {
      throw new Error(`正答PDFの読み込みに失敗: ${pdfPath}`);
    }

    const blob = await response.blob();
    const text = await extractTextFromPDFBlob(blob);

    return parseAnswerText(text, examNumber);
  } catch (error) {
    console.error(`正答PDF読み込みエラー: ${pdfPath}`, error);
    return [];
  }
}

/**
 * PDFブロブからテキストを抽出（pdf.js使用）
 */
async function extractTextFromPDFBlob(blob: Blob): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // publicフォルダからワーカーを読み込む（Vite用）
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

  const arrayBuffer = await blob.arrayBuffer();
  
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

  let fullText = '';
  let extractedPages = 0;
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // テキストアイテムを位置情報でソートして結合
      interface TextItem {
        str: string;
        transform: number[];
      }

      const items = textContent.items as TextItem[];
      
      if (items.length === 0) {
        console.warn(`[extractTextFromPDFBlob] 警告: ページ${pageNum}にテキストが見つかりません`);
        continue;
      }
      
      const sortedItems = items.sort((a, b) => {
        // Y座標（上から下）で比較、同じ行ならX座標（左から右）で比較
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.transform[4] - b.transform[4];
      });

      const pageText = sortedItems.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      extractedPages++;
    } catch (pageError: any) {
      console.error(`[extractTextFromPDFBlob] ページ${pageNum}の処理エラー:`, pageError);
      // ページエラーは続行
    }
  }

  if (fullText.trim().length === 0) {
    throw new Error('PDFからテキストを抽出できませんでした（スキャン画像PDFの可能性）');
  }

  console.log(`[extractTextFromPDFBlob] 抽出テキスト長: ${fullText.length}文字 (${extractedPages}/${pdf.numPages}ページから抽出)`);
  
  return fullText;
}
