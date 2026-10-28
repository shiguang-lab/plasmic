import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import * as studioBundles from "@/wab/client/components/studio/studio-bundles";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { createSite } from "@/wab/shared/core/sites";
import $ from "jquery";

it("rejects a failed registration load and allows the queued retry to finish", async () => {
  const { studioCtx } = fakeStudioCtx();
  const error = new Error("Library registration unavailable");
  const load = vi.spyOn(studioBundles, "getSortedHostLessPkgs")
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce([]);
  const first = studioCtx.updateCcRegistry(["overseas"]);
  const retry = studioCtx.updateCcRegistry(["overseas"]);
  await expect(first).rejects.toBe(error);
  await expect(retry).resolves.toBeUndefined();
  expect(load).toHaveBeenCalledTimes(2);
}, 5000);

it("propagates registration script failures and retries them without deadlocking", async () => {
  const { studioCtx } = fakeStudioCtx();
  const error = new Error("Invalid library registration");
  const domUtils = await import("@/wab/client/dom-utils");
  const execute = vi.spyOn(domUtils, "scriptExec")
    .mockImplementationOnce(() => { throw error; })
    .mockImplementationOnce(() => undefined);
  vi.spyOn(studioBundles, "getSortedHostLessPkgs").mockResolvedValue([["react-ui", "registration"]]);
  await expect(studioCtx.updateCcRegistry(["react-ui"])).rejects.toBe(error);
  await expect(studioCtx.updateCcRegistry(["react-ui"])).resolves.toBeUndefined();
  expect(execute).toHaveBeenCalledTimes(2);
}, 5000);

it("reloads the original registration when undo returns a library to a previously loaded version", async () => {
  const { studioCtx } = fakeStudioCtx();
  const domUtils = await import("@/wab/client/dom-utils");
  const execute = vi.spyOn(domUtils, "scriptExec").mockImplementation(() => undefined);
  vi.spyOn(studioBundles, "getSortedHostLessPkgs")
    .mockResolvedValueOnce([["overseas@1.0.0", "version one"]])
    .mockResolvedValueOnce([["overseas@2.0.0", "version two"]])
    .mockResolvedValueOnce([["overseas@1.0.0", "version one"]]);
  await studioCtx.updateCcRegistry(["overseas"]);
  await studioCtx.updateCcRegistry(["overseas"]);
  await studioCtx.updateCcRegistry(["overseas"]);
  expect(execute.mock.calls.map(([, source]) => source)).toEqual(["version one", "version two", "version one"]);
});

it("releases the canvas loading count after a failed registration and allows the next load", async () => {
  const canvas = new CanvasCtx({ $viewport: $(document.createElement("iframe")), name: "Audit" });
  canvas._win = window;
  const failure = new Error("Canvas registration unavailable");
  vi.spyOn(studioBundles, "getSortedHostLessPkgs").mockRejectedValueOnce(failure).mockResolvedValueOnce([]);
  await expect(canvas["updateCcRegistry"](["react-ui"], createSite())).rejects.toBe(failure);
  expect(canvas.isUpdatingCcRegistry()).toBe(false);
  await expect(canvas["updateCcRegistry"](["react-ui"], createSite())).resolves.toBeUndefined();
  expect(canvas.isUpdatingCcRegistry()).toBe(false);
});
