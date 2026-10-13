import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import indicator from "@/wab/client/components/style-controls/DefinedIndicator.module.sass";
import { ImagePreview } from "@/wab/client/components/style-controls/ImageSelector";
import { SourceRow } from "@/wab/client/components/style-controls/DefinedIndicator";
import Indicator from "@/wab/client/components/style-controls/Indicator";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { placeholderImgUrl } from "@/wab/shared/urls";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { theme } from "antd";
import * as React from "react";

afterEach(cleanup);

it("updates property inputs, bindings, indicators and image placeholders across themes", () => {
  render(
    <AntdConfigProvider productUI>
      <div className="generic-prop-editor">
        <div className="code-editor-input" data-testid="binding">
          <span className="text-set" data-testid="expression">$state.name</span>
        </div>
      </div>
      <div className="templated-string-input">
        <span className="code-chip" data-testid="chip">$state.name</span>
      </div>
      <div className="right-panel-input-background__no-height" data-testid="multi-select">
        <span className="multi-select-prop-pill" data-testid="pill">English</span>
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
      expect(getComputedStyle(screen.getByTestId(id)).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    }
    probe.style.background = token.colorSuccessBg;
    probe.style.color = token.colorSuccessText;
    for (const id of ["expression", "chip"]) {
      const actual = getComputedStyle(screen.getByTestId(id));
      expect(actual.backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
      expect(actual.color).toBe(getComputedStyle(probe).color);
    }
    probe.style.boxShadow = "none";
    expect(getComputedStyle(screen.getByTestId("indicator")).boxShadow).toBe(getComputedStyle(probe).boxShadow);
    const placeholder = document.querySelector(".img-thumb--placeholder");
    expect(placeholder).not.toBeNull();
    if (placeholder) {
      probe.style.background = token.colorFillSecondary;
      expect(getComputedStyle(placeholder).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
      expect(getComputedStyle(placeholder).backgroundImage).toBe("none");
      expect(placeholder.querySelector("svg")).not.toBeNull();
    }
    probe.remove();
  }
});

it("preserves the actual image preview", () => {
  const { container } = render(<ImagePreview uri="https://example.com/logo.png" />);
  expect(container.querySelector(".img-thumb--placeholder")).toBeNull();
  expect(container.querySelector<HTMLElement>(".img-thumb")?.style.backgroundImage).toContain("https://example.com/logo.png");
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
          <div className="defined-indicator__source-stack" data-testid="source-stack">
            <SourceRow title="Base" type="target" icon={<span>◇</span>} onClear={clear}>
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
    expect(getComputedStyle(stack).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    expect(getComputedStyle(screen.getByText("数禾经营 OS")).color).toBe(getComputedStyle(probe).color);
    expect(getComputedStyle(screen.getByText("数禾经营 OS")).whiteSpace).toBe("normal");
    probe.remove();
  }
  const reset = stack.querySelector<HTMLElement>('[data-test-class="indicator-clear"]');
  expect(reset).not.toBeNull();
  if (reset) {
    fireEvent.click(reset);
  }
  expect(clear).toHaveBeenCalledOnce();
});
