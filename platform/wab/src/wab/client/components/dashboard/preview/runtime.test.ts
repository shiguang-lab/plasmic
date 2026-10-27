import { load } from "@/wab/client/components/dashboard/preview/renderer";
import type { Bundle } from "@/wab/shared/bundler";
import { DEVFLAGS } from "@/wab/shared/devflags";
import fs from "fs";
import path from "path";

vi.mock("@/wab/client/components/studio/studio-bundles", () => ({
  getCanvasPkgs: async () => "",
  getLiveFrameClientJs: async () => "",
  getReactWebBundle: async () => "",
  getSortedHostLessPkgs: async () => [],
  getVersionForCanvasPackages: () => "",
}));
vi.mock("@/wab/shared/code-components/builtin-code-components", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/wab/shared/code-components/builtin-code-components")>();
  return {
    ...actual,
    getBuiltinComponentRegistrations: (runtime?: unknown) => runtime ? {} : actual.getBuiltinComponentRegistrations(),
  };
});

it("initializes preview event callbacks before the first isolated render", async () => {
  const bundles = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../shared/codegen/__testonly__/bundles/counters-test.json"), "utf8")) as [string, Bundle][];
  const [id, bundle] = bundles[bundles.length - 1];
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const win = frame.contentWindow as Window & Record<string, any>;
  const body = win.document.createElement("div");
  body.className = "__wab_user-body";
  win.document.body.append(body);
  const onValuesChange = vi.fn();
  win.__Sub = { hostUtils: { registerRenderErrorListener: () => () => {} } };
  const update = vi.fn(async () => {
    // A native form can emit its initial change during the first React commit.
    win.__PLASMIC_CACHE_EVENT_ARGS(1, { amount: 100 });
    win.__PLASMIC_CACHE_$STEP_VALUE(1, "validate", true);
    onValuesChange({ amount: 100 });
  });
  win.__plasmicLive = { update, showError: vi.fn() };
  win.requestAnimationFrame = (callback) => { callback(0); return 0; };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", win.document);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
    project: { id, name: "Preview event fixture" },
    rev: { revision: 42, data: JSON.stringify(bundle) },
    depPkgs: bundles.slice(0, -1).map(([depId, model]) => ({ id: depId, model })),
  }) })));
  try {
    await load({ projectId: id, revision: 42, flags: DEVFLAGS, staticBaseUrl: "http://localhost/" });
    expect(update).toHaveBeenCalledOnce();
    expect(onValuesChange).toHaveBeenCalledExactlyOnceWith({ amount: 100 });
    expect(win.__plasmicLive.showError).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
    frame.remove();
  }
});
