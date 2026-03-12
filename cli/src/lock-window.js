#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const LOCKS_PATH = join(ROOT, 'window-locks.json');

// --- Pure exported functions ---

/**
 * Lock a window for a specific owner.
 * Rejects if locked by a different owner. Allows same owner to re-lock (update).
 */
export function lockWindow(locks, windowName, { owner, branch, reason }) {
  const existing = locks[windowName];
  if (existing && existing.owner !== owner) {
    return {
      success: false,
      locks,
      error: `Window "${windowName}" is already locked by ${existing.owner} (branch: ${existing.branch}, since: ${existing.since})`,
    };
  }

  const updated = { ...locks };
  updated[windowName] = {
    owner,
    branch: branch || '',
    since: new Date().toISOString().slice(0, 10),
    reason: reason || '',
  };

  return { success: true, locks: updated };
}

/**
 * Unlock a window. Only the owner can unlock.
 * Succeeds silently if already unlocked.
 */
export function unlockWindow(locks, windowName, owner) {
  const existing = locks[windowName];
  if (!existing) {
    return { success: true, locks };
  }
  if (existing.owner !== owner) {
    return {
      success: false,
      locks,
      error: `Window "${windowName}" is locked by ${existing.owner}, not ${owner}`,
    };
  }

  const updated = { ...locks };
  delete updated[windowName];
  return { success: true, locks: updated };
}

/**
 * Returns sorted array of all current locks.
 */
export function getLockStatus(locks) {
  return Object.entries(locks)
    .map(([window, entry]) => ({
      window,
      owner: entry.owner,
      branch: entry.branch,
      since: entry.since,
      reason: entry.reason,
    }))
    .sort((a, b) => a.window.localeCompare(b.window));
}

/**
 * Validate that a specific owner holds the lock on a window.
 */
export function validateLock(locks, windowName, owner) {
  const existing = locks[windowName];
  if (!existing) {
    return { valid: false, error: `Window "${windowName}" is not locked` };
  }
  if (existing.owner !== owner) {
    return {
      valid: false,
      error: `Window "${windowName}" is locked by ${existing.owner}, not ${owner}`,
    };
  }
  return { valid: true };
}

// --- File I/O helpers (not exported) ---

async function loadLocks() {
  try {
    const raw = await readFile(LOCKS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveLocks(locks) {
  await writeFile(LOCKS_PATH, JSON.stringify(locks, null, 2) + '\n', 'utf-8');
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

  async function run() {
    switch (command) {
      case 'lock': {
        const window = getArg('window');
        const owner = getArg('owner');
        const branch = getArg('branch') || '';
        const reason = getArg('reason') || '';
        if (!window || !owner) {
          console.error('Usage: lock-window.js lock --window <name> --owner <name> [--branch <branch>] [--reason <reason>]');
          process.exit(1);
        }
        const locks = await loadLocks();
        const result = lockWindow(locks, window, { owner, branch, reason });
        if (result.success) {
          await saveLocks(result.locks);
          console.log(`Locked "${window}" for ${owner}`);
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
        const locks = await loadLocks();
        const result = unlockWindow(locks, window, owner);
        if (result.success) {
          await saveLocks(result.locks);
          console.log(`Unlocked "${window}"`);
        } else {
          console.error(result.error);
          process.exit(1);
        }
        break;
      }
      case 'status': {
        const locks = await loadLocks();
        const status = getLockStatus(locks);
        if (status.length === 0) {
          console.log('No windows are currently locked.');
        } else {
          console.log('Window Locks:');
          console.log('─'.repeat(80));
          for (const entry of status) {
            console.log(`  ${entry.window}`);
            console.log(`    Owner:  ${entry.owner}`);
            console.log(`    Branch: ${entry.branch}`);
            console.log(`    Since:  ${entry.since}`);
            console.log(`    Reason: ${entry.reason}`);
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
        const locks = await loadLocks();
        const result = validateLock(locks, window, owner);
        if (result.valid) {
          console.log(`Valid: ${owner} holds lock on "${window}"`);
        } else {
          console.error(result.error);
          process.exit(1);
        }
        break;
      }
      case 'help':
      default:
        console.log(`Usage: lock-window.js <command> [options]

Commands:
  lock    --window <name> --owner <name> [--branch <branch>] [--reason <reason>]
  unlock  --window <name> --owner <name>
  status  Show all current locks
  check   --window <name> --owner <name>  Validate lock (exit 1 if invalid)
  help    Show this help message`);
        break;
    }
  }

  run().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
