---
name: build-parallel
description: |
  Experimental build variant with parallelized review — launches code review agents in background while planning the next phase. Faster but may reduce review compliance. Use /build for the sequential (safer) version.

  Use when: "build parallel", "parallel build", or when speed matters more than review thoroughness.
user-invocable: true
---

# Build: Spec-to-Code Orchestrator

Takes a specification and delivers working, tested code through a rigorous phased loop: clarify, explore, review, decompose, plan, validate, implement, review, fix, advance, and browser-test.

**Input**: A spec file path, inline spec description, or reference to an existing spec.

**When to use `/build` vs individual commands**: Use `/build` when you want the full orchestrated lifecycle from spec to working code. Use the individual commands (`/clarify`, `/plan`, `/tasks`, `/implement-phase`) when you want manual control over each step, or when resuming a workflow that was started with those commands.

---

## Critical Rules

1. **You write all code.** Never delegate file edits or code generation to subagents. Agents are for research and review only.
2. **Agents write to files, not context.** All agent findings go to `docs/explore/` markdown files. Only 1-2 sentence summaries return to the conversation.
3. **Use explore-researcher agents (haiku model)** for all review/research tasks. Never use Explore agents.
4. **Use opus model** for plan review agents (Step 5b).
5. **Immutable state updates.** Never use Immer `produce`. Always use spread operators for Zustand state.
6. **Use centralized config.** Import from `@/lib/config` instead of hardcoding values.
7. **Run `npx tsc --noEmit` after each phase** to catch type errors early.
8. **No magic numbers.** Extract literals to config or named constants.
9. **Write plans to files.** Phase plans go to `.Codex/plans/build-{feature}-phase-{N}.md`. Never keep plans only in conversation — they must survive context compaction.
10. **Track progress.** Use TaskCreate/TaskUpdate for visual progress. Update the build progress file after each phase completion (not every sub-step).
11. **Agents must prefer built-in tools.** When writing agent prompts, explicitly instruct agents to use Read, Grep, and Glob tools for their research — never Bash commands that execute code. Code execution in agents triggers user approval prompts, which defeats the goal of minimizing human intervention during builds.

---

## Step 0: Spec Intake & Git Setup

**Goal**: Locate the specification and ensure clean git state.

1. If the user provided a file path, read it. If they provided inline text, treat it as the spec. If they referenced a feature name, search `specs/` for matching spec files.
2. Read the full spec carefully. Build a mental model of: scope, entities, user flows, integration points, and success criteria.
3. If no spec exists, tell the user and suggest they write one or use `/specify`.
4. **Git check**: Verify the current branch. If on `main`, suggest creating a feature branch before proceeding. If already on a feature branch, confirm it with the user.
5. **Check for existing progress**: Look for `docs/explore/build-progress-{feature}.md`.

   **If a progress file exists** — a previous `/build` was started. Read it and determine:
   - Which steps and phases are marked complete
   - Whether the build was cleanly paused or interrupted mid-step
   - Present the state to the user: "Found a previous build at Phase {N}, Step {X}. Resume from there, or start fresh?"
   - If resuming: skip to the first incomplete step/phase
   - If starting fresh: archive the old progress file (rename to `build-progress-{feature}-{date}.md`) and create a new one

   **If no progress file exists but related code already exists** (e.g., types/services/components matching the spec were created manually or via `/implement-phase`):
   - Note this — it will be detected in detail during the prior work audit after phase decomposition (Step 4)
   - Create the progress file normally

   **If clean slate** — no progress file, no existing code:
   - Create the progress file normally

6. **Initialize progress file** (if not resuming):
   ```markdown
   # Build Progress: {feature}
   Spec: {spec path}
   Branch: {branch name}
   Started: {date}

   ## Steps
   - [ ] Step 0: Spec Intake & Git Setup
   - [ ] Step 1: Clarification
   - [ ] Step 2: Codebase Exploration
   - [ ] Step 3: Spec Critical Review
   - [ ] Step 4: Phase Decomposition
   - [ ] Step 5: Phase Execution
   - [ ] Step 6: Final Checklist
   - [ ] Step 7: Browser Testing

   ## Phases
   (populated after Step 4)

   ## Deferred Items
   (populated during execution)
   ```
7. Mark Step 0 complete in the progress file.

---

## Step 1: Clarification

**Goal**: Resolve ambiguities before committing to architecture.

1. After reading the spec, identify areas that are underspecified, ambiguous, or have multiple valid interpretations. Focus on:
   - Data model gaps (missing fields, unclear relationships, identity rules)
   - Behavioral ambiguity (what happens when X? what's the default for Y?)
   - Integration points (how does this connect to existing systems?)
   - Edge cases that would change the implementation approach
   - Performance/scale assumptions that affect architecture

2. Use `AskUserQuestion` to ask up to 5 targeted questions. Each question should:
   - Be answerable with a short selection or phrase
   - Materially impact architecture, data modeling, or implementation
   - Be ordered by impact (highest first)

3. If the spec is clear enough, skip clarification and say so.
4. Mark Step 1 complete in the progress file.

---

## Step 2: Codebase Exploration

**Goal**: Understand the existing code before designing anything.

Launch 2-3 explore-researcher agents (haiku) in parallel, each targeting a different aspect of the codebase relevant to the spec. Agents write findings to `docs/explore/build-{feature}-explore-{scope}.md`.

**Agent scopes** (choose the most relevant):
- **Similar features**: "Find features similar to {feature} and trace their implementation. Map: file locations, patterns used, how they integrate with the store/services/UI. List the 5-10 most important files to read."
- **Architecture**: "Map the architecture for {relevant area}. Trace data flow from UI through store to services. Identify extension points, shared utilities, and conventions. List the 5-10 most important files to read."
- **Integration surface**: "Identify all existing code that {feature} will need to integrate with. Map: store actions, service functions, component props, type definitions. List the 5-10 most important files to read."

**After agents complete**:
1. Read the exploration files
2. Read the key files identified by the agents (the actual source files, not just the reports)
3. Update your mental model of how the feature fits into the existing codebase
4. Mark Step 2 complete in the progress file

This step is essential — without it, plans and phase decomposition will be based on the spec alone, leading to duplicated utilities, wrong patterns, and missed integration points.

---

## Step 3: Spec Critical Review

**Goal**: Catch logic errors, contradictions, and structural gaps — now informed by codebase knowledge.

Perform a critical analysis of the spec covering:

- **Internal consistency**: Do requirements contradict each other? Are there circular dependencies?
- **Completeness**: Are there user flows with no defined error states? Missing CRUD operations? Incomplete lifecycle definitions?
- **Feasibility**: Given what you now know about the codebase, are any requirements technically unreasonable? Would any requirement require invasive changes to stable systems?
- **Integration risk**: Based on the exploration, will this break existing systems? Are there hidden coupling points the spec doesn't account for?
- **Testability**: Can success criteria actually be verified?

**Output to user**: If issues found, present them as a numbered list with severity (P0 = blocking, P1 = significant, P2 = minor). Ask the user how to proceed:
- Fix the spec issues now
- Acknowledge and proceed (spec issues become implementation constraints)
- Abandon (spec needs major rework)

If no issues found, say so and proceed. Mark Step 3 complete.

---

## Step 4: Phase Decomposition

**Goal**: Break the full implementation into ordered phases.

Using both the spec and codebase exploration findings, decompose into implementation phases. Each phase should:

1. Be independently completable and verifiable
2. Have clear inputs (what must exist before) and outputs (what exists after)
3. Follow a logical dependency order. The default template is:
   - **Phase 1**: Types, constants, configuration (foundational)
   - **Phase 2**: Core services and business logic
   - **Phase 3**: Store integration (state management)
   - **Phase 4**: UI components
   - **Phase 5**: Integration, polish, edge cases

   Adapt freely — an API-only feature has no UI phase, a refactor might be all services, a small feature might have only 2 phases. The template is a starting point, not a constraint.

4. Target 5-15 tasks per phase. If a phase has more, split it.

**Output to user**: Present the phase breakdown as a summary table:
```
Phase 1: [Name] — [Goal] — ~N tasks
Phase 2: [Name] — [Goal] — ~N tasks
...
```

Ask for approval before proceeding. Update the progress file with the phase list. Create tasks via `TaskCreate` for each phase. Mark Step 4 complete.

### Prior Work Audit

Before starting execution, check whether any phase outputs already exist in the codebase — from manual work, a previous partial `/build`, or the `/implement-phase` pipeline.

For each phase, check whether its key outputs (files, types, store actions, components) already exist:
- **Fully complete**: All expected files exist and match the spec. Mark the phase complete in the progress file, mark its task as `completed`, and skip it.
- **Partially complete**: Some files exist but the phase is incomplete. Note which tasks are done and which remain. When this phase is reached in the loop, start from the first incomplete task.
- **Not started**: No outputs found. Execute normally.

Present the audit results to the user:
```
Phase 1: Types & Config — ALREADY COMPLETE (3/3 files exist)
Phase 2: Services — PARTIAL (2/4 services exist, missing: fooService, barService)
Phase 3: Store — NOT STARTED
...
```

This prevents re-implementing existing code and gives the user a clear picture of how much work remains. If a phase is marked complete but the code has issues (doesn't compile, wrong patterns), flag it as "exists but needs review" and let the user decide whether to skip or redo it.

---

## Step 5: Phase Execution Loop

For each phase (skipping those marked complete by the audit), execute this loop:

### 5a. Plan the Phase

Write a detailed implementation plan to `.Codex/plans/build-{feature}-phase-{N}.md`:

- List every file to create or modify (with absolute paths)
- For each file: what changes, what functions/types to add, what patterns to follow
- Identify which existing files to read first for context
- Note any inter-task dependencies within the phase
- Reference relevant patterns from `AGENTS.md`, `docs/explore/`, and the codebase exploration findings

The plan must be in the file, not just in conversation. The plan review agent will read it from there.

### 5b. Critical Plan Review (Opus Agent)

Spawn an opus-model agent to critically review the plan:

```
Agent prompt template:
"You are reviewing an implementation plan for Phase {N}: {phase name} of the
{feature} feature.

Read the plan at: {absolute path to .Codex/plans/build-{feature}-phase-{N}.md}
Read the spec at: {spec path}

Also read these files for codebase context:
- AGENTS.md (project root: {project root path})
- {list any subdirectory AGENTS.md files relevant to this phase}
- {list the 3-5 most relevant source files this phase modifies or depends on}

Critically review this plan for:
1. GAPS: Missing steps, forgotten edge cases, incomplete error handling
2. CONTRADICTIONS: Steps that conflict with each other or with the spec
3. PATTERN VIOLATIONS: Deviations from established codebase patterns (check the
   actual source files, not just AGENTS.md descriptions)
4. INTEGRATION RISKS: Changes that could break existing functionality
5. ORDERING ISSUES: Dependencies that would cause failures if executed as-is
6. OVER-ENGINEERING: Unnecessary complexity or abstraction

Write your findings to docs/explore/build-{feature}-plan-review-phase-{N}.md:
- P0 (blocking): Issues that would cause the phase to fail
- P1 (significant): Issues that would cause bugs or tech debt
- P2 (minor): Style/preference suggestions

Be ruthless. The goal is to catch problems BEFORE code is written."
```

**After agent completes**: Read the review file. If P0 issues exist, revise the plan file and re-submit for review. If only P1/P2, present them to the user and ask whether to address them in the plan or proceed.

### 5c. Execute the Phase

Update the phase's task to `in_progress` via `TaskUpdate`. Implement the plan yourself (no agents for code):

1. Read all relevant existing files first
2. Implement changes file by file, following the plan
3. After all changes, run `npx tsc --noEmit` to catch type errors
4. Fix any compilation errors immediately
5. Run `npm run lint` if it's the final phase or if significant code was written

### 5d. Multi-Agent Implementation Review

Determine which review scopes are relevant based on what files were actually modified in this phase. Only launch agents for scopes that apply:

- **Types & Constants** — launch if type files, interfaces, constants, or config entries were created/modified
- **Services & Logic** — launch if service files or business logic were created/modified
- **UI & Wiring** — launch if React components or hooks were created/modified
- **Store Integration** — launch if store files, actions, or state fields were created/modified

For each relevant scope, launch an explore-researcher agent (haiku model) in parallel. Each writes findings to `docs/explore/build-{feature}-review-r{N}-{scope}.md`. **In every agent prompt, include these instructions:** "Use Read, Grep, and Glob tools for all research. Never use Bash to run code. Write output to `scratch/` (session-scoped, gitignored) not `docs/explore/`."

**Agent 1 — Types & Constants** (if applicable):
```
Review all new/modified type definitions, interfaces, constants, and config
entries in these files: {enumerate every type/config file path modified}

Check for:
- Dead state fields (defined but never read anywhere in the codebase)
- Non-nullable types that are guarded for null elsewhere (or vice versa)
- Magic numbers or string literals that should be in config/constants
- ID collision risks in Record/Map keyed structures
- Missing branded types where different ID types could be confused
- Naming inconsistencies with existing codebase conventions

Write findings to: docs/explore/build-{feature}-review-r{N}-types.md
```

**Agent 2 — Services & Logic** (if applicable):
```
Review all new/modified service functions and business logic in these files:
{enumerate every service file path modified}

Check for:
- Double-application of effects (applying a modifier twice in a flow)
- Stale or wrong entity matching (filtering/finding by wrong field)
- Edge cases with empty arrays, zero values, null/undefined inputs
- Off-by-one errors in thresholds, ranges, or percentage calculations
- Missing fallbacks for optional data that could be undefined
- Async operations without error handling or timeout protection

Write findings to: docs/explore/build-{feature}-review-r{N}-services.md
```

**Agent 3 — UI & Wiring** (if applicable):
```
Review all new/modified React components and hooks in these files:
{enumerate every component/hook file path modified}

Check for:
- Stale closures: useCallback/useMemo missing dependencies
- Keyboard shortcuts that fire while user is typing in an input/textarea
- Dead rendering branches (conditional returns that can never trigger)
- Missing loading, error, or empty states in data-dependent components
- Props accepted in the interface but never used in the component body
- Event handlers that need preventDefault/stopPropagation but don't have it

Write findings to: docs/explore/build-{feature}-review-r{N}-ui.md
```

**Agent 4 — Store Integration** (if applicable):
```
Review all new/modified store actions and state fields in these files:
{enumerate every store file path modified}

Check for:
- New state fields missing from the store's load/hydration path (old saves
  would crash or have undefined values without defaults)
- New state fields missing from the store's reset/cleanup path (state leaks
  between sessions)
- New state fields missing from the store's serialization/save path (data
  silently lost on save)
- Store actions that are defined but never called from any component or service
- Periodic/tick effects that are defined but never registered in the tick loop
- Immer produce usage (this codebase requires immutable spread operators)

Write findings to: docs/explore/build-{feature}-review-r{N}-store.md
```

**Parallelism with next phase planning**: If this is not the final phase, launch review agents in the background (`run_in_background: true`) and immediately begin planning the next phase (Step 5a for phase N+1) while reviews run. When the background agents complete, read their findings and triage (5e) before starting execution of the next phase. This overlaps review wait time with planning work.

### 5e. Triage

After all review agents complete:

1. Read ALL review files for this round before making any decisions
2. Collect all findings across the reports
3. Classify by severity: P0 (causes crashes/data loss), P1 (causes bugs), P2 (style/minor)
4. Present the unified triage to the user as a prioritized list
5. Fix all P0 issues immediately
6. Ask the user which P1 issues to fix now vs defer
7. Record deferred items in the progress file under "Deferred Items"

### 5f. Re-Review Loop (if P0s were found)

If P0 issues were found and fixed in 5e:

1. Run `npx tsc --noEmit` again
2. Launch a focused review round — only the scopes that had P0s, with round number incremented (R2, R3...)
3. Triage again
4. Repeat until the review comes back clean (P2s only)

Maximum 3 review rounds per phase. If still finding P0s after R3, stop and present the situation to the user.

### 5g. Phase Complete

After a clean review (or user approval to proceed):

1. Report phase completion: what was built, files created/modified, deferred items
2. Ask the user if they want to commit the phase (`git add` + `git commit` with a descriptive message). Committing per-phase provides rollback points.
3. Mark the phase complete in the progress file and update the task via `TaskUpdate`
4. Delete the phase plan file from `.Codex/plans/` (it's served its purpose)

### 5h. Compaction Resilience (large builds only)

For large builds (5+ phases), context compaction may still occur even with 1M context. Follow these practices:

- Phase plans live in `.Codex/plans/` files, not in conversation context.
- Review findings live in `docs/explore/` files, not in conversation context.
- After each phase, update the progress file with: completed phases, key decisions, deferred items, and what the next phase needs.
- If context compaction occurs mid-session, the conversation summary + progress file + plan files provide enough context to continue without re-researching.

For small/medium builds (1-4 phases), the progress file and plan files provide sufficient recovery. No need to update the progress file after every sub-step — phase boundaries are enough.

**After a phase completes**: Loop back to 5a for the next phase.

---

## Mid-Build Spec Amendments

If the user wants to change the spec during execution:

1. Apply the spec change
2. Assess impact: does it affect only future phases, or does it invalidate already-completed work?
3. If future-only: update the phase decomposition and continue
4. If it invalidates completed work: present the scope of rework to the user and ask how to proceed
5. Update the progress file with the amendment note

---

## Step 6: Final Checklist

After the last phase completes, run through the checklist in `.Codex/plans/END-OF-PLAN-CHECKLIST.md`, then:

- **Clean up** — delete remaining plan files from `.Codex/plans/` (keep the checklist). Ask user if they want to keep or delete the `docs/explore/` review files. Mark the progress file as complete.

Report the final summary: files created, files modified, phases completed, known deferred items, suggested next steps.

### Testing Checklist (multi-phase builds only)

For any build with 3+ phases, generate a testing checklist at `docs/{feature}-testing-checklist.md`. This gives the user (or a QA agent) a concrete guide to verify the feature works end-to-end.

**Before writing checklist items**, launch an explore-researcher agent (haiku) to map UI navigation paths for every UI component modified during the build. The agent should:
- Read each modified UI component file (tsx) and trace: which app/screen it lives in, what navigation reaches it, what buttons/tabs are present, what store actions they call
- For automated behaviors (weekly tick, time advancement), identify which UI component triggers them and how
- Write findings to `docs/explore/build-{feature}-ui-map.md`

Read the resulting UI map file, then write checklist items using the verified paths. Each checklist item involving UI interaction must include the concrete, code-verified navigation path.

- BAD: "Run 3-5 shifts; open Venue Management > Finances tab and verify reputation"
- GOOD: "Click Advance Week (AdvanceWeekButton) to trigger owned venue shifts via performWeeklyTick(). Then: Work app > My Jobs > 'Manage' button on brothel > VenueManagementModal > Finances tab > verify 'Reputation' section with Overall Quality progress bar"

The checklist should include:

1. **Setup** — any prerequisites, config, or test data needed before testing
2. **Core functionality** — one item per user-facing behavior from the spec, phrased as a testable action:
   - "Create a [thing] and verify [expected result]"
   - "Trigger [action] with [input] and confirm [output]"
3. **Edge cases** — empty states, boundary values, error conditions, rapid repeated actions
4. **Integration points** — interactions with existing systems that could regress (identified during codebase exploration)
5. **Save/load compatibility** — if state is persisted: save, reload the page, verify state survived. If old saves exist, load one and verify no crash.
6. **Deferred items** — any P1/P2 issues that were deferred during review, listed as known limitations

Each item should be a checkbox (`- [ ]`) so the user can work through it. Keep items concrete and specific — "verify the UI renders correctly" is useless; "open the influence hub, click the Media tab, verify the property list shows 3 default entries" is testable.

---

## Step 7: Browser Testing (multi-phase builds only)

**Goal**: Verify the feature works end-to-end in a real browser, catch runtime bugs that static analysis misses, and fix them before declaring done.

For any build with 3+ phases, invoke `/test-billionairesim` or follow its instructions manually. The testing skill has its own persistent MEMORY.md with accumulated gotchas and verified patterns from previous sessions.

**Key references** (read by the testing skill automatically):
- `docs/agent-testing-guide.md` — Dev toolbar, store access, quickstart setup, JS patterns, common gotchas
- `.Codex/skills/test-billionairesim/MEMORY.md` — Session-to-session learnings

**Inputs to provide**: The testing checklist from Step 6 (`docs/{feature}-testing-checklist.md`) and the UI map (`docs/explore/build-{feature}-ui-map.md`).

After testing completes, update the build progress file with the test results and mark Step 7 complete.

---

## Interruption & Resume

The build is designed to survive session breaks and (for large builds) context compaction:
- The progress file (`docs/explore/build-progress-{feature}.md`) tracks completed steps/phases
- Phase plans in `.Codex/plans/` provide implementation context
- Review findings in `docs/explore/` provide review context

**If the user explicitly stops**: Update the progress file, suggest committing.

**Resuming** (new session or after compaction): Read the progress file to determine where to resume. Skip completed steps and phases. If mid-phase, check file existence and tsc output to assess what was done.

If the user says "skip" for any step, skip it but record the skip in the progress file.
If the user says "just build it" or "no review needed", skip the agent review steps (5d-5f) but still run tsc.
If the user says "skip testing", skip Step 7 but still generate the testing checklist in Step 6.

---

## Adaptation

This workflow adapts to feature size:

- **Small features** (1-2 phases, <10 tasks total):
  - Merge Steps 1-3 into a single pass: read spec, ask 1-2 questions if needed, note any issues inline
  - Launch 1-2 review agents per phase instead of up to 4 (pick the most relevant scopes)
  - Skip the re-review loop (5f) — fix any P0s and move on
  - Skip per-phase commits — commit once at the end
  - Skip Step 7 (browser testing) — feature is small enough for manual verification

- **Medium features** (3-4 phases, 10-30 tasks total):
  - Full workflow as described
  - Step 7: Test the critical path only (1-2 core flows). Skip edge cases and integration checks unless the feature touches complex state (revenue calculations, time advancement, multi-entity workflows).

- **Large features** (5+ phases, 30+ tasks total):
  - Full workflow — rely on auto-compact; do not pause between phases unless blocked
  - Commit after every phase (mandatory, not optional)
  - Consider splitting into multiple `/build` invocations if phases are truly independent
  - Step 7: Full testing coverage — critical path, edge cases, integration points, save/load. Budget significant time for this; large features routinely surface P0 runtime bugs that static analysis misses (e.g., zero-output calculations, broken matching algorithms, missing seed data).
