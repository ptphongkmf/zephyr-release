import * as v from "@valibot/valibot";
import { DEFAULT_AUTO_RELEASE_STRATEGY } from "../../../constants/defaults/auto-release-strategy.ts";
import { AutoStrategySchema } from "./components/auto-release-strategy.ts";

export const AutoConfigSchema = v.pipe(
  v.object({
    triggerStrategy: v.pipe(
      v.optional(AutoStrategySchema, DEFAULT_AUTO_RELEASE_STRATEGY),
      v.metadata({
        description:
          "Defines the strategy that determines whether an automated release should be triggered. Used when `releaseFlow` is " +
          'set to "auto".\n' +
          `Default: ${JSON.stringify(DEFAULT_AUTO_RELEASE_STRATEGY)}`,
      }),
    ),
  }),
  v.metadata({
    description:
      'Configuration specific to the "auto" release flow. Defines the conditions and strategies for bypassing proposals ' +
      "and committing releases directly.",
  }),
);

type _AutoConfigInput = v.InferInput<typeof AutoConfigSchema>;
export type AutoConfigOutput = v.InferOutput<typeof AutoConfigSchema>;
