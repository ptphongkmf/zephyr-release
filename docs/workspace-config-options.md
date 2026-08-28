# Workspace Configuration Options <!-- omit from toc -->

Configuration reference for workspace members in a monorepo setup.

Each workspace member is defined under the root `workspace` property as a key-value pair, where the **key** is the relative path from the repository root, and the **value** is the workspace member configuration object.

## Inheritance <!-- omit from toc -->

All properties (except `name`) are **optional**. When omitted, the root config value is used. When provided, it is **deeply merged** with the root config — field-level inheritance, not full replacement.

For example, if the root config defines 5 commit types and a workspace defines 2, the workspace will use only its 2 commit types (array replacement, not merge). But for nested objects like `tag`, only the fields you specify will override (e.g., setting `tag.name-template` overrides just that field while keeping the root's `tag.create-tag` value).

## Example <!-- omit from toc -->

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

## Table of Content <!-- auto-generated, do not edit --> <!-- omit from toc -->

- [Properties](#properties)
  - [name (Required)](#name-required)
  - [initial-version (Optional)](#initial-version-optional)
  - [version-files (Required)](#version-files-required)
  - [commit-types (Optional)](#commit-types-optional)
  - [allowed-release-as-commit-types (Optional)](#allowed-release-as-commit-types-optional)
  - [bump-strategy (Optional)](#bump-strategy-optional)
  - [changelog (Optional)](#changelog-optional)
  - [commit (Optional)](#commit-optional)
  - [tag (Optional)](#tag-optional)
    - [name-template](#name-template)
  - [release (Optional)](#release-optional)
  - [review (Optional)](#review-optional)
  - [auto (Optional)](#auto-optional)
  - [command-hooks (Optional)](#command-hooks-optional)


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

[⬆ Back to top](#table-of-content)

### initial-version (Optional)

Type: `string`\
Default: `inherit from root`

The initial semver version for this workspace when no previous version is found.

[⬆ Back to top](#table-of-content)

### version-files (Required)

Type: `object | object[]`

Version file(s) for this workspace. Accepts a single file object or an array of file objects. Paths are **relative to the workspace directory**. See [config-options.md > version-files](./config-options.md#version-files-required) for the full version file schema.

Note: Unlike other fields, version files DO NOT inherit from root, they are required per-workspace.

[⬆ Back to top](#table-of-content)

### commit-types (Optional)

Type: `array of objects`\
Default: `inherit from root`

Override the conventional commit types recognized for this workspace. See [config-options.md > commit-types](./config-options.md#commit-types-optional).

[⬆ Back to top](#table-of-content)

### allowed-release-as-commit-types (Optional)

Type: `string | string[]`\
Default: `inherit from root`

Override which commit types are allowed to trigger a "Release-As" version override for this workspace.

[⬆ Back to top](#table-of-content)

### bump-strategy (Optional)

Type: `object`\
Default: `inherit from root`

Override version bumping behavior for this workspace. See [config-options.md > bump-strategy](./config-options.md#bump-strategy-optional).

[⬆ Back to top](#table-of-content)

### changelog (Optional)

Type: `object`\
Default: `inherit from root`

Override changelog generation behavior for this workspace. See [config-options.md > changelog](./config-options.md#changelog-optional).

[⬆ Back to top](#table-of-content)

### commit (Optional)

Type: `object`\
Default: `inherit from root`

Override commit message templates for this workspace. See [config-options.md > commit](./config-options.md#commit-optional).

[⬆ Back to top](#table-of-content)

### tag (Optional)

Type: `object`\
Default: `inherit from root`

Override tag creation behavior for this workspace. See [config-options.md > tag](./config-options.md#tag-optional) for the full schema.

#### name-template

Type: `string`\
Default: `{{name}}-v{{nextVersion}}`

Override the tag name template for this workspace. See [config-options.md > tag > name-template](./config-options.md#tag--name-template-optional).

[⬆ Back to top](#table-of-content)

### release (Optional)

Type: `object`\
Default: `inherit from root`

Override release creation behavior for this workspace. See [config-options.md > release](./config-options.md#release-optional).

[⬆ Back to top](#table-of-content)

### review (Optional)

Type: `object`\
Default: `inherit from root`

Override review/proposal behavior for this workspace. Identical to the root config but only accepts the following properties:
- [`body-template`](./config-options.md#review--body-template-optional)
- [`body-template-path`](./config-options.md#review--body-template-path-optional)

[⬆ Back to top](#table-of-content)

### auto (Optional)

Type: `object`\
Default: `inherit from root`

Override auto-release trigger strategy for this workspace. See [config-options.md > auto](./config-options.md#auto-optional).

[⬆ Back to top](#table-of-content)

### command-hooks (Optional)

Type: `object`\
Default: `inherit from root`

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
| `preCommit` | ❌ Root only |
| `postCommit` | ❌ Root only |
| `postProposal` | ❌ Root only |

The `ZR_NAME` environment variable is set to the current workspace name during per-workspace hook execution.

See [command-hooks.md](./command-hooks.md) for the full command hooks reference.
