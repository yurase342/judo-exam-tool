import { FileMetadata } from '../types';

/**
 * Web APIを使用したファイル選択と読み込み
 */
export async function selectPDFFiles(): Promise<FileMetadata[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf';

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) {
        reject(new Error('ファイルが選択されませんでした'));
        return;
      }

      try {
        const metadata: FileMetadata[] = [];

        for (const file of Array.from(files)) {
          const parsed = parseFilename(file.name, file.name);
          if (parsed) {
            metadata.push({
              ...parsed,
              fullPath: file.name, // Web環境ではファイル名のみ
            });
          }
        }

        // ファイルオブジェクトを保存（後でPDF解析時に使用）
        (window as any).selectedPDFFiles = files;

        resolve(metadata);
      } catch (error) {
        reject(error);
      }
    };

    input.oncancel = () => {
      reject(new Error('ファイル選択がキャンセルされました'));
    };

    input.click();
  });
}

/**
 * ファイル名からメタデータを抽出
 */
function parseFilename(filename: string, fullPath: string): FileMetadata | null {
  const pattern = /^(\d{4})_(\d+)_(gozen|gogo)(_bessatsu)?\.pdf$/i;
  const match = filename.match(pattern);

  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const examNumber = parseInt(match[2], 10);
  const session = match[3].toLowerCase() as 'gozen' | 'gogo';
  const isSupplement = !!match[4];
  const type = isSupplement ? 'supplement' : 'question';

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
 * 選択されたPDFファイルを取得
 */
export function getPDFFile(filename: string): File | null {
  const files = (window as any).selectedPDFFiles as FileList | undefined;
  if (!files) {
    return null;
  }

  for (const file of Array.from(files)) {
    if (file.name === filename) {
      return file;
    }
  }

  return null;
}

/**
 * FileオブジェクトをArrayBufferに変換
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('ファイルの読み込みに失敗しました'));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
