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
- **3つのモード**: 練習モード、小テストモード、本番モード
- 11科目別のフィルタリング
- 複数正答対応（AでもBでも正解の問題）
- 選択肢シャッフル機能
- 別冊画像参照機能

---

## 3つのモード

| モード | 説明 | 時間制限 | やめるボタン |
|--------|------|----------|--------------|
| 📚 練習 | ヒントあり、ゆっくり学習 | なし | あり |
| 📝 小テスト | 1問75秒の制限時間 | 1問75秒 | あり |
| 📋 本番 | 実際の試験と同じ環境 | 2時間30分 | なし |

### 本番モードの特徴
- 回次（第29回〜第33回）を選択
- 午前の部 / 午後の部 を選択
- 制限時間: 2時間30分（本番と同じ）
- 問題順・選択肢順のシャッフルを選択可能
- 途中でやめることはできない

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
  ├── Home.tsx            # メイン画面（3つの大きなボタン + 設定画面 + 本番モード画面）
  ├── CategorySelector.tsx # 科目選択コンポーネント（現在は使用されていない）
  ├── QuestionSession.tsx  # 問題出題セッション（タイマー、やめるボタン含む）
  ├── QuestionView.tsx     # 問題表示
  ├── AnswerFeedback.tsx   # 回答フィードバック
  └── ResultView.tsx       # 結果画面（途中終了メッセージ対応）

src/services/
  ├── jsonQuestionLoader.ts # JSON問題読み込み
  └── questionGenerator.ts  # 問題生成

src/config/
  └── categoryConfig.ts    # 科目設定（11科目）

src/types/
  ├── index.ts            # 基本型定義（Mode = 'learning' | 'test' | 'exam'）
  └── questionData.ts     # 問題データ型
```

---

## 現在のUI構造

### メイン画面（3つの大きなボタン）
```
┌─────────────────────────────┐
│      柔道整復学             │
│      対策ツール             │
├─────────────────────────────┤
│  🎯 すぐに始める            │  ← 青いボタン
│  （10問・全科目・ランダム）   │
├─────────────────────────────┤
│  ⚙️ 設定を変えて始める       │  ← 白いボタン
│  （問題数・科目・小テストなど）│
├─────────────────────────────┤
│  📋 本番モード               │  ← 赤いグラデーションボタン
│  （実際の試験と同じ環境）     │
└─────────────────────────────┘
```

### 画面遷移
```
Home.tsx
  ├── メイン画面 (currentScreen === 'main')
  │     ├── 「すぐに始める」→ QuestionSession
  │     ├── 「設定を変えて始める」→ 設定画面
  │     └── 「本番モード」→ 回次選択画面
  ├── 設定画面 (currentScreen === 'settings')
  │     └── モード・出題数・回次・科目選択 → QuestionSession
  ├── 本番モード回次選択 (currentScreen === 'exam-select')
  │     └── 第29回〜第33回選択 → 午前/午後選択画面
  └── 午前/午後選択 (currentScreen === 'exam-session-select')
        └── 午前/午後選択 + シャッフル設定 → QuestionSession
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

## 作業履歴

### 2025年1月22日 - 本番モード追加

#### 追加した機能
1. **本番モード（exam）**: 実際の国家試験と同じ環境
   - 回次選択 → 午前/午後選択 → 試験開始
   - 制限時間: 2時間30分（9000秒）
   - 途中でやめることはできない
   - 問題順・選択肢順シャッフルの選択可能

2. **やめるボタン**: 練習・小テストモードのみ
   - 確認ダイアログ表示
   - 途中終了した問題番号を記録
   - 結果画面で「問題○で終了しました」と表示

3. **テストモード → 小テストモードに名称変更**
   - UIの表示を「テスト」から「小テスト」に変更
   - 結果画面のタイトルも変更

#### 変更ファイル
- `src/types/index.ts` - Mode型に'exam'追加、AnswerStatusに'quit'追加
- `src/components/Home.tsx` - 本番モードUI追加（回次選択、午前/午後選択）
- `src/components/QuestionSession.tsx` - タイマーUI、やめるボタン、本番モード対応
- `src/components/AnswerFeedback.tsx` - mode型に'exam'追加
- `src/components/QuestionView.tsx` - mode型に'exam'追加
- `src/components/ResultView.tsx` - 途中終了メッセージ、本番モード対応
- `src/App.tsx` - quitAtQuestion対応

### 2025年1月20日 - 複数正答機能・UI簡略化

#### 複数正答機能の実装
- `correctAnswers`フィールドを追加（例: `["a", "b"]`）
- AでもBでも正解の問題を正しく判定
- 学習モードで「この問題はBでも正解でした」と表示

#### UI全体の大幅シンプル化
- メイン画面: 大きなボタン2つ → 3つに拡張
- 設定画面を内包する構造に変更

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

# 型チェックのみ
npx tsc --noEmit
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

4. **本番モードの制限時間**:
   - `EXAM_TIME_LIMIT = 150 * 60` (Home.tsx)
   - 2時間30分 = 9000秒
