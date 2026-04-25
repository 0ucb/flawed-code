---
name: build-finish
description: |
  Finalize a modular build: AGENTS.md updates, testing checklist with UI map, lint, store lifecycle audit, and browser testing. Run after all /build-phase invocations are complete.

  Use when: "build finish", "finalize build", or after the last /build-phase completes.
user-invocable: true
---

# Build Finish: Final Checklist & Testing

Run after all phases are complete. Handles documentation updates, testing checklist generation, and browser testing.

**Input**: None — reads the progress file to determine the feature and what was built.

---

## Step 1: Locate Progress File

Find `scratch/build-progress-{feature}.md` (or `docs/explore/build-progress-{feature}.md` for older builds). Read it to determine:
- Which phases completed
- Which files were created/modified
- Any deferred items

If no progress file found, ask the user what feature to finalize.

---

## Step 2: Final Verification

Run in parallel:
- `npx tsc --noEmit` — verify clean compilation
- `npm run lint` — catch unused imports, missing hook deps

Fix any errors before proceeding.

---

## Step 3: End-of-Build Checklist

Run through `.Codex/plans/END-OF-PLAN-CHECKLIST.md`, then clean up — delete remaining `.Codex/plans/build-{feature}-*` files.

---

## Step 4: Testing Checklist

For any build with 3+ phases, generate a testing checklist.

### 4a. UI Navigation Map

Launch an explore-researcher agent (haiku) to map UI navigation paths for every modified component:

```
For each modified UI component (tsx):
- Which app/screen it lives in
- What navigation path reaches it
- What buttons/tabs are present
- What store actions they call
- For automated behaviors (weekly tick), which UI triggers them

Write to: scratch/build-{feature}-ui-map.md
```

### 4b. Write Checklist

Read the UI map, then write `docs/{feature}-testing-checklist.md` with:

1. **Setup** — prerequisites, config, test data
2. **Core functionality** — one checkbox per user-facing behavior, with code-verified navigation path:
   - BAD: "open the settings and check the value"
   - GOOD: "Phone > Work app > Manage button on venue > VenueManagementModal > Finances tab > verify Revenue section"
3. **Edge cases** — empty states, boundary values, error conditions
4. **Integration points** — interactions with existing systems that could regress
5. **Save/load** — persist, reload, verify
6. **Deferred items** — known limitations from review triage

---

## Step 5: Browser Testing

For builds with 3+ phases, invoke `/test-billionairesim` or follow its instructions manually.

Provide: the testing checklist and UI map paths.

---

## Step 6: Complete

Update progress file: mark all steps complete, record test results.

Report final summary:
- Files created / modified (total counts)
- Phases completed
- Deferred items
- Test results

Ask if the user wants to commit.
