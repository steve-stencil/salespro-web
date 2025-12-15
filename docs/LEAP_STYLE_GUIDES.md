# Leap Style Guides & Coding Standards

This document provides references to official Leap documentation in Confluence for style guidelines, coding standards, and best practices.

## How to Fetch Documentation

Use the Atlassian MCP tools to fetch the latest documentation:

```javascript
// Fetch a specific page
mcp_Atlassian_getConfluencePage({
  cloudId: 'b78be30c-0578-4bba-bd2e-e1d6e551437b',
  pageId: '<page_id>',
});

// Search for topics
mcp_Atlassian_search({
  query: 'React component patterns',
});
```

---

## UI/UX & Design Style Guides

### Style Guide & UX Best Practices

- **Page ID**: `74153985`
- **URL**: https://leap.atlassian.net/wiki/spaces/PROD/pages/74153985/Style+Guide+UX+Best+Practices
- **Use for**: UI patterns, UX best practices, component guidelines

### Design Tokens

- **Page ID**: `37486593`
- **URL**: https://leap.atlassian.net/wiki/spaces/PROD/pages/37486593/Design+Tokens
- **Use for**: Colors, fonts, spacing, elevation tokens

### Design System Progress

- **Page ID**: `127926274`
- **URL**: https://leap.atlassian.net/wiki/spaces/PROD/pages/127926274/Design+System+Progress
- **Use for**: Figma library reference, component status

### Common Terms & Brand Voice

- **Page ID**: `104693761`
- **URL**: https://leap.atlassian.net/wiki/spaces/PROD/pages/104693761/Common+Terms+Brand+Voice
- **Use for**: Terminology standards, brand voice guidelines

### Content & Brand Standards

- **Page ID**: `1466040322`
- **URL**: https://leap.atlassian.net/wiki/spaces/SKB/pages/1466040322/2025-07-21+Support+Marketing+Content+Brand+Standards
- **Use for**: Brand guidelines, fonts, colors, dos/don'ts

---

## Coding Standards

### Leap-360 Coding Standards (React/Frontend)

- **Page ID**: `789643406`
- **URL**: https://leap.atlassian.net/wiki/spaces/LDEV/pages/789643406/Leap-360+Coding+Standards
- **Use for**: React patterns, React-Query, folder structure, types, styles, hooks

### Bill's Default Global Rules

- **Page ID**: `1711669249`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/1711669249/Bill+s+Default+Global+Rules
- **Use for**: Universal engineering standards (PSR-12, Google JS, PEP8), code quality

### Mobile (Flutter) Guidelines

- **Page ID**: `786595879`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/786595879/Mobile+Flutter
- **Use for**: Flutter standards, UI Kit, theming, design system usage

### Secure Coding Policy

- **Page ID**: `953352238`
- **URL**: https://leap.atlassian.net/wiki/spaces/HO/pages/953352238/INFOSEC-9+Secure+Coding+Policy
- **Use for**: Security best practices, secure coding guidelines

### Code Repositories Guidelines

- **Page ID**: `622231576`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/622231576/Code+Repositories
- **Use for**: Repo structure, branch naming, documentation standards

---

## Testing Standards

### React Unit Test Best Practices

- **Page ID**: `476708898`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/476708898/React+Unit+Test+Cases+Best+Practices+and+Standards
- **Use for**: React testing patterns, Jest, React Testing Library

### Laravel Unit Test Best Practices

- **Page ID**: `412942348`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/412942348/Laravel+Unit+Test+Best+Practices+and+Standards
- **Use for**: PHP/Laravel testing patterns

### Bruno API Test Automation

- **Page ID**: `833257504`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/833257504/Bruno+API+Test+Automation+Guidelines
- **Use for**: API testing guidelines

---

## Infrastructure & DevOps

### LaunchDarkly Standards

- **Page ID**: `1128988690`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/1128988690/Launch+Darkly+Standards+and+Guidelines
- **Use for**: Feature flag naming, lifecycle management, targeting

### Terraform Usage & Standards

- **Page ID**: `1742929928`
- **URL**: https://leap.atlassian.net/wiki/spaces/LDEVOPS/pages/1742929928/Terraform+Usage+Standards
- **Use for**: Terraform standards, state management

### Enterprise Architecture Decision Process

- **Page ID**: `612991013`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/612991013/Enterprise+Architecture+Decision+Process+Standards
- **Use for**: Architecture diagrams, ADRs, notation standards

---

## Other Useful Guides

### Pendo Style Guide

- **Page ID**: `421855270`
- **URL**: https://leap.atlassian.net/wiki/spaces/SKB/pages/421855270/Pendo+Style+Guide
- **Use for**: In-app guidance styling

### WordPress KB Style Guide

- **Page ID**: `436142099`
- **URL**: https://leap.atlassian.net/wiki/spaces/SKB/pages/436142099/WordPress+KB+Style+Guide
- **Use for**: Knowledge base customization

### SalesPro iOS Release Playbook

- **Page ID**: `1122238470`
- **URL**: https://leap.atlassian.net/wiki/spaces/TECH/pages/1122238470/SalesPro+iOS+Release+Playbook
- **Use for**: iOS release process, App Store compliance

---

## Quick Reference Table

| Category | Page                            | Page ID      |
| -------- | ------------------------------- | ------------ |
| UI/UX    | Style Guide & UX Best Practices | `74153985`   |
| UI/UX    | Design Tokens                   | `37486593`   |
| UI/UX    | Common Terms & Brand Voice      | `104693761`  |
| Coding   | Leap-360 Coding Standards       | `789643406`  |
| Coding   | Bill's Default Global Rules     | `1711669249` |
| Coding   | Secure Coding Policy            | `953352238`  |
| Testing  | React Unit Test Best Practices  | `476708898`  |
| Testing  | Bruno API Test Automation       | `833257504`  |
| DevOps   | LaunchDarkly Standards          | `1128988690` |
| DevOps   | Terraform Usage & Standards     | `1742929928` |
