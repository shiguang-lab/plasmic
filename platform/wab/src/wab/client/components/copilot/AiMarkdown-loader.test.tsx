import {
  AiMarkdown,
  preloadAiMarkdown,
} from "@/wab/client/components/copilot/AiMarkdown";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
const control = vi.hoisted(() => {
  let resolve!: () => void;
  const ready = new Promise<void>((done) => {
    resolve = done;
  });
  return { ready, resolve, mounts: 0 };
});
vi.mock("./AiMarkdownContent", async () => {
  await control.ready;
  return {
    AiMarkdown: ({ children }: { children: string }) => {
      React.useEffect(() => {
        control.mounts++;
      }, []);
      return <div data-testid="loaded-markdown">{children}</div>;
    },
  };
});
afterEach(cleanup);
it("shares preloading, renders the latest stream, and mounts synchronously after preloading", async () => {
  const pending = preloadAiMarkdown();
  expect(preloadAiMarkdown()).toBe(pending);
  const view = render(
    <AiMarkdown running>{"<script>old</script>"}</AiMarkdown>,
  );
  expect(view.container.querySelector("[aria-busy=true]")).not.toBeNull();
  expect(view.container.querySelector("script")).toBeNull();
  view.rerender(<AiMarkdown>{"Final streamed response"}</AiMarkdown>);
  await act(async () => {
    control.resolve();
    await pending;
  });
  expect((await screen.findByTestId("loaded-markdown")).textContent).toBe(
    "Final streamed response",
  );
  expect(control.mounts).toBe(1);
  view.rerender(<AiMarkdown>{"Another streamed update"}</AiMarkdown>);
  expect(screen.getByTestId("loaded-markdown").textContent).toBe(
    "Another streamed update",
  );
  expect(control.mounts).toBe(1);
  view.unmount();
  const warm = render(<AiMarkdown>{"Warm response"}</AiMarkdown>);
  expect(screen.getByTestId("loaded-markdown").textContent).toBe(
    "Warm response",
  );
  expect(warm.container.querySelector("[aria-busy]")).toBeNull();
});
