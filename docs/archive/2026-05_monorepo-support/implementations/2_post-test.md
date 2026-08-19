# Phase 2 — Post-Test: Real GitHub API

> **Purpose:** Test the enforced pure context model and the updated default commit header template (`{{ releases | format_releases }}`) in a real end-to-end run.

---

## Prerequisites

- Phase 2 implementation complete and passing `deno task check`.
- A GitHub repository with at least 1 tag and 1+ new commits since.
- GitHub Personal Access Token configured.

---

## Test 1: Single-Repo Default Commit Message

**Config:** Default (no `commit.headerTemplate` override).

**Expected behavior:**
- The commit message should be `chore: release v<nextVersion>` (e.g., `chore: release v1.2.0`).
- This validates that the `releases` array is populated with a single entry whose `tagName` is the tag name.

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

## Test 4: No Global State Leaks

**Verify:**
- [ ] Grep for `STRING_PATTERN_CONTEXT` in `src/` — should return 0 results (the global is deleted).
- [ ] Grep for `BUILT_IN_CONTEXT` in `src/` — should return 0 results.
- [ ] Grep for `CUSTOM_CONTEXT` in `src/` — should return 0 results.
- [ ] All `resolveStringTemplate` calls pass an explicit `context` argument — no call omits the second parameter.

---

## Test 5: Runtime Config Override Preserves Context

**Config with runtime override:**
```json
{
  "runtime-config-override": {
    "path": ".zephyr-override.json"
  },
  "command-hooks": {
    "pre-calculate-version": [
      "echo '{\"name\": \"overridden-name\"}' > .zephyr-override.json"
    ]
  }
}
```

**Expected behavior:**
- After the `pre-calculate-version` hook, `synchronizeRuntimeStateAfterOverride` rebuilds the context with the new config and returns it.
- Subsequent template resolutions (tag name, commit header, etc.) reflect the overridden `name`.

**Verify:**
- [ ] The commit message or tag name reflects the overridden `name` value.
- [ ] No stale values from the pre-override context leak through.
