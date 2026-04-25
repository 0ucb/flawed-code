---
name: test-billionairesim
description: |
  BillionaireSim browser testing via Chrome automation. Verifies features end-to-end in a real browser, catches runtime bugs that tsc misses (wrong wiring, zero-output calculations, missing seed data, broken UI flows).

  Use when: the user says "test this", "test billionairesim", "browser test", or after completing a /build. Also invoked by /build Step 7.
user-invocable: true
---

# BillionaireSim Browser Testing

Verifies BillionaireSim features in a live browser using Chrome automation tools (`mcp__claude-in-chrome__*`). Catches runtime bugs that static analysis cannot: wrong store wiring, broken UI flows, missing data, zero-output calculations, and race conditions.

**Do not delegate browser testing to subagents.** Testing requires iterative diagnosis, code fixes, and re-testing that only the primary session can do.

---

## Required Reading

Before ANY browser interaction, read these files:

1. **`docs/agent-testing-guide.md`** — Project-specific reference: dev toolbar, store access, quickstart setup, verified JS patterns, gotchas
2. **This skill's `MEMORY.md`** (`.Codex/skills/test-billionairesim/MEMORY.md`) — Accumulated learnings from previous testing sessions. New gotchas, broken patterns, corrected snippets. **Read this every time.**
3. **UI map** (if exists) — `docs/explore/build-{feature}-ui-map.md` — Code-verified navigation paths for the feature under test

---

## Phase 1: Setup

1. **Connect**: Call `tabs_context_mcp`. Create a new tab if needed.
2. **Navigate**: Go to `http://localhost:3000/billionairesim?quickstart`. Wait 3s for game init.
3. **Verify stores**: Run `typeof window.__gameStore !== 'undefined'` via `javascript_tool`. If false, the page didn't load correctly.
4. **Verify game state**: Check `window.__gameStore.getState().weekNumber` — should be 1 for a fresh quickstart.
5. **Feature-specific setup**: If testing a feature that needs preconditions (owned venue, advanced weeks, specific NPC state), set them up via JS or dev toolbar clicks now.

### Dev Toolbar Buttons

Use `find` tool to locate, then ref-based clicks. **Never use coordinate clicks on the dev toolbar** — positions are unreliable.

| Button | Effect |
|--------|--------|
| Advance Week | `advanceToWeekEnd()` + `performWeeklyTick()` |
| +$10M | Adds $10M to bank |
| Go to Lot | Navigate to first unpurchased commercial lot |
| Go to Brothel | Navigate to first brothel venue |
| Phone | Open phone panel |
| Work App | Open phone to Work app |

### Store Access

```javascript
window.__gameStore.getState()   // Game: empire, venues, time, locations
window.__npcStore.getState()    // NPCs, relationships, conversations
```

---

## Phase 2: Test Plan

### If invoked from `/build`:
Read the testing checklist (`docs/{feature}-testing-checklist.md`) and UI map. The checklist defines WHAT to test; the test plan defines HOW.

### If invoked standalone:
Ask the user what to test, or infer from context. Write a quick test plan covering the requested flows.

### Writing the test plan

Write to `.Codex/plans/test-{feature}.md`:

1. **Numbered test flows** — each includes:
   - JS snippet to verify data (with pass/fail criteria)
   - UI navigation path (from UI map, verified against component source)
   - What to screenshot
2. **Execution order** — setup-heavy tests first
3. **Bug handling** — P0 fix inline, P1 record, P2 ignore

### Critical rule: Never assume UI flows

Before writing ANY UI navigation in the test plan, verify the path from component source code. Trace: which component renders it → what button/tab leads there → what store action fires on click. **Never infer UI flows from service-layer knowledge.** Even if you just wrote the UI in a previous phase, verify from source — context compaction erases that knowledge.

---

## Phase 3: Execute

Work through the test plan mechanically.

### Data verification (JS)
- Use `javascript_tool` for all data checks — faster and more precise than screenshots
- Batch multiple checks in one call
- Wrap async code in `(async () => { ... })()`
- **Never use `await import(...)`** — dynamic imports fail in browser JS context
- Only access stores via `window.__gameStore` / `window.__npcStore`

### UI verification (screenshots)
- Use `computer` tool `screenshot` for layout, component rendering, visual state
- Use `zoom` to inspect small UI elements (pills, bars, numbers)
- Use `find` + ref-based clicks for all button/tab interactions
- **Save all screenshots and GIFs to `agent-workspace/`** — this directory is gitignored. Never save screenshots to the project root or other tracked directories.

### Time advancement
- Use `find("Advance Week button")` → ref-based click → wait 5s between clicks
- For 3+ weeks: loop of ref-based clicks with waits
- Do NOT try programmatic advancement via dynamic imports

### Bug handling
When a bug is found:
1. **Diagnose** — trace data flow via JS console and code reading. Don't guess.
2. **Classify** — P0 (feature broken/zero output), P1 (notable issue), P2 (cosmetic)
3. **P0: Fix inline** — edit code, run `tsc`, reload browser (`navigate` to quickstart), re-test affected flow
4. **P1: Record** — add to progress file deferred items
5. **P2: Skip** — note and move on

---

## Phase 4: Report & Learn

### Report results
Update the build progress file (if `/build` context) or report directly to user:

```
Tests executed: N
Passed: N
Bugs found: N (P0: N, P1: N, P2: N)
Bugs fixed: [list]
Bugs deferred: [list with repro steps]
```

If P0 bugs were fixed, run `npx tsc --noEmit` to verify fixes compile.

### Update MEMORY.md

After testing, review what you learned this session. Update `.Codex/skills/test-billionairesim/MEMORY.md` with:

- **New gotchas** — things that failed unexpectedly (broken patterns, wrong field names, timing issues)
- **Corrected patterns** — JS snippets that needed fixing, UI paths that were wrong
- **New verified patterns** — JS snippets or navigation flows confirmed working
- **Removed stale entries** — patterns that no longer apply after code changes

Keep MEMORY.md concise — it's read every session. Remove superseded entries rather than accumulating.

### Self-tune the skill

Ask the user: **"Any changes to the testing workflow itself?"** If the user identifies friction, missing steps, or workflow improvements:

- Edit this SKILL.md directly to incorporate the change
- This keeps the skill evolving based on real usage rather than theoretical design

If no changes needed, skip this step silently.

---

## Quick Reference: Verified JS Patterns

### Check brothel shift totals
```javascript
const gs = window.__gameStore.getState();
const reports = Object.values(gs.shiftReports || {});
const night = reports.filter(r => r.shiftSlot === 'night' && r.brothelData);
const t = { served: 0, unmatched: 0, revenue: 0, incidents: 0, regulars: 0 };
for (const r of night) {
  const bd = r.brothelData;
  t.served += bd.customersServed || 0;
  t.unmatched += bd.customersUnmatched || 0;
  t.revenue += Object.values(bd.revenueByCategory || {}).reduce((s, v) => s + v, 0);
  t.incidents += bd.incidentResults?.length || 0;
  t.regulars += bd.regularsServed || 0;
}
JSON.stringify(t, null, 2);
```

### Check reputation & regulars
```javascript
const gs = window.__gameStore.getState();
const b = Object.values(gs.workVenues || {}).find(v => v.category === 'brothel');
const o = b?.ownership;
JSON.stringify({
  reputation: o?.brothelReputation,
  regulars: o?.regularCustomers?.length,
  nextRegularId: o?.nextRegularId,
}, null, 2);
```

### Check worker stats
```javascript
const gs = window.__gameStore.getState();
const ns = window.__npcStore.getState();
const b = Object.values(gs.workVenues || {}).find(v => v.category === 'brothel');
(b?.ownership?.staffAssignments || []).map(s => {
  const npc = ns.npcs[s.npcId];
  return { name: npc?.name, corruption: npc?.corruption, hasAffinity: !!npc?.affinityData, night: s.nightShift };
});
```
