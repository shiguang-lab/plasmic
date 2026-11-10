import { StartupProjectModel } from "@/wab/client/frame-ctx/project-model-transfer";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import * as Comlink from "comlink";
import nodeEndpoint from "comlink/dist/umd/node-adapter";
import { MessageChannel } from "node:worker_threads";

it("transfers startup dependencies once, decodes them in the Host, and leaves later reads on the normal wire", async () => {
  const response: GetProjectResponse = JSON.parse(JSON.stringify({
    rev: { revision: 7, data: '{"root":"root","map":{}}' },
    project: { id: "project", name: "用户查询" },
    depPkgs: ["first", "second"].map(id => ({
      id,
      version: "1.0.0",
      model: { map: { node: { name: "按钮", ref: { __ref: "target" } } }, root: "node" },
    })),
    perms: [], modelVersion: 1, hostlessDataVersion: 0, latestRevisionSynced: 7,
    hasAppAuth: false, isMainBranchProtected: false,
  }));
  const { depPkgs, ...project } = response;
  const bytes = new TextEncoder().encode(JSON.stringify(depPkgs[0].model)).buffer;
  const badBytes = new TextEncoder().encode("{").buffer;
  const { port1, port2 } = new MessageChannel();
  const packets: { type: string; name?: string }[] = [];
  port2.on("message", packet => packets.push(packet));
  Comlink.expose({
    startup: () => new StartupProjectModel({
      project,
      dependencies: depPkgs.map(({ model: _model, ...info }) => ({ info, bytes })),
    }),
    broken: () => new StartupProjectModel({
      project,
      dependencies: [{ info: depPkgs[0], bytes: badBytes }],
    }),
    refresh: () => response,
  }, nodeEndpoint(port1));
  const remote = Comlink.wrap<{
    startup(): GetProjectResponse;
    broken(): GetProjectResponse;
    refresh(): GetProjectResponse;
  }>(nodeEndpoint(port2));
  try {
    const received = await remote.startup();
    expect(received).toEqual(response);
    expect(received.depPkgs[0].model).toBe(received.depPkgs[1].model);
    expect(bytes.byteLength).toBe(0);
    expect(packets.at(-1)).toMatchObject({ type: "HANDLER", name: "PROJECT_MODEL" });
    await expect(remote.broken()).rejects.toThrow(SyntaxError);
    expect(await remote.refresh()).toEqual(response);
    expect(packets.at(-1)?.type).toBe("RAW");
  } finally {
    remote[Comlink.releaseProxy]();
    port1.close();
    port2.close();
  }
});
