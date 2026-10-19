import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { EnumPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/EnumPropEditor";
import {
  SidebarModal,
  SidebarModalProvider,
} from "@/wab/client/components/sidebar/SidebarModal";
import {
  DefinedIndicator,
  SourceRow,
} from "@/wab/client/components/style-controls/DefinedIndicator";
import indicator from "@/wab/client/components/style-controls/DefinedIndicator.module.sass";
import { ImagePreview } from "@/wab/client/components/style-controls/ImageSelector";
import Indicator from "@/wab/client/components/style-controls/Indicator";
import Select from "@/wab/client/components/widgets/Select";
import Textarea from "@/wab/client/components/widgets/Textarea";
import { ListBox } from "@/wab/client/components/widgets";
import { SectionSeparator } from "@/wab/client/components/sidebar/sidebar-helpers";
import styleSelectOption from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Option.module.css";
import styleSelectOverlay from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Overlay.module.css";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { placeholderImgUrl } from "@/wab/shared/urls";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ConfigProvider, theme } from "antd";
import { observable } from "mobx";
import { mock } from "vitest-mock-extended";
import * as React from "react";
import {
  ExpsProvider,
  SingleRsExpsProvider,
  StylePanelSection,
} from "@/wab/client/components/style-controls/StyleComponent";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { codeLit } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { AttrSource } from "@/wab/shared/defined-indicator";

// Codegen tests require unscoped CSS module names in Vitest. Keep these
// modules distinct, as in Studio, so tooltip slots cannot alias option slots.
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Overlay.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => `format-overlay-${String(key)}` },
    ),
  }),
);
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Option.module.css",
  () => ({
    default: new Proxy(
      {},
      { get: (_target, key) => `format-option-${String(key)}` },
    ),
  }),
);

afterEach(cleanup);

it("keeps sidebar modal surfaces readable with a light scrim across themes", async () => {
  const onClose = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <SidebarModalProvider containerSelector="#token-sidebar">
        <div id="token-sidebar">Data tokens</div>
        <SidebarModal show title="Edit data token" onClose={onClose}>
          <Select aria-label="Type" value="code" type="bordered">
            <Select.Option value="code">Code Expression</Select.Option>
          </Select>
        </SidebarModal>
      </SidebarModalProvider>
    </AntdConfigProvider>,
  );
  const title = await screen.findByText("Edit data token");
  const popup = ensure(
    title.closest(".panel-popup"),
    "Expected the sidebar modal surface",
  );
  const mask = ensure(
    popup.closest(".right-pane__mask"),
    "Expected the sidebar modal scrim",
  );
  const select = screen.getByRole("button", { name: /Type/ });
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    probe.style.backgroundColor = "rgba(0, 0, 0, 0.15)";
    expect(getComputedStyle(mask).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor,
    );
    probe.style.backgroundColor = token.colorBgElevated;
    probe.style.color = token.colorText;
    expect(getComputedStyle(popup).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor,
    );
    expect(getComputedStyle(title).color).toBe(getComputedStyle(probe).color);
    probe.style.backgroundColor = token.colorBgContainer;
    expect(getComputedStyle(select).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor,
    );
    probe.remove();
  }
  fireEvent.click(
    ensure(
      document.querySelector<HTMLElement>(
        '[data-test-id="close-sidebar-modal"]',
      ),
      "Expected the sidebar modal close button",
    ),
  );
  expect(onClose).toHaveBeenCalledOnce();
});

it("themes the image format menu portal and keeps selection working", async () => {
  const onChange = vi.fn();
  const { container } = render(
    <AntdConfigProvider productUI>
      <EnumPropEditor
        aria-label="Format"
        value={undefined}
        defaultValueHint="webp"
        options={[
          { value: "avif", label: "AVIF" },
          { value: "jpeg", label: "JPEG" },
          { value: "png", label: "PNG" },
          { value: "webp", label: "WebP" },
        ]}
        onChange={onChange}
      />
    </AntdConfigProvider>,
  );
  fireEvent.click(screen.getByRole("button"));
  const option = await screen.findByRole("option", { name: "AVIF" });
  expect(container.contains(option)).toBe(false);
  const surface = ensure(
    option.closest(`.${styleSelectOverlay.main}`),
    "Expected the portaled format menu surface",
  );
  const label = ensure(
    option.querySelector(`.${styleSelectOption.slotTargetChildren}`),
    "Expected the format option label",
  );
  const overlay = ensure(
    surface.closest(`.${styleSelectOverlay.root}`),
    "Expected the Plume overlay root",
  );
  const overlayParent = ensure(overlay.parentElement, "Expected portal container");
  // A Plume portal must carry its palette even outside the body's theme scope.
  document.documentElement.appendChild(overlay);
  try {
    for (const appearance of ["dark", "light"] as const) {
      act(() => setAppearancePreference(appearance));
      const token = theme.getDesignToken(productTheme(appearance));
      const probe = document.createElement("div");
      probe.style.backgroundColor = token.colorBgElevated;
      probe.style.color = token.colorText;
      document.body.appendChild(probe);
      expect(getComputedStyle(surface).backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
      expect(getComputedStyle(label).color).toBe(getComputedStyle(probe).color);
      probe.remove();
    }
  } finally {
    overlayParent.appendChild(overlay);
  }
  fireEvent.click(option);
  expect(onChange).toHaveBeenCalledWith("avif");
});

it.each([false, true])("themes list add actions and sizing separators with disabled=%s", (disabled) => {
  const add = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <ListBox appendPrepend="append" addText="Add item" onAdd={add} disabled={disabled} />
      <SectionSeparator className="property-separator" />
    </AntdConfigProvider>,
  );
  const button = screen.getByRole("button", { name: /Add item/ });
  const separator = ensure(document.querySelector(".property-separator"), "Expected sizing separator");
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const probe = document.createElement("div");
    probe.style.backgroundColor = token.colorBorderSecondary;
    probe.style.color = disabled ? token.colorTextDisabled : token.colorText;
    document.body.appendChild(probe);
    expect(getComputedStyle(button).color).toBe(getComputedStyle(probe).color);
    expect(getComputedStyle(separator).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    probe.remove();
  }
  fireEvent.click(button);
  expect(add).toHaveBeenCalledTimes(disabled ? 0 : 1);
});

it("keeps selected and focused format options readable across themes", async () => {
  render(
    <AntdConfigProvider productUI>
      <EnumPropEditor
        aria-label="Format"
        value="webp"
        options={[
          { value: "jpeg", label: "JPEG" },
          { value: "webp", label: "WebP" },
        ]}
        onChange={vi.fn()}
      />
    </AntdConfigProvider>,
  );
  fireEvent.click(screen.getByRole("button"));
  const selected = await screen.findByRole("option", { name: "WebP" });
  const focused = screen.getByRole("option", { name: "JPEG" });
  act(() => focused.focus());
  expect(selected.getAttribute("aria-selected")).toBe("true");
  expect(focused.classList.contains(styleSelectOption.rootisHighlighted)).toBe(
    true,
  );
  const label = ensure(
    selected.querySelector(`.${styleSelectOption.slotTargetChildren}`),
    "Expected the selected format label",
  );
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    probe.style.backgroundColor = token.colorPrimaryBg;
    probe.style.color = token.colorPrimaryText;
    expect(getComputedStyle(selected).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor,
    );
    expect(getComputedStyle(label).color).toBe(getComputedStyle(probe).color);
    probe.style.backgroundColor = token.colorFillSecondary;
    expect(getComputedStyle(focused).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor,
    );
    probe.remove();
  }
});

it.each([false, true])(
  "themes multiline inputs with disabled=%s",
  (disabled) => {
    render(
      <AntdConfigProvider productUI>
        <Textarea
          textareaOverrides={{ "aria-label": "Description" }}
          whiteBackground
          disabled={disabled}
        />
      </AntdConfigProvider>,
    );
    const field = screen.getByRole("textbox");
    for (const appearance of ["dark", "light"] as const) {
      act(() => setAppearancePreference(appearance));
      const token = theme.getDesignToken(productTheme(appearance));
      const probe = document.createElement("div");
      probe.style.backgroundColor = disabled
        ? token.colorBgContainerDisabled
        : token.colorBgContainer;
      probe.style.color = disabled ? token.colorTextDisabled : token.colorText;
      document.body.appendChild(probe);
      expect(getComputedStyle(field).backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
      expect(getComputedStyle(field).color).toBe(getComputedStyle(probe).color);
      probe.remove();
    }
  },
);

it("updates property inputs, bindings, indicators and image placeholders across themes", () => {
  render(
    <AntdConfigProvider productUI>
      <div className="generic-prop-editor">
        <div className="code-editor-input" data-testid="binding">
          <span className="text-set" data-testid="expression">
            $state.name
          </span>
        </div>
      </div>
      <div className="templated-string-input">
        <span className="code-chip" data-testid="chip">
          $state.name
        </span>
      </div>
      <div
        className="right-panel-input-background__no-height"
        data-testid="multi-select"
      >
        <span className="multi-select-prop-pill" data-testid="pill">
          English
        </span>
      </div>
      <div className={indicator.DefinedIndicator} data-testid="indicator" />
      <ImagePreview uri={placeholderImgUrl()} />
    </AntdConfigProvider>,
  );
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    probe.style.background = token.colorBgContainer;
    for (const id of ["binding", "multi-select", "pill"]) {
      expect(getComputedStyle(screen.getByTestId(id)).backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
    }
    probe.style.background = token.colorSuccessBg;
    probe.style.color = token.colorSuccessText;
    for (const id of ["expression", "chip"]) {
      const actual = getComputedStyle(screen.getByTestId(id));
      expect(actual.backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
      expect(actual.color).toBe(getComputedStyle(probe).color);
    }
    probe.style.boxShadow = "none";
    expect(getComputedStyle(screen.getByTestId("indicator")).boxShadow).toBe(
      getComputedStyle(probe).boxShadow,
    );
    const placeholder = document.querySelector(".img-thumb--placeholder");
    expect(placeholder).not.toBeNull();
    if (placeholder) {
      probe.style.background = token.colorFillSecondary;
      expect(getComputedStyle(placeholder).backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
      expect(getComputedStyle(placeholder).backgroundImage).toBe("none");
      expect(placeholder.querySelector("svg")).not.toBeNull();
    }
    probe.remove();
  }
});

it("preserves the actual image preview", () => {
  const { container } = render(
    <ImagePreview uri="https://example.com/logo.png" />,
  );
  expect(container.querySelector(".img-thumb--placeholder")).toBeNull();
  expect(
    container.querySelector<HTMLElement>(".img-thumb")?.style.backgroundImage,
  ).toContain("https://example.com/logo.png");
});

it("themes the source popup and preserves its reset action", async () => {
  const clear = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <Indicator
        color="blue"
        data-testid="source-trigger"
        popoverTitle="Product name"
        popover={() => (
          <div
            className="defined-indicator__source-stack"
            data-testid="source-stack"
          >
            <SourceRow
              title="Base"
              type="target"
              icon={<span>◇</span>}
              onClear={clear}
            >
              数禾经营 OS
            </SourceRow>
          </div>
        )}
      />
    </AntdConfigProvider>,
  );
  fireEvent.mouseEnter(screen.getByTestId("source-trigger"));
  const stack = await screen.findByTestId("source-stack");
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const probe = document.createElement("div");
    probe.style.background = token.colorBgElevated;
    probe.style.color = token.colorText;
    document.body.appendChild(probe);
    expect(getComputedStyle(stack).backgroundColor).toBe(
      getComputedStyle(probe).backgroundColor,
    );
    expect(getComputedStyle(screen.getByText("数禾经营 OS")).color).toBe(
      getComputedStyle(probe).color,
    );
    expect(getComputedStyle(screen.getByText("数禾经营 OS")).whiteSpace).toBe(
      "normal",
    );
    probe.remove();
  }
  const reset = stack.querySelector<HTMLElement>(
    '[data-test-class="indicator-clear"]',
  );
  expect(reset).not.toBeNull();
  if (reset) {
    fireEvent.click(reset);
  }
  expect(clear).toHaveBeenCalledOnce();
});

it("themes the actual property-source popup outside the document's product theme scope", async () => {
  setAppearancePreference("dark");
  const popupHost = document.createElement("div");
  // Keep the portal in the document, but outside the body's theme boundary.
  document.documentElement.appendChild(popupHost);
  onTestFinished(() => popupHost.remove());
  const studioCtx = mock<StudioCtx>({ site: createSite() });
  studioCtx.viewCtxs = observable.array();
  studioCtx.focusedViewCtx.mockReturnValue(undefined);
  const source: AttrSource = {
    type: "attr",
    combo: [mkBaseVariant()],
    attr: "timeZone",
    value: codeLit("America/Mexico_City"),
  };
  render(
    <AntdConfigProvider productUI>
      <ConfigProvider getPopupContainer={() => popupHost}>
        <StudioCtxContext.Provider value={studioCtx}>
          <DefinedIndicator
            className="time-zone-source"
            label="Time zone"
            type={{ source: "set", stack: [source], targetSource: source }}
          />
        </StudioCtxContext.Provider>
      </ConfigProvider>
    </AntdConfigProvider>,
  );
  fireEvent.mouseEnter(
    ensure(document.querySelector(".time-zone-source"), "Expected source trigger"),
  );
  const base = await within(popupHost).findByText("Base");
  const value = within(popupHost).getByText('"America/Mexico_City"');
  const stack = ensure(
    base.closest(".defined-indicator__source-stack"),
    "Expected source stack",
  );
  const icon = ensure(
    stack.querySelector(".defined-indicator__source-icon"),
    "Expected source icon",
  );
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const probe = document.createElement("div");
    probe.style.backgroundColor = token.colorBgElevated;
    probe.style.color = token.colorText;
    document.body.appendChild(probe);
    for (const panel of [stack, icon]) {
      expect(getComputedStyle(panel).backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
    }
    expect(getComputedStyle(value).color).toBe(getComputedStyle(probe).color);
    const popup = ensure(stack.closest(".ant-popover"), "Expected popup root");
    expect(
      getComputedStyle(popup).getPropertyValue("--ui-elevated").trim(),
    ).toBe(token.colorBgElevated);
    expect(popup.classList.contains("defined-indicator__popover")).toBe(true);
    expect(within(popupHost).getByText("Time zone")).toBeTruthy();
    probe.remove();
  }
});

describe("removing a section's styles", () => {
  function setup(mixin = false) {
    const rs = mkRuleSet({ values: { color: "blue", position: "absolute" } });
    const exp = RSH(rs, mkTplTagX("div", {}));
    const studioCtx = {
      site: { mixins: [] },
      focusedViewCtx: () => undefined,
      changeUnsafe: async (change: () => void) => change(),
    } as unknown as StudioCtx;
    const provider = new SingleRsExpsProvider(rs, exp, studioCtx, []);
    // A Tpl provider and a mixin provider differ only in whether the section's
    // required layout defaults apply. Keep the actual ruleset operations.
    const expsProvider: ExpsProvider = mixin ? provider : { ...provider };
    render(
      <StudioCtxContext.Provider value={studioCtx}>
      <StylePanelSection
        title="Typography"
        styleProps={["color", "position"]}
        defaultStyleProps={new Map([["color", "red"], ["position", "relative"]])}
        unremovableStyleProps={["position"]}
        expsProvider={expsProvider}
      >
        <div>Style controls</div>
      </StylePanelSection>
      </StudioCtxContext.Provider>,
    );
    return rs;
  }

  it("clears removable defaults so inherited styles can take effect", async () => {
    const rs = setup();
    fireEvent.contextMenu(screen.getByText("Typography"));
    await act(async () => { fireEvent.click(await screen.findByRole("menuitem", { name: /Remove all Typography styles/ })); });
    expect(rs.values).toEqual({ position: "relative" });
  });

  it("clears mixin styles without inserting a component's layout defaults", async () => {
    const rs = setup(true);
    fireEvent.contextMenu(screen.getByText("Typography"));
    await act(async () => { fireEvent.click(await screen.findByRole("menuitem", { name: /Remove all Typography styles/ })); });
    expect(rs.values).toEqual({});
  });
});
