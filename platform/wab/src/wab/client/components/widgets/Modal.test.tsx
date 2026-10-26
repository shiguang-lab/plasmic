import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { ModalScope } from "@/wab/client/components/widgets/ModalScope";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen } from "@testing-library/react";
import { theme } from "antd";
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
        modalRender={customRender ? () => <div className="ant-modal-content">{content}</div> : undefined}
      >
        {content}
      </Modal>
    </AntdConfigProvider>,
  );
  const surface = ensure(screen.getByText("Dialog content").closest(customRender ? ".ant-modal-content" : ".ant-modal-container"), "Expected modal surface");
  expect(surface.closest(".caller-class")).toBeTruthy();
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    if (customRender) {
      expect(getComputedStyle(surface).borderRadius).toBe(`${token.borderRadiusLG}px`);
    } else {
      // jsdom does not resolve CSS variables used by Ant Design's native surface.
      expect(getComputedStyle(surface).borderRadius).toBe("var(--ant-border-radius-lg)");
      expect(Array.from(document.querySelectorAll("style")).some((style) => style.textContent?.includes(`--ant-border-radius-lg:${token.borderRadiusLG}px`))).toBe(true);
    }
    expect(getComputedStyle(surface).overflow).toBe("hidden");
  }
  if (!customRender) {
    expect((surface as HTMLElement).style.padding).toBe("0px");
  }
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
