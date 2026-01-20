/**
 * ヒント生成サービス
 * 問題文と選択肢から自動的にキーワードと考え方のヒントを抽出
 */

import { Question, CategoryId } from '../types';

export interface GeneratedHint {
  keywords: string[];
  thinkingHints: string[];
}

/**
 * 医学用語辞書（カテゴリ別）
 */
const MEDICAL_TERMS: Record<string, string[]> = {
  // 骨・関節
  bones: [
    '上腕骨', '橈骨', '尺骨', '大腿骨', '脛骨', '腓骨', '鎖骨', '肩甲骨', '骨盤',
    '頭蓋骨', '脊椎', '椎骨', '頸椎', '胸椎', '腰椎', '仙骨', '尾骨', '肋骨',
    '胸骨', '手根骨', '中手骨', '指骨', '足根骨', '中足骨', '踵骨', '距骨',
    '寛骨', '腸骨', '坐骨', '恥骨', '大転子', '小転子', '骨頭', '骨幹', '骨端',
    '顆', '上顆', '外側上顆', '内側上顆', '茎状突起', '結節', '粗面', '窩',
  ],
  // 筋肉
  muscles: [
    '大胸筋', '小胸筋', '三角筋', '僧帽筋', '広背筋', '上腕二頭筋', '上腕三頭筋',
    '腕橈骨筋', '回外筋', '回内筋', '大腿四頭筋', '大腿二頭筋', 'ハムストリング',
    '腓腹筋', 'ヒラメ筋', '前脛骨筋', '腸腰筋', '大殿筋', '中殿筋', '小殿筋',
    '腹直筋', '外腹斜筋', '内腹斜筋', '腹横筋', '脊柱起立筋', '菱形筋',
    '肩甲挙筋', '棘上筋', '棘下筋', '小円筋', '大円筋', '肩甲下筋', '縫工筋',
    '内転筋', '外転筋', '屈筋', '伸筋', '回旋筋腱板', 'ローテーターカフ',
  ],
  // 神経
  nerves: [
    '正中神経', '尺骨神経', '橈骨神経', '腕神経叢', '坐骨神経', '大腿神経',
    '腓骨神経', '脛骨神経', '腋窩神経', '筋皮神経', '肩甲上神経', '長胸神経',
    '副神経', '顔面神経', '三叉神経', '迷走神経', '舌咽神経', '交感神経',
    '副交感神経', '自律神経', '脊髄神経', '末梢神経', '中枢神経',
  ],
  // 疾患・外傷
  conditions: [
    '骨折', '脱臼', '捻挫', '打撲', '挫傷', '肉離れ', '腱断裂', '靭帯損傷',
    'コーレス骨折', 'スミス骨折', 'モンテジア骨折', 'ガレアッチ骨折',
    '上腕骨外科頸骨折', '上腕骨顆上骨折', '肘内障', '肩関節脱臼', '股関節脱臼',
    '膝関節脱臼', 'アキレス腱断裂', '前十字靭帯損傷', '半月板損傷',
    '椎間板ヘルニア', '脊柱管狭窄症', '変形性関節症', '関節リウマチ',
    '骨粗鬆症', '骨壊死', '骨髄炎', '腱鞘炎', '滑液包炎', 'ばね指',
  ],
  // 検査・徴候
  signs: [
    '圧痛', '腫脹', '変形', '機能障害', '異常可動性', '軋轢音', 'クレピタス',
    '筋力低下', '感覚障害', '反射異常', '関節可動域', 'ROM', 'MMT',
    'ラセーグテスト', 'SLRテスト', 'トーマステスト', 'パトリックテスト',
    'マクマレーテスト', 'アプレーテスト', '前方引き出しテスト', 'ラックマンテスト',
    'ドロップアームサイン', 'ペインフルアーク', 'スピードテスト', 'ヤーガソンテスト',
  ],
  // 治療・固定
  treatment: [
    '整復', '固定', '後療法', 'RICE処置', '冷却', '圧迫', '挙上', '安静',
    'ギプス', 'シーネ', '副子', 'テーピング', '包帯', '三角巾', '牽引',
    '物理療法', '運動療法', 'マッサージ', 'ストレッチ', '筋力強化',
  ],
  // 解剖学的位置
  positions: [
    '近位', '遠位', '内側', '外側', '前方', '後方', '上方', '下方',
    '浅層', '深層', '背側', '掌側', '足底', '足背', '屈側', '伸側',
  ],
  // 生理学用語
  physiology: [
    '収縮', '弛緩', '興奮', '伝導', '反射', '代謝', '循環', '呼吸',
    '消化', '吸収', '排泄', 'ホルモン', '酵素', '神経伝達物質',
    'ATP', '乳酸', 'グリコーゲン', '酸素', '二酸化炭素',
  ],
};

/**
 * 科目別の考え方ヒント
 */
const CATEGORY_THINKING_HINTS: Record<CategoryId, string[]> = {
  anatomy: [
    '骨の形状と特徴を思い出しましょう',
    '筋の起始・停止・作用を確認しましょう',
    '神経の走行と支配領域を考えましょう',
    '血管の分岐と走行を思い出しましょう',
  ],
  physiology: [
    '生体の恒常性（ホメオスタシス）を考えましょう',
    '神経系と内分泌系の調節機構を思い出しましょう',
    '興奮と伝導のメカニズムを確認しましょう',
    '代謝経路とエネルギー産生を考えましょう',
  ],
  kinesiology: [
    '関節運動の種類と軸を確認しましょう',
    '主動作筋と拮抗筋の関係を考えましょう',
    '運動連鎖と代償動作を思い出しましょう',
    '姿勢と重心の関係を考えましょう',
  ],
  pathology: [
    '病変の基本的な変化（変性、壊死、炎症など）を思い出しましょう',
    '原因と結果の因果関係を考えましょう',
    '急性と慢性の違いを確認しましょう',
    '全身性と局所性の違いを考えましょう',
  ],
  hygiene: [
    '疫学の基本指標を確認しましょう',
    '予防の3段階（一次・二次・三次）を思い出しましょう',
    '感染症の感染経路を考えましょう',
    '環境因子と健康の関係を確認しましょう',
  ],
  clinical_general: [
    '症状と疾患の関連を考えましょう',
    'バイタルサインの正常値を確認しましょう',
    '検査所見の意味を思い出しましょう',
    '鑑別診断のポイントを考えましょう',
  ],
  surgery: [
    '創傷治癒の過程を思い出しましょう',
    '消毒と滅菌の違いを確認しましょう',
    '出血と止血の方法を考えましょう',
    '救急処置の優先順位を思い出しましょう',
  ],
  orthopedics: [
    '骨・関節疾患の特徴的な症状を思い出しましょう',
    '画像所見の特徴を確認しましょう',
    '保存療法と手術療法の適応を考えましょう',
    '合併症と後遺症を思い出しましょう',
  ],
  rehabilitation: [
    'ICFの概念を思い出しましょう',
    '評価法（MMT、ROM、ADL）の意味を確認しましょう',
    '運動療法の目的と方法を考えましょう',
    '装具の種類と適応を思い出しましょう',
  ],
  judo_therapy: [
    '骨折の分類と特徴を確認しましょう',
    '脱臼の整復方法を思い出しましょう',
    '固定の原則と期間を考えましょう',
    '後療法の目的と方法を確認しましょう',
  ],
  law: [
    '柔道整復師法の条文を思い出しましょう',
    '業務範囲と禁止事項を確認しましょう',
    '届出義務と罰則を考えましょう',
    '保険制度の仕組みを思い出しましょう',
  ],
};

/**
 * 問題文のパターンに基づくヒント
 */
function getQuestionPatternHint(questionText: string): string | null {
  if (questionText.includes('誤っている') || questionText.includes('誤りは')) {
    return '「誤っているもの」を選ぶ問題です。正しい記述を除外していきましょう';
  }
  if (questionText.includes('正しい') || questionText.includes('適切な')) {
    return '正しい記述を選ぶ問題です。各選択肢を慎重に検討しましょう';
  }
  if (questionText.includes('組合せ') || questionText.includes('組み合わせ')) {
    return '組み合わせ問題です。各要素の関連性を確認しましょう';
  }
  if (questionText.includes('順序') || questionText.includes('順番')) {
    return '順序を問う問題です。時系列や優先順位を考えましょう';
  }
  if (questionText.includes('原因') || questionText.includes('機序')) {
    return '原因やメカニズムを問う問題です。因果関係を整理しましょう';
  }
  if (questionText.includes('症状') || questionText.includes('所見')) {
    return '症状や所見を問う問題です。特徴的な臨床像を思い出しましょう';
  }
  if (questionText.includes('治療') || questionText.includes('処置')) {
    return '治療法を問う問題です。適応と禁忌を確認しましょう';
  }
  return null;
}

/**
 * テキストからキーワードを抽出
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const allTerms = Object.values(MEDICAL_TERMS).flat();

  for (const term of allTerms) {
    if (text.includes(term) && !keywords.includes(term)) {
      keywords.push(term);
    }
  }

  return keywords;
}

/**
 * 正解の選択肢から部分的なヒントを生成（ネタバレしない程度に）
 */
function getCorrectAnswerHint(question: Question): string | null {
  const correctChoice = question.choices.find(
    c => c.label.toLowerCase() === question.correctAnswer.toLowerCase()
  );

  if (!correctChoice) return null;

  const text = correctChoice.text;
  const keywords = extractKeywords(text);

  if (keywords.length > 0) {
    // キーワードが含まれる場合、関連する考え方を示唆
    const boneKeywords = MEDICAL_TERMS.bones.filter(t => text.includes(t));
    const muscleKeywords = MEDICAL_TERMS.muscles.filter(t => text.includes(t));
    const nerveKeywords = MEDICAL_TERMS.nerves.filter(t => text.includes(t));

    if (boneKeywords.length > 0) {
      return '骨の解剖学的特徴に注目しましょう';
    }
    if (muscleKeywords.length > 0) {
      return '筋の作用と支配神経を確認しましょう';
    }
    if (nerveKeywords.length > 0) {
      return '神経の走行と支配領域を思い出しましょう';
    }
  }

  return null;
}

/**
 * ヒントを生成
 */
export function generateHint(question: Question): GeneratedHint {
  const keywords: string[] = [];
  const thinkingHints: string[] = [];

  // 1. 問題文からキーワードを抽出
  const questionKeywords = extractKeywords(question.questionText);
  keywords.push(...questionKeywords);

  // 2. 選択肢からもキーワードを抽出（全選択肢から）
  for (const choice of question.choices) {
    const choiceKeywords = extractKeywords(choice.text);
    for (const kw of choiceKeywords) {
      if (!keywords.includes(kw)) {
        keywords.push(kw);
      }
    }
  }

  // 3. キーワードは最大5個まで
  const limitedKeywords = keywords.slice(0, 5);

  // 4. 問題パターンに基づくヒント
  const patternHint = getQuestionPatternHint(question.questionText);
  if (patternHint) {
    thinkingHints.push(patternHint);
  }

  // 5. 科目に基づくヒント
  if (question.category) {
    const categoryHints = CATEGORY_THINKING_HINTS[question.category];
    if (categoryHints && categoryHints.length > 0) {
      // ランダムに1つ選択
      const randomHint = categoryHints[Math.floor(Math.random() * categoryHints.length)];
      thinkingHints.push(randomHint);
    }
  }

  // 6. 正解に関連するヒント（ネタバレしない程度に）
  const answerHint = getCorrectAnswerHint(question);
  if (answerHint && !thinkingHints.includes(answerHint)) {
    thinkingHints.push(answerHint);
  }

  // 7. キーワードが見つからなかった場合のフォールバック
  if (limitedKeywords.length === 0) {
    // 問題文から名詞らしきものを抽出（簡易的）
    const nouns = question.questionText.match(/[ァ-ヴー]+|[一-龥]+/g);
    if (nouns) {
      const uniqueNouns = [...new Set(nouns)].filter(n => n.length >= 2).slice(0, 3);
      limitedKeywords.push(...uniqueNouns);
    }
  }

  // 8. ヒントが少ない場合のフォールバック
  if (thinkingHints.length === 0) {
    thinkingHints.push('選択肢を一つずつ検討し、消去法も活用しましょう');
  }

  return {
    keywords: limitedKeywords,
    thinkingHints: thinkingHints,
  };
}
