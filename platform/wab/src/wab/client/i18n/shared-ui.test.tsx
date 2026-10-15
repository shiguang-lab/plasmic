import { AuthProviderTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import Searchbox from "@/wab/client/components/widgets/Searchbox";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await act(async () => await setLanguagePreference("en"));
});

it("updates shared search defaults without rewriting caller placeholders or input", async () => {
  const view = render(<Searchbox value="My project" onChange={vi.fn()} />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  for (const { value } of languageOptions) {
    await act(async () => await setLanguagePreference(value));
    expect(input.placeholder).toBe(translate(value, "Search..."));
    expect(input.value).toBe("My project");
  }
  view.rerender(
    <Searchbox
      placeholder="Business field"
      value="My project"
      onChange={vi.fn()}
    />,
  );
  await act(async () => await setLanguagePreference("zh-CN"));
  expect(input.placeholder).toBe("Business field");
});

it("translates Markdown tooltips on language changes and preserves documentation links", async () => {
  const view = render(<AuthProviderTooltip />);
  const english = view.container.textContent;
  for (const value of ["zh-CN", "zh-TW", "ja", "ko"] as const) {
    await act(async () => await setLanguagePreference(value));
    expect(view.container.textContent).not.toBe(english);
    expect(view.container.querySelector("a")?.getAttribute("href")).toBe(
      "https://docs.plasmic.app/learn/auth",
    );
    expect(view.container.textContent).not.toContain(
      "This is the simplest option.",
    );
  }
});
