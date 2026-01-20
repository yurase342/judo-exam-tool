# 別冊PDF → WebP画像 変換スクリプト

Vercelのファイルサイズ制限を回避するため、別冊PDFを事前にWebP画像に変換するスクリプトです。

## なぜWebP画像に変換するのか？

- **Vercelの制限**: Vercelでは大きなPDFファイルの処理に制限があります
- **高速化**: PDFをその場でレンダリングする代わりに、画像を直接読み込むため高速
- **軽量化**: WebP形式は高品質を保ちながらファイルサイズを大幅に削減できます

## 必要なもの

### 方法1: Pythonを使う（推奨）

```bash
# 必要なパッケージをインストール
pip install pdf2image Pillow

# popplerをインストール
# macOS:
brew install poppler

# Ubuntu:
sudo apt-get install poppler-utils

# Windows:
# http://blog.alivate.com.au/poppler-windows/ からダウンロード
```

### 方法2: Node.jsを使う

```bash
# 必要なパッケージをインストール
npm install pdf-poppler sharp

# popplerも同様にインストールが必要
```

## 使用方法

### 1. PDFファイルを配置

別冊PDFファイルを `public/pdfs/` ディレクトリに配置します：

```
public/pdfs/
├── 2021_29_gozen_bessatsu.pdf
├── 2021_29_gogo_bessatsu.pdf
├── 2022_30_gozen_bessatsu.pdf
├── 2022_30_gogo_bessatsu.pdf
├── 2023_31_gozen_bessatsu.pdf
├── 2023_31_gogo_bessatsu.pdf
├── 2024_32_gozen_bessatsu.pdf
├── 2024_32_gogo_bessatsu.pdf
├── 2025_33_gozen_bessatsu.pdf
└── ... (その他のPDF)
```

### 2. スクリプトを実行

```bash
# Pythonの場合（推奨）
python scripts/convertBessatsuToWebp.py

# Node.jsの場合
node scripts/convertBessatsuToWebp.js
```

### 3. 出力結果

WebP画像が以下の構造で生成されます：

```
public/data/bessatsu/
├── 29/
│   ├── gozen/
│   │   ├── 1.webp
│   │   ├── 2.webp
│   │   └── ...
│   └── gogo/
│       ├── 1.webp
│       ├── 2.webp
│       └── ...
├── 30/
│   ├── gozen/
│   │   └── ...
│   └── gogo/
│       └── ...
└── ...
```

### 4. GitHubにプッシュしてVercelにデプロイ

生成されたWebP画像をコミットしてプッシュします：

```bash
git add public/data/bessatsu/
git commit -m "別冊画像をWebP形式に変換"
git push
```

## 設定のカスタマイズ

スクリプト内の `CONFIG` オブジェクトで以下を調整できます：

- `webp_quality` / `webpQuality`: 画質（0-100、デフォルト: 85）
- `dpi`: 解像度（デフォルト: 200）

## トラブルシューティング

### エラー: "poppler not found"

popplerがインストールされていません。上記のインストール手順を確認してください。

### WebP画像が大きすぎる場合

`webp_quality` を下げるか、`dpi` を下げてください：

```python
CONFIG = {
    "webp_quality": 70,  # 85から70に下げる
    "dpi": 150,          # 200から150に下げる
    ...
}
```

### 特定のPDFだけ変換したい場合

`bessatsu_files` リストを編集して、必要なPDFだけ残してください。

## 動作確認

変換後、アプリを起動して別冊画像が正しく表示されることを確認してください：

```bash
npm run dev
```

ブラウザの開発者ツール（Console）で以下のようなログが表示されれば成功です：

```
[bessatsuRenderer] 別冊画像読み込み開始: /data/bessatsu/32/gozen/1.webp
[bessatsuRenderer] 別冊画像読み込み完了: /data/bessatsu/32/gozen/1.webp
```
