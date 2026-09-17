#!/usr/bin/env node
/**
 * Generates api/reports static manifest for production.
 * Output: tools/app-shell/dist/api/reports (no extension, served as application/json via S3 metadata)
 *
 * This file is created as part of `make build` so that `aws s3 sync dist/` always
 * includes it — preventing the manifest from being deleted by automated deployments.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The descriptor shape lives in ONE place — see report-descriptor.js for why
// (this script used to keep its own copy and silently dropped `sections`).
import { listReportDescriptors } from './report-descriptor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');
const ARTIFACTS_DIR = join(ROOT, 'artifacts');
const OUT_DIR = join(ROOT, 'tools/app-shell/dist/api');
const OUT_FILE = join(OUT_DIR, 'reports');

const reports = listReportDescriptors(ARTIFACTS_DIR);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(reports) + '\n');
console.log(`reports manifest: ${reports.length} reports → dist/api/reports`);
