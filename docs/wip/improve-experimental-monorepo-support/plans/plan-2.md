# Plan 2: `releases` context and `isWorkspace`

## The question

`ReleaseContextEntry` carries an `isWorkspace: boolean`. The caller already knows whether it's in monorepo mode via `runSettings.isMonorepoMode`. Is `isWorkspace` in the entry itself redundant?

## What the code actually does

`addReleasesPatternContext` populates the `{{ releases }}` template variable — an array of objects that template authors can iterate over. Each entry describes one workspace (or the single root repo):

```ts
export interface ReleaseContextEntry {
  name: string;
  nextVersion: string;
  tagName: string;
  isWorkspace: boolean;
}
```

In all three callers (`review.prepare.ts`, `review.publish.ts`, `auto.ts`) the value is always copied directly from `ws.isWorkspace`:

```ts
releaseEntries.push({
  name: wsConfig.name ?? "root",
  nextVersion: format(nextVersion),
  tagName,
  isWorkspace: ws.isWorkspace, // <-- always ws.isWorkspace
});
```

And `ws.isWorkspace` is itself set in `workspace-resolver.ts`:
- `false` for the single-repo entry
- `true` for every monorepo workspace entry

## Is it redundant?

It depends on the scope of "who knows what."

**`runSettings.isMonorepoMode`** answers: "is this run a monorepo run overall?"

**`entry.isWorkspace`** answers: "is *this specific entry in the `releases` array* a monorepo workspace, or the root?"

In single-repo mode both are effectively the same: there is one entry, `isWorkspace` is `false`, and `isMonorepoMode` is `false`.

In monorepo mode both are also redundant at the *workflow level*, because `isMonorepoMode` is `true` and every entry in the array has `isWorkspace: true`. There is no mixed case where some entries are workspaces and others aren't within the same run.

However, `isWorkspace` lives inside `ReleaseContextEntry`, which is a *template-facing data structure*. Its audience is not the workflow code — it's Liquid templates written by users in `bodyTemplate`. A template author iterating `{{ releases }}` has no access to `runSettings.isMonorepoMode`. If they want to branch on "is this entry a workspace or the root repo?", `isWorkspace` is the only way they can do it inside a template expression.

So the duplication is intentional: `isMonorepoMode` is for the Deno workflow code; `isWorkspace` inside each entry is for the template layer.

## Is it actually *useful* in the template?

Currently, in monorepo mode, all entries will always have `isWorkspace: true`, so iterating `releases` and checking `isWorkspace` tells the user nothing they couldn't infer from the length of the array or the `name` field. The field only gains real meaning if the `releases` array could ever contain a mix of workspace and non-workspace entries, which the current architecture doesn't allow.

## Conclusion

`isWorkspace` in `ReleaseContextEntry` is **technically redundant** given the current data model, where a run is either fully single-repo (one entry, `isWorkspace: false`) or fully monorepo (all entries, `isWorkspace: true`). The field was added for template expressiveness but provides no information a template author couldn't already derive.

## Potential action

Remove `isWorkspace` from `ReleaseContextEntry` and from every push-site in `review.prepare.ts`, `review.publish.ts`, and `auto.ts`. Update `docs/string-templates-and-patterns.md` to remove the `isWorkspace` bullet from the `{{ releases }}` entry description.

This is a minor breaking change to the template API if any user currently references `{{ releases[0].isWorkspace }}` in a custom template, but that's unlikely given the feature is still experimental.

---

## Implementation Results (Phase 2)

### 1. `ResolvedWorkspace.isMonorepoMember` removed entirely

The `isWorkspace` (later `isMonorepoMember`) field on the `ResolvedWorkspace` object was completely removed. It was a set-only field that was never read in the codebase, since `runSettings.isMonorepoMode` already provides this exact same information to any caller handling workspaces.

Changed files:
- `src/types/workspace-context.ts` — removed field from `ResolvedWorkspace`
- `src/tasks/workspace-resolver.ts` — removed the field from both single-repo and monorepo resolution paths

### 2. `isWorkspace` removed from `ReleaseContextEntry`

As documented above, the field was redundant. In any given run, either all entries have `isMonorepoMember: true` (monorepo) or the single entry has `isMonorepoMember: false` (single-repo). There is no mixed case. Template authors can use `{{ isMonorepo }}` instead.

Changed files:
- `src/tasks/string-templates-and-patterns/pattern-context.ts` — removed `isWorkspace` from `ReleaseContextEntry`
- `src/workflows/review.prepare.ts` — removed `isWorkspace` from `releaseEntries.push(...)`
- `src/workflows/review.publish.ts` — removed `isWorkspace` from `releaseEntries.push(...)` and from the internal `WorkspacePublishData` interface
- `src/workflows/auto.ts` — removed `isWorkspace` from `releaseEntries.push(...)`

### 3. `{{ isMonorepo }}` string pattern registered

Mirrors `ZR_IS_MONOREPO` from the export variables system. Set to `true` in monorepo mode, `false` in single-repo mode.

- Added `"isMonorepo"` to `FixedBaseStringPattern` union in `src/types/string-patterns.ts`
- Merged `isMonorepo` directly into `addBasePatternContext` in `src/tasks/string-templates-and-patterns/pattern-context.ts` so it is available from the earliest point in the lifecycle (bootstrap)
- Updated `src/workflows/bootstrap.ts` and `src/tasks/runtime-override.ts` to pass `isMonorepoMode` into `addBasePatternContext`
- Updated `docs/string-templates-and-patterns.md` — added `{{ isMonorepo }}` entry to the Base section, updated `{{ releases }}` description to clarify it holds one entry per workspace in monorepo mode
