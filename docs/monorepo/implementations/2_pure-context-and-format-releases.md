# Phase 2: Pure String Pattern Context & `format_releases` Filter

> **Scope:** Single-repo compatible. No monorepo dependency.  
> **Breaking changes:** Yes — removes the global `STRING_PATTERN_CONTEXT` singleton; changes default commit header template.  
> **Prerequisite for:** Phase 3 (monorepo workspace loop needs isolated contexts)

---

## Summary

Replace the global mutable `STRING_PATTERN_CONTEXT` singleton with an explicit context object that is built progressively in the workflows and passed down to every task that resolves templates.

Currently, template resolution works via side effects: `createFixed*` functions mutate a global object, and `resolveStringTemplate` reads from it implicitly. This makes workspace isolation impossible, hides ordering dependencies, and prevents meaningful testing.

The refactor:
1. **Deletes** `STRING_PATTERN_CONTEXT`, `BUILT_IN_CONTEXT`, `CUSTOM_CONTEXT` globals.
2. Converts all `createFixed*` / `createDynamic*` functions into **pure builder functions** that return a new context object.
3. Makes `context` a **required parameter** on `resolveStringTemplate`.
4. Threads the context object through workflows → tasks.
5. Adds `releases` context variable and `format_releases` filter for monorepo-ready commit messages.

---

## Key Design: `StringPatternContext`

A plain object that accumulates template variables as the workflow progresses. Workflows own the context; tasks receive it.

```typescript
// Just a type alias — it's a plain record, not a class
export type StringPatternContext = Record<string, unknown>;
```

Builder functions are pure — they take the current context and return a new one:

```typescript
export function addBaseContext(
  ctx: StringPatternContext,
  provider: PlatformProvider,
  triggerBranchName: string,
  config: CreateFixedStrPatCtxConfigParams,
  workingBranchName: string,
): StringPatternContext {
  return {
    ...ctx,
    name: config.name,
    host: provider.getHost(),
    namespace: provider.getNamespace(),
    // ... etc
    triggerBranchName,
    workingBranchName,
    timeZone: config.timeZone,
  };
}
```

> **Note on `workingBranchName`:** Currently, `createFixedBaseStringPatternContext` resolves `workingBranchNameTemplate` using `resolveStringTemplate` — which is a circular dependency on the global context. In the pure model, the workflow must resolve the working branch name template **first** (using the partial context built so far), then feed the resolved value into `addBaseContext`. This removes the self-referential mutation.

---

## Files to Change

### Core Template Engine

#### [MODIFY] [resolve-template.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/string-templates-and-patterns/resolve-template.ts)
Make `context` a **required** parameter. Remove the global import.

```typescript
import { Liquid, type Template } from "liquidjs";
import type { StringPatternContext } from "./pattern-context.ts";

export const liquidEngine = new Liquid({ jsTruthy: true });

const PARSED_TEMPLATE_CACHE = new Map<string, Template[]>();

/** @throws */
export async function resolveStringTemplate(
  template: string,
  context: StringPatternContext,
  additionalContext?: Record<string, unknown>,
): Promise<string> {
  try {
    let parsedTemplate = PARSED_TEMPLATE_CACHE.get(template);

    if (!parsedTemplate) {
      parsedTemplate = liquidEngine.parse(template);
      PARSED_TEMPLATE_CACHE.set(template, parsedTemplate);
    }

    const renderedTemplate = await liquidEngine.render(
      parsedTemplate,
      additionalContext
        ? { ...context, ...additionalContext }
        : context,
    );

    if (typeof renderedTemplate !== "string") {
      throw new Error(
        `Resolved template is not a string. Received '${typeof renderedTemplate}'`,
      );
    }

    return renderedTemplate;
  } catch (error) {
    throw new Error(
      `'${resolveStringTemplate.name}' error: failed to resolve string template '${template}'`,
      { cause: error },
    );
  }
}
```

---

### Pattern Context Module

#### [MODIFY] [pattern-context.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/string-templates-and-patterns/pattern-context.ts)

Complete rewrite — delete the three globals, convert all functions to pure builders.

**Delete:**
- `STRING_PATTERN_CONTEXT` global
- `BUILT_IN_CONTEXT` global
- `CUSTOM_CONTEXT` global
- All `createFixed*` / `createDynamic*` void functions

**Add:**

```typescript
import { format, type SemVer } from "@std/semver";
import {
  DateTimeFormatter,
  nativeJs,
  type ZonedDateTime,
  ZoneId,
} from "@js-joda/core";
import type { ConfigOutput } from "../../schemas/configs/config.ts";
import type { PlatformProvider } from "../../types/providers/platform-provider.ts";
import { taskLogger } from "../logger.ts";
import { startTime } from "../../main.ts";
import type {
  DynamicChangelogStringPattern,
  DynamicDatetimeStringPattern,
  FixedBaseStringPattern,
  FixedCurrentVersionStringPattern,
  FixedDatetimeStringPattern,
  FixedNextVersionStringPattern,
  FixedTagStringPattern,
} from "../../types/string-patterns.ts";
import { resolveStringTemplate } from "./resolve-template.ts";
import type { ReviewConfigOutput } from "../../schemas/configs/modules/review-config.ts";
import { jsonValueNormalizer } from "../../utils/transformers/json.ts";

export type StringPatternContext = Record<string, unknown>;

// --- Pure builder functions ---

export function createEmptyContext(): StringPatternContext {
  return {};
}

export function addCustomContext(
  ctx: StringPatternContext,
  customPatterns: ConfigOutput["customStringPatterns"],
): StringPatternContext {
  if (!customPatterns || Object.keys(customPatterns).length === 0) return ctx;

  taskLogger.debug(
    "Custom string pattern context: " + JSON.stringify(customPatterns, null, 2),
  );
  // Custom goes first so built-in keys always win (spread order = last wins)
  return { ...customPatterns, ...ctx };
}

type AddBaseContextConfigParams =
  & Pick<ConfigOutput, "name" | "timeZone">
  & {
    review: Pick<ReviewConfigOutput, "workingBranchNameTemplate">;
  };

/**
 * Add base project/repo patterns to context.
 *
 * NOTE: The caller must resolve `workingBranchName` BEFORE calling this,
 * using the partial context built so far. This removes the old circular
 * dependency where createFixedBaseStringPatternContext called
 * resolveStringTemplate while mutating the same global it read from.
 */
export function addBaseContext(
  ctx: StringPatternContext,
  provider: PlatformProvider,
  triggerBranchName: string,
  config: AddBaseContextConfigParams,
  workingBranchName: string,
): StringPatternContext {
  const base = {
    name: config.name,
    host: provider.getHost(),
    namespace: provider.getNamespace(),
    repository: provider.getRepositoryName(),
    commitPathPart: provider.getCommitPathPart(),
    referencePathPart: provider.getReferencePathPart(),

    triggerBranchName: triggerBranchName,
    workingBranchName: workingBranchName,

    timeZone: config.timeZone,
  } satisfies Record<FixedBaseStringPattern, string | number | undefined>;

  taskLogger.debug(
    "Fixed base string pattern context: " + JSON.stringify(base, null, 2),
  );

  return { ...ctx, ...base };
}

export function addDatetimeContext(
  ctx: StringPatternContext,
  timeZone: string,
): StringPatternContext {
  const targetZoneId = ZoneId.of(timeZone);
  const fixedZonedDateTime = nativeJs(startTime, targetZoneId);

  function zdtFormat(zdt: ZonedDateTime, pattern: string) {
    return zdt.format(DateTimeFormatter.ofPattern(pattern));
  }

  const fixedContext = {
    timestamp: startTime.getTime(),
    "YYYY": zdtFormat(fixedZonedDateTime, "yyyy"),
    "MM": zdtFormat(fixedZonedDateTime, "MM"),
    "DD": zdtFormat(fixedZonedDateTime, "dd"),
    "HH": zdtFormat(fixedZonedDateTime, "HH"),
    "mm": zdtFormat(fixedZonedDateTime, "mm"),
    "ss": zdtFormat(fixedZonedDateTime, "ss"),
  } satisfies Record<FixedDatetimeStringPattern, string | number | undefined>;

  const dynamicContext = {
    nowTimestamp: () => new Date().getTime(),
    nowYYYY: () => zdtFormat(nativeJs(new Date(), targetZoneId), "yyyy"),
    nowMM: () => zdtFormat(nativeJs(new Date(), targetZoneId), "MM"),
    nowDD: () => zdtFormat(nativeJs(new Date(), targetZoneId), "dd"),
    nowHH: () => zdtFormat(nativeJs(new Date(), targetZoneId), "HH"),
    nowmm: () => zdtFormat(nativeJs(new Date(), targetZoneId), "mm"),
    nowss: () => zdtFormat(nativeJs(new Date(), targetZoneId), "ss"),
  } satisfies Record<DynamicDatetimeStringPattern, () => string | number>;

  taskLogger.debug(
    "Fixed and dynamic datetime string pattern context initialized.",
  );

  return { ...ctx, ...fixedContext, ...dynamicContext };
}

export function addCurrentVersionContext(
  ctx: StringPatternContext,
  currentVersion?: SemVer,
): StringPatternContext {
  if (!currentVersion) return ctx;

  const versionContext = {
    currentVersion: format(currentVersion),
    currentVersionCore:
      `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`,
    currentVersionPre: currentVersion?.prerelease?.length
      ? currentVersion.prerelease.join(".")
      : undefined,
    currentVersionBld: currentVersion?.build?.length
      ? currentVersion.build.join(".")
      : undefined,
  } satisfies Record<FixedCurrentVersionStringPattern, string | undefined>;

  taskLogger.debug(
    "Fixed current version string pattern context: " +
      JSON.stringify(versionContext, null, 2),
  );

  return { ...ctx, ...versionContext };
}

export function addNextVersionContext(
  ctx: StringPatternContext,
  nextVersion: SemVer,
): StringPatternContext {
  const versionContext = {
    nextVersion: format(nextVersion),
    nextVersionCore:
      `${nextVersion.major}.${nextVersion.minor}.${nextVersion.patch}`,
    nextVersionPre: nextVersion.prerelease?.length
      ? nextVersion.prerelease.join(".")
      : undefined,
    nextVersionBld: nextVersion.build?.length
      ? nextVersion.build.join(".")
      : undefined,
  } satisfies Record<FixedNextVersionStringPattern, string | undefined>;

  taskLogger.debug(
    "Fixed next version string pattern context: " +
      JSON.stringify(versionContext, null, 2),
  );

  return { ...ctx, ...versionContext };
}

export async function addTagContext(
  ctx: StringPatternContext,
  tagTemplate: string,
): Promise<StringPatternContext> {
  const tagContext = {
    tagName: await resolveStringTemplate(tagTemplate, ctx),
  } satisfies Record<FixedTagStringPattern, string>;

  taskLogger.debug(
    "Fixed tag string pattern context: " + JSON.stringify(tagContext, null, 2),
  );

  return { ...ctx, ...tagContext };
}

export function addChangelogContext(
  ctx: StringPatternContext,
  changelogRelease?: string,
  changelogReleaseBody?: string,
  changelogReleaseAlt?: string,
  changelogReleaseBodyAlt?: string,
): StringPatternContext {
  const context = {
    changelogRelease,
    changelogReleaseBody,
    changelogReleaseAlt,
    changelogReleaseBodyAlt,
  } satisfies Record<DynamicChangelogStringPattern, string | undefined>;

  taskLogger.debug(
    "Dynamic changelog string pattern context: " +
      JSON.stringify(context, null, 2),
  );

  return { ...ctx, ...context };
}

// --- New: releases context ---

export interface ReleaseContextEntry {
  name: string;
  nextVersion: string;
  tagName: string;
  isWorkspace: boolean;
}

export function addReleasesContext(
  ctx: StringPatternContext,
  releases: ReleaseContextEntry[],
): StringPatternContext {
  return { ...ctx, releases };
}

// --- Stringify ---

export async function stringifyPatternContext(
  ctx: StringPatternContext,
): Promise<string> {
  const resolvedContext: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value === "function") {
      try {
        const result = await value();
        resolvedContext[key] = typeof result !== "function" ? result : value;
      } catch {
        resolvedContext[key] = value;
      }
    } else {
      resolvedContext[key] = value;
    }
  }

  return JSON.stringify(resolvedContext, jsonValueNormalizer);
}
```

---

### New `format_releases` Filter

#### [MODIFY] [transformers.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/string-templates-and-patterns/transformers.ts)
Register the `format_releases` filter alongside existing filters:

```typescript
liquidEngine.registerFilter(
  "format_releases",
  (releases: unknown, separator?: unknown) => {
    if (!Array.isArray(releases)) {
      throw new Error(
        `Filter "format_releases" input requires an array, received ${typeof releases}`,
      );
    }
    const sep = typeof separator === "string" ? separator : ", ";
    return releases.map((r: any) => r.tagName).join(sep);
  },
);
```

---

### Update Default Commit Header Template

#### [MODIFY] [string-templates.ts](file:///g:/Projects/Coding/zephyr-release/src/constants/defaults/string-templates.ts)

```typescript
// Before:
export const DEFAULT_COMMIT_HEADER_TEMPLATE =
  liquid`chore: release v{{ nextVersion }}`;

// After:
export const DEFAULT_COMMIT_HEADER_TEMPLATE =
  liquid`chore: release {{ releases | format_releases }}`;
```

> **Breaking change:** Users who depend on the exact format `chore: release v1.2.3` need to explicitly set `commit.headerTemplate` to the old value. Document this in migration guide.

---

### Update String Pattern Types

#### [MODIFY] [string-patterns.ts](file:///g:/Projects/Coding/zephyr-release/src/types/string-patterns.ts)
Add the `releases` type:

```typescript
export type BuiltInArrayStringPattern = "releases";
```

---

### Workflow Updates — Threading Context

The pattern is the same across all three workflows. The context object is built progressively and stored in `runSettings` (or a local variable) then passed to every downstream task call.

#### [MODIFY] [bootstrap.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/bootstrap.ts)

Bootstrap builds the initial context and returns it as part of `BootstrapResult`:

```typescript
import {
  createEmptyContext,
  addCustomContext,
  addBaseContext,
  addDatetimeContext,
  type StringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { resolveStringTemplate } from "../tasks/string-templates-and-patterns/resolve-template.ts";

export interface BootstrapResult {
  triggerContext: OperationTriggerContext;
  workingBranchResult: WorkingBranchResult;
  associatedProposalForCommit: ProviderProposal | undefined;
  associatedProposalFromBranch: ProviderProposal | undefined;
  patternContext: StringPatternContext; // NEW
}

// Inside bootstrapOperation:
let ctx = createEmptyContext();
ctx = addCustomContext(ctx, config.customStringPatterns);

// Resolve working branch name with the partial context built so far
const workingBranchName = await resolveStringTemplate(
  config.review.workingBranchNameTemplate,
  ctx,
);

ctx = addBaseContext(ctx, provider, inputs.triggerBranchName, config, workingBranchName);
ctx = addDatetimeContext(ctx, config.timeZone);

// ... setupWorkingBranch still works as-is (doesn't use resolveStringTemplate internally —
// it receives the resolved branch name from the context), actually it does use
// resolveStringTemplate internally so we need to update it too.

return {
  triggerContext,
  workingBranchResult,
  associatedProposalForCommit,
  associatedProposalFromBranch,
  patternContext: ctx,
};
```

#### [MODIFY] [auto.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/auto.ts)
#### [MODIFY] [review.prepare.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.prepare.ts)
#### [MODIFY] [review.publish.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.publish.ts)

Each workflow:
1. Receives `patternContext` from bootstrap result.
2. Builds on it progressively: `ctx = addNextVersionContext(ctx, ...)`, etc.
3. Passes `ctx` to every task that calls `resolveStringTemplate`.

```typescript
// Example from auto.ts — after calculating version:
ctx = addCurrentVersionContext(ctx, currentVersion);
ctx = addNextVersionContext(ctx, nextVersion);
ctx = await addTagContext(ctx, runSettings.config.tag.nameTemplate);
ctx = addReleasesContext(ctx, [{
  name: runSettings.config.name ?? "root",
  nextVersion: format(nextVersion),
  tagName: ctx.tagName as string,
  isWorkspace: false,
}]);

// ... later:
ctx = addChangelogContext(
  ctx,
  changelogReleaseResult.release,
  changelogReleaseResult.releaseBody,
  changelogReleaseResult.releaseAlt,
  changelogReleaseResult.releaseBodyAlt,
);
```

---

### Task Updates — Accept Context Parameter

Every task function that calls `resolveStringTemplate` needs to accept `ctx: StringPatternContext` and pass it through.

#### [MODIFY] [branch.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/branch.ts)
`setupWorkingBranch` receives the context from bootstrap (or uses a pre-resolved branch name, since bootstrap resolves it before calling).

#### [MODIFY] [commit.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/commit.ts)
`commitChangesToBranch` → add `ctx` param, pass to `resolveStringTemplate` calls for header/body/footer templates.

#### [MODIFY] [changelog.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/changelog.ts)
All changelog generation functions → add `ctx` param. This is the largest file (~20 `resolveStringTemplate` calls). Each call gets `ctx` as the second argument.

#### [MODIFY] [proposal.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/proposal.ts)
`createOrUpdateProposal` → add `ctx` param for title/header/body/footer template resolution.

#### [MODIFY] [release.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/release.ts)
`createRelease` → add `ctx` param for release title/header/body/footer template resolution.

#### [MODIFY] [tag.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/tag.ts)
`createTag` → add `ctx` param for tag name and message template resolution.

---

### Runtime Override — Pure Rebuild

#### [MODIFY] [runtime-override.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/runtime-override.ts)
`synchronizeRuntimeStateAfterOverride` currently mutates the global context. Change it to accept the current context, rebuild it, and return the new context.

```typescript
interface SynchronizeRuntimeStateParams {
  provider: PlatformProvider;
  config: ConfigOutput;
  rawConfig: object;
  triggerBranchName: string;
  currentPatternContext: StringPatternContext; // NEW: receive current
  nextVersion?: SemVer;
  currentVersion?: SemVer;
}

export async function synchronizeRuntimeStateAfterOverride(
  params: SynchronizeRuntimeStateParams,
): Promise<StringPatternContext> { // NEW: return updated context
  const {
    provider, config, rawConfig, triggerBranchName,
    currentPatternContext, nextVersion, currentVersion,
  } = params;

  let ctx = createEmptyContext();
  ctx = addCustomContext(ctx, config.customStringPatterns);

  // Resolve working branch name with partial context
  const workingBranchName = await resolveStringTemplate(
    config.review.workingBranchNameTemplate,
    ctx,
  );
  ctx = addBaseContext(ctx, provider, triggerBranchName, config, workingBranchName);
  ctx = addDatetimeContext(ctx, config.timeZone);

  if (currentVersion) {
    ctx = addCurrentVersionContext(ctx, currentVersion);
  }

  if (nextVersion) {
    ctx = addNextVersionContext(ctx, nextVersion);
    ctx = await addTagContext(ctx, config.tag.nameTemplate);
  }

  // Preserve releases from the current context if they exist
  if (currentPatternContext.releases) {
    ctx = { ...ctx, releases: currentPatternContext.releases };
  }

  // Re-export stale env variables
  const staleExports = {
    config: JSON.stringify(rawConfig, jsonValueNormalizer),
    internalConfig: JSON.stringify(config, jsonValueNormalizer),
    patternContext: await stringifyPatternContext(ctx),
  };
  // ... export them

  return ctx;
}
```

The workflow call sites update accordingly:
```typescript
// Before:
await synchronizeRuntimeStateAfterOverride({ provider, config, ... });

// After:
ctx = await synchronizeRuntimeStateAfterOverride({
  provider, config, ...,
  currentPatternContext: ctx,
});
```

---

### Export Variables — Use Context

#### [MODIFY] [export-variables.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/export-variables.ts)
Any function that calls `stringifyCurrentPatternContext()` should instead accept and use `stringifyPatternContext(ctx)`.

---

### Wire Up `releases` in Workflows

After `addTagContext`, each workflow adds the releases entry:

```typescript
// Single-repo: array of one
ctx = addReleasesContext(ctx, [{
  name: runSettings.config.name ?? "root",
  nextVersion: format(nextVersion),
  tagName: ctx.tagName as string,
  isWorkspace: false,
}]);
```

This goes in `auto.ts`, `review.prepare.ts`, and `review.publish.ts` — after the tag context is added.

---

## What This Changes (vs old plan)

| Aspect | Old Plan | New Plan |
|--------|----------|----------|
| Global singleton | Kept, with optional bypass | **Deleted** |
| `resolveStringTemplate` context | Optional 3rd param, fallback to global | **Required 2nd param** |
| Builder functions | Both mutation and pure coexist | **Pure only** — return new context |
| Task function signatures | Unchanged | **Add `ctx` param** |
| `synchronizeRuntimeStateAfterOverride` | Mutates global | **Returns new context** |
| Backward compat | Full (fallback to global) | None — every call site updated |

---

## Verification

### Type Checking
```bash
deno task check
```

This is the primary verification. Since `context` is now required on `resolveStringTemplate`, the compiler will catch every missed call site.

### Local Logic Testing (experiments/)

Create `experiments/pure-context-and-format-releases.ts`:

```typescript
import {
  createEmptyContext,
  addBaseContext,
  addNextVersionContext,
  addTagContext,
  addReleasesContext,
  type StringPatternContext,
} from "../src/tasks/string-templates-and-patterns/pattern-context.ts";
import {
  resolveStringTemplate,
  liquidEngine,
} from "../src/tasks/string-templates-and-patterns/resolve-template.ts";

// Register the format_releases filter (mimic registerTransformersToTemplateEngine)
liquidEngine.registerFilter(
  "format_releases",
  (releases: any[], separator?: any) => {
    if (!Array.isArray(releases)) throw new Error("Expected array");
    const sep = typeof separator === "string" ? separator : ", ";
    return releases.map((r: any) => r.tagName).join(sep);
  },
);

// Test 1: Pure context — no global state
const ctx1: StringPatternContext = { name: "explicit-context" };
const result1 = await resolveStringTemplate("{{ name }}", ctx1);
console.log(`Explicit context: "${result1}" ${result1 === "explicit-context" ? "✅" : "❌"}`);

// Test 2: format_releases filter — single repo
const singleRepoCtx: StringPatternContext = {
  releases: [{ name: "my-app", nextVersion: "1.3.0", tagName: "v1.3.0", isWorkspace: false }],
};
const result2 = await resolveStringTemplate(
  "chore: release {{ releases | format_releases }}",
  singleRepoCtx,
);
console.log(`Single-repo: "${result2}" ${result2 === "chore: release v1.3.0" ? "✅" : "❌"}`);

// Test 3: format_releases filter — monorepo
const monoCtx: StringPatternContext = {
  releases: [
    { name: "core", nextVersion: "1.3.0", tagName: "core-v1.3.0", isWorkspace: true },
    { name: "cli", nextVersion: "2.0.1", tagName: "cli-v2.0.1", isWorkspace: true },
  ],
};
const result3 = await resolveStringTemplate(
  "chore: release {{ releases | format_releases }}",
  monoCtx,
);
console.log(`Monorepo: "${result3}" ${result3 === "chore: release core-v1.3.0, cli-v2.0.1" ? "✅" : "❌"}`);

// Test 4: Custom separator
const result4 = await resolveStringTemplate(
  '{{ releases | format_releases: " | " }}',
  monoCtx,
);
console.log(`Custom sep: "${result4}" ${result4 === "core-v1.3.0 | cli-v2.0.1" ? "✅" : "❌"}`);

// Test 5: Context isolation — two contexts don't bleed
const ctxA: StringPatternContext = { name: "project-a" };
const ctxB: StringPatternContext = { name: "project-b" };
const [resA, resB] = await Promise.all([
  resolveStringTemplate("{{ name }}", ctxA),
  resolveStringTemplate("{{ name }}", ctxB),
]);
console.log(`Isolation A: "${resA}" ${resA === "project-a" ? "✅" : "❌"}`);
console.log(`Isolation B: "${resB}" ${resB === "project-b" ? "✅" : "❌"}`);

console.log("\nAll tests complete.");
```

Run with:
```bash
deno run -A experiments/pure-context-and-format-releases.ts
```

### JSON Schema Regeneration
```bash
deno run -A scripts/gen-json-schema.ts
```

### Post-Test: Real GitHub API (Manual)

See [2_post-test.md](file:///g:/Projects/Coding/zephyr-release/docs/monorepo/implementations/2_post-test.md) for testing on a real repository to verify the default commit header template renders correctly end-to-end.
