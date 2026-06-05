import { Liquid, type Template } from "liquidjs";
import type { StringPatternContext } from "./pattern-context.ts";

export const liquidEngine = new Liquid({ jsTruthy: true });

const PARSED_TEMPLATE_CACHE = new Map<string, Template[]>();

/** @throws */
export async function resolveStringTemplate(
  template: string,
  context: StringPatternContext,
  additionalContext?: Record<string, unknown>,
): Promise<string> {
  try {
    let parsedTemplate = PARSED_TEMPLATE_CACHE.get(template);

    if (!parsedTemplate) {
      parsedTemplate = liquidEngine.parse(template);
      PARSED_TEMPLATE_CACHE.set(template, parsedTemplate);
    }

    const renderedTemplate = await liquidEngine.render(
      parsedTemplate,
      additionalContext
        ? { ...context, ...additionalContext }
        : context,
    );

    if (typeof renderedTemplate !== "string") {
      throw new Error(
        `Resolved template is not a string. Received '${typeof renderedTemplate}'`,
      );
    }

    return renderedTemplate;
  } catch (error) {
    throw new Error(
      `'${resolveStringTemplate.name}' error: failed to resolve string template '${template}'`,
      { cause: error },
    );
  }
}
