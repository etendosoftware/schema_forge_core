#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Window locking via GitHub Issues.
 *
 * Title format: "🔒 LOCK: {windowName} #"
 * The trailing " #" prevents partial matches (e.g. "invoice" vs "purchase-invoice").
 * All locks use the "window-lock" label.
 */

const LABEL = 'window-lock';

function lockTitle(windowName) {
  return `🔒 LOCK: ${windowName} #`;
}

function gh(args) {
  return execSync(`gh ${args}`, { encoding: 'utf-8', timeout: 15000 }).trim();
}

// --- Core functions ---

/**
 * Find an open lock issue for a window.
 * Returns { number, owner } or null.
 */
export function findLock(windowName) {
  const title = lockTitle(windowName);
  let issues;
  try {
    const raw = gh(`issue list --label "${LABEL}" --state open --json number,title,assignees --limit 100`);
    issues = JSON.parse(raw);
  } catch {
    return null;
  }
  const match = issues.find(i => i.title === title);
  if (!match) return null;
  const owner = match.assignees?.[0]?.login || 'unknown';
  return { number: match.number, owner };
}

/**
 * Lock a window by creating a GitHub issue.
 * Rejects if already locked by a different owner.
 */
export function lockWindow(windowName, { owner, reason }) {
  const existing = findLock(windowName);
  if (existing) {
    if (existing.owner === owner) {
      return { success: true, issueNumber: existing.number, message: `Already locked by you (#${existing.number})` };
    }
    return {
      success: false,
      error: `Window "${windowName}" is already locked by @${existing.owner} (issue #${existing.number})`,
    };
  }

  const title = lockTitle(windowName);
  const body = reason || `Locking window "${windowName}" for classification.`;

  // Ensure label exists (idempotent)
  try {
    gh(`label create "${LABEL}" --description "Window lock for Schema Forge classification" --color "d93f0b" --force`);
  } catch {
    // Label may already exist, that's fine
  }

  const result = gh(`issue create --title "${title}" --body "${body}" --label "${LABEL}" --assignee "${owner}"`);
  // gh issue create prints the URL, extract issue number
  const issueMatch = result.match(/\/issues\/(\d+)/);
  const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : null;

  return { success: true, issueNumber, message: `Locked "${windowName}" → issue #${issueNumber}` };
}

/**
 * Unlock a window by closing its GitHub issue.
 * Only the owner (assignee) can unlock.
 */
export function unlockWindow(windowName, owner) {
  const existing = findLock(windowName);
  if (!existing) {
    return { success: true, message: `"${windowName}" was not locked` };
  }
  if (existing.owner !== owner) {
    return {
      success: false,
      error: `Window "${windowName}" is locked by @${existing.owner}, not @${owner} (issue #${existing.number})`,
    };
  }

  gh(`issue close ${existing.number} --comment "Unlocked by @${owner}"`);
  return { success: true, message: `Unlocked "${windowName}" (closed #${existing.number})` };
}

/**
 * List all current window locks.
 */
export function getLockStatus() {
  let issues;
  try {
    const raw = gh(`issue list --label "${LABEL}" --state open --json number,title,assignees,createdAt --limit 100`);
    issues = JSON.parse(raw);
  } catch {
    return [];
  }

  return issues
    .filter(i => i.title.startsWith('🔒 LOCK: ') && i.title.endsWith(' #'))
    .map(i => ({
      window: i.title.slice('🔒 LOCK: '.length, -2), // strip prefix and " #"
      owner: i.assignees?.[0]?.login || 'unknown',
      issue: i.number,
      since: i.createdAt?.slice(0, 10) || 'unknown',
    }))
    .sort((a, b) => a.window.localeCompare(b.window));
}

/**
 * Validate that a specific owner holds the lock on a window.
 */
export function validateLock(windowName, owner) {
  const existing = findLock(windowName);
  if (!existing) {
    return { valid: false, error: `Window "${windowName}" is not locked` };
  }
  if (existing.owner !== owner) {
    return {
      valid: false,
      error: `Window "${windowName}" is locked by @${existing.owner}, not @${owner} (issue #${existing.number})`,
    };
  }
  return { valid: true, issueNumber: existing.number };
}

// --- CLI entry point ---

const isCLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isCLI) {
  const args = process.argv.slice(2);
  const command = args[0];

  function getArg(name) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  switch (command) {
    case 'lock': {
      const window = getArg('window');
      const owner = getArg('owner');
      const reason = getArg('reason') || '';
      if (!window || !owner) {
        console.error('Usage: lock-window.js lock --window <name> --owner <name> [--reason <reason>]');
        process.exit(1);
      }
      const result = lockWindow(window, { owner, reason });
      if (result.success) {
        console.log(result.message);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      break;
    }
    case 'unlock': {
      const window = getArg('window');
      const owner = getArg('owner');
      if (!window || !owner) {
        console.error('Usage: lock-window.js unlock --window <name> --owner <name>');
        process.exit(1);
      }
      const result = unlockWindow(window, owner);
      if (result.success) {
        console.log(result.message);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      break;
    }
    case 'status': {
      const status = getLockStatus();
      if (status.length === 0) {
        console.log('No windows are currently locked.');
      } else {
        console.log('Window Locks:');
        console.log('─'.repeat(60));
        for (const entry of status) {
          console.log(`  ${entry.window}`);
          console.log(`    Owner:  @${entry.owner}`);
          console.log(`    Issue:  #${entry.issue}`);
          console.log(`    Since:  ${entry.since}`);
          console.log('');
        }
      }
      break;
    }
    case 'check': {
      const window = getArg('window');
      const owner = getArg('owner');
      if (!window || !owner) {
        console.error('Usage: lock-window.js check --window <name> --owner <name>');
        process.exit(1);
      }
      const result = validateLock(window, owner);
      if (result.valid) {
        console.log(`Valid: @${owner} holds lock on "${window}" (issue #${result.issueNumber})`);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      break;
    }
    case 'list': {
      // Alias for status — list all active locks in compact format
      const locks = getLockStatus();
      if (locks.length === 0) {
        console.log('No windows are currently locked.');
      } else {
        console.log(`${locks.length} active lock(s):\n`);
        for (const entry of locks) {
          console.log(`  ${entry.window.padEnd(30)} @${entry.owner.padEnd(20)} #${entry.issue}  (${entry.since})`);
        }
      }
      break;
    }
    case 'free': {
      // Show which windows from the menu cache are NOT locked
      const locks = getLockStatus();
      const lockedNames = new Set(locks.map(l => l.window));
      let cacheEntries;
      try {
        const { loadCache } = await import('./menu-cache.js');
        const cache = await loadCache();
        if (!cache) {
          console.error('No menu cache found. Run: node cli/src/menu-cache.js refresh');
          process.exit(1);
        }
        cacheEntries = cache.entries;
      } catch (err) {
        console.error(`Failed to load menu cache: ${err.message}`);
        process.exit(1);
      }

      const typeFilter = getArg('type');
      let candidates = cacheEntries.filter(e => e.type !== 'folder' && e.type !== 'other');
      if (typeFilter) {
        candidates = candidates.filter(e => e.type === typeFilter);
      }

      const free = candidates.filter(e => {
        // Check both the raw name and kebab-case version
        const kebab = e.name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        return !lockedNames.has(e.name) && !lockedNames.has(kebab);
      });

      console.log(`${free.length} free entries${typeFilter ? ` (${typeFilter})` : ''} (${locks.length} locked):\n`);
      const typeLabel = { window: 'W', process: 'P', report: 'R', form: 'F' };
      for (const entry of free.slice(0, 50)) {
        console.log(`  [${typeLabel[entry.type] || '?'}] ${entry.name.padEnd(45)} ${entry.id}`);
      }
      if (free.length > 50) {
        console.log(`  ... and ${free.length - 50} more. Use --type to filter.`);
      }
      break;
    }
    case 'help':
    default:
      console.log(`Usage: lock-window.js <command> [options]

Commands:
  lock    --window <name> --owner <ghUser> [--reason <reason>]
  unlock  --window <name> --owner <ghUser>
  status  Show all current locks (detailed)
  list    Show all current locks (compact)
  check   --window <name> --owner <ghUser>  Validate lock (exit 1 if invalid)
  free    [--type window|process|report]    Show unlocked entries from menu cache
  help    Show this help message

Locks are GitHub Issues with label "${LABEL}" and title "🔒 LOCK: <window> #".
Owner is the GitHub username (issue assignee).`);
      break;
  }
}
