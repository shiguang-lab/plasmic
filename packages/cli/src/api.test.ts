import { afterEach, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("axios", () => ({
  default: { create: () => ({ post }) },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  post.mockReset();
});

it("keeps a configured self-hosted default on its own codegen server", async () => {
  const host = "https://studio.example.test";
  vi.stubEnv("PLASMIC_DEFAULT_HOST", host);
  const { PlasmicApi } = await import("./api");
  post.mockResolvedValue({
    data: { projects: [], dependencies: [], conflicts: [] },
  });
  for (const authHost of [host, ""]) {
    const api = new PlasmicApi({ host: authHost, user: "", token: "" });
    await api.resolveSync([
      {
        projectId: "local-project",
        branchName: "main",
        componentIdOrNames: undefined,
      },
    ]);
    expect(post.mock.lastCall?.[0]).toBe(`${host}/api/v1/code/resolve-sync`);
  }
});

it("routes only the official Studio origins to official codegen servers", async () => {
  vi.stubEnv("PLASMIC_DEFAULT_HOST", "https://studio.example.test");
  const { PlasmicApi } = await import("./api");
  post.mockResolvedValue({ data: {} });
  for (const [host, apiHost] of [
    ["https://studio.plasmic.app", "https://codegen-origin.plasmic.app"],
    [
      "https://studio.dev.plasmic.app",
      "https://codegen-origin.dev.plasmic.app",
    ],
    ["https://another.example.test", "https://another.example.test"],
  ]) {
    await new PlasmicApi({ host, user: "", token: "" }).genStyleConfig();
    expect(post.mock.lastCall?.[0]).toBe(`${apiHost}/api/v1/code/style-config`);
  }
});
