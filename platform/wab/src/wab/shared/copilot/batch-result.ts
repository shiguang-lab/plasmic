/** Preserve ordered operation receipts and losslessly share identical resources. */
export function batchResult<T>(
  names: string[],
  outcomes: { results: T[]; messages?: string[] }[],
) {
  const resources: T[] = [];
  const indexes = new Map<string, number>();
  const operations = outcomes.map((outcome, index) => ({
    name: names[index],
    resourceIndexes: outcome.results.map((resource) => {
      // Identity alone is insufficient: Project results can be different slices.
      const key = JSON.stringify(resource);
      let resourceIndex = indexes.get(key);
      if (resourceIndex === undefined) {
        resourceIndex = resources.length;
        indexes.set(key, resourceIndex);
        resources.push(resource);
      }
      return resourceIndex;
    }),
    ...(outcome.messages ? { messages: outcome.messages } : {}),
  }));
  return { operations, resources };
}
