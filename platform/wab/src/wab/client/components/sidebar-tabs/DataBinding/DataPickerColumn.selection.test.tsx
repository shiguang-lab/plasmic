import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import DataPickerColumn from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerColumn";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { render, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/plasmic/plasmic_kit_data_binding/PlasmicDataPickerColumn", () => ({
  PlasmicDataPickerColumn: ({ children, root }: React.PropsWithChildren<{ root: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> } }>) => <div {...root}>{children}</div>,
}));

it("keeps hook ownership valid as an unresolved column gains and loses data", async () => {
  const { studioCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const error = vi.spyOn(console, "error");
  const column = (data: Record<string, unknown> | undefined) => <StudioCtxContext.Provider value={studioCtx}>
    <DataPickerColumn data={data} columnIndex={0} selectedItem={undefined} isActiveColumn columnItems={[]} onItemSelected={vi.fn()} opts={{ showAdvancedFields: false }} />
  </StudioCtxContext.Provider>;
  const view = render(<React.StrictMode>{column(undefined)}</React.StrictMode>);
  try {
    view.rerender(<React.StrictMode>{column({ value: "ready" })}</React.StrictMode>);
    expect(view.container.querySelector("#data-picker-column-0")).toBeTruthy();
    view.rerender(<React.StrictMode>{column(undefined)}</React.StrictMode>);
    expect(view.container.querySelector("#data-picker-column-0")).toBeNull();
    view.rerender(<React.StrictMode>{column({ other: "ready again" })}</React.StrictMode>);
    expect(view.container.querySelector("#data-picker-column-0")).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
  } finally { view.unmount(); error.mockRestore(); studioCtx.dispose(); }
});
