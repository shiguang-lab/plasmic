// Studio owns the persisted preference and resolves system appearance.
// Native dialogs share its current resolved appearance for this app session.
function createDesktopAppearance() {
  let appearance = "dark";
  const listeners = new Set();
  return {
    snapshot: () => appearance,
    set(value) {
      if (value !== "dark" && value !== "light") {
        throw new Error("Invalid UI appearance");
      }
      if (value === appearance) {
        return;
      }
      appearance = value;
      for (const listener of listeners) {
        listener(appearance);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
module.exports = { createDesktopAppearance };
