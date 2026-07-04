import { generatePublishChangelogReleaseContent } from "../tasks/changelog.ts";
import {
  exportPostReleaseVariables,
  exportPreReleaseVariables,
  exportPreTagVariables,
} from "../tasks/export-variables.ts";
import { updateProposalLabelsOnMerge } from "../tasks/label.ts";
import { logger } from "../tasks/logger.ts";
import { extractChangelogFromProposal } from "../tasks/proposal.ts";
import { attachReleaseAssets, createRelease } from "../tasks/release.ts";
import {
  addChangelogPatternContext,
  addNextVersionPatternContext,
  addReleasesPatternContext,
  addTagPatternContext,
  type ReleaseContextEntry,
  type StringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import { createTag } from "../tasks/tag.ts";
import {
  getPrimaryVersionFile,
  getVersionSemVerFromVersionFile,
} from "../tasks/version-files/version-file.ts";
import { format } from "@std/semver";
import type { OperationRunSettings } from "../types/operation-context.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import type { ProviderRelease } from "../types/providers/release.ts";
import { executeHookWithOverride } from "./hook-runner.ts";

export async function executeReviewPublishPhase(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  associatedProposalForCommit: ProviderProposal,
  initialPatternContext: StringPatternContext,
): Promise<OperationRunSettings> {
  /**
   * Publish phase run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;
  let patternContext = initialPatternContext;

  // ═══════════════════════════════════════════════════════════════════
  // Phase 1: Per-workspace version extraction and pattern context
  // ═══════════════════════════════════════════════════════════════════

  // Extract changelog from proposal (shared for all workspaces in grouped mode)
  logger.stepStart("Starting: Generate changelog release content");
  const proposalChangelogRelease = extractChangelogFromProposal(
    associatedProposalForCommit,
  );
  logger.stepFinish("Finished: Generate changelog release content");

  const releaseEntries: ReleaseContextEntry[] = [];
  const workspaces = runSettings.workspaces;

  interface WorkspacePublishData {
    wsConfig: typeof workspaces[0]["config"];
    wsPath: string;
    isWorkspace: boolean;
    wsPatternContext: StringPatternContext;
    nextVersionStr: string;
  }

  const workspacePublishDataList: WorkspacePublishData[] = [];

  for (const ws of workspaces) {
    const wsConfig = ws.config;
    const wsLabel = runSettings.isMonorepoMode
      ? `[${wsConfig.name}] `
      : "";

    if (runSettings.isMonorepoMode) {
      logger.subHeader(`Workspace: ${wsConfig.name}`);
      provider.setEnv("ZR_NAME", wsConfig.name ?? "");
    }

    // Get version from version file
    logger.stepStart(
      `${wsLabel}Starting: Extract next version from primary version file`,
    );
    const primaryVersionFile = getPrimaryVersionFile(wsConfig.versionFiles);
    const nextVersion = await getVersionSemVerFromVersionFile(
      primaryVersionFile,
      runSettings.inputs.sourceMode,
      provider,
      runSettings.inputs.workspacePath,
      runSettings.inputs.triggerCommitHash,
      ws.path,
    );
    if (!nextVersion) {
      throw new Error(
        `${wsLabel}Failed to extract next version from primary version file`,
      );
    }
    logger.stepFinish(
      `${wsLabel}Finished: Extract next version from primary version file`,
    );

    // Build per-workspace changelog
    const changelogReleaseResult =
      await generatePublishChangelogReleaseContent(
        provider,
        proposalChangelogRelease ?? "",
        runSettings.inputs,
        wsConfig,
        patternContext,
      );

    // Build per-workspace pattern context
    logger.debugStepStart(
      `${wsLabel}Starting: Create fixed next version and tag string pattern context`,
    );
    let wsPatternContext = patternContext;
    wsPatternContext = addNextVersionPatternContext(
      wsPatternContext,
      nextVersion,
    );
    wsPatternContext = await addTagPatternContext(
      wsPatternContext,
      wsConfig.tag.nameTemplate,
    );

    const tagName = wsPatternContext.tagName as string;
    releaseEntries.push({
      name: wsConfig.name ?? "root",
      nextVersion: format(nextVersion),
      tagName,
      isWorkspace: ws.isWorkspace,
    });

    logger.debugStepFinish(
      `${wsLabel}Finished: Create fixed next version and tag string pattern context`,
    );

    logger.debugStepStart(
      `${wsLabel}Starting: Create dynamic changelog string pattern context`,
    );
    wsPatternContext = addChangelogPatternContext(
      wsPatternContext,
      changelogReleaseResult?.release,
      changelogReleaseResult?.releaseBody,
      changelogReleaseResult?.releaseAlt,
      changelogReleaseResult?.releaseBodyAlt,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Create dynamic changelog string pattern context`,
    );

    workspacePublishDataList.push({
      wsConfig,
      wsPath: ws.path,
      isWorkspace: ws.isWorkspace,
      wsPatternContext,
      nextVersionStr: format(nextVersion),
    });

    patternContext = wsPatternContext;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Phase 2: Per-workspace tags and releases
  // ═══════════════════════════════════════════════════════════════════

  if (runSettings.config.tag.createTag) {
    logger.header(
      "Review release flow (publish): Creating tag and release...",
    );

    for (const wsData of workspacePublishDataList) {
      const { wsConfig } = wsData;
      const wsLabel = runSettings.isMonorepoMode
        ? `[${wsConfig.name}] `
        : "";
      let wsPatternCtx = wsData.wsPatternContext;

      // Apply releases context
      wsPatternCtx = addReleasesPatternContext(wsPatternCtx, releaseEntries);

      if (runSettings.isMonorepoMode) {
        logger.subHeader(`Workspace: ${wsConfig.name}`);
        provider.setEnv("ZR_NAME", wsConfig.name ?? "");
      }

      // preTag hook
      logger.debugStepStart(
        `${wsLabel}Starting: Export pre tag variables`,
      );
      // Parse version back for the hook
      const nextVersion = await getVersionSemVerFromVersionFile(
        getPrimaryVersionFile(wsConfig.versionFiles),
        runSettings.inputs.sourceMode,
        provider,
        runSettings.inputs.workspacePath,
        runSettings.inputs.triggerCommitHash,
        wsData.wsPath,
      );
      await exportPreTagVariables(
        provider,
        nextVersion!,
        wsPatternCtx,
        associatedProposalForCommit.id,
      );
      logger.debugStepFinish(
        `${wsLabel}Finished: Export pre tag variables`,
      );

      ({ runSettings, patternContext: wsPatternCtx } =
        await executeHookWithOverride(
          provider,
          "preTag",
          wsConfig.commandHooks,
          runSettings,
          wsPatternCtx,
          { nextVersion: nextVersion! },
        ));

      // Create tag
      logger.stepStart(`${wsLabel}Starting: Create tag`);
      const createdTag = await createTag(
        provider,
        runSettings.inputs.triggerCommitHash,
        runSettings.inputs,
        wsConfig,
        wsPatternCtx,
      );
      logger.stepFinish(`${wsLabel}Finished: Create tag`);

      // preRelease hook
      logger.debugStepStart(
        `${wsLabel}Starting: Export pre release variables`,
      );
      await exportPreReleaseVariables(
        provider,
        createdTag.hash,
        wsPatternCtx,
      );
      logger.debugStepFinish(
        `${wsLabel}Finished: Export pre release variables`,
      );

      ({ runSettings, patternContext: wsPatternCtx } =
        await executeHookWithOverride(
          provider,
          "preRelease",
          wsConfig.commandHooks,
          runSettings,
          wsPatternCtx,
          { nextVersion: nextVersion! },
        ));

      // Create release and attach assets
      logger.stepStart(`${wsLabel}Starting: Create release`);
      let createdReleaseNote: ProviderRelease | undefined;
      if (wsConfig.release.createRelease) {
        createdReleaseNote = await createRelease(
          provider,
          runSettings.inputs,
          wsConfig,
          wsPatternCtx,
        );
        logger.stepFinish(`${wsLabel}Finished: Create release`);
      } else {
        logger.stepSkip(
          `${wsLabel}Skipped: Create release (config create release note is false)`,
        );
      }

      logger.stepStart(`${wsLabel}Starting: Attach release assets`);
      if (createdReleaseNote?.id && wsConfig.release.assets) {
        await attachReleaseAssets(
          provider,
          createdReleaseNote.id,
          wsConfig.release.assets,
        );
        logger.stepFinish(`${wsLabel}Finished: Attach release assets`);
      } else {
        logger.stepSkip(
          `${wsLabel}Skipped: Attach release assets (no assets to attach or config create release note is false)`,
        );
      }

      // Label management (only once for grouped proposals)
      if (workspacePublishDataList.indexOf(wsData) === 0) {
        logger.stepStart("Starting: Update merged proposal labels");
        await updateProposalLabelsOnMerge(
          provider,
          associatedProposalForCommit.id,
          runSettings.config.review.labels?.onMerge?.add,
          runSettings.config.review.labels?.onMerge?.remove,
        );
        logger.stepFinish("Finished: Update merged proposal labels");
      }

      // postRelease hook
      logger.debugStepStart(
        `${wsLabel}Starting: Export post release variables`,
      );
      await exportPostReleaseVariables(
        provider,
        wsPatternCtx,
        createdReleaseNote?.id,
        createdReleaseNote?.uploadUrl,
      );
      logger.debugStepFinish(
        `${wsLabel}Finished: Export post release variables`,
      );

      ({ runSettings, patternContext: wsPatternCtx } =
        await executeHookWithOverride(
          provider,
          "postRelease",
          wsConfig.commandHooks,
          runSettings,
          wsPatternCtx,
          { nextVersion: nextVersion! },
        ));

      patternContext = wsPatternCtx;
    }
  } else {
    logger.header(
      "Review release flow (publish): Skip create tag and release (disabled in config)",
    );
  }

  return runSettings;
}
