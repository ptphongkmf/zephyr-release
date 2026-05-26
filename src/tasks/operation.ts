import { CommitParser } from "conventional-commits-parser";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { OperationTriggerContext } from "../types/operation-context.ts";
import { SafeExit } from "../errors/safe-exit.ts";
import type { ConfigOutput } from "../schemas/configs/config.ts";
import { taskLogger } from "./logger.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import { initTomlEditJs } from "../libs/@rainbowatcher/toml-edit-js/initWasm.ts";
import { ZEPHYR_RELEASE_COMMIT_SIGN } from "../constants/commit.ts";

export function initOperationRuntime(
  provider: PlatformProvider,
  inputs: InputsOutput,
) {
  taskLogger.info("Setting up provider context with inputs");
  provider.setupProviderContext(inputs);

  taskLogger.info("Initializing @rainbowatcher/toml-edit-js wasm module...");
  initTomlEditJs();
}

/** @throws {SafeExit} */
export function validateCurrentOperationTriggerCtx(
  provider: PlatformProvider,
  allowedCommitTypes: ConfigOutput["commitTypes"],
  releaseFlow: ConfigOutput["releaseFlow"],
): OperationTriggerContext {
  const operationContext = provider.getOperationTriggerContext();

  if (!operationContext.latestTriggerCommit) {
    throw new SafeExit("Latest commit is invalid, this might be a delete push");
  }

  const commitParser = new CommitParser(
    provider.getConventionalCommitParserOptions(),
  );
  const allowedTypes = new Set(allowedCommitTypes.map((c) => c.type));

  const parsedLatestTriggerCommit = commitParser.parse(
    operationContext.latestTriggerCommit.message,
  );

  if (releaseFlow === "auto") {
    const isZephyrReleaseSignCommit = parsedLatestTriggerCommit.notes
      .some((n) =>
        n.title.toLowerCase() === ZEPHYR_RELEASE_COMMIT_SIGN.toLowerCase()
      );

    if (isZephyrReleaseSignCommit) {
      throw new SafeExit(
        "Detected Zephyr Release bot signature in the trigger commit. Exiting safely to prevent an infinite CI loop",
      );
    }
  }

  const parsedTriggerCommits = operationContext.triggerCommits.map((c) =>
    commitParser.parse(c.message)
  );

  const commitHasAllowedType = (parsedLatestTriggerCommit.type &&
    allowedTypes.has(parsedLatestTriggerCommit.type)) ||
    parsedTriggerCommits.some((c) => c.type && allowedTypes.has(c.type));

  if (!commitHasAllowedType) {
    if (releaseFlow === "auto") {
      taskLogger.info(
        'No commits with an allowed type found. But operation continues because release flow is "auto"',
      );
    } else {
      taskLogger.info(
        "No commits with an allowed type found. But operation continues so a later step can verify if this is a merged release proposal",
      );
    }
  }

  return {
    latestTriggerCommit: {
      parsedCommit: parsedLatestTriggerCommit,
      treeHash: operationContext.latestTriggerCommit.treeHash,
    },
    parsedTriggerCommits: parsedTriggerCommits,
    commitHasAllowedType,
  };
}
