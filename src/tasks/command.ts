import { spawn } from "node:child_process";
import process from "node:process";
import { taskLogger } from "./logger.ts";
import type {
  CommandHookKind,
  CommandHooksOutput,
} from "../schemas/configs/modules/components/command-hook.ts";
import { failedNonCriticalTasks } from "../main.ts";

/** @throws if `continueOnError` is false and command fails */
export async function runCommands(
  commandHooks: CommandHooksOutput | undefined,
  kind: CommandHookKind,
): Promise<string | undefined> {
  const commands = commandHooks?.[kind];
  if (!commands || commands.length === 0) return undefined;
  if (!commands.some((cmd) => Boolean(cmd.cmd))) {
    return undefined;
  }

  const baseTimeout = commandHooks.timeout;
  const baseContinueOnError = commandHooks.continueOnError;

  let succeedCount = 0;
  let skippedCount = 0;
  const failedCommands: string[] = [];

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
      await runChildProcess(cmdStr, timeout);
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

  return `${succeedCount} cmd succeed, ${skippedCount} cmd skipped, ${failedCommands.length} cmd failed${
    failedCommands.length > 0 ? ` (${failedCommands.join(", ")})` : ""
  }`;
}

/** @throws */
async function runChildProcess(
  cmd: string,
  timeout: number,
) {
  await new Promise<void>((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const shellArgs = isWindows ? ["/d", "/s", "/c"] : ["-c"];

    const child = spawn(shell, [...shellArgs, cmd], {
      stdio: "inherit",
      shell: false,
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
        resolve();
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
