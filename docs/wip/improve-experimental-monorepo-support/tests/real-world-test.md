# Real-World Throwaway Repository Testing Plan: Experimental Monorepo Support

This document defines an end-to-end testing plan to validate all experimental monorepo features of Zephyr Release within an isolated, throwaway GitHub repository.

Every test case is broken down into:
- **Agent-job**: Exact file changes and local Git commands executed by the AI assistant in the test repo.
- **User-job**: Actions performed by the user on GitHub (pushing commits, merging pull requests, checking GitHub Actions and Releases UI).
- **Expected Results & UI Text**: Exact string templates, pull request titles, bodies, marker placement, release notes, and environment variables.
- **Plan Reference**: Document and line references in `plans/`, `drafts/`, or `archive/` that established the behavior.

---

## Table of Contents

- [Environment Setup & Initial Configuration](#environment-setup--initial-configuration)
  - [1. GitHub Repository Settings](#1-github-repository-settings)
  - [2. GitHub Actions Workflow](#2-github-actions-workflow)
  - [3. Throwaway Repository Layout](#3-throwaway-repository-layout)
- [Test Cases](#test-cases)
  - [Test Case 1: Baseline Review Flow — Multi-Workspace Propose Phase](#test-case-1-baseline-review-flow--multi-workspace-propose-phase)
  - [Test Case 2: Incremental Proposal Update (Adding Commits to an Open PR)](#test-case-2-incremental-proposal-update-adding-commits-to-an-open-pr)
  - [Test Case 3: Review Flow Publish Phase — Marker Extraction & GitHub Releases](#test-case-3-review-flow-publish-phase--marker-extraction--github-releases)
  - [Test Case 4: Single Workspace Affected & Unaffected Workspace Invariance](#test-case-4-single-workspace-affected--unaffected-workspace-invariance)
  - [Test Case 5: Custom Member Review Templates & `title` Display Heading](#test-case-5-custom-member-review-templates--title-display-heading)
  - [Test Case 6: Manual Version Override via `Release-As` Footers](#test-case-6-manual-version-override-via-release-as-footers)
  - [Test Case 7: Legacy Tag Migration via `tag.matchPatterns`](#test-case-7-legacy-tag-migration-via-tagmatchpatterns)
  - [Test Case 8: Automated Release Flow (`releaseFlow: "auto"`)](#test-case-8-automated-release-flow-releaseflow-auto)
  - [Test Case 9: Command Hooks & Monorepo Environment Variables](#test-case-9-command-hooks--monorepo-environment-variables)
  - [Test Case 10: Backward Compatibility — Single-Repo Fallback](#test-case-10-backward-compatibility--single-repo-fallback)

---

## Environment Setup & Initial Configuration

### 1. GitHub Repository Settings
1. Create a public or private throwaway repository on GitHub (e.g., `zephyr-release-monorepo-test`).
2. Go to **Settings > Actions > General > Workflow permissions**:
   - Select **Read and write permissions**.
   - Check **Allow GitHub Actions to create and approve pull requests**.
   - Click **Save**.

### 2. GitHub Actions Workflow
In the throwaway repo, create `.github/workflows/release.yml`. This workflow runs Zephyr Release directly using the `canary` action (`uses: ptphongkmf/zephyr-release@canary`).

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: read
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Zephyr Release
        uses: ptphongkmf/zephyr-release@canary
        with:
          config-path: .zephyr-release.json
          config-format: json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Throwaway Repository Layout
The repo contains three packages representing typical monorepo packages:
- `packages/core` (standard package)
- `packages/cli` (standard tool)
- `packages/shared-utils` (namespaced/hyphenated identifier to test sanitization)

```
throwaway-repo/
├── .github/
│   └── workflows/
│       └── release.yml
├── .zephyr-release.json
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   └── src/index.ts
│   ├── cli/
│   │   ├── package.json
│   │   └── src/index.ts
│   └── shared-utils/
│       ├── package.json
│       └── src/index.ts
└── README.md
```

#### Step 0: Initial Repository Setup
**[Agent-job]**:
Initialize files in throwaway repository:

1. `packages/core/package.json`:
   ```json
   {
     "name": "@throwaway/core",
     "version": "1.0.0"
   }
   ```
2. `packages/core/src/index.ts`:
   ```typescript
   export const CORE_VERSION = "1.0.0";
   ```
3. `packages/cli/package.json`:
   ```json
   {
     "name": "@throwaway/cli",
     "version": "0.5.0"
   }
   ```
4. `packages/cli/src/index.ts`:
   ```typescript
   export const CLI_VERSION = "0.5.0";
   ```
5. `packages/shared-utils/package.json`:
   ```json
   {
     "name": "@throwaway/shared-utils",
     "version": "0.1.0"
   }
   ```
6. `packages/shared-utils/src/index.ts`:
   ```typescript
   export const UTILS_VERSION = "0.1.0";
   ```
7. `README.md`:
   ```markdown
   # Monorepo Throwaway Test Repository
   Testing Zephyr Release experimental monorepo support.
   ```
8. `.zephyr-release.json`:
   ```json
   {
     "release-flow": "review",
     "workspace": {
       "packages/core": {
         "name": "core",
         "title": "Core Library",
         "version-files": {
           "path": "package.json",
           "selector": "$.version"
         }
       },
       "packages/cli": {
         "name": "cli",
         "title": "Command Line Interface",
         "version-files": {
           "path": "package.json",
           "selector": "$.version"
         }
       },
       "packages/shared-utils": {
         "name": "shared-utils",
         "title": "Shared Utilities",
         "version-files": {
           "path": "package.json",
           "selector": "$.version"
         }
       }
     }
   }
   ```
9. Git commit and create initial baseline tags:
   ```bash
   git init
   git add .
   git commit -m "chore: initial repository setup"
   git branch -M main
   git tag core-v1.0.0
   git tag cli-v0.5.0
   git tag shared-utils-v0.1.0
   ```

**[User-job]**:
1. Add remote and push `main` branch with tags to GitHub:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main --tags
   ```
2. Verify repository default branch is `main` and all 3 tags exist on GitHub.

---

## Test Cases

### Test Case 1: Baseline Review Flow — Multi-Workspace Propose Phase

- **Objective**: Verify that when multiple workspaces are affected in `review` release flow:
  1. The auto-derived tag patterns (`*-v*`) detect the last release boundary per workspace.
  2. Both `core` and `cli` receive correct SemVer bumps.
  3. `shared-utils` is skipped because it has no changes.
  4. A single grouped release proposal PR is created on working branch `zephyr-release/main`.
  5. PR title uses `{{ releases | format_release_tags }}`.
  6. PR body uses `{{ releases | format_proposal_body }}` with `## {title}` headings and per-workspace named markers `<!-- PROPOSAL-CHANGELOG-RELEASE-START:{tagName} -->`.
  7. Version files are updated only for affected packages on the working branch.
- **Plan Reference**:
  - (plans/plan-3.md:L10-L24): Solution architecture & `format_proposal_body`
  - (plans/plan-3.md:L124-L151): `ReleaseContextEntry` & `memberBlock`
  - (plans/plan-3.md:L174-L180): `DEFAULT_PROPOSAL_BODY_TEMPLATE`
  - (plans/plan-1.md:L51-L64): Unconditionally grouped PRs
  - (2026-05_monorepo-support/implementations/3_monorepo-implementation-mid-problem.md:L132-L159): Workspace path prepending for `version-files`

#### Execution Steps

**[Agent-job]**:
Make commits touching `core` and `cli`, leaving `shared-utils` untouched:
```bash
# Feature commit in core (triggers minor bump: 1.0.0 -> 1.1.0)
echo 'export const CORE_FEATURE = "feature-1";' >> packages/core/src/index.ts
git add packages/core/src/index.ts
git commit -m "feat(core): introduce primary engine capability"

# Bug fix in cli (triggers patch bump: 0.5.0 -> 0.5.1)
echo 'export const CLI_DEBUG = true;' >> packages/cli/src/index.ts
git add packages/cli/src/index.ts
git commit -m "fix(cli): fix argument parser edge case"
```

**[User-job]**:
1. Push commits to `main`:
   ```bash
   git push origin main
   ```
2. Navigate to **Actions** tab on GitHub, inspect the running `Release` workflow.
3. Once completed, navigate to **Pull requests** tab on GitHub.

#### Expected Results & UI Verifications

1. **Pull Request Metadata**:
   - **Branch**: `zephyr-release/main` into `main`.
   - **Title**:
     ```
     chore: release core-v1.1.0, cli-v0.5.1
     ```
   - *Note*: `shared-utils` is omitted from the title because it had no changes.
2. **Pull Request Body**:
   The PR body must strictly contain:
   ```markdown
   # 🤖 Release Proposal

   <!-- PROPOSAL-CHANGELOG-RELEASE-START -->
   ## Core Library

   <!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v1.1.0 -->
   ## core-v1.1.0 (...)

   ### Features

   - **core:** introduce primary engine capability (...)
   <!-- PROPOSAL-CHANGELOG-RELEASE-END:core-v1.1.0 -->

   ## Command Line Interface

   <!-- PROPOSAL-CHANGELOG-RELEASE-START:cli-v0.5.1 -->
   ## cli-v0.5.1 (...)

   ### Bug Fixes

   - **cli:** fix argument parser edge case (...)
   <!-- PROPOSAL-CHANGELOG-RELEASE-END:cli-v0.5.1 -->
   <!-- PROPOSAL-CHANGELOG-RELEASE-END -->

   ---
   *This proposal was generated with [Zephyr Release](https://github.com/ptphongkmf/zephyr-release)*
   ```
3. **Files Changed in Pull Request**:
   - `packages/core/package.json`: `"version": "1.1.0"`
   - `packages/cli/package.json`: `"version": "0.5.1"`
   - `packages/shared-utils/package.json`: **NOT modified**.
4. **Pass/Fail Checklist**:
   - [ ] Proposal title is `chore: release core-v1.1.0, cli-v0.5.1`
   - [ ] Outer markers `<!-- PROPOSAL-CHANGELOG-RELEASE-START -->` wrap the entire body
   - [ ] Each section uses `title` (`## Core Library` and `## Command Line Interface`)
   - [ ] Inner named markers `<!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v1.1.0 -->` wrap core's notes
   - [ ] Inner named markers `<!-- PROPOSAL-CHANGELOG-RELEASE-START:cli-v0.5.1 -->` wrap cli's notes
   - [ ] `shared-utils` is neither bumped nor mentioned

---

### Test Case 2: Incremental Proposal Update (Adding Commits to an Open PR)

- **Objective**: Verify that when a PR is already open and new commits arrive on `main`:
  1. Zephyr Release updates the existing proposal PR rather than creating a duplicate.
  2. A newly affected workspace (`shared-utils`) is dynamically added to the existing release list.
  3. The PR title is updated to reflect all three releases.
  4. The PR body is reconstructed to include the third workspace section.
- **Plan Reference**:
  - (plans/plan-3.md:L75-L80): PR body re-assembly in prepare loop
  - (2026-05_monorepo-support/drafts/impl-2.md:L40-L58): Updating existing proposal on trigger push

#### Execution Steps

**[Agent-job]**:
While the PR from Test Case 1 is still open, add a commit affecting `packages/shared-utils`:
```bash
echo 'export function formatName(name: string) { return name.trim(); }' >> packages/shared-utils/src/index.ts
git add packages/shared-utils/src/index.ts
git commit -m "feat(shared-utils): add string formatting helper"
```

**[User-job]**:
1. Push to `main`:
   ```bash
   git push origin main
   ```
2. Wait for the `Release` workflow to finish.
3. Inspect the open Pull Request on GitHub.

#### Expected Results & UI Verifications

1. **Pull Request Count**: Still exactly **1** open pull request (no second PR created).
2. **Updated PR Title**:
   ```
   chore: release core-v1.1.0, cli-v0.5.1, shared-utils-v0.2.0
   ```
3. **Updated PR Body**:
   The PR body now contains all three workspaces:
   - `## Core Library` (with `core-v1.1.0` named markers)
   - `## Command Line Interface` (with `cli-v0.5.1` named markers)
   - `## Shared Utilities` (with `shared-utils-v0.2.0` named markers)
4. **Files Changed in PR**:
   - `packages/core/package.json`: `"1.1.0"`
   - `packages/cli/package.json`: `"0.5.1"`
   - `packages/shared-utils/package.json`: `"0.2.0"`
5. **Pass/Fail Checklist**:
   - [ ] No duplicate PR created
   - [ ] Title updated with all 3 releases joined by comma
   - [ ] `## Shared Utilities` section appended with its named markers

---

### Test Case 3: Review Flow Publish Phase — Marker Extraction & GitHub Releases

- **Objective**: Verify that when the release proposal PR is merged into `main`:
  1. `extractChangelogFromProposal` scans the PR body and correctly maps each `tagName` to its exact changelog block.
  2. Each affected workspace publishes its own independent GitHub Release.
  3. The GitHub Release notes for each workspace contain ONLY that workspace's changelog (no headings or content from other packages).
  4. Git tags are created on GitHub for each workspace: `core-v1.1.0`, `cli-v0.5.1`, `shared-utils-v0.2.0`.
  5. The working branch `zephyr-release/main` is deleted or merged cleanly.
- **Plan Reference**:
  - (plans/plan-3.md:L193-L210): `extractChangelogFromProposal` returning Map keyed by `tagName` and publish per-workspace lookup
  - (plans/plan-3.md:L53-L56): User Stories 14 & 15 (isolated per-workspace changelog publish)

#### Execution Steps

**[Agent-job]**: None.

**[User-job]**:
1. Go to the open Release Proposal PR on GitHub.
2. Click **Merge pull request** (Create a merge commit or Squash and merge) and confirm merge.
3. Navigate to **Actions** tab. Wait for the `Release` workflow triggered by `push` to `main` (from the merge) to complete.
4. Navigate to **Releases** and **Tags** on GitHub.

#### Expected Results & UI Verifications

1. **Tags Created**:
   - `core-v1.1.0`
   - `cli-v0.5.1`
   - `shared-utils-v0.2.0`
2. **GitHub Releases Published**:
   Exactly 3 releases published on GitHub:
   - **Release 1: `core-v1.1.0`**:
     - Title: `core-v1.1.0`
     - Tag: `core-v1.1.0`
     - Notes: Contains `introduce primary engine capability`. **Does NOT contain** `cli` or `shared-utils` content!
   - **Release 2: `cli-v0.5.1`**:
     - Title: `cli-v0.5.1`
     - Tag: `cli-v0.5.1`
     - Notes: Contains `fix argument parser edge case`. **Does NOT contain** `core` or `shared-utils` content!
   - **Release 3: `shared-utils-v0.2.0`**:
     - Title: `shared-utils-v0.2.0`
     - Tag: `shared-utils-v0.2.0`
     - Notes: Contains `add string formatting helper`. **Does NOT contain** other packages' content!
3. **Pass/Fail Checklist**:
   - [ ] 3 tags created on the merge commit
   - [ ] 3 GitHub Releases created
   - [ ] Each GitHub Release has isolated notes extracted via `<!-- PROPOSAL-CHANGELOG-RELEASE-START:{tagName} -->`
   - [ ] No markers leaked into the published release descriptions

---

### Test Case 4: Single Workspace Affected & Unaffected Workspace Invariance

- **Objective**: Verify that after prior releases exist, a commit touching only one workspace:
  1. Calculates the previous version using that workspace's latest tag (`core-v1.1.0`).
  2. Bumps only that workspace (`core` 1.1.0 -> 1.1.1).
  3. Completely ignores `cli` and `shared-utils`.
  4. Generates a proposal PR with only that single workspace section.
- **Plan Reference**:
  - (2026-05_monorepo-support/implementations/3_post-test.md:L75-L86): Scenario 3 — Only One Workspace Affected
  - (src/tasks/workspace-detection.ts): Commit path filtering

#### Execution Steps

**[Agent-job]**:
Make a commit touching only `packages/core`:
```bash
git checkout main
git pull origin main

echo '// bugfix comment' >> packages/core/src/index.ts
git add packages/core/src/index.ts
git commit -m "fix(core): resolve null pointer exception in core"
```

**[User-job]**:
1. Push to `main`:
   ```bash
   git push origin main
   ```
2. Check the newly created Release Proposal PR on GitHub.

#### Expected Results & UI Verifications

1. **Pull Request Title**:
   ```
   chore: release core-v1.1.1
   ```
2. **Pull Request Body**:
   - Contains only `## Core Library` section.
   - Contains named markers `<!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v1.1.1 -->`.
   - Neither `cli` nor `shared-utils` appears in headings or body.
3. **Files Changed in PR**:
   - Only `packages/core/package.json` (`"version": "1.1.1"`).
   - Neither `packages/cli/package.json` nor `packages/shared-utils/package.json` is modified.
4. **Merge Verification**:
   - Merge the PR on GitHub.
   - Verify that only **1** tag (`core-v1.1.1`) and only **1** GitHub Release (`core-v1.1.1`) are created.
5. **Pass/Fail Checklist**:
   - [ ] Only `core` is bumped to `1.1.1`
   - [ ] PR contains only `core`
   - [ ] Only 1 tag and 1 release created upon merge

---

### Test Case 5: Custom Member Review Templates & `title` Display Heading

- **Objective**: Verify the Phase 3 per-workspace member review templates:
  1. `title` overrides the default `name` as the section heading.
  2. `review.member-header-template`: PR-only content placed *before* the member body markers.
  3. `review.member-body-template`: Custom body placed *inside* the member markers (extracted to GitHub Release).
  4. `review.member-footer-template`: PR-only content placed *after* the member body markers.
  5. `review.member-header-template-path`: Verifies that file paths are resolved relative to repository root (not workspace root).
  6. On publish, confirm that `member-header-template` and `member-footer-template` are **omitted** from the GitHub Release, while `member-body-template` is **included**.
- **Plan Reference**:
  - (plans/plan-3.md:L35-L42): User Stories 5, 6, 7 (member header, body, footer separation)
  - (plans/plan-3.md:L158-L170): `ReviewConfigWorkspaceMemberSchema` additions
  - (plans/plan-3.md:L215-L226): Member template resolution order
  - (docs/workspace-config-options.md:L124-L184): `review > member-*` configuration options

#### Execution Steps

**[Agent-job]**:
1. Create a root-relative template file `templates/cli-header.md`:
   ```markdown
   > 📢 **CLI Maintenance Notice**: This version updates CLI commands.
   ```
2. Update `.zephyr-release.json`:
   ```json
   {
     "release-flow": "review",
     "workspace": {
       "packages/core": {
         "name": "core",
         "title": "Core Engine (Supercharged)",
         "version-files": [{ "path": "package.json", "selector": "$.version" }],
         "review": {
           "member-header-template": "> ⚠️ **Notice**: Internal API refactor in {{ name }}.",
           "member-body-template": "{{ changelogRelease }}\n\n### Migration Steps\nRun `npm update` to apply changes.",
           "member-footer-template": "*Review Checklist: [x] Architecture approved*"
         }
       },
       "packages/cli": {
         "name": "cli",
         "title": "Command Line Interface",
         "version-files": [{ "path": "package.json", "selector": "$.version" }],
         "review": {
           "member-header-template-path": "templates/cli-header.md"
         }
       },
       "packages/shared-utils": {
         "name": "shared-utils",
         "title": "Shared Utilities",
         "version-files": [{ "path": "package.json", "selector": "$.version" }]
       }
     }
   }
   ```
3. Make commits touching `packages/core` and `packages/cli`:
   ```bash
   git checkout main
   git pull origin main

   mkdir templates
   # (create templates/cli-header.md and update .zephyr-release.json)

   echo 'export const CORE_V2 = true;' >> packages/core/src/index.ts
   git add templates/cli-header.md .zephyr-release.json packages/core/src/index.ts
   git commit -m "feat(core): supercharge core engine architecture"

   echo 'export const CLI_V2 = true;' >> packages/cli/src/index.ts
   git add packages/cli/src/index.ts
   git commit -m "feat(cli): add new interactive command"
   ```

**[User-job]**:
1. Push to `main`:
   ```bash
   git push origin main
   ```
2. Wait for proposal PR to be created and open it on GitHub.

#### Expected Results & UI Verifications

1. **Pull Request UI**:
   - Heading for core is `## Core Engine (Supercharged)`.
   - Core block order:
     ```markdown
     ## Core Engine (Supercharged)

     > ⚠️ **Notice**: Internal API refactor in core.

     <!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v1.2.0 -->
     ## core-v1.2.0 (...)

     ### Features

     - **core:** supercharge core engine architecture (...)

     ### Migration Steps
     Run `npm update` to apply changes.
     <!-- PROPOSAL-CHANGELOG-RELEASE-END:core-v1.2.0 -->

     *Review Checklist: [x] Architecture approved*
     ```
   - CLI section includes:
     ```markdown
     ## Command Line Interface

     > 📢 **CLI Maintenance Notice**: This version updates CLI commands.

     <!-- PROPOSAL-CHANGELOG-RELEASE-START:cli-v0.6.0 -->
     ...
     <!-- PROPOSAL-CHANGELOG-RELEASE-END:cli-v0.6.0 -->
     ```
2. **Merge & Publish Verification**:
   - Merge the PR on GitHub.
   - Inspect the created GitHub Release `core-v1.2.0`:
     - **MUST contain**:
       ```markdown
       ### Migration Steps
       Run `npm update` to apply changes.
       ```
     - **MUST NOT contain**: `> ⚠️ **Notice**: Internal API refactor` (memberHeader was excluded).
     - **MUST NOT contain**: `*Review Checklist: [x] Architecture approved*` (memberFooter was excluded).
   - Inspect the created GitHub Release `cli-v0.6.0`:
     - **MUST NOT contain**: `> 📢 **CLI Maintenance Notice**` (memberHeaderPath was excluded).
3. **Pass/Fail Checklist**:
   - [ ] Custom `title` rendered as heading in PR
   - [ ] `member-header-template` appears before markers in PR
   - [ ] `member-footer-template` appears after markers in PR
   - [ ] `member-header-template-path` loads from repo root
   - [ ] Only `member-body-template` is published to the GitHub Release notes

---

### Test Case 6: Manual Version Override via `Release-As` Footers

- **Objective**: Verify that:
  1. A commit footer `Release-As: <name>@<version>` overrides the calculated version for a specific workspace.
  2. Other affected workspaces calculate their bumps normally.
  3. A global `Release-As: <version>` footer overrides all affected workspaces.
- **Plan Reference**:
  - (2026-05_monorepo-support/implementations/3_post-test.md:L133-L146): Scenario 7 — `Release-As` Footer
  - (src/tasks/commit.ts): `extractReleaseAsFromCommit`

#### Execution Steps

**[Agent-job]**:
Make commits with `Release-As` footers:
```bash
git checkout main
git pull origin main

# Force core to jump to 2.0.0-rc.1 via targeted footer
echo 'export const RC = 1;' >> packages/core/src/index.ts
git add packages/core/src/index.ts
git commit -m "feat(core): prepare release candidate

Release-As: core@2.0.0-rc.1"

# Normal patch fix in cli (would naturally be 0.6.1)
echo 'export const FIX = true;' >> packages/cli/src/index.ts
git add packages/cli/src/index.ts
git commit -m "fix(cli): resolve formatting in cli"
```

**[User-job]**:
1. Push to `main`:
   ```bash
   git push origin main
   ```
2. Check the opened PR on GitHub.

#### Expected Results & UI Verifications

1. **Pull Request Title**:
   ```
   chore: release core-v2.0.0-rc.1, cli-v0.6.1
   ```
2. **Version File Diffs in PR**:
   - `packages/core/package.json`: `"version": "2.0.0-rc.1"` (forced by `Release-As`).
   - `packages/cli/package.json`: `"version": "0.6.1"` (standard patch calculation).
3. **Merge Verification**:
   - Merge PR.
   - Verify tag `core-v2.0.0-rc.1` is created as a prerelease.
4. **Pass/Fail Checklist**:
   - [ ] `Release-As: core@2.0.0-rc.1` forces `core` version
   - [ ] `cli` is unaffected by core's override and bumps normally

---

### Test Case 7: Legacy Tag Migration via `tag.matchPatterns`

- **Objective**: Verify that when migrating existing repositories where older tags did not follow the `{{ name }}-v{{ nextVersion }}` convention:
  1. `tag.matchPatterns` detects the legacy tag as the release boundary.
  2. Commit traversal stops at the legacy tag commit instead of traversing back to the repository beginning.
  3. New tags are generated using the configured `name-template`.
- **Plan Reference**:
  - (2026-05_monorepo-support/implementations/1_post-test.md:L40-L62): Test 2 — Custom `matchPatterns` Migration
  - (docs/config-options.md:L1299-L1309): `tag > match-patterns`

#### Execution Steps

**[Agent-job]**:
1. Create a legacy tag on `main` following an old convention (e.g. `legacy-shared-9.0.0`):
   ```bash
   git checkout main
   git pull origin main
   git tag legacy-shared-9.0.0
   ```
2. Update `.zephyr-release.json` to add `matchPatterns` to `packages/shared-utils`:
   ```json
   {
     "workspace": {
       "packages/shared-utils": {
         "name": "shared-utils",
         "title": "Shared Utilities",
         "version-files": [{ "path": "package.json", "selector": "$.version" }],
         "tag": {
           "match-patterns": ["legacy-shared-*", "shared-utils-v*"]
         }
       }
     }
   }
   ```
3. Make a commit touching `packages/shared-utils`:
   ```bash
   echo 'export const LEGACY_TEST = true;' >> packages/shared-utils/src/index.ts
   git add .zephyr-release.json packages/shared-utils/src/index.ts
   git commit -m "feat(shared-utils): feature after legacy tag migration"
   ```

**[User-job]**:
1. Push commit and legacy tag:
   ```bash
   git push origin main --tags
   ```
2. Inspect the PR on GitHub.

#### Expected Results & UI Verifications

1. **Commit Range Resolution**:
   - Workflow log shows `findLastReleaseHash` successfully resolved `legacy-shared-9.0.0`.
   - The changelog in the PR for `shared-utils` contains only the commit made *after* `legacy-shared-9.0.0`.
2. **Next Tag**:
   - The new tag proposed uses the standard `name-template` (`shared-utils-v...`), not the legacy format.
3. **Pass/Fail Checklist**:
   - [ ] Legacy tag recognized via `match-patterns`
   - [ ] Previous commits before legacy tag are not included in changelog
   - [ ] New tag uses active `name-template`

---

### Test Case 8: Automated Release Flow (`releaseFlow: "auto"`)

- **Objective**: Verify monorepo operations under `releaseFlow: "auto"`:
  1. No release proposal PR is created.
  2. Bumps and changelogs are committed directly to `main`.
  3. Tags and GitHub Releases are created immediately in the same run.
- **Plan Reference**:
  - (2026-05_monorepo-support/implementations/3_post-test.md:L61-L73): Scenario 2 — Both Workspaces Affected in `auto` mode
  - (src/workflows/auto.ts): Monorepo loop in automated release flow

#### Execution Steps

**[Agent-job]**:
1. Edit `.zephyr-release.json` to set `"release-flow": "auto"`:
   ```json
   {
     "release-flow": "auto",
     "workspace": {
       "packages/core": {
         "name": "core",
         "title": "Core Library",
         "version-files": [{ "path": "package.json", "selector": "$.version" }]
       },
       "packages/cli": {
         "name": "cli",
         "title": "Command Line Interface",
         "version-files": [{ "path": "package.json", "selector": "$.version" }]
       },
       "packages/shared-utils": {
         "name": "shared-utils",
         "title": "Shared Utilities",
         "version-files": [{ "path": "package.json", "selector": "$.version" }]
       }
     }
   }
   ```
2. Make a commit in `packages/cli`:
   ```bash
   git checkout main
   git pull origin main

   echo 'export const AUTO_MODE = true;' >> packages/cli/src/index.ts
   git add .zephyr-release.json packages/cli/src/index.ts
   git commit -m "feat(cli): add auto release command support"
   ```

**[User-job]**:
1. Push to `main`:
   ```bash
   git push origin main
   ```
2. Check the GitHub Actions workflow run.

#### Expected Results & UI Verifications

1. **Pull Requests Tab**: **Zero** pull requests created.
2. **Git Commit on `main`**:
   - Automatically committed by Zephyr Release with message:
     ```
     chore: release cli-v0.7.0
     ```
   - Commit touches `packages/cli/package.json` (`0.7.0`) and `packages/cli/CHANGELOG.md`.
3. **Tags & GitHub Releases**:
   - Tag `cli-v0.7.0` created immediately.
   - GitHub Release `cli-v0.7.0` published immediately.
4. **Pass/Fail Checklist**:
   - [ ] No PR created
   - [ ] Commit pushed directly to `main` with `chore: release <tag>`
   - [ ] Tag and GitHub Release created immediately

---

### Test Case 9: Command Hooks & Monorepo Environment Variables

- **Objective**: Verify that:
  1. Per-workspace hooks (`preCalculateVersion`, `postCalculateVersion`, `preTag`, `preRelease`, `postRelease`) execute once per affected workspace.
  2. `ZR_NAME` reflects the active workspace name during per-workspace hooks.
  3. Per-workspace namespaced environment variables (`ZR__<name>__*`) and outputs (`zr--<name>--*`) are exported.
  4. Global hooks (`preRun`, `preCommit`, `postCommit`, `postProposal`, `postRun`) execute strictly at the root level.
  5. Names are minimally sanitized (e.g. `@throwaway/core` -> `ZR____throwaway_core__NEXT_VERSION` and `zr--@throwaway_core--next-version`).
- **Plan Reference**:
  - (docs/workspace-config-options.md:L288-L311): Command hook execution matrix
  - (docs/export-variables.md:L370-L404): Per-workspace namespaced variables & sanitization rules
  - (2026-05_monorepo-support/implementations/3_monorepo-implementation-mid-problem.md:L230-L305): Minimal sanitization design

#### Execution Steps

**[Agent-job]**:
1. Update `.zephyr-release.json`:
   ```json
   {
     "release-flow": "review",
     "command-hooks": {
       "pre-run": [
         "echo \"HOOK_LOG: GLOBAL PRE-RUN isMonorepo=$ZR_IS_MONOREPO\""
       ],
       "post-calculate-version": [
         "echo \"HOOK_LOG: ROOT postCalculateVersion affected=$ZR_AFFECTED_WORKSPACES\""
       ],
       "post-run": [
         "echo \"HOOK_LOG: GLOBAL POST-RUN outcome=$ZR_OUTCOME workspaces=$ZR_WORKSPACES\""
       ]
     },
     "workspace": {
       "packages/core": {
         "name": "core",
         "title": "Core Library",
         "version-files": [{ "path": "package.json", "selector": "$.version" }],
         "command-hooks": {
           "post-calculate-version": [
             "echo \"HOOK_LOG: CORE HOOK name=$ZR_NAME next=$ZR_NEXT_VERSION namespaced=$ZR__core__NEXT_VERSION\""
           ]
         }
       },
       "packages/shared-utils": {
         "name": "shared-utils",
         "title": "Shared Utilities",
         "version-files": [{ "path": "package.json", "selector": "$.version" }],
         "command-hooks": {
           "post-calculate-version": [
             "echo \"HOOK_LOG: UTILS HOOK name=$ZR_NAME next=$ZR_NEXT_VERSION namespaced=$ZR__shared_utils__NEXT_VERSION\""
           ]
         }
       }
     }
   }
   ```
2. Make commits in both `core` and `shared-utils`:
   ```bash
   git checkout main
   git pull origin main

   echo 'export const HOOK_TEST = 1;' >> packages/core/src/index.ts
   git add .zephyr-release.json packages/core/src/index.ts
   git commit -m "feat(core): trigger hooks test"

   echo 'export const HOOK_TEST = 2;' >> packages/shared-utils/src/index.ts
   git add packages/shared-utils/src/index.ts
   git commit -m "feat(shared-utils): trigger hooks test"
   ```

**[User-job]**:
1. Push to `main`:
   ```bash
   git push origin main
   ```
2. Navigate to **Actions** run log and search for `HOOK_LOG:`.

#### Expected Results & UI Verifications

1. **Actions Log Output**:
   - `HOOK_LOG: GLOBAL PRE-RUN isMonorepo=true`
   - `HOOK_LOG: CORE HOOK name=core next=2.1.0 namespaced=2.1.0`
   - `HOOK_LOG: UTILS HOOK name=shared-utils next=0.3.0 namespaced=0.3.0`
   - `HOOK_LOG: ROOT postCalculateVersion affected=["core","shared-utils"]`
   - `HOOK_LOG: GLOBAL POST-RUN outcome=success`
2. **Variable Assertions**:
   - `ZR_NAME` is set to `"core"` during core's hook execution, and `"shared-utils"` during shared-utils' hook execution.
   - `ZR_AFFECTED_WORKSPACES` contains the JSON string array `["core","shared-utils"]`.
   - `ZR_IS_MONOREPO` is `"true"`.
3. **Pass/Fail Checklist**:
   - [ ] Global `pre-run` and `post-run` fire once
   - [ ] Per-workspace `post-calculate-version` fires for each affected member with `ZR_NAME`
   - [ ] Namespaced `ZR__<name>__*` variables match calculated next versions

---

### Test Case 10: Backward Compatibility — Single-Repo Fallback

- **Objective**: Verify that removing the `workspace` property from the configuration restores standard single-repo behavior:
  1. `isMonorepo` is `false`.
  2. Single default tag `v<version>` is used.
  3. Single proposal PR is created without `## {title}` headings.
  4. Standard single-repo outputs (`zr-next-version`) and env vars (`ZR_NEXT_VERSION`) are exported without workspace namespacing.
- **Plan Reference**:
  - (plans/plan-3.md:L33-L34): User Story 4 — Single-repo backward compatibility
  - (plans/plan-3.md:L212-L214): `format_proposal_body` single-repo behavior
  - (plans/plan-2.md:L78-L94): `{{ isMonorepo }}` is `false`

#### Execution Steps

**[Agent-job]**:
1. Create a root `version.json`:
   ```json
   {
     "version": "1.0.0"
   }
   ```
2. Replace `.zephyr-release.json` with a single-repo configuration (no `workspace` key):
   ```json
   {
     "release-flow": "review",
     "version-files": [{ "path": "version.json", "selector": "$.version" }]
   }
   ```
3. Commit and tag baseline:
   ```bash
   git checkout -b test/single-repo-mode
   git add version.json .zephyr-release.json
   git commit -m "chore: switch to single repo mode configuration"
   git tag v1.0.0

   echo 'export const SINGLE_REPO = true;' >> README.md
   git add README.md
   git commit -m "feat: first single-repo feature"
   ```

**[User-job]**:
1. Push branch to GitHub:
   ```bash
   git push origin test/single-repo-mode --tags
   ```
2. Check the opened Proposal PR for branch `test/single-repo-mode`.

#### Expected Results & UI Verifications

1. **Pull Request Metadata**:
   - **Branch**: `zephyr-release/test/single-repo-mode` into `test/single-repo-mode`.
   - **Title**: `chore: release v1.1.0` (single tag, no comma).
2. **Pull Request Body**:
   - `format_proposal_body` outputs `memberBlock` directly **without any `## {title}` headings**.
   - Contains global markers wrapping the single changelog block.
3. **Environment & Outputs**:
   - `ZR_IS_MONOREPO`: `"false"`
   - `ZR_NEXT_VERSION`: `"1.1.0"`
   - Output `zr-next-version`: `"1.1.0"`
   - No `ZR__*__*` namespaced variables.
4. **Pass/Fail Checklist**:
   - [ ] No `## {title}` heading in single-repo proposal body
   - [ ] Tag proposed is `v1.1.0`
   - [ ] `ZR_IS_MONOREPO` is `false`
   - [ ] Standard single-repo outputs are present

