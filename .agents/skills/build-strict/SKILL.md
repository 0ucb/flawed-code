---
name: build-strict
description: |
  Strict build pipeline with mandatory review gates. Same lifecycle as /build but with hard checkpoints that cannot be skipped. Every phase requires plan review, code review, and triage before advancing.

  Use when: "build strict", "strict build", or when you want enforced review compliance without modularization.
user-invocable: true
---

# Build Strict: Enforced Review Gates

Same lifecycle as `/build` — spec intake, clarify, explore, review, decompose, then phased implementation — but with MANDATORY gates that prevent skipping reviews.

**Input**: A spec file path, inline spec description, or reference to an existing spec.

---

## Critical Rules

1. **You write all code.** Agents are for review only.
2. **Agents write to files, not context.** Ephemeral findings go to `scratch/` (gitignored). Durable findings go to `docs/explore/` with frontmatter per `docs/DOC-STANDARDS.md`.
3. **Use explore-researcher agents (haiku)** for code review, **opus** for plan review.
4. **Immutable state updates.** No Immer `produce`.
5. **Run `npx tsc --noEmit` after each phase.**
6. **Plans go to files.** `.Codex/plans/build-{feature}-phase-{N}.md`.
7. **Agents must use built-in tools only.** Read, Grep, Glob — never Bash.

---

## Setup (Steps 0-4)

### Step 0: Spec Intake & Git

1. Locate spec. Read it fully.
2. Git check — suggest feature branch if on main.
3. Check for existing progress file. Resume or create new.
4. Initialize progress file with `Pipeline: strict` marker.

### Step 1: Clarification

Up to 5 targeted questions via `AskUserQuestion`. Skip if spec is clear.

### Step 2: Codebase Exploration

Launch 2-3 explore-researcher agents (haiku) targeting similar features, integration surface, architecture. Write to `docs/explore/build-{feature}-explore-{scope}.md`. Read results AND key source files.

### Step 3: Spec Critical Review

Analyze for consistency, completeness, feasibility, integration risk. Present P0/P1/P2.

### Step 4: Phase Decomposition

Break into phases (types → services → store → UI, adapted as needed). Prior work audit. Create tasks. Present to user for approval.

---

## Phase Execution Loop

For each phase, execute ALL of the following stages in order.

### Stage A: Plan

Write plan to `.Codex/plans/build-{feature}-phase-{N}.md`. Launch opus plan review agent. **Wait for completion. Read the review.**

- P0s found → revise plan, re-review.
- P1s found → present to user, get direction.
- Clean → proceed.

### Stage B: Implement

Read relevant files. Implement the plan. Run `npx tsc --noEmit`. Fix errors.

---

### ======================================================
### MANDATORY REVIEW GATE — DO NOT SKIP — DO NOT DEFER
### ======================================================
###
### You have finished Stage B. Code compiles. You feel done.
### You are NOT done. The following steps are REQUIRED.
###
### Do not start planning the next phase.
### Do not write any more code.
### Do not tell the user the phase is complete.
### Do not proceed to Stage D until Stage C is fully done.
###
### ======================================================

### Stage C: Code Review

**C1. Determine scopes.** Which of these apply to the files you modified?
- Types & Constants (type/config files)
- Services & Logic (service files)
- UI & Wiring (React components)
- Store Integration (store files)

**C2. Launch agents.** For EACH applicable scope, launch an explore-researcher agent (haiku). Run them in parallel. Each prompt must include: "Use Read, Grep, and Glob tools for all research. Never use Bash to run code."

- **Types**: dead fields, nullable contradictions, magic numbers, ID collisions, naming
- **Services**: double-application, wrong matching, empty arrays, off-by-one, missing fallbacks
- **UI**: stale closures, keyboard during input, dead branches, missing states, unused props
- **Store**: missing load/save/reset fields, uncalled actions, unregistered ticks, Immer usage

Each writes to `docs/explore/build-{feature}-review-r{N}-{scope}.md`.

**C3. Wait for ALL agents to complete.** Do not proceed until every agent has returned.

**C4. Read ALL review files.** Every single one. Not just the summaries.

**C5. Triage.** Collect all findings. Classify P0/P1/P2. Present unified list to user.

**C6. Fix P0s.** Immediately. Run `npx tsc --noEmit` after fixes.

**C7. P1 disposition.** Ask user: fix now or defer? Record deferred items in progress file.

**C8. Re-review if P0s were found.** Launch focused review (only scopes that had P0s), round N+1. Repeat until clean. Maximum 3 rounds.

### ======================================================
### GATE COMPLETE — You may now proceed to Stage D
### ======================================================

### Stage D: Phase Complete

1. Report: files created/modified, deferred items.
2. Ask user about committing this phase.
3. Mark phase complete in progress file and `TaskUpdate`.
4. Delete plan file from `.Codex/plans/`.

**Then loop back to Stage A for the next phase.**

---

## Finalization (after last phase)

### Final Checklist

Run through `.Codex/plans/END-OF-PLAN-CHECKLIST.md`, then clean up — delete plan files, mark progress complete.

### Testing Checklist (3+ phases)

1. Launch explore-researcher to map UI navigation paths → `docs/explore/build-{feature}-ui-map.md`.
2. Read the map. Write `docs/{feature}-testing-checklist.md` with code-verified navigation paths.
3. Each item: setup, core functionality, edge cases, integration, save/load, deferred items.

### Browser Testing (3+ phases)

Invoke `/test-billionairesim` with the checklist and UI map.

---

## Interruption & Resume

Progress file + plan files + review files provide full recovery context. On resume: read progress file, skip completed phases, check file existence and tsc for partial phases.

If user says "skip review" for a phase, record the skip in progress file but still run tsc.
