/**
 * 別冊PDFをWebP画像に変換するスクリプト
 *
 * 使用方法:
 *   node scripts/convertBessatsuToWebp.js
 *
 * 必要なパッケージ:
 *   npm install pdf-poppler sharp
 *
 * 注意:
 *   - pdf-popplerはpopplerのインストールが必要です
 *   - macOS: brew install poppler
 *   - Ubuntu: sudo apt-get install poppler-utils
 *   - Windows: http://blog.alivate.com.au/poppler-windows/
 *
 * 代替方法（Pythonを使う場合）:
 *   python scripts/convertBessatsuToWebp.py
 */

const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
  // 入力: 別冊PDFファイルの配置場所
  inputDir: path.join(__dirname, '../public/pdfs'),

  // 出力: WebP画像の出力先
  outputDir: path.join(__dirname, '../public/data/bessatsu'),

  // 別冊PDFのファイルマッピング
  bessatsuFiles: [
    { examNumber: 29, session: 'gozen', filename: '2021_29_gozen_bessatsu.pdf' },
    { examNumber: 29, session: 'gogo', filename: '2021_29_gogo_bessatsu.pdf' },
    { examNumber: 30, session: 'gozen', filename: '2022_30_gozen_bessatsu.pdf' },
    { examNumber: 30, session: 'gogo', filename: '2022_30_gogo_bessatsu.pdf' },
    { examNumber: 31, session: 'gozen', filename: '2023_31_gozen_bessatsu.pdf' },
    { examNumber: 31, session: 'gogo', filename: '2023_31_gogo_bessatsu.pdf' },
    { examNumber: 32, session: 'gozen', filename: '2024_32_gozen_bessatsu.pdf' },
    { examNumber: 32, session: 'gogo', filename: '2024_32_gogo_bessatsu.pdf' },
    { examNumber: 33, session: 'gozen', filename: '2025_33_gozen_bessatsu.pdf' },
    { examNumber: 33, session: 'gogo', filename: '2025_33_gozen_bessatsu.pdf' }, // 午後も午前の別冊を使用
  ],

  // WebP品質（0-100）
  webpQuality: 85,

  // 画像解像度（DPI）
  dpi: 200,
};

async function main() {
  console.log('=== 別冊PDF → WebP 変換スクリプト ===\n');

  // 必要なモジュールを確認
  let pdfPoppler, sharp;
  try {
    pdfPoppler = require('pdf-poppler');
    sharp = require('sharp');
  } catch (error) {
    console.error('必要なパッケージがインストールされていません。');
    console.error('以下のコマンドでインストールしてください:');
    console.error('  npm install pdf-poppler sharp');
    console.error('\nまた、popplerもシステムにインストールする必要があります:');
    console.error('  macOS: brew install poppler');
    console.error('  Ubuntu: sudo apt-get install poppler-utils');
    process.exit(1);
  }

  // 出力ディレクトリを作成
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  let totalConverted = 0;
  let totalFailed = 0;

  for (const bessatsu of CONFIG.bessatsuFiles) {
    const pdfPath = path.join(CONFIG.inputDir, bessatsu.filename);

    if (!fs.existsSync(pdfPath)) {
      console.log(`⚠️  スキップ: ${bessatsu.filename} (ファイルが見つかりません)`);
      continue;
    }

    console.log(`📄 処理中: ${bessatsu.filename}`);

    // 出力ディレクトリを作成
    const outputSubDir = path.join(CONFIG.outputDir, String(bessatsu.examNumber), bessatsu.session);
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true });
    }

    try {
      // PDFをPNGに変換（一時ファイル）
      const tempDir = path.join(__dirname, '../temp_pdf_images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const opts = {
        format: 'png',
        out_dir: tempDir,
        out_prefix: `bessatsu_${bessatsu.examNumber}_${bessatsu.session}`,
        scale: CONFIG.dpi,
      };

      await pdfPoppler.convert(pdfPath, opts);

      // 生成されたPNGファイルをWebPに変換
      const pngFiles = fs.readdirSync(tempDir)
        .filter(f => f.startsWith(opts.out_prefix) && f.endsWith('.png'))
        .sort();

      for (let i = 0; i < pngFiles.length; i++) {
        const pngPath = path.join(tempDir, pngFiles[i]);
        const pageNumber = i + 1;
        const webpPath = path.join(outputSubDir, `${pageNumber}.webp`);

        await sharp(pngPath)
          .webp({ quality: CONFIG.webpQuality })
          .toFile(webpPath);

        // 一時PNGファイルを削除
        fs.unlinkSync(pngPath);

        const stats = fs.statSync(webpPath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`   ✅ ページ ${pageNumber} → ${sizeKB}KB`);
        totalConverted++;
      }

    } catch (error) {
      console.error(`   ❌ エラー: ${error.message}`);
      totalFailed++;
    }
  }

  // 一時ディレクトリを削除
  const tempDir = path.join(__dirname, '../temp_pdf_images');
  if (fs.existsSync(tempDir)) {
    fs.rmdirSync(tempDir, { recursive: true });
  }

  console.log('\n=== 変換完了 ===');
  console.log(`✅ 成功: ${totalConverted} ページ`);
  if (totalFailed > 0) {
    console.log(`❌ 失敗: ${totalFailed} ファイル`);
  }
  console.log(`\n出力先: ${CONFIG.outputDir}`);
}

main().catch(console.error);
