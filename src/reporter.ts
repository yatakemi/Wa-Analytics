import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs';
import * as path from 'path';
import { ChartConfiguration, Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns'; // date-fnsアダプターをインポート
import { stringify } from 'csv-stringify';
import { TimeSeriesData } from './types';

// Chart.jsのすべてのコンポーネントとアダプターを登録
Chart.register(...registerables);

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

  async generateChart(data: TimeSeriesData, filename: string, title: string, yAxisLabel: string): Promise<void> {
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
    const outputPath = path.join(this.outputDir, filename);
    fs.writeFileSync(outputPath, buffer);
    console.log(`グラフを ${outputPath} に保存しました。`);
  }

  async generateLineChart(data: TimeSeriesData, filename: string, title: string, yAxisLabel: string): Promise<void> {
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
    const outputPath = path.join(this.outputDir, filename);
    fs.writeFileSync(outputPath, buffer);
    console.log(`グラフを ${outputPath} に保存しました。`);
  }

  async generateContributorBarChart(contributorMetrics: Map<string, any>, metricKey: string, filename: string, title: string, yAxisLabel: string): Promise<void> {
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
    const outputPath = path.join(this.outputDir, filename);
    fs.writeFileSync(outputPath, buffer);
    console.log(`グラフを ${outputPath} に保存しました。`);
  }

  private async _writeCsvFile(data: any[], filename: string, columns: string[]): Promise<void> {
    const outputPath = path.join(this.outputDir, filename);
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

  async generateOverallMetricsCsv(prMetrics: any, issueMetrics: any): Promise<void> {
    const prData = Object.entries(prMetrics).map(([key, value]) => ({ Metric: key, Value: value }));
    await this._writeCsvFile(prData, 'overall_pr_metrics.csv', ['Metric', 'Value']);

    const issueData = Object.entries(issueMetrics).map(([key, value]) => ({ Metric: key, Value: value }));
    await this._writeCsvFile(issueData, 'overall_issue_metrics.csv', ['Metric', 'Value']);
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

  // Markdownレポート生成のスケルトン
  generateMarkdownReport(data: any, filename: string): void {
    // TODO: Markdown形式でレポートを生成するロジックを実装
    console.log(`Markdownレポートを ${filename} に生成します (未実装)。`);
  }
}

export default Reporter;