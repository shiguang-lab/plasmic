import { CodeDisplayContent } from "@/wab/client/components/coding/CodeDisplayContent";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

afterEach(cleanup);

it("updates a compiled leaf through a native selector and releases the subscription", () => {
  const state = createStore(() => ({
    first: "const first = 1;",
    second: "const second = 2;",
    useFirst: true,
  }));
  const listeners = new Set<unknown>();
  const subscribe = state.subscribe;
  vi.spyOn(state, "subscribe").mockImplementation((listener) => {
    listeners.add(listener);
    const unsubscribe = subscribe(listener);
    return () => {
      listeners.delete(listener);
      unsubscribe();
    };
  });
  const committed = vi.fn();
  function Parent() {
    const [tick, setTick] = React.useState(0);
    const code = useStore(state, (snapshot) =>
      snapshot.useFirst ? snapshot.first : snapshot.second,
    );
    return (
      <React.Profiler id="parent" onRender={committed}>
        <button onClick={() => setTick(tick + 1)}>Rerender {tick}</button>
        <CodeDisplayContent language="tsx">{code}</CodeDisplayContent>
      </React.Profiler>
    );
  }
  const view = render(<Parent />);
  const code = () => view.container.querySelector("pre")?.textContent;
  expect(code()).toBe("const first = 1;");
  fireEvent.click(screen.getByRole("button", { name: "Rerender 0" }));
  act(() => state.setState({ first: "const first = 3;" }));
  expect(code()).toBe("const first = 3;");
  act(() => state.setState({ useFirst: false }));
  expect(code()).toBe("const second = 2;");
  act(() => state.setState({ second: "const second = 4;" }));
  expect(code()).toBe("const second = 4;");
  const before = committed.mock.calls.length;
  act(() => state.setState({ first: "unused" }));
  expect(code()).toBe("const second = 4;");
  expect(committed).toHaveBeenCalledTimes(before);
  expect(listeners.size).toBe(1);
  view.unmount();
  expect(listeners.size).toBe(0);
  const reopened = render(<Parent />);
  expect(reopened.container.querySelector("pre")?.textContent).toBe(
    "const second = 4;",
  );
  reopened.unmount();
  expect(listeners.size).toBe(0);
});
