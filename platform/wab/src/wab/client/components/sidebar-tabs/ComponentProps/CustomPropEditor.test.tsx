import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createSite } from "@/wab/shared/core/sites";
import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { CustomPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/CustomPropEditor";
import { CustomPropValueEcho as ValueEcho } from "../../../../../../../canvas-packages/src/custom-prop-value-echo";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import * as frameWindows from "@/wab/client/frame-ctx/windows";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { TplComponent } from "@/wab/shared/model/classes";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ConfigProvider, type ThemeConfig } from "antd";
import React from "react";
import * as ReactDOMClient from "react-dom/client";

function TextControl(props: {
  value?: string;
  updateValue: (v: string) => void;
}) {
  return (
    <input
      value={props.value ?? ""}
      onChange={(e) => props.updateValue(e.target.value)}
    />
  );
}

it("forwards live Studio theme changes to the isolated custom control root", async () => {
  const provider = vi.fn(({ children }: { children?: React.ReactNode; theme?: ThemeConfig }) => <>{children}</>);
  vi.spyOn(frameWindows, "getRootSub").mockReturnValue({
    React,
    ReactDOMClient,
    CustomPropValueEcho: ValueEcho,
    StudioControlsProvider: provider,
    GenericErrorBoundary: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    createModal: () => () => null,
  } as unknown as SubDeps);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const studioCtx = { site: createSite(), modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal }, getProjectData: () => ({ components: [], pages: [] }) } as unknown as StudioCtx;
  const onChange = vi.fn();
  const controls = (surface: string) => (
    <ConfigProvider theme={{ token: { colorBgContainer: surface } }}>
      <StudioCtxContext.Provider value={studioCtx}>
        <CustomPropEditor
          tpl={{} as TplComponent}
          value="Value"
          onChange={onChange}
          impl={TextControl}
          componentPropValues={{}}
          ccContextData={undefined}
          propName="Caption"
        />
      </StudioCtxContext.Provider>
    </ConfigProvider>
  );
  const view = render(controls("#202128"));
  try {
  for (const surface of ["#202128", "#ffffff", "#202128"]) {
    view.rerender(controls(surface));
    await waitFor(() => expect(provider.mock.lastCall?.[0].theme?.token?.colorBgContainer).toBe(surface));
  }
  fireEvent.change(view.container.querySelector("input") as HTMLInputElement, {
    target: { value: "Updated" },
  });
  expect(onChange).toHaveBeenCalledWith("Updated");
  } finally { view.unmount(); lifetime.abort(); models.dispose(); }
});
