import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { EnumPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/EnumPropEditor";
import {
  SidebarModal,
  SidebarModalProvider,
} from "@/wab/client/components/sidebar/SidebarModal";
import { SourceRow } from "@/wab/client/components/style-controls/DefinedIndicator";
import indicator from "@/wab/client/components/style-controls/DefinedIndicator.module.sass";
import { ImagePreview } from "@/wab/client/components/style-controls/ImageSelector";
import Indicator from "@/wab/client/components/style-controls/Indicator";
import Select from "@/wab/client/components/widgets/Select";
import Textarea from "@/wab/client/components/widgets/Textarea";
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
} from "@testing-library/react";
import { theme } from "antd";
import * as React from "react";

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
  fireEvent.click(option);
  expect(onChange).toHaveBeenCalledWith("avif");
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
