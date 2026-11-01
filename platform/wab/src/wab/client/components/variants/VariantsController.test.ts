import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";

it.each([false, true])(
  "does not construct a controller for a disposed panel view (focus mode %s)",
  (focusedMode) => {
    const studio = {
      focusedMode,
      focusedViewCtx: vi.fn(),
      focusedOrFirstViewCtx: vi.fn(),
    } as unknown as StudioCtx;
    const view = {
      isDisposed: true,
      componentStackFrames: () => {
        throw Error("Disposed view must not be read");
      },
    } as unknown as ViewCtx;
    expect(makeVariantsController(studio, view)).toBeUndefined();
    expect(studio.focusedViewCtx).not.toHaveBeenCalled();
    expect(studio.focusedOrFirstViewCtx).not.toHaveBeenCalled();
  },
);
