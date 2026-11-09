// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { Stack } from "./Stack";
import { createScreenVariantStore, useScreenVariants } from "./screen-variants";
import { StyleTokensProvider, useStyleTokens } from "./style-tokens";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("preserves Stack tag, content and React 19 ref cleanup", () => {
  const released = vi.fn();
  const ref = vi.fn(() => released);
  const view = render(<Stack.button ref={ref} hasGap={false} title="action">Action</Stack.button>);
  expect(screen.getByRole("button").textContent).toBe("Action");
  expect(ref).toHaveBeenCalledWith(screen.getByRole("button"));
  view.rerender(<Stack.button ref={ref} hasGap={false} title="changed">Next</Stack.button>);
  expect(screen.getByRole("button").title).toBe("changed");
  expect(ref).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(released).toHaveBeenCalledTimes(1);
});

it("updates project tokens and inherited overrides from their actual variants", () => {
  const parent = {base: "parent override", varianted: [{className: "parent-dark", groupName: "theme", variant: "dark"}]};
  const child = {base: "child parent", varianted: [{className: "child-dark", groupName: "theme", variant: "dark"}]};
  function Child({theme}: {theme: string}) {
    const classes = useStyleTokens(child, {theme});
    return <output>{classes.join(" ")}</output>;
  }
  const view = render(<StyleTokensProvider tokenData={parent} globalVariants={{theme: "light"}}><Child theme="light" /></StyleTokensProvider>);
  expect(screen.getByRole("status").textContent).toBe("parent override child");
  view.rerender(<StyleTokensProvider tokenData={parent} globalVariants={{theme: "dark"}}><Child theme="dark" /></StyleTokensProvider>);
  expect(screen.getByRole("status").textContent).toBe("parent override parent-dark child child-dark");
});

it("keeps the server screen empty and publishes resize changes to native subscribers", () => {
  let narrow = false;
  vi.stubGlobal("matchMedia", (query: string) => ({matches: narrow && query === "(max-width: 600px)"}));
  const store = createScreenVariantStore({nativeNarrow: "(max-width: 600px)"});
  function Screen() {
    const active = useScreenVariants(store, true);
    return <output>{active.join(",")}</output>;
  }
  expect(renderToString(<Screen />)).toBe("<output></output>");
  render(<Screen />);
  expect(screen.getByRole("status").textContent).toBe("");
  act(() => { narrow = true; window.dispatchEvent(new Event("resize")); });
  expect(screen.getByRole("status").textContent).toBe("nativeNarrow");
  act(() => { narrow = false; window.dispatchEvent(new Event("resize")); });
  expect(screen.getByRole("status").textContent).toBe("");
});
