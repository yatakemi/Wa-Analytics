import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parseISO, isValid, startOfDay, endOfDay } from 'date-fns';

import GitHubClient from './src/github';
import Analyzer from './src/analyzer';
import Reporter from './src/reporter';
import AIAnalyzer from './src/ai_analyzer';
import { AllMetrics } from './src/types';

// dotenvxの読み込みはファイルの先頭で行う
const dotenvx = require('@dotenvx/dotenvx');
dotenvx.config();

const program = new Command();

program
  .name('productivity-tool')
  .description('GitHubリポジリの生産性を測定するCLIツール')
  .version('0.1.0')
  .option('--repo <owner/repo>', '分析対象のリポジリ (例: octocat/Spoon-Knife)')
  .option('--start-date <date>', '分析開始日 (YYYY-MM-DD)')
  .option('--end-date <date>', '分析終了日 (YYYY-MM-DD)')
  .option('--all-repos <org>', '組織内の全てのリポジリを分析 (組織名を指定)')
  .option('--summary', 'サマリーレポートを表示')
  .option('--output-format <format>', 'レポート出力形式 (csv, markdown)', 'markdown')
  .option('--analyze-ai', '生成AIによる分析と対策案の提示')
  .option('--dora-metrics', 'DORAメトリクスを計算してレポートに含める')
  .option('--output-dir <path>', '出力ファイルを保存するディレクトリ', './reports')
  .option('--time-unit <unit>', '時系列グラフの時間単位 (daily, weekly, monthly)', 'daily')
  .option('--project-name <name>', '分析対象のGitHub Project名')
  .option('--done-column-name <name>', 'プロジェクトの完了済みカラム名', 'Done')
  .option('--project-number <number>', '分析対象のGitHub Projectの番号', parseInt)
  .option('--iteration-field-name <name>', 'イテレーションフィールド名', 'Iteration')
  .option('--status-field-name <name>', 'ステータスフィールド名', 'Status')
  .option('--done-status-value <name>', '完了ステータスの値', 'Done')
  .option('--full-report', '全ての分析を有効化して実行');

program.parse(process.argv);

const options = program.opts();

// Handle --full-report option
if (options.fullReport) {
  options.doraMetrics = true;
  options.analyzeAi = true;
}

async function analyzeRepo(owner: string, repo: string, startDate: Date, endDate: Date, outputDir: string, timeUnit: string, outputFormat: string, analyzeAi: boolean, calculateDoraMetrics: boolean, projectName: string | undefined, doneColumnName: string, projectNumber: number | undefined, iterationFieldName: string, statusFieldName: string, doneStatusValue: string, githubClient: GitHubClient, analyzer: Analyzer, reporter: Reporter, aiAnalyzer: AIAnalyzer | null) {
  console.log(`リポジリ ${owner}/${repo} を分析中...`);
  console.log(`期間: ${startDate.toISOString()} - ${endDate.toISOString()}`);

  console.log('Pull Requestデータを取得中...');
  const pulls = await githubClient.getPullRequests(owner, repo, startDate, endDate);
  console.log(`取得したPull Request数: ${pulls.length}`);

  console.log('Issueデータを取得中...');
  const issues = await githubClient.getIssues(owner, repo, startDate, endDate);
  console.log(`取得したIssue数: ${issues.length}`);

  console.log('メトリクスを計算中...');
  const { overall: prMetrics, contributors: prContributors, timeSeries: prTimeSeries } = await analyzer.calculatePullRequestMetrics(owner, repo, pulls);
  const { overall: issueMetrics, contributors: issueContributors, timeSeries: issueTimeSeries } = analyzer.calculateIssueMetrics(issues);

  const allMetrics: AllMetrics = { prMetrics, issueMetrics, prContributors, issueContributors, prTimeSeries, issueTimeSeries };

  if (calculateDoraMetrics) {
    console.log('DORAメトリクスを計算中...');
    allMetrics.doraMetrics = await analyzer.calculateDoraMetrics(owner, repo, startDate, endDate, pulls, issues);
  }

  if (projectName) {
    console.log('Projectメトリクスを計算中...');
    const projectMetrics = await analyzer.calculateProjectMetrics(owner, repo, projectName, doneColumnName);
    if (projectMetrics) {
      allMetrics.projectMetrics = projectMetrics;
    }
  }

  if (projectNumber) {
    console.log('Iterationメトリクスを計算中...');
    const iterationMetrics = await analyzer.calculateIterationMetrics(owner, projectNumber, iterationFieldName, statusFieldName, doneStatusValue);
    if (iterationMetrics) {
      allMetrics.iterationMetrics = iterationMetrics;
    }
  }

  console.log('\n--- 全体分析結果 ---');
  console.log('Pull Requestメトリクス:', allMetrics.prMetrics);
  console.log('Issueメトリクス:', allMetrics.issueMetrics);
  if (allMetrics.doraMetrics) {
    console.log('DORAメトリクス:', allMetrics.doraMetrics);
  }
  if (allMetrics.projectMetrics) {
    console.log('Projectメトリクス:', allMetrics.projectMetrics);
  }
  if (allMetrics.iterationMetrics) {
    console.log('Iterationメトリクス:', allMetrics.iterationMetrics);
  }

  console.log('\n--- コントリビューター別Pull Requestメトリクス ---');
  allMetrics.prContributors.forEach((metrics, contributor) => {
    console.log(`  ${contributor}:`, metrics);
  });

  console.log('\n--- コントリビューター別Issueメトリクス ---');
  allMetrics.issueContributors.forEach((metrics, contributor) => {
    console.log(`  ${contributor}:`, metrics);
  });

  // レポート生成
  await reporter.generateAllReports(allMetrics, timeUnit, outputFormat, owner, repo);

  if (analyzeAi && aiAnalyzer) {
    console.log('生成AIによる分析と対策案を生成中...');
    const aiAnalysisResult = await aiAnalyzer.analyzeMetrics(allMetrics);
    console.log('\n--- AI分析結果と対策案 ---');
    console.log(aiAnalysisResult);
  }
}

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  const aiApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!githubToken) {
    console.error('エラー: 環境変数 GITHUB_TOKEN が設定されていません。');
    console.error('GitHub Personal Access Token を設定してください。');
    process.exit(1);
  }

  // 出力ディレクトリの作成
  const baseOutputDir = path.resolve(process.cwd(), options.outputDir);
  if (!fs.existsSync(baseOutputDir)) {
    fs.mkdirSync(baseOutputDir, { recursive: true });
    console.log(`出力ディレクトリを作成しました: ${baseOutputDir}`);
  }

  const githubClient = new GitHubClient(githubToken);
  const analyzer = new Analyzer(githubClient);
  const reporter = new Reporter(baseOutputDir);
  let aiAnalyzer: AIAnalyzer | null = null;

  if (options.analyzeAi) {
    if (!aiApiKey) {
      console.error('エラー: 生成AIによる分析には環境変数 GEMINI_API_KEY または OPENAI_API_KEY が必要です。');
      process.exit(1);
    }
    aiAnalyzer = new AIAnalyzer(aiApiKey);
  }

  console.log('GitHub生産性測定ツールを開始します...');
  console.log('オプション:', options);

  let startDate: Date | null = options.startDate ? startOfDay(parseISO(options.startDate)) : null;
  let endDate: Date | null = options.endDate ? endOfDay(parseISO(options.endDate)) : null;

  if (startDate && !isValid(startDate)) {
    console.error('エラー: 無効な開始日フォーマットです。YYYY-MM-DD形式で指定してください。');
    process.exit(1);
  }
  if (endDate && !isValid(endDate)) {
    console.error('エラー: 無効な終了日フォーマットです。YYYY-MM-DD形式で指定してください。');
    process.exit(1);
  }

  if (options.repo) {
    const [owner, repo] = options.repo.split('/');
    if (!owner || !repo) {
      console.error('エラー: リポジリの指定が不正です。owner/repo 形式で指定してください。');
      process.exit(1);
    }
    await analyzeRepo(owner, repo, startDate!, endDate!, baseOutputDir, options.timeUnit, options.outputFormat, options.analyzeAi, options.doraMetrics, options.projectName, options.doneColumnName, options.projectNumber, options.iterationFieldName, options.statusFieldName, options.doneStatusValue, githubClient, analyzer, reporter, aiAnalyzer);

  } else if (options.allRepos) {
    const org = options.allRepos;
    if (!org) {
      console.error('エラー: --all-repos オプションには組織名を指定してください。');
      process.exit(1);
    }
    console.log(`組織 ${org} の全てのリポジリを分析中...`);
    const repos = await githubClient.getOrganizationRepos(org);
    console.log(`取得したリポジリ数: ${repos.length}`);

    for (const repoInfo of repos) {
      const repoOwner = repoInfo.owner.login;
      const repoName = repoInfo.name;
      const repoOutputDir = path.join(baseOutputDir, repoOwner, repoName);
      if (!fs.existsSync(repoOutputDir)) {
        fs.mkdirSync(repoOutputDir, { recursive: true });
      }
      const repoReporter = new Reporter(repoOutputDir);
      await analyzeRepo(repoOwner, repoName, startDate!, endDate!, repoOutputDir, options.timeUnit, options.outputFormat, options.analyzeAi, options.doraMetrics, options.projectName, options.doneColumnName, options.projectNumber, options.iterationFieldName, options.statusFieldName, options.doneStatusValue, githubClient, analyzer, repoReporter, aiAnalyzer);
    }

  } else {
    console.error('エラー: 分析対象のリポジリ (--repo) または組織 (--all-repos) を指定してください。');
    process.exit(1);
  }

  console.log('処理が完了しました。');
}

main().catch(error => {
  console.error('予期せぬエラーが発生しました:', error);
  process.exit(1);
});