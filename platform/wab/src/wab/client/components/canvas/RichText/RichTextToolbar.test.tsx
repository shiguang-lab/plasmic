import RichTextToolbar from "@/wab/client/components/canvas/RichText/RichTextToolbar";
import { dispatchFrameInteraction } from "@/wab/client/frame-ctx/frame-interactions";
import type { EditingTextContext } from "@/wab/client/studio-ctx/view-ctx";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const state = vi.hoisted(() => ({ blur: vi.fn() }));
vi.mock("@/wab/client/contexts/StudioContexts", async (original) => ({
  ...(await original<typeof import("@/wab/client/contexts/StudioContexts")>()),
  useStudioCtx: () => ({
    focusedViewCtx: () => ({ tryBlurEditingText: state.blur }),
    getCurrentUiConfig: () => ({}),
    contentEditorMode: false,
    focusedMode: false,
  }),
}));
vi.mock(
  "@/wab/client/components/widgets/ColorPicker/client-token-resolver",
  () => ({
    useClientTokenResolver: () => ({}),
  }),
);
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({
  SidebarModalProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_rich_text_toolbar/PlasmicRichTextToolbar",
  () => ({
    PlasmicRichTextToolbar: ({
      root,
    }: {
      root: { ref: React.Ref<HTMLDivElement> };
    }) => (
      <div ref={root.ref} data-testid="toolbar">
        Toolbar
      </div>
    ),
  }),
);
afterEach(() => {
  cleanup();
  state.blur.mockClear();
});
function setup() {
  render(
    <RichTextToolbar ctx={mock<EditingTextContext>({ editor: undefined })} />,
  );
}
it("keeps the canvas text edit active for forwarded iframe pointer notifications", () => {
  setup();
  dispatchFrameInteraction(document, {
    type: "pointerdown",
    button: 0,
    buttons: 1,
    clientX: 10,
    clientY: 10,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    pointerId: 1,
    pointerType: "mouse",
  });
  expect(state.blur).not.toHaveBeenCalled();
});
it("commits for real outside studio clicks while preserving toolbar and popup interaction", () => {
  setup();
  const press = (target: Element) =>
    fireEvent(
      target,
      new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
    );
  press(screen.getByTestId("toolbar"));
  const popup = document.createElement("div");
  popup.className = "ant-modal-root";
  document.body.append(popup);
  press(popup);
  expect(state.blur).not.toHaveBeenCalled();
  popup.remove();
  press(document.body);
  expect(state.blur).toHaveBeenCalledTimes(1);
});
