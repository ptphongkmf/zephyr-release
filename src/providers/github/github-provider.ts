import { githubLogger } from "./logger.ts";
import { githubGetRawInputs } from "./inputs.ts";
import { makeGithubGetTextFile } from "./file.ts";
import {
  makeGithubAddAssigneesToPr,
  makeGithubAddReviewersToPr,
  makeGithubCreatePullRequest,
  makeGithubFindMergedProposalPrByCommit,
  makeGithubFindOpenProposalPr,
  makeGithubUpdatePullRequest,
} from "./pull-request.ts";
import {
  githubGetCommitPathPart,
  githubGetHost,
  githubGetNamespace,
  githubGetReferencePathPart,
  githubGetRepositoryName,
} from "./repository.ts";
import type { PlatformProvider } from "../../types/providers/platform-provider.ts";
import { githubSetEnv, githubSetOutput } from "./export.ts";
import { makeGithubEnsureBranchExist } from "./branch.ts";
import {
  makeGithubCompareCommits,
  makeGithubCreateCommitOnBranch,
  makeGithubGetCommit,
  makeGithubListCommitsInRange,
} from "./commit.ts";
import { githubGetConventionalCommitParserOptions } from "./conventional-commit.ts";
import {
  githubGetCompareTagUrl,
  makeGithubCreateTag,
  makeGithubFindLastReleaseTag,
  makeGithubGetCompareTagUrlFromCurrentToLatest,
} from "./tag.ts";
import { getOctokitClient, type OctokitClient } from "./octokit.ts";
import { githubGetOperationTriggerContext } from "./operation.ts";
import {
  makeGithubAddLabelsToPullRequest,
  makeGithubRemoveLabelsFromPullRequest,
} from "./label.ts";
import {
  makeGithubAttachReleaseAsset,
  makeGithubCreateRelease,
} from "./release.ts";
import { githubGetReferenceUrl } from "./reference.ts";

export function createGitHubProvider(): PlatformProvider {
  // Private state variables held in the closure
  let _octokit: OctokitClient | undefined;

  function getOctokit() {
    if (!_octokit) {
      throw new Error(
        "Provider context 'octokit' not initialized. Ensure 'setupProviderContext' is called first",
      );
    }

    return _octokit;
  }

  return {
    platform: "github",

    logger: githubLogger,

    getRawInputs: githubGetRawInputs,
    setupProviderContext: (validatedInputs) => {
      _octokit = getOctokitClient(validatedInputs.token);
    },

    getHost: githubGetHost,
    getNamespace: githubGetNamespace,
    getRepositoryName: githubGetRepositoryName,
    getCommitPathPart: githubGetCommitPathPart,
    getReferencePathPart: githubGetReferencePathPart,
    getOperationTriggerContext: githubGetOperationTriggerContext,

    getReferenceUrl: githubGetReferenceUrl,
    getCompareTagUrl: githubGetCompareTagUrl,
    getCompareTagUrlFromCurrentToLatest:
      makeGithubGetCompareTagUrlFromCurrentToLatest(getOctokit),

    getTextFile: makeGithubGetTextFile(getOctokit),

    ensureBranchExist: makeGithubEnsureBranchExist(getOctokit),

    findMergedProposalByCommit: makeGithubFindMergedProposalPrByCommit(
      getOctokit,
    ),

    findOpenProposal: makeGithubFindOpenProposalPr(
      getOctokit,
    ),

    listCommitsInRange: makeGithubListCommitsInRange(getOctokit),
    compareCommits: makeGithubCompareCommits(getOctokit),
    getCommit: makeGithubGetCommit(getOctokit),
    createCommitOnBranch: makeGithubCreateCommitOnBranch(
      getOctokit,
    ),

    createProposal: makeGithubCreatePullRequest(getOctokit),
    updateProposal: makeGithubUpdatePullRequest(getOctokit),

    addLabelsToProposal: makeGithubAddLabelsToPullRequest(
      getOctokit,
    ),
    removeLabelsFromProposal: makeGithubRemoveLabelsFromPullRequest(
      getOctokit,
    ),

    addAssigneesToProposal: makeGithubAddAssigneesToPr(
      getOctokit,
    ),
    addReviewersToProposal: makeGithubAddReviewersToPr(
      getOctokit,
    ),

    findLastReleaseTag: makeGithubFindLastReleaseTag(getOctokit),
    createTag: makeGithubCreateTag(getOctokit),

    createRelease: makeGithubCreateRelease(getOctokit),
    attachReleaseAsset: makeGithubAttachReleaseAsset(getOctokit),

    setOutput: githubSetOutput,
    setEnv: githubSetEnv,

    getConventionalCommitParserOptions:
      githubGetConventionalCommitParserOptions,
  };
}
