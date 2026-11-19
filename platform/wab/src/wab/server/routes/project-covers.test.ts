import { ForbiddenError } from "@/wab/server/db/DbMgr";
import type { PublishedCover } from "@/wab/shared/project-covers";
import express from "express";
import http from "http";
import type { AddressInfo } from "net";
import path from "path";
import {
  getCoverRevisions,
  getProjectCover,
  streamCoverEvents,
} from "./project-covers";

const hosts = vi.hoisted(() => ({ snapshot: "" }));
vi.mock("node-fetch", async (original) => {
  const real = await original<typeof import("node-fetch")>();
  return {
    ...real,
    default: (url: string, options) =>
      real.default(
        url.replace("http://canvas-snapshot-page:3100", hosts.snapshot),
        options,
      ),
  };
});
vi.mock("@/wab/server/db/DbMgr", () => ({
  ForbiddenError: class extends Error {},
  NotFoundError: class extends Error {},
}));
const readable = new Set<string>();
vi.mock("@/wab/server/routes/util", () => ({
  getUser: () => ({ id: "user" }),
  userDbMgr: () => ({
    checkProjectPerms: async (id: string) => {
      if (!readable.has(id)) throw new ForbiddenError("revoked");
    },
  }),
}));

it("streams durable revisions over HTTP, checks current viewer rights, closes the upstream on leave", async () => {
  const published = new Map([
    ["project", 7],
    ["private", 42],
  ]);
  const snapshot = express();
  let closed: () => void;
  const upstreamClosed = new Promise<void>((resolve) => {
    closed = resolve;
  });
  snapshot.use("/_cover-events", (_req, res, next) => {
    res.once("close", closed);
    next();
  });
  const { serveCoverEvents } = require(
    path.resolve(
      __dirname,
      "../../../../../../deploy/canvas-snapshot/covers.cjs",
    ),
  );
  const publish: (event: PublishedCover) => void = serveCoverEvents(
    snapshot,
    published,
  );
  snapshot.get("/_covers/project", (_req, res) =>
    res
      .set("X-Cover-Revision", "7")
      .type("image/webp")
      .send(Buffer.from("image")),
  );
  const studio = express();
  studio.get("/events", streamCoverEvents);
  studio.get("/revisions", getCoverRevisions);
  studio.get("/projects/:projectId/cover", getProjectCover);
  const servers: http.Server[] = [];
  async function listen(app: express.Express) {
    const server = http.createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    return "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  }
  const client = new AbortController();
  try {
    hosts.snapshot = await listen(snapshot);
    const get = http.get.bind(http);
    vi.spyOn(http, "get").mockImplementation((url, options, callback) =>
      get(
        String(url).replace("http://canvas-snapshot-page:3100", hosts.snapshot),
        options,
        callback,
      ),
    );
    const origin = await listen(studio);
    readable.add("project");
    readable.add("empty");
    expect((await fetch(origin + "/events?account=previous")).status).toBe(403);
    const image = await fetch(origin + "/projects/project/cover?account=user");
    expect(image.headers.get("X-Cover-Revision")).toBe("7");
    const response = await fetch(origin + "/events?account=user", {
      signal: client.signal,
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    async function next() {
      let text = "";
      while (!text.includes("\n\n")) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("unexpected end of stream");
        text += decoder.decode(chunk.value);
      }
      return text;
    }
    const ready = await next();
    expect(ready).toContain("event: ready");
    const stream = JSON.parse(ready.split("data: ")[1]);
    expect(
      await (
        await fetch(
          origin +
            "/revisions?account=user&ids=project,private,empty&stream=" +
            stream,
        )
      ).json(),
    ).toEqual({ project: 7, empty: 0 });
    readable.add("unlisted");
    publish({ projectId: "unlisted", publishedRevision: 3 });
    publish({ projectId: "private", publishedRevision: 42 });
    publish({ projectId: "project", publishedRevision: 8 });
    expect(await next()).toBe(
      'event: coverReady\ndata: {"projectId":"project","publishedRevision":8}\n\n',
    );
    readable.delete("project");
    publish({ projectId: "project", publishedRevision: 9 });
    publish({ projectId: "empty", publishedRevision: 1 });
    expect(await next()).toBe(
      'event: coverReady\ndata: {"projectId":"empty","publishedRevision":1}\n\n',
    );
    client.abort();
    await upstreamClosed;

    // Losing the snapshot service must terminate the public stream so that
    // EventSource reconnects and registers a fresh revision snapshot.
    const again = await fetch(origin + "/events?account=user");
    const reconnected = again.body!.getReader();
    expect(decoder.decode((await reconnected.read()).value)).toContain(
      "event: ready",
    );
    servers[0].closeAllConnections();
    expect((await reconnected.read()).done).toBe(true);
  } finally {
    client.abort();
    vi.restoreAllMocks();
    readable.clear();
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
