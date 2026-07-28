# Workspace Configuration Options <!-- omit from toc -->

Configuration reference for workspace members in a monorepo setup.

Each workspace member is defined under the root `workspace` property as a key-value pair, where the **key** is the relative path from the repository root, and the **value** is the workspace member configuration object.

## Inheritance

All properties (except `name`) are **optional**. When omitted, the root config value is used. When provided, it is **deeply merged** with the root config — field-level inheritance, not full replacement.

For example, if the root config defines 5 commit types and a workspace defines 2, the workspace will use only its 2 commit types (array replacement, not merge). But for nested objects like `tag`, only the fields you specify will override (e.g., setting `tag.name-template` overrides just that field while keeping the root's `tag.create-tag` value).

## Example

```json
{
  "version-files": [{ "path": "package.json", "selector": "$.version" }],
  "tag": {
    "name-template": "v{{nextVersion}}"
  },
  "workspace": {
    "packages/core": {
      "name": "core",
      "version-files": [{ "path": "package.json", "selector": "$.version" }],
      "tag": {
        "name-template": "core-v{{nextVersion}}"
      }
    },
    "packages/cli": {
      "name": "cli",
      "version-files": [{ "path": "package.json", "selector": "$.version" }],
      "tag": {
        "name-template": "cli-v{{nextVersion}}"
      }
    }
  }
}
```

> [!NOTE]
> Version file paths are **relative to the workspace root**. If `packages/core` has `"path": "package.json"`, the resolved path is `packages/core/package.json`.

## Properties

### name (Required)

Type: `string`

The workspace member name. Used in:
- Tag names (via `{{name}}` in templates)
- Environment variables (`ZR_NAME`, `ZR__<name>__*`)
- GitHub Actions outputs (`zr--<name>--*`)
- Release-As footer parsing (`name@version`)

For env/output variable naming, characters not valid in shell identifiers are replaced with underscore:
- Env vars: any character not matching `[a-zA-Z0-9_]` → `_`
- Output keys: any character not matching `[a-zA-Z0-9_-]` → `_`

Original casing and structure are preserved ("least surprise" principle).

**Examples:**
| Name | Env key | Output key |
|---|---|---|
| `core` | `ZR__core__NEXT_VERSION` | `zr--core--next-version` |
| `@scope/pkg` | `ZR___scope_pkg__NEXT_VERSION` | `zr--@scope_pkg--next-version` |

### initial-version (Optional)

Type: `string`

Default: inherits from root config.

The initial semver version for this workspace when no previous version is found.

### version-files (Optional)

Type: array of version file objects

Default: inherits from root config.

Version files for this workspace. Paths are **relative to the workspace directory**. See [config-options.md > version-files](./config-options.md#version-files-required) for the full version file schema.

### commit-types (Optional)

Type: array of commit type objects

Default: inherits from root config.

Override the conventional commit types recognized for this workspace. See [config-options.md > commit-types](./config-options.md#commit-types-optional).

### allowed-release-as-commit-types (Optional)

Type: `string[]` or `"all"`

Default: inherits from root config.

Override which commit types are allowed to trigger a "Release-As" version override for this workspace.

### bump-strategy (Optional)

Type: bump strategy object

Default: inherits from root config (deeply merged).

Override version bumping behavior for this workspace. See [config-options.md > bump-strategy](./config-options.md#bump-strategy-optional).

### changelog (Optional)

Type: changelog object

Default: inherits from root config (deeply merged).

Override changelog generation behavior for this workspace. See [config-options.md > changelog](./config-options.md#changelog-optional).

### commit (Optional)

Type: commit object

Default: inherits from root config (deeply merged).

Override commit message templates for this workspace. See [config-options.md > commit](./config-options.md#commit-optional).

### tag (Optional)

Type: tag object

Default: inherits from root config (deeply merged).

Override tag creation behavior for this workspace. The `name-template` is commonly overridden to include the workspace name:

```json
{
  "tag": {
    "name-template": "{{name}}-v{{nextVersion}}"
  }
}
```

When the root config has a `workspace` property, the **default** `tag.name-template` for all workspaces becomes `{{name}}-v{{nextVersion}}` (instead of `v{{nextVersion}}`).

See [config-options.md > tag](./config-options.md#tag-optional).

### release (Optional)

Type: release object

Default: inherits from root config (deeply merged).

Override release creation behavior for this workspace. See [config-options.md > release](./config-options.md#release-optional).

### review (Optional)

Type: review object

Default: inherits from root config (deeply merged).

Override review/proposal behavior for this workspace.

> [!NOTE]
> When `review.groupProposals` is `true` (the default and currently the only supported mode in monorepo), `postCommit` and `postProposal` hooks defined here are **ignored** — only the root config's hooks fire for these global phases.

### auto (Optional)

Type: auto object

Default: inherits from root config (deeply merged).

Override auto-release trigger strategy for this workspace. See [config-options.md > auto](./config-options.md#auto-optional).

### command-hooks (Optional)

Type: command hooks object

Default: inherits from root config (deeply merged).

Per-workspace command hook overrides. Only per-workspace hooks are active from this config:

| Hook | Fires from workspace config? |
|---|---|
| `preCalculateVersion` | ✅ Per-workspace |
| `postCalculateVersion` | ✅ Per-workspace |
| `preTag` | ✅ Per-workspace |
| `preRelease` | ✅ Per-workspace |
| `postRelease` | ✅ Per-workspace |
| `preRun` | ❌ Root only |
| `postRun` | ❌ Root only |
| `preCommit` | ❌ Root only (grouped mode) |
| `postCommit` | ❌ Root only (grouped mode) |
| `postProposal` | ❌ Root only (grouped mode) |

The `ZR_NAME` environment variable is set to the current workspace name during per-workspace hook execution.

See [command-hooks.md](./command-hooks.md) for the full command hooks reference.
