import { DEVFLAGS } from "@/wab/shared/devflags";
import { notification } from "antd";
import "fake-indexeddb/auto";
import * as jestExtendedMatchers from "jest-extended";
import { TransformStream } from "stream/web";
import { TextDecoder, TextEncoder } from "util";
import { expect, vi } from "vitest";
import "whatwg-fetch";
import { BroadcastChannel as NodeBroadcastChannel } from "worker_threads";

import "@/wab/client/__testonly__/initTests";

expect.extend(jestExtendedMatchers);

// Use mocks for code that doesn't work in JSDOM
vi.mock("@/wab/client/image/metadata");

// Studio fetches its canvas/hostless bundles from the static server, which isn't
// running under test. Left alone, StudioCtx kicks those fetches off from
// its constructor and the rejections surface as unhandled errors.
vi.mock(
  "@/wab/client/components/studio/studio-bundles",
  async (importOriginal) => ({
    ...(await importOriginal()),
    getCanvasPkgs: async () => "",
    ensureCanvasRuntime: async () => undefined,
    getReactWebBundle: async () => "",
    prefetchCanvasResources: vi.fn(),
    getLiveFrameClientJs: async () => "",
    getHostLessPkg: async () => "",
    getSortedHostLessPkgs: async (_win, _api, pkgs) =>
      pkgs.map((pkg) => [pkg, ""]),
  }),
);

DEVFLAGS.hostUrl = "http://localhost";

// Mock the entire static notification lifecycle. Antd's destroy() also creates
// a React root when none exists, even though the mocked emitters opened none.
for (const method of ["open", "success", "info", "warning", "error", "destroy"]) {
  notification[method] = () => {};
}

// Web shims for APIs missing in JSDOM
if (typeof Element !== "undefined") {
  Element.prototype.animate = () => ({ cancel: vi.fn() });
}
// Real SVG geometry is checked in Chromium; jsdom exercises animation lifecycle.
if (typeof SVGElement !== "undefined") {
  Object.defineProperties(SVGElement.prototype, {
    getTotalLength: { configurable: true, value: () => 100 },
    getPointAtLength: {
      configurable: true,
      value: (distance) => ({ x: distance, y: 0 }),
    },
  });
}

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Node's encoder returns a Node-realm array. Modules such as esbuild require
// the result to be an instance of the test environment's Uint8Array.
global.TextEncoder = class extends TextEncoder {
  encode(input) {
    return new Uint8Array(super.encode(input));
  }
};
global.TextDecoder = TextDecoder;
// Needed at import time by the AI SDKs used for copilot.
global.TransformStream = TransformStream;

// Node's BroadcastChannel is Web-compatible. `unref` so open channels don't keep
// the process alive after tests.
global.BroadcastChannel = class BroadcastChannel extends NodeBroadcastChannel {
  constructor(name) {
    super(name);
    this.unref();
  }
};

let objectURLCounter = 0;
global.URL.createObjectURL = () => `blob:${++objectURLCounter}`;
global.URL.revokeObjectURL = () => {};

beforeAll(async () => {
  if (typeof window === "undefined") {
    return;
  }
  const { initializeUiLocale } = await vi.importActual("@/wab/client/i18n");
  await initializeUiLocale();
});
