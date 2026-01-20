/**
 * 科目（カテゴリ）設定
 * 柔道整復師国家試験の11科目を定義
 */

export type CategoryId =
  | 'anatomy'           // 解剖学
  | 'physiology'        // 生理学
  | 'kinesiology'       // 運動学
  | 'pathology'         // 病理学概論
  | 'hygiene'           // 衛生学・公衆衛生学
  | 'clinical_general'  // 一般臨床医学
  | 'surgery'           // 外科学概論
  | 'orthopedics'       // 整形外科学
  | 'rehabilitation'    // リハビリテーション医学
  | 'judo_therapy'      // 柔道整復理論
  | 'law';              // 関係法規

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  shortName: string;
  description: string;
  color: string; // Tailwind CSS color class
}

/**
 * 科目情報の定義
 */
export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  anatomy: {
    id: 'anatomy',
    name: '解剖学',
    shortName: '解剖',
    description: '人体の構造（骨格系、筋系、神経系、脈管系、内臓系など）',
    color: 'blue',
  },
  physiology: {
    id: 'physiology',
    name: '生理学',
    shortName: '生理',
    description: '人体の機能（細胞、神経、筋、循環、呼吸、消化、内分泌など）',
    color: 'green',
  },
  kinesiology: {
    id: 'kinesiology',
    name: '運動学',
    shortName: '運動',
    description: '運動力学、関節運動、筋の機能、姿勢・歩行',
    color: 'purple',
  },
  pathology: {
    id: 'pathology',
    name: '病理学概論',
    shortName: '病理',
    description: '循環障害、退行性・進行性病変、炎症、免疫、腫瘍',
    color: 'red',
  },
  hygiene: {
    id: 'hygiene',
    name: '衛生学・公衆衛生学',
    shortName: '衛生',
    description: '疫学、母子保健、成人・高齢者保健、感染症、環境衛生',
    color: 'teal',
  },
  clinical_general: {
    id: 'clinical_general',
    name: '一般臨床医学',
    shortName: '臨床',
    description: '診察法、バイタルサイン、内科学、神経疾患、膠原病',
    color: 'orange',
  },
  surgery: {
    id: 'surgery',
    name: '外科学概論',
    shortName: '外科',
    description: '創傷処置、消毒・滅菌、出血・ショック、心肺蘇生',
    color: 'pink',
  },
  orthopedics: {
    id: 'orthopedics',
    name: '整形外科学',
    shortName: '整形',
    description: '骨・軟部腫瘍、代謝性骨疾患、骨端症、部位別疾患',
    color: 'indigo',
  },
  rehabilitation: {
    id: 'rehabilitation',
    name: 'リハビリテーション医学',
    shortName: 'リハ',
    description: 'ICF、評価（MMT・ROM・ADL）、装具、運動療法',
    color: 'cyan',
  },
  judo_therapy: {
    id: 'judo_therapy',
    name: '柔道整復理論',
    shortName: '柔理',
    description: '骨折・脱臼・軟部組織損傷の診察・整復・固定・後療法',
    color: 'amber',
  },
  law: {
    id: 'law',
    name: '関係法規',
    shortName: '法規',
    description: '柔道整復師法、医事関係法規、社会保険制度',
    color: 'gray',
  },
};

/**
 * 科目リスト（表示順）
 */
export const CATEGORY_LIST: CategoryId[] = [
  'judo_therapy',
  'law',
  'anatomy',
  'physiology',
  'kinesiology',
  'pathology',
  'hygiene',
  'rehabilitation',
  'clinical_general',
  'surgery',
  'orthopedics',
];

/**
 * 問題番号から科目を判定するマッピング
 * 午前・午後で異なるため、それぞれ定義
 *
 * 注意: これは一般的な傾向に基づく推定であり、
 * 年度によって若干の変動がある可能性があります
 */
export interface QuestionRangeMapping {
  startQuestion: number;
  endQuestion: number;
  category: CategoryId;
}

/**
 * 午前問題の科目マッピング（問1〜128）
 */
export const GOZEN_CATEGORY_MAPPING: QuestionRangeMapping[] = [
  // 柔道整復理論（必修含む）: 問1〜40
  { startQuestion: 1, endQuestion: 40, category: 'judo_therapy' },
  // 関係法規: 問41〜50
  { startQuestion: 41, endQuestion: 50, category: 'law' },
  // 解剖学: 問51〜80
  { startQuestion: 51, endQuestion: 80, category: 'anatomy' },
  // 生理学: 問81〜105
  { startQuestion: 81, endQuestion: 105, category: 'physiology' },
  // 運動学: 問106〜115
  { startQuestion: 106, endQuestion: 115, category: 'kinesiology' },
  // 病理学概論: 問116〜128
  { startQuestion: 116, endQuestion: 128, category: 'pathology' },
];

/**
 * 午後問題の科目マッピング（問1〜122）
 */
export const GOGO_CATEGORY_MAPPING: QuestionRangeMapping[] = [
  // 衛生学・公衆衛生学: 問1〜12
  { startQuestion: 1, endQuestion: 12, category: 'hygiene' },
  // リハビリテーション医学: 問13〜23
  { startQuestion: 13, endQuestion: 23, category: 'rehabilitation' },
  // 一般臨床医学: 問24〜45
  { startQuestion: 24, endQuestion: 45, category: 'clinical_general' },
  // 外科学概論: 問46〜56
  { startQuestion: 46, endQuestion: 56, category: 'surgery' },
  // 整形外科学: 問57〜67
  { startQuestion: 57, endQuestion: 67, category: 'orthopedics' },
  // 柔道整復理論（各論）: 問68〜122
  { startQuestion: 68, endQuestion: 122, category: 'judo_therapy' },
];

/**
 * 問題番号から科目を取得
 * @param questionNumber 問題番号
 * @param session セッション（gozen/gogo）
 * @returns 科目ID
 */
export function getCategoryByQuestionNumber(
  questionNumber: number,
  session: 'gozen' | 'gogo'
): CategoryId {
  const mapping = session === 'gozen' ? GOZEN_CATEGORY_MAPPING : GOGO_CATEGORY_MAPPING;

  for (const range of mapping) {
    if (questionNumber >= range.startQuestion && questionNumber <= range.endQuestion) {
      return range.category;
    }
  }

  // デフォルトは柔道整復理論
  return 'judo_therapy';
}

/**
 * 科目情報を取得
 */
export function getCategoryInfo(categoryId: CategoryId): CategoryInfo {
  return CATEGORIES[categoryId];
}

/**
 * 全科目情報を取得
 */
export function getAllCategories(): CategoryInfo[] {
  return CATEGORY_LIST.map(id => CATEGORIES[id]);
}
