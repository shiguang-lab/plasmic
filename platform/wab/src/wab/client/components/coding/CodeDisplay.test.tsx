import { CodeDisplay } from "@/wab/client/components/coding/CodeDisplay";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { act, cleanup, render } from "@testing-library/react";
import lightTheme from "prism-react-renderer/themes/github";
import darkTheme from "prism-react-renderer/themes/vsDark";
import * as React from "react";

afterEach(() => {
  cleanup();
  setAppearancePreference("dark");
});

it("changes code colors with the product theme while preserving code content", () => {
  setAppearancePreference("dark");
  const { container } = render(
    <CodeDisplay language="tsx">const title = "Example";</CodeDisplay>,
  );
  const pre = container.querySelector("pre");
  const expected = document.createElement("div");
  expected.style.backgroundColor = darkTheme.plain.backgroundColor ?? "";
  expect(pre?.style.backgroundColor).toBe(expected.style.backgroundColor);
  act(() => setAppearancePreference("light"));
  expected.style.backgroundColor = lightTheme.plain.backgroundColor ?? "";
  expect(pre?.style.backgroundColor).toBe(expected.style.backgroundColor);
  expect(pre?.textContent).toBe('const title = "Example";');
});
