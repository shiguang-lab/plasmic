// Keep the original diagnostic and translation arguments separate across IPC.
function uiError(key, values = {}) {
  const message = key.replace(/\{(\w+)\}/g, (placeholder, name) =>
    values[name] === undefined ? placeholder : String(values[name]),
  );
  return Object.assign(new Error(message), { uiMessage: { key, values } });
}
function errorMessage(error, fallback) {
  return error.uiMessage || { key: fallback, values: {} };
}
module.exports = { uiError, errorMessage };
