---
name: Platform Role Permissions Refactor
overview: "Refactor platform roles to use explicit company permissions instead of the companyAccessLevel enum. Platform roles will have two permission arrays: `permissions` for platform-level actions and `companyPermissions` for what internal users can do when switched into any company."
todos: []
---

# Platform Role Permissions Refactor

## Current State

Platform roles use a `companyAccessLevel` enum to determine company access: