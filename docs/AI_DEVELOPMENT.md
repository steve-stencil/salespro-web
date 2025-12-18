# AI-Assisted Development Guide

This guide provides comprehensive instructions for AI agents working with SalesPro Web, especially when assisting users with little to no coding knowledge to build real applications.

## Project Overview

This is a **production-ready web application monorepo** designed for AI-assisted development:

- **Backend**: Express.js API with PostgreSQL (MikroORM)
- **Frontend**: React 19 with Vite
- **Shared**: TypeScript types and Zod schemas
- **Testing**: Vitest with 80% coverage requirement
- **TypeScript**: Strict mode with `any` type forbidden

## Getting Started with User Requirements

### When a User Provides a PRD or Requirements Document

1. **Read and analyze** the requirements thoroughly
2. **Ask clarifying questions** about:
   - User authentication requirements
   - Database schema needs
   - API endpoint specifications
   - UI/UX requirements
   - Business logic complexity
3. **Create an implementation plan** with phases
4. **Get user approval** before starting development
5. **Implement incrementally** with user feedback

### When a User Describes Their Application Idea

1. **Understand the business domain**:
   - What problem does it solve?
   - Who are the users?
   - What are the key features?
2. **Ask about technical requirements**:
   - User authentication needed?
   - Real-time features required?
   - Mobile responsiveness?
   - Integration with external services?
3. **Create a feature breakdown**:
   - Core features (MVP)
   - Nice-to-have features
   - Future enhancements
4. **Estimate complexity** and suggest implementation approach

### When a User Has Existing Code/Designs

1. **Analyze existing assets**:
   - Database schemas
   - API specifications
   - UI mockups/wireframes
   - Business logic documentation
2. **Identify integration points**:
   - How to adapt existing schemas
   - API compatibility requirements
   - UI component mapping
3. **Create migration plan** if needed

### Handling Business Requirements

#### Domain Modeling

1. **Identify core entities**:
   - What are the main business objects?
   - What properties do they have?
   - How do they relate to each other?
2. **Define business rules**:
   - What constraints exist?
   - What validations are needed?
   - What business logic applies?
3. **Plan data flow**:
   - How does data move through the system?
   - What transformations are needed?
   - What external integrations required?

#### Feature Prioritization

1. **MVP (Minimum Viable Product)**:
   - Core functionality that solves the main problem
   - Essential user flows
   - Basic data management
2. **Phase 2 features**:
   - Enhanced user experience
   - Additional functionality
   - Performance improvements
3. **Future enhancements**:
   - Advanced features
   - Integrations
   - Scalability improvements

#### Technical Architecture Planning

1. **Database design**:
   - Entity relationships
   - Indexing strategy
   - Data validation rules
2. **API design**:
   - RESTful endpoints
   - Request/response schemas
   - Authentication requirements
3. **Frontend architecture**:
   - Component structure
   - State management
   - User experience flow

## AI Agent Guidelines

### When a User Makes a Request

1. **Always ask clarifying questions** for ambiguous requests
2. **Check existing patterns** in the codebase before implementing
3. **Follow the established rules** in `.cursor/rules/`
4. **Write tests** for all new functionality
5. **Update documentation** when adding features
6. **Use TypeScript strict mode** - no `any` types allowed

### Common User Requests and How to Handle Them

#### "I want to build a [type of application]"

1. **Understand the domain**:
   - What business problem does it solve?
   - Who are the target users?
   - What are the core features?
2. **Ask about technical requirements**:
   - User authentication needed?
   - Real-time features?
   - Mobile responsiveness?
   - Third-party integrations?
3. **Create a feature roadmap**:
   - MVP features (must-have)
   - Phase 2 features (should-have)
   - Future features (could-have)
4. **Start with database design**:
   - Identify core entities
   - Define relationships
   - Plan API endpoints
5. **Build incrementally** with user feedback

#### "Add a new feature to my app"

1. **Understand the feature**:
   - What does it do?
   - Who uses it?
   - How does it fit with existing features?
2. **Plan the implementation**:
   - Database changes needed?
   - New API endpoints?
   - Frontend components?
   - User flow changes?
3. **Implement step by step**:
   - Database models first
   - API endpoints
   - Frontend components
   - Integration and testing

#### "Add user authentication"

1. **Determine requirements**:
   - What type of auth? (JWT, sessions, OAuth?)
   - Which endpoints need protection?
   - Frontend login/logout flow?
   - User roles and permissions?
2. **Create implementation plan**:
   - User model and schema
   - Authentication middleware
   - Login/logout endpoints
   - Frontend auth components
   - Protected route handling
3. **Implement incrementally**:
   - Start with basic JWT auth
   - Add user registration
   - Implement protected routes
   - Add role-based access control

#### "Add a new API endpoint"

1. **Understand the requirement**:
   - What data does it handle?
   - What operations (CRUD)?
   - Authentication required?
   - Validation rules?
2. **Check existing patterns** in `apps/api/src/routes/`
3. **Create route handler** with Zod validation
4. **Add MikroORM entity** if needed
5. **Add shared types** if the endpoint needs new request/response types:
   - Add types to `packages/shared/src/types/`
   - Run `pnpm --filter @shared/core build`
6. **Write integration tests**
7. **Update API documentation**

#### "Add shared types"

When creating types that need to be used by both API and web:

1. **Add types** to `packages/shared/src/types/` (in the appropriate domain file)
2. **Export from index** in `packages/shared/src/types/index.ts` if new file
3. **Build the package**: `pnpm --filter @shared/core build`
4. **Import in apps**:
   ```typescript
   import type { MyNewType } from '@shared/core';
   ```

**Type categories:**

- `auth.ts` - Authentication types (login, session, MFA)
- `users.ts` - User, role, office types
- `invites.ts` - User invitation types
- `company.ts` - Company settings types
- `api/pagination.ts` - Pagination types
- `errors.ts` - Error codes and helpers

#### "Add a new page/component"

1. **Understand the UI requirement**:
   - What should it display?
   - What user interactions?
   - Mobile responsive?
   - Accessibility requirements?
2. **Check existing patterns** in `apps/web/src/`
3. **Create React component** with TypeScript
4. **Add routing** if needed
5. **Write component tests**
6. **Ensure accessibility compliance**

#### "Fix a bug"

1. Ask user to describe the issue in detail
2. Check logs and error messages
3. Identify the root cause
4. Write a test that reproduces the bug
5. Fix the issue
6. Verify the fix works

#### "Change the UI"

1. Ask for specific details:
   - Which component/page?
   - What should it look like?
   - Any reference designs?
2. Check existing styling patterns
3. Implement changes with proper accessibility
4. Test on different screen sizes

### Development Workflow

#### Before Making Changes

1. **Understand the request**: Ask clarifying questions
2. **Check existing code**: Look for similar patterns
3. **Plan the implementation**: Break down into steps
4. **Get user approval**: Confirm the plan before starting

#### During Implementation

1. **Follow the rules**: Check `.cursor/rules/` for guidance
2. **Write tests first**: TDD approach for new features
3. **Use TypeScript strictly**: No `any` types
4. **Follow naming conventions**: Check existing patterns
5. **Update documentation**: README.md and relevant docs

#### After Implementation

1. **Run tests**: `pnpm test` to ensure everything works
2. **Check linting**: `pnpm lint` for code quality
3. **Type check**: `pnpm typecheck` for TypeScript errors
4. **Verify functionality**: Test the feature works as expected
5. **Update docs**: Document any new setup or usage

### Error Handling Patterns

#### When You Encounter Errors

1. **Check the logs**: Use structured logging to identify issues
2. **Validate inputs**: Ensure all inputs match Zod schemas
3. **Check database connection**: Verify PostgreSQL connectivity
4. **Review environment variables**: Ensure all required vars are set
5. **Run tests**: Use `pnpm test` to identify failing tests

#### Common Error Patterns

- **Validation errors** → Check Zod schemas in shared package
- **Database errors** → Check PostgreSQL connection and MikroORM entities
- **Type errors** → Ensure strict TypeScript compliance
- **Test failures** → Check test setup and mocks
- **Build errors** → Check TypeScript configuration and imports

### Testing Requirements

#### Mandatory Testing

- **All new code must include tests**
- **80% coverage minimum** for branches, functions, lines, and statements
- **Unit tests** for individual functions and components
- **Integration tests** for API endpoints and component interactions
- **Error scenarios** must be tested, not just happy paths

#### Test Structure

```
src/
├── __tests__/
│   ├── setup.ts          # Test configuration and mocks
│   ├── lib/              # Unit tests for utilities
│   ├── components/       # Component tests
│   └── integration/      # Integration tests
```

#### Test Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run integration tests
pnpm test:integration
```

### Code Quality Standards

#### TypeScript Requirements

- **Strict mode**: All TypeScript code must use strict mode
- **No `any` type**: The `any` type is forbidden throughout the codebase
- **Type safety**: All functions and variables must be properly typed
- **JSDoc comments**: All exported functions and types must have JSDoc documentation

#### Code Organization

- **Functional approach**: Prefer functional, small modules over large classes
- **Single responsibility**: Each module should have a single, clear purpose
- **File naming**: Use kebab-case for files, PascalCase for components
- **Import organization**: Use consistent import ordering (external, internal, relative)

#### File Size Limits

- **Functions**: Should not exceed 50 lines
- **Files**: Should not exceed 300 lines
- **Components**: Keep focused and extract when needed

### Documentation Requirements

#### When Adding Features

- **Update README.md** if setup or usage changes
- **Document API endpoints** with request/response examples
- **Document environment variables** with defaults
- **Update architecture docs** if structure changes

#### When Fixing Bugs

- **Document the root cause** in commit messages
- **Add tests** to prevent regression
- **Update troubleshooting docs** if it's a common issue

### Security Considerations

#### Always Validate

- **Input validation**: Use Zod schemas for all inputs
- **Environment variables**: Validate with Zod schemas
- **Database queries**: Use MikroORM's parameterized queries
- **Error messages**: Never expose sensitive information

#### Security Checklist

- [ ] Input validation with Zod
- [ ] Proper error handling
- [ ] Environment variable validation
- [ ] No sensitive data in logs
- [ ] Proper CORS configuration
- [ ] Security headers with Helmet

### Performance Considerations

#### API Performance

- **Database indexing** for frequently queried fields
- **Connection pooling** for PostgreSQL
- **Response compression** with Express
- **Caching** for expensive operations

#### Frontend Performance

- **Code splitting** with dynamic imports
- **Lazy loading** for routes and components
- **Memoization** with React.memo and useMemo
- **Bundle optimization** with Vite

### Troubleshooting Guide

#### Common Issues

1. **TypeScript errors**: Check strict mode compliance
2. **Test failures**: Verify test setup and mocks
3. **Build errors**: Check imports and dependencies
4. **Database connection**: Verify PostgreSQL connection (DATABASE_URL)
5. **Environment variables**: Ensure all required vars are set

#### Debugging Steps

1. **Check logs**: Use structured logging to identify issues
2. **Run tests**: Use `pnpm test` to identify failing tests
3. **Type check**: Use `pnpm typecheck` for TypeScript errors
4. **Lint check**: Use `pnpm lint` for code quality issues
5. **Build check**: Use `pnpm build` to verify build process

### Best Practices for AI Agents

#### Communication

- **Ask clarifying questions** for ambiguous requests
- **Explain your approach** before implementing
- **Provide progress updates** during implementation
- **Ask for confirmation** before making major changes

#### Implementation

- **Follow existing patterns** in the codebase
- **Write tests first** for new features
- **Use TypeScript strictly** throughout
- **Update documentation** when making changes
- **Verify functionality** after implementation

#### Quality Assurance

- **Run all tests** before considering work complete
- **Check linting and type checking**
- **Verify the feature works as expected**
- **Ensure no regressions** in existing functionality

## Quick Reference

### Essential Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm build                  # Build all packages
pnpm test                   # Run all tests
pnpm lint                   # Lint all code
pnpm typecheck             # Type check all code

# Individual services
pnpm --filter api dev      # API only
pnpm --filter web dev      # Web only
```

### Key Directories

- `apps/api/src/` - API server code
- `apps/web/src/` - React frontend code
- `packages/shared/src/` - Shared types and utilities
- `docs/` - Project documentation
- `.cursor/rules/` - AI agent rules

### Important Files

- `README.md` - Main project documentation
- `docs/ARCHITECTURE.md` - System architecture
- `docs/DEVELOPMENT.md` - Development patterns
- `.cursor/rules/*` - AI agent guidance rules

This guide ensures AI agents can effectively assist users of any technical level while maintaining code quality and project standards.
