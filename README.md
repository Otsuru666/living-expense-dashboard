# 同棲費用ダッシュボード

スプレッドシートのデータを読み込み、いつでもWebで見られる生活費ダッシュボードです。

## 構成
- フロント: Vite + React + Tailwind CSS + Recharts
- データ: Google Sheets
- API: Google Apps Script (GAS)
- 公開: GitHub Pages

## 事前準備（スプレッドシート）
1. スプレッドシートに家計簿データを貼り付けます。
2. タブ名は `2026_CSV` のように末尾を `_CSV` にします（複数年度OK）。
3. 1行目に以下の列名を用意します。
   - `日付`, `内容`, `金額（円）`, `大項目`, `中項目`, `計算対象`, `メモ`
4. 「計算対象」列が `1` の行のみ集計されます。

## GASのセットアップ
1. スプレッドシートの「拡張機能」>「Apps Script」を開く
2. `GAS_LivingExpense.gs` の内容を貼り付けて保存
3. 「デプロイ」>「新しいデプロイ」
   - 種類: `ウェブアプリ`
   - 実行: `自分`
   - アクセス: `全員`
4. 発行されたURLを控える

## ローカル起動
```bash
npm install
npm run dev
```
初回起動時に表示される設定画面へ、GASのURLを入力してください。

## GitHub Pagesで公開
1. GitHubにこのリポジトリを作成してpush
2. `main` ブランチへpushすると自動でPagesへデプロイされます
3. GitHubの「Settings」>「Pages」で公開URLを確認

※ デフォルトブランチが `master` の場合は `.github/workflows/deploy.yml` の分岐名を修正してください。

## GAS URLの変更
- 画面右上の歯車アイコンから再設定できます
- 変更はブラウザの `localStorage` に保存されます

## 技術スタック
- React 18
- Vite
- Tailwind CSS
- Recharts
- Google Apps Script
