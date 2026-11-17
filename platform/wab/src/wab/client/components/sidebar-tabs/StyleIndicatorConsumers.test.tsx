import "@/wab/client/components/sidebar/MixinControls";
import { InteractionStylesPanelSection } from "@/wab/client/components/sidebar-tabs/InteractionStylesPanelSection";
import { TransformPanelSection } from "@/wab/client/components/sidebar-tabs/TransformPanelSection";
import {
  SingleRsExpsProvider,
  StyleTarget,
  StyleTargetContext,
} from "@/wab/client/components/style-controls/StyleComponent";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ModalScope } from "@/wab/client/components/widgets/ModalScope";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { createSite } from "@/wab/shared/core/sites";
import { ensure } from "@/wab/shared/common";
import { CssTransforms } from "@/wab/shared/css/transforms";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({
  SidebarModal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
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
  const rs = ensure(site.activeTheme, "Expected a theme for the test site")
    .defaultStyle.rs;
  Object.assign(rs.values, values);
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

it("opens transform settings, creation and editing in popovers", async () => {
  const { studio, rs, provider, wrap } = await fixture();
  const definedIndicator = vi.spyOn(provider, "definedIndicator").mockImplementation(() => {
    throw new Error("Render must use native indicator recipes");
  });
  render(
    wrap(
      <ModalScope active>
        <TransformPanelSection expsProvider={provider} />
      </ModalScope>,
    ),
  );
  const header = screen.getByText("Transform");
  expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();

  const settingsTrigger = screen.getByRole("button", {
    name: "Transform Settings",
  });
  act(() => settingsTrigger.focus());
  fireEvent.click(settingsTrigger);
  const settings = await screen.findByRole("dialog", {
    name: "Transform Settings",
  });
  expect(settings.closest(".ant-popover")).toBeInTheDocument();
  const [origin] = within(settings).getAllByRole("textbox");
  act(() => origin.focus());
  expect(origin).toHaveFocus();
  fireEvent.click(within(settings).getByText("Hidden"));
  await waitFor(() => expect(rs.values["backface-visibility"]).toBe("hidden"));
  expect(settings).toBeInTheDocument();
  fireEvent.keyDown(settings, { key: "Escape" });
  expect(settingsTrigger).toHaveFocus();
  expect(settingsTrigger).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(header);
  await act(async () => { await studio.awaitEval(); });
  expect(rs.values.transform).toBeUndefined();
  expect(screen.queryByRole("dialog", { name: "Transform" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Add transform" }));
  await act(async () => { await studio.awaitEval(); });
  const editor = await screen.findByRole("dialog", { name: "Transform" });
  expect(editor.closest(".ant-popover")).toBeInTheDocument();
  expect(
    CssTransforms.fromCss(new RuleSetHelpers(rs, "div").get("transform")).transforms,
  ).toHaveLength(1);
  fireEvent.click(within(editor).getByText("Rotate"));
  const row = await screen.findByRole("button", { name: "Transform: Rotate" });
  expect(screen.getByRole("dialog", { name: "Transform" })).toBe(editor);
  fireEvent.keyDown(editor, { key: "Escape" });
  expect(row).toHaveFocus();
  fireEvent.click(row);
  expect(await screen.findByRole("dialog", { name: "Transform" })).toBeInTheDocument();
  fireEvent.pointerDown(document.body);
  fireEvent.mouseDown(document.body);
  expect(row).toHaveAttribute("aria-expanded", "false");

  fireEvent.contextMenu(header);
  expect(
    await screen.findByRole("menuitem", { name: /Move all Transform styles to a style preset/ }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Remove all Transform styles" })).toBeNull();
  expect(definedIndicator).not.toHaveBeenCalled();
  await act(async () => { await studio.awaitEval(); });
});

it("edits cursor and pointer events in the compact interaction row without changing effects", async () => {
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
  render(wrap(<InteractionStylesPanelSection expsProvider={provider} />));

  const cursor = screen.getByRole("combobox", { name: "Cursor" });
  expect(cursor).toHaveValue("pointer");
  fireEvent.change(cursor, { target: { value: "grab" } });
  await act(async () => { await studio.awaitEval(); });
  expect(rs.values.cursor).toBe("grab");
  const interactive = screen.getByRole("button", { name: "Pointer events" });
  expect(interactive).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(interactive);
  await act(async () => { await studio.awaitEval(); });

  expect(rs.values["pointer-events"]).toBe("none");
  expect(interactive).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(interactive);
  await act(async () => { await studio.awaitEval(); });
  expect(rs.values["pointer-events"]).toBe("auto");
  expect(interactive).toHaveAttribute("aria-pressed", "true");
  expect(rs.values.filter).toBe("blur(2px)");
  expect(rs.values["backdrop-filter"]).toBe("blur(2px)");
  expect(rs.values["mix-blend-mode"]).toBe("multiply");
  expect(rs.values.isolation).toBe("isolate");
  expect(definedIndicator).not.toHaveBeenCalled();
});
