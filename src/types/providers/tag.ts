export interface ProviderTag {
  /**
   * The name of the tag (e.g., 'v1.0.0').
   */
  name: string;

  /**
   * The Git SHA-1 hash of the newly created tag object.
   * Note: For annotated tags, this is different from the commit hash.
   */
  hash: string;

  /**
   * The Git SHA-1 hash of the commit this tag points to.
   */
  targetHash: string;
}

export interface ProviderMatchedTag {
  tagName: string;
  hash: string;
}
