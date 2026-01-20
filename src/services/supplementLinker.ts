import { SupplementReference } from '../types';

/**
 * 問題文から別冊参照を検出
 * パターン例:
 * - "別冊No.12を見て答えよ"
 * - "別冊No.5A、Bを別に示す"
 * - "別冊の図3を参照"
 * - "別冊No.8A、B、Cを別に示す"
 */
export function detectSupplementReferences(questionText: string): SupplementReference[] {
  const references: SupplementReference[] = [];

  // パターン1: "別冊No.12" または "別冊No.12A"
  const pattern1 = /別冊\s*No\.\s*(\d+)([A-Za-z])?/gi;
  let match1;
  while ((match1 = pattern1.exec(questionText)) !== null) {
    const number = match1[1];
    const letter = match1[2] || '';
    const imageNumber = `${number}${letter}`;
    const referenceText = match1[0];

    references.push({
      referenceText,
      supplementId: '', // 後で設定
      imageNumber,
    });
  }

  // パターン2: "別冊No.5A、B" または "別冊No.5A、B、C"
  const pattern2 = /別冊\s*No\.\s*(\d+)([A-Za-z])[、,]\s*([A-Za-z]+)/gi;
  let match2;
  while ((match2 = pattern2.exec(questionText)) !== null) {
    const number = match2[1];
    const firstLetter = match2[2];
    const additionalLetters = match2[3];

    // 最初の画像
    references.push({
      referenceText: match2[0],
      supplementId: '',
      imageNumber: `${number}${firstLetter}`,
    });

    // 追加の画像（B, Cなど）
    for (const letter of additionalLetters) {
      references.push({
        referenceText: match2[0],
        supplementId: '',
        imageNumber: `${number}${letter}`,
      });
    }
  }

  // パターン3: "別冊の図A" または "別冊の図3"
  const pattern3 = /別冊\s*の\s*(図|表|写真)\s*([A-Za-z0-9]+)/gi;
  let match3;
  while ((match3 = pattern3.exec(questionText)) !== null) {
    const type = match3[1];
    const identifier = match3[2];
    const imageNumber = `${type}${identifier}`;

    references.push({
      referenceText: match3[0],
      supplementId: '',
      imageNumber,
    });
  }

  // パターン4: "別冊No.8A〜C" のような範囲指定
  const pattern4 = /別冊\s*No\.\s*(\d+)([A-Za-z])[〜~-]\s*([A-Za-z])/gi;
  let match4;
  while ((match4 = pattern4.exec(questionText)) !== null) {
    const number = match4[1];
    const startLetter = match4[2];
    const endLetter = match4[3];

    const startCode = startLetter.charCodeAt(0);
    const endCode = endLetter.charCodeAt(0);

    for (let code = startCode; code <= endCode; code++) {
      const letter = String.fromCharCode(code);
      references.push({
        referenceText: match4[0],
        supplementId: '',
        imageNumber: `${number}${letter}`,
      });
    }
  }

  return references;
}

/**
 * 別冊参照を問題と別冊画像に自動紐付け
 * 3条件マッチング: examNumber + session + imageNumber
 */
export function linkSupplementReferences(
  references: SupplementReference[],
  examNumber: number,
  session: 'gozen' | 'gogo',
  supplements: Array<{ id: string; imageNumber: string; examNumber: number; session: 'gozen' | 'gogo' }>
): SupplementReference[] {
  return references.map((ref) => {
    // 同じ回次・時間帯で、画像番号が一致する別冊を検索
    const matchedSupplement = supplements.find(
      (supp) =>
        supp.examNumber === examNumber &&
        supp.session === session &&
        supp.imageNumber === ref.imageNumber
    );

    if (matchedSupplement) {
      return {
        ...ref,
        supplementId: matchedSupplement.id,
      };
    }

    // 紐付けが見つからない場合は、supplementIdは空のまま（警告ログ用）
    return ref;
  });
}

/**
 * 紐付けエラーを検出
 */
export function detectLinkingErrors(
  references: SupplementReference[],
  examNumber: number,
  session: 'gozen' | 'gogo'
): Array<{ reference: SupplementReference; error: string }> {
  const errors: Array<{ reference: SupplementReference; error: string }> = [];

  for (const ref of references) {
    if (!ref.supplementId) {
      errors.push({
        reference: ref,
        error: `別冊参照「${ref.referenceText}」に対応する画像が見つかりません（第${examNumber}回 ${session === 'gozen' ? '午前' : '午後'}）`,
      });
    }
  }

  return errors;
}
