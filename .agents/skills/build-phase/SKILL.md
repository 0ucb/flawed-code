---
name: build-phase
description: |
  Execute a single build phase with mandatory plan review, implementation, code review, and triage. Invoked by /build-modular for each phase, or manually via /build-phase {N}.

  The review gate is the entire point of this skill's existence. This skill is ~80 lines. The review instructions cannot get lost in context because they ARE the context.

  Use when: invoked by /build-modular, or manually with "build phase 1", "execute phase 2", etc.
user-invocable: true
---

# Build Phase: Single Phase Executor

Executes ONE phase of a build. Four stages, strict order. No stage may be skipped.

**Input**: Phase number + feature name + spec path (from args or progress file).

**This skill exists because it is short.** The review gate below is the dominant instruction. In a 500-line monolith, this gate gets buried. Here, it's half the document.

---

## Rules

1. **You write all code.** Agents are for review only.
2. **Agents write to files, not context.** Ephemeral findings go to `scratch/` (gitignored). Durable findings go to `docs/explore/` with frontmatter per `docs/DOC-STANDARDS.md`.
3. **Haiku for code review, opus for plan review.**
4. **No Immer produce.** Immutable spreads only.
5. **tsc after implementation.**
6. **Plans to files.** `.Codex/plans/build-{feature}-phase-{N}.md`.
7. **Agents use Read/Grep/Glob only.** Never Bash.

---

## Stage 1: Plan

1. Read the progress file to determine what this phase covers.
2. Write a detailed plan to `.Codex/plans/build-{feature}-phase-{N}.md`:
   - Every file to create or modify (absolute paths)
   - What changes per file, what patterns to follow
   - Which existing files to read first
3. Launch an **opus** explore-researcher agent to review the plan.
4. **Wait for the agent. Read the review file.**
5. P0s → revise and re-review. P1s → present to user. Clean → proceed.

---

## Stage 2: Implement

1. Update the phase task to `in_progress`.
2. Read relevant existing files.
3. Implement the plan, file by file.
4. Run `npx tsc --noEmit`. Fix errors.

---

## REVIEW GATE

**Implementation is done. STOP HERE.**

**Do not plan the next phase.**
**Do not write more code.**
**Do not report the phase as complete.**
**Execute every step below before doing anything else.**

### Gate Step 1: Determine review scopes

Which apply to the files you just modified?
- **Types & Constants** — type/config files
- **Services & Logic** — service files
- **UI & Wiring** — React components
- **Store Integration** — store files

### Gate Step 2: Launch review agents

For EACH applicable scope, launch an explore-researcher agent (haiku). Parallel. Every prompt must say: "Use Read, Grep, and Glob tools for all research. Never use Bash to run code."

- **Types**: dead fields, nullable contradictions, magic numbers, ID collisions, naming
- **Services**: double-application, wrong matching, empty arrays, off-by-one, missing fallbacks
- **UI**: stale closures, keyboard during input, dead branches, missing states, unused props
- **Store**: missing load/save/reset fields, uncalled actions, unregistered ticks, Immer

Each writes to `docs/explore/build-{feature}-review-r{N}-{scope}.md`.

### Gate Step 3: Wait for ALL agents

Do not proceed until every agent has returned.

### Gate Step 4: Read ALL review files

Every one. Not summaries. The actual files.

### Gate Step 5: Triage

Collect findings. Classify P0/P1/P2. Present unified list to user.

### Gate Step 6: Fix

P0s: fix immediately, re-run tsc.
P1s: ask user — fix now or defer? Record deferred items.

### Gate Step 7: Re-review if P0s were found

Focused re-review (only scopes with P0s), round N+1. Max 3 rounds.

---

## Stage 4: Complete

1. Run `npx tsc --noEmit` final check.
2. Run `npm run lint` if final phase or significant code written.
3. Report: files created/modified, deferred items.
4. Ask user about committing this phase.
5. Mark phase complete in progress file. `TaskUpdate` to completed.
6. Delete plan file from `.Codex/plans/`.
