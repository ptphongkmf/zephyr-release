import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ResolvedWorkspace } from "../types/workspace-context.ts";
import { buildMatchPatterns } from "./string-templates-and-patterns/match-patterns.ts";
import { taskLogger } from "./logger.ts";

export interface AffectedWorkspace extends ResolvedWorkspace {
  lastReleaseHash: string | undefined;
  lastReleaseTagName: string | undefined;
}

/**
 * For each workspace, find its last release tag and check if there are
 * new commits in that workspace's path since the last release.
 * Uses parallel API calls for efficiency.
 *
 * Returns only workspaces that have been affected (have new commits).
 * Each returned workspace includes the last release hash and tag name
 * for use in downstream version calculation.
 */
export async function detectAffectedWorkspaces(
  provider: PlatformProvider,
  workspaces: ResolvedWorkspace[],
  triggerCommitHash: string,
  maxCommitsToResolve: number,
): Promise<AffectedWorkspace[]> {
  // Step 1: Find the last release tag for each workspace (parallel)
  const workspacesWithRelease = await Promise.all(
    workspaces.map(async (ws) => {
      const patterns = buildMatchPatterns(
        ws.config.tag.nameTemplate,
        ws.config.tag.matchPatterns,
      );
      const lastRelease = await provider.findLastReleaseTag(patterns);

      taskLogger.info(
        lastRelease
          ? `Workspace "${ws.config.name}": last release tag "${lastRelease.tagName}" (${
            lastRelease.hash.substring(0, 7)
          })`
          : `Workspace "${ws.config.name}": no previous release found`,
      );

      return {
        ...ws,
        lastReleaseHash: lastRelease?.hash,
        lastReleaseTagName: lastRelease?.tagName,
      };
    }),
  );

  // Step 2: Check for new commits in each workspace path since last release (parallel)
  const affected = await Promise.all(
    workspacesWithRelease.map(async (ws) => {
      const pathFilter = ws.path === "." ? undefined : ws.path;
      const commits = await provider.listCommitsInRange(
        triggerCommitHash,
        ws.lastReleaseHash,
        pathFilter,
        maxCommitsToResolve,
      ).catch(() => // TODO: must log or do something on error, gracefully with empty array might not enough
      []);

      if (commits.length > 0) {
        taskLogger.info(
          `Workspace "${ws.config.name}": ${commits.length} commit(s) detected — affected`,
        );
        return ws;
      }

      taskLogger.info(
        `Workspace "${ws.config.name}": no new commits — skipping`,
      );
      return null;
    }),
  );

  return affected.filter((ws) => ws !== null);
}
