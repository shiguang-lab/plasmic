(() => {
  let snapshot = { locale: "en", messages: {} };
  const listeners = new Set();
  function apply(root) {
    for (const element of root.querySelectorAll("[data-ui-message]")) {
      const text = t(element.dataset.uiMessage);
      if (element.dataset.uiAttribute)
        element.setAttribute(element.dataset.uiAttribute, text);
      else element.textContent = text;
    }
  }
  function t(key, values = {}) {
    return (
      Object.hasOwn(snapshot.messages, key) ? snapshot.messages[key] : key
    ).replace(/\{(\w+)\}/g, (placeholder, name) =>
      values[name] === undefined ? placeholder : String(values[name]),
    );
  }
  function setSnapshot(value) {
    snapshot = value;
    document.documentElement.lang = snapshot.locale;
    apply(document);
    for (const listener of listeners) listener();
  }
  window.desktopUiI18n = {
    t,
    apply,
    setSnapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => snapshot,
  };
  const api = window.desktopEnvironment || window.mcpSettings;
  if (api) {
    api.onUiLocale(setSnapshot);
    void api.getUiMessages().then(setSnapshot);
  }
})();
