#!/usr/bin/env node

const dotenvx = require('@dotenvx/dotenvx');
dotenvx.config();

import { Command } from 'commander';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import GitHubClient from './src/github';
import Analyzer from './src/analyzer';
import Reporter from './src/reporter';
import AIAnalyzer from './src/ai_analyzer';
import { parseISO, isValid, startOfDay, endOfDay } from 'date-fns';

const program = new Command();

program
  .name('productivity-tool')
  .description('GitHubリポジリの生産性を測定するCLIツール')
  .version('0.1.0');

program
  .option('--repo <owner/repo>', '分析対象のリポジリ (例: octocat/Spoon-Knife)')
  .option('--start-date <date>', '分析開始日 (YYYY-MM-DD)')
  .option('--end-date <date>', '分析終了日 (YYYY-MM-DD)')
  .option('--all-repos', '組織内の全てのリポジリを分析')
  .option('--summary', 'サマリーレポートを表示')
  .option('--output-format <format>', 'レポート出力形式 (csv, markdown)', 'markdown')
  .option('--analyze-ai', '生成AIによる分析と対策案の提示');

program.parse(process.argv);

const options = program.opts();

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  const aiApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!githubToken) {
    console.error('エラー: 環境変数 GITHUB_TOKEN が設定されていません。');
    console.error('GitHub Personal Access Token を設定してください。');
    process.exit(1);
  }

  const githubClient = new GitHubClient(githubToken);
  const analyzer = new Analyzer(githubClient);
  const reporter = new Reporter();
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
    console.log(`リポジリ ${owner}/${repo} を分析中...`);

    if (startDate && endDate) {
      console.log(`期間: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      console.log('Pull Requestデータを取得中...');
      const pulls = await githubClient.getPullRequests(owner, repo, startDate, endDate);
      console.log(`取得したPull Request数: ${pulls.length}`);

      console.log('Issueデータを取得中...');
      const issues = await githubClient.getIssues(owner, repo, startDate, endDate);
      console.log(`取得したIssue数: ${issues.length}`);

      console.log('メトリクスを計算中...');
      const { overall: prMetrics, contributors: prContributors } = await analyzer.calculatePullRequestMetrics(owner, repo, pulls);
      const { overall: issueMetrics, contributors: issueContributors } = analyzer.calculateIssueMetrics(issues);

      const allMetrics = { prMetrics, issueMetrics, prContributors, issueContributors };

      console.log('\n--- 全体分析結果 ---');
      console.log('Pull Requestメトリクス:', prMetrics);
      console.log('Issueメトリクス:', issueMetrics);

      console.log('\n--- コントリビューター別Pull Requestメトリクス ---');
      prContributors.forEach((metrics, contributor) => {
        console.log(`  ${contributor}:`, metrics);
      });

      console.log('\n--- コントリビューター別Issueメトリクス ---');
      issueContributors.forEach((metrics, contributor) => {
        console.log(`  ${contributor}:`, metrics);
      });

      // グラフ生成の例
      if (prMetrics.mergedPullRequests > 0) {
        await reporter.generateChart(
          { labels: ['マージされたPR数'], values: [prMetrics.mergedPullRequests] },
          'merged_pr_count.png',
          'マージされたPull Request数',
          '数'
        );
        await reporter.generateChart(
          { labels: ['平均PRサイクルタイム'], values: [prMetrics.avgTimeToMerge] },
          'avg_pr_cycle_time.png',
          '平均Pull Requestサイクルタイム (分)',
          '時間 (分)'
        );
      }

      if (options.analyzeAi && aiAnalyzer) {
        console.log('生成AIによる分析と対策案を生成中...');
        const aiAnalysisResult = await aiAnalyzer.analyzeMetrics(allMetrics);
        console.log('\n--- AI分析結果と対策案 ---');
        console.log(aiAnalysisResult);
      }

    } else {
      console.warn('警告: 分析期間が指定されていないため、データ収集とメトリクス計算はスキップされます。');
    }

  } else if (options.allRepos) {
    console.log('全ての組織リポジリを分析中... (未実装)');
    // 全リポジリのデータ収集、分析、レポート生成のロジック
  }

  console.log('処理が完了しました。');
}

main().catch(error => {
  console.error('予期せぬエラーが発生しました:', error);
  process.exit(1);
});