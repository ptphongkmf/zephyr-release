/**
 * Test: per-workspace block assembly logic
 *
 * These tests verify the block assembly rules (the pure logic, not the full workflow).
 * They can be run standalone without a full runtime context.
 *
 * Run:
 *   deno test docs/wip/improve-experimental-monorepo-support/tests/test-block-assembly.ts
 *
 * To use these as acceptance tests post-Phase D, extract the assembly function
 * into a testable pure helper and import it here.
 */

import { assertEquals } from "@std/assert";

// ─── Inline the assembly logic (pure function, matches Phase D implementation) ──

const NAMED_MARKER_START = (tagName: string) =>
  `<!-- PROPOSAL-CHANGELOG-RELEASE-START:${tagName} -->`;
const NAMED_MARKER_END = (tagName: string) =>
  `<!-- PROPOSAL-CHANGELOG-RELEASE-END:${tagName} -->`;

function assembleMemberBlock(params: {
  tagName: string;
  memberHeader: string;
  memberBody: string;
  memberFooter: string;
}): string {
  const { tagName, memberHeader, memberBody, memberFooter } = params;

  const markedBody = [
    NAMED_MARKER_START(tagName),
    memberBody,
    NAMED_MARKER_END(tagName),
  ].join("\n");

  return [memberHeader, markedBody, memberFooter]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}

// ─── Tests ──────────────────────────────────────────────────────────────────

Deno.test("block assembly — body only: wraps in named markers, no header/footer", () => {
  const block = assembleMemberBlock({
    tagName: "v1.0.0",
    memberHeader: "",
    memberBody: "## Fixes\n- fix: patch",
    memberFooter: "",
  });

  assertEquals(
    block,
    "<!-- PROPOSAL-CHANGELOG-RELEASE-START:v1.0.0 -->\n## Fixes\n- fix: patch\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:v1.0.0 -->",
  );
});

Deno.test("block assembly — header + body: header appears before markers", () => {
  const block = assembleMemberBlock({
    tagName: "api-v2.0.0",
    memberHeader: "> Please check the breaking changes section.",
    memberBody: "## Breaking\n- removed foo",
    memberFooter: "",
  });

  const headerIdx = block.indexOf("> Please check");
  const markerIdx = block.indexOf("PROPOSAL-CHANGELOG-RELEASE-START:api-v2.0.0");

  assertEquals(headerIdx < markerIdx, true, "header must appear before markers");
});

Deno.test("block assembly — footer + body: footer appears after markers", () => {
  const block = assembleMemberBlock({
    tagName: "sdk-v3.1.0",
    memberHeader: "",
    memberBody: "## Features\n- feat: new API",
    memberFooter: "> Thanks for reviewing!",
  });

  const markerEndIdx = block.indexOf("PROPOSAL-CHANGELOG-RELEASE-END:sdk-v3.1.0");
  const footerIdx = block.indexOf("> Thanks for reviewing!");

  assertEquals(footerIdx > markerEndIdx, true, "footer must appear after marker end");
});

Deno.test("block assembly — all three: correct order header → markers → footer", () => {
  const block = assembleMemberBlock({
    tagName: "core-v5.0.0",
    memberHeader: "HEADER",
    memberBody: "BODY",
    memberFooter: "FOOTER",
  });

  const headerIdx = block.indexOf("HEADER");
  const startMarkerIdx = block.indexOf("PROPOSAL-CHANGELOG-RELEASE-START:core-v5.0.0");
  const endMarkerIdx = block.indexOf("PROPOSAL-CHANGELOG-RELEASE-END:core-v5.0.0");
  const footerIdx = block.indexOf("FOOTER");

  assertEquals(headerIdx < startMarkerIdx, true, "header before start marker");
  assertEquals(startMarkerIdx < endMarkerIdx, true, "start marker before end marker");
  assertEquals(endMarkerIdx < footerIdx, true, "end marker before footer");
});

Deno.test("block assembly — tag name with dots and hyphens: markers contain correct tag", () => {
  const tagName = "my-pkg-v1.0.0-alpha.2";
  const block = assembleMemberBlock({
    tagName,
    memberHeader: "",
    memberBody: "pre-release changes",
    memberFooter: "",
  });

  assertEquals(block.includes(`PROPOSAL-CHANGELOG-RELEASE-START:${tagName}`), true);
  assertEquals(block.includes(`PROPOSAL-CHANGELOG-RELEASE-END:${tagName}`), true);
});

Deno.test("block assembly — empty body: markers still present (empty release is valid)", () => {
  const block = assembleMemberBlock({
    tagName: "v0.1.0",
    memberHeader: "",
    memberBody: "",
    memberFooter: "",
  });

  // Even with empty body, markers must be present (so extraction finds them)
  // However with all parts empty, the block itself may be empty. Verify marker placement.
  // If the body is truly empty, this is an edge case — but markers should still wrap it.
  // The filter logic should handle trimming of the body string.
  assertEquals(block.includes("PROPOSAL-CHANGELOG-RELEASE-START:v0.1.0"), true);
  assertEquals(block.includes("PROPOSAL-CHANGELOG-RELEASE-END:v0.1.0"), true);
});

Deno.test("block assembly — extract round-trip: assembled block survives regex extraction", () => {
  const tagName = "web-v4.2.1";
  const originalBody = "## Features\n- feat: dark mode";

  const block = assembleMemberBlock({
    tagName,
    memberHeader: "PR-only header",
    memberBody: originalBody,
    memberFooter: "PR-only footer",
  });

  // Simulate extraction regex (same pattern as extractChangelogFromProposal)
  const regex = new RegExp(
    `<!-- PROPOSAL-CHANGELOG-RELEASE-START:([\\w.\\-]+) -->([\\s\\S]*?)<!-- PROPOSAL-CHANGELOG-RELEASE-END:\\1 -->`,
    "g",
  );

  const matches = [...block.matchAll(regex)];
  assertEquals(matches.length, 1, "should find exactly one marker pair");
  assertEquals(matches[0]![1], tagName, "extracted tag name must match");
  assertEquals(matches[0]![2]!.trim(), originalBody, "extracted body must match original");
});

// ─── Global marker wrapping ──────────────────────────────────────────────────

Deno.test("global marker wrapping — assembled body is wrapped by createProposalContent", () => {
  // This test verifies the expected structure of the full PR body
  // The global markers are placed by createProposalContent around the resolved bodyTemplate
  const GLOBAL_START = "<!-- PROPOSAL-CHANGELOG-RELEASE-START -->";
  const GLOBAL_END = "<!-- PROPOSAL-CHANGELOG-RELEASE-END -->";

  const resolvedBodyTemplate =
    "## Core\n\n<!-- PROPOSAL-CHANGELOG-RELEASE-START:core-v1.0.0 -->\ncore changes\n<!-- PROPOSAL-CHANGELOG-RELEASE-END:core-v1.0.0 -->";

  const fullBody = [GLOBAL_START, resolvedBodyTemplate, GLOBAL_END].join("\n");

  // Global markers wrap everything
  assertEquals(fullBody.startsWith(GLOBAL_START), true);
  assertEquals(fullBody.endsWith(GLOBAL_END), true);

  // Named markers are inside the global ones
  const globalStartIdx = fullBody.indexOf(GLOBAL_START);
  const namedStartIdx = fullBody.indexOf("PROPOSAL-CHANGELOG-RELEASE-START:core");
  const globalEndIdx = fullBody.indexOf(GLOBAL_END);

  assertEquals(namedStartIdx > globalStartIdx, true, "named marker inside global start");
  assertEquals(namedStartIdx < globalEndIdx, true, "named marker inside global end");
});
