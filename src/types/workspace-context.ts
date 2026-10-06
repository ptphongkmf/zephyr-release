import type { ResolvedConfig } from "../schemas/configs/resolved-config.ts";

export interface ResolvedWorkspace {
  /** Relative path from repo root */
  path: string;
  /**
   * Fully merged config (root defaults + workspace overrides).
   * In single-repo mode, this is the root ConfigOutput passed through directly
   * (workspace-only fields like title are absent / undefined).
   * In monorepo mode, this is the deep-merged result validated through
   * ResolvedConfigSchema, which preserves workspace-specific fields.
   * ResolvedConfig is a superset of ConfigOutput, so all shared field types
   * remain compatible.
   */
  config: ResolvedConfig;
}
