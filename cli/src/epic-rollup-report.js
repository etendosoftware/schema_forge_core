#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { isMainModule } from './utils.js';

export const EPIC_ROLLUP_MARKER = '<!-- epic-rollup-report -->';
export const EPIC_ROLLUP_ENTRY_MARKER = '<!-- epic-rollup-entry -->';
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

function normalizeRollupEntry(source) {
  const mergedSource = source.pullRequest ? { ...source.pullRequest, ...source } : source;
  return {
    number: mergedSource.number,
    title: mergedSource.title,
    url: mergedSource.url,
    author: mergedSource.author || 'unknown',
    mergedAt: mergedSource.mergedAt || null,
    summaryBullets: mergedSource.summaryBullets || extractSummaryBullets(mergedSource.body || ''),
    reviewReport: mergedSource.reviewReport || parseReviewReport(mergedSource.reviewReportBody || ''),
  };
}

export function renderEpicRollupEntry(source) {
  const entry = normalizeRollupEntry(source);
  return [
    EPIC_ROLLUP_ENTRY_MARKER,
    '## Epic rollout entry',
    '',
    `Feature PR: [#${entry.number} ${entry.title}](${entry.url})`,
    `Merged into epic: ${formatDate(entry.mergedAt)}`,
    '',
    '```json',
    JSON.stringify(entry, null, 2),
    '```',
  ].join('\n');
}

export function parseRollupEntry(body) {
  if (!body?.includes(EPIC_ROLLUP_ENTRY_MARKER)) {
    return null;
  }

  const match = body.match(/```json\n([\s\S]*?)\n```/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]);
    return normalizeRollupEntry(parsed);
  } catch {
    return null;
  }
}

function normalizeReportPullRequest(pullRequest) {
  const parsedEntry = parseRollupEntry(pullRequest.rollupEntryBody || '');
  if (parsedEntry) {
    return parsedEntry;
  }

  return normalizeRollupEntry(pullRequest);
}

export function renderEpicRollupReport({ epicPullRequest, includedPullRequests }) {
  const normalizedPullRequests = [...includedPullRequests]
    .map((pullRequest) => normalizeReportPullRequest(pullRequest))
    .sort((left, right) => left.number - right.number);

  const blockerCount = normalizedPullRequests.filter((pullRequest) => pullRequest.reviewReport.blockers.length).length;
  const warningCount = normalizedPullRequests.filter((pullRequest) => pullRequest.reviewReport.warnings.length).length;

  const reportSections = normalizedPullRequests.map((pullRequest) => [
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
    `- Included PRs (${normalizedPullRequests.length})`,
    `- PRs with blocking findings: ${blockerCount}`,
    `- PRs with warnings: ${warningCount}`,
    '',
    '## Included PRs',
    '',
    ...reportSections,
  ].join('\n');
}

const isCli = isMainModule(import.meta.url);

if (isCli) {
  const args = process.argv.slice(2);
  const mode = getArg(args, 'mode') || 'report';
  const inputPath = getArg(args, 'input');
  const outputPath = getArg(args, 'out');

  if (!inputPath || !outputPath) {
    console.error('Usage: node cli/src/epic-rollup-report.js --mode <entry|report> --input <path> --out <path>');
    process.exit(1);
  }

  const input = readJson(inputPath);
  const output = mode === 'entry'
    ? renderEpicRollupEntry(input)
    : renderEpicRollupReport({
      epicPullRequest: input.epicPullRequest,
      includedPullRequests: input.includedPullRequests || [],
    });

  writeFileSync(outputPath, output);
}
