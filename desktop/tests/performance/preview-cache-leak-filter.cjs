// MemLab diagnostic filter; tagged Sites deliberately exclude the protected model.
module.exports = {
  leakFilter: (node) =>
    node.type === "object" &&
    !!node.findAnyReference(
      (edge) => edge.name_or_index === "__retiredPreviewCacheSite",
    ),
  // A WeakMap ephemeron path can hide the ordinary Map/closure retaining its key.
  retainerReferenceFilter: (edge, _snapshot, shouldTraverse) =>
    shouldTraverse && !String(edge.name_or_index).includes("part of key"),
};
