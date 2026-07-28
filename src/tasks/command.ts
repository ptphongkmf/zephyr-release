import { spawn } from "node:child_process";
import process from "node:process";
import { taskLogger } from "./logger.ts";
import type {
  CommandHookKind,
  CommandHooksOutput,
} from "../schemas/configs/modules/components/command-hook.ts";
import { failedNonCriticalTasks } from "../main.ts";

export interface RunCommandsResult {
  /** Summary string (undefined if no commands ran) */
  summary: string | undefined;
  /** Combined stdout from all hook commands in this invocation */
  capturedStdout: string;
}

/**
 * Maximum size for the captured stdout buffer (10 MB).
 * Stdout beyond this limit is still streamed to the console but not buffered.
 * This prevents unbounded memory growth from verbose hook commands.
 */
const MAX_STDOUT_BUFFER_BYTES = 10 * 1024 * 1024;

/** @throws if `continueOnError` is false and command fails */
export async function runCommands(
  commandHooks: CommandHooksOutput | undefined,
  kind: CommandHookKind,
): Promise<RunCommandsResult> {
  const commands = commandHooks?.[kind];
  if (!commands || commands.length === 0) {
    return { summary: undefined, capturedStdout: "" };
  }
  if (!commands.some((cmd) => Boolean(cmd.cmd))) {
    return { summary: undefined, capturedStdout: "" };
  }

  const baseTimeout = commandHooks.timeout;
  const baseContinueOnError = commandHooks.continueOnError;

  let succeedCount = 0;
  let skippedCount = 0;
  const failedCommands: string[] = [];
  let capturedStdout = "";
  let stdoutBufferExceeded = false;

  taskLogger.startGroup("Commands log:");
  for (const cmd of commands) {
    // Check if command is empty/invalid (skipped)
    if (!cmd.cmd) {
      skippedCount++;
      continue;
    }

    const cmdStr = cmd.cmd;
    const timeout = cmd.timeout ?? baseTimeout;
    const continueOnError = cmd.continueOnError ?? baseContinueOnError;

    try {
      const stdout = await runChildProcess(cmdStr, timeout);

      // Guard: stop buffering if we exceed the memory limit
      if (!stdoutBufferExceeded) {
        if (capturedStdout.length + stdout.length > MAX_STDOUT_BUFFER_BYTES) {
          stdoutBufferExceeded = true;
          taskLogger.warn(
            `Stdout buffer limit (${MAX_STDOUT_BUFFER_BYTES / 1024 / 1024} MB) exceeded. ` +
              "Further stdout will not be captured for config override extraction.",
          );
        } else {
          capturedStdout += stdout;
        }
      }

      succeedCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (continueOnError) {
        taskLogger.info(message);
        failedNonCriticalTasks.push(message);

        failedCommands.push(cmdStr);
      } else {
        taskLogger.endGroup();
        throw new Error(
          `\`${runCommands.name}\` failed!`,
          { cause: error },
        );
      }
    }
  }
  taskLogger.endGroup();

  const summary =
    `${succeedCount} cmd succeed, ${skippedCount} cmd skipped, ${failedCommands.length} cmd failed${
      failedCommands.length > 0 ? ` (${failedCommands.join(", ")})` : ""
    }`;

  return { summary, capturedStdout };
}

/**
 * @throws
 * @returns captured stdout from the child process
 */
async function runChildProcess(
  cmd: string,
  timeout: number,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const shellArgs = isWindows ? ["/d", "/s", "/c"] : ["-c"];

    const child = spawn(shell, [...shellArgs, cmd], {
      // stdin=inherit, stdout=pipe (captured), stderr=inherit
      stdio: ["inherit", "pipe", "inherit"],
      shell: false,
    });

    let stdout = "";

    // Stream stdout to logger in real-time while also buffering
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      // Pass through to parent process stdout so user can see output in real-time
      process.stdout.write(chunk);
    });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");

      // Force kill after a short grace period
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 1000);

      reject(
        new Error(`Command timed out after ${timeout}ms: ${cmd}`),
      );
    }, timeout);

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `Command failed with code ${code ?? "unknown"}${
              signal ? ` (signal: ${signal})` : ""
            }: ${cmd}`,
          ),
        );
      }
    });
  });
}
