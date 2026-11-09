// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PlasmicComponent } from "./PlasmicComponent";

const state = vi.hoisted(() => ({ context: undefined as any }));
vi.mock("./PlasmicRootProvider", () => ({ usePlasmicRootContext: () => state.context }));
vi.mock("./usePlasmicComponent", () => ({ usePlasmicComponent: () => Content }));
function Content() { return <span>Content</span>; }
function Root({ children, i18n, globalVariants }: any) {
  return <div data-testid="root" data-translation={i18n.translator("hello")} data-variant={globalVariants[0].value}>{children}</div>;
}
afterEach(cleanup);

it("propagates new translation, variants and token override project with unchanged component props", () => {
  const tokens = vi.fn(() => undefined);
  const loader = { opts: {}, getLookup: () => ({ getRootProvider: () => Root, maybeGetStyleTokensProvider: tokens, getGlobalContextsProvider: () => undefined }) };
  state.context = { loader, translator: () => "Hello", globalVariants: [{ value: "light" }], styleTokenOverridesProjectId: "a" };
  const props = { component: "Page", componentProps: {} };
  const view = render(<PlasmicComponent {...props} />);
  expect(screen.getByTestId("root").dataset.translation).toBe("Hello");
  state.context = { ...state.context, translator: () => "你好", globalVariants: [{ value: "dark" }], styleTokenOverridesProjectId: "b" };
  view.rerender(<PlasmicComponent {...props} />);
  expect(screen.getByTestId("root").dataset.translation).toBe("你好");
  expect(screen.getByTestId("root").dataset.variant).toBe("dark");
  expect(tokens.mock.calls.at(-1)?.[1]).toBe("b");
});
