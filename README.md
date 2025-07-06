# Team Performance Tools

## 概要

このツールは、GitHubリポジリのデータを多角的に分析し、チームの開発生産性を可視化するためのCLIツールです。Pull Request、Issue、DORAメトリクス、さらにはGitHub Projectsの進捗状況までを分析し、開発プロセスの改善点発見とデータに基づいた意思決定を支援します。

## 主な機能

- **多角的なメトリクス分析**: PRやIssueの基本的な指標に加え、DORAメトリクスやGitHub Projectsのイテレーション（スプリント）に基づいた高度な分析が可能です。
- **柔軟なレポート出力**: 分析結果は、CLIでのサマリー表示のほか、詳細なMarkdownレポートやCSVファイルとして出力できます。
- **グラフによる可視化**: 主要なメトリクスはグラフ（PNG形式）として出力され、傾向の把握を容易にします。
- **AIによる分析支援**: GeminiまたはOpenAI APIと連携し、分析結果に対する洞察や改善提案を自動で生成します。
- **キャッシュ機能**: 一度取得したAPIレスポンスをキャッシュすることで、再実行時のパフォーマンスを向上させます。

## 測定指標

### コード開発
- **Pull Request**: マージ数、レビュー時間、マージ時間、変更行数、レビューコメント数など
- **Issue**: クローズ数、解決時間
- **コントリビューター別分析**: 上記指標の個人別集計

### DevOps (DORAメトリクス)
- **デプロイ頻度**: 本番環境へのリリース頻度
- **変更のリードタイム**: コミットから本番デプロイまでの時間
- **変更障害率**: デプロイに起因する障害の発生率
- **サービス復元時間 (MTTR)**: 障害発生から復旧までの平均時間

### プロジェクト管理
- **GitHub Projects (v1)**: カードの総数、完了数、平均リードタイム、スループット
- **GitHub Projects (v2) イテレーション**: イテレーションごとのアイテム数、完了数、スループット

## セットアップ

### 1. 前提条件

- Node.js (v18以上を推奨)
- npm

### 2. インストール

```bash
npm install
```

### 3. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の情報を設定します。

```dotenv
# GitHub Personal Access Token (必須)
GITHUB_TOKEN="YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"

# AI分析機能を使用する場合 (任意)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY" # または OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

#### GitHub PATの権限

分析には、読み取り権限を持つFine-grained personal access tokenを推奨します。以下の権限を付与してください。

- **Repository**: `Contents`, `Issues`, `Pull requests`, `Metadata`
- **Organization**: `Projects` (Projects v2の分析に必要)

## 使用方法

`npm start` コマンド（または `tsx index.ts`）でツールを実行します。

### 基本的な使い方

```bash
# 特定のリポジリを期間指定で分析
npm start -- --repo <owner>/<repo> --start-date YYYY-MM-DD --end-date YYYY-MM-DD

# 組織内の全リポジリを分析
npm start -- --all-repos <organization_name> --start-date YYYY-MM-DD --end-date YYYY-MM-DD
```

### コマンドラインオプション

| オプション | 説明 | デフォルト値 |
| --- | --- | --- |
| `--repo <owner/repo>` | 分析対象のリポジリを指定します。 | - |
| `--all-repos <org>` | 指定した組織の全リポジリを分析対象とします。 | - |
| `--start-date <date>` | 分析の開始日 (YYYY-MM-DD)。 | - |
| `--end-date <date>` | 分析の終了日 (YYYY-MM-DD)。 | - |
| `--output-dir <path>` | レポートとグラフの出力先ディレクトリ。 | `./reports` |
| `--output-format <format>` | レポートの出力形式 (`markdown` または `csv`)。 | `markdown` |
| `--time-unit <unit>` | 時系列グラフの時間単位 (`daily`, `weekly`, `monthly`)。 | `daily` |
| `--full-report` | DORAメトリクスとAI分析を含むすべての分析を有効化します。 | `false` |
| `--dora-metrics` | DORAメトリクスを分析に含めます。 | `false` |
| `--analyze-ai` | AIによる分析と改善提案を生成します。 | `false` |
| `--project-name <name>` | **[Projects v1]** 分析対象のプロジェクト名。 | - |
| `--done-column-name <name>` | **[Projects v1]** 完了状態を示すカラム名。 | `Done` |
| `--project-number <number>` | **[Projects v2]** 分析対象のプロジェクト番号。 | - |
| `--iteration-field-name <name>` | **[Projects v2]** イテレーションのフィールド名。 | `Iteration` |
| `--status-field-name <name>` | **[Projects v2]** ステータスのフィールド名。 | `Status` |
| `--done-status-value <value>` | **[Projects v2]** 完了を示すステータスの値。 | `Done` |

### 実行例

```bash
# フルレポートを生成（DORA, AI分析、イテレーション分析を含む）
npm start -- \
  --repo my-org/my-awesome-project \
  --start-date 2024-01-01 \
  --end-date 2024-03-31 \
  --full-report \
  --project-number 5

# CSV形式で週次のレポートを出力
npm start -- \
  --repo my-org/my-awesome-project \
  --start-date 2024-01-01 \
  --end-date 2024-03-31 \
  --output-format csv \
  --time-unit weekly
```

## 貢献

バグ報告や機能改善の提案は、GitHubのIssueまでお寄せください。

## ライセンス

[LICENSE](LICENSE)ファイルを参照してください。
