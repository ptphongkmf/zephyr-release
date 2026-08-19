import { RequestError } from "@octokit/request-error";
import { BranchOutOfDateError } from "../../errors/providers/branch.ts";
import { NoCommitFoundError } from "../../errors/providers/commit.ts";
import type { GetOctokitFn, OctokitClient } from "./octokit.ts";
import { githubGetNamespace, githubGetRepositoryName } from "./repository.ts";
import type {
  ProviderCommit,
  ProviderCompareCommits,
} from "../../types/providers/commit.ts";

/** @throws */
async function githubListCommitsInRange(
  octokit: OctokitClient,
  fromHash: string,
  stopHash?: string,
  path?: string,
  maxCommits: number = 100,
): Promise<ProviderCommit[]> {
  const owner = githubGetNamespace();
  const repo = githubGetRepositoryName();

  const collectedCommits: ProviderCommit[] = [];

  const commitsIterator = octokit.paginate.iterator(
    octokit.rest.repos.listCommits,
    {
      owner,
      repo,
      sha: fromHash,
      path: path,
      per_page: 100,
    },
  );

  for await (const response of commitsIterator) {
    for (const commit of response.data) {
      if (stopHash && commit.sha === stopHash) {
        if (collectedCommits.length === 0) {
          throw new NoCommitFoundError(
            `No new commits found. The starting commit is already released.`,
          );
        }
        return collectedCommits;
      }

      collectedCommits.push({
        hash: commit.sha,
        header: commit.commit.message.split("\n")[0] ?? "",
        body: commit.commit.message.split("\n").slice(1).join("\n").trim(),
        message: commit.commit.message,
        treeHash: commit.commit.tree.sha,
        author: {
          name: commit.commit.author?.name ?? "",
          email: commit.commit.author?.email ?? "",
          date: new Date(commit.commit.author?.date ?? 0),
        },
        committer: {
          name: commit.commit.committer?.name ?? "",
          email: commit.commit.committer?.email ?? "",
          date: new Date(commit.commit.committer?.date ?? 0),
        },
      });

      if (collectedCommits.length >= maxCommits) {
        if (stopHash) {
          throw new Error(
            `Reached the maximum commit limit (${maxCommits}) before encountering the stop hash (${stopHash.substring(0, 7)}).`,
          );
        }
        return collectedCommits;
      }
    }
  }

  if (collectedCommits.length === 0) {
    throw new NoCommitFoundError(
      `No commits found for hash ${fromHash.substring(0, 7)}`,
    );
  }

  return collectedCommits;
}

/** @throws */
async function githubCompareCommits(
  octokit: OctokitClient,
  base: string,
  head: string,
): Promise<ProviderCompareCommits> {
  const res = await octokit.rest.repos.compareCommits({
    owner: githubGetNamespace(),
    repo: githubGetRepositoryName(),
    base,
    head,
  });

  return {
    commits: res.data.commits.map((c) => ({ message: c.commit.message })),
    totalCommits: res.data.total_commits,
  };
}

/** @throws */
async function githubCreateCommitOnBranch(
  octokit: OctokitClient,
  data: {
    triggerCommitHash: string;
    baseTreeHash: string;
    changesToCommit: Map<string, string | null>;
    message: string;
    targetBranchName: string;
    force?: boolean;
  },
): Promise<ProviderCommit> {
  const {
    triggerCommitHash,
    baseTreeHash,
    changesToCommit,
    message,
    targetBranchName,
    force,
  } = data;

  const owner = githubGetNamespace();
  const repo = githubGetRepositoryName();

  const newTreeItems = Array.from(changesToCommit, ([path, content]) => {
    if (content) {
      return {
        path,
        mode: "100644" as const,
        type: "blob" as const,
        content,
      };
    } else {
      return {
        path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: null,
      };
    }
  });

  const createTreeRes = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeHash,
    tree: newTreeItems,
  });

  // Explicitly linking to "parentSha" ensures the history is exactly what we expect
  const createCommitRes = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: createTreeRes.data.sha,
    parents: [triggerCommitHash],
  });

  // If true (in review release flow), we are effectively "overwriting" the branch history with this new timeline
  // If false (in auto release flow), throws error if there are newer commits
  try {
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${targetBranchName}`,
      sha: createCommitRes.data.sha,
      force,
    });
  } catch (error) {
    if (
      error instanceof RequestError &&
      error.status === 422 &&
      error.message.toLowerCase().includes("is not a fast forward")
    ) {
      throw new BranchOutOfDateError();
    }

    throw error;
  }

  return {
    hash: createCommitRes.data.sha,
    header: message.split("\n")[0] ?? "",
    body: message.split("\n").slice(1).join("\n").trim(),
    message,
    treeHash: createTreeRes.data.sha,
    author: {
      name: createCommitRes.data.author.name,
      email: createCommitRes.data.author.email,
      // waiting for temporal support in node
      //       date: safeParseTemporalInstant(createCommitRes.data.author.date) ??
      //         Temporal.Instant.fromEpochMilliseconds(0),
      date: new Date(createCommitRes.data.author.date),
    },
    committer: {
      name: createCommitRes.data.committer.name,
      email: createCommitRes.data.committer.email,
      // waiting for temporal support in node
      //       date: safeParseTemporalInstant(createCommitRes.data.committer.date) ??
      //         Temporal.Instant.fromEpochMilliseconds(0),
      date: new Date(createCommitRes.data.committer.date),
    },
  };
}

/** @throws */
async function githubGetCommit(
  octokit: OctokitClient,
  hash: string,
): Promise<ProviderCommit> {
  const res = await octokit.rest.git.getCommit({
    owner: githubGetNamespace(),
    repo: githubGetRepositoryName(),
    commit_sha: hash,
  });

  return {
    hash: res.data.sha,
    header: res.data.message.split("\n")[0] ?? "",
    body: res.data.message.split("\n").slice(1).join("\n").trim(),
    message: res.data.message,
    treeHash: res.data.tree.sha,

    author: {
      name: res.data.author.name,
      email: res.data.author.email,
      // waiting for temporal support in node
      //       date: safeParseTemporalInstant(res.data.author.date) ??
      //         Temporal.Instant.fromEpochMilliseconds(0),
      date: new Date(res.data.author.date),
    },
    committer: {
      name: res.data.committer.name,
      email: res.data.committer.email,
      // waiting for temporal support in node
      //       date: safeParseTemporalInstant(res.data.committer.date) ??
      //         Temporal.Instant.fromEpochMilliseconds(0),
      date: new Date(res.data.committer.date),
    },
  };
}

export function makeGithubListCommitsInRange(
  getOctokit: GetOctokitFn,
) {
  return (
    fromHash: string,
    stopHash?: string,
    path?: string,
    maxCommits?: number,
  ) =>
    githubListCommitsInRange(
      getOctokit(),
      fromHash,
      stopHash,
      path,
      maxCommits,
    );
}

export function makeGithubCompareCommits(getOctokit: GetOctokitFn) {
  return (base: string, head: string) =>
    githubCompareCommits(getOctokit(), base, head);
}

export function makeGithubCreateCommitOnBranch(
  getOctokit: GetOctokitFn,
) {
  return (
    triggerCommitHash: string,
    baseTreeHash: string,
    changesToCommit: Map<string, string | null>,
    message: string,
    targetBranchName: string,
    force?: boolean,
  ) =>
    githubCreateCommitOnBranch(getOctokit(), {
      triggerCommitHash,
      baseTreeHash,
      changesToCommit,
      message,
      targetBranchName,
      force,
    });
}

export function makeGithubGetCommit(getOctokit: GetOctokitFn) {
  return (hash: string) => githubGetCommit(getOctokit(), hash);
}
