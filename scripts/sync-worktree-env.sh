#!/bin/bash
# sync-worktree-env.sh
# Syncs .env files from main project to all Cursor worktrees via symlinks

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script lives (main project)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_PROJECT="$(dirname "$SCRIPT_DIR")"

# Cursor worktrees location
WORKTREES_DIR="$HOME/.cursor/worktrees"
REPO_NAME=$(basename "$MAIN_PROJECT")

echo "📁 Main project: $MAIN_PROJECT"
echo "📁 Worktrees dir: $WORKTREES_DIR/$REPO_NAME"
echo ""

# Check if worktrees directory exists
if [ ! -d "$WORKTREES_DIR/$REPO_NAME" ]; then
    echo -e "${YELLOW}No worktrees found for $REPO_NAME${NC}"
    exit 0
fi

# Define which .env files to sync (relative to project root)
ENV_FILES=(
    "apps/api/.env"
    "apps/web/.env"
)

# Function to create symlink
create_symlink() {
    local source="$1"
    local target="$2"
    
    # Check if source exists
    if [ ! -f "$source" ]; then
        echo -e "  ${YELLOW}⚠ Source not found: $source${NC}"
        return
    fi
    
    # If target exists and is a symlink, remove it
    if [ -L "$target" ]; then
        rm "$target"
    # If target exists and is a regular file, back it up
    elif [ -f "$target" ]; then
        echo -e "  ${YELLOW}  Backing up existing: $target → $target.backup${NC}"
        mv "$target" "$target.backup"
    fi
    
    # Create the symlink
    ln -s "$source" "$target"
    echo -e "  ${GREEN}✓ Linked: $(basename "$target")${NC}"
}

# Iterate through all worktrees
for worktree_path in "$WORKTREES_DIR/$REPO_NAME"/*/; do
    if [ -d "$worktree_path" ]; then
        worktree_name=$(basename "$worktree_path")
        echo "🔗 Processing worktree: $worktree_name"
        
        for env_file in "${ENV_FILES[@]}"; do
            source_file="$MAIN_PROJECT/$env_file"
            target_file="$worktree_path$env_file"
            
            # Ensure target directory exists
            target_dir=$(dirname "$target_file")
            if [ -d "$target_dir" ]; then
                create_symlink "$source_file" "$target_file"
            else
                echo -e "  ${YELLOW}⚠ Dir not found: $target_dir${NC}"
            fi
        done
        echo ""
    fi
done

echo -e "${GREEN}✅ Done! All worktrees synced.${NC}"

