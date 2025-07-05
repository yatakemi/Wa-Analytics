import { Octokit } from '@octokit/rest';

// GitHub API Types (簡略化)
export type PullRequest = Octokit.PullsListResponseItem;
export type Issue = Octokit.IssuesListForRepoResponseItem;
export type Commit = Octokit.ReposListCommitsResponseItem;
export type ReviewComment = Octokit.PullsListReviewCommentsResponseItem;
export type PullRequestFile = Octokit.PullsListFilesResponseItem;

// Metrics Types
export interface PullRequestMetrics {
  mergedPullRequests: number;
  avgTimeToFirstReview: number;
  avgTimeToMerge: number;
  totalLinesChanged: number;
  avgReviewCommentsPerPR: number;
  avgReviewIterationsPerPR: number;
}

export interface IssueMetrics {
  closedIssues: number;
  avgIssueResolutionTime: number;
}

export interface ContributorPullRequestMetrics {
  mergedPullRequests: number;
  totalTimeToFirstReview: number;
  totalTimeToMerge: number;
  totalLinesChanged: number;
  totalReviewComments: number;
  totalReviewIterations: number;
}

export interface ContributorIssueMetrics {
  closedIssues: number;
  totalIssueResolutionTime: number;
}

export interface TimeSeriesData {
  labels: string[]; // YYYY-MM-DD, YYYY-MM, or YYYY-MM-DD (for week start)
  values: number[];
}

export interface PullRequestTimeSeries {
  daily: { mergedPullRequests: TimeSeriesData; avgTimeToMerge: TimeSeriesData };
  weekly: { mergedPullRequests: TimeSeriesData; avgTimeToMerge: TimeSeriesData };
  monthly: { mergedPullRequests: TimeSeriesData; avgTimeToMerge: TimeSeriesData };
}

export interface IssueTimeSeries {
  daily: { closedIssues: TimeSeriesData; avgIssueResolutionTime: TimeSeriesData };
  weekly: { closedIssues: TimeSeriesData; avgIssueResolutionTime: TimeSeriesData };
  monthly: { closedIssues: TimeSeriesData; avgIssueResolutionTime: TimeSeriesData };
}

export interface AllMetrics {
  prMetrics: PullRequestMetrics;
  issueMetrics: IssueMetrics;
  prContributors: Map<string, ContributorPullRequestMetrics>;
  issueContributors: Map<string, ContributorIssueMetrics>;
  prTimeSeries: PullRequestTimeSeries;
  issueTimeSeries: IssueTimeSeries;
}
