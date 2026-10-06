// Runs in Studio's main world. Only existing, validated editor operations are
// callable; this does not evaluate code supplied by MCP clients.
(() => {
  if (window.top !== window) return;
  const open = window.open;
  window.open = function (url, ...args) {
    const target = new URL(url || "", location.href);
    if (
      target.origin === location.origin &&
      target.pathname === "/api/v1/auth/google"
    ) {
      window.postMessage(
        { channel: "plasmic-desktop-google-start" },
        location.origin,
      );
      return window;
    }
    return open.call(window, url, ...args);
  };
  window.addEventListener("message", async (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.channel !== "plasmic-desktop-request"
    )
      return;
    const { id, method, input } = event.data;
    let result;
    try {
      const tools = window.PLASMIC_AI_TOOLS;
      if (method === "metadata") {
        let editorContext = null;
        if (tools) {
          const context = await tools.getEditorContext({});
          if (!context.success) throw new Error(context.error.message);
          editorContext = JSON.parse(context.output);
        }
        result = { ready: !!tools, tools: tools?._meta || {}, editorContext };
      } else if (method === "renderReady") {
        await document.fonts.ready;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        result = { ready: true };
      } else {
        if (!tools || !Object.hasOwn(tools._meta, method))
          throw new Error("Open a design before calling editor tools");
        result = await tools[method](input);
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
