---
name: experiment
description: |
  Turn a pitched idea (strategy, prompt tweak, agent behavior change) into a running experiment plan via the Supervisor tab. Translates the idea into an ExperimentPlan JSON, saves it, and walks the user through launching it in the UI.

  Use when: the user pitches an optimization idea like "what if debate-judge scored blind?", "try adding a planning step to the writer", "test whether self-critique helps the speccer", or any prompt/strategy/agent behavior hypothesis.

  Triggers: "/experiment [idea]", "test this idea", "run an experiment on...", "what if we tried...", "can we test whether..."
user-invocable: true
---

# /experiment — Idea to Running Experiment

Translates a pitched optimization idea into an experiment plan and launches it via the Supervisor tab UI.

---

## Step 1: Classify the Idea

Two questions determine the workflow:

1. **Does a strategy for this idea already exist in `strategies.ts`?**
   - YES → Skip to Step 3 (build plan with `strategyCategories` filter)
   - NO → Go to Step 2 (encode it as a `MutationStrategy`)

2. **Should this test one agent or many?**
   - ONE → Single-group plan
   - MANY → Multi-group plan (one group per agent)

---

## Step 2: Encode the Idea

### If it's a new strategy or prompt tweak:

1. Read `src/lib/agents/v2/mutations/strategies.ts` to understand the format
2. Write the strategy as a `MutationStrategy` object:
   - `id`: kebab-case, descriptive (e.g., `judge-blind-scoring`)
   - `category`: use existing category or create a new one
   - `hypothesis`: one sentence explaining why this should help
   - `applicableTo`: which agent IDs this applies to
   - `modifications`: array of `{ type, target?, content }` — prepend/append/replace/insert-section/remove-section
3. Add it to the appropriate array in `strategies.ts` (DEBATER_STRATEGIES, JUDGE_STRATEGIES, RESEARCH_SYNTHESIZER_STRATEGIES, or REASONING_STRATEGIES)
4. If new category: it auto-appears in `STRATEGY_CATEGORIES` and the UI filter chips **after a server restart** (module-level constant computed at load time)

### Dry-run validation (required for new strategies)

After adding the strategy to `strategies.ts`, verify it applies correctly before building the plan:

1. Read the target agent's current prompt from `public/agents/{agentId}.json` (field: `systemPrompt`)
2. Check that `target` strings for replace/insert-section modifications actually exist in the prompt. Common failures:
   - `replace` target doesn't match (whitespace, newlines, prompt was already modified by a previous strategy)
   - `insert-section` target heading doesn't exist in the prompt
3. If the strategy uses `replace` or `insert-section`, **grep the target agent's prompt** for the exact target string:
   ```
   Use Grep tool to search for the exact target string in public/agents/{agentId}.json
   ```
4. If the target doesn't match, either fix the strategy's target or use `append`/`prepend` instead (these always succeed)
5. **Validation chain**: After `applyStrategy()`, the code calls `validateStrategyResult()` — it checks output differs from input, isn't empty, and isn't too short (<30% of original). If validation fails, the engine tries the next untried strategy, then falls back to freetext rewrite.

### If it targets existing strategies:

No code changes needed — just build the plan JSON with `strategyCategories` filter.

---

## Step 3: Build the Experiment Plan

Create an `ExperimentPlan` JSON:

```json
{
  "id": "{descriptive-kebab-id}",
  "name": "{Human-readable name}",
  "model": "deepseek-chat",
  "groups": [
    {
      "id": "{agent}-{category}",
      "agentId": "{target agent}",
      "inputs": ["{test input for this agent}"],
      "strategyCategories": ["{optional: filter by category}"],
      "maxExperiments": 2,         // mutations per input — increase for deeper exploration
      "successThreshold": 1,       // promotions needed to count group as success
      "onSuccess": "continue",     // alternatives: "expand" (run more), "stop"
      "onFailure": "stop"          // alternative: "continue" (don't stop on failure)
    }
  ]
}
```

**Tuning**: For quick validation, use `maxExperiments: 2, successThreshold: 1`. For thorough exploration, use `maxExperiments: 4, successThreshold: 2`.

**Choosing inputs**: Read `agent-workspace/solidification-criteria.json` for the agent's seed inputs. If the target agent has no entry there, use a seed input from the same pipeline — debate agents share debate-judge's inputs, writer agents use a writing prompt, research-planner shares research-synthesizer's inputs. Or ask the user for a test input.

**Choosing model**: Check the user's typical model. Default `deepseek-chat` for DeepSeek direct API, or `lm-studio-{model-id}` for local models. Ask if unsure.

**`strategyCategories` behavior**: This filters strategies by category, intersected with the strategy's `applicableTo` field. Setting `strategyCategories: ["externalized-reasoning"]` on `debate-advocate` tests all externalized-reasoning strategies that apply to that agent. Omitting `strategyCategories` entirely lets the LLM metaprompt pick from ALL untried strategies (exploratory mode). Note: `strategyCategories` is a soft constraint — it filters the strategies shown to the LLM selector, but the engine trusts the LLM to pick from the offered list.

**Multi-agent sweeps**: Create one group per agent. Set `onFailure: "continue"` (don't stop the sweep on one agent's failure).

---

## Step 4: Save and Launch

1. Save the plan to `agent-workspace/experiment-plans/{id}.json`
2. Tell the user the plan is ready and give them the launch instructions:

```
Plan saved to agent-workspace/experiment-plans/{id}.json

To run it:
1. Open the Supervisor tab (Pipeline Observability > Supervisor)
2. Click "Experiment Plan" mode
3. Click "Load Plan" and select "{id}"
4. Verify the preview looks correct
5. Click "Run Plan"

The plan will run {N} group(s) targeting {agents}. 
Estimated time: ~{N * 3} minutes per group (baseline + mutation cycles).
```

If the user says "just run it", note that the run endpoint returns an SSE stream (not JSON). The plan runs server-side and persists results to disk regardless of whether the stream is watched:

```bash
# Monitor progress (Ctrl+C won't stop the plan, just the stream):
curl -s -N http://localhost:3000/api/agents/experiment-plans/run \
  -H "Content-Type: application/json" \
  -d @agent-workspace/experiment-plans/{id}.json

# Stop a running plan:
curl -X DELETE http://localhost:3000/api/agents/experiment-plans/run

# Results persist to: agent-workspace/experiment-plans/{id}-result-{timestamp}.json
# (timestamp format: 2026-04-02T10-30-45-123Z)
```

---

## Step 5: Analyze Results

After the plan completes (user reports back or you check the result file):

1. Read the result file: `agent-workspace/experiment-plans/{id}-result-{timestamp}.json`
2. Also check the experiment log for details: read recent entries from `agent-workspace/experiments/log.json`
3. Summarize: which strategies promoted, which rejected, what the pattern suggests
4. If the idea worked (promotions): note it in the session, suggest the user let the mutation engine handle CV
5. If the idea failed (all rejected): explain why based on the comparison data, suggest alternatives

**Cross-validation**: After a promotion, the engine automatically re-tests the new version against previous seed inputs (`MUTATION_CROSS_VALIDATE` config). If regressions are detected, they are logged as `cross-validation-regression` experiments but the agent is NOT automatically rolled back. Check the experiment log for regression entries. If regressions outnumber the original promotion's gain, consider manual rollback via the Agent Manager.

---

## Quick Reference: Mutable Agents

| Agent ID | Pipeline | Strategies | Notes |
|----------|----------|-----------|-------|
| `speccer` | team-build | 26+ encoded | Debater + reasoning strategies via `applicableTo` |
| `analyzer` | team-build | freetext-only | Reasoning strategies were net negative |
| `designer` | team-build | freetext-only | No encoded strategies defined |
| `writer-section` | longform-writer | reasoning | Plan-then-execute promoted |
| `writer-reviewer` | longform-writer | reasoning | In QUALITY_AGENTS |
| `research-planner` | deep-research | freetext-only | No encoded strategies defined |
| `research-synthesizer` | deep-research | 8 encoded | Citation, analysis, synthesis, structure categories |
| `debate-framer` | debate | freetext-only | No encoded strategies defined |
| `debate-advocate` | debate | 15+ encoded | Rhetorical, steelman, reasoning strategies |
| `debate-critic` | debate | 15+ encoded | Same pool as advocate |
| `debate-judge` | debate | 11+ encoded | Scoring, verdict, synthesis, anti-bias strategies |

**Freetext-only agents**: Plans targeting these agents will use LLM-generated prompt rewrites instead of encoded strategies. `strategyCategories` has no effect — omit it.

## Quick Reference: Strategy Categories

Read from `STRATEGY_CATEGORIES` in `strategies.ts`. Current categories (sorted):
analysis-depth, anti-bias, citation-quality, concession, engagement-precision, externalized-reasoning, intellectual-framing, rhetorical-tactics, scoring-process, section-architecture, steelman-depth, structure, synthesis-depth, synthesis-quality, verdict-construction

---

## Examples

**User**: "What if the debate judge wrote their verdict before looking at scores?"
**Action**: This is already `judge-verdict-first` in the registry. Build a plan targeting `debate-judge` with `strategyCategories: ["verdict-construction"]`.

**User**: "Try making the speccer list constraints before generating contracts"
**Action**: This maps to `reason-constraint-verify` (externalized-reasoning). Build a plan targeting `speccer` with `strategyCategories: ["externalized-reasoning"]`.

**User**: "I want to test whether adding a 'think step by step' prefix helps any agent"
**Action**: Create a new strategy (`reason-chain-of-thought`, category `externalized-reasoning`, append modification with CoT prefix). Add to REASONING_STRATEGIES. Restart server. Build a multi-group plan sweeping quality agents (skip freetext-only agents — CoT is a strategy, not a freetext concept).
