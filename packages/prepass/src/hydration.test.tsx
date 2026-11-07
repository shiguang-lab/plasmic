// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PlasmicQueryDataProvider, usePlasmicQueryData } from "@plasmicapp/query";
import { extractPlasmicQueryData } from "./index";

it("hydrates extracted data without a duplicate fetch or a hydration recovery", async () => {
  const fetcher = vi.fn(async () => ({ label: "Server result" }));
  function Page() {
    const result = usePlasmicQueryData("hydrated", fetcher);
    return <button>{result.data?.label ?? "Loading"}</button>;
  }
  const cache = await extractPlasmicQueryData(<Page />);
  expect(cache).toEqual({ hydrated: { label: "Server result" } });
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockClear();
  const tree = <PlasmicQueryDataProvider prefetchedCache={cache}><Page /></PlasmicQueryDataProvider>;
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(tree);
  expect(container.textContent).toBe("Server result");
  const recovery = vi.fn();
  let root: ReturnType<typeof createRoot> | undefined;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: recovery }); });
    expect(container.querySelector("button")?.textContent).toBe("Server result");
    expect(fetcher).not.toHaveBeenCalled();
    expect(recovery).not.toHaveBeenCalled();
  } finally {
    act(() => root?.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  }
});
