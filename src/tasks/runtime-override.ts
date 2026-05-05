import { deepMerge } from "@std/collections";
import * as v from "@valibot/valibot";
import type { ConfigOutput } from "../schemas/configs/config.ts";
import { parseConfig } from "./configs/config-parser.ts";
import { getTextFile } from "./file.ts";
import { taskLogger } from "./logger.ts";
import { jsonValueNormalizer } from "../utils/transformers/json.ts";
import { transformObjKeyToCamelCase } from "../utils/transformers/object.ts";
import { formatValibotIssues } from "../utils/formatters/valibot.ts";
import { ConfigSchema } from "../schemas/configs/config.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { SemVer } from "@std/semver";
import {
  createCustomStringPatternContext,
  createFixedAndDynamicDatetimeStringPatternContext,
  createFixedBaseStringPatternContext,
  createFixedCurrentVersionStringPatternContext,
  createFixedNextVersionStringPatternContext,
  createFixedTagStringPatternContext,
  stringifyCurrentPatternContext,
} from "./string-templates-and-patterns/pattern-context.ts";
import {
  toOutputKey,
  toEnvKey,
} from "../utils/transformers/case.ts";

interface ResolvedRuntimeConfigResult {
  rawResolvedRuntime: object;
  resolvedRuntime: ConfigOutput;
}

/** @throws */
export async function resolveRuntimeConfigOverride(
  rawConfig: object,
  config: ConfigOutput,
  workspacePath: string,
): Promise<ResolvedRuntimeConfigResult | undefined> {
  const runtimeConfigOverride = config.runtimeConfigOverride;

  if (!runtimeConfigOverride) return undefined;

  const runtimeOverrideText = await getTextFile(
    "local",
    runtimeConfigOverride.path,
    { workspacePath },
  );

  if (!runtimeOverrideText.trim()) return undefined;

  const parsedRawResult = parseConfig(
    runtimeOverrideText,
    runtimeConfigOverride.format,
    runtimeConfigOverride.path,
  );

  taskLogger.info(
    `Runtime config override parsed successfully (${parsedRawResult.resolvedFormatResult})`,
  );

  taskLogger.info("Merging runtime override with current config...");
  const rawFinalConfig = deepMerge(
    rawConfig,
    parsedRawResult.parsedConfig,
    { arrays: "replace" },
  );

  const finalConfig = deepMerge(
    config,
    transformObjKeyToCamelCase(parsedRawResult.parsedConfig),
    { arrays: "replace" },
  );

  // Preserve core structural fields
  // workingBranchNameTemplate
  finalConfig.review.workingBranchNameTemplate =
    config.review.workingBranchNameTemplate;

  const resolvedFinalConfigResult = v.safeParse(
    ConfigSchema,
    finalConfig,
  );
  if (!resolvedFinalConfigResult.success) {
    throw new Error(
      `\`${resolveRuntimeConfigOverride.name}\` failed!` +
        formatValibotIssues(resolvedFinalConfigResult.issues),
    );
  }

  taskLogger.startGroup("Resolved runtime override config:");
  taskLogger.info(
    JSON.stringify(resolvedFinalConfigResult.output, jsonValueNormalizer, 2),
  );
  taskLogger.endGroup();

  return {
    rawResolvedRuntime: rawFinalConfig,
    resolvedRuntime: resolvedFinalConfigResult.output,
  };
}

interface SynchronizeRuntimeStateParams {
  provider: PlatformProvider;
  config: ConfigOutput;
  rawConfig: object;
  triggerBranchName: string;
  nextVersion?: SemVer;
  currentVersion?: SemVer;
}

/**
 * Resets and recalculates the global STRING_PATTERN_CONTEXT and re-exports
 * stale environment variables after a runtime config override.
 *
 * This must be called every time `resolveRuntimeConfigOverride` produces a
 * new config, so that template-derived values (e.g. `tagName`,
 * `workingBranchName`) and the exported `ZR_CONFIG`, `ZR_INTERNAL_CONFIG`,
 * and `ZR_PATTERN_CONTEXT` stay in sync with the overridden config.
 *
 * @throws
 */
export async function synchronizeRuntimeStateAfterOverride(
  params: SynchronizeRuntimeStateParams,
): Promise<void> {
  const {
    provider,
    config,
    rawConfig,
    triggerBranchName,
    nextVersion,
    currentVersion,
  } = params;

  taskLogger.debug("Synchronizing runtime state after config override...");

  // 1. Refresh custom string patterns (user-defined context keys).
  createCustomStringPatternContext(config.customStringPatterns);

  // 2. Refresh fixed base context (name, timeZone, workingBranchName, etc.).
  //
  // NOTE ON IMMUTABLE FIELDS:
  // The `config` object passed here has already rejected overrides for immutable fields
  // during the resolution phase. Re-evaluating this context is perfectly safe; it
  // ensures dynamic patterns update while strictly preserving the original structural
  // templates for:
  // - `review.workingBranchNameTemplate`
  await createFixedBaseStringPatternContext(
    provider,
    triggerBranchName,
    config,
  );

  // 3. Refresh datetime context (timezone may have changed).
  createFixedAndDynamicDatetimeStringPatternContext(config.timeZone);

  // 4. Refresh version context if version is available at this lifecycle stage.
  // Also affect tag name
  if (currentVersion) {
    createFixedCurrentVersionStringPatternContext(currentVersion);
  }

  if (nextVersion) {
    createFixedNextVersionStringPatternContext(nextVersion);
    await createFixedTagStringPatternContext(config.tag.nameTemplate);
  }

  // 5. Re-export the three dynamic variables that become stale after override.
  const staleExports = {
    config: JSON.stringify(rawConfig, jsonValueNormalizer),
    internalConfig: JSON.stringify(config, jsonValueNormalizer),
    patternContext: await stringifyCurrentPatternContext(),
  };

  Object.entries(staleExports).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });

  taskLogger.debug("Runtime state synchronized.");
}
