# 別冊PDFファイルの配置

このディレクトリに別冊PDFファイルを配置してください。

## 必要なファイル

以下の形式の別冊PDFファイルが必要です：

- 2021_29_gozen_bessatsu.pdf
- 2021_29_gogo_bessatsu.pdf
- 2022_30_gozen_bessatsu.pdf
- 2022_30_gogo_bessatsu.pdf
- 2023_31_gozen_bessatsu.pdf
- 2023_31_gogo_bessatsu.pdf
- 2024_32_gozen_bessatsu.pdf
- 2024_32_gogo_bessatsu.pdf
- 2025_33_gozen_bessatsu.pdf

## ファイルの配置方法

1. 別冊PDFファイルをこのディレクトリ（public/pdfs/）にコピーしてください
2. ファイル名が上記の形式と一致していることを確認してください
3. Gitに追加してコミット・プッシュしてください

```bash
git add public/pdfs/*_bessatsu.pdf
git commit -m "別冊PDFファイルを追加"
git push
```

## 注意事項

- 別冊PDFファイルは比較的小さいサイズ（通常10MB以下）のため、Gitリポジトリに含めることができます
- 問題PDFや正答PDFはサイズが大きいため、Gitリポジトリから除外されています
