// Public editor context excludes native UI persistence and browser import state.
const contextFields = ["projectId", "projectName", "branchId", "sessionId", "revision", "changeCounter", "componentUuid", "componentName", "frameUuid", "selectedElementUuids", "selectedSlot", "instanceIndex", "mode", "canEdit", "previewContext", "path"];
function editorOutput(name, result) {
  if (name === "getEditorContext" && typeof result.output === "string") {
    throw new Error("Editor context requires JSON; call identify with outputFormat:json and retry.");
  }
  return name === "getEditorContext"
    ? Object.fromEntries(contextFields.filter((key) => Object.hasOwn(result, key)).map((key) => [key, result[key]])) : result;
}
function editorOutputSchema(name, schema) {
  if (name !== "getEditorContext") return schema;
  return { ...schema,
    additionalProperties: false,
    properties: Object.fromEntries(Object.entries(schema.properties || {}).filter(([key]) => contextFields.includes(key))),
    ...(schema.required ? { required: schema.required.filter((key) => contextFields.includes(key)) } : {}),
  };
}
module.exports = { editorOutput, editorOutputSchema };
