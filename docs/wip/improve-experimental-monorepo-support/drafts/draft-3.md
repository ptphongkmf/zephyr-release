# Draft 3: Design Discussion — Grouped PR Body

## Round 1 (Previous conversation)

**Your proposal:** Remove `bodyTemplate` / `bodyTemplatePath` from workspace-level config entirely. Introduce a `format_proposal_body` transformer at root level that produces correctly-grouped output for both single and monorepo mode — mirroring `format_releases`.

**Analysis findings:**
- The real root cause is that `changelogRelease` is workspace-scoped in the current pattern context. It's injected per-iteration and always overwrites the previous value, so there's no `releases[i].changelogRelease` accessible to a root template.
- Fix: add `changelogRelease` to `ReleaseContextEntry`, then the transformer can iterate `releases[]` and compose the body.
- Commit body deferred — empty default is fine, "affected commits list" is a separate feature.

---

## Round 2 — Should we keep workspace `sectionTemplate`?

### The question

You asked: if we keep a workspace-level `bodyTemplate` (or rename it `sectionTemplate`) and want a root default template that works for both single and monorepo, wouldn't the root template have to receive an array of body templates? Otherwise we can't have a single default that handles both modes.

### The argument for keeping it

The use case is: a user wants to customise the body *content* for one specific workspace. Example — the `api` package wants to append a migration guide after its changelog section. Without a workspace-level override, they'd have to write a root-level template that manually branches on workspace name, which is messy.

`sectionTemplate` solves this cleanly: each workspace defines what its section says, and the root template just arranges the sections.

### But here is where your concern is valid

If we keep `sectionTemplate` at the workspace level, the root template cannot resolve it directly. The `format_proposal_body` transformer runs during root template resolution, where the only thing available per entry in `releases[]` is what we already attached to `ReleaseContextEntry` — a string, not a template that still needs resolving.

So the flow would **have to be two-phase**:

1. **During the workspace loop** (before the root template runs): resolve each workspace's `sectionTemplate` using that workspace's `patternContext`, and attach the resolved string to its `ReleaseContextEntry` — call it `resolvedBody`.
2. **During root template rendering**: `format_proposal_body` reads `releases[i].resolvedBody` (if set) or falls back to `releases[i].changelogRelease`.

This means `sectionTemplate` is not a "template the root body template reads" — it's a template that gets pre-resolved *before* the root template even runs, and the result flows in through `releases[]`. The root `bodyTemplate = {{ releases | format_proposal_body }}` never touches `sectionTemplate` directly.

### Does `sectionTemplate` make sense in single-repo?

No. In single-repo there are no workspace overrides at all — the root config is the only config. `sectionTemplate` lives under `workspaces[*].review.sectionTemplate`, a path that doesn't exist in a single-repo setup. So it's implicitly a monorepo-only concept.

The transformer handles single-repo by checking `releases.length === 1` and skipping the section heading. The body content always comes from `releases[0].changelogRelease` in that case.

### Conclusion on naming

If we keep it, `sectionTemplate` is the right name for two reasons:
1. It's honest about the scope — it controls one *section* of the body, not the whole body.
2. It prevents confusion with root `bodyTemplate`, which controls the entire assembled body.

Using the same name `bodyTemplate` for both would imply they do the same thing, but they don't: root `bodyTemplate` is the full output template; workspace `bodyTemplate` would be a pre-resolved fragment injected into `releases[]`. That mismatch is a documentation trap.

### Counter-argument for removing it entirely

The two-phase resolution is extra complexity for a use case (custom per-workspace body content) that most users won't need. The transformer default (`changelogRelease`) already covers the common case well. Users who need truly custom per-workspace sections can still do it by placing a custom root `bodyTemplate` that branches manually:

```liquid
{% for r in releases %}
## {{ r.name }}

{{ r.changelogRelease }}

{% if r.name == "api" %}
### Migration Guide
...
{% endif %}
{% endfor %}
```

That's verbose but workable, and it keeps the config schema simpler.

### My position

Lean towards **removing workspace `sectionTemplate`** entirely. The two-phase pre-resolution adds implementation complexity, and the escape hatch is achievable at the root template level for anyone who needs it. The schema stays clean and the mental model is simple: one template at root, one transformer, everything works.

If you disagree and want the escape hatch, the rename to `sectionTemplate` is non-negotiable — same name as root would be wrong.

---

## Round 3 - User's actual goal: inject additional text without touching changelogRelease

The goal is clear: users should be able to write something like:

`liquid
{{ changelogRelease }}

### Migration Guide
This version renames Foo to Bar.
`

...in a per-workspace template, while changelogRelease itself stays clean (just the changelog entries generated by Zephyr). They don't want to touch the root bodyTemplate at all.

### Does this require altering existing logic?

Yes, but less than it sounds. Here is where things stand today in review.prepare.ts:

The workspace loop already does this, in order:
1. Calculate next version -> build wsPatternContext with version + tag patterns
2. Push to releaseEntries (current: just name, nextVersion, tagName)
3. Generate changelog -> call addChangelogPatternContext(wsPatternContext, ...)
4. Prepare file changes

After step 3, wsPatternContext.changelogRelease is fully populated for that workspace. This is exactly when we'd want to resolve a sectionTemplate.

### The minimal change required

Inside the workspace loop, after step 3, we add a conditional resolution step. We also move the releaseEntries.push() to after step 3 so we can include changelogRelease fields in the entry directly.

ReleaseContextEntry gains two new optional fields:
- changelogRelease (string, optional) - for the transformer's default fallback
- resolvedBody (string, optional) - pre-resolved sectionTemplate result, if the user set one

The format_proposal_body transformer reads: entry.resolvedBody ?? entry.changelogRelease ?? ""

That is the full scope of the change.

### Why it is not really two-phase complexity

The workspace loop is already a phase. We are just adding a small conditional step inside it that has always had all the necessary data available. changelogRelease is in wsPatternContext from step 3 onward, so resolving a sectionTemplate there is no different from resolving the tag name template or any other template in the loop.

### Updated recommendation

Keep sectionTemplate / sectionTemplatePath in ReviewConfigPatchSchema, renamed from bodyTemplate. The old bodyTemplate / bodyTemplatePath are removed from the workspace patch schema.

Workspace review ends up with:
- sectionTemplate - Liquid template for this workspace's body section. Has access to all per-workspace patterns including changelogRelease. Default: uses changelogRelease directly via the transformer fallback.
- sectionTemplatePath - path to a file containing the section template.

Root review.bodyTemplate stays unchanged. Its new default becomes {{ releases | format_proposal_body }}.

---

## Round 4 - The marker constraint changes the sectionTemplate picture

### The marker architecture

The body markers (ZEPHYR:BODY:START / ZEPHYR:BODY:END) are not purely cosmetic. On review.publish, extractChangelogFromProposal reads the merged PR body, extracts everything between the markers, and feeds it into generatePublishChangelogReleaseContent as the changelog source for each workspace's GitHub Release.

This means the body section is a data transport layer:

  PR body = [header - PR only]
             [MARKER_START]
             [body - this gets read back on publish and used for release notes]
             [MARKER_END]
             [footer - PR only]

Header and footer are purely decorative and PR-scoped. The body is release-scoped.

### The implication for sectionTemplate

If sectionTemplate content goes inside the markers, it flows to the GitHub Release page. If a user writes:

  {{ changelogRelease }}

  ### Migration Guide
  This version renames Foo to Bar.

...that Migration Guide will appear on the GitHub Release page, not just the PR. That may or may not be what they want.

If they want content that is PR-only (e.g. reviewer instructions, internal notes), they should use root headerTemplate or footerTemplate -- those are outside the markers.

### Does sectionTemplate still make sense?

Yes, but with a clear semantic: sectionTemplate = content that belongs in the release notes for this workspace. It is release-scoped by definition because it lives inside the markers. Users who want PR-only per-workspace content do not have a clean per-workspace escape hatch -- and that is probably fine. PR-only content is typically global (reviewer instructions, links) and belongs in root header/footer.

### Consequence for the design

No change to the plan. sectionTemplate stays, but documentation must be explicit:
- sectionTemplate content appears inside the body markers and will be included in the extracted changelog used for GitHub Releases.
- For PR-only content (not on the release page), use root headerTemplate or footerTemplate.

The two things users might want:
1. Custom release-scoped content per workspace → sectionTemplate
2. Custom PR-only content (global) → root header/footer

There is no case 3 (custom PR-only per workspace) that is architecturally clean to support.

---

## Round 5 — Per-workspace section header/footer to support PR-only content

### The ask

You want to support case 3 after all: custom per-workspace content that is PR-only. The proposed anatomy:

```
root headerTemplate
root bodyTemplate (composed by format_proposal_body from all sections)
  ├─ pkg1 section heading (e.g. "## core")
  │   ├─ pkg1 sectionHeaderTemplate       ← PR-only
  │   ├─ <!-- MARKER:START:core -->
  │   ├─ pkg1 sectionBodyTemplate          ← release-scoped (extracted on publish)
  │   ├─ <!-- MARKER:END:core -->
  │   └─ pkg1 sectionFooterTemplate       ← PR-only
  ├─ pkg2 section heading (e.g. "## utils")
  │   ├─ pkg2 sectionHeaderTemplate
  │   ├─ <!-- MARKER:START:utils -->
  │   ├─ pkg2 sectionBodyTemplate
  │   ├─ <!-- MARKER:END:utils -->
  │   └─ pkg2 sectionFooterTemplate
root footerTemplate
```

### Is it possible? Yes.

The `format_proposal_body` transformer would compose each workspace's section block as:

```
## <name>
<resolved sectionHeader>
<!-- PROPOSAL-CHANGELOG-RELEASE-START:<name> -->
<resolved sectionBody>
<!-- PROPOSAL-CHANGELOG-RELEASE-END:<name> -->
<resolved sectionFooter>
```

In single-repo mode (one entry), the heading is omitted and the markers stay as-is (no name suffix, backward compatible).

### Marker changes required

Currently `PROPOSAL_MARKERS` uses a single pair:
- `<!-- PROPOSAL-CHANGELOG-RELEASE-START -->`
- `<!-- PROPOSAL-CHANGELOG-RELEASE-END -->`

For monorepo, we need per-workspace markers:
- `<!-- PROPOSAL-CHANGELOG-RELEASE-START:core -->`
- `<!-- PROPOSAL-CHANGELOG-RELEASE-END:core -->`

`extractChangelogFromProposal` currently returns a single string. It would need to return either:
- A `Map<string, string>` (name → extracted body) for monorepo
- Or a single string for single-repo (backward compat)

A clean unified API: `extractChangelogFromProposal` returns `Map<string, string>` always. In single-repo, the map has one entry keyed by `"root"`. In monorepo, one entry per workspace name. The publish workflow then looks up the map by workspace name instead of using a shared string.

### What changes on the publish side (`review.publish.ts`)

Currently line 100: `proposalChangelogRelease ?? ""` is passed to every workspace's `generatePublishChangelogReleaseContent`. With per-workspace markers, each workspace gets its own extracted body:

```typescript
const proposalChangelogMap = extractChangelogFromProposal(associatedProposalForCommit);
// ...
// Inside workspace loop:
const wsChangelog = proposalChangelogMap.get(wsConfig.name ?? "root") ?? "";
const changelogReleaseResult = await generatePublishChangelogReleaseContent(
  provider,
  wsChangelog,  // was: proposalChangelogRelease ?? ""
  ...
);
```

This is actually a bug fix too — the current code feeds the same extracted changelog to every workspace, which is wrong for monorepo. Per-workspace markers fix this.

### Schema additions for workspace `review` config

The workspace `ReviewConfigPatchSchema` would have:
- `sectionHeaderTemplate` / `sectionHeaderTemplatePath` — PR-only content before the body markers
- `sectionBodyTemplate` / `sectionBodyTemplatePath` — replaces old `bodyTemplate`, release-scoped (inside markers)
- `sectionFooterTemplate` / `sectionFooterTemplatePath` — PR-only content after the body markers

All optional, all defaulting to empty/changelogRelease respectively.

In single-repo, none of these exist (there's no workspace config). The root `bodyTemplate` controls everything directly, same as before.

### Complexity assessment

This is more involved than the previous rounds but architecturally sound:
1. **Transformer** composes the full section block per workspace (heading + header + markers + body + markers + footer)
2. **Markers** become workspace-aware (name-suffixed in monorepo, plain in single-repo)
3. **Extraction** returns a map instead of a single string
4. **Publish** looks up per-workspace changelog from the map

The most significant change is (3) — `extractChangelogFromProposal` returning a map. Everything else is additive.

### Open question

Is `sectionHeaderTemplate` / `sectionBodyTemplate` / `sectionFooterTemplate` acceptable naming, or is that too verbose? Alternatives:
- `header` / `body` / `footer` nested under a `section` object in the workspace review config
- Keep them flat as proposed

---

## Round 6 — Breaking changes, custom heading names, tag-based markers, "member" naming, unified default template

### 1. Breaking changes are fine

The architectural correctness matters more. Every choice below optimises for the right design, not backward compat.

---

### 2. Custom member heading name

**Options ruled out:**

- **`runtime-override.ts` approach**: That system injects config overrides at runtime from hook stdout. It rebuilds the pattern context for template-derived values (tagName, workingBranchName). It has no concept of per-workspace heading names for a transformer — and the transformer runs at root template time with the assembled `releases[]`, not per-workspace. Not the right mechanism.

- **Transformer argument** (`{{ releases | format_proposal_body: nameMap }}`): Non-idiomatic for Liquid. The user would have to construct a Liquid object literal as a filter argument, which is awkward syntax and harder to document. Rejected.

**Best approach: a `displayName` field in workspace config, defaulting to `name`.**

Add an optional `displayName` (or `memberTitle` — open to naming) to `WorkspaceMemberConfig`. It defaults to `name` if omitted. This value is stored in `ReleaseContextEntry` and the transformer reads `entry.displayName ?? entry.name` for the heading.

This is the most idiomatic approach: declarative config, visible in schema documentation, no template gymnastics. Users who want `core` to display as `Core Package` just set `displayName: "Core Package"` once.

---

### 3. Use tag name for markers, not workspace name

Correct call. Workspace `name` is a mutable config string — if it changes between prepare and publish, extraction breaks. Tag name is derived from the version, which is written to files and committed. It cannot silently drift mid-release.

**New marker format:**

```
<!-- PROPOSAL-CHANGELOG-RELEASE-START:{tagName} -->
<!-- PROPOSAL-CHANGELOG-RELEASE-END:{tagName} -->
```

**Extraction on publish (`extractChangelogFromProposal`):**

Instead of returning a single string, returns `Map<string, string>` where keys are `tagName` strings. The extraction scans the PR body for all `START:{x}` / `END:{x}` marker pairs:

```typescript
// regex: /<!-- PROPOSAL-CHANGELOG-RELEASE-START:([\w.\-]+) -->([\s\S]*?)<!-- PROPOSAL-CHANGELOG-RELEASE-END:\1 -->/g
```

Each workspace on publish looks up its changelog by exact `tagName` first, then falls back to checking `tag.matchPatterns` against all keys in the map. This makes it robust to tag name template changes between releases.

**Single-repo backward compat (abandoned per your instruction):** In single-repo, we also emit a named marker using the single workspace's tag name. No special-casing. Single-repo and monorepo both use the same format.

---

### 4. Rename "section" → "member"

Workspace-level `ReviewConfigPatchSchema` fields become:

- `memberHeaderTemplate` / `memberHeaderTemplatePath`
- `memberBodyTemplate` / `memberBodyTemplatePath`
- `memberFooterTemplate` / `memberFooterTemplatePath`

These replace the old `bodyTemplate` / `bodyTemplatePath` which are removed from the workspace patch schema.

---

### 5. Single default root body template that works for both modes

This is the crux. The current `DEFAULT_PROPOSAL_BODY_TEMPLATE = {{ changelogRelease }}` only works because body wrapping in markers is done in code (`createProposalContent`, lines 113–118), not in the template.

With the new design, **the `format_proposal_body` transformer must own marker placement entirely**. Here's why:

In monorepo, each workspace section needs its own markers:
```
## core
{memberHeader}
<!-- START:core-v1.2.3 -->
{memberBody}
<!-- END:core-v1.2.3 -->
{memberFooter}
```

If `createProposalContent` also wraps the whole body in outer markers, we'd have double-wrapping. So the outer marker wrapping in `createProposalContent` is removed. The transformer handles markers for every mode.

**The unified default template:**

```
DEFAULT_PROPOSAL_BODY_TEMPLATE = {{ releases | format_proposal_body }}
```

**What `format_proposal_body` outputs:**

For a single-repo run (`releases = [{ name: "root", tagName: "v1.2.3", changelogRelease: "..." }]`):
```
<!-- PROPOSAL-CHANGELOG-RELEASE-START:v1.2.3 -->
{changelogRelease}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:v1.2.3 -->
```
No heading. Just markers + body. Identical function to the current behavior.

For a monorepo run (`releases = [{ name: "core", tagName: "core-v1.2.3", ... }, { name: "utils", tagName: "utils-v2.0.0", ... }]`):
```
## core
{resolvedMemberHeader}
<!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v1.2.3 -->
{resolvedMemberBody or changelogRelease}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:core-v1.2.3 -->
{resolvedMemberFooter}

## utils
...
```

This works for both modes. There is **no new pattern variable needed** — `format_proposal_body` is the single abstraction that unifies both.

**The transformer receives everything it needs from `releases[]`**, which is pre-populated per-workspace during the workspace loop with:
- `changelogRelease` — raw changelog (always present)
- `resolvedMemberHeader` — pre-resolved `memberHeaderTemplate`, if set (PR-only, not in markers)
- `resolvedMemberBody` — pre-resolved `memberBodyTemplate`, if set (inside markers)
- `resolvedMemberFooter` — pre-resolved `memberFooterTemplate`, if set (PR-only, not in markers)
- `tagName` — used for marker key
- `displayName` — used for the heading

**The consequence for `createProposalContent`:**

Lines 113–118 that wrap `proposalBody` in `PROPOSAL_MARKERS.bodyStart/End` are removed. The function now just resolves `bodyTemplate` and uses the result verbatim — the transformer already embedded the markers.

`PROPOSAL_MARKERS` in `markers.ts` can be removed or repurposed, since marker generation moves into the transformer and marker extraction now uses a regex scan rather than a fixed sentinel pair.

---

## Round 7 — Naming the heading field; who owns marker placement

### 1. Naming: `title` is the top pick

Candidates:

| Name | Pros | Cons |
|------|------|------|
| `displayName` | Conventional pairing with `name` (React, LDAP, Firebase). Self-documenting. | Feels enterprise-y for a YAML config. Verbose. |
| `title` | Short, natural in a config file. A section has a "title." | Minor ambiguity with root `titleTemplate` (PR title). |
| `label` | Short. | Already used in this codebase for PR/issue labels (`review.labels`). Collision. |
| `sectionName` | Explicit. | We're renaming away from "section" to "member." Inconsistent. |
| `memberName` | Consistent with "member" terminology. | Confusing next to `name` — `name` vs `memberName`? |

**My top pick: `title`.**

In a user-facing YAML config, brevity and clarity matter more than code convention. `title` reads naturally: `workspaces: [{ name: core, title: Core Library }]`. The ambiguity with `titleTemplate` is minor — they live at different config levels (workspace vs root review) and the contexts are clearly different. Nobody would confuse "what heading does this workspace get in the PR body" with "what is the PR title."

`displayName` is the most *conventional* pairing with `name` in TypeScript/Java codebases, but this is a config schema that users write by hand, not an internal API. Config files favor short keys.

---

### 2. Marker ownership: decompose into composable primitives

You're right that having `format_proposal_body` exclusively own markers is fragile. If a user writes a custom root `bodyTemplate` without using the transformer, the publish extraction breaks silently.

**Evaluating the three options:**

#### Option A: Expose markers as a transformer

A low-level `wrap_proposal_markers` transformer:

```liquid
{{ someContent | wrap_proposal_markers: tagName }}
```

Output:
```
<!-- PROPOSAL-CHANGELOG-RELEASE-START:v1.2.3 -->
someContent
<!-- PROPOSAL-CHANGELOG-RELEASE-END:v1.2.3 -->
```

Then `format_proposal_body` uses `wrap_proposal_markers` internally. Users who write custom templates use it manually:

```liquid
{% for r in releases %}
## {{ r.title }}
{{ r.memberHeader }}
{{ r.changelogRelease | wrap_proposal_markers: r.tagName }}
{{ r.memberFooter }}
{% endfor %}
```

**Pros:**
- Composable: small primitive + higher-level helper built on top
- Users who write custom templates can still participate in the marker system
- If they choose to not use `wrap_proposal_markers`, extraction returns empty — that's an explicit choice, not an accident
- `format_proposal_body` is not magic — it's just a convenience wrapper over primitives that users can also access

**Cons:**
- If users forget to use it in a custom template, publish silently gets no changelog (but we could log a warning if no markers are found)

#### Option B: Keep marker placement in application code

`createProposalContent` would need to receive per-workspace body data and wrap each one in markers. This means the function needs to know the structure of the body — which workspace sections exist, where they begin and end. That's fragile: it would have to parse the template output to find boundaries.

Unless we split the architecture: the template produces content WITHOUT markers, and the application wraps markers separately. But then the application needs the per-workspace resolved bodies as separate strings, which means template resolution can't be a single `resolveStringTemplate(bodyTemplate, context)` call anymore. The orchestrator would need to:

1. Resolve each workspace's body separately
2. Give each resolved body to `createProposalContent` as a list
3. `createProposalContent` wraps each in markers and joins them

This works but defeats the purpose of having a root `bodyTemplate` that controls the full assembly. The template loses agency — it can't decide ordering, separators, or layout. The code handles all structure.

**Rejected** — it splits responsibility in a way that makes the template less useful.

#### Option C: Remove markers entirely, re-generate on publish

On publish, re-resolve commits and re-generate changelog from scratch instead of extracting from the PR body.

**Pros:**
- No markers, no transport hack
- Publish is self-contained

**Cons:**
- Duplicates significant work (commit resolution, changelog generation)
- If the user manually edited the changelog in the PR body between prepare and publish (which is a supported workflow — they can tweak wording), those edits are lost
- Slower publish step

**Rejected** — it loses the "PR body as editable draft" capability, which is a valuable feature.

---

### Verdict: Option A — composable transformer primitives

The architecture becomes:

1. **`wrap_proposal_markers`** — low-level filter. Takes content + tag name, wraps in marker pair. Available to users in custom templates.

2. **`format_proposal_body`** — high-level filter. Takes `releases[]`, composes the full body (headings, member header/footer, markers via `wrap_proposal_markers`). This is what `DEFAULT_PROPOSAL_BODY_TEMPLATE` uses.

3. **`createProposalContent`** — no longer wraps markers itself. Just resolves the root `bodyTemplate` and returns the result. Markers are in the resolved output (placed by whichever transformer the user chose).

4. **`extractChangelogFromProposal`** — regex-scans for all marker pairs, returns `Map<tagName, body>`. If no markers found, returns empty map and logs a warning.

This gives three tiers of control:
- **Default**: `{{ releases | format_proposal_body }}` — everything handled automatically
- **Custom layout, standard markers**: `{% for r in releases %} ... {{ r.changelogRelease | wrap_proposal_markers: r.tagName }} ... {% endfor %}`
- **Fully custom, opt out of markers**: User writes whatever they want, accepts that publish extraction won't work (they'd configure `release.bodyTemplate` separately)

Each tier is an explicit, documented choice. No silent breakage.

---

## Round 8 — Code owns the markers; transformer only handles title and layout

### The observation

To build a full member section you need:

```
memberHeader (PR-only)
MARKER_START:tagName
memberBody (release-scoped)
MARKER_END:tagName
memberFooter (PR-only)
```

The markers are not a user concern — they are an architectural invariant. Every member body gets wrapped in markers. Always. That constraint belongs in the application code, not in a transformer.

The Round 7 proposal delegated markers to `format_proposal_body` and introduced `wrap_proposal_markers` as a primitive for users who bypass it. But that creates an obligation: custom template authors must remember to call `wrap_proposal_markers` or extraction silently fails. That's a bad API surface.

### Better: code assembles `resolvedMemberSection`, transformer only handles title + ordering

**In the workspace loop (`review.prepare.ts`), for each workspace, the code:**

1. Resolves `memberHeaderTemplate` → `resolvedMemberHeader`
2. Resolves `memberBodyTemplate` → `resolvedMemberBody` (defaults to `changelogRelease`)
3. Resolves `memberFooterTemplate` → `resolvedMemberFooter`
4. Wraps `resolvedMemberBody` in markers: `MARKER_START:tagName + resolvedMemberBody + MARKER_END:tagName`
5. Assembles `resolvedMemberSection = resolvedMemberHeader + markedBody + resolvedMemberFooter`

All fields are stored in `ReleaseContextEntry`.

**`format_proposal_body` transformer only handles:**
- Adding the `## title` heading per entry (skipped in single-repo)
- Joining entries with `\n\n`

```liquid
{{ releases | format_proposal_body }}
```

Outputs:
```
## Core Library
{resolvedMemberSection for core}

## Utils
{resolvedMemberSection for utils}
```

Markers are already embedded inside each `resolvedMemberSection`. The transformer has zero marker awareness.

### What's available in `releases[]` for custom templates

```
r.name                    — workspace identifier
r.title                   — display heading (from workspace config, defaults to name)
r.tagName                 — used internally by the system for marker keys
r.changelogRelease        — raw changelog string, no markers
r.resolvedMemberHeader    — pre-resolved header (PR-only)
r.resolvedMemberBody      — pre-resolved body content, no markers
r.resolvedMemberSection   — fully assembled: header + MARKER + body + MARKER + footer
```

A user who wants a custom layout still gets markers guaranteed, because `resolvedMemberSection` always contains them:

```liquid
{% for r in releases %}
# {{ r.title }}
> Custom intro for this workspace
{{ r.resolvedMemberSection }}
Some custom outro
{% endfor %}
```

### `wrap_proposal_markers` dropped

No longer needed. Markers are already in `resolvedMemberSection`. A user accessing `r.resolvedMemberBody` (raw, no markers) is explicitly choosing to bypass the marker system — that's an edge case that's documented as "you're responsible for your own extraction."

### Should "opt out of member templates entirely" be supported?

You asked whether to support users who write a fully custom `bodyTemplate` not using any `releases[]` patterns. Practically: if they do this, `extractChangelogFromProposal` returns empty, publish gets no changelog from the PR, and the GitHub Release body would need to be sourced entirely from `release.bodyTemplate` configured separately.

That's an explicit opt-out with clear consequences. It's worth supporting, but not worth adding special-case code for. The documentation should note: "if your custom `bodyTemplate` does not include `resolvedMemberSection` for each workspace, automatic changelog extraction on publish will not work."

### `createProposalContent` changes

The old marker wrapping (lines 113–118) is removed. The function now:
1. Resolves the root `bodyTemplate` (which contains markers via `resolvedMemberSection`)
2. Returns the resolved string verbatim as the body

`PROPOSAL_MARKERS` in `markers.ts` is no longer used for wrapping — it can be converted to a marker string constant used only by the extraction regex, or removed entirely if the regex is self-contained.

### Summary of the cleaner architecture

| Responsibility | Owner |
|---|---|
| Resolve `memberHeader/Body/Footer` per workspace | Application code (workspace loop) |
| Place markers around `memberBody` | Application code (workspace loop) |
| Assemble `resolvedMemberSection` | Application code (workspace loop) |
| Add title heading, join sections | `format_proposal_body` transformer |
| Root body assembly | Root `bodyTemplate` (default: `{{ releases \| format_proposal_body }}`) |
| Extract per-workspace bodies on publish | `extractChangelogFromProposal` via regex scan |

---

## Round 9 — Single pattern for both modes; global no-name marker; naming `section` vs alternatives

### 1. Does `resolvedMemberSection` always exist? Yes — no fallback arg needed.

In the workspace loop, every workspace (including the single workspace in single-repo) goes through the same assembly step:

1. Resolve `memberBodyTemplate` → defaults to `changelogRelease` if unset
2. Wrap in named marker
3. Assemble `resolvedMemberSection = header + markedBody + footer`

This runs unconditionally. In single-repo, `releases` has exactly one entry, and `releases[0].resolvedMemberSection` is always populated. The `format_proposal_body` transformer in single-repo just outputs that entry's `resolvedMemberSection` with no heading — identical in function to the current `{{ changelogRelease }}` default.

No fallback argument on the transformer. No new pattern variable. `{{ releases | format_proposal_body }}` is the single unified default that works for both modes.

---

### 2. Should we keep the global no-name marker?

Current: `<!-- PROPOSAL-CHANGELOG-RELEASE-START -->` / `<!-- PROPOSAL-CHANGELOG-RELEASE-END -->` wrapping the entire body.

You make a very good point. Let's look at the practical, real-world use cases where extracting the *entire* body (excluding header and footer) is highly valuable:

**Practical Use Case: Monorepo Release Announcements (Slack / Discord / Email)**
When a release PR is merged, many teams trigger a workflow (like a GitHub Action) to send a release announcement to a Slack or Discord channel. 
If they want to send a single message that summarizes the entire monorepo release ("Here is what changed across all packages: ## Core ... ## Utils ..."), they just need to extract the combined changelog block from the PR body.

If we keep the global marker:
- They can extract the entire combined changelog trivially using a simple bash script, `grep`, or existing GitHub Actions that look for text between two delimiters.
- If a user manually types a "high-level summary" paragraph at the top of the PR body (between the global START and the first workspace's heading), that summary gets captured and included in the Slack announcement. It won't go to any specific package's GitHub Release (since it's outside the per-workspace `START:tagName` markers), which is exactly correct for a global summary.

If we drop the global marker:
- To get the combined announcement, they would have to write a complex regex to find the start of the first workspace marker and the end of the last workspace marker.
- Any manual global summary they wrote above the first workspace would be lost to automated tools, because there is no delimiter separating "Zephyr's generated body" from the PR header.

**Decision: Keep it.** The global marker acts as a semantic boundary for the entire "Zephyr-managed changelog zone." It costs us nothing to keep it (it just wraps the resolved `bodyTemplate` output like it currently does in `createProposalContent`), and it makes third-party integrations and custom notification scripts trivial to write. Good catch.

---

### 3. Naming: `section` vs alternatives for the assembled member block

**The collision concern is real.** In `changelog-config.ts`, "section" is an established term: `releaseSectionHeadingTemplate`, `releaseSectionEntryTemplate`, the pattern variable `{{ section }}` (which represents a commit category like "Features" or "Bug Fixes"). Users who customize both changelog and PR templates will encounter both. Sharing the term creates cognitive load even if there's no namespace collision in code.

**Candidate terms for the assembled workspace block:**

| Name | In Liquid (`releases[i].*`) | Assessment |
|---|---|---|
| `section` | `r.section` | Short, intuitive. Real collision risk with changelog `{{ section }}` pattern. |
| `memberSection` | `r.memberSection` | Explicit. Still uses "section" — half the collision risk. |
| `block` | `r.block` | Short, neutral. `block` is a LiquidJS tag but safe as a variable name. Slightly generic. |
| `entry` | `r.entry` | Too ambiguous — "entry" is already used for individual changelog commit entries. |
| `content` | `r.content` | Too generic. |
| `segment` | `r.segment` | Neutral, no collision. Slightly unusual in a config context. |
| `part` | `r.part` | Too weak. |
| `slot` | `r.slot` | Has Vue/web-component connotations, may confuse users. |

**My pick: `block`.**

`block` is short, neutral, and carries no collision with any existing term in this codebase. In the context of `releases[i].block`, it reads naturally: "this workspace's block in the proposal body." The LiquidJS `{% block %}` tag is a tag, not a filter/variable, so naming a field `block` is safe.

`memberSection` is my second pick — explicit and still readable, though "section" appears in both its name and changelog config which is the exact thing we're trying to avoid.

`segment` would be my pick if `block` feels too informal, but `block` is used everywhere (block of text, block of content) and feels right for this.

**Naming the individual pieces consistently:**

| Config field | `ReleaseContextEntry` field (Liquid) |
|---|---|
| `memberHeaderTemplate` | `releases[i].memberHeader` |
| `memberBodyTemplate` | `releases[i].memberBody` |
| `memberFooterTemplate` | `releases[i].memberFooter` |
| *(assembled by code)* | `releases[i].block` |

`memberHeader`, `memberBody`, `memberFooter` keep the `member` prefix to signal "per-workspace" and avoid confusion with the root proposal `header`/`body`/`footer`. The assembled result drops the prefix and becomes just `block` — shorter because it's the single most-commonly-used field in custom templates.

---

## Round 10 — Naming finals; `changelogRelease` scope; Dynamic String Patterns accuracy

### 1. `block` → `memberBlock`

`block` was renamed to `memberBlock` for consistency. All five member-level fields on `ReleaseContextEntry` now share the `member` prefix:
- `memberHeader`
- `memberBody`
- `memberFooter`
- `memberBlock` ← renamed from `block`

No "resolved" prefix anywhere — all fields on an entry are pre-resolved by definition.

`format_proposal_body` validation schema now checks for `memberBlock` (string) and `title` (string).

---

### 2. `releases[i].changelogRelease` vs the flat `{{ changelogRelease }}` pattern

These are **not the same pattern**. They exist at different scopes:

| | Flat `{{ changelogRelease }}` | `releases[i].changelogRelease` |
|---|---|---|
| **When set** | Per workspace, during the workspace loop | Same (copied onto the entry at push time) |
| **Scope** | Root pattern context | Property on each `ReleaseContextEntry` |
| **Value at root template render** | Holds only the **last workspace's** value | Each entry holds its **own workspace's** value |
| **Where to use** | In `memberBodyTemplate`, `memberHeaderTemplate`, etc. (workspace-loop templates) | In root `bodyTemplate` inside `{% for r in releases %}` |

**Documentation requirement (Phase C-docs):** The `releases[i].changelogRelease` entry in the docs must have an explicit callout note on a separate line, in the same style as other notes, explaining this scope difference. Failure to document this will cause monorepo users to incorrectly use the flat pattern in root body templates and get only the last workspace's changelog.

---

### 3. `memberHeader` and `memberFooter` — kept on `ReleaseContextEntry`

Decision: keep both on the entry (user confirmed). They are available to custom template authors who want to re-order or intersperse content around `memberBlock`. The trade-off (slightly fatter entry object) is acceptable.

---

### 4. Dynamic String Patterns — label vs. description accuracy

The **label** "Dynamic String Patterns" is correct — these patterns are computed from the run context rather than being static config properties.

The **section description** "may change each time they are used" is only accurate for the `now*` datetime patterns (which are live JavaScript functions evaluated on every access). The changelog patterns (`changelogRelease`, etc.) are computed **once per workspace per run** and then fixed — they do not change on re-access.

**Fix (Phase G):**
1. Change the section description to: *"These string patterns are computed during the run based on the release context (commits, versions, etc.) and may differ between runs."*
2. Add a specific note under the `now*` datetime group: *"Unlike other dynamic patterns, these are live-evaluated on every access and may return different values each time they are called within the same run."*

