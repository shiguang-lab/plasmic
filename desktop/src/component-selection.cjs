function selectCandidates(rows, region) {
  const used = rows.filter(
    (row) =>
      row.eligible && region.usedComponentUuids.includes(row.componentUuid),
  );
  const candidates = rows.filter(
    (row) =>
      !region.usedComponentUuids.includes(row.componentUuid) &&
      row.componentUuid !== region.componentUuid &&
      row.eligible,
  );
  if (
    used.some(
      (row) =>
        candidates[0] &&
        (row.similarity ?? 0) >= (candidates[0].similarity ?? 0) - 0.01 &&
        row.keywordScore >= candidates[0].keywordScore,
    )
  )
    return [];
  // A child is never an independently insertable alternative. Reserve room
  // for its complete parent chain before applying the candidate budget.
  const selected = new Map();
  const requiredBy = new Map();
  for (const candidate of candidates) {
    const chain = [];
    const visited = new Set();
    let row = candidate;
    let valid = true;
    while (row) {
      if (
        visited.has(row.componentUuid) ||
        row.componentUuid === region.componentUuid
      ) {
        valid = false;
        break;
      }
      visited.add(row.componentUuid);
      chain.unshift(row);
      if (!row.contract.parent) break;
      const parent = rows.find(
        (item) =>
          item.name === row.contract.parent &&
          item.fromProject === row.fromProject &&
          item.version === row.version,
      );
      if (!parent) {
        valid = false;
        break;
      }
      if (region.ancestorComponentUuids?.includes(parent.componentUuid)) break;
      row = parent;
    }
    if (
      !valid ||
      new Set([...selected.keys(), ...chain.map((item) => item.componentUuid)])
        .size > 3
    )
      continue;
    for (const [index, item] of chain.entries()) {
      selected.set(item.componentUuid, item);
      if (index + 1 < chain.length) {
        const children = requiredBy.get(item.componentUuid) ?? new Set();
        children.add(chain[index + 1].componentUuid);
        requiredBy.set(item.componentUuid, children);
      }
    }
  }
  return [...selected.values()].map(({ eligible, ...candidate }) => ({
    ...candidate,
    ...(requiredBy.has(candidate.componentUuid)
      ? { requiredBy: [...requiredBy.get(candidate.componentUuid)] }
      : {}),
  }));
}
module.exports = { selectCandidates };
