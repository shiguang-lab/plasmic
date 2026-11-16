import type { PropType } from "@plasmicapp/host";

type SemanticParts = {
  [key: string]: string | SemanticParts;
};

// Require every native region, including nested popup and table regions.
export type SemanticPartLabels<T> = {
  [K in keyof NonNullable<T>]-?: NonNullable<NonNullable<T>[K]> extends string
    ? string
    : SemanticPartLabels<Exclude<NonNullable<T>[K], string>>;
};

type SemanticAppearanceOptions = {
  advanced?: boolean;
  stylesDescription?: string;
  classNamesDescription?: string;
};

export function semanticAppearance(
  parts: SemanticParts,
  options?: SemanticAppearanceOptions,
) {
  function fields(
    entries: SemanticParts,
    leafType: "object" | "string",
  ): Record<string, PropType<any>> {
    return Object.fromEntries(
      Object.entries(entries).map(([key, entry]) => [
        key,
        typeof entry === "string"
          ? { type: leafType, displayName: entry }
          : { type: "object", fields: fields(entry, leafType) },
      ]),
    );
  }

  return {
    styles: {
      type: "object",
      editor: "semantic",
      displayName: "Styles",
      fields: fields(parts, "object"),
      ...(options?.advanced ? { advanced: true } : {}),
      ...(options?.stylesDescription
        ? { description: options.stylesDescription }
        : {}),
    },
    classNames: {
      type: "object",
      editor: "semantic",
      displayName: "Class names",
      fields: fields(parts, "string"),
      ...(options?.advanced ? { advanced: true } : {}),
      ...(options?.classNamesDescription
        ? { description: options.classNamesDescription }
        : {}),
    },
  } satisfies Record<string, PropType<any>>;
}
