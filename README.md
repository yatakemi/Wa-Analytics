# 開発生産性測定ツール

## 概要

このツールは、GitHubのリポジトリデータから開発活動に関する様々な指標を抽出し、チームや個人の生産性、コード品質、コラボレーションの状況を可視化することで、開発プロセスの改善点特定と意思決定を支援するCLIツールです。

## 機能

*   **GitHub連携**: GitHub Personal Access Token (PAT) を使用した認証。分析対象リポジトリ（単一または複数）と分析期間の指定。データ取得の進捗表示。
*   **データキャッシュ**: GitHub API呼び出しのキャッシュ機能により、高速な再実行とAPIレートリミットの消費削減。
*   **データ収集と分析**: 指定されたリポジトリと期間のGitHubデータを自動的に収集し、各種メトリクスを計算。コントリビューター単位での詳細な分析も可能。
*   **レポート生成**: 
    *   CLIでのサマリー表示。
    *   詳細なレポート（CSVまたはMarkdown形式）の出力。
    *   主要メトリクスを可視化するグラフ（PNG/SVG形式）の生成。日次、週次、月次の時系列グラフに対応。
*   **設定管理**: GitHub PAT、デフォルトリポジトリ、分析期間などの設定を管理。
*   **生成AIによる分析と対策案提示**: 収集・分析されたメトリクスデータに基づき、生成AIが現状の課題を分析し、生産性向上や品質改善のための具体的な対策案を提示。

## 測定指標（メトリクス）

以下のカテゴリで主要なメトリクスを測定します。

### スループット (Throughput)
*   マージされたPull Request数
*   クローズされたIssue数
*   コミット数
*   変更行数 (Lines of Code Changed)

### 効率性・リードタイム (Efficiency / Lead Time)
*   Pull Requestサイクルタイム (PR作成からマージまでの平均時間)
    *   Time to First Review (PR作成から最初のレビューコメントが付くまでの平均時間)
    *   Time to Merge (PR作成からマージされるまでの平均時間)
*   Issue解決時間 (Issue作成からクローズまでの平均時間)

### コード品質・安定性 (Code Quality / Stability)
*   レビューコメント数/PR
*   再オープンされたIssue/PR数
*   レビューイテレーション数

### コラボレーション (Collaboration)
*   平均レビュー担当者数/PR
*   レビュー参加率
*   レビューコメントのポジティブ/ネガティブ比率（高度な機能、自然言語処理が必要）

**コントリビューター単位のメトリクス**: 上記の各メトリクスは、コントリビューター（Pull Requestの作成者やIssueのアサイン担当者）ごとに集計・分析されます。

## 技術スタック

*   **言語**: Node.js (TypeScript)
*   **ライブラリ**:
    *   `@octokit/rest`: GitHub APIクライアント
    *   `commander`: CLIコマンド解析
    *   `csv-stringify`: CSV出力
    *   `date-fns`: 日付処理
    *   `chart.js`, `chartjs-node-canvas`, `chartjs-adapter-date-fns`: グラフ生成
    *   `@google/generative-ai`: Google Gemini APIクライアント (またはOpenAI API)
    *   `@dotenvx/dotenvx`: 環境変数管理
    *   `tsx`: TypeScriptコードの直接実行

## セットアップ

### 前提条件

*   Node.js (v18以上推奨)
*   npm

### インストール

プロジェクトのルートディレクトリで以下のコマンドを実行します。

```bash
npm install
```

### 環境変数の設定

プロジェクトのルートディレクトリに `.env` ファイルを作成し、以下の環境変数を設定してください。

```dotenv
GITHUB_TOKEN="YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY" # または OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

#### GitHub Personal Access Token (PAT) の権限

ファイングレインパーソナルアクセストークンを使用することを推奨します。以下の権限を「読み取り専用 (Read-only)」で付与してください。

*   **リポジトリのアクセス (Repository access)**:
    *   `Contents`: Read-only
    *   `Issues`: Read-only
    *   `Pull requests`: Read-only
    *   `Metadata`: Read-only

## 使用方法

### ビルド

TypeScriptコードをJavaScriptにコンパイルします。開発中は `npm start` を直接使用できます。

```bash
npm run build
```

### ツールの実行

`npm start` コマンドは `tsx` を使用してTypeScriptコードを直接実行します。ビルドは不要です。

#### 特定のリポジトリと期間で生産性レポートを生成

```bash
npm start -- --repo <owner>/<repo> --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--output-dir <path>] [--time-unit <daily|weekly|monthly>] [--output-format <csv|markdown>]
# 例:
npm start -- --repo octocat/Spoon-Knife --start-date 2023-01-01 --end-date 2023-12-31 --output-dir ./reports --time-unit daily --output-format csv
```

*   `--output-dir`: 生成されたグラフやレポートを保存するディレクトリを指定します。デフォルトは `./reports` です。
*   `--time-unit`: 時系列グラフの時間単位を指定します (`daily`, `weekly`, `monthly`)。デフォルトは `daily` です。
*   `--output-format`: レポートの出力形式を指定します (`csv`, `markdown`)。デフォルトは `markdown` です。

#### 生成AIによる分析と対策案の提示

```bash
npm start -- --repo <owner>/<repo> --start-date YYYY-MM-DD --end-date YYYY-MM-DD --analyze-ai
# 例:
npm start -- --repo octocat/Spoon-Knife --start-date 2023-01-01 --end-date 2023-12-31 --analyze-ai
```

#### キャッシュについて

GitHub APIから取得したデータは、`.cache` ディレクトリに一時的に保存されます。これにより、同じ期間とリポジトリで再度実行する際のAPI呼び出しが削減され、処理が高速化されます。キャッシュは1時間で期限切れになります。

#### グラフ出力について

ツールを実行すると、指定された出力ディレクトリにグラフ画像ファイル（例: `merged_pr_count_daily_time_series.png`）が生成されます。

## 貢献

貢献を歓迎します。バグ報告や機能提案はIssueとして登録してください。

## ライセンス

[LICENSE](LICENSE) ファイルを参照してください。