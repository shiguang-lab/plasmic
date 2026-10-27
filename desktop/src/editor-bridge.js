// Runs in Studio's main world. Only existing, validated editor operations are
// callable; this does not evaluate code supplied by MCP clients.
(() => {
  if (window.top !== window) {
    return;
  }
  window.addEventListener("message", async (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.channel !== "plasmic-desktop-request"
    ) {
      return;
    }
    const { id, method, input, caller } = event.data;
    let result;
    try {
      const tools = window.PLASMIC_AI_TOOLS;
      if (method === "flushDraft" || method === "showDrafts") {
        result = { protected: window.desktopDraftAction ? await window.desktopDraftAction(method === "flushDraft" ? "flush" : "show") : true };
      } else if (method === "metadata") {
        let editorContext = null;
        if (tools) {
          const context = await tools.getEditorContext({});
          if (!context.success) {
            throw new Error(context.error.message);
          }
          editorContext = JSON.parse(context.output);
        }
        const metadata = tools?._meta || {};
        const toolNames = input?.toolNames;
        const availableEditorTools = Object.keys(metadata);
        result = {
          ready: !!tools,
          tools: toolNames === undefined ? metadata : Object.fromEntries(toolNames.map((name) => {
            if (!Object.hasOwn(metadata, name)) {
              throw new Error(`Editor schema unavailable: ${name}`);
            }
            return [name, metadata[name]];
          })),
          ...(toolNames === undefined ? {} : { availableEditorTools }),
          editorContext,
        };
      } else if (method === "renderReady") {
        await document.fonts.ready;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        result = { ready: true };
      } else {
        if (!tools || !Object.hasOwn(tools._meta, method)) {
          throw new Error("Open a design before calling editor tools");
        }
        result = await tools[method](input, caller);
      }
    } catch (error) {
      result = { success: false, error: { message: error.message } };
    }
    window.postMessage(
      { channel: "plasmic-desktop-response", id, result },
      location.origin,
    );
  });
})();
