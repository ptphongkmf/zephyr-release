# Phase 3 Spec: Grouped PR Body with Per-Workspace Member Templates

## Problem Statement

In monorepo mode, the release proposal (PR/MR) body contains changelog content from all workspaces concatenated without structure. There is no way to distinguish which changelog entries belong to which workspace, and no mechanism to add workspace-specific content to the proposal body (PR-only or release-scoped). The PR body is also used as a data transport layer — content between `PROPOSAL-CHANGELOG-RELEASE-START/END` markers is extracted on publish and used as changelog source for each workspace's GitHub Release. The current single-marker approach feeds the same extracted string to every workspace, which is incorrect for monorepo.

Additionally, the default `bodyTemplate` of `{{ changelogRelease }}` is a flat single-workspace pattern that has no meaningful equivalent for monorepo mode, so users cannot write one default body template that works across both single and monorepo setups.

## Solution

Introduce a structured per-workspace "member block" system for the proposal body:

1. **`format_proposal_body` transformer** — a new Liquid filter that takes the `releases[]` array and assembles the full PR body. In single-repo, it outputs the body with markers for that single workspace. In monorepo, it outputs one labelled block per workspace (title heading, per-workspace member header/body/footer, each body wrapped in named per-workspace markers). The default root `bodyTemplate` becomes `{{ releases | format_proposal_body }}`.

2. **Per-workspace member templates** — three optional new fields in `WorkspaceMemberConfig.review`: `memberHeaderTemplate` / `memberHeaderTemplatePath`, `memberBodyTemplate` / `memberBodyTemplatePath`, and `memberFooterTemplate` / `memberFooterTemplatePath`. Header and footer are PR-only (outside per-workspace markers). Body is release-scoped (inside per-workspace markers, extracted on publish).

3. **Per-workspace named markers** — change from a single global `<!-- PROPOSAL-CHANGELOG-RELEASE-START -->` to per-workspace markers keyed by `tagName`: `<!-- PROPOSAL-CHANGELOG-RELEASE-START:{tagName} -->`. The application code (workspace loop) is solely responsible for placing markers around each member body — no user template machinery involved.

4. **Global boundary markers preserved** — the root no-name `<!-- PROPOSAL-CHANGELOG-RELEASE-START -->` / `<!-- PROPOSAL-CHANGELOG-RELEASE-END -->` wrapping the entire resolved body is kept. This allows external tools (Slack/Discord integrations, GitHub Actions, scripts) to trivially extract the entire Zephyr-managed changelog zone from the PR body without parsing per-workspace markers.

5. **`extractChangelogFromProposal` returns a map** — changed from returning `string | undefined` to `Map<string, string>`, where keys are `tagName` strings. On publish, each workspace looks up its own extracted body by exact `tagName` match, falling back to `tag.matchPatterns` if no exact match is found. This fixes an existing bug where the same extracted string was fed to every workspace.

6. **`title` field on workspace member config** — a new optional `title` field in `WorkspaceMemberConfig`. When set, overrides the workspace `name` as the section heading in the PR body. Defaults to `name` if omitted.

## User Stories

1. As a monorepo maintainer, I want the release PR body to group changelog entries by workspace, so that reviewers can immediately see which changes belong to which package.

2. As a monorepo maintainer, I want the workspace section headings to use my workspace names by default, so that the PR body is meaningful without any configuration.

3. As a monorepo maintainer, I want to set a custom `title` for a workspace (e.g. `"Core Library"` instead of `"core"`), so that the PR body headings are human-readable without changing the workspace's technical `name` field.

4. As a user of single-repo mode, I want the default `bodyTemplate` to continue working exactly as before, so that upgrading to this version does not break my existing setup.

5. As a monorepo maintainer, I want to add per-workspace content before the changelog in the PR body (a "member header"), so that I can write reviewer instructions or context specific to one package directly in the PR.

6. As a monorepo maintainer, I want per-workspace header and footer content to appear in the PR but NOT in the GitHub Release notes, so that I can include reviewer-only instructions without polluting the release page.

7. As a monorepo maintainer, I want to customise the body content that goes into a workspace's GitHub Release notes (the "member body"), so that I can append release-specific notes (like migration guides) to the release page for one specific package.

8. As a monorepo maintainer, I want the `memberBodyTemplate` for a workspace to have access to that workspace's `changelogRelease` and all other per-workspace patterns, so that I can reference the generated changelog in my custom member body.

9. As a developer building custom integrations, I want a simple way to extract the entire combined changelog from the merged PR body, so that I can feed it to a Slack bot or release announcement workflow without writing complex regex.

10. As a user who writes a custom root `bodyTemplate`, I want to iterate `releases[]` and access `r.block` (the fully assembled member block including markers) for each workspace, so that I get correct marker placement automatically even in a custom layout.

11. As a user who writes a custom root `bodyTemplate`, I want to access `r.memberHeader`, `r.memberBody`, and `r.memberFooter` separately in `releases[]`, so that I have granular control over the layout of each workspace section if needed.

12. As a user, I want access to `r.changelogRelease` in `releases[]`, so that I can use the raw changelog for a workspace in my custom template without markers.

13. As a user, I want access to `r.title` and `r.name` in `releases[]`, so that I can use the display heading and technical name for a workspace in my custom template.

14. As a monorepo maintainer, I want the GitHub Release for each workspace to extract only that workspace's changelog content, so that each package's release page shows only its own changes.

15. As a monorepo maintainer, I want the publish workflow to match a workspace's extracted changelog by tag name, with fallback to `tag.matchPatterns`, so that a workspace rename mid-release does not break the publish flow.

16. As a user, I want `memberHeaderTemplatePath`, `memberBodyTemplatePath`, and `memberFooterTemplatePath` variants for each member template field, so that I can store long templates as separate files.

17. As a user, I want the `memberHeaderTemplate` and friends to use the same source-mode path resolution as other template path fields, so that they work with local and remote source modes.

18. As a documentation reader, I want the `workspace-config-options.md` to document all new `review.*` member template fields for workspace config, so that I know how to configure per-workspace proposal body content.

19. As a documentation reader, I want `string-templates-and-patterns.md` to document `format_proposal_body` as a new Liquid filter and all new `releases[i].*` fields available in templates, so that I can write custom body templates confidently.

20. As a documentation reader, I want `config-options.md` to document that the root `review.bodyTemplate` default has changed to `{{ releases | format_proposal_body }}`, so that I understand what the PR body will look like by default.

21. As a user, I want `memberBodyTemplate` for a workspace to default to `{{ changelogRelease }}` when not explicitly set, so that the workspace's release notes continue to work without any configuration change.

22. As a user who writes a fully custom `bodyTemplate` that does not use `releases[i].block`, I want the documentation to clearly warn me that automatic changelog extraction on publish will not work, so that I can configure `release.bodyTemplate` separately as an alternative.

## Implementation Decisions

### Architecture overview

The PR body assembly is split into two clear responsibilities:

- **Application code (workspace loop in `review.prepare.ts`)**: For each workspace, resolve `memberHeaderTemplate`, `memberBodyTemplate` (default: `{{ changelogRelease }}`), `memberFooterTemplate`. Wrap the resolved member body in per-workspace named markers. Assemble the full `block` (member header + marked body + member footer) and attach all fields to `ReleaseContextEntry`.

- **`format_proposal_body` Liquid filter**: Receives `releases[]` (now enriched with member fields). In single-repo (one entry), outputs `block` without a heading. In monorepo (multiple entries), outputs each `## {title}\n{block}` joined by blank lines. The filter has no marker logic of its own — markers are already embedded in `block`.

### General conventions

- **Schema and doc field order must match.** The order in which fields appear in a valibot schema object must exactly match the order of sections in the corresponding documentation file. When adding a new field, insert it at the same relative position in both the schema and the doc. This applies to `WorkspaceMemberConfigSchema` / `workspace-config-options.md`, `ReviewConfigPatchSchema` / the workspace review subsection, and any other schema/doc pair.

### Breaking changes

This is an intentionally breaking change. The old `bodyTemplate` / `bodyTemplatePath` fields on `ReviewConfigPatchSchema` (workspace-level) are replaced entirely. The default root `bodyTemplate` value changes. The `PROPOSAL_MARKERS` structure changes. `extractChangelogFromProposal` signature changes.

### Marker changes

**Before:**

```
<!-- PROPOSAL-CHANGELOG-RELEASE-START -->
{entire body content}
<!-- PROPOSAL-CHANGELOG-RELEASE-END -->
```

**After (conceptually):**

```
<!-- PROPOSAL-CHANGELOG-RELEASE-START -->
## Workspace A
{memberHeaderA}
<!-- PROPOSAL-CHANGELOG-RELEASE-START:tagNameA -->
{memberBodyA}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:tagNameA -->
{memberFooterA}

## Workspace B
...
<!-- PROPOSAL-CHANGELOG-RELEASE-END -->
```

The outer global markers are still placed by `createProposalContent` (unchanged from today). The inner per-workspace named markers (`:{tagName}`) are placed by the application code in the workspace loop, embedded in each entry's `block` field before the template is rendered.

The `PROPOSAL_MARKERS` constant keeps `bodyStart` and `bodyEnd` for the global markers. Two new fields are added as functions or constants for generating the named variant: `namedBodyStart(tagName)` and `namedBodyEnd(tagName)`.

### `ReleaseContextEntry` additions

New optional fields, with rationale for each:

```typescript
interface ReleaseContextEntry {
  name: string;
  nextVersion: string;
  tagName: string;
  // New:
  title?: string;            // (A) section heading in PR body
  changelogRelease?: string; // (B) raw changelog text, no markers
  memberHeader?: string;     // (C) resolved header string, PR-only
  memberBody?: string;       // (D) resolved body content, no markers
  memberFooter?: string;     // (E) resolved footer string, PR-only
  memberBlock?: string;      // (F) fully assembled section with named markers inside
}
```

**(A) `title`** — Needed by `format_proposal_body` to render `## {title}` headings in monorepo. Also available to custom template authors as `r.title`. Populated from `WorkspaceMemberConfig.title ?? name`.

**(B) `changelogRelease`** — Needed for two reasons: (1) it is the default input to `memberBodyTemplate` (i.e. when no custom body is configured, the resolved member body IS the changelog), so it must live on the entry so custom template authors can access `r.changelogRelease` for the raw changelog without markers. (2) Users writing fully custom root body templates may want to access the raw text directly (e.g. for summarisation or alternative formatting).

> **Note on `releases[i].changelogRelease` vs the flat `{{ changelogRelease }}` pattern:** These are NOT the same. The flat `{{ changelogRelease }}` pattern is workspace-loop-scoped — by the time the root `bodyTemplate` renders, it holds only the value of the last workspace processed. `releases[i].changelogRelease` is the correct way to access a specific workspace's changelog inside a `{% for r in releases %}` loop at root template level.

**(C) `memberHeader`** — Exposed so custom template authors who iterate `releases[]` manually can access the header text independently of `memberBlock`, e.g. to place it after the markers or intersperse other content.

**(D) `memberBody`** — Exposed as the explicit documented opt-out path. `r.memberBody` gives the body content without markers. Using this instead of `r.memberBlock` is the documented "I accept that publish extraction won't work" escape hatch.

**(E) `memberFooter`** — Same reasoning as `memberHeader`.

**(F) `memberBlock`** — The primary field. This is what `format_proposal_body` reads. It contains `memberHeader + named-marker-start + memberBody + named-marker-end + memberFooter`, assembled by the application code. Any user writing a custom root body template should use `r.memberBlock` to retain correct marker placement and therefore working publish extraction.

All new fields except `title` are only populated during `review.prepare.ts` (not on publish or other flows). `title` is also read by publish for display but is not used for extraction.

### `ReviewConfigPatchSchema` changes

Remove: `bodyTemplate`, `bodyTemplatePath`

Add:

- `memberHeaderTemplate` (optional string) — PR-only content before member body markers. Default: `""`.
- `memberHeaderTemplatePath` (optional string) — path variant.
- `memberBodyTemplate` (optional string) — release-scoped content inside member markers. Default: `{{ changelogRelease }}`.
- `memberBodyTemplatePath` (optional string) — path variant.
- `memberFooterTemplate` (optional string) — PR-only content after member body markers. Default: `""`.
- `memberFooterTemplatePath` (optional string) — path variant.

### `WorkspaceMemberConfigSchema` addition

Add optional `title` field (string) at the top-level workspace member config alongside `name`. This is a human-readable display string for use as a section heading in the PR body. If omitted, the value of `name` is used.

### Default template change

```typescript
// Before:
DEFAULT_PROPOSAL_BODY_TEMPLATE = `{{ changelogRelease }}`

// After:
DEFAULT_PROPOSAL_BODY_TEMPLATE = `{{ releases | format_proposal_body }}`
```

### `createProposalContent` changes

The function continues to wrap the resolved body with global markers:

```
PROPOSAL_MARKERS.bodyStart
+ resolved bodyTemplate (which now contains per-workspace named markers inside)
+ PROPOSAL_MARKERS.bodyEnd
```

No other changes to this function.

### `extractChangelogFromProposal` signature change

```typescript
// Before:
function extractChangelogFromProposal(proposal: ProviderProposal): string | undefined

// After:
function extractChangelogFromProposal(proposal: ProviderProposal): Map<string, string>
```

Implementation: scan the PR body for all `<!-- PROPOSAL-CHANGELOG-RELEASE-START:{tagName} -->` / `<!-- PROPOSAL-CHANGELOG-RELEASE-END:{tagName} -->` pairs using a regex. Return a `Map<tagName, extractedBody>`. If no named markers are found, return an empty map and log a warning.

### `review.publish.ts` changes

**Before:** A single `proposalChangelogRelease` string is fed to every workspace's `generatePublishChangelogReleaseContent`.

**After:** The returned map is used to look up each workspace's body individually. Lookup order: exact `tagName` match first, then iterate `tag.matchPatterns` to find a map key that matches the pattern. If nothing is found, fall back to empty string and log a warning.

### `format_proposal_body` filter registration

Registered in `transformers.ts`. Input validation: must receive an array of objects with at least `memberBlock` (string) and `title` (string). Single-entry array: output `memberBlock` only (no heading). Multi-entry array: output `## {title}\n\n{memberBlock}` per entry, joined by `\n\n`.

### Member template resolution order (workspace loop)

For each workspace after changelog is generated:

1. Resolve `memberBodyTemplate` (or read `memberBodyTemplatePath`) using `wsPatternContext`. Default: `{{ changelogRelease }}`.
2. Wrap result in named markers: `<!-- PROPOSAL-CHANGELOG-RELEASE-START:{tagName} -->\n{body}\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:{tagName} -->`.
3. Resolve `memberHeaderTemplate` (or path). Default: `""`.
4. Resolve `memberFooterTemplate` (or path). Default: `""`.
5. Assemble `block`: join non-empty parts with `\n\n`.
6. Store all fields on `ReleaseContextEntry`.

Member templates have access to all per-workspace patterns available at that point in the loop: `nextVersion`, `tagName`, `changelogRelease`, `changelogReleaseBody`, etc.

### `releaseEntries.push()` timing change

Currently, `releaseEntries.push()` happens at line ~223 in `review.prepare.ts`, BEFORE changelog generation. It must move to after the member template resolution step (after step 5 above) so that all new fields can be included.

**Safety check — nothing between the old and new push positions reads `releaseEntries`:**

Scanning the workspace loop body (lines 229–311) after the current push:

- `exportPostCalculateVersionVariables` — uses `patternContext`, not `releaseEntries` ✓
- `executeHookWithOverride` (`postCalculateVersion`) — uses `wsPatternContext`, not `releaseEntries` ✓
- `generatePrepareChangelogReleaseContent` — uses `resolvedCommitsResult`, not `releaseEntries` ✓
- `addChangelogPatternContext` — builds `wsPatternContext`, not `releaseEntries` ✓
- `prepareChangesToCommit` — uses `wsPatternContext`, not `releaseEntries` ✓
- `workspaceVersionDataMap.set()` — separate map, not `releaseEntries` ✓
- `patternContext = wsPatternContext` — context update, not `releaseEntries` ✓

The first consumer of `releaseEntries` is `exportWorkspaceSummaryVariables` (line ~314), which runs AFTER the loop. It only reads `name`, `nextVersion`, `tagName`, and `path` — all of which remain present. Moving push is safe.

## Testing Decisions

**What makes a good test:** Test only the externally observable behavior — the assembled PR body string structure (presence and order of markers, headings, member blocks), the return value of `extractChangelogFromProposal`, and the per-workspace changelog lookup in publish. Do not test implementation details like which internal function resolved a template.

**Modules to test:**

- `extractChangelogFromProposal` (unit): given PR body strings with various marker combinations, assert the returned map contains correct entries. Test: single-entry, multi-entry, missing markers, partial markers, fallback to `matchPatterns`.
- `format_proposal_body` filter (unit): given `releases[]` with various `block`/`title` combinations, assert correct output for single-entry and multi-entry arrays.
- `review.prepare.ts` workspace loop (integration, if existing integration tests exist): assert that `releaseEntries` entries have `block` populated and contain named markers keyed to `tagName`.

**Prior art:** Look at existing tests for `extractChangelogFromProposal` and `createProposalContent` for test shape and patterns. Look at tests for `format_releases` filter for how Liquid filter tests are structured.

## Out of Scope

- **Commit body grouping** — deferred to a later phase.
- **Root `headerTemplate`, `footerTemplate`, `titleTemplate`** — not touched; these are global PR-level templates with no per-workspace equivalent needed.
- **`release.bodyTemplate` changes** — not needed. `generatePublishChangelogReleaseContent` simply passes the extracted string through as `release` (which becomes `changelogRelease` in the pattern context), then `release.bodyTemplate = {{ changelogRelease }}` renders it. After Phase F supplies each workspace with its own correctly-scoped extracted string, this already works correctly end-to-end without any change to `release.bodyTemplate` or `changelog.ts`.
- **Re-running member templates on publish** — member templates are resolved during prepare. On publish, the already-resolved content is extracted from the PR body markers. There is nothing to re-run.

## Further Notes

- The `title` field on `WorkspaceMemberConfig` is a display-only field. It does not affect tag names, env vars, branch names, or any other computed value — only the heading in the PR body.
- The `block` field in `ReleaseContextEntry` is the recommended way to reference a workspace's content in a custom root `bodyTemplate`. Using `r.memberBody` directly bypasses markers and is explicitly documented as "opt-out of automatic changelog extraction."
- The global markers (`<!-- PROPOSAL-CHANGELOG-RELEASE-START -->` / `END`) are kept because they provide a trivial extraction boundary for third-party integrations (Slack bots, announcement GitHub Actions) that want the entire Zephyr changelog zone without parsing per-workspace named markers.
- The `tag.matchPatterns` fallback in `extractChangelogFromProposal` is a publish-time concern only. During prepare, the exact `tagName` is always known and is used directly as the marker key.

---

## Implementation Phases

Each phase is self-contained and can be executed independently. After each schema/logic phase, the corresponding doc update phase immediately follows.

---

### Phase A — Schema: `WorkspaceMemberConfig.title` + `ReviewConfigPatchSchema` member fields

**Files to change:**

- `src/schemas/configs/workspace-member-config.ts` — add optional `title` field alongside `name`
- `src/schemas/configs/modules/review-config.ts` — remove `bodyTemplate`/`bodyTemplatePath` from `ReviewConfigPatchSchema`; add `memberHeaderTemplate`, `memberHeaderTemplatePath`, `memberBodyTemplate`, `memberBodyTemplatePath`, `memberFooterTemplate`, `memberFooterTemplatePath`

**Doc update (Phase A-docs):**

- `docs/workspace-config-options.md` — document `title` field and all six new `review.*` member template fields; remove old workspace-level `bodyTemplate`/`bodyTemplatePath` entries
- `docs/config-options.md` — note the removal of workspace-level `review.bodyTemplate` from the workspace patch schema

**Verification:** `deno task check`

---

### Phase B — Constants: Markers and default template

**Files to change:**

- `src/constants/markers.ts` — add `namedBodyStart(tagName: string)` and `namedBodyEnd(tagName: string)` helpers alongside existing `PROPOSAL_MARKERS`
- `src/constants/defaults/string-templates.ts` — change `DEFAULT_PROPOSAL_BODY_TEMPLATE` from `{{ changelogRelease }}` to `{{ releases | format_proposal_body }}`

**Doc update (Phase B-docs):**

- `docs/config-options.md` — update `review.bodyTemplate` default value in root config documentation

**Verification:** `deno task check`

---

### Phase C — `ReleaseContextEntry` additions

**Files to change:**

- `src/tasks/string-templates-and-patterns/pattern-context.ts` — add `title`, `changelogRelease`, `memberHeader`, `memberBody`, `memberFooter`, `block` optional fields to `ReleaseContextEntry`

**Doc update (Phase C-docs):**

- `docs/string-templates-and-patterns.md` — expand the `{{ releases }}` entry under Fixed String Patterns → Releases to document all new fields on each release object: `title`, `changelogRelease`, `memberHeader`, `memberBody`, `memberFooter`, `memberBlock`. For `changelogRelease`, add a callout note (new line, same bullet style) explicitly stating it is distinct from the flat `{{ changelogRelease }}` dynamic pattern — specifically that the flat pattern holds only the last workspace's value at root template render time, while `releases[i].changelogRelease` is the correct accessor inside a `{% for r in releases %}` loop.

**Verification:** `deno task check`

---

### Phase D — Workspace loop: member template resolution and `releaseEntries` population

**Files to change:**

- `src/workflows/review.prepare.ts`:
  - Move `releaseEntries.push()` to after changelog generation and member template resolution
  - After changelog context is built, resolve `memberBodyTemplate` (or path), wrap in named markers, resolve `memberHeaderTemplate` and `memberFooterTemplate` (or paths), assemble `memberBlock`
  - Push fully populated `ReleaseContextEntry` (with all new fields including `memberBlock`) to `releaseEntries`

**Verification:** `deno task check`

---

### Phase E — `format_proposal_body` transformer

**Files to change:**

- `src/tasks/string-templates-and-patterns/transformers.ts` — register `format_proposal_body` filter; validates input, handles single vs. multi-entry, outputs assembled string with headings

**Doc update (Phase E-docs):**

- `docs/string-templates-and-patterns.md` — document `format_proposal_body` filter: input shape, single-repo vs. monorepo behavior, example output

**Verification:** `deno task check`

---

### Phase F — `extractChangelogFromProposal` return type + `review.publish.ts` adaptation

**Files to change:**

- `src/tasks/proposal.ts` — change `extractChangelogFromProposal` to return `Map<string, string>`; implement regex scan for all named marker pairs
- `src/workflows/review.publish.ts` — adapt call site: use the returned map, look up per-workspace by exact `tagName`, fall back to `tag.matchPatterns`; remove old single-string usage

**Verification:** `deno task check`

---

### Phase G — Final doc pass

**Files to change:**

- `docs/export-variables.md` — verify nothing is affected; no new exported variables in this phase.

- `docs/string-templates-and-patterns.md`:

  - **Restructure the Pattern Details section.** The current `####`/`#####` heading hierarchy inside Pattern Details is over-engineered — it creates useless TOC anchors and the classification scheme (Fixed/Dynamic/Special) is inconsistent with what the words mean. Restructure as follows:

    - **Rename `Dynamic String Patterns` → `Run-Computed Patterns`.** The new description: *"These string patterns are computed during the run based on the release context (commits, versions, etc.) and may differ between runs."* Under the `now*` datetime group specifically, add a callout note: *"Unlike other run-computed patterns, these are live-evaluated on every access and may return a different value each time they are called within the same run."*

    - **Drop all `#####` sub-headings** inside `Fixed String Patterns` and `Run-Computed Patterns` (Base, Datetime, Current Version, Next Version, Releases, Changelog, Datetime (now)). Replace with `<br>` between groups. Lifecycle order within each section is preserved. The `####` top-level category headings (`Fixed String Patterns`, `Run-Computed Patterns`) are kept because they carry behavioral meaning, not just visual grouping.

    - **Rename `Special String Patterns` → `Template-Specific Patterns`.** Keep this as a `####` heading because it describes a fundamentally different access model — these patterns are not lifecycle-gated, they are access-gated (only resolvable inside a specific template type; using them elsewhere throws or returns undefined). The sub-headings within this section (`#####`) can also be flattened to bold labels + `<br>`.

  - **Fix `releases[i].changelogRelease` scope note** — added in Phase C-docs; confirm it clearly states the difference from the flat `{{ changelogRelease }}` pattern.
  - **Review all new `releases[i].*` docs added in Phase C-docs** for consistency with implemented field names and behavior.
  - **Confirm `format_proposal_body` doc added in Phase E-docs** is accurate.

- `docs/workspace-config-options.md` — review complete state for consistency, especially the new `review.*` member template fields and the `title` field.

- `docs/config-options.md` — verify the updated `review.bodyTemplate` default value entry is accurate.

**Verification:** Manual review of all four docs for accuracy and consistency with the implemented changes.

