function semanticAppearance(parts, options) {
  function fields(entries, leafType) {
    return Object.fromEntries(
      Object.entries(entries).map(([key, entry]) => [
        key,
        typeof entry === "string" ? { type: leafType, displayName: entry } : { type: "object", fields: fields(entry, leafType) }
      ])
    );
  }
  return {
    styles: {
      type: "object",
      editor: "semantic",
      displayName: "Styles",
      fields: fields(parts, "object"),
      ...options?.advanced ? { advanced: true } : {},
      ...options?.stylesDescription ? { description: options.stylesDescription } : {}
    },
    classNames: {
      type: "object",
      editor: "semantic",
      displayName: "Class names",
      fields: fields(parts, "string"),
      ...options?.advanced ? { advanced: true } : {},
      ...options?.classNamesDescription ? { description: options.classNamesDescription } : {}
    }
  };
}

export { semanticAppearance as s };
//# sourceMappingURL=semantic-appearance-D-8fw6YR.esm.js.map
