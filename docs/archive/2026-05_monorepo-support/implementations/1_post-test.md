# Phase 1 — Post-Test: Real GitHub API

> **Purpose:** Test the refactored provider (`findLastReleaseHash` + `listCommitsInRange`) against a real GitHub repository after implementation.

---

## Prerequisites

- A GitHub repository with:
  - At least 5+ commits on the default branch.
  - At least 2 tags following different naming patterns (e.g., `v1.0.0`, `v1.1.0`).
- A GitHub Personal Access Token configured.

---

## Test 1: Basic Tag Resolution

**Config:**
```json
{
  "tag": {
    "nameTemplate": "v{{ nextVersion }}"
  }
}
```

**Expected behavior:**
- `findLastReleaseHash` auto-derives pattern `v*` from `nameTemplate`.
- Finds the latest tag matching `v*` (e.g., `v1.1.0`).
- `listCommitsInRange` walks from the trigger commit to `v1.1.0`'s hash.
- Commits returned should NOT include the commit that `v1.1.0` points to.

**Verify:**
- [ ] Tag found matches the latest `v*` tag in the repo.
- [ ] Commit list starts from trigger and stops before the tag's commit.
- [ ] Commit count matches what `git log --oneline <tag>..HEAD` shows locally.

---

## Test 2: Custom `matchPatterns` Migration

**Setup:** Create a tag with a different naming convention (e.g., `release-2.0.0`) that is the latest.

**Config:**
```json
{
  "tag": {
    "nameTemplate": "v{{ nextVersion }}",
    "matchPatterns": ["release-*", "v*"]
  }
}
```

**Expected behavior:**
- `findLastReleaseHash` checks tags against both `release-*` AND auto-derived `v*`.
- Should find `release-2.0.0` (the latest matching tag from either pattern).

**Verify:**
- [ ] The `release-*` tag is found even though `nameTemplate` uses `v*` format.
- [ ] New tags will be created as `v*` format (per `nameTemplate`), but old tags are still detected.

---

## Test 3: No Tags Exist

**Setup:** Use a repo with no tags at all.

**Expected behavior:**
- `findLastReleaseHash` returns `undefined`.
- `listCommitsInRange` walks from trigger to the beginning of history (up to `maxCommitsToResolve`).

**Verify:**
- [ ] No error thrown.
- [ ] All commits up to `maxCommitsToResolve` are returned.

---

## Test 4: `listCommitsInRange` with `path` filter

**Setup:** Use a repo with files in multiple directories (e.g., `packages/core/` and `packages/cli/`).

**Config:** Manually call `listCommitsInRange` with `path: "packages/core"`.

**Expected behavior:**
- Only commits that touched files in `packages/core/` are returned.
- Commits that only changed `packages/cli/` are excluded.

**Verify:**
- [ ] Count matches `git log --oneline -- packages/core` locally.
- [ ] No commit in the returned list touches only files outside `packages/core/`.

---

## Test 5: Verify `parseLooseSemVer` is Removed

**Verify:**
- [ ] Grep for `parseLooseSemVer` in `src/` — should return 0 results.
- [ ] Grep for `getLatestRelease` in `src/providers/` — should return 0 results.
- [ ] `deno task check` passes.
