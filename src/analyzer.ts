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

class Analyzer {
  private githubClient: GitHubClient;

  constructor(githubClient: GitHubClient) {
    this.githubClient = githubClient;
  }

  async calculatePullRequestMetrics(owner: string, repo: string, pulls: any[]): Promise<PullRequestMetrics> {
    let totalTimeToFirstReview = 0;
    let totalTimeToMerge = 0;
    let totalLinesChanged = 0;
    let totalReviewComments = 0;
    let totalReviewIterations = 0;

    for (const pull of pulls) {
      // Time to Merge
      if (pull.created_at && pull.merged_at) {
        totalTimeToMerge += differenceInMinutes(parseISO(pull.merged_at), parseISO(pull.created_at));
      }

      // Lines of Code Changed
      totalLinesChanged += (pull.additions || 0) + (pull.deletions || 0);

      // Fetch review comments for more accurate metrics
      const reviewComments = await this.githubClient.getPullRequestReviewComments(owner, repo, pull.number);
      totalReviewComments += reviewComments.length;

      if (reviewComments.length > 0) {
        // Time to First Review: Find the earliest review comment
        const firstReview = reviewComments.reduce((min: Date | null, comment: any) => {
          const commentDate = parseISO(comment.created_at);
          return (min === null || commentDate < min) ? commentDate : min;
        }, null);

        if (firstReview) {
          totalTimeToFirstReview += differenceInMinutes(firstReview, parseISO(pull.created_at));
        }

        // Review Iterations: Simplified - count distinct users who commented
        const distinctReviewers = new Set(reviewComments.map((comment: any) => comment.user.login));
        totalReviewIterations += distinctReviewers.size; // This is a simplification. True iterations are more complex.
      }
    }

    const numPulls = pulls.length;

    return {
      mergedPullRequests: numPulls,
      avgTimeToFirstReview: numPulls > 0 ? totalTimeToFirstReview / numPulls : 0,
      avgTimeToMerge: numPulls > 0 ? totalTimeToMerge / numPulls : 0,
      totalLinesChanged: totalLinesChanged,
      avgReviewCommentsPerPR: numPulls > 0 ? totalReviewComments / numPulls : 0,
      avgReviewIterationsPerPR: numPulls > 0 ? totalReviewIterations / numPulls : 0,
    };
  }

  calculateIssueMetrics(issues: any[]): IssueMetrics {
    let totalIssueResolutionTime = 0;

    for (const issue of issues) {
      if (issue.created_at && issue.closed_at) {
        totalIssueResolutionTime += differenceInMinutes(parseISO(issue.closed_at), parseISO(issue.created_at));
      }
    }

    const numIssues = issues.length;

    return {
      closedIssues: numIssues,
      avgIssueResolutionTime: numIssues > 0 ? totalIssueResolutionTime / numIssues : 0,
    };
  }
}

export default Analyzer;
