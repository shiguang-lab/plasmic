import {
  languageOptions,
  messages,
  resolveUiLocale,
  translate,
} from "@/wab/client/i18n/locales";

it.each([
  ["en-GB", "en"],
  ["zh-CN", "zh-CN"],
  ["zh-SG", "zh-CN"],
  ["zh-Hans-HK", "zh-CN"],
  ["zh-Hant", "zh-TW"],
  ["zh-TW", "zh-TW"],
  ["zh-HK", "zh-TW"],
  ["zh_MO", "zh-TW"],
  ["ja-JP", "ja"],
  ["ko-KR", "ko"],
])("resolves system language %s to %s", (systemLanguage, expected) => {
  expect(resolveUiLocale("system", [systemLanguage])).toBe(expected);
});
it("uses the first supported preferred language, with English as the final fallback", () => {
  expect(resolveUiLocale("system", ["fr-FR", "ja-JP", "ko-KR"])).toBe("ja");
  expect(resolveUiLocale("system", ["fr-FR"])).toBe("en");
  expect(resolveUiLocale("system", [])).toBe("en");
  expect(resolveUiLocale("ko", ["zh-CN"])).toBe("ko");
});
it("ships a complete language pack with matching interpolation tokens for every option", () => {
  for (const { value } of languageOptions) {
    expect(Object.keys(messages[value]).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
    for (const [key, message] of Object.entries(messages[value])) {
      expect(message.trim().length).toBeGreaterThan(0);
      expect(message.match(/\{\w+\}/g) ?? []).toEqual(
        key.match(/\{\w+\}/g) ?? [],
      );
    }
  }
});
it("interpolates names without interpreting them as markup or replacement tokens", () => {
  expect(
    translate("zh-CN", 'Delete project "{name}"?', {
      name: "<script>$&</script>",
    }),
  ).toBe("删除项目“<script>$&</script>”？");
});
