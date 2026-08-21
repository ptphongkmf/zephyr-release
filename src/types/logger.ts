export interface CoreLogger {
  info: (message: string) => void;

  startGroup: (name: string) => void;
  endGroup: () => void;

  debug: (message: string) => void;
  isDebugEnabled?: () => boolean;

  notice: (message: string) => void;

  warn: (message: string) => void;

  setFailed: (message: string | Error) => void;
}

export interface Logger {
  info: (message: string) => void;

  title: (message: string) => void;
  heading: (message: string) => void;
  subHeading: (message: string) => void;

  step: (message: string) => void;
  stepStart: (message: string) => void;
  stepFinish: (message: string) => void;
  stepSkip: (message: string) => void;

  startGroup: (name: string) => void;
  endGroup: () => void;

  debug: (message: string) => void;
  debugStepStart: (message: string) => void;
  debugStepFinish: (message: string) => void;
  debugStepSkip: (message: string) => void;
  debugWrap: (fn: (debugLogger: DebugLogger) => void) => void;

  notice: (message: string) => void;

  warn: (message: string) => void;

  setFailed: (message: string | Error) => void;

  /**
   * A sub-logger that prefixes each line with `"  │ "` (supports multiline).
   *
   * Note: does NOT include `step()` or `setFailed()`.
   */
  indent: IndentLogger;
}

export type DebugLogger = Pick<Logger, "info" | "startGroup" | "endGroup">;

export type IndentLogger = Pick<
  Logger,
  "info" | "startGroup" | "endGroup" | "debug" | "debugWrap" | "notice" | "warn"
>;
