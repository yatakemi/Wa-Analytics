import { Endpoints } from '@octokit/types';

// GitHub API Types (簡略化)
export type PullRequest = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];
export type Issue = Endpoints['GET /repos/{owner}/{repo}/issues']['response']['data'][number];
export type Commit = Endpoints['GET /repos/{owner}/{repo}/commits']['response']['data'][number];
export type ReviewComment = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/comments']['response']['data'][number];
export type PullRequestFile = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/files']['response']['data'][number];

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

export interface DoraMetrics {
  deploymentFrequency: number;
  leadTimeForChanges: number; // in hours
  changeFailureRate: number; // percentage
  meanTimeToRecovery: number; // in hours
}

// GitHub Project Types
export interface Project {
  id: number;
  name: string;
  body: string | null;
  state: string;
}

export interface ProjectColumn {
  id: number;
  name: string;
}

export interface ProjectCard {
  id: number;
  note: string | null;
  content_url?: string;
  column_id: number;
  creator: {
    login: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMetrics {
  totalCards: number;
  completedCards: number;
  avgCardLeadTime: number; // in hours
  throughput: number; // cards per week
}

export interface AllMetrics {
  prMetrics: PullRequestMetrics;
  issueMetrics: IssueMetrics;
  prContributors: Map<string, ContributorPullRequestMetrics>;
  issueContributors: Map<string, ContributorIssueMetrics>;
  prTimeSeries: PullRequestTimeSeries;
  issueTimeSeries: IssueTimeSeries;
  doraMetrics?: DoraMetrics; // Optional, as it will be calculated separately
  projectMetrics?: ProjectMetrics; // Optional
}
