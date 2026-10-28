import { aiChatRun } from "@/wab/server/copilot/ai-workflow";
import type { LocalEditResponse } from "@/wab/shared/copilot/local-edit";
const fixture = vi.hoisted(() => {
  const order: string[] = [],
    names = new Map<string, string>();
  const state = {
    status: "running",
    changed: false,
    componentUuid: "page" as string | null,
  };
  const a = {
    loadRun: vi.fn(async () => ({
      status: state.status,
      hasChanges: state.changed,
      task: {
        binding: {
          componentUuid: state.componentUuid,
          canvasName: state.componentUuid ? undefined : "PageGroup",
          elementUuids: [],
        },
      },
    })),
    runState: vi.fn(async () => ({ status: state.status })),
    chooseIntent: vi.fn(async (): Promise<import("@/wab/shared/copilot/local-edit").LocalAiIntent> => ({mode: "edit"})),
    requestTool: vi.fn(async (_run: string, id: string, name: string) => {
      names.set(id, name);
      order.push(name);
      if (name === "changeElement") {
        state.changed = true;
      }
    }),
    readTool: vi.fn(async (id: string) => ({
      status: "completed",
      result: {
        result:
          names.get(id) === "validate" ? '{"valid":true}' : '{"revision":12}',
        binding: {},
        changed: false,
      },
    })),
    setRun: vi.fn(async (_run: string, patch: { status?: string }) => {
      if (patch.status) {
        state.status = patch.status;
      }
    }),
    modelStep: vi.fn(
      async (
        _run: string,
        step: number,
        _resources: string[],
        channel: string,
      ): Promise<LocalEditResponse> => {
        order.push(channel);
        return channel === "answer"
          ? { text: "Saved revision 12", calls: [] }
          : {
              text: "Working",
              calls:
                step === 0
                  ? [
                      {
                        id: "change",
                        name: "changeElement",
                        input: { text: "Updated" },
                      },
                    ]
                  : [],
            };
      },
    ),
    recordModelResult: vi.fn(async () => {}),
  };
  return { a, order, state, names };
});
vi.mock("@temporalio/workflow", () => ({
  proxyActivities: () => fixture.a,
  sleep: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.order.length = 0;
  fixture.state.status = "running";
  fixture.state.changed = false;
  fixture.state.componentUuid = "page";
  fixture.names.clear();
});
it("validates and saves before requesting the explicit final answer channel", async () => {
  await aiChatRun("run");
  expect(fixture.order).toEqual([
    "read",
    "read",
    "commentary",
    "changeElement",
    "commentary",
    "validate",
    "save",
    "answer",
  ]);
  expect(fixture.a.modelStep.mock.calls.map((call) => call[3])).toEqual([
    "commentary",
    "commentary",
    "answer",
  ]);
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
  expect(fixture.a.modelStep.mock.calls.at(-1)?.[2]).toEqual([
    "run:0",
    "run:1",
    "run:3",
    "run:4",
  ]);
});

it("answers discussion requests without mutation, structural validation or saving", async () => {
  fixture.a.chooseIntent.mockResolvedValueOnce({mode: "discuss"});
  fixture.a.modelStep.mockImplementationOnce(async () => {
    fixture.order.push("commentary");
    return {text: "Proposed improvements", calls: []};
  });
  await aiChatRun("run");
  expect(fixture.a.setRun).toHaveBeenCalledWith("run", {intent: "discuss"});
  expect(fixture.order).toEqual(["read", "read", "commentary", "answer"]);
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {status: "completed", phase: "Completed"});
});

it("passes the explicitly declared failed call identity to the retry operation", async () => {
  fixture.a.modelStep.mockImplementationOnce(async () => ({
    text: "Read context",
    calls: [{ id: "bad-context", name: "getEditorContext", input: {} }],
  }));
  fixture.a.modelStep.mockImplementationOnce(async () => ({
    text: "Retry context",
    calls: [
      {
        id: "retry-context",
        name: "getEditorContext",
        input: {},
        retryOf: "bad-context",
      },
    ],
  }));
  fixture.a.readTool.mockImplementation(async (id) => ({
    status: id === "run:2" ? "failed" : "completed",
    error: "Invalid arguments",
    result: {
      result: fixture.names.get(id) === "validate" ? '{"valid":true}' : "{}",
      binding: {},
      changed: false,
    },
  }));
  await aiChatRun("run");
  expect(fixture.a.requestTool).toHaveBeenCalledWith(
    "run",
    "run:3",
    "getEditorContext",
    {},
    "run:2",
  );
  expect(fixture.a.recordModelResult).toHaveBeenCalledWith(
    "run",
    0,
    "bad-context",
    undefined,
    "Invalid arguments",
  );
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
});

it("runs from the canvas overview without requiring a focused page", async () => {
  fixture.state.componentUuid = null;
  await aiChatRun("run");
  expect(fixture.a.requestTool).toHaveBeenCalledWith(
    "run",
    "run:0",
    "getEditorContext",
    {},
    undefined,
  );
  expect(fixture.a.requestTool).toHaveBeenCalledWith(
    "run",
    "run:1",
    "read",
    {},
    undefined,
  );
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
});

it("lets the model read contracts and repair a missing component without ending the design task", async () => {
  fixture.a.modelStep
    .mockImplementationOnce(async () => ({
      text: "Insert widget",
      calls: [
        {
          id: "missing",
          name: "insertHtml",
          input: {
            html: '<plasmic-component data-plasmic-component="Missing" />',
          },
        },
        {
          id: "dependent",
          name: "changeElement",
          input: { elementUuid: "not-created" },
        },
      ],
    }))
    .mockImplementationOnce(async () => ({
      text: "Read installed contracts",
      calls: [{ id: "contracts", name: "read", input: {} }],
    }))
    .mockImplementationOnce(async () => ({
      text: "Retry with the registered name",
      calls: [
        {
          id: "fixed",
          name: "insertHtml",
          input: {
            html: '<plasmic-component data-plasmic-component="Registered" />',
          },
          retryOf: "missing",
        },
      ],
    }))
    .mockImplementationOnce(async () => ({ text: "Done", calls: [] }));
  const completedTool = async () => ({
    status: "completed",
    result: { result: "{}", binding: {}, changed: false },
  });
  fixture.a.readTool
    .mockImplementationOnce(completedTool)
    .mockImplementationOnce(completedTool)
    .mockImplementationOnce(async () => ({
      status: "failed",
      error:
        'Component "Missing" was not found. Read installed component contracts and retry.',
      result: { result: "{}", binding: {}, changed: false },
    }));
  await aiChatRun("run");
  expect(fixture.a.recordModelResult).toHaveBeenCalledWith(
    "run",
    0,
    "missing",
    undefined,
    expect.stringContaining('Component "Missing"'),
  );
  expect(fixture.a.recordModelResult).toHaveBeenCalledWith(
    "run",
    0,
    "dependent",
    undefined,
    expect.stringContaining("Skipped after a rejected call"),
  );
  expect(fixture.a.requestTool).not.toHaveBeenCalledWith(
    "run",
    expect.anything(),
    "changeElement",
    expect.anything(),
    expect.anything(),
  );
  expect(fixture.a.requestTool).toHaveBeenCalledWith(
    "run",
    "run:4",
    "insertHtml",
    { html: '<plasmic-component data-plasmic-component="Registered" />' },
    "run:2",
  );
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
});

it("restores the repair budget after each successful correction", async () => {
  fixture.a.modelStep.mockImplementation(
    async (_run, step, _resources, channel) => {
      if (channel === "answer") {
        return { text: "Completed the design", calls: [] };
      }
      if (step >= 8) {
        return { text: "Done", calls: [] };
      }
      const pair = Math.floor(step / 2);
      const correcting = step % 2 === 1;
      return {
        text: correcting
          ? "Correct the component reference"
          : "Insert component",
        calls: [
          {
            id: `${correcting ? "fixed" : "missing"}-${pair}`,
            name: "insertHtml",
            input: {
              html: `<plasmic-component data-plasmic-component="${correcting ? "Registered" : "Missing"}${pair}" />`,
            },
            ...(correcting ? { retryOf: `missing-${pair}` } : {}),
          },
        ],
      };
    },
  );
  fixture.a.readTool.mockImplementation(async (id) => {
    const index = Number(id.split(":").at(-1));
    return {
      status:
        index >= 2 && index < 10 && index % 2 === 0 ? "failed" : "completed",
      error: "Component not found; correct the reference and retry",
      result: {
        result: fixture.names.get(id) === "validate" ? '{"valid":true}' : "{}",
        binding: {},
        changed: false,
      },
    };
  });
  await aiChatRun("run");
  expect(
    fixture.a.requestTool.mock.calls.filter((call) => call[2] === "insertHtml"),
  ).toHaveLength(8);
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "completed",
    phase: "Completed",
  });
});

it("still stops repeated unsuccessful repairs", async () => {
  fixture.a.modelStep.mockImplementation(async (_run, step) => ({
    text: "Correct the component reference",
    calls: [
      {
        id: `attempt-${step}`,
        name: "insertHtml",
        input: {
          html: `<plasmic-component data-plasmic-component="Missing${step}" />`,
        },
        ...(step > 0 ? { retryOf: `attempt-${step - 1}` } : {}),
      },
    ],
  }));
  fixture.a.readTool.mockImplementation(async (id) => ({
    status: fixture.names.get(id) === "insertHtml" ? "failed" : "completed",
    error: "Component not found",
    result: { result: "{}", binding: {}, changed: false },
  }));
  await aiChatRun("run");
  expect(
    fixture.a.requestTool.mock.calls.filter((call) => call[2] === "insertHtml"),
  ).toHaveLength(4);
  expect(fixture.a.setRun).toHaveBeenLastCalledWith("run", {
    status: "failed",
    phase: "Failed",
    error: "Component not found",
  });
});
