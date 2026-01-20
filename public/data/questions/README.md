# 問題データJSONファイル形式

このフォルダにはJSONベースの問題データを配置します。
問題PDFがスキャン画像形式でテキスト抽出ができない場合に使用します。

## ファイル命名規則

`{回次}_{セッション}.json`

例:
- `29_gozen.json` - 第29回 午前
- `29_gogo.json` - 第29回 午後
- `31_gozen.json` - 第31回 午前

## JSONフォーマット

```json
{
  "examNumber": 29,
  "year": 2021,
  "session": "gozen",
  "totalQuestions": 115,
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "問題文をここに入力してください。",
      "choices": {
        "a": "選択肢1",
        "b": "選択肢2",
        "c": "選択肢3",
        "d": "選択肢4",
        "e": "選択肢5"
      }
    },
    {
      "questionNumber": 2,
      "questionText": "別冊参照が必要な問題の例です。",
      "choices": {
        "a": "選択肢1",
        "b": "選択肢2",
        "c": "選択肢3",
        "d": "選択肢4",
        "e": "選択肢5"
      },
      "bessatsuPage": 1,
      "bessatsuLabel": "別冊No.1"
    }
  ]
}
```

## フィールド説明

### ルートオブジェクト

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| examNumber | number | ◯ | 回次（例: 29, 30, 31） |
| year | number | ◯ | 年度（例: 2021, 2022） |
| session | string | ◯ | セッション（"gozen" または "gogo"） |
| totalQuestions | number | ◯ | 問題総数（通常115） |
| questions | array | ◯ | 問題データの配列 |

### 問題オブジェクト

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| questionNumber | number | ◯ | 問題番号（1から開始） |
| questionText | string | ◯ | 問題文 |
| choices | object | ◯ | 選択肢（a〜e） |
| bessatsuPage | number | △ | 別冊PDFのページ番号（1から開始） |
| bessatsuLabel | string | △ | 別冊の表示ラベル |

## 注意事項

1. **正答は別ファイル**: 正答は `public/answers/` の正答PDFから自動抽出されます。
   JSONファイルには正答を含めません。

2. **文字エンコーディング**: ファイルはUTF-8で保存してください。

3. **別冊参照**:
   - `bessatsuPage` は別冊PDFのページ番号です（1から開始）
   - 別冊PDFは `public/pdfs/` に `{年}_{回次}_{セッション}_bessatsu.pdf` の形式で配置

4. **問題番号の連続性**: 1から始まり、連続している必要があります。

## 入力例

```json
{
  "questionNumber": 45,
  "questionText": "骨折の癒合期間に影響を与える因子で正しいのはどれか。",
  "choices": {
    "a": "年齢が高いほど癒合は早い",
    "b": "骨折部の血流障害は癒合を促進する",
    "c": "離開転位は癒合を遅延させる",
    "d": "骨欠損があっても癒合には影響しない",
    "e": "感染は癒合を促進する"
  }
}
```
