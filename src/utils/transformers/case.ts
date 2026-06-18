import { toKebabCase } from "@std/text";
import { toConstantCase } from "@std/text/unstable-to-constant-case";

export function toOutputKey(k: string): string {
  return "zr-" + toKebabCase(k);
}

export function toEnvKey(k: string): string {
  return "ZR_" + toConstantCase(k);
}

/**
 * Sanitize a workspace name for use in environment variable names.
 * Replaces any character that is not `[a-zA-Z0-9_]` with underscore.
 * Casing and structure are preserved ("least surprise").
 */
export function sanitizeNameForEnv(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Sanitize a workspace name for use in GitHub Actions output names.
 * Replaces any character that is not `[a-zA-Z0-9_-]` with underscore.
 * Casing and structure are preserved ("least surprise").
 */
export function sanitizeNameForOutput(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Workspace-specific env key: `ZR__<sanitized_name>__<CONSTANT_VAR>` */
export function toWorkspaceEnvKey(
  workspaceName: string,
  varName: string,
): string {
  return "ZR__" + sanitizeNameForEnv(workspaceName) + "__" +
    toConstantCase(varName);
}

/** Workspace-specific output key: `zr--<sanitized_name>--<kebab-var>` */
export function toWorkspaceOutputKey(
  workspaceName: string,
  varName: string,
): string {
  return "zr--" + sanitizeNameForOutput(workspaceName) + "--" +
    toKebabCase(varName);
}
