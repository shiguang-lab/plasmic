import { experiments, type SwcLoaderOptions } from "@rspack/core";
import { browserslist } from "../../package.json";
import { mkSharedRsbuildConfig } from "./sharedRsbuildConfig";

const source = "export function copy(input) { return { ...input, fixed: true }; }";
function defaultSwcOptions(): SwcLoaderOptions {
  return {
    jsc: { parser: { syntax: "ecmascript" }, externalHelpers: true },
    env: { targets: browserslist, mode: "entry", coreJs: "3.48" },
  };
}

beforeEach(() => vi.stubEnv("COMMITHASH", ""));
afterEach(() => vi.unstubAllEnvs());

it("preserves ordinary Web Browserslist targets and their required object-spread lowering", () => {
  vi.stubEnv("PLASMIC_DESKTOP_CHROMIUM_VERSION", "");
  const shared = mkSharedRsbuildConfig({ commitHash: "web-target-test" });
  expect(shared.tools?.swc).toBeUndefined();
  expect(shared.output?.overrideBrowserslist).toBeUndefined();
  const options = defaultSwcOptions();
  const output = experiments.swc.transformSync(source, options).code;
  expect(options.env?.targets).toBe(browserslist);
  expect(output).toContain("_object_spread");
});

it.each([
  ["156.0.8078.75", "156"],
  ["140.0.7339.1", "140"],
])("retains native object spread for the supplied Desktop Chromium %s", (version, major) => {
  vi.stubEnv("PLASMIC_DESKTOP_CHROMIUM_VERSION", version);
  const shared = mkSharedRsbuildConfig({ commitHash: "desktop-target-test" });
  const modifySwc = shared.tools?.swc;
  expect(modifySwc).toBeTypeOf("function");
  if (typeof modifySwc !== "function") { throw new Error("Desktop must configure the SWC target after Browserslist resolution"); }
  const options = defaultSwcOptions();
  const parser = options.jsc?.parser;
  modifySwc(options);
  expect(options.env).toEqual({ targets: { chrome: major }, mode: "entry", coreJs: "3.48" });
  expect(options.jsc?.parser).toBe(parser);
  expect(options.jsc?.externalHelpers).toBe(true);
  expect(options.jsc?.target).toBeUndefined();
  expect(shared.output?.overrideBrowserslist).toBeUndefined();
  const output = experiments.swc.transformSync(source, options).code;
  expect(output).toContain("...input");
  expect(output).not.toContain("_object_spread");
});
