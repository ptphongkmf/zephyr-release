export class NoCommitFoundError extends Error {
  public override readonly name = "NoCommitFoundError";

  constructor(message = "No commit found", opts?: ErrorOptions) {
    super(message, opts);
  }
}
