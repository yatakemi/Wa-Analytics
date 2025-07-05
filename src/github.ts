import { Octokit } from '@octokit/rest';

class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  async getPullRequests(owner: string, repo: string, startDate: Date, endDate: Date): Promise<any[]> {
    const pulls: any[] = [];
    let page = 1;
    let hasMore = true;

    console.log(`  Pull Requests: ページ ${page} を取得中...`);
    while (hasMore) {
      const response = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'closed',
        per_page: 100,
        page,
      });

      const filteredPulls = response.data.filter(pull => {
        const mergedAt = pull.merged_at ? new Date(pull.merged_at) : null;
        return pull.merged_at && mergedAt && mergedAt >= startDate && mergedAt <= endDate;
      });

      pulls.push(...filteredPulls);

      if (response.data.length < 100) {
        hasMore = false;
      } else {
        page++;
        console.log(`  Pull Requests: ページ ${page} を取得中... (現在の合計: ${pulls.length})`);
      }
    }
    return pulls;
  }

  async getIssues(owner: string, repo: string, startDate: Date, endDate: Date): Promise<any[]> {
    const issues: any[] = [];
    let page = 1;
    let hasMore = true;

    console.log(`  Issues: ページ ${page} を取得中...`);
    while (hasMore) {
      const response = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state: 'closed',
        since: startDate.toISOString(),
        per_page: 100,
        page,
      });

      const filteredIssues = response.data.filter(issue => {
        const closedAt = issue.closed_at ? new Date(issue.closed_at) : null;
        return issue.closed_at && closedAt && closedAt >= startDate && closedAt <= endDate && !issue.pull_request;
      });

      issues.push(...filteredIssues);

      if (response.data.length < 100) {
        hasMore = false;
      } else {
        page++;
        console.log(`  Issues: ページ ${page} を取得中... (現在の合計: ${issues.length})`);
      }
    }
    return issues;
  }

  async getCommits(owner: string, repo: string, startDate: Date, endDate: Date): Promise<any[]> {
    const commits: any[] = [];
    let page = 1;
    let hasMore = true;

    console.log(`  Commits: ページ ${page} を取得中...`);
    while (hasMore) {
      const response = await this.octokit.repos.listCommits({
        owner,
        repo,
        since: startDate.toISOString(),
        until: endDate.toISOString(),
        per_page: 100,
        page,
      });

      commits.push(...response.data);

      if (response.data.length < 100) {
        hasMore = false;
      } else {
        page++;
        console.log(`  Commits: ページ ${page} を取得中... (現在の合計: ${commits.length})`);
      }
    }
    return commits;
  }

  async getPullRequestReviewComments(owner: string, repo: string, pull_number: number): Promise<any[]> {
    const comments: any[] = [];
    let page = 1;
    let hasMore = true;

    // console.log(`    PR #${pull_number} のレビューコメント: ページ ${page} を取得中...`); // コメントが多すぎる可能性があるのでコメントアウト
    while (hasMore) {
      const response = await this.octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number,
        per_page: 100,
        page,
      });

      comments.push(...response.data);

      if (response.data.length < 100) {
        hasMore = false;
      } else {
        page++;
        // console.log(`    PR #${pull_number} のレビューコメント: ページ ${page} を取得中... (現在の合計: ${comments.length})`);
      }
    }
    return comments;
  }

  async getPullRequestFiles(owner: string, repo: string, pull_number: number): Promise<any[]> {
    const response = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    return response.data;
  }
}

export default GitHubClient;
