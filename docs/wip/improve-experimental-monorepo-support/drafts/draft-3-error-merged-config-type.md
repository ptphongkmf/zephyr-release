# Analysis: `ResolvedWorkspace.config` typing problem

## Is the problem real?

**Yes.** The problem is real and will get worse as we continue.

Currently `ResolvedWorkspace.config` is typed as `ConfigOutput`. This is correct in single-repo mode (the config object passes through `ConfigSchema` unchanged). But in monorepo mode, the resolved workspace config is produced by `deepMergeWorkspaceConfig`, which:

1. Deep-merges root `ConfigOutput` with `WorkspaceMemberConfigOutput`
2. Re-parses through `v.safeParse(ConfigSchema, merged)`
3. Returns `ConfigOutput`

Step 2 is the key. The merged object contains workspace-specific fields like `title` and `review.memberBodyTemplate`, but `ConfigSchema` does not define those fields. Valibot's `v.object()` by default **strips unknown keys** during parsing. So:

- `title` gets **silently dropped** during re-validation
- `review.memberHeaderTemplate`, `review.memberBodyTemplate`, etc. get **silently dropped** because they are not in `ReviewConfigSchema`

This means the type is technically correct today: `ConfigOutput` accurately describes what comes out. But the data we need is gone.

### Two distinct problems

1. **Data loss**: Fields like `title` and `review.member*Template` are stripped by re-validation through `ConfigSchema`. The type is honest, but the runtime value is wrong. We need these fields to survive the merge.

2. **Type narrowness**: Even if we fix the data loss, `ConfigOutput` has no `title` field and no `review.memberHeaderTemplate` field. Downstream code would need `?.` chains or type guards to access them.

### Evidence in existing code

The `wsConfig.name ?? "root"` pattern appears **9 times** across workflows. `name` is `string | undefined` on `ConfigOutput` (optional at root level), but in monorepo mode after merge it always comes from `WorkspaceMemberConfigSchema` where it is required. Every `?? "root"` is defensive noise that the type system should eliminate.

Similarly, when we need `wsConfig.title` in Phase D+, the type does not have it.

---

## Approach evaluation

### Approach 1: Utility type `Omit<ConfigOutput, ...> & WorkspaceMemberConfigOutput`

Simple intersection type. **Rejected** for two reasons:
- It's a lie in single-repo mode: `title` and `name: string` (required) don't exist on the single-repo config.
- It doesn't fix the data loss. We still need a schema change to prevent Valibot from stripping unknown keys.

### Approach 2: Discriminated union via `isMonorepoMode`

The first version of this idea (discriminating on `OperationRunSettings`) is too heavy. Every function that takes `runSettings` must branch on mode just to access workspace config. That's friction for code that accesses shared fields like `tag`, `changelog`, etc.

**But there's a lighter variant**: discriminate at the `ResolvedWorkspace` level, not at `OperationRunSettings`.

```typescript
interface SingleRepoWorkspace {
  path: ".";
  config: ConfigOutput;
}

interface MonorepoWorkspace {
  path: string;
  config: ResolvedWorkspaceConfig; // ConfigOutput + title + review.member*
}

type ResolvedWorkspace = SingleRepoWorkspace | MonorepoWorkspace;
```

This is less disruptive because:
- `OperationRunSettings` stays unchanged (`workspaces: ResolvedWorkspace[]`)
- The workspace loop stays uniform: `for (const ws of affectedWorkspaces)`
- Shared field access (`ws.config.tag`, `ws.config.changelog`) works on both variants since `ResolvedWorkspaceConfig extends ConfigOutput`
- When you need monorepo-specific fields, you narrow once: `if ("title" in ws.config)` or by checking a discriminant

**Problem**: `ConfigOutput` and `ResolvedWorkspaceConfig` don't have a clean discriminant field. We'd need to add one (e.g. `kind: "single" | "monorepo"`), which leaks an implementation concept into the config object. Or we'd use `path === "."` as the discriminant, which is fragile (a monorepo workspace could legitimately be at root).

### Approach 3: Superset type with optional workspace fields

```typescript
export type ResolvedWorkspaceConfig =
  & ConfigOutput
  & {
    title?: string;
    review: ConfigOutput["review"] & {
      memberHeaderTemplate?: string;
      // ...
    };
  };
```

### Re-evaluation: Is the superset a "lie"?

The concern: in single-repo mode, `title` doesn't conceptually exist. Typing it as `title?: string` suggests "this field might be here" when it will never be here.

**But here's the fact**: `title?: string` means the value is `string | undefined`. In single-repo, `title` is `undefined`. In monorepo without user-specified title, `title` is also `undefined`. The type is truthful in both cases. It's imprecise (it doesn't encode "this can only be defined in monorepo"), but it's not wrong.

Compare with how the codebase already handles `name`:
- `ConfigOutput.name` is `string | undefined` (optional at root)
- In monorepo, `name` comes from `WorkspaceMemberConfigSchema` where it's required, so it's always `string`
- But the type still says `string | undefined`, and every callsite does `wsConfig.name ?? "root"`

This is the same pattern. The type is imprecise but the code works correctly. The `??` fallback handles both modes.

### When would the discriminated union actually help?

The discriminated union is valuable when you have functions that **only run in monorepo mode** and would benefit from seeing `name: string` (non-optional) and `title?: string` (field exists). But looking at the codebase:

- The workspace loop runs in **both** modes (single-repo = 1 iteration, monorepo = N)
- Inside the loop, the code already branches on `isMonorepoMode` for logging/env-var purposes (9 occurrences)
- But shared field access (`wsConfig.tag`, `wsConfig.changelog`, `wsConfig.versionFiles`) never branches

The **only** upcoming code that reads workspace-specific fields (`title`, `review.memberBodyTemplate`) is the member section assembly in Phase E, which happens inside the same uniform loop. In single-repo, these fields are `undefined`, and the fallback behavior (use `changelogRelease` directly, skip heading) handles it.

### Verdict (post-implementation)

**Approach 3 (superset with optionals) was initially chosen** but then revised during implementation. The actual solution is:

1. **`ResolvedConfigSchema`** is a `v.strictObject` spreading `BaseConfigSchema.entries` + `WorkspaceMemberConfigSchema.entries`. The workspace member fields overlay the root fields (workspace member wins on conflicts).

2. **`name` is optional** (`string | undefined`) in `ResolvedConfig` — it inherits the optional root config `name` rather than the required workspace member `name`. This is honest: in single-repo mode, `name` may genuinely be undefined.

3. **No type cast** in `workspace-resolver.ts`. Because `ResolvedConfigSchema` requires `title: v.string()`, the single-repo `rootConfig` does not structurally satisfy it. Instead of casting, we construct a valid object dynamically: `{ ...rootConfig, title: rootConfig.name ?? "root" }`.

4. **Monorepo-specific blocks** that require `name` to be non-null use `invariant(wsConfig.name, "Workspace name is required in monorepo mode")` to narrow the type safely within the block, without leaking unsound types to the surrounding scope.

This avoids both the `as unknown as ResolvedConfig` cast and the discriminated union overhead, while guaranteeing `title` is always a string.

---

## Deferred Refactors (Resolved during Phase C.patch)

The following refactorings were identified and addressed alongside the config typing fixes:

### 1. `title` fallback on `ReleaseContextEntry`
**Decision:** Resolve `title` during workspace resolution (`workspace-resolver.ts`). `ResolvedConfig` and `ReleaseContextEntry.title` are both `string` (non-optional). The single-repo `title` fallback is `rootConfig.name ?? "root"`.
**Rationale:** Relying on `releases.length === 1` inside `format_proposal_body` is dangerous (a monorepo release run might only affect a single workspace). `title` should always exist on the resolved config.

### 2. `name` fallback patterns
**Decision:** `name` remains typed as `string | undefined` in `ResolvedConfig`. Monorepo-specific blocks use `invariant(wsConfig.name, ...)` to narrow type safely. Callsite fallbacks (`?? "root"` or `?? ""`) remain as designed. Fallbacks belong at each callsite context, not in the schema.

### 3. `format_releases` transformer naming
**Decision:** Renamed `format_releases` to `format_release_tags` everywhere to be more descriptive.

### 4. Drifting Docs: `name` fallbacks
**Decision:** Synced docs. `docs/export-variables.md` (for `ZR_AFFECTED_WORKSPACES`) and `docs/string-templates-and-patterns.md` (for `releases[i].name`) now accurately describe the `"root"` fallback in single-repo mode.

### 5. `ReleaseContextEntry` location
**Decision:** Moved from `pattern-context.ts` to `src/types/release-context.ts`. `pattern-context.ts` re-exports it for backward compatibility.

### 6. Replace `ConfigOutput` with `ResolvedConfig` in Workspace Loop
**Decision:** All functions operating within the per-workspace loop that take the config object (or a subset of it) now use `ResolvedConfig` (or `Pick<ResolvedConfig, ...>`). The arguments were renamed from `config` to `resolvedConfig` to clearly distinguish them from the global `ConfigOutput`. Global-level tasks (like parsing, stdout overrides, and exporting global variables) continue to use `ConfigOutput`.

---

Implementation: [plan-3-error-merged-config-type.md](../plans/plan-3-error-merged-config-type.md).
