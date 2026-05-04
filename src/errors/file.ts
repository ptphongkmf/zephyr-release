export class FileNotFoundError extends Error {
  public override readonly name = "FileNotFoundError";

  constructor(message = "File not found", opts?: ErrorOptions) {
    super(message, opts);
  }
}
