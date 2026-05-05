export type FixedBaseStringPattern =
  // Project info
  | "name"
  | "host"
  | "namespace"
  | "repository"
  | "commitPathPart"
  | "referencePathPart"
  | "triggerBranchName"
  | "workingBranchName"
  // Configuration
  | "timeZone";

export type FixedDatetimeStringPattern =
  | "timestamp"
  | "YYYY"
  | "MM"
  | "DD"
  | "HH"
  | "mm"
  | "ss";

export type DynamicDatetimeStringPattern =
  | "nowTimestamp"
  | "nowYYYY"
  | "nowMM"
  | "nowDD"
  | "nowHH"
  | "nowmm"
  | "nowss";

export type FixedCurrentVersionStringPattern =
  // Current version components
  | "currentVersion"
  | "currentVersionCore"
  | "currentVersionPre"
  | "currentVersionBld";

export type FixedNextVersionStringPattern =
  // Version components
  | "nextVersion"
  | "nextVersionCore"
  | "nextVersionPre"
  | "nextVersionBld";

export type FixedTagStringPattern = // Tag
"tagName";

export type DynamicChangelogStringPattern =
  | "changelogRelease"
  | "changelogReleaseBody"
  | "changelogReleaseAlt"
  | "changelogReleaseBodyAlt";

export type ChangelogReleaseEntryPattern =
  | "commit"
  | "hash"
  | "type"
  | "scope"
  | "desc"
  | "body"
  | "footer"
  | "breakingDesc"
  | "isBreaking"
  | "authorName"
  | "authorEmail"
  | "authorDate"
  | "committerName"
  | "committerEmail"
  | "committerDate";
