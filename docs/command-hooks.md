# Command Hooks

Command Hooks provide a way to execute custom shell scripts or commands at specific points during the Zephyr Release operation. This allows you to integrate your own logic - such as running tests, building artifacts, or sending notifications - seamlessly into the release process.

You can configure these hooks in your configuration file using the [`command-hooks`](./config-options.md#command-hooks-optional) option. During their execution, command hooks have access to a rich set of environment variables. You can learn more about these variables in the [Export Variables](./export-variables.md) and [String Templates and Patterns](./string-templates-and-patterns.md) documentation to understand what resources are available to your commands as environment variables.

## Execution Flow

The execution flow illustrates exactly when your scripts will run and how they fit into the broader Zephyr Release process. This helps you understand the operational context when each hook is triggered.

### Review Release Flow

In review release flow, the operation is split into two distinct phases depending on the state of the release proposal. Below is the flow for each phase:

#### Prepare Phase

This phase runs when creating or updating a release proposal.

1. Bootstrap operation and export base operation variables.

2. **Run [`command-hooks.pre-run`](./config-options.md#command-hooks--pre-run-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

3. Parse commits.

4. Export pre-calculate-version operation variables.

5. **Run [`command-hooks.pre-calculate-version`](./config-options.md#command-hooks--pre-calculate-version-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

6. Calculate the next version.

7. Export post-calculate-version operation variables.

8. **Run [`command-hooks.post-calculate-version`](./config-options.md#command-hooks--post-calculate-version-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

9. Generate changelog release content and prepare changes in working directory.

10. Export pre-commit operation variables.

11. **Run [`command-hooks.pre-commit`](./config-options.md#command-hooks--pre-commit-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

12. Commit changes to the working branch.

13. Export post-commit operation variables.

14. **Run [`command-hooks.post-commit`](./config-options.md#command-hooks--post-commit-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

15. Create/update the proposal.

16. Export post-proposal operation variables.

17. **Run [`command-hooks.post-proposal`](./config-options.md#command-hooks--post-proposal-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

18. Export final operation variables.

19. **Run [`command-hooks.post-run`](./config-options.md#command-hooks--post-run-optional) commands.**

#### Publish Phase

This phase runs when merging a release proposal, triggering the actual release. Note that this phase will only execute if [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled.

1. Bootstrap operation and export base operation variables.

2. **Run [`command-hooks.pre-run`](./config-options.md#command-hooks--pre-run-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

3. Generate changelog release content and extract the next version.

4. Export pre-tag operation variables.

5. **Run [`command-hooks.pre-tag`](./config-options.md#command-hooks--pre-tag-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

6. Create the Git tag.

7. *(If [`release.create-release`](./config-options.md#release--create-release-optional) is enabled)* Export pre-release operation variables.

8. *(If [`release.create-release`](./config-options.md#release--create-release-optional) is enabled)* **Run [`command-hooks.pre-release`](./config-options.md#command-hooks--pre-release-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

9. *(If [`release.create-release`](./config-options.md#release--create-release-optional) is enabled)* Create the platform release.

10. *(If [`release.create-release`](./config-options.md#release--create-release-optional) is enabled)* Attach release assets.

11. Export post-release operation variables.

12. **Run [`command-hooks.post-release`](./config-options.md#command-hooks--post-release-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

13. Export final operation variables.

14. **Run [`command-hooks.post-run`](./config-options.md#command-hooks--post-run-optional) commands.**

### Auto Release Flow

In auto release flow, the operation executes both the prepare and publish steps sequentially in a single run.

1. Bootstrap operation and export base operation variables.

2. **Run [`command-hooks.pre-run`](./config-options.md#command-hooks--pre-run-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

3. Parse commits.

4. Export pre-calculate-version operation variables.

5. **Run [`command-hooks.pre-calculate-version`](./config-options.md#command-hooks--pre-calculate-version-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

6. Calculate the next version.

7. Export post-calculate-version operation variables.

8. **Run [`command-hooks.post-calculate-version`](./config-options.md#command-hooks--post-calculate-version-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

9. Generate changelog release content and prepare changes in working directory.

10. Export pre-commit operation variables.

11. **Run [`command-hooks.pre-commit`](./config-options.md#command-hooks--pre-commit-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

12. Commit changes directly to the target branch.

13. Export post-commit operation variables.

14. **Run [`command-hooks.post-commit`](./config-options.md#command-hooks--post-commit-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

15. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* Export pre-tag operation variables.

16. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* **Run [`command-hooks.pre-tag`](./config-options.md#command-hooks--pre-tag-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

17. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* Create the Git tag.

18. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) and [`release.create-release`](./config-options.md#release--create-release-optional) are enabled)* Export pre-release operation variables.

19. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) and [`release.create-release`](./config-options.md#release--create-release-optional) are enabled)* **Run [`command-hooks.pre-release`](./config-options.md#command-hooks--pre-release-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

20. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) and [`release.create-release`](./config-options.md#release--create-release-optional) are enabled)* Create the platform release.

21. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) and [`release.create-release`](./config-options.md#release--create-release-optional) are enabled)* Attach release assets.

22. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* Export post-release operation variables.

23. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* **Run [`command-hooks.post-release`](./config-options.md#command-hooks--post-release-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

24. Export final operation variables.

25. **Run [`command-hooks.post-run`](./config-options.md#command-hooks--post-run-optional) commands.**

## Monorepo Mode: Hook Scoping

In monorepo mode, hooks are categorized as **global** or **per-workspace**. This determines which config's `command-hooks` definition is used and how many times the hook fires.

### Hook Scope Table

| Hook | Scope | Fires per... | Config source |
|---|---|---|---|
| `pre-run` | Global | Once | Root config only |
| `pre-calculate-version` | Per-workspace | Each workspace | Workspace config (merged with root) |
| `post-calculate-version` | Per-workspace | Each workspace | Workspace config (merged with root) |
| `pre-commit` | Global | Once | Root config only |
| `post-commit` | Global | Once | Root config only |
| `post-proposal` | Global | Once | Root config only |
| `pre-tag` | Per-workspace | Each workspace | Workspace config (merged with root) |
| `pre-release` | Per-workspace | Each workspace | Workspace config (merged with root) |
| `post-release` | Per-workspace | Each workspace | Workspace config (merged with root) |
| `post-run` | Global | Once | Root config only |

### Per-Workspace Hook Behavior

When a hook fires per-workspace:

1. **Config inheritance**: The workspace's `command-hooks` is deeply merged with the root's `command-hooks`. If a workspace defines `pre-tag`, it overrides the root's `pre-tag`. If it doesn't define `pre-tag`, the root's `pre-tag` is used.

2. **`ZR_NAME` env var**: During per-workspace hook execution, the `ZR_NAME` environment variable is set to the current workspace name.

3. **Config override via stdout**: Per-workspace hooks support the same stdout-based config override mechanism as single-repo mode. The override marker delimiters (`---zephyr-release-config-override-start---` / `---zephyr-release-config-override-end---`) work the same way. Overrides apply to the **current workspace's config** only.

### Global Hook Behavior

When a hook fires globally:

1. **Config source**: Always uses the **root** config's `command-hooks` definition. Workspace-level `command-hooks` for global hooks are **ignored**.

2. **Context**: `ZR_NAME` is not set (or empty). Global hooks operate on the aggregated state across all workspaces.

> [!NOTE]
> If a workspace defines `pre-commit`, `post-commit`, or `post-proposal` in its `command-hooks`, those definitions are silently ignored in grouped proposal mode. Only the root config's definitions for these hooks are used.
