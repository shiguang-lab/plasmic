// @vitest-environment node
import { shiguangIdentityMiddleware } from "@/wab/server/auth/shiguang";
import express from "express";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { addDesktopUpdateDiscovery, getDesktopBeta } from "./desktop-beta";

vi.mock("@/wab/server/auth/shiguang", () => ({
  shiguangIdentityMiddleware(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) {
    const id = req.header("x-test-session");
    if (id) {
      req.user = {
        id: id === "expired" ? "tester" : id,
      } as express.Request["user"];
      req.shiguangIdentity = {} as express.Request["shiguangIdentity"];
    }
    next(id === "expired" ? Error("expired") : undefined);
  },
}));

const httpFetch = globalThis.fetch;
let release = "0.9.12",
  root: string,
  url: string;
let server: ReturnType<express.Express["listen"]>;
const selected = "0.9.13-beta.10";
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "desktop-beta-"));
  vi.stubEnv("DESKTOP_BETA_DIRECTORY", root);
  vi.stubEnv("DESKTOP_BETA_USER_IDS", "tester, other");
  vi.stubGlobal("fetch", async () =>
    Response.json({ version: release, installers: [] }),
  );
  for (const version of ["0.9.13-beta.2", selected, ".staging"]) {
    await mkdir(path.join(root, version, "darwin/arm64"), { recursive: true });
    await writeFile(
      path.join(root, version, "latest.json"),
      JSON.stringify({ version, installers: [] }),
    );
  }
  await writeFile(
    path.join(
      root,
      selected,
      "darwin/arm64",
      `Plasmic-${selected}-mac-arm64.zip`,
    ),
    "installer",
  );
  const app = express();
  addDesktopUpdateDiscovery(app);
  app.use(shiguangIdentityMiddleware);
  app.get(
    "/api/v1/desktop-beta/:version/:platform/:arch/:file",
    getDesktopBeta,
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([
  [undefined, "0.9.12", "0.9.12"],
  ["expired", "0.9.12", "0.9.12"],
  ["ordinary", "0.9.12", "0.9.12"],
  ["tester", "0.9.12", selected],
  ["tester", "0.9.13", "0.9.13"],
  ["tester", "0.10.0", "0.10.0"],
])(
  "session %s and public release %s return %s",
  async (id, stable, expected) => {
    release = stable!;
    const res = await httpFetch(url + "/desktop-updates/latest", {
      headers: id ? { "x-test-session": id } : {},
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect((await res.json()).version).toBe(expected);
  },
);
it("checks eligibility on the private file itself and supports byte ranges", async () => {
  const file = `${url}/desktop-beta/${selected}/darwin/arm64/Plasmic-${selected}-mac-arm64.zip`;
  expect((await httpFetch(file)).status).toBe(404);
  expect(
    (await httpFetch(file, { headers: { "x-test-session": "ordinary" } }))
      .status,
  ).toBe(404);
  const res = await httpFetch(file, {
    headers: { "x-test-session": "tester", Range: "bytes=0-2" },
  });
  expect(res.status).toBe(206);
  expect(await res.text()).toBe("ins");
});
