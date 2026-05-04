import { normalize } from "@std/path";
import {
  type Commit,
  type CommitBase,
  CommitParser,
} from "conventional-commits-parser";
import { filterRevertedCommitsSync } from "conventional-commits-filter";
import picomatch from "picomatch";
import { taskLogger } from "./logger.ts";
import { prepareVersionFilesToCommit } from "./version-files/version-file.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ConfigOutput } from "../schemas/configs/config.ts";
import {
  NESTED_CLEANING_REGEX,
  NESTED_COMMIT,
  ZEPHYR_RELEASE_COMMIT_SIGN,
} from "../constants/commit.ts";
import type { ProviderCommit } from "../types/providers/commit.ts";
import type { ChangelogConfigOutput } from "../schemas/configs/modules/changelog-config.ts";
import { prepareChangelogFileToCommit } from "./changelog.ts";
import { execSync } from "node:child_process";
import { getTextFile } from "./file.ts";
import { resolveStringTemplate } from "./string-templates-and-patterns/resolve-template.ts";
import type { CommitConfigOutput } from "../schemas/configs/modules/commit-config.ts";
import { BranchOutOfDateError } from "../errors/providers/branch.ts";
import { SafeExit } from "../errors/safe-exit.ts";
import { VERSION } from "../version.generated.ts";
import { breakingChangeKeywords } from "../constants/conventional-commit-parser-options.ts";
import { NoCommitFoundError } from "../errors/providers/commit.ts";
import { format, type SemVer } from "@std/semver";

type ResolveCommitsInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash"
>;

type ResolveCommitsConfigParams = Pick<
  ConfigOutput,
  "commitTypes" | "maxCommitsToResolve" | "resolveUntilCommitHash"
>;

/**
 * Parsed and resolved commit object with additional fields.
 *
 * @example
 * Commit message:
 * ```text
 * feat(api)!: add new authentication endpoint (#800)
 *
 * Implement OAuth2 authentication with JWT token support.
 *
 * BREAKING CHANGE: The old /auth/login endpoint is deprecated. Use /auth/oauth2 instead.
 *
 * Fixes #123
 * Closes #456
 * Refs #789
 *
 * Co-authored-by: John Doe <john@example.com>
 * ```
 *
 * Parsed result:
 * ```json
 * {
 *   "merge": null,
 *   "revert": null,
 *   "header": "feat(api)!: add new authentication endpoint (#800)",
 *   "body": "Implement OAuth2 authentication with JWT token support.",
 *   "footer": "BREAKING CHANGE: The old /auth/login endpoint is deprecated. Use /auth/oauth2 instead.\n\nFixes #123\nCloses #456\nRefs #789\n\nCo-authored-by: John Doe <john@example.com>",
 *   "notes": [
 *     {
 *       "title": "BREAKING CHANGE",
 *       "text": "The old /auth/login endpoint is deprecated. Use /auth/oauth2 instead."
 *     }
 *   ],
 *   "mentions": [
 *     "example"
 *   ],
 *   "references": [
 *     {
 *       "raw": "feat(api)!: add new authentication endpoint (#800",
 *       "action": null,
 *       "owner": null,
 *       "repository": null,
 *       "prefix": "#",
 *       "issue": "800"
 *     },
 *     {
 *       "raw": "#123",
 *       "action": "Fixes",
 *       "owner": null,
 *       "repository": null,
 *       "prefix": "#",
 *       "issue": "123"
 *     },
 *     {
 *       "raw": "#456",
 *       "action": "Closes",
 *       "owner": null,
 *       "repository": null,
 *       "prefix": "#",
 *       "issue": "456"
 *     },
 *     {
 *       "raw": "Refs #789",
 *       "action": null,
 *       "owner": null,
 *       "repository": null,
 *       "prefix": "#",
 *       "issue": "789"
 *     }
 *   ],
 *   "type": "feat",
 *   "scope": "api",
 *   "breaking": "!",
 *   "subject": "add new authentication endpoint (#800)",
 *   "hash": "abc123def456",
 *   "isBreaking": true
 * }
 * ```
 */
export type ResolvedCommit = CommitBase & {
  hash: string;
  type: string;
  scope?: string;
  subject: string;
  breaking?: string; // This is the "!" char
  isBreaking: boolean;
  author: ProviderCommit["author"];
  committer: ProviderCommit["committer"];
};

interface WorkingCommitEntry {
  hash: string;
  message: string;
  isVirtual: boolean;
  isIgnored: boolean;
  author: ProviderCommit["author"];
  committer: ProviderCommit["committer"];
}

export interface ResolvedCommitsResult {
  resolvedTriggerCommit: Commit;
  entries: ResolvedCommit[];
}

/** @throws {Error | SafeExit} */
export async function resolveCommitsFromTriggerToLastRelease(
  provider: PlatformProvider,
  inputs: ResolveCommitsInputsParams,
  config: ResolveCommitsConfigParams,
): Promise<ResolvedCommitsResult> {
  const { triggerCommitHash } = inputs;
  const { commitTypes, maxCommitsToResolve, resolveUntilCommitHash } = config;

  const rawCommits = await provider.listCommitsFromGivenToLastRelease(
    triggerCommitHash,
    maxCommitsToResolve,
    resolveUntilCommitHash,
  ).catch((error) => {
    if (error instanceof NoCommitFoundError) {
      throw new SafeExit(error.message);
    }
    throw error;
  });

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup("Raw collected commits:");
    dLogger.info(JSON.stringify(rawCommits, null, 2));
    dLogger.endGroup();
  });

  taskLogger.info("Pre processing raw commits into working entries...");
  const workingEntries = processRawCommits(rawCommits);

  taskLogger.info("Parsing and filtering processed working commit entries...");
  // Options is shallow merged with the library defaults
  const commitParser = new CommitParser(
    provider.getConventionalCommitParserOptions(),
  );

  const allowedTypes = new Set(commitTypes.map((c) => c.type));

  let resolvedTriggerCommit: Commit | undefined;
  const parsedFilteredCommits: ResolvedCommit[] = [];

  for (const entry of workingEntries) {
    const commit = commitParser.parse(entry.message);

    const type = commit.type?.toLowerCase();
    const subject = commit.subject;
    const isTypeAllowed = !!(type && allowedTypes.has(type));

    if (entry.hash === triggerCommitHash && !entry.isVirtual) {
      resolvedTriggerCommit = commit;
    }

    if (entry.isIgnored || !isTypeAllowed || !subject) continue;

    const hasBreakingNote = commit.notes.some(
      (n) =>
        n.title === breakingChangeKeywords.space ||
        n.title === breakingChangeKeywords.hyphen,
    );
    const isBreaking = !!commit.breaking || hasBreakingNote;

    if (isBreaking && !hasBreakingNote) {
      commit.notes.push({
        title: breakingChangeKeywords.space,
        text: subject,
      });
    }

    parsedFilteredCommits.push({
      ...commit,
      hash: entry.hash,
      type,
      subject,
      isBreaking,
      author: entry.author,
      committer: entry.committer,
    });
  }

  if (!resolvedTriggerCommit) {
    throw new Error(
      `Critical Error: Trigger commit ${triggerCommitHash} not found after resolved commit entries`,
    );
  }

  const resolvedCommits = Array.from(
    filterRevertedCommitsSync(parsedFilteredCommits),
  );

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup("Final resolved (parsed and filtered) commits:");
    dLogger.info(JSON.stringify(resolvedCommits, null, 2));
    dLogger.endGroup();
  });

  return {
    resolvedTriggerCommit,
    entries: resolvedCommits,
  };
}

function processRawCommits(rawCommits: ProviderCommit[]): WorkingCommitEntry[] {
  const workingEntries: WorkingCommitEntry[] = [];

  for (const raw of rawCommits) {
    const cleanedOriginalMessage = cleanMessage(raw.message);
    const overrides = extractBlock(raw.message, NESTED_COMMIT.OVERRIDE);
    const appends = extractBlock(raw.message, NESTED_COMMIT.APPEND);

    workingEntries.push({
      hash: raw.hash,
      message: cleanedOriginalMessage,
      isVirtual: false,
      isIgnored: overrides.length > 0, // Ignore if user provided an override
      author: raw.author,
      committer: raw.committer,
    });

    const nestedEntries = overrides.length > 0 ? overrides : appends;
    for (const msg of nestedEntries) {
      workingEntries.push({
        hash: raw.hash,
        message: msg,
        isVirtual: true,
        isIgnored: false,
        author: raw.author,
        committer: raw.committer,
      });
    }
  }

  return workingEntries;
}

/**
 * Removes the metadata blocks from the message so the parser
 * doesn't include them in the body/footer.
 */
function cleanMessage(text: string): string {
  return text.replace(NESTED_CLEANING_REGEX, "").trim();
}

function extractBlock(
  text: string,
  block: { start: string; end: string },
): string[] {
  const startIdx = text.indexOf(block.start);
  const endIdx = text.indexOf(block.end);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) return [];

  return text
    .slice(startIdx + block.start.length, endIdx)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

type PrepareChangesInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash" | "workspacePath" | "sourceMode"
>;

type PrepareChangesConfigParams = {
  versionFiles: ConfigOutput["versionFiles"];
  changelog: Pick<
    ChangelogConfigOutput,
    | "writeToFile"
    | "path"
    | "fileHeaderTemplate"
    | "fileHeaderTemplatePath"
    | "fileReleaseTemplate"
    | "fileReleaseTemplatePath"
    | "fileFooterTemplate"
    | "fileFooterTemplatePath"
  >;
  commit: Pick<CommitConfigOutput, "localChangesToCommit">;
};

/** @throws */
export async function prepareChangesToCommit(
  provider: PlatformProvider,
  inputs: PrepareChangesInputsParams,
  config: PrepareChangesConfigParams,
  nextVersion: SemVer,
): Promise<Map<string, string | null>> {
  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const { versionFiles, changelog, commit } = config;
  const { localChangesToCommit } = commit;
  const { writeToFile, path } = changelog;

  const changesData = new Map<string, string | null>();

  taskLogger.info("Collecting changelog data to commit...");
  if (writeToFile) {
    const clContent = await prepareChangelogFileToCommit(
      provider,
      changelog,
      sourceMode,
      workspacePath,
      triggerCommitHash,
    );
    changesData.set(normalize(path), clContent);
  } else {
    taskLogger.info("Changelog config write to file is off. Skipping...");
  }

  taskLogger.info(
    `Collecting version files data to commit (${versionFiles.length} files)...`,
  );
  const vfChangesData = await prepareVersionFilesToCommit(
    provider,
    versionFiles,
    sourceMode,
    workspacePath,
    format(nextVersion),
    triggerCommitHash,
  );
  for (const [vfPath, vfContent] of vfChangesData) {
    changesData.set(normalize(vfPath), vfContent);
  }

  if (localChangesToCommit) {
    taskLogger.info(
      `Collecting local changes to commit using globs (${localChangesToCommit.length} globs)...`,
    );

    const allChangedFiles: {
      path: string;
      isDelete: boolean;
    }[] = [];

    try {
      const output = execSync("git status --porcelain", {
        cwd: workspacePath,
        encoding: "utf-8",
      });

      const lines = output.split("\n").filter((line) => line.trim().length > 0);

      for (const line of lines) {
        const status = line.slice(0, 2);
        let filePathPart = line.slice(3).trim();

        if (status.includes("R") && filePathPart.includes(" -> ")) {
          const parts = filePathPart.split(" -> ");
          const oldPathPart = parts[0];
          const newPathPart = parts[parts.length - 1];

          if (oldPathPart && newPathPart) {
            allChangedFiles.push({
              path: gitUnquote(oldPathPart.trim()),
              isDelete: true,
            });
            allChangedFiles.push({
              path: gitUnquote(newPathPart.trim()),
              isDelete: false,
            });
          }

          continue;
        }

        const isDelete = status.includes("D");
        filePathPart = gitUnquote(filePathPart);

        if (filePathPart.length > 0) {
          allChangedFiles.push({ path: filePathPart, isDelete });
        }
      }
    } catch (error) {
      throw new Error("Error while executing 'git status --porcelain'", {
        cause: error,
      });
    }

    // Match the strictly parsed git files against the user's globs
    const isMatch = picomatch(localChangesToCommit, { dot: true });

    for (const entry of allChangedFiles) {
      if (!isMatch(entry.path)) continue;

      const normalizedPath = normalize(entry.path);

      if (entry.isDelete) {
        changesData.set(normalizedPath, null);
        continue;
      }

      // DEDUPLICATION:
      // If "changelog.md" is already in the manifest from step 1,
      // we do NOT overwrite it with the old version from disk
      if (changesData.has(normalizedPath)) continue;

      const fileContent = await getTextFile("local", entry.path, {
        workspacePath: workspacePath,
      });
      changesData.set(normalizedPath, fileContent);
    }
  }

  return changesData;
}

function gitUnquote(p: string) {
  if (p.startsWith('"') && p.endsWith('"')) {
    return p.slice(1, -1).replace(/\\"/g, '"');
  }
  return p;
}

type CommitChangesInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash" | "workspacePath" | "sourceMode"
>;

interface CommitChangesConfigParams {
  mode: ConfigOutput["mode"];
  commit: Pick<
    CommitConfigOutput,
    | "headerTemplate"
    | "headerTemplatePath"
    | "bodyTemplate"
    | "bodyTemplatePath"
    | "footerTemplate"
    | "footerTemplatePath"
  >;
}

/** @throws */
export async function commitChangesToBranch(
  provider: PlatformProvider,
  inputs: CommitChangesInputsParams,
  config: CommitChangesConfigParams,
  commitData: {
    baseTreeHash: string;
    changesToCommit: Map<string, string | null>;
    targetBranchName: string;
    force?: boolean;
  },
) {
  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const { mode } = config;
  const {
    headerTemplate,
    headerTemplatePath,
    bodyTemplate,
    bodyTemplatePath,
    footerTemplate,
    footerTemplatePath,
  } = config.commit;
  const { baseTreeHash, changesToCommit, targetBranchName, force } = commitData;

  const resolvedChangesToCommit = new Map<string, string | null>();
  for (const [path, content] of changesToCommit) {
    resolvedChangesToCommit.set(path, content);
  }

  let commitHeader: string;
  if (headerTemplatePath) {
    const headerTemplateFromFile = await getTextFile(
      sourceMode.overrides?.[headerTemplatePath] ?? sourceMode.mode,
      headerTemplatePath,
      { provider, workspacePath, ref: triggerCommitHash },
    );
    commitHeader = await resolveStringTemplate(headerTemplateFromFile);
  } else {
    commitHeader = await resolveStringTemplate(headerTemplate);
  }

  let commitBody: string | undefined;
  if (bodyTemplatePath) {
    const bodyTemplateFromFile = await getTextFile(
      sourceMode.overrides?.[bodyTemplatePath] ?? sourceMode.mode,
      bodyTemplatePath,
      { provider, workspacePath, ref: triggerCommitHash },
    );
    commitBody = await resolveStringTemplate(bodyTemplateFromFile);
  } else if (bodyTemplate) {
    commitBody = await resolveStringTemplate(bodyTemplate);
  }

  let commitFooter: string | undefined;
  if (footerTemplatePath) {
    const footerTemplateFromFile = await getTextFile(
      sourceMode.overrides?.[footerTemplatePath] ?? sourceMode.mode,
      footerTemplatePath,
      { provider, workspacePath, ref: triggerCommitHash },
    );
    commitFooter = await resolveStringTemplate(footerTemplateFromFile);
  } else if (footerTemplate) {
    commitFooter = await resolveStringTemplate(footerTemplate);
  }

  const zephyrReleaseSign = `${ZEPHYR_RELEASE_COMMIT_SIGN}: ${VERSION}`;
  if (commitFooter?.trim()) {
    commitFooter = `${commitFooter.trim()}\n${zephyrReleaseSign}`;
  } else {
    commitFooter = zephyrReleaseSign;
  }

  const commitMessage = [commitHeader, commitBody, commitFooter]
    .filter(Boolean)
    .join("\n\n");

  taskLogger.info("Creating commit and pushing to working branch...");
  const createdCommit = await provider.createCommitOnBranch(
    triggerCommitHash,
    baseTreeHash,
    changesToCommit,
    commitMessage,
    targetBranchName,
    force,
  ).catch((error) => {
    if (mode === "auto" && error instanceof BranchOutOfDateError) {
      throw new SafeExit(
        "Trigger branch has moved forward. Letting the newer commit take over",
      );
    }

    throw error;
  });

  return createdCommit;
}
