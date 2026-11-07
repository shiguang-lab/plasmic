import { OverflowSection } from "@/wab/client/components/sidebar-tabs/OverflowSection";
import type { ExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import type { ViewStyleInputs, TplStyleSource } from "@/wab/client/studio-ctx/style-inputs";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ locale: "en", t: (text: string) => text }),
}));
vi.mock("@/wab/client/components/style-controls/StyleComponent", () => ({
  StylePanelSection: ({
    title,
    controls,
    children,
  }: {
    title: React.ReactNode;
    controls?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {controls}
      {children}
    </section>
  ),
}));
vi.mock("@/wab/client/components/sidebar/sidebar-helpers", () => ({
  FullRow: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LabeledToggleButtonGroup: ({
    value,
    children,
  }: {
    value?: string;
    children?: React.ReactNode;
  }) => (
    <div data-testid="toggle-group" data-value={String(value)}>
      {children}
    </div>
  ),
}));
vi.mock("@/wab/client/components/style-controls/StyleToggleButton", () => ({
  default: () => <button />,
}));

afterEach(cleanup);

it("renders active defaults when the style owner is already disposed", () => {
  const inputs = mock<ViewStyleInputs>({ isDisposed: true });
  const provider = mock<ExpsProvider>({
    getNativeStyleSource: () => ({
      kind: "tpl",
      inputs,
      source: mock<TplStyleSource>(),
    }),
  });
  const studioCtx = mock<StudioCtx>();

  render(
    <StudioCtxContext.Provider value={studioCtx}>
      <OverflowSection expsProvider={provider} />
    </StudioCtxContext.Provider>,
  );

  expect(screen.getByRole("heading", { name: "Overflow" })).toBeInTheDocument();
  expect(screen.getByTestId("toggle-group")).toHaveAttribute(
    "data-value",
    "undefined",
  );
  expect(inputs.get).not.toHaveBeenCalled();
});
