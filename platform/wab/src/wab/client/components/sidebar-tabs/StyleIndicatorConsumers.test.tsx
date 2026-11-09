import "@/wab/client/components/sidebar/MixinControls";
import { EffectsPanelSection } from "@/wab/client/components/sidebar-tabs/EffectsSection";
import { TransformPanelSection } from "@/wab/client/components/sidebar-tabs/TransformPanelSection";
import {
  SingleRsExpsProvider,
  StyleTarget,
  StyleTargetContext,
} from "@/wab/client/components/style-controls/StyleComponent";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { createSite } from "@/wab/shared/core/sites";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { CssTransforms } from "@/wab/shared/css/transforms";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ locale: "en", label: (text: string) => text, t: (text: string) => text }),
}));
vi.mock("@/wab/client/components/sidebar/sidebar-helpers", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/wab/client/components/sidebar/sidebar-helpers")
  >();
  return {
    ...actual,
    LabeledStyleSelectItem: ({ label }: { label?: React.ReactNode }) => <div>{label}</div>,
    LabeledStyleSelectItemRow: ({ label }: { label?: React.ReactNode }) => <div>{label}</div>,
    LabeledStyleSwitchItem: ({
      label,
      value,
      onChange,
    }: {
      label?: React.ReactNode;
      value?: boolean;
      onChange?: (value: boolean) => void;
    }) => (
      <label>
        {label}
        <input
          type="checkbox"
          checked={!!value}
          onChange={(event) => onChange?.(event.target.checked)}
        />
      </label>
    ),
  };
});
vi.mock("@/wab/client/components/sidebar-tabs/FilterEffectSection", () => ({
  FilterEffectSection: () => null,
  BackdropFilterEffectSection: () => null,
}));
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({
  SidebarModal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/wab/client/components/style-controls/TransformPanel", () => ({
  TransformPanel: () => null,
}));
vi.mock("@/wab/client/components/style-controls/TransformSettingsPanel", () => ({
  TransformSettingsPanel: () => null,
}));
vi.mock("@/wab/client/components/widgets", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/wab/client/components/widgets")
  >();
  return {
    ...actual,
    IconLinkButton: ({
      children,
      onClick,
      disabled,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button data-testid="icon-link-button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    ListBox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ListBoxItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

const studios: ReturnType<typeof fakeStudioCtx>["studioCtx"][] = [];
afterEach(async () => {
  cleanup();
  for (const studio of studios.splice(0)) {
    await studio.awaitEval();
    studio.dispose();
  }
  vi.restoreAllMocks();
});

async function fixture(values: Record<string, string> = {}) {
  const site = createSite();
  const rs = mkRuleSet({ values });
  const { studioCtx: studio } = fakeStudioCtx({ site });
  studios.push(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const provider = new SingleRsExpsProvider(
    rs,
    new RuleSetHelpers(rs, "div"),
    studio,
    [],
    { kind: "ruleSet", rs, forTag: "div" },
  );
  const sc = new StyleTarget({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => (
    <StudioCtxContext.Provider value={studio}>
      <StyleTargetContext.Provider value={sc}>
        {children}
      </StyleTargetContext.Provider>
    </StudioCtxContext.Provider>
  );
  return { studio, rs, provider, wrap };
}

it("renders Transform from native cells/indicators and preserves the add-transform command", async () => {
  const { studio, rs, provider, wrap } = await fixture();
  const definedIndicator = vi.spyOn(provider, "definedIndicator").mockImplementation(() => {
    throw new Error("Render must use native indicator recipes");
  });
  render(wrap(<TransformPanelSection expsProvider={provider} />));

  const buttons = screen.getAllByTestId("icon-link-button");
  fireEvent.click(buttons[1]);
  await act(async () => { await studio.awaitEval(); });

  const transform = new RuleSetHelpers(rs, "div").get("transform");
  expect(CssTransforms.fromCss(transform).transforms).toHaveLength(1);
  expect(definedIndicator).not.toHaveBeenCalled();
});

it("derives Effects isSet from native indicator sources and preserves pointer-events writes", async () => {
  const { studio, rs, provider, wrap } = await fixture({
    cursor: "pointer",
    "pointer-events": "auto",
    "mix-blend-mode": "multiply",
    isolation: "isolate",
    filter: "blur(2px)",
    "backdrop-filter": "blur(2px)",
  });
  const definedIndicator = vi.spyOn(provider, "definedIndicator").mockImplementation(() => {
    throw new Error("Render must use native indicator recipes");
  });
  render(wrap(<EffectsPanelSection expsProvider={provider} />));

  const interactive = screen.getByRole("checkbox", { name: "Interactive" });
  expect(interactive).toBeChecked();
  fireEvent.click(interactive);
  await act(async () => { await studio.awaitEval(); });

  expect(rs.values["pointer-events"]).toBe("none");
  expect(definedIndicator).not.toHaveBeenCalled();
});
