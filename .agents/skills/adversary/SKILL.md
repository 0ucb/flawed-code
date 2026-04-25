---
name: adversary
description: |
  Spawn independent cold-readers to challenge recent work — code, specs, plans, or research. Returns structured ISSUE/FIX findings with a triage table for applying or rejecting suggestions. Replaces /challenge.

  The skill decides review intensity (model tier) based on work size — haiku for routine, haiku+opus for large/high-stakes. User can override with /adversary opus or /adversary tri (haiku+sonnet+opus).

  Use when: you want a second opinion before committing to code, a spec, a plan, or research. Works on any work product, not just pipeline outputs.

  Triggers: "/adversary code", "/adversary spec path", "/adversary plan", "/adversary research path", "/adversary last", "/adversary tri [target]", or when the user asks for adversarial review of recent work.
user-invocable: true
---

# /adversary — Workbench Adversarial Review

Spawns independent reviewer agent(s) to cold-read recent work and find gaps, risks, and unnecessary complexity. Returns structured ISSUE/FIX findings. Replaces `/challenge`.

---

## Critical Rules

1. **Reviewers write to files, not context.** All findings go to `docs/explore/adversary-review-*.md`. Only a summary returns to the conversation.
2. **Use explore-researcher agents.** Haiku by default, opus when escalating. Never use Explore agents.
3. **Explicit targets required.** Do not auto-detect. The user specifies what to review.
4. **Verify before applying.** Before applying any reviewer suggestion, read the actual code/spec at the cited location. Reviewers hallucinate line numbers, function names, and the existence of bugs.
5. **Agents must prefer built-in tools.** Instruct reviewer agents to use Read, Grep, and Glob — never Bash.

---

## Step 1: Determine Target and Context

The user provides an explicit target:

```
/adversary code                — uncommitted changes (git diff HEAD)
/adversary code main..HEAD     — branch diff against main
/adversary code HEAD~3..HEAD   — last 3 commits
/adversary spec path/to/spec   — a spec file
/adversary plan                — active plan in .Codex/plans/
/adversary research path       — a research doc or docs/explore/ file
/adversary last                — the last file Codex wrote to disk
/adversary opus [target]       — force opus-tier review on any target
/adversary tri [target]        — three-model review: haiku + sonnet + opus in parallel
/adversary lenient [target]    — lenient filter: only flag P0 structural issues, cap at 3
/adversary aggressive [target] — aggressive filter: flag all flaws including minor, cap at 12
```

**Aggressiveness** (combinable with `opus`/`tri`): `lenient`, `balanced` (default), `aggressive`.
- `lenient` — early exploration: keep candidates alive, only flag showstoppers
- `balanced` — default: P0+P1+P2, cap at 7
- `aggressive` — pre-promotion: eliminate anything questionable, cap at 12

If no target provided, ask the user what to review.

**Assemble context:**
- The work product (diff output, file content, or document)
- Relevant AGENTS.md sections for touched directories
- If available: the motivating spec or task description

**Code-specific context:**
- Run the appropriate `git diff` command
- Truncate at 15KB with note: "[Diff truncated — showing first 15KB of {total}KB. Run `/adversary code path/to/file.ts` for full review.]"
- Filter out: binary files, generated dirs (node_modules, dist, .next), files with <3 lines changed
- If `git diff HEAD` returns empty and branch has commits ahead of main, suggest: "No uncommitted changes found. Review branch diff with `/adversary code main..HEAD`?"
- Report: "Reviewing {N} files ({M}KB diff)."

**Spec-specific context:**
- Include list of related specs in `specs/` (for conflict detection)
- If re-reviewing (previous adversary-review file exists for this spec): include `git diff` of the spec file

---

## Step 2: Determine Review Intensity

Pick model tier based on the work — unless the user specified `/adversary opus`.

The key insight: **spend tokens on orthogonal perspectives, not repeated perspectives.** Two haiku passes from the same angle find less than one haiku + one opus pass. Haiku catches surface gaps; opus catches architectural flaws. Different questions, not more tokens.

| Signal | Intensity | Why |
|--------|-----------|-----|
| Small code diff (<100 lines), single file | 1 haiku pass | Low blast radius |
| Multi-file code change | 1 haiku pass | Standard review |
| Spec or plan (any size) | 1 haiku + 1 opus pass | Small artifact, high downstream cost if wrong |
| Large code change (>300 lines), new system | 1 haiku + 1 opus pass | Size warrants depth |
| User specified `opus` | 1 opus pass | Override |
| User specified `tri` | 1 haiku + 1 sonnet + 1 opus pass | Maximum coverage — three orthogonal perspectives |

Report: "Running haiku review on 4 files." or "Spec detected — running haiku + opus passes (high downstream cost)." or "Tri-model review: launching haiku + sonnet + opus in parallel."

---

## Step 3: Spawn Reviewer(s)

Launch explore-researcher agent(s) at the determined tier. Each writes to `docs/explore/adversary-review-{target}-{date}.md` (append `-opus.md` for the opus pass, `-sonnet.md` for the sonnet pass).

**Target slug**: derive from filename or directory (e.g., `adversary-skill-spec`, `pipelineRegistry`, `code-2026-03-30`).

**Tri mode**: Launch all three agents in parallel (single message with three Agent tool calls). Each agent gets the same prompt and context but runs at a different model tier — haiku for surface coverage, sonnet for implementation-level analysis, opus for architectural depth. Use `model: "haiku"`, `model: "sonnet"`, `model: "opus"` on the Agent tool calls.

Use this prompt for the reviewer agent:

```
You are an independent reviewer. You did not produce this work. Your job is to
read it cold and find what the author missed — AND what the author over-built.

Your lens: "{framing line — see below}"

## File Format

Start the output file with this YAML frontmatter (fill in values):

---
title: Adversarial Review — {target}
tags: [adversary-review, {domain-specific tags}]
createdDate: {today YYYY-MM-DD}
lastUpdated: {today YYYY-MM-DD}
domain: {bsim | agents | litenovel | comfyui | chat | sprites | infra}
status: draft
lastVerified: {today YYYY-MM-DD}
---

Then write the review body below the frontmatter.

## Work Product
{assembled context from Step 1}

## What to Check

### Gaps & Risks
- Unstated assumptions — what does this assume that isn't written down?
- Edge cases — empty, zero, null, boundary, concurrent, maximum
- Integration risks — does this break existing callers or systems?
- Missing error/failure handling
- Logical contradictions or gaps
- Convention violations (check AGENTS.md)

### Unnecessary Complexity
- Premature abstractions — exists for only one consumer?
- False flexibility — configuration that will never vary?
- YAGNI — features built for hypothetical future requirements?
- Over-engineering — where are 3 simple lines better than 1 clever abstraction?

{FOR RESEARCH TARGETS ONLY, append:}
### Research-Specific
- Unsupported claims — assertions without cited evidence
- Source conflicts — disagreements presented as consensus
- Selection bias — contrary evidence omitted
- Logical leaps — conclusions that don't follow from evidence

## Output Format (STRICT — follow exactly)

Output ONLY the structured format below. No prose preamble.

1. ISSUE: [specific problem — quote the exact line/section]
   SEVERITY: P0 (will cause failures) | P1 (will cause bugs) | P2 (quality gap)
   LENS: Gap | Complexity | Research
   FIX: [concrete, actionable fix — specific enough to apply without further research]
   — OR —
   QUESTION: [open question with reasoning for why this can't be cleanly resolved]

Use FIX when you know the answer. Use QUESTION when the issue is real but the
resolution involves a tradeoff, missing data, or architectural tension that
needs human judgment. QUESTION must be specific — not "this is hard" but
"this is hard because X, and the tradeoff is between Y and Z."

{AGGRESSIVENESS BLOCK — select one based on aggressiveness level}

FOR LENIENT:
You are in LENIENT mode. Only flag P0 (structural failures that will cause runtime errors, data loss, or security issues). Skip P1 and P2 entirely. If more than 3 P0 issues exist, output only the top 3.

FOR BALANCED (default):
If more than 7 genuine issues exist, output only the top 7 by severity.

FOR AGGRESSIVE:
You are in AGGRESSIVE mode. Flag everything — including minor issues, style concerns, naming inconsistencies, and potential future problems. Lower your threshold: if something looks even slightly wrong, flag it. If more than 12 issues exist, output only the top 12 by severity.
{END AGGRESSIVENESS BLOCK}

If no genuine issues found, output EXACTLY:
No significant issues found. [1-2 sentence reason why the work is solid]

## Simplest Alternative (if complexity issues found)
If you flagged any Complexity issues, end with:
MINIMAL VERSION: [3-5 bullets describing the simplest design that achieves the same goal]

Do NOT manufacture issues. Do NOT suggest style changes. Focus on gaps, risks,
unnecessary complexity, and errors.
```

**Framing lines by target type:**
- Code: "This code works. Find what breaks when assumptions change, and what's built that doesn't need to be."
- Spec: "This spec will be implemented literally. What's missing, what contradicts, and what's over-specified?"
- Plan: "This plan will be executed step by step. What goes wrong, and what steps are unnecessary?"
- Research: "This research will inform decisions. What's unreliable, and what analysis is filler?"

---

## Step 4: Present Findings

After agent(s) complete, **read findings from the file** — the file is the source of truth, not conversation context.

**If agent failed or timed out:** "Adversarial review failed: {error}. Run `/adversary` again to retry."

**If output is malformed** (no ISSUE/FIX structure): "Reviewer produced malformed output. No actionable findings."

**If multi-pass** (haiku + opus, or haiku + sonnet + opus): read all files, merge findings, deduplicate (same issue found by multiple reviewers → keep the most detailed version, note which models flagged it), present unified list sorted by severity.

**Present to user:**

```
## Adversarial Review: {target}

{intensity description} found {N} issue(s): {P0 count} structural, {P1 count} bugs/complexity, {P2 count} minor.

{findings formatted as readable list with LENS tags}

{if MINIMAL VERSION present, include it}

Review saved to: {file path(s)}

Apply all, apply selectively, or dismiss?
```

**Clean review:** "Adversarial review came back clean. {reviewer's reasoning}."

---

## Step 5: Apply (if requested)

If the user says to apply (all or selectively):

1. **Re-load** findings from the review file(s). Do not rely on conversation context — it may have been compacted since Step 4.
2. **Verify premises** — before applying any fix, read the actual code/spec at the cited location. The reviewer may have hallucinated.
3. **Default to applying** unless you can identify a specific factual error in the reviewer's premise. "I considered this and decided otherwise" is not sufficient grounds for rejection — explain what the reviewer got wrong about the code, not about your intent.
4. Apply fixes. For Complexity findings, simplify as suggested. For Gap findings, add the missing handling/coverage.
5. **Produce a structured triage table:**

```
| # | Issue | Lens | Verdict | Reasoning |
|---|-------|------|---------|-----------|
| 1 | [summary] | Gap | APPLIED | Changed X to Y because... |
| 2 | [summary] | Complexity | APPLIED | Removed unnecessary abstraction |
| 3 | [summary] | Gap | REJECTED | Reviewer's premise is wrong: [specific factual error] |
| 4 | [summary] | Gap | DEFERRED | Valid but out of scope |
| 5 | [summary] | Gap | NOTED | Open question — [user's decision or "needs investigation"] |
```

This table is the primary output of Step 5. The human audits rejection reasoning without re-reading the full review.

---

## Design Principles (Reference)

These principles are load-bearing — they come from empirical testing in the pipeline adversarial reviewers and correctless research.

1. **Every issue comes with a FIX or a QUESTION.** Vague complaints are rejected by the prompt format. FIX for problems with clear solutions. QUESTION for genuine tradeoffs, missing data, or architectural tensions — must name the specific tradeoff, not just flag uncertainty.
2. **Reviewer writes suggestions, not commands.** Codex and the human retain authority to disagree. "You may disagree" framing prevents over-correction.
3. **Ownership framing activates self-correction.** When applying feedback, frame as "You previously produced this" — triggers genuine self-correction vs polite acknowledgment.
4. **Cold read means cold.** Reviewer gets the work and minimal orientation context, NOT Codex's reasoning or conversation history. Prompt instructs: "The stated goal may itself be wrong — question it if warranted."
5. **Silence is a valid output.** Clean reviews mean the work is solid, not that the reviewer failed.
