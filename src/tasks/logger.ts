import process from "node:process";
import type {
  CoreLogger,
  DebugLogger,
  IndentLogger,
  Logger,
} from "../types/logger.ts";
import {
  formatDebugMessage,
  formatDebugStepMessage,
  formatHeaderMessage,
  formatIndentedMessage,
  formatNoticeMessage,
  formatStepMessage,
  formatWarnMessage,
} from "../utils/formatters/log.ts";

let activeCoreLogger: CoreLogger;

const defaultCoreLogger: CoreLogger = {
  info: (message: string) => console.log(message),

  startGroup: (name: string) => console.group(name),
  endGroup: () => console.groupEnd(),

  debug: (message: string) => console.debug(message),
  isDebugEnabled: () => process.env.DEBUG?.toLowerCase() === "true",

  notice: (message: string) => console.info(message),

  warn: (message: string) => console.warn(message),

  setFailed: (message: string | Error) => {
    const msg = message instanceof Error ? message.message : message;
    console.log(msg);
    process.exitCode = 1;
  },
};

const debugLogger: DebugLogger = {
  info: (message: string) => {
    activeCoreLogger.info(formatDebugMessage(message));
  },

  startGroup: (name: string) => {
    activeCoreLogger.startGroup(formatDebugMessage(name));
  },
  endGroup: () => activeCoreLogger.endGroup(),
};

const indentDebugLogger: DebugLogger = {
  info: (message: string) => {
    activeCoreLogger.info(
      formatDebugMessage(formatIndentedMessage(message)),
    );
  },

  startGroup: (name: string) => {
    activeCoreLogger.startGroup(
      formatDebugMessage(formatIndentedMessage(name)),
    );
  },
  endGroup: () => activeCoreLogger.endGroup(),
};

const indentLogger: IndentLogger = {
  info: (message: string) =>
    activeCoreLogger.info(formatIndentedMessage(message)),

  startGroup: (name: string) =>
    activeCoreLogger.startGroup(formatIndentedMessage(name)),
  endGroup: () => activeCoreLogger.endGroup(),

  debug: (message: string) =>
    activeCoreLogger.debug(
      formatDebugMessage(formatIndentedMessage(message)),
    ),
  debugWrap: (fn: (debugLogger: DebugLogger) => void) => {
    if (isDebugEnabled()) fn(indentDebugLogger);
  },

  notice: (message: string) =>
    activeCoreLogger.notice(
      formatNoticeMessage(formatIndentedMessage(message)),
    ),

  warn: (message: string) =>
    activeCoreLogger.warn(
      formatWarnMessage(formatIndentedMessage(message)),
    ),
};

activeCoreLogger = defaultCoreLogger;

export const logger: Logger = {
  info: (message: string) => activeCoreLogger.info(message),

  title: (message: string) =>
    activeCoreLogger.info(formatHeaderMessage(message, { padChar: "=" })),
  heading: (message: string) =>
    activeCoreLogger.info(formatHeaderMessage(message, { padChar: "-" })),
  subHeading: (message: string) =>
    activeCoreLogger.info(formatHeaderMessage(message, { padChar: "~" })),

  step: (message: string) => activeCoreLogger.info(formatStepMessage(message)),
  stepStart: (message: string) =>
    activeCoreLogger.info(formatStepMessage(message, "start")),
  stepFinish: (message: string) =>
    activeCoreLogger.info(formatStepMessage(message, "finish")),
  stepSkip: (message: string) =>
    activeCoreLogger.info(formatStepMessage(message, "skip")),

  startGroup: (name: string) => activeCoreLogger.startGroup(name),
  endGroup: () => activeCoreLogger.endGroup(),

  debug: (message: string) =>
    activeCoreLogger.debug(formatDebugMessage(message)),
  debugStepStart: (message: string) =>
    activeCoreLogger.debug(formatDebugStepMessage(message, "start")),
  debugStepFinish: (message: string) =>
    activeCoreLogger.debug(formatDebugStepMessage(message, "finish")),
  debugStepSkip: (message: string) =>
    activeCoreLogger.debug(formatDebugStepMessage(message, "skip")),
  debugWrap: (fn: (debugLogger: DebugLogger) => void) => {
    if (isDebugEnabled()) fn(debugLogger);
  },

  notice: (message: string) =>
    activeCoreLogger.notice(formatNoticeMessage(message)),

  warn: (message: string) => activeCoreLogger.warn(formatWarnMessage(message)),

  setFailed: (message: string | Error) => activeCoreLogger.setFailed(message),

  indent: indentLogger,
};

/**
 * Shorthand for `logger.indent`. Use for logging in task processes.
 */
export const taskLogger = logger.indent;

export function setLogger(providedLogger: CoreLogger) {
  activeCoreLogger = providedLogger;
}

function isDebugEnabled(): boolean {
  return (
    activeCoreLogger.isDebugEnabled?.() ??
      process.env.DEBUG?.toLowerCase() === "true"
  );
}
