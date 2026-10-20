function readLayout(layout, input = {}) {
  if (input.view === "full" && (input.fields || input.elementUuid || input.offset !== undefined || input.limit !== undefined)) throw new Error("Full layout reads cannot be combined with fields, elementUuid or pagination");
  const { elements, images, ...frame } = layout;
  const problems = [
    ...elements.filter((el) => el.horizontalOverflow).map((el) => ({
      type: "horizontal-overflow", elementUuid: el.elementUuid, index: el.index,
      bounds: { x: el.x, width: el.width }, viewportWidth: layout.width,
    })),
    ...images.filter((image) => !image.loaded).map((image) => ({ type: "image-unloaded", elementUuid: image.elementUuid, src: image.src })),
  ];
  const view = input.view || "summary";
  const base = { ...frame, read: { view }, counts: { elements: elements.length, images: images.length, problems: problems.length } };
  if (view === "full") return { ...base, elements, images, problems };
  const offset = input.offset || 0;
  const limit = input.limit || 50;
  let items = view === "elements" ? elements : view === "images" ? images : problems;
  if (input.elementUuid) items = items.filter((item) => item.elementUuid === input.elementUuid);
  const selected = items.slice(offset, offset + limit);
  const fields = input.fields || (view === "elements" ? ["index", "elementUuid", "tag", "x", "y", "width", "height", "horizontalOverflow"] : undefined);
  const values = fields ? selected.map((item) => Object.fromEntries(fields.filter((key) => Object.hasOwn(item, key)).map((key) => [key, item[key]]))) : selected;
  return { ...base, read: { view, ...(fields ? { fields } : {}) }, [view === "summary" ? "problems" : view]: values, offset, total: items.length,
    ...(offset + selected.length < items.length ? { nextOffset: offset + selected.length } : {}) };
}
module.exports = { readLayout };
