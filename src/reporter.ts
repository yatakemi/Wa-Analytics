import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs';
import * as path from 'path';
import { ChartConfiguration, ChartTypeRegistry } from 'chart.js';

interface ChartData {
  labels: string[];
  values: number[];
}

class Reporter {
  private width: number;
  private height: number;
  private chartJSNodeCanvas: ChartJSNodeCanvas;

  constructor() {
    this.width = 800;
    this.height = 600;
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: this.width,
      height: this.height,
      backgroundColour: 'white',
    });
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
    const outputPath = path.join(process.cwd(), filename);
    fs.writeFileSync(outputPath, buffer);
    console.log(`グラフを ${outputPath} に保存しました。`);
  }

  // CSVレポート生成のスケルトン
  generateCsvReport(data: any, filename: string): void {
    // TODO: csv-stringify を使用してCSVを生成するロジックを実装
    console.log(`CSVレポートを ${filename} に生成します (未実装)。`);
  }

  // Markdownレポート生成のスケルトン
  generateMarkdownReport(data: any, filename: string): void {
    // TODO: Markdown形式でレポートを生成するロジックを実装
    console.log(`Markdownレポートを ${filename} に生成します (未実装)。`);
  }
}

export default Reporter;
