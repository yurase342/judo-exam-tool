# 柔道整復学 理論編試験対策ツール - プロジェクト情報

このファイルはClaude Codeが自動的に読み込む設定ファイルです。
プロジェクトの概要と過去の作業内容を記載しています。

---

## プロジェクト概要

**アプリ名**: 柔道整復学 理論編試験対策ツール
**技術スタック**: React + TypeScript + Vite + Tailwind CSS
**デプロイ先**: Vercel

### 機能
- 柔道整復師国家試験（第29回〜第33回）の問題を学習
- 学習モード（ヒントあり、即時解説）とテストモード（制限時間あり）
- 11科目別のフィルタリング
- 複数正答対応（AでもBでも正解の問題）
- 選択肢シャッフル機能
- 別冊画像参照機能

---

## 重要なファイル構成

```
public/data/questions/     # 問題JSONファイル（10ファイル、計1250問）
  ├── 29_gozen.json       # 第29回午前
  ├── 29_gogo.json        # 第29回午後
  ├── 30_gozen.json       # 第30回午前
  ├── 30_gogo.json        # 第30回午後
  ├── 31_gozen.json       # 第31回午前
  ├── 31_gogo.json        # 第31回午後
  ├── 32_gozen.json       # 第32回午前
  ├── 32_gogo.json        # 第32回午後
  ├── 33_gozen.json       # 第33回午前
  └── 33_gogo.json        # 第33回午後

src/components/
  ├── Home.tsx            # メイン画面（設定、科目選択）
  ├── CategorySelector.tsx # 科目選択コンポーネント
  ├── QuestionSession.tsx  # 問題出題セッション
  ├── QuestionView.tsx     # 問題表示
  ├── AnswerFeedback.tsx   # 回答フィードバック
  └── ResultView.tsx       # 結果画面

src/services/
  ├── jsonQuestionLoader.ts # JSON問題読み込み
  └── questionGenerator.ts  # 問題生成

src/config/
  └── categoryConfig.ts    # 科目設定（11科目）

src/types/
  ├── index.ts            # 基本型定義
  └── questionData.ts     # 問題データ型
```

---

## 科目一覧（11科目、計1250問）

| 科目ID | 科目名 | 問題数 |
|--------|--------|--------|
| judo_therapy | 柔道整復理論 | 475問 |
| anatomy | 解剖学 | 150問 |
| physiology | 生理学 | 125問 |
| clinical_general | 一般臨床医学 | 110問 |
| pathology | 病理学概論 | 65問 |
| hygiene | 衛生学・公衆衛生学 | 60問 |
| rehabilitation | リハビリテーション医学 | 55問 |
| surgery | 外科学概論 | 55問 |
| orthopedics | 整形外科学 | 55問 |
| law | 関係法規 | 50問 |
| kinesiology | 運動学 | 50問 |

---

## 最近の作業履歴（2025年1月20日）

### 1. 複数正答機能の実装
- `correctAnswers`フィールドを追加（例: `["a", "b"]`）
- AでもBでも正解の問題を正しく判定
- 学習モードで「この問題はBでも正解でした」と表示
- 結果画面で複数正答の説明を表示

**変更ファイル**:
- `src/types/questionData.ts` - 型定義追加
- `src/services/jsonQuestionLoader.ts` - 正答読み込み優先順位
- `src/components/QuestionSession.tsx` - 複数正答判定
- `src/components/AnswerFeedback.tsx` - 複数正答表示
- `src/components/ResultView.tsx` - 結果画面表示
- `public/data/questions/*.json` - 全問題に正答追加（34問が複数正答）

### 2. UI全体の大幅シンプル化
- メイン画面: 「すぐに始める」「設定を変えて始める」の2ボタンのみ
- 「すぐに始める」で10問・全科目で即開始
- 「設定を変えて始める」で詳細設定画面へ
- 設定画面: モード・出題数・回次・科目を選択して開始

**変更ファイル**:
- `src/components/Home.tsx` - 完全に書き直し（2画面構成に）
- `src/components/CategorySelector.tsx` - 不要になった（Home.tsxに統合）

---

## 問題JSONファイルの形式

```json
{
  "examNumber": 33,
  "year": 2025,
  "session": "gozen",
  "totalQuestions": 128,
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "問題文...",
      "choices": {
        "a": "選択肢A",
        "b": "選択肢B",
        "c": "選択肢C",
        "d": "選択肢D"
      },
      "category": "judo_therapy",
      "correctAnswer": "d",
      "correctAnswers": ["a", "b"]  // 複数正答の場合のみ
    }
  ]
}
```

---

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント
npm run lint
```

---

## デプロイ

- GitHubにプッシュするとVercelが自動デプロイ
- `vercel.json`でリライト設定済み

---

## 注意事項

1. **正答の優先順位**:
   - JSONの`correctAnswers` > JSONの`correctAnswer` > PDFから抽出

2. **カテゴリフィルタ**:
   - 選択した科目の問題のみが出題される
   - カテゴリが設定されていない問題は出題されない

3. **選択肢シャッフル**:
   - `shuffleChoices`オプションで選択肢の順番をランダム化
   - `correctAnswer`も自動的に更新される
