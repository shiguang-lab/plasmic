import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { ModalScope } from "@/wab/client/components/widgets/ModalScope";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import { theme as AntdTheme } from "antd";
import React from "react";

afterEach(() => {
  cleanup();
  setAppearancePreference("light");
});

it.each([false, true])("preserves theme corners with full-bleed content (custom render: %s)", (customRender) => {
  const content = <div style={{ background: "black", height: 40 }}>Dialog content</div>;
  render(
    <AntdConfigProvider productUI>
      <Modal
        open
        footer={null}
        className="caller-class"
        styles={{ container: { padding: 0 } }}
        modalRender={customRender ? (node) => <div data-test-id="custom-modal-wrapper">{node}</div> : undefined}
      >
        {content}
      </Modal>
    </AntdConfigProvider>,
  );
  const surface = ensure(screen.getByText("Dialog content").closest(".ant-modal-container"), "Expected modal surface");
  expect(surface.closest(".caller-class")).toBeTruthy();
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = AntdTheme.getDesignToken(productTheme(appearance));
    // jsdom does not resolve CSS variables used by Ant Design's native surface.
    expect(getComputedStyle(surface).borderRadius).toBe("var(--ant-border-radius-lg)");
    expect(Array.from(document.querySelectorAll("style")).some((style) => style.textContent?.includes(`--ant-border-radius-lg:${token.borderRadiusLG}px`))).toBe(true);
    expect(getComputedStyle(surface).pointerEvents).toBe("auto");
    expect(getComputedStyle(surface).overflow).toBe("hidden");
  }
  expect((surface as HTMLElement).style.padding).toBe("0px");
  if (customRender) { expect(surface.closest('[data-test-id="custom-modal-wrapper"]')).toBeTruthy(); }
});

it("does not automatically focus modal actions", async () => {
  render(
    <AntdConfigProvider productUI>
      <Modal open title="Settings">
        <input aria-label="Name" />
      </Modal>
    </AntdConfigProvider>,
  );
  // Include the layout fallback timer and React Aria's animation-frame focus.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(screen.getAllByRole("button").some((button) => button === document.activeElement)).toBe(false);
});

it("preserves explicit input autofocus inside a modal scope", async () => {
  render(
    <ModalScope>
      <button>Close</button>
      <input aria-label="Name" autoFocus />
    </ModalScope>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));
});
