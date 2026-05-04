export class BranchOutOfDateError extends Error {
  public override readonly name = "BranchOutOfDateError";

  constructor(
    message =
      "Failed to update branch because it is out of date. The branch has moved forward",
    opts?: ErrorOptions,
  ) {
    super(message, opts);
  }
}
