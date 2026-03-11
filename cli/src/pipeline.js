#!/usr/bin/env node

export function validatePipelineInput(input) {
  if (!input.windowId) return { valid: false, error: 'windowId is required' };
  if (!input.windowName) return { valid: false, error: 'windowName is required' };
  return { valid: true };
}

export function buildPipelineSteps() {
  return [
    { name: 'extract-fields', description: 'Extract field metadata from Etendo DB', phase: 'F1a' },
    { name: 'extract-rules', description: 'Extract business rules and callouts', phase: 'F1b' },
    { name: 'validate', description: 'Validate schema (4 levels) and processes', phase: 'F2' },
    { name: 'pre-classify', description: 'Pre-classify rules (deterministic + AI)', phase: 'F3' },
    { name: 'human-decisions', description: 'Open Decision Panel for human review', phase: 'F4', interactive: true },
    { name: 'generate-contract', description: 'Generate frontend/backend contracts + test manifest', phase: 'F6' },
    { name: 'push-to-neo', description: 'Configure NEO Headless via webhooks (from contract)', phase: 'F7' },
    { name: 'generate-frontend', description: 'Generate React components from contract', phase: 'F8' },
    { name: 'translate-todos', description: 'AI-assisted translation of callout/onchange TODO comments', phase: 'F8b', interactive: true },
    { name: 'run-tests', description: 'Run contract tests (Node.js side)', phase: 'F9' },
  ];
}

// CLI entry point
async function main() {
  const windowId = process.argv[2];
  const windowName = process.argv[3] || 'sales-order';

  const validation = validatePipelineInput({ windowId, windowName });
  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    console.error('Usage: sf-pipeline <windowId> [windowName]');
    process.exit(1);
  }

  const steps = buildPipelineSteps();
  console.log(`\n=== Schema Forge Pipeline: ${windowName} ===\n`);

  for (const step of steps) {
    if (step.interactive) {
      console.log(`\n[${step.phase}] ${step.description}`);
      if (step.name === 'translate-todos') {
        console.log('  → Review generated TODO comments in the frontend components');
        console.log('  → Use AI or manual translation to implement callout/onchange logic');
        console.log('  → Re-run pipeline with --skip-to=run-tests when done');
      } else {
        console.log('  → Open Decision Panel at http://localhost:3000');
        console.log('  → Save curated artifacts, then re-run pipeline with --skip-to=generate-contract');
        console.log('  → For AI classification, run: /sf:classify-rules');
      }
      break; // Stop at interactive step
    }

    console.log(`[${step.phase}] ${step.description}...`);

    try {
      // Dynamic import and execution of each phase
      switch (step.name) {
        case 'extract-fields': {
          const { main: extractFields } = await import('./extract-fields.js');
          await extractFields(windowId, windowName);
          break;
        }
        case 'extract-rules': {
          const { main: extractRules } = await import('./extract-rules.js');
          await extractRules(windowId, windowName);
          break;
        }
        case 'validate': {
          const { validateSchema } = await import('./validate-schema.js');
          const { readFile } = await import('node:fs/promises');
          const schema = JSON.parse(await readFile(`artifacts/${windowName}/schema-raw.json`, 'utf8'));
          const result = validateSchema(schema);
          if (result.errors.length > 0) {
            console.error('  ✗ Schema validation failed');
            result.errors.forEach(e => console.error(`    - ${e}`));
            process.exit(1);
          }
          console.log(`  ✓ Validation passed (${result.warnings.length} warnings)`);
          break;
        }
        case 'pre-classify': {
          const { classifyRules } = await import('./pre-classify.js');
          const { readFile } = await import('node:fs/promises');
          const rules = JSON.parse(await readFile(`artifacts/${windowName}/rules-raw.json`, 'utf8'));
          const classified = classifyRules(rules.rules || rules, { skipAi: true });
          console.log(`  ✓ ${classified.summary.autoClassified} auto, ${classified.summary.humanReview} human`);
          break;
        }
        case 'generate-contract': {
          const { generateContract } = await import('./generate-contract.js');
          const { readFile, writeFile } = await import('node:fs/promises');
          const schema = JSON.parse(await readFile(`artifacts/${windowName}/schema-curated.json`, 'utf8'));
          const rules = JSON.parse(await readFile(`artifacts/${windowName}/rules-curated.json`, 'utf8'));
          const processes = JSON.parse(await readFile(`artifacts/${windowName}/processes.json`, 'utf8'));
          const contract = generateContract(schema, rules.rules || [], processes.processes || []);
          await writeFile(`artifacts/${windowName}/contract.json`, JSON.stringify(contract, null, 2));
          console.log(`  ✓ Contract generated (${contract.testManifest.summary.total} tests)`);
          break;
        }
        case 'push-to-neo': {
          const { pushToNeo } = await import('./push-to-neo.js');
          const dryRun = process.argv.includes('--dry-run');
          const result = await pushToNeo(windowName, { dryRun });
          if (dryRun) {
            console.log(`  ✓ Dry run: ${result.actions.length} webhook calls planned`);
          } else {
            console.log(`  ✓ NEO Headless configured (${result.fieldsConfigured} fields)`);
          }
          break;
        }
        case 'generate-frontend': {
          const { generateAll } = await import('./generate-frontend.js');
          const { preserveAndRegenerate } = await import('./preserve-custom-sections.js');
          const { readFile, writeFile, mkdir } = await import('node:fs/promises');
          const { resolve: resolvePath } = await import('node:path');
          const contract = JSON.parse(await readFile(`artifacts/${windowName}/contract.json`, 'utf8'));
          const files = generateAll(contract);
          const outDir = `artifacts/${windowName}/generated/web/${windowName}`;
          await mkdir(outDir, { recursive: true });

          let totalPreserved = 0;
          let totalUnmatched = 0;

          for (const [filename, code] of Object.entries(files)) {
            const filePath = resolvePath(outDir, filename);
            const { content, preserved, unmatched } = preserveAndRegenerate(filePath, code);
            await writeFile(filePath, content, 'utf8');
            totalPreserved += preserved.length;
            totalUnmatched += unmatched.length;

            // Save .old backup only when there are unmatched sections
            if (unmatched.length > 0) {
              const existing = await readFile(filePath, 'utf8').catch(() => null);
              if (existing) {
                await writeFile(`${filePath}.old`, existing, 'utf8');
              }
            }
          }

          let summary = `  ✓ ${Object.keys(files).length} frontend components generated`;
          if (totalPreserved > 0 || totalUnmatched > 0) {
            summary += ` (preserved ${totalPreserved} custom sections`;
            if (totalUnmatched > 0) {
              summary += `, ${totalUnmatched} unmatched (saved to .old)`;
            }
            summary += ')';
          }
          console.log(summary);
          break;
        }
        case 'run-tests': {
          const { runContractTests } = await import('./run-contract-tests.js');
          const { readFile } = await import('node:fs/promises');
          const contract = JSON.parse(await readFile(`artifacts/${windowName}/contract.json`, 'utf8'));
          const result = runContractTests(contract);
          console.log(`  ✓ ${result.passed}/${result.total} passed, ${result.skipped} skipped`);
          if (result.failed > 0) {
            console.error(`  ✗ ${result.failed} tests failed`);
            result.results.filter(r => !r.passed).forEach(r => console.error(`    - ${r.description}: ${r.reason}`));
          }
          break;
        }
      }
    } catch (err) {
      console.error(`  ✗ ${step.name} failed: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n=== Pipeline complete ===\n');
}

// Only run main if executed directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('pipeline.js') ||
  process.argv[1].endsWith('sf-pipeline')
);
if (isMainModule) {
  main().catch(err => { console.error(err); process.exit(1); });
}
