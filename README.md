# Zephyr Release

> [!WARNING]
> 🚧 Currently under development 🚧

💨🍃 Zephyr Release is yet another automated tool for version bumping, changelog generation, and release publishing.

**It follows Conventional Commits and uses Semantic Versioning for version numbers but skips strict bump rules in favor of a more flexible approach.**

*Designed for my personal use, but may also be useful to others.*

*Hugely inspired by [`googleapis/release-please`](https://github.com/googleapis/release-please) [`googleapis/release-please-action`](https://github.com/googleapis/release-please-action).*

## Key Features

### Adaptable Configuration

Zephyr Release is designed to integrate seamlessly into any environment, providing both a natural fit for your codebase and the flexibility to adapt at runtime.

- **Multiple File Formats:** ZR supports **JSON** (including JSONC and JSON5), **YAML**, and **TOML**. Pick the format that feels most at home in your repository.
- **Flexible Casing:** You don't have to change your coding style to use this tool. ZR provides dedicated schemas for different naming conventions:
  - **Using Python or Rust?** Try the [snake_case schema](./schemas/v1/config-v1.snake.json).
  - **Using JavaScript or C#?** Use the [camelCase schema](./schemas/v1/config-v1.camel.json).
  - **Prefer an agnostic, readable style?** The [kebab-case schema](./schemas/v1/config-v1.kebab.json) is perfect for a clean, language-neutral look.
- **Dynamic Config Overrides:** Need to change settings on the fly? You can inject configuration overrides directly from your CI/CD workflow or generate them at runtime using custom scripts. [Learn more about dynamic overrides](#dynamic-configuration-overrides).

### Extensible Workflows with Hooks

Zephyr Release isn't a black box. You can easily plug into almost every step of the release process to run your own custom scripts, tests, or notifications using [`command-hooks`](./docs/command-hooks.md).

- **Rich Execution Flow:** Whether you need to run something right before a version is calculated ([`pre-calculate-version`](./docs/config-options.md#command-hooks--pre-calculate-version-optional)), after a release is published ([`post-release`](./docs/config-options.md#command-hooks--post-release-optional)), or just a general cleanup at the very end ([`post-run`](./docs/config-options.md#command-hooks--post-run-optional)), there's a hook for that.
- **Context Aware:** Your scripts don't run blind. Each hook gets access to a rich set of [environment variables](./docs/export-variables.md) like the next version, commit hashes, or dynamic template contexts to help your scripts do exactly what you need.

[See the full list of available hooks here](./docs/command-hooks.md).

### Monorepo Support

Manage multiple packages in a single repository with independent versioning, changelogs, tags, and releases — all in one operation.

- **Workspace-Aware Releases:** Define workspace members in your config with the [`workspace`](./docs/config-options.md#workspace-optional) property. Each workspace gets its own version, changelog, and tag while sharing a single commit. See the [full workspace config reference](./docs/workspace-config-options.md).
- **Affected Workspace Detection:** Only workspaces with changes since their last release are processed. Changes are detected via tag-based lookup and path-filtered commit analysis.
- **Per-Workspace Hooks:** Some hooks fire once per workspace (like `pre-tag` and `post-release`), while others fire globally (like `pre-commit`). Each workspace can override hook commands independently. See [hook scoping in monorepo mode](./docs/command-hooks.md#monorepo-mode-hook-scoping).
- **Namespaced Variables:** Access per-workspace data in your CI/CD pipelines via namespaced [environment variables and outputs](./docs/export-variables.md#workspace-variables-monorepo-mode) (e.g., `ZR__core__NEXT_VERSION`).

## Getting Started

### First, a config file

below is a minimal working one

```json
{
  // or *.camel.json / *.snake.json
  "$schema": "https://raw.githubusercontent.com/ptphongkmf/zephyr-release/refs/heads/main/schemas/v1/config-v1.kebab.json",

  // you need at least 1 primary version file, this is your "source of truth" version
  "version-files": {
    "path": "deno.json",
    "selector": "$.version"
  }
}
```

> *for full list of options, see [config-options.md](./docs/config-options.md)*

### Second, an input file

For github, it is your `.github/workflows/zephyr-release.yml`

```yaml
name: Zephyr Release

on:
  push:
    branches:
      - main # Or your default branch

# !IMPORTANT: Prevents parallel runs and forces them into a safe queue.
concurrency:
  # The group name can be anything, but combining these two variables is best practice:
  # github.workflow: The name of this workflow (e.g., "Zephyr Release").
  # github.ref: The branch ref. Ensures pushes to different branches (e.g., 'main' vs 'dev') don't block each other.
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  zephyr-release:
    runs-on: ubuntu-latest

    # Permissions are only needed if you use default GITHUB_TOKEN
    # For a PAT or GitHub App token, permissions are set by you on creation
    # permissions:
    #   contents: write
    #   pull-requests: write
    #   issues: write

    steps:
      # Optional checkout
      # - name: Checkout Code
      #   uses: actions/checkout@v4

      - name: Run Zephyr Release
        uses: ptphongkmf/zephyr-release@v1
        with:
          token: ${{ secrets.CUSTOM_TOKEN }} # Omit this line to use the default GITHUB_TOKEN
          config-path: ".zephyr-release/config.jsonc"
          config-format: "jsonc"

          # Override specific config values directly in the workflow
          config-override: |
            {
              "name": "Override name"
            }

          # See docs for all available source-mode options:
          # https://github.com/ptphongkmf/zephyr-release/blob/main/docs/input-options.md#source-mode-optional
          source-mode: "local"
```

> *for full list of options, see [inputs-options.md](./docs/input-options.md)*

### ⚠️ Crucial: Managing Concurrency

Because Zephyr Release resolves history up to the specific trigger commit to manage proposals (PRs, MRs, ...) and tags/releases, running multiple workflows at the same time can lead to collisions or race conditions.

- In **Review Release Flow**, parallel runs can collide while trying to update the same Release Proposal.
- In **Auto Release Flow**, parallel runs will try to push version bump commits and Git tags to your branch simultaneously, resulting in Git push rejections and failed workflows.

To prevent this, you must handle **parallel runs (concurrency)** by putting workflows into a queue so they run one-at-a-time (as shown above)

> *More [examples](./docs/examples/).*

## How It Works

Zephyr Release automates your versioning and changelogs. You can choose between two distinct [release flows](./docs/config-options.md#release-flow-optional) for your workflow:

- **Review Release Flow:** Creates a release proposal and await for human approval.
- **Auto Release Flow:** Releases automatically on every ***valid*** push (based on your [strategy](./docs/config-options.md#auto--trigger-strategy-optional)).

### 1. The Trigger

Begin by creating commits that follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.\
If you are working through proposals (recommended), you should use **Squash and Merge** to maintain a linear git history.

#### Handling Multiple Changes in one proposal (Review Release Flow)

If a single proposal (PR, MR, ...) contains multiple features or fixes that need individual changelog entries, you can use `APPEND` or `OVERRIDE` blocks in your proposal commit body. Zephyr Release will parse these blocks and treat each entry as an individual commit for versioning purposes.

> Each entry must be a single line and follow the conventional format: `<type>(<scope>)<!>: <description>`.\
> If both an `APPEND` and `OVERRIDE` block exist, `OVERRIDE` will take over.

Example:

```text
feat: add multiple changes

this is proposal commit body

footer: zephyr

START_OVERRIDE_CHANGES
feat: add authentication layer
fix: resolve memory leak in worker threads
docs: update API documentation
END_OVERRIDE_CHANGES
```

### 2. The Execution (Based on Release Flow)

Depending on your chosen release flow, Zephyr Release will take different actions when a change is detected on your branch.

#### Release Flow: Review (Default)

This release flow is best for teams that want human eyes on a release before it goes live.

- **The Proposal:** Zephyr Release automatically creates (or updates) a **Release Proposal**. It calculates the next [Semantic Version](https://semver.org/), updates your `version-files` (e.g., `deno.json`), and generates a changelog preview. The proposal stays open and updates automatically with every new commit.
- **The Release:** When you are ready to ship, simply **merge** the proposal. Zephyr Release detects the merge, automatically creates a Git Tag, and publishes the final Release.

#### Release Flow: Auto

This release flow is perfect for libraries, packages, or rapid continuous deployment where no human review is needed.

- **Direct Release:** Zephyr Release bypasses the proposal entirely. It calculates the new version, updates your files, generates the changelog, and pushes a new commit directly back to your branch.
- **Instant Tagging:** In the exact same run, it creates the Git Tag and publishes the Release. *(Note: Zephyr automatically formats the commit to prevent infinite CI loops).*

## Dynamic Configuration Overrides

Sometimes a static configuration file is not enough. For example, you might want to dynamically change the release notes based on the current branch or an external API. Zephyr Release gives you two ways to change your settings on the fly:

**1. Workflow Input Override:** You can generate configuration data in an earlier step of your CI/CD workflow and pass it directly into the operation using the [`config-override`](./docs/input-options.md#config-override-optional) input. This is great if your workflow already knows what needs to change before Zephyr Release even starts.

**2. Runtime File Override:** If you need to calculate settings *during* the release process itself, you can use [`runtime-config-override`](./docs/config-options.md#runtime-config-override-optional). By pairing it with various [`command-hooks`](./docs/config-options.md#command-hooks-optional) options, you can run a custom script that generates a temporary JSON file on the runner. Zephyr Release will automatically read this file and merge it into your configuration after any command hook runs.

## Force a Specific Version

Sometimes you need to set a version number manually instead of letting the tool calculate it for you.

You can do this by adding `release-as:` or `release as:` (case insensitive) as a commit footer, followed by the version you want.

**Single-repo:**

```text
feat: add a massive new feature

This change is so big we want to jump to 2.0.0.

release-as: 2.0.0
```

**Monorepo** — use the `name@version` syntax to target specific workspaces:

```text
feat: update core and cli packages

release-as: core@2.0.0
release-as: cli@1.5.0
```

- `release-as: <version>` (without a name) applies to **all** workspaces globally.
- `release-as: <name>@<version>` overrides a **specific** workspace.
- Workspace-scoped overrides take precedence over global overrides.

### Important things to know

- **Only the current commit works:** Zephyr Release only looks for this footer in the **specific commit** that triggers the release. If you had a "release-as" footer in an old commit from last week, it will be ignored.
- **Permissions:** By default, any commit can use this. However, you can change the [`allowed-release-as-commit-types`](./docs/config-options.md#allowed-release-as-commit-types-optional) setting in your config if you only want certain commit types (like `feat`) to be allowed to force a version.
