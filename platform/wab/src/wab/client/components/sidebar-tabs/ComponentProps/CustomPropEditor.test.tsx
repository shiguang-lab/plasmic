import { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { CustomPropEditor, _testonly } from "@/wab/client/components/sidebar-tabs/ComponentProps/CustomPropEditor";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import * as frameWindows from "@/wab/client/frame-ctx/windows";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { TplComponent } from "@/wab/shared/model/classes";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ConfigProvider, type ThemeConfig } from "antd";
import React from "react";
import * as ReactDOMClient from "react-dom/client";

const ValueEcho = _testonly.makeValueEcho({ React } as SubDeps);

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

function renderEcho(initialValue: string) {
  const onChange = vi.fn();
  const mkProps = (value: string) => ({
    impl: TextControl as any,
    value,
    onChange,
    controlProps: {},
  });
  const utils = render(<ValueEcho {...mkProps(initialValue)} />);
  const input = utils.container.querySelector("input") as HTMLInputElement;
  return {
    input,
    onChange,
    type: (v: string) => fireEvent.change(input, { target: { value: v } }),
    setValue: (v: string) => utils.rerender(<ValueEcho {...mkProps(v)} />),
  };
}

describe("ValueEcho", () => {
  it("updates the control immediately while the write is still in flight", () => {
    const { input, onChange, type } = renderEcho("a");
    type("ab");
    expect(input.value).toBe("ab");
    expect(onChange).toHaveBeenCalledWith("ab");
  });

  it("ignores echoes of in-flight writes instead of clobbering newer input", () => {
    const { input, type, setValue } = renderEcho("a");
    type("ab");
    type("abc");
    setValue("ab");
    expect(input.value).toBe("abc");
    setValue("abc");
    expect(input.value).toBe("abc");
  });

  it("accepts external value changes", () => {
    const { input, setValue } = renderEcho("a");
    setValue("xyz");
    expect(input.value).toBe("xyz");
  });

  it("discards pending writes on an external value change", () => {
    const { input, type, setValue } = renderEcho("a");
    type("ab");
    setValue("xyz");
    expect(input.value).toBe("xyz");
  });

  it("clears writes superseded by a coalesced echo", () => {
    const { input, type, setValue } = renderEcho("a");
    type("ab");
    type("abc");
    type("abcd");
    setValue("abcd");
    expect(input.value).toBe("abcd");
    setValue("ab");
    expect(input.value).toBe("ab");
  });
});

it("forwards live Studio theme changes to the isolated custom control root", async () => {
  const provider = vi.fn(({ children }: { children?: React.ReactNode; theme?: ThemeConfig }) => <>{children}</>);
  vi.spyOn(frameWindows, "getRootSub").mockReturnValue({
    React,
    ReactDOMClient,
    StudioControlsProvider: provider,
    GenericErrorBoundary: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    createModal: () => () => null,
  } as unknown as SubDeps);
  const studioCtx = { getProjectData: () => ({}) } as unknown as StudioCtx;
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
  for (const surface of ["#202128", "#ffffff", "#202128"]) {
    view.rerender(controls(surface));
    await waitFor(() => expect(provider.mock.lastCall?.[0].theme?.token?.colorBgContainer).toBe(surface));
  }
  fireEvent.change(view.container.querySelector("input") as HTMLInputElement, {
    target: { value: "Updated" },
  });
  expect(onChange).toHaveBeenCalledWith("Updated");
});
