# OpenClaude → Optimized Fork: Bug Fixes & Bloat Removal

> **Fork context**: No Anthropic API. Local models only — qwen3.6 (multimodal, vLLM/LM Studio) and DeepSeek (text-only via OpenAI-compatible endpoint). The OpenAI shim becomes the primary provider interface; Anthropic SDK is bloat.

---

## Bug #1: Token Count = 0 for Local Models

### Verified Root Cause

In `src/services/api/openaiShim.ts:1576-1577`:
```typescript
if (params.stream && !isLocalProviderUrl(request.baseUrl)) {
  body.stream_options = { include_usage: true }
}
```
`stream_options.include_usage` is gated on `!isLocalProviderUrl()` — a heuristic that detects localhost/private IPs. This is intentional (test at `openaiShim.test.ts:413` asserts `stream_options` is `undefined` for local providers), but the guard is overbroad:
- **vLLM** (>=0.19.0) fully supports `include_usage` — it's an OpenAI-compatible extension
- **LM Studio** depends on backend version; newer backends support it
- **Ollama** may silently ignore it

When the flag isn't sent and the server doesn't include usage in stream chunks, `convertChunkUsage()` (line 857) receives `undefined` and returns `undefined` — token counts stay at 0.

### Fix

1. **Remove the `isLocalProviderUrl` guard** — always set `stream_options.include_usage = true`. Most modern OpenAI-compatible servers support it. For servers that reject the field, wrap in a try/catch or detect 400 responses mentioning `stream_options` and retry without it.
2. **Non-streaming path is already handled** (lines 1887-1893 extract `prompt_tokens`/`completion_tokens` from `response.json().usage`). No change needed.
3. **`convertChunkUsage` already handles null** (line 860) — but it expects OpenAI field names (`prompt_tokens`, `completion_tokens`, `prompt_tokens_details`). If a provider returns a non-standard shape, add normalization.
4. **Char-based fallback** (`roughTokenCountEstimation`, `services/tokenEstimation.ts:203`) is `chars / 4` — tuned for GPT-4's tiktoken (English-heavy). For qwen3.6's BPE tokenizer (~1.5–2.5 chars/token for code), this is 1.5–2.5x off. Add model-specific ratios keyed on the model string. For now, the fix in step 1 should make the fallback unnecessary.

### Decision Tree

```
1. Always send include_usage: true
2. On response:
   a. If response.usage exists → normalize to canonical format → done
   b. If response.usage is null/missing → estimate from character count + model-specific ratio → add `estimated: true` flag
```

### Files
- `src/services/api/openaiShim.ts:1576-1577` — remove `!isLocalProviderUrl` guard
- `src/services/api/openaiShim.ts:857-871` — `convertChunkUsage` (may need format normalization)
- `src/services/tokenEstimation.ts:203-208` — add model-specific bytesPerToken ratios

---

## Bug #2: Image Ingestion Bricks the Terminal

### Verified Root Cause — CORRECTED

**The original premise was wrong.** Standard base64 (alphabet: A-Z, a-z, 0-9, +, /, =) **cannot** produce bytes `0x1B` (ESC) or `0x5D` (`]`). These bytes are not in the base64 alphabet. A base64-encoded data URI string is safe ASCII.

**Verified code flow:**
1. Shell tool captures stdout → `isImageOutput()` regex matches `^data:image/...;base64,` prefix
2. `resizeShellImageOutput()` decodes base64 → raw binary buffer → resizes → re-encodes to base64
3. `BashToolResultMessage.tsx:101-110`: when `isImage=true`, renders **`[Image data detected and sent to Claude]`** — NEVER raw base64
4. The image content block goes to the model's API, not the terminal

**Where the actual risk may be:**
- Model text output containing literal ESC sequences (model could emit them in its response)
- Shell output containing raw binary that isn't a data URI (e.g., `cat image.png` pipes raw bytes to stdout, bypassing base64 encoding)
- Tool results that contain unescaped binary

**To verify:** Generate an image, run a shell command that outputs raw binary to stdout, observe terminal behavior. Check if `isImageOutput()` regex misses any image output formats.

### Fix (single layer — not four)

1. **Verify first.** Determine what actually triggers the terminal bricking. The 4-layer defense in the original plan targeted a non-existent attack vector.
2. **If model output escape sequences is the vector:** Add escape-sequence stripping in the stream text handler at `messages.ts:3057` before the text reaches the terminal renderer.
3. **If raw binary shell output is the vector:** Add binary-safe truncation at the boundary where shell tool stdout enters the Ink rendering pipeline (`BashToolResultMessage.tsx` or `OutputLine.tsx`). Replace non-printable bytes with `.` and truncate at a safe length.
4. **Drop terminal image rendering** (Layer 4). This is a new feature, not a bug fix. If needed later, spec it separately.

### Files (revised — single insertion point, not scattered across 5 files)
- `src/tools/BashTool/BashToolResultMessage.tsx` — where stdout enters the render pipeline
- `src/components/shell/OutputLine.tsx` — where output lines are rendered
- `src/utils/messages.ts:3057` — stream text handler (if model output is the vector)

---

## Bloat: Candidates for Removal in an Optimized Fork

### Decision Criteria (published, reproducible)

| Criterion | Threshold | Why |
|-----------|-----------|-----|
| Consumer count | < 3 import sites in `src/` | Single-use code is dead weight |
| Replaceability | stdlib or 5-line reimplementation exists | Don't keep packages for trivial needs |
| Anthropic coupling | Depends on Anthropic API/infra | Fork uses local models only |
| Size | > 2MB with no critical function | Bundle bloat |

### Heavy Dependencies

| Package | Size | Used By | Verdict |
|---------|------|---------|---------|
| `@opentelemetry/*` (11 packages) | ~15MB | Distributed tracing | **Remove** — 0 consumer sites in local-only fork |
| `google-auth-library` | ~10MB | Vertex AI auth | **Remove** — cloud-only |
| `sharp` | ~30MB+ | Image processing | **Keep** — needed for image resize/optimization |
| `@mendable/firecrawl-js` | ~5MB | Web scraping | **Remove** — < 3 consumers |
| `qrcode` | ~1MB | Mobile QR codes | **Remove** — 0 consumers in local fork |
| `@grpc/grpc-js` + `@grpc/proto-loader` | ~8MB | Remote bridge | **Remove** — cloud deployment only |
| `@growthbook/growthbook` | ~2MB | Feature flags | **Remove** — adds runtime complexity |
| `react-reconciler` | ~3MB | Ink rendering | **Keep** — core UI |
| `@anthropic-ai/sdk` | ~5MB | Anthropic API | **Remove** — no Anthropic usage in fork |

### Complex Feature Modules (verified dependency data)

| Module | Files | Ext. Importers | Feature Flag | Risk | Verdict |
|--------|-------|---------------|-------------|------|---------|
| `src/utils/computerUse/` | 14 | 7 (all dynamic imports) | `CHICAGO_MCP` (DISABLED) | **SAFE** | **Remove now** — no static importers |
| `src/services/voiceStreamSTT.ts` | 1 | 3 (all gated) | `VOICE_MODE` (DISABLED) | **CONDITIONAL** | **Remove now** — all paths guarded |
| `src/bridge/` | 33 | 26 (all gated by `BRIDGE_MODE`) | `BRIDGE_MODE` (DISABLED) | **CONDITIONAL** | **Remove now** — dead code in open build |
| `src/services/vcr.ts` | 1 | 2 (static imports) | Self-gated (env) | **CONDITIONAL** | 2 importer edits needed |
| `src/commands/install-github-app/` | 16 | 2 (static imports) | None | **RISKY** | 2 edits: `commands.ts` + type import |
| `src/services/autoDream/` | 4 | 5 (static imports) | Runtime only | **RISKY** | 5 file edits |
| `src/utils/telemetry/` | 8 | ~20 (static imports) | `PERFETTO_TRACING` (unset) | **RISKY** | ~20 file edits — deep in core paths |
| `src/skills/` | 18 | 17 (static imports) | Partial | **RISKY** | ~15 file edits — `main.tsx` + tool files |
| `src/utils/swarm/` | 23 | ~30 (static imports) | None | **RISKY** | ~30 file edits — `main.tsx`, `REPL.tsx` |
| `src/utils/plugins/` | 42 | ~80+ (static imports) | None (core) | **RISKY** | Massive refactor — ~80+ files |
| `src/commands/plugin/` | 16 | 1 (`commands.ts`) | None | **CONDITIONAL** | Remove with plugins or keep |

**Removal order** (least to most entangled):
1. `computerUse/` + `voiceStreamSTT.ts` — done
2. `bridge/` + companion files — done
3. `vcr.ts` — 2 importer edits
4. `install-github-app/` — 2 importer edits
5. `autoDream/` — 5 importer edits
6. (remaining RISKY modules deferred to separate session)

### Qwen3.6 Compatibility Notes (keep/enhance)

| Area | Status | Action |
|------|--------|--------|
| Image format | Qwen uses OpenAI `image_url` blocks (HTTP URLs or base64) | **Compatible** — existing shim already handles this |
| `extra_body` params | Qwen needs `top_k`, `chat_template_kwargs` (enable_thinking, preserve_thinking) | **Enhance** — pass through in the shim |
| Reasoning content | Qwen streams `<think>...</think>` blocks | **Already handled** — `reasoning_content` field at line 1047 |
| Context length | Qwen supports up to 262K tokens natively | **Enhance** — extend max context window config |
| Sampling params | Qwen recommends presence_penalty=1.5, top_k=20 | **Enhance** — add provider-specific default params |

### Fork Strategy

**Core that stays:**
- REPL + query loop
- OpenAI shim (now the primary provider interface)
- Tool system: Bash, Read, Edit, Write, Glob, Grep, WebFetch, Task
- Ink UI rendering
- Token estimation (with model-specific ratios)
- Image handling (sharp + resize/downsample)
- Permission system

**Core that goes:**
- Anthropic SDK and all Anthropic-specific code
- Bridge, swarm, plugins, skills, VCR, telemetry
- grpc, google-auth, firecrawl, qrcode, growthbook
- All cloud-only commands and providers (Vertex, Bedrock, GitHub Models)
- All plugin/skill commands
- Computer use, voice streaming, autoDream

**Result:** Smaller bundle (~40% reduction), faster startup, fewer terminal-bricking vectors, no Anthropic coupling.

---

## Verification Matrix

| Fix | Provider | Mode | Assertion |
|-----|----------|------|-----------|
| Bug #1 | vLLM | Stream | `tokenCount > 0` after conversation |
| Bug #1 | LM Studio | Stream | `tokenCount > 0` or `estimated: true` |
| Bug #1 | vLLM | Non-stream | `tokenCount > 0` (already handled) |
| Bug #2 | Any | Shell `cat image.png` | Terminal does not brick; output is sanitized |
| Bug #2 | Any | Model emits ESC sequences | Terminal does not brick; sequences are stripped |
