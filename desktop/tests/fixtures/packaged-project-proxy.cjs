const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { execFileSync } = require("node:child_process");
const { X509Certificate, createHash } = require("node:crypto");
const { createProjectBackend } = require("../performance/real-project-backend.cjs");

/** Exercise the installed main process's real network stack, without replacing
 * app modules, bypassing production fuses or contacting the saved project's NAS. */
exports.createPackagedProjectProxy = async (fixture, directory) => {
  await fs.mkdir(directory, {recursive: true});
  const read = async name => JSON.parse(await fs.readFile(path.join(fixture, name), "utf8"));
  const opening = await read("project-response.json");
  const startup = opening.startup;
  // Explicit user edits below are saved through the real endpoint, not autosave.
  startup.appConfig.config.autoSave = false;
  const models = {...await read("model-resources.json"), ...await read("plume-resources.json")};
  const canonical = value => { const u = new URL(value, "https://plasmic-studio.shiguanglab.com"); u.searchParams.sort(); return u.pathname + u.search; };
  const codes = new Map(Object.entries(await read("code-resources.json")).map(([key, value]) => [canonical(key), value]));
  const report = {requests: [], blocked: [], saves: []};
  const backend = createProjectBackend({opening, startup, models, codes, plume: await read("plume-opening.json"), report, phase: () => "installed-desktop", functional: true});
  const certFile = path.join(directory, "fixture-cert.pem"), keyFile = path.join(directory, "fixture-key.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=plasmic-studio.shiguanglab.com", "-keyout", keyFile, "-out", certFile], {stdio: "ignore"});
  await fs.chmod(keyFile, 0o600);
  const cert = await fs.readFile(certFile), key = await fs.readFile(keyFile);
  const spki = createHash("sha256").update(new X509Certificate(cert).publicKey.export({type: "spki", format: "der"})).digest("base64");
  const sockets = new Set();
  const track = socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); };
  const respond = async (incoming, outgoing, secure = true) => {
    try {
      const url = incoming.url.startsWith("http") ? incoming.url : `${secure ? "https" : "http"}://${incoming.headers.host}${incoming.url}`;
      const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      let request = new Request(url, {method: incoming.method, headers: incoming.headers, ...(body.length ? {body} : {})});
      if (incoming.method === "POST" && new URL(url).pathname.startsWith(`/api/v1/projects/${startup.projectId}/revisions/`)) {
        const input = await request.json();
        if (input.incremental) {
          const previous = JSON.parse(opening.rev.data), next = JSON.parse(input.data);
          next.map = {...previous.map, ...Object.fromEntries(Object.entries(next.map).map(([id, fields]) => {
            if (previous.map[id] && previous.map[id].__type !== fields.__type) throw new Error("Incremental model type changed");
            return [id, {...previous.map[id], ...fields}];
          }))};
          for (const id of input.toDeleteIids || []) delete next.map[id];
          input.data = JSON.stringify(next); input.incremental = false;
        }
        request = new Request(url, {method: incoming.method, headers: incoming.headers, body: JSON.stringify(input)});
      }
      const response = await backend(request), bytes = Buffer.from(await response.arrayBuffer());
      const headers = Object.fromEntries(response.headers);
      for (const name of ["content-length", "transfer-encoding", "connection"]) delete headers[name];
      if (incoming.headers.origin && ["https://plasmic-studio.shiguanglab.com", "https://plasmic-canvas.shiguanglab.com"].includes(incoming.headers.origin)) {
        headers["access-control-allow-origin"] = incoming.headers.origin;
        headers["access-control-allow-credentials"] = "true";
      }
      headers["content-length"] = bytes.length;
      report.requests.push({method: incoming.method, path: new URL(url).pathname, status: response.status});
      outgoing.writeHead(response.status, headers); outgoing.end(incoming.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      report.blocked.push({method: incoming.method, path: incoming.url, error: error.message});
      outgoing.writeHead(500, {"content-type": "text/plain"}); outgoing.end("Owned fixture request failed");
    }
  };
  const secure = https.createServer({key, cert}, respond); secure.on("connection", track);
  await new Promise(resolve => secure.listen(0, "127.0.0.1", resolve));
  const proxy = http.createServer((req, res) => respond(req, res, false)); proxy.on("connection", track);
  proxy.on("connect", (req, socket, head) => {
    // Every CONNECT terminates in this local fixture; never tunnel to the NAS.
    const upstream = net.connect(secure.address().port, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    track(upstream); upstream.on("error", () => socket.destroy()); socket.on("error", () => upstream.destroy());
  });
  await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
  return {projectId: startup.projectId, projectName: opening.project.name, proxyUrl: `http://127.0.0.1:${proxy.address().port}`, spki, report,
    originalBundle: opening.rev.data,
    getSavedBundle: () => opening.rev.data,
    close: async () => { for (const socket of sockets) socket.destroy(); await Promise.all([new Promise(resolve => proxy.close(resolve)), new Promise(resolve => secure.close(resolve))]); },
  };
};
