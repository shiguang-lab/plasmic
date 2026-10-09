// Shared by Studio and the desktop main process. Preference storage belongs to Studio.
function resolveUiLocale(preference, systemLanguages) {
  if (preference !== "system") return preference;
  for (const language of systemLanguages) {
    const parts = language.toLowerCase().replace(/_/g, "-").split("-");
    if (parts[0] === "zh") {
      if (parts.includes("hant")) return "zh-TW";
      if (parts.includes("hans")) return "zh-CN";
      return parts.some((part) => ["tw", "hk", "mo"].includes(part))
        ? "zh-TW"
        : "zh-CN";
    }
    if (["en", "ja", "ko"].includes(parts[0])) return parts[0];
  }
  return "en";
}
module.exports = { resolveUiLocale };
