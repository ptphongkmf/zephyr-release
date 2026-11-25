# Plan 4: Make root `versionFiles` conditional on `workspace`

> **Tracks**: `drafts/draft-4-neon-xhigh.md`
> **Status**: completed

---

## 1. Problem

`BaseConfigSchema` (in `src/schemas/configs/base-config.ts`) declares `versionFiles` as required. `ConfigSchema` (in `src/schemas/configs/config.ts`) spreads `BaseConfigSchema.entries` and adds an optional `workspace` map. Because of that, monorepo configs that declare `versionFiles` only inside each workspace member fail validation:

```text
Validation error: Invalid key: Expected "versionFiles" but received undefined
  Field: versionFiles
```

The fix must:
- Keep root `versionFiles` required in single-repo mode (when `workspace` is omitted).
- Allow monorepo configs to omit root `versionFiles`, and forbid setting dead root `versionFiles` alongside `workspace` (since `workspace-resolver.ts` overwrites it per member).
- Preserve editor validation in the generated JSON Schema (`schemas/v1/config-v1.{kebab,camel,snake}.json`) without duplicating properties or degrading CI error messages.

---

## 2. Approach: Single `v.object` + inline `v.partialCheck` + `overrideAction`

Keep `BaseConfigSchema` untouched as the single source of truth, and keep `ConfigSchema` as one flat `v.object` (`RootConfigSchema`) instead of a `v.union`:

- Override root `versionFiles` to `v.optional(versionFilesSchema)` inside `RootConfigSchema`.
- Enforce mutual exclusion at runtime using two inline `v.forward(v.partialCheck(...), ["versionFiles"])` checks inside `v.pipe(RootConfigSchema, ...)` (matching `src/schemas/inputs/inputs.ts`, handled natively by `src/utils/formatters/valibot.ts`, and preserving free contextual TypeScript inference):
  - `ROOT_VERSION_FILES_REQUIRED_MSG`: requires `versionFiles` when `workspace` is absent.
  - `ROOT_VERSION_FILES_FORBIDDEN_MSG`: rejects root `versionFiles` when `workspace` is set.
- Export the two message strings as constants so `scripts/gen-json-schema.ts` can match each check inside `overrideAction` without pulling checks out of `v.pipe(...)` or depending on fragile `ConfigSchema.pipe[index]` positions.
- Mirror both rules into JSON Schema via `overrideAction`, emitting Draft-07 `if` / `then` / `else`:

```json
{
  "if": { "not": { "required": ["workspace"] } },
  "then": { "required": ["versionFiles"] },
  "else": { "properties": { "versionFiles": false } }
}
```

`else: { properties: { versionFiles: false } }` puts the VS Code squiggle directly on the `"version-files"` key instead of underlining the entire root object.

---

## 3. File-by-file changes

### 3.1 `src/schemas/configs/base-config.ts`

**No changes.** `BaseConfigSchema` stays intact with required `versionFiles`.

### 3.2 `src/schemas/configs/config.ts`

Keep `ConfigSchema` as one `v.object` (`RootConfigSchema`), override `versionFiles` to optional with an explanatory comment, export the two message constants with a comment explaining why they are constants, and keep both `v.forward(v.partialCheck(...), ["versionFiles"])` checks inline inside `v.pipe`:

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

  // Overridden to optional here so monorepo configs can declare `versionFiles`
  // inside each `workspace` member instead of at the root.
  // The actual logic for `versionFiles` (required when single-repo, omitted and
  // disallowed at root when `workspace` is set) is enforced by the partial checks
  // inside `ConfigSchema` below, and mirrored into JSON Schema via
  // `overrideAction` in `scripts/gen-json-schema.ts`.
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

// Exported as constants (instead of inlined strings) so `scripts/gen-json-schema.ts`
// can match each inline `partialCheck` inside `overrideAction` by message without
// pulling the checks out of `v.pipe(...)` (which loses contextual type inference)
// or relying on fragile `ConfigSchema.pipe[index]` positions.
export const ROOT_VERSION_FILES_REQUIRED_MSG =
  'Missing required "versionFiles" (required at root when "workspace" is not configured)';
export const ROOT_VERSION_FILES_FORBIDDEN_MSG =
  '"versionFiles" cannot be set at root when "workspace" is configured (define it inside each workspace member instead)';

export const ConfigSchema = v.pipe(
  RootConfigSchema,
  v.forward(
    v.partialCheck(
      [["versionFiles"], ["workspace"]],
      (input) =>
        input.workspace !== undefined || input.versionFiles !== undefined,
      ROOT_VERSION_FILES_REQUIRED_MSG,
    ),
    ["versionFiles"],
  ),
  v.forward(
    v.partialCheck(
      [["versionFiles"], ["workspace"]],
      (input) =>
        !(input.workspace !== undefined && input.versionFiles !== undefined),
      ROOT_VERSION_FILES_FORBIDDEN_MSG,
    ),
    ["versionFiles"],
  ),
  v.metadata({
    title: "Zephyr Release configuration file",
    description:
      "A JSON representation of a Zephyr Release configuration file.",
  }),
);

type _ConfigInput = v.InferInput<typeof ConfigSchema>;
export type ConfigOutput = v.InferOutput<typeof ConfigSchema>;
```

Key details:
- `ConfigOutput` stays a single flat object type, so `src/run.ts`, `src/tasks/workspace-resolver.ts`, and `src/schemas/configs/config-preserve-keys.ts` compile with zero changes.
- Keeping `v.forward(v.partialCheck(...), ["versionFiles"])` inline inside `v.pipe(...)` gives free TypeScript inference with zero manual generic arguments.
- Because `v.partialCheck` depends only on `[["versionFiles"], ["workspace"]]`, missing root `versionFiles` is still reported when an unrelated field (such as `timeZone`) fails, and does not produce a false root error when a `workspace` member fails validation.
- Keeping `v.object` avoids breaking configs that include `"$schema"` (which `transformObjKeyToCamelCase` turns into `"schema"`).

### 3.3 `scripts/gen-json-schema.ts`

1. **Cleanup (completed):** removed the redundant workspace schema set (`workspace-config-v1.*.json`), renamed `baseSchema` to `configSchema`, and updated comments.
2. **Add `overrideAction` to `toJsonSchema`:** import `ROOT_VERSION_FILES_REQUIRED_MSG` and `ROOT_VERSION_FILES_FORBIDDEN_MSG` from `../src/schemas/configs/config.ts`, narrow with `ctx.valibotAction.type === "partial_check" && "message" in ctx.valibotAction`, and match by message constant (order-independent, zero type casts):

```ts
import traverse, {
  type SyncMutationFunction,
} from "@json-schema-tools/traverse";
import {
  ConfigSchema,
  ROOT_VERSION_FILES_FORBIDDEN_MSG,
  ROOT_VERSION_FILES_REQUIRED_MSG,
} from "../src/schemas/configs/config.ts";

const configSchema = toJsonSchema(ConfigSchema, {
  typeMode: "input",
  definitions: { timeZone: TimeZoneSchema },
  ignoreActions: ["trim", "safe_integer", "to_lower_case"],
  overrideAction: (ctx) => {
    if (
      ctx.valibotAction.type === "partial_check" &&
      "message" in ctx.valibotAction
    ) {
      if (ctx.valibotAction.message === ROOT_VERSION_FILES_REQUIRED_MSG) {
        return {
          ...ctx.jsonSchema,
          if: { not: { required: ["workspace"] } },
          then: { required: ["versionFiles"] },
          else: { properties: { versionFiles: false } },
        };
      }
      if (ctx.valibotAction.message === ROOT_VERSION_FILES_FORBIDDEN_MSG) {
        return ctx.jsonSchema;
      }
    }
  },
});
```

3. **Type transformers with `SyncMutationFunction` and patch `transformKeys` for conditional keywords:** typing `transformKeys` and `transformDescriptions` as `SyncMutationFunction` matches `@json-schema-tools/traverse@1.15.1` and narrows `schema` to `JSONSchemaObject` inside `if (schema && typeof schema === "object")`, so `schema[keyword]` needs no type cast. Because `@json-schema-tools/traverse` (`1.15.1`) does not visit `if`, `then`, `else`, or `not`, add a small loop inside `transformKeys`:

```ts
// conditional keywords skipped by @json-schema-tools/traverse
for (const keyword of ["if", "then", "else", "not"] as const) {
  const sub = schema[keyword];
  if (sub && typeof sub === "object") {
    traverse.default(sub, transformKeys, { mutable: true });
  }
}
```

### 3.4 `src/schemas/configs/resolved-config.ts`

**No changes.** `ResolvedConfigSchema` spreads `BaseConfigSchema.entries` directly and does not touch `ConfigSchema`. `ResolvedConfig["versionFiles"]` stays required everywhere downstream.

### 3.5 `src/schemas/configs/workspace-member-config.ts`

**No changes.** `WorkspaceMemberConfigSchema` already declares its own required `versionFiles` and imports only from `base-config.ts`.

### 3.6 JSON Schema regeneration (`schemas/v1/`)

Regenerate `schemas/v1/config-v1.{kebab,camel,snake}.json` and verify:
- Root `properties` is emitted once (flat schema, no `anyOf` duplication).
- Top-level `if` / `then` / `else` is present and properly cased in all three variants (`versionFiles`, `version-files`, `version_files`).
- Single-repo config without `versionFiles` -> VS Code reports missing `versionFiles` / `version-files`.
- Monorepo config without root `versionFiles` and with valid members -> no error.
- Monorepo config with root `versionFiles` alongside `workspace` -> VS Code flags `versionFiles` / `version-files` directly.
- Monorepo config with an invalid member (missing `versionFiles`) -> VS Code flags that member.
- Empty `workspace: {}` -> VS Code flags `minProperties: 1` on `workspace`.

---

## 4. Order of execution

1. **Clean up `scripts/gen-json-schema.ts`** (single config schema set, renamed `configSchema`).
2. **Update `src/schemas/configs/config.ts`** with `RootConfigSchema` (including the comment above the `versionFiles` override), exported message constants (`ROOT_VERSION_FILES_REQUIRED_MSG`, `ROOT_VERSION_FILES_FORBIDDEN_MSG`) with explanatory comment, and inline `v.forward(v.partialCheck(...), ["versionFiles"])` checks inside `ConfigSchema`.
3. **Update `scripts/gen-json-schema.ts`** with `overrideAction` (matching by message constant), `SyncMutationFunction` typing, and the cast-free `if` / `then` / `else` / `not` traversal loop inside `transformKeys`.
4. **Run `deno task check` and `deno check scripts/gen-json-schema.ts`** to verify zero TypeScript errors.
5. **Run `deno task gen:json-schema`** and inspect `schemas/v1/config-v1.{kebab,camel,snake}.json` for the cased `if` / `then` / `else` block.
6. **Verify runtime validation and IDE checks** against single-repo and monorepo test configs (including updating expectations in `docs/wip/improve-experimental-monorepo-support/tests/schema-test-*.jsonc`).
