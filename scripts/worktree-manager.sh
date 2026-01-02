#!/bin/bash
# worktree-manager.sh
# Comprehensive worktree management for multi-agent development
# 
# Usage:
#   ./scripts/worktree-manager.sh list          - List all worktrees with status
#   ./scripts/worktree-manager.sh switch <name> - Switch to worktree (open in Cursor)
#   ./scripts/worktree-manager.sh sync          - Sync all env files to worktrees
#   ./scripts/worktree-manager.sh setup <name>  - Full setup of a worktree (env + deps)
#   ./scripts/worktree-manager.sh status        - Show status of all worktrees
#   ./scripts/worktree-manager.sh ports         - Show what's running on dev ports

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Get the directory where this script lives (main project)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_PROJECT="$(dirname "$SCRIPT_DIR")"

# Cursor worktrees location
WORKTREES_DIR="$HOME/.cursor/worktrees"
REPO_NAME=$(basename "$MAIN_PROJECT")

# Define which files to sync (relative to project root)
ENV_FILES=(
    "apps/api/.env"
    "apps/web/.env"
)

# Additional files that might need syncing (like .npmrc)
EXTRA_FILES=(
    ".npmrc"
)

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_section() {
    echo -e "\n${CYAN}── $1 ──${NC}\n"
}

# Get list of all worktree paths
get_worktree_paths() {
    git -C "$MAIN_PROJECT" worktree list --porcelain | grep "^worktree " | cut -d' ' -f2-
}

# Check if a worktree has .env files (either real or symlinked)
check_env_status() {
    local worktree_path="$1"
    local has_api_env=false
    local has_web_env=false
    
    if [ -f "$worktree_path/apps/api/.env" ] || [ -L "$worktree_path/apps/api/.env" ]; then
        has_api_env=true
    fi
    
    if [ -f "$worktree_path/apps/web/.env" ] || [ -L "$worktree_path/apps/web/.env" ]; then
        has_web_env=true
    fi
    
    if $has_api_env && $has_web_env; then
        echo "✅"
    elif $has_api_env || $has_web_env; then
        echo "⚠️ "
    else
        echo "❌"
    fi
}

# Check if node_modules exist
check_deps_status() {
    local worktree_path="$1"
    
    if [ -d "$worktree_path/node_modules" ]; then
        echo "✅"
    else
        echo "❌"
    fi
}

# ============================================================================
# List Command - Show all worktrees
# ============================================================================

cmd_list() {
    print_header "Git Worktrees for $REPO_NAME"
    
    echo -e "${BOLD}Main Project:${NC}"
    echo -e "  📁 $MAIN_PROJECT"
    echo ""
    
    echo -e "${BOLD}Available Worktrees:${NC}"
    echo ""
    
    # Parse git worktree list output
    local worktrees=$(git -C "$MAIN_PROJECT" worktree list)
    
    while IFS= read -r line; do
        local path=$(echo "$line" | awk '{print $1}')
        local commit=$(echo "$line" | awk '{print $2}')
        local branch=$(echo "$line" | awk '{print $3}' | tr -d '[]')
        
        if [ "$path" = "$MAIN_PROJECT" ]; then
            echo -e "  ${GREEN}● MAIN${NC} ($branch)"
            echo -e "    Path: $path"
        else
            local name=$(basename "$path")
            local env_status=$(check_env_status "$path")
            local deps_status=$(check_deps_status "$path")
            
            echo -e "  ${YELLOW}○ $name${NC}"
            echo -e "    Branch: $branch"
            echo -e "    Path: $path"
            echo -e "    Env: $env_status  Deps: $deps_status"
        fi
        echo ""
    done <<< "$worktrees"
    
    echo -e "${CYAN}Tip: Use 'worktree-manager.sh switch <name>' to open in Cursor${NC}"
}

# ============================================================================
# Status Command - Detailed status of all worktrees
# ============================================================================

cmd_status() {
    print_header "Worktree Status Overview"
    
    printf "%-12s %-30s %-6s %-6s %-20s\n" "NAME" "BRANCH" "ENV" "DEPS" "LAST MODIFIED"
    printf "%-12s %-30s %-6s %-6s %-20s\n" "────" "──────" "───" "────" "─────────────"
    
    local worktrees=$(git -C "$MAIN_PROJECT" worktree list)
    
    while IFS= read -r line; do
        local path=$(echo "$line" | awk '{print $1}')
        local branch=$(echo "$line" | awk '{print $3}' | tr -d '[]')
        
        local name
        if [ "$path" = "$MAIN_PROJECT" ]; then
            name="MAIN"
        else
            name=$(basename "$path")
        fi
        
        local env_status=$(check_env_status "$path")
        local deps_status=$(check_deps_status "$path")
        
        # Get last modified time of the worktree
        local last_mod=""
        if [ -d "$path/.git" ] || [ -f "$path/.git" ]; then
            last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$path" 2>/dev/null || echo "unknown")
        fi
        
        printf "%-12s %-30s %-6s %-6s %-20s\n" "$name" "${branch:0:28}" "$env_status" "$deps_status" "$last_mod"
    done <<< "$worktrees"
}

# ============================================================================
# Sync Command - Sync env files to all worktrees
# ============================================================================

cmd_sync() {
    print_header "Syncing Environment Files"
    
    echo -e "📁 Main project: $MAIN_PROJECT"
    echo -e "📁 Worktrees dir: $WORKTREES_DIR/$REPO_NAME"
    echo ""
    
    # Check if worktrees directory exists
    if [ ! -d "$WORKTREES_DIR/$REPO_NAME" ]; then
        echo -e "${YELLOW}No Cursor worktrees found for $REPO_NAME${NC}"
        echo -e "Looking for git worktrees..."
    fi
    
    # Get all worktrees
    local worktrees=$(git -C "$MAIN_PROJECT" worktree list --porcelain | grep "^worktree " | cut -d' ' -f2-)
    
    while IFS= read -r worktree_path; do
        # Skip main project
        if [ "$worktree_path" = "$MAIN_PROJECT" ]; then
            continue
        fi
        
        if [ -d "$worktree_path" ]; then
            local worktree_name=$(basename "$worktree_path")
            echo -e "🔗 Processing worktree: ${BOLD}$worktree_name${NC}"
            
            # Sync .env files
            for env_file in "${ENV_FILES[@]}"; do
                local source_file="$MAIN_PROJECT/$env_file"
                local target_file="$worktree_path/$env_file"
                
                # Ensure target directory exists
                local target_dir=$(dirname "$target_file")
                if [ -d "$target_dir" ]; then
                    create_symlink "$source_file" "$target_file"
                else
                    echo -e "  ${YELLOW}⚠ Dir not found: $target_dir${NC}"
                fi
            done
            
            # Sync extra files (like .npmrc)
            for extra_file in "${EXTRA_FILES[@]}"; do
                local source_file="$MAIN_PROJECT/$extra_file"
                local target_file="$worktree_path/$extra_file"
                
                if [ -f "$source_file" ]; then
                    create_symlink "$source_file" "$target_file"
                fi
            done
            
            # Also check for global .npmrc and link if project doesn't have one
            if [ ! -f "$worktree_path/.npmrc" ] && [ -f "$HOME/.npmrc" ]; then
                echo -e "  ${CYAN}ℹ Using global ~/.npmrc${NC}"
            fi
            
            echo ""
        fi
    done <<< "$worktrees"
    
    echo -e "${GREEN}✅ Done! All worktrees synced.${NC}"
}

# Function to create symlink (used by sync command)
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

# ============================================================================
# Switch Command - Open worktree in Cursor
# ============================================================================

cmd_switch() {
    local target_name="$1"
    
    if [ -z "$target_name" ]; then
        echo -e "${RED}Error: Please provide a worktree name${NC}"
        echo ""
        echo "Usage: worktree-manager.sh switch <name>"
        echo ""
        echo "Available worktrees:"
        cmd_list
        exit 1
    fi
    
    print_header "Switching to Worktree: $target_name"
    
    # Find the worktree path
    local target_path=""
    
    if [ "$target_name" = "main" ] || [ "$target_name" = "MAIN" ]; then
        target_path="$MAIN_PROJECT"
    else
        # Look in Cursor worktrees
        if [ -d "$WORKTREES_DIR/$REPO_NAME/$target_name" ]; then
            target_path="$WORKTREES_DIR/$REPO_NAME/$target_name"
        else
            # Try to find it via git worktree list
            target_path=$(git -C "$MAIN_PROJECT" worktree list --porcelain | grep "^worktree .*/$target_name\$" | cut -d' ' -f2- || true)
        fi
    fi
    
    if [ -z "$target_path" ] || [ ! -d "$target_path" ]; then
        echo -e "${RED}Error: Worktree '$target_name' not found${NC}"
        echo ""
        echo "Available worktrees:"
        git -C "$MAIN_PROJECT" worktree list
        exit 1
    fi
    
    echo -e "📂 Opening: $target_path"
    
    # Check env status before opening
    local env_status=$(check_env_status "$target_path")
    if [ "$env_status" != "✅" ]; then
        echo -e "${YELLOW}⚠ Environment files may not be set up. Running sync...${NC}"
        
        # Quick sync for this specific worktree
        for env_file in "${ENV_FILES[@]}"; do
            local source_file="$MAIN_PROJECT/$env_file"
            local target_file="$target_path/$env_file"
            local target_dir=$(dirname "$target_file")
            
            if [ -d "$target_dir" ] && [ -f "$source_file" ]; then
                if [ ! -f "$target_file" ] && [ ! -L "$target_file" ]; then
                    ln -s "$source_file" "$target_file"
                    echo -e "  ${GREEN}✓ Linked: $env_file${NC}"
                fi
            fi
        done
    fi
    
    # Check deps status
    local deps_status=$(check_deps_status "$target_path")
    if [ "$deps_status" != "✅" ]; then
        echo -e "${YELLOW}⚠ Dependencies not installed. Run 'pnpm install' after opening.${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Opening in Cursor...${NC}"
    
    # Open in Cursor (new window)
    cursor "$target_path"
    
    echo ""
    echo -e "${GREEN}✅ Worktree opened in new Cursor window${NC}"
    echo ""
    echo -e "${BOLD}Quick Start:${NC}"
    echo -e "  1. Wait for Cursor to open"
    echo -e "  2. Open terminal in Cursor (Ctrl+\`)"
    echo -e "  3. Run: ${CYAN}pnpm install${NC} (if deps not installed)"
    echo -e "  4. Run: ${CYAN}pnpm dev${NC}"
}

# ============================================================================
# Setup Command - Full setup of a worktree
# ============================================================================

cmd_setup() {
    local target_name="$1"
    
    if [ -z "$target_name" ]; then
        echo -e "${RED}Error: Please provide a worktree name${NC}"
        echo "Usage: worktree-manager.sh setup <name>"
        exit 1
    fi
    
    print_header "Setting Up Worktree: $target_name"
    
    # Find the worktree path
    local target_path=""
    
    if [ "$target_name" = "main" ] || [ "$target_name" = "MAIN" ]; then
        target_path="$MAIN_PROJECT"
    elif [ -d "$WORKTREES_DIR/$REPO_NAME/$target_name" ]; then
        target_path="$WORKTREES_DIR/$REPO_NAME/$target_name"
    else
        target_path=$(git -C "$MAIN_PROJECT" worktree list --porcelain | grep "^worktree .*/$target_name\$" | cut -d' ' -f2- || true)
    fi
    
    if [ -z "$target_path" ] || [ ! -d "$target_path" ]; then
        echo -e "${RED}Error: Worktree '$target_name' not found${NC}"
        exit 1
    fi
    
    echo -e "📂 Target: $target_path"
    echo ""
    
    # Step 1: Sync env files
    print_section "Step 1: Syncing Environment Files"
    
    for env_file in "${ENV_FILES[@]}"; do
        local source_file="$MAIN_PROJECT/$env_file"
        local target_file="$target_path/$env_file"
        local target_dir=$(dirname "$target_file")
        
        if [ -d "$target_dir" ]; then
            create_symlink "$source_file" "$target_file"
        fi
    done
    
    for extra_file in "${EXTRA_FILES[@]}"; do
        local source_file="$MAIN_PROJECT/$extra_file"
        local target_file="$target_path/$extra_file"
        
        if [ -f "$source_file" ]; then
            create_symlink "$source_file" "$target_file"
        fi
    done
    
    # Step 2: Install dependencies
    print_section "Step 2: Installing Dependencies"
    
    cd "$target_path"
    echo -e "Running: ${CYAN}pnpm install${NC}"
    pnpm install
    
    echo ""
    echo -e "${GREEN}✅ Worktree '$target_name' is fully set up!${NC}"
    echo ""
    echo -e "${BOLD}Next steps:${NC}"
    echo -e "  • Run: ${CYAN}./scripts/worktree-manager.sh switch $target_name${NC}"
    echo -e "  • Or:  ${CYAN}cursor $target_path${NC}"
}

# ============================================================================
# Ports Command - Show what's running on dev ports
# ============================================================================

cmd_ports() {
    print_header "Development Ports Status"
    
    echo -e "${BOLD}Checking common development ports...${NC}"
    echo ""
    
    local ports=(3000 3001 5173 5174 4000 4001 8080 8081)
    
    printf "%-8s %-10s %-40s\n" "PORT" "STATUS" "PROCESS"
    printf "%-8s %-10s %-40s\n" "────" "──────" "───────"
    
    for port in "${ports[@]}"; do
        local pid=$(lsof -ti ":$port" 2>/dev/null | head -1)
        
        if [ -n "$pid" ]; then
            local process=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            printf "%-8s ${GREEN}%-10s${NC} %-40s\n" "$port" "IN USE" "$process (PID: $pid)"
        else
            printf "%-8s ${YELLOW}%-10s${NC} %-40s\n" "$port" "FREE" "-"
        fi
    done
    
    echo ""
    echo -e "${CYAN}Tip: Kill a process with: kill <PID>${NC}"
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        list|ls)
            cmd_list
            ;;
        status|st)
            cmd_status
            ;;
        sync)
            cmd_sync
            ;;
        switch|sw)
            cmd_switch "$@"
            ;;
        setup)
            cmd_setup "$@"
            ;;
        ports)
            cmd_ports
            ;;
        help|--help|-h)
            print_header "Worktree Manager - Help"
            echo "Usage: worktree-manager.sh <command> [options]"
            echo ""
            echo "Commands:"
            echo "  list, ls        List all worktrees with their status"
            echo "  status, st      Show detailed status table of all worktrees"
            echo "  sync            Sync .env files to all worktrees (via symlinks)"
            echo "  switch, sw      Switch to a worktree (opens in Cursor)"
            echo "  setup           Full setup: sync env + install deps"
            echo "  ports           Show what's running on development ports"
            echo "  help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  worktree-manager.sh list"
            echo "  worktree-manager.sh switch syt"
            echo "  worktree-manager.sh setup lyb"
            echo "  worktree-manager.sh sync"
            echo ""
            echo "Workflow Tips:"
            echo "  1. Each worktree should be opened in a SEPARATE Cursor window"
            echo "  2. Use 'switch' to open a worktree - it auto-syncs env files"
            echo "  3. Run 'pnpm dev' in each worktree's terminal independently"
            echo "  4. Use different ports for different worktrees if running simultaneously"
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            echo "Run 'worktree-manager.sh help' for usage"
            exit 1
            ;;
    esac
}

main "$@"

