# OpenClaude — Agent Guide

## Build & toolchain

- **Runtime**: Node >=20. **Bun** is the package manager, test runner, and bundler. `bun install --frozen-lockfile`.
- **Build**: `bun run build` runs `scripts/build.ts`, which bundles `src/entrypoints/cli.tsx` → `dist/cli.mjs`. **Modifies source files in-place** (preprocesses `feature('FLAG')` calls into booleans), then restores them.
- **Typecheck**: `tsc --noEmit` (separate from build — build uses Bun's bundler, not tsc).
- **No lint script** is configured (no `npm run lint`). PR CI does not include a lint step.

## Commands

| Command | What it does |
|---|---|
| `bun run build` | Builds dist/cli.mjs |
| `bun test` | Full JS/TS test suite (Bun test runner) |
| `bun run test:coverage` | Tests + lcov + heatmap HTML |
| `bun run test:provider` | Provider-specific tests (`src/services/api/*.test.ts`) |
| `bun run test:provider-recommendation` | Focused provider profile tests |
| `bun run typecheck` | TypeScript check only |
| `bun run smoke` | Builds and runs `--version` |
| `bun run doctor:runtime` | System health check (provider, reachability) |
| `bun run hardening:check` | `smoke` + `doctor:runtime` |
| `bun run hardening:strict` | `typecheck` + `hardening:check` |
| `bun run dev` | `build` + `dist/cli.mjs` |
| `bun run dev:profile` | Launch with saved profile |
| `bun run dev:ollama` / `dev:openai` / `dev:gemini` | Launch with provider preset |
| `bun run dev:grpc` | Headless gRPC server |
| `bun run verify:privacy` | Check build for banned Anthropic patterns |
| `bun run security:pr-scan -- --base origin/main` | PR intent scan |

## Development workflow

1. `bun install` (first time)
2. `bun run build` or use any `bun run dev:*`
3. `bun run typecheck && bun run smoke` before PR

## Profile system

- `.openclaude-profile.json` (gitignored) stores a named profile with provider env vars.
- `bun run profile:init -- --provider <name> --model <model>` creates it interactively.
- Provider can also be set at launch: `node dist/cli.mjs --provider openai`.
- The profile is applied on next `bun run dev:profile`.

## Feature flags

Controlled in `scripts/build.ts` (pre-processed into source during build). Key disabled flags (requiring Anthropic infra): `VOICE_MODE`, `BRIDGE_MODE`, `DAEMON`, `BG_SESSIONS`, `WEB_BROWSER_TOOL`, `CHICAGO_MCP`. Enabled flags: `COORDINATOR_MODE`, `BUDDY`, `TEAMMEM`, `VERIFICATION_AGENT`, `FORK_SUBAGENT`, and others.

If a runtime error mentions "unavailable in the open build," it's behind a disabled flag.

## Testing

- **JS/TS**: `bun test` (Bun's built-in runner). Focused: `bun test path/to/file.test.ts`.
- **Python**: `python -m pytest -q python/tests` (dependencies in `python/requirements.txt`).
- **Coverage**: `bun run test:coverage` (outputs `coverage/lcov.info` + `coverage/index.html`).
- Test files use `.test.ts` / `.test.tsx` naming. Some live in `src/__tests__/`, most are co-located.

## Privacy

`bun run verify:privacy` checks the bundled output for strings from Anthropic's internal infra. All telemetry to Anthropic endpoints is stripped from the open build. The `scripts/no-telemetry-plugin.ts` plugin stubs out telemetry at build time.

## Structure

- `src/` — core CLI (entrypoint: `src/entrypoints/cli.tsx` → `src/main.tsx`)
- `scripts/` — build, launch, diagnostics, verification
- `python/` — standalone helpers (Ollama provider, Atomic Chat, smart router) with pytest suite
- `vscode-extension/openclaude-vscode/` — VS Code extension (separate package.json)
- `bin/openclaude` — npm-installed launcher (checks `dist/cli.mjs` exists)
- `docs/` — setup guides
- `.github/workflows/` — CI runs: smoke → `bun test` → Python tests → security:pr-scan → provider tests

## Edge cases & quirks

- The entrypoint forcibly sets `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=true` to avoid API errors.
- Pinned deps: `bun.lock`, no `package-lock.json` (gitignored).
- Build produces a single ESM file with external deps (OpenTelemetry, sharp, AWS/Azure/GCP SDKs).
- `dist/`, `node_modules/`, `.openclaude-profile.json`, `reports/`, `coverage/`, `/.claude` are all gitignored.
- `sharp` and `@opentelemetry/*` packages are external in the build — they must be installed at runtime.
