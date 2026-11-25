# Proposal: Config schema design for single-repo and monorepo (breaking changes allowed)

Since the project is still on `0.12.1`, backward compatibility does not have to dictate the config shape. I evaluated all four realistic architectures from scratch against the actual codebase:

1. **Single `v.object` + `v.partialCheck` + `overrideAction` (`if` / `then` / `else`)** (recommended)
2. **Unified `workspace` map (`release-please` style, `"workspace": { ".": { ... } }`)** (best alternative if you want a monorepo-first redesign)
3. **Tagged union via `v.variant`** (`"layout": "single" | "monorepo"`)
4. **Plain `v.union` + `v.strictObject`** (the previous `draft-4.md` design)

My verdict does not change just because breaking changes are free: **Option 1 is still the cleanest design for both the user and the maintainer**, upgraded to strictly forbid dead root `versionFiles` when `workspace` is set. Below is why, with verified test results from running each option against this repo.

---

## Option 1 (recommended): Single `v.object` + `v.partialCheck` + `overrideAction`

Keep the flat, zero-ceremony config format, and use `0.x` freedom to ban the one dead-config footgun (`versionFiles` at root alongside `workspace`, which `workspace-resolver.ts` silently overwrites per member anyway).

```jsonc
// Single repo
{
  "$schema": "...",
  "version-files": { "path": "deno.json", "selector": "$.version" }
}

// Monorepo
{
  "$schema": "...",
  "release-flow": "review",
  "workspace": {
    "packages/core": {
      "name": "core",
      "version-files": { "path": "package.json", "selector": "$.version" }
    }
  }
}
```

### Valibot schema (`src/schemas/configs/config.ts`)

`BaseConfigSchema` stays untouched as the single source of truth. `ConfigSchema` stays one `v.object`, overrides `versionFiles` to optional, and enforces mutual exclusion with two `v.forward(v.partialCheck(...), ["versionFiles"])` checks. This matches the exact pattern already used in `src/schemas/inputs/inputs.ts` (lines 40-59) and works out of the box with `src/utils/formatters/valibot.ts` (lines 7-8).

```ts
import * as v from "@valibot/valibot";
import {
  BaseConfigSchema,
  versionFilesDesc,
  versionFilesSchema,
} from "./base-config.ts";
import { WorkspaceMemberConfigSchema } from "./workspace-member-config.ts";
import { trimNonEmptyStringSchema } from "../string.ts";

const RootConfigSchema = v.object({
  ...BaseConfigSchema.entries,
  versionFiles: v.pipe(
    v.optional(versionFilesSchema),
    v.metadata({ description: versionFilesDesc }),
  ),
  workspace: v.pipe(
    v.optional(
      v.pipe(
        v.record(trimNonEmptyStringSchema, WorkspaceMemberConfigSchema),
        v.minEntries(1),
      ),
    ),
    v.metadata({
      description:
        "Workspace members for monorepo mode. Each key is the relative path " +
        'from repo root to the workspace directory (e.g., "packages/core").\n' +
        "If omitted, Zephyr Release operates in single-repo mode.",
    }),
  ),
});

type RootConfigOutput = v.InferOutput<typeof RootConfigSchema>;

export const requireRootVersionFilesCheck = v.forward(
  v.partialCheck<RootConfigOutput>(
    [["versionFiles"], ["workspace"]],
    (input) => input.workspace !== undefined || input.versionFiles !== undefined,
    'Missing required "versionFiles" (required at root when "workspace" is not configured)',
  ),
  ["versionFiles"],
);

export const forbidRootVersionFilesInMonorepoCheck = v.forward(
  v.partialCheck<RootConfigOutput>(
    [["versionFiles"], ["workspace"]],
    (input) => !(input.workspace !== undefined && input.versionFiles !== undefined),
    '"versionFiles" cannot be set at root when "workspace" is configured (define it inside each workspace member instead)',
  ),
  ["versionFiles"],
);

export const ConfigSchema = v.pipe(
  RootConfigSchema,
  requireRootVersionFilesCheck,
  forbidRootVersionFilesInMonorepoCheck,
  v.metadata({
    title: "Zephyr Release configuration file",
    description:
      "A JSON representation of a Zephyr Release configuration file.",
  }),
);

type _ConfigInput = v.InferInput<typeof ConfigSchema>;
export type ConfigOutput = v.InferOutput<typeof ConfigSchema>;
```

Why `v.partialCheck` instead of `v.check`:

- If a single-repo config has both an invalid `timeZone` and a missing `versionFiles`, `v.check` is skipped, whereas `v.partialCheck([["versionFiles"], ["workspace"]], ...)` still runs and reports both issues.
- If a monorepo config has a broken member (such as `packages/core` missing `versionFiles`), `workspace` fails validation, so `v.partialCheck` does not fire. The user sees only `workspace.packages/core.versionFiles` with no false root error.

### JSON Schema (`scripts/gen-json-schema.ts`)

`@valibot/to-json-schema` (`^1.5.0`) provides an `overrideAction` callback with `{ valibotAction, jsonSchema, errors }`. Matching the exported actions by object identity ties the Valibot rules to the JSON Schema output through TypeScript:

```ts
import {
  ConfigSchema,
  forbidRootVersionFilesInMonorepoCheck,
  requireRootVersionFilesCheck,
} from "../src/schemas/configs/config.ts";

const configSchema = toJsonSchema(ConfigSchema, {
  typeMode: "input",
  definitions: { timeZone: TimeZoneSchema },
  ignoreActions: ["trim", "safe_integer", "to_lower_case"],
  overrideAction: (ctx) => {
    if (ctx.valibotAction === requireRootVersionFilesCheck) {
      return {
        ...ctx.jsonSchema,
        if: { not: { required: ["workspace"] } },
        then: { required: ["versionFiles"] },
        else: { properties: { versionFiles: false } },
      };
    }
    if (ctx.valibotAction === forbidRootVersionFilesInMonorepoCheck) {
      return ctx.jsonSchema;
    }
  },
});
```

Two verified implementation details in `scripts/gen-json-schema.ts`:

1. Using `else: { properties: { versionFiles: false } }` instead of `else: { not: { required: ["versionFiles"] } }` tells VS Code to put the red squiggle directly on the `"version-files"` key rather than underlining the entire root JSON object.
2. `@json-schema-tools/traverse` (`1.15.1`) does **not** visit `if`, `then`, `else`, or `not`. For now we keep `@json-schema-tools/traverse` and patch `transformKeys` with a small loop so `"versionFiles"` inside `then` and `else` is converted properly in `config-v1.kebab.json` and `config-v1.snake.json`:

```ts
for (const keyword of ["if", "then", "else", "not"] as const) {
  if (
    keyword in schema &&
    schema[keyword] &&
    typeof schema[keyword] === "object"
  ) {
    traverse.default(
      schema[keyword] as Record<string, unknown>,
      transformKeys,
      { mutable: true },
    );
  }
}
```

Verified kebab output after traversal:

```json
{
  "if": {
    "not": {
      "required": ["workspace"]
    }
  },
  "then": {
    "required": ["version-files"]
  },
  "else": {
    "properties": {
      "version-files": false
    }
  }
}
```

### Why Option 1 wins

- **Best user config in both modes.** Single-repo stays 3 lines flat. Monorepo swaps root `version-files` for `workspace`. No redundant mode field, no extra nesting.
- **Exact editor diagnostics and intact autocomplete.** Because all properties remain in the single top-level `properties` object, autocomplete is never hidden behind `if`/`then`. Missing `version-files` shows `Missing property "version-files"`. Setting both `version-files` and `workspace` highlights `"version-files"` directly.
- **Exact CI diagnostics.** Verified `formatValibotIssues` output points to `Field: versionFiles` for root violations and `Field: workspace.packages/core.versionFiles` for member violations.
- **Flat JSON Schema.** 5,484 lines instead of 8,312+.
- **Zero TypeScript fallout.** `ConfigOutput` stays a single object. `src/run.ts`, `src/tasks/workspace-resolver.ts`, and `src/schemas/configs/config-preserve-keys.ts` (`"workspace" satisfies keyof ConfigOutput`) all compile untouched. Nothing in `src/` reads `.versionFiles` off `ConfigOutput` (only `src/workflows/review.publish.ts` reads `.versionFiles`, and it reads from `ResolvedConfig`).
- **Works with `"$schema"`.** Does not force `v.strictObject` as a workaround. (If you want typo rejection later, strip `"$schema"` before `transformObjKeyToCamelCase` and turn on `strictObject` deliberately as a separate feature.)

**Honest downside:** the JSON Schema conditional lives in `overrideAction` (~18 lines in `scripts/gen-json-schema.ts`, including the `if`/`then`/`else`/`not` traversal patch) instead of being derived automatically from the JS predicate. Symbol-matching prevents it from going stale on renames or deletions, though editing the predicate means updating those 3 lines of `if`/`then`/`else` next to it.

---

## Option 2: Unified `workspace` always required (`release-please` style)

This is the strongest breaking alternative. Remove `versionFiles` from the root config altogether and require every releasable unit, including a single repo, to be declared under `workspace` (or `packages`):

```jsonc
// Single repo
{
  "$schema": "...",
  "workspace": {
    ".": {
      "version-files": { "path": "deno.json", "selector": "$.version" }
    }
  }
}

// Monorepo
{
  "$schema": "...",
  "release-flow": "review",
  "workspace": {
    "packages/core": {
      "name": "core",
      "version-files": { "path": "package.json", "selector": "$.version" }
    }
  }
}
```

### What is genuinely good about it

- **Cleanest conceptual model for the codebase.** Right now `versionFiles` is the only field in `BaseConfigSchema` that never inherits from root (`workspace-member-config.ts:87`). Moving it out of root makes the split exact: root holds global repo settings and inherited defaults, `workspace` holds every releasable package.
- **Pure Valibot to JSON Schema.** Zero `overrideAction`, zero `if`/`then`, smallest JSON Schema (~5,200 lines), zero union duplication.
- **Simplifies `src/tasks/workspace-resolver.ts`.** The single-repo `as any` bypass on line 33 disappears because single-repo runs through `deepMergeWorkspaceConfig` and `ResolvedConfigSchema` like everything else.

### The hidden costs in this codebase

Once you trace it into the real code, Option 2 is not free:

1. **It moves the conditional-schema problem onto `name`.** In `workspace-member-config.ts:49`, `name` is required for monorepo members (used in `core-v1.0.0`, `ZR_CORE_NEXT_VERSION`, and log headings). Single-repo users do not want to set `"name"` just to get a `v1.0.0` tag. That leaves three awkward choices:
   - Force single-repo users to provide `"name"` inside `workspace["."]` (bad UX).
   - Make `name` conditional on whether the key is `"."` (same conditional-schema problem all over again).
   - Make `name` optional everywhere and auto-derive it from the directory basename (`"packages/core"` -> `"core"`) when omitted, while treating a sole `"."` entry as single-repo (`v{{ nextVersion }}`). That works (it is what `release-please` does with `component`), but it also requires runtime duplicate-name checks (for paths like `apps/api/pkg` and `libs/web/pkg`) and changing how `isMonorepoMode` is computed across `run.ts`, `review.prepare.ts`, `review.publish.ts`, `auto.ts`, and `export-variables.ts`.
2. **Permanent UX tax on single-repo users.** Most users of a release action have a single repository. Every single-repo config gains an extra nesting level (`workspace["."]`), and every single-repo user hits the classic `release-please` confusion of "do `tag`, `changelog`, and `bump-strategy` go at the root or inside `workspace["."]`?" when both work and mean the same thing.

**When Option 2 makes sense:** if you want Zephyr Release to be explicitly monorepo-first, are ready to make `name` optional with basename fallback, and want to unify single-repo and monorepo inside `workspace-resolver.ts` and the workflows. If you just want to solve the config schema cleanly without making single-repo configs worse, Option 1 is better.

---

## Option 3: Tagged union with `v.variant`

Require an explicit discriminator key such as `"layout": "single" | "monorepo"` (or `"repo-mode"`):

```jsonc
{
  "$schema": "...",
  "layout": "single",
  "version-files": { "path": "deno.json", "selector": "$.version" }
}
```

Tested against the repo with `deno run`, `v.variant` behaves much better than `v.union`:

- `@valibot/to-json-schema` emits `oneOf` with `"const": "single"` and `"const": "monorepo"`, so VS Code narrows to the active branch once `layout` is set.
- `formatValibotIssues` preserves exact field paths (`Field: versionFiles` and `Field: workspace.packages/core.versionFiles`), unlike `v.union`.
- Because `const` already separates the branches, `v.strictObject` is not required, so `"$schema"` passes at runtime.
- `config.layout === "monorepo"` gives TypeScript a real discriminated union and can replace the separate `isMonorepoMode` boolean.

**Why it still loses:**

- Every user pays a permanent boilerplate tax. Single-repo users have to write `"layout": "single"` (`v.variant` cannot default an omitted discriminator), and monorepo users have to write `"layout": "monorepo"` right next to `"workspace": { ... }`.
- JSON Schema still duplicates all root properties in both `oneOf` branches (**8,318 lines**, +52% bloat per casing file).
- Downstream code (`run.ts`, `workspace-resolver.ts`, `config-preserve-keys.ts`) still has to handle the union type.

---

## Option 4 (rejected): Plain `v.union` + `v.strictObject`

Testing the `draft-4.md` design against the real codebase surfaced four concrete failures:

1. **Destroys CI error messages.** `formatValibotIssues` does not unwrap nested union sub-issues. Every config mistake (missing root `versionFiles`, missing member `versionFiles`, typo inside `workspace.packages/core.versionFiles`) collapses into:
   ```text
   Validation error: Invalid type: Expected Object but received Object
     Field: root
   ```
2. **Breaks `"$schema"` at runtime.** `transformObjKeyToCamelCase` turns `"$schema"` into `"schema"`. `v.strictObject` rejects `"schema"`, crashing every config that copies `docs/examples/minimal-zr-config.json` or `docs/examples/zephyr-release-config.jsonc`.
3. **JSON Schema bloat and poor VS Code errors.** 8,312 lines (duplicated root properties inside `anyOf`), and without a `const` discriminator, VS Code falls back to generic `anyOf` mismatch errors.
4. **TypeScript errors.** 4 errors in `src/run.ts:41` and `src/tasks/workspace-resolver.ts:22, 41, 66`, plus `config-preserve-keys.ts` losing `satisfies keyof ConfigOutput`.

---

## Comparison

| Aspect | Option 1: `v.object` + `v.partialCheck` + `overrideAction` | Option 2: Unified `workspace["."]` (`release-please`) | Option 3: `v.variant` (`layout`) | Option 4: `v.union` + `v.strictObject` |
| --- | --- | --- | --- | --- |
| Single-repo minimal config | Flat, 3 lines | Nested under `workspace["."]` | Flat + redundant `layout` | Flat, 3 lines |
| Monorepo config | Clean, bans dead root `versionFiles` | Clean, no root `versionFiles` | Redundant `layout` + `workspace` | Clean |
| CI error messages | Exact field path | Exact field path | Exact field path | Broken (`Field: root` for everything) |
| VS Code diagnostics | Exact (`Missing property`, squiggle on key) | Exact | Good after `layout` is typed | Generic `anyOf` wall |
| `"$schema"` at runtime | Works | Works | Works | Crashes unless stripped |
| JSON Schema lines | 5,484 | ~5,200 | 8,318 | 8,312 |
| TypeScript / workflow changes | None | Medium (`name`, `isMonorepoMode`, `workspace-resolver.ts`) | Small (union narrowing) | Small (union narrowing) |
| Extra code in `gen-json-schema.ts` | ~18 lines (`overrideAction` + `if`/`then`/`else`/`not` traversal patch) | None | None | None |

---

## Final take

Do not let a limitation in `@valibot/to-json-schema` dictate the user-facing config format.

- **Pick Option 1** if you want the best user experience in both single-repo and monorepo configs. Eighteen lines in `scripts/gen-json-schema.ts` (which already contains custom JSON Schema transforms) is a cheap price to keep single-repo configs flat, monorepo configs clean, CI and VS Code errors exact, JSON Schema compact, and TypeScript errors at zero.
- **Pick Option 2** only if you genuinely prefer the `release-please` mental model where every repository is a workspace map and you are happy to redesign `name` (optional with basename fallback), `isMonorepoMode`, and the single-repo onboarding docs to match.
