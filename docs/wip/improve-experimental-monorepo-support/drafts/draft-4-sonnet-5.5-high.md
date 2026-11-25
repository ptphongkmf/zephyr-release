# Proposal: Make root `versionFiles` conditional on `workspace` without weakening the JSON Schema

> **Status: proposal / proof of concept only.**
> The code below uses a simplified example config, not the real codebase. Before applying any of this, run it against the actual config schema and the existing tests first. Nothing here has been executed yet, and the expected JSON Schema output is an estimate.

## Problem

The action config supports two layouts:

- **Single repo:** `versionFiles` is required at the root.
- **Monorepo:** a `workspace` field maps each member path to a member config (same shape as the root, minus a nested `workspace`). `versionFiles` is required in each member.

Today `versionFiles` is required at the root in both layouts, so monorepo users who only declare `versionFiles` inside members get a validation error for the missing root field.

## Constraints

- The schema is converted to JSON Schema with `@valibot/to-json-schema`, so users get editor validation before CI runs.
- Making root `versionFiles` simply optional is not acceptable: single-repo users would lose the "required" error in their editor.

## Options considered

| Option | Verdict |
| --- | --- |
| Make root `versionFiles` optional | Rejected: removes the required check for single-repo users. |
| Patch the generated JSON Schema by hand | Possible fallback, but adds a post-processing step that can drift from the Valibot schema. |
| `v.variant` with an explicit `mode` field | Rejected: forces a redundant field, since `workspace` already implies monorepo. |
| **`v.union` of two schemas** | **Proposed.** |

`v.variant` needs a literal discriminator value. "Is `workspace` present?" is not a literal check, so a plain `v.union` fits better.

## Proposed schema

Split the root config into two shapes and combine them with `v.union`.

```ts
import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';

const VersionFiles = v.pipe(v.array(v.string()), v.minLength(1));

// Fields shared by root and members
const shared = {
  changelog: v.optional(v.string()),
  // ...other options
};

// Workspace member: versionFiles required, no nested workspace
const MemberSchema = v.strictObject({
  ...shared,
  versionFiles: VersionFiles,
});

// Single repo: versionFiles required, workspace not allowed
const SingleSchema = v.strictObject({
  ...shared,
  versionFiles: VersionFiles,
});

// Monorepo: workspace required, root versionFiles optional
const MonorepoSchema = v.strictObject({
  ...shared,
  versionFiles: v.optional(VersionFiles),
  workspace: v.record(v.string(), MemberSchema),
});

export const ConfigSchema = v.union([MonorepoSchema, SingleSchema]);
export type Config = v.InferOutput<typeof ConfigSchema>;

export const jsonSchema = toJsonSchema(ConfigSchema);
```

### Why `strictObject` everywhere

Valibot object variants differ in how they treat unknown keys:

- `v.object` strips them from the output without an error.
- `v.looseObject` keeps them.
- `v.strictObject` rejects them.

All three schemas use `strictObject` for consistency, and it matters most on `SingleSchema`. With a plain `v.object` there, this input slips through:

```ts
{ versionFiles: ['x'], workspace: { a: {} } } // member "a" is invalid
```

The monorepo branch fails because member `a` has no `versionFiles`. The single-repo branch then succeeds, because it ignores and drops `workspace`. An invalid monorepo config is accepted as a valid single repo.

With `strictObject`, the single-repo branch rejects the unexpected `workspace` key, so the union fails as it should.

On the other schemas it is not needed for correctness, but it gives the same strict behavior everywhere:

- `MonorepoSchema`: unknown root keys (typos) are rejected instead of silently dropped.
- `MemberSchema`: unknown keys are rejected, including a nested `workspace`.

`strictObject` also emits `additionalProperties: false` in the JSON Schema, so the editor flags all of these cases before CI runs.

### Expected JSON Schema (unverified)

Roughly the following. The real output may differ.

```json
{
  "anyOf": [
    {
      "type": "object",
      "properties": { "...": {}, "workspace": {} },
      "required": ["workspace"],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": { "...": {} },
      "required": ["versionFiles"],
      "additionalProperties": false
    }
  ]
}
```

Intended editor behavior:

- A monorepo config without root `versionFiles` matches the first branch.
- A single-repo config without `versionFiles` matches neither branch, so it is flagged.

## Trade-offs

- **Vaguer errors:** `anyOf` errors ("doesn't match any schema") are less specific than those of a single object schema.
- **Some duplication:** `SingleSchema` and `MemberSchema` currently have the same shape. They can share a base or stay separate.
- **Possible fallback:** if editor messages turn out to be too poor, the generated JSON Schema could be post-processed into an `if/then/else` on `required: ["workspace"]`, which Valibot cannot generate directly.
