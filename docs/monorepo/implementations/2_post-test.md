# Phase 2 — Post-Test: Real GitHub API

> **Purpose:** Test the updated default commit header template (`{{ releases | format_releases }}`) and the pure context fallback in a real end-to-end run.

---

## Prerequisites

- Phase 1 implementation complete and passing.
- A GitHub repository with at least 1 tag and 1+ new commits since.
- GitHub Personal Access Token configured.

---

## Test 1: Single-Repo Default Commit Message

**Config:** Default (no `commit.headerTemplate` override).

**Expected behavior:**
- The commit message should be `chore: release v<nextVersion>` (e.g., `chore: release v1.2.0`).
- This is the same format as before the refactor (backward compatible).

**Verify (in `review` mode — check proposal title / commit on working branch):**
- [ ] Commit header is `chore: release v1.2.0` (not `chore: release [object Object]` or empty).
- [ ] The `releases` array was populated correctly (single item, `isWorkspace: false`).

**Verify (in `auto` mode — check the created commit):**
- [ ] Same format: `chore: release v1.2.0`.

---

## Test 2: Custom Commit Header Template

**Config:**
```json
{
  "commit": {
    "headerTemplate": "chore: bump to {{ releases | format_releases: \" and \" }}"
  }
}
```

**Expected behavior:**
- Commit message: `chore: bump to v1.2.0` (single-repo, so only one item in the array).

**Verify:**
- [ ] Custom separator is applied (though with 1 item, separator doesn't show).
- [ ] No template resolution errors.

---

## Test 3: Old-Style Template Still Works

**Config:**
```json
{
  "commit": {
    "headerTemplate": "chore: release v{{ nextVersion }}"
  }
}
```

**Expected behavior:**
- Users who explicitly set the old template format should see no change.
- Commit message: `chore: release v1.2.0`.

**Verify:**
- [ ] The `{{ nextVersion }}` pattern still resolves correctly.
- [ ] No deprecation warnings or errors.

---

## Test 4: Explicit Context Override (Developer Verification)

This is tested locally via `experiments/pure-context-and-format-releases.ts`, but for extra confidence:

**Verify:**
- [ ] `resolveStringTemplate("{{ name }}", undefined, { name: "test" })` returns `"test"`, not whatever is in the global `STRING_PATTERN_CONTEXT`.
- [ ] `resolveStringTemplate("{{ name }}")` (without explicit context) still reads from the global singleton.
