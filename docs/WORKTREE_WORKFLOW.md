# Git Worktree Workflow for Multi-Agent Development

This guide explains how to efficiently work with multiple Git worktrees when running AI agents on different tasks simultaneously.

## Quick Reference

```bash
# List all worktrees
pnpm worktree:list

# Switch to a worktree (opens in new Cursor window)
./scripts/worktree-manager.sh switch <name>

# Sync env files to all worktrees
pnpm worktree:sync

# Check what's running on dev ports
pnpm worktree:ports

# Full setup (sync + install deps)
./scripts/worktree-manager.sh setup <name>
```

## Understanding Git Worktrees

Git worktrees allow you to have multiple branches checked out simultaneously in different directories. Cursor creates worktrees in `~/.cursor/worktrees/<repo-name>/` when you use features like Background Agents.

**Key locations:**

- **Main project:** `/Users/<you>/Desktop/Coding/salespro-web`
- **Cursor worktrees:** `~/.cursor/worktrees/salespro-web/<worktree-name>/`

## The Problem

Worktrees share Git history but NOT:

- `.env` files (gitignored)
- `.npmrc` (gitignored or global)
- `node_modules/` (not committed)

This means a fresh worktree won't have your environment variables or dependencies!

## The Solution: Worktree Manager

We have a script that solves this by creating symlinks from your main project's `.env` files to each worktree.

### Step-by-Step Workflow

#### 1. Check Your Worktrees

```bash
# See all worktrees and their status
pnpm worktree:list

# Or for a table view
pnpm worktree:status
```

This shows:

- Worktree name and branch
- Whether `.env` files are set up (✅ or ❌)
- Whether dependencies are installed (✅ or ❌)

#### 2. Switch to a Worktree

**Best Practice: Open each worktree in its own Cursor window.**

```bash
# This opens the worktree in a NEW Cursor window
./scripts/worktree-manager.sh switch syt
```

What this does:

1. Finds the worktree path
2. Auto-syncs `.env` files if missing
3. Opens in a new Cursor window
4. Tells you if you need to run `pnpm install`

#### 3. Set Up a New Worktree

If you have a fresh worktree that needs full setup:

```bash
./scripts/worktree-manager.sh setup <worktree-name>
```

This:

1. Creates symlinks for all `.env` files
2. Runs `pnpm install`
3. Gets it ready to run

#### 4. Sync Environment Files

If you update your `.env` files in the main project, sync them:

```bash
pnpm worktree:sync
```

Since we use symlinks, you typically don't need to re-sync - changes in the main project's `.env` are automatically reflected!

## Running Multiple Worktrees Simultaneously

### Option A: Same Ports (Switch Between)

1. Stop servers in one worktree before starting in another
2. Use `pnpm worktree:ports` to see what's running

```bash
# Check what's using ports
pnpm worktree:ports

# Kill a process if needed
kill <PID>
```

### Option B: Different Ports (Run in Parallel)

Modify `.env` files to use different ports per worktree:

**Main project:**

```env
# apps/api/.env
PORT=3001
# apps/web/.env (vite uses 5173 by default)
VITE_API_URL=http://localhost:3001
```

**For parallel worktree, create worktree-specific .env:**

```bash
# In the worktree (NOT the main project)
# Remove the symlink and create a custom .env
rm apps/api/.env
cp /path/to/main/apps/api/.env apps/api/.env
# Edit to use different port
```

Then modify ports:

```env
# apps/api/.env
PORT=3002
# apps/web/.env
VITE_API_URL=http://localhost:3002
```

## Best Practices

### 1. One Cursor Window Per Worktree

Each worktree should have its own Cursor window. This keeps:

- File explorers separate
- Terminals scoped to that worktree
- AI context focused on that task

### 2. Keep Env Symlinked

The symlink approach means:

- Update `.env` once in main project
- All worktrees automatically get the update
- No copy/paste errors

### 3. Check Status Before Starting

```bash
pnpm worktree:status
```

This quick check shows if any worktree is missing setup.

### 4. Name Your Worktrees Meaningfully

Cursor often uses short random names like `syt` or `lyb`. You can mentally map these to tasks:

- `syt` → multi-company-user-access feature
- `lyb` → price-guide work

## Command Reference

| Command                                       | Description                      |
| --------------------------------------------- | -------------------------------- |
| `pnpm worktree:list`                          | List all worktrees with status   |
| `pnpm worktree:status`                        | Table view of worktree status    |
| `pnpm worktree:sync`                          | Sync .env files to all worktrees |
| `pnpm worktree:ports`                         | Show what's running on dev ports |
| `./scripts/worktree-manager.sh switch <name>` | Open worktree in Cursor          |
| `./scripts/worktree-manager.sh setup <name>`  | Full setup (env + deps)          |

## Troubleshooting

### "No .env file" Errors

```bash
# Sync env files
pnpm worktree:sync

# Or for one worktree
./scripts/worktree-manager.sh setup <name>
```

### "Cannot find module" Errors

Dependencies not installed:

```bash
# In the worktree directory
pnpm install
```

### Port Already in Use

```bash
# See what's using ports
pnpm worktree:ports

# Kill the process
kill <PID>

# Or find and kill by port
lsof -ti :3001 | xargs kill -9
```

### .npmrc Issues

If you have a private npm registry (like FontAwesome):

1. **Global .npmrc** (`~/.npmrc`) - Works automatically
2. **Project .npmrc** - Will be symlinked by the sync command

Check if the worktree can access your registry:

```bash
# In the worktree
pnpm config list
```

## Architecture

```
~/.cursor/worktrees/salespro-web/
├── syt/                          # Worktree 1
│   ├── apps/
│   │   ├── api/
│   │   │   └── .env -> /main/.env  # Symlink!
│   │   └── web/
│   │       └── .env -> /main/.env  # Symlink!
│   └── node_modules/             # Independent
│
├── lyb/                          # Worktree 2
│   ├── apps/
│   │   ├── api/
│   │   │   └── .env -> /main/.env  # Same symlink
│   │   └── web/
│   │       └── .env -> /main/.env
│   └── node_modules/             # Independent
│
/Users/you/Desktop/Coding/salespro-web/  # Main project
├── apps/
│   ├── api/.env                  # Source of truth
│   └── web/.env                  # Source of truth
└── scripts/worktree-manager.sh
```

## Tips for AI Agent Workflows

1. **Start agents in separate worktrees** - Each agent gets its own branch and files
2. **Check agent progress** - Switch to their worktree window to see what they're doing
3. **Test agent changes** - Start the dev server in that worktree to see the UI
4. **Review before merging** - Each worktree has its own git state
