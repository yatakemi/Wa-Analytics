import { differenceInMinutes, parseISO } from 'date-fns';
import GitHubClient from './github';

interface PullRequestMetrics {
  mergedPullRequests: number;
  avgTimeToFirstReview: number;
  avgTimeToMerge: number;
  totalLinesChanged: number;
  avgReviewCommentsPerPR: number;
  avgReviewIterationsPerPR: number;
}

interface IssueMetrics {
  closedIssues: number;
  avgIssueResolutionTime: number;
}

interface ContributorPullRequestMetrics {
  mergedPullRequests: number;
  totalTimeToFirstReview: number;
  totalTimeToMerge: number;
  totalLinesChanged: number;
  totalReviewComments: number;
  totalReviewIterations: number;
}

interface ContributorIssueMetrics {
  closedIssues: number;
  totalIssueResolutionTime: number;
}

class Analyzer {
  private githubClient: GitHubClient;

  constructor(githubClient: GitHubClient) {
    this.githubClient = githubClient;
  }

  async calculatePullRequestMetrics(owner: string, repo: string, pulls: any[]): Promise<{ overall: PullRequestMetrics; contributors: Map<string, ContributorPullRequestMetrics> }> {
    let totalTimeToFirstReview = 0;
    let totalTimeToMerge = 0;
    let totalLinesChanged = 0;
    let totalReviewComments = 0;
    let totalReviewIterations = 0;

    const contributorMetrics = new Map<string, ContributorPullRequestMetrics>();

    for (const pull of pulls) {
      const authorLogin = pull.user?.login || 'unknown';

      if (!contributorMetrics.has(authorLogin)) {
        contributorMetrics.set(authorLogin, {
          mergedPullRequests: 0,
          totalTimeToFirstReview: 0,
          totalTimeToMerge: 0,
          totalLinesChanged: 0,
          totalReviewComments: 0,
          totalReviewIterations: 0,
        });
      }
      const currentContributorMetrics = contributorMetrics.get(authorLogin)!;

      currentContributorMetrics.mergedPullRequests++;

      // Time to Merge
      if (pull.created_at && pull.merged_at) {
        const timeToMerge = differenceInMinutes(parseISO(pull.merged_at), parseISO(pull.created_at));
        totalTimeToMerge += timeToMerge;
        currentContributorMetrics.totalTimeToMerge += timeToMerge;
      }

      // Lines of Code Changed
      const linesChanged = (pull.additions || 0) + (pull.deletions || 0);
      totalLinesChanged += linesChanged;
      currentContributorMetrics.totalLinesChanged += linesChanged;

      // Fetch review comments for more accurate metrics
      const reviewComments = await this.githubClient.getPullRequestReviewComments(owner, repo, pull.number);
      totalReviewComments += reviewComments.length;
      currentContributorMetrics.totalReviewComments += reviewComments.length;

      if (reviewComments.length > 0) {
        // Time to First Review: Find the earliest review comment
        const firstReview = reviewComments.reduce((min: Date | null, comment: any) => {
          const commentDate = parseISO(comment.created_at);
          return (min === null || commentDate < min) ? commentDate : min;
        }, null);

        if (firstReview) {
          const timeToFirstReview = differenceInMinutes(firstReview, parseISO(pull.created_at));
          totalTimeToFirstReview += timeToFirstReview;
          currentContributorMetrics.totalTimeToFirstReview += timeToFirstReview;
        }

        // Review Iterations: Simplified - count distinct users who commented
        const distinctReviewers = new Set(reviewComments.map((comment: any) => comment.user.login));
        totalReviewIterations += distinctReviewers.size; // This is a simplification. True iterations are more complex.
        currentContributorMetrics.totalReviewIterations += distinctReviewers.size;
      }
    }

    const numPulls = pulls.length;

    const overallMetrics: PullRequestMetrics = {
      mergedPullRequests: numPulls,
      avgTimeToFirstReview: numPulls > 0 ? totalTimeToFirstReview / numPulls : 0,
      avgTimeToMerge: numPulls > 0 ? totalTimeToMerge / numPulls : 0,
      totalLinesChanged: totalLinesChanged,
      avgReviewCommentsPerPR: numPulls > 0 ? totalReviewComments / numPulls : 0,
      avgReviewIterationsPerPR: numPulls > 0 ? totalReviewIterations / numPulls : 0,
    };

    // Calculate averages for contributors
    contributorMetrics.forEach((metrics, login) => {
      if (metrics.mergedPullRequests > 0) {
        metrics.totalTimeToFirstReview /= metrics.mergedPullRequests;
        metrics.totalTimeToMerge /= metrics.mergedPullRequests;
        metrics.totalReviewComments /= metrics.mergedPullRequests;
        metrics.totalReviewIterations /= metrics.mergedPullRequests;
      }
    });

    return { overall: overallMetrics, contributors: contributorMetrics };
  }

  calculateIssueMetrics(issues: any[]): { overall: IssueMetrics; contributors: Map<string, ContributorIssueMetrics> } {
    let totalIssueResolutionTime = 0;
    const contributorMetrics = new Map<string, ContributorIssueMetrics>();

    for (const issue of issues) {
      const assigneeLogin = issue.assignee?.login || issue.user?.login || 'unknown';

      if (!contributorMetrics.has(assigneeLogin)) {
        contributorMetrics.set(assigneeLogin, {
          closedIssues: 0,
          totalIssueResolutionTime: 0,
        });
      }
      const currentContributorMetrics = contributorMetrics.get(assigneeLogin)!;

      currentContributorMetrics.closedIssues++;

      if (issue.created_at && issue.closed_at) {
        const resolutionTime = differenceInMinutes(parseISO(issue.closed_at), parseISO(issue.created_at));
        totalIssueResolutionTime += resolutionTime;
        currentContributorMetrics.totalIssueResolutionTime += resolutionTime;
      }
    }

    const numIssues = issues.length;

    const overallMetrics: IssueMetrics = {
      closedIssues: numIssues,
      avgIssueResolutionTime: numIssues > 0 ? totalIssueResolutionTime / numIssues : 0,
    };

    // Calculate averages for contributors
    contributorMetrics.forEach((metrics, login) => {
      if (metrics.closedIssues > 0) {
        metrics.totalIssueResolutionTime /= metrics.closedIssues;
      }
    });

    return { overall: overallMetrics, contributors: contributorMetrics };
  }
}

export default Analyzer;