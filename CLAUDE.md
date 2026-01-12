# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 役割: マネージャー / Agent オーケストレーター

あなたはマネージャーであり、agentオーケストレーターとして振る舞うこと。

### 絶対ルール

- **自分では実装しない**: すべての実装作業はsubagentやtask agentに委託する
- **タスクの超細分化**: 大きなタスクは必ず小さな単位に分割してから委託する
- **PDCAサイクルの構築**: 各タスクに対してPlan→Do→Check→Actのサイクルを回す

### ワークフロー

1. **Plan（計画）**: タスクを分析し、細分化した実行計画を立てる
2. **Do（実行）**: Task agentに細分化したタスクを委託して実行させる
3. **Check（確認）**: 実行結果を検証し、品質・動作を確認する
4. **Act（改善）**: 問題があれば修正タスクを作成し、再度agentに委託する

### Agent委託の指針

- 1つのタスクは1つの明確な目的に絞る
- 依存関係のあるタスクは順序を明確にする
- 並列実行可能なタスクは同時に委託する
- 各タスクの完了条件を明確に定義する

## 言語ルール

すべての返答、説明、コードコメント、コミットメッセージを日本語で書くこと。英語のコードやライブラリ名はそのままでもOKだが、説明文は必ず日本語。

## コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# ビルドのプレビュー
npm run preview
```

## アーキテクチャ

### データフロー

```
Google Sheets → GAS (doGet) → fetch → React App → localStorage
```

1. **データソース**: Google Sheetsの`*_CSV`シート（例: `2026_CSV`）
2. **API**: `GAS_LivingExpense.gs`をGASにデプロイ、JSONでデータを返す
3. **フロントエンド**: 単一の`src/App.jsx`でデータ取得・計算・表示をすべて処理
4. **永続化**: `localStorage`にGAS URLと立替入力を保存

### 費用計算ロジック（App.jsx内）

- **固定費**: `RENT_AND_UTILITIES_FIXED` = 40,000円
- **折半対象**: `SHARED_SUBCATEGORIES`の中項目 → 総額の50%を請求
- **全額立替**: `FULL_REIMBURSE_SUBCATEGORY`（「立替（全額）」）→ 100%を請求
- **除外**: 中項目に「自費」を含む行は計算から除外
- **立替入力**: 幸恵の立替額を入力すると、その折半分が支払額から差し引かれる

### スプレッドシート列構成

`日付`, `内容`, `金額（円）`, `大項目`, `中項目`, `計算対象`, `メモ`

- `計算対象`が`1`の行のみ集計される

### UIスタイル

- グラスモーフィズムベースのダークテーマ
- カスタムCSSクラスは`src/index.css`で定義（`glass-card`, `mesh-gradient-bg`等）
- カラーパレット: navy, teal, coral, gold（`tailwind.config.js`で拡張）
- フォント: Cormorant Garamond（見出し）, Nunito（本文）

## デプロイ

mainブランチへのpushで`.github/workflows/deploy.yml`によりGitHub Pagesへ自動デプロイ。
