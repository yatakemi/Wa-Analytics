import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs';
import * as path from 'path';
import { ChartConfiguration, Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns'; // date-fnsアダプターをインポート
import { stringify } from 'csv-stringify';
import { AllMetrics, TimeSeriesData } from './types';

// Chart.jsのすべてのコンポーネントとアダプターを登録
Chart.register(...registerables);

interface ChartData {
  labels: string[];
  values: number[];
}

class Reporter {
  private width: number;
  private height: number;
  private chartJSNodeCanvas: ChartJSNodeCanvas;
  private outputDir: string;

  constructor(outputDir: string = '.') {
    this.width = 800;
    this.height = 600;
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: this.width,
      height: this.height,
      backgroundColour: 'white',
    });
    this.outputDir = outputDir;
  }

  private _getMarkdownImagePath(filename: string): string {
    // outputDirからの相対パスを生成
    const relativePath = path.relative(this.outputDir, path.join(this.outputDir, filename));
    return relativePath.replace(/\\/g, '/'); // Markdownで正しく解釈されるようにスラッシュに変換
  }

  private async _ensureDirectoryExistence(filePath: string): Promise<void> {
    const dirname = path.dirname(filePath);
    try {
      await fs.promises.access(dirname);
    } catch (e) {
      await fs.promises.mkdir(dirname, { recursive: true });
    }
  }

  async generateChart(data: ChartData, filename: string, title: string, yAxisLabel: string): Promise<void> {
    const outputPath = path.join(this.outputDir, filename);
    await this._ensureDirectoryExistence(outputPath);

    const configuration: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: title,
          data: data.values,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: yAxisLabel,
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
          },
        },
      },
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync(outputPath, buffer);
    console.log(`グラフを ${outputPath} に保存しました。`);
  }

  async generateLineChart(data: TimeSeriesData, filename: string, title: string, yAxisLabel: string): Promise<void> {
    const outputPath = path.join(this.outputDir, filename);
    await this._ensureDirectoryExistence(outputPath);

    const configuration: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: title,
          data: data.values,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: false,
          tension: 0.1,
        }],
      },
      options: {
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'yyyy-MM-dd',
              displayFormats: {
                day: 'MM-dd' // 日次表示
              }
            },
            title: {
              display: true,
              text: '日付'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: yAxisLabel,
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
          },
        },
      },
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync(outputPath, buffer);
    console.log(`グラフを ${outputPath} に保存しました。`);
  }

  async generateContributorBarChart(contributorMetrics: Map<string, any>, metricKey: string, filename: string, title: string, yAxisLabel: string): Promise<void> {
    const outputPath = path.join(this.outputDir, filename);
    await this._ensureDirectoryExistence(outputPath);

    const labels: string[] = [];
    const values: number[] = [];

    // Mapを配列に変換し、値でソート（降順）
    const sortedContributors = Array.from(contributorMetrics.entries()).sort((a, b) => {
      const valA = a[1][metricKey] || 0;
      const valB = b[1][metricKey] || 0;
      return valB - valA;
    });

    sortedContributors.forEach(([contributor, metrics]) => {
      labels.push(contributor);
      values.push(metrics[metricKey] || 0);
    });

    const configuration: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: values,
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        indexAxis: 'y', // 棒グラフを横向きにする
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: yAxisLabel,
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: title,
          },
        },
      },
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync(outputPath, buffer);
    console.log(`グラフを ${outputPath} に保存しました。`);
  }

  private async _writeCsvFile(data: any[], filename: string, columns: string[]): Promise<void> {
    const outputPath = path.join(this.outputDir, filename);
    await this._ensureDirectoryExistence(outputPath);

    return new Promise((resolve, reject) => {
      stringify(data, { header: true, columns: columns }, (err, output) => {
        if (err) {
          console.error(`CSV生成エラー (${filename}):`, err);
          return reject(err);
        }
        fs.writeFileSync(outputPath, output);
        console.log(`CSVレポートを ${outputPath} に保存しました。`);
        resolve();
      });
    });
  }

  async generateOverallMetricsCsv(prMetrics: any, issueMetrics: any, doraMetrics?: any): Promise<void> {
    const prData = Object.entries(prMetrics).map(([key, value]) => ({ Metric: key, Value: value }));
    await this._writeCsvFile(prData, 'overall_pr_metrics.csv', ['Metric', 'Value']);

    const issueData = Object.entries(issueMetrics).map(([key, value]) => ({ Metric: key, Value: value }));
    await this._writeCsvFile(issueData, 'overall_issue_metrics.csv', ['Metric', 'Value']);

    if (doraMetrics) {
      const doraData = Object.entries(doraMetrics).map(([key, value]) => ({ Metric: key, Value: value }));
      await this._writeCsvFile(doraData, 'overall_dora_metrics.csv', ['Metric', 'Value']);
    }
  }

  async generateContributorMetricsCsv(prContributors: Map<string, any>, issueContributors: Map<string, any>): Promise<void> {
    if (prContributors.size > 0) {
      const prContributorData = Array.from(prContributors.entries()).map(([contributor, metrics]) => ({
        Contributor: contributor,
        ...metrics,
      }));
      const prColumns = ['Contributor', ...Object.keys(prContributorData[0]).filter(key => key !== 'Contributor')];
      await this._writeCsvFile(prContributorData, 'contributor_pr_metrics.csv', prColumns);
    }

    if (issueContributors.size > 0) {
      const issueContributorData = Array.from(issueContributors.entries()).map(([contributor, metrics]) => ({
        Contributor: contributor,
        ...metrics,
      }));
      const issueColumns = ['Contributor', ...Object.keys(issueContributorData[0]).filter(key => key !== 'Contributor')];
      await this._writeCsvFile(issueContributorData, 'contributor_issue_metrics.csv', issueColumns);
    }
  }

  async generateTimeSeriesCsv(prTimeSeries: any, issueTimeSeries: any, timeUnit: string): Promise<void> {
    // PR Time Series
    const prTimeSeriesData = prTimeSeries[timeUnit];
    if (prTimeSeriesData.mergedPullRequests.labels.length > 0) {
      const data = prTimeSeriesData.mergedPullRequests.labels.map((label: string, index: number) => ({
        Date: label,
        MergedPRs: prTimeSeriesData.mergedPullRequests.values[index],
        AvgTimeToMerge: prTimeSeriesData.avgTimeToMerge.values[index],
      }));
      await this._writeCsvFile(data, `pr_time_series_${timeUnit}.csv`, ['Date', 'MergedPRs', 'AvgTimeToMerge']);
    }

    // Issue Time Series
    const issueTimeSeriesData = issueTimeSeries[timeUnit];
    if (issueTimeSeriesData.closedIssues.labels.length > 0) {
      const data = issueTimeSeriesData.closedIssues.labels.map((label: string, index: number) => ({
        Date: label,
        ClosedIssues: issueTimeSeriesData.closedIssues.values[index],
        AvgIssueResolutionTime: issueTimeSeriesData.avgIssueResolutionTime.values[index],
      }));
      await this._writeCsvFile(data, `issue_time_series_${timeUnit}.csv`, ['Date', 'ClosedIssues', 'AvgIssueResolutionTime']);
    }
  }

  async generateAllReports(allMetrics: AllMetrics, timeUnit: string, outputFormat: string, owner: string, repo: string): Promise<void> {
    // グラフ生成
    // Overall Metrics Charts
    await this.generateChart({ labels: ['Merged PRs'], values: [allMetrics.prMetrics.mergedPullRequests] }, path.join(owner, repo, 'overall_pr_merged_pull_requests.png'), 'マージされたPR数', 'PR数');
    await this.generateChart({ labels: ['Avg Time to Merge'], values: [allMetrics.prMetrics.avgTimeToMerge] }, path.join(owner, repo, 'overall_pr_avg_time_to_merge.png'), '平均マージ時間', '時間 (分)');
    await this.generateChart({ labels: ['Closed Issues'], values: [allMetrics.issueMetrics.closedIssues] }, path.join(owner, repo, 'overall_issue_closed_issues.png'), 'クローズされたIssue数', 'Issue数');
    await this.generateChart({ labels: ['Avg Issue Resolution Time'], values: [allMetrics.issueMetrics.avgIssueResolutionTime] }, path.join(owner, repo, 'overall_issue_avg_issue_resolution_time.png'), '平均Issue解決時間', '時間 (分)');

    // DORA Metrics Charts
    if (allMetrics.doraMetrics) {
      await this.generateChart({ labels: ['Deployment Frequency'], values: [allMetrics.doraMetrics.deploymentFrequency] }, path.join(owner, repo, 'dora_deployment_frequency.png'), 'デプロイ頻度', '回');
      await this.generateChart({ labels: ['Lead Time for Changes'], values: [allMetrics.doraMetrics.leadTimeForChanges] }, path.join(owner, repo, 'dora_lead_time_for_changes.png'), '変更のリードタイム', '時間');
      await this.generateChart({ labels: ['Change Failure Rate'], values: [allMetrics.doraMetrics.changeFailureRate] }, path.join(owner, repo, 'dora_change_failure_rate.png'), '変更障害率', '%');
      await this.generateChart({ labels: ['Mean Time to Recovery'], values: [allMetrics.doraMetrics.meanTimeToRecovery] }, path.join(owner, repo, 'dora_mean_time_to_recovery.png'), 'サービス復元時間', '時間');
    }

    // Contributor Metrics Charts
    await this.generateContributorBarChart(allMetrics.prContributors, 'mergedPullRequests', path.join(owner, repo, 'contributor_pr_merged_pull_requests.png'), 'コントリビューター別マージPR数', 'PR数');
    await this.generateContributorBarChart(allMetrics.prContributors, 'totalTimeToMerge', path.join(owner, repo, 'contributor_pr_avg_time_to_merge.png'), 'コントリビューター別平均マージ時間', '時間 (分)');
    await this.generateContributorBarChart(allMetrics.issueContributors, 'closedIssues', path.join(owner, repo, 'contributor_issue_closed_issues.png'), 'コントリビューター別クローズIssue数', 'Issue数');
    await this.generateContributorBarChart(allMetrics.issueContributors, 'totalIssueResolutionTime', path.join(owner, repo, 'contributor_issue_avg_issue_resolution_time.png'), 'コントリビューター別平均Issue解決時間', '時間 (分)');

    // Time Series Charts
    let prMergedTimeSeriesData: TimeSeriesData;
    let prAvgTimeToMergeTimeSeriesData: TimeSeriesData;
    let issueClosedTimeSeriesData: TimeSeriesData;
    let issueAvgResolutionTimeSeriesData: TimeSeriesData;

    switch (timeUnit) {
      case 'daily':
        prMergedTimeSeriesData = allMetrics.prTimeSeries.daily.mergedPullRequests;
        prAvgTimeToMergeTimeSeriesData = allMetrics.prTimeSeries.daily.avgTimeToMerge;
        issueClosedTimeSeriesData = allMetrics.issueTimeSeries.daily.closedIssues;
        issueAvgResolutionTimeSeriesData = allMetrics.issueTimeSeries.daily.avgIssueResolutionTime;
        break;
      case 'weekly':
        prMergedTimeSeriesData = allMetrics.prTimeSeries.weekly.mergedPullRequests;
        prAvgTimeToMergeTimeSeriesData = allMetrics.prTimeSeries.weekly.avgTimeToMerge;
        issueClosedTimeSeriesData = allMetrics.issueTimeSeries.weekly.closedIssues;
        issueAvgResolutionTimeSeriesData = allMetrics.issueTimeSeries.weekly.avgIssueResolutionTime;
        break;
      case 'monthly':
        prMergedTimeSeriesData = allMetrics.prTimeSeries.monthly.mergedPullRequests;
        prAvgTimeToMergeTimeSeriesData = allMetrics.prTimeSeries.monthly.avgTimeToMerge;
        issueClosedTimeSeriesData = allMetrics.issueTimeSeries.monthly.closedIssues;
        issueAvgResolutionTimeSeriesData = allMetrics.issueTimeSeries.monthly.avgIssueResolutionTime;
        break;
      default:
        console.warn('警告: 無効な時間単位が指定されました。日次データを使用します。');
        prMergedTimeSeriesData = allMetrics.prTimeSeries.daily.mergedPullRequests;
        prAvgTimeToMergeTimeSeriesData = allMetrics.prTimeSeries.daily.avgTimeToMerge;
        issueClosedTimeSeriesData = allMetrics.issueTimeSeries.daily.closedIssues;
        issueAvgResolutionTimeSeriesData = allMetrics.issueTimeSeries.daily.avgIssueResolutionTime;
    }

    if (prMergedTimeSeriesData.labels.length > 0) {
      await this.generateLineChart(prMergedTimeSeriesData, path.join(owner, repo, `pr_time_series_merged_pull_requests_${timeUnit}.png`), `時系列マージされたPR数 (${timeUnit})`, 'PR数');
      await this.generateLineChart(prAvgTimeToMergeTimeSeriesData, path.join(owner, repo, `pr_time_series_avg_time_to_merge_${timeUnit}.png`), `時系列平均マージ時間 (${timeUnit})`, '時間 (分)');
    }
    if (issueClosedTimeSeriesData.labels.length > 0) {
      await this.generateLineChart(issueClosedTimeSeriesData, path.join(owner, repo, `issue_time_series_closed_issues_${timeUnit}.png`), `時系列クローズされたIssue数 (${timeUnit})`, 'Issue数');
      await this.generateLineChart(issueAvgResolutionTimeSeriesData, path.join(owner, repo, `issue_time_series_avg_issue_resolution_time_${timeUnit}.png`), `時系列平均解決時間 (${timeUnit})`, '時間 (分)');
    }

    // レポート生成
    if (outputFormat === 'csv') {
      await this.generateOverallMetricsCsv(allMetrics.prMetrics, allMetrics.issueMetrics, allMetrics.doraMetrics);
      await this.generateContributorMetricsCsv(allMetrics.prContributors, allMetrics.issueContributors);
      await this.generateTimeSeriesCsv(allMetrics.prTimeSeries, allMetrics.issueTimeSeries, timeUnit);
    } else if (outputFormat === 'markdown') {
      await this.generateMarkdownReport(allMetrics, path.join(owner, repo, 'report.md'), timeUnit);
    }
  }

  async generateMarkdownReport(allMetrics: AllMetrics, filename: string, timeUnit: string): Promise<void> {
    const outputPath = path.join(this.outputDir, filename);
    await this._ensureDirectoryExistence(outputPath);

    let markdownContent = `# 生産性レポート\n\n`;

    markdownContent += `## 全体メトリクス\n\n`;
    markdownContent += `### Pull Request メトリクス

`;
    markdownContent += `| メトリクス | 値 | 単位 |\n`;
    markdownContent += `|---|---|---|\n`;
    markdownContent += `| マージされたPR数 | ${allMetrics.prMetrics.mergedPullRequests} | 回 |\n`;
    markdownContent += `| 最初のレビューまでの平均時間 | ${allMetrics.prMetrics.avgTimeToFirstReview.toFixed(2)} | 分 |\n`;
    markdownContent += `| マージまでの平均時間 | ${allMetrics.prMetrics.avgTimeToMerge.toFixed(2)} | 分 |\n`;
    markdownContent += `| 変更された総行数 | ${allMetrics.prMetrics.totalLinesChanged} | 行 |\n`;
    markdownContent += `| PRあたりの平均レビューコメント数 | ${allMetrics.prMetrics.avgReviewCommentsPerPR.toFixed(2)} | 回 |\n`;
    markdownContent += `| PRあたりの平均レビューイテレーション数 | ${allMetrics.prMetrics.avgReviewIterationsPerPR.toFixed(2)} | 回 |\n`;
    markdownContent += `\n`;
    markdownContent += `![マージされたPR数](${this._getMarkdownImagePath('overall_pr_merged_pull_requests.png')})\n\n`;
    markdownContent += `![平均マージ時間](${this._getMarkdownImagePath('overall_pr_avg_time_to_merge.png')})\n\n`;

    markdownContent += `### Issue メトリクス

`;
    markdownContent += `| メトリクス | 値 | 単位 |\n`;
    markdownContent += `|---|---|---|\n`;
    markdownContent += `| クローズされたIssue数 | ${allMetrics.issueMetrics.closedIssues} | 回 |\n`;
    markdownContent += `| Issue解決までの平均時間 | ${allMetrics.issueMetrics.avgIssueResolutionTime.toFixed(2)} | 分 |\n`;
    markdownContent += `\n`;
    markdownContent += `![クローズされたIssue数](${this._getMarkdownImagePath('overall_issue_closed_issues.png')})\n\n`;
    markdownContent += `![平均Issue解決時間](${this._getMarkdownImagePath('overall_issue_avg_issue_resolution_time.png')})\n\n`;

    if (allMetrics.projectMetrics) {
      markdownContent += `### Project メトリクス\n\n`;
      markdownContent += `| メトリクス | 値 | 単位 |\n`;
      markdownContent += `|---|---|---|\n`;
      markdownContent += `| 総カード数 | ${allMetrics.projectMetrics.totalCards} | 枚 |\n`;
      markdownContent += `| 完了カード数 | ${allMetrics.projectMetrics.completedCards} | 枚 |\n`;
      markdownContent += `| 平均カードリードタイム | ${allMetrics.projectMetrics.avgCardLeadTime.toFixed(2)} | 時間 |\n`;
      markdownContent += `| スループット | ${allMetrics.projectMetrics.throughput.toFixed(2)} | 枚/週 |
`;      markdownContent += `
`;    }

    if (allMetrics.iterationMetrics) {
      markdownContent += `### Iteration メトリクス

`;
      markdownContent += `| イテレーション | 開始日 | 終了日 | 総アイテム数 | 完了アイテム数 | スループット (アイテム/週) |
`;
      markdownContent += `|---|---|---|---|---|---|
`;
      for (const metrics of allMetrics.iterationMetrics) {
        markdownContent += `| ${metrics.title} | ${metrics.startDate} | ${metrics.endDate} | ${metrics.totalItems} | ${metrics.completedItems} | ${metrics.throughput.toFixed(2)} |
`;
      }
      markdownContent += `
`;
    }

    if (allMetrics.doraMetrics) {
      markdownContent += `## DORA メトリクス\n\n`;
      markdownContent += `| メトリクス | 値 | 単位 |\n`;
      markdownContent += `|---|---|---|\n`;
      markdownContent += `| デプロイ頻度 | ${allMetrics.doraMetrics.deploymentFrequency} | 回 |\n`;
      markdownContent += `| 変更のリードタイム | ${allMetrics.doraMetrics.leadTimeForChanges.toFixed(2)} | 時間 |\n`;
      markdownContent += `| 変更障害率 | ${allMetrics.doraMetrics.changeFailureRate.toFixed(2)} | % |\n`;
      markdownContent += `| サービス復元時間 | ${allMetrics.doraMetrics.meanTimeToRecovery.toFixed(2)} | 時間 |\n`;
      markdownContent += `\n`;
      markdownContent += `![デプロイ頻度](${this._getMarkdownImagePath('dora_deployment_frequency.png')})\n\n`;
      markdownContent += `![変更のリードタイム](${this._getMarkdownImagePath('dora_lead_time_for_changes.png')})\n\n`;
      markdownContent += `![変更障害率](${this._getMarkdownImagePath('dora_change_failure_rate.png')})\n\n`;
      markdownContent += `![サービス復元時間](${this._getMarkdownImagePath('dora_mean_time_to_recovery.png')})\n\n`;
    }

    markdownContent += `## コントリビューター別メトリクス\n\n`;
    if (allMetrics.prContributors.size > 0) {
      markdownContent += `### Pull Request コントリビューター\n\n`;
      markdownContent += `![コントリビューター別マージPR数](${this._getMarkdownImagePath('contributor_pr_merged_pull_requests.png')})\n\n`;
      markdownContent += `![コントリビューター別平均マージ時間](${this._getMarkdownImagePath('contributor_pr_avg_time_to_merge.png')})\n\n`;
      const firstContributorMetrics = allMetrics.prContributors.values().next().value;
      if (firstContributorMetrics) {
        const columns = ['コントリビューター', 'マージされたPR数', '最初のレビューまでの平均時間 (分)', 'マージまでの平均時間 (分)', '変更された総行数', 'レビューコメント数', 'レビューイテレーション数'];
        markdownContent += `| ${columns.join(' | ')} |\n`;
        markdownContent += `|${columns.map(() => '---').join('|')}|\n`;
        // Sort PR contributors by mergedPullRequests in descending order
        const sortedPrContributors = Array.from(allMetrics.prContributors.entries()).sort(([, a], [, b]) => b.mergedPullRequests - a.mergedPullRequests);
        sortedPrContributors.forEach(([contributor, metrics]) => {
          markdownContent += `| ${contributor} | ${metrics.mergedPullRequests} | ${metrics.totalTimeToFirstReview.toFixed(2)} | ${metrics.totalTimeToMerge.toFixed(2)} | ${metrics.totalLinesChanged} | ${metrics.totalReviewComments} | ${metrics.totalReviewIterations} |\n`;
        });
        markdownContent += `\n`;
      }
    }

    if (allMetrics.issueContributors.size > 0) {
      markdownContent += `### Issue コントリビューター\n\n`;
      markdownContent += `![コントリビューター別クローズIssue数](${this._getMarkdownImagePath('contributor_issue_closed_issues.png')})\n\n`;
      markdownContent += `![コントリビューター別平均Issue解決時間](${this._getMarkdownImagePath('contributor_issue_avg_issue_resolution_time.png')})\n\n`;
      const firstContributorMetrics = allMetrics.issueContributors.values().next().value;
      if (firstContributorMetrics) {
        const columns = ['コントリビューター', 'クローズされたIssue数', 'Issue解決までの平均時間 (分)'];
        markdownContent += `| ${columns.join(' | ')} |\n`;
        markdownContent += `|${columns.map(() => '---').join('|')}|\n`;
        // Sort Issue contributors by closedIssues in descending order
        const sortedIssueContributors = Array.from(allMetrics.issueContributors.entries()).sort(([, a], [, b]) => b.closedIssues - a.closedIssues);
        sortedIssueContributors.forEach(([contributor, metrics]) => {
          markdownContent += `| ${contributor} | ${metrics.closedIssues} | ${metrics.totalIssueResolutionTime.toFixed(2)} |\n`;
        });
        markdownContent += `\n`;
      }
    }

    markdownContent += `## 時系列メトリクス\n\n`;
    // PR Time Series
    const prTimeSeriesData = allMetrics.prTimeSeries.daily; // デフォルトで日次を表示
    if (prTimeSeriesData.mergedPullRequests.labels.length > 0) {
      markdownContent += `### Pull Request 時系列 (日次)\n\n`;
      markdownContent += `![日次マージされたPR数](${this._getMarkdownImagePath('pr_time_series_merged_pull_requests_daily.png')})\n\n`;
      markdownContent += `![日次平均マージ時間](${this._getMarkdownImagePath('pr_time_series_avg_time_to_merge_daily.png')})\n\n`;
      markdownContent += `| 日付 | マージされたPR数 | 平均マージ時間 (分) |\n`;
      markdownContent += `|---|---|---|\n`;
      prTimeSeriesData.mergedPullRequests.labels.forEach((label: string, index: number) => {
        const mergedPRs = prTimeSeriesData.mergedPullRequests.values[index];
        const avgTimeToMerge = prTimeSeriesData.avgTimeToMerge.values[index];
        markdownContent += `| ${label} | ${mergedPRs} | ${avgTimeToMerge.toFixed(2)} |\n`;
      });
      markdownContent += `\n`;
    }

    // Issue Time Series
    const issueTimeSeriesData = allMetrics.issueTimeSeries.daily; // デフォルトで日次を表示
    if (issueTimeSeriesData.closedIssues.labels.length > 0) {
      markdownContent += `### Issue 時系列 (日次)\n\n`;
      markdownContent += `![日次クローズされたIssue数](${this._getMarkdownImagePath('issue_time_series_closed_issues_daily.png')})\n\n`;
      markdownContent += `![日次平均解決時間](${this._getMarkdownImagePath('issue_time_series_avg_issue_resolution_time_daily.png')})\n\n`;
      markdownContent += `| 日付 | クローズされたIssue数 | 平均解決時間 (分) |\n`;
      markdownContent += `|---|---|---|\n`;
      issueTimeSeriesData.closedIssues.labels.forEach((label: string, index: number) => {
        const closedIssues = issueTimeSeriesData.closedIssues.values[index];
        const avgIssueResolutionTime = issueTimeSeriesData.avgIssueResolutionTime.values[index];
        markdownContent += `| ${label} | ${closedIssues} | ${avgIssueResolutionTime.toFixed(2)} |\n`;
      });
      markdownContent += `\n`;
    }

    fs.writeFileSync(outputPath, markdownContent);
    console.log(`Markdownレポートを ${outputPath} に保存しました。`);
  }
}

export default Reporter;
