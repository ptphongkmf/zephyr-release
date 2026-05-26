export const ReleaseFlows = {
  review: "review",
  auto: "auto",
} as const;

export type ReleaseFlow = typeof ReleaseFlows[keyof typeof ReleaseFlows];
