---
name: brainstorm
description: |
  Maps all integration points for a feature or system across the codebase. Produces a structured markdown doc organized by direct impacts, indirect impacts, UI touchpoints, and test implications — with code snippets showing current integration sites. Use when planning a new feature, assessing impact of changes, or exploring how a system connects to the rest of the codebase.

  Triggers: "brainstorm [feature]", "map integrations for [system]", "what touches [feature]", "integration points for [system]", or when the user asks about how a system connects to others.
user-invocable: true
---

# Brainstorm: Integration Point Mapper

Maps how a feature or system integrates across the codebase. Produces a structured reference doc for planning, impact assessment, or pre-spec exploration.

**Input**: A feature/system name (e.g., "investigation", "ghost customers", "institution corruption"), optionally with a focus area.

---

## Workflow

### 1. Parse the Target

Extract the feature/system name from the user's prompt. If ambiguous, ask one clarifying question.

### 2. Find All Touchpoints

Launch 2-3 explore-researcher agents (haiku) in parallel to search the codebase:

**Agent A — Type & Service Layer**:
```
Search for all type definitions, service functions, and constants related to "{feature}".
Use Grep to find:
- Type/interface definitions mentioning {feature}
- Service functions that read/write {feature} data
- Constants and config related to {feature}
- Import statements pulling {feature} types/functions

Read the key files found. For each integration point, capture:
- File path and line number
- Function/type name
- What it does with {feature} data (reads, writes, derives, validates)
- A 2-5 line code snippet showing the integration

Start the file with YAML frontmatter:
---
title: {Feature} Integration Map — Types & Services
tags: [brainstorm, {feature}, types, services]
createdDate: {today YYYY-MM-DD}
lastUpdated: {today YYYY-MM-DD}
domain: {appropriate domain}
status: draft
lastVerified: {today YYYY-MM-DD}
---

Write to: docs/explore/brainstorm-{feature}-types-services.md
```

**Agent B — Store & Tick Layer**:
```
Search for all store actions, weekly tick hooks, and state management related to "{feature}".
Use Grep to find:
- Store actions that modify {feature} state
- Weekly tick entries that process {feature}
- Load/save/reset handlers for {feature} data
- Selectors or derived state from {feature}

Read the key files found. For each integration point, capture:
- File path and line number
- Action/function name
- Direction of data flow (into store, out of store, both)
- A 2-5 line code snippet

Start the file with YAML frontmatter (same schema as Agent A, title: "... — Store & Tick").

Write to: docs/explore/brainstorm-{feature}-store-tick.md
```

**Agent C — UI & Consumer Layer**:
```
Search for all React components, hooks, and UI code that displays or interacts with "{feature}".
Use Grep to find:
- Components that render {feature} data
- Hooks or selectors that subscribe to {feature} state
- User actions (buttons, forms, modals) that trigger {feature} operations
- Navigation paths to reach {feature} UI

Read the key files found. For each integration point, capture:
- File path and line number
- Component/hook name
- What the user sees/does
- A 2-5 line code snippet

Start the file with YAML frontmatter (same schema as Agent A, title: "... — UI").

Write to: docs/explore/brainstorm-{feature}-ui.md
```

### 3. Synthesize

After agents complete, read their output files and write the final integration map:

**Output file**: `docs/brainstorms/{feature}-integrations.md`

Structure:

```markdown
# {Feature} Integration Map

> Generated: {date}

## Summary
1-2 sentence overview of how {feature} connects to the codebase.

## Direct Impacts
Systems that directly read/write {feature} data.
For each: file, function, what it does, code snippet.

## Indirect Impacts
Systems affected by {feature} through derived state, modifiers, or side effects.
For each: file, function, the chain of influence, code snippet.

## UI Touchpoints
Components that display or allow interaction with {feature}.
For each: component, navigation path, what the user sees.

## Test Implications
What would break or need testing if {feature} changes.
Organized by risk level (high/medium/low).

## Open Questions
Gaps, ambiguities, or areas that need further investigation.
```

### 4. Report

Return a 3-5 sentence summary to the user with:
- How many integration points found
- The highest-risk areas
- Link to the output file
