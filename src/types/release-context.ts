/**
 * Per-workspace release data used in template contexts (e.g. `{{ releases }}`).
 * Each entry describes one workspace (or the single root repo in single-repo mode).
 *
 * Populated during the workspace loop in review.prepare / review.publish / auto workflows.
 */
export interface ReleaseContextEntry {
  name: string;
  nextVersion: string;
  tagName: string;
  title: string;
  changelogRelease?: string;
  memberHeader?: string;
  memberBody?: string;
  memberFooter?: string;
  memberBlock?: string;
}
