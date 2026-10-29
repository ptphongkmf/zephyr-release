# Monorepo Support — Schema Generation & Workspace Mode Design (Draft 4)

> **Status:** Draft / Technical Design  
> **Date:** 2026-05-25  
> **Scope:** Resolving feedback on exporting separate JSON schemas for path-based workspace files, evaluating the complexity and dependency implications of per-package execution modes, adopting platform-agnostic terminology (`group-proposals`), and updating default tag templates.

---

## 1. Separate JSON Schema for Workspace Member Configs

When users choose a **path-based** workspace configuration (pointing to a standalone file like `packages/core/zephyr.json`), that file should not reference the root `config-v1.json` schema. The root schema contains fields like `workspace` and global configuration blocks which are invalid inside a workspace member file.

We will export a dedicated JSON schema specifically for workspace-level files, generated directly from `WorkspaceMemberConfigSchema`.

### Configuration Reference Example
For a path-based workspace file:
```json
{
  "$schema": "https://raw.githubusercontent.com/ptphongkmf/zephyr-release/main/schemas/v1/workspace-member-v1.kebab.json",
  "name": "core",
  "version-files": ["package.json"],
  "tag": {
    "name-template": "{{ name }}-v{{ nextVersion }}"
  }
}
```

### Implementing in `scripts/gen-json-schema.ts`
We will update [gen-json-schema.ts](file:///g:/Projects/Coding/zephyr-release/scripts/gen-json-schema.ts) to generate both the root config schemas and the workspace-member config schemas for each casing style.

```typescript
import { ConfigSchema } from "../src/schemas/configs/config.ts";
import { WorkspaceMemberConfigSchema } from "../src/schemas/configs/modules/workspace-config.ts";
import { TimeZoneSchema } from "../src/schemas/configs/modules/components/timezone.ts";

// Define the two schemas we want to export
const SCHEMAS_TO_GENERATE = [
  {
    name: "config-v1",
    schema: ConfigSchema,
    definitions: { 
      timeZone: TimeZoneSchema,
      workspaceMemberConfig: WorkspaceMemberConfigSchema
    }
  },
  {
    name: "workspace-member-v1",
    schema: WorkspaceMemberConfigSchema,
    definitions: {
      timeZone: TimeZoneSchema
    }
  }
];

// Inside gen-json-schema.ts loop:
for (const schemaInfo of SCHEMAS_TO_GENERATE) {
  const baseSchema = toJsonSchema(schemaInfo.schema, {
    typeMode: "input",
    definitions: schemaInfo.definitions,
    ignoreActions: ["trim", "safe_integer", "to_lower_case"],
  });

  for (const { outputFile, casingFn } of SCHEMA_CONFIG) {
    const finalOutputFile = outputFile.replace("config-v1", schemaInfo.name);
    const schema = structuredClone(baseSchema);
    const { transformKeys, transformDescriptions } = createTransformers(casingFn);

    traverse.default(schema, transformKeys, { mutable: true });
    traverse.default(schema, transformDescriptions, { mutable: true });

    const outputPath = join(
      import.meta.dirname!,
      `../schemas/${SCHEMA_VERSION}/${finalOutputFile}`,
    );

    Deno.mkdirSync(dirname(outputPath), { recursive: true });
    Deno.writeTextFileSync(
      outputPath,
      JSON.stringify(schema, null, 2),
    );
  }
}
```
This generates the following six output files under `schemas/v1/`:
- `config-v1.kebab.json` / `config-v1.camel.json` / `config-v1.snake.json`
- `workspace-member-v1.kebab.json` / `workspace-member-v1.camel.json` / `workspace-member-v1.snake.json`

---

## 2. Per-Package Execution Mode Overrides (`review` vs `auto`)

We analyzed the complexity of allowing individual packages to override the execution `mode` (e.g. `packages/core` uses `review` mode while `packages/cli` uses `auto` mode) and whether this conflicts with future dependency graphs.

### Complexity 1: Git Conflict & Branch Synchronization
In a single run, Zephyr Release would have to process two separate execution strategies:
1. **`auto` mode packages**: Immediately calculates versions, writes files, commits, tags, and pushes directly to the target branch (e.g., `main`).
2. **`review` mode packages**: Branches off the trigger state, commits version and changelog bumps, and pushes to a proposal branch (e.g., `zephyr-release/proposal`).

If a single trigger run executes both:
- The `auto` push modifies the remote target branch (`main`).
- The `review` push creates/updates a proposal branch branched from the older state of `main`.
- This creates divergence. Subsequent merges of the proposal PR will face merge conflicts because the target branch has moved forward with `auto` bumps.

### Complexity 2: Dependency Graph Violations
If we add dependency-graph cascading in the future:
- **Scenario A**: An `auto` package (`cli`) depends on a `review` package (`core`).
  - If a commit touches `core`, it triggers a version bump for `core` (proposed in a PR).
  - Due to dependency, `cli` must also bump its dependency reference.
  - Since `cli` is in `auto` mode, does it push the updated dependency reference immediately to `main`? If it does, the dependency is broken on `main` because `core`'s new version has not been merged/published yet.
- **Scenario B**: A `review` package (`cli`) depends on an `auto` package (`core`).
  - `core` gets bumped and published to `main` immediately.
  - `cli` gets proposed. The proposal branch must pull/rebase the new `core` version from `main`.

### Is it impossible or just a hack?
It is **not strictly impossible**, but it is fundamentally a **hack** that breaks the core philosophy of a monorepo.

To technically achieve it, Zephyr Release would have to serialize the pipelines: run all `auto` packages first, push to `main`, then checkout the new `main`, branch off for `review` packages, and create the proposal. 

However, this is **logically incorrect** and an anti-pattern for the following reasons:
1. **Breaks Atomic Commits**: If a developer makes a single commit that touches both `packages/core` (`review`) and `packages/cli` (`auto`), splitting that commit across two different release lifecycles destroys the atomic nature of the change. `cli` would publish immediately with its half of the change, while `core` waits in a PR. If the PR is rejected or modified, the repo is left in a broken, half-released state.
2. **Breaks "Single State" Reality**: A monorepo represents a single, unified state of the codebase. A release tool's job is to release that state. Mixing `auto` and `review` splits the codebase into two diverging timelines during a release.

**Conclusion:** It is a hack around a philosophical mismatch. The repository should either be fully automated (CD) or require human review. It is **impossible to do cleanly**, and attempting it would just be a series of dangerous workarounds. Therefore, `mode` must remain global.

---

## 3. Agnostic Naming: `review.group-proposals`

Zephyr Release aims to be platform-agnostic. Since GitHub uses Pull Requests, GitLab uses Merge Requests, and Bitbucket uses Pull Requests, the tool internally uses the agnostic term **proposals**.

To align with this, the configuration property is renamed from `review.group-pull-requests` to:

`review.group-proposals` (boolean, default: `true`)

*   **`true`**: Commits and version bumps for all workspaces are grouped into a single agnostic proposal (one branch, one PR/MR).
*   **`false`**: Each workspace gets its own branch and proposal (one PR/MR per package).

---

## 4. Default Tag Naming Convention

We will use the hyphenated convention as the default tag naming structure for monorepo workspaces:

`{{ name }}-v{{ nextVersion }}` (e.g., `core-v1.2.0`)

This avoids potential issues with certain Git hosting tools or CI pipelines that treat slash-divided tags (`core/v1.2.0`) as folders or namespaces. Users can still customize this format in their package settings via the `tag.nameTemplate` property.

---

## 5. Summary of Final Configuration Structure

An updated example of a monorepo configuration with both inline and path-based configurations, utilizing the new casing and names:

### Root Config (`zephyr-release-config.json`)
```json
{
  "name": "my-monorepo",
  "mode": "review",
  "review": {
    "group-proposals": true
  },
  "workspace": {
    "packages/core": {
      "name": "core",
      "version-files": ["package.json"]
    },
    "packages/cli": "packages/cli/zephyr-member.json"
  }
}
```

### Path-Based Workspace Config (`packages/cli/zephyr-member.json`)
```json
{
  "$schema": "https://raw.githubusercontent.com/ptphongkmf/zephyr-release/main/schemas/v1/workspace-member-v1.kebab.json",
  "name": "cli",
  "version-files": ["deno.json"]
}
```
