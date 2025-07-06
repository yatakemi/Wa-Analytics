import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { Endpoints } from '@octokit/types';
import { readCache, writeCache } from './cache';
import { PullRequest, Issue, Commit, ReviewComment, PullRequestFile, ProjectV2, ProjectV2Item, Iteration, DetailedPullRequest, DetailedIssue, IssueComment, TimelineEvent } from './types';

class GitHubClient {
  private octokit: Octokit;
  private graphqlWithAuth: typeof graphql;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
    this.graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
  }

  private async fetchDataAndCache<T>(cacheKey: string, fetchFunction: () => Promise<T>): Promise<T> {
    const cachedData = await readCache<T>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const data = await fetchFunction();
    await writeCache(cacheKey, data);
    return data;
  }

  async getOrganizationRepos(org: string): Promise<any[]> {
    const cacheKey = `repos-${org}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const repos: any[] = [];
      let page = 1;
      let hasMore = true;

      console.log(`  組織 ${org} のリポジトリ: ページ ${page} を取得中...`);
      while (hasMore) {
        const response = await this.octokit.repos.listForOrg({
          org,
          type: 'all',
          per_page: 100,
          page,
        });

        repos.push(...response.data);

        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
          console.log(`  組織 ${org} のリポジトリ: ページ ${page} を取得中... (現在の合計: ${repos.length})`);
        }
      }
      return repos;
    });
  }

  async getPullRequests(owner: string, repo: string, startDate: Date, endDate: Date): Promise<DetailedPullRequest[]> {
    const cacheKey = `pulls-${owner}-${repo}-${startDate.getTime()}-${endDate.getTime()}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const pulls: DetailedPullRequest[] = [];
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

        const detailedPullPromises = filteredPulls.map(async (simplePull) => {
          const [detailedPull, reviewComments, files, timeline] = await Promise.all([
            this.getPullRequestDetails(owner, repo, simplePull.number),
            this.getPullRequestReviewComments(owner, repo, simplePull.number),
            this.getPullRequestFiles(owner, repo, simplePull.number),
            this.getPullRequestTimeline(owner, repo, simplePull.number),
          ]);
          return { ...detailedPull, reviewComments, files, timeline };
        });

        pulls.push(...(await Promise.all(detailedPullPromises)));

        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
          console.log(`  Pull Requests: ページ ${pulls.length / 100} を取得中... (現在の合計: ${pulls.length})`);
        }
      }
      return pulls;
    });
  }

  async getIssues(owner: string, repo: string, startDate: Date, endDate: Date): Promise<DetailedIssue[]> {
    const cacheKey = `issues-${owner}-${repo}-${startDate.getTime()}-${endDate.getTime()}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const issues: DetailedIssue[] = [];
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

        const detailedIssuePromises = filteredIssues.map(async (simpleIssue) => {
          const [issueComments, timeline] = await Promise.all([
            this.getIssueComments(owner, repo, simpleIssue.number),
            this.getIssueTimeline(owner, repo, simpleIssue.number),
          ]);
          return { ...simpleIssue, issueComments, timeline };
        });

        issues.push(...(await Promise.all(detailedIssuePromises)));

        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
          console.log(`  Issues: ページ ${issues.length / 100} を取得中... (現在の合計: ${issues.length})`);
        }
      }
      return issues;
    });
  }

  async getCommits(owner: string, repo: string, startDate: Date, endDate: Date): Promise<Commit[]> {
    const cacheKey = `commits-${owner}-${repo}-${startDate.getTime()}-${endDate.getTime()}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const commits: Commit[] = [];
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
    });
  }

  async getPullRequestReviewComments(owner: string, repo: string, pull_number: number): Promise<ReviewComment[]> {
    const cacheKey = `pr-comments-${owner}-${repo}-${pull_number}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const comments: ReviewComment[] = [];
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
    });
  }

  async getPullRequestFiles(owner: string, repo: string, pull_number: number): Promise<PullRequestFile[]> {
    const cacheKey = `pr-files-${owner}-${repo}-${pull_number}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const response = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number,
      });
      return response.data;
    });
  }

  async getPullRequestDetails(owner: string, repo: string, pull_number: number): Promise<PullRequest> {
    const cacheKey = `pr-details-${owner}-${repo}-${pull_number}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const response = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number,
      });
      return response.data as PullRequest;
    });
  }

  async getIssueComments(owner: string, repo: string, issue_number: number): Promise<Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data'][number][]> {
    const cacheKey = `issue-comments-${owner}-${repo}-${issue_number}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const comments: Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data'][number][] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.issues.listComments({
          owner,
          repo,
          issue_number,
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
    });
  }

  async getIssueTimeline(owner: string, repo: string, issue_number: number): Promise<Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/timeline']['response']['data'][number][]> {
    const cacheKey = `issue-timeline-${owner}-${repo}-${issue_number}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const timeline: Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/timeline']['response']['data'][number][] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.issues.listEventsForTimeline({
          owner,
          repo,
          issue_number,
          per_page: 100,
          page,
        });
        timeline.push(...response.data);
        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
      return timeline;
    });
  }

  async getPullRequestTimeline(owner: string, repo: string, pull_number: number): Promise<Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/timeline']['response']['data'][number][]> {
    const cacheKey = `pr-timeline-${owner}-${repo}-${pull_number}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const timeline: Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/timeline']['response']['data'][number][] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.issues.listEventsForTimeline({
          owner,
          repo,
          issue_number: pull_number, // PR timeline is accessed via issue timeline API
          per_page: 100,
          page,
        });
        timeline.push(...response.data);
        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
      return timeline;
    });
  }

  async getDeployments(owner: string, repo: string, startDate: Date, endDate: Date): Promise<Endpoints['GET /repos/{owner}/{repo}/deployments']['response']['data']> {
    const cacheKey = `deployments-${owner}-${repo}-${startDate.getTime()}-${endDate.getTime()}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const deployments: Endpoints['GET /repos/{owner}/{repo}/deployments']['response']['data'] = [];
      let page = 1;
      let hasMore = true;

      console.log(`  Deployments: ページ ${page} を取得中...`);
      while (hasMore) {
        const response = await this.octokit.repos.listDeployments({
          owner,
          repo,
          per_page: 100,
          page,
        });

        const filteredDeployments = response.data.filter(deployment => {
          const createdAt = new Date(deployment.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });

        deployments.push(...filteredDeployments);

        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
          console.log(`  Deployments: ページ ${page} を取得中... (現在の合計: ${deployments.length})`);
        }
      }
      return deployments;
    });
  }

  async getReleases(owner: string, repo: string, startDate: Date, endDate: Date): Promise<Endpoints['GET /repos/{owner}/{repo}/releases']['response']['data']> {
    const cacheKey = `releases-${owner}-${repo}-${startDate.getTime()}-${endDate.getTime()}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const releases: Endpoints['GET /repos/{owner}/{repo}/releases']['response']['data'] = [];
      let page = 1;
      let hasMore = true;

      console.log(`  Releases: ページ ${page} を取得中...`);
      while (hasMore) {
        const response = await this.octokit.repos.listReleases({
          owner,
          repo,
          per_page: 100,
          page,
        });

        const filteredReleases = response.data.filter(release => {
          const publishedAt = release.published_at ? new Date(release.published_at) : null;
          return publishedAt && publishedAt >= startDate && publishedAt <= endDate;
        });

        releases.push(...filteredReleases);

        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
          console.log(`  Releases: ページ ${page} を取得中... (現在の合計: ${releases.length})`);
        }
      }
      return releases;
    });
  }

  // Project-related methods
  async listProjects(owner: string, repo: string): Promise<any[]> {
    const cacheKey = `projects-${owner}-${repo}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const response = await this.octokit.projects.listForRepo({
        owner,
        repo,
        state: 'open',
      });
      return response.data;
    });
  }

  async listProjectColumns(project_id: number): Promise<any[]> {
    const cacheKey = `project-columns-${project_id}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const response = await this.octokit.projects.listColumns({
        project_id,
      });
      return response.data;
    });
  }

  async listColumnCards(column_id: number): Promise<any[]> {
    const cacheKey = `column-cards-${column_id}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const cards: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.projects.listCards({
          column_id,
          per_page: 100,
          page,
        });

        cards.push(...response.data);

        if (response.data.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
      return cards;
    });
  }

  // Project v2 (GraphQL) methods
  async getProjectV2(owner: string, projectNumber: number): Promise<ProjectV2 | null> {
    const cacheKey = `project-v2-${owner}-${projectNumber}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const query = `
        query($owner: String!, $projectNumber: Int!) {
          organization(login: $owner) {
            projectV2(number: $projectNumber) {
              id
              title
              number
            }
          }
        }
      `;
      const { organization } = await this.graphqlWithAuth<{ organization: { projectV2: ProjectV2 } }>(query, { owner, projectNumber });
      return organization.projectV2;
    });
  }

  async getProjectV2Items(projectId: string): Promise<ProjectV2Item[]> {
    const cacheKey = `project-v2-items-${projectId}`;
    return this.fetchDataAndCache(cacheKey, async () => {
      const items: ProjectV2Item[] = [];
      let cursor = null;
      let hasNextPage = true;

      while (hasNextPage) {
        const query = `
          query($projectId: ID!, $cursor: String) {
            node(id: $projectId) {
              ... on ProjectV2 {
                items(first: 100, after: $cursor) {
                  pageInfo {
                    endCursor
                    hasNextPage
                  }
                  nodes {
                    id
                    content {
                      __typename
                      ... on Issue {
                        id
                        number
                        title
                        createdAt
                        closedAt
                      }
                      ... on PullRequest {
                        id
                        number
                        title
                        createdAt
                        closedAt
                      }
                    }
                    fieldValues(first: 20) {
                      nodes {
                        ... on ProjectV2ItemFieldSingleSelectValue {
                          field {
                            name
                          }
                          name
                        }
                        ... on ProjectV2ItemFieldIterationValue {
                          field {
                            name
                          }
                          title
                          iterationId
                          startDate
                          duration
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        const { node }: any = await this.graphqlWithAuth(query, { projectId, cursor });
        items.push(...node.items.nodes);
        hasNextPage = node.items.pageInfo.hasNextPage;
        cursor = node.items.pageInfo.endCursor;
      }
      return items;
    });
  }
}

export default GitHubClient;
