# Phase 3: Mid-Implementation Design Decisions

> Addressing design questions raised during Phase 3 planning.
> This document captures decisions, rationale, and action items.

---

## 1. Deep Merge Strategy

### Decision
Use `deepMerge` from `@std/collections` (already imported in the codebase at `runtime-override.ts`).

### Usage
```typescript
import { deepMerge } from "@std/collections";
import * as v from "@valibot/valibot";
import { ConfigSchema, type ConfigOutput } from "../schemas/configs/config.ts";

// In workspace-resolver.ts:
function deepMergeWorkspaceConfig(
  root: ConfigOutput,
  member: WorkspaceMemberConfigOutput,
): ConfigOutput {
  const merged = deepMerge(root, member, { arrays: "replace" });

  const result = v.safeParse(ConfigSchema, merged);
  if (!result.success) {
    throw new Error(
      `Failed to merge workspace config for "${member.name}": ` +
        formatValibotIssues(result.issues),
    );
  }

  return result.output;
}
```

**Important:** Never use `as ConfigOutput` type casting after `deepMerge`. Always re-validate through `ConfigSchema` via Valibot. This ensures the merged result is structurally valid and catches any shape mismatches introduced by the merge at runtime (not silently at compile time).

This is consistent with `runtime-override.ts` which uses the same function with the same `{ arrays: "replace" }` option, and also re-validates via `v.safeParse(ConfigSchema, ...)` after merging.

### Why `arrays: "replace"`
Workspace arrays (like `versionFiles`, `commitTypes`) should **replace** the root's, not merge/concatenate. If a workspace defines its own `commitTypes`, it means "use ONLY these", not "add these to root's".

---

## 2. `groupProposals: false` — Deferred, But Extensible

### Decision
Implement only `groupProposals: true` (default) in this release. Design the code so `false` can be added later without restructuring.

### Extensibility Points

The key architectural choice: the workflow loop functions should accept a `workingBranchName` parameter rather than deriving it internally. This way:

- **Grouped (current):** Caller passes the single global working branch name.
- **Ungrouped (future):** Caller passes a per-workspace branch name resolved from `DEFAULT_WORKSPACE_WORKING_BRANCH_NAME_TEMPLATE`.

Specifically, the following places must be parametrized (not hardcoded to `runSettings.config.review.workingBranchNameTemplate`):

| File | What to parametrize |
|---|---|
| `bootstrap.ts` | `workingBranchName` resolution — currently uses `config.review.workingBranchNameTemplate` directly. Keep this, but when `groupProposals: false` is added later, the caller will loop and resolve per-workspace. |
| `review.prepare.ts` | `workingBranchResult.name` is already passed in from bootstrap. No change needed. |
| `review.publish.ts` | Proposal lookup already uses the branch name from bootstrap. No change needed. |

**Action item:** Add `groupProposals` to `ReviewConfigSchema` now. In workflow code, add a guard:
```typescript
if (!runSettings.config.review.groupProposals) {
  throw new Error(
    "Ungrouped proposals (review.groupProposals: false) are not yet supported. " +
    "Please set review.groupProposals to true or omit it (default)."
  );
}
```

This makes the schema future-ready without implementing the complex per-workspace branch/PR logic.

---

## 3. Runtime Config Override in Monorepo — Footgun Analysis

### The Problem Illustrated

**Current single-repo flow:**
```
preRun hook → [runtime override check] → preCalculateVersion hook → [runtime override check] → ...
```

Each hook can write to a file (e.g., `.zephyr-override.json`), and the next runtime override check picks it up and deep-merges it into the config. This is a great feature for single-repo: a hook can dynamically adjust the config based on external data.

**Monorepo scenario with per-workspace runtime override:**

Imagine a monorepo with workspaces `core` and `cli`:

```
FOR core:
  preCalculateVersion hook runs → writes .zephyr-override.json with { tag: { type: "annotated" } }
  → runtime override check → config now has tag.type = "annotated"

FOR cli:
  preCalculateVersion hook runs → does NOT write any override
  → runtime override check → reads the SAME .zephyr-override.json (left by core)
  → cli ALSO gets tag.type = "annotated" ← UNINTENDED!
```

The problems:
1. **File pollution across workspaces:** Override file is a single shared file path. Workspace A's hook output leaks into workspace B's config.
2. **Ordering dependency:** The result depends on which workspace runs first. This is fragile and non-deterministic if we ever parallelize.
3. **State accumulation:** Each workspace's override stacks on top of the previous one's, creating a snowball effect.
4. **Cleanup burden:** Who clears the override file between workspaces? If the user's hook doesn't, bugs are silent.

### Decision

Runtime config override fires at the **global level only** (before the workspace loop and after it). It does NOT fire per-workspace inside the loop.

The per-workspace hook points (`preCalculateVersion`, `postCalculateVersion`, etc.) still fire, but they do NOT trigger a runtime config override check. This means:
- Hooks can still run custom scripts per workspace (e.g., `npm run build` in the workspace dir)
- Hooks can still set env vars per workspace
- But hooks **cannot dynamically override the config per workspace** via the runtime override file

This is the safe default. If users need per-workspace config differences, they should define them statically in the workspace config.

### Future Enhancement (if needed)
If per-workspace runtime override is ever needed, it would require:
- Per-workspace override file paths (e.g., `.zephyr-override-core.json`, `.zephyr-override-cli.json`)
- Scoped config snapshots that don't leak between iterations
- This is a significant feature and should be planned separately

---

## 4. Workspace Path Auto-Prepend for File Paths

### Decision
Auto-prepend the workspace path to `versionFiles[].path` and `changelog.path` when the workspace path is not `"."`.

### How It Works

```typescript
// In commit.ts / version-file.ts / changelog.ts:
function resolveWorkspacePath(workspacePath: string, filePath: string): string {
  return workspacePath === "." ? filePath : `${workspacePath}/${filePath}`;
}
```

**User config:**
```jsonc
{
  "workspace": {
    "packages/core": {
      "name": "core",
      "versionFiles": { "path": "package.json", "selector": "$.version" }
    }
  }
}
```

**Internally resolves to:** `packages/core/package.json`

### Schema Description Updates Required

The following schema field descriptions need updating to mention workspace path prepending. Track these in a checklist:

#### Paths that ARE auto-prepended (workspace-relative)

- [ ] `versionFiles > path` in `base-config.ts` — add: *"In monorepo mode, this path is relative to the workspace directory (auto-prepended with the workspace path key)."*
- [ ] `changelog > path` in `changelog-config.ts` — same note

#### Paths that are NOT auto-prepended (always repo-root-relative)

These paths are fetched via source mode or are global. Their schema descriptions should explicitly note:
*"This path is always relative to the repository root, even in monorepo mode."*

- [ ] `runtimeConfigOverride > path` — global, not per-workspace
- [ ] `changelog > releaseBodyOverridePath` — fetched via source mode
- [ ] `changelog > releaseBodyOverrideAltPath` — fetched via source mode
- [ ] `review > titleTemplatePath` — fetched via source mode
- [ ] `review > headerTemplatePath` — fetched via source mode
- [ ] `review > bodyTemplatePath` — fetched via source mode
- [ ] `review > footerTemplatePath` — fetched via source mode
- [ ] `tag > messageTemplatePath` — fetched via source mode
- [ ] `changelog > releaseHeaderTemplatePath` — fetched via source mode
- [ ] `changelog > releaseSectionHeadingTemplatePath` — fetched via source mode
- [ ] `changelog > releaseSectionEntryTemplatePath` — fetched via source mode
- [ ] `changelog > releaseBreakingSectionEntryTemplatePath` — fetched via source mode
- [ ] `changelog > releaseFooterTemplatePath` — fetched via source mode
- [ ] `changelog > releaseHeaderTemplateAltPath` — fetched via source mode
- [ ] `changelog > releaseSectionHeadingTemplateAltPath` — fetched via source mode
- [ ] `changelog > releaseSectionEntryTemplateAltPath` — fetched via source mode
- [ ] `changelog > releaseFooterTemplateAltPath` — fetched via source mode
- [ ] `changelog > fileHeaderTemplatePath` — fetched via source mode

### Documentation Updates

Create a dedicated section in `docs/workspace-config-options.md`:

```markdown
## Path Resolution in Monorepo Mode

In monorepo mode, file paths in workspace member configs are **relative to the workspace directory**.
Zephyr Release automatically prepends the workspace key (the path you used in the `workspace` config object)
to these paths.

For example, given this config:
...workspace: { "packages/core": { versionFiles: { path: "package.json" } } }...

The version file path resolves to `packages/core/package.json`.

**Auto-prepended paths (workspace-relative):**
- `version-files > path`
- `changelog > path`

**NOT auto-prepended (always repo-root-relative):**

All template file paths (e.g., `title-template-path`, `header-template-path`, etc.) are fetched via source
mode and always require the **full path from the repository root**. This is because template files are
typically shared across workspaces (e.g., a single changelog template used by all packages).

- `runtime-config-override > path`
- All `*-template-path` fields (changelog, review, tag)
- `release-body-override-path` / `release-body-override-alt-path`

If a workspace needs its own custom template, the path must be specified from the repo root:
..."headerTemplatePath": "packages/core/.zephyr/header.md"...
```

---

## 5. Environment Variable Name Sanitization

### Decision
Use a **custom minimal sanitizer** that only replaces invalid characters with `_`, without changing casing or restructuring the name. This follows the "least surprise" principle — the output should look as close to the original name as possible.

No `@std/` package exists for this purpose (confirmed via search). We write our own utility and explicitly document the replacement rules.

### Why Not `toConstantCase` / `toKebabCase`?

These functions change casing, strip characters, and restructure the name:
- `@scope/core` → `SCOPE_CORE` (uppercased, lost structure)
- `my-pkg` → `MY_PKG` (uppercased, lost hyphen)

This violates "least surprise". A user naming their workspace `my-pkg` would expect `ZR__my-pkg__NEXT_VERSION` in the output, not `ZR__MY_PKG__NEXT_VERSION`.

### Sanitization Rules

**For environment variable names** — only `[a-zA-Z0-9_]` are valid:
```typescript
function sanitizeForEnv(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
```

**For GitHub Actions output names** — `[a-zA-Z0-9_-]` are valid (hyphens allowed):
```typescript
function sanitizeForOutput(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}
```

### Verified Behavior

| Input Name | Env sanitized | Output sanitized |
|---|---|---|
| `core` | `core` | `core` |
| `my-pkg` | `my_pkg` | `my-pkg` |
| `@scope/core` | `_scope_core` | `_scope_core` |
| `@scope/my-pkg` | `_scope_my_pkg` | `_scope_my-pkg` |
| `CamelCase` | `CamelCase` | `CamelCase` |

Key properties:
- **Casing preserved**: `CamelCase` stays `CamelCase`
- **Hyphens preserved in outputs**: `my-pkg` stays `my-pkg` (only replaced in env)
- **Only truly invalid characters replaced**: `@` → `_`, `/` → `_`

### Implementation

Add to `src/utils/transformers/case.ts`:

```typescript
/**
 * Sanitize a workspace name for use in environment variable names.
 * Replaces any character that is not [a-zA-Z0-9_] with underscore.
 */
export function sanitizeNameForEnv(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Sanitize a workspace name for use in GitHub Actions output names.
 * Replaces any character that is not [a-zA-Z0-9_-] with underscore.
 */
export function sanitizeNameForOutput(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Workspace-specific env key:
export function toWorkspaceEnvKey(workspaceName: string, varName: string): string {
  return "ZR__" + sanitizeNameForEnv(workspaceName) + "__" + toConstantCase(varName);
}

// Workspace-specific output key:
export function toWorkspaceOutputKey(workspaceName: string, varName: string): string {
  return "zr--" + sanitizeNameForOutput(workspaceName) + "--" + toKebabCase(varName);
}
```

Note: `varName` (e.g., `NEXT_VERSION`, `next-version`) still uses `toConstantCase`/`toKebabCase` since those are our own internal key names, not user-provided. Only the **workspace name** portion uses minimal sanitization.

### Documentation

In `docs/export-variables.md`, add a section:

```markdown
### Workspace Variable Name Sanitization

Workspace names are minimally sanitized for use in environment variable and output names.
Only characters that are invalid in the target context are replaced with underscore (`_`).
Casing and structure are preserved.

**Environment variables** — characters not matching `[a-zA-Z0-9_]` are replaced with `_`:

| Workspace Name | Env Var Example |
|---|---|
| `core` | `ZR__core__NEXT_VERSION` |
| `my-pkg` | `ZR__my_pkg__NEXT_VERSION` |
| `@scope/core` | `ZR___scope_core__NEXT_VERSION` |

**GitHub Actions outputs** — characters not matching `[a-zA-Z0-9_-]` are replaced with `_`:

| Workspace Name | Output Example |
|---|---|
| `core` | `zr--core--next-version` |
| `my-pkg` | `zr--my-pkg--next-version` |
| `@scope/core` | `zr--_scope_core--next-version` |
```

Also add a brief note in the workspace member schema description for `name`:

```
"Workspace member name. Required. Used in tags, env vars, and outputs.
For env/output variable naming, characters invalid in shell identifiers are replaced
with underscore (see export-variables docs for the exact rules)."
```

---

## 6. Implementation Order (Updated)

With the above decisions, the updated order is:

1. **3A — Schemas** — workspace-member-config, review.groupProposals, root config workspace key, string template defaults, JSON schema gen
2. **3B — Types & Workspace Resolver** — ResolvedWorkspace type, OperationRunSettings update, workspace-resolver.ts using `deepMerge` from `@std/collections`
3. **3F — Release-As Parsing** — standalone, no workflow dependencies
4. **3C — Affected Workspace Detection** — workspace-detection.ts
5. **3G — Path Resolution** — changelog/version file path prepending, schema description updates
6. **3D — Workflow Refactor** — the big one (auto.ts, review.prepare.ts, review.publish.ts, bootstrap.ts, run.ts). Runtime override stays global-only. Add `groupProposals: false` guard.
7. **3E — Export Variables** — workspace-aware exports using custom minimal sanitizers (`sanitizeNameForEnv`, `sanitizeNameForOutput`)
8. **3H — Documentation** — workspace-config-options.md, config-options.md, export-variables.md, command-hooks.md. Include the full path resolution rules and sanitization tables.

Type check (`deno task check`) after each sub-phase.
