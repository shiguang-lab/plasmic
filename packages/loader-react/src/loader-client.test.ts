/** @vitest-environment jsdom */
import { expect, it } from "vitest";
import * as ReactDOMClient from "react-dom/client";
import { InternalPlasmicComponentLoader } from "./loader-client";

it("supplies react-dom/client in the browser without a downloaded module or Node require fallback", () => {
  const loader = new InternalPlasmicComponentLoader({ projects: [] });
  expect(() => loader.loadServerQueriesModule("react-dom/client")).not.toThrow();
  const module = loader.loadServerQueriesModule("react-dom/client");
  expect(module.createRoot).toBe(ReactDOMClient.createRoot);
  expect(module.hydrateRoot).toBe(ReactDOMClient.hydrateRoot);
});
