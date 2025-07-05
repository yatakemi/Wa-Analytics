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
      }
    }
    return pulls;
  }

  async getIssues(owner: string, repo: string, startDate: Date, endDate: Date): Promise<any[]> {
    const issues: any[] = [];
    let page = 1;
    let hasMore = true;

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
      }
    }
    return issues;
  }

  async getCommits(owner: string, repo: string, startDate: Date, endDate: Date): Promise<any[]> {
    const commits: any[] = [];
    let page = 1;
    let hasMore = true;

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
      }
    }
    return commits;
  }

  async getPullRequestReviewComments(owner: string, repo: string, pull_number: number): Promise<any[]> {
    const comments: any[] = [];
    let page = 1;
    let hasMore = true;

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