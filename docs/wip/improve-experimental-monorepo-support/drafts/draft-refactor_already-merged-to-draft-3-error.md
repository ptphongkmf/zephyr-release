# Deferred Refactors (Already merged into draft-3-error-merged-config-type.md)

Refactoring items identified during plan-3 implementation. Not blocking progress; can be done after the current plan is complete.

---

## 1. `title` fallback on `ReleaseContextEntry`

**Status: RESOLVED.**

*(OBSOLETE PLAN)*
> `title` on `ReleaseContextEntry` should be `string` (non-optional). The schema says "falls back to `name` if not set," so the fallback is universal. Resolve at push time: `title: wsConfig.title ?? entry.name`. The transformer reads `entry.title` without fallback logic. Same principle as `tagName`.

**Final Decision:** Resolve `title` during workspace resolution (`workspace-resolver.ts`). `ResolvedConfig` and `ReleaseContextEntry.title` are both `string` (non-optional).

**Rationale:**

- Relying on `releases.length === 1` inside `format_proposal_body` is dangerous because in a monorepo, a release run might only affect a single workspace! If only one workspace is affected, `releases.length === 1`, but we *should* still show the heading because it's part of a monorepo.
- `title` should always exist on the resolved config, populated by `wsConfig.title ?? wsConfig.name ?? "root"`.
- The `format_proposal_body` filter can use `this.context.getSync(["isMonorepo"])` to safely decide whether to show headings, completely independent of `releases.length`.

**Implementation:**
Done in `workspace-resolver.ts`. `ResolvedConfigSchema` sets `title: v.string()`. `releaseEntries.push` just passes `wsConfig.title` directly.

## 2. `name` fallback patterns

**Status: RESOLVED.**

| Callsite | Fallback | Reason |
| --- | --- | --- |
| `releaseEntries.push({ name: ... })` | `?? "root"` | Template-facing identifier, must be non-empty |
| `provider.setEnv("ZR_NAME", ...)` | `?? ""` | Env var, empty is the correct "unset" signal |
| `addBasePatternContext` | `undefined` as-is | `{{ name }}` renders empty intentionally |
| `workspaceVersionDataMap.set(...)` | `?? "root"` | Map key, needs non-empty |

*(OBSOLETE PLAN)*
> Do NOT set `"root"` as the schema default for `name`. The fallback belongs at each callsite, not in the schema.
> The `workspaceVersionDataMap.set(wsConfig.name ?? "root", ...)` and `affectedWorkspaces.map(ws => ws.config.name ?? "root")` callsites should ideally read from the already-resolved `ReleaseContextEntry.name` instead of re-deriving the fallback.

**Final Decision:** `name` is typed as `string | undefined` in `ResolvedConfig`. Monorepo-specific blocks use `invariant(wsConfig.name, ...)` to narrow type safely. Callsite fallbacks remain as designed. Fallbacks belong at each callsite, not in the schema.

## 3. `format_releases` transformer naming

**Status: DONE** — renamed to `format_release_tags` everywhere:

- `src/tasks/string-templates-and-patterns/transformers.ts`
- `src/constants/defaults/string-templates.ts`
- `docs/string-templates-and-patterns.md`
- `docs/config-options.md`

*(ORIGINAL NOTE)*
> `format_releases` is too generic compared to `format_proposal_body`. Consider a more descriptive name. (From question.txt TODO.) fix it and dont forget to update its docs accordingly

---

## 4. `name` field type conflict in `ResolvedConfigSchema` (surfaced by Phase C½)

**Status: RESOLVED.**

### The error

`ResolvedConfigSchema` spreads `WorkspaceMemberConfigSchema.entries`, which makes `name: string` (required). But in single-repo mode, `rootConfig.name` is `string | undefined`, so the cast `rootConfig as unknown as ResolvedConfig` is technically unsound.

### Does it matter in practice?

It doesn't cause a runtime bug. In single-repo the cast bypasses re-validation entirely — `rootConfig` is never parsed through `ResolvedConfigSchema`. Only the monorepo path runs `v.safeParse(ResolvedConfigSchema, merged)`, and in that path `merged.name` always comes from the workspace member config where `name` is required (enforced by `WorkspaceMemberConfigSchema`). So the `name: string` requirement is always satisfied at parse time.

### What does `name` mean at each callsite?

Research across docs and code:

| Callsite | Mode | `name` value | Behavior |
| --- | --- | --- | --- |
| `addBasePatternContext(config, ...)` | Single-repo **only** (bootstrap, root config) | `string \| undefined` | `{{ name }}` in templates. If user sets `name: "myapp"`, resolves to `"myapp"`. If unset, renders empty string. This is correct and documented: `name` is optional for single-repo. |
| `provider.setEnv("ZR_NAME", wsConfig.name ?? "")` | Both (per-workspace loop) | `string \| undefined` (single-repo), `string` (monorepo member) | In single-repo, single iteration, `name` is the root `name` or empty. In monorepo, `name` is always set (member required). Docs confirm: monorepo `ZR_NAME` = workspace name; global hooks `ZR_NAME` is "not set (or empty)". Empty `""` is correct signal. |
| `releaseEntries.push({ name: wsConfig.name ?? "root" })` | Both | Template-facing identifier | `"root"` is the display fallback when no name is configured. |
| `workspaceVersionDataMap.set(wsConfig.name ?? "root", ...)` | Both | Map key | Needs non-empty; `"root"` is the fallback key. |
| `affectedWorkspaces.map(ws => ws.config.name ?? "root")` | Both | Array of names for `ZR_AFFECTED_WORKSPACES` | Same pattern. |

### Does single-repo + user-provided `name` work?

Yes. If a single-repo user sets `name: "myapp"` in their config, it flows through unchanged to all callsites. The `?? "root"` / `?? ""` only fires when `name` is unset (`undefined`).

*(OBSOLETE CONCLUSION)*

> ### Conclusion: no schema change needed
>
> The `as unknown as ResolvedConfig` cast in the single-repo branch of `workspace-resolver.ts` is safe:
>
> - The single-repo path never runs `v.safeParse(ResolvedConfigSchema, ...)`, so the `name: string` requirement is never checked against an undefined value at runtime.
> **Leave as-is.** The draft-refactor note about `name` fallback patterns (section 2 above) remains valid for callsite cleanup, independent of this schema question.

**Final Decision:** Decision was to make `name` optional in `ResolvedConfigSchema` (inherits the optional `name` from `ConfigSchema`). The type cast was removed. Monorepo blocks that need a guaranteed non-null name use `invariant(wsConfig.name, "Workspace name is required in monorepo mode")`. See `src/schemas/configs/resolved-config.ts` and `src/tasks/workspace-resolver.ts`.

---

## 5. Drifting Docs: `name` fallbacks

**Status: DONE** — Synced:

- `docs/export-variables.md` — `affectedWorkspaces` section now mentions the `"root"` fallback for single-repo.
- `docs/string-templates-and-patterns.md` — `releases[i].name` now documents the `"root"` default.

*(ORIGINAL NOTE)*
> The code uses `"root"` as a fallback when a single-repo project doesn't have a `name` configured, but this is not accurately reflected in the documentation:
>
> 1. **`ZR_AFFECTED_WORKSPACES`**: In `docs/export-variables.md`, it is described as a "JSON array of affected workspace names". It does not mention that in single-repo mode without a name, it will contain `["root"]` rather than `[""]` or an empty array.
> 2. **`releases` template array**: The `name` property on elements inside the `releases` array (e.g., `releases[0].name`) defaults to `"root"`. `docs/string-templates-and-patterns.md` should explicitly document this fallback for the `releases` context.
> **TODO**: Sync the documentation to accurately describe what happens in single-repo mode when no name is provided for these specific variables.

---

## 6. `ReleaseContextEntry` location

**Status: DONE** — Moved from `pattern-context.ts` to `src/types/release-context.ts`. `pattern-context.ts` re-exports it for backward compatibility. All three workflow files (`review.prepare.ts`, `review.publish.ts`, `auto.ts`) continue to import from `pattern-context.ts` (re-export) — no import changes needed.
