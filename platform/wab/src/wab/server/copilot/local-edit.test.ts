import {
  generateLocalEditStep,
  getLocalAiConfig,
  getLocalAiModels,
  localEditMessages,
  resolveLocalAiIntent,
} from "@/wab/server/copilot/local-edit";
import {
  LocalAiAttachment,
  LocalEditRequest,
} from "@/wab/shared/copilot/local-edit";
import { Server, createServer } from "node:http";
import { AddressInfo } from "node:net";
const config = vi.hoisted(() => ({
  baseUrl: "",
  apiKey: "fixture-key",
  model: "fixture-model",
  models: ["fixture-model", "alternate-model"] as string[] | undefined,
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
const attachments: LocalAiAttachment[] = [
  {
    type: "text",
    name: "requirements.md",
    text: "Use a table with a status filter.",
  },
  {
    type: "file",
    name: "reference.png",
    mediaType: "image/png",
    data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8XcAAAAASUVORK5CYII=",
  },
  {
    type: "file",
    name: "requirements.pdf",
    mediaType: "application/pdf",
    data: Buffer.from("%PDF-1.7\nrequirements").toString("base64"),
  },
];
let server: Server;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it.each(["selection", "component", "canvas", "page"] as const)(
  "uses actual SDK tool schemas for scope=%s",
  async (scope) => {
    let body: Record<string, any> = {};
    server = createServer(async (req, res) => {
      const parts: Buffer[] = [];
      for await (const part of req) {
        parts.push(part);
      }
      body = JSON.parse(Buffer.concat(parts).toString());
      expect(req.url).toBe("/v1/chat/completions");
      expect(req.headers.authorization).toBe("Bearer fixture-key");
      expect(body.stream).toBe(true);
      res.setHeader("Content-Type", "text/event-stream");
      const argumentsJson = JSON.stringify({
        componentUuid: "page",
        elementUuid: "title",
        text: "After",
        retryOf: "failed-call",
      });
      res.write(
        `data: ${JSON.stringify({ id: "completion", model: config.model, created: 1, choices: [{ index: 0, finish_reason: null, delta: { role: "assistant", content: "Editing title", tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "changeElement", arguments: argumentsJson.slice(0, 20) } }] } }] })}\n\n`,
      );
      res.end(
        `data: ${JSON.stringify({ id: "completion", model: config.model, created: 1, choices: [{ index: 0, finish_reason: "tool_calls", delta: { tool_calls: [{ index: 0, function: { arguments: argumentsJson.slice(20) } }] } }], usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 } })}\n\ndata: [DONE]\n\n`,
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    config.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    const result = await generateLocalEditStep(
      scope !== "selection"
        ? {
            ...request,
            attachments,
            model: scope === "page" ? "alternate-model" : undefined,
            binding: {
              ...request.binding,
              mode: scope === "page" ? "page" : undefined,
              componentUuid:
                scope === "canvas" ? null : request.binding.componentUuid,
              canvasName: scope === "canvas" ? "PageGroup" : undefined,
              elementUuids: [],
            },
          }
        : { ...request, attachments },
      "commentary",
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      text: "Editing title",
      calls: [
        {
          id: "call-1",
          name: "changeElement",
          input: { text: "After" },
          retryOf: "failed-call",
        },
      ],
    });
    expect(result.calls[0].input).not.toHaveProperty("retryOf");
    expect(
      body.tools.find((tool: any) => tool.function.name === "changeElement")
        .function.parameters.properties.retryOf.type,
    ).toBe("string");
    expect(body.model).toBe(
      scope === "page" ? "alternate-model" : config.model,
    );
    expect(body.max_tokens).toBe(8192);
    const system = body.messages
      .filter((message: any) => message.role === "system")
      .map((message: any) => message.content)
      .join("\n");
    expect(system).toContain("If a component is not found");
    expect(system).toContain("retryOf");
    expect(system).toContain(
      "Do not retry a successful call merely because it contains cleanup messages",
    );
    expect(system).toContain("Audit every ignored item");
    expect(system).toContain("not lists of discarded style or prop names");
    const userContent = body.messages.find(
      (message: any) => message.role === "user",
    ).content;
    expect(userContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("Use a table with a status filter."),
        }),
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${attachments[1].type === "file" ? attachments[1].data : ""}`,
          },
        },
        {
          type: "file",
          file: {
            filename: "requirements.pdf",
            file_data: `data:application/pdf;base64,${attachments[2].type === "file" ? attachments[2].data : ""}`,
          },
        },
      ]),
    );
    const names = body.tools.map((t: any) => t.function.name);
    expect(names).toContain("createState");
    expect(names).toContain("setPageViewport");
    expect(names).toContain("navigate");
    expect(names).toContain("createInteraction");
    expect(names).toContain("updateInteraction");
    expect(names).toContain("deleteInteraction");
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

it("rejects a provider disconnect before a tool call finishes", async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const part of req) {
      chunks.push(part);
    }
    expect(JSON.parse(Buffer.concat(chunks).toString()).stream).toBe(true);
    res.setHeader("Content-Type", "text/event-stream");
    res.write(
      `data: ${JSON.stringify({ id: "partial", model: config.model, created: 1, choices: [{ index: 0, finish_reason: null, delta: { role: "assistant", tool_calls: [{ index: 0, id: "partial-call", type: "function", function: { name: "changeElement", arguments: '{"componentUuid":"page"' } }] } }] })}\n\n`,
    );
    setTimeout(() => res.destroy(), 20);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  config.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  await expect(
    generateLocalEditStep(request, "commentary", new AbortController().signal),
  ).rejects.toThrow();
});

it("cancels an active provider stream when the task is stopped", async () => {
  const controller = new AbortController();
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const part of req) {
      chunks.push(part);
    }
    expect(JSON.parse(Buffer.concat(chunks).toString()).stream).toBe(true);
    res.setHeader("Content-Type", "text/event-stream");
    res.write(
      `data: ${JSON.stringify({ id: "partial", model: config.model, created: 1, choices: [{ index: 0, finish_reason: null, delta: { role: "assistant", content: "Starting" } }] })}\n\n`,
    );
    setTimeout(() => controller.abort(), 20);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  config.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  await expect(
    generateLocalEditStep(request, "commentary", controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
});

it("rejects a token-limited response before returning any tools", async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const part of req) {
      chunks.push(part);
    }
    expect(JSON.parse(Buffer.concat(chunks).toString()).stream).toBe(true);
    res.setHeader("Content-Type", "text/event-stream");
    res.end(
      `data: ${JSON.stringify({ id: "limited", model: config.model, created: 1, choices: [{ index: 0, finish_reason: "length", delta: { role: "assistant", content: "Partial output" } }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  config.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  await expect(
    generateLocalEditStep(request, "commentary", new AbortController().signal),
  ).rejects.toThrow("AI response did not complete");
});

it.each([
  { mode: "edit" },
  { mode: "page", name: "RecordsPage", path: "/records" },
])("resolves intent through a validated model tool: %j", async (intent) => {
  let body: Record<string, any> = {};
  server = createServer(async (req, res) => {
    const parts: Buffer[] = [];
    for await (const part of req) {
      parts.push(part);
    }
    body = JSON.parse(Buffer.concat(parts).toString());
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "intent",
        model: config.model,
        created: 1,
        choices: [
          {
            index: 0,
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "intent-1",
                  type: "function",
                  function: {
                    name: "resolveIntent",
                    arguments: JSON.stringify(intent),
                  },
                },
              ],
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  config.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  expect(
    await resolveLocalAiIntent(
      {
        prompt: "User request",
        hasCurrentPage: true,
        model: "alternate-model",
      },
      new AbortController().signal,
    ),
  ).toEqual(intent);
  expect(body.model).toBe("alternate-model");
  expect(body.tool_choice).toMatchObject({
    type: "function",
    function: { name: "resolveIntent" },
  });
  expect(body.messages[0].content).toContain("when intent is ambiguous");
});

it("rejects a model outside the server catalog before calling the provider", async () => {
  await expect(
    generateLocalEditStep(
      { ...request, model: "unavailable" },
      "commentary",
      new AbortController().signal,
    ),
  ).rejects.toThrow("not available");
  await expect(
    resolveLocalAiIntent(
      { prompt: "Create page", hasCurrentPage: true, model: "unavailable" },
      new AbortController().signal,
    ),
  ).rejects.toThrow("not available");
});
it("discovers and caches service models without returning credentials", async () => {
  const original = config.models;
  config.models = undefined;
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [{ id: "alternate-model" }, { id: "alternate-model" }],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PLASMIC_AI_BASE_URL", "https://model-catalog.example/v1");
  try {
    expect(await getLocalAiModels()).toEqual([
      "fixture-model",
      "alternate-model",
    ]);
    expect(await getLocalAiModels()).toEqual([
      "fixture-model",
      "alternate-model",
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://model-catalog.example/v1/models",
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer fixture-key",
    );
  } finally {
    config.models = original;
    vi.unstubAllGlobals();
  }
});
it("uses explicitly configured models without discovery", async () => {
  vi.stubEnv(
    "PLASMIC_AI_MODELS",
    " alternate-model, custom-model, alternate-model ",
  );
  expect(await getLocalAiModels()).toEqual([
    "fixture-model",
    "alternate-model",
    "custom-model",
  ]);
});
it("retains the default model when discovery is unsupported", async () => {
  const original = config.models;
  config.models = undefined;
  vi.stubEnv("PLASMIC_AI_BASE_URL", "https://no-catalog.example/v1");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  try {
    expect(await getLocalAiModels()).toEqual(["fixture-model"]);
  } finally {
    config.models = original;
    vi.unstubAllGlobals();
  }
});

it("retries discovery after a transient failure instead of caching the fallback", async () => {
  const original = config.models;
  config.models = undefined;
  vi.stubEnv("PLASMIC_AI_BASE_URL", "https://transient-catalog.example/v1");
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error("Transient failure"))
    .mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "alternate-model" }] }),
    });
  vi.stubGlobal("fetch", fetchMock);
  try {
    expect(await getLocalAiModels()).toEqual(["fixture-model"]);
    expect(await getLocalAiModels()).toEqual([
      "fixture-model",
      "alternate-model",
    ]);
    expect(await getLocalAiModels()).toEqual([
      "fixture-model",
      "alternate-model",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    config.models = original;
    vi.unstubAllGlobals();
  }
});

it("sends High thinking and streams upstream reasoning separately from the tool-free final answer", async () => {
  const chunks: { type: string; text: string; complete: boolean }[] = [];
  server = createServer(async (req, res) => {
    const bytes: Buffer[] = [];
    for await (const part of req) {
      bytes.push(part);
    }
    const body = JSON.parse(Buffer.concat(bytes).toString());
    expect(body.reasoning_effort).toBe("high");
    expect(body.extra_body.google.thinking_config).toEqual({
      include_thoughts: true,
    });
    expect(body.tools).toBeUndefined();
    expect(body.messages[0].content).toContain("final response stage");
    res.setHeader("Content-Type", "text/event-stream");
    const emit = (delta: unknown, finish_reason: string | null = null) =>
      res.write(
        `data: ${JSON.stringify({ id: "final", model: config.model, created: 1, choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
      );
    emit({
      role: "assistant",
      reasoning_content: "Checking recorded results.",
    });
    emit({ content: "The title was updated." });
    emit({}, "stop");
    res.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  config.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  const result = await generateLocalEditStep(
    request,
    "answer",
    new AbortController().signal,
    async (part) => {
      chunks.push(part);
    },
  );
  expect(result.reasoning).toBe("Checking recorded results.");
  expect(result.text).toBe("The title was updated.");
  expect(chunks).toEqual([
    { type: "reasoning", text: "Checking recorded results.", complete: false },
    { type: "reasoning", text: "", complete: true },
    { type: "markdown", text: "The title was updated.", complete: false },
    { type: "markdown", text: "", complete: true },
  ]);
});
