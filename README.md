# abacus

React Native で作る、タッチ操作可能なそろばんトレーニングアプリのプロトタイプです。

## できること

- 珠をタップして上下に弾くアニメーション
- そろばん値のリアルタイム計算
- 問題表示と答え合わせ

## 開発

```bash
npm install
npm run typecheck
```

## 設計方針

- **Separation of Concerns**
  - `components`: 表示のみ
  - `hooks`: 画面用状態管理
  - `services`: 業務ロジック
  - `models`: 型定義
- **Open/Closed Principle**
  - ロジックを `services` に閉じ込め、UI は差し替えや拡張をしやすくする
- **Easy to read**
  - 小さな関数へ分割し、責務が読み取りやすい構成

## フォルダ構成

- `App.tsx`: 画面オーケストレーション
- `src/components/Abacus`: そろばんUI（フレーム・棒・珠）
- `src/components/Quiz`: 問題と判定UI
- `src/hooks`: `useAbacus`, `useQuiz`
- `src/services`: `abacusEngine`, `quizEngine`
- `src/models`: ドメイン型
