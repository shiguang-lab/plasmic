// A single local worker publishes revisioned covers. New saves replace pending work.
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const quietMs = 45_000;
const maxWaitMs = 300_000;
const retryMs = [15_000, 60_000, 300_000];

class CoverQueue {
  pending = new Map();
  published = new Map();
  busy = false;

  offer(id, rev, now, immediate = false) {
    if ((this.published.get(id) || 0) >= rev) return;
    const old = this.pending.get(id);
    if (old && old.rev >= rev) return;
    const first = old?.first ?? now;
    this.pending.set(id, {
      rev,
      first,
      attempts: 0,
      due: immediate ? now : Math.min(now + quietMs, first + maxWaitMs),
    });
  }

  async run(capture, clock = Date.now) {
    if (this.busy) return;
    const task = [...this.pending].find(([, job]) => job.due <= clock());
    if (!task) return;
    const [id, job] = task;
    this.busy = true;
    try {
      const result = await capture(id);
      if (result.projectId !== id || result.revision < job.rev)
        throw Error("Unexpected captured revision");
      this.published.set(id, result.revision);
      if (this.pending.get(id)?.rev <= result.revision) this.pending.delete(id);
      return { projectId: id, publishedRevision: result.revision };
    } catch (error) {
      if (this.pending.get(id) === job) {
        job.due =
          job.attempts < retryMs.length
            ? clock() + retryMs[job.attempts]
            : Infinity;
        job.attempts++;
      }
      console.error("Cover job", id, job.rev, error.message);
    } finally {
      this.busy = false;
    }
  }
}

function capture(id) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: "/jobs/screenshot.sock",
        path: "/covers/" + id,
        method: "POST",
        signal: AbortSignal.timeout(240_000),
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8").on("data", (chunk) => {
          body += chunk;
        });
        res.on("error", reject).on("end", () => {
          try {
            if (res.statusCode !== 200)
              throw Error("Worker HTTP " + res.statusCode);
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject).end();
  });
}

function serveCoverEvents(app, published) {
  const streams = new Map();
  app.get("/_cover-events", (req, res) => {
    const { stream, account } = req.query;
    const projects = new Set();
    res.type("application/x-ndjson");
    streams.set(stream, { res, account, projects });
    const heartbeat = setInterval(() => {
      if (!res.write("\n")) res.destroy();
    }, 15_000);
    res.on("close", () => {
      clearInterval(heartbeat);
      streams.delete(stream);
    });
    res.flushHeaders();
  });
  app.get("/_cover-revisions", (req, res) => {
    const subscription = streams.get(req.query.stream);
    if (!subscription || subscription.account !== req.query.account) return res.sendStatus(409);
    const ids = String(req.query.ids).split(",");
    // Subscribe and read in the same turn so a publication cannot fall between them.
    for (const id of ids) subscription.projects.add(id);
    res.json(Object.fromEntries(ids.map(id => [id, published.get(id) || 0])));
  });
  return (event) => {
    const line = JSON.stringify(event) + "\n";
    for (const { res, projects } of streams.values()) {
      if (projects.has(event.projectId) && !res.write(line)) res.destroy();
    }
  };
}

async function startCovers(app, pool) {
  const queue = new CoverQueue();
  const dir = "/covers";
  for (const file of await fs.readdir(dir)) {
    const match = /^([\w-]+)-(\d+)\.webp$/.exec(file);
    if (match)
      queue.published.set(
        match[1],
        Math.max(queue.published.get(match[1]) || 0, Number(match[2])),
      );
  }
  // Reconcile saves committed while either service was offline. Old projects
  // predating installation get their first cover when a visible card asks.
  const epochPath = "/jobs/cover-start";
  const epochFile = await fs.open(epochPath, "a", 0o600);
  await epochFile.close();
  const epoch = (await fs.stat(epochPath)).mtime;
  const latest = `SELECT p.id,r.revision FROM project p CROSS JOIN LATERAL (
    SELECT revision FROM project_revision WHERE "projectId"=p.id AND "branchId" IS NULL
      AND "deletedAt" IS NULL ORDER BY revision DESC LIMIT 1
    ) r WHERE p."deletedAt" IS NULL`;
  let scanning = false;
  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      const { rows } = await pool.query(latest + ' AND p."updatedAt" >= $1', [
        epoch,
      ]);
      for (const row of rows) queue.offer(row.id, row.revision, Date.now());
    } catch (error) {
      console.error("Cover reconciliation:", error.message);
    } finally {
      scanning = false;
    }
  }
  const publish = serveCoverEvents(app, queue.published);

  await scan();
  setInterval(scan, 15_000);
  setInterval(async () => {
    const event = await queue.run(capture);
    if (event) publish(event);
  }, 1000);

  // Only the Studio backend calls this Docker-network route, after viewer authorization.
  app.get(/^\/_covers\/([\w-]+)$/, async (req, res) => {
    const id = req.params[0];
    res.set("Cache-Control", "private, no-store");
    try {
      const {
        rows: [row],
      } = await pool.query(latest + " AND p.id=$1", [id]);
      if (!row) return res.sendStatus(404);
      let rev = queue.published.get(id);
      let bytes;
      if (rev) {
        try {
          bytes = await fs.readFile(path.join(dir, id + "-" + rev + ".webp"));
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
          queue.published.delete(id);
          rev = undefined;
        }
      }
      queue.offer(id, row.revision, Date.now(), !rev);
      const job = queue.pending.get(id);
      if (job && Number.isFinite(job.due)) res.set("Retry-After", "10");
      if (!bytes) return res.status(job?.due === Infinity ? 503 : 202).end();
      res.set("X-Cover-Revision", String(rev)).type("image/webp").send(bytes);
    } catch (error) {
      console.error("Read cover:", error.message);
      res.sendStatus(503);
    }
  });
}
module.exports = { CoverQueue, startCovers, serveCoverEvents };
