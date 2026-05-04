export class SafeExit extends Error {
  public override readonly name = "SafeExit";

  constructor(message = "Safe exit", opts?: ErrorOptions) {
    super(message, opts);
  }
}
