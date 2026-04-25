---
name: build-modular
description: |
  Modular build pipeline: spec intake through phase decomposition, then auto-advances through phases using /build-phase for each, and /build-finish for finalization. Review compliance is enforced structurally — each phase loads a short, focused skill where review steps can't get lost in context.

  Use when: "build modular", "modular build", or when you want the pipeline that forces review compliance through progress-gated context injection.
user-invocable: true
---

# Build Modular: Full Autonomous Pipeline

Takes a specification and delivers working, tested code. Same lifecycle as `/build` but with structural review enforcement: each phase is executed via `/build-phase`, which is a short skill (~80 lines) where review instructions are the entire context — not buried 300 lines deep.

**Input**: A spec file path, inline spec description, or reference to an existing spec.

**How it works**: This skill handles setup and decomposition (Steps 0-4), then auto-advances through each phase by invoking `/build-phase` via the Skill tool. After all phases, invokes `/build-finish`. The user does not need to invoke phases manually — the pipeline is fully autonomous.

**Why this works**: The review gate in `/build-phase` is structurally enforced. When that skill loads, the review instructions are the dominant context. The model can't lose track of them because the skill document is 80 lines, not 500.

---

## Critical Rules

1. **This skill orchestrates.** Setup is done here. Code is written by `/build-phase`.
2. **Agents write to files, not context.** Ephemeral findings go to `scratch/` (gitignored). Durable findings go to `docs/explore/` with frontmatter per `docs/DOC-STANDARDS.md`.
3. **Use explore-researcher agents (haiku)** for exploration.
4. **After decomposition, invoke `/build-phase` via the Skill tool for each phase.** Do not implement code directly in this skill.
5. **After all phases, invoke `/build-finish` via the Skill tool.**

---

## Step 1: Spec Intake & Git Setup

1. Locate the spec file (from user input, file path, or `specs/` search).
2. Read the full spec. Build a mental model of scope, entities, flows, integration points.
3. If no spec exists, tell the user and suggest `/specify`.
4. **Git check**: If on `main`, suggest creating a feature branch. Otherwise confirm branch.
5. **Check for existing progress**: Look for `docs/explore/build-progress-{feature}.md`.
   - If found: present state, ask resume or fresh start.
   - If not found: create it.
6. Initialize progress file:

```markdown
# Build Progress: {feature}
Spec: {spec path}
Branch: {branch name}
Started: {date}
Pipeline: modular

## Steps
- [ ] Setup & Decomposition
- [ ] Phase Execution
- [ ] Finalization

## Phases
(populated below)

## Deferred Items
(populated during execution)
```

## Step 2: Clarification

Identify ambiguities. Use `AskUserQuestion` for up to 5 targeted questions. Skip if spec is clear.

## Step 3: Codebase Exploration

Launch 2-3 explore-researcher agents (haiku) in parallel targeting:
- **Similar features**: patterns, file locations, conventions
- **Integration surface**: store actions, service functions, type definitions this feature touches
- **Architecture**: data flow, extension points

Agents write to `docs/explore/build-{feature}-explore-{scope}.md`. After completion, read the reports AND the key source files they identify.

## Step 4: Spec Critical Review

Analyze the spec for:
- Internal consistency and contradictions
- Completeness (missing error states, CRUD gaps, lifecycle gaps)
- Feasibility given codebase knowledge
- Integration risks
- Testability

Present issues as P0/P1/P2. Ask user how to proceed.

## Step 5: Phase Decomposition

Break implementation into ordered phases. Default template:
1. Types, constants, configuration
2. Core services and business logic
3. Store integration and state management
4. UI components
5. Integration, polish, edge cases

Adapt freely. Target 5-15 tasks per phase.

### Prior Work Audit

Check whether any phase outputs already exist. For each phase, report:
- **COMPLETE**: all expected files exist — skip
- **PARTIAL**: some files exist, note what remains
- **NOT STARTED**: execute normally

Present phase breakdown. Update progress file with phase list. Create tasks via `TaskCreate`.

## Step 6: Auto-Advance Through Phases

For each phase that is not complete:

1. Invoke `/build-phase` via the Skill tool with args: `{phase number} {feature name} {spec path}`
2. Wait for completion.
3. Verify the phase task is marked complete.
4. Proceed to next phase.

Do not implement code in this skill. Do not skip phases. Do not skip the `/build-phase` invocation.

## Step 7: Finalize

After all phases complete, invoke `/build-finish` via the Skill tool.

Report final summary to user.
