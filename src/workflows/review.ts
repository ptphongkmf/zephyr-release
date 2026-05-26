import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import { logger } from "../tasks/logger.ts";
import type { OperationRunSettings } from "../types/operation-context.ts";
import { executeReviewPreparePhase } from "./review.prepare.ts";
import { executeReviewPublishPhase } from "./review.publish.ts";
import type { BootstrapResult } from "./bootstrap.ts";

export async function executeReviewReleaseFlow(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  bootstrapData: BootstrapResult,
): Promise<OperationRunSettings> {
  /**
   * Review release flow run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;

  if (!bootstrapData.associatedProposalForCommit) {
    logger.header(
      "Review release flow (prepare): Creating/Updating release proposal",
    );
    runSettings = await executeReviewPreparePhase(
      provider,
      runSettings,
      bootstrapData,
    );
  } else if (runSettings.config.tag.createTag) {
    logger.header(
      "Review release flow (publish): Creating tag and release",
    );
    runSettings = await executeReviewPublishPhase(
      provider,
      runSettings,
      bootstrapData.associatedProposalForCommit,
    );
  } else {
    logger.subHeader(
      "Review release flow (publish): Skip create tag and release (disabled in config)",
    );
  }

  return runSettings;
}
