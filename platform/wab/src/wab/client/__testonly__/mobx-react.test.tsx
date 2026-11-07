import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { observable, onBecomeUnobserved, runInAction } from "mobx";
import { observer } from "mobx-react";
import React from "react";

afterEach(cleanup);

it.each([false, true])("tracks same-reference model changes and switches dynamic dependencies, strict: %s", (strict) => {
  const model = observable({ left: "Left", right: "Right", useLeft: true });
  const leftReleased = vi.fn();
  const rightReleased = vi.fn();
  const stopLeft = onBecomeUnobserved(model, "left", leftReleased);
  const stopRight = onBecomeUnobserved(model, "right", rightReleased);
  const renders = vi.fn();
  const Leaf = observer(({ value }: { value: typeof model }) => {
    renders();
    return <span>{value.useLeft ? value.left : value.right}</span>;
  });
  const node = <Leaf value={model} />;
  const view = render(strict ? <React.StrictMode>{node}</React.StrictMode> : node);
  act(() => runInAction(() => { model.left = "Left changed"; }));
  expect(view.getByText("Left changed")).toBeTruthy();
  act(() => runInAction(() => { model.useLeft = false; }));
  expect(view.getByText("Right")).toBeTruthy();
  // StrictMode's abandoned initial render is reclaimed by the library's
  // FinalizationRegistry; committed subscriptions must switch immediately.
  if (!strict) {
    expect(leftReleased).toHaveBeenCalled();
  }
  const count = renders.mock.calls.length;
  act(() => runInAction(() => { model.left = "Unused"; }));
  expect(renders).toHaveBeenCalledTimes(count);
  act(() => runInAction(() => { model.right = "Right changed"; }));
  expect(view.getByText("Right changed")).toBeTruthy();
  view.unmount();
  expect(rightReleased).toHaveBeenCalled();
  stopLeft();
  stopRight();
});

it("keeps class observers reactive alongside React state and releases subscriptions", () => {
  const value = observable.box("Initial");
  const released = vi.fn();
  const stop = onBecomeUnobserved(value, released);
  const Counter = observer(class extends React.Component {
    state = { count: 0 };
    render() {
      return <button onClick={() => this.setState({ count: this.state.count + 1 })}>
        {value.get()} {this.state.count}
      </button>;
    }
  });
  const view = render(<Counter />);
  fireEvent.click(view.getByRole("button", { name: "Initial 0" }));
  act(() => runInAction(() => value.set("Updated")));
  expect(view.getByRole("button", { name: "Updated 1" })).toBeTruthy();
  view.unmount();
  expect(released).toHaveBeenCalledTimes(1);
  stop();
});
