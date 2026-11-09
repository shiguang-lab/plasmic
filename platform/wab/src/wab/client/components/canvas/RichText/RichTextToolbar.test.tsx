import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { SingleRsStyleInputs } from "@/wab/client/studio-ctx/style-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { createSite } from "@/wab/shared/core/sites";
import RichTextToolbar from "@/wab/client/components/canvas/RichText/RichTextToolbar";
import { dispatchFrameInteraction } from "@/wab/client/frame-ctx/frame-interactions";
import type { EditingTextContext } from "@/wab/client/studio-ctx/view-ctx";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { createEditor } from "slate";
import { mock } from "vitest-mock-extended";

let arenaState: StudioArenaState;
let models: ModelSnapshots;
let studioCtx: StudioCtx;
let styleInputs: SingleRsStyleInputs;
const state = vi.hoisted(() => ({ blur: vi.fn() }));
vi.mock("@/wab/client/contexts/StudioContexts", async (original) => ({
  ...(await original<typeof import("@/wab/client/contexts/StudioContexts")>()),
  useStudioCtx: () => studioCtx,
}));
vi.mock(
  "@/wab/client/components/widgets/ColorPicker/client-token-resolver",
  () => ({
    useClientTokenValue: () => undefined,
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
      root, fontWeight,
    }: {
      root: { ref: React.Ref<HTMLDivElement> };
      fontWeight: { props: { type: string | string[] } };
    }) => (
      <div ref={root.ref} data-testid="toolbar" data-bold={fontWeight.props.type.includes("secondary")}>
        Toolbar
      </div>
    ),
  }),
);
beforeEach(() => {
  models = new ModelSnapshots();
  const site = createSite();
  arenaState = new StudioArenaState({ site, modelSnapshots: models });
  styleInputs = new SingleRsStyleInputs(() => models, arenaState.lifetime());
  const studio = mock<StudioCtx>(), view = mock<ViewCtx>();
  view.tryBlurEditingText.mockImplementation(state.blur);
  studio.focusedViewCtx.mockReturnValue(view);
  studio.subscribeModelChanges.mockReturnValue(() => undefined);
  Object.defineProperties(studio, {
    arenaState: { value: arenaState }, modelSnapshots: { value: models }, site: { value: site },
    singleRsStyleInputs: { value: styleInputs }, uiEnvironment: { value: createStudioUiEnvironmentFixture().uiEnvironment },
  });
  studioCtx = studio;
});
afterEach(() => {
  cleanup();
  state.blur.mockClear();
  styleInputs.dispose(); arenaState.dispose(); models.dispose();
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


it("updates formatting when the selection changes on the same Slate editor", () => {
  const editor = createEditor();
  editor.children = [{ type: "TplTag", tag: "p", children: [
    { text: "bold", "font-weight": "700" }, { text: "plain" },
  ] }] as any;
  editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 4 } };
  const context = () => mock<EditingTextContext>({ editor });
  const view = render(<RichTextToolbar ctx={context()} />);
  expect(screen.getByTestId("toolbar").getAttribute("data-bold")).toBe("true");
  editor.selection = { anchor: { path: [0, 1], offset: 0 }, focus: { path: [0, 1], offset: 5 } };
  view.rerender(<RichTextToolbar ctx={context()} />);
  expect(screen.getByTestId("toolbar").getAttribute("data-bold")).toBe("false");
});
