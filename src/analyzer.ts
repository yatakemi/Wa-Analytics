import { differenceInMinutes, parseISO, format, startOfMonth, startOfWeek, startOfDay, differenceInHours } from 'date-fns';

import GitHubClient from './github';
import {
  PullRequest,
  Issue,
  PullRequestMetrics,
  IssueMetrics,
  ContributorPullRequestMetrics,
  ContributorIssueMetrics,
  TimeSeriesData,
  PullRequestTimeSeries,
  IssueTimeSeries,
  DoraMetrics,
  ProjectMetrics,
  IterationMetrics,
} from './types';

class Analyzer {
  private githubClient: GitHubClient;

  constructor(githubClient: GitHubClient) {
    this.githubClient = githubClient;
  }

  async calculatePullRequestMetrics(owner: string, repo: string, pulls: PullRequest[]): Promise<{ overall: PullRequestMetrics; contributors: Map<string, ContributorPullRequestMetrics>; timeSeries: PullRequestTimeSeries }> {
    let totalTimeToFirstReview = 0;
    let totalTimeToMerge = 0;
    let totalLinesChanged = 0;
    let totalReviewComments = 0;
    let totalReviewIterations = 0;

    const contributorMetrics = new Map<string, ContributorPullRequestMetrics>();

    const mergedPullRequestsDailyTimeSeries: { [key: string]: number } = {};
    const timeToMergeDailyTimeSeries: { [key: string]: { total: number; count: number } } = {};

    const mergedPullRequestsWeeklyTimeSeries: { [key: string]: number } = {};
    const timeToMergeWeeklyTimeSeries: { [key: string]: { total: number; count: number } } = {};

    const mergedPullRequestsMonthlyTimeSeries: { [key: string]: number } = {};
    const timeToMergeMonthlyTimeSeries: { [key: string]: { total: number; count: number } } = {};

    const totalPulls = pulls.length;
    console.log(`  Pull Requestメトリクスを計算中... (合計 ${totalPulls} 件)`);

    console.log(`    Pull Requestの詳細情報を取得中...`);
    const pullDetailsPromises = pulls.map(pull => this.githubClient.getPullRequestDetails(owner, repo, pull.number));
    const pullDetailsList = await Promise.all(pullDetailsPromises);
    console.log(`    Pull Requestの詳細情報を取得しました。`);

    console.log(`    レビューコメントを取得中...`);
    const reviewCommentsPromises = pullDetailsList.map(pullDetails => this.githubClient.getPullRequestReviewComments(owner, repo, pullDetails.number));
    const reviewCommentsList = await Promise.all(reviewCommentsPromises);
    console.log(`    レビューコメントを取得しました。`);

    const reviewCommentsMap = new Map<number, any[]>();
    pullDetailsList.forEach((pullDetails, index) => {
      reviewCommentsMap.set(pullDetails.number, reviewCommentsList[index]);
    });

    for (let i = 0; i < totalPulls; i++) {
      const pullDetails = pullDetailsList[i];
      if ((i + 1) % 10 === 0 || (i + 1) === totalPulls) {
        console.log(`    ${i + 1}/${totalPulls} 件のPull Requestを処理しました。`);
      }

      const authorLogin = pullDetails.user?.login || 'unknown';
      const mergedAt = pullDetails.merged_at ? parseISO(pullDetails.merged_at) : null;

      let dayKey = '';
      let weekKey = '';
      let monthKey = '';

      if (mergedAt) {
        dayKey = format(startOfDay(mergedAt), 'yyyy-MM-dd');
        mergedPullRequestsDailyTimeSeries[dayKey] = (mergedPullRequestsDailyTimeSeries[dayKey] || 0) + 1;

        weekKey = format(startOfWeek(mergedAt, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday start
        mergedPullRequestsWeeklyTimeSeries[weekKey] = (mergedPullRequestsWeeklyTimeSeries[weekKey] || 0) + 1;

        monthKey = format(startOfMonth(mergedAt), 'yyyy-MM');
        mergedPullRequestsMonthlyTimeSeries[monthKey] = (mergedPullRequestsMonthlyTimeSeries[monthKey] || 0) + 1;
      }

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
      if (pullDetails.created_at && pullDetails.merged_at) {
        const timeToMerge = differenceInMinutes(parseISO(pullDetails.merged_at), parseISO(pullDetails.created_at));
        totalTimeToMerge += timeToMerge;
        currentContributorMetrics.totalTimeToMerge += timeToMerge;

        if (dayKey) {
          if (!timeToMergeDailyTimeSeries[dayKey]) {
            timeToMergeDailyTimeSeries[dayKey] = { total: 0, count: 0 };
          }
          timeToMergeDailyTimeSeries[dayKey].total += timeToMerge;
          timeToMergeDailyTimeSeries[dayKey].count++;
        }
        if (weekKey) {
          if (!timeToMergeWeeklyTimeSeries[weekKey]) {
            timeToMergeWeeklyTimeSeries[weekKey] = { total: 0, count: 0 };
          }
          timeToMergeWeeklyTimeSeries[weekKey].total += timeToMerge;
          timeToMergeWeeklyTimeSeries[weekKey].count++;
        }
        if (monthKey) {
          if (!timeToMergeMonthlyTimeSeries[monthKey]) {
            timeToMergeMonthlyTimeSeries[monthKey] = { total: 0, count: 0 };
          }
          timeToMergeMonthlyTimeSeries[monthKey].total += timeToMerge;
          timeToMergeMonthlyTimeSeries[monthKey].count++;
        }
      }

      // Lines of Code Changed
      const linesChanged = (pullDetails.additions || 0) + (pullDetails.deletions || 0);
      totalLinesChanged += linesChanged;
      currentContributorMetrics.totalLinesChanged += linesChanged;

      // Fetch review comments for more accurate metrics
      const reviewComments = reviewCommentsMap.get(pullDetails.number) || [];
      totalReviewComments += reviewComments.length;
      currentContributorMetrics.totalReviewComments += reviewComments.length;

      if (reviewComments.length > 0) {
        // Time to First Review: Find the earliest review comment
        const firstReview = reviewComments.reduce((min: Date | null, comment: any) => {
          const commentDate = parseISO(comment.created_at);
          return (min === null || commentDate < min) ? commentDate : min;
        }, null);

        if (firstReview) {
          const timeToFirstReview = differenceInMinutes(firstReview, parseISO(pullDetails.created_at));
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

    // Prepare daily time series data
    const sortedDailyKeys = Object.keys(mergedPullRequestsDailyTimeSeries).sort();
    const mergedPRDailyTimeSeriesData: TimeSeriesData = {
      labels: sortedDailyKeys,
      values: sortedDailyKeys.map(day => mergedPullRequestsDailyTimeSeries[day]),
    };
    const avgTimeToMergeDailyTimeSeriesData: TimeSeriesData = {
      labels: sortedDailyKeys,
      values: sortedDailyKeys.map(day => timeToMergeDailyTimeSeries[day] ? timeToMergeDailyTimeSeries[day].total / timeToMergeDailyTimeSeries[day].count : 0),
    };

    // Prepare weekly time series data
    const sortedWeeklyKeys = Object.keys(mergedPullRequestsWeeklyTimeSeries).sort();
    const mergedPRWeeklyTimeSeriesData: TimeSeriesData = {
      labels: sortedWeeklyKeys,
      values: sortedWeeklyKeys.map(week => mergedPullRequestsWeeklyTimeSeries[week]),
    };
    const avgTimeToMergeWeeklyTimeSeriesData: TimeSeriesData = {
      labels: sortedWeeklyKeys,
      values: sortedWeeklyKeys.map(week => timeToMergeWeeklyTimeSeries[week] ? timeToMergeWeeklyTimeSeries[week].total / timeToMergeWeeklyTimeSeries[week].count : 0),
    };

    // Prepare monthly time series data
    const sortedMonthlyKeys = Object.keys(mergedPullRequestsMonthlyTimeSeries).sort();
    const mergedPRMonthlyTimeSeriesData: TimeSeriesData = {
      labels: sortedMonthlyKeys,
      values: sortedMonthlyKeys.map(month => mergedPullRequestsMonthlyTimeSeries[month]),
    };
    const avgTimeToMergeMonthlyTimeSeriesData: TimeSeriesData = {
      labels: sortedMonthlyKeys,
      values: sortedMonthlyKeys.map(month => timeToMergeMonthlyTimeSeries[month] ? timeToMergeMonthlyTimeSeries[month].total / timeToMergeMonthlyTimeSeries[month].count : 0),
    };

    return { overall: overallMetrics, contributors: contributorMetrics, timeSeries: { daily: { mergedPullRequests: mergedPRDailyTimeSeriesData, avgTimeToMerge: avgTimeToMergeDailyTimeSeriesData }, weekly: { mergedPullRequests: mergedPRWeeklyTimeSeriesData, avgTimeToMerge: avgTimeToMergeWeeklyTimeSeriesData }, monthly: { mergedPullRequests: mergedPRMonthlyTimeSeriesData, avgTimeToMerge: avgTimeToMergeMonthlyTimeSeriesData } } };
  }

  calculateIssueMetrics(issues: Issue[]): { overall: IssueMetrics; contributors: Map<string, ContributorIssueMetrics>; timeSeries: IssueTimeSeries } {
    let totalIssueResolutionTime = 0;
    const contributorMetrics = new Map<string, ContributorIssueMetrics>();

    const closedIssuesDailyTimeSeries: { [key: string]: number } = {};
    const issueResolutionDailyTimeSeries: { [key: string]: { total: number; count: number } } = {};

    const closedIssuesWeeklyTimeSeries: { [key: string]: number } = {};
    const issueResolutionWeeklyTimeSeries: { [key: string]: { total: number; count: number } } = {};

    const closedIssuesMonthlyTimeSeries: { [key: string]: number } = {};
    const issueResolutionMonthlyTimeSeries: { [key: string]: { total: number; count: number } } = {};

    const totalIssues = issues.length;
    console.log(`  Issueメトリクスを計算中... (合計 ${totalIssues} 件)`);

    for (let i = 0; i < totalIssues; i++) {
      const issue = issues[i];
      if ((i + 1) % 10 === 0 || (i + 1) === totalIssues) {
        console.log(`    ${i + 1}/${totalIssues} 件のIssueを処理しました。`);
      }

      const assigneeLogin = issue.assignee?.login || issue.user?.login || 'unknown';
      const closedAt = issue.closed_at ? parseISO(issue.closed_at) : null;

      let dayKey = '';
      let weekKey = '';
      let monthKey = '';

      if (closedAt) {
        dayKey = format(startOfDay(closedAt), 'yyyy-MM-dd');
        closedIssuesDailyTimeSeries[dayKey] = (closedIssuesDailyTimeSeries[dayKey] || 0) + 1;

        weekKey = format(startOfWeek(closedAt, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday start
        closedIssuesWeeklyTimeSeries[weekKey] = (closedIssuesWeeklyTimeSeries[weekKey] || 0) + 1;

        monthKey = format(startOfMonth(closedAt), 'yyyy-MM');
        closedIssuesMonthlyTimeSeries[monthKey] = (closedIssuesMonthlyTimeSeries[monthKey] || 0) + 1;
      }

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

        if (dayKey) {
          if (!issueResolutionDailyTimeSeries[dayKey]) {
            issueResolutionDailyTimeSeries[dayKey] = { total: 0, count: 0 };
          }
          issueResolutionDailyTimeSeries[dayKey].total += resolutionTime;
          issueResolutionDailyTimeSeries[dayKey].count++;
        }
        if (weekKey) {
          if (!issueResolutionWeeklyTimeSeries[weekKey]) {
            issueResolutionWeeklyTimeSeries[weekKey] = { total: 0, count: 0 };
          }
          issueResolutionWeeklyTimeSeries[weekKey].total += resolutionTime;
          issueResolutionWeeklyTimeSeries[weekKey].count++;
        }
        if (monthKey) {
          if (!issueResolutionMonthlyTimeSeries[monthKey]) {
            issueResolutionMonthlyTimeSeries[monthKey] = { total: 0, count: 0 };
          }
          issueResolutionMonthlyTimeSeries[monthKey].total += resolutionTime;
          issueResolutionMonthlyTimeSeries[monthKey].count++;
        }
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

    // Prepare daily time series data
    const sortedDailyKeys = Object.keys(closedIssuesDailyTimeSeries).sort();
    const closedIssueDailyTimeSeriesData: TimeSeriesData = {
      labels: sortedDailyKeys,
      values: sortedDailyKeys.map(day => closedIssuesDailyTimeSeries[day]),
    };
    const avgIssueResolutionDailyTimeSeriesData: TimeSeriesData = {
      labels: sortedDailyKeys,
      values: sortedDailyKeys.map(day => issueResolutionDailyTimeSeries[day] ? issueResolutionDailyTimeSeries[day].total / issueResolutionDailyTimeSeries[day].count : 0),
    };

    // Prepare weekly time series data
    const sortedWeeklyKeys = Object.keys(closedIssuesWeeklyTimeSeries).sort();
    const closedIssueWeeklyTimeSeriesData: TimeSeriesData = {
      labels: sortedWeeklyKeys,
      values: sortedWeeklyKeys.map(week => closedIssuesWeeklyTimeSeries[week]),
    };
    const avgIssueResolutionWeeklyTimeSeriesData: TimeSeriesData = {
      labels: sortedWeeklyKeys,
      values: sortedWeeklyKeys.map(week => issueResolutionWeeklyTimeSeries[week] ? issueResolutionWeeklyTimeSeries[week].total / issueResolutionWeeklyTimeSeries[week].count : 0),
    };

    // Prepare monthly time series data
    const sortedMonthlyKeys = Object.keys(closedIssuesMonthlyTimeSeries).sort();
    const closedIssueMonthlyTimeSeriesData: TimeSeriesData = {
      labels: sortedMonthlyKeys,
      values: sortedMonthlyKeys.map(month => closedIssuesMonthlyTimeSeries[month]),
    };
    const avgIssueResolutionMonthlyTimeSeriesData: TimeSeriesData = {
      labels: sortedMonthlyKeys,
      values: sortedMonthlyKeys.map(month => issueResolutionMonthlyTimeSeries[month] ? issueResolutionMonthlyTimeSeries[month].total / issueResolutionMonthlyTimeSeries[month].count : 0),
    };

    return { overall: overallMetrics, contributors: contributorMetrics, timeSeries: { daily: { closedIssues: closedIssueDailyTimeSeriesData, avgIssueResolutionTime: avgIssueResolutionDailyTimeSeriesData }, weekly: { closedIssues: closedIssueWeeklyTimeSeriesData, avgIssueResolutionTime: avgIssueResolutionWeeklyTimeSeriesData }, monthly: { closedIssues: closedIssueMonthlyTimeSeriesData, avgIssueResolutionTime: avgIssueResolutionMonthlyTimeSeriesData } } };
  }

  async calculateDoraMetrics(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date,
    pulls: PullRequest[],
    issues: Issue[],
  ): Promise<DoraMetrics> {
    console.log(`  DORAメトリクスを計算中...`);

    // 1. デプロイ頻度 (Deployment Frequency)
    const [deployments, releases] = await Promise.all([
      this.githubClient.getDeployments(owner, repo, startDate, endDate),
      this.githubClient.getReleases(owner, repo, startDate, endDate),
    ]);
    const deploymentFrequency = deployments.length + releases.length;

    // 2. 変更のリードタイム (Lead Time for Changes)
    let totalLeadTimeForChanges = 0;
    let leadTimeCount = 0;

    for (const pull of pulls) {
      if (pull.merged_at) {
        const mergedAt = parseISO(pull.merged_at);
        // Find a deployment that includes this PR's merge commit
        // This is a simplification. A more robust solution would involve checking commit history.
        const relevantDeployment = deployments.find(dep => {
          // Assuming deployment.sha is the commit SHA being deployed
          // And pull.merge_commit_sha is the merge commit SHA
          return dep.sha === pull.merge_commit_sha && new Date(dep.created_at) >= mergedAt;
        });

        if (relevantDeployment) {
          const leadTime = differenceInHours(new Date(relevantDeployment.created_at), mergedAt);
          totalLeadTimeForChanges += leadTime;
          leadTimeCount++;
        }
      }
    }

    const leadTimeForChanges = leadTimeCount > 0 ? totalLeadTimeForChanges / leadTimeCount : 0;

    // 3. 変更障害率 (Change Failure Rate)
    // This is a simplified approach. A more accurate metric would require external incident tracking.
    const incidentIssues = issues.filter(issue =>
      issue.labels.some(label => typeof label === 'object' && (label.name?.toLowerCase().includes('bug') || label.name?.toLowerCase().includes('incident')))
    );
    const changeFailureRate = deploymentFrequency > 0 ? (incidentIssues.length / deploymentFrequency) * 100 : 0;

    // 4. サービス復元時間 (Mean Time to Recovery - MTTR)
    // This is also a simplified approach, based on incident issue resolution time.
    let totalRecoveryTime = 0;
    let recoveryCount = 0;

    for (const issue of incidentIssues) {
      if (issue.created_at && issue.closed_at) {
        const recoveryTime = differenceInHours(parseISO(issue.closed_at), parseISO(issue.created_at));
        totalRecoveryTime += recoveryTime;
        recoveryCount++;
      }
    }

    const meanTimeToRecovery = recoveryCount > 0 ? totalRecoveryTime / recoveryCount : 0;

    return {
      deploymentFrequency,
      leadTimeForChanges,
      changeFailureRate,
      meanTimeToRecovery,
    };
  }

  async calculateProjectMetrics(owner: string, repo: string, projectName: string, doneColumnName: string): Promise<ProjectMetrics | null> {
    console.log(`  Projectメトリクスを計算中... (${projectName})`);

    const projects = await this.githubClient.listProjects(owner, repo);
    const targetProject = projects.find(p => p.name === projectName);

    if (!targetProject) {
      console.log(`    プロジェクト '${projectName}' が見つかりませんでした。`);
      return null;
    }

    const columns = await this.githubClient.listProjectColumns(targetProject.id);
    const doneColumn = columns.find(c => c.name === doneColumnName);

    if (!doneColumn) {
      console.log(`    完了カラム '${doneColumnName}' が見つかりませんでした。`);
      return null;
    }

    let totalCards = 0;
    let completedCards = 0;
    let totalLeadTime = 0;
    const weeklyThroughput: { [key: string]: number } = {};

    for (const column of columns) {
      const cards = await this.githubClient.listColumnCards(column.id);
      totalCards += cards.length;

      if (column.id === doneColumn.id) {
        completedCards += cards.length;
        for (const card of cards) {
          const createdAt = parseISO(card.created_at);
          const updatedAt = parseISO(card.updated_at);
          const leadTime = differenceInHours(updatedAt, createdAt);
          totalLeadTime += leadTime;

          const weekKey = format(startOfWeek(updatedAt, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          weeklyThroughput[weekKey] = (weeklyThroughput[weekKey] || 0) + 1;
        }
      }
    }

    const avgCardLeadTime = completedCards > 0 ? totalLeadTime / completedCards : 0;
    const throughputValues = Object.values(weeklyThroughput);
    const throughput = throughputValues.length > 0 ? throughputValues.reduce((a, b) => a + b, 0) / throughputValues.length : 0;

    return {
      totalCards,
      completedCards,
      avgCardLeadTime,
      throughput,
    };
  }

  async calculateIterationMetrics(owner: string, projectNumber: number, iterationFieldName: string, statusFieldName: string, doneStatusValue: string): Promise<IterationMetrics[] | null> {
    console.log(`  Iterationメトリクスを計算中... (Project #${projectNumber})`);

    const project = await this.githubClient.getProjectV2(owner, projectNumber);
    if (!project) {
      console.log(`    プロジェクト #${projectNumber} が見つかりませんでした。`);
      return null;
    }

    const items = await this.githubClient.getProjectV2Items(project.id);
    const iterationMetrics = new Map<string, IterationMetrics>();

    for (const item of items) {
      const iterationFieldValue = item.fieldValues.nodes.find(fv => fv.field?.name === iterationFieldName);
      const statusFieldValue = item.fieldValues.nodes.find(fv => fv.field?.name === statusFieldName);

      if (iterationFieldValue && 'iterationId' in iterationFieldValue) {
        const iteration = iterationFieldValue as any;
        const iterationId = iteration.iterationId;

        if (!iterationMetrics.has(iterationId)) {
          const startDate = parseISO(iteration.startDate);
          const endDate = new Date(startDate.getTime() + iteration.duration * 24 * 60 * 60 * 1000);
          iterationMetrics.set(iterationId, {
            iterationId,
            title: iteration.title,
            startDate: iteration.startDate,
            endDate: endDate.toISOString(),
            totalItems: 0,
            completedItems: 0,
            storyPoints: 0, // Note: Story points are not yet supported in this implementation
            completedStoryPoints: 0,
            throughput: 0,
          });
        }

        const metrics = iterationMetrics.get(iterationId)!;
        metrics.totalItems++;

        if (statusFieldValue && 'name' in statusFieldValue && statusFieldValue.name === doneStatusValue) {
          metrics.completedItems++;
        }
      }
    }

    // Calculate throughput
    iterationMetrics.forEach(metrics => {
      const durationInWeeks = differenceInMinutes(parseISO(metrics.endDate), parseISO(metrics.startDate)) / (60 * 24 * 7);
      if (durationInWeeks > 0) {
        metrics.throughput = metrics.completedItems / durationInWeeks;
      }
    });

    return Array.from(iterationMetrics.values());
  }
}

export default Analyzer;