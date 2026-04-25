# Low-Effort Tasks — Agent-Executable Plan

Tasks ordered by risk (lowest first). Each has file paths, line numbers, and exact changes.

---

## Task 1: Remove `computerUse/` — SAFE

**Why safe:** All 7 external references use `require()` inside `feature('CHICAGO_MCP') ? ... : undefined/null` blocks. Flag is disabled in open build. Build process converts to `false ? require(...) : null` — dead code, tree-shaken by bundler.

### Delete
```
src/utils/computerUse/
```
(14 files, all start with `src/utils/computerUse/`)

### Edit: `src/services/mcp/client.ts`
Lines 244-252. Replace:
```typescript
const computerUseWrapper = feature('CHICAGO_MCP')
  ? (): typeof import('../../utils/computerUse/wrapper.js') =>
    require('../../utils/computerUse/wrapper.js')
  : undefined
const isComputerUseMCPServer = feature('CHICAGO_MCP')
  ? (
    require('../../utils/computerUse/common.js') as typeof import('../../utils/computerUse/common.js')
  ).isComputerUseMCPServer
  : undefined
```
with:
```typescript
const computerUseWrapper = undefined
const isComputerUseMCPServer = undefined
```

### Edit: `src/services/mcp/config.ts`
Lines 1512-1516. Replace:
```typescript
const DEFAULT_DISABLED_BUILTIN = feature('CHICAGO_MCP')
  ? (
      require('../../utils/computerUse/common.js') as typeof import('../../utils/computerUse/common.js')
    ).COMPUTER_USE_MCP_SERVER_NAME
  : null
```
with:
```typescript
const DEFAULT_DISABLED_BUILTIN = null
```

### Edit: `src/services/analytics/metadata.ts`
Lines 129-137. Replace:
```typescript
const BUILTIN_MCP_SERVER_NAMES: ReadonlySet<string> = new Set(
  feature('CHICAGO_MCP')
    ? [
        (
          require('../../utils/computerUse/common.js') as typeof import('../../utils/computerUse/common.js')
        ).COMPUTER_USE_MCP_SERVER_NAME,
      ]
    : [],
)
```
with:
```typescript
const BUILTIN_MCP_SERVER_NAMES: ReadonlySet<string> = new Set()
```

### Verify
```
bun test --timeout 120000
```
Expected: same 1240 pass / 14 fail as baseline (pre-existing failures only).

---

## Task 2: Remove `voiceStreamSTT.ts` — CONDITIONAL

**Why conditional:** One static import in `useVoice.ts`, but that file is only loaded when `VOICE_MODE` is enabled (disabled in open build).

### Delete
```
src/services/voiceStreamSTT.ts
src/hooks/useVoice.ts
```

### Edit: `src/hooks/useVoiceIntegration.tsx`
Find the import/require of `useVoice.js` and replace with a no-op. Search for `VOICE_MODE` and `useVoice`. Replace the dynamic require block with:
```typescript
const useVoiceModule = {}
```

### Edit: `src/commands/voice/voice.ts`
Delete this file (command is already gated by `VOICE_MODE` in `commands.ts`).

### Edit: `src/tools/ConfigTool/ConfigTool.ts`
Around line 251, find the `feature('VOICE_MODE')` block that dynamically imports `voiceStreamSTT`. Replace the entire if-block with a no-op:
```typescript
// VOICE_MODE disabled — voice stream STT removed
```

### Verify
```
bun test --timeout 120000
```

---

## Task 3: Remove `vcr.ts` — CONDITIONAL

**Why conditional:** 2 static importers with small edits.

### Delete
```
src/services/vcr.ts
```

### Edit: `src/services/api/claude.ts`
Line ~231. Remove:
```typescript
import { withStreamingVCR, withVCR } from '../vcr.js'
```
Find and remove the call sites of `withVCR()` and `withStreamingVCR()`:
- Search for `withVCR(` → unwrap: remove the function wrapper, keep the inner call
- Search for `withStreamingVCR(` → same: unwrap

### Edit: `src/services/tokenEstimation.ts`
Line 28. Remove:
```typescript
import { withTokenCountVCR } from './vcr.js'
```
Find the call site of `withTokenCountVCR(` → unwrap: remove the function wrapper, keep the inner call.

### Verify
```
bun test --timeout 120000
```

---

## Task 4: Add model-specific token estimation ratios

### Edit: `src/services/tokenEstimation.ts`
After line 207 (`return Math.round(content.length / bytesPerToken)`), add:
```typescript
const MODEL_BYTES_PER_TOKEN: Record<string, number> = {
  qwen: 2.0,
  deepseek: 3.0,
  llama: 2.5,
  mistral: 3.0,
  gemma: 2.5,
  minimax: 3.5,
}

export function roughTokenCountEstimationForModel(
  content: string,
  model: string | undefined,
): number {
  if (!model) return roughTokenCountEstimation(content)
  const lower = model.toLowerCase()
  for (const [key, ratio] of Object.entries(MODEL_BYTES_PER_TOKEN)) {
    if (lower.includes(key)) return roughTokenCountEstimation(content, ratio)
  }
  return roughTokenCountEstimation(content)
}
```

### Edit: `src/utils/tokens.ts`
Line 213-219 area. Where `roughTokenCountEstimation` is called for blocks within `tokenCountWithEstimation`, replace `roughTokenCountEstimation(block.thinking)` with `roughTokenCountEstimationForModel(block.thinking, message.message.model)` etc.

### Verify
```
bun test src/services/tokenEstimation.test.ts src/utils/tokens.test.ts
```

---

## Task 5: Normalize non-standard usage formats in `convertChunkUsage`

### Edit: `src/services/api/openaiShim.ts`
Line 857-871. Replace `convertChunkUsage`:
```typescript
function convertChunkUsage(
  usage: OpenAIStreamChunk['usage'] | undefined,
): Partial<AnthropicUsage> | undefined {
  if (!usage) return undefined

  const promptTokens =
    (usage as any).prompt_tokens ??
    (usage as any).input_tokens ??
    0
  const completionTokens =
    (usage as any).completion_tokens ??
    (usage as any).output_tokens ??
    0
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0

  return {
    input_tokens: promptTokens - cached,
    output_tokens: completionTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: cached,
  }
}
```
This handles providers that return `input_tokens`/`output_tokens` instead of `prompt_tokens`/`completion_tokens`.

### Verify
```
bun test src/services/api/openaiShim.test.ts --test-name-pattern "usage"
```

---

## Task 6: Remove unused `feature()` import

### Edit: `src/services/api/openaiShim.ts`
Line 1. Check if `import { feature } from 'bun:bundle'` is still needed after Task 1 (computerUse removal). If `feature()` is no longer used in this file, remove the import.

### Verify
```
bun test src/services/api/openaiShim.test.ts
```
All 62 tests must still pass.

---

## Execution Order

```
Task 1 (computerUse) → verify
Task 3 (vcr) → verify
Task 2 (voiceStreamSTT) → verify
Task 4 (token ratios) → verify
Task 5 (usage normalization) → verify
Task 6 (cleanup) → verify
```

Run `bun test --timeout 120000` after each task. Do NOT proceed to next task if any new failures appear.

---

## Success Criteria

- All 14 pre-existing failures remain unchanged (no regressions)
- No new test failures
- `bun run typecheck` has no NEW errors (ignore pre-existing ~500 errors)
- `bun run build` succeeds
