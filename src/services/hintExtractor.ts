import { QuestionHint } from '../types';

/**
 * 問題文と解説からキーワードを抽出
 * 簡易版実装（実際にはkuromoji.js等を使用して形態素解析を行う）
 */
export function extractKeywords(questionText: string, explanation: string): string[] {
  const keywords: string[] = [];
  const combinedText = `${questionText} ${explanation}`;

  // 医学用語のパターン（簡易版）
  const medicalTerms = [
    '急性', '慢性', '炎症', '疾患', '症候群', '徴候', '症状',
    '診断', '治療', '検査', '画像', 'CT', 'MRI', 'X線',
    '骨折', '脱臼', '捻挫', '打撲', '挫傷',
    '膵炎', '肝炎', '腎炎', '肺炎', '心筋梗塞',
    'アミラーゼ', 'CRP', '白血球', '赤血球', '血小板',
  ];

  for (const term of medicalTerms) {
    if (combinedText.includes(term) && !keywords.includes(term)) {
      keywords.push(term);
    }
  }

  // 重要な名詞を抽出（簡易版）
  // 実際の実装では、kuromoji.jsで形態素解析を行い、名詞を抽出
  const nounPatterns = [
    /([A-Za-z]+症)/g,
    /([A-Za-z]+炎)/g,
    /([A-Za-z]+病)/g,
    /([A-Za-z]+症候群)/g,
  ];

  for (const pattern of nounPatterns) {
    const matches = combinedText.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (!keywords.includes(match)) {
          keywords.push(match);
        }
      }
    }
  }

  return keywords.slice(0, 10); // 最大10個まで
}

/**
 * 解説からヒントを抽出
 * 正解に導くフレーズを抽出
 */
export function extractHints(explanation: string): string[] {
  const hints: string[] = [];

  // 重要なフレーズパターン
  const hintPatterns = [
    /(重要なのは[^。]+)/g,
    /(特徴として[^。]+)/g,
    /(診断のポイントは[^。]+)/g,
    /(注意すべきは[^。]+)/g,
    /(典型的な[^。]+)/g,
  ];

  for (const pattern of hintPatterns) {
    const matches = explanation.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (match.length > 10 && match.length < 100) {
          hints.push(match.trim());
        }
      }
    }
  }

  // 数値や検査値に関するヒント
  const valueHints = explanation.match(/(\d+[^。]*)/g);
  if (valueHints) {
    for (const hint of valueHints.slice(0, 3)) {
      if (hint.length > 5 && hint.length < 50) {
        hints.push(hint.trim());
      }
    }
  }

  return hints.slice(0, 5); // 最大5個まで
}

/**
 * 問題からヒントデータを生成
 */
export function generateHint(question: {
  id: string;
  questionText: string;
  explanation: string;
}): QuestionHint {
  const keywords = extractKeywords(question.questionText, question.explanation);
  const hints = extractHints(question.explanation);

  return {
    questionId: question.id,
    keywords,
    hints,
  };
}
