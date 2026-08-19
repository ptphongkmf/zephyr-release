# Phase 3 — Post-Test: Full Monorepo Integration

> **Purpose:** End-to-end testing of monorepo support on a real GitHub repository.  
> **Prerequisites:** Phase 1 and Phase 2 implemented and passing.

---

## Test Repository Setup

Create a test repo with the following structure:

```
test-monorepo/
├── .zephyr-release.json
├── packages/
│   ├── core/
│   │   ├── version.json      # { "version": "1.0.0" }
│   │   └── src/
│   │       └── index.ts
│   └── cli/
│       ├── version.json      # { "version": "0.5.0" }
│       └── src/
│           └── index.ts
└── README.md
```

**Root config (`.zephyr-release.json`):**
```json
{
  "releaseFlow": "auto",
  "versionFiles": [{ "path": "version.json", "type": "json" }],
  "workspace": {
    "packages/core": {
      "name": "core"
    },
    "packages/cli": {
      "name": "cli",
      "auto": {
        "triggerStrategy": { "type": "always" }
      }
    }
  }
}
```

Create initial tags `core-v1.0.0` and `cli-v0.5.0` pointing to the initial commit.

---

## Scenario 1: Single-Repo Backward Compatibility

**Setup:** Remove the `workspace` key from config. Run as single-repo.

**Verify:**
- [ ] `deno task check` passes.
- [ ] Behavior is identical to pre-monorepo: single tag `v<version>`, single commit, single release.
- [ ] Env vars: `ZR_NEXT_VERSION` is set, `ZR_WORKSPACES` is set with 1-item array, no `ZR__*__*` vars.

---

## Scenario 2: Monorepo — Both Workspaces Affected (`auto` mode)

**Setup:** Add `workspace` key back. Make commits that touch both `packages/core/` and `packages/cli/`.

**Verify:**
- [ ] Both workspaces detected as affected.
- [ ] Each workspace gets its own version bump (e.g., `core-v1.1.0`, `cli-v0.6.0`).
- [ ] Single commit with message: `chore: release core-v1.1.0, cli-v0.6.0`.
- [ ] Two separate tags created: `core-v1.1.0` and `cli-v0.6.0`.
- [ ] Two separate GitHub Releases created.
- [ ] Env vars during per-workspace hooks include both `ZR_NEXT_VERSION` (current) and `ZR__core__NEXT_VERSION` / `ZR__cli__NEXT_VERSION`.

---

## Scenario 3: Monorepo — Only One Workspace Affected

**Setup:** Make a commit that only touches `packages/core/src/index.ts`.

**Verify:**
- [ ] Only `core` is detected as affected.
- [ ] `cli` is skipped entirely (no version bump, no tag, no release).
- [ ] Commit message: `chore: release core-v1.2.0` (only core).
- [ ] Only 1 tag and 1 release created.

---

## Scenario 4: Monorepo — `review` mode with `group-proposals: true`

**Config change:** `"releaseFlow": "review"`.

**Verify:**
- [ ] One working branch created: `zephyr-release/main` (or per template).
- [ ] One PR created with aggregated changes from all affected workspaces.
- [ ] PR title includes all workspace versions.
- [ ] On merge: per-workspace tags and releases created.

---

## Scenario 5: Monorepo — `review` mode with `group-proposals: false`

**Config change:** Add `"review": { "groupProposals": false }`.

**Verify:**
- [ ] Per-workspace working branches: `zephyr-release/core/main`, `zephyr-release/cli/main`.
- [ ] Per-workspace PRs created.
- [ ] Each PR only contains changes for its workspace.
- [ ] On merge of each PR: only that workspace's tag/release created.

---

## Scenario 6: Workspace Config Overrides

**Config:** Add custom tag template and changelog path for `cli`:
```json
{
  "workspace": {
    "packages/cli": {
      "name": "cli",
      "tag": { "nameTemplate": "cli/v{{ nextVersion }}" },
      "changelog": { "path": "RELEASES.md" }
    }
  }
}
```

**Verify:**
- [ ] `cli` tag is `cli/v0.6.0` (custom template), not `cli-v0.6.0` (default).
- [ ] `cli` changelog written to `packages/cli/RELEASES.md`, not `packages/cli/CHANGELOG.md`.
- [ ] `core` still uses defaults: `core-v1.1.0` tag, `packages/core/CHANGELOG.md`.

---

## Scenario 7: `Release-As` Footer

**Setup:** Make a commit with footer:
```
feat: new feature

Release-As: core@2.0.0
```

**Verify:**
- [ ] `core` version is forced to `2.0.0` regardless of commit bump rules.
- [ ] `cli` (if affected) uses normal bump calculation.
- [ ] Global `Release-As: 3.0.0` (without `@`) applies to all affected workspaces.

---

## Scenario 8: Migration — Adding Workspaces to Existing Single-Repo

**Setup:** 
1. Start with a single-repo config (no `workspace` key). Tag `v1.5.0` exists.
2. Add `workspace` key with `tag.matchPatterns: ["v*"]`.

**Verify:**
- [ ] `findLastReleaseHash` picks up old `v1.5.0` tag via `matchPatterns`.
- [ ] New workspace tags follow the new pattern (e.g., `core-v1.6.0`).
- [ ] No commits are missed from the old tag to the current trigger.

---

## Env Variable Verification Checklist

For any monorepo test above, verify the following env vars are correctly set:

| Variable | Per-Workspace Hook | Global Hook |
|----------|-------------------|-------------|
| `ZR_NEXT_VERSION` | Current workspace version | undefined |
| `ZR_NAME` | Current workspace name | undefined |
| `ZR__core__NEXT_VERSION` | Set | Set |
| `ZR__cli__NEXT_VERSION` | Set | Set |
| `ZR_WORKSPACES` | JSON array (all) | JSON array (all) |

And for outputs:

| Output | Monorepo | Single-Repo |
|--------|----------|-------------|
| `zr-next-version` | undefined | version |
| `zr--core--next-version` | version | N/A |
| `zr--cli--next-version` | version | N/A |
