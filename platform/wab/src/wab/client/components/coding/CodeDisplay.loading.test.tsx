import { CodeDisplay } from "@/wab/client/components/coding/CodeDisplay";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const pending = vi.hoisted(() => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release, started: false };
});

vi.mock("./CodeDisplayContent", async () => {
  pending.started = true;
  await pending.promise;
  return {
    CodeDisplayContent: ({ children }: { children: string }) => {
      const [count, setCount] = React.useState(0);
      return <button onClick={() => setCount(count + 1)}>{children}:{count}</button>;
    },
  };
});

afterEach(cleanup);

it("loads on use, keeps pending code updates and preserves the loaded component", async () => {
  expect(pending.started).toBe(false);
  const view = render(<>
    <CodeDisplay key="live" language="tsx">{"<script>unsafe()</script>"}</CodeDisplay>
    <CodeDisplay key="closed" language="tsx">Closed code</CodeDisplay>
  </>);
  expect(view.container.querySelector("script")).toBeNull();
  expect(view.container.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
  await waitFor(() => expect(pending.started).toBe(true));
  view.rerender(<><CodeDisplay key="live" language="tsx">Latest code</CodeDisplay></>);
  await act(async () => { pending.release(); await pending.promise; });
  const button = await screen.findByRole("button", { name: "Latest code:0" });
  expect(screen.queryByText("Closed code")).toBeNull();
  fireEvent.click(button);
  view.rerender(<><CodeDisplay key="live" language="tsx">Next code</CodeDisplay></>);
  expect(screen.getByRole("button", { name: "Next code:1" })).toBeTruthy();
});
