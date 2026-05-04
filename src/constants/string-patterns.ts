export const FixedBaseStringPatterns = {
  // Project info
  name: "name",
  host: "host",
  namespace: "namespace",
  repository: "repository",
  commitPathPart: "commitPathPart",
  referencePathPart: "referencePathPart",

  triggerBranchName: "triggerBranchName",
  workingBranchName: "workingBranchName",

  // Configuration
  timeZone: "timeZone",
} as const;

export type FixedBaseStringPattern =
  typeof FixedBaseStringPatterns[keyof typeof FixedBaseStringPatterns];

export const FixedDatetimeStringPatterns = {
  timestamp: "timestamp",
  year: "YYYY",
  month: "MM",
  day: "DD",
  hour: "HH",
  minute: "mm",
  second: "ss",
} as const;

export type FixedDatetimeStringPattern =
  typeof FixedDatetimeStringPatterns[keyof typeof FixedDatetimeStringPatterns];

export const DynamicDatetimeStringPatterns = {
  nowTimestamp: "nowTimestamp",
  nowYear: "nowYYYY",
  nowMonth: "nowMM",
  nowDay: "nowDD",
  nowHour: "nowHH",
  nowMinute: "nowmm",
  nowSecond: "nowss",
} as const;

export type DynamicDatetimeStringPattern = typeof DynamicDatetimeStringPatterns[
  keyof typeof DynamicDatetimeStringPatterns
];

const FixedCurrentVersionStringPatterns = {
  // Current version components
  currentVersion: "currentVersion",
  currentVersionCore: "currentVersionCore",
  currentVersionPrerelease: "currentVersionPre",
  currentVersionBuild: "currentVersionBld",
};

export type FixedCurrentVersionStringPattern =
  typeof FixedCurrentVersionStringPatterns[
    keyof typeof FixedCurrentVersionStringPatterns
  ];

const FixedNextVersionStringPatterns = {
  // Version components
  nextVersion: "nextVersion",
  nextVersionCore: "nextVersionCore",
  nextVersionPrerelease: "nextVersionPre",
  nextVersionBuild: "nextVersionBld",

  // Tag
  tagName: "tagName",
} as const;

export type FixedNextVersionStringPattern =
  typeof FixedNextVersionStringPatterns[
    keyof typeof FixedNextVersionStringPatterns
  ];

const DynamicChangelogStringPatterns = {
  changelogRelease: "changelogRelease",
  changelogReleaseBody: "changelogReleaseBody",
  changelogReleaseAlt: "changelogReleaseAlt",
  changelogReleaseBodyAlt: "changelogReleaseBodyAlt",
} as const;

export type DynamicChangelogStringPattern =
  typeof DynamicChangelogStringPatterns[
    keyof typeof DynamicChangelogStringPatterns
  ];

const ChangelogReleaseEntryPatterns = {
  commit: "commit",
  hash: "hash",
  type: "type",
  scope: "scope",
  desc: "desc",
  body: "body",
  footer: "footer",
  breakingDesc: "breakingDesc",
  isBreaking: "isBreaking",
  authorName: "authorName",
  authorEmail: "authorEmail",
  authorDate: "authorDate",
  committerName: "committerName",
  committerEmail: "committerEmail",
  committerDate: "committerDate",
} as const;

export type ChangelogReleaseEntryPattern = typeof ChangelogReleaseEntryPatterns[
  keyof typeof ChangelogReleaseEntryPatterns
];
