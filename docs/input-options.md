# Input options <!-- omit from toc -->

All available input options for Zephyr Release. They are all optional - default values are used when not provided.

## Table of Content <!-- omit from toc -->

- [Options](#options)
  - [token (Optional)](#token-optional)
  - [config-path (Optional)](#config-path-optional)
  - [config-format (Optional)](#config-format-optional)
  - [config-override (Optional)](#config-override-optional)
  - [config-override-format (Optional)](#config-override-format-optional)
  - [source-mode (Optional)](#source-mode-optional)

## Options

### token (Optional)

Type: `string`\
Default: `${{ github.token }}` for github

Authentication token for Zephyr Release operations.

### config-path (Optional)

Type: `string`\
Default: `"zephyr-release-config.json"`

Path to the Zephyr Release config file, relative to the project root.

### config-format (Optional)

Type: `"auto" | "json" | "jsonc" | "json5" | "yaml" | "toml"`\
Default: `"auto"`

The format of the config file.

### config-override (Optional)

Type: `string`\
Default: `""`

Config content provided as a literal block scalar (`|`). It is merged with the config file and overrides duplicate keys.

### config-override-format (Optional)

Type: `"auto" | "json" | "jsonc" | "json5" | "yaml" | "yml" | "toml"`\
Default: `"auto"`

The format of `config-override`.

### source-mode (Optional)

Type: `"remote" | "local" | object`\
Default: `"remote"`

Defines the data execution strategy and source of truth for the operation.

- **`remote`**: Optimized for performance. Operations are performed via remote API calls. This mode does not require a local checkout of the repository.
- **`local`**: Operations are performed on the runner's filesystem. This mode is required if your workflow involves local file modifications (e.g., via [`command-hooks`](./config-options.md#command-hooks-optional)).
- **`object`**: A JSON object allowing for granular control over which specific file paths use the local filesystem versus the remote API.

**Object Structure:**

When providing a JSON object, use the following structure:

```json
{
  "mode": "remote",
  "overrides": {
    "<path>": "local or remote"
  }
}
```

- **`mode`**: Global default mode for all operations. Either `"remote"` or `"local"`. Defaults to `"remote"` when omitted.
- **`overrides`**: An optional map of **file paths** to `"local"` or `"remote"`.
  - **Key**: An exact file path string, as used in your config (for example, `CHANGELOG.md`, `.github/zephyr-release-config.jsonc`, `templates/pr-title.txt`, `deno.json`).
  - **Value**: Either `"local"` or `"remote"`.

At runtime, Zephyr Release resolves the source mode for any file it needs by looking up:

```text
sourceMode.overrides[<path>] ?? sourceMode.mode
```

This means:

- If an override exists for a given path, its value is used.
- If no override exists, the global `mode` is used instead.

**Examples:**

Use remote API for everything except the changelog file, which should be read from disk:

```json
{
  "mode": "remote",
  "overrides": {
    "CHANGELOG.md": "local"
  }
}
```

Use local filesystem for everything, but read a specific template file from the remote repository:

```json
{
  "mode": "local",
  "overrides": {
    "templates/release-title.md": "remote"
  }
}
```

Tie version file resolution to a specific file path (matching your [`version-files`](./config-options.md#version-files-required) config):

```json
{
  "mode": "remote",
  "overrides": {
    "deno.json": "local"
  }
}
```

> [!Important]
> If `source-mode` is set to `local` (globally or for a specific path override), a valid local workspace must exist. If required files are missing from the disk, the operation will fail with an error to prevent state mismatch between the local environment and the remote provider.
