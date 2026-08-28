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
