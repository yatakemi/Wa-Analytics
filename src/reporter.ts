import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs';
import * as path from 'path';
import { ChartConfiguration, Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns'; // date-fnsアダプターをインポート
import { stringify } from 'csv-stringify';

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

  async generateChart(data: ChartData, filename: string, title: string, yAxisLabel: string): Promise<void> {
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

  async generateLineChart(data: ChartData, filename: string, title: string, yAxisLabel: string): Promise<void> {
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

  async generateCsvReport(data: any, filename: string): Promise<void> {
    const outputPath = path.join(this.outputDir, filename);
    const columns = Object.keys(data);
    const values = Object.values(data);

    stringify([columns, values], (err, output) => {
      if (err) {
        console.error('CSV生成エラー:', err);
        return;
      }
      fs.writeFileSync(outputPath, output);
      console.log(`CSVレポートを ${outputPath} に保存しました。`);
    });
  }

  // Markdownレポート生成のスケルトン
  generateMarkdownReport(data: any, filename: string): void {
    // TODO: Markdown形式でレポートを生成するロジックを実装
    console.log(`Markdownレポートを ${filename} に生成します (未実装)。`);
  }
}

export default Reporter;
