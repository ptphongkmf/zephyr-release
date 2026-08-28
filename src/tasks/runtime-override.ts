import { CONFIG_OVERRIDE_MARKERS } from "../constants/config-override-markers.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { SemVer } from "@std/semver";
import {
  addBasePatternContext,
  addWorkingBranchPatternContext,
  addCurrentVersionPatternContext,
  addCustomPatternContext,
  addDatetimePatternContext,
  addNextVersionPatternContext,
  addTagPatternContext,
  createEmptyPatternContext,
  stringifyPatternContext,
  type StringPatternContext,
} from "./string-templates-and-patterns/pattern-context.ts";
import { resolveStringTemplate } from "./string-templates-and-patterns/resolve-template.ts";
import { toEnvKey, toOutputKey } from "../utils/transformers/case.ts";
import { jsonValueNormalizer } from "../utils/transformers/json.ts";
import { taskLogger } from "./logger.ts";
import type { ConfigOutput } from "../schemas/configs/config.ts";

/**
 * Extract config override JSON from captured stdout using marker delimiters.
 * Returns undefined if no markers found.
 */
export function extractOverrideFromStdout(
  stdout: string,
): string | undefined {
  const startIdx = stdout.indexOf(CONFIG_OVERRIDE_MARKERS.start);
  const endIdx = stdout.lastIndexOf(CONFIG_OVERRIDE_MARKERS.end);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return undefined;

  return stdout
    .substring(startIdx + CONFIG_OVERRIDE_MARKERS.start.length, endIdx)
    .trim();
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
 * This must be called every time a stdout config override is applied,
 * so that template-derived values (e.g. `tagName`,
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
  patternContext = addCustomPatternContext(
    patternContext,
    config.customStringPatterns,
  );

  patternContext = addBasePatternContext(
    patternContext,
    provider,
    triggerBranchName,
    config,
    currentPatternContext.isMonorepo as boolean,
  );

  const workingBranchName = await resolveStringTemplate(
    config.review.workingBranchNameTemplate,
    patternContext,
  );

  patternContext = addWorkingBranchPatternContext(
    patternContext,
    workingBranchName,
  );

  patternContext = addDatetimePatternContext(patternContext, config.timeZone);

  if (currentVersion) {
    patternContext = addCurrentVersionPatternContext(
      patternContext,
      currentVersion,
    );
  }

  if (nextVersion) {
    patternContext = addNextVersionPatternContext(patternContext, nextVersion);
    patternContext = await addTagPatternContext(
      patternContext,
      config.tag.nameTemplate,
    );
  }

  // Preserve releases from the current context if they exist
  if (currentPatternContext.releases) {
    patternContext = {
      ...patternContext,
      releases: currentPatternContext.releases,
    };
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
