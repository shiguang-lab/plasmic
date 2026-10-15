import en from "@/wab/client/i18n/locales/en.json";
import ja from "@/wab/client/i18n/locales/ja.json";
import ko from "@/wab/client/i18n/locales/ko.json";
import zhCN from "@/wab/client/i18n/locales/zh-CN.json";
import zhTW from "@/wab/client/i18n/locales/zh-TW.json";
const messages = { en, ja, ko, "zh-CN": zhCN, "zh-TW": zhTW };
beforeAll(() => loadMessages("zh-CN"));
import {
  languageOptions,
  loadMessages,
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
      expect((message.match(/\{\w+\}/g) ?? []).sort()).toEqual(
        (key.match(/\{\w+\}/g) ?? []).sort(),
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

it("includes every shared editor caption in all five language packs", async () => {
  const labels = await import("@/wab/shared/Labels");
  for (const label of Object.values(labels)) {
    expect(Object.hasOwn(messages.en, label), label).toBe(true);
  }
});

it("includes the descriptions and contexts of all Studio keyboard shortcuts", async () => {
  const { STUDIO_SHORTCUTS } =
    await import("@/wab/client/shortcuts/studio/studio-shortcuts");
  const labels = Object.values(STUDIO_SHORTCUTS).flatMap((shortcut) => [
    shortcut.description,
    ...(shortcut.context ? [shortcut.context] : []),
  ]);
  expect(labels.filter((label) => !Object.hasOwn(messages.en, label))).toEqual(
    [],
  );
});

 it("shares an in-flight language download and caches the loaded pack", async () => {
  vi.resetModules();
  const fresh = await import("@/wab/client/i18n/locales");
  expect(fresh.getMessages("ko")).toBeUndefined();
  const first = fresh.loadMessages("ko");
  expect(fresh.loadMessages("ko")).toBe(first);
  const pack = await first;
  expect(pack.Settings).toBe("설정");
  expect(fresh.getMessages("ko")).toBe(pack);
  expect(await fresh.loadMessages("ko")).toBe(pack);
});
