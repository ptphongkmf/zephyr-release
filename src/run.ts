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
import { executeReviewReleaseFlow } from "./workflows/review.ts";
import type { OperationRunSettings } from "./types/operation-context.ts";
import { executeAutoReleaseFlow } from "./workflows/auto.ts";
import { SafeExit } from "./errors/safe-exit.ts";
import { bootstrapOperation, type BootstrapResult } from "./workflows/bootstrap.ts";
import { executeHookWithOverride } from "./workflows/hook-runner.ts";
import { resolveWorkspaces } from "./tasks/workspace-resolver.ts";

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

  // Resolve workspaces //
  const workspaces = resolveWorkspaces(configResult.config);
  const isMonorepoMode = configResult.config.workspace !== undefined;

  if (isMonorepoMode && !configResult.config.review.groupProposals) {
    throw new Error(
      "Ungrouped proposals (review.groupProposals: false) are not yet supported in monorepo mode. " +
      "Please set review.groupProposals to true or omit it (default is true).",
    );
  }

  // Init Run Settings //
  let runSettings: OperationRunSettings = {
    rawInputs: inputsResult.rawInputs,
    inputs: inputsResult.inputs,
    rawConfig: configResult.rawConfig,
    config: configResult.config,
    isMonorepoMode,
    workspaces,
  };

  let bootstrapData: BootstrapResult | undefined;

  try {
    logger.header("Start Bootstrap Operation");
    bootstrapData = await bootstrapOperation(
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
      patternContext: bootstrapData.patternContext,
    });
    logger.debugStepFinish("Finished: Export base operation variables");

    {
      const hookResult = await executeHookWithOverride(
        provider,
        "preRun",
        runSettings.config.commandHooks,
        runSettings,
        bootstrapData.patternContext,
      );
      runSettings = hookResult.runSettings;
      bootstrapData.patternContext = hookResult.patternContext;
    }

    // Main operation workflow //
    switch (runSettings.config.releaseFlow) {
      case "review":
        runSettings = await executeReviewReleaseFlow(
          provider,
          runSettings,
          bootstrapData,
        );
        break;
      case "auto":
        runSettings = await executeAutoReleaseFlow(
          provider,
          runSettings,
          bootstrapData,
        );
        break;
    }

    await exportFinalOperationVariables(provider, "success", bootstrapData!.patternContext);
  } catch (error) {
    if (error instanceof SafeExit) {
      await exportFinalOperationVariables(provider, "skipped", bootstrapData?.patternContext ?? {});
    } else {
      await exportFinalOperationVariables(provider, "failure", bootstrapData?.patternContext ?? {});
    }

    throw error;
  } finally {
    logger.stepStart("Starting: Execute base post commands");
    const postResult = await runCommands(
      runSettings.config.commandHooks,
      "postRun",
    );
    if (postResult.summary) {
      logger.stepFinish(`Finished: Execute base post commands. ${postResult.summary}`);
    } else {
      logger.stepSkip("Skipped: Execute base post commands (empty)");
    }
  }
}
