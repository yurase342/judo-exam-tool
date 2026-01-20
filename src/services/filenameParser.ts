import { FileMetadata, SessionType, QuestionType } from '../types';

/**
 * ファイル名から年度・回次・時間帯・タイプを自動抽出
 * パターン: {年度}_{回次}_{時間帯}.pdf または {年度}_{回次}_{時間帯}_bessatsu.pdf
 * 例: 2021_29_gozen.pdf, 2021_29_gozen_bessatsu.pdf
 */
export function parseFilename(filename: string, fullPath: string): FileMetadata | null {
  // 正規表現パターン: /(\d{4})_(\d+)_(gozen|gogo)(_bessatsu)?\.pdf/
  const pattern = /^(\d{4})_(\d+)_(gozen|gogo)(_bessatsu)?\.pdf$/i;
  const match = filename.match(pattern);

  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const examNumber = parseInt(match[2], 10);
  const session = match[3].toLowerCase() as SessionType;
  const isSupplement = !!match[4]; // _bessatsu があるかどうか
  const type: QuestionType = isSupplement ? 'supplement' : 'question';

  return {
    year,
    examNumber,
    session,
    type,
    filename,
    fullPath,
  };
}

/**
 * フォルダ内のPDFファイルを解析してメタデータを抽出
 */
export function parseFolderFiles(files: string[], folderPath: string): FileMetadata[] {
  const results: FileMetadata[] = [];

  for (const file of files) {
    if (!file.endsWith('.pdf')) {
      continue;
    }

    const fullPath = `${folderPath}/${file}`;
    const metadata = parseFilename(file, fullPath);

    if (metadata) {
      results.push(metadata);
    }
  }

  return results;
}

/**
 * ファイル名が有効な形式かどうかをチェック
 */
export function isValidFilename(filename: string): boolean {
  const pattern = /^(\d{4})_(\d+)_(gozen|gogo)(_bessatsu)?\.pdf$/i;
  return pattern.test(filename);
}
