const fields = {
  load_page: ["url", "title", "loading", "width", "height", "error"],
  get_state: ["visible", "url", "title", "loading", "busy", "width", "height", "zoom", "device", "importHeight", "picking", "error"],
  set_import_height: ["importHeight"],
  select_element: ["picking"],
  close: ["visible"],
};
function browserOutput(action, result) {
  if (!fields[action]) return result; // Capture, CDP and import have their own result contracts.
  const output = Object.fromEntries([...fields[action], "evidence"].filter((key) => Object.hasOwn(result, key)).map((key) => [key, result[key]]));
  if (["get_state", "select_element"].includes(action)) {
    const selected = result.selection;
    output.selection = selected ? { selector: selected.selector,
      ...(selected.ancestors?.length ? { element: selected.ancestors.at(-1) } : {}) } : null;
  }
  return output;
}
module.exports = { browserOutput };
