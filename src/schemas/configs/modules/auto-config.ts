import * as v from "@valibot/valibot";
import { DEFAULT_AUTO_RELEASE_STRATEGY } from "../../../constants/defaults/auto-release-strategy.ts";
import { AutoStrategySchema } from "./components/auto-release-strategy.ts";

const autoTriggerStrategySchema = AutoStrategySchema;
const autoTriggerStrategyDesc =
  "Defines the strategy that determines whether an automated release should be triggered. Used when `releaseFlow` is " +
  'set to "auto".\n';

const autoConfigDesc =
  'Configuration specific to the "auto" release flow. Defines the conditions and strategies for bypassing proposals ' +
  "and committing releases directly.";

export const AutoConfigSchema = v.pipe(
  v.object({
    triggerStrategy: v.pipe(
      v.optional(autoTriggerStrategySchema, DEFAULT_AUTO_RELEASE_STRATEGY),
      v.metadata({
        description: autoTriggerStrategyDesc +
          `Default: ${JSON.stringify(DEFAULT_AUTO_RELEASE_STRATEGY)}`,
      }),
    ),
  }),
  v.metadata({
    description: autoConfigDesc,
  }),
);

type _AutoConfigInput = v.InferInput<typeof AutoConfigSchema>;
export type AutoConfigOutput = v.InferOutput<typeof AutoConfigSchema>;

export const AutoConfigPatchSchema = v.pipe(
  v.object(
    {
      triggerStrategy: v.pipe(
        v.optional(autoTriggerStrategySchema),
        v.metadata({
          description: autoTriggerStrategyDesc +
            "Default: inherit from root",
        }),
      ),
    } satisfies Record<keyof AutoConfigOutput, unknown>,
  ),
  v.metadata({
    description: autoConfigDesc,
  }),
);
