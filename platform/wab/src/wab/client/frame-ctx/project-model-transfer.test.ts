import { transferProjectModel } from "@/wab/client/frame-ctx/project-model-transfer";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import * as Comlink from "comlink";
import nodeEndpoint from "comlink/dist/umd/node-adapter";
import { MessageChannel } from "node:worker_threads";

it("transports a marked startup DTO as JSON and leaves later responses on the normal wire", async () => {
  const response: GetProjectResponse = JSON.parse(JSON.stringify({
    rev: { revision: 7, data: '{"root":"root","map":{}}' },
    project: { id: "project", name: "用户查询" },
    depPkgs: [{ id: "dependency", version: "1.0.0", model: { map: { node: { name: "按钮", ref: { __ref: "target" } } }, root: "node" } }],
    perms: [], modelVersion: 1, hostlessDataVersion: 0, latestRevisionSynced: 7,
    hasAppAuth: false, isMainBranchProtected: false,
  }));
  const { port1, port2 } = new MessageChannel();
  const packets: { type: string; name?: string; value: unknown }[] = [];
  port2.on("message", packet => packets.push(packet));
  Comlink.expose({ startup: () => transferProjectModel(response), refresh: () => response }, nodeEndpoint(port1));
  const remote = Comlink.wrap<{ startup(): GetProjectResponse; refresh(): GetProjectResponse }>(nodeEndpoint(port2));
  try {
    expect(await remote.startup()).toEqual(response);
    expect(packets.at(-1)).toMatchObject({ type: "HANDLER", name: "PROJECT_MODEL", value: JSON.stringify(response) });
    expect(await remote.refresh()).toEqual(response);
    expect(packets.at(-1)?.type).toBe("RAW");
  } finally {
    remote[Comlink.releaseProxy]();
    port1.close(); port2.close();
  }
});
