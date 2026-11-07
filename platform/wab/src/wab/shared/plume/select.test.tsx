import {
  mkCanvasIsFirstGroupState,
  mkCanvasSelectedValueState,
} from "@/wab/shared/plume/select";
import { cleanup, render } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

function ContextProbe({
  selectedContext,
  isFirstContext,
}: {
  selectedContext: React.Context<undefined | { selectedValue: string }>;
  isFirstContext: React.Context<boolean>;
}) {
  const selected = React.useContext(selectedContext);
  const isFirst = React.useContext(isFirstContext);
  return (
    <div>
      {selected === undefined ? "empty" : selected.selectedValue}:
      {String(isFirst)}
    </div>
  );
}

it("returns a stable context for the same React module", () => {
  const selected = mkCanvasSelectedValueState(React);
  const isFirst = mkCanvasIsFirstGroupState(React);

  expect(mkCanvasSelectedValueState(React)).toBe(selected);
  expect(mkCanvasIsFirstGroupState(React)).toBe(isFirst);
  expect(selected).not.toBe(isFirst);
});

it("preserves the existing context defaults", () => {
  const Selected = mkCanvasSelectedValueState(React);
  const IsFirst = mkCanvasIsFirstGroupState(React);
  const { container } = render(
    <ContextProbe selectedContext={Selected} isFirstContext={IsFirst} />,
  );

  expect(container.textContent).toBe("empty:false");
});

it("uses the context values supplied by providers", () => {
  const Selected = mkCanvasSelectedValueState(React);
  const IsFirst = mkCanvasIsFirstGroupState(React);
  const { container } = render(
    <Selected.Provider value={{ selectedValue: "option-a" }}>
      <IsFirst.Provider value={true}>
        <ContextProbe selectedContext={Selected} isFirstContext={IsFirst} />
      </IsFirst.Provider>
    </Selected.Provider>,
  );

  expect(container.textContent).toBe("option-a:true");
});

it("keys each factory by the actual React module object", () => {
  const otherReact = Object.create(React) as typeof React;
  expect(otherReact.createContext).toBe(React.createContext);

  const selected = mkCanvasSelectedValueState(React);
  const isFirst = mkCanvasIsFirstGroupState(React);
  const otherSelected = mkCanvasSelectedValueState(otherReact);
  const otherIsFirst = mkCanvasIsFirstGroupState(otherReact);

  expect(otherSelected).not.toBe(selected);
  expect(otherIsFirst).not.toBe(isFirst);
  expect(mkCanvasSelectedValueState(otherReact)).toBe(otherSelected);
  expect(mkCanvasIsFirstGroupState(otherReact)).toBe(otherIsFirst);

  const { container } = render(
    <otherSelected.Provider value={{ selectedValue: "other-module" }}>
      <otherIsFirst.Provider value={false}>
        <ContextProbe
          selectedContext={otherSelected}
          isFirstContext={otherIsFirst}
        />
      </otherIsFirst.Provider>
    </otherSelected.Provider>,
  );

  expect(container.textContent).toBe("other-module:false");
});
