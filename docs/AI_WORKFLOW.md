# AI Agent Workflow

This document defines the mandatory workflow for AI agents working on SalesPro Web to ensure consistent quality and prevent errors.

## Mandatory Workflow Steps

### 1. Before Starting Any Task

- [ ] Read and understand the requirements
- [ ] Check existing code patterns in the project
- [ ] Plan the implementation approach
- [ ] Identify all files that will be created or modified

### 2. During Implementation

- [ ] Follow existing code patterns and conventions
- [ ] Use TypeScript strict mode (no `any` types)
- [ ] Write comprehensive error handling
- [ ] Add proper JSDoc comments for exported functions
- [ ] Follow the established file structure

### 3. Before Task Completion (MANDATORY)

- [ ] **Run linting checks** on ALL modified files
- [ ] **Fix ALL linting errors** immediately
- [ ] **Re-check linting** until no errors remain
- [ ] **Verify TypeScript compilation** works
- [ ] **Test the functionality** if applicable
- [ ] **Update documentation** if needed

## Quality Assurance Checklist

### Linting Requirements

```bash
# MANDATORY: Check all modified files
read_lints --paths [file1, file2, file3, ...]

# If errors found, fix them and re-check
# Repeat until NO errors remain
```

### Common Linting Issues to Fix

1. **TypeScript strict mode violations**
2. **Import/export type issues**
3. **Code style violations**
4. **Type compatibility issues**
5. **Unused variables or imports**

### Quality Gates

**Task completion is ONLY allowed when**:

- ✅ All linting errors are fixed
- ✅ All TypeScript errors are resolved
- ✅ All ESLint warnings are addressed
- ✅ Code follows project style guidelines
- ✅ No `any` types are used
- ✅ All imports are properly typed

## Error Prevention Strategies

### 1. Systematic Approach

- **Plan first**: Understand requirements before coding
- **Check patterns**: Look at existing code for guidance
- **Incremental changes**: Make small, testable changes
- **Verify each step**: Check linting after each significant change

### 2. Quality Checks

- **Linting**: Run `read_lints` on all modified files
- **Type checking**: Ensure TypeScript compilation works
- **Style**: Follow project formatting rules
- **Documentation**: Update docs when needed

### 3. Common Mistakes to Avoid

- **Skipping linting checks** (NEVER do this)
- **Using `any` types** (forbidden in this project)
- **Ignoring TypeScript errors** (fix them immediately)
- **Inconsistent formatting** (follow project style)
- **Missing error handling** (always implement proper error handling)

## Workflow Examples

### Example 1: Adding a New API Endpoint

1. **Plan**: Understand the endpoint requirements
2. **Create**: Add route handler with proper validation
3. **Test**: Write tests for the endpoint
4. **Check**: Run linting on all modified files
5. **Fix**: Resolve any linting errors
6. **Verify**: Re-check linting until clean
7. **Complete**: Only then mark task as done

### Example 2: Creating a React Component

1. **Plan**: Understand component requirements
2. **Create**: Build component with TypeScript
3. **Style**: Follow project styling conventions
4. **Test**: Add component tests
5. **Check**: Run linting on component file
6. **Fix**: Resolve any linting errors
7. **Verify**: Re-check linting until clean
8. **Complete**: Only then mark task as done

## Enforcement Rules

### Non-Negotiable Requirements

- **Linting checks are MANDATORY** - no exceptions
- **All errors must be fixed** before task completion
- **Quality over speed** - take time to fix properly
- **No shortcuts** - follow the complete workflow

### Consequences of Skipping

- **Technical debt** accumulates
- **Build process** breaks
- **Code quality** suffers
- **Maintenance** becomes harder
- **Runtime errors** may occur

## Tools and Commands

### Essential Commands

```bash
# Check linting for specific files
read_lints --paths [file1, file2, ...]

# Check all files in a directory
read_lints --paths [directory]

# Check specific file types
read_lints --paths [**/*.ts, **/*.tsx]
```

### Quality Verification

```bash
# TypeScript compilation
pnpm typecheck

# ESLint checking
pnpm lint

# Full test suite
pnpm test
```

## Remember

**Quality is not negotiable. Every line of code must meet the project's standards before task completion.**

**The workflow is designed to prevent errors and ensure consistent quality. Follow it religiously.**
