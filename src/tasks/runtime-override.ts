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
  createEmptyPatternContext,
  addCustomPatternContext,
  addBasePatternContext,
  addDatetimePatternContext,
  addCurrentVersionPatternContext,
  addNextVersionPatternContext,
  addTagPatternContext,
  stringifyPatternContext,
  type StringPatternContext,
} from "./string-templates-and-patterns/pattern-context.ts";
import { resolveStringTemplate } from "./string-templates-and-patterns/resolve-template.ts";
import { toEnvKey, toOutputKey } from "../utils/transformers/case.ts";

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
  currentPatternContext: StringPatternContext;
  nextVersion?: SemVer;
  currentVersion?: SemVer;
}

/**
 * Rebuilds the pattern context from scratch and re-exports stale
 * environment variables after a runtime config override.
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
): Promise<StringPatternContext> {
  const {
    provider,
    config,
    rawConfig,
    triggerBranchName,
    currentPatternContext,
    nextVersion,
    currentVersion,
  } = params;

  taskLogger.debug("Synchronizing runtime state after config override...");

  let patternContext = createEmptyPatternContext();
  patternContext = addCustomPatternContext(patternContext, config.customStringPatterns);

  const workingBranchName = await resolveStringTemplate(
    config.review.workingBranchNameTemplate,
    patternContext,
  );

  patternContext = addBasePatternContext(
    patternContext,
    provider,
    triggerBranchName,
    config,
    workingBranchName,
  );

  patternContext = addDatetimePatternContext(patternContext, config.timeZone);

  if (currentVersion) {
    patternContext = addCurrentVersionPatternContext(patternContext, currentVersion);
  }

  if (nextVersion) {
    patternContext = addNextVersionPatternContext(patternContext, nextVersion);
    patternContext = await addTagPatternContext(patternContext, config.tag.nameTemplate);
  }

  // Preserve releases from the current context if they exist
  if (currentPatternContext.releases) {
    patternContext = { ...patternContext, releases: currentPatternContext.releases };
  }

  const staleExports = {
    config: JSON.stringify(rawConfig, jsonValueNormalizer),
    internalConfig: JSON.stringify(config, jsonValueNormalizer),
    patternContext: await stringifyPatternContext(patternContext),
  };

  Object.entries(staleExports).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });

  taskLogger.debug("Runtime state synchronized.");

  return patternContext;
}
