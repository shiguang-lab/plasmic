import { App, AppView, useApp } from "@/wab/client/components/top-view";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);

it("keeps independent native App owners and exposes the same controller through context", () => {
  const committed: App[] = [];
  function Content({ label }: { label: string }) {
    const app = useApp();
    React.useEffect(() => { committed.push(app); }, [app]);
    return <button onClick={() => app.setIsDragging(!app.isDragging())}>{label}</button>;
  }
  render(<React.StrictMode>
    <AppView contents={() => <Content label="First" />} />
    <AppView contents={() => <Content label="Second" />} />
  </React.StrictMode>);
  const first = screen.getByRole("button", { name: "First" });
  const second = screen.getByRole("button", { name: "Second" });
  expect(new Set(committed).size).toBe(2);
  fireEvent.click(first);
  expect(first.closest(".app")?.classList.contains("app--dragging")).toBe(true);
  expect(second.closest(".app")?.classList.contains("app--dragging")).toBe(false);
  fireEvent.click(first);
  expect(first.closest(".app")?.classList.contains("app--dragging")).toBe(false);
  expect(new Set(committed).size).toBe(2);
});

it("releases the native spinner when a task rejects", async () => {
  let controller: App | undefined;
  function Content() {
    const app = useApp();
    React.useEffect(() => { controller = app; return () => { controller = undefined; }; }, [app]);
    return null;
  }
  render(<AppView contents={() => <Content />} />);
  if (!controller) { throw new Error("Committed App controller"); }
  let reject: (error: Error) => void = () => {};
  const task = new Promise<never>((_resolve, rejectTask) => { reject = rejectTask; });
  let pending: Promise<never> | undefined;
  act(() => { pending = controller?.withSpinner(task); });
  expect(document.querySelector(".ant-spin")).toBeTruthy();
  const failure = new Error("Task failed");
  const result = expect(pending).rejects.toBe(failure);
  await act(async () => { reject(failure); await result; });
  expect(document.querySelector(".ant-spin")).toBeNull();
});
