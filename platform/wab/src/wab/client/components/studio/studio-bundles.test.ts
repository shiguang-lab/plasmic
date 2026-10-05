import { runInNewContext } from "node:vm";
import { afterEach, expect, test, vi } from "vitest";

vi.unmock("@/wab/client/components/studio/studio-bundles");

vi.mock("@/wab/client/env", () => ({ ENV: { COMMITHASH: "test" } }));
vi.mock("@/wab/shared/urls", () => ({
  getStaticBaseUrl: () => "http://localhost/static",
}));
vi.mock("@/wab/shared/common", () => ({
  sortAs: (values: string[]) => values,
}));
vi.mock("@/wab/shared/core/hostless-components", () => ({
  fstPartyHostLessComponents: [],
}));

import { getSortedHostLessPkgs } from "./studio-bundles";

afterEach(() => vi.unstubAllGlobals());

test.each([["antd6", "overseas", "react-ui"], ["react-ui"]])("metadata and preview windows initialize the runtime before %j, once per window", async (...packages: string[]) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      text: async () =>
        url.endsWith("/client.test.js")
          ? "window.initializations++; window.__CanvasPkgs = { Antd6: {} };"
          : "window.registrations.push(window.__CanvasPkgs.Antd6);",
    })),
  );
  const modules = await getSortedHostLessPkgs(packages, "-v2");
  for (let frame = 0; frame < 2; frame++) {
    const window = {
      initializations: 0,
      registrations: [] as object[],
      __CanvasPkgs: undefined as any,
    };
    for (const [, source] of modules) runInNewContext(source, { window });
    expect(window.initializations).toBe(1);
    expect(window.registrations).toHaveLength(packages.length);
    expect(
      window.registrations.every(
        (runtime) => runtime === window.__CanvasPkgs.Antd6,
      ),
    ).toBe(true);
  }
});
