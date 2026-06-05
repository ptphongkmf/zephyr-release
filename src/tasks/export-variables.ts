import type { OperationTriggerContext } from "../types/operation-context.ts";
import type {
  BaseOperationVariables,
  DynamicOperationVariables,
  FinalOperationVariables,
  PostCalculateVersionVariables,
  PostCommitVariables,
  PostProposalVariables,
  PostReleaseVariables,
  PreCalculateVersionVariables,
  PreCommitVariables,
  PreReleaseVariables,
  PreTagVariables,
} from "../types/operation-variables.ts";
import type { PlatformProvider } from "../types/providers/platform-provider.ts";
import type { ProviderProposal } from "../types/providers/proposal.ts";
import { toEnvKey, toOutputKey } from "../utils/transformers/case.ts";
import { jsonValueNormalizer } from "../utils/transformers/json.ts";
import { format, type SemVer } from "@std/semver";
import type { WorkingBranchResult } from "./branch.ts";
import type { ResolvedCommit } from "./commit.ts";
import { taskLogger } from "./logger.ts";
import { startTime } from "../main.ts";
import {
  type OperationJob,
  type OperationKind,
  OperationKinds,
  type OperationOutcome,
} from "../constants/operation-variables.ts";
import type { ProviderInputs } from "../types/providers/inputs.ts";
import type { ConfigOutput } from "../schemas/configs/config.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";
import { stringifyPatternContext, type StringPatternContext } from "./string-templates-and-patterns/pattern-context.ts";

export async function exportBaseOperationVariables(
  provider: PlatformProvider,
  options: {
    triggerContext: OperationTriggerContext;
    workingBranchResult: WorkingBranchResult;
    proposalForCommit: ProviderProposal | undefined;
    proposalFromBranch: ProviderProposal | undefined;
    rawInputs: ProviderInputs;
    inputs: InputsOutput;
    rawConfig: object;
    config: ConfigOutput;
    patternContext: StringPatternContext;
  },
) {
  const {
    triggerContext,
    workingBranchResult,
    proposalForCommit,
    proposalFromBranch,
    rawInputs,
    inputs,
    rawConfig,
    config,
  } = options;

  let operationKind: OperationKind | undefined;
  switch (config.releaseFlow) {
    case "review":
      operationKind = proposalForCommit
        ? OperationKinds.release
        : OperationKinds.propose;

      break;

    case "auto":
      operationKind = OperationKinds.autorelease;

      break;
  }

  const operationJobs: OperationJob[] = [];
  switch (operationKind) {
    case "propose":
      if (proposalFromBranch) {
        operationJobs.push("update-proposal");
      } else {
        operationJobs.push("create-proposal");
      }

      break;

    case "release":
      if (config.tag.createTag) {
        operationJobs.push("create-tag");
      }

      if (config.tag.createTag && config.release.createRelease) {
        operationJobs.push("create-release");
      }

      break;

    case "autorelease":
      // Empty
      // For releaseFlow "auto", jobs are available at post commit phase

      break;
  }

  const { token: _t, sourceMode: _sm, ...excludedInputs } = inputs;

  const prepareExportObject = {
    ...excludedInputs,

    sourceMode: rawInputs.sourceMode ?? "",
    internalSourceMode: JSON.stringify(inputs.sourceMode),

    parsedTriggerCommit: JSON.stringify(
      triggerContext.latestTriggerCommit.parsedCommit,
    ),
    parsedTriggerCommitList: JSON.stringify(
      triggerContext.parsedTriggerCommits,
    ),

    workingBranchName: workingBranchResult.name,
    workingBranchRef: workingBranchResult.ref,
    workingBranchHash: workingBranchResult.object.sha,

    releaseFlow: config.releaseFlow,
    operation: operationKind,
    jobs: JSON.stringify(operationJobs),

    startTime: startTime.toISOString(),

    config: JSON.stringify(rawConfig, jsonValueNormalizer),
    internalConfig: JSON.stringify(config, jsonValueNormalizer),

    proposalId: operationKind === "propose"
      ? proposalFromBranch?.id
      : proposalForCommit?.id,
    patternContext: await stringifyPatternContext(options.patternContext),
  } satisfies BaseOperationVariables & DynamicOperationVariables;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Base operation variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(prepareExportObject, jsonValueNormalizer, 2));
    dLogger.endGroup();
  });

  Object.entries(prepareExportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPreCalculateVersionVariables(
  provider: PlatformProvider,
  resolvedCommitEntries: ResolvedCommit[],
  patternContext: StringPatternContext,
) {
  const exportObject = {
    resolvedCommitEntries: JSON.stringify(resolvedCommitEntries),

    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & PreCalculateVersionVariables
    & Pick<DynamicOperationVariables, "patternContext">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Pre calculate version variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPostCalculateVersionVariables(
  provider: PlatformProvider,
  currentVersion: SemVer | undefined,
  nextVersion: SemVer,
  patternContext: StringPatternContext,
) {
  const exportObject = {
    currentVersion: currentVersion ? format(currentVersion) : "",
    nextVersion: format(nextVersion),

    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & PostCalculateVersionVariables
    & Pick<DynamicOperationVariables, "patternContext">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Post calculate version variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPreCommitVariables(
  provider: PlatformProvider,
  changesData: Map<string, string | null>,
  patternContext: StringPatternContext,
) {
  const exportObject = {
    committedFilePaths: JSON.stringify([...changesData.keys()]),

    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & PreCommitVariables
    & Pick<DynamicOperationVariables, "patternContext">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Pre commit variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPostCommitVariables(
  provider: PlatformProvider,
  commitHash: string,
  patternContext: StringPatternContext,
) {
  const exportObject = {
    commitHash,

    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & PostCommitVariables
    & Pick<DynamicOperationVariables, "patternContext">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Post commit variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPostProposalVariables(
  provider: PlatformProvider,
  proposalId: string | undefined,
  releaseFlowRelatedData?: {
    config?: ConfigOutput;
  },
  patternContext?: StringPatternContext,
) {
  const { config } = releaseFlowRelatedData ?? {};

  const operationJobs: OperationJob[] = [];
  if (config) {
    operationJobs.push("create-commit");

    if (config.tag.createTag) {
      operationJobs.push("create-tag");
    }

    if (config.tag.createTag && config.release.createRelease) {
      operationJobs.push("create-release");
    }
  }

  const exportObject = {
    proposalId: proposalId,
    jobs: JSON.stringify(operationJobs),

    patternContext: patternContext ? await stringifyPatternContext(patternContext) : "",
  } satisfies
    & PostProposalVariables
    & Pick<DynamicOperationVariables, "proposalId" | "patternContext">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Post proposal variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPreTagVariables(
  provider: PlatformProvider,
  nextVersion: SemVer,
  patternContext: StringPatternContext,
  proposalId?: string,
) {
  const exportObject = {
    nextVersion: format(nextVersion),

    proposalId: proposalId,
    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & PreTagVariables
    & Pick<DynamicOperationVariables, "patternContext" | "proposalId">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Pre tag variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPreReleaseVariables(
  provider: PlatformProvider,
  tagHash: string,
  patternContext: StringPatternContext,
) {
  const exportObject = {
    tagHash,

    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & PreReleaseVariables
    & Pick<DynamicOperationVariables, "patternContext">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Pre release variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportPostReleaseVariables(
  provider: PlatformProvider,
  patternContext: StringPatternContext,
  releaseId?: string | number,
  releaseUploadUrl?: string,
) {
  const exportObject = {
    releaseId,
    releaseUploadUrl,

    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & PostReleaseVariables
    & Pick<DynamicOperationVariables, "patternContext">;

  taskLogger.debugWrap((dLogger) => {
    dLogger.startGroup(
      "Post release variables to export (internal key name):",
    );
    dLogger.info(JSON.stringify(exportObject, null, 2));
    dLogger.endGroup();
  });

  Object.entries(exportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}

export async function exportFinalOperationVariables(
  provider: PlatformProvider,
  outcome: OperationOutcome,
  patternContext: StringPatternContext,
) {
  const prepareExportObject = {
    outcome,

    patternContext: await stringifyPatternContext(patternContext),
  } satisfies
    & FinalOperationVariables
    & Pick<DynamicOperationVariables, "patternContext">;

  taskLogger.debug(
    "Final operation variables to export:\n" +
      JSON.stringify(prepareExportObject, null, 2),
  );

  Object.entries(prepareExportObject).forEach(([k, v]) => {
    provider.setOutput(toOutputKey(k), v);
    provider.setEnv(toEnvKey(k), v);
  });
}
