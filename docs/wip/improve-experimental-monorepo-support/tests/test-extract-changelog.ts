/**
 * Test: extractChangelogFromProposal return value (Map<string, string>)
 *
 * Run AFTER Phase F is implemented:
 *   deno test docs/wip/improve-experimental-monorepo-support/tests/test-extract-changelog.ts
 *
 * These tests call the actual function from proposal.ts.
 * Adjust the import path if the module location changes.
 */

import { assertEquals } from "@std/assert";
import { extractChangelogFromProposal } from "../../../../src/tasks/proposal.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProposal(body: string) {
  return { id: "1", title: "Release", body, url: "" };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

Deno.test("extractChangelogFromProposal — single workspace: returns map with one entry", () => {
  const tagName = "v1.2.3";
  const content = "## Fixes\n- fix: something important";
  const body = `# Header

<!-- PROPOSAL-CHANGELOG-RELEASE-START -->
<!-- PROPOSAL-CHANGELOG-RELEASE-START:${tagName} -->
${content}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:${tagName} -->
<!-- PROPOSAL-CHANGELOG-RELEASE-END -->

---
Footer`;

  const result = extractChangelogFromProposal(makeProposal(body));

  assertEquals(result.size, 1);
  assertEquals(result.get(tagName)?.trim(), content);
});

Deno.test("extractChangelogFromProposal — monorepo: returns map with one entry per workspace", () => {
  const coreTag = "core-v2.0.0";
  const coreContent = "## Features\n- feat(core): new feature";
  const utilsTag = "utils-v1.5.0";
  const utilsContent = "## Fixes\n- fix(utils): patch bug";

  const body = `# Header

<!-- PROPOSAL-CHANGELOG-RELEASE-START -->
## Core Library

<!-- PROPOSAL-CHANGELOG-RELEASE-START:${coreTag} -->
${coreContent}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:${coreTag} -->

## Utils

<!-- PROPOSAL-CHANGELOG-RELEASE-START:${utilsTag} -->
${utilsContent}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:${utilsTag} -->
<!-- PROPOSAL-CHANGELOG-RELEASE-END -->`;

  const result = extractChangelogFromProposal(makeProposal(body));

  assertEquals(result.size, 2);
  assertEquals(result.get(coreTag)?.trim(), coreContent);
  assertEquals(result.get(utilsTag)?.trim(), utilsContent);
});

Deno.test("extractChangelogFromProposal — no named markers: returns empty map", () => {
  // Old-style PR body with only global markers (no per-workspace named markers)
  const body = `<!-- PROPOSAL-CHANGELOG-RELEASE-START -->
## Fixes
- fix: something
<!-- PROPOSAL-CHANGELOG-RELEASE-END -->`;

  const result = extractChangelogFromProposal(makeProposal(body));
  assertEquals(result.size, 0);
});

Deno.test("extractChangelogFromProposal — completely empty body: returns empty map", () => {
  const result = extractChangelogFromProposal(makeProposal(""));
  assertEquals(result.size, 0);
});

Deno.test("extractChangelogFromProposal — no markers at all: returns empty map", () => {
  const result = extractChangelogFromProposal(makeProposal("Just a plain PR body with no markers."));
  assertEquals(result.size, 0);
});

Deno.test("extractChangelogFromProposal — tag name with dots and hyphens: parsed correctly", () => {
  const tagName = "my-pkg-v1.0.0-beta.1";
  const content = "pre-release content";
  const body = `<!-- PROPOSAL-CHANGELOG-RELEASE-START:${tagName} -->
${content}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:${tagName} -->`;

  const result = extractChangelogFromProposal(makeProposal(body));
  assertEquals(result.size, 1);
  assertEquals(result.get(tagName)?.trim(), content);
});

Deno.test("extractChangelogFromProposal — multi-line content preserved", () => {
  const tagName = "api-v3.0.0";
  const content = `## Breaking Changes

- feat!: removed deprecated API
- feat!: changed argument order

## Features

- feat: added new endpoint`;

  const body = `<!-- PROPOSAL-CHANGELOG-RELEASE-START:${tagName} -->
${content}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:${tagName} -->`;

  const result = extractChangelogFromProposal(makeProposal(body));
  assertEquals(result.get(tagName)?.trim(), content);
});

Deno.test("extractChangelogFromProposal — user-edited content between markers is preserved", () => {
  // Users are allowed to edit the PR body between prepare and publish.
  // The edited content should be what gets used, not a re-generated version.
  const tagName = "v2.0.0";
  const editedContent = "## Fixes\n- fix: something\n\n**Editor's note: this was a critical fix.**";

  const body = `<!-- PROPOSAL-CHANGELOG-RELEASE-START:${tagName} -->
${editedContent}
<!-- PROPOSAL-CHANGELOG-RELEASE-END:${tagName} -->`;

  const result = extractChangelogFromProposal(makeProposal(body));
  assertEquals(result.get(tagName)?.trim(), editedContent);
});

Deno.test("extractChangelogFromProposal — mismatched markers: unmatched START is ignored", () => {
  // A START without a matching END should not extract content
  const body = `<!-- PROPOSAL-CHANGELOG-RELEASE-START:orphan-v1.0.0 -->
content without end marker`;

  const result = extractChangelogFromProposal(makeProposal(body));
  assertEquals(result.size, 0);
});
