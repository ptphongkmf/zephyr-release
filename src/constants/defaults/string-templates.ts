/** Fake fn just to get Liquid highlight from extension */
const liquid = String.raw;

// Working branch
export const DEFAULT_WORKING_BRANCH_NAME_TEMPLATE =
  "zephyr-release/{{ triggerBranchName }}";

// Changelog
export const DEFAULT_CHANGELOG_FILE_HEADER_TEMPLATE = "# Changelog\n\n<br>";
export const DEFAULT_CHANGELOG_RELEASE_TEMPLATE = "{{ changelogRelease }}";

export const DEFAULT_RELEASE_HEADER_TEMPLATE =
  liquid`## {{ nextVersion | wrap_compare_latest_tag: tagName }} (
    {{- YYYY }}-{{ MM }}-{{ DD }}) <!-- timezone: {{ timeZone }} -->`;

export const DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE =
  liquid`### {{ section }}`;

export const DEFAULT_RELEASE_SECTION_ENTRY_TEMPLATE =
  liquid`- {% if scope %}**{{ scope }}:** {% endif %}{{ desc | format_commit_references: commit }} ([{{ hash | slice: 0, 7 }}](
  {{- host }}/{{ namespace }}/{{ repository }}/{{ commitPathPart }}/{{ hash }}))`;

export const DEFAULT_RELEASE_BREAKING_SECTION_ENTRY_TEMPLATE =
  liquid`- {% if scope %}**{{ scope }}:** {% endif %}{{ breakingDesc }}`;

export const DEFAULT_RELEASE_SECTION_HEADING_TEMPLATE_ALT =
  liquid`### {{ sectionAlt }}`;

// Commit
export const DEFAULT_COMMIT_HEADER_TEMPLATE =
  liquid`chore: release v{{ nextVersion }}`;

// Proposal (PR, MR, ...)
export const DEFAULT_PROPOSAL_TITLE_TEMPLATE =
  liquid`chore: release v{{ nextVersion }}`;

export const DEFAULT_PROPOSAL_HEADER_TEMPLATE = "# 🤖 Release Proposal";

export const DEFAULT_PROPOSAL_BODY_TEMPLATE = liquid`{{ changelogRelease }}`;

export const DEFAULT_PROPOSAL_FOOTER_TEMPLATE =
  "---\n*This proposal was generated with [Zephyr Release](https://github.com/ptphongkmf/zephyr-release)*";

// Tag and Release
export const DEFAULT_TAG_NAME_TEMPLATE = liquid`v{{ nextVersion }}`;

export const DEFAULT_TAG_MESSAGE_TEMPLATE = liquid`Release {{ tagName }}`;

export const DEFAULT_RELEASE_TITLE_TEMPLATE = liquid`{{ tagName }}`;

export const DEFAULT_RELEASE_BODY_TEMPLATE = liquid`{{ changelogRelease }}`;
