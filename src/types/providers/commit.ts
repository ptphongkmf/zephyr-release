export interface ProviderCommit {
  hash: string;
  header: string;
  body: string;

  /**
   * Full commit message (header + body)
   */
  message: string;

  /**
   * Tree hash associated with this commit.
   */
  treeHash: string;

  author: { name: string; email: string; date: Temporal.Instant };
  committer: { name: string; email: string; date: Temporal.Instant };
}

export interface ProviderCompareCommits {
  commits: { message: string }[];
  totalCommits: number;
}
