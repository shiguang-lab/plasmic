import {
  generateLocalEditStep,
  getLocalAiConfig,
  localEditMessages,
} from "@/wab/server/copilot/local-edit";
import { LocalEditRequest } from "@/wab/shared/copilot/local-edit";
import { Server, createServer } from "node:http";
import { AddressInfo } from "node:net";
const config = vi.hoisted(() => ({
  baseUrl: "",
  apiKey: "fixture-key",
  model: "fixture-model",
}));
vi.mock("@/wab/server/secrets", () => ({
  loadSecrets: () => ({ localAiEditing: config }),
}));

const request: LocalEditRequest = {
  binding: {
    projectId: "project",
    branchId: null,
    sessionId: "session",
    changeCounter: 0,
    componentUuid: "page",
    elementUuids: ["region"],
  },
  prompt: "Change title",
  resources: "Title UUID: title",
  history: [],
};
let server: Server;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it.each([false, true])(
  "uses actual SDK tool schemas for page mode=%s",
  async (page) => {
    let body: Record<string, any> = {};
    server = createServer(async (req, res) => {
      const parts: Buffer[] = [];
      for await (const part of req) {
        parts.push(part);
      }
      body = JSON.parse(Buffer.concat(parts).toString());
      expect(req.url).toBe("/v1/chat/completions");
      expect(req.headers.authorization).toBe("Bearer fixture-key");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: "completion",
          model: config.model,
          created: 1,
          choices: [
            {
              index: 0,
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: "Editing title",
                tool_calls: [
                  {
                    id: "call-1",
                    type: "function",
                    function: {
                      name: "changeElement",
                      arguments: JSON.stringify({
                        componentUuid: "page",
                        elementUuid: "title",
                        text: "After",
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    config.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    const result = await generateLocalEditStep(
      page
        ? {
            ...request,
            binding: { ...request.binding, mode: "page", elementUuids: [] },
          }
        : request,
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      text: "Editing title",
      calls: [
        { id: "call-1", name: "changeElement", input: { text: "After" } },
      ],
    });
    expect(body.model).toBe(config.model);
    const names = body.tools.map((t: any) => t.function.name);
    expect(names.includes("createState")).toBe(page);
    expect(names.includes("createInteraction")).toBe(page);
    expect(names).not.toContain("createComponent");
    expect(body.tools.map((t: any) => t.function.name)).toContain(
      "selectElement",
    );
    expect(body.tools.map((t: any) => t.function.name)).not.toContain(
      "deleteComponent",
    );
  },
);

it("requires matching tool results when continuing the model conversation", () => {
  expect(() =>
    localEditMessages({
      ...request,
      history: [
        {
          text: "",
          calls: [{ id: "call", name: "read", input: {} }],
          results: [],
        },
      ],
    }),
  ).toThrow("Missing AI tool result");
  const messages = localEditMessages({
    ...request,
    history: [
      {
        text: "Reading",
        calls: [{ id: "call", name: "read", input: {} }],
        results: [{ id: "call", output: "Resource" }],
      },
    ],
  });
  expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
});

it("accepts environment configuration without exposing secrets in status data", () => {
  vi.stubEnv("PLASMIC_AI_BASE_URL", "https://example.com/v1");
  vi.stubEnv("PLASMIC_AI_MODEL", "configured-model");
  expect(getLocalAiConfig()?.model).toBe("configured-model");
  vi.stubEnv("PLASMIC_AI_BASE_URL", "http://external.example/v1");
  expect(() => getLocalAiConfig()).toThrow("requires HTTPS");
});
