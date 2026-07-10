import type { ReleaseFlow } from "../constants/release-flows.ts";
import type {
  OperationKind,
  OperationOutcome,
} from "../constants/operation-variables.ts";
import type { InputsOutput } from "../schemas/inputs/inputs.ts";

export type OperationVariables =
  // spread inputs without token and sourceMode...
  & Omit<InputsOutput, "token" | "sourceMode">
  & {
    // Base operation variables
    sourceMode: string;
    internalSourceMode: string;

    parsedTriggerCommit: string;
    parsedTriggerCommitList: string;

    workingBranchName: string;
    workingBranchRef: string;
    workingBranchHash: string;

    releaseFlow: ReleaseFlow;
    operation: OperationKind;
    /** Stringified OperationJobs[] */
    jobs: string;

    startTime: string;

    // versioning and changelog
    resolvedCommitEntries: string;

    currentVersion: string;
    nextVersion: string;

    commitHash: string;
    committedFilePaths: string;

    tagHash: string;
    releaseId?: string | number;
    releaseUploadUrl?: string;

    outcome: OperationOutcome;

    // Dynamic operation variables
    config: string;
    internalConfig: string;

    patternContext: string;
    proposalId?: string;
  };

export type BaseOperationVariables = Pick<
  OperationVariables,
  | keyof Omit<InputsOutput, "token" | "sourceMode">
  | "sourceMode"
  | "internalSourceMode"
  | "parsedTriggerCommit"
  | "parsedTriggerCommitList"
  | "workingBranchName"
  | "workingBranchRef"
  | "workingBranchHash"
  | "releaseFlow"
  | "operation"
  | "jobs"
  | "startTime"
>;

export type DynamicOperationVariables = Pick<
  OperationVariables,
  | "config"
  | "internalConfig"
  | "patternContext"
  | "proposalId"
>;

export type PreCalculateVersionVariables = Pick<
  OperationVariables,
  "resolvedCommitEntries"
>;

export type PostCalculateVersionVariables = Pick<
  OperationVariables,
  "currentVersion" | "nextVersion"
>;

export type PreCommitVariables = Pick<
  OperationVariables,
  "committedFilePaths"
>;

export type PostCommitVariables = Pick<
  OperationVariables,
  "commitHash"
>;

export type PostProposalVariables = Pick<
  OperationVariables,
  "proposalId" | "jobs"
>;

export type PreTagVariables = Pick<
  OperationVariables,
  "nextVersion"
>;

export type PreReleaseVariables = Pick<
  OperationVariables,
  "tagHash"
>;

export type PostReleaseVariables = Pick<
  OperationVariables,
  "releaseId" | "releaseUploadUrl"
>;

export type FinalOperationVariables = Pick<OperationVariables, "outcome">;

// --- Workspace-aware variables ---

export interface WorkspaceVariableData {
  /** Sanitized workspace name */
  name: string;
  /** Formatted next version (e.g. "1.2.3") */
  nextVersion: string;
  /** Resolved tag name (e.g. "core-v1.2.3") */
  tagName: string;
  /** Relative path from repo root */
  path: string;
}

/**
 * Variables exported once per operation for workspace summary.
 * In monorepo mode, these give downstream consumers a structured view
 * of all workspaces and their resolved versions.
 */
export interface WorkspaceSummaryVariables {
  /** "true" in monorepo mode, "false" otherwise */
  isMonorepo: string;
  /** Current workspace name (set during per-workspace phases) */
  name: string;
  /** JSON array of all workspace variable data */
  workspaces: string;
  /** JSON array of affected workspace names */
  affectedWorkspaces: string;
}
