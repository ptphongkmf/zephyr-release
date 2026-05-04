# String Templates and Patterns

Documentation for working with string templates and string patterns.

To inject values into your templates, put [patterns](#available-string-patterns) inside `{{ }}` brackets. You can also transform these values using  [transformers](#transformers) with the pipe symbol `|`.

Example:

- [Proposal title template](./config-options.md#review--title-template-optional): `chore: release {{ name | upper }} version {{ nextVersion }}`
- [Tag template](./config-options.md#tag--name-template-optional): `v{{ nextVersion }}`

<br>

Under the hood, Zephyr Release uses **LiquidJS** as the template engine. For more advanced usages, refer to the [LiquidJS official documentation](https://liquidjs.com/tutorials/intro-to-liquid.html).

Zephyr Release engine options

```typescript
export const liquidEngine = new Liquid({ jsTruthy: true });
```

## Available String Patterns

These patterns let you inject dynamic values into your templates. Because Zephyr Release runs in several stages, certain patterns are only available after specific phases.

### Lifecycle Overview

#### Base (available at all time)

These patterns are available starting from the bootstrap phase, meaning they can be used across the entire release operation.

- Custom Patterns
- name, host, namespace, repository, commitPathPart, referencePathPart
- triggerBranchName, workingBranchName
- timeZone
- timestamp, YYYY, MM, DD, HH, mm, ss (Fixed)
- nowTimestamp, nowYYYY, nowMM, nowDD, nowHH, nowmm, nowss (Dynamic)

#### Prepare Phase

These patterns become available sequentially as the prepare operation (managing proposals or automated commits) progresses:

Available after resolving commits and calculating the versions:

- currentVersion, nextVersion (and their components like **Core**, **Pre**, **Bld**)
- tagName

Available after generating the changelog release content based on the resolved commits:

- changelogRelease, changelogReleaseBody, changelogReleaseAlt, changelogReleaseBodyAlt

#### Publish Phase

These patterns become available sequentially when merging a proposal and triggering the actual platform release:

Available after extracting the changelog from the proposal body or re-generating the changelog:

- changelogRelease, changelogReleaseBody, changelogReleaseAlt, changelogReleaseBodyAlt

Available after extracting the next version natively from the primary version file in the codebase:

- nextVersion (and its components like **Core**, **Pre**, **Bld**)
- tagName

### Pattern Details

#### Custom Patterns

Custom string patterns defined in your configuration file using the [`custom-string-patterns`](./config-options.md#custom-string-patterns-optional) option. If a custom pattern key matches a built-in pattern, the built-in takes priority and your custom one is ignored. Usage: `{{ yourCustomKey }}`.

### Fixed String Patterns  

These string patterns are resolved at runtime and remain fixed for the lifetime of the process.

#### Base

- **Custom Patterns**: Custom string patterns defined in your configuration file using the [`custom-string-patterns`](./config-options.md#custom-string-patterns-optional) option. `{{ yourCustomKey }}`.

<br>

- `{{ name }}`: Project name (set via [`name`](./config-options.md#name-optional))
- `{{ host }}`: Repository host
- `{{ namespace }}`: Repository namespace (organization or user)
- `{{ repository }}`: Repository name
- `{{ commitPathPart }}`: The commit part of the url
- `{{ referencePathPart }}`: The reference part of the url

<br>

- `{{ triggerBranchName }}`: The trigger branch name
- `{{ workingBranchName }}`: the working branch name

<br>

- `{{ timeZone }}`: IANA time zone (set via [`time-zone`](./config-options.md#time-zone-optional))

#### Datetime

- `{{ timestamp }}`: Timestamp at script start time, always UTC
- `{{ YYYY }}`, `{{ MM }}`, `{{ DD }}`, `{{ HH }}`, `{{ mm }}`, `{{ ss }}`: Date/time components at script start time

#### Current Version

Only available in "auto" mode or "review" mode propose operation. Can be undefined if the project has no version yet (the calculated version is initial version)

- `{{ currentVersion }}`: The current full semantic version (SemVer)
- `{{ currentVersionCore }}`: The current core part of the semantic version (major.minor.patch)
- `{{ currentVersionPre }}`: The current prerelease identifier of the semantic version
- `{{ currentVersionBld }}`: The current build metadata of the semantic version

#### Next Version (and tag)

- `{{ nextVersion }}`: The calculated next full semantic version (SemVer)
- `{{ nextVersionCore }}`: The calculated next core part of the semantic version (major.minor.patch)
- `{{ nextVersionPre }}`: The calculated next prerelease identifier of the semantic version
- `{{ nextVersionBld }}`: The calculated next build metadata of the semantic version

<br>

- `{{ tagName }}`: Tag name (set via [`tag-name-template`](./config-options.md#tag--name-template-optional))

### Dynamic String Patterns

These string patterns are resolved dynamically at runtime and may change each time they are used.

#### Changelog

- `{{ changelogRelease }}`: In `propose` operation (managing proposals), the generated changelog content section is [release header](./config-options.md#changelog--release-header-template-optional) + body (generated from resolved commits) + [release footer](./config-options.md#changelog--release-footer-template-optional). In `release` operation (create tag and publish release), the value is the **proposal body** (this means any edits made to the proposal body will also be included). If, however, [release-body-override](./config-options.md#changelog--release-body-override-optional) (or [release-body-override-path](./config-options.md#changelog--release-body-override-path-optional)) is provided, the value will be re-evaluated to [release header](./config-options.md#changelog--release-header-template-optional) + body override + [release footer](./config-options.md#changelog--release-footer-template-optional)

- `{{ changelogReleaseBody }}`: The generated changelog release body. You can override it dynamically via [release-body-override](./config-options.md#changelog--release-body-override-optional) (or [release-body-override-path](./config-options.md#changelog--release-body-override-path-optional)). In `release` operation (create tag and publish release), this value is undefined if no override provided.

- `{{ changelogReleaseAlt }}`: An alternative value for `{{ changelogRelease }}`. It is computed by combining the alternative header ([`release-header-template-alt`](./config-options.md#changelog--release-header-template-alt-optional)), the alternative body, and the alternative footer ([`release-footer-template-alt`](./config-options.md#changelog--release-footer-template-alt-optional)). It is useful when a distinct style of release notes (such as a "lite" version) is required alongside the standard output. If no alternative templates are defined, it falls back to the original `{{ changelogRelease }}` content.

- `{{ changelogReleaseBodyAlt }}`: An alternative value for `{{ changelogReleaseBody }}`. It is computed using alternative section-level templates like [`release-section-heading-template-alt`](./config-options.md#changelog--release-section-heading-template-alt-optional) or [`release-section-entry-template-alt`](./config-options.md#changelog--release-section-entry-template-alt-optional). It can also be overridden via [`release-body-override-alt`](./config-options.md#changelog--release-body-override-alt-optional) or [`release-body-override-alt-path`](./config-options.md#changelog--release-body-override-alt-path-optional). If no alternative configuration is provided, it falls back to the original `{{ changelogReleaseBody }}` content.

#### Datetime (now)

- `{{ nowTimestamp }}`: Timestamp at NOW, always UTC
- `{{ nowYYYY }}`, `{{ nowMM }}`, `{{ nowDD }}`, `{{ nowHH }}`, `{{ nowmm }}`, `{{ nowss }}`: Date/time components at NOW

### Special String Patterns

These are special patterns that are only available to certain templates. Make sure to check the template description to see which templates explicitly support these patterns.

#### Changelog Section Heading

Usage: [`release-section-heading-template`](./config-options.md#changelog--release-section-heading-template-optional)

- `{{ section }}`: string; the section names defined in [`commit-types`](./config-options.md#commit-types-optional) (e.g., "Features", "Bug Fixes")
- `{{ sectionAlt }}`: string; the alternative section names (fall back to section) defined in [`commit-types`](./config-options.md#commit-types-optional)

#### Changelog Entries

Usage: [`release-section-entry-template`](./config-options.md#changelog--release-section-entry-template-optional) and [`release-breaking-section-entry-template`](./config-options.md#changelog--release-breaking-section-entry-template-optional)

- `{{ commit }}`: The full parsed and resolved commit object. See [ResolvedCommit](../src/tasks/commit.ts#L34-L41) for the structure
- `{{ hash }}`: string; commit hash
- `{{ type }}`: string; commit type
- `{{ scope }}`: string; commit scope
- `{{ desc }}`: string; commit description, the text after ":" in commit header
- `{{ body }}`: string; commit body, can span multiple paragraphs
- `{{ footer }}`: string; commit footer
- `{{ breakingDesc }}`: string; breaking change description. It is the text of the last breaking change footer, or falls back to the commit description if none exist
- `{{ isBreaking }}`: boolean
- `{{ authorName }}`: string; the name of the author
- `{{ authorEmail }}`: string; the email of the author
- `{{ authorDate }}`: string; the date the author made the commit in ISO format
- `{{ committerName }}`: string; the name of the committer
- `{{ committerEmail }}`: string; the email of the committer
- `{{ committerDate }}`: string; the date the committer applied the commit in ISO format

## Transformers

Transformers modify or transform the values of string patterns using the pipe symbol `|`. You can apply transformers to format, manipulate, or process pattern values in your templates.

Usage: `{{ <value> | <transformers>: <arg1>, <arg2>, ...  }}`

### Zephyr Release Transformers

Custom transformers.

- `wrap_compare_tag: tag1, tag2`: Wraps the current text in a markdown link that compares `tag1` with `tag2`
  - tag1: `string`
  - tag2: `string`
  - Usage: `{{ text | wrap_compare_tag: tag1, tag2 }}`

- `wrap_compare_latest_tag: currentTag, skip`: Wraps the current text in a markdown link comparing the current given tag to the latest tag. If the repository has no prior tags (first release), the text is returned as-is. Otherwise, if `skip` exceeds the number of available tags, an error is thrown
  - currentTag: `string`
  - skip (optional): `number` (positive integer), `DEFAULT: 0`  
    how many tags back from the latest tag to compare against (`0` = latest tag, `1` = tag before the latest, etc.)
  - Usage: `{{ text | wrap_compare_latest_tag: currentTag, skip }}` or `{{ text | wrap_compare_latest_tag: currentTag }}`

- `format_commit_references: commit`: Formats the current text to find references (like #12) and transforms them into markdown links using the provided commit context. Usually used for [entry template](./config-options.md#changelog--release-section-entry-template-optional)
  - commit: [`ResolvedCommit`](../src/tasks/commit.ts#L34-L41) or [`an object with shape { references: { prefix: string, issue: string }[] }`](../src/tasks/string-templates-and-patterns/transformers.ts)
  - Usage: `{{ text | parse_references: commit }}`

### LiquidJS built-in Transformers

As mentioned above, Zephyr Release uses LiquidJS under the hood. Therefore there are also built-in transformers (called **filters** in LiquidJS) you can use directly in templates.

Below are some commonly used built-in transformers:

- `slice(start, length)`: extract a substring  
  Usage: `{{ someString | slice: 0, 5 }}` → first 5 characters

- `upcase` / `downcase`: convert text to upper / lower case  
  Usage: `{{ name | upcase }}`

- `truncate(length, ellipsis)`: shorten long text and append an ellipsis (optional)  
  Usage: `{{ description | truncate: 30, "…" }}`

- `default(value)`: fallback value if the input is empty or nil  
  Usage: `{{ nickname | default: "n/a" }}`

- `date(format)`: format a date/time value  
  Usage: `{{ publishedAt | date: "%Y-%m-%d" }}`

- `replace(search, replace)` / `replace_first(search, replace)`: replace occurrences of a substring  
  Usage: `{{ text | replace: "foo", "bar" }}`

- `strip` / `strip_html`: remove surrounding whitespace or strip HTML tags  
  Usage: `{{ htmlContent | strip_html | strip }}`

- `json`: serialize a value as JSON (useful for debugging or embedding structured data)  
  Usage: `{{ obj | json }}`

- `join(separator)`: join array items into a string  
  Usage: `{{ items | join: ", " }}`

These built-in transformers cover many common needs. For the full list and syntax details, see: <https://liquidjs.com/filters/overview.html>.
