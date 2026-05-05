# Configuration options <!-- omit from toc -->

All possible config options of the Zephyr Release Configuration file.

Most options are optional - if you don't provide them, default values will be used.  
Required options:

- [version-files](#version-files-required)

<br>

It is recommended to use [`JSON Schema (v1)`](../schemas/v1/) when writing the config JSON.

To know more about templates, see [string-templates-and-patterns.md](./string-templates-and-patterns.md).

Some example [config files](./examples/).

## Table of Content <!-- auto-generated, do not edit --> <!-- omit from toc -->

- [Properties](#properties)
  - [name (Optional)](#name-optional)
  - [time-zone (Optional)](#time-zone-optional)
  - [custom-string-patterns (Optional)](#custom-string-patterns-optional)
  - [mode (Optional)](#mode-optional)
  - [review (Optional)](#review-optional)
    - [review \> draft (Optional)](#review--draft-optional)
    - [review \> working-branch-name-template (Optional)](#review--working-branch-name-template-optional)
    - [review \> title-template (Optional)](#review--title-template-optional)
    - [review \> title-template-path (Optional)](#review--title-template-path-optional)
    - [review \> header-template (Optional)](#review--header-template-optional)
    - [review \> header-template-path (Optional)](#review--header-template-path-optional)
    - [review \> body-template (Optional)](#review--body-template-optional)
    - [review \> body-template-path (Optional)](#review--body-template-path-optional)
    - [review \> footer-template (Optional)](#review--footer-template-optional)
    - [review \> footer-template-path (Optional)](#review--footer-template-path-optional)
    - [review \> labels (Optional)](#review--labels-optional)
      - [\> labels \> on-create (Optional)](#-labels--on-create-optional)
        - [\> on-create \> name (Required)](#-on-create--name-required)
        - [\> on-create \> description (Optional)](#-on-create--description-optional)
        - [\> on-create \> color (Optional)](#-on-create--color-optional)
        - [\> on-create \> create-if-missing (Optional)](#-on-create--create-if-missing-optional)
      - [\> labels \> on-merge (Optional)](#-labels--on-merge-optional)
        - [\> on-merge \> add (Optional)](#-on-merge--add-optional)
        - [\> add \> same properties as review \> labels \> on-createe\`](#-add--same-properties-as-review--labels--on-createe)
        - [\> on-merge \> remove (Optional)](#-on-merge--remove-optional)
        - [\> remove \> same properties as review \> labels \> on-createe\`](#-remove--same-properties-as-review--labels--on-createe)
    - [review \> assignees (Optional)](#review--assignees-optional)
    - [review \> reviewers (Optional)](#review--reviewers-optional)
  - [auto (Optional)](#auto-optional)
    - [auto \> trigger-strategy (Optional)](#auto--trigger-strategy-optional)
      - [\> trigger-strategy \> type (Required)](#-trigger-strategy--type-required)
  - [initial-version (Optional)](#initial-version-optional)
  - [version-files (Required)](#version-files-required)
    - [version-files \> path (Required)](#version-files--path-required)
    - [version-files \> format (Optional)](#version-files--format-optional)
    - [version-files \> extractor (Optional)](#version-files--extractor-optional)
    - [version-files \> selector (Required)](#version-files--selector-required)
    - [version-files \> primary (Optional)](#version-files--primary-optional)
  - [commit-types (Optional)](#commit-types-optional)
    - [commit-types \> type (Required)](#commit-types--type-required)
    - [commit-types \> section (Optional)](#commit-types--section-optional)
    - [commit-types \> sectionAlt (Optional)](#commit-types--sectionalt-optional)
    - [commit-types \> hidden (Optional)](#commit-types--hidden-optional)
  - [max-commits-to-resolve (Optional)](#max-commits-to-resolve-optional)
  - [resolve-until-commit-hash (Optional)](#resolve-until-commit-hash-optional)
  - [allowed-release-as-commit-types (Optional)](#allowed-release-as-commit-types-optional)
  - [bump-strategy (Optional)](#bump-strategy-optional)
    - [bump-strategy \> treat-major-as-minor-pre-stable (Optional)](#bump-strategy--treat-major-as-minor-pre-stable-optional)
    - [bump-strategy \> treat-minor-as-patch-pre-stable (Optional)](#bump-strategy--treat-minor-as-patch-pre-stable-optional)
    - [bump-strategy \> major (Optional)](#bump-strategy--major-optional)
      - [\> major \> types (Optional)](#-major--types-optional)
      - [\> major \> count-breaking-as (Optional)](#-major--count-breaking-as-optional)
      - [\> major \> commits-per-bump (Optional)](#-major--commits-per-bump-optional)
    - [bump-strategy \> minor (Optional)](#bump-strategy--minor-optional)
      - [\> minor \> same properties as bump-strategy \> major\`](#-minor--same-properties-as-bump-strategy--major)
    - [bump-strategy \> patch (Optional)](#bump-strategy--patch-optional)
      - [\> patch \> same properties as bump-strategy \> major\`](#-patch--same-properties-as-bump-strategy--major)
    - [bump-strategy \> prerelease (Optional)](#bump-strategy--prerelease-optional)
      - [\> prerelease \> enabled (Optional)](#-prerelease--enabled-optional)
      - [\> prerelease \> override (Optional)](#-prerelease--override-optional)
      - [\> prerelease \> treat-override-as-significant (Optional)](#-prerelease--treat-override-as-significant-optional)
      - [\> prerelease \> extensions (Optional)](#-prerelease--extensions-optional)
        - [\> extensions \> type (Required)](#-extensions--type-required)
    - [bump-strategy \> build (Optional)](#bump-strategy--build-optional)
      - [\> build \> same properties as bump-strategy \> prereleasee\`](#-build--same-properties-as-bump-strategy--prereleasee)
  - [changelog (Optional)](#changelog-optional)
    - [changelog \> write-to-file (Optional)](#changelog--write-to-file-optional)
    - [changelog \> path (Optional)](#changelog--path-optional)
    - [changelog \> commit-group-mode (Optional)](#changelog--commit-group-mode-optional)
    - [changelog \> commit-sort-order (Optional)](#changelog--commit-sort-order-optional)
    - [changelog \> file-header-template (Optional)](#changelog--file-header-template-optional)
    - [changelog \> file-header-template-path (Optional)](#changelog--file-header-template-path-optional)
    - [changelog \> file-release-template (Optional)](#changelog--file-release-template-optional)
    - [changelog \> file-release-template-path (Optional)](#changelog--file-release-template-path-optional)
    - [changelog \> file-footer-template (Optional)](#changelog--file-footer-template-optional)
    - [changelog \> file-footer-template-path (Optional)](#changelog--file-footer-template-path-optional)
    - [changelog \> release-header-template (Optional)](#changelog--release-header-template-optional)
    - [changelog \> release-header-template-path (Optional)](#changelog--release-header-template-path-optional)
    - [changelog \> release-section-heading-template (Optional)](#changelog--release-section-heading-template-optional)
    - [changelog \> release-section-heading-template-path (Optional)](#changelog--release-section-heading-template-path-optional)
    - [changelog \> release-section-entry-template (Optional)](#changelog--release-section-entry-template-optional)
    - [changelog \> release-section-entry-template-path (Optional)](#changelog--release-section-entry-template-path-optional)
    - [changelog \> release-breaking-section-heading (Optional)](#changelog--release-breaking-section-heading-optional)
    - [changelog \> release-breaking-section-entry-template (Optional)](#changelog--release-breaking-section-entry-template-optional)
    - [changelog \> release-breaking-section-entry-template-path (Optional)](#changelog--release-breaking-section-entry-template-path-optional)
    - [changelog \> release-body-override (Optional)](#changelog--release-body-override-optional)
    - [changelog \> release-body-override-path (Optional)](#changelog--release-body-override-path-optional)
    - [changelog \> release-footer-template (Optional)](#changelog--release-footer-template-optional)
    - [changelog \> release-footer-template-path (Optional)](#changelog--release-footer-template-path-optional)
    - [changelog \> release-header-template-alt (Optional)](#changelog--release-header-template-alt-optional)
    - [changelog \> release-header-template-alt-path (Optional)](#changelog--release-header-template-alt-path-optional)
    - [changelog \> release-section-heading-template-alt (Optional)](#changelog--release-section-heading-template-alt-optional)
    - [changelog \> release-section-heading-template-alt-path (Optional)](#changelog--release-section-heading-template-alt-path-optional)
    - [changelog \> release-section-entry-template-alt (Optional)](#changelog--release-section-entry-template-alt-optional)
    - [changelog \> release-section-entry-template-alt-path (Optional)](#changelog--release-section-entry-template-alt-path-optional)
    - [changelog \> release-breaking-section-heading-alt (Optional)](#changelog--release-breaking-section-heading-alt-optional)
    - [changelog \> release-breaking-section-entry-template-alt (Optional)](#changelog--release-breaking-section-entry-template-alt-optional)
    - [changelog \> release-breaking-section-entry-template-alt-path (Optional)](#changelog--release-breaking-section-entry-template-alt-path-optional)
    - [changelog \> release-body-override-alt (Optional)](#changelog--release-body-override-alt-optional)
    - [changelog \> release-body-override-alt-path (Optional)](#changelog--release-body-override-alt-path-optional)
    - [changelog \> release-footer-template-alt (Optional)](#changelog--release-footer-template-alt-optional)
    - [changelog \> release-footer-template-alt-path (Optional)](#changelog--release-footer-template-alt-path-optional)
  - [commit (Optional)](#commit-optional)
    - [commit \> local-changes-to-commit (Optional)](#commit--local-changes-to-commit-optional)
    - [commit \> header-template (Optional)](#commit--header-template-optional)
    - [commit \> header-template-path (Optional)](#commit--header-template-path-optional)
    - [commit \> body-template (Optional)](#commit--body-template-optional)
    - [commit \> body-template-path (Optional)](#commit--body-template-path-optional)
    - [commit \> footer-template (Optional)](#commit--footer-template-optional)
    - [commit \> footer-template-path (Optional)](#commit--footer-template-path-optional)
  - [tag (Optional)](#tag-optional)
    - [tag \> create-tag (Optional)](#tag--create-tag-optional)
    - [tag \> name-template (Optional)](#tag--name-template-optional)
    - [tag \> type (Optional)](#tag--type-optional)
    - [tag \> message-template (Optional)](#tag--message-template-optional)
    - [tag \> message-template-path (Optional)](#tag--message-template-path-optional)
    - [tag \> tagger (Optional)](#tag--tagger-optional)
      - [\> tagger \> name (Required)](#-tagger--name-required)
      - [\> tagger \> email (Required)](#-tagger--email-required)
      - [\> tagger \> date (Optional)](#-tagger--date-optional)
  - [release (Optional)](#release-optional)
    - [release \> create-release (Optional)](#release--create-release-optional)
    - [release \> prerelease (Optional)](#release--prerelease-optional)
    - [release \> draft (Optional)](#release--draft-optional)
    - [release \> set-latest (Optional)](#release--set-latest-optional)
    - [release \> title-template (Optional)](#release--title-template-optional)
    - [release \> title-template-path (Optional)](#release--title-template-path-optional)
    - [release \> header-template (Optional)](#release--header-template-optional)
    - [release \> header-template-path (Optional)](#release--header-template-path-optional)
    - [release \> body-template (Optional)](#release--body-template-optional)
    - [release \> body-template-path (Optional)](#release--body-template-path-optional)
    - [release \> footer-template (Optional)](#release--footer-template-optional)
    - [release \> footer-template-path (Optional)](#release--footer-template-path-optional)
    - [release \> assets (Optional)](#release--assets-optional)
  - [command-hooks (Optional)](#command-hooks-optional)
    - [command-hooks \> base (Optional)](#command-hooks--base-optional)
      - [\> base \> timeout (Optional)](#-base--timeout-optional)
      - [\> base \> continue-on-error (Optional)](#-base--continue-on-error-optional)
      - [\> base \> pre (Optional)](#-base--pre-optional)
        - [\> pre \> cmd (Required)](#-pre--cmd-required)
        - [\> pre \> timeout (Optional)](#-pre--timeout-optional)
        - [\> pre \> continue-on-error (Optional)](#-pre--continue-on-error-optional)
      - [\> base \> post (Optional)](#-base--post-optional)
        - [\> post \> same properties as command-hooks \> base \> pree\`](#-post--same-properties-as-command-hooks--base--pree)
    - [command-hooks \> prepare (Optional)](#command-hooks--prepare-optional)
      - [\> prepare \> same properties as command-hooks \> basee\`](#-prepare--same-properties-as-command-hooks--basee)
    - [command-hooks \> publish (Optional)](#command-hooks--publish-optional)
      - [\> publish \> same properties as command-hooks \> basee\`](#-publish--same-properties-as-command-hooks--basee)
  - [runtime-config-override (Optional)](#runtime-config-override-optional)
    - [runtime-config-override \> path (Required)](#runtime-config-override--path-required)
    - [runtime-config-override \> format (Optional)](#runtime-config-override--format-optional)
- [Type Definitions](#type-definitions)
  - [AutoStrategy](#autostrategy)
  - [SemverExtension](#semverextension)

## Properties

### name (Optional)

Type: `string`  
Default: `""`

The project name used in [string templates](./string-templates-and-patterns.md) (available as `{{ name }}`).

[⬆ Back to top](#table-of-content)

### time-zone (Optional)

Type: `string`  
Default: `"UTC"`

IANA time zone used to format and display times.  
This value is also available for use in [string templates](./string-templates-and-patterns.md) as `{{ timeZone }}`.

[⬆ Back to top](#table-of-content)

### custom-string-patterns (Optional)

Type: `object` (record of string to string)

Custom string patterns to use in templates. The key is the pattern name, available as `{{ <key> }}` in [string templates](./string-templates-and-patterns.md), while the resolved value is the key's value.

**Notes:** If a custom pattern key name matches an existing built-in pattern name, the built-in pattern takes precedence and the custom value will be ignored.

[⬆ Back to top](#table-of-content)

### mode (Optional)

Type: `"review" | "auto"`  
Default: `"review"`

Defines the execution strategy.

- **`"review"`**: Routes updates through a release proposal (PR, MR, ...). This is the default behavior where Zephyr Release creates or updates a proposal with version bumps and changelog changes.
- **`"auto"`**: Bypasses the proposal and commits directly to the branch. When set to `"auto"`, the release operation will commit changes directly to the branch without creating a proposal (PR, MR, ...).

If choosing `"auto"`, see [`auto > trigger-strategy`](#auto--trigger-strategy-optional) for configuring when automated releases are triggered.

[⬆ Back to top](#table-of-content)

### review (Optional)

Type: `object`  
**Properties:** [`draft`](#review--draft-optional), [`working-branch-name-template`](#review--working-branch-name-template-optional), [`title-template`](#review--title-template-optional), [`title-template-path`](#review--title-template-path-optional), [`header-template`](#review--header-template-optional), [`header-template-path`](#review--header-template-path-optional), [`body-template`](#review--body-template-optional), [`body-template-path`](#review--body-template-path-optional), [`footer-template`](#review--footer-template-optional), [`footer-template-path`](#review--footer-template-path-optional), [`labels`](#review--labels-optional), [`assignees`](#review--assignees-optional), [`reviewers`](#review--reviewers-optional)

Configuration specific to the `"review"` execution `mode`. Defines how release proposals (such as PRs, MRs, ...) are generated, formatted, and tracked.

[⬆ Back to top](#table-of-content)

#### review > draft (Optional)

Type: `boolean`  
Default: `false`

If enabled, the proposal will be created as draft.

[⬆ Back to top](#table-of-content)

#### review > working-branch-name-template (Optional)

Type: `string`  
Default: [`DEFAULT_WORKING_BRANCH_NAME_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for branch name that Zephyr Release will use.  
Allowed patterns to use are: fixed base string patterns.

**Note on Immutability:** This property is considered a core structural configuration and is **immutable at runtime**. It cannot be overridden by a [`runtime-config-override`](#runtime-config-override-optional) file. This ensures that the branch naming strategy remains consistent throughout the entire release process, preventing potential conflicts or unexpected branch creations during dynamic configuration updates.

[⬆ Back to top](#table-of-content)

#### review > title-template (Optional)

Type: `string`  
Default: [`DEFAULT_PROPOSAL_TITLE_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for proposal title, using with string patterns like {{ nextVersion }}.  
Allowed patterns to use are: all fixed and dynamic string patterns.

[⬆ Back to top](#table-of-content)

#### review > title-template-path (Optional)

Type: `string`

Path to text file containing proposal title template. Overrides `title-template` when both are provided.  
To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### review > header-template (Optional)

Type: `string`  
Default: [`DEFAULT_PROPOSAL_HEADER_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for proposal header, using with string patterns like {{ nextVersion }}.  
Allowed patterns to use are: all fixed and dynamic string patterns.

[⬆ Back to top](#table-of-content)

#### review > header-template-path (Optional)

Type: `string`

Path to text file containing proposal header template. Overrides `header-template` when both are provided.  
To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### review > body-template (Optional)

Type: `string`  
Default: [`DEFAULT_PROPOSAL_BODY_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for proposal body, using with string patterns like {{ changelogRelease }}.  
Allowed patterns to use are: all fixed and dynamic string patterns.

[⬆ Back to top](#table-of-content)

#### review > body-template-path (Optional)

Type: `string`

Path to text file containing proposal body template. Overrides `body-template` when both are provided.  
To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### review > footer-template (Optional)

Type: `string`  
Default: [`DEFAULT_PROPOSAL_FOOTER_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for proposal footer, using with string patterns.  
Allowed patterns to use are: all fixed and dynamic string patterns.

[⬆ Back to top](#table-of-content)

#### review > footer-template-path (Optional)

Type: `string`

Path to text file containing proposal footer template. Overrides `footer-template` when both are provided.  
To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### review > labels (Optional)

Type: `object`  
Default: `{}`

Labels to attach and remove from proposals on different stages.

[⬆ Back to top](#table-of-content)

##### > labels > on-create (Optional)

Type: `string | object | (string | object)[]`

Labels to attach to proposals when created. Can be a string, a label object, or an array containing either.

[⬆ Back to top](#table-of-content)

###### > on-create > name (Required)

Type: `string`

Label name.

[⬆ Back to top](#table-of-content)

###### > on-create > description (Optional)

Type: `string`

Label description.

[⬆ Back to top](#table-of-content)

###### > on-create > color (Optional)

Type: `string`  
Default: `"#ededed"`

The hexadecimal color code for the label, in standard format with the leading #.

[⬆ Back to top](#table-of-content)

###### > on-create > create-if-missing (Optional)

Type: `boolean`  
Default: `false`

If enabled, the label will be created if it does not exist on the platform.

[⬆ Back to top](#table-of-content)

##### > labels > on-merge (Optional)

Type: `object`

Labels to attach and remove from proposals when merged and release operation has completed.

[⬆ Back to top](#table-of-content)

###### > on-merge > add (Optional)

Type: `string | object | (string | object)[]`

Labels to add when proposal is merged.

[⬆ Back to top](#table-of-content)

###### > add > same properties as review > labels > on-createe`

Same as [`review > labels > on-create`](#-labels--on-create-optional).

- [`name`](#-on-create--name-required)
- [`description`](#-on-create--description-optional)
- [`color`](#-on-create--color-optional)
- [`create-if-missing`](#-on-create--create-if-missing-optional)

[⬆ Back to top](#table-of-content)

###### > on-merge > remove (Optional)

Type: `string | object | (string | object)[]`

Labels to remove when proposal is merged. Use `"<ALL_ON_CREATE>"` to remove all labels added in `on-create`.

[⬆ Back to top](#table-of-content)

###### > remove > same properties as review > labels > on-createe`

Same as [`review > labels > on-create`](#-labels--on-create-optional).

- [`name`](#-on-create--name-required)
- [`description`](#-on-create--description-optional)
- [`color`](#-on-create--color-optional)
- [`create-if-missing`](#-on-create--create-if-missing-optional)

[⬆ Back to top](#table-of-content)

#### review > assignees (Optional)

Type: `string | string[]`

A list of user identifiers to assign to the release proposal.  
Use the platform's expected format (e.g., usernames).

[⬆ Back to top](#table-of-content)

#### review > reviewers (Optional)

Type: `string | string[]`

A list of user or team identifiers requested to review the release proposal.  
Use the platform's expected format (e.g., usernames or team slugs).

[⬆ Back to top](#table-of-content)

### auto (Optional)

Type: `object`  

Configuration specific to the `"auto"` execution `mode`. Defines the conditions and strategies for bypassing proposals and committing releases directly.

[⬆ Back to top](#table-of-content)

#### auto > trigger-strategy (Optional)

Type: [`AutoStrategy`](#autostrategy)  
Default: `{ type: "commit-types" }`

Strategy that determines whether an automated release should be triggered when base [`mode`](#mode-optional) is set to `"auto"`.  
Defines the conditions under which a release will be automatically triggered and committed directly to the branch.

[⬆ Back to top](#table-of-content)

##### > trigger-strategy > type (Required)

Type: `"commit-types" | "commit-footer" | "flag"`

The strategy type used for automated releases. See [`AutoStrategy`](#autostrategy) for full configuration details of each type.

[⬆ Back to top](#table-of-content)

### initial-version (Optional)

Type: `string`  
Default: `"0.1.0"`

The initial semantic version used when a project has no existing version defined in its main version file, or the existing is `0.0.0` (typically during the first setup or initialization of a project).

If the version is missing or `0.0.0`, Zephyr Release will use this initial value exactly as the next version without calculating any bumps, ensuring your first release stays predictable even if you already have several commits. Once a version is established, subsequent releases will increment from the current value rather than this initial one.

If you actually want your starting version to be `0.0.0`, just set it as the `initial-version` value. Zephyr Release will handles this under the hood to ensure no loops happen (like see `0.0.0`, fall back to an initial version `0.0.0`, rinse and repeat, stuck at zero forever).

[⬆ Back to top](#table-of-content)

### version-files (Required)

Type: `object | object[]`

Version file(s). Accepts a single file object or an array of file objects. If a single object, it becomes the primary file. If arrays, the first file with `primary: true` becomes the primary; if none are marked, the first file in the array will be.

The **primary file** serves as the main source of truth for the project's version.  
When reading or bumping versions, the action uses the primary file's version to determine the current and next version.  
Other version files (if any) are then synchronized to match the primary version.

[⬆ Back to top](#table-of-content)

#### version-files > path (Required)

Type: `string`

Path to the version file, relative to the project root. To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### version-files > format (Optional)

Type: `"auto" | "json" | "jsonc" | "json5" | "yaml" | "toml" | "txt"`  
Default: `"auto"`

Defines the file format.

[⬆ Back to top](#table-of-content)

#### version-files > extractor (Optional)

Type: `"auto" | "json-path" | "regex"`  
Default: `"auto"`

Defines how the version should be located inside the parsed output.

[⬆ Back to top](#table-of-content)

#### version-files > selector (Required)

Type: `string`

The lookup used by the chosen extractor. For `json-path`, this is the JSON path string; for `regex`, supply the pattern.

[⬆ Back to top](#table-of-content)

#### version-files > primary (Optional)

Type: `boolean`  
Default: `false`

Marks this file as the primary source of truth for the current version.

[⬆ Back to top](#table-of-content)

### commit-types (Optional)

Type: `array of objects`  
Default: [`DEFAULT_COMMIT_TYPES`](../src/constants/defaults/commit.ts)

**Properties:** [`type`](#commit-types--type-required), [`section`](#commit-types--section-optional), [`sectionAlt`](#commit-types--sectionalt-optional), [`hidden`](#commit-types--hidden-optional)

List of commit types that the application will track and record. Only commits with these types will be considered when calculating version bumps and generating release notes.

[⬆ Back to top](#table-of-content)

#### commit-types > type (Required)

Type: `string`

Commit type name (e.g., "feat", "fix").

[⬆ Back to top](#table-of-content)

#### commit-types > section (Optional)

Type: `string`

Changelog section heading for this commit type. When empty, the `type` value is used.

[⬆ Back to top](#table-of-content)

#### commit-types > sectionAlt (Optional)

Type: `string`

Changelog alternative section heading for this commit type. When empty, the `section` value is used.

[⬆ Back to top](#table-of-content)

#### commit-types > hidden (Optional)

Type: `boolean`  
Default: `false`

Exclude this commit type from changelog generation (does not affect version bump calculation).

[⬆ Back to top](#table-of-content)

### max-commits-to-resolve (Optional)

Type: `number`  
Default: `100`

The maximum number of commits allowed to resolve, the rest will be truncated.

[⬆ Back to top](#table-of-content)

### resolve-until-commit-hash (Optional)

Type: `string`

Forces the tool to keep resolving commits until it reaches this specific hash, completely bypassing the standard resolve behavior.

By default, Zephyr Release automatically finds your last release by querying the platform's Release API, or falls back to semantic version numbers from your Git tags. However, sometimes automatic detection is impossible:

- **No Platform Releases:** You are running locally, on a host without a formal Release API, or you just dont use the Release feature ([`create-release`](#release--create-release-optional) is false).
- **Noisy/Custom Tags:** You tag non-release commits (e.g., `test-deploy`) and do not use Semantic Versioning in tag name, causing the tag fallback to fail.
- **Custom Boundaries:** You need to forcefully generate a changelog from a highly specific point in time.

In those cases, `resolve-until-commit-hash` acts as your explicit manual override, telling the tool exactly which commit hash to anchor to.

While this property overrides standard behavior, it **does not** override your safety limits. The resolution process still strictly respects `max-commits-to-resolve`. If the specified hash is not found before the maximum commit limit is reached, the tool will safely stop and return the commits gathered up to that point.

**Note:** Avoid hardcoding this in your static config file. Instead, set it dynamically via [`input config override`](./input-options.md#config-override-optional) or `command-hooks`.

[⬆ Back to top](#table-of-content)

### allowed-release-as-commit-types (Optional)

Type: `string | string[]`  
Default: `"<ALL>"`

List of commit type(s) allowed to trigger `release-as`. Accepts a single string or an array of strings.

**Special values:**

- `"<ALL>"`: Accepts any commit type (default behavior)
- `"<COMMIT_TYPES>"`: Uses the list of commit types defined in [`commit-types`](#commit-types-optional)

You can combine `"<COMMIT_TYPES>"` with other commit types. For example: `["<COMMIT_TYPES>", "chore", "ci", "cd"]` will allow commits with types from `commit-types` plus `"chore"`, `"ci"`, and `"cd"`.

About `release-as`: [README.md → Force a Specific Version](../README.md#force-a-specific-version)

[⬆ Back to top](#table-of-content)

### bump-strategy (Optional)

Type: `object`  
**Properties:** [`bump-minor-for-major-pre-stable`](#bump-strategy--bump-minor-for-major-pre-stable-optional), [`bump-patch-for-minor-pre-stable`](#bump-strategy--bump-patch-for-minor-pre-stable-optional), [`major`](#bump-strategy--major-optional), [`minor`](#bump-strategy--minor-optional), [`patch`](#bump-strategy--patch-optional), [`prerelease`](#bump-strategy--prerelease-optional), [`build`](#bump-strategy--build-optional)

Configuration options that determine how version numbers are calculated.

[⬆ Back to top](#table-of-content)

#### bump-strategy > treat-major-as-minor-pre-stable (Optional)

Type: `boolean`  
Default: `true`

Treats major changes as minor version bumps in pre-1.0 (0.x.x) releases.

[⬆ Back to top](#table-of-content)

#### bump-strategy > treat-minor-as-patch-pre-stable (Optional)

Type: `boolean`  
Default: `true`

Treats minor changes as patch version bumps in pre-1.0 (0.x.x) releases.

[⬆ Back to top](#table-of-content)

#### bump-strategy > major (Optional)

Type: `object`  
Default: [`DEFAULT_MAJOR_BUMP_STRATEGY`](../src/constants/defaults/bump-strategy.ts)

Strategy for major version bumps (x.0.0).

[⬆ Back to top](#table-of-content)

##### > major > types (Optional)

Type: `string[]`

Array of commit types (from base [`commit-types`](#commit-types-optional)) that count toward version bumping.

[⬆ Back to top](#table-of-content)

##### > major > count-breaking-as (Optional)

Type: `"none" | "commit" | "bump"`  
Default: `"commit"`

How to treat breaking changes regardless of `types`.  
Usually this should only be set for a single semver level (major, minor, or patch) to avoid double counting.

[⬆ Back to top](#table-of-content)

##### > major > commits-per-bump (Optional)

Type: `number | string`  
Default: `Infinity`

Number of commits required for each additional bump after the first. Use `Infinity`, `"Infinity"`, or `"infinity"` to always bump once, unless `countBreakingAs` is set to `"bump"`.

Note: In JSON/JSONC files you can use `"Infinity"` or `"infinity"`; in JSON5 you can use `Infinity` directly.

[⬆ Back to top](#table-of-content)

#### bump-strategy > minor (Optional)

Type: `object`  
Default: [`DEFAULT_MINOR_BUMP_STRATEGY`](../src/constants/defaults/bump-strategy.ts)

Strategy for minor version bumps (0.x.0).

[⬆ Back to top](#table-of-content)

##### > minor > same properties as bump-strategy > major`

Same as [`bump-strategy > major`](#bump-strategy--major-optional).

- [`types`](#-major--types-optional)
- [`count-breaking-as`](#-major--count-breaking-as-optional)
- [`commits-per-bump`](#-major--commits-per-bump-optional)

[⬆ Back to top](#table-of-content)

#### bump-strategy > patch (Optional)

Type: `object`  
Default: [`DEFAULT_PATCH_BUMP_STRATEGY`](../src/constants/defaults/bump-strategy.ts)

Strategy for patch version bumps (0.0.x).

[⬆ Back to top](#table-of-content)

##### > patch > same properties as bump-strategy > major`

Same as [`bump-strategy > major`](#bump-strategy--major-optional).

- [`types`](#-major--types-optional)
- [`count-breaking-as`](#-major--count-breaking-as-optional)
- [`commits-per-bump`](#-major--commits-per-bump-optional)

[⬆ Back to top](#table-of-content)

#### bump-strategy > prerelease (Optional)

Type: `object`  
Default: `{}`

Strategy for bumping prerelease version (1.2.3-x.x).

[⬆ Back to top](#table-of-content)

##### > prerelease > enabled (Optional)

Type: `boolean`  
Default: `false`

Enable/disable handling of SemVer extensions (pre-release identifiers / build metadata).

[⬆ Back to top](#table-of-content)

##### > prerelease > override (Optional)

Type: `any[]`

Overrides extension items to use for the next version. When provided, these values take precedence over all other bump rules in `extensions`. Should only be set dynamically, not in static config.

[⬆ Back to top](#table-of-content)

##### > prerelease > treat-override-as-significant (Optional)

Type: `boolean`  
Default: `false`

If set to `true`, the presence of an `override` is strictly treated as a structural change. This immediately triggers resets on any dependent version components (e.g., resetting the Build number). If `false`, overrides are treated as volatile/dynamic and ignored by reset logic.

[⬆ Back to top](#table-of-content)

##### > prerelease > extensions (Optional)

Type: [`SemverExtension[]`](#semverextension)

Specifies the items to use for SemVer extensions.

[⬆ Back to top](#table-of-content)

###### > extensions > type (Required)

Type: `"static" | "dynamic" | "incremental" | "timestamp" | "date"`

The extension type. See [`SemverExtension`](#semverextension) for full configuration details of each type.

[⬆ Back to top](#table-of-content)

#### bump-strategy > build (Optional)

Type: `object`  
Default: `{}`

Strategy for bumping build metadata (1.2.3+x.x).

[⬆ Back to top](#table-of-content)

##### > build > same properties as bump-strategy > prereleasee`

Same as [`bump-strategy > prerelease`](#bump-strategy--prerelease-optional).

- [`enabled`](#-prerelease--enabled-optional)
- [`override`](#-prerelease--override-optional)
- [`treat-override-as-significant`](#-prerelease--treat-override-as-significant-optional)
- [`extensions`](#-prerelease--extensions-optional)

[⬆ Back to top](#table-of-content)

### changelog (Optional)

Type: `object`  
**Properties:** [`write-to-file`](#changelog--write-to-file-optional), [`path`](#changelog--path-optional), [`commit-group-mode`](#changelog--commit-group-mode-optional), [`commit-sort-order`](#changelog--commit-sort-order-optional), [`file-header-template`](#changelog--file-header-template-optional), [`file-header-template-path`](#changelog--file-header-template-path-optional), [`file-release-template`](#changelog--file-release-template-optional), [`file-release-template-path`](#changelog--file-release-template-path-optional), [`file-footer-template`](#changelog--file-footer-template-optional), [`file-footer-template-path`](#changelog--file-footer-template-path-optional), [`release-header-template`](#changelog--release-header-template-optional), [`release-header-template-path`](#changelog--release-header-template-path-optional), [`release-section-heading-template`](#changelog--release-section-heading-template-optional), [`release-section-entry-template`](#changelog--release-section-entry-template-optional), [`release-section-entry-template-path`](#changelog--release-section-entry-template-path-optional), [`release-breaking-section-heading`](#changelog--release-breaking-section-heading-optional), [`release-breaking-section-entry-template`](#changelog--release-breaking-section-entry-template-optional), [`release-breaking-section-entry-template-path`](#changelog--release-breaking-section-entry-template-path-optional), [`release-footer-template`](#changelog--release-footer-template-optional), [`release-footer-template-path`](#changelog--release-footer-template-path-optional), [`release-body-override`](#changelog--release-body-override-optional), [`release-body-override-path`](#changelog--release-body-override-path-optional), [`release-header-template-alt`](#changelog--release-header-template-alt-optional), [`release-header-template-alt-path`](#changelog--release-header-template-alt-path-optional), [`release-section-heading-template-alt`](#changelog--release-section-heading-template-alt-optional), [`release-section-entry-template-alt`](#changelog--release-section-entry-template-alt-optional), [`release-section-entry-template-alt-path`](#changelog--release-section-entry-template-alt-path-optional), [`release-breaking-section-heading-alt`](#changelog--release-breaking-section-heading-alt-optional), [`release-breaking-section-entry-template-alt`](#changelog--release-breaking-section-entry-template-alt-optional), [`release-breaking-section-entry-template-alt-path`](#changelog--release-breaking-section-entry-template-alt-path-optional), [`release-body-override-alt`](#changelog--release-body-override-alt-optional), [`release-body-override-alt-path`](#changelog--release-body-override-alt-path-optional), [`release-footer-template-alt`](#changelog--release-footer-template-alt-optional), [`release-footer-template-alt-path`](#changelog--release-footer-template-alt-path-optional)

Configuration specific to changelogs. All generated changelog content are available in string templates as `{{ changelogRelease }}` (release header + body) or `{{ changelogReleaseHeader }}` and `{{ changelogReleaseBody }}`.

[⬆ Back to top](#table-of-content)

#### changelog > write-to-file (Optional)

Type: `boolean`  
Default: `true`

Enable/disable writing changelog to file. When disabled, changelogs are still generated for proposals, releases and [string templates](./string-templates-and-patterns.md) but they won't be written to file.

[⬆ Back to top](#table-of-content)

#### changelog > path (Optional)

Type: `string`  
Default: `"CHANGELOG.md"`

Path to the file where the generated changelog will be written to, relative to the project root.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > commit-group-mode (Optional)

Type: `"none" | "scope-first" | "scope-last"`  
Default: `"none"`

Defines how commits are sub-grouped within their respective changelog sections (Features, Fixes, etc.).

- **"none":** Commits are rendered as a single flat list.
- **"scope-first":** Commits are grouped by their scope. Scoped groups appear at the top, and unscoped commits fall to the bottom.
- **"scope-last":** Commits are grouped by their scope. Unscoped commits sit at the top, and scoped groups follow below.

[⬆ Back to top](#table-of-content)

#### changelog > commit-sort-order (Optional)

Type: `"alphabetical" | "oldest-first" | "newest-first"`  
Default: `"alphabetical"`

Defines the sorting algorithm used to order the commits (and their groups, if a grouping mode is used).

- **"alphabetical":** Sorts alphabetically from A to Z.
- **"newest-first":** Sorts by commit timestamp, placing the newest commits at the top.
- **"oldest-first":** Sorts by commit timestamp, placing the oldest commits at the top.

[⬆ Back to top](#table-of-content)

#### changelog > file-header-template (Optional)

Type: `string`  
Default: [`DEFAULT_CHANGELOG_FILE_HEADER_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for changelog file header, using with string patterns like `{{ nextVersion }}`. Placed above any changelog content.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### changelog > file-header-template-path (Optional)

Type: `string`

Path to text file containing changelog file header. Overrides `file-header-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > file-release-template (Optional)

Type: `string`  
Default: [`DEFAULT_CHANGELOG_RELEASE_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for the individual release block inserted into the changelog file.  
To use your alternative configuration, set this to `"{{ changelogReleaseAlt }}"`.

[⬆ Back to top](#table-of-content)

#### changelog > file-release-template-path (Optional)

Type: `string`

Path to text file containing changelog release template. Overrides `file-release-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > file-footer-template (Optional)

Type: `string`

String template for changelog file footer, using with string patterns like `{{ nextVersion }}`. Placed below any changelog content.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### changelog > file-footer-template-path (Optional)

Type: `string`

Path to text file containing changelog file footer. Overrides `file-footer-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-header-template (Optional)

Type: `string`  
Default: `"## {{ tagName | md_link_compare_tag_from_current_to_latest }} ({{- YYYY }}-{{ MM }}-{{ DD }}) <!-- time-zone: {{ timeZone }} -->"`

String template for header of a changelog release, using with string patterns like `{{ nextVersion }}`.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### changelog > release-header-template-path (Optional)

Type: `string`

Path to text file containing changelog release header. Overrides `release-header-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-section-heading-template (Optional)

Type: `string`  
Default: [`DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for heading of a changelog release section, using with string patterns like `{{ section }}`.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

Additionally, you can use a special dynamic pattern (see [patterns docs](./string-templates-and-patterns.md#changelog-section-heading) for more details):

- `{{ section }}`: string
- `{{ sectionAlt }}`: string

[⬆ Back to top](#table-of-content)

#### changelog > release-section-heading-template-path (Optional)

Type: `string`

Path to text file containing changelog release section heading template. Overrides `release-section-heading-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-section-entry-template (Optional)

Type: `string`  
Default: [`DEFAULT_RELEASE_SECTION_ENTRY_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for each entries in the changelog release sections.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns) and [dynamic patterns](./string-templates-and-patterns.md#dynamic-string-patterns).

Additionally, you can use a special set of dynamic patterns (see [patterns docs](./string-templates-and-patterns.md#changelog-entries) for more details):

- `{{ commit }}`: string
- `{{ hash }}`: string
- `{{ type }}`: string
- `{{ scope }}`: string
- `{{ desc }}`: string
- `{{ body }}`: string
- `{{ footer }}`: string
- `{{ breakingDesc }}`: string
- `{{ isBreaking }}`: boolean
- `{{ authorName }}`: string
- `{{ authorEmail }}`: string
- `{{ authorDate }}`: string
- `{{ committerName }}`: string
- `{{ committerEmail }}`: string
- `{{ committerDate }}`: string

[⬆ Back to top](#table-of-content)

#### changelog > release-section-entry-template-path (Optional)

Type: `string`

Path to text file containing changelog release section entry template. Overrides `release-section-entry-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-breaking-section-heading (Optional)

Type: `string`  
Default: `"⚠ BREAKING CHANGES"`

Heading of a changelog release BREAKING section.

[⬆ Back to top](#table-of-content)

#### changelog > release-breaking-section-entry-template (Optional)

Type: `string`  
Default: [`DEFAULT_RELEASE_BREAKING_SECTION_ENTRY_TEMPLATE`](../src/constants/defaults/string-templates.ts)

Basically the same as `release-section-entry-template`, but for breaking changes specifically. If not provided, falls back to `release-section-entry-template`.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns) and [dynamic patterns](./string-templates-and-patterns.md#dynamic-string-patterns).

[⬆ Back to top](#table-of-content)

#### changelog > release-breaking-section-entry-template-path (Optional)

Type: `string`

Path to text file containing changelog release breaking section entry template. Overrides `release-breaking-section-entry-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-body-override (Optional)

Type: `string`

User-provided changelog release body, available in string templates as `{{ changelogReleaseBody }}`. If set, completely ignores the built-in generation and uses this value as the content. Should only be set dynamically, not in static config.

[⬆ Back to top](#table-of-content)

#### changelog > release-body-override-path (Optional)

Type: `string`

Path to text file containing changelog release body override, will take precedence over `release-body-override`.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-footer-template (Optional)

Type: `string`

String template for footer of a changelog release, using with string patterns.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### changelog > release-footer-template-path (Optional)

Type: `string`

Path to text file containing changelog release footer. Overrides `release-footer-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-header-template-alt (Optional)

Type: `string`

Alternative value for [`release-header-template`](#changelog--release-header-template-optional). When not provided, fall back to the original.

[⬆ Back to top](#table-of-content)

#### changelog > release-header-template-alt-path (Optional)

Type: `string`

Path to text file containing alternative changelog release header. Overrides `release-header-template-alt` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-section-heading-template-alt (Optional)

Type: `string`  
Default: [`DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE_ALT`](../src/constants/defaults/string-templates.ts)

String template for alternative heading of a changelog release section. Allowed string patterns and special dynamic patterns are the same as [`release-section-heading-template`](#changelog--release-section-heading-template-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-section-heading-template-alt-path (Optional)

Type: `string`

Path to text file containing alternative changelog release section heading template. Overrides `release-section-heading-template-alt` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-section-entry-template-alt (Optional)

Type: `string`

Alternative value for [`release-section-entry-template`](#changelog--release-section-entry-template-optional). When not provided, fall back to the original.

[⬆ Back to top](#table-of-content)

#### changelog > release-section-entry-template-alt-path (Optional)

Type: `string`

Path to text file containing alternative changelog release section entry template. Overrides `release-section-entry-template-alt` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-breaking-section-heading-alt (Optional)

Type: `string`

Alternative value for [`release-breaking-section-heading`](#changelog--release-breaking-section-heading-optional). When not provided, fall back to the original.

[⬆ Back to top](#table-of-content)

#### changelog > release-breaking-section-entry-template-alt (Optional)

Type: `string`

Alternative value for [`release-breaking-section-entry-template`](#changelog--release-breaking-section-entry-template-optional). When not provided, fall back to the original.

[⬆ Back to top](#table-of-content)

#### changelog > release-breaking-section-entry-template-alt-path (Optional)

Type: `string`

Path to text file containing alternative changelog release breaking section entry template. Overrides `release-breaking-section-entry-template-alt` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-body-override-alt (Optional)

Type: `string`

Alternative value for [`release-body-override`](#changelog--release-body-override-optional). When not provided, fall back to the original.

[⬆ Back to top](#table-of-content)

#### changelog > release-body-override-alt-path (Optional)

Type: `string`

Path to text file containing alternative changelog release body override. Overrides `release-body-override-alt` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### changelog > release-footer-template-alt (Optional)

Type: `string`

Alternative value for [`release-footer-template`](#changelog--release-footer-template-optional). When not provided, fall back to the original.

[⬆ Back to top](#table-of-content)

#### changelog > release-footer-template-alt-path (Optional)

Type: `string`

Path to text file containing alternative changelog release footer. Overrides `release-footer-template-alt` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

### commit (Optional)

Type: `object`  
**Properties:** [`local-changes-to-commit`](#commit--local-changes-to-commit-optional), [`header-template`](#commit--header-template-optional), [`header-template-path`](#commit--header-template-path-optional), [`body-template`](#commit--body-template-optional), [`body-template-path`](#commit--body-template-path-optional), [`footer-template`](#commit--footer-template-optional), [`footer-template-path`](#commit--footer-template-path-optional)

Configuration specific to commits. These templates are used to build the commit message when Zephyr Release creates a commit.

[⬆ Back to top](#table-of-content)

#### commit > local-changes-to-commit (Optional)

Type: `string | string[]`

Additional local changes to include in the commit (add, modify, or delete files). Accepts a path or an array of paths/globs. Paths are relative to the repo root.

To include all changes, you can use a glob pattern such as `"**/*"`.

[⬆ Back to top](#table-of-content)

#### commit > header-template (Optional)

Type: `string`  
Default: [`DEFAULT_COMMIT_HEADER_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for commit header, using with string patterns like `{{ nextVersion }}`. You can optionally include a CI skip token here (or body/footer) to prevent downstream pipeline runs (e.g., `[skip ci]` or `[ci skip]` for GitHub, GitLab, and Bitbucket).  
Allowed patterns to use are: [all fixed and dynamic string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### commit > header-template-path (Optional)

Type: `string`

Path to text file containing commit header template. Overrides `header-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### commit > body-template (Optional)

Type: `string`

String template for commit body, using with string patterns like `{{ changelogRelease }}`. You can optionally include a CI skip token here (or header/footer) to prevent downstream pipeline runs (e.g., `[skip ci]` or `[ci skip]` for GitHub, GitLab, and Bitbucket).  
Allowed patterns to use are: [all fixed and dynamic string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### commit > body-template-path (Optional)

Type: `string`

Path to text file containing commit body template. Overrides `body-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### commit > footer-template (Optional)

Type: `string`

String template for commit footer, using with string patterns. You can optionally include a CI skip token here (or header/body) to prevent downstream pipeline runs (e.g., `[skip ci]` or `[ci skip]` for GitHub, GitLab, and Bitbucket).  
Allowed patterns to use are: [all fixed and dynamic string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### commit > footer-template-path (Optional)

Type: `string`

Path to text file containing commit footer template. Overrides `footer-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

### tag (Optional)

Type: `object`  
**Properties:** [`create-tag`](#tag--create-tag-optional), [`name-template`](#tag--name-template-optional), [`type`](#tag--type-optional), [`message-template`](#tag--message-template-optional), [`message-template-path`](#tag--message-template-path-optional), [`tagger`](#tag--tagger-optional)

Configuration specific to tags.

[⬆ Back to top](#table-of-content)

#### tag > create-tag (Optional)

Type: `boolean`  
Default: `true`

Enable/disable tag creation. If disabled, create release note will also be skipped.

[⬆ Back to top](#table-of-content)

#### tag > name-template (Optional)

Type: `string`  
Default: [`DEFAULT_TAG_NAME_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for tag name, using with string patterns like `{{ nextVersion }}`. Available in [string templates](./string-templates-and-patterns.md) as `{{ tagName }}`.  
Allowed patterns to use in template are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns) (except `{{ tagName }}` itself).

[⬆ Back to top](#table-of-content)

#### tag > type (Optional)

Type: `"lightweight" | "annotated" | "signed"`  
Default: `"lightweight"`

The type of Git tag to create.

- **`lightweight`**: Creates a simple tag without a message or identity.
- **`annotated`**: Creates a tag with a message, date, and tagger identity. (A tag message is required).
- **`signed`**: Creates an annotated tag cryptographically signed with GPG or SSH. (A tag message is required).

**Important Notes for Signed Tags:**

Zephyr Release intentionally does not manage, accept, or process private cryptographic keys. To use `"signed"`, you must independently configure the Git CLI in your CI runner environment *before* Zephyr Release executes.

It is highly recommended to use established CI integrations or native pipeline steps in an earlier pipeline stage to import your keys, rather than attempting to script the setup using `command-hooks`. This keeps your private secrets safely isolated from the release configuration.

Furthermore, if you are using temporary or shared cloud runners, you should always include a final cleanup step in your CI pipeline to securely wipe the private key from the machine after Zephyr Release completes, regardless of whether the operation succeeds or fails.

[⬆ Back to top](#table-of-content)

#### tag > message-template (Optional)

Type: `string`  
Default: [`DEFAULT_TAG_MESSAGE_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for the Git annotated or signed tag message.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### tag > message-template-path (Optional)

Type: `string`

Path to text file containing Git annotated or signed tag message template. Overrides `message-template` when both are provided.
To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### tag > tagger (Optional)

Type: `object`

Custom identity and timestamp information for the Git tag. If omitted, defaults to the platform native behavior.

[⬆ Back to top](#table-of-content)

##### > tagger > name (Required)

Type: `string`

The name of the tag creator.

[⬆ Back to top](#table-of-content)

##### > tagger > email (Required)

Type: `string`

The email of the tag creator.

[⬆ Back to top](#table-of-content)

##### > tagger > date (Optional)

Type: `string`

Override the Git tag timestamp.  
Can be one of these options:

- `"now"`: The moment the operation creates the tag.
- `"commit-date"`: The Git committer date.
- `"author-date"`: The Git author date.
- Or a specific ISO 8601 date string.  
If omitted, defaults to the platform native behavior (recommended).

[⬆ Back to top](#table-of-content)

### release (Optional)

Type: `object`  
**Properties:** [`create-release`](#release--create-release-optional), [`prerelease`](#release--prerelease-optional), [`draft`](#release--draft-optional), [`set-latest`](#release--set-latest-optional), [`title-template`](#release--title-template-optional), [`title-template-path`](#release--title-template-path-optional), [`header-template`](#release--header-template-optional), [`header-template-path`](#release--header-template-path-optional), [`body-template`](#release--body-template-optional), [`body-template-path`](#release--body-template-path-optional), [`footer-template`](#release--footer-template-optional), [`footer-template-path`](#release--footer-template-path-optional), [`assets`](#release--assets-optional)

Configuration specific to releases.

[⬆ Back to top](#table-of-content)

#### release > create-release (Optional)

Type: `boolean`  
Default: `true`

Enable/disable release creation.

[⬆ Back to top](#table-of-content)

#### release > prerelease (Optional)

Type: `boolean`  
Default: `false`

If enabled, the release will be marked as prerelease.

[⬆ Back to top](#table-of-content)

#### release > draft (Optional)

Type: `boolean`  
Default: `false`

If enabled, the release will be created as draft.

[⬆ Back to top](#table-of-content)

#### release > set-latest (Optional)

Type: `boolean`  
Default: `true`

If enabled, the release will be set as the latest release.

[⬆ Back to top](#table-of-content)

#### release > title-template (Optional)

Type: `string`  
Default: [`DEFAULT_RELEASE_TITLE_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for release note title, using with string patterns like `{{ tagName }}`.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### release > title-template-path (Optional)

Type: `string`

Path to text file containing release title template. Overrides `title-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### release > header-template (Optional)

Type: `string`

String template for release note header, using with string patterns.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### release > header-template-path (Optional)

Type: `string`

Path to text file containing release header template. Overrides `header-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### release > body-template (Optional)

Type: `string`  
Default: [`DEFAULT_RELEASE_BODY_TEMPLATE`](../src/constants/defaults/string-templates.ts)

String template for release note body, using with string patterns like `{{ changelogRelease }}`.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### release > body-template-path (Optional)

Type: `string`

Path to text file containing release body template. Overrides `body-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### release > footer-template (Optional)

Type: `string`

String template for release note footer, using with string patterns.  
Allowed patterns to use are: [all string patterns](./string-templates-and-patterns.md#available-string-patterns).

[⬆ Back to top](#table-of-content)

#### release > footer-template-path (Optional)

Type: `string`

Path to text file containing release footer template. Overrides `footer-template` when both are provided.

To customize whether this file is fetched locally or remotely, see [source mode](./input-options.md#source-mode-optional).

[⬆ Back to top](#table-of-content)

#### release > assets (Optional)

Type: `string | string[]`

List of local asset path(s) to attach to the release. Accepts a single string or an array of strings. Paths are relative to the repository root.

[⬆ Back to top](#table-of-content)

### command-hooks (Optional)

Type: `object`  
**Properties:** [`base`](#command-hooks--base-optional), [`prepare`](#command-hooks--prepare-optional), [`publish`](#command-hooks--publish-optional)

Command hooks to run at different phases of the operation. Each command runs from the repository root.

[⬆ Back to top](#table-of-content)

#### command-hooks > base (Optional)

Type: `object`

Pre/post commands to run around the main operation. Each command runs from the repository root.  
Post commands will always run regardless of operation outcome (success, skipped or failure). It is recommended to check the outcome export variable if your script should only run under specific conditions.  
Available variables that cmds can use: see [Export operation variables](./export-variables.md).

[⬆ Back to top](#table-of-content)

##### > base > timeout (Optional)

Type: `number | string`  
Default: `60000` (1 min)

Base default timeout (ms) for all commands in `pre` and `post`, can be overridden per command. Use `Infinity`, `"Infinity"`, or `"infinity"` to never timeout (not recommended).

[⬆ Back to top](#table-of-content)

##### > base > continue-on-error (Optional)

Type: `boolean`  
Default: `false`

Base default behavior for all commands in `pre` and `post`, can be overridden per command.

[⬆ Back to top](#table-of-content)

##### > base > pre (Optional)

Type: `(string | object)[]`

Commands to run before the operation.  
Each command can be either a `string` or an `object`.  
List of exposed env variables: see [Export operation variables](./export-variables.md).

[⬆ Back to top](#table-of-content)

###### > pre > cmd (Required)

Type: `string`

The command string to execute.

[⬆ Back to top](#table-of-content)

###### > pre > timeout (Optional)

Type: `number | string`  
Default: Base default timeout

Timeout in milliseconds, use Infinity to never timeout (not recommended).

[⬆ Back to top](#table-of-content)

###### > pre > continue-on-error (Optional)

Type: `boolean`  
Default: Base default continue-on-error

Continue or stop the process on commands error.

[⬆ Back to top](#table-of-content)

##### > base > post (Optional)

Type: `(string | object)[]`

Commands to run after the operation.  
Each command can be either a `string` or an `object`.  
List of exposed env variables: see [Export operation variables](./export-variables.md).

[⬆ Back to top](#table-of-content)

###### > post > same properties as command-hooks > base > pree`

Same as [`command-hooks > base > pre`](#-base--pre-optional).

- [`cmd`](#-pre--cmd-required)
- [`timeout`](#-pre--timeout-optional)
- [`continue-on-error`](#-pre--continue-on-error-optional)

[⬆ Back to top](#table-of-content)

#### command-hooks > prepare (Optional)

Type: `object`

Pre/post commands to run around the proposal (PR, MR, ...) operation. Each command runs from the repository root.  
Available variables that cmds can use: see [Export operation variables](./export-variables.md).

[⬆ Back to top](#table-of-content)

##### > prepare > same properties as command-hooks > basee`

Same as [`command-hooks > base`](#command-hooks--base-optional).

- [`timeout`](#-base--timeout-optional)
- [`continue-on-error`](#-base--continue-on-error-optional)
- [`pre`](#-base--pre-optional)
- [`post`](#-base--post-optional)

[⬆ Back to top](#table-of-content)

#### command-hooks > publish (Optional)

Type: `object`

Pre/post commands to run around the release operation. Each command runs from the repository root.  
Available variables that cmds can use: see [Export operation variables](./export-variables.md).

[⬆ Back to top](#table-of-content)

##### > publish > same properties as command-hooks > basee`

Same as [`command-hooks > base`](#command-hooks--base-optional).

- [`timeout`](#-base--timeout-optional)
- [`continue-on-error`](#-base--continue-on-error-optional)
- [`pre`](#-base--pre-optional)
- [`post`](#-base--post-optional)

[⬆ Back to top](#table-of-content)

### runtime-config-override (Optional)

Type: `object`  
**Properties:** [`path`](#runtime-config-override--path-required), [`format`](#runtime-config-override--format-optional)

A dynamic configuration file to deep-merge over the resolved config at runtime, typically generated by a [`command-hooks`](#command-hooks-optional) script.

This file is always read from the local filesystem. If the file does not exist or is empty, it is safely ignored. However, if the file exists but the merged result fails schema validation, the operation will throw an error.

**Immutable Fields:** For security and structural consistency, certain core fields are protected and cannot be overridden at runtime. Any values provided for these fields in the override file will be ignored, and the original configuration values will be preserved.

Currently protected fields:

- [`review > working-branch-name-template`](#review--working-branch-name-template-optional)

[⬆ Back to top](#table-of-content)

#### runtime-config-override > path (Required)

Type: `string`

Path to the runtime override config file, read from the local filesystem.

[⬆ Back to top](#table-of-content)

#### runtime-config-override > format (Optional)

Type: `string`  
Default: `"auto"`

Config file format. Allowed values: `auto`, `json`, `jsonc`, `json5`, `yaml`, `toml`.

[⬆ Back to top](#table-of-content)

## Type Definitions

### AutoStrategy

A discriminated union based on the `type` field. Defines the strategy for automatically triggering releases when [`mode`](#mode-optional) is set to `"auto"`.

**Type: `"commit-types"`** - Triggers a release automatically when the pushed commits contain specific allowed types.

- `type` (Required): `"commit-types"`
- `allowed-types` (Optional): Allowed commit types (a string or array of strings) that can trigger a release, must be chosen from the base [`commit-types`](#commit-types-optional). If omitted, all types in the base `commit-types` are allowed.
- `min-commit-count` (Optional): The minimum number of unreleased matching commits required to trigger a release. Accepts a single number for a global count, or an object mapping specific commit types to their own minimum counts. When using object, thresholds are evaluated using OR logic, the release triggers if ANY of the specified counts are met. Default: `1`
- `require-breaking` (Optional): If set to `true`, an auto-release will ONLY trigger if at least one of the matching commits contains a breaking change. Default: `false`

**Type: `"commit-footer"`** - Triggers a release automatically when a specific token is found in the commit footers.

- `type` (Required): `"commit-footer"`
- `token` (Required): The conventional commit footer token to look for (e.g., `"Autorelease"`).
- `value` (Optional): The specific value the footer token must have (e.g., `"true"`). If omitted, only the token's presence is required.

**Type: `"flag"`** - Triggers a release based on a strict boolean flag. Ideal for dynamic configuration overrides and custom script evaluations. The strategy will be evaluated after the cmd hooks `base.pre` and `prepare.pre` run.

- `type` (Required): `"flag"`
- `value` (Optional): A hardcoded boolean flag to explicitly force or skip the release trigger. Default: `false`

[⬆ Back to top](#table-of-content)

### SemverExtension

A discriminated union based on the `type` field. Specifies the type of pre-release/build identifier/metadata.

**Type: `"static"`** - A stable label that should not change often.

- `type` (Required): `"static"`
- `value` (Required): The static string value to use. Examples: `"pre"`, `"alpha"`, `"beta"`, `"rc"`.

**Type: `"dynamic"`** - A label value that often changes per build or commit, usually sourced externally (e.g., git hash, branch name).

- `type` (Required): `"dynamic"`
- `value` (Optional): The string value to use, should be set dynamically.
- `fallback-value` (Optional): The fallback string value used when `value` is empty. If this is also empty, the identifier/metadata will be omitted from the array.

**Type: `"incremental"`** - Integer value that auto-increments by 1.

- `type` (Required): `"incremental"`
- `initial-value` (Optional): Initial integer number value. The value will auto-increment by 1 on each bump. Default: `0`
- `reset-on` (Optional): Resets the incremental value when the specified version component(s) change, could be a single or an array of options. Allowed values: `"major"`, `"minor"`, `"patch"`, `"prerelease"`, `"build"`, and `"none"`. For `"prerelease"` and `"build"`, a reset is triggered only when `"static"` values change, or when `"static"`, `"incremental"`, `"timestamp"` or `"date"` values are added or removed. Any changes to `"dynamic"` values, including their addition or removal, do not trigger a reset. Default: `"none"`

**Type: `"timestamp"`** - Integer value that changes over time, representing a specific point in time since January 1, 1970 (UTC).

- `type` (Required): `"timestamp"`
- `unit` (Optional): The time unit. `"ms"` (13 digits) or `"s"` (10 digits). Default: `"ms"`

**Type: `"date"`** - A date string that changes over time.

- `type` (Required): `"date"`
- `format` (Optional): The date format. `"YYYYMMDD"` or `"YYYY-MM-DD"`. Default: `"YYYYMMDD"`
- `time-zone` (Optional): The timezone to use for the date. If not specified, falls back to base [`time-zone`](#time-zone-optional).

[⬆ Back to top](#table-of-content)
