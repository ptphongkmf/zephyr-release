import type { ParserOptions } from "conventional-commits-parser";
import type { ProviderBranch } from "./branch.ts";
import type {
  ProviderAssetParams,
  ProviderRelease,
  ProviderReleaseOptions,
} from "./release.ts";
import type { ProviderInputLabel, ProviderLabel } from "./label.ts";
import type { CoreLogger } from "../logger.ts";
import type {
  ProviderCommit,
  ProviderCompareCommits,
} from "./commit.ts";
import type { ProviderInputs } from "./inputs.ts";
import type { ProviderAddedAssignees, ProviderProposal } from "./proposal.ts";
import type { ProviderOperationTriggerContext } from "./provider-operation-context.ts";
import type { InputsOutput } from "../../schemas/inputs/inputs.ts";
import type { ProviderTag } from "./tag.ts";
import type { TaggerRequest } from "../tag.ts";
import type { TagTypeOption } from "../../constants/release-tag-options.ts";

export interface PlatformProvider {
  platform: "github" | ""; // gitlab? local?

  logger: CoreLogger;

  getRawInputs: () => ProviderInputs;
  setupProviderContext: (validatedInputs: InputsOutput) => void;

  getHost: () => string;
  getNamespace: () => string;
  getRepositoryName: () => string;
  getCommitPathPart: () => string;
  getReferencePathPart: () => string;
  /** @throws */
  getOperationTriggerContext: () => ProviderOperationTriggerContext;

  getReferenceUrl: (ref: string) => string;
  getCompareTagUrl: (tag1: string, tag2: string) => string;
  getCompareTagUrlFromCurrentToLatest: (
    currentTag: string,
    skip?: number,
  ) => Promise<string>;

  /** @throws */
  getTextFile: (filePath: string, ref?: string) => Promise<string>;

  /** @throws */
  ensureBranchExist: (
    branchName: string,
    commitHash: string,
  ) => Promise<ProviderBranch>;

  /** @throws */
  findMergedProposalByCommit: (
    commitHash: string,
    sourceBranch: string,
    targetBranch: string,
  ) => Promise<ProviderProposal | undefined>;

  /** @throws */
  findOpenProposal: (
    sourceBranch: string,
    targetBranch: string,
  ) => Promise<ProviderProposal | undefined>;

  /** @throws {Error | NoCommitFoundError} */
  listCommitsFromGivenToLastRelease: (
    commitHash: string,
    maxCommitsToResolve: number,
    resolveUntilCommitHash?: string,
  ) => Promise<ProviderCommit[]>;
  /** @throws */
  compareCommits: (
    base: string,
    head: string,
  ) => Promise<ProviderCompareCommits>;
  /** @throws */
  getCommit: (hash: string) => Promise<ProviderCommit>;
  /** @throws */
  createCommitOnBranch: (
    triggerCommitHash: string,
    baseTreeHash: string,
    changesToCommit: Map<string, string | null>,
    message: string,
    targetBranchName: string,
    force?: boolean,
  ) => Promise<ProviderCommit>;

  /** @throws */
  createProposal: (
    sourceBranch: string,
    targetBranch: string,
    title: string,
    body: string,
    opts?: { draft?: boolean },
  ) => Promise<ProviderProposal>;
  /** @throws */
  updateProposal: (
    id: string,
    title: string,
    body: string,
  ) => Promise<ProviderProposal>;

  /** @throws */
  addLabelsToProposal: (
    proposalId: string,
    labels: ProviderInputLabel[],
  ) => Promise<ProviderLabel[]>;
  /** @throws */
  removeLabelsFromProposal: (
    proposalId: string,
    labels: string[],
  ) => Promise<string[]>;

  /** @throws */
  addAssigneesToProposal: (
    proposalId: string,
    assignees: string[],
  ) => Promise<ProviderAddedAssignees[]>;
  /** @throws */
  addReviewersToProposal: (
    proposalId: string,
    reviewers: string[],
  ) => Promise<void>;

  /** @throws */
  getLatestReleaseTag: () => Promise<string | undefined>;
  /** @throws */
  createTag: (
    tagName: string,
    commitHash: string,
    tagType: TagTypeOption,
    message: string,
    tagger?: TaggerRequest,
  ) => Promise<ProviderTag>;

  /** @throws */
  createRelease: (
    tagName: string,
    title: string,
    body: string,
    options: ProviderReleaseOptions,
  ) => Promise<ProviderRelease>;
  /** @throws */
  attachReleaseAsset: (
    releaseId: string,
    asset: ProviderAssetParams,
  ) => Promise<void>;

  setOutput: (k: string, v: string | number | null | undefined) => void;
  setEnv: (k: string, v: string | number | null | undefined) => void;

  getConventionalCommitParserOptions: () => ParserOptions;
}
