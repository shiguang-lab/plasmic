const text = (value, max = 300) =>
  typeof value === "string" && value.length <= max && /\S/.test(value);
const strings = (value, max = 100) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((item) => text(item));
function documents(input) {
  if (!Array.isArray(input) || input.length > 5000)
    throw new TypeError("Invalid component catalogue");
  let length = 0;
  const ids = new Set();
  return input.map((doc) => {
    if (
      !doc ||
      ![doc.componentUuid, doc.name, doc.fromProject, doc.version].every(
        (value) => text(value),
      ) ||
      typeof doc.description !== "string" ||
      doc.description.length > 4000 ||
      !Array.isArray(doc.sections) ||
      !doc.sections.length ||
      doc.sections.length > 32 ||
      !doc.sections.every((section) => text(section, 32000)) ||
      !strings(doc.props, 500) ||
      !strings(doc.slots, 100) ||
      !strings(doc.events, 100) ||
      (doc.parent !== undefined && !text(doc.parent))
    )
      throw new TypeError("Invalid component contract document");
    length +=
      doc.sections.join().length +
      doc.description.length +
      doc.props.join().length +
      doc.slots.join().length +
      doc.events.join().length;
    if (length > 4 * 1024 * 1024 || ids.has(doc.componentUuid))
      throw new TypeError(
        "Component catalogue exceeds limits or has duplicate identities",
      );
    ids.add(doc.componentUuid);
    return {
      componentUuid: doc.componentUuid,
      name: doc.name,
      fromProject: doc.fromProject,
      version: doc.version,
      description: doc.description,
      sections: doc.sections,
      props: doc.props,
      slots: doc.slots,
      events: doc.events,
      ...(doc.parent ? { parent: doc.parent } : {}),
    };
  });
}
module.exports = { documents };
