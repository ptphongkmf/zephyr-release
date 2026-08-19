# Dynamic Override System — Architecture Consultation

> Should the runtime config override system be kept, removed, or refactored?
> This document analyzes the current system, its strengths, weaknesses, and proposes an architectural recommendation.

---

## Current System Overview

Zephyr Release has **two** override mechanisms:

### 1. Input-Level Override (`config-override`)
- **When:** Before the operation starts (static, set in CI workflow YAML)
- **How:** User passes inline config via the `config-override` input
- **Merge:** Deep-merged over the config file, then validated via `ConfigSchema`
- **Location:** `src/tasks/configs/config.ts`

This is clean, well-scoped, and doesn't have architectural issues.

### 2. Runtime File Override (`runtime-config-override`)
- **When:** After **every single hook** fires during the operation
- **How:** A command hook script writes a JSON/YAML/TOML file to disk. ZR reads it and deep-merges it into the active config.
- **Merge:** Deep-merged via `@std/collections`'s `deepMerge`, then re-validated via `ConfigSchema`, then pattern context is fully rebuilt from scratch
- **Location:** `src/tasks/runtime-override.ts`

This is the one worth discussing.

---

## How Runtime Override Currently Works (Detailed)

The lifecycle looks like this (using auto flow as example):

```
preRun hook → [check override file] → 
preCalculateVersion hook → [check override file] → 
postCalculateVersion hook → [check override file] → 
preCommit hook → [check override file] → 
postCommit hook → [check override file] → 
preTag hook → [check override file] → 
preRelease hook → [check override file] → 
postRelease hook → [check override file]
```

That's **8 override check points** in auto flow, **6** in review prepare, **4** in review publish, plus **1** in `run.ts` after `preRun`. Total: **~14 call sites** across the codebase.

Each check:
1. Reads the file from disk
2. Parses it (JSON/YAML/TOML)
3. Deep-merges with current config
4. Re-validates through Valibot `ConfigSchema`
5. Rebuilds the entire `patternContext` from scratch (custom patterns, base patterns, datetime, version, tag)
6. Re-exports stale env variables (`ZR_CONFIG`, `ZR_INTERNAL_CONFIG`, `ZR_PATTERN_CONTEXT`)

---

## Strengths

### What Makes It Unique
1. **True runtime dynamism.** Unlike release-please or semantic-release, ZR lets you change config *mid-operation*. A `preCalculateVersion` hook can inspect the commits (available as env vars) and dynamically change the bump strategy. This is genuinely powerful.

2. **The hook+override combo is like a plugin system.** Users can write arbitrary scripts that produce config changes, turning ZR into a programmable release engine rather than a rigid tool.

3. **No API surface needed.** Instead of building a formal plugin API (which is a massive undertaking), the file-based override gives users the same power with zero API coupling.

### Real Use Cases That Justify It
- A hook script that calls an external service to determine if this release should be pre-release or stable, then adjusts `tag.nameTemplate` accordingly
- A hook that reads a `RELEASE_NOTES.md` file and injects it as `changelog.releaseBodyOverride`
- A hook that adjusts the bump strategy based on which files changed (detected by the hook script)

---

## Weaknesses

### 1. Code Duplication Explosion
The override check is copy-pasted after every hook. Each instance is ~20 lines of boilerplate:
```typescript
const _result = await resolveRuntimeConfigOverride(...);
if (_result) {
  runSettings = { ...runSettings, rawConfig: ..., config: ... };
  patternContext = await synchronizeRuntimeStateAfterOverride({...});
  logger.stepFinish(...);
} else {
  logger.stepSkip(...);
}
```
This pattern appears **14 times** across `auto.ts`, `review.prepare.ts`, `review.publish.ts`, and `run.ts`.

### 2. Implicit File-Based Communication
The override mechanism uses a **shared mutable file** as the communication channel. This creates:
- **No clear ownership:** Who wrote the file? When? Which hook?
- **Stale state risk:** If a hook doesn't clear the file, the next hook's override check reads stale data
- **Testing difficulty:** You can't unit test the override behavior without filesystem side effects

### 3. Monorepo Incompatibility (the immediate problem)
As documented in `3_monorepo-implementation-mid-problem.md` Section 3:
- Single shared file path → workspace A's override leaks into workspace B
- Ordering dependency → result depends on which workspace runs first
- No way to scope overrides to a specific workspace

### 4. Performance Cost
Every override check rebuilds the **entire** pattern context from scratch, even when the file is empty or unchanged. The `synchronizeRuntimeStateAfterOverride` function recreates all custom patterns, base patterns, datetime patterns, version patterns, and tag patterns — plus re-exports 3 env variables.

### 5. The "After Every Hook" Pattern Is Overkill
In practice, the user configures `runtimeConfigOverride` with a single file path. The same file is checked after every hook. But realistically:
- Most users only need to override config at **one specific point** (e.g., after `preCalculateVersion`)
- The other 13 checks are wasted I/O and computation
- The user has no control over *which* hooks trigger an override check

---

## Options

### Option A: Remove It Entirely

**Pros:**
- Eliminates 14 call sites of boilerplate
- Simplifies the workflow code dramatically (each workflow file shrinks by ~40%)
- No monorepo complications

**Cons:**
- Loses the unique "programmable release" capability
- Users who depend on it would need to migrate to a different approach
- The `config-override` input is static — it can't react to runtime data

**Verdict:** Too aggressive. The dynamism is a genuine differentiator.

---

### Option B: Keep As-Is

**Pros:**
- Works today for single-repo
- No refactoring effort

**Cons:**
- Monorepo incompatible (workspace leak problem)
- 14 duplicated code blocks
- Performance waste on empty checks
- Hard to reason about state flow

**Verdict:** Not viable for monorepo. Even for single-repo, the code quality cost is high.

---

### Option C: Refactor — Scoped Override Points (Recommended)

Instead of checking the override file after **every** hook, let the user **declare which hook point(s)** should trigger an override check.

#### Design

Add an optional `applyAt` field to `runtimeConfigOverride`:

```typescript
// Current:
runtimeConfigOverride: {
  path: ".zephyr-override.json",
  format: "auto"
}

// Proposed:
runtimeConfigOverride: {
  path: ".zephyr-override.json",
  format: "auto",
  applyAt: ["preCalculateVersion"]  // NEW: only check after this hook
}
```

`applyAt` is an array of `CommandHookKind` values (the existing hook names). If omitted, default to `["preRun"]` (check once at the start, after the first hook — backward compatible with the most common use case).

#### Implementation

1. **Remove the 14 duplicated override checks** from the workflow files
2. **Move the override check into `runCommands`** (or a wrapper). After a hook fires, check if the current hook kind is in `config.runtimeConfigOverride.applyAt`. If yes, read and merge the file.
3. **Single call site.** The override logic lives in one place. The workflows just call hooks and don't care about overrides.

```typescript
// In a new utility or extending runCommands:
async function executeHookWithOverride(
  hookKind: CommandHookKind,
  runSettings: OperationRunSettings,
  patternContext: StringPatternContext,
  ...
): Promise<{ runSettings: OperationRunSettings; patternContext: StringPatternContext }> {
  // 1. Run the hook commands
  await runCommands(runSettings.config.commandHooks, hookKind);
  
  // 2. Check if override should apply at this hook
  const applyAt = runSettings.config.runtimeConfigOverride?.applyAt ?? ["preRun"];
  if (!applyAt.includes(hookKind)) {
    return { runSettings, patternContext };
  }
  
  // 3. Read and merge override
  const result = await resolveRuntimeConfigOverride(...);
  if (!result) return { runSettings, patternContext };
  
  // 4. Rebuild state
  const newPatternContext = await synchronizeRuntimeStateAfterOverride({...});
  return {
    runSettings: { ...runSettings, rawConfig: result.rawResolvedRuntime, config: result.resolvedRuntime },
    patternContext: newPatternContext,
  };
}
```

#### Benefits
- **Workflows become clean:** Each workflow file shrinks by ~40%. No more copy-pasted override blocks.
- **User has control:** They declare exactly when the override applies.
- **Performance:** Only checks the file at the declared hook points, not after every hook.
- **Monorepo compatible:** Override only fires at global hook points (outside the workspace loop). Users know exactly when it fires.
- **Testable:** Single function to test instead of 14 copies.
- **Backward compatible:** Default `applyAt: ["preRun"]` means existing configs keep working.

#### Considerations
- Slightly more complex schema (one new optional array field)
- Users need to understand hook names to use `applyAt` (but they already need to understand them for `commandHooks`)

---

### Option D: Refactor — Event-Based Override (More Ambitious)

Instead of file-based communication, hooks could return structured data that ZR interprets as config overrides.

```yaml
command-hooks:
  pre-calculate-version:
    cmd: "node scripts/dynamic-config.js"
    captureOutput: true  # NEW: capture stdout as config override
```

The script would print JSON to stdout, and ZR would parse it as a config override.

**Pros:**
- No file I/O
- No stale file risk
- Natural for scripts
- Easy to test

**Cons:**
- Breaking change to hook contract
- stdout might contain other output (logging, warnings)
- Need a framing protocol (e.g., `---ZR_CONFIG_START---` / `---ZR_CONFIG_END---`)
- More complex implementation

**Verdict:** Good future enhancement but too ambitious for Phase 3. Can be added alongside Option C later.

---

## Recommendation

**Go with Option C (Scoped Override Points)** for Phase 3.

It solves all the current problems:
1. ✅ Eliminates 14 duplicated code blocks → 1 utility function
2. ✅ User controls when override fires → no wasted checks
3. ✅ Monorepo compatible → fires at global level, user knows when
4. ✅ Backward compatible → default `applyAt` preserves existing behavior
5. ✅ Preserves the "programmable release" differentiator

The refactor is contained: it only touches the workflow files and adds one schema field. The core override logic (`resolveRuntimeConfigOverride`, `synchronizeRuntimeStateAfterOverride`) stays unchanged.

### Should This Be In Phase 3 Scope?

This is a judgment call:

**Yes (do it in Phase 3):**
- The workflow refactor for monorepo is already touching `auto.ts`, `review.prepare.ts`, `review.publish.ts`. Doing the override refactor at the same time avoids duplicating all 14 override blocks in the new workspace-looped code.
- It would be painful to first copy-paste 14 override blocks into workspace-aware code, then refactor them out in a follow-up.

**No (defer to Phase 4):**
- Phase 3 is already the largest phase. Adding more scope is risky.
- The runtime override can simply be disabled in the workspace loop (global-only) for Phase 3, and refactored later.

My recommendation: **Do the refactor in Phase 3.** The cost of NOT doing it is duplicating 14 override blocks into even more complex workspace-looped code, only to rip them all out later. The refactor itself is mechanical — extract the pattern into a utility function, add `applyAt` to the schema, and simplify the workflows.

---

## Follow-Up Answers

### Q1: "The whole point of 'after every hook' is that we don't know which hook the user wants. Isn't that why we check every one?"

You're right, and I was imprecise. The *intent* of checking after every hook is absolutely correct — give the user maximum flexibility. My criticism was mislabeled. The problem is **not** that we check at every hook. The problem is the **implementation approach**:

We achieve "check at every hook" by manually copy-pasting ~20 lines of override boilerplate after each hook call site. This means:

- 14 nearly identical code blocks across 4 files
- Every time a new hook is added, the developer must remember to add the override block
- Every time the override logic changes (e.g., new params to `synchronizeRuntimeStateAfterOverride`), it must be updated in 14 places

The fix isn't to check at fewer hooks — it's to **keep checking at every hook but do it through a single utility function** instead of 14 copies. The `applyAt` idea from Option C was actually unnecessary for solving the code quality problem. A simpler refactor achieves the same goal:

```typescript
// Before: 14 copies of this pattern scattered across workflow files
const _result = await resolveRuntimeConfigOverride(rawConfig, config, workspacePath);
if (_result) {
  runSettings = { ...runSettings, rawConfig: ..., config: ... };
  patternContext = await synchronizeRuntimeStateAfterOverride({...});
  logger.stepFinish(...);
} else {
  logger.stepSkip(...);
}

// After: 1 utility function called 14 times (one line each)
({ runSettings, patternContext } = await applyRuntimeOverrideIfChanged(
  hookKind, runSettings, patternContext, { nextVersion, currentVersion }
));
```

The behavior is identical — still checks after every hook. But the implementation is one function instead of 14 copies.

That said, the `applyAt` field could still be useful as an **opt-in optimization** (skip the file read when the user knows they only write to it in one hook). But it's a nice-to-have, not a requirement. We can add it later if users ask for it.

### Q2: "Monorepo is breaking anyway, so no need to worry about backward compatibility"

Acknowledged. This simplifies the design space significantly. We don't need to preserve `applyAt` defaults or worry about existing configs. We can make any structural changes we want to the override system in Phase 3.

### Q3: "How would Options C and D solve the stale file / workspace leak problem?"

Honest answer: **they don't, by themselves.**

Let me be precise about what the monorepo problem actually is:

```
Workspace loop iteration 1 (core):
  preCalculateVersion hook → script writes .zephyr-override.json
  [override check] → reads file → merges into config ← INTENDED for core

Workspace loop iteration 2 (cli):
  preCalculateVersion hook → script does NOT write anything
  [override check] → reads SAME .zephyr-override.json (still has core's data)
  → merges into cli's config ← UNINTENDED, core's override leaks into cli
```

The core issue is: **a shared mutable file path + a per-workspace loop = cross-contamination.**

Neither Option C (`applyAt`) nor Option D (stdout capture) inherently fixes this. They solve code quality problems but not the monorepo scoping problem.

There are really only **three ways** to solve the monorepo scoping problem:

#### Solution 1: Override fires at global level only (simplest, already our plan)

Runtime config override only fires **outside** the workspace loop. Inside the workspace loop, hooks can still run, but the override file is not checked.

```
[override check after preRun hook] ← GLOBAL, fires once
FOR core:
  preCalculateVersion hook → runs (no override check)
  ...
FOR cli:
  preCalculateVersion hook → runs (no override check)
  ...
[override check after postRun hook] ← GLOBAL, fires once
```

**Status quo:** This is what we already decided in `3_monorepo-implementation-mid-problem.md`. It's safe, simple, and sufficient for Phase 3.

**Limitation:** Users can't dynamically adjust per-workspace config at runtime. But they can still:
- Define per-workspace static config in the `workspace` config object
- Use global-level overrides that affect all workspaces equally

#### Solution 2: Per-workspace override file paths (future)

Each workspace gets its own override file path, auto-derived from the workspace name:

```
runtime-config-override:
  path: ".zephyr-override-{{ name }}.json"  # template-resolved per workspace
```

Or auto-suffixed:
```
core → reads .zephyr-override-core.json
cli  → reads .zephyr-override-cli.json
```

This fully isolates workspace overrides. Hook scripts receive `ZR_NAME` as an env var so they know which workspace they're running for, and can write to the correct file.

**This is the clean long-term solution**, but it adds complexity and should be deferred.

#### Solution 3: Stdout capture (Option D, also future)

If hooks capture stdout as override data, the isolation is natural — each hook invocation's stdout is consumed immediately and discarded. No file, no leak.

```
FOR core:
  preCalculateVersion hook → stdout: {"tag":{"type":"annotated"}} → applied to core only
FOR cli:
  preCalculateVersion hook → stdout: (nothing) → no override for cli
```

This is the cleanest conceptually, but requires the most work (framing protocol, output parsing, error handling).

### Final Recommendation (Updated)

For Phase 3:

1. **Extract the override pattern into a utility function** — collapse 14 copies into 1 function. This is a code quality win regardless of anything else.
2. **Override fires at global level only** (Solution 1 above). Inside the workspace loop, hooks run but override is not checked.
3. **Defer per-workspace override** (Solution 2 or 3) to a future phase.

Since monorepo is breaking anyway, we can also take this opportunity to clean up the override API if we want (e.g., rename fields, restructure). But the core mechanism stays the same.

---

### Q4: "When workspace is true, root commandHooks runs globally, per-workspace hooks read from workspace config? And no inheritance?"

Your question exposed a gap in the current plan. Here's the situation:

**Current plan:** `WorkspaceMemberConfigSchema` does **NOT** include `commandHooks` or `runtimeConfigOverride`. These exist only in `BaseLifecycleConfigSchema`, which is root-only.

**What the workflow pseudocode shows:** Hooks like `preCalculateVersion`, `preTag`, `preRelease` fire inside the per-workspace loop — but since the workspace config has no `commandHooks`, they would all read from `root.commandHooks`. This means:

```
FOR core:
  preCalculateVersion hook → runs root's preCalculateVersion command
FOR cli:
  preCalculateVersion hook → runs root's preCalculateVersion command (same command!)
```

The same hook script runs for every workspace. The only way the script knows which workspace it's working on is through the env var `ZR_NAME` (set before each workspace iteration).

**Is this good or bad?** It depends:

#### Option A: commandHooks are global-only (current plan, simplest)

Hook commands are defined once at root level. They run at each lifecycle point. Inside the workspace loop, each iteration sets `ZR_NAME` before firing the hook so the script can branch:

```bash
# User's preCalculateVersion script:
if [ "$ZR_NAME" = "core" ]; then
  echo "Special handling for core"
fi
```

**Pros:** Simple. One set of hooks. No inheritance question.
**Cons:** The script must do its own workspace dispatch. No way to have completely different hook scripts per workspace.

#### Option B: commandHooks are per-workspace with inheritance (more powerful)

Add `commandHooks` to `WorkspaceMemberConfigSchema`. Merge behavior:

```jsonc
{
  // Root defines global hooks
  "command-hooks": {
    "pre-calculate-version": "node scripts/global-pre-calc.js",
    "post-release": "node scripts/notify.js"
  },
  "workspace": {
    "packages/core": {
      "name": "core",
      // core overrides preCalculateVersion, inherits postRelease from root
      "command-hooks": {
        "pre-calculate-version": "node scripts/core-pre-calc.js"
      }
    },
    "packages/cli": {
      "name": "cli"
      // cli has no command-hooks, inherits ALL from root
    }
  }
}
```

**The inheritance question:** Since we use `deepMerge` with `{ arrays: "replace" }`, the merge behavior would be:
- If workspace defines `commandHooks.preCalculateVersion`, it **replaces** root's
- If workspace does NOT define `commandHooks.preCalculateVersion`, root's value is **preserved** (inherited)
- This is field-level inheritance (per hook kind), NOT all-or-nothing

This actually works naturally with our `deepMerge` approach. No special code needed — `deepMerge` already gives us per-field inheritance.

**Pros:** Each workspace can have its own scripts. Natural inheritance via deepMerge.
**Cons:** More config surface area. Slightly more complex mental model.

#### Option C: commandHooks are per-workspace, NO inheritance

If workspace defines `commandHooks`, it completely replaces root's. If undefined, root's is used.

This would require explicit handling — check if the raw workspace config has a `commandHooks` key, and if so, use it entirely instead of merging.

**Pros:** Simpler mental model (all or nothing).
**Cons:** User must copy ALL hooks if they want to change just one. Defeats the purpose.

#### Recommendation for Q4

**Go with Option B** (per-workspace with inheritance via deepMerge). Reasons:

1. It's free — `deepMerge` already does field-level merge. No extra code.
2. It's the "least surprise" for users. If you override one hook, you keep the others.
3. Add `commandHooks` to `WorkspaceMemberConfigSchema` (optional, defaults to `{}`).
4. `runtimeConfigOverride` stays global-only (NOT in workspace member config). This is an explicit design choice — runtime override is a global mechanism.

The lifecycle would be:

```
[Global hooks: preRun] → uses root.commandHooks
  [Runtime override check] → global

FOR core:
  [Per-workspace hooks: preCalculateVersion] → uses deepMerge(root.commandHooks, core.commandHooks)
  [NO runtime override check inside loop]
  ...

[Global hooks: postRun] → uses root.commandHooks
```

**Important nuance:** `preCommit` and `postCommit` are tricky. In grouped mode, there's a single commit for all workspaces. These should fire at global level (using root hooks), not per-workspace. Same for `postProposal`. Only version/tag/release hooks make sense per-workspace.

So the actual split would be:

| Hook | Fires at | Config source |
|---|---|---|
| `preRun` | Global (once) | Root only |
| `preCalculateVersion` | Per-workspace | Merged (root + workspace) |
| `postCalculateVersion` | Per-workspace | Merged (root + workspace) |
| `preCommit` | Global (once, after all workspaces prepared) | Root only |
| `postCommit` | Global (once) | Root only |
| `postProposal` | Global (once) | Root only |
| `preTag` | Per-workspace | Merged (root + workspace) |
| `preRelease` | Per-workspace | Merged (root + workspace) |
| `postRelease` | Per-workspace | Merged (root + workspace) |
| `postRun` | Global (once) | Root only |

---

### Q5: "Since I prefer API-first, stdout would be better? User won't need checkout just to use override?"

Yes, you're absolutely right, and this is a genuinely strong argument I didn't emphasize enough.

#### The Checkout Problem

With the current file-based override, the hook script must:
1. Be checked out in the repository (or installed somehow)
2. Write a file to the local filesystem
3. ZR reads that file

This means `source-mode: "local"` (or checkout) is effectively required for runtime overrides, even though the rest of ZR can work without checkout (`source-mode: "remote"`).

With stdout capture, a hook command could be:
```yaml
command-hooks:
  pre-calculate-version: "curl -s https://my-api.com/release-config?name=$ZR_NAME"
```

No checkout. No file. The API returns JSON, ZR captures it, merges it. Pure API-first.

#### Design Proposal for Stdout Capture

**Framing protocol:** Since hooks can output anything (logs, warnings, debug info), we need a way to distinguish "this is override config" from "this is just a log line". Two approaches:

**Approach 1: Marker delimiters** (similar to existing `START_OVERRIDE_CHANGES` / `END_OVERRIDE_CHANGES` pattern in commit parsing):

```
some debug output from the script
ZR_CONFIG_OVERRIDE_START
{"tag": {"type": "annotated"}}
ZR_CONFIG_OVERRIDE_END
more log output
```

ZR scans stdout for the markers, extracts the JSON between them, ignores everything else.

**Pros:** Simple. Familiar pattern (already used in commit body parsing). Works with any language.
**Cons:** Marker strings could theoretically appear in legitimate output (very unlikely).

**Approach 2: Separate stream via stderr/file descriptor**

Hook script writes override to stderr (or fd 3), logs to stdout. ZR captures stderr as override.

**Cons:** Counterintuitive (stderr for data, stdout for logs). Some languages make stderr hard to use cleanly.

**Recommendation: Approach 1 (marker delimiters).** It's consistent with ZR's existing patterns and works universally.

#### Can We Do Both File AND Stdout?

Yes. They're not mutually exclusive. In fact, combining them is the cleanest migration path:

1. **Phase 3:** Extract override into utility function. Override fires at global level only. Keep file-based mechanism (works today). Remove file-based from per-workspace loop.
2. **Phase 4 (or later):** Add stdout capture as a second override mechanism. Both coexist:
   - `runtimeConfigOverride.path` — file-based (for scripts that prefer files, or complex multi-file scenarios)
   - Stdout markers — for quick, API-first, no-checkout overrides

The stdout approach would also naturally solve the monorepo problem — each hook invocation captures its own stdout, so there's no shared state between workspace iterations.

#### Updated Architecture Vision

```
Global level:
  preRun hook → [capture stdout + check file] → merge override → global config

Per-workspace loop:
  FOR core:
    preCalculateVersion hook → [capture stdout only] → merge into core's config snapshot
  FOR cli:
    preCalculateVersion hook → [capture stdout only] → merge into cli's config snapshot
    
Global level:
  postRun hook → [capture stdout + check file] → merge override → global config
```

Inside the workspace loop: stdout capture only (naturally scoped). No file check (avoids cross-contamination).
At global level: both mechanisms available.

This is elegant and solves everything, but it's a Phase 4 effort. For Phase 3, we stick with global-only file-based override + the utility function refactor.
