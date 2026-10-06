import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  beginCanvasInspection,
  endCanvasInspection,
} from "@/wab/client/copilot/canvas-inspection";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTag } from "@/wab/shared/core/tpls";
import { ArenaFrame } from "@/wab/shared/model/classes";

function fixture() {
  const { studioCtx } = fakeStudioCtx();
  const component = mkComponent({
    name: "Inspection",
    type: ComponentType.Plain,
    tplTree: mkTplTag("div"),
  });
  const viewCtx = mockDeepAuto<ViewCtx>();
  const doc = document.implementation.createHTMLDocument();
  const iframe = doc.documentElement;
  iframe.setAttribute("data-plasmic-canvas-inspection", "original");
  viewCtx.canvasCtx.doc.mockReturnValue(doc);
  const frame = mockDeepAuto<ArenaFrame>();
  Object.defineProperty(frame, "uuid", { value: "frame" });
  viewCtx.arenaFrame.mockReturnValue(frame);
  const background = vi
    .spyOn(studioCtx, "withBackgroundViewCtxForComponent")
    .mockImplementation(async (_component, read) => read(viewCtx));
  const navigate = vi.spyOn(studioCtx, "switchToArena");
  return { studioCtx, component, iframe, background, navigate, viewCtx };
}

it("pins a marked background frame and restores it on release without switching the arena", async () => {
  const { studioCtx, component, iframe, navigate } = fixture();
  const arena = studioCtx.currentArena;
  const inspection = await beginCanvasInspection(studioCtx, component);
  expect(iframe.getAttribute("data-plasmic-canvas-inspection")).toBe(
    inspection.inspectionId,
  );
  expect(inspection).toMatchObject({
    componentUuid: component.uuid,
    frameUuid: "frame",
  });
  expect(await endCanvasInspection(studioCtx, inspection.inspectionId)).toEqual(
    { released: true },
  );
  expect(iframe.getAttribute("data-plasmic-canvas-inspection")).toBe(
    "original",
  );
  expect(await endCanvasInspection(studioCtx, inspection.inspectionId)).toEqual(
    { released: false },
  );
  expect(studioCtx.currentArena).toBe(arena);
  expect(navigate).not.toHaveBeenCalled();
});

it("reports a missing canvas rather than leaving an unresolved inspection", async () => {
  const { studioCtx, component, background } = fixture();
  background.mockResolvedValue(null);
  await expect(beginCanvasInspection(studioCtx, component)).rejects.toThrow(
    "No canvas",
  );
});

it("marks the rendered document after the canvas finishes synchronizing", async () => {
  const { studioCtx, component, viewCtx, iframe } = fixture();
  const renderedDoc = document.implementation.createHTMLDocument();
  viewCtx.awaitSync.mockImplementation(async () => {
    viewCtx.canvasCtx.doc.mockReturnValue(renderedDoc);
  });
  const inspection = await beginCanvasInspection(studioCtx, component);
  expect(iframe.getAttribute("data-plasmic-canvas-inspection")).toBe(
    "original",
  );
  expect(
    renderedDoc.documentElement.getAttribute("data-plasmic-canvas-inspection"),
  ).toBe(inspection.inspectionId);
  await endCanvasInspection(studioCtx, inspection.inspectionId);
  expect(
    renderedDoc.documentElement.hasAttribute("data-plasmic-canvas-inspection"),
  ).toBe(false);
});

it("expires abandoned inspections and restores the frame marker", async () => {
  vi.useFakeTimers();
  try {
    const { studioCtx, component, iframe } = fixture();
    const inspection = await beginCanvasInspection(studioCtx, component);
    await vi.advanceTimersByTimeAsync(120000);
    expect(iframe.getAttribute("data-plasmic-canvas-inspection")).toBe(
      "original",
    );
    expect(
      await endCanvasInspection(studioCtx, inspection.inspectionId),
    ).toEqual({ released: false });
  } finally {
    vi.useRealTimers();
  }
});
