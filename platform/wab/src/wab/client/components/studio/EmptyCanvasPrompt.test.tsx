import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { EmptyCanvasPrompt } from "@/wab/client/components/studio/EmptyCanvasPrompt";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);

it("updates AI entry availability when project editing permissions change", async () => {
  const { studioCtx, appCtx } = fakeStudioCtx({});
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  appCtx.appConfig.enableLocalAiEditing = true;
  const { unmount } = render(<EmptyCanvasPrompt studioCtx={studioCtx} emptyProject />);
  try {
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Describe your idea" });
    expect(button.disabled).toBe(false);
    act(() => { studioCtx.editMode = false; });
    expect(button.disabled).toBe(true);
    act(() => { studioCtx.editMode = true; });
    expect(button.disabled).toBe(false);
  } finally {
    unmount();
    studioCtx.dispose();
  }
});
