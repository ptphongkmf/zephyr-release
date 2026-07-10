import type { WorkingBranchResult } from "../tasks/branch.ts";
import {
  calculateNextVersion,
  compareNextVersionToCurrentVersion,
} from "../tasks/calculate-next-version/calculate-version.ts";
import { getCurrentVersion } from "../tasks/calculate-next-version/previous-version.ts";
import { format, type SemVer } from "@std/semver";
import { generatePrepareChangelogReleaseContent } from "../tasks/changelog.ts";
import {
  commitChangesToBranch,
  prepareChangesToCommit,
  resolveCommitsFromTriggerToLastRelease,
} from "../tasks/commit.ts";
import {
  exportPostCalculateVersionVariables,
  exportPostCommitVariables,
  exportPostProposalVariables,
  exportPostReleaseVariables,
  exportPreCalculateVersionVariables,
  exportPreCommitVariables,
  exportPreReleaseVariables,
  exportPreTagVariables,
  exportWorkspaceSummaryVariables,
} from "../tasks/export-variables.ts";
import { logger } from "../tasks/logger.ts";
import {
  addChangelogPatternContext,
  addCurrentVersionPatternContext,
  addNextVersionPatternContext,
  addReleasesPatternContext,
  addTagPatternContext,
  type ReleaseContextEntry,
  type StringPatternContext,
} from "../tasks/string-templates-and-patterns/pattern-context.ts";
import type {
  OperationRunSettings,
  OperationTriggerContext,
} from "../types/operation-context.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import { evaluateAutoReleaseFlowTriggerStrategy } from "../tasks/auto-trigger-strategy.ts";
import { createTag } from "../tasks/tag.ts";
import { attachReleaseAssets, createRelease } from "../tasks/release.ts";
import type { ProviderRelease } from "../types/providers/release.ts";
import { executeHookWithOverride } from "./hook-runner.ts";
import {
  type AffectedWorkspace,
  detectAffectedWorkspaces,
} from "../tasks/workspace-detection.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";

interface AutoWorkflowOptions {
  workingBranchResult: WorkingBranchResult;
  associatedProposalForCommit: ProviderProposal | undefined;
  associatedProposalFromBranch: ProviderProposal | undefined;
  triggerContext: OperationTriggerContext;
  patternContext: StringPatternContext;
}

/** Per-workspace result accumulated during Phase 1 */
interface WorkspaceReleaseData {
  workspace: AffectedWorkspace;
  nextVersion: SemVer;
  currentVersion: SemVer | undefined;
  tagName: string;
  patternContext: StringPatternContext;
}

export async function executeAutoReleaseFlow(
  provider: PlatformProvider,
  currentRunSettings: OperationRunSettings,
  opts: AutoWorkflowOptions,
) {
  const {
    // workingBranchResult,
    // associatedProposalForCommit,
    // associatedProposalFromBranch,
    triggerContext,
    patternContext: initialPatternContext,
  } = opts;

  let patternContext = initialPatternContext;

  /**
   * Auto release flow run settings.
   */
  let runSettings: OperationRunSettings = currentRunSettings;

  // ═══════════════════════════════════════════════════════════════════
  // Phase 1: Per-workspace version/changelog/files
  // ═══════════════════════════════════════════════════════════════════

  logger.header("Auto release flow (prepare): Creating commit...");

  // Detect affected workspaces
  const affectedWorkspaces: AffectedWorkspace[] = runSettings.isMonorepoMode
    ? await detectAffectedWorkspaces(
      provider,
      runSettings.workspaces,
      runSettings.inputs.triggerCommitHash,
      runSettings.config.maxCommitsToResolve,
    )
    : runSettings.workspaces.map((ws: ResolvedWorkspace) => ({
      ...ws,
      lastReleaseHash: undefined,
      lastReleaseTagName: undefined,
    }));

  if (affectedWorkspaces.length === 0) {
    logger.stepSkip(
      "No affected workspaces detected — nothing to release",
    );
    return runSettings;
  }

  const releaseEntries: ReleaseContextEntry[] = [];
  const allChangesData = new Map<string, string | null>();
  const workspaceReleaseDataList: WorkspaceReleaseData[] = [];

  for (const ws of affectedWorkspaces) {
    const wsConfig = ws.config;
    const wsLabel = runSettings.isMonorepoMode ? `[${wsConfig.name}] ` : "";

    if (runSettings.isMonorepoMode) {
      logger.subHeader(`Workspace: ${wsConfig.name}`);
      provider.setEnv("ZR_NAME", wsConfig.name ?? "");
    }

    // Get current version
    logger.stepStart(`${wsLabel}Starting: Get current version`);
    const currentVersion = await getCurrentVersion(
      provider,
      runSettings.inputs,
      wsConfig,
      ws.path,
    );
    logger.stepFinish(`${wsLabel}Finished: Get current version`);

    // Resolve commits
    logger.stepStart(
      `${wsLabel}Starting: Resolve commits from trigger to last release`,
    );
    const resolvedCommitsResult = await resolveCommitsFromTriggerToLastRelease(
      provider,
      runSettings.inputs,
      wsConfig,
      ws.lastReleaseHash,
      ws.path === "." ? undefined : ws.path,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Resolve commits from trigger to last release`,
    );

    // preCalculateVersion hook
    logger.debugStepStart(
      `${wsLabel}Starting: Export pre calculate version variables`,
    );
    await exportPreCalculateVersionVariables(
      provider,
      resolvedCommitsResult.entries,
      patternContext,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Export pre calculate version variables`,
    );

    ({ runSettings, patternContext } = await executeHookWithOverride(
      provider,
      "preCalculateVersion",
      wsConfig.commandHooks,
      runSettings,
      patternContext,
    ));

    // Calculate version
    logger.stepStart(`${wsLabel}Starting: Calculate next version`);
    const nextVersion = calculateNextVersion(
      resolvedCommitsResult,
      wsConfig,
      currentVersion,
    );
    logger.stepFinish(`${wsLabel}Finished: Calculate next version`);

    logger.stepStart(
      `${wsLabel}Starting: Compare calculated next version with current version`,
    );
    compareNextVersionToCurrentVersion(
      nextVersion,
      currentVersion,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Compare calculated next version with current version`,
    );

    // Build per-workspace pattern context
    logger.debugStepStart(
      `${wsLabel}Starting: Create fixed version and tag string pattern context`,
    );
    let wsPatternContext = patternContext;
    if (currentVersion) {
      wsPatternContext = addCurrentVersionPatternContext(
        wsPatternContext,
        currentVersion,
      );
    }
    wsPatternContext = addNextVersionPatternContext(
      wsPatternContext,
      nextVersion,
    );
    wsPatternContext = await addTagPatternContext(
      wsPatternContext,
      wsConfig.tag.nameTemplate,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Create fixed version and tag string pattern context`,
    );

    // Collect release entry for later aggregation
    const tagName = wsPatternContext.tagName as string;
    releaseEntries.push({
      name: wsConfig.name ?? "root",
      nextVersion: format(nextVersion),
      tagName,
      isWorkspace: ws.isWorkspace,
    });

    // postCalculateVersion hook
    logger.debugStepStart(
      `${wsLabel}Starting: Export post calculate version variables`,
    );
    await exportPostCalculateVersionVariables(
      provider,
      currentVersion,
      nextVersion,
      wsPatternContext,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Export post calculate version variables`,
    );

    ({ runSettings, patternContext: wsPatternContext } =
      await executeHookWithOverride(
        provider,
        "postCalculateVersion",
        wsConfig.commandHooks,
        runSettings,
        wsPatternContext,
        { nextVersion, currentVersion },
      ));

    // Evaluate auto trigger strategy
    logger.stepStart(
      `${wsLabel}Starting: Evaluate auto release flow trigger strategy`,
    );
    evaluateAutoReleaseFlowTriggerStrategy(
      resolvedCommitsResult.entries,
      wsConfig,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Evaluate auto release flow trigger strategy`,
    );

    // Generate changelog
    logger.stepStart(
      `${wsLabel}Starting: Generate changelog release content`,
    );
    const changelogReleaseResult = await generatePrepareChangelogReleaseContent(
      provider,
      resolvedCommitsResult.entries,
      runSettings.inputs,
      wsConfig,
      wsPatternContext,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Generate changelog release content`,
    );

    logger.debugStepStart(
      `${wsLabel}Starting: Create dynamic changelog string pattern context`,
    );
    wsPatternContext = addChangelogPatternContext(
      wsPatternContext,
      changelogReleaseResult.release,
      changelogReleaseResult.releaseBody,
      changelogReleaseResult.releaseAlt,
      changelogReleaseResult.releaseBodyAlt,
    );
    logger.debugStepFinish(
      `${wsLabel}Finished: Create dynamic changelog string pattern context`,
    );

    // Prepare changes to commit (workspace-relative paths)
    logger.stepStart(
      `${wsLabel}Starting: Prepare and collect changes data to commit`,
    );
    const wsChangesData = await prepareChangesToCommit(
      provider,
      runSettings.inputs,
      wsConfig,
      nextVersion,
      wsPatternContext,
      ws.path,
    );
    logger.stepFinish(
      `${wsLabel}Finished: Prepare and collect changes data to commit`,
    );

    // Accumulate changes across all workspaces
    for (const [filePath, content] of wsChangesData) {
      allChangesData.set(filePath, content);
    }

    // Store per-workspace data for Phase 3
    workspaceReleaseDataList.push({
      workspace: ws,
      nextVersion,
      currentVersion,
      tagName,
      patternContext: wsPatternContext,
    });

    // Update shared pattern context for the next workspace iteration
    patternContext = wsPatternContext;
  }

  // Export workspace summary variables (after all workspace versions are known)
  exportWorkspaceSummaryVariables(
    provider,
    runSettings.isMonorepoMode,
    affectedWorkspaces[0]?.config.name,
    releaseEntries.map((entry, i) => ({
      name: entry.name,
      nextVersion: entry.nextVersion,
      tagName: entry.tagName,
      path: affectedWorkspaces[i]!.path,
    })),
    affectedWorkspaces.map((ws) => ws.config.name ?? "root"),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Phase 2: Global commit
  // ═══════════════════════════════════════════════════════════════════

  // Set releases pattern context (all workspaces)
  patternContext = addReleasesPatternContext(patternContext, releaseEntries);

  // preCommit hook (global, root config)
  logger.debugStepStart("Starting: Export pre commit variables");
  await exportPreCommitVariables(provider, allChangesData, patternContext);
  logger.debugStepFinish("Finished: Export pre commit variables");

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "preCommit",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    {
      nextVersion: workspaceReleaseDataList[0]?.nextVersion,
      currentVersion: workspaceReleaseDataList[0]?.currentVersion,
    },
  ));

  // Commit all changes in one commit
  logger.stepStart("Starting: Commit changes");
  const commitResult = await commitChangesToBranch(
    provider,
    runSettings.inputs,
    runSettings.config,
    {
      baseTreeHash: triggerContext.latestTriggerCommit.treeHash,
      changesToCommit: allChangesData,
      targetBranchName: runSettings.inputs.triggerBranchName,
      force: false,
    },
    patternContext,
  );
  logger.stepFinish("Finished: Commit changes");

  // postCommit hook
  logger.debugStepStart("Starting: Export post commit variables");
  await exportPostCommitVariables(provider, commitResult.hash, patternContext);
  logger.debugStepFinish("Finished: Export post commit variables");

  // In auto release flow, postProposal is merged with postCommit
  logger.debugStepStart(
    "Starting: Export post proposal variables (auto release flow)",
  );
  await exportPostProposalVariables(
    provider,
    undefined,
    {
      config: runSettings.config,
    },
    patternContext,
  );
  logger.debugStepFinish(
    "Finished: Export post proposal variables (auto release flow)",
  );

  ({ runSettings, patternContext } = await executeHookWithOverride(
    provider,
    "postCommit",
    runSettings.config.commandHooks,
    runSettings,
    patternContext,
    {
      nextVersion: workspaceReleaseDataList[0]?.nextVersion,
      currentVersion: workspaceReleaseDataList[0]?.currentVersion,
    },
  ));

  // ═══════════════════════════════════════════════════════════════════
  // Phase 3: Per-workspace tags and releases
  // ═══════════════════════════════════════════════════════════════════

  if (runSettings.config.tag.createTag) {
    logger.header(
      "Auto release flow (publish): Creating tag and release...",
    );

    for (const wsData of workspaceReleaseDataList) {
      const wsConfig = wsData.workspace.config;
      const wsLabel = runSettings.isMonorepoMode ? `[${wsConfig.name}] ` : "";
      let wsPatternCtx = wsData.patternContext;

      // Re-apply releases context to each workspace's pattern context
      wsPatternCtx = addReleasesPatternContext(wsPatternCtx, releaseEntries);

      if (runSettings.isMonorepoMode) {
        logger.subHeader(`Workspace: ${wsConfig.name}`);
        provider.setEnv("ZR_NAME", wsConfig.name ?? "");
      }

      // preTag hook
      logger.debugStepStart(
        `${wsLabel}Starting: Export pre tag variables`,
      );
      await exportPreTagVariables(
        provider,
        wsData.nextVersion,
        wsPatternCtx,
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
          {
            nextVersion: wsData.nextVersion,
            currentVersion: wsData.currentVersion,
          },
        ));

      // Create tag
      logger.stepStart(`${wsLabel}Starting: Create tag`);
      const createdTag = await createTag(
        provider,
        commitResult.hash,
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
          {
            nextVersion: wsData.nextVersion,
            currentVersion: wsData.currentVersion,
          },
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
          `${wsLabel}Skipped: Create release (config create release is false)`,
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
          `${wsLabel}Skipped: Attach release assets (no assets to attach or config create release is false)`,
        );
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
          {
            nextVersion: wsData.nextVersion,
            currentVersion: wsData.currentVersion,
          },
        ));

      // Preserve pattern context for next iteration
      patternContext = wsPatternCtx;
    }
  } else {
    logger.header(
      "Auto release flow (publish): Skip create tag and release (disabled in config)",
    );
  }

  return runSettings;
}
