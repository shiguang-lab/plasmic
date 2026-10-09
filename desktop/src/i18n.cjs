const fs = require("node:fs");
const path = require("node:path");
function createDesktopI18n(directory, systemLanguages) {
  const { resolveUiLocale } = require(
    path.join(directory, "locale-resolution.cjs"),
  );
  const packs = Object.fromEntries(
    ["en", "zh-CN", "zh-TW", "ja", "ko"].map((locale) => [
      locale,
      JSON.parse(
        fs.readFileSync(path.join(directory, locale + ".json"), "utf8"),
      ),
    ]),
  );
  let locale = resolveUiLocale("system", systemLanguages);
  const listeners = new Set();
  return {
    t: (key, values = {}) =>
      (Object.hasOwn(packs[locale], key) ? packs[locale][key] : key).replace(
        /\{(\w+)\}/g,
        (placeholder, name) =>
          values[name] === undefined ? placeholder : String(values[name]),
      ),
    snapshot: () => ({ locale, messages: packs[locale] }),
    setLocale: (value) => {
      if (!Object.hasOwn(packs, value)) throw new Error("Invalid UI language");
      if (locale === value) return;
      locale = value;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
module.exports = { createDesktopI18n };
