// @vitest-environment jsdom
import { PlasmicDataSourceContextProvider } from "@plasmicapp/data-sources-context";
import { DataProvider } from "@plasmicapp/host";
import {
  PlasmicQueryDataProvider,
  usePlasmicQueryData,
} from "@plasmicapp/query";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { LoadingBoundary } from "../../../plasmicpkgs/plasmic-basic-components/src/LoadingBoundary";
import { PlasmicPageGuard } from "../../react-web/src/auth/PlasmicPageGuard";
import { extractPlasmicQueryData } from "./index";

afterEach(cleanup);

function Boundary({
  children,
  forceLoading = false,
}: React.PropsWithChildren<{ forceLoading?: boolean }>) {
  return (
    <DataProvider name="plasmicInternalEnableLoadingBoundary" data={true}>
      <LoadingBoundary
        loadingState={<span>Loading example</span>}
        forceLoading={forceLoading}
      >
        {children}
      </LoadingBoundary>
    </DataProvider>
  );
}

it("prefetches LoadingBoundary descendants only during prepass and respects forced loading", async () => {
  const fetch = vi.fn(async () => "Fetched example");
  function Child() {
    const result = usePlasmicQueryData("boundary-example", fetch);
    return <span>{result.data}</span>;
  }
  const normal = (
    <Boundary>
      <Child />
    </Boundary>
  );
  expect(renderToString(normal)).toContain("Loading example");
  expect(fetch).not.toHaveBeenCalled();
  expect(await extractPlasmicQueryData(normal)).toEqual({
    "boundary-example": "Fetched example",
  });
  expect(fetch).toHaveBeenCalledOnce();
  fetch.mockClear();
  expect(
    await extractPlasmicQueryData(
      <Boundary forceLoading>
        <Child />
      </Boundary>,
    ),
  ).toEqual({});
  expect(fetch).not.toHaveBeenCalled();
});

it("hydrates the server loading state without mismatch and reuses prefetched data", async () => {
  const fetch = vi.fn(async () => "Unexpected refetch");
  function Child() {
    const result = usePlasmicQueryData("hydrated-boundary", fetch);
    return <span>{result.data}</span>;
  }
  const cache = new Map();
  const tree = (forced = false) => (
    <PlasmicQueryDataProvider
      provider={() => cache}
      prefetchedCache={{ "hydrated-boundary": "Saved example" }}
    >
      <Boundary forceLoading={forced}>
        <Child />
      </Boundary>
    </PlasmicQueryDataProvider>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree());
  expect(container.textContent).toBe("Loading example");
  document.body.append(container);
  const recovered = vi.fn();
  const root = hydrateRoot(container, tree(), {
    onRecoverableError: recovered,
  });
  try {
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toBe("Saved example");
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => root.render(tree(true)));
    expect(container.textContent).toBe("Loading example");
    await act(async () => root.render(tree()));
    expect(container.textContent).toBe("Saved example");
    expect(recovered).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

const authorized = {
  isUserLoading: false,
  user: {
    email: "test@example.invalid",
    properties: null,
    roleId: "editor",
    roleName: "Editor",
    roleIds: ["editor"],
    roleNames: ["Editor"],
  },
};

it("keeps protected query descendants out of prepass while ordinary SSR respects roles", async () => {
  const fetch = vi.fn(async () => "Private data");
  function Protected() {
    const result = usePlasmicQueryData("protected-example", fetch);
    return <span>{result.data}</span>;
  }
  const guard = (
    <PlasmicPageGuard
      appId="app"
      authorizeEndpoint="/authorize"
      minRole="editor"
      canTriggerLogin={false}
      unauthorizedComp={<span>Access denied</span>}
    >
      <Protected />
    </PlasmicPageGuard>
  );
  expect(
    await extractPlasmicQueryData(
      <PlasmicDataSourceContextProvider value={authorized}>
        {guard}
      </PlasmicDataSourceContextProvider>,
    ),
  ).toEqual({});
  expect(fetch).not.toHaveBeenCalled();
  const content = (
    <PlasmicPageGuard
      appId="app"
      authorizeEndpoint="/authorize"
      minRole="editor"
      canTriggerLogin={false}
      unauthorizedComp={<span>Access denied</span>}
    >
      Allowed content
    </PlasmicPageGuard>
  );
  expect(
    renderToString(
      <PlasmicDataSourceContextProvider value={authorized}>
        {content}
      </PlasmicDataSourceContextProvider>,
    ),
  ).toContain("Allowed content");
  expect(
    renderToString(
      <PlasmicDataSourceContextProvider
        value={{ isUserLoading: false, user: null }}
      >
        {content}
      </PlasmicDataSourceContextProvider>,
    ),
  ).toContain("Access denied");
});

it("keeps client authorization reactive across loading, denied and allowed states", () => {
  const content = (
    <PlasmicPageGuard
      appId="app"
      authorizeEndpoint="/authorize"
      minRole="editor"
      canTriggerLogin={false}
      unauthorizedComp={<span>Access denied</span>}
    >
      Allowed content
    </PlasmicPageGuard>
  );
  const view = render(
    <PlasmicDataSourceContextProvider
      value={{ isUserLoading: true, user: null }}
    >
      {content}
    </PlasmicDataSourceContextProvider>,
  );
  expect(view.container.textContent).toBe("");
  view.rerender(
    <PlasmicDataSourceContextProvider
      value={{ isUserLoading: false, user: null }}
    >
      {content}
    </PlasmicDataSourceContextProvider>,
  );
  expect(screen.getByText("Access denied")).toBeTruthy();
  view.rerender(
    <PlasmicDataSourceContextProvider value={authorized}>
      {content}
    </PlasmicDataSourceContextProvider>,
  );
  expect(screen.getByText("Allowed content")).toBeTruthy();
});
