import React from "react";
import { render } from "@testing-library/react";
import { combineProps, useForwardedRef } from "@/wab/commons/components/ReactUtil";
import { cx } from "@/wab/shared/common";

describe("combineProps", () =>
  it("should work", function () {
    let aProps, bProps;
    const combined = combineProps(
      (aProps = {
        onChange: vi.fn(),
        className: "a",
      }),
      (bProps = {
        onChange: vi.fn(),
        className: cx({
          b: true,
        }),
      }),
    );
    expect(combined.className).toBe("a b");
    combined.onChange("foo");
    expect(aProps.onChange).toHaveBeenCalledWith("foo");
    return expect(bProps.onChange).toHaveBeenCalledWith("foo");
  }));

it("forwards React 19 cleanup and keeps its internal ref synchronized", () => {
  const cleanup = vi.fn();
  const external = vi.fn(() => cleanup);
  let current: React.RefObject<HTMLButtonElement | null> | undefined;
  function Probe({ outerRef }: { outerRef: React.Ref<HTMLButtonElement> }) {
    const forwarded = useForwardedRef(outerRef);
    current = forwarded.ref;
    return React.createElement("button", { ref: forwarded.onRef });
  }
  const view = render(React.createElement(Probe, { outerRef: external }));
  expect(current?.current).toBe(view.getByRole("button"));
  view.rerender(React.createElement(Probe, { outerRef: external }));
  expect(external).toHaveBeenCalledTimes(1);
  expect(cleanup).not.toHaveBeenCalled();
  const replacement = React.createRef<HTMLButtonElement>();
  view.rerender(React.createElement(Probe, { outerRef: replacement }));
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(external).toHaveBeenCalledTimes(1);
  expect(current?.current).toBe(replacement.current);
  view.unmount();
  expect(current?.current).toBeNull();
  expect(replacement.current).toBeNull();
});
