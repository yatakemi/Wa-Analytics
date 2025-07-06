import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AllMetrics } from './types';

class AIAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('AI_API_KEY is required for AI analysis.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  async analyzeMetrics(metrics: AllMetrics): Promise<string> {
    let detailedDataSummary = '';

    if (metrics.detailedPulls && metrics.detailedPulls.length > 0) {
      detailedDataSummary += '\n--- 詳細なPull Requestデータ ---\n';
      metrics.detailedPulls.slice(0, 5).forEach(pr => { // 上位5件のみをサマリー
        detailedDataSummary += `PR #${pr.number}: ${pr.title}\n`;
        detailedDataSummary += `  作成者: ${pr.user?.login}, マージ日: ${pr.merged_at}\n`;
        detailedDataSummary += `  変更ファイル数: ${pr.files?.length || 0}, レビューコメント数: ${pr.reviewComments?.length || 0}\n`;
        if (pr.body) detailedDataSummary += `  説明の冒頭: ${pr.body.substring(0, 100)}...\n`;
        if (pr.reviewComments && pr.reviewComments.length > 0) {
          detailedDataSummary += `  レビューコメントの例: ${pr.reviewComments[0].body.substring(0, 50)}...\n`;
        }
        detailedDataSummary += '\n';
      });
    }

    if (metrics.detailedIssues && metrics.detailedIssues.length > 0) {
      detailedDataSummary += '\n--- 詳細なIssueデータ ---\n';
      metrics.detailedIssues.slice(0, 5).forEach(issue => { // 上位5件のみをサマリー
        detailedDataSummary += `Issue #${issue.number}: ${issue.title}\n`;
        detailedDataSummary += `  作成者: ${issue.user?.login}, クローズ日: ${issue.closed_at}\n`;
        if (issue.body) detailedDataSummary += `  説明の冒頭: ${issue.body.substring(0, 100)}...\n`;
        if (issue.issueComments && issue.issueComments.length > 0) {
          const firstComment = issue.issueComments[0];
          detailedDataSummary += `  コメントの例: ${firstComment.body?.substring(0, 50)}...
`;
        }
        detailedDataSummary += '\n';
      });
    }

    const prompt = `あなたはGitHubリポジトリの生産性分析の専門家です。以下のメトリクスと詳細データに基づいて、現状の課題を深く分析し、具体的な改善策を提案してください。\n\n--- メトリクス ---\n${JSON.stringify(metrics, (key, value) => {
      // MapオブジェクトをJSONに変換する際に、配列に変換してシリアライズ
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      // detailedPullsとdetailedIssuesは別途処理するため、ここでは除外
      if (key === 'detailedPulls' || key === 'detailedIssues') {
        return undefined;
      }
      return value;
    }, 2)}

${detailedDataSummary}

--- 分析の指示 ---\n1.  **現状の課題**: メトリクスと詳細データから読み取れる、チームの生産性、コード品質、コラボレーションにおける課題を特定してください。時系列トレンド、異常値、メトリクス間の相関関係にも注目してください。
2.  **具体的な対策案**: 特定された課題に対して、実行可能で具体的な対策案を複数提案してください。各対策案について、その目的、期待される効果、実施ステップを簡潔に記述してください。
3.  **優先順位**: 提案する対策案に優先順位を付けてください（高、中、低）。
4.  **KPIへの影響予測**: 提案された対策が、Pull Requestのマージ時間、Issue解決時間、デプロイ頻度などの主要なKPIにどのように影響すると予測されるか記述してください。\n\n--- 出力形式 ---\n以下のMarkdown形式で出力してください。\n\n## AI分析結果と対策案\n\n### 1. 現状の課題\n\n- 課題1: ...\n  - 詳細: ...\n- 課題2: ...\n  - 詳細: ...\n\n### 2. 対策案\n\n#### 対策案A: [対策のタイトル]\n- 目的: ...\n- 期待される効果: ...\n- 実施ステップ:\n  1. ...\n  2. ...\n- 優先順位: [高/中/低]\n- KPIへの影響予測: ...\n\n#### 対策案B: [対策のタイトル]\n- ...\n\n`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return text;
    } catch (error) {
      console.error('生成AIによる分析中にエラーが発生しました:', error);
      return '生成AIによる分析に失敗しました。';
    }
  }
}

export default AIAnalyzer;