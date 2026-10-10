import PageSettings from "@/wab/client/components/PageSettings";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType, PageComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => ({
    projectFlags: () => ({}),
    customFunctionsSchema: () => ({}),
  }),
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/legacy-component-params-section",
  () => ({ LegacyComponentParamsSection: () => null }),
);
vi.mock("@/wab/client/components/style-controls/ImageSelector", () => ({
  ImageAssetPreviewAndPicker: () => (
    <div data-testid="image-chooser">Image chooser</div>
  ),
}));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", async () => {
  const ReactModule = await import("react");
  return {
    PropValueEditorContext: ReactModule.createContext({}),
    InnerPropEditorRow: ({ label }) => <input aria-label={label} readOnly />,
    PropEditorRow: () => null,
  };
});
afterEach(cleanup);

it("opens the image chooser without a rendered canvas and keeps it open across form renders", async () => {
  const mgr = new TplMgr({ site: createSite() });
  const page = mgr.addComponent({
    name: "Page2",
    type: ComponentType.Page,
  }) as PageComponent;
  const { rerender } = render(<PageSettings page={page} />);
  const trigger = screen.getByRole("button", { name: "Choose an image" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);
  expect(await screen.findByTestId("image-chooser")).toBeTruthy();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  rerender(<PageSettings page={page} className="updated-form" />);
  expect(
    screen
      .getByRole("button", { name: "Choose an image" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
});
