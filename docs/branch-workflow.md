# Branch & Worktree Workflow

Rules for branch management, worktree isolation, and merging in the Schema Forge pipeline.

## Worktree Isolation (MANDATORY)

Every task runs in an isolated git worktree. No exceptions.
The worktree branch is created FROM the current branch, and PRs target that same branch.

```bash
CURRENT_BRANCH=$(git branch --show-current)
git worktree add .worktrees/feat-<task-name> -b feat/<task-name>
```

All agents work ONLY in that worktree — never in the main repo.
The coordinator creates the worktree and passes the path to each agent.

**Worktree branches are LOCAL ONLY.** They are never pushed to remote.

### After All Phases Approve (Local Merge)

1. Coordinator switches to the parent branch: `git checkout feature/ETP-XXXX`
2. Merge the worktree branch: `git merge feat/<task-name>` (preserves full commit history)
3. Clean up: `git worktree remove .worktrees/feat-<task-name> && git branch -d feat/<task-name>`

On rejection: DEV fixes in the SAME worktree, cycle restarts from the rejecting phase.

## Parallelization

- Independent tasks → parallel worktrees
- Within a task → sequential pipeline

## PR Rules (feature → develop)

**The only GitHub PR is feature → develop**, created when the feature is complete. The user controls when to push and create this PR.

- **NEVER target `main` directly.** The highest allowed target is `develop`.
- **Always assign the PR to the current user.**
- **GitHub usernames must be stored in auto-memory** (not committed). On first interaction, look up the current user's GitHub username and any known reviewers, and save them to auto-memory for future use. **CRITICAL:** Before ANY GitHub operation, read the `github-usernames.md` file from the auto-memory directory (`~/.claude/projects/.../memory/github-usernames.md` — use the absolute path, NEVER a path relative to the project root). NEVER assume, hardcode, or guess a username — if no username is stored, ask the user and save it immediately.

## New Feature Branch Policy (MANDATORY)

When the user requests a new task while on a feature branch, the coordinator MUST ask:
1. **What is the new task?**
2. **Does it depend on changes in the current feature branch?**

Based on the answer:
- **Independent task →** Create new branch from `develop` (with `git pull` first to update)
- **Dependent task →** Create new branch from the current feature branch

## Branch Safety (MANDATORY)

When Schema Forge is on a feature branch (e.g., `feature/ETP-3505`), the target module repository (e.g., `com.etendoerp.go`) **MUST** be on the same branch. This prevents accidental commits to `main` or `develop` in the module. Always verify both repos are on matching branches before generating or committing code.
