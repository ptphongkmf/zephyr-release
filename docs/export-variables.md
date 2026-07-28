# Export operation variables

These variables are available to the host platform via output variables, and to internal command execution ([`command-hooks`](./config-options.md#command-hooks-optional)) via environment variables.

- **Output variables:** Extracted to the main CI/CD pipeline host.
- **Env variables:** Injected directly into the current environment. Accessible as a standard environment variable.

In GitHub: using [`@actions/core`](https://github.com/actions/toolkit/tree/main/packages/core) package, `core.exportVariable(k, v)` and `core.setOutput(k, v)`

## System environment (internal commands only)

By default, all environment variables available on your system are automatically passed to internal commands:

- ...process.env.*: all environment variables currently exposed by the system/runtime.

## Zephyr Release operation variables

Zephyr Release additional operation-scoped variables. These variables are not all immediately available, but become available as the operation progresses through each stage.

### Lifecycle Overview

#### Base (available at all time)

These variables are available starting from the first [`command-hooks > pre-run`](./config-options.md#command-hooks--pre-run-optional) command runs.

<!-- no toc -->
- [triggerCommitHash](#triggercommithash)
- [triggerBranchName](#triggerbranchname)
- [workspacePath](#workspacepath)
- [configPath](#configpath)
- [configFormat](#configformat)
- [configOverride](#configoverride)
- [configOverrideFormat](#configoverrideformat)
- [sourceMode](#sourcemode)
- [internalSourceMode](#internalsourcemode)
- [parsedTriggerCommit](#parsedtriggercommit)
- [parsedTriggerCommitList](#parsedtriggercommitlist)
- [workingBranchName](#workingbranchname)
- [workingBranchRef](#workingbranchref)
- [workingBranchHash](#workingbranchhash)
- [releaseFlow](#releaseflow)
- [operation](#operation)
- [jobs](#jobs)
- [startTime](#starttime)

#### Dynamic (available at all time)

These variables are exposed continuously throughout the operation, and their values are updated for each stage. Additionally, although they are labeled as available at all times, a value might or might not exist during some stages (such as `proposalId`).

- [config](#config)
- [internalConfig](#internalconfig)
- [patternContext](#patterncontext)
- [proposalId](#proposalid)

#### Pre Calculate Version

These variables are available starting from the first [`command-hooks > pre-calculate-version`](./config-options.md#command-hooks--pre-calculate-version-optional) command runs.

- [resolvedCommitEntries](#resolvedcommitentries)

#### Post Calculate Version

These variables are available starting from the first [`command-hooks > post-calculate-version`](./config-options.md#command-hooks--post-calculate-version-optional) command runs.

- [currentVersion](#currentversion)
- [nextVersion](#nextversion)

#### Pre Commit

These variables are available starting from the first [`command-hooks > pre-commit`](./config-options.md#command-hooks--pre-commit-optional) command runs.

- [committedFilePaths](#committedfilepaths)

#### Post Commit

These variables are available starting from the first [`command-hooks > post-commit`](./config-options.md#command-hooks--post-commit-optional) command runs.

- [commitHash](#commithash)

#### Post Proposal

These variables are available starting from the first [`command-hooks > post-proposal`](./config-options.md#command-hooks--post-proposal-optional) command runs.

- [jobs](#jobs)

#### Pre Tag

These variables are available starting from the first [`command-hooks > pre-tag`](./config-options.md#command-hooks--pre-tag-optional) command runs.

- [nextVersion](#nextversion)

#### Pre Release

These variables are available starting from the first [`command-hooks > pre-release`](./config-options.md#command-hooks--pre-release-optional) command runs.

- [tagHash](#taghash)

#### Post Release

These variables are available starting from the first [`command-hooks > post-release`](./config-options.md#command-hooks--post-release-optional) command runs.

- [releaseId](#releaseid)
- [releaseUploadUrl](#releaseuploadurl)

#### Final (available at the end)

These variables are available for [`command-hooks > post-run`](./config-options.md#command-hooks--post-run-optional) command runs.

- [outcome](#outcome)

### Variable Details

#### triggerCommitHash

Trigger commit hash

- Output: `zr-trigger-commit-hash`
- Env: `ZR_TRIGGER_COMMIT_HASH`

#### triggerBranchName

Trigger branch name

- Output: `zr-trigger-branch-name`
- Env: `ZR_TRIGGER_BRANCH_NAME`

#### workspacePath

Workspace path

- Output: `zr-workspace-path`
- Env: `ZR_WORKSPACE_PATH`

#### configPath

Config file path

- Output: `zr-config-path`
- Env: `ZR_CONFIG_PATH`

#### configFormat

Config file format

- Output: `zr-config-format`
- Env: `ZR_CONFIG_FORMAT`

#### configOverride

Config override string

- Output: `zr-config-override`
- Env: `ZR_CONFIG_OVERRIDE`

#### configOverrideFormat

Config override format

- Output: `zr-config-override-format`
- Env: `ZR_CONFIG_OVERRIDE_FORMAT`

#### sourceMode

Source mode string from inputs, preserved as-is (JSON stringified)

- Output: `zr-source-mode-str`
- Env: `ZR_SOURCE_MODE_STR`

#### internalSourceMode

Internally resolved source mode object (JSON stringified). The object has the shape `{ mode: "remote" | "local", overrides?: Record<string, "remote" | "local"> }`, where `overrides` is a map of file paths to mode values. See [source mode docs](./input-options.md#source-mode-optional).

- Output: `zr-internal-source-mode`
- Env: `ZR_INTERNAL_SOURCE_MODE`

#### parsedTriggerCommit

Parsed commit object for the latest commit that triggered the operation (JSON stringified). [View the commit object structure](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-commits-parser#usage)

- Output: `zr-trigger-commit`
- Env: `ZR_TRIGGER_COMMIT`

#### parsedTriggerCommitList

Array of parsed commit objects that triggered the operation (JSON stringified). A list can contain multiple commits, for example when you push multiple local commits at once. [View the commit object structure](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-commits-parser#usage)

- Output: `zr-trigger-commit-list`
- Env: `ZR_TRIGGER_COMMIT_LIST`

#### workingBranchName

Working branch name used by the operation

- Output: `zr-working-branch-name`
- Env: `ZR_WORKING_BRANCH_NAME`

#### workingBranchRef

Working branch ref (e.g. `refs/heads/feature-login`)

- Output: `zr-working-branch-ref`
- Env: `ZR_WORKING_BRANCH_REF`

#### workingBranchHash

Working branch HEAD commit hash

- Output: `zr-working-branch-hash`
- Env: `ZR_WORKING_BRANCH_HASH`

#### releaseFlow

The release flow. It is the same as the config [`release-flow`](./config-options.md#release-flow-optional) option and is included here for convenience

- Output: `zr-release-flow`
- Env: `ZR_RELEASE_FLOW`

#### operation

For [`release-flow`](./config-options.md#release-flow-optional) "review", value is "propose" in "prepare" phase (when creating or updating proposal), "release" in "publish" phase (when creating tag or publishing release). For [`release-flow`](./config-options.md#release-flow-optional) "auto", value is "autorelease"

- Output: `zr-operation`
- Env: `ZR_OPERATION`

#### jobs

Stringified array of jobs being executed. For [`release-flow`](./config-options.md#release-flow-optional) "review", available from the base phase with values "create-proposal" or "update-proposal" during "propose" operation, and "create-tag"/"create-release" during "release" operation. For [`release-flow`](./config-options.md#release-flow-optional) "auto", available after the prepare phase with values "create-commit", "create-tag", and/or "create-release".

- Output: `zr-jobs`
- Env: `ZR_JOBS`

#### startTime

The operation start time in ISO format

- Output: `zr-start-time`
- Env: `ZR_START_TIME`

#### config

**Current** resolved config object taken directly from the user, preserved as-is (JSON stringified). This value updates dynamically if a [`runtime-config-override`](./config-options.md#runtime-config-override-optional) is applied during execution, ensuring it always reflects the active configuration rules.

- Output: `zr-config`
- Env: `ZR_CONFIG`

#### internalConfig

**Current** internally resolved config object, with camelCase keys and normalized values (e.g., a prop that accepts a string or an array is normalized to an array containing a single string) (JSON stringified). This value also updates dynamically if a [`runtime-config-override`](./config-options.md#runtime-config-override-optional) is applied during execution. For schema shape see: [config.ts](../src/schemas/configs/config.ts)

- Output: `zr-internal-config`
- Env: `ZR_INTERNAL_CONFIG`

#### patternContext

**Current** string pattern context object (JSON stringified). Contains all available string pattern variables that can be used in string templates. Dynamic values (functions or async functions) are resolved at stringify time, ensuring the exported context reflects the **current** state of all pattern variables. See: [pattern-context.ts](../src/tasks/string-templates-and-patterns/pattern-context.ts). For example, the patternContext exposed at `command-hooks > pre-run` might be differ compared to the patternContext exposed at `command-hooks > pre-calculate-version`

- Output: `zr-pattern-context`
- Env: `ZR_PATTERN_CONTEXT`

#### proposalId

Proposal ID (pull request number, ...). For "propose" operation (create/update proposal), it is the proposal ID we are working with. For "release" operation, it is the proposal ID we just merged into. Will be undefined if proposal not found. For example, when there is no proposal open for "propose" operation yet, the initial value will be undefined. Then the "create-proposal" job will create the proposal, and re-update the number. The value can now be accessed in the next cmds like ([`command-hooks > post-proposal`](./config-options.md#command-hooks--post-proposal-optional))

- Output: `zr-proposal-id`
- Env: `ZR_PROPOSAL_ID`

#### resolvedCommitEntries

Array of resolved commit entries (parsed and filtered) from the trigger commit to the last release (JSON stringified). Each entry contains fields such as hash, type, scope, subject, isBreaking, etc. See: [commit.ts](../src/tasks/commit.ts)

- Output: `zr-resolved-commit-entries`
- Env: `ZR_RESOLVED_COMMIT_ENTRIES`

#### currentVersion

Current version string (the current version of your project)

- Output: `zr-current-version`
- Env: `ZR_CURRENT_VERSION`

#### nextVersion

The calculated next version string to be used for the release.

- Output: `zr-next-version`
- Env: `ZR_NEXT_VERSION`

#### commitHash

The committed commit hash. For [`release-flow`](./config-options.md#release-flow-optional) "review", it is the commit on the working branch. For [`release-flow`](./config-options.md#release-flow-optional) "auto", it is the commit on the trigger branch

- Output: `zr-commit-hash`
- Env: `ZR_COMMIT_HASH`

#### committedFilePaths

Stringified array of file paths that have been committed

- Output: `zr-committed-file-paths`
- Env: `ZR_COMMITTED_FILE_PATHS`

#### tagHash

Git tag hash created for the release

- Output: `zr-tag-hash`
- Env: `ZR_TAG_HASH`

#### releaseId

Platform-specific release identifier (for example, GitHub release ID). May be empty if no release was created (for example, when [`release > create-release`](./config-options.md#release--create-release-optional) is disabled or the platform does not support releases)

- Output: `zr-release-id`
- Env: `ZR_RELEASE_ID`

#### releaseUploadUrl

Platform-specific upload URL for release assets (for example, GitHub release upload URL). May be empty if not supported or no release was created

- Output: `zr-release-upload-url`
- Env: `ZR_RELEASE_UPLOAD_URL`

#### outcome

The outcome status of the operation. Possible values are "success" (completed successfully), "skipped" (exited intentionally and safely, e.g., no version bump required), or "failure" (stopped by an unexpected error)

- Output: `zr-outcome`
- Env: `ZR_OUTCOME`

## Workspace Variables (Monorepo Mode)

When operating in monorepo mode (i.e., the config has a [`workspace`](./config-options.md#workspace-optional) property), additional variables are exported.

### Summary Variables

These are exported after all per-workspace version calculations complete, before the commit phase.

#### isMonorepo

Whether the operation is running in monorepo mode.

- Output: `zr-is-monorepo`
- Env: `ZR_IS_MONOREPO`
- Value: `"true"` or `"false"`

#### name

The current workspace name. Updated during per-workspace phases.

- Output: `zr-name`
- Env: `ZR_NAME`

#### workspaces

JSON array of all workspace data objects. Each object contains: `name`, `nextVersion`, `tagName`, `path`.

- Output: `zr-workspaces`
- Env: `ZR_WORKSPACES`
- Value: `[{"name":"core","nextVersion":"1.2.3","tagName":"core-v1.2.3","path":"packages/core"}, ...]`

#### affectedWorkspaces

JSON array of affected workspace names (workspaces with changes since their last release).

- Output: `zr-affected-workspaces`
- Env: `ZR_AFFECTED_WORKSPACES`
- Value: `["core","cli"]`

### Per-Workspace Namespaced Variables

In monorepo mode, each workspace also gets **namespaced** env and output variables. These are useful for accessing specific workspace data in downstream CI/CD steps.

#### Naming Convention

| Type | Pattern | Example |
|---|---|---|
| Env | `ZR__<sanitized_name>__<CONSTANT_VAR>` | `ZR__core__NEXT_VERSION` |
| Output | `zr--<sanitized_name>--<kebab-var>` | `zr--core--next-version` |

#### Name Sanitization Rules

Workspace names may contain characters that are invalid in environment variable or output names. The following rules are applied:

- **Env vars**: any character not matching `[a-zA-Z0-9_]` is replaced with `_`
- **Output keys**: any character not matching `[a-zA-Z0-9_-]` is replaced with `_`

**Examples:**

| Original Name | Env Prefix | Output Prefix |
|---|---|---|
| `core` | `ZR__core__` | `zr--core--` |
| `@scope/pkg` | `ZR___scope_pkg__` | `zr--@scope_pkg--` |
| `my-lib` | `ZR__my_lib__` | `zr--my-lib--` |

#### Available Namespaced Variables

For each workspace, the following variables are exported:

| Variable | Env Example | Output Example |
|---|---|---|
| `nextVersion` | `ZR__core__NEXT_VERSION` | `zr--core--next-version` |
| `tagName` | `ZR__core__TAG_NAME` | `zr--core--tag-name` |
| `path` | `ZR__core__PATH` | `zr--core--path` |
