# Monorepo Support — Filter Design & Commit Template (Draft 10)

> **Date:** 2026-05-30  
> **Purpose:** Resolve the remaining design questions around the `format_workspace_releases` filter and commit message template.

---

## The Core Problem

You're right to push back. There are actually **three intertwined concerns** here that we need to untangle:

1. **What the filter is called** — must fit both single-repo and monorepo.
2. **What the filter outputs** — different formatting expectations per mode.
3. **Whether a unified default template is even worth it** — or if separate defaults are simpler.

Let me address each.

---

## 1. Filter Naming

`format_workspace_releases` has "workspace" in it, which implies monorepo. But this filter also runs in single-repo mode.

**Alternative names considered:**
- `format_releases` — clean, short, mode-agnostic. A "release" is universal.
- `format_release_summary` — more descriptive but longer.
- `format_versions` — focuses on versions, but the output includes names too (in monorepo).

**Recommendation: `format_releases`**

It's short, agnostic, and pairs well with the variable it operates on. The variable should also be renamed from `workspaceReleases` to just `releases` for the same reason.

```liquid
chore: release {{ releases | format_releases }}
```

---

## 2. What The Filter Outputs

Your concerns are valid. Let's be concrete about the format expectations:

**Single-repo user expectation:**
```
chore: release v1.3.0
```
→ Just the version with `v` prefix.

**Monorepo user expectation:**
```
chore: release core-v1.3.0, cli-v2.0.1
```
→ Each entry is `<name>-v<version>`, comma-separated.

But wait — should the monorepo format really be hardcoded to `<name>-v<version>`? What if the user's tag template is `{{ name }}/v{{ nextVersion }}`? Then their tags would be `core/v1.3.0` but their commit message would say `core-v1.3.0` — a mismatch.

### The Right Answer: Reuse `tagName`

You nailed it with your last point. Instead of the filter constructing its own `<name>-v<version>` format, it should **reuse the already-resolved `tagName`** from each workspace's context. The `tagName` is the canonical identifier for a release — it's what appears in Git, in GitHub Releases, in changelogs. The commit message should use the same format.

This means the `releases` array should contain the **resolved `tagName`** for each workspace:

```typescript
// releases variable shape
[
  { name: "core", nextVersion: "1.3.0", tagName: "core-v1.3.0", isWorkspace: true },
  { name: "cli", nextVersion: "2.0.1", tagName: "cli-v2.0.1", isWorkspace: true },
]

// single-repo
[
  { name: "my-app", nextVersion: "1.3.0", tagName: "v1.3.0", isWorkspace: false },
]
```

**The `format_releases` filter then becomes trivially simple:**

```typescript
liquidEngine.registerFilter(
  "format_releases",
  (releases: any[], separator?: string) => {
    const sep = typeof separator === "string" ? separator : ", ";
    return releases.map(r => r.tagName).join(sep);
  },
);
```

- **Single-repo**: `{{ releases | format_releases }}` → `v1.3.0`
- **Monorepo**: `{{ releases | format_releases }}` → `core-v1.3.0, cli-v2.0.1`
- **Custom separator**: `{{ releases | format_releases: " | " }}` → `core-v1.3.0 | cli-v2.0.1`

No `isWorkspace` check needed in the filter. No hardcoded format. The `tagName` already encodes the correct naming convention because it was resolved from `tag.nameTemplate`.

### Why this is elegant:
- **Consistent**: The commit message uses the exact same names as the tags.
- **Customizable**: If the user changes their `tag.nameTemplate` to `{{ name }}/{{ nextVersion }}`, the commit message automatically reflects that.
- **No mode branching in the filter**: The filter does one thing — join tagNames.

---

## 3. Is One Unified Default Template Still Worth It?

**Yes, and now it's even simpler.** With the `tagName`-based filter:

```liquid
chore: release {{ releases | format_releases }}
```

- Single-repo: `chore: release v1.3.0`
- Monorepo (2 affected): `chore: release core-v1.3.0, cli-v2.0.1`

There is **no** formatting difference to branch on. The `tagName` already carries the right format for each mode. One default template, zero conditional logic.

The only thing left is: **do we still need the `isWorkspace` boolean at all?**

**Yes, keep it**, but not for this filter. It's useful for:
- The log messages (log workspace headers in monorepo, skip in single-repo).
- Other filters users might write that need to know the mode.
- The env variable export logic (`ZR__name__*` only emitted when `isWorkspace: true`).

It's just not needed inside `format_releases` anymore.

---

## The Full Picture

### String pattern variable:
```typescript
// "releases" is populated after all workspace versions are calculated
// Shape: Array<{ name: string; nextVersion: string; tagName: string; isWorkspace: boolean }>
```

### LiquidJS filter:
```typescript
liquidEngine.registerFilter(
  "format_releases",
  (releases: any[], separator?: string) => {
    const sep = typeof separator === "string" ? separator : ", ";
    return releases.map(r => r.tagName).join(sep);
  },
);
```

### Default commit template (unified, no variant):
```liquid
chore: release {{ releases | format_releases }}
```

### User power-use examples:
```liquid
{%- comment -%} Custom: only versions, no names {%- endcomment -%}
chore: bump {% for r in releases %}v{{ r.nextVersion }}{% unless forloop.last %}, {% endunless %}{% endfor %}

{%- comment -%} Custom: pipe-separated {%- endcomment -%}
chore: release {{ releases | format_releases: " | " }}

{%- comment -%} Custom: names only, no versions {%- endcomment -%}
chore: update {% for r in releases %}{{ r.name }}{% unless forloop.last %}, {% endunless %}{% endfor %}
```

---

## Updated Decision Ledger (changes only)

| # | Topic | Previous Decision | Updated Decision |
|---|-------|------------------|-----------------|
| 13 | Commit template filter | `format_workspace_releases` with isWorkspace branching | `format_releases` — joins `tagName` values. No mode branching |
| — | `releases` variable name | `workspaceReleases` | `releases` (mode-agnostic) |
| — | Filter format source | Hardcoded `<name>-v<version>` | Reuses resolved `tagName` from each workspace context |

Everything else from the Draft 9 ledger remains unchanged.

---

## Any remaining questions on your end, or are we ready to write the implementation plan?
