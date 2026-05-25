import type { PlatformProvider } from "./types/providers/platform-provider.ts";
import { logger } from "./tasks/logger.ts";
import { getInputs } from "./tasks/inputs.ts";
import { resolveConfig } from "./tasks/configs/config.ts";
import { runCommands } from "./tasks/command.ts";
import {
  exportBaseOperationVariables,
  exportFinalOperationVariables,
} from "./tasks/export-variables.ts";
import { initOperationRuntime } from "./tasks/operation.ts";
import { executeReviewStrategy } from "./workflows/review.ts";
import type { OperationRunSettings } from "./types/operation-context.ts";
import { executeAutoStrategy } from "./workflows/auto.ts";
import { SafeExit } from "./errors/safe-exit.ts";
import { bootstrapOperation } from "./workflows/bootstrap.ts";
import {
  resolveRuntimeConfigOverride,
  synchronizeRuntimeStateAfterOverride,
} from "./tasks/runtime-override.ts";

export async function run(provider: PlatformProvider) {
  logger.stepStart("Starting: Get operation inputs");
  const inputsResult = getInputs(provider);
  logger.stepFinish("Finished: Get operation inputs");

  logger.stepStart("Starting: Initialize operation runtime");
  initOperationRuntime(provider, inputsResult.inputs);
  logger.stepFinish("Finished: Initialize operation runtime");

  logger.stepStart("Starting: Resolve config from file and override");
  const configResult = await resolveConfig(
    provider,
    inputsResult.inputs,
  );
  logger.stepFinish("Finished: Resolve config from file and override");

  // Init Run Settings //
  let runSettings: OperationRunSettings = {
    rawInputs: inputsResult.rawInputs,
    inputs: inputsResult.inputs,
    rawConfig: configResult.rawConfig,
    config: configResult.config,
  };

  try {
    logger.header("Start Bootstrap Operation");
    const bootstrapData = await bootstrapOperation(
      provider,
      runSettings.config,
      runSettings.inputs,
    );

    logger.debugStepStart("Starting: Export base operation variables");
    await exportBaseOperationVariables(provider, {
      triggerContext: bootstrapData.triggerContext,
      workingBranchResult: bootstrapData.workingBranchResult,
      proposalForCommit: bootstrapData.associatedProposalForCommit,
      proposalFromBranch: bootstrapData.associatedProposalFromBranch,
      rawInputs: runSettings.rawInputs,
      inputs: runSettings.inputs,
      rawConfig: runSettings.rawConfig,
      config: runSettings.config,
    });
    logger.debugStepFinish("Finished: Export base operation variables");

    logger.stepStart("Starting: Execute base pre commands");
    const preResult = await runCommands(
      runSettings.config.commandHooks,
      "preRun",
    );
    if (preResult) {
      logger.stepFinish(`Finished: Execute base pre commands. ${preResult}`);
    } else {
      logger.stepSkip("Skipped: Execute base pre commands (empty)");
    }

    logger.stepStart(
      "Starting: Resolve runtime config override (base pre commands)",
    );
    const _basePreRuntimeConfigResult = await resolveRuntimeConfigOverride(
      runSettings.rawConfig,
      runSettings.config,
      runSettings.inputs.workspacePath,
    );
    if (_basePreRuntimeConfigResult) {
      runSettings = {
        ...runSettings,
        rawConfig: _basePreRuntimeConfigResult.rawResolvedRuntime,
        config: _basePreRuntimeConfigResult.resolvedRuntime,
      };
      await synchronizeRuntimeStateAfterOverride({
        provider,
        config: runSettings.config,
        rawConfig: runSettings.rawConfig,
        triggerBranchName: runSettings.inputs.triggerBranchName,
      });
      logger.stepFinish(
        "Finished: Resolve runtime config override (base pre commands)",
      );
    } else {
      logger.stepSkip(
        "Skipped: Resolve runtime config override (base pre commands)",
      );
    }

    // Main operation workflow //
    switch (runSettings.config.mode) {
      case "review":
        runSettings = await executeReviewStrategy(
          provider,
          runSettings,
          bootstrapData,
        );
        break;
      case "auto":
        runSettings = await executeAutoStrategy(
          provider,
          runSettings,
          bootstrapData,
        );
        break;
    }

    await exportFinalOperationVariables(provider, "success");
  } catch (error) {
    if (error instanceof SafeExit) {
      await exportFinalOperationVariables(provider, "skipped");
    } else {
      await exportFinalOperationVariables(provider, "failure");
    }

    throw error;
  } finally {
    logger.stepStart("Starting: Execute base post commands");
    const postResult = await runCommands(
      runSettings.config.commandHooks,
      "postRun",
    );
    if (postResult) {
      logger.stepFinish(`Finished: Execute base post commands. ${postResult}`);
    } else {
      logger.stepSkip("Skipped: Execute base post commands (empty)");
    }
  }
}
