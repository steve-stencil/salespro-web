---
name: Price Guide Categories
overview: Implement a hierarchical category system for the price guide that allows nested folder-like navigation for home improvement categories (roofing, windows, bathrooms, etc.), with support for measure sheet items that belong to categories.
todos: []
---

# Price Guide Categories Implementation

## Overview

Build a hierarchical category system for the price guide where categories can be nested infinitely deep (like folders). Measure sheet items will belong to leaf categories.

## Data Model

```mermaid
erDiagram
    Company ||--o{ PriceGuideCategory : has
    PriceGuideCategory ||--o{ PriceGuideCategory : "parent-child"
    PriceGuideCategory ||--o{ MeasureSheetItem : contains
    Company ||--o{ MeasureSheetItem : has

    PriceGuideCategory {
        uuid id PK
        string name
        uuid parentId FK "nullable - null = root"
        uuid companyId FK
        int sortOrder
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    MeasureSheetItem {
        uuid id PK
        string name
        string description
        uuid categoryId FK
        uuid companyId FK
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

```
