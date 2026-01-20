import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Answer, Question, SessionSummary, Mode } from '../types';

/**
 * 日本語フォントを読み込んでPDFに追加
 * Noto Sans JPのTTF形式フォントをCDNから読み込む
 */
async function loadJapaneseFont(doc: jsPDF): Promise<void> {
  try {
    // まず、publicフォルダからフォントファイルを読み込むことを試みる
    try {
      const fontResponse = await fetch('/fonts/NotoSansJP-Regular.ttf');
      if (fontResponse.ok) {
        const fontBlob = await fontResponse.blob();
        const fontArrayBuffer = await fontBlob.arrayBuffer();
        const fontBase64 = btoa(
          String.fromCharCode(...new Uint8Array(fontArrayBuffer))
        );
        
        doc.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
        doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
        doc.setFont('NotoSansJP');
        return;
      }
    } catch (localError) {
      console.log('ローカルフォントファイルが見つかりません。CDNから読み込みます。');
    }
    
    // ローカルフォントが見つからない場合は、CDNから読み込む
    // Noto Sans JPのTTF形式フォントをGitHubから読み込む
    const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP-Regular.ttf';
    
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error('フォントの読み込みに失敗しました');
    }
    
    const fontBlob = await response.blob();
    const fontArrayBuffer = await fontBlob.arrayBuffer();
    const fontBase64 = btoa(
      String.fromCharCode(...new Uint8Array(fontArrayBuffer))
    );
    
    // jsPDFにフォントを追加
    doc.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
    doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
    doc.setFont('NotoSansJP');
  } catch (error) {
    console.warn('日本語フォントの読み込みに失敗しました。デフォルトフォントを使用します。', error);
    // フォント読み込みに失敗した場合は、デフォルトフォントを使用
    // 日本語は文字化けする可能性がありますが、処理は続行します
  }
}

/**
 * 結果レポートをPDF形式で出力
 */
export async function exportResultToPDF(
  answers: Answer[],
  questions: Question[],
  summary: SessionSummary,
  mode: Mode
): Promise<void> {
  const doc = new jsPDF();
  
  // 日本語フォントを読み込む
  await loadJapaneseFont(doc);
  
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // タイトル
  doc.setFontSize(18);
  doc.text(
    mode === 'learning' ? '学習結果レポート' : 'テスト結果レポート',
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 10;

  // 日時
  doc.setFontSize(10);
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  doc.text(dateStr, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // 総合成績
  doc.setFontSize(14);
  doc.text('【総合成績】', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  const summaryText = `出題数: ${summary.totalQuestions}問 | 正答: ${summary.correctCount}問 | 誤答: ${summary.incorrectCount}問 | 正答率: ${summary.accuracy.toFixed(1)}%`;
  doc.text(summaryText, 20, yPosition);
  yPosition += 6;

  if (mode === 'learning') {
    const timeText = `総回答時間: ${Math.floor(summary.totalTime / 60)}分${summary.totalTime % 60}秒 | 平均: ${(summary.averageTime / 60).toFixed(1)}分/問`;
    doc.text(timeText, 20, yPosition);
    yPosition += 6;
  } else {
    if (summary.skippedCount > 0) {
      doc.text(`スキップ: ${summary.skippedCount}問 ⏭`, 20, yPosition);
      yPosition += 6;
    }
    if (summary.timeoutCount > 0) {
      doc.text(`時間切れ未回答: ${summary.timeoutCount}問 ⏱`, 20, yPosition);
      yPosition += 6;
    }
    if (summary.remainingTime !== undefined) {
      const mins = Math.floor(summary.remainingTime / 60);
      const secs = summary.remainingTime % 60;
      const remainingText = summary.isTimeUp
        ? '⏱ 時間切れにより終了しました'
        : secs > 0
        ? `✓ ${mins}分${secs}秒残しで完了！`
        : `✓ ${mins}分残しで完了！`;
      doc.text(remainingText, 20, yPosition);
      yPosition += 6;
    }
  }

  yPosition += 5;

  // 問題別結果テーブル
  const tableData = questions.map((q, index) => {
    const answer = answers[index];
    const status =
      answer?.isCorrect === true
        ? '✓'
        : answer?.status === 'skipped'
        ? '⏭'
        : answer?.status === 'timeout'
        ? '⏱'
        : '✗';

    return [
      index + 1,
      `${q.examNumber}回${q.session === 'gozen' ? '午前' : '午後'}-${q.questionNumber}`,
      status,
      answer?.selectedAnswer || '未回答',
      q.correctAnswer,
      answer?.timeSpent && answer.timeSpent > 0
        ? `${Math.floor(answer.timeSpent / 60)}:${(answer.timeSpent % 60).toString().padStart(2, '0')}`
        : '-',
      answer?.isCorrect === false || answer?.status !== 'answered'
        ? q.explanation.substring(0, 30) + '...'
        : '',
    ];
  });

  // 日本語フォントが読み込まれている場合は、autoTableでも使用
  const fontName = doc.getFont().fontName;
  const useJapaneseFont = fontName === 'NotoSansJP';
  
  autoTable(doc, {
    startY: yPosition,
    head: [['No.', '出典', '結果', '回答', '正解', '時間', '解説(要約)']],
    body: tableData,
    styles: { 
      fontSize: 8,
      font: useJapaneseFont ? 'NotoSansJP' : 'helvetica',
    },
    headStyles: { 
      fillColor: [66, 139, 202],
      font: useJapaneseFont ? 'NotoSansJP' : 'helvetica',
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 20, right: 20 },
  });

  // PDFをダウンロード
  const filename = `結果_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}.pdf`;
  doc.save(filename);
}
