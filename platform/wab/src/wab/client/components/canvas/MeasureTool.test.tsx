import { MeasureTool } from "@/wab/client/components/canvas/MeasureTool";
import { Box } from "@/wab/shared/geom";
import { act, render } from "@testing-library/react";
import $ from "jquery";
import { observable, runInAction } from "mobx";
import React from "react";

vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  withStudioCtx: (component: unknown) => component,
}));
vi.mock("@/wab/client/studio-ctx/view-ctx", async () => ({
  ViewComponentBase: (await import("react")).Component,
}));
vi.mock("@/wab/client/dom", () => ({ hasLayoutBox: () => true }));
vi.mock("@/wab/client/components/canvas/HoverBox", () => ({
  recomputeBounds: ($node: JQuery) =>
    Box.fromRect($node[0].getBoundingClientRect()),
}));

it("updates existing measurement lines on nested content scroll and cleans up when changing frames", () => {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const doc = iframe.contentDocument!;
  const parent = doc.createElement("div");
  const child = doc.createElement("div");
  parent.append(child);
  doc.body.append(parent);
  let childY = 100;
  vi.spyOn(parent, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 400, 400),
  );
  vi.spyOn(child, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(50, childY, 100, 50),
  );
  const makeView = (document: Document) => ({
    canvasCtx: { $doc: () => $(document) },
    focusedDomElt: () => $(child),
    $measureToolDomElt: () => $(parent),
    arenaFrame: () => ({}),
    getViewOps: () => ({
      getFinalFocusable: () => ({ focusedDom: $(parent) }),
    }),
    studioCtx: { getArenaFrameScalerRect: () => ({ left: 0, top: 0 }) },
  });
  const focused = observable.box(makeView(doc), { deep: false });
  const studioCtx = {
    focusedViewCtx: () => focused.get(),
    zoom: 1,
    isResizeDragging: false,
  };
  const { container, unmount } = render(
    <MeasureTool studioCtx={studioCtx as any} />,
  );
  const topLine = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(".MeasureTool__Line"),
    ).find(
      (line) => line.style.left === "100px" && line.style.top === `${childY}px`,
    )!;
  expect(topLine().dataset.originalWidth).toBe("100");
  act(() => {
    childY = 40;
    parent.dispatchEvent(new Event("scroll"));
  });
  expect(topLine().dataset.originalWidth).toBe("40");
  const remove = vi.spyOn(doc, "removeEventListener");
  const nextDoc = document.implementation.createHTMLDocument();
  const nextRemove = vi.spyOn(nextDoc, "removeEventListener");
  act(() => runInAction(() => focused.set(makeView(nextDoc))));
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  unmount();
  expect(nextRemove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  iframe.remove();
});
