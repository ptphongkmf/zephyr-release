export const CHANGELOG_MARKERS = {
  bodyStart: "<!-- CHANGELOG-BODY-START -->",
  bodyEnd: "<!-- CHANGELOG-BODY-END -->",

  archived: "<!-- ARCHIVED-CONTENT -->",
} as const;

export const PROPOSAL_MARKERS = {
  bodyStart: "<!-- PROPOSAL-CHANGELOG-RELEASE-START -->",
  bodyEnd: "<!-- PROPOSAL-CHANGELOG-RELEASE-END -->",
  namedBodyStart: (tagName: string) =>
    `<!-- PROPOSAL-CHANGELOG-RELEASE-START:${tagName} -->`,
  namedBodyEnd: (tagName: string) =>
    `<!-- PROPOSAL-CHANGELOG-RELEASE-END:${tagName} -->`,
} as const;
