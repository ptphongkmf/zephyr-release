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

// waiting for temporal support in node
//   author: { name: string; email: string; date: Temporal.Instant };
//   committer: { name: string; email: string; date: Temporal.Instant };
  author: { name: string; email: string; date: Date };
  committer: { name: string; email: string; date: Date };
}

export interface ProviderCompareCommits {
  commits: { message: string }[];
  totalCommits: number;
}
