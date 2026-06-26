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
  resolveRuntimeConfigOverride,
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
 * Consolidates the previously duplicated pattern of:
 *   1. Run hook commands (now with stdout capture)
 *   2. Check for stdout-based config override (marker delimiters)
 *   3. Check for file-based config override (global hooks only)
 *   4. Re-validate config through Valibot
 *   5. Synchronize runtime state (pattern context, env vars)
 *
 * For global hooks: checks both stdout capture and file-based override.
 * For per-workspace hooks: checks stdout capture only (avoids cross-contamination).
 */
export async function executeHookWithOverride(
  provider: PlatformProvider,
  hookKind: CommandHookKind,
  commandHooks: CommandHooksOutput | undefined,
  runSettings: OperationRunSettings,
  patternContext: StringPatternContext,
  options: HookRunnerOptions = {},
  isPerWorkspaceHook: boolean = false,
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

  // 2. Try stdout-based override (always available)
  logger.stepStart(
    `Starting: Resolve runtime config override (${hookKind})`,
  );
  let overrideApplied = false;
  const stdoutOverride = extractOverrideFromStdout(
    hookResult.capturedStdout,
  );
  if (stdoutOverride) {
    taskLogger.info(
      `Detected stdout config override from ${hookKind} hook`,
    );

    // Parse as JSON (stdout overrides are always JSON)
    const parsedRaw = parseConfig(stdoutOverride, "json", "<stdout>");

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

  // 3. Try file-based override (global hooks only, and only if stdout didn't already apply one)
  if (!isPerWorkspaceHook && !overrideApplied) {
    const fileResult = await resolveRuntimeConfigOverride(
      runSettings.rawConfig,
      runSettings.config,
      runSettings.inputs.workspacePath,
    );
    if (fileResult) {
      runSettings = {
        ...runSettings,
        rawConfig: fileResult.rawResolvedRuntime,
        config: fileResult.resolvedRuntime,
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
