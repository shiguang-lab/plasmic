import { PreselectBox, PreselectBoxes } from "@/wab/client/components/canvas/HoverBox/PreselectBoxes";
import { computeScalerVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { SQ, type Selectable } from "@/wab/shared/core/selection";
import { Arena, type ArenaFrame } from "@/wab/shared/model/classes";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { cleanup, render, waitFor } from "@testing-library/react";
import $ from "jquery";
import React from "react";

vi.mock("@/wab/client/contexts/StudioContexts", async (original) => ({
  ...await original<typeof import("@/wab/client/contexts/StudioContexts")>(),
  useStudioCtx: vi.fn(),
}));
vi.mock("@/wab/shared/core/selection", async (original) => ({
  ...await original<typeof import("@/wab/shared/core/selection")>(),
  SQ: vi.fn(),
}));
vi.mock("@/wab/client/components/canvas/EditableNodeLabel", () => ({
  EditableNodeLabel: () => null,
}));
vi.mock("@/wab/client/utils/tpl-client-utils", () => ({
  summarizeFocusObj: () => "Field",
}));
vi.mock("@/wab/client/components/sidebar-tabs/tpl-tree", () => ({
  createNodeIcon: () => undefined,
}));
vi.mock("@/wab/client/components/canvas/HoverBox/useTagPlacement", () => ({
  useTagPlacement: () => ({}),
}));
vi.mock("@/wab/client/components/canvas/HoverBox/visible-bounds", () => ({
  computeScalerVisibility: vi.fn(() => ({
    visible: { top: 0, left: 0, width: 100, height: 50 },
  })),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

function element(parent = document.body) {
  const node = document.createElement("div");
  Object.defineProperty(node, "offsetWidth", { value: 100 });
  Object.defineProperty(node, "offsetHeight", { value: 50 });
  parent.appendChild(node);
  return node;
}

function outline(roots: HTMLElement[], hovered: HTMLElement, isHoveredElt = false, live = false) {
  const viewCtx = {
    dom2focusObj: () => undefined,
    selectionDom: () => $(roots),
    $hoveredDomElt: () => $(hovered),
    contentEditor: { contains: () => true },
    canvasCtx: { $doc: () => $(document) },
    hoverVariantTplMgr: () => ({
      isTargetingNonBaseVariant: () => false,
      effectiveVariantSetting: () => undefined,
    }),
  } as unknown as ViewCtx;
  const studioCtx = {
    focusedViewCtx: () => undefined,
    shouldHidePreselectBox: () => false,
    showStackOfParents: false,
    zoom: 1,
  } as unknown as StudioCtx;
  const selectable = { tpl: mkTplTagX("div") } as Selectable;
  if (live) {
    const frame = {} as ArenaFrame;
    Object.assign(viewCtx, {
      arenaFrame: () => frame,
      hoveredSelectable: () => selectable,
      sel2cloneKey: () => undefined,
      valState: () => undefined,
    });
    Object.assign(studioCtx, {
      isTransforming: () => false,
      viewCtxs: [viewCtx],
      currentArena: new Arena({ name: "Page", children: [frame] }),
      showAncestorsHoverBoxes: () => false,
    });
    vi.mocked(SQ).mockReturnValue({
      ancestors: () => ({ toArray: () => [selectable] }),
    } as unknown as ReturnType<typeof SQ>);
    vi.mocked(useStudioCtx).mockReturnValue(studioCtx);
    return render(<PreselectBoxes />);
  }
  return render(
    <PreselectBox
      selectable={selectable}
      cloneKey={undefined}
      studioCtx={studioCtx}
      viewCtx={viewCtx}
      isHoveredElt={isHoveredElt}
    />,
  );
}

it("does not outline background model ancestors of a portaled dialog", () => {
  const background = element();
  const dialog = element();
  const button = element(dialog);
  const { container } = outline([background], button);
  expect(container.querySelector(".PreselectBox")).toBeNull();
  expect(computeScalerVisibility).not.toHaveBeenCalled();
});

it("keeps ancestor outlines within the dialog content", () => {
  const dialog = element();
  const form = element(dialog);
  const field = element(form);
  const { container } = outline([form], field);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  expect(vi.mocked(computeScalerVisibility).mock.calls[0][0].toArray()).toEqual([form]);
});

it("excludes background roots from a component that also renders a portal", () => {
  const background = element();
  const dialog = element();
  const field = element(dialog);
  const { container } = outline([background, dialog], field);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  expect(vi.mocked(computeScalerVisibility).mock.calls[0][0].toArray()).toEqual([dialog]);
});

it("preserves ordinary non-portal ancestor outlines", () => {
  const section = element();
  const field = element(section);
  const { container } = outline([section], field);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});

it("hides a stale background hover target when a modal opens over it", () => {
  const opener = element();
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const { container } = outline([opener], opener, true);
  expect(container.querySelector(".PreselectBox")).toBeNull();
  expect(computeScalerVisibility).not.toHaveBeenCalled();
});

it("keeps hovered fields inside the active modal", () => {
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const field = element(modal);
  const { container } = outline([field], field, true);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});

it("does not let a hidden modal suppress background hover", () => {
  const field = element();
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.style.visibility = "hidden";
  const { container } = outline([field], field, true);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});

it("restricts hover to the last visible nested modal", () => {
  const first = element();
  const second = element();
  for (const modal of [first, second]) {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
  }
  const field = element(first);
  const { container } = outline([field], field, true);
  expect(container.querySelector(".PreselectBox")).toBeNull();
});

it("updates stale hover when a modal opens and closes without another mousemove", async () => {
  const opener = element();
  const { container } = outline([opener], opener, true, true);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  await waitFor(() => expect(container.querySelector(".PreselectBox")).toBeNull());
  modal.remove();
  await waitFor(() => expect(container.querySelector(".PreselectBox")).not.toBeNull());
});
