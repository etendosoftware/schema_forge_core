#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EPIC_ROLLUP_MARKER = '<!-- epic-rollup-report -->';
const REVIEW_MARKER = '<!-- copilot-pr-review -->';

function getArg(args, name) {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function collectBulletItems(sectionText) {
  return sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function getMarkdownSection(body, heading) {
  const lines = body.split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  if (startIndex === -1) {
    return '';
  }

  const headingLevel = heading.match(/^#+/)?.[0].length || 1;
  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const lineHeadingLevel = trimmed.match(/^#+/)?.[0].length || 0;
    if (lineHeadingLevel > 0 && lineHeadingLevel <= headingLevel) {
      break;
    }
    sectionLines.push(line);
  }

  return sectionLines.join('\n').trim();
}

export function extractSummaryBullets(body) {
  const summarySection = getMarkdownSection(body || '', '## Summary');
  return collectBulletItems(summarySection);
}

function extractFindingTitles(sectionText) {
  return sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- **'))
    .map((line) => line.match(/^- \*\*(.+?)\*\*/)?.[1] || '')
    .filter(Boolean);
}

export function parseReviewReport(body) {
  if (!body?.includes(REVIEW_MARKER)) {
    return {
      outcome: 'Not found',
      blockers: [],
      warnings: [],
    };
  }

  const outcomeMatch = body.match(/Outcome:\s+\*\*(.+?)\*\*/);
  const blockers = extractFindingTitles(getMarkdownSection(body, '### Blocking findings'));
  const warnings = extractFindingTitles(getMarkdownSection(body, '### Warnings'));

  return {
    outcome: outcomeMatch?.[1] || 'Unknown',
    blockers,
    warnings,
  };
}

function formatDate(isoValue) {
  if (!isoValue) return 'unknown';
  return isoValue.slice(0, 10);
}

function renderSummaryBullets(summaryBullets, title) {
  if (summaryBullets.length) {
    return summaryBullets.map((item) => `  - ${item}`).join('\n');
  }

  return `  - No explicit PR summary found in the PR body for \`${title}\`.`;
}

function renderReviewFindings(reviewReport) {
  const sections = [`  - Review outcome: **${reviewReport.outcome}**`];

  if (reviewReport.blockers.length) {
    sections.push('  - Blocking findings:');
    sections.push(...reviewReport.blockers.map((item) => `    - ${item}`));
  }

  if (reviewReport.warnings.length) {
    sections.push('  - Warnings:');
    sections.push(...reviewReport.warnings.map((item) => `    - ${item}`));
  }

  if (!reviewReport.blockers.length && !reviewReport.warnings.length) {
    sections.push('  - No blocking or warning findings were recorded.');
  }

  return sections.join('\n');
}

export function renderEpicRollupReport({ epicPullRequest, includedPullRequests }) {
  const sortedPullRequests = [...includedPullRequests].sort((left, right) => left.number - right.number);
  const blockerCount = sortedPullRequests.filter((pullRequest) => pullRequest.reviewReport.blockers.length).length;
  const warningCount = sortedPullRequests.filter((pullRequest) => pullRequest.reviewReport.warnings.length).length;

  const reportSections = sortedPullRequests.map((pullRequest) => [
    `### PR #${pullRequest.number}: [${pullRequest.title}](${pullRequest.url})`,
    `- Author: @${pullRequest.author}`,
    `- Merged into epic: ${formatDate(pullRequest.mergedAt)}`,
    '- Included changes:',
    renderSummaryBullets(pullRequest.summaryBullets, pullRequest.title),
    '- Review findings:',
    renderReviewFindings(pullRequest.reviewReport),
  ].join('\n'));

  return [
    EPIC_ROLLUP_MARKER,
    '# Epic rollout report',
    '',
    `Target PR: [#${epicPullRequest.number} ${epicPullRequest.title}](${epicPullRequest.url})`,
    `Flow: \`${epicPullRequest.headRefName}\` → \`${epicPullRequest.baseRefName}\``,
    '',
    '## Overview',
    '',
    `- Included PRs (${sortedPullRequests.length})`,
    `- PRs with blocking findings: ${blockerCount}`,
    `- PRs with warnings: ${warningCount}`,
    '',
    '## Included PRs',
    '',
    ...reportSections,
  ].join('\n');
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isCli) {
  const args = process.argv.slice(2);
  const inputPath = getArg(args, 'input');
  const outputPath = getArg(args, 'out');

  if (!inputPath || !outputPath) {
    console.error('Usage: node cli/src/epic-rollup-report.js --input <path> --out <path>');
    process.exit(1);
  }

  const input = readJson(inputPath);
  const normalizedInput = {
    epicPullRequest: input.epicPullRequest,
    includedPullRequests: (input.includedPullRequests || []).map((pullRequest) => ({
      ...pullRequest,
      summaryBullets: pullRequest.summaryBullets || extractSummaryBullets(pullRequest.body || ''),
      reviewReport: pullRequest.reviewReport || parseReviewReport(pullRequest.reviewReportBody || ''),
    })),
  };

  writeFileSync(outputPath, renderEpicRollupReport(normalizedInput));
}
