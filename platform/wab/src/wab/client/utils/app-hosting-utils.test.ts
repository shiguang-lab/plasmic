import {
  getHostUrl,
  isImmutableHostPage,
} from "@/wab/client/utils/app-hosting-utils";
import type { ApiBranch, ApiProject } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";

const project = {} as ApiProject;
const previousHostUrl = DEVFLAGS.hostUrl;
const previousDefault = DEVFLAGS.defaultHostUrl;
const config = {
  ...DEVFLAGS,
  ccStubs: false,
  defaultHostUrl: "https://canvas.example/static/host.html",
};
const path = `/static/host.${"a".repeat(64)}.html`;

beforeEach(() => {
  DEVFLAGS.hostUrl = "";
  DEVFLAGS.defaultHostUrl = config.defaultHostUrl;
  vi.stubEnv("REACT_APP_VERSIONED_HOST_PATH", path);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0");
});
afterEach(() => {
  DEVFLAGS.defaultHostUrl = previousDefault;
  DEVFLAGS.hostUrl = previousHostUrl;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("uses the immutable built-in Host in Web, including an explicitly stored default URL", () => {
  expect(getHostUrl(project, undefined, config)).toBe(
    `https://canvas.example${path}`,
  );
  expect(
    getHostUrl(
      { ...project, hostUrl: config.defaultHostUrl },
      undefined,
      config,
    ),
  ).toBe(`https://canvas.example${path}`);
});
it("keeps Desktop on its local Host and development on its unversioned URL", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  expect(getHostUrl(project, undefined, config)).toBe(config.defaultHostUrl);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0");
  vi.stubEnv("REACT_APP_VERSIONED_HOST_PATH", "");
  expect(getHostUrl(project, undefined, config)).toBe(config.defaultHostUrl);
});
it("preserves custom project and branch Hosts", () => {
  for (const hostUrl of [
    "https://custom.example/static/host.html",
    "https://canvas.example/custom-host",
    `${config.defaultHostUrl}?custom=true`,
  ]) {
    expect(getHostUrl({ ...project, hostUrl }, undefined, config)).toBe(
      hostUrl,
    );
    expect(getHostUrl(project, { hostUrl } as ApiBranch, config)).toBe(hostUrl);
  }
});

it("does not rewrite a customized default Host or reuse an unrelated hashed Host", () => {
  const custom = {
    ...config,
    defaultHostUrl: "https://custom.example/static/host.html",
  };
  expect(getHostUrl(project, undefined, custom)).toBe(custom.defaultHostUrl);
  expect(isImmutableHostPage(`https://canvas.example${path}`)).toBe(true);
  expect(isImmutableHostPage(`https://custom.example${path}`)).toBe(false);
  expect(isImmutableHostPage(config.defaultHostUrl)).toBe(false);
});
