import { Fiber, FiberRoot } from "@/wab/client/react-global-hook/fiber";
import { traverseTree, traverseUpdates } from "@/wab/client/react-global-hook/traverseFiber";
import { act } from "@testing-library/react";
import React from "react";
import { createRoot, Root } from "react-dom/client";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const current = () => (root as unknown as { _internalRoot: FiberRoot })._internalRoot.current;
function visibleIds(tree: Fiber) {
  const ids: string[] = [];
  traverseTree(tree, node => { if (node.memoizedProps?.["data-node"]) ids.push(node.memoizedProps["data-node"]); }, () => {}, false);
  return ids;
}

it("excludes retained Activity content while hidden and restores it without remounting DOM", async () => {
  const unmounted: string[] = [];
  // Activity may commit again to prepare hidden children. Observe each commit
  // like the DevTools hook, before React can reuse an alternate fiber.
  const onCommit = () => {
    const tree = current();
    if (tree.alternate) traverseUpdates(tree, tree.alternate, () => {}, () => {}, node => {
      if (node.memoizedProps?.["data-node"]) unmounted.push(node.memoizedProps["data-node"]);
    }, () => {});
  };
  const element = (mode: "visible" | "hidden") => <React.Profiler id="activity" onRender={onCommit}><React.Activity mode={mode}><span data-node="primary">Primary</span></React.Activity><span data-node="outside">Outside</span></React.Profiler>;
  await act(async () => root.render(element("visible")));
  const before = current();
  const primary = container.querySelector('[data-node="primary"]');
  expect(visibleIds(before)).toEqual(["primary", "outside"]);
  await act(async () => root.render(element("hidden")));
  const hidden = current();
  expect(visibleIds(hidden)).toEqual(["outside"]);
  expect(container.querySelector('[data-node="primary"]')).toBe(primary);
  expect(unmounted).toEqual(["primary"]);
  await act(async () => root.render(element("visible")));
  expect(visibleIds(current())).toEqual(["primary", "outside"]);
  expect(container.querySelector('[data-node="primary"]')).toBe(primary);
});

it("visits the Suspense fallback then reveals React.use data without retaining fallback nodes", async () => {
  let resolve: (value: string) => void = () => {};
  const data = new Promise<string>(done => { resolve = done; });
  function Content() { return <span data-node="resolved">{React.use(data)}</span>; }
  await act(async () => root.render(<React.Suspense fallback={<span data-node="fallback">Loading</span>}><Content /></React.Suspense>));
  expect(visibleIds(current())).toEqual(["fallback"]);
  await act(async () => resolve("Ready"));
  expect(visibleIds(current())).toEqual(["resolved"]);
  expect(container.textContent).toBe("Ready");
  await act(async () => root.render(null));
  expect(visibleIds(current())).toEqual([]);
});
