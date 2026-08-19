import type {
  CommandHookKind,
  CommandHooksOutput,
} from "../schemas/configs/modules/components/command-hook.ts";
import type { OperationRunSettings } from "../types/operation-context.ts";
import type { StringPatternContext } from "../tasks/string-templates-and-patterns/pattern-context.ts";
import type { SemVer } from "@std/semver";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import { runCommands } from "../tasks/command.ts";
import {
  extractOverrideFromStdout,
  synchronizeRuntimeStateAfterOverride,
} from "../tasks/runtime-override.ts";
import { parseConfig } from "../tasks/configs/config-parser.ts";
import { logger, taskLogger } from "../tasks/logger.ts";
import { deepMerge } from "@std/collections";
import * as v from "@valibot/valibot";
import { ConfigSchema } from "../schemas/configs/config.ts";
import { transformObjKeyToCamelCase } from "../utils/transformers/object.ts";
import { formatValibotIssues } from "../utils/formatters/valibot.ts";
import { jsonValueNormalizer } from "../utils/transformers/json.ts";
import type { ConfigFileFormatWithAuto } from "../constants/file-formats.ts";

export interface HookRunnerOptions {
  nextVersion?: SemVer;
  currentVersion?: SemVer;
}

export interface HookRunnerResult {
  runSettings: OperationRunSettings;
  patternContext: StringPatternContext;
}

/**
 * Execute a command hook and apply runtime config override if applicable.
 *
 * Consolidates the pattern of:
 *   1. Run hook commands (with stdout capture)
 *   2. Check for stdout-based config override (marker delimiters)
 *      - Per-command overrides (with their own format) are checked first
 *      - Falls back to combined stdout with the default `stdoutOverrideFormat`
 *   3. Re-validate config through Valibot
 *   4. Synchronize runtime state (pattern context, env vars)
 */
export async function executeHookWithOverride(
  provider: PlatformProvider,
  hookKind: CommandHookKind,
  commandHooks: CommandHooksOutput | undefined,
  runSettings: OperationRunSettings,
  patternContext: StringPatternContext,
  options: HookRunnerOptions = {},
): Promise<HookRunnerResult> {
  // 1. Run hook commands and capture stdout
  logger.stepStart(`Starting: Execute ${hookKind} commands`);
  const hookResult = await runCommands(commandHooks, hookKind);
  if (hookResult.summary) {
    logger.stepFinish(
      `Finished: Execute ${hookKind} commands. ${hookResult.summary}`,
    );
  } else {
    logger.stepSkip(`Skipped: Execute ${hookKind} commands (empty)`);
  }

  // 2. Try stdout-based override
  logger.stepStart(
    `Starting: Resolve runtime config override (${hookKind})`,
  );

  // Resolve override content and format:
  //   - Per-command overrides (own format + isolated stdout) take priority
  //   - Falls back to combined stdout with the default stdoutOverrideFormat
  let overrideContent: string | undefined;
  let overrideFormat: ConfigFileFormatWithAuto | undefined;

  // Check per-command overrides first
  for (const perCmd of hookResult.perCommandOverrides) {
    const extracted = extractOverrideFromStdout(perCmd.stdout);
    if (extracted) {
      overrideContent = extracted;
      overrideFormat = perCmd.format;
      taskLogger.info(
        `Detected per-command stdout config override (format: ${overrideFormat})`,
      );
      break;
    }
  }

  // Fall back to combined stdout
  if (!overrideContent && commandHooks) {
    const extracted = extractOverrideFromStdout(hookResult.capturedStdout);
    if (extracted) {
      overrideContent = extracted;
      overrideFormat = commandHooks.stdoutOverrideFormat;
      taskLogger.info(
        `Detected stdout config override from ${hookKind} hook (format: ${overrideFormat})`,
      );
    }
  }

  let overrideApplied = false;
  if (overrideContent && overrideFormat) {
    const parsedRaw = parseConfig(overrideContent, overrideFormat);

    taskLogger.info(
      `Stdout config override parsed successfully (${parsedRaw.resolvedFormatResult})`,
    );
    taskLogger.info("Merging stdout override with current config...");

    const rawMerged = deepMerge(
      runSettings.rawConfig,
      parsedRaw.parsedConfig,
      { arrays: "replace" },
    );

    const merged = deepMerge(
      runSettings.config,
      transformObjKeyToCamelCase(parsedRaw.parsedConfig),
      { arrays: "replace" },
    );

    // Preserve immutable fields
    merged.review.workingBranchNameTemplate =
      runSettings.config.review.workingBranchNameTemplate;

    const result = v.safeParse(ConfigSchema, merged);
    if (!result.success) {
      throw new Error(
        `\`${executeHookWithOverride.name}\` stdout override failed for "${hookKind}"!` +
          formatValibotIssues(result.issues),
      );
    }

    taskLogger.startGroup("Resolved stdout override config:");
    taskLogger.info(
      JSON.stringify(result.output, jsonValueNormalizer, 2),
    );
    taskLogger.endGroup();

    runSettings = {
      ...runSettings,
      rawConfig: rawMerged,
      config: result.output,
    };
    patternContext = await synchronizeRuntimeStateAfterOverride({
      provider,
      config: runSettings.config,
      rawConfig: runSettings.rawConfig,
      triggerBranchName: runSettings.inputs.triggerBranchName,
      currentPatternContext: patternContext,
      ...options,
    });
    overrideApplied = true;
  }

  if (overrideApplied) {
    logger.stepFinish(
      `Finished: Resolve runtime config override (${hookKind})`,
    );
  } else {
    logger.stepSkip(
      `Skipped: Resolve runtime config override (${hookKind})`,
    );
  }

  return { runSettings, patternContext };
}
