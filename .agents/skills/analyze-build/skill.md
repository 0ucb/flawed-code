---
name: analyze-build
description: |
  Analyze a Team Build pipeline run from its run directory. Reads all artifacts
  (evaluation.json, validation reports, symbol report, lint report, fragments,
  assembled HTML) and produces a comprehensive diagnostic report.

  Use when: the user says "analyze this build", "what happened in that run",
  "tell me about the latest build", or passes a run directory timestamp.
user-invocable: true
---

# Analyze Team Build

Reads a pipeline run directory and produces a structured diagnostic report covering every phase, every gate, every tool output, and the final evaluation scores. Designed to be delegated to a subagent.

---

## Input

The user provides one of:
- A run directory timestamp (e.g., `2026-03-26T06-45-31`)
- "latest" or "last run" → find the most recent directory
- A specific file path

The run directory is at the ABSOLUTE path: `C:\Users\dlee1\Documents\chat project\template-2\agent-workspace\runs\{timestamp}\`

**IMPORTANT**: Always use absolute paths when reading files. The working directory may not be the project root.

## Files to Read

Read ALL of these from the run directory using absolute paths (skip any that don't exist):

| File | Contains |
|------|----------|
| `evaluation.json` | All scores: contractScore, structureScore, rubricScore, behavioralScore, a11yScore. Detailed breakdowns per grader. Model used. |
| `analysis.md` | Analyzer output — what the model understood about the request |
| `brief.md` | Designer output — visual design direction |
| `contracts.md` | Speccer output — interface contracts (IC-DOM, IC-CSS, IC-STY, IC-EVT, etc.) |
| `complexity.txt` | Detected complexity level (low/medium/high) |
| `detected-patterns.json` | UI pattern template IDs matched |
| `required-contracts.json` | Contracts the analyzer required the speccer to include |
| `fragment-structure.html` | Structure builder output |
| `fragment-style.html` | Style builder output |
| `fragment-logic.html` | Logic builder output |
| `symbol-report.md` | Cross-fragment symbol resolution — declared vs referenced vs unresolved |
| `lint-report.md` | HTMLHint linting results |
| `validation-report.md` | Initial contract validation (before fixes) |
| `validation-report-patched.md` | Post-fix validation (after programmatic + fix agent) |
| `assembled.html` | Final assembled artifact (first ~50 lines for structure check) |
| `assembled-patched.html` | Fix agent patched version (check size — 0 bytes = bug) |
| `screenshot.png` | Behavioral grader screenshot (read as image if multimodal) |

## Report Structure

Produce the report in this order:

### 1. Summary Card
```
Prompt: "{userInstruction}"
Model: {model}
Complexity: {complexity}
Duration: {durationMs}ms
Contracts: {passed}/{total} ({contractScore})
```

### 2. Phase 1: Analysis & Design
- **Analyzer**: Length, heading count, complexity detection. Was it thorough?
- **Designer**: Did the brief include colors, fonts, layout direction?
- **Speccer**: How many contracts? Which categories? Were any unusual categories invented (IC-SIM, IC-CAL)?
- **Revision**: Did speccer revision trigger? What were the metrics (specificity, dupRate, balance)?
- **Quality**: Were contracts specific enough? Any vague grep targets?

### 3. Phase 2: Build
- **Fragments**: Size of each fragment. Any suspiciously short (<500 chars)?
- **Gate 4**: Did any builders fail Gate 4? Were any dropped?
- **Symbol Resolution**: How many unresolved symbols? Which types (IDs, classes, CSS vars)?
  - Are unresolved symbols legitimate dynamic classes (classList.add) or real mismatches?
- **Lint**: Any HTML issues? Unclosed tags?

### 4. Phase 3: Assembly & Validation
- **Initial validation**: How many contracts passed on first attempt?
- **Programmatic fix**: Did it run? How many contracts did it fix?
- **Fix agent**: Did it run? What was the before/after contract count?
- **Final validation**: Pass rate. Which contracts still failed? Why?
  - Categorize failures: missing element, wrong ID, vague target, multi-file issue

### 5. Evaluation Scores

| Grader | Score | Key Finding |
|--------|-------|-------------|
| Contracts | X/Y | {summary} |
| Structure | X/10 | {which checks failed} |
| Rubric | X/N | {which criteria failed and why} |
| Behavioral | X/5 | {which checks failed — JS errors? No interactivity? Layout?} |
| Accessibility | X or null | {violations if any} |

### 6. Diagnosis
- **What worked**: Strongest phases/agents
- **What failed**: Root cause of the primary failure mode
- **Symbol resolver signal**: Did it predict any issues that materialized?
- **Comparison to baseline**: If the same prompt has been run before, how does this compare?

### 7. Recommendations
- Would thinking mode help? (If JS errors or truncated logic)
- Would voting help? (If contract quality was borderline)
- Would a different model help? (If the model class is too small)
- Any pipeline improvements suggested by the failure pattern?

## Important Notes

- Read `evaluation.json` FIRST — it has all scores and details in structured form
- The `rubricDetails` array contains the rubric grader's reasoning per criterion — quote it
- The `behavioralDetails` array has exact pass/fail per check with `actual` field — quote it
- Check `assembled-patched.html` file size — if 0 bytes, the fix agent produced empty output (known bug, now fixed)
- Multi-file artifacts (assembled-styles.css, assembled-scripts.js exist) indicate high complexity split
- If `validation-report.md` shows 0/N but `evaluation.json` shows >0, the fix agent rescued it
- Contract categories: DOM (elements), CSS (variables), STY (styling), EVT (events), CDN (libraries), plus model-invented categories (SIM, CAL, etc.)
