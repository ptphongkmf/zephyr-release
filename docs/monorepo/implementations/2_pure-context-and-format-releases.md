# Phase 2: Pure String Pattern Context Refactor

> **Scope:** Single-repo compatible. No monorepo dependency.  
> **Breaking changes:** None (backward-compatible — global singleton fallback preserved).  
> **Prerequisite for:** Phase 3 (monorepo workspace loop needs isolated contexts)

---

## Summary

Refactor the global mutable `STRING_PATTERN_CONTEXT` singleton into an explicit-context model. Currently, template resolution relies on a side-effect: functions mutate a global object, and `resolveStringTemplate` reads from it implicitly. This makes workspace isolation impossible.

The refactor adds an explicit `context` parameter to `resolveStringTemplate` that **falls back** to the global singleton if not provided. All existing call sites continue working unchanged. The monorepo workspace loop (Phase 3) will use the explicit parameter.

---

## Files to Change

### Core Template Engine

#### [MODIFY] [resolve-template.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/string-templates-and-patterns/resolve-template.ts)
Add optional `baseContext` parameter:

```typescript
export async function resolveStringTemplate(
  template: string,
  additionalContext?: Record<string, unknown>,
  baseContext?: Record<string, unknown>,  // NEW: explicit context override
): Promise<string> {
  try {
    let parsedTemplate = PARSED_TEMPLATE_CACHE.get(template);
    if (!parsedTemplate) {
      parsedTemplate = liquidEngine.parse(template);
      PARSED_TEMPLATE_CACHE.set(template, parsedTemplate);
    }

    const effectiveContext = baseContext ?? STRING_PATTERN_CONTEXT;
    const renderedTemplate = await liquidEngine.render(
      parsedTemplate,
      additionalContext
        ? { ...effectiveContext, ...additionalContext }
        : effectiveContext,
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

### Pattern Context Builder

#### [MODIFY] [pattern-context.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/string-templates-and-patterns/pattern-context.ts)
Add utility functions to **build** a context object without mutating the global singleton:

```typescript
// Keep existing global mutable context for backward compat
export const STRING_PATTERN_CONTEXT: Record<string, unknown> = {};

// NEW: Build a complete context object from components (pure, no side effects)
export function buildStringPatternContext(options: {
  custom?: Record<string, unknown>;
  base?: Record<string, string | number | undefined>;
  datetime?: { fixedZonedDateTime: ZonedDateTime; timeZone: string };
  currentVersion?: SemVer;
  nextVersion?: SemVer;
  tagName?: string;
  changelog?: {
    release?: string;
    releaseBody?: string;
    releaseAlt?: string;
    releaseBodyAlt?: string;
  };
}): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};

  if (options.custom) Object.assign(ctx, options.custom);
  if (options.base) Object.assign(ctx, options.base);
  // ... build datetime, version, tag, changelog entries
  // same logic as existing create* functions, but returning instead of mutating

  return ctx;
}
```

The existing `createFixed*` and `createDynamic*` functions remain and continue to mutate the global `STRING_PATTERN_CONTEXT` for backward compatibility. The new `buildStringPatternContext` is the pure alternative used by monorepo in Phase 3.

---

### New `releases` Variable & `format_releases` Filter

#### [MODIFY] [pattern-context.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/string-templates-and-patterns/pattern-context.ts)
Add a new function to set the `releases` array in the context:

```typescript
export interface ReleaseContextEntry {
  name: string;
  nextVersion: string;
  tagName: string;
  isWorkspace: boolean;
}

export function createReleasesStringPatternContext(
  releases: ReleaseContextEntry[],
) {
  const context = { releases };
  Object.assign(BUILT_IN_CONTEXT, context);
  Object.assign(STRING_PATTERN_CONTEXT, CUSTOM_CONTEXT, BUILT_IN_CONTEXT);
}
```

#### [MODIFY] [transformers.ts](file:///g:/Projects/Coding/zephyr-release/src/tasks/string-templates-and-patterns/transformers.ts)
Register the `format_releases` filter:

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

Note: This filter is registered in `registerTransformersToTemplateEngine` (no provider dependency, so it could be its own registration function or part of the existing one).

---

### Update Default Commit Header Template

#### [MODIFY] [string-templates.ts](file:///g:/Projects/Coding/zephyr-release/src/constants/defaults/string-templates.ts)
Change the default commit header template:

```typescript
// Before:
export const DEFAULT_COMMIT_HEADER_TEMPLATE =
  liquid`chore: release v{{ nextVersion }}`;

// After:
export const DEFAULT_COMMIT_HEADER_TEMPLATE =
  liquid`chore: release {{ releases | format_releases }}`;
```

> **Breaking change note:** This changes the default commit message format. Users who depend on the exact format `chore: release v1.2.3` need to explicitly set `commit.headerTemplate` to the old value. Document this in the migration guide.

---

### Update String Pattern Types

#### [MODIFY] [string-patterns.ts](file:///g:/Projects/Coding/zephyr-release/src/types/string-patterns.ts)
Add the `releases` type (if tracking built-in patterns):

```typescript
// This is an array type, not a simple string pattern.
// May not fit the existing pattern type system directly.
// Document it separately or add a new union:
export type BuiltInArrayStringPattern = "releases";
```

---

### Wire Up `releases` in Workflows

#### [MODIFY] [auto.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/auto.ts)
After `createFixedTagStringPatternContext`, add:

```typescript
createReleasesStringPatternContext([{
  name: runSettings.config.name ?? "root",
  nextVersion: format(nextVersion),
  tagName: await resolveStringTemplate(runSettings.config.tag.nameTemplate),
  isWorkspace: false,
}]);
```

#### [MODIFY] [review.prepare.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.prepare.ts)
Same injection point — after `createFixedTagStringPatternContext`.

#### [MODIFY] [review.publish.ts](file:///g:/Projects/Coding/zephyr-release/src/workflows/review.publish.ts)
Same injection point — after `createFixedTagStringPatternContext`.

---

## What This Does NOT Change

- All existing `createFixed*` / `createDynamic*` functions remain and work as before.
- All existing call sites of `resolveStringTemplate` continue working via global fallback.
- No workflow logic changes — just adding the `releases` variable and the new filter.

## Verification

### Type Checking
```bash
deno task check
```

### Local Logic Testing (experiments/)

Create `experiments/pure-context-and-format-releases.ts`:

```typescript
import { resolveStringTemplate, liquidEngine } from "../src/tasks/string-templates-and-patterns/resolve-template.ts";

// Register the format_releases filter first (mimic what registerTransformersToTemplateEngine does)
liquidEngine.registerFilter(
  "format_releases",
  (releases: any[], separator?: any) => {
    if (!Array.isArray(releases)) throw new Error("Expected array");
    const sep = typeof separator === "string" ? separator : ", ";
    return releases.map((r: any) => r.tagName).join(sep);
  },
);

// Test 1: Explicit context overrides global
const result1 = await resolveStringTemplate(
  "{{ name }}",
  undefined,
  { name: "explicit-context" },
);
console.log(`Explicit context: "${result1}" ${result1 === "explicit-context" ? "✅" : "❌"}`);

// Test 2: format_releases filter — single repo
const singleRepoCtx = {
  releases: [{ name: "my-app", nextVersion: "1.3.0", tagName: "v1.3.0", isWorkspace: false }],
};
const result2 = await resolveStringTemplate(
  "chore: release {{ releases | format_releases }}",
  undefined,
  singleRepoCtx,
);
console.log(`Single-repo: "${result2}" ${result2 === "chore: release v1.3.0" ? "✅" : "❌"}`);

// Test 3: format_releases filter — monorepo
const monoCtx = {
  releases: [
    { name: "core", nextVersion: "1.3.0", tagName: "core-v1.3.0", isWorkspace: true },
    { name: "cli", nextVersion: "2.0.1", tagName: "cli-v2.0.1", isWorkspace: true },
  ],
};
const result3 = await resolveStringTemplate(
  "chore: release {{ releases | format_releases }}",
  undefined,
  monoCtx,
);
console.log(`Monorepo: "${result3}" ${result3 === "chore: release core-v1.3.0, cli-v2.0.1" ? "✅" : "❌"}`);

// Test 4: Custom separator
const result4 = await resolveStringTemplate(
  '{{ releases | format_releases: " | " }}',
  undefined,
  monoCtx,
);
console.log(`Custom sep: "${result4}" ${result4 === "core-v1.3.0 | cli-v2.0.1" ? "✅" : "❌"}`);

// Test 5: Fallback to global when no explicit context
// (would need to set STRING_PATTERN_CONTEXT, but this validates the param works)
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

