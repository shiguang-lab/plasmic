/** @vitest-environment node */
import { ApiTester } from "@/wab/server/__testonly__/api-tester";
import { startTestServer } from "@/wab/server/__testonly__/test-server";
import { UnknownApiError } from "@/wab/shared/ApiErrors/ApiError";

it.each(["text", "unrecognized-json"])(
  "preserves an unrecognized %s API failure without importing a browser runtime",
  async (kind) => {
    expect(typeof window).toBe("undefined");
    const server = await startTestServer("127.0.0.1", (_req, res) => {
      res.writeHead(502, { "Content-Type": kind === "text" ? "text/plain" : "application/json" });
      res.end(kind === "text" ? "Gateway unavailable" : JSON.stringify({ error: { message: "Gateway unavailable" } }));
    });
    const api = new ApiTester(server.url);
    try {
      await expect(api.req("get", "/failure")).rejects.toBeInstanceOf(UnknownApiError);
      await expect(api.req("get", "/failure")).rejects.toThrow(
        kind === "text" ? "502: Gateway unavailable" : "Gateway unavailable",
      );
    } finally {
      await api.dispose();
      await server.dispose();
    }
  },
);
