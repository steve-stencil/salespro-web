# Helper Scripts Documentation

This document describes the helper scripts available for AI agents and developers working with SalesPro Web.

## Overview

The project includes several helper scripts designed to:

- **Automate common development tasks**
- **Ensure quality standards are met**
- **Provide guidance for AI agents**
- **Streamline the development workflow**

## Available Scripts

### 1. AI Development Helper (`scripts/ai-dev-helper.sh`)

A comprehensive script for AI agents to perform common development tasks.

#### Usage

```bash
# Unix/Linux/macOS
./scripts/ai-dev-helper.sh <command> [options]

# Windows
scripts\ai-dev-helper.bat <command> [options]

# Via pnpm
pnpm ai:<command>
```

#### Commands

##### `new-feature <name>`

Creates a new feature branch for development.

```bash
# Create a new feature branch
./scripts/ai-dev-helper.sh new-feature user-authentication
pnpm ai:new-feature user-authentication
```

**What it does:**

- Creates a new feature branch with sanitized name
- Checks out the new branch
- Provides reminders about development best practices

##### `check-setup`

Verifies the project setup and dependencies.

```bash
# Check project setup
./scripts/ai-dev-helper.sh check-setup
pnpm ai:check-setup
```

**What it does:**

- Checks Node.js and pnpm versions
- Verifies .env files exist
- Installs dependencies if needed
- Reports setup status

##### `check-health`

Runs comprehensive health checks on the project.

```bash
# Run health checks
./scripts/ai-dev-helper.sh check-health
pnpm ai:check-health
```

**What it does:**

- Runs TypeScript type checking
- Runs ESLint linting
- Runs all tests
- Reports overall project health

##### `deploy-ready`

Prepares the project for deployment.

```bash
# Prepare for deployment
./scripts/ai-dev-helper.sh deploy-ready
pnpm ai:deploy-ready
```

**What it does:**

- Builds all packages
- Runs all tests
- Runs integration tests
- Checks linting
- Verifies type checking

##### `clean`

Cleans the project by removing build artifacts and caches.

```bash
# Clean project
./scripts/ai-dev-helper.sh clean
pnpm ai:clean
```

**What it does:**

- Removes node_modules
- Removes dist directories
- Removes coverage directories
- Cleans pnpm cache

##### `lint <files...>`

Runs linting checks on specific files.

```bash
# Lint specific files
./scripts/ai-dev-helper.sh lint apps/api/src/server.ts apps/web/src/App.tsx
```

### 2. Development Workflow (`scripts/dev-workflow.sh`)

A comprehensive workflow script for different development scenarios.

#### Usage

```bash
# Unix/Linux/macOS
./scripts/dev-workflow.sh <workflow>

# Via pnpm
pnpm workflow:<workflow>
```

#### Workflows

##### `ai-workflow`

Complete development workflow for AI agents.

```bash
# AI agent workflow
./scripts/dev-workflow.sh ai-workflow
pnpm workflow:ai
```

**What it does:**

1. **Requirements Understanding**: Guides through requirement analysis
2. **Setup and Preparation**: Ensures development environment is ready
3. **Development Process**: Provides development guidelines
4. **Quality Assurance**: Runs mandatory quality checks
5. **Final Verification**: Comprehensive verification process

##### `user-workflow`

Development workflow for human developers.

```bash
# User development workflow
./scripts/dev-workflow.sh user-workflow
pnpm workflow:user
```

**What it does:**

1. **Project Setup**: Sets up the development environment
2. **Development Environment**: Starts development servers
3. **Guidance**: Provides development guidance

##### `qa-workflow`

Quality assurance workflow for testing and validation.

```bash
# Quality assurance workflow
./scripts/dev-workflow.sh qa-workflow
pnpm workflow:qa
```

**What it does:**

1. **Linting Checks**: Runs comprehensive linting
2. **Type Checking**: Validates TypeScript types
3. **Testing**: Runs all tests
4. **Integration Testing**: Runs integration tests

##### `deploy-workflow`

Build and deployment workflow.

```bash
# Deploy workflow
./scripts/dev-workflow.sh deploy-workflow
pnpm workflow:deploy
```

**What it does:**

1. **Pre-deployment Checks**: Runs quality assurance
2. **Build Process**: Builds all packages
3. **Final Verification**: Verifies build artifacts

## Package.json Scripts

The project includes convenient npm scripts that wrap the helper scripts:

### AI Agent Scripts

```bash
# Create new feature branch
pnpm ai:new-feature <name>

# Check project setup
pnpm ai:check-setup

# Run health checks
pnpm ai:check-health

# Prepare for deployment
pnpm ai:deploy-ready

# Clean project
pnpm ai:clean
```

### Workflow Scripts

```bash
# AI agent workflow
pnpm workflow:ai

# User development workflow
pnpm workflow:user

# Quality assurance workflow
pnpm workflow:qa

# Deploy workflow
pnpm workflow:deploy
```

## Best Practices

### For AI Agents

1. **Always use the AI workflow**:

   ```bash
   pnpm workflow:ai
   ```

2. **Check health before starting**:

   ```bash
   pnpm ai:check-health
   ```

3. **Create feature branches**:

   ```bash
   pnpm ai:new-feature feature-name
   ```

4. **Verify quality before completion**:
   ```bash
   pnpm workflow:qa
   ```

### For Developers

1. **Start with user workflow**:

   ```bash
   pnpm workflow:user
   ```

2. **Use quality assurance**:

   ```bash
   pnpm workflow:qa
   ```

3. **Prepare for deployment**:
   ```bash
   pnpm workflow:deploy
   ```

## Error Handling

The scripts include comprehensive error handling:

- **Exit codes**: Scripts exit with appropriate codes
- **Error messages**: Clear error messages with suggestions
- **Validation**: Input validation and environment checks
- **Recovery**: Suggestions for fixing common issues

## Platform Support

### Unix/Linux/macOS

- Uses bash scripts with full feature support
- Colorized output for better readability
- Comprehensive error handling

### Windows

- Batch file versions available
- Basic feature support
- Compatible with Windows Command Prompt and PowerShell

## Integration with Quality Assurance

The helper scripts are designed to work with the project's quality assurance system:

- **Mandatory linting checks** before task completion
- **TypeScript strict mode** enforcement
- **Comprehensive testing** requirements
- **Documentation updates** when needed

## Troubleshooting

### Common Issues

1. **Permission denied**:

   ```bash
   chmod +x scripts/*.sh
   ```

2. **pnpm not found**:

   ```bash
   npm install -g pnpm
   ```

3. **Node.js version mismatch**:

   ```bash
   nvm use 20.11.0
   ```

4. **Script not found**:
   ```bash
   # Make sure you're in the project root
   ls -la scripts/
   ```

### Getting Help

```bash
# Show help for AI helper
./scripts/ai-dev-helper.sh help

# Show help for workflow
./scripts/dev-workflow.sh help
```

## Examples

### Complete AI Agent Workflow

```bash
# 1. Check project health
pnpm ai:check-health

# 2. Create new feature branch
pnpm ai:new-feature user-dashboard

# 3. Follow AI workflow
pnpm workflow:ai

# 4. Verify quality
pnpm workflow:qa

# 5. Prepare for deployment
pnpm workflow:deploy
```

### Complete User Development Workflow

```bash
# 1. Check setup
pnpm ai:check-setup

# 2. Start development
pnpm workflow:user

# 3. Run quality checks
pnpm workflow:qa

# 4. Deploy when ready
pnpm workflow:deploy
```

These helper scripts provide a comprehensive development environment that ensures quality, consistency, and efficiency for both AI agents and human developers.
