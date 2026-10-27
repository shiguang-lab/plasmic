const net = require("node:net");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes, randomUUID, createHash } = require("node:crypto");
const { errorPayload } = require("./tool-context.cjs");
const MCP_SESSION = "mcp:session";
const MCP_REGISTER_CALLER = "mcp:register-caller";

function callerName(clientInfo) {
  const name = clientInfo?.name;
  if (typeof name !== "string" || !name.trim()) throw new Error("MCP client name is required");
  const title = typeof clientInfo.title === "string" ? clientInfo.title.trim() : "";
  if (/(?:^|[\s/_-])codex(?:$|[\s/_-])/i.test(name)) return "Codex";
  if (/(?:^|[\s/_-])chat[ -]?gpt(?:$|[\s/_-])/i.test(name)) return "ChatGPT";
  return (title || name).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) || name.trim().slice(0, 120);
}
function socketPath(profile) {
  return process.platform === "win32"
    ? "\\\\.\\pipe\\plasmic-desktop-" +
        createHash("sha256").update(profile).digest("hex").slice(0, 24)
    : path.join(profile, "mcp.sock");
}
async function startRpc(profile, dispatch) {
  await fs.mkdir(profile, { recursive: true, mode: 0o700 });
  const socket = socketPath(profile);
  if (process.platform !== "win32") {
    await fs.unlink(socket).catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
  }
  const token = randomBytes(32).toString("hex");
  const connections = new Set();
  // Command sockets are short-lived; their caller belongs to a lifecycle socket.
  const callers = new Map();
  const server = net.createServer((connection) => {
    connections.add(connection);
    let callerId;
    connection.once("close", () => {
      connections.delete(connection);
      if (callerId) callers.delete(callerId);
    });
    connection.setEncoding("utf8");
    let buffer = "",
      accepted = false;
    connection.setTimeout(150000, () => connection.destroy());
    connection.on("error", () => {});
    connection.on("data", async (chunk) => {
      if (accepted) {
        return;
      }
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 1024 * 1024) {
        connection.destroy();
        return;
      }
      if (!buffer.includes("\n")) {
        return;
      }
      accepted = true;
      const started = Date.now();
      const requestId = randomUUID();
      let request;
      let authenticated = false;
      let response;
      try {
        request = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
        if (request.token !== token) {
          throw new Error("Unauthorized local client");
        }
        authenticated = true;
        if (request.method === MCP_SESSION) {
          callerId = randomUUID();
          callers.set(callerId, undefined);
          connection.setTimeout(0);
          connection.write(JSON.stringify({ result: { connected: true, callerId } }) + "\n");
          return;
        }
        if (request.callerId !== undefined && !callers.has(request.callerId)) {
          throw new Error("MCP caller session has closed; reconnect");
        }
        if (request.method === MCP_REGISTER_CALLER) {
          if (!request.callerId || callers.get(request.callerId)) throw new Error("MCP caller must register once per connection");
          const caller = Object.freeze({ id: request.callerId, name: callerName(request.input?.clientInfo) });
          callers.set(request.callerId, caller);
          connection.end(JSON.stringify({ result: { registered: true } }) + "\n");
          return;
        }
        const caller = callers.get(request.callerId);
        if (request.callerId !== undefined && !caller) throw new Error("MCP caller is not registered");
        const result = await dispatch(request.method, request.input || {}, caller);
        response = { result };
      } catch (error) {
        response = { error: errorPayload(error) };
      }
      const encoded = JSON.stringify(response);
      const metrics = authenticated ? {
        requestId, time: new Date().toISOString(), method: request.method,
        operation: request.method === "execute" ? request.input?.name : undefined,
        inputBytes: Buffer.byteLength(JSON.stringify(request.input || {})),
        responseBytes: Buffer.byteLength(encoded), ms: Date.now() - started,
        failed: !!response.error,
      } : undefined;
      if (authenticated && process.env.PLASMIC_RPC_METRICS) {
        // Opt-in local evaluation counters cover script/RPC traffic as well as MCP.
        // Never store the token, argument values, returned content or error text.
        await fs.appendFile(process.env.PLASMIC_RPC_METRICS, JSON.stringify(metrics) + "\n", { mode: 0o600 }).catch(() => {});
      }
      if (authenticated && process.env.PLASMIC_RPC_AUDIT) {
        // Explicit local audit opt-in: full content (including images/errors),
        // shared by every transport. Authentication credentials are excluded.
        await fs.appendFile(process.env.PLASMIC_RPC_AUDIT, JSON.stringify({
          ...metrics, input: request.input || {}, response,
        }) + "\n", { mode: 0o600 }).catch((error) => {
          process.stderr.write(`RPC audit write failed for ${requestId}: ${error.message}\n`);
        });
      }
      connection.end(encoded + "\n");
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socket, resolve);
  });
  if (process.platform !== "win32") {
    await fs.chmod(socket, 0o600);
  }
  await fs.writeFile(
    path.join(profile, "mcp-connection.json"),
    JSON.stringify({ socket, token }),
    { mode: 0o600 },
  );
  return async () => {
    const closed = new Promise((resolve) => server.close(resolve));
    for (const connection of connections) connection.destroy();
    await closed;
    await fs.unlink(path.join(profile, "mcp-connection.json")).catch(() => {});
    if (process.platform !== "win32") {
      await fs.unlink(socket).catch(() => {});
    }
  };
}
async function rpcAddress(profile) {
  try {
    return JSON.parse(
      await fs.readFile(path.join(profile, "mcp-connection.json"), "utf8"),
    );
  } catch {
    throw new Error("Start Plasmic before connecting MCP");
  }
}
async function connectRpcSession(profile) {
  const address = await rpcAddress(profile);
  return new Promise((resolve, reject) => {
    const connection = net.createConnection(address.socket);
    let buffer = "", connected = false;
    connection.setEncoding("utf8");
    connection.setTimeout(5000, () => connection.destroy(new Error("Desktop connection timed out")));
    connection.on("error", reject);
    connection.once("close", () => reject(new Error("Plasmic closed before MCP connected")));
    connection.on("connect", () => connection.write(JSON.stringify({ token: address.token, method: MCP_SESSION }) + "\n"));
    connection.on("data", (chunk) => {
      if (connected) return;
      buffer += chunk;
      if (buffer.length > 4096) {
        connection.destroy(new Error("Invalid Desktop connection response"));
        return;
      }
      if (!buffer.includes("\n")) return;
      try {
        const response = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
        if (response.result?.connected !== true || typeof response.result.callerId !== "string") throw new Error(response.error?.message || "Invalid Desktop connection response");
        connected = true;
        connection.callerId = response.result.callerId;
        connection.setTimeout(0);
        resolve(connection);
      } catch (error) { connection.destroy(error); }
    });
  });
}
async function requestRpc(profile, method, input = {}, callerId) {
  const address = await rpcAddress(profile);
  return new Promise((resolve, reject) => {
    const connection = net.createConnection(address.socket);
    connection.setEncoding("utf8");
    let buffer = "";
    connection.setTimeout(150000, () =>
      connection.destroy(new Error("Desktop command timed out")),
    );
    connection.on("error", reject);
    connection.on("connect", () =>
      connection.write(
        JSON.stringify({ token: address.token, method, input, ...(callerId ? { callerId } : {}) }) + "\n",
      ),
    );
    connection.on("data", (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 32 * 1024 * 1024) {
        connection.destroy(new Error("Desktop response too large"));
      }
    });
    connection.on("end", () => {
      try {
        const response = JSON.parse(buffer);
        if (response.error) {
          const { message, name, stack, cause, ...context } = response.error;
          reject(Object.assign(new Error(message, cause === undefined ? undefined : { cause }),
            name ? { name } : {}, stack ? { stack } : {},
            Object.keys(context).length ? { context } : {}));
        } else {
          resolve(response.result);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}
module.exports = { startRpc, requestRpc, connectRpcSession, MCP_REGISTER_CALLER };
