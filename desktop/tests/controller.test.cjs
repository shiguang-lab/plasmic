const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? { ipcMain: { on() {}, removeListener() {} } }
    : originalLoad.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = originalLoad;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
test("schema discovery preserves full contracts while status polling omits their repeated bodies", async (t) => {
  const controller = new DesktopController(() => null, {});
  t.after(() => controller.close());
  const read = { inputSchema: { type: "object" }, outputSchema: { definitions: { node: { type: "object" } }, $ref: "#/definitions/node" } };
  const state = { ready: true, projectId: "project", build: { hash: "build" },
    editorContext: { sessionId: "session", changeCounter: 2 }, operations: [{ phase: "running" }],
    editorTools: { read, save: { inputSchema: { type: "object" } } }, availableEditorTools: ["read", "save"] };
  const scopes = [];
  controller.state = async (toolNames) => { scopes.push(toolNames); return state; };
  assert.equal(await controller.dispatch("get_app_state", {}), state);
  const status = await controller.dispatch("get_app_state", { toolNames: [] });
  assert.deepEqual(status, { ...state, availableEditorTools: ["read", "save"], editorTools: {} });
  const selected = await controller.dispatch("get_app_state", { toolNames: ["read"] });
  assert.deepEqual(selected.editorTools, { read });
  assert.deepEqual(scopes, [undefined, [], ["read"]]);
  assert.equal(selected.editorTools.read, read);
  assert.deepEqual(state.editorTools, { read, save: { inputSchema: { type: "object" } } });
  for (const toolNames of [["missing"], ["read", "read"], [""], [0], "read", null]) {
    await assert.rejects(controller.dispatch("get_app_state", { toolNames }), /toolNames|schema unavailable/);
  }
  controller.state = async () => ({ ready: false, projectId: null });
  assert.deepEqual(await controller.dispatch("get_app_state", { toolNames: [] }), {
    ready: false, projectId: null, availableEditorTools: [], editorTools: {},
  });
});
test("readiness polling requests context without schemas", async (t) => {
  const win = { isDestroyed: () => false, webContents: {
    isLoadingMainFrame: () => false, getURL: () => "https://studio.example/projects/project",
  } };
  const controller = new DesktopController(() => win, { studioOrigin: "https://studio.example" });
  t.after(() => controller.close());
  controller.invoke = async (method, input) => {
    assert.equal(method, "metadata");
    assert.deepEqual(input, { toolNames: [] });
    return { ready: true, tools: {}, editorContext: { sessionId: "session" } };
  };
  assert.equal((await controller.ready()).ready, true);
});
test("state and independent media remain responsive while editor operations serialize", async () => {
  const controller = new DesktopController(() => null, {});
  const gate = deferred();
  const entered = deferred();
  const calls = [];
  controller.execute = async (method) => {
    calls.push(method);
    if (method === "execute") {
      entered.resolve();
      await gate.promise;
    }
    return method;
  };
  const first = controller.dispatch("execute", {});
  await entered.promise;
  const second = controller.dispatch("execute_batch", {});
  assert.equal(await controller.dispatch("get_app_state", {}), "get_app_state");
  assert.equal(
    await controller.dispatch("generate_image", {}),
    "generate_image",
  );
  assert.deepEqual(calls, ["execute", "get_app_state", "generate_image"]);
  assert.deepEqual(
    [...controller.operations.values()].map((operation) => operation.phase),
    ["running", "queued"],
  );
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(controller.operations.size, 0);
  controller.close();
});
test("a lost metadata response expires, releases the queue and ignores a late IPC reply", async () => {
  const sent = [];
  const webContents = {
    mainFrame: {},
    send: (_channel, request) => sent.push(request),
  };
  const win = { isDestroyed: () => false, webContents };
  const controller = new DesktopController(() => win, {});
  controller.execute = (method) =>
    method === "snapshot_layout"
      ? controller.invoke("metadata", {}, 10)
      : Promise.resolve({ resumed: true });
  const failed = assert.rejects(
    controller.dispatch("snapshot_layout", {}),
    /Editor command timed out: metadata/,
  );
  const next = controller.dispatch("execute", {});
  await failed;
  assert.deepEqual(await next, { resumed: true });
  assert.equal(controller.pending.size, 0);
  assert.equal(controller.operations.size, 0);
  controller.receive(
    { sender: webContents, senderFrame: webContents.mainFrame },
    sent[0].id,
    { ready: true },
  );
  assert.equal(controller.pending.size, 0);
  const healthy = controller.invoke("metadata", {}, 1000);
  controller.receive(
    { sender: webContents, senderFrame: webContents.mainFrame },
    sent[1].id,
    { ready: true },
  );
  assert.deepEqual(await healthy, { ready: true });
  controller.close();
});
test("opening a project waits for initial loadURL to finish", async () => {
  const startup = deferred();
  const urls = [];
  const win = {
    isDestroyed: () => false,
    loadURL: async (url) => urls.push(url),
  };
  const controller = new DesktopController(
    () => win,
    { studioOrigin: "https://studio.example" },
    () => startup.promise,
  );
  controller.state = async () => ({ ready: false, projectId: null });
  controller.ready = async () => {};
  controller.editor = async () => ({ projectId: "project" });
  const opening = controller.dispatch("open_design", { projectId: "project" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(urls, []);
  startup.resolve();
  assert.equal((await opening).opened, true);
  assert.deepEqual(urls, ["https://studio.example/projects/project"]);
  controller.close();
});
test("background inspection releases its frame after a failed read without navigating", async () => {
  const controller = new DesktopController(() => null, {});
  const calls = [];
  controller.editor = async (method, input) => {
    calls.push({ method, input });
    return { inspectionId: "lease" };
  };
  await assert.rejects(
    controller.inspectCanvas({ componentUuid: "page" }, async (name) => {
      assert.equal(name, "lease");
      throw new Error("Capture failed");
    }),
    /Capture failed/,
  );
  assert.deepEqual(calls, [
    { method: "beginCanvasInspection", input: { componentUuid: "page" } },
    { method: "endCanvasInspection", input: { inspectionId: "lease" } },
  ]);
  await assert.rejects(
    controller.inspectCanvas(
      { mode: "workspace", componentUuid: "page" },
      () => {},
    ),
    /current canvas/,
  );
  controller.close();
});

test("exports pin the exact requested frame and release business rendering after failure", async () => {
  const controller = new DesktopController(() => null, {});
  const calls = [];
  controller.editor = async (method, input) => {
    calls.push({ method, input });
    return { inspectionId: "export-lease" };
  };
  await assert.rejects(
    controller.inspectCanvas(
      { frameUuid: "selected-frame" },
      async () => {
        throw new Error("Capture failed");
      },
      true,
    ),
    /Capture failed/,
  );
  assert.deepEqual(calls, [
    {
      method: "beginCanvasInspection",
      input: { frameUuid: "selected-frame", forExport: true },
    },
    { method: "endCanvasInspection", input: { inspectionId: "export-lease" } },
  ]);
  controller.close();
});

test("workspace screenshots capture the editor when a project uses a custom host", async () => {
  const calls = [];
  const win = {
    isDestroyed: () => false,
    webContents: {
      capturePage: async () => {
        calls.push("capture");
        return {
          toPNG: () => Buffer.from("image"),
          getSize: () => ({ width: 1600, height: 1000 }),
        };
      },
    },
  };
  const controller = new DesktopController(() => win, {});
  controller.ready = async () => calls.push("ready");
  controller.invoke = async (method) => calls.push(method);
  const result = await controller.dispatch("get_screenshot", {
    mode: "workspace",
  });
  assert.equal(result.width, 1600);
  assert.equal(result.height, 1000);
  assert.deepEqual(calls, ["ready", "ready", "renderReady", "capture"]);
  controller.close();
});

test("exports transitive library CSS through authenticated codegen requests without refetching cyclic dependencies", async () => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "plasmic-controller-export-"),
  );
  const css = (id) =>
    `@import "../${id}/plasmic.css"; /* plasmic-import: ${id}/projectcss */`;
  const bundles = {
    root: {
      components: [
        {
          id: "page",
          componentName: "Page",
          skeletonModuleFileName: "Page.tsx",
          skeletonModule: 'import "./plasmic.css"; export const page = "Page";',
        },
      ],
      projectConfig: {
        projectId: "root",
        cssFileName: "plasmic.css",
        cssRules: css("library"),
      },
    },
    library: {
      components: [],
      projectConfig: {
        projectId: "library",
        cssFileName: "plasmic.css",
        cssRules: css("root") + css("shared"),
      },
    },
    shared: {
      components: [],
      projectConfig: {
        projectId: "shared",
        cssFileName: "plasmic.css",
        cssRules: ":root{--theme:red}",
      },
    },
  };
  const requests = [];
  const controller = new DesktopController(
    () => ({
      isDestroyed: () => false,
      webContents: {
        session: {
          fetch: async (url, options) => {
            if (url.endsWith("/resolve-sync")) {
              return {
                ok: true,
                json: async () => ({
                  projects: [
                    { projectId: "root", componentIds: ["page", "reusable"] },
                  ],
                }),
              };
            }
            const projectId = new URL(url).pathname.split("/")[4];
            assert.equal(new URL(url).search, "");
            requests.push({ projectId, body: JSON.parse(options.body) });
            assert.equal(JSON.parse(options.body).imageOpts.scheme, "files");
            assert.equal(options.credentials, "include");
            assert.equal(options.bypassCustomProtocolHandlers, true);
            return { ok: true, json: async () => bundles[projectId] };
          },
        },
      },
    }),
    { studioOrigin: "https://studio.example" },
  );
  controller.ready = async () => {};
  controller.editor = async () => ({ projectId: "root" });
  try {
    const result = await controller.dispatch("export_code", {
      outputPath: path.join(root, "export"),
      componentUuids: ["page"],
    });
    assert.deepEqual(
      requests.map((request) => request.projectId),
      ["root", "library", "shared"],
    );
    assert.deepEqual(
      requests.map((request) => request.body.componentIdOrNames),
      [["page", "reusable"], [], []],
    );
    assert.ok(result.files.includes("dependencies/shared/plasmic.css"));
  } finally {
    controller.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("downloads self-hosted pictures and includes their bytes in an export", async () => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "plasmic-export-image-"),
  );
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const requests = [];
  const controller = new DesktopController(
    () => ({
      isDestroyed: () => false,
      webContents: {
        session: {
          fetch: async (url, options) => {
            if (url.endsWith("/resolve-sync")) {
              return {
                ok: true,
                json: async () => ({
                  projects: [{ projectId: "project", componentIds: ["page"] }],
                }),
              };
            }
            requests.push({ url, credentials: options.credentials });
            if (options.method === "POST") {
              assert.equal(JSON.parse(options.body).imageOpts.scheme, "files");
              return {
                ok: true,
                json: async () => ({
                  components: [
                    {
                      id: "page",
                      componentName: "Page",
                      skeletonModuleFileName: "Page.tsx",
                      skeletonModule:
                        'import image from "./image.null"; // plasmic-import: image/picture\nexport default image;',
                    },
                  ],
                  imageAssets: [
                    {
                      id: "image",
                      fileName: "image.jpg",
                      blob: "https://studio.example/assets/image.jpg",
                    },
                    {
                      id: "external",
                      fileName: "external.jpg",
                      blob: "https://assets.example/external.jpg",
                    },
                  ],
                }),
              };
            }
            return { ok: true, arrayBuffer: async () => bytes };
          },
        },
      },
    }),
    { studioOrigin: "https://studio.example" },
  );
  controller.ready = async () => {};
  controller.editor = async () => ({ projectId: "project" });
  try {
    const result = await controller.dispatch("export_code", {
      componentUuids: ["page"],
      outputPath: path.join(root, "export"),
    });
    assert.deepEqual(
      requests.map((r) => r.credentials),
      ["include", "include", "omit"],
    );
    assert.ok(result.files.includes("image.jpg"));
    assert.deepEqual(
      await fs.readFile(path.join(result.path, "image.jpg")),
      bytes,
    );
  } finally {
    controller.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("native API operations wait for device session restoration, while local state polling does not renew login", async () => {
  const gate = deferred();
  let restores = 0;
  let requests = 0;
  const win = {
    isDestroyed: () => false,
    webContents: {
      session: {
        fetch: async () => {
          requests++;
          return Response.json({ id: "org" });
        },
      },
    },
  };
  const controller = new DesktopController(
    () => win,
    { studioOrigin: "https://studio.example" },
    async () => {},
    () => {
      restores++;
      return gate.promise;
    },
  );
  controller.state = async () => ({ ready: true });
  await controller.dispatch("get_app_state", {});
  assert.equal(restores, 0);
  const operation = controller.dispatch("get_org", { orgId: "org" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(restores, 1);
  assert.equal(requests, 0);
  gate.resolve();
  assert.deepEqual(await operation, { id: "org" });
  assert.equal(requests, 1);
  controller.close();
});
