const net = require("node:net");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");
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
  const server = net.createServer((connection) => {
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
      let request;
      let authenticated = false;
      let response;
      try {
        request = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
        if (request.token !== token) {
          throw new Error("Unauthorized local client");
        }
        authenticated = true;
        const result = await dispatch(request.method, request.input || {});
        response = { result };
      } catch (error) {
        response = { error: error.message };
      }
      const encoded = JSON.stringify(response);
      if (authenticated && process.env.PLASMIC_RPC_METRICS) {
        // Opt-in local evaluation counters cover script/RPC traffic as well as MCP.
        // Never store the token, argument values, returned content or error text.
        await fs.appendFile(process.env.PLASMIC_RPC_METRICS, JSON.stringify({
          time: new Date().toISOString(), method: request.method,
          operation: request.method === "execute" ? request.input?.name : undefined,
          inputBytes: Buffer.byteLength(JSON.stringify(request.input || {})),
          responseBytes: Buffer.byteLength(encoded), ms: Date.now() - started,
          failed: !!response.error,
        }) + "\n", { mode: 0o600 }).catch(() => {});
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
    await new Promise((resolve) => server.close(resolve));
    await fs.unlink(path.join(profile, "mcp-connection.json")).catch(() => {});
    if (process.platform !== "win32") {
      await fs.unlink(socket).catch(() => {});
    }
  };
}
async function requestRpc(profile, method, input = {}) {
  let address;
  try {
    address = JSON.parse(
      await fs.readFile(path.join(profile, "mcp-connection.json"), "utf8"),
    );
  } catch {
    throw new Error("Start Plasmic before connecting MCP");
  }
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
        JSON.stringify({ token: address.token, method, input }) + "\n",
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
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}
module.exports = { startRpc, requestRpc };
