import React from "react";
import { expect, it, vi } from "vitest";
import { InternalServerPlasmicLoader } from "./loader-server";

it("keeps native React and registered query functions without invoking client components", async () => {
  const loader = new InternalServerPlasmicLoader({ projects: [] });
  const component = vi.fn(() => null);
  loader.registerComponent(component, { name: "ClientOnly", props: {} });
  const query = vi.fn(async (id: number) => ({ id }));
  loader.registerFunction(query, { name: "getItem", namespace: "business", params: [] });
  expect(loader.loadServerQueriesModule("react")).toBe(React);
  const registry = loader.loadServerQueriesModule("@plasmicapp/loader-runtime-registry");
  expect(await registry.functions.__fn_business__getItem(7)).toEqual({ id: 7 });
  expect(query).toHaveBeenCalledExactlyOnceWith(7);
  expect(component).not.toHaveBeenCalled();
});
