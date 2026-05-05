import { toTitleCase } from "@std/text/unstable-to-title-case";
import type { ResolvedCommit } from "./commit.ts";
import { getTextFile } from "./file.ts";
import { FileNotFoundError } from "../errors/file.ts";
import type { ConfigOutput } from "../schemas/configs/config.ts";
import type { ChangelogConfigOutput } from "../schemas/configs/modules/changelog-config.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import { resolveStringTemplate } from "./string-templates-and-patterns/resolve-template.ts";
import type { ChangelogReleaseEntryPattern } from "../types/string-patterns.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import { CHANGELOG_MARKERS } from "../constants/markers.ts";
import { failedNonCriticalTasks } from "../main.ts";
import { taskLogger } from "./logger.ts";
import { breakingChangeKeywords } from "../constants/conventional-commit-parser-options.ts";
import {
  CommitGroupModes,
  CommitSortOrders,
} from "../constants/changelog-commit-options.ts";

type GenerateChangelogReleaseInputsParams = Pick<
  InputsOutput,
  "triggerCommitHash" | "workspacePath" | "sourceMode"
>;

type GenerateChangelogReleaseConfigParams =
  & Pick<ConfigOutput, "commitTypes">
  & {
    changelog: Pick<
      ChangelogConfigOutput,
      | "commitGroupMode"
      | "commitSortOrder"
      | "releaseHeaderTemplate"
      | "releaseHeaderTemplatePath"
      | "releaseSectionHeadingTemplate"
      | "releaseSectionHeadingTemplatePath"
      | "releaseSectionEntryTemplate"
      | "releaseSectionEntryTemplatePath"
      | "releaseBreakingSectionHeading"
      | "releaseBreakingSectionEntryTemplate"
      | "releaseBreakingSectionEntryTemplatePath"
      | "releaseFooterTemplate"
      | "releaseFooterTemplatePath"
      | "releaseBodyOverride"
      | "releaseBodyOverridePath"
      | "releaseHeaderTemplateAlt"
      | "releaseHeaderTemplateAltPath"
      | "releaseSectionHeadingTemplateAlt"
      | "releaseSectionHeadingTemplateAltPath"
      | "releaseSectionEntryTemplateAlt"
      | "releaseSectionEntryTemplateAltPath"
      | "releaseBreakingSectionHeadingAlt"
      | "releaseBreakingSectionEntryTemplateAlt"
      | "releaseBreakingSectionEntryTemplateAltPath"
      | "releaseFooterTemplateAlt"
      | "releaseFooterTemplateAltPath"
      | "releaseBodyOverrideAlt"
      | "releaseBodyOverrideAltPath"
    >;
  };

interface GeneratePrepareReleaseContentResult {
  release: string;
  releaseBody: string;
  releaseAlt: string;
  releaseBodyAlt: string;
}

/** @throws */
export async function generatePrepareChangelogReleaseContent(
  provider: PlatformProvider,
  resolvedCommits: ResolvedCommit[],
  inputs: GenerateChangelogReleaseInputsParams,
  config: GenerateChangelogReleaseConfigParams,
): Promise<GeneratePrepareReleaseContentResult> {
  const [releaseHeader, releaseBody, releaseFooter] = await Promise.all([
    resolveReleaseHeader(provider, inputs, config),
    resolveReleaseBody(provider, resolvedCommits, inputs, config),
    resolveReleaseFooter(provider, inputs, config),
  ]);

  return {
    release: [releaseHeader.base, releaseBody.base, releaseFooter.base]
      .filter(Boolean)
      .join("\n\n"),
    releaseBody: releaseBody.base,
    releaseAlt: [releaseHeader.alt, releaseBody.alt, releaseFooter.alt]
      .filter(Boolean)
      .join("\n\n"),
    releaseBodyAlt: releaseBody.alt,
  };
}

interface GeneratePublishReleaseContentResult {
  release: string;
  releaseBody?: string;
  releaseAlt?: string;
  releaseBodyAlt?: string;
}

export async function generatePublishChangelogReleaseContent(
  provider: PlatformProvider,
  proposalChangelogRelease: string,
  inputs: GenerateChangelogReleaseInputsParams,
  config: GenerateChangelogReleaseConfigParams,
): Promise<GeneratePublishReleaseContentResult | undefined> {
  try {
    const {
      releaseBodyOverride,
      releaseBodyOverridePath,
      releaseBodyOverrideAlt,
      releaseBodyOverrideAltPath,
    } = config.changelog;

    if (
      releaseBodyOverride ||
      releaseBodyOverridePath ||
      releaseBodyOverrideAlt ||
      releaseBodyOverrideAltPath
    ) {
      const [releaseHeader, releaseBody, releaseFooter] = await Promise.all([
        resolveReleaseHeader(provider, inputs, config),
        resolveReleaseBody(provider, undefined, inputs, config),
        resolveReleaseFooter(provider, inputs, config),
      ]);

      return {
        release: [releaseHeader.base, releaseBody.base, releaseFooter.base]
          .filter(Boolean)
          .join("\n\n"),
        releaseBody: releaseBody.base,
        releaseAlt: [releaseHeader.alt, releaseBody.alt, releaseFooter.alt]
          .filter(Boolean)
          .join("\n\n"),
        releaseBodyAlt: releaseBody.alt,
      };
    }

    // If no override, the value is just the proposal body.
    return { release: proposalChangelogRelease };
  } catch (error) {
    const message =
      `Failed to generate publish changelog release content using override: ${
        error instanceof Error ? error.message : String(error)
      } - falling back to using proposal body as release content.`;

    taskLogger.warn(message);
    failedNonCriticalTasks.push(message);

    return { release: proposalChangelogRelease };
  }
}

interface ResolvedReleaseText {
  base: string;
  alt: string;
}

async function resolveReleaseHeader(
  provider: PlatformProvider,
  inputs: GenerateChangelogReleaseInputsParams,
  config: GenerateChangelogReleaseConfigParams,
): Promise<ResolvedReleaseText> {
  const {
    releaseHeaderTemplate,
    releaseHeaderTemplatePath,
    releaseHeaderTemplateAlt,
    releaseHeaderTemplateAltPath,
  } = config.changelog;

  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const getTextOpts = { provider, workspacePath, ref: triggerCommitHash };

  let baseTemplate: string;
  if (releaseHeaderTemplatePath) {
    baseTemplate = await getTextFile(
      sourceMode.overrides?.[releaseHeaderTemplatePath] ?? sourceMode.mode,
      releaseHeaderTemplatePath,
      getTextOpts,
    );
  } else {
    baseTemplate = releaseHeaderTemplate;
  }

  let altTemplate: string;
  const resolvedAltPath = releaseHeaderTemplateAltPath ??
    releaseHeaderTemplatePath;
  const resolvedAltTemplate = releaseHeaderTemplateAlt ?? releaseHeaderTemplate;

  if (
    resolvedAltPath === releaseHeaderTemplatePath &&
    resolvedAltTemplate === releaseHeaderTemplate
  ) {
    altTemplate = baseTemplate;
  } else if (resolvedAltPath) {
    altTemplate = await getTextFile(
      sourceMode.overrides?.[resolvedAltPath] ?? sourceMode.mode,
      resolvedAltPath,
      getTextOpts,
    );
  } else {
    altTemplate = resolvedAltTemplate;
  }

  if (baseTemplate === altTemplate) {
    const resolved = await resolveStringTemplate(baseTemplate);
    return { base: resolved, alt: resolved };
  } else {
    const [base, alt] = await Promise.all([
      resolveStringTemplate(baseTemplate),
      resolveStringTemplate(altTemplate),
    ]);
    return { base, alt };
  }
}

/** @throws */
async function resolveReleaseBody(
  provider: PlatformProvider,
  resolvedCommits: ResolvedCommit[] | undefined,
  inputs: GenerateChangelogReleaseInputsParams,
  config: GenerateChangelogReleaseConfigParams,
): Promise<ResolvedReleaseText> {
  const {
    releaseBodyOverride,
    releaseBodyOverridePath,
    releaseBodyOverrideAlt,
    releaseBodyOverrideAltPath,
  } = config.changelog;

  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const getTextOpts = { provider, workspacePath, ref: triggerCommitHash };

  let baseTemplateOverride: string | undefined;
  if (releaseBodyOverridePath) {
    baseTemplateOverride = await getTextFile(
      sourceMode.overrides?.[releaseBodyOverridePath] ?? sourceMode.mode,
      releaseBodyOverridePath,
      getTextOpts,
    );
  } else {
    baseTemplateOverride = releaseBodyOverride;
  }

  let altTemplateOverride: string | undefined;
  const resolvedAltPath = releaseBodyOverrideAltPath ?? releaseBodyOverridePath;
  const resolvedAltTemplate = releaseBodyOverrideAlt ?? releaseBodyOverride;

  if (
    resolvedAltPath === releaseBodyOverridePath &&
    resolvedAltTemplate === releaseBodyOverride
  ) {
    altTemplateOverride = baseTemplateOverride;
  } else if (resolvedAltPath) {
    altTemplateOverride = await getTextFile(
      sourceMode.overrides?.[resolvedAltPath] ?? sourceMode.mode,
      resolvedAltPath,
      getTextOpts,
    );
  } else {
    altTemplateOverride = resolvedAltTemplate;
  }

  if (baseTemplateOverride !== undefined && altTemplateOverride !== undefined) {
    return { base: baseTemplateOverride, alt: altTemplateOverride };
  }

  if (!resolvedCommits) {
    throw new Error(
      "resolvedCommits must be provided to generate a release body when no override is configured",
    );
  }

  const generated = await generateReleaseBodyBasedOnCommits(
    provider,
    resolvedCommits,
    inputs,
    config,
  );

  return {
    base: baseTemplateOverride ?? generated.base,
    alt: altTemplateOverride ?? generated.alt,
  };
}

async function resolveReleaseFooter(
  provider: PlatformProvider,
  inputs: GenerateChangelogReleaseInputsParams,
  config: GenerateChangelogReleaseConfigParams,
): Promise<Partial<ResolvedReleaseText>> {
  const {
    releaseFooterTemplate,
    releaseFooterTemplatePath,
    releaseFooterTemplateAlt,
    releaseFooterTemplateAltPath,
  } = config.changelog;

  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const getTextOpts = { provider, workspacePath, ref: triggerCommitHash };

  let baseTemplate: string | undefined;
  if (releaseFooterTemplatePath) {
    baseTemplate = await getTextFile(
      sourceMode.overrides?.[releaseFooterTemplatePath] ?? sourceMode.mode,
      releaseFooterTemplatePath,
      getTextOpts,
    );
  } else {
    baseTemplate = releaseFooterTemplate;
  }

  let altTemplate: string | undefined;
  const resolvedAltPath = releaseFooterTemplateAltPath ??
    releaseFooterTemplatePath;
  const resolvedAltTemplate = releaseFooterTemplateAlt ?? releaseFooterTemplate;

  if (
    resolvedAltPath === releaseFooterTemplatePath &&
    resolvedAltTemplate === releaseFooterTemplate
  ) {
    altTemplate = baseTemplate;
  } else if (resolvedAltPath) {
    altTemplate = await getTextFile(
      sourceMode.overrides?.[resolvedAltPath] ?? sourceMode.mode,
      resolvedAltPath,
      getTextOpts,
    );
  } else {
    altTemplate = resolvedAltTemplate;
  }

  if (baseTemplate === altTemplate) {
    if (baseTemplate) {
      const resolved = await resolveStringTemplate(baseTemplate);
      return { base: resolved, alt: resolved };
    }
  } else {
    const resolves = await Promise.all([
      baseTemplate
        ? resolveStringTemplate(baseTemplate)
        : Promise.resolve(undefined),
      altTemplate
        ? resolveStringTemplate(altTemplate)
        : Promise.resolve(undefined),
    ]);
    return { base: resolves[0], alt: resolves[1] };
  }

  return { base: undefined, alt: undefined };
}

interface SectionGroupData {
  entries: string[];
  sectionInfo: { section: string; sectionAlt: string };
}

async function generateReleaseBodyBasedOnCommits(
  provider: PlatformProvider,
  resolvedCommits: ResolvedCommit[],
  inputs: GenerateChangelogReleaseInputsParams,
  config: GenerateChangelogReleaseConfigParams,
): Promise<ResolvedReleaseText> {
  const {
    commitTypes,
    changelog: {
      commitGroupMode,
      commitSortOrder,
      releaseSectionHeadingTemplate,
      releaseSectionHeadingTemplatePath,
      releaseSectionEntryTemplate,
      releaseSectionEntryTemplatePath,
      releaseBreakingSectionHeading,
      releaseBreakingSectionEntryTemplate,
      releaseBreakingSectionEntryTemplatePath,
      releaseSectionHeadingTemplateAlt,
      releaseSectionHeadingTemplateAltPath,
      releaseSectionEntryTemplateAlt,
      releaseSectionEntryTemplateAltPath,
      releaseBreakingSectionHeadingAlt,
      releaseBreakingSectionEntryTemplateAlt,
      releaseBreakingSectionEntryTemplateAltPath,
    },
  } = config;

  const baseSectionGroups = new Map<string, SectionGroupData>();
  const altSectionGroups = new Map<string, SectionGroupData>();

  const typeToSection = new Map<
    string,
    { baseSection: string; altSection: string; hidden: boolean }
  >();

  const breakingSectionHeadingBase = await resolveStringTemplate(
    releaseBreakingSectionHeading,
  );
  const breakingSectionHeadingAlt = await resolveStringTemplate(
    releaseBreakingSectionHeadingAlt ?? releaseBreakingSectionHeading,
  );

  baseSectionGroups.set(breakingSectionHeadingBase, {
    entries: [],
    sectionInfo: {
      section: breakingSectionHeadingBase,
      sectionAlt: breakingSectionHeadingAlt,
    },
  });
  altSectionGroups.set(breakingSectionHeadingAlt, {
    entries: [],
    sectionInfo: {
      section: breakingSectionHeadingBase,
      sectionAlt: breakingSectionHeadingAlt,
    },
  });

  for (const ct of commitTypes) {
    const sectionBase = ct.section ?? toTitleCase(ct.type);
    const sectionAlt = ct.sectionAlt ?? sectionBase;

    typeToSection.set(ct.type, {
      baseSection: sectionBase,
      altSection: sectionAlt,
      hidden: ct.hidden,
    });

    // Hidden types still need their sections registered so that breaking
    // commits from those types can be rendered under their own heading.
    const sectionInfo = { section: sectionBase, sectionAlt: sectionAlt };
    if (!baseSectionGroups.has(sectionBase)) {
      baseSectionGroups.set(sectionBase, { entries: [], sectionInfo });
    }
    if (!altSectionGroups.has(sectionAlt)) {
      altSectionGroups.set(sectionAlt, { entries: [], sectionInfo });
    }
  }

  const { triggerCommitHash, workspacePath, sourceMode } = inputs;
  const getTextOpts = { provider, workspacePath, ref: triggerCommitHash };

  let sectionHeadingTemplateBase: string;
  if (releaseSectionHeadingTemplatePath) {
    sectionHeadingTemplateBase = await getTextFile(
      sourceMode.overrides?.[releaseSectionHeadingTemplatePath] ??
        sourceMode.mode,
      releaseSectionHeadingTemplatePath,
      getTextOpts,
    );
  } else {
    sectionHeadingTemplateBase = releaseSectionHeadingTemplate;
  }

  let sectionHeadingTemplateAlt: string;
  const resolvedSectionHeadingAltPath = releaseSectionHeadingTemplateAltPath ??
    releaseSectionHeadingTemplatePath;
  const resolvedSectionHeadingAltTemplate = releaseSectionHeadingTemplateAlt;

  if (
    resolvedSectionHeadingAltPath === releaseSectionHeadingTemplatePath &&
    resolvedSectionHeadingAltTemplate === releaseSectionHeadingTemplate
  ) {
    sectionHeadingTemplateAlt = sectionHeadingTemplateBase;
  } else if (resolvedSectionHeadingAltPath) {
    sectionHeadingTemplateAlt = await getTextFile(
      sourceMode.overrides?.[resolvedSectionHeadingAltPath] ?? sourceMode.mode,
      resolvedSectionHeadingAltPath,
      getTextOpts,
    );
  } else {
    sectionHeadingTemplateAlt = resolvedSectionHeadingAltTemplate;
  }

  let sectionEntryTemplateBase: string;
  if (releaseSectionEntryTemplatePath) {
    sectionEntryTemplateBase = await getTextFile(
      sourceMode.overrides?.[releaseSectionEntryTemplatePath] ??
        sourceMode.mode,
      releaseSectionEntryTemplatePath,
      getTextOpts,
    );
  } else {
    sectionEntryTemplateBase = releaseSectionEntryTemplate;
  }

  let sectionEntryTemplateAlt: string;
  const resolvedSectionEntryAltPath = releaseSectionEntryTemplateAltPath ??
    releaseSectionEntryTemplatePath;
  const resolvedSectionEntryAltTemplate = releaseSectionEntryTemplateAlt ??
    releaseSectionEntryTemplate;

  if (
    resolvedSectionEntryAltPath === releaseSectionEntryTemplatePath &&
    resolvedSectionEntryAltTemplate === releaseSectionEntryTemplate
  ) {
    sectionEntryTemplateAlt = sectionEntryTemplateBase;
  } else if (resolvedSectionEntryAltPath) {
    sectionEntryTemplateAlt = await getTextFile(
      sourceMode.overrides?.[resolvedSectionEntryAltPath] ?? sourceMode.mode,
      resolvedSectionEntryAltPath,
      getTextOpts,
    );
  } else {
    sectionEntryTemplateAlt = resolvedSectionEntryAltTemplate;
  }

  let breakingEntryTemplateBase: string;
  if (releaseBreakingSectionEntryTemplatePath) {
    breakingEntryTemplateBase = await getTextFile(
      sourceMode.overrides?.[releaseBreakingSectionEntryTemplatePath] ??
        sourceMode.mode,
      releaseBreakingSectionEntryTemplatePath,
      getTextOpts,
    );
  } else {
    breakingEntryTemplateBase = releaseBreakingSectionEntryTemplate;
  }

  let breakingEntryTemplateAlt: string;
  const resolvedBreakingEntryAltPath =
    releaseBreakingSectionEntryTemplateAltPath ??
      releaseBreakingSectionEntryTemplatePath;
  const resolvedBreakingEntryAltTemplate =
    releaseBreakingSectionEntryTemplateAlt ??
      releaseBreakingSectionEntryTemplate;

  if (
    resolvedBreakingEntryAltPath === releaseBreakingSectionEntryTemplatePath &&
    resolvedBreakingEntryAltTemplate === releaseBreakingSectionEntryTemplate
  ) {
    breakingEntryTemplateAlt = breakingEntryTemplateBase;
  } else if (resolvedBreakingEntryAltPath) {
    breakingEntryTemplateAlt = await getTextFile(
      sourceMode.overrides?.[resolvedBreakingEntryAltPath] ?? sourceMode.mode,
      resolvedBreakingEntryAltPath,
      getTextOpts,
    );
  } else {
    breakingEntryTemplateAlt = resolvedBreakingEntryAltTemplate;
  }

  const sortedCommits = [...resolvedCommits].sort((a, b) => {
    if (commitGroupMode !== CommitGroupModes.none) {
      const scopeA = a.scope ? a.scope.toLowerCase() : "";
      const scopeB = b.scope ? b.scope.toLowerCase() : "";

      if (scopeA !== scopeB) {
        if (commitGroupMode === CommitGroupModes.scopeFirst) {
          if (!scopeA && scopeB) return 1;
          if (scopeA && !scopeB) return -1;
        } else if (commitGroupMode === CommitGroupModes.scopeLast) {
          if (!scopeA && scopeB) return -1;
          if (scopeA && !scopeB) return 1;
        }
        if (scopeA && scopeB) {
          return scopeA.localeCompare(scopeB);
        }
      }
    }

    if (commitSortOrder === CommitSortOrders.oldestFirst) {
      // waiting for temporal support in node
      //       return Temporal.Instant.compare(a.committer.date, b.committer.date);
      return a.committer.date.getTime() - b.committer.date.getTime();
    } else if (commitSortOrder === CommitSortOrders.newestFirst) {
      // waiting for temporal support in node
      //       return Temporal.Instant.compare(b.committer.date, a.committer.date);
      return b.committer.date.getTime() - a.committer.date.getTime();
    } else {
      return a.subject.localeCompare(b.subject);
    }
  });

  // Process Commits
  for (const commit of sortedCommits) {
    const typeInfo = typeToSection.get(commit.type);
    if (!typeInfo) continue;

    // Hidden commit types are excluded from the changelog unless the commit
    // is a breaking change, in which case it must still be shown.
    if (typeInfo.hidden && !commit.isBreaking) continue;

    const baseSectionGroup = baseSectionGroups.get(typeInfo.baseSection);
    const altSectionGroup = altSectionGroups.get(typeInfo.altSection);

    if (!baseSectionGroup || !altSectionGroup) continue;

    const commitPatterns = createCommitExtraPatterns(commit);

    const commitStrBase = await resolveStringTemplate(
      sectionEntryTemplateBase,
      commitPatterns,
    );

    const commitStrAlt = sectionEntryTemplateBase === sectionEntryTemplateAlt
      ? commitStrBase
      : await resolveStringTemplate(
        sectionEntryTemplateAlt,
        commitPatterns,
      );

    baseSectionGroup.entries.push(commitStrBase);
    altSectionGroup.entries.push(commitStrAlt);

    if (commit.isBreaking) {
      const commitBreakingStrBase = breakingEntryTemplateBase
        ? await resolveStringTemplate(breakingEntryTemplateBase, commitPatterns)
        : commitStrBase;

      let commitBreakingStrAlt: string;
      if (breakingEntryTemplateAlt) {
        if (breakingEntryTemplateBase === breakingEntryTemplateAlt) {
          commitBreakingStrAlt = commitBreakingStrBase;
        } else {
          commitBreakingStrAlt = await resolveStringTemplate(
            breakingEntryTemplateAlt,
            commitPatterns,
          );
        }
      } else {
        commitBreakingStrAlt = commitStrAlt;
      }

      const baseBreakingGroup = baseSectionGroups.get(
        breakingSectionHeadingBase,
      );
      const altBreakingGroup = altSectionGroups.get(breakingSectionHeadingAlt);

      if (!baseBreakingGroup || !altBreakingGroup) {
        throw new Error(
          `${generatePrepareChangelogReleaseContent.name} failed: Breaking Changes section has not been initialized?`,
        );
      }

      baseBreakingGroup.entries.push(commitBreakingStrBase);
      altBreakingGroup.entries.push(commitBreakingStrAlt);
    }
  }

  const finalReleaseBodyBase: string[] = [];
  for (const [key, group] of baseSectionGroups) {
    if (group.entries.length === 0) continue;

    const heading = key === breakingSectionHeadingBase
      ? key
      : await resolveStringTemplate(
        sectionHeadingTemplateBase,
        group.sectionInfo,
      );

    finalReleaseBodyBase.push(heading);
    finalReleaseBodyBase.push(group.entries.join("\n"));
  }

  const finalReleaseBodyAlt: string[] = [];
  for (const [key, group] of altSectionGroups) {
    if (group.entries.length === 0) continue;

    const heading = key === breakingSectionHeadingAlt
      ? key
      : await resolveStringTemplate(
        sectionHeadingTemplateAlt,
        group.sectionInfo,
      );

    finalReleaseBodyAlt.push(heading);
    finalReleaseBodyAlt.push(group.entries.join("\n"));
  }

  return {
    base: finalReleaseBodyBase.join("\n\n"),
    alt: finalReleaseBodyAlt.join("\n\n"),
  };
}

/** @throws */
function createCommitExtraPatterns(
  commit: ResolvedCommit,
): Record<ChangelogReleaseEntryPattern, unknown> {
  const breakingDesc = commit.notes.findLast(
    (n) =>
      n.title === breakingChangeKeywords.space ||
      n.title === breakingChangeKeywords.hyphen,
  )?.text ?? commit.subject;

  return {
    commit,
    hash: commit.hash,
    type: commit.type,
    scope: commit.scope,
    desc: commit.subject,
    body: commit.body,
    footer: commit.footer,
    breakingDesc,
    isBreaking: commit.isBreaking,
    authorName: commit.author.name,
    authorEmail: commit.author.email,
    authorDate: commit.author.date.toString(),
    committerName: commit.committer.name,
    committerEmail: commit.committer.email,
    committerDate: commit.committer.date.toString(),
  };
}

type PrepareChangelogParams = Pick<
  ChangelogConfigOutput,
  | "path"
  | "fileHeaderTemplate"
  | "fileHeaderTemplatePath"
  | "fileReleaseTemplate"
  | "fileReleaseTemplatePath"
  | "fileFooterTemplate"
  | "fileFooterTemplatePath"
>;

export async function prepareChangelogFileToCommit(
  provider: PlatformProvider,
  changelogConfig: PrepareChangelogParams,
  sourceMode: InputsOutput["sourceMode"],
  workspacePath: string,
  triggerCommitHash: string,
): Promise<string> {
  const {
    path,
    fileHeaderTemplate,
    fileHeaderTemplatePath,
    fileReleaseTemplate,
    fileReleaseTemplatePath,
    fileFooterTemplate,
    fileFooterTemplatePath,
  } = changelogConfig;

  const changelogSourceMode = sourceMode.overrides?.[path] ?? sourceMode.mode;

  // If current changelog file not exist, we auto create a brand new one
  const currentFileContent = await getTextFile(
    changelogSourceMode,
    path,
    { provider, workspacePath: workspacePath, ref: triggerCommitHash },
  ).catch((error) => {
    if (error instanceof FileNotFoundError) {
      return "";
    }

    throw error;
  });

  let header: string;
  if (fileHeaderTemplatePath) {
    const headerTemplate = await getTextFile(
      sourceMode.overrides?.[fileHeaderTemplatePath] ?? sourceMode.mode,
      fileHeaderTemplatePath,
      { provider, workspacePath: workspacePath, ref: triggerCommitHash },
    );
    header = await resolveStringTemplate(headerTemplate);
  } else header = await resolveStringTemplate(fileHeaderTemplate);

  let releaseContentBlock: string;
  if (fileReleaseTemplatePath) {
    const releaseTemplate = await getTextFile(
      sourceMode.overrides?.[fileReleaseTemplatePath] ?? sourceMode.mode,
      fileReleaseTemplatePath,
      { provider, workspacePath: workspacePath, ref: triggerCommitHash },
    );
    releaseContentBlock = await resolveStringTemplate(releaseTemplate);
  } else {
    releaseContentBlock = await resolveStringTemplate(fileReleaseTemplate);
  }

  let footer: string | undefined;
  if (fileFooterTemplatePath) {
    const footerTemplate = await getTextFile(
      sourceMode.overrides?.[fileFooterTemplatePath] ?? sourceMode.mode,
      fileFooterTemplatePath,
      { provider, workspacePath: workspacePath, ref: triggerCommitHash },
    );
    footer = await resolveStringTemplate(footerTemplate);
  } else if (fileFooterTemplate) {
    footer = await resolveStringTemplate(fileFooterTemplate);
  }

  if (!currentFileContent.trim()) {
    const bodyWithMarkers = [
      CHANGELOG_MARKERS.bodyStart,
      releaseContentBlock,
      CHANGELOG_MARKERS.bodyEnd,
    ].join("\n");

    return [header, bodyWithMarkers, footer].filter(Boolean).join("\n\n");
  } else {
    // check if fileContent have the marker from CHANGELOG_MARKERS start and end
    const bodyStartMarkerIndex = currentFileContent.indexOf(
      CHANGELOG_MARKERS.bodyStart,
    );
    const bodyEndMarkerIndex = currentFileContent.lastIndexOf(
      CHANGELOG_MARKERS.bodyEnd,
    );

    if (bodyStartMarkerIndex === -1 || bodyEndMarkerIndex === -1) {
      // Markers not found - treat current content as old and archive it
      const archivedContent = [
        CHANGELOG_MARKERS.archived,
        "---",
        currentFileContent,
      ].join("\n");

      const bodyWithMarkers = [
        CHANGELOG_MARKERS.bodyStart,
        releaseContentBlock,
        CHANGELOG_MARKERS.bodyEnd,
      ].join("\n");

      return [header, bodyWithMarkers, footer, archivedContent].filter(Boolean)
        .join("\n\n");
    } else {
      // Markers exist - update content between outermost markers

      // Handle update body
      const bodyStartMarkerEndIndex = bodyStartMarkerIndex +
        CHANGELOG_MARKERS.bodyStart.length;

      const existingBodyContent = currentFileContent.substring(
        bodyStartMarkerEndIndex,
        bodyEndMarkerIndex,
      ).trim();

      const updatedBody = existingBodyContent
        ? [releaseContentBlock, existingBodyContent].join("\n\n")
        : releaseContentBlock;

      const updatedBodyWithMarkers = [
        CHANGELOG_MARKERS.bodyStart,
        updatedBody,
        CHANGELOG_MARKERS.bodyEnd,
      ].join("\n");

      // Handle archive
      const bodyEndMarkerEndIndex = bodyEndMarkerIndex +
        CHANGELOG_MARKERS.bodyEnd.length;
      const contentAfterBodyEnd = currentFileContent.substring(
        bodyEndMarkerEndIndex,
      );

      const archivedMarkerIndex = contentAfterBodyEnd.indexOf(
        CHANGELOG_MARKERS.archived,
      );

      let archivedContent: string | undefined;
      if (archivedMarkerIndex !== -1) {
        archivedContent = contentAfterBodyEnd.substring(archivedMarkerIndex);
      }

      return [header, updatedBodyWithMarkers, footer, archivedContent].filter(
        Boolean,
      )
        .join("\n\n");
    }
  }
}
