import { ForbiddenError, NotFoundError } from "@/wab/server/db/DbMgr";
import { getUser, userDbMgr } from "@/wab/server/routes/util";
import { BadRequestError } from "@/wab/shared/ApiErrors/errors";
import {
  coverRevisionBatchSize,
  coverRevisionHeader,
  PublishedCover,
} from "@/wab/shared/project-covers";
import { randomUUID } from "crypto";
import type { Request, Response } from "express-serve-static-core";
import http from "http";
import fetch from "node-fetch";
import { createInterface } from "readline";

const snapshotService = "http://canvas-snapshot-page:3100";

export async function getProjectCover(req: Request, res: Response) {
  const { projectId } = req.params;
  res.set("Cache-Control", "private, no-store");
  if (
    req.query.account !== undefined &&
    req.query.account !== getUser(req).id
  ) {
    res.sendStatus(403);
    return;
  }
  await userDbMgr(req).checkProjectPerms(
    projectId,
    "viewer",
    "View project cover",
  );
  const cover = await fetch(
    snapshotService + "/_covers/" + encodeURIComponent(projectId),
    { signal: AbortSignal.timeout(5000) },
  );
  if (cover.headers.has("retry-after")) res.set("Retry-After", "10");
  if (cover.status !== 200) {
    res.status(cover.status).end();
    return;
  }
  const revision = cover.headers.get(coverRevisionHeader);
  if (revision) res.set(coverRevisionHeader, revision);
  res.type("image/webp").send(Buffer.from(await cover.arrayBuffer()));
}

async function canReadCover(req: Request, projectId: string) {
  try {
    // DbMgr memoizes permission checks. Each publication needs current permissions.
    await userDbMgr(req).checkProjectPerms(
      projectId,
      "viewer",
      "View project cover",
    );
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError)
      return false;
    throw error;
  }
}

export async function getCoverRevisions(req: Request, res: Response) {
  if (getUser(req).id !== req.query.account) {
    res.sendStatus(403);
    return;
  }
  const stream = req.query.stream;
  if (typeof stream !== "string" || !/^[a-f0-9-]{36}$/.test(stream)) {
    throw new BadRequestError("Invalid cover subscription");
  }
  const ids = typeof req.query.ids === "string" ? req.query.ids.split(",") : [];
  if (
    !ids.length ||
    ids.length > coverRevisionBatchSize ||
    ids.some((id) => !/^[\w-]{1,128}$/.test(id))
  ) {
    throw new BadRequestError("Invalid cover project IDs");
  }
  const allowed: string[] = [];
  for (const id of new Set(ids)) {
    if (res.destroyed) return;
    if (await canReadCover(req, id)) allowed.push(id);
  }
  let revisions: Record<string, number> = {};
  if (allowed.length) {
    const params = new URLSearchParams({
      stream,
      account: getUser(req).id,
      ids: allowed.join(","),
    });
    const result = await fetch(
      snapshotService + "/_cover-revisions?" + params,
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!result.ok) throw new Error("Cover revisions unavailable");
    revisions = await result.json();
  }
  // Omitted IDs have lost access; zero means authorized but no image yet.
  res.set("Cache-Control", "private, no-store").json(revisions);
}

export async function streamCoverEvents(req: Request, res: Response) {
  if (getUser(req).id !== req.query.account) {
    res.sendStatus(403);
    return;
  }
  const lifetime = new AbortController();
  res.once("close", () => lifetime.abort());
  const expires = req.shiguangIdentity?.exp;
  const expiry =
    expires &&
    setTimeout(
      () => lifetime.abort(),
      Math.max(0, expires * 1000 - Date.now()),
    );
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "private, no-store, no-transform",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  try {
    const stream = randomUUID();
    const params = new URLSearchParams({ stream, account: getUser(req).id });
    const source = await new Promise<http.IncomingMessage>(
      (resolve, reject) => {
        const request = http.get(
          snapshotService + "/_cover-events?" + params,
          {
            signal: lifetime.signal,
            timeout: 35_000, // The publisher sends a heartbeat every 15 seconds.
          },
          resolve,
        );
        request.once("error", reject);
        request.on("timeout", () =>
          request.destroy(new Error("Cover publisher timed out")),
        );
      },
    );
    if (source.statusCode !== 200)
      throw new Error("Cover publisher unavailable");
    // The publisher has installed its listener before flushing headers. Clients
    // can now reconcile missed revisions without a snapshot/subscribe gap.
    res.write("event: ready\ndata: " + JSON.stringify(stream) + "\n\n");
    const lines = createInterface({ input: source, crlfDelay: Infinity });
    for await (const line of lines) {
      let message = ": heartbeat\n\n";
      if (line) {
        const event: PublishedCover = JSON.parse(line);
        if (!(await canReadCover(req, event.projectId))) continue;
        message = "event: coverReady\ndata: " + JSON.stringify(event) + "\n\n";
      }
      if (lifetime.signal.aborted || !res.write(message)) break;
    }
  } catch (error) {
    if (!lifetime.signal.aborted)
      console.warn("Cover event stream interrupted", error);
  } finally {
    if (expiry) clearTimeout(expiry);
    lifetime.abort();
    res.end();
  }
}
